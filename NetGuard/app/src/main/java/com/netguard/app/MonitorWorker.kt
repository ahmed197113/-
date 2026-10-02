package com.netguard.app

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.netguard.app.data.DeviceRepository
import com.netguard.app.data.SettingsStore
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

/**
 * عامل خلفية دوري: يمسح الشبكة، يسجّل الحضور، ويُنبّه عند دخول جهاز جديد.
 */
class MonitorWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val settings = SettingsStore(applicationContext)
        val enabled = settings.monitorEnabledFlow.first()
        if (!enabled) return Result.success()
        val interval = settings.scanInterval()
        val repo = DeviceRepository(applicationContext)
        val newDevices = runCatching { repo.scanAndSync(interval) }.getOrDefault(emptyList())

        if (newDevices.isNotEmpty() && settings.notifyNewFlow.first()) {
            notifyNewDevices(newDevices.size)
        }
        return Result.success()
    }

    private fun notifyNewDevices(count: Int) {
        if (ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED && android.os.Build.VERSION.SDK_INT >= 33) return

        val n = NotificationCompat.Builder(applicationContext, NetGuardApp.CH_ALERT)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("⚠️ جهاز جديد على شبكتك")
            .setContentText("تم اكتشاف $count جهاز جديد. افتح التطبيق للمراجعة والحظر.")
            .setAutoCancel(true)
            .build()
        applicationContext.getSystemService(NotificationManager::class.java)
            .notify(1001, n)
    }

    companion object {
        private const val WORK_NAME = "netguard_monitor"

        fun schedule(context: Context, intervalMinutes: Int) {
            val safe = intervalMinutes.coerceAtLeast(15) // حد WorkManager الأدنى
            val req = PeriodicWorkRequestBuilder<MonitorWorker>(safe.toLong(), TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, req
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
