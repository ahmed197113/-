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
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar
import java.util.concurrent.TimeUnit

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val context = applicationContext
        if (!Notifications.canPost(context)) return Result.success()
        val now = Calendar.getInstance()
        if (Prefs.isQuietTime(context, now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE))) {
            return Result.success()
        }
        val text = PHRASES.random()
        val openApp = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, Notifications.CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.title_main))
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()
        Notifications.notify(context, NOTIFICATION_ID, notification)
        return Result.success()
    }

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val WORK_NAME = "salawat_periodic_reminder"
        private val PHRASES = listOf(
            "اللهم صلِّ وسلم على نبينا محمد ﷺ",
            "صلِّ على محمد وعلى آل محمد",
            "اللهم صلِّ على محمد كما صليت على إبراهيم",
            "اللهم بارك على محمد وعلى آل محمد",
            "صلى الله عليه وسلم تسليماً كثيراً"
        )

        /** Applies the saved reminder settings; UPDATE keeps the schedule but picks up a new interval. */
        fun apply(context: Context) {
            val workManager = WorkManager.getInstance(context)
            if (!Prefs.get(context).getBoolean(Prefs.KEY_REMINDER_ENABLED, false)) {
                workManager.cancelUniqueWork(WORK_NAME)
                return
            }
            val request = PeriodicWorkRequestBuilder<ReminderWorker>(Prefs.reminderInterval(context), TimeUnit.MINUTES).build()
            workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }
    }
}

object Notifications {
    const val CHANNEL_REMINDER = "salawat_reminder_channel"
    const val CHANNEL_PRAYER = "prayer_times_channel"
    const val CHANNEL_ADHAN = "adhan_playback_channel"

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
        manager.createNotificationChannels(listOf(reminder, prayer, adhan))
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
