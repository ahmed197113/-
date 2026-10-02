package com.reminder.salawat

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        post(applicationContext)
        return Result.success()
    }

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val WORK_NAME = "salawat_periodic_reminder"
        private const val ALARM_REQUEST = 2201
        private const val KEY_NEXT_AT = "salawat_next_at"
        private val PHRASES = listOf(
            "اللهم صلِّ وسلم على نبينا محمد ﷺ",
            "صلِّ على محمد وعلى آل محمد",
            "اللهم صلِّ على محمد كما صليت على إبراهيم",
            "اللهم بارك على محمد وعلى آل محمد",
            "صلى الله عليه وسلم تسليماً كثيراً"
        )

        fun post(context: Context) {
            if (!Notifications.canPost(context)) return
            val now = Calendar.getInstance()
            if (Prefs.isQuietTime(context, now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE))) {
                return
            }
            val text = PHRASES.random()
            val openApp = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notification = NotificationCompat.Builder(context, Notifications.CHANNEL_REMINDER)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.reminder_notif_title))
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(openApp)
                .setAutoCancel(true)
                .build()
            Notifications.notify(context, NOTIFICATION_ID, notification)
        }

        /**
         * Arms the next salawat reminder with an exact alarm, so it arrives on time even when the app is closed
         * and the phone is in Doze (WorkManager's periodic work was deferred until the app was opened).
         */
        fun apply(context: Context, advance: Boolean = false) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME) // the old periodic job, if any
            val am = context.getSystemService(android.app.AlarmManager::class.java)
            val pi = PendingIntent.getBroadcast(
                context, ALARM_REQUEST, Intent(context, SalawatReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            if (!Prefs.get(context).getBoolean(Prefs.KEY_REMINDER_ENABLED, false)) {
                am.cancel(pi)
                return
            }
            // Keep the pending time when the app merely re-applies settings (app start, boot), so opening the app
            // often never postpones the reminder; move on only after one fired or the interval changed.
            val prefs = Prefs.get(context)
            val now = System.currentTimeMillis()
            val interval = Prefs.reminderInterval(context).coerceAtLeast(15) * 60_000L
            val saved = prefs.getLong(KEY_NEXT_AT, 0L)
            val at = if (!advance && saved > now && saved - now <= interval) saved else now + interval
            prefs.edit().putLong(KEY_NEXT_AT, at).apply()
            try {
                if (PrayerScheduler.canScheduleExact(context)) am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi)
                else am.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi)
            } catch (_: SecurityException) {
                am.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi)
            }
        }
    }
}

/** Fires each salawat reminder and arms the next one. */
class SalawatReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderWorker.post(context)
        ReminderWorker.apply(context, advance = true)
    }
}

object Notifications {
    const val CHANNEL_REMINDER = "salawat_reminder_channel"
    const val CHANNEL_PRAYER = "prayer_times_channel"
    const val CHANNEL_ADHAN = "adhan_playback_channel"
    const val CHANNEL_REMINDERS = "daily_reminders_channel"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(android.app.NotificationManager::class.java)
        val reminder = android.app.NotificationChannel(
            CHANNEL_REMINDER, context.getString(R.string.notif_channel_name), android.app.NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = context.getString(R.string.notif_channel_desc) }
        val prayer = android.app.NotificationChannel(
            CHANNEL_PRAYER, context.getString(R.string.prayer_channel_name), android.app.NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.prayer_channel_desc)
            enableVibration(true)
        }
        // The adhan audio itself is played by AdhanService, so this channel is silent.
        val adhan = android.app.NotificationChannel(
            CHANNEL_ADHAN, context.getString(R.string.adhan_channel_name), android.app.NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.adhan_channel_desc)
            setSound(null, null)
            enableVibration(true)
        }
        val daily = android.app.NotificationChannel(
            CHANNEL_REMINDERS, context.getString(R.string.rem_channel_name), android.app.NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = context.getString(R.string.rem_channel_desc) }
        manager.createNotificationChannels(listOf(reminder, prayer, adhan, daily))
    }

    fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun notify(context: Context, id: Int, notification: android.app.Notification) {
        if (!canPost(context)) return
        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (_: SecurityException) {
        }
    }
}
