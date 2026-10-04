package com.wafr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Bill
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.data.Settings
import com.wafr.app.domain.Insight
import com.wafr.app.domain.Money
import com.wafr.app.domain.Snapshot
import com.wafr.app.domain.Tone
import com.wafr.app.ui.components.AnimatedAmount
import com.wafr.app.ui.components.ExpenseRow
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LegendDot
import com.wafr.app.ui.components.ProgressRing
import com.wafr.app.ui.components.rememberReliability
import com.wafr.app.ui.components.SectionTitle
import com.wafr.app.ui.components.SplitBar
import com.wafr.app.ui.components.StatTile
import com.wafr.app.ui.theme.AmountStyle
import com.wafr.app.ui.theme.Mz
import com.wafr.app.ui.theme.Plex
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dateFmt = DateTimeFormatter.ofPattern("EEEE، d MMMM", Locale("ar"))

fun greeting(): String = when (LocalTime.now().hour) {
    in 4..11 -> "صباح الخير"
    in 12..16 -> "نهارك سعيد"
    else -> "مساء الخير"
}

/** The gradient "وَفْر" wordmark. */
@Composable
fun Wordmark(size: Int = 30) {
    Text("وَفْر", style = TextStyle(brush = Mz.colors.neon, fontFamily = Plex, fontWeight = FontWeight.Bold, fontSize = size.sp))
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
    onPlanner: () -> Unit,
    onPayBill: (Bill) -> Unit,
) {
    val c = Mz.colors
    val byId = categories.associateBy { it.id }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Wordmark()
                    Text(
                        "${greeting()}${if (settings.userName.isNotBlank()) "، ${settings.userName}" else ""} • ${dateFmt.format(snap.today)}",
                        color = c.muted, style = MaterialTheme.typography.bodySmall,
                    )
                }
                Box(Modifier.clip(CircleShape).background(c.card).border(1.dp, c.border, CircleShape)) {
                    IconButton(onClick = onSettings) { Icon(Icons.Outlined.Settings, "الإعدادات", tint = c.text) }
                }
            }
        }
        item {
            val r = rememberReliability()
            if (settings.remindersEnabled && !r.allGood) {
                GlassCard(Modifier.fillMaxWidth(), onClick = onSettings) {
                    Text("⚠️ التذكير كل ${settings.reminderHours} ساعات قد يتوقف", color = c.want, fontWeight = FontWeight.Bold)
                    Text("اضغط هنا وفعّل الإعدادات الناقصة (منبّهات دقيقة / استثناء البطارية) ليبقى منتظماً دائماً.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                }
            }
        }
        item { HeroOrb(snap) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile("🔥", "${snap.streak}", "يوم بلا كماليات", Modifier.weight(1f), accent = c.want)
                StatTile("🎯", "${snap.score}", snap.scoreLabel, Modifier.weight(1f), accent = c.good)
                StatTile("🧾", Money.compact(snap.spentToday, ""), "صرف اليوم", Modifier.weight(1f), accent = c.need)
            }
        }
        if (settings.monthlyIncome == 0L || categories.none { it.monthlyLimit > 0 }) {
            item {
                GlassCard(Modifier.fillMaxWidth(), onClick = onPlanner) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🧭", fontSize = 30.sp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("خطّط راتبك بذكاء", style = MaterialTheme.typography.titleMedium, color = c.good)
                            Text("أدخل راتبك واختر قاعدة من كتب الثراء (50/30/20، الحسابات الستة…) وسيوزّعه وَفْر لك.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                        }
                    }
                }
            }
        }
        if (snap.unpaidBills.isNotEmpty()) {
            item {
                SectionTitle("التزامات هذه الدورة • محجوز ${snap.money(snap.reservedBills)}")
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(snap.unpaidBills, key = { it.id }) { b ->
                        GlassCard(Modifier.width(170.dp), padding = 14.dp) {
                            Text("${b.emoji} ${b.name}", fontWeight = FontWeight.SemiBold, maxLines = 1)
                            Text("يوم ${b.dayOfMonth} • ${Money.format(b.amount, snap.currency)}", color = c.muted, style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = { onPayBill(b) }) { Text("دفعتها ✓", color = c.good, fontWeight = FontWeight.Bold) }
                        }
                    }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
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
        item { SectionTitle("آخر المصاريف", action = if (snap.expenses.isNotEmpty()) "السجل الكامل ←" else null, onAction = onSeeAll) }
        if (snap.expenses.isEmpty()) {
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("✨", fontSize = 32.sp)
                    Spacer(Modifier.height(6.dp))
                    Text("لا مصاريف بعد في هذه الدورة", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "اضغط زر ＋ المضيء لتسجيل أول مصروف. ومن الإعدادات أضف زر «سجّل مصروف» لستارة الإشعارات وويدجت الشاشة الرئيسية.",
                        color = c.muted, style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        } else {
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 10.dp) {
                    snap.expenses.take(6).forEach { e ->
                        ExpenseRow(e, byId[e.categoryId], snap.currency, onClick = { onEdit(e) })
                    }
                }
            }
        }
    }
}

@Composable
private fun HeroOrb(snap: Snapshot) {
    val c = Mz.colors
    val label: String
    val amount: Long
    val amountColor: Color
    when {
        !snap.hasBudget -> { label = "صرفت هذه الدورة"; amount = snap.spent; amountColor = Color.White }
        snap.safeToday >= 0 -> { label = "مسموح لك اليوم"; amount = snap.safeToday; amountColor = Color.White }
        else -> { label = "تجاوزت حد اليوم بـ"; amount = -snap.safeToday; amountColor = Color(0xFFFFB3C1) }
    }
    val ringColor = when {
        snap.remaining < 0 -> c.danger
        snap.overPace -> c.want
        else -> c.good
    }
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(32.dp)).background(c.hero)
            .border(1.dp, c.border, RoundedCornerShape(32.dp)).padding(vertical = 22.dp, horizontal = 18.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            ProgressRing(
                if (snap.hasBudget) 1f - snap.usedFraction else 0f, ringColor, Color.White.copy(alpha = 0.10f),
                Modifier.size(220.dp), stroke = 14.dp,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodyMedium)
                    AnimatedAmount(amount, snap.currency, AmountStyle.copy(fontSize = 36.sp), amountColor)
                    if (snap.hasBudget) {
                        Text(
                            "${(100 - snap.usedFraction * 100).toInt().coerceAtLeast(0)}% متبقٍ من الدورة",
                            color = ringColor, style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            if (snap.hasBudget) {
                Row(Modifier.fillMaxWidth()) {
                    HeroStat("المتبقي", snap.money(snap.remaining), Modifier.weight(1f))
                    HeroStat("الأيام", "${snap.daysLeft} يوم", Modifier.weight(1f))
                    HeroStat("المعدل اليومي", snap.money(snap.dailyAllowance), Modifier.weight(1f))
                }
            } else {
                Text(
                    "حدّد ميزانيتك من «الخطة» أو «مخطط الراتب» لتفعيل المسموح اليومي",
                    color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun HeroStat(label: String, value: String, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
        Text(value, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1)
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
                Text(ins.body, style = MaterialTheme.typography.bodyMedium, color = c.muted)
            }
        }
    }
}
