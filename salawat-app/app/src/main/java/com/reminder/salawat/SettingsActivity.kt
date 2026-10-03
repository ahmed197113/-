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
class SettingsActivity : LocalizedActivity(), PermissionHost {

    override val permissions = PermissionRequester(this)
    private lateinit var binding: ActivitySettingsBinding

    private val exportLauncher = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) {
            val ok = runCatching { Backup.export(this, uri) }.isSuccess
            android.widget.Toast.makeText(this, if (ok) R.string.backup_done else R.string.backup_failed, android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    private val importLauncher = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val ok = runCatching { Backup.restore(this, uri) }.isSuccess
            android.widget.Toast.makeText(this, if (ok) R.string.restore_done else R.string.restore_failed, android.widget.Toast.LENGTH_LONG).show()
            if (ok) recreate()
        }
    }

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
            else offsets.joinToString(Ui.listSep()) { "${getString(it.nameRes)} ${getString(R.string.settings_offset_value, PrayerRepository.offset(this, it))}" }) {
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
        val duaOn = AdhanService.duaAfterAdhanOn(this)
        Ui.row(prayer, R.drawable.ic_heart, getString(R.string.settings_dua_after_adhan),
            getString(if (duaOn) R.string.settings_on else R.string.settings_off)) {
            AdhanService.setDuaAfterAdhan(this, !duaOn); render()
        }
        val iqamaOn = AdhanService.iqamaSoundOn(this)
        Ui.row(prayer, R.drawable.ic_volume, getString(R.string.settings_iqama_sound),
            getString(if (iqamaOn) R.string.settings_on else R.string.settings_off)) {
            AdhanService.setIqamaSound(this, !iqamaOn); render()
        }
        val batteryOk = AlertPermissions.ignoresBatteryOptimizations(this)
        Ui.row(prayer, R.drawable.ic_settings, getString(R.string.settings_battery),
            getString(if (batteryOk) R.string.settings_battery_on else R.string.settings_battery_off)) {
            if (!batteryOk) AlertPermissions.requestBatteryExemption(this)
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
        val languages = listOf("العربية", "English")
        val langIndex = Lang.SUPPORTED.indexOf(Lang.current(this)).coerceAtLeast(0)
        Ui.row(display, R.drawable.ic_apps, getString(R.string.settings_language), languages[langIndex]) {
            choose(getString(R.string.settings_language), languages, langIndex) {
                PrayerRepository.clearMemo()
                Lang.set(this, Lang.SUPPORTED[it])
            }
        }
        val themes = resources.getStringArray(R.array.theme_labels)
        val theme = prefs.getInt(Prefs.KEY_THEME, 0)
        Ui.row(display, R.drawable.ic_sun, getString(R.string.settings_theme), themes[theme]) {
            choose(getString(R.string.settings_theme), themes.toList(), theme) {
                prefs.edit().putInt(Prefs.KEY_THEME, it).apply()
                SalawatApp.applyTheme(this)
            }
        }
        val palette = Themes.selected(this)
        Ui.row(display, R.drawable.ic_star, getString(R.string.settings_color_theme), getString(palette.nameRes)) {
            choose(getString(R.string.settings_color_theme), Themes.ALL.map { getString(it.nameRes) }, Themes.ALL.indexOf(palette)) {
                Themes.select(this, Themes.ALL[it])
                recreate()
            }
        }
        val pageStyles = listOf(getString(R.string.mushaf_style_pages), getString(R.string.mushaf_style_text))
        val mushafOn = MushafMode.isOn(this)
        Ui.row(display, R.drawable.ic_quran, getString(R.string.mushaf_style), pageStyles[if (mushafOn) 0 else 1]) {
            choose(getString(R.string.mushaf_style), pageStyles, if (mushafOn) 0 else 1) { MushafMode.set(this, it == 0) }
        }
        val reading = ReadingMode.get(this)
        Ui.row(display, R.drawable.ic_quran, getString(R.string.settings_reading_mode), getString(reading.labelRes)) {
            choose(getString(R.string.settings_reading_mode), ReadingMode.values().map { getString(it.labelRes) }, reading.ordinal) {
                ReadingMode.set(this, ReadingMode.values()[it])
            }
        }
        val scale = Prefs.textScale(this)
        val scaleLabels = resources.getStringArray(R.array.text_scale_labels).toList()
        val scaleIndex = Prefs.TEXT_SCALES.indexOfFirst { kotlin.math.abs(it - scale) < 0.01f }.coerceAtLeast(0)
        Ui.row(display, R.drawable.ic_search, getString(R.string.settings_text_size), scaleLabels[scaleIndex]) {
            choose(getString(R.string.settings_text_size), scaleLabels, scaleIndex) {
                prefs.edit().putFloat(Prefs.KEY_TEXT_SCALE, Prefs.TEXT_SCALES[it]).apply()
            }
        }

        // Backup
        Ui.sectionTitle(c, getString(R.string.backup_section))
        val backup = Ui.card(c)
        Ui.row(backup, R.drawable.ic_share, getString(R.string.backup_export), getString(R.string.backup_export_desc)) {
            exportLauncher.launch("rafiq-backup.json")
        }
        Ui.row(backup, R.drawable.ic_refresh, getString(R.string.backup_import), getString(R.string.backup_import_desc)) {
            AlertDialog.Builder(this)
                .setTitle(R.string.backup_import)
                .setMessage(R.string.backup_import_confirm)
                .setPositiveButton(R.string.backup_import_choose) { _, _ -> importLauncher.launch(arrayOf("application/json", "application/octet-stream", "text/plain")) }
                .setNegativeButton(android.R.string.cancel, null)
                .show()
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
            ReminderWorker.apply(this, advance = true)
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
