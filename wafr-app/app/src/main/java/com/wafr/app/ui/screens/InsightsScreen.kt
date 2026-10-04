package com.wafr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.domain.Achievement
import com.wafr.app.domain.Insight
import com.wafr.app.domain.Money
import com.wafr.app.domain.Snapshot
import com.wafr.app.ui.components.DailyBars
import com.wafr.app.ui.components.DonutChart
import com.wafr.app.ui.components.DonutSlice
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LegendDot
import com.wafr.app.ui.components.LinearMeter
import com.wafr.app.ui.components.ProgressRing
import com.wafr.app.ui.components.SectionTitle
import com.wafr.app.ui.theme.Mz

@Composable
fun InsightsScreen(snap: Snapshot, insights: List<Insight>, achievements: List<Achievement>, contentPadding: PaddingValues) {
    val c = Mz.colors
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text("التحليلات", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "الدورة: ${snap.period.start.dayOfMonth}/${snap.period.start.monthValue} — ${snap.period.end.minusDays(1).dayOfMonth}/${snap.period.end.minusDays(1).monthValue}",
                color = c.muted, style = MaterialTheme.typography.bodySmall,
            )
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val ringColor = when {
                        snap.score >= 70 -> c.good
                        snap.score >= 50 -> c.want
                        else -> c.danger
                    }
                    ProgressRing(snap.score / 100f, ringColor, c.muted.copy(alpha = 0.15f), Modifier.size(104.dp), stroke = 10.dp) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${snap.score}", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = ringColor)
                            Text("من 100", fontSize = 11.sp, color = c.muted)
                        }
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text("مؤشر الانضباط", style = MaterialTheme.typography.titleMedium)
                        Text(snap.scoreLabel, color = ringColor, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "يُحسب من وتيرة صرفك مقارنة بالأيام المنقضية، ونسبة الكماليات، وسلسلة أيامك المنضبطة.",
                            style = MaterialTheme.typography.bodySmall, color = c.muted,
                        )
                    }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("الصرف اليومي", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LegendDot(c.need, "ضروري", "")
                    LegendDot(c.want, "كمالي", "")
                    if (snap.hasBudget) LegendDot(c.muted, "- - المعدل المسموح", "")
                }
                Spacer(Modifier.height(14.dp))
                DailyBars(snap.daily, snap.dailyWants, snap.daysElapsed - 1, if (snap.hasBudget) snap.budget / snap.period.totalDays else 0L)
                Spacer(Modifier.height(8.dp))
                Row {
                    Column(Modifier.weight(1f)) {
                        Text("المتوسط اليومي", color = c.muted, style = MaterialTheme.typography.bodySmall)
                        Text(snap.money(snap.spent / snap.daysElapsed.coerceAtLeast(1)), fontWeight = FontWeight.Bold)
                    }
                    Column(Modifier.weight(1f)) {
                        Text("المتوقع نهاية الدورة", color = c.muted, style = MaterialTheme.typography.bodySmall)
                        Text(snap.money(snap.projected), fontWeight = FontWeight.Bold, color = if (snap.hasBudget && snap.projected > snap.budget) c.danger else Color.Unspecified)
                    }
                }
            }
        }
        item {
            val cats = snap.byCategory.filter { it.spent > 0 }
            GlassCard(Modifier.fillMaxWidth()) {
                Text("أين تذهب أموالك؟", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(14.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    DonutChart(cats.map { DonutSlice(it.spent.toFloat(), Color(it.category.color)) }, Modifier.size(190.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("المجموع", color = c.muted, fontSize = 12.sp)
                            Text(Money.compact(snap.spent, snap.currency), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
                if (cats.isEmpty()) Text("لا بيانات بعد", color = c.muted)
                cats.forEach { cs ->
                    val pct = if (snap.spent > 0) cs.spent.toFloat() / snap.spent else 0f
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(10.dp).clip(CircleShape).background(Color(cs.category.color)))
                        Spacer(Modifier.width(8.dp))
                        Text("${cs.category.emoji} ${cs.category.name}", modifier = Modifier.weight(1f))
                        Text("${(pct * 100).toInt()}%", color = c.muted, fontSize = 12.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(Money.format(cs.spent, snap.currency), fontWeight = FontWeight.Bold)
                    }
                    LinearMeter(pct, Color(cs.category.color), height = 5.dp)
                }
            }
        }
        item { HeatmapCard(snap) }
        if (insights.isNotEmpty()) {
            item { SectionTitle("نصائح ذكية لك") }
            items(insights) { InsightCard(it) }
        }
        item {
            SectionTitle("إنجازاتك • ${achievements.count { it.unlocked }}/${achievements.size}")
            GlassCard(Modifier.fillMaxWidth(), padding = 12.dp) {
                achievements.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { a ->
                            Row(
                                Modifier.weight(1f).padding(vertical = 6.dp).clip(RoundedCornerShape(16.dp))
                                    .background(if (a.unlocked) c.good.copy(alpha = 0.10f) else c.muted.copy(alpha = 0.06f)).padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(if (a.unlocked) a.emoji else "🔒", fontSize = 22.sp)
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text(a.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (a.unlocked) c.text else c.muted)
                                    Text(a.description, fontSize = 11.sp, color = c.muted, maxLines = 2)
                                }
                            }
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/** A month calendar coloured by how much was spent each day versus the allowance. */
@Composable
private fun HeatmapCard(snap: Snapshot) {
    val c = Mz.colors
    val avg = if (snap.hasBudget) snap.budget / snap.period.totalDays else (snap.daily.filter { it > 0 }.average().takeIf { !it.isNaN() } ?: 1.0).toLong()
    GlassCard(Modifier.fillMaxWidth()) {
        Text("خريطة الدورة", style = MaterialTheme.typography.titleMedium)
        Text("كل مربع يوم: الأخضر تحت المعدل، البرتقالي فوقه، الأحمر ضعفه", style = MaterialTheme.typography.bodySmall, color = c.muted)
        Spacer(Modifier.height(12.dp))
        snap.daily.withIndex().chunked(7).forEach { week ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 6.dp)) {
                week.forEach { (i, v) ->
                    val future = i >= snap.daysElapsed
                    val color = when {
                        future -> c.muted.copy(alpha = 0.08f)
                        v == 0L -> c.good.copy(alpha = 0.25f)
                        v <= avg -> c.good.copy(alpha = 0.6f)
                        v <= avg * 2 -> c.want.copy(alpha = 0.75f)
                        else -> c.danger.copy(alpha = 0.85f)
                    }
                    Box(
                        Modifier.weight(1f).height(30.dp).clip(RoundedCornerShape(8.dp)).background(color),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("${snap.period.start.plusDays(i.toLong()).dayOfMonth}", fontSize = 10.sp, color = if (future) c.muted else c.text)
                    }
                }
                repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
