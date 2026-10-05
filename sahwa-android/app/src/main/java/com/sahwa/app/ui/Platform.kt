package com.sahwa.app.ui

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.sahwa.app.guard.GuardService
import com.sahwa.app.guard.ShortsDetector
import java.time.LocalDate
import java.time.ZoneId

fun isGuardEnabled(ctx: Context): Boolean {
    val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        ?: return false
    val me = ComponentName(ctx, GuardService::class.java)
    return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
}

fun openAccessibilitySettings(ctx: Context) {
    runCatching {
        ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

fun isIgnoringBattery(ctx: Context): Boolean {
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(ctx.packageName)
}

/** Asks the system not to kill the shield to save battery (a common cause of it stopping). */
@SuppressLint("BatteryLife")
fun requestIgnoreBattery(ctx: Context) {
    val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.packageName))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { ctx.startActivity(direct) }.onFailure {
        runCatching {
            ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}

/** The shield is switched on in settings but hasn't ticked recently: the system stopped it. */
fun isGuardStalled(ctx: Context, now: Long): Boolean =
    android.os.SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime() > 15_000L &&
        isGuardEnabled(ctx) && now - com.sahwa.app.data.Store.guardHeartbeat > 15_000L

fun hasUsageAccess(ctx: Context): Boolean {
    val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    } else {
        @Suppress("DEPRECATION")
        ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
}

fun openUsageSettings(ctx: Context) {
    runCatching {
        ctx.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

/** Foreground time today (ms) of every short-video app, keyed by display name. */
fun shortsAppsUsageToday(ctx: Context): Map<String, Long> {
    val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return emptyMap()
    val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val end = System.currentTimeMillis()
    val events = runCatching { usm.queryEvents(start, end) }.getOrNull() ?: return emptyMap()
    val e = UsageEvents.Event()
    val open = HashMap<String, Long>()
    val total = HashMap<String, Long>()
    while (events.hasNextEvent()) {
        events.getNextEvent(e)
        val p = e.packageName ?: continue
        if (!ShortsDetector.isMonitored(p)) continue
        when (e.eventType) {
            1 -> open[p] = e.timeStamp // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
            2 -> open.remove(p)?.let { s -> total[p] = (total[p] ?: 0L) + (e.timeStamp - s) } // ACTIVITY_PAUSED
        }
    }
    open.forEach { (p, s) -> total[p] = (total[p] ?: 0L) + (end - s) }
    val byName = HashMap<String, Long>()
    total.forEach { (p, ms) ->
        val name = ShortsDetector.NAMES[p] ?: p
        byName[name] = (byName[name] ?: 0L) + ms
    }
    return byName
}

fun formatDuration(sec: Long): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    return when {
        h > 0 -> "${h}س ${m}د"
        m > 0 -> "${m} د"
        else -> "${sec} ث"
    }
}
