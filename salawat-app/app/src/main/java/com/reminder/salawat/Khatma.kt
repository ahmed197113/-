package com.reminder.salawat

import android.content.Context
import kotlin.math.ceil

/** A Quran completion plan: finish the Mushaf in N days, tracked against the last page read. */
object Khatma {
    private const val KEY_ACTIVE = "khatma_active"
    private const val KEY_DAYS = "khatma_days"
    private const val KEY_START = "khatma_start"
    private const val KEY_START_PAGE = "khatma_start_page"
    private const val DAY = 86_400_000L

    data class Status(
        val days: Int,
        val dayIndex: Int,
        val pagesPerDay: Int,
        val todayFrom: Int,
        val todayTo: Int,
        val currentPage: Int,
        val expectedPage: Int,
        val percent: Int
    )

    fun isActive(context: Context) = Prefs.get(context).getBoolean(KEY_ACTIVE, false)

    fun start(context: Context, days: Int) {
        val start = Prefs.get(context).getInt(Prefs.KEY_LAST_PAGE, 0).let { if (it in 1..603) it else 1 }
        Prefs.get(context).edit()
            .putBoolean(KEY_ACTIVE, true)
            .putInt(KEY_DAYS, days)
            .putLong(KEY_START, startOfToday())
            .putInt(KEY_START_PAGE, start)
            .apply()
    }

    fun stop(context: Context) = Prefs.get(context).edit().putBoolean(KEY_ACTIVE, false).apply()

    private fun startOfToday(): Long = java.util.Calendar.getInstance().apply {
        set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0)
        set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0)
    }.timeInMillis

    fun status(context: Context): Status? {
        if (!isActive(context)) return null
        val p = Prefs.get(context)
        val days = p.getInt(KEY_DAYS, 30).coerceAtLeast(1)
        val startPage = p.getInt(KEY_START_PAGE, 1)
        val dayIndex = ((startOfToday() - p.getLong(KEY_START, startOfToday())) / DAY).toInt().coerceIn(0, days - 1)
        val total = QuranData.PAGE_COUNT - startPage + 1
        val perDay = ceil(total / days.toDouble()).toInt().coerceAtLeast(1)
        val from = (startPage + perDay * dayIndex).coerceAtMost(QuranData.PAGE_COUNT)
        val to = (from + perDay - 1).coerceAtMost(QuranData.PAGE_COUNT)
        val current = p.getInt(Prefs.KEY_LAST_PAGE, startPage)
        val percent = (((current - startPage + 1).coerceAtLeast(0)) * 100 / total).coerceIn(0, 100)
        return Status(days, dayIndex, perDay, from, to, current, to, percent)
    }

    fun todayText(context: Context): String? {
        val s = status(context) ?: return null
        return context.getString(
            R.string.khatma_today, QuranData.toArabicDigits(s.dayIndex + 1), QuranData.toArabicDigits(s.days),
            QuranData.toArabicDigits(s.todayFrom), QuranData.toArabicDigits(s.todayTo)
        )
    }
}
