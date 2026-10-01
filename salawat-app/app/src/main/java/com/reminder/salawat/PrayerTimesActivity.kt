package com.reminder.salawat

import android.Manifest
import android.app.Application
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewModelScope
import com.reminder.salawat.databinding.ActivityPrayerTimesBinding
import com.reminder.salawat.databinding.RowPrayerTimeBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class PrayerTimesViewModel(app: Application) : AndroidViewModel(app) {
    val loading = MutableLiveData(false)
    val error = MutableLiveData<Int?>(null)
    /** Bumped after every successful refresh so the screen re-reads the cache. */
    val version = MutableLiveData(0)

    fun refresh() {
        if (loading.value == true) return
        val context = getApplication<Application>()
        loading.value = true
        error.value = null
        viewModelScope.launch {
            try {
                PrayerRepository.refresh(context)
                PrayerScheduler.refreshDependents(context)
                version.value = (version.value ?: 0) + 1
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = if (PrayerRepository.hasToday(context)) R.string.prayer_fetch_error_cached
                else R.string.prayer_fetch_error
            } finally {
                loading.value = false
            }
        }
    }
}

class PrayerTimesActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPrayerTimesBinding
    private val viewModel: PrayerTimesViewModel by viewModels()
    private val prefs by lazy { PrayerRepository.prefs(this) }

    private val rows by lazy {
        mapOf(
            Prayer.FAJR to binding.rowFajr, Prayer.SUNRISE to binding.rowSunrise, Prayer.DHUHR to binding.rowDhuhr,
            Prayer.ASR to binding.rowAsr, Prayer.MAGHRIB to binding.rowMaghrib, Prayer.ISHA to binding.rowIsha
        )
    }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) locate() else showError(getString(R.string.prayer_location_denied))
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            setAlertsEnabled(granted)
            if (!granted) binding.switchAlerts.isChecked = false
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPrayerTimesBinding.inflate(layoutInflater)
        setContentView(binding.root)

        rows.forEach { (prayer, row) -> row.textPrayerName.setText(prayer.nameRes) }

        val usingLocation = prefs.getBoolean(PrayerRepository.KEY_USE_LOCATION, false)
        binding.editCity.setText(if (usingLocation) "" else prefs.getString(PrayerRepository.KEY_CITY, ""))
        binding.editCountry.setText(if (usingLocation) "" else prefs.getString(PrayerRepository.KEY_COUNTRY, ""))
        if (usingLocation) binding.editCity.hint = getString(R.string.prayer_my_location)

        setupMethodSpinner()
        setupAlerts()

        binding.btnRefresh.setOnClickListener { refreshFromInputs() }
        binding.btnUseLocation.setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                locate()
            } else {
                locationPermissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
        }

        viewModel.loading.observe(this) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
            binding.btnRefresh.isEnabled = !loading
            binding.btnUseLocation.isEnabled = !loading
        }
        viewModel.error.observe(this) { res -> if (res == null) hideError() else showError(getString(res)) }
        viewModel.version.observe(this) { render() }

        // Fetch only when there's no cached data for today (not on every rotation).
        if (savedInstanceState == null && PrayerRepository.isConfigured(this) && !PrayerRepository.hasToday(this)) {
            viewModel.refresh()
        }
    }

    override fun onResume() {
        super.onResume()
        binding.layoutExactAlarm.visibility =
            if (binding.switchAlerts.isChecked && !PrayerScheduler.canScheduleExact(this)) View.VISIBLE else View.GONE
        render()
    }

    private fun setupMethodSpinner() {
        val labels = resources.getStringArray(R.array.prayer_method_labels)
        binding.spinnerMethod.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, labels).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        val method = prefs.getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)
        binding.spinnerMethod.setSelection(PrayerRepository.METHOD_IDS.indexOf(method).coerceAtLeast(0), false)
        binding.spinnerMethod.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selected = PrayerRepository.METHOD_IDS[position]
                if (selected == prefs.getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)) return
                prefs.edit().putInt(PrayerRepository.KEY_METHOD, selected).apply()
                if (PrayerRepository.isConfigured(this@PrayerTimesActivity)) viewModel.refresh()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun setupAlerts() {
        binding.switchAlerts.isChecked = prefs.getBoolean(PrayerRepository.KEY_ALERTS, false) && Notifications.canPost(this)
        binding.switchAlerts.setOnCheckedChangeListener { _, checked ->
            if (checked && !Notifications.canPost(this) && Build.VERSION.SDK_INT >= 33) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                setAlertsEnabled(checked)
            }
        }
        binding.btnExactAlarm.setOnClickListener {
            if (Build.VERSION.SDK_INT >= 31) {
                runCatching {
                    startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                }
            }
        }
    }

    private fun setAlertsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(PrayerRepository.KEY_ALERTS, enabled).apply()
        PrayerScheduler.schedule(this)
        binding.layoutExactAlarm.visibility =
            if (enabled && !PrayerScheduler.canScheduleExact(this)) View.VISIBLE else View.GONE
    }

    private fun refreshFromInputs() {
        val city = binding.editCity.text.toString().trim()
        val country = binding.editCountry.text.toString().trim()
        if (city.isEmpty()) {
            if (prefs.getBoolean(PrayerRepository.KEY_USE_LOCATION, false)) {
                viewModel.refresh()
            } else {
                showError(getString(R.string.prayer_enter_city))
            }
            return
        }
        prefs.edit()
            .putBoolean(PrayerRepository.KEY_USE_LOCATION, false)
            .putString(PrayerRepository.KEY_CITY, city)
            .putString(PrayerRepository.KEY_COUNTRY, country)
            .apply()
        viewModel.refresh()
    }

    private fun locate() {
        hideError()
        binding.textLastUpdate.text = getString(R.string.prayer_locating)
        binding.progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            val location = LocationHelper.currentLocation(this@PrayerTimesActivity)
            binding.progressBar.visibility = View.GONE
            if (location == null) {
                showError(getString(R.string.prayer_location_failed))
                render()
                return@launch
            }
            prefs.edit()
                .putBoolean(PrayerRepository.KEY_USE_LOCATION, true)
                .putFloat(PrayerRepository.KEY_LAT, location.latitude.toFloat())
                .putFloat(PrayerRepository.KEY_LNG, location.longitude.toFloat())
                .apply()
            binding.editCity.setText("")
            binding.editCountry.setText("")
            binding.editCity.hint = getString(R.string.prayer_my_location)
            viewModel.refresh()
        }
    }

    private fun render() {
        val day = PrayerRepository.today(this)
        if (day == null) {
            rows.values.forEach { it.textPrayerTime.text = "--:--"; highlight(it, false) }
            if (viewModel.loading.value != true) binding.textLastUpdate.text = getString(R.string.prayer_no_data)
            binding.textNext.visibility = View.GONE
            return
        }
        binding.textLastUpdate.text = getString(R.string.prayer_last_update, day.readableDate, day.hijriDate)
        val next = PrayerRepository.nextPrayer(this)
        rows.forEach { (prayer, row) ->
            row.textPrayerTime.text = day.times[prayer] ?: "--:--"
            highlight(row, next != null && next.prayer == prayer && next.time == day.times[prayer])
        }
        if (next != null) {
            binding.textNext.text = getString(R.string.next_prayer, getString(next.prayer.nameRes), next.time) +
                " — " + getString(R.string.next_prayer_remaining, MainActivity.formatRemaining(this, next.millis))
            binding.textNext.visibility = View.VISIBLE
        } else {
            binding.textNext.visibility = View.GONE
        }
    }

    private fun highlight(row: RowPrayerTimeBinding, on: Boolean) {
        row.root.setBackgroundColor(if (on) ContextCompat.getColor(this, R.color.highlight) else 0)
    }

    private fun showError(message: String) {
        binding.textError.text = message
        binding.textError.visibility = View.VISIBLE
    }

    private fun hideError() {
        binding.textError.visibility = View.GONE
    }
}
