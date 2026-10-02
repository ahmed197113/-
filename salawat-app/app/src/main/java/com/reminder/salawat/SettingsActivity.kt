package com.reminder.salawat

import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.reminder.salawat.databinding.ActivitySettingsBinding

/** All preferences in one place, grouped into clear sections. Rebuilt on resume so values stay current. */
class SettingsActivity : AppCompatActivity(), PermissionHost {

    override val permissions = PermissionRequester(this)
    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.toolbar.setTitle(R.string.settings_title)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val c = binding.settingsContainer
        c.removeAllViews()
        val prefs = Prefs.get(this)
        val prayerPrefs = PrayerRepository.prefs(this)

        // Prayer times & adhan
        Ui.sectionTitle(c, getString(R.string.settings_section_prayer))
        val prayer = Ui.card(c)
        Ui.row(prayer, R.drawable.ic_location, getString(R.string.location_change),
            PrayerRepository.placeLabel(this) ?: getString(R.string.home_place_unknown)) {
            LocationSheet.show(this, permissions) { render() }
        }
        Ui.row(prayer, R.drawable.ic_clock, getString(R.string.method_title), Ui.methodLabel(this)) { chooseMethod() }
        val alertsOn = PrayerRepository.alertsOn(this)
        Ui.row(prayer, R.drawable.ic_bell, getString(R.string.settings_prayer_alerts),
            if (alertsOn) getString(R.string.settings_prayer_alerts_on, Prayer.values().count { PrayerRepository.isAlertEnabled(this, it) })
            else getString(R.string.settings_off),
            switchChecked = alertsOn) {
            if (alertsOn) {
                prayerPrefs.edit().putBoolean(PrayerRepository.KEY_ALERTS, false).apply()
                PrayerScheduler.schedule(this)
                render()
            } else {
                permissions.requestNotifications { granted ->
                    prayerPrefs.edit().putBoolean(PrayerRepository.KEY_ALERTS, granted).apply()
                    PrayerScheduler.schedule(this)
                    render()
                }
            }
        }
        Ui.row(prayer, R.drawable.ic_volume, getString(R.string.tile_adhan), Ui.adhanLabel(this)) {
            startActivity(Intent(this, AdhanSettingsActivity::class.java))
        }
        if (alertsOn && !PrayerScheduler.canScheduleExact(this) && Build.VERSION.SDK_INT >= 31) {
            Ui.row(prayer, R.drawable.ic_clock, getString(R.string.settings_exact), getString(R.string.settings_exact_needed)) {
                runCatching {
                    startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                }
            }
        }

