package com.sahwa.app.ui

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
import com.sahwa.app.data.TARGET_BUDGET
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
            }
        }
        item {
            GlowCard(accent = C.Cyan) {
                SectionTitle("⚡ ميزانية البداية: ${d.startBudget} تمريرة/يوم")
                Text(
                    "تنخفض تلقائيًا خلال 30 يومًا حتى $TARGET_BUDGET. ميزانية اليوم: ${d.baseBudget}",
                    color = C.Muted, fontSize = 12.sp,
                )
                Slider(
                    value = d.startBudget.toFloat(),
                    onValueChange = { Store.setStartBudget(it.toInt()) },
                    valueRange = 15f..200f,
                    colors = sliderColors(C.Cyan),
                )
            }
        }
        item {
            GlowCard(accent = C.Violet) {
                SectionTitle("🧠 بوابة الوعي: ${d.gateSeconds} ثوانٍ")
                Text("مدة التنفس قبل كل جلسة. تزيد 5 ثوانٍ مع كل جلسة إضافية في اليوم.", color = C.Muted, fontSize = 12.sp)
                Slider(
                    value = d.gateSeconds.toFloat(),
                    onValueChange = { Store.setGateSeconds(it.toInt()) },
                    valueRange = 3f..30f,
                    colors = sliderColors(C.Violet),
                )
            }
        }
        item {
            GlowCard(accent = C.Indigo) {
                ToggleRow("🌙 درع الليل", "إغلاق المقاطع القصيرة ليلًا لحماية نومك", d.nightShield) { Store.setNightShield(it) }
                if (d.nightShield) {
                    HourStepper("من الساعة", d.nightStart) { Store.setNightHours(it, d.nightEnd) }
                    HourStepper("حتى الساعة", d.nightEnd) { Store.setNightHours(d.nightStart, it) }
                }
            }
        }
        item {
            GlowCard(accent = C.Pink) {
                ToggleRow("🧟 كاشف وضع الزومبي", "تنبيه عند التمرير القهري السريع (12 تمريرة في دقيقة)", d.zombieCheck) {
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
            GlowCard(accent = C.Green) {
                SectionTitle("🌱 برنامج التعافي")
                Text("اليوم ${d.programDay}. إعادة البدء ترجع الميزانية لقيمة البداية.", color = C.Muted, fontSize = 12.sp)
                OutlinedButton(onClick = { confirmRestart = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text("إعادة بدء البرنامج")
                }
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
            title = { Text("إعادة بدء البرنامج؟") },
            text = { Text("سيعود العدّاد لليوم 1. سجلاتك وعاداتك تبقى كما هي.", color = C.Muted) },
            confirmButton = {
                TextButton(onClick = {
                    Store.restartProgram()
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
private fun ToggleRow(title: String, desc: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            SectionTitle(title)
            Text(desc, color = C.Muted, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
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
