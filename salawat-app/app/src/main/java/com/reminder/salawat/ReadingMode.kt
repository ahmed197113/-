package com.reminder.salawat

import android.content.Context
import android.content.res.Configuration

/** The Mushaf's own background, independent of the app's light/dark mode. */
enum class ReadingMode(val labelRes: Int) {
    AUTO(R.string.reading_auto), DAY(R.string.reading_day), SEPIA(R.string.reading_sepia), NIGHT(R.string.reading_night);

    /** background, paper, text, ayah number, page number */
    data class Colors(val background: Int, val paper: Int, val text: Int, val ayahNumber: Int, val pageNumber: Int, val isDark: Boolean)

    fun colors(context: Context): Colors {
        val mode = if (this == AUTO) {
            val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            if (night) NIGHT else DAY
        } else this
        return when (mode) {
            NIGHT -> Colors(0xFF0B1210.toInt(), 0xFF141C1A.toInt(), 0xFFE8E4D8.toInt(), 0xFF8FD18F.toInt(), 0xFF9FB5B0.toInt(), true)
            SEPIA -> Colors(0xFFE6D8B8.toInt(), 0xFFF4E8CC.toInt(), 0xFF2B2014.toInt(), 0xFF005500.toInt(), 0xFF6B5636.toInt(), false)
            else -> Colors(0xFFEFE7D2.toInt(), 0xFFFFFBF0.toInt(), 0xFF1B1F1E.toInt(), 0xFF005500.toInt(), 0xFF0F5C56.toInt(), false)
        }
    }

    companion object {
        private const val KEY = "reading_mode"
        fun get(context: Context): ReadingMode =
            runCatching { valueOf(Prefs.get(context).getString(KEY, AUTO.name)!!) }.getOrDefault(AUTO)
        fun set(context: Context, mode: ReadingMode) = Prefs.get(context).edit().putString(KEY, mode.name).apply()
    }
}