        // Salawat reminder
        Ui.sectionTitle(c, getString(R.string.settings_section_reminder))
        val reminder = Ui.card(c)
        val reminderOn = prefs.getBoolean(Prefs.KEY_REMINDER_ENABLED, false) && Notifications.canPost(this)
        Ui.row(reminder, R.drawable.ic_heart, getString(R.string.settings_reminder),
            if (reminderOn) getString(R.string.reminder_every, Ui.intervalLabel(this)) else getString(R.string.settings_off),
            switchChecked = reminderOn) {
            if (reminderOn) {
                prefs.edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, false).apply()
                ReminderWorker.apply(this)
                render()
            } else {
                permissions.requestNotifications { granted ->
                    prefs.edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, granted).apply()
                    ReminderWorker.apply(this)
                    render()
                }
            }
        }
        Ui.row(reminder, R.drawable.ic_refresh, getString(R.string.settings_interval), Ui.intervalLabel(this)) { chooseInterval() }
        val quietOn = prefs.getBoolean(Prefs.KEY_QUIET_ENABLED, false)
        Ui.row(reminder, R.drawable.ic_moon, getString(R.string.settings_quiet),
            if (quietOn) getString(R.string.settings_quiet_range, Prefs.formatMinutes(Prefs.quietStart(this)), Prefs.formatMinutes(Prefs.quietEnd(this)))
            else getString(R.string.settings_off),
            switchChecked = quietOn) {
            if (quietOn) {
                prefs.edit().putBoolean(Prefs.KEY_QUIET_ENABLED, false).apply()
                render()
            } else {
                pickQuietHours()
            }
        }

        // Quran
        Ui.sectionTitle(c, getString(R.string.settings_section_quran))
        val quran = Ui.card(c)
        Ui.row(quran, R.drawable.ic_volume, getString(R.string.settings_reciter), Reciters.selected(this).name) {
            choose(getString(R.string.quran_choose_reciter), Reciters.ALL.map { it.name }, Reciters.ALL.indexOf(Reciters.selected(this))) {
                prefs.edit().putString(Prefs.KEY_RECITER, Reciters.ALL[it].id).apply()
            }
        }
        Ui.row(quran, R.drawable.ic_quran, getString(R.string.settings_tafsir), Tafasir.selected(this).second) {
            choose(getString(R.string.quran_choose_tafsir), Tafasir.ALL.map { it.second }, Tafasir.ALL.indexOf(Tafasir.selected(this))) {
                prefs.edit().putString(Prefs.KEY_TAFSIR, Tafasir.ALL[it].first).apply()
            }
        }

        // Display
        Ui.sectionTitle(c, getString(R.string.settings_section_display))
        val display = Ui.card(c)
        val themes = resources.getStringArray(R.array.theme_labels)
        val theme = prefs.getInt(Prefs.KEY_THEME, 0)
        Ui.row(display, R.drawable.ic_sun, getString(R.string.settings_theme), themes[theme]) {
            choose(getString(R.string.settings_theme), themes.toList(), theme) {
                prefs.edit().putInt(Prefs.KEY_THEME, it).apply()
                SalawatApp.applyTheme(this)
            }
        }
        c.addView(View(this).apply { minimumHeight = 1 })
    }

    private fun choose(title: String, items: List<String>, selected: Int, onChosen: (Int) -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setSingleChoiceItems(items.toTypedArray(), selected) { dialog, which ->
                onChosen(which)
                dialog.dismiss()
                render()
            }
            .show()
    }

    private fun chooseMethod() {
        val labels = resources.getStringArray(R.array.prayer_method_labels).toList()
        val current = PrayerRepository.METHOD_IDS.indexOf(
            PrayerRepository.prefs(this).getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)
        )
        choose(getString(R.string.method_title), labels, current) {
            PrayerRepository.prefs(this).edit().putInt(PrayerRepository.KEY_METHOD, PrayerRepository.METHOD_IDS[it]).apply()
            PrayerRefreshWorker.runOnce(this)
        }
    }

    private fun chooseInterval() {
        val labels = resources.getStringArray(R.array.reminder_interval_labels).toList()
        val current = Prefs.INTERVAL_OPTIONS.indexOf(Prefs.reminderInterval(this)).coerceAtLeast(0)
        choose(getString(R.string.settings_interval), labels, current) {
            Prefs.get(this).edit().putLong(Prefs.KEY_REMINDER_INTERVAL, Prefs.INTERVAL_OPTIONS[it]).apply()
            ReminderWorker.apply(this)
        }
    }

    private fun pickQuietHours() {
        val prefs = Prefs.get(this)
        val start = Prefs.quietStart(this)
        TimePickerDialog(this, { _, h, m ->
            prefs.edit().putInt(Prefs.KEY_QUIET_START, h * 60 + m).apply()
            val end = Prefs.quietEnd(this)
            TimePickerDialog(this, { _, h2, m2 ->
                prefs.edit().putInt(Prefs.KEY_QUIET_END, h2 * 60 + m2).putBoolean(Prefs.KEY_QUIET_ENABLED, true).apply()
                render()
            }, end / 60, end % 60, false).apply { setTitle(R.string.quiet_hours_pick_end) }.show()
        }, start / 60, start % 60, false).apply { setTitle(R.string.quiet_hours_pick_start) }.show()
    }
}
