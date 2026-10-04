package com.mizan.budget.ui.screens

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
import com.mizan.budget.domain.Insight
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.ui.components.DailyBars
import com.mizan.budget.ui.components.DonutChart
import com.mizan.budget.ui.components.DonutSlice
import com.mizan.budget.ui.components.GlassCard
import com.mizan.budget.ui.components.LegendDot
import com.mizan.budget.ui.components.LinearMeter
import com.mizan.budget.ui.components.ProgressRing
import com.mizan.budget.ui.components.SectionTitle
import com.mizan.budget.ui.theme.Mz

@Composable
fun InsightsScreen(snap: Snapshot, insights: List<Insight>, contentPadding: PaddingValues) {
    val c = Mz.colors
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 96.dp),
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
        if (insights.isNotEmpty()) {
            item { SectionTitle("نصائح ذكية لك") }
            items(insights) { InsightCard(it) }
        }
    }
}
