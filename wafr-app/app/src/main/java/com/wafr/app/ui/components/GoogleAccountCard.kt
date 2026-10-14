package com.wafr.app.ui.components

import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.cloud.DriveBackup
import com.wafr.app.cloud.GoogleAccount
import com.wafr.app.cloud.GoogleProfile
import com.wafr.app.data.Settings
import com.wafr.app.repo
import com.wafr.app.ui.MainViewModel
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** White "Sign in with Google" button following Google's branding (white fill, grey outline, coloured G). */
@Composable
fun GoogleSignInButton(modifier: Modifier = Modifier, text: String = "تسجيل الدخول بحساب Google", onSignedIn: (GoogleProfile) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    Row(
        modifier.height(50.dp)
            .pressable(RoundedCornerShape(25.dp), onClick = {
                if (busy) return@pressable
                if (!GoogleAccount.isConfigured) {
                    Toast.makeText(context, "تسجيل الدخول بـ Google غير مفعّل في هذه النسخة بعد", Toast.LENGTH_LONG).show()
                    return@pressable
                }
                busy = true
                scope.launch {
                    runCatching { GoogleAccount.signIn(context) }
                        .onSuccess(onSignedIn)
                        .onFailure { e ->
                            if (e !is GoogleAccount.Cancelled) Toast.makeText(context, "تعذّر تسجيل الدخول: ${e.message ?: "خطأ"}", Toast.LENGTH_LONG).show()
                        }
                    busy = false
                }
            })
            .background(Color.White)
            .border(1.dp, Color(0xFFDADCE0), RoundedCornerShape(25.dp))
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color(0xFF4285F4))
        else GoogleG()
        Spacer(Modifier.width(12.dp))
        Text(text, color = Color(0xFF1F1F1F), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

@Composable
private fun GoogleG() {
    androidx.compose.foundation.Canvas(Modifier.size(20.dp)) {
        val s = size.minDimension
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(s * 0.2f)
        val inset = s * 0.1f
        val tl = androidx.compose.ui.geometry.Offset(inset, inset)
        val sz = androidx.compose.ui.geometry.Size(s - 2 * inset, s - 2 * inset)
        drawArc(Color(0xFFEA4335), -150f, 105f, false, tl, sz, style = stroke)
        drawArc(Color(0xFFFBBC05), 150f, 60f, false, tl, sz, style = stroke)
        drawArc(Color(0xFF34A853), 50f, 100f, false, tl, sz, style = stroke)
        drawArc(Color(0xFF4285F4), -45f, 95f, false, tl, sz, style = stroke)
        drawRect(Color(0xFF4285F4), androidx.compose.ui.geometry.Offset(s / 2, s / 2 - s * 0.1f), androidx.compose.ui.geometry.Size(s / 2 - inset * 0.2f, s * 0.2f))
    }
}

private val backupTime = SimpleDateFormat("d MMM، h:mm a", Locale("ar"))

/** Settings card: Google account + one-tap Drive backup / restore. */
@Composable
fun GoogleAccountCard(vm: MainViewModel, settings: Settings) {
    val c = Mz.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    var confirmRestore by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf<(suspend (String) -> Unit)?>(null) }

    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { r ->
        val action = pending
        pending = null
        val token = runCatching { DriveBackup.tokenFromConsent(context, r.data) }.getOrNull()
        if (action != null && token != null) scope.launch { action(token) } else { busy = null; toast(context, "لم يتم منح الإذن لـ Google Drive") }
    }

    fun withDrive(label: String, action: suspend (String) -> Unit) {
        busy = label
        scope.launch {
            runCatching { DriveBackup.authorize(context) }
                .onSuccess { auth ->
                    when (auth) {
                        is DriveBackup.Auth.Token -> action(auth.value)
                        is DriveBackup.Auth.NeedsConsent -> {
                            pending = action
                            consent.launch(IntentSenderRequest.Builder(auth.intent.intentSender).build())
                        }
                    }
                }
                .onFailure { busy = null; toast(context, "تعذّر الاتصال بـ Google: ${it.message ?: ""}") }
        }
    }

    val backupNow: suspend (String) -> Unit = { token ->
        runCatching { DriveBackup.backup(context.repo, token) }
            .onSuccess {
                vm.updateSettings { it.copy(lastCloudBackup = System.currentTimeMillis()) }
                toast(context, "✓ حُفظت نسخة في Google Drive")
            }
            .onFailure { toast(context, "تعذّر رفع النسخة: ${it.message ?: ""}") }
        busy = null
    }
    val restoreNow: suspend (String) -> Unit = { token ->
        runCatching { DriveBackup.restore(context.repo, token) }
            .onSuccess { n -> toast(context, if (n == null) "لا توجد نسخة في Drive بعد" else "✓ استُعيد $n مصروف من Drive") }
            .onFailure { toast(context, "تعذّرت الاستعادة: ${it.message ?: ""}") }
        busy = null
    }

    GlassCard(Modifier.fillMaxWidth()) {
        if (settings.googleEmail.isBlank()) {
            Text("سجّل الدخول بحساب Google لتُحفظ نسخة من بياناتك تلقائياً في Google Drive الخاص بك، وتستعيدها عند تغيير الهاتف.", style = MaterialTheme.typography.bodySmall, color = c.muted)
            Spacer(Modifier.height(12.dp))
            GoogleSignInButton(Modifier.fillMaxWidth()) { p ->
                vm.updateSettings { it.copy(googleEmail = p.email, googleName = p.name, userName = it.userName.ifBlank { p.name }) }
                toast(context, "✓ تم تسجيل الدخول")
                withDrive("backup", backupNow)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val initial = (settings.googleName.ifBlank { settings.googleEmail }).take(1).uppercase()
                Box(Modifier.size(44.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) {
                    Text(initial, color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(settings.googleName.ifBlank { "حساب Google" }, fontWeight = FontWeight.SemiBold)
                    Text(settings.googleEmail, style = MaterialTheme.typography.bodySmall, color = c.muted)
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                if (settings.lastCloudBackup > 0) "آخر نسخة في Drive: ${backupTime.format(Date(settings.lastCloudBackup))} • تُحدَّث تلقائياً يومياً"
                else "لم تُرفع أي نسخة بعد",
                style = MaterialTheme.typography.bodySmall, color = c.muted,
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { withDrive("backup", backupNow) }, enabled = busy == null, modifier = Modifier.weight(1f)) {
                    Text(if (busy == "backup") "جارٍ الرفع…" else "☁️ نسخ الآن", textAlign = TextAlign.Center)
                }
                OutlinedButton(onClick = { confirmRestore = true }, enabled = busy == null, modifier = Modifier.weight(1f)) {
                    Text(if (busy == "restore") "جارٍ الاستعادة…" else "⬇️ استعادة", textAlign = TextAlign.Center)
                }
            }
            TextButton(onClick = {
                scope.launch { GoogleAccount.signOut(context) }
                vm.updateSettings { it.copy(googleEmail = "", googleName = "", lastCloudBackup = 0) }
            }) { Text("تسجيل الخروج", color = c.danger) }
        }
    }

    if (confirmRestore) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmRestore = false },
            title = { Text("استعادة من Google Drive؟") },
            text = { Text("ستُستبدل مصاريفك وفئاتك الحالية بآخر نسخة محفوظة في Drive.") },
            confirmButton = { TextButton(onClick = { confirmRestore = false; withDrive("restore", restoreNow) }) { Text("استعادة") } },
            dismissButton = { TextButton(onClick = { confirmRestore = false }) { Text("إلغاء") } },
        )
    }
}

private fun toast(context: Context, msg: String) = Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
