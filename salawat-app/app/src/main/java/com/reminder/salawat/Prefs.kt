package com.reminder.salawat

import android.content.Context
import android.content.SharedPreferences

object Prefs {
    private const val NAME = "salawat_prefs"

    const val KEY_ONBOARDED = "onboarded"
    const val KEY_THEME = "theme_mode"
    const val KEY_REMINDER_ENABLED = "reminder_enabled"
    const val KEY_REMINDER_INTERVAL = "reminder_interval_minutes"
    const val KEY_QUIET_ENABLED = "quiet_enabled"
    const val KEY_QUIET_START = "quiet_start_minutes"
    const val KEY_QUIET_END = "quiet_end_minutes"
    const val KEY_TASBIH_INDEX = "tasbih_dhikr_index"
    const val KEY_TASBIH_COUNT_PREFIX = "tasbih_count_"
    const val KEY_TASBIH_TARGET = "tasbih_target"
    const val KEY_QURAN_FONT = "quran_font_sp"
    const val KEY_LAST_SURAH = "last_surah"
    const val KEY_LAST_SURAH_NAME = "last_surah_name"
    const val KEY_LAST_AYAH = "last_ayah"
    const val KEY_LAST_PAGE = "last_page"
    const val KEY_BOOKMARK_GLOBAL = "bookmark_global"
    const val KEY_RECITER = "reciter"
    const val KEY_TAFSIR = "tafsir"
    const val KEY_ADHAN = "adhan_id"
    const val KEY_ADHAN_FAJR = "adhan_fajr_id"
    const val KEY_ADHAN_CUSTOM_URI = "adhan_custom_uri"

    val INTERVAL_OPTIONS = longArrayOf(15, 30, 60, 120, 180)

    fun get(context: Context): SharedPreferences = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun reminderInterval(context: Context): Long = get(context).getLong(KEY_REMINDER_INTERVAL, 30)

    fun quietStart(context: Context): Int = get(context).getInt(KEY_QUIET_START, 23 * 60)

    fun quietEnd(context: Context): Int = get(context).getInt(KEY_QUIET_END, 6 * 60)

    fun formatMinutes(minutesOfDay: Int): String =
        String.format(java.util.Locale.US, "%02d:%02d", minutesOfDay / 60, minutesOfDay % 60)

    /** True when [minutesOfDay] falls inside the quiet window, which may wrap past midnight. */
    fun isQuietTime(context: Context, minutesOfDay: Int): Boolean {
        val prefs = get(context)
        if (!prefs.getBoolean(KEY_QUIET_ENABLED, false)) return false
        val start = quietStart(context)
        val end = quietEnd(context)
        return if (start <= end) minutesOfDay in start until end else minutesOfDay >= start || minutesOfDay < end
    }
}
