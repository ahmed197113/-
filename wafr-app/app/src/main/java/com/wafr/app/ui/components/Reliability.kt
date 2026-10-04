package com.wafr.app.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings as AndroidSettings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.wafr.app.appScope
import com.wafr.app.data.Settings
import com.wafr.app.notify.Notifications
import com.wafr.app.notify.ReminderScheduler
import com.wafr.app.repo
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class ReliabilityState(val notifications: Boolean, val exact: Boolean, val battery: Boolean) {
    val allGood: Boolean get() = notifications && exact && battery
}

fun reliability(context: Context) = ReliabilityState(
    notifications = Notifications.canPost(context),
    exact = ReminderScheduler.canExact(context),
    battery = ReminderScheduler.ignoresBatteryOptimizations(context),
)

private fun open(context: Context, intent: Intent) {
    try { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {
        context.startActivity(Intent(AndroidSettings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

fun fixNotifications(context: Context) = open(
    context, Intent(AndroidSettings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(AndroidSettings.EXTRA_APP_PACKAGE, context.packageName),
)

fun fixExact(context: Context) {
    if (Build.VERSION.SDK_INT >= 31) open(context, Intent(AndroidSettings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
}

@android.annotation.SuppressLint("BatteryLife")
fun fixBattery(context: Context) =
    open(context, Intent(AndroidSettings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")))

/** Re-reads the system state every time the screen resumes (after the user returns from Settings). */
@Composable
fun rememberReliability(): ReliabilityState {
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { tick++ }
    return remember(tick) { reliability(context) }
}

private val timeFmt = DateTimeFormatter.ofPattern("EEEE h:mm a", Locale("ar"))

@Composable
fun ReliabilityCard(settings: Settings) {
    val c = Mz.colors
    val context = LocalContext.current
    val r = rememberReliability()
    GlassCard(Modifier.fillMaxWidth()) {
        Text(if (r.allGood) "✅ التذكير يعمل بانتظام" else "⚠️ أكمل الإعدادات لضمان عدم توقف التذكير", fontWeight = FontWeight.Bold, color = if (r.allGood) c.good else c.want)
        if (settings.remindersEnabled && settings.nextCheckInAt > 0) {
            Text(
                "التذكير القادم: " + timeFmt.format(Instant.ofEpochMilli(settings.nextCheckInAt).atZone(ZoneId.systemDefault())),
                style = MaterialTheme.typography.bodySmall, color = c.muted,
            )
        }
        Spacer(Modifier.height(8.dp))
        CheckRow(r.notifications, "الإشعارات مسموحة", "بدونها لا يصلك أي تذكير") { fixNotifications(context) }
        CheckRow(r.exact, "منبّهات دقيقة", "ليصلك التذكير في موعده تماماً") { fixExact(context) }
        CheckRow(r.battery, "مستثنى من توفير البطارية", "يمنع النظام من إيقاف التذكير في الخلفية") { fixBattery(context) }
        Spacer(Modifier.height(6.dp))
        Text(
            "💡 في هواتف شاومي وهواوي وأوبو: فعّل أيضاً «التشغيل التلقائي» لتطبيق وَفْر من إعدادات الهاتف.",
            style = MaterialTheme.typography.bodySmall, color = c.muted,
        )
        Text(
            "🔔 أرسل تذكيراً تجريبياً الآن", color = c.good, fontWeight = FontWeight.Bold, fontSize = 14.sp,
            modifier = Modifier.padding(top = 8.dp).clip(RoundedCornerShape(10.dp)).clickable {
                context.appScope.launch { Notifications.showCheckIn(context, context.repo.snapshotOnce(), settings.reminderHours) }
            }.padding(6.dp),
        )
    }
}

@Composable
private fun CheckRow(ok: Boolean, title: String, subtitle: String, onFix: () -> Unit) {
    val c = Mz.colors
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(if (ok) "✅" else "⚠️", fontSize = 20.sp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted)
        }
        if (!ok) {
            Text(
                "فعّل", color = androidx.compose.ui.graphics.Color(0xFF02101A), fontWeight = FontWeight.Bold,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(c.neon).clickable(onClick = onFix).padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }
    }
}
