package com.reminder.salawat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.core.app.NotificationManagerCompat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** Daily log of the five prayers plus a make-up (qada) counter per prayer. */
object PrayerTracker {
    private const val PREFS = "prayer_tracker"
    private const val QADA_PREFIX = "qada_"
    val SALAH = Prayer.values().filter { it.isSalah }

    private fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun dayKey(cal: Calendar): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)

    fun isDone(context: Context, cal: Calendar, prayer: Prayer): Boolean =
        prefs(context).getBoolean("${dayKey(cal)}_${prayer.name}", false)

    fun setDone(context: Context, cal: Calendar, prayer: Prayer, done: Boolean) {
        prefs(context).edit().putBoolean("${dayKey(cal)}_${prayer.name}", done).apply()
    }

    fun toggle(context: Context, cal: Calendar, prayer: Prayer): Boolean {
        val now = !isDone(context, cal, prayer)
        setDone(context, cal, prayer, now)
        return now
    }

    fun countForDay(context: Context, cal: Calendar): Int = SALAH.count { isDone(context, cal, it) }

    /** Consecutive days (ending yesterday, or today if complete) with all five prayers logged. */
    fun streak(context: Context): Int {
        val cal = Calendar.getInstance()
        if (countForDay(context, cal) < 5) cal.add(Calendar.DAY_OF_MONTH, -1)
        var days = 0
        while (days < 3650 && countForDay(context, cal) == 5) {
            days++
            cal.add(Calendar.DAY_OF_MONTH, -1)
        }
        return days
    }

    /** Prayers logged out of the last [days] days × 5. */
    fun stats(context: Context, days: Int): Pair<Int, Int> {
        val cal = Calendar.getInstance()
        var done = 0
        repeat(days) {
            done += countForDay(context, cal)
            cal.add(Calendar.DAY_OF_MONTH, -1)
        }
        return done to days * 5
    }

    fun qada(context: Context, prayer: Prayer): Int = prefs(context).getInt(QADA_PREFIX + prayer.name, 0)

    fun setQada(context: Context, prayer: Prayer, value: Int) {
        prefs(context).edit().putInt(QADA_PREFIX + prayer.name, value.coerceAtLeast(0)).apply()
    }
}

/** "صليت ✓" action on the adhan notification. */
fun prayedPendingIntent(context: Context, prayer: Prayer, notificationId: Int): android.app.PendingIntent =
    android.app.PendingIntent.getBroadcast(
        context, 500 + prayer.ordinal,
        Intent(context, PrayedReceiver::class.java)
            .putExtra(PrayedReceiver.EXTRA_PRAYER, prayer.name)
            .putExtra(PrayedReceiver.EXTRA_NOTIFICATION_ID, notificationId),
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )

class PrayedReceiver : BroadcastReceiver() {
    override fun onReceive(raw: Context, intent: Intent) {
        val context = Lang.wrap(raw)
        val prayer = intent.getStringExtra(EXTRA_PRAYER)?.let { runCatching { Prayer.valueOf(it) }.getOrNull() } ?: return
        PrayerTracker.setDone(context, Calendar.getInstance(), prayer, true)
        val id = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        if (id != 0) NotificationManagerCompat.from(context).cancel(id)
        AdhanService.stop(context)
    }

    companion object {
        const val EXTRA_PRAYER = "prayer"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
    }
}
