package com.sahwa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.AppData
import com.sahwa.app.data.Store
import com.sahwa.app.data.Pace
import com.sahwa.app.guard.ShortsDetector

@Composable
fun SettingsScreen(d: AppData, now: Long) {
    val ctx = LocalContext.current
    val guardOn = remember(now / 3000) { isGuardEnabled(ctx) }
    var confirmRestart by remember { mutableStateOf(false) }
    var futureMsg by remember { mutableStateOf(d.futureMsg) }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { ScreenHeader("الدرع", "اضبط كيف يحميك «صحوة»") }
        item {
            GlowCard(accent = if (guardOn) C.Green else C.Amber) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        SectionTitle(if (guardOn) "🛡️ الدرع يعمل" else "🛡️ الدرع متوقف")
                        Text(
                            "يراقب: " + ShortsDetector.NAMES.values.distinct().joinToString("، "),
                            color = C.Muted, fontSize = 12.sp,
                        )
                    }
                }
                Button(
                    onClick = { openAccessibilitySettings(ctx) },
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (guardOn) C.Panel2 else C.Amber,
                        contentColor = if (guardOn) C.Text else Color.Black,
                    ),
                ) { Text(if (guardOn) "إعدادات إمكانية الوصول" else "تفعيل الدرع") }
                val batteryOk = remember(now / 3000) { isIgnoringBattery(ctx) }
                if (!batteryOk) {
                    OutlinedButton(onClick = { requestIgnoreBattery(ctx) }, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                        Text("🔋 اسمح بالعمل في الخلفية (يمنع توقف الدرع)")
                    }
                }
            }
        }
        item { StrictCard(d) }
        item {
            GlowCard(accent = C.Cyan) {
                SectionTitle("🪜 سرعة التعافي")
                Text(
                    "كم يومًا تقضي في كل مرحلة قبل أن تصعد. الصعود يحتاج نجاحك في 60٪ من أيام المرحلة.",
                    color = C.Muted, fontSize = 12.sp,
                )
                Pace.entries.forEach { p ->
                    val selected = d.pace == p
                    val locked = d.strictActive && p.days > d.pace.days
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (selected) C.Cyan.copy(alpha = 0.15f) else C.Panel2)
                            .clickable(enabled = !locked) { Store.setPace(p) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(p.label, color = if (selected) C.Cyan else C.Text, fontWeight = FontWeight.Bold)
                            Text(p.desc, color = C.Muted, fontSize = 12.sp)
                        }
                        if (selected) Text("✓", color = C.Cyan, fontSize = 18.sp)
                    }
                }
            }
        }
        item {
            GlowCard(accent = C.Violet) {
                SectionTitle("${d.stageInfo.emoji} مرحلتك: ${d.stageInfo.name}")
                Text(
                    "إذا شعرت أن المرحلة صعبة جدًا، انزل درجة. هذا ليس فشلًا — التقدم الثابت أفضل من القفز ثم السقوط.",
                    color = C.Muted, fontSize = 12.sp,
                )
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { Store.stepDown() },
                        enabled = !d.strictActive && d.stage > 1,
                        modifier = Modifier.weight(1f),
                    ) { Text("⬇️ انزل درجة") }
                    OutlinedButton(
                        onClick = { confirmRestart = true },
                        enabled = !d.strictActive,
                        modifier = Modifier.weight(1f),
                    ) { Text("🔁 من البداية") }
                }
            }
        }
        item {
            GlowCard(accent = C.Indigo) {
                ToggleRow("🌙 درع الليل", "إغلاق المقاطع القصيرة ليلًا لحماية نومك", d.nightShield, locked = d.strictActive && d.nightShield) { Store.setNightShield(it) }
                if (d.nightShield) {
                    if (d.strictActive) {
                        Text("ساعات الليل مقفلة أثناء الوضع الصارم.", color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    } else {
                        HourStepper("من الساعة", d.nightStart) { Store.setNightHours(it, d.nightEnd) }
                        HourStepper("حتى الساعة", d.nightEnd) { Store.setNightHours(d.nightStart, it) }
                    }
                }
            }
        }
        item {
            GlowCard(accent = C.Pink) {
                ToggleRow("🧟 كاشف وضع الزومبي", "تنبيه عند التمرير القهري السريع (12 مقطعًا في دقيقة) — من مرحلة النيّة", d.zombieCheck, locked = d.strictActive && d.zombieCheck) {
                    Store.setZombieCheck(it)
                }
            }
        }
        item {
            GlowCard(accent = C.Amber) {
                SectionTitle("💌 رسالة من نفسك المستقبلية")
                Text("تظهر لك في بوابة الوعي كل مرة تحاول فيها الدخول.", color = C.Muted, fontSize = 12.sp)
                OutlinedTextField(
                    value = futureMsg,
                    onValueChange = {
                        futureMsg = it.take(140)
                        Store.setFutureMsg(futureMsg)
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    minLines = 2,
                )
            }
        }
        item {
            Text(
                "🔒 الخصوصية: «صحوة» يعمل بالكامل على هاتفك. لا إنترنت، لا حسابات، لا إعلانات، ولا يقرأ محتوى رسائلك.",
                color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(8.dp),
            )
        }
    }

    if (confirmRestart) {
        AlertDialog(
            onDismissRequest = { confirmRestart = false },
            containerColor = C.Panel2,
            title = { Text("البدء من مرحلة المراقبة؟") },
            text = { Text("سنعيد قياس متوسطك 3 أيام ثم نبني أهدافًا جديدة. سجلاتك وعاداتك تبقى كما هي.", color = C.Muted) },
            confirmButton = {
                TextButton(onClick = {
                    Store.restartLadder()
                    confirmRestart = false
                }) { Text("إعادة البدء") }
            },
            dismissButton = { TextButton(onClick = { confirmRestart = false }) { Text("إلغاء") } },
        )
    }
}

