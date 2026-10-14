package com.wafr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import com.wafr.app.ui.components.HudLabel
import com.wafr.app.ui.components.LocalHoloPhase
import com.wafr.app.ui.components.holoEdge
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
                    HudLabel("WAFR OS · 2500")
                    Wordmark(34)
                    Text(
                        "${greeting()}${if (settings.userName.isNotBlank()) "، ${settings.userName}" else ""} • ${dateFmt.format(snap.today)}",
                        color = c.muted, style = MaterialTheme.typography.bodySmall,
                    )
                }
                Box(Modifier.clip(CircleShape).background(c.cardFill).holoEdge(c, LocalHoloPhase.current, 24.dp)) {
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

/** The "quantum core": HUD ring wrapped in counter-rotating orbit lanes with satellites. */
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
    val status = when {
        !snap.hasBudget -> "STANDBY"
        snap.remaining < 0 -> "OVERLOAD"
        snap.overPace -> "CAUTION"
        else -> "OPTIMAL"
    }
    val orbit = rememberInfiniteTransition(label = "orbit")
    val spin = orbit.animateFloat(0f, 360f, infiniteRepeatable(tween(24000, easing = LinearEasing)), label = "spin")
    val breathe = orbit.animateFloat(0.55f, 1f, infiniteRepeatable(tween(2600), RepeatMode.Reverse), label = "breathe")
    val shape = RoundedCornerShape(34.dp)
    Box(
        Modifier.fillMaxWidth().clip(shape).background(c.hero)
            .holoEdge(c, LocalHoloPhase.current, 34.dp, width = 1.5.dp, strength = 1.3f)
            .padding(vertical = 20.dp, horizontal = 18.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            HudLabel("CORE · $status", color = ringColor)
            Spacer(Modifier.weight(1f))
            Text("${snap.daysLeft}d", style = com.wafr.app.ui.theme.HudStyle, color = Color.White.copy(alpha = 0.55f))
        }
        Column(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(262.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.matchParentSize()) {
                    val r = size.minDimension / 2
                    // Core halo.
                    drawCircle(Brush.radialGradient(listOf(ringColor.copy(alpha = 0.22f * breathe.value), Color.Transparent), radius = r), r)
                    rotate(spin.value) {
                        drawCircle(
                            Color.White.copy(alpha = 0.16f), r - 3.dp.toPx(),
                            style = Stroke(1.2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 7.dp.toPx()))),
                        )
                        drawCircle(c.glow1, 3.5.dp.toPx(), Offset(center.x, center.y - (r - 3.dp.toPx())))
                        drawCircle(c.glow1.copy(alpha = 0.3f), 8.dp.toPx(), Offset(center.x, center.y - (r - 3.dp.toPx())))
                    }
                    rotate(-spin.value * 1.6f) {
                        drawArc(c.glow4.copy(alpha = 0.55f), 20f, 70f, false, Offset(8.dp.toPx(), 8.dp.toPx()),
                            androidx.compose.ui.geometry.Size(size.width - 16.dp.toPx(), size.height - 16.dp.toPx()), style = Stroke(1.6f))
                        drawArc(c.glow2.copy(alpha = 0.55f), 200f, 50f, false, Offset(8.dp.toPx(), 8.dp.toPx()),
                            androidx.compose.ui.geometry.Size(size.width - 16.dp.toPx(), size.height - 16.dp.toPx()), style = Stroke(1.6f))
                        drawCircle(c.glow3, 2.5.dp.toPx(), Offset(center.x + (r - 8.dp.toPx()), center.y))
                    }
                }
                ProgressRing(
                    if (snap.hasBudget) 1f - snap.usedFraction else 0f, ringColor, Color.White.copy(alpha = 0.10f),
                    Modifier.size(226.dp), stroke = 12.dp,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(label, color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodyMedium)
                        AnimatedAmount(amount, snap.currency, AmountStyle.copy(fontSize = 34.sp), amountColor)
                        if (snap.hasBudget) {
                            Text(
                                "${(100 - snap.usedFraction * 100).toInt().coerceAtLeast(0)}% متبقٍ من الدورة",
                                color = ringColor, style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            if (snap.hasBudget) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.05f))
                        .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(20.dp)).padding(vertical = 10.dp),
                ) {
                    HeroStat("المتبقي", snap.money(snap.remaining), Modifier.weight(1f))
                    Box(Modifier.size(width = 1.dp, height = 30.dp).background(Color.White.copy(alpha = 0.12f)).align(Alignment.CenterVertically))
                    HeroStat("الأيام", "${snap.daysLeft} يوم", Modifier.weight(1f))
                    Box(Modifier.size(width = 1.dp, height = 30.dp).background(Color.White.copy(alpha = 0.12f)).align(Alignment.CenterVertically))
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
            Box(
                Modifier.size(44.dp).clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(listOf(tone.copy(alpha = 0.32f), tone.copy(alpha = 0.06f))))
                    .border(1.dp, tone.copy(alpha = 0.45f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
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
