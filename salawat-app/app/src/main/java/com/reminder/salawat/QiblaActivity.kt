package com.reminder.salawat

import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.reminder.salawat.databinding.ActivityQiblaBinding
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class QiblaActivity : LocalizedActivity(), SensorEventListener, PermissionHost {

    override val permissions = PermissionRequester(this)

    private lateinit var binding: ActivityQiblaBinding
    private lateinit var sensorManager: SensorManager
    private var qiblaBearing = 0f
    private var declination = 0f
    private var smoothedAzimuth = Float.NaN
    private val rotationMatrix = FloatArray(9)
    private val orientation = FloatArray(3)
    private var gravity: FloatArray? = null
    private var geomagnetic: FloatArray? = null
    private val remapped = FloatArray(9)
    /** Magnetometer accuracy as reported by the phone: below MEDIUM the compass needs a figure-8 calibration. */
    private var magAccuracy = SensorManager.SENSOR_STATUS_ACCURACY_HIGH
    private var wasAligned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQiblaBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.toolbar.setTitle(R.string.qibla_title)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
        sensorManager = getSystemService(SensorManager::class.java)

        val location = PrayerRepository.location(this)
        if (location == null) {
            binding.textQiblaAngle.text = getString(R.string.qibla_need_location)
            binding.imageArrow.visibility = View.GONE
            binding.textQiblaHint.visibility = View.GONE
            binding.btnQiblaLocation.visibility = View.VISIBLE
            binding.btnQiblaLocation.setOnClickListener {
                LocationSheet.show(this, permissions) { recreate() }
            }
            return
        }
        val (lat, lng) = location
        qiblaBearing = bearingToKaaba(lat, lng)
        declination = GeomagneticField(lat.toFloat(), lng.toFloat(), 0f, System.currentTimeMillis()).declination
        val degrees = qiblaBearing.roundToInt()
        binding.textQiblaAngle.text = if (hasCompass()) getString(R.string.qibla_angle, degrees)
        else getString(R.string.qibla_no_sensor, degrees)
        if (!hasCompass()) binding.imageArrow.rotation = qiblaBearing
    }

    private fun hasCompass() =
        sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null ||
            sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null

    override fun onResume() {
        super.onResume()
        if (PrayerRepository.location(this) == null) return
        val rotation = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (rotation != null) {
            sensorManager.registerListener(this, rotation, SensorManager.SENSOR_DELAY_GAME)
            // Only for its accuracy reports (calibration prompt).
            sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
            }
        } else {
            sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
            }
            sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        val usingRotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
            Sensor.TYPE_ACCELEROMETER -> { gravity = event.values.clone(); if (!fromAccelMag()) return }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                updateAccuracy(event.accuracy)
                if (usingRotationVector) return
                geomagnetic = event.values.clone(); if (!fromAccelMag()) return
            }
            else -> return
        }
        // Held upright (screen facing you, like a camera) the flat-phone azimuth is unstable: measure the direction
        // the back of the phone points instead. Lying flat, the top edge of the phone is the pointer.
        val pitch = Math.toDegrees(kotlin.math.asin((-rotationMatrix[7]).coerceIn(-1f, 1f).toDouble()))
        val matrix = if (abs(pitch) > 50) {
            SensorManager.remapCoordinateSystem(rotationMatrix, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped)
            remapped
        } else rotationMatrix
        SensorManager.getOrientation(matrix, orientation)
        val magneticAzimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
        val trueAzimuth = (magneticAzimuth + declination + 360f) % 360f
        smoothedAzimuth = if (smoothedAzimuth.isNaN()) trueAzimuth else smoothAngle(smoothedAzimuth, trueAzimuth)
        val arrow = (qiblaBearing - smoothedAzimuth + 360f) % 360f
        binding.imageArrow.rotation = arrow
        val off = if (arrow > 180f) 360f - arrow else arrow
        val aligned = abs(off) < 4f
        binding.textAligned.visibility = if (aligned) View.VISIBLE else View.INVISIBLE
        if (aligned && !wasAligned) binding.imageArrow.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
        wasAligned = aligned
    }

    private fun updateAccuracy(accuracy: Int) {
        magAccuracy = accuracy
        val needsCalibration = accuracy == SensorManager.SENSOR_STATUS_UNRELIABLE ||
            accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW
        binding.textQiblaHint.setText(if (needsCalibration) R.string.qibla_calibrate else R.string.qibla_instructions)
        binding.textQiblaHint.setTextColor(Themes.color(this, if (needsCalibration) R.color.error_text else R.color.text_secondary_light))
    }

    private fun fromAccelMag(): Boolean {
        val g = gravity ?: return false
        val m = geomagnetic ?: return false
        return SensorManager.getRotationMatrix(rotationMatrix, null, g, m)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        if (sensor?.type == Sensor.TYPE_MAGNETIC_FIELD) updateAccuracy(accuracy)
    }

    companion object {
        private const val KAABA_LAT = 21.422487
        private const val KAABA_LNG = 39.826206

        fun bearingToKaaba(lat: Double, lng: Double): Float {
            val phi1 = Math.toRadians(lat)
            val phi2 = Math.toRadians(KAABA_LAT)
            val dLambda = Math.toRadians(KAABA_LNG - lng)
            val y = sin(dLambda) * cos(phi2)
            val x = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dLambda)
            return ((Math.toDegrees(atan2(y, x)) + 360.0) % 360.0).toFloat()
        }

        /** Low-pass filter that handles the 359°→0° wrap. */
        private fun smoothAngle(current: Float, target: Float): Float {
            var delta = target - current
            if (delta > 180f) delta -= 360f
            if (delta < -180f) delta += 360f
            return (current + delta * 0.1f + 360f) % 360f
        }
    }
}
