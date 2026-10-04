package com.sahwa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.AppData
import java.time.DayOfWeek
import java.time.LocalDate

private fun arDay(d: DayOfWeek) = when (d) {
    DayOfWeek.SATURDAY -> "سبت"
    DayOfWeek.SUNDAY -> "أحد"
    DayOfWeek.MONDAY -> "اثنين"
    DayOfWeek.TUESDAY -> "ثلاثاء"
    DayOfWeek.WEDNESDAY -> "أربعاء"
    DayOfWeek.THURSDAY -> "خميس"
    DayOfWeek.FRIDAY -> "جمعة"
}

@Composable
fun StatsScreen(d: AppData, now: Long) {
    val ctx = LocalContext.current
    val today = LocalDate.now()
    val week = (6 downTo 0).map { today.minusDays(it.toLong()) }
    val prevWeek = (13 downTo 7).map { today.minusDays(it.toLong()) }
    val labels = week.map { arDay(it.dayOfWeek) }
    val swipes = week.map { d.day(it.toString()).swipes.toFloat() }
    val minutes = week.map { d.day(it.toString()).shortsSec / 60f }
    val thisTotal = swipes.sum()
    val prevTotal = prevWeek.sumOf { d.day(it.toString()).swipes }.toFloat()
    val resisted = week.sumOf { d.day(it.toString()).resisted }
    val activities = week.sumOf { d.day(it.toString()).activities }
    val focus = week.sumOf { d.day(it.toString()).focusMin }

    val usageAllowed = remember(now / 5000) { hasUsageAccess(ctx) }
    val usage = remember(now / 30000, usageAllowed) { if (usageAllowed) shortsAppsUsageToday(ctx) else emptyMap() }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { ScreenHeader("التقدّم", "الأرقام لا تكذب — راقب عقلك وهو يتعافى") }
        item {
            GlowCard(accent = if (prevTotal == 0f || thisTotal <= prevTotal) C.Green else C.Red) {
                SectionTitle("🔍 رؤية الأسبوع")
                Text(insight(thisTotal, prevTotal), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
            }
        }
        item {
            GlowCard(accent = C.Pink) {
                SectionTitle("📲 التمريرات اليومية")
                Spacer(Modifier.height(12.dp))
                BarChart(swipes, labels, C.Pink)
            }
        }
        item {
            GlowCard(accent = C.Amber) {
                SectionTitle("⏱ دقائق المقاطع القصيرة")
                Spacer(Modifier.height(12.dp))
                BarChart(minutes, labels, C.Amber)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MiniStat("💪", "$resisted", "مقاومة", C.Green, Modifier.weight(1f))
                MiniStat("⚡", "$activities", "نشاط بديل", C.Cyan, Modifier.weight(1f))
                MiniStat("🎯", "$focus د", "تركيز", C.Violet, Modifier.weight(1f))
            }
        }
        item {
            GlowCard(accent = C.Indigo) {
                SectionTitle("📊 وقت تطبيقات المقاطع اليوم")
                if (!usageAllowed) {
                    Text(
                        "امنح صلاحية «الوصول لبيانات الاستخدام» لترى الوقت الحقيقي لكل تطبيق.",
                        color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp),
                    )
                    Button(
                        onClick = { openUsageSettings(ctx) },
                        colors = ButtonDefaults.buttonColors(containerColor = C.Indigo, contentColor = Color.Black),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("منح الصلاحية") }
                } else if (usage.isEmpty()) {
                    Text("لم تفتح أي تطبيق مقاطع اليوم. 👏", color = C.Green, modifier = Modifier.padding(top = 8.dp))
                } else {
                    usage.entries.sortedByDescending { it.value }.forEach { (name, ms) ->
                        Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(name, color = C.Text, modifier = Modifier.weight(1f))
                            Text(formatDuration(ms / 1000), color = C.Indigo, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

private fun insight(thisWeek: Float, prevWeek: Float): String = when {
    thisWeek == 0f && prevWeek == 0f -> "لا توجد تمريرات مسجلة بعد. فعّل الدرع وابدأ رحلتك."
    prevWeek == 0f -> "هذا أسبوعك الأول. سجّلت ${thisWeek.toInt()} تمريرة — سنقارن الأسبوع القادم."
    thisWeek <= prevWeek -> {
        val pct = ((prevWeek - thisWeek) / prevWeek * 100).toInt()
        "رائع! قلّلت التمرير بنسبة $pct% عن الأسبوع الماضي. دماغك يستعيد قدرته على التركيز."
    }
    else -> {
        val pct = ((thisWeek - prevWeek) / prevWeek * 100).toInt()
        "زاد التمرير $pct% عن الأسبوع الماضي. لا بأس — جرّب تفعيل التركيز العميق أو تقليل الميزانية."
    }
}

@Composable
fun BarChart(values: List<Float>, labels: List<String>, color: Color) {
    val max = (values.maxOrNull() ?: 0f).coerceAtLeast(1f)
    Column {
        Row(
            Modifier.fillMaxWidth().height(150.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            values.forEachIndexed { i, v ->
                Column(
                    Modifier.weight(1f).fillMaxHeight(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                ) {
                    Text(v.toInt().toString(), color = C.Muted, fontSize = 10.sp)
                    Box(
                        Modifier
                            .width(18.dp)
                            .fillMaxHeight((v / max).coerceIn(0.02f, 1f) * 0.82f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                Brush.verticalGradient(
                                    if (i == values.lastIndex) listOf(C.Text, color) else listOf(color, color.copy(alpha = 0.35f)),
                                ),
                            ),
                    )
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            labels.forEach {
                Text(it, color = C.Muted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            }
        }
    }
}
