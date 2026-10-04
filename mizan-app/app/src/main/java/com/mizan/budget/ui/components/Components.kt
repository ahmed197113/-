package com.mizan.budget.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mizan.budget.data.Category
import com.mizan.budget.data.Expense
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.toLocalDate
import com.mizan.budget.ui.theme.Mz
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: Dp = 18.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Mz.colors
    val shape = RoundedCornerShape(24.dp)
    val border = BorderStroke(1.dp, c.cardBorder)
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier, shape = shape, color = c.card, border = border) {
            Column(Modifier.padding(padding), content = content)
        }
    } else {
        Surface(modifier = modifier, shape = shape, color = c.card, border = border) {
            Column(Modifier.padding(padding), content = content)
        }
    }
}

@Composable
fun SectionTitle(title: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        if (action != null) {
            Text(
                action, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onAction).padding(6.dp),
            )
        }
    }
}

/** Counts up/down smoothly whenever the amount changes. */
@Composable
fun AnimatedAmount(minor: Long, currency: String, style: TextStyle, color: Color = Color.Unspecified, prefix: String = "") {
    val anim = remember { Animatable(minor.toFloat()) }
    LaunchedEffect(minor) { anim.animateTo(minor.toFloat(), tween(700, easing = FastOutSlowInEasing)) }
    Row(verticalAlignment = Alignment.Bottom) {
        Text(prefix + Money.plain(anim.value.toLong()), style = style, color = color, maxLines = 1)
        Spacer(Modifier.width(6.dp))
        Text(currency, style = MaterialTheme.typography.titleMedium, color = color.copy(alpha = 0.7f), modifier = Modifier.padding(bottom = 6.dp))
    }
}

@Composable
fun ProgressRing(progress: Float, color: Color, track: Color, modifier: Modifier = Modifier, stroke: Dp = 12.dp, content: @Composable () -> Unit = {}) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(900, easing = FastOutSlowInEasing), label = "ring")
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val s = stroke.toPx()
            val arcSize = Size(size.width - s, size.height - s)
            val tl = Offset(s / 2, s / 2)
            drawArc(track, -90f, 360f, false, tl, arcSize, style = Stroke(s, cap = StrokeCap.Round))
            drawArc(color, -90f, 360f * p, false, tl, arcSize, style = Stroke(s, cap = StrokeCap.Round))
        }
        content()
    }
}

/** Horizontal bar split into "needs" and "wants". */
@Composable
fun SplitBar(needs: Long, wants: Long, modifier: Modifier = Modifier) {
    val c = Mz.colors
    val total = max(1L, needs + wants)
    val f by animateFloatAsState(needs.toFloat() / total, tween(800), label = "split")
    Canvas(modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp))) {
        if (needs + wants == 0L) {
            drawRect(c.muted.copy(alpha = 0.2f)); return@Canvas
        }
        drawRect(c.need, size = Size(size.width * f, size.height))
        drawRect(c.want, topLeft = Offset(size.width * f, 0f), size = Size(size.width * (1 - f), size.height))
    }
}

@Composable
fun LegendDot(color: Color, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.bodySmall, color = Mz.colors.muted)
        Spacer(Modifier.width(6.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun LinearMeter(progress: Float, color: Color, modifier: Modifier = Modifier, height: Dp = 8.dp) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(800), label = "meter")
    val track = Mz.colors.muted.copy(alpha = 0.18f)
    Canvas(modifier.fillMaxWidth().height(height)) {
        val r = CornerRadius(size.height / 2, size.height / 2)
        drawRoundRect(track, cornerRadius = r)
        if (p > 0f) drawRoundRect(color, size = Size(max(size.height, size.width * p), size.height), cornerRadius = r)
    }
}

data class DonutSlice(val value: Float, val color: Color)

@Composable
fun DonutChart(slices: List<DonutSlice>, modifier: Modifier = Modifier, stroke: Dp = 22.dp, content: @Composable () -> Unit = {}) {
    val anim = remember { Animatable(0f) }
    LaunchedEffect(slices) { anim.snapTo(0f); anim.animateTo(1f, tween(1000, easing = FastOutSlowInEasing)) }
    val track = Mz.colors.muted.copy(alpha = 0.15f)
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val s = stroke.toPx()
            val arcSize = Size(size.width - s, size.height - s)
            val tl = Offset(s / 2, s / 2)
            val total = slices.sumOf { it.value.toDouble() }.toFloat()
            if (total <= 0f) {
                drawArc(track, 0f, 360f, false, tl, arcSize, style = Stroke(s)); return@Canvas
            }
            var start = -90f
            val gap = if (slices.size > 1) 2f else 0f
            slices.forEach { sl ->
                val sweep = 360f * sl.value / total * anim.value
                drawArc(sl.color, start + gap / 2, max(0f, sweep - gap), false, tl, arcSize, style = Stroke(s, cap = StrokeCap.Butt))
                start += sweep
            }
        }
        content()
    }
}

