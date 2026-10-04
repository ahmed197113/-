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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.mizan.budget.data.Category
import com.mizan.budget.data.Expense
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Insight
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.domain.Tone
import com.mizan.budget.ui.components.AnimatedAmount
import com.mizan.budget.ui.components.ExpenseRow
import com.mizan.budget.ui.components.GlassCard
import com.mizan.budget.ui.components.LegendDot
import com.mizan.budget.ui.components.ProgressRing
import com.mizan.budget.ui.components.SectionTitle
import com.mizan.budget.ui.components.SplitBar
import com.mizan.budget.ui.components.StatTile
import com.mizan.budget.ui.theme.AmountStyle
import com.mizan.budget.ui.theme.Mz
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dateFmt = DateTimeFormatter.ofPattern("EEEE، d MMMM", Locale("ar"))

fun greeting(): String = when (LocalTime.now().hour) {
    in 4..11 -> "صباح الخير"
    in 12..16 -> "نهارك سعيد"
    else -> "مساء الخير"
}

@Composable
fun HomeScreen(
    settings: Settings,
    snap: Snapshot,
    categories: List<Category>,
    insights: List<Insight>,
    contentPadding: PaddingValues,
    onSettings: () -> Unit,
    onSeeAll: () -> Unit,
    onEdit: (Expense) -> Unit,
    onInsights: () -> Unit,
) {
    val c = Mz.colors
    val byId = categories.associateBy { it.id }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "${greeting()}${if (settings.userName.isNotBlank()) "، ${settings.userName}" else ""} 👋",
                        style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                    )
                    Text(dateFmt.format(snap.today), color = c.muted, style = MaterialTheme.typography.bodyMedium)
                }
                IconButton(onClick = onSettings) { Icon(Icons.Outlined.Settings, "الإعدادات") }
            }
        }
        item { HeroCard(snap) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile("🔥", "${snap.streak}", "يوم بلا كماليات", Modifier.weight(1f), accent = c.want)
                StatTile("🎯", "${snap.score}", snap.scoreLabel, Modifier.weight(1f))
                StatTile("🧾", Money.compact(snap.spentToday, ""), "صرف اليوم", Modifier.weight(1f), accent = c.need)
            }
        }
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("ضروري مقابل كمالي", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    if (snap.spent > 0) Text("${(snap.wantsShare * 100).toInt()}% كماليات", color = c.want, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(12.dp))
                SplitBar(snap.needs, snap.wants)
                Spacer(Modifier.height(12.dp))
                Row {
                    Box(Modifier.weight(1f)) { LegendDot(c.need, "ضروري", Money.format(snap.needs, snap.currency)) }
                    Box(Modifier.weight(1f)) { LegendDot(c.want, "كمالي", Money.format(snap.wants, snap.currency)) }
                }
                if (snap.wants > 0) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "💡 كان بإمكانك توفير ${snap.money(snap.wants)} هذه الدورة لو استغنيت عن الكماليات.",
                        style = MaterialTheme.typography.bodySmall, color = c.muted,
                    )
                }
            }
        }
        insights.firstOrNull()?.let { ins -> item { InsightCard(ins, onClick = onInsights) } }
        item { SectionTitle("آخر المصاريف", action = if (snap.expenses.isNotEmpty()) "عرض الكل" else null, onAction = onSeeAll) }
        if (snap.expenses.isEmpty()) {
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("✨", fontSize = 32.sp)
                    Spacer(Modifier.height(6.dp))
                    Text("لا مصاريف بعد في هذه الدورة", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "اضغط زر + لتسجيل أول مصروف، أو أضف اختصار «سجّل مصروف» لستارة الإشعارات والويدجت للشاشة الرئيسية من الإعدادات.",
                        color = c.muted, style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        } else {
            items(snap.expenses.take(6), key = { it.id }) { e ->
                ExpenseRow(e, byId[e.categoryId], snap.currency, onClick = { onEdit(e) })
            }
        }
    }
}

@Composable
private fun HeroCard(snap: Snapshot) {
    val c = Mz.colors
    val label: String
    val amount: Long
    val amountColor: Color
    when {
        !snap.hasBudget -> { label = "صرفت هذه الدورة"; amount = snap.spent; amountColor = Color.White }
        snap.safeToday >= 0 -> { label = "مسموح لك تصرف اليوم"; amount = snap.safeToday; amountColor = Color.White }
        else -> { label = "تجاوزت حد اليوم بـ"; amount = -snap.safeToday; amountColor = Color(0xFFFFB3C1) }
    }
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.hero).padding(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(label, color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodyMedium)
                AnimatedAmount(amount, snap.currency, AmountStyle, amountColor)
                Spacer(Modifier.height(8.dp))
                if (snap.hasBudget) {
                    Text(
                        "المتبقي ${snap.money(snap.remaining)} من ${snap.money(snap.budget)}",
                        color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodySmall,
                    )
                    Text(
                        "${snap.daysLeft} يوم متبقي • المعدل اليومي ${snap.money(snap.dailyAllowance)}",
                        color = Color.White.copy(alpha = 0.6f), style = MaterialTheme.typography.bodySmall,
                    )
                } else {
                    Text("حدّد ميزانيتك الشهرية من الخطة لتفعيل «المسموح اليومي»", color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.bodySmall)
                }
            }
            if (snap.hasBudget) {
                Spacer(Modifier.width(12.dp))
                val ringColor = when {
                    snap.remaining < 0 -> c.danger
                    snap.overPace -> c.want
                    else -> c.good
                }
                ProgressRing(snap.usedFraction, ringColor, Color.White.copy(alpha = 0.15f), Modifier.size(96.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${(snap.usedFraction * 100).toInt()}%", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                        Text("مستهلك", color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun InsightCard(ins: Insight, onClick: (() -> Unit)? = null) {
    val c = Mz.colors
    val tone = when (ins.tone) {
        Tone.GOOD -> c.good
        Tone.WARN -> c.want
        Tone.INFO -> c.need
    }
    GlassCard(Modifier.fillMaxWidth(), onClick = onClick) {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(tone.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                Text(ins.emoji, fontSize = 22.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(ins.title, style = MaterialTheme.typography.titleMedium, color = tone)
                Spacer(Modifier.height(2.dp))
                Text(ins.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
