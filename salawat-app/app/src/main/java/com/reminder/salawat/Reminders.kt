package com.reminder.salawat

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import java.util.Calendar

enum class ReminderType(val titleRes: Int, val descRes: Int, val defaultMinutes: Int, val defaultOn: Boolean) {
    MORNING(R.string.rem_morning, R.string.rem_morning_desc, 7 * 60, true),
    EVENING(R.string.rem_evening, R.string.rem_evening_desc, 17 * 60, true),
    SLEEP(R.string.rem_sleep, R.string.rem_sleep_desc, 22 * 60 + 30, true),
    KAHF(R.string.rem_kahf, R.string.rem_kahf_desc, 10 * 60, true),
    WIRD(R.string.rem_wird, R.string.rem_wird_desc, 21 * 60, true),
    FASTING(R.string.rem_fasting, R.string.rem_fasting_desc, 20 * 60 + 30, true),
    PRE_ADHAN(R.string.rem_pre_adhan, R.string.rem_pre_adhan_desc, 10, true),
    IQAMA(R.string.rem_iqama, R.string.rem_iqama_desc, 15, true),
    SUHOOR(R.string.rem_suhoor, R.string.rem_suhoor_desc, 45, true),
    FRIDAY_HOUR(R.string.rem_friday_hour, R.string.rem_friday_hour_desc, 60, true);

    /**
     * Minutes relative to a prayer: PRE_ADHAN before the adhan, IQAMA after it, SUHOOR before Fajr (Ramadan only),
     * FRIDAY_HOUR before Maghrib on Fridays. The others are a time of day.
     */
    val isTimeOfDay get() = this != PRE_ADHAN && this != IQAMA && this != SUHOOR && this != FRIDAY_HOUR
}

/**
 * All non-adhan reminders share one alarm: the earliest upcoming enabled reminder is armed, and each
 * delivery re-arms the next one. Times are user-adjustable.
 */
object Reminders {
    private const val REQUEST_CODE = 2101
    private const val EXTRA_TYPE = "type"
    private const val EXTRA_TEXT = "text"
    private const val EXTRA_PRAYER = "prayer"

    fun isOn(context: Context, type: ReminderType) = Prefs.get(context).getBoolean("rem_${type.name}_on", type.defaultOn)

    fun setOn(context: Context, type: ReminderType, on: Boolean) {
        Prefs.get(context).edit().putBoolean("rem_${type.name}_on", on).apply()
        schedule(context)
    }

    fun minutes(context: Context, type: ReminderType) = Prefs.get(context).getInt("rem_${type.name}_min", type.defaultMinutes)

    fun setMinutes(context: Context, type: ReminderType, minutes: Int) {
        Prefs.get(context).edit().putInt("rem_${type.name}_min", minutes).apply()
        schedule(context)
    }

    private data class Next(val type: ReminderType, val at: Long, val text: String? = null, val prayer: Prayer? = null)

    fun schedule(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java)
        val next = findNext(context, System.currentTimeMillis())
        val intent = Intent(context, ReminderReceiver::class.java)
        if (next != null) {
            intent.putExtra(EXTRA_TYPE, next.type.name)
            next.text?.let { intent.putExtra(EXTRA_TEXT, it) }
            next.prayer?.let { intent.putExtra(EXTRA_PRAYER, it.name) }
        }
        val pi = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        if (next == null) {
            am.cancel(pi)
            return
        }
        try {
            if (PrayerScheduler.canScheduleExact(context)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
        }
    }

