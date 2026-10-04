package com.wafr.app.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.wafr.app.appScope
import com.wafr.app.data.Settings
import com.wafr.app.data.WishItem
import com.wafr.app.domain.toMillis
import com.wafr.app.repo
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * The "did you spend anything?" reminder.
 *
 * Primary path: an exact, Doze-proof AlarmManager alarm that re-arms itself every time it fires.
 * Safety nets: an hourly WorkManager job and every app start call [ReminderScheduler.ensure],
 * which fires a missed reminder and re-arms the alarm, so reminders never silently stop
 * (reboot, app update, clock change, OEM battery killers).
 */
object ReminderScheduler {
    private const val REFRESH = "wafr_refresh"
    private const val LEGACY_CHECKIN = "wafr_checkin"
    private const val GRACE = 10 * 60 * 1000L

    fun isQuiet(s: Settings, hour: Int): Boolean =
        if (s.quietStart == s.quietEnd) false
        else if (s.quietStart > s.quietEnd) hour >= s.quietStart || hour < s.quietEnd
        else hour in s.quietStart until s.quietEnd

    /** The next reminder time after [from], moved to the end of quiet hours if needed. */
    fun nextAfter(s: Settings, from: Long): Long {
        val zone = ZoneId.systemDefault()
        var t = LocalDateTime.ofInstant(Instant.ofEpochMilli(from), zone).plusHours(s.reminderHours.coerceIn(1, 24).toLong())
        if (isQuiet(s, t.hour)) {
            var end = t.withHour(s.quietEnd).withMinute(0).withSecond(0).withNano(0)
            if (!end.isAfter(t)) end = end.plusDays(1)
            t = end
        }
        return t.atZone(zone).toInstant().toEpochMilli()
    }

    fun canExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 31) return true
        return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    }

    fun ignoresBatteryOptimizations(context: Context): Boolean =
        context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName)

    private fun alarmIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context, 900, Intent(context, CheckInAlarmReceiver::class.java).setAction(CheckInAlarmReceiver.ACTION),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun arm(context: Context, at: Long) {
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = alarmIntent(context)
        try {
            if (canExact(context)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    /** Arms the alarm for the stored next time (or a fresh one) and keeps the hourly safety net. */
    suspend fun apply(context: Context, settings: Settings) {
        val wm = WorkManager.getInstance(context)
        wm.cancelUniqueWork(LEGACY_CHECKIN)
        wm.enqueueUniquePeriodicWork(
            REFRESH, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<RefreshWorker>(1, TimeUnit.HOURS).build(),
        )
        val am = context.getSystemService(AlarmManager::class.java)
        if (!settings.remindersEnabled || !settings.onboarded) {
            am.cancel(alarmIntent(context)); return
        }
        val now = System.currentTimeMillis()
        val next = if (settings.nextCheckInAt > now) settings.nextCheckInAt else nextAfter(settings, now)
        if (next != settings.nextCheckInAt) context.repo.settingsStore.update { it.copy(nextCheckInAt = next) }
        arm(context, next)
    }

    /** Interval changed or reminders re-enabled: count from now. */
    suspend fun reschedule(context: Context, settings: Settings) {
        context.repo.settingsStore.update { it.copy(nextCheckInAt = 0) }
        apply(context, settings.copy(nextCheckInAt = 0))
    }

    /** Called when the alarm fires (or a safety net notices it was missed). */
    suspend fun fire(context: Context) {
        val repo = context.repo
        val s = repo.settingsStore.current()
        if (!s.onboarded || !s.remindersEnabled) return
        val now = System.currentTimeMillis()
        if (!isQuiet(s, LocalDateTime.now().hour)) {
            Notifications.showCheckIn(context, repo.snapshotOnce(), s.reminderHours)
        }
        val next = nextAfter(s, now)
        repo.settingsStore.update { it.copy(lastCheckInAt = now, nextCheckInAt = next) }
        arm(context, next)
    }

    /** Safety net: if the alarm was killed or delayed, fire now and re-arm. */
    suspend fun ensure(context: Context) {
        val s = context.repo.settingsStore.current()
        if (!s.onboarded || !s.remindersEnabled) return
        if (s.nextCheckInAt in 1 until System.currentTimeMillis() - GRACE) fire(context) else apply(context, s)
    }
}

class CheckInAlarmReceiver : BroadcastReceiver() {
    companion object { const val ACTION = "com.wafr.app.CHECKIN_ALARM" }

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext
        app.appScope.launch {
            try { ReminderScheduler.fire(app) } finally { pending.finish() }
        }
    }
}

/**
 * Hourly: keeps the widget, tile and status notification fresh across midnight, re-checks the
 * reminder alarm, and sends the evening summary, bill reminders and "cooling-off is over" nudges.
 */
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val repo = ctx.repo
        repo.changed()
        val settings = repo.settingsStore.current()
        if (!settings.onboarded) return Result.success()
        ReminderScheduler.ensure(ctx)
        val now = LocalDateTime.now()
        val todayMillis = now.toLocalDate().toMillis()
        val quiet = ReminderScheduler.isQuiet(settings, now.hour)

        if (settings.eveningSummary && now.hour >= 21 && settings.lastSummaryDay != todayMillis && !quiet) {
            Notifications.showEveningSummary(ctx, repo.snapshotOnce())
            repo.settingsStore.update { it.copy(lastSummaryDay = todayMillis) }
        }
        if (!quiet && now.hour >= 9) {
            val snap = repo.snapshotOnce()
            snap.unpaidBills
                .filter { it.lastNotifiedDay != todayMillis && now.dayOfMonth >= it.dayOfMonth.coerceAtMost(now.toLocalDate().lengthOfMonth()) }
                .forEach { b ->
                    Notifications.showBillDue(ctx, b, settings.currency)
                    repo.markBillNotified(b)
                }
            repo.wishesOnce()
                .filter { it.status == WishItem.Status.WAITING && !it.notified && it.decideAfter <= System.currentTimeMillis() }
                .forEach { w ->
                    Notifications.showWishReady(ctx, w, settings.currency)
                    repo.markWishNotified(w)
                }
        }
        return Result.success()
    }
}