@Composable
private fun sliderColors(c: Color) = SliderDefaults.colors(
    thumbColor = c,
    activeTrackColor = c,
    inactiveTrackColor = C.Panel2,
)

@Composable
private fun ToggleRow(title: String, desc: String, checked: Boolean, locked: Boolean = false, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            SectionTitle(title)
            Text(desc, color = C.Muted, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            enabled = !locked,
            colors = SwitchDefaults.colors(checkedTrackColor = C.Cyan, checkedThumbColor = Color.Black),
        )
    }
}

@Composable
private fun HourStepper(label: String, hour: Int, onChange: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = C.Muted, modifier = Modifier.weight(1f))
        TextButton(onClick = { onChange((hour + 23) % 24) }) { Text("−", fontSize = 20.sp) }
        Text("%02d:00".format(hour), color = C.Text, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        TextButton(onClick = { onChange((hour + 1) % 24) }) { Text("+", fontSize = 20.sp) }
    }
}

@Composable
private fun StrictCard(d: AppData) {
    var pickDays by remember { mutableStateOf<Int?>(null) }
    GlowCard(accent = C.Red) {
        SectionTitle("🔒 الوضع الصارم")
        if (d.strictActive) {
            val left = d.strictUntil - System.currentTimeMillis()
            val days = left / 86_400_000L
            val hours = (left % 86_400_000L) / 3_600_000L
            Text("مفعّل — متبقٍ $days يوم و $hours ساعة", color = C.Red, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
            Text(
                "لا يمكنك الآن رفع الميزانية، تقليل البوابة، إيقاف درع الليل أو كاشف الزومبي، أو إنهاء التركيز مبكرًا.",
                color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp),
            )
            val pending = d.unlockLeftMs
            if (pending == null) {
                OutlinedButton(onClick = { Store.requestUnlock() }, modifier = Modifier.fillMaxWidth()) {
                    Text("🚨 خروج طوارئ (يُفعَّل بعد 24 ساعة)", color = C.Muted)
                }
            } else {
                Text(
                    "طلب الخروج قيد الانتظار: يُلغى الوضع الصارم بعد ${pending / 3_600_000L} س ${(pending % 3_600_000L) / 60_000L} د. " +
                        "غالبًا ستزول الرغبة قبل ذلك 😉",
                    color = C.Amber, fontSize = 12.sp,
                )
                Button(
                    onClick = { Store.cancelUnlock() },
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = C.Green, contentColor = Color.Black),
                ) { Text("تراجعت — أبقِ الوضع الصارم 💪") }
            }
        } else {
            Text(
                "التزام لا رجعة فيه: تُقفل إعداداتك فلا يمكن تخفيفها في لحظة ضعف. الخروج المبكر يحتاج انتظار 24 ساعة.",
                color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(3, 7, 14, 30).forEach { n ->
                    OutlinedButton(onClick = { pickDays = n }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(4.dp)) {
                        Text("$n يوم", fontSize = 13.sp)
                    }
                }
            }
        }
    }
    pickDays?.let { n ->
        AlertDialog(
            onDismissRequest = { pickDays = null },
            containerColor = C.Panel2,
            title = { Text("تفعيل الوضع الصارم $n يوم؟") },
            text = { Text("لن تستطيع تخفيف أي حد طوال المدة. الخروج المبكر يتطلب الانتظار 24 ساعة.", color = C.Muted) },
            confirmButton = {
                TextButton(onClick = {
                    Store.startStrict(n)
                    pickDays = null
                }) { Text("نعم، ألتزم", color = C.Red) }
            },
            dismissButton = { TextButton(onClick = { pickDays = null }) { Text("إلغاء") } },
        )
    }
}
