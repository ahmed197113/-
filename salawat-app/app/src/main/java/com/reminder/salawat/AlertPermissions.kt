package com.reminder.salawat

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/**
 * Everything the adhan and reminders need to fire on time, asked for in one pass: notifications (Android 13+),
 * exact alarms (Android 12, where it is a user setting) and leaving the app out of battery optimisation, so
 * the phone's power saving never delays or swallows an adhan. Each step explains itself before opening settings.
 */
object AlertPermissions {
    private const val KEY_BATTERY_ASKED = "battery_opt_asked"

    fun requestAll(activity: AppCompatActivity, permissions: PermissionRequester, onDone: () -> Unit) {
        permissions.requestNotifications { granted ->
            if (!granted && Build.VERSION.SDK_INT >= 33) explainNotifications(activity) { exactAlarms(activity) { battery(activity, onDone) } }
            else exactAlarms(activity) { battery(activity, onDone) }
        }
    }

    private fun explainNotifications(activity: AppCompatActivity, next: () -> Unit) {
        dialog(activity, R.string.perm_notif_title, R.string.perm_notif_text, R.string.location_open_app_settings, {
            open(activity, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName))
        }, next)
    }

    @SuppressLint("InlinedApi")
    private fun exactAlarms(activity: AppCompatActivity, next: () -> Unit) {
        if (PrayerScheduler.canScheduleExact(activity)) return next()
        dialog(activity, R.string.perm_alarm_title, R.string.perm_alarm_text, R.string.perm_allow, {
            open(activity, Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + activity.packageName)))
        }, next)
    }

    fun ignoresBatteryOptimizations(context: Context): Boolean =
        context.getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(context.packageName) ?: true

    private fun battery(activity: AppCompatActivity, next: () -> Unit) {
        val prefs = Prefs.get(activity)
        if (ignoresBatteryOptimizations(activity) || prefs.getBoolean(KEY_BATTERY_ASKED, false)) return next()
        prefs.edit().putBoolean(KEY_BATTERY_ASKED, true).apply()
        dialog(activity, R.string.perm_battery_title, R.string.perm_battery_text, R.string.perm_open_battery, {
            open(activity, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }, next)
    }

    private fun dialog(activity: AppCompatActivity, title: Int, text: Int, positive: Int, onPositive: () -> Unit, next: () -> Unit) {
        if (activity.isFinishing) return next()
        AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(text)
            .setCancelable(false)
            .setPositiveButton(positive) { _, _ -> onPositive(); next() }
            .setNegativeButton(R.string.perm_later) { _, _ -> next() }
            .show()
    }

    private fun open(activity: AppCompatActivity, intent: Intent) {
        runCatching { activity.startActivity(intent) }.onFailure {
            runCatching { activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", activity.packageName, null))) }
        }
    }
}