/** Daily stacked bars (needs bottom, wants top) for the whole cycle. */
@Composable
fun DailyBars(daily: List<Long>, wants: List<Long>, todayIndex: Int, allowance: Long, modifier: Modifier = Modifier) {
    val c = Mz.colors
    val anim = remember { Animatable(0f) }
    LaunchedEffect(daily) { anim.snapTo(0f); anim.animateTo(1f, tween(900)) }
    val maxV = max(1L, max(daily.maxOrNull() ?: 0L, allowance)).toFloat()
    Canvas(modifier.fillMaxWidth().height(140.dp)) {
        val n = max(1, daily.size)
        val slot = size.width / n
        val bw = slot * 0.62f
        daily.forEachIndexed { i, v ->
            // RTL: day 1 on the right.
            val x = size.width - (i + 1) * slot + (slot - bw) / 2
            val h = size.height * (v / maxV) * anim.value
            val wh = size.height * (wants.getOrElse(i) { 0L } / maxV) * anim.value
            val base = if (i == todayIndex) c.good else c.need
            if (v == 0L) {
                drawRoundRect(c.muted.copy(alpha = 0.15f), Offset(x, size.height - 3.dp.toPx()), Size(bw, 3.dp.toPx()), CornerRadius(2f, 2f))
            } else {
                drawRoundRect(base.copy(alpha = if (i > todayIndex) 0.3f else 0.9f), Offset(x, size.height - h), Size(bw, h), CornerRadius(bw / 3, bw / 3))
                if (wh > 0) drawRoundRect(c.want, Offset(x, size.height - h), Size(bw, wh), CornerRadius(bw / 3, bw / 3))
            }
        }
        if (allowance > 0) {
            val y = size.height - size.height * (allowance / maxV)
            var xx = 0f
            while (xx < size.width) {
                drawLine(c.muted.copy(alpha = 0.6f), Offset(xx, y), Offset(xx + 8f, y), strokeWidth = 2f)
                xx += 16f
            }
        }
    }
}

@Composable
fun CategoryBadge(category: Category?, size: Dp = 42.dp) {
    val color = Color(category?.color ?: 0xFF94A3B8)
    Box(
        Modifier.size(size).clip(RoundedCornerShape(14.dp)).background(color.copy(alpha = 0.18f)),
        contentAlignment = Alignment.Center,
    ) { Text(category?.emoji ?: "✨", fontSize = (size.value * 0.48f).sp) }
}

private val timeFmt = DateTimeFormatter.ofPattern("h:mm a", Locale("ar"))

@Composable
fun ExpenseRow(e: Expense, category: Category?, currency: String, onClick: () -> Unit, showDate: Boolean = false) {
    val c = Mz.colors
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(vertical = 10.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CategoryBadge(category)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                e.note.ifBlank { category?.name ?: "مصروف" }, style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            val dt = java.time.Instant.ofEpochMilli(e.timestamp).atZone(java.time.ZoneId.systemDefault())
            val sub = buildString {
                append(category?.name ?: "")
                append(" • ")
                if (showDate) append("${dt.dayOfMonth}/${dt.monthValue} ")
                append(timeFmt.format(dt))
            }
            Text(sub, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("-${Money.plain(e.amount)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Pill(if (e.isNeed) "ضروري" else "كمالي", if (e.isNeed) c.need else c.want)
        }
    }
}

@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier) {
    Text(
        text, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold,
        modifier = modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun StatTile(emoji: String, value: String, label: String, modifier: Modifier = Modifier, accent: Color = MaterialTheme.colorScheme.primary) {
    GlassCard(modifier, padding = 14.dp) {
        Text(emoji, fontSize = 20.sp)
        Spacer(Modifier.height(6.dp))
        Text(value, style = MaterialTheme.typography.titleLarge, color = accent, maxLines = 1)
        Text(label, style = MaterialTheme.typography.bodySmall, color = Mz.colors.muted, maxLines = 1)
    }
}

@Composable
fun Hairline(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Mz.colors.cardBorder))
}

@Composable
fun OutlinedBox(modifier: Modifier = Modifier, selected: Boolean, color: Color, content: @Composable () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(18.dp))
            .background(if (selected) color.copy(alpha = 0.18f) else Color.Transparent)
            .border(if (selected) 2.dp else 1.dp, if (selected) color else Mz.colors.cardBorder, RoundedCornerShape(18.dp)),
        contentAlignment = Alignment.Center,
    ) { content() }
}

