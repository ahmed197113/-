package com.reminder.salawat

import android.location.Geocoder
import android.location.Location
import android.view.View
import android.widget.ArrayAdapter
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.reminder.salawat.databinding.SheetLocationBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

/** One place to set the location (GPS or typed city) and calculation method, used app-wide. */
object LocationSheet {

    private data class Place(val name: String?, val countryCode: String?, val countryName: String?)

    fun show(activity: AppCompatActivity, permissions: PermissionRequester, onSaved: () -> Unit) {
        val dialog = BottomSheetDialog(activity)
        val b = SheetLocationBinding.inflate(activity.layoutInflater)
        dialog.setContentView(b.root)
        dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        dialog.behavior.skipCollapsed = true

        val prefs = PrayerRepository.prefs(activity)
        val labels = activity.resources.getStringArray(R.array.prayer_method_labels)
        var methodIndex = PrayerRepository.METHOD_IDS
            .indexOf(prefs.getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)).coerceAtLeast(0)
        var methodChosenByUser = prefs.contains(PrayerRepository.KEY_METHOD)
        b.dropdownMethod.setAdapter(ArrayAdapter(activity, R.layout.item_dropdown, labels))
        b.dropdownMethod.setText(labels[methodIndex], false)
        b.dropdownMethod.setOnItemClickListener { _, _, position, _ ->
            methodIndex = position
            methodChosenByUser = true
        }
        fun suggest(code: String?, name: String?) {
            if (methodChosenByUser) return
            methodIndex = PrayerRepository.METHOD_IDS.indexOf(PrayerRepository.suggestMethod(code, name)).coerceAtLeast(0)
            b.dropdownMethod.setText(labels[methodIndex], false)
        }

        if (!prefs.getBoolean(PrayerRepository.KEY_USE_LOCATION, false)) {
            b.editCity.setText(prefs.getString(PrayerRepository.KEY_CITY, ""))
            b.editCountry.setText(prefs.getString(PrayerRepository.KEY_COUNTRY, ""))
        } else {
            PrayerRepository.placeLabel(activity)?.let {
                b.textGpsResult.text = activity.getString(R.string.location_found, it)
                b.textGpsResult.visibility = View.VISIBLE
            }
        }

        fun busy(on: Boolean) {
            b.progressLocation.visibility = if (on) View.VISIBLE else View.GONE
            b.btnGps.isEnabled = !on
            b.btnSaveLocation.isEnabled = !on
        }
        fun error(text: String?) {
            b.textLocationError.text = text
            b.textLocationError.visibility = if (text == null) View.GONE else View.VISIBLE
        }

        fun save(onDone: () -> Unit = {}) {
            editorMethod(prefs, methodIndex)
            busy(true)
            activity.lifecycleScope.launch {
                try {
                    PrayerRepository.refresh(activity)
                    PrayerScheduler.refreshDependents(activity)
                    dialog.dismiss()
                    onDone()
                    onSaved()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    busy(false)
                    b.progressGps.visibility = View.GONE
                    b.btnGps.setText(R.string.prayer_use_location)
                    error(activity.getString(R.string.prayer_fetch_error))
                    android.widget.Toast.makeText(activity, R.string.prayer_fetch_error, android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }

        b.btnGps.setOnClickListener {
            error(null)
            LocationHelper.obtain(activity, permissions, onBusy = { on ->
                busy(on)
                b.progressGps.visibility = if (on) View.VISIBLE else View.GONE
                b.btnGps.setText(if (on) R.string.location_locating else R.string.prayer_use_location)
            }, onResult = { location ->
                if (location == null) return@obtain
                b.progressGps.visibility = View.VISIBLE
                b.btnGps.setText(R.string.location_locating)
                busy(true)
                val place = reverseGeocode(activity, location)
                b.editCity.setText("")
                b.editCountry.setText("")
                val label = place.name ?: activity.getString(R.string.prayer_my_location)
                b.textGpsResult.text = activity.getString(R.string.location_found, label)
                b.textGpsResult.visibility = View.VISIBLE
                suggest(place.countryCode, place.countryName)
                // A fix is all the user asked for: save it and refresh the times straight away.
                prefs.edit()
                    .putBoolean(PrayerRepository.KEY_USE_LOCATION, true)
                    .putFloat(PrayerRepository.KEY_LAT, location.latitude.toFloat())
                    .putFloat(PrayerRepository.KEY_LNG, location.longitude.toFloat())
                    .putString(PrayerRepository.KEY_PLACE_NAME, place.name)
                    .apply()
                save {
                    android.widget.Toast.makeText(activity, activity.getString(R.string.location_saved, label), android.widget.Toast.LENGTH_LONG).show()
                }
            })
        }

        b.btnSaveLocation.setOnClickListener {
            error(null)
            val city = b.editCity.text?.toString()?.trim().orEmpty()
            val country = b.editCountry.text?.toString()?.trim().orEmpty()
            val editor = prefs.edit()
            when {
                city.isNotEmpty() -> {
                    suggest(null, country)
                    editor.putBoolean(PrayerRepository.KEY_USE_LOCATION, false)
                        .putString(PrayerRepository.KEY_CITY, city)
                        .putString(PrayerRepository.KEY_COUNTRY, country)
                }
                PrayerRepository.isConfigured(activity) -> Unit // only the method changed
                else -> {
                    error(activity.getString(R.string.prayer_enter_city))
                    return@setOnClickListener
                }
            }
            editor.apply()
            save()
        }
        dialog.show()
    }

    private fun editorMethod(prefs: android.content.SharedPreferences, methodIndex: Int) {
        prefs.edit().putInt(PrayerRepository.KEY_METHOD, PrayerRepository.METHOD_IDS[methodIndex]).apply()
    }

    @Suppress("DEPRECATION")
    private suspend fun reverseGeocode(activity: AppCompatActivity, location: Location): Place = withContext(Dispatchers.IO) {
        runCatching {
            val address = Geocoder(activity, Locale("ar")).getFromLocation(location.latitude, location.longitude, 1)?.firstOrNull()
            if (address == null) Place(null, null, null)
            else {
                val city = address.locality ?: address.subAdminArea ?: address.adminArea
                Place(listOfNotNull(city, address.countryName).joinToString("، ").ifBlank { null }, address.countryCode, address.countryName)
            }
        }.getOrDefault(Place(null, null, null))
    }
}
