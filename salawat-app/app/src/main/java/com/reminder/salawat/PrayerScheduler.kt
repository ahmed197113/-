package com.reminder.salawat

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

object PrayerScheduler {
    private const val REQUEST_CODE = 2001
    const val EXTRA_PRAYER = "prayer"
    const val EXTRA_TIME = "time"
    const val EXTRA_MILLIS = "millis"

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 31) return true
        return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    }

    /** Arms a single alarm for the next salah; each alarm re-arms the following one. */
    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val enabled = PrayerRepository.prefs(context).getBoolean(PrayerRepository.KEY_ALERTS, true)
        val next = if (enabled) PrayerRepository.nextPrayer(context) { PrayerRepository.isAlertEnabled(context, it) } else null
        if (next == null) {
            alarmManager.cancel(pendingIntent(context, null))
            if (enabled && PrayerRepository.isConfigured(context)) PrayerRefreshWorker.runOnce(context)
            return
        }
        val pi = pendingIntent(context, next)
        try {
            if (canScheduleExact(context)) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.millis, pi)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.millis, pi)
            }
        } catch (_: SecurityException) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.millis, pi)
        }
    }

    private fun pendingIntent(context: Context, next: UpcomingPrayer?): PendingIntent {
        val intent = Intent(context, PrayerAlarmReceiver::class.java)
        if (next != null) {
            intent.putExtra(EXTRA_PRAYER, next.prayer.name)
            intent.putExtra(EXTRA_TIME, next.time)
            intent.putExtra(EXTRA_MILLIS, next.millis)
        }
        return PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** Refreshes everything that depends on prayer times. */
    fun refreshDependents(context: Context) {
        schedule(context)
        Reminders.schedule(context)
        NextPrayerWidget.updateAll(context)
        AyahWidget.updateAll(context)
    }
}

class PrayerAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prayer = intent.getStringExtra(PrayerScheduler.EXTRA_PRAYER)?.let { runCatching { Prayer.valueOf(it) }.getOrNull() }
        val millis = intent.getLongExtra(PrayerScheduler.EXTRA_MILLIS, 0L)
        val enabled = PrayerRepository.prefs(context).getBoolean(PrayerRepository.KEY_ALERTS, true)
        // Skip stale alarms (e.g. delivered long after the device was off).
        if (prayer != null && enabled && System.currentTimeMillis() - millis < 30 * 60_000L) {
            val adhan = AdhanCatalog.sourceFor(context, prayer)
            // The adhan plays even when notifications are blocked (the foreground service still runs; only its
            // notice is hidden) — a missing permission must never silence the adhan.
            val playing = adhan != null && AdhanService.start(context, prayer)
            if (!playing) postPrayerNotification(context, prayer)
        }
        PrayerScheduler.refreshDependents(context)
    }
}

fun postPrayerNotification(context: Context, prayer: Prayer) {
    val name = context.getString(prayer.nameRes)
    val openApp = PendingIntent.getActivity(
        context, 1, MainActivity.intent(context, MainActivity.TAB_PRAYER),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(context, Notifications.CHANNEL_PRAYER)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(context.getString(R.string.prayer_notif_title, name))
        .setContentText(context.getString(R.string.prayer_notif_text))
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setContentIntent(openApp)
        .addAction(0, context.getString(R.string.tracker_prayed_action), prayedPendingIntent(context, prayer, 3000 + prayer.ordinal))
        .setAutoCancel(true)
        .build()
    Notifications.notify(context, 3000 + prayer.ordinal, notification)
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        PrayerScheduler.refreshDependents(context)
        ReminderWorker.apply(context)
    }
}

/** Keeps the cached month fresh (and fetches the next month) whenever the network is available. */
class PrayerRefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        if (!PrayerRepository.isConfigured(applicationContext)) return Result.success()
        return try {
            PrayerRepository.refresh(applicationContext)
            PrayerScheduler.refreshDependents(applicationContext)
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val PERIODIC = "prayer_refresh_periodic"
        private const val ONCE = "prayer_refresh_once"
        private val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun ensurePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<PrayerRefreshWorker>(12, TimeUnit.HOURS)
                .setConstraints(constraints).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun runOnce(context: Context) {
            val request = OneTimeWorkRequestBuilder<PrayerRefreshWorker>().setConstraints(constraints).build()
            WorkManager.getInstance(context).enqueueUniqueWork(ONCE, ExistingWorkPolicy.KEEP, request)
        }
    }
}
