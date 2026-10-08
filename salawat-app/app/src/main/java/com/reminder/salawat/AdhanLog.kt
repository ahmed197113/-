package com.reminder.salawat

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date

/**
 * The last adhan alarms: when each was due and when the phone actually delivered it. Shown in Settings so a late
 * or early adhan can be traced to its cause (the phone holding the alarm back, or the prayer times themselves).
 */
object AdhanLog {
    private const val KEY = "adhan_log"
    private const val MAX = 15

    fun add(context: Context, prayer: Prayer, due: Long, outcome: String) {
        val prefs = Prefs.get(context)
        val entry = "${prayer.name}|$due|${System.currentTimeMillis()}|$outcome"
        val list = (listOf(entry) + prefs.getString(KEY, "").orEmpty().split('\n').filter { it.isNotBlank() }).take(MAX)
        prefs.edit().putString(KEY, list.joinToString("\n")).apply()
    }

    fun text(context: Context): String {
        val lines = Prefs.get(context).getString(KEY, "").orEmpty().split('\n').filter { it.isNotBlank() }
        if (lines.isEmpty()) return context.getString(R.string.adhan_log_empty)
        val day = SimpleDateFormat("EEE d/M", Ui.locale())
        val time = SimpleDateFormat("HH:mm:ss", Ui.locale())
        return lines.mapNotNull { line ->
            val p = line.split('|')
            val prayer = runCatching { Prayer.valueOf(p[0]) }.getOrNull() ?: return@mapNotNull null
            val due = p[1].toLong(); val at = p[2].toLong()
            val delay = ((at - due) / 1000).toInt()
            val outcome = when (p.getOrNull(3)) {
                "adhan" -> context.getString(R.string.adhan_log_played)
                "late" -> context.getString(R.string.adhan_log_late)
                else -> context.getString(R.string.settings_off)
            }
            "${context.getString(prayer.nameRes)} — ${day.format(Date(due))}\n" +
                context.getString(R.string.adhan_log_line, time.format(Date(due)), time.format(Date(at)), delay.toString(), outcome)
        }.joinToString("\n\n")
    }
}
