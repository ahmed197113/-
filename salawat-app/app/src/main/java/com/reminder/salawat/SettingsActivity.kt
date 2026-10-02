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
        val asrLabels = resources.getStringArray(R.array.asr_labels)
        val school = prayerPrefs.getInt(PrayerRepository.KEY_SCHOOL, 0)
        Ui.row(prayer, R.drawable.ic_sun, getString(R.string.settings_asr), asrLabels[school]) {
            choose(getString(R.string.settings_asr), asrLabels.toList(), school) {
                prayerPrefs.edit().putInt(PrayerRepository.KEY_SCHOOL, it).apply()
                PrayerRepository.settingsChanged(this)
            }
        }
        val offsets = Prayer.values().filter { PrayerRepository.offset(this, it) != 0 }
        Ui.row(prayer, R.drawable.ic_refresh, getString(R.string.settings_offsets),
            if (offsets.isEmpty()) getString(R.string.settings_offsets_desc)
            else offsets.joinToString("، ") { "${getString(it.nameRes)} ${getString(R.string.settings_offset_value, PrayerRepository.offset(this, it))}" }) {
            editOffsets()
        }
        val hijri = HijriDate.offset(this)
        Ui.row(prayer, R.drawable.ic_moon, getString(R.string.settings_hijri),
            "${HijriDate.today(this)}" + if (hijri != 0) " (${getString(R.string.settings_hijri_value, hijri)})" else "") {
            val options = listOf(-2, -1, 0, 1, 2)
            choose(getString(R.string.settings_hijri), options.map { getString(R.string.settings_hijri_value, it) }, options.indexOf(hijri)) {
                HijriDate.setOffset(this, options[it])
                Reminders.schedule(this)
            }
        }
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

        Ui.row(reminder, R.drawable.ic_bell, getString(R.string.tool_reminders), getString(R.string.settings_reminders_desc)) {
            startActivity(Intent(this, RemindersActivity::class.java))
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
            PrayerRepository.settingsChanged(this)
        }
    }

    /** Per-prayer ± minutes, applied through the API's "tune" so alarms and widgets agree. */
    private fun editOffsets() {
        val prayers = Prayer.values().toList()
        val values = prayers.map { PrayerRepository.offset(this, it) }.toMutableList()
        val list = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 24, 48, 8)
        }
        prayers.forEachIndexed { i, p ->
            val line = android.widget.LinearLayout(this).apply { gravity = android.view.Gravity.CENTER_VERTICAL }
            val name = android.widget.TextView(this, null, 0, R.style.Text_TitleSmall).apply { text = getString(p.nameRes) }
            line.addView(name, android.widget.LinearLayout.LayoutParams(0, -2, 1f))
            val value = android.widget.TextView(this, null, 0, R.style.Text_TitleMedium).apply {
                gravity = android.view.Gravity.CENTER
                text = getString(R.string.settings_offset_value, values[i])
            }
            fun step(delta: Int) = com.google.android.material.button.MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = if (delta > 0) "+" else "−"
                minWidth = 0; minimumWidth = 0
                setOnClickListener {
                    values[i] = (values[i] + delta).coerceIn(-30, 30)
                    value.text = getString(R.string.settings_offset_value, values[i])
                }
            }
            line.addView(step(-1), android.widget.LinearLayout.LayoutParams(130, 130))
            line.addView(value, android.widget.LinearLayout.LayoutParams(220, -2))
            line.addView(step(1), android.widget.LinearLayout.LayoutParams(130, 130))
            list.addView(line)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.settings_offsets)
            .setView(android.widget.ScrollView(this).apply { addView(list) })
            .setPositiveButton(R.string.done) { _, _ ->
                prayers.forEachIndexed { i, p -> PrayerRepository.setOffset(this, p, values[i]) }
                PrayerRepository.settingsChanged(this)
                render()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
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
