package com.wafr.app.notify

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.wafr.app.data.Settings
import com.wafr.app.data.WishItem
import com.wafr.app.domain.toMillis
import com.wafr.app.repo
import java.time.LocalTime
import java.util.concurrent.TimeUnit

/** Fires every N hours (5 by default) and asks "did you spend anything?". */
class CheckInWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repo = applicationContext.repo
        val settings = repo.settingsStore.current()
        if (!settings.onboarded || !settings.remindersEnabled) return Result.success()
        if (ReminderScheduler.isQuiet(settings, LocalTime.now().hour)) return Result.success()
        val snap = repo.snapshotOnce()
        // Smart skip: if something was logged in the last 90 minutes there's nothing to remind about.
        val lastLogged = snap.expenses.maxOfOrNull { it.timestamp } ?: 0L
        if (System.currentTimeMillis() - lastLogged < 90 * 60 * 1000L) return Result.success()
        Notifications.showCheckIn(applicationContext, snap, settings.reminderHours)
        repo.settingsStore.update { it.copy(lastCheckInAt = System.currentTimeMillis()) }
        return Result.success()
    }
}

/**
 * Hourly: keeps the widget, tile and status notification fresh across midnight, and sends
 * the evening summary, bill due-day reminders and "cooling-off period is over" nudges.
 */
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val repo = ctx.repo
        repo.changed()
        val settings = repo.settingsStore.current()
        if (!settings.onboarded) return Result.success()
        val now = java.time.LocalDateTime.now()
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

object ReminderScheduler {
    private const val CHECKIN = "wafr_checkin"
    private const val REFRESH = "wafr_refresh"

    fun isQuiet(s: Settings, hour: Int): Boolean =
        if (s.quietStart == s.quietEnd) false
        else if (s.quietStart > s.quietEnd) hour >= s.quietStart || hour < s.quietEnd
        else hour in s.quietStart until s.quietEnd

    fun apply(context: Context, settings: Settings) {
        val wm = WorkManager.getInstance(context)
        if (settings.remindersEnabled) {
            val hours = settings.reminderHours.coerceIn(1, 24).toLong()
            val req = PeriodicWorkRequestBuilder<CheckInWorker>(hours, TimeUnit.HOURS)
                .setInitialDelay(hours, TimeUnit.HOURS)
                .build()
            wm.enqueueUniquePeriodicWork(CHECKIN, ExistingPeriodicWorkPolicy.UPDATE, req)
        } else {
            wm.cancelUniqueWork(CHECKIN)
        }
        wm.enqueueUniquePeriodicWork(
            REFRESH, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<RefreshWorker>(1, TimeUnit.HOURS).build(),
        )
    }

    /** Called when the interval changes so the new cadence starts counting from now. */
    fun reschedule(context: Context, settings: Settings) {
        WorkManager.getInstance(context).cancelUniqueWork(CHECKIN)
        apply(context, settings)
    }
}
