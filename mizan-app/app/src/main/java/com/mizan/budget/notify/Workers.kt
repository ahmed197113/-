package com.mizan.budget.notify

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.mizan.budget.data.Settings
import com.mizan.budget.repo
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

/** Keeps the widget, tile and status notification fresh across midnight. */
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        applicationContext.repo.changed()
        return Result.success()
    }
}

object ReminderScheduler {
    private const val CHECKIN = "mizani_checkin"
    private const val REFRESH = "mizani_refresh"

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