    private fun atTime(day: Calendar, minutesOfDay: Int): Long = (day.clone() as Calendar).apply {
        set(Calendar.HOUR_OF_DAY, minutesOfDay / 60)
        set(Calendar.MINUTE, minutesOfDay % 60)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    private fun findNext(context: Context, now: Long): Next? {
        val candidates = ArrayList<Next>()
        val base = Calendar.getInstance()
        for (type in ReminderType.values()) {
            if (!isOn(context, type)) continue
            if (type == ReminderType.PRE_ADHAN || type == ReminderType.IQAMA) {
                // Only for prayers whose adhan alert is on.
                if (!PrayerRepository.alertsOn(context)) continue
                val include = { pr: Prayer -> PrayerRepository.isAlertEnabled(context, pr) }
                val gap = minutes(context, type) * 60_000L
                if (type == ReminderType.PRE_ADHAN) {
                    PrayerRepository.nextPrayer(context, now + gap, include)?.let { p ->
                        candidates.add(Next(type, p.millis - gap, prayer = p.prayer))
                    }
                } else {
                    PrayerRepository.nextPrayer(context, now - gap, include)?.let { p ->
                        candidates.add(Next(type, p.millis + gap, prayer = p.prayer))
                    }
                }
                continue
            }
            if (type == ReminderType.SUHOOR || type == ReminderType.FRIDAY_HOUR) {
                val gap = minutes(context, type) * 60_000L
                for (offset in 0..8) {
                    val day = (base.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, offset) }
                    val ok = if (type == ReminderType.SUHOOR) HijriDate.of(context, day).month == 9
                    else day.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY
                    if (!ok) continue
                    val timings = PrayerRepository.dayTimings(context, day) ?: continue
                    val anchor = timings.millisOf(if (type == ReminderType.SUHOOR) Prayer.FAJR else Prayer.MAGHRIB) ?: continue
                    if (anchor - gap > now) {
                        candidates.add(Next(type, anchor - gap))
                        break
                    }
                }
                continue
            }
            for (offset in 0..8) {
                val day = (base.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, offset) }
                val at = atTime(day, minutes(context, type))
                if (at <= now) continue
                val ok = when (type) {
                    ReminderType.KAHF -> day.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY
                    ReminderType.FASTING -> fastingTomorrow(context, day) != null
                    else -> true
                }
                if (ok) {
                    val text = if (type == ReminderType.FASTING) fastingTomorrow(context, day) else null
                    candidates.add(Next(type, at, text))
                    break
                }
            }
        }
        return candidates.minByOrNull { it.at }
    }

    /** Title of a recommended fast on the day after [day], if any. */
    fun fastingTomorrow(context: Context, day: Calendar): String? {
        val tomorrow = (day.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 1) }
        val event = HijriDate.events(HijriDate.of(context, tomorrow), tomorrow).firstOrNull { it.fasting } ?: return null
        return "${event.title} — ${event.note}"
    }

    fun deliver(context: Context, intent: Intent) {
        val type = intent.getStringExtra(EXTRA_TYPE)?.let { runCatching { ReminderType.valueOf(it) }.getOrNull() } ?: return
        if (!isOn(context, type)) return
        if (type == ReminderType.IQAMA) {
            val prayer = intent.getStringExtra(EXTRA_PRAYER)?.let { runCatching { Prayer.valueOf(it) }.getOrNull() } ?: Prayer.DHUHR
            if (!AdhanService.startIqama(context, prayer)) postIqama(context, prayer)
            return
        }
        val (title, text, open) = when (type) {
            ReminderType.MORNING -> Triple(context.getString(R.string.rem_morning), context.getString(R.string.rem_morning_text), azkar(context, 27))
            ReminderType.EVENING -> Triple(context.getString(R.string.rem_evening), context.getString(R.string.rem_evening_text), azkar(context, 27))
            ReminderType.SLEEP -> Triple(context.getString(R.string.rem_sleep), context.getString(R.string.rem_sleep_text), azkar(context, 28))
            ReminderType.KAHF -> Triple(
                context.getString(R.string.rem_kahf),
                context.getString(R.string.rem_kahf_text) + (HadithQuotes.cite("friday_salawat")?.let { "\n\n$it" } ?: ""),
                Intent(context, QuranPagerActivity::class.java).putExtra(QuranPagerActivity.EXTRA_PAGE, QuranData.surahStartPage(context, 18))
            )
            ReminderType.WIRD -> Triple(
                context.getString(R.string.rem_wird), Khatma.todayText(context) ?: context.getString(R.string.rem_wird_text),
                Intent(context, QuranPagerActivity::class.java)
            )
            ReminderType.FASTING -> Triple(
                context.getString(R.string.rem_fasting_title), intent.getStringExtra(EXTRA_TEXT) ?: context.getString(R.string.rem_fasting_desc),
                Intent(context, CalendarActivity::class.java)
            )
            ReminderType.IQAMA -> return
            ReminderType.SUHOOR -> Triple(
                context.getString(R.string.rem_suhoor_title),
                HadithQuotes.cite("suhoor") ?: context.getString(R.string.rem_suhoor_desc),
                Intent(context, RamadanActivity::class.java)
            )
            ReminderType.FRIDAY_HOUR -> Triple(
                context.getString(R.string.rem_friday_hour_title),
                HadithQuotes.cite("friday_last_hour") ?: context.getString(R.string.rem_friday_hour_desc),
                MainActivity.intent(context, MainActivity.TAB_AZKAR)
            )
            ReminderType.PRE_ADHAN -> {
                val prayer = intent.getStringExtra(EXTRA_PRAYER)?.let { runCatching { Prayer.valueOf(it) }.getOrNull() } ?: Prayer.DHUHR
                // Sound the opening "Allahu akbar, Allahu akbar" of the user's adhan, with the notice on screen.
                if (AdhanService.startTakbir(context, prayer, minutes(context, type))) return
                Triple(
                    context.getString(R.string.rem_pre_adhan_title, arabicMinutes(minutes(context, type)), context.getString(prayer.nameRes)),
                    context.getString(R.string.rem_pre_adhan_text),
                    MainActivity.intent(context, MainActivity.TAB_PRAYER)
                )
            }
        }
        val pi = PendingIntent.getActivity(context, 700 + type.ordinal, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, Notifications.CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        Notifications.notify(context, 4000 + type.ordinal, notification)
    }

    /** Iqama alert: a sounding, high-priority notification on the prayer channel. */
    private fun postIqama(context: Context, prayer: Prayer) {
        val title = context.getString(R.string.rem_iqama_title, context.getString(prayer.nameRes))
        val text = context.getString(R.string.rem_iqama_text)
        val pi = PendingIntent.getActivity(
            context, 790, MainActivity.intent(context, MainActivity.TAB_PRAYER),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, Notifications.CHANNEL_PRAYER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        Notifications.notify(context, 4900, notification)
    }

    private fun azkar(context: Context, id: Int) = Intent(context, AzkarDetailActivity::class.java)
        .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_ID, id)
        .putExtra(AzkarDetailActivity.EXTRA_CATEGORY_TITLE, context.getString(if (id == 28) R.string.azkar_sleep else R.string.azkar_morning_evening))
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(raw: Context, intent: Intent) {
        val context = Lang.wrap(raw)
        Reminders.deliver(context, intent)
        Reminders.schedule(context)
    }
}

/** "دقيقة واحدة", "دقيقتان", "5 دقائق", "15 دقيقة": Arabic counted-noun agreement. */
fun arabicMinutes(n: Int): String = if (!Lang.arabic) (if (n == 1) "1 minute" else "$n minutes") else when {
    n == 1 -> "دقيقة واحدة"
    n == 2 -> "دقيقتان"
    n % 100 in 3..10 -> "$n دقائق"
    else -> "$n دقيقة"
}
