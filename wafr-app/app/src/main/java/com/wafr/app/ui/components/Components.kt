package com.wafr.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.material3.LocalContentColor
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import com.wafr.app.ui.theme.HudStyle
import com.wafr.app.ui.theme.Plex
import com.wafr.app.ui.theme.WafrColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.domain.toLocalDate
import com.wafr.app.ui.theme.Mz
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max

/** Shared 0..1 clock (9 s loop) that drives every holographic edge, read only in the draw phase. */
val LocalHoloPhase = staticCompositionLocalOf<State<Float>> { mutableStateOf(0f) }

/** Press feedback for anything tappable: springy shrink, ripple and a light haptic tick. */
@Composable
fun Modifier.pressable(shape: Shape, onClick: (() -> Unit)?, enabled: Boolean = true, haptic: Boolean = true): Modifier {
    if (onClick == null) return this.clip(shape)
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.965f else 1f, spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMedium), label = "press")
    val h = LocalHapticFeedback.current
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clip(shape)
        .clickable(interactionSource = src, indication = LocalIndication.current, enabled = enabled) {
            if (haptic) h.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onClick()
        }
}

/** Rotating iridescent hairline plus a specular top reflection. */
fun Modifier.holoEdge(c: WafrColors, phase: State<Float>, radius: Dp, width: Dp = 1.dp, strength: Float = 1f): Modifier = drawWithContent {
    drawContent()
    val ang = phase.value * 2f * PI.toFloat()
    val cx = size.width / 2
    val cy = size.height / 2
    val r = max(size.width, size.height) / 2
    val dx = cos(ang) * r
    val dy = sin(ang) * r
    val brush = Brush.linearGradient(
        listOf(
            c.glow1.copy(alpha = 0.9f * strength), c.cardBorder, c.glow3.copy(alpha = 0.75f * strength),
            c.glow4.copy(alpha = 0.55f * strength), c.cardBorder,
        ),
        start = Offset(cx + dx, cy + dy), end = Offset(cx - dx, cy - dy),
    )
    val w = width.toPx()
    val cr = radius.toPx()
    drawRoundRect(brush, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), CornerRadius(cr - w / 2, cr - w / 2), style = Stroke(w))
    val hl = (if (c.isDark) Color.White else c.glow2).copy(alpha = if (c.isDark) 0.28f else 0.25f)
    drawLine(
        Brush.horizontalGradient(listOf(Color.Transparent, hl, Color.Transparent), startX = size.width * 0.12f, endX = size.width * 0.88f),
        Offset(size.width * 0.12f, w), Offset(size.width * 0.88f, w), strokeWidth = w * 1.4f,
    )
}

/** Holographic glass card: translucent depth fill with a living iridescent edge. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: Dp = 18.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Mz.colors
    val shape = RoundedCornerShape(26.dp)
    CompositionLocalProvider(LocalContentColor provides c.text) {
        Column(
            modifier
                .pressable(shape, onClick)
                .background(c.cardFill)
                .holoEdge(c, LocalHoloPhase.current, 26.dp)
                .padding(padding),
            content = content,
        )
    }
}

private class Star(val x: Float, val y: Float, val r: Float, val a: Float, val k: Int, val p: Float)

/** Deep-space backdrop: nebulae, twinkling stars, a scrolling horizon grid and a scan beam. */
@Composable
fun AuroraBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val c = Mz.colors
    val t = rememberInfiniteTransition(label = "aurora")
    val drift = t.animateFloat(0f, 1f, infiniteRepeatable(tween(16000, easing = LinearEasing), RepeatMode.Reverse), label = "a")
    val phase = t.animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing), RepeatMode.Restart), label = "p")
    val stars = remember {
        val rnd = Random(2500)
        List(110) { Star(rnd.nextFloat(), rnd.nextFloat(), 0.6f + rnd.nextFloat() * 1.6f, 0.25f + rnd.nextFloat() * 0.75f, 1 + rnd.nextInt(3), rnd.nextFloat() * 6.28f) }
    }
    Box(modifier.fillMaxSize().background(c.bg)) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val a = drift.value
            val p = phase.value
            val alpha = if (c.isDark) 0.30f else 0.15f
            nebula(c.glow1.copy(alpha = alpha), Offset(w * (0.12f + 0.3f * a), h * 0.06f), w * 0.95f)
            nebula(c.glow3.copy(alpha = alpha), Offset(w * (0.98f - 0.25f * a), h * (0.32f + 0.1f * a)), w * 0.85f)
            nebula(c.glow4.copy(alpha = alpha * 0.55f), Offset(w * (0.1f + 0.2f * a), h * (0.62f - 0.06f * a)), w * 0.7f)
            nebula(c.glow2.copy(alpha = alpha * 0.7f), Offset(w * 0.5f, h * (1.02f - 0.08f * a)), w)
            if (c.isDark) {
                stars.forEach { s ->
                    val tw = 0.55f + 0.45f * sin(p * 2f * PI.toFloat() * s.k + s.p)
                    drawCircle(Color.White.copy(alpha = s.a * tw * 0.8f), s.r.dp.toPx() * 0.6f, Offset(s.x * w, s.y * h))
                }
            }
            // Horizon grid floor, rushing gently toward the viewer.
            val horizon = h * 0.74f
            val gridColor = (if (c.isDark) c.glow2 else c.glow3).copy(alpha = if (c.isDark) 0.10f else 0.06f)
            drawRect(
                Brush.verticalGradient(listOf(Color.Transparent, c.glow3.copy(alpha = if (c.isDark) 0.08f else 0.04f)), startY = horizon - h * 0.08f, endY = h),
                topLeft = Offset(0f, horizon - h * 0.08f), size = Size(w, h - horizon + h * 0.08f),
            )
            for (i in -12..12) {
                drawLine(gridColor, Offset(w / 2 + i * w * 0.06f, horizon), Offset(w / 2 + i * w * 0.55f, h), 1.2f)
            }
            val n = 9
            for (k in 0 until n) {
                val f = ((k + (p * 3f) % 1f) / n)
                val y = horizon + (h - horizon) * f * f
                drawLine(gridColor.copy(alpha = gridColor.alpha * (0.3f + f)), Offset(0f, y), Offset(w, y), 1.2f)
            }
            drawLine(
                Brush.horizontalGradient(listOf(Color.Transparent, c.glow1.copy(alpha = 0.35f), c.glow4.copy(alpha = 0.3f), Color.Transparent)),
                Offset(0f, horizon), Offset(w, horizon), 1.5f,
            )
            // Slow scan beam.
            val sy = h * p
            drawRect(
                Brush.verticalGradient(listOf(Color.Transparent, c.glow1.copy(alpha = if (c.isDark) 0.035f else 0.02f), Color.Transparent), startY = sy - 60f, endY = sy + 60f),
                topLeft = Offset(0f, sy - 60f), size = Size(w, 120f),
            )
        }
        CompositionLocalProvider(LocalHoloPhase provides phase) { content() }
    }
}

private fun DrawScope.nebula(color: Color, center: Offset, radius: Float) {
    drawCircle(Brush.radialGradient(listOf(color, Color.Transparent), center = center, radius = radius), radius = radius, center = center)
}

/** Tiny instrument-panel caption: glowing dot + wide-tracked Latin label. */
@Composable
fun HudLabel(text: String, modifier: Modifier = Modifier, color: Color = Mz.colors.glow1) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(6.dp).drawBehind { drawCircle(color.copy(alpha = 0.35f), size.minDimension); drawCircle(color) })
        Spacer(Modifier.width(7.dp))
        Text(text, style = HudStyle, color = color.copy(alpha = 0.85f), maxLines = 1)
    }
}

/** Round holo "back" button used by every sub-screen header. */
@Composable
fun HoloBack(onBack: () -> Unit) {
    val c = Mz.colors
    Box(
        Modifier.size(44.dp).pressable(CircleShape, onBack).background(c.cardFill).holoEdge(c, LocalHoloPhase.current, 22.dp),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Icon(
            androidx.compose.material.icons.Icons.AutoMirrored.Outlined.ArrowBack, "رجوع", tint = c.text, modifier = Modifier.size(22.dp),
        )
    }
}

/** Big screen title in iridescent ink, with an optional HUD caption and subtitle. */
@Composable
fun ScreenTitle(title: String, modifier: Modifier = Modifier, hud: String? = null, subtitle: String? = null) {
    val c = Mz.colors
    Column(modifier) {
        if (hud != null) {
            HudLabel(hud)
            Spacer(Modifier.height(6.dp))
        }
        Text(title, style = TextStyle(brush = c.holo, fontFamily = Plex, fontWeight = FontWeight.Bold, fontSize = 28.sp))
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted)
    }
}

/** Holo call-to-action: iridescent fill, travelling light sheen, outer glow and springy press. */
@Composable
fun NeonButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, brush: Brush? = null, onClick: () -> Unit) {
    val c = Mz.colors
    val b = brush ?: c.neon
    val shape = RoundedCornerShape(18.dp)
    val sheen = rememberInfiniteTransition(label = "sheen").animateFloat(
        -0.6f, 1.6f, infiniteRepeatable(tween(2600, easing = LinearEasing), RepeatMode.Restart), label = "s",
    )
    Box(
        modifier
            .height(56.dp)
            .drawBehind {
                if (enabled) drawRoundRect(c.glow2.copy(alpha = 0.22f), Offset(-6f, 4f), Size(size.width + 12f, size.height + 8f), CornerRadius(26.dp.toPx()))
            }
            .pressable(shape, onClick, enabled)
            .background(if (enabled) b else Brush.linearGradient(listOf(c.muted.copy(alpha = 0.3f), c.muted.copy(alpha = 0.3f))))
            .drawWithContent {
                drawContent()
                if (enabled) {
                    val x = size.width * sheen.value
                    drawRect(
                        Brush.linearGradient(
                            listOf(Color.Transparent, Color.White.copy(alpha = 0.35f), Color.Transparent),
                            start = Offset(x - size.height, 0f), end = Offset(x, size.height),
                        ),
                    )
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = if (enabled) Color(0xFF02101A) else c.muted, fontWeight = FontWeight.Bold, fontSize = 17.sp)
    }
}

@Composable
fun SectionTitle(title: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) {
    val c = Mz.colors
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(width = 4.dp, height = 18.dp).clip(RoundedCornerShape(2.dp)).background(Brush.verticalGradient(listOf(c.glow1, c.glow3))))
        Spacer(Modifier.width(10.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        if (action != null) {
            Text(
                action, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(c.glow1.copy(alpha = 0.08f)).clickable(onClick = onAction)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
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

/** HUD ring: tick-mark bezel, glowing arc and a comet head riding the arc's tip. */
@Composable
fun ProgressRing(progress: Float, color: Color, track: Color, modifier: Modifier = Modifier, stroke: Dp = 12.dp, content: @Composable () -> Unit = {}) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(1100, easing = FastOutSlowInEasing), label = "ring")
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val s = stroke.toPx()
            val bezel = 9.dp.toPx()
            val outer = size.minDimension / 2
            val ctr = center
            // Bezel ticks.
            for (i in 0 until 72) {
                val ang = (i * 5f - 90f) * PI.toFloat() / 180f
                val major = i % 6 == 0
                val lit = i / 72f <= p
                val len = if (major) bezel * 0.8f else bezel * 0.45f
                val c0 = Offset(ctr.x + cos(ang) * outer, ctr.y + sin(ang) * outer)
                val c1 = Offset(ctr.x + cos(ang) * (outer - len), ctr.y + sin(ang) * (outer - len))
                drawLine(if (lit) color.copy(alpha = if (major) 0.9f else 0.5f) else track.copy(alpha = 0.6f), c0, c1, if (major) 2.2f else 1.4f)
            }
            val inset = bezel + 4.dp.toPx() + s / 2
            val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
            val tl = Offset(inset, inset)
            drawArc(track, -90f, 360f, false, tl, arcSize, style = Stroke(s, cap = StrokeCap.Round))
            drawArc(color.copy(alpha = 0.16f), -90f, 360f * p, false, tl, arcSize, style = Stroke(s * 2.4f, cap = StrokeCap.Round))
            drawArc(
                Brush.sweepGradient(listOf(color.copy(alpha = 0.35f), color, Color.White.copy(alpha = 0.95f), color), center = ctr),
                -90f, 360f * p, false, tl, arcSize, style = Stroke(s, cap = StrokeCap.Round),
            )
            // Inner hairline ring.
            drawCircle(track.copy(alpha = 0.5f), radius = arcSize.width / 2 - s * 1.3f, center = ctr, style = Stroke(1f))
            if (p > 0.005f) {
                val ang = (-90f + 360f * p) * PI.toFloat() / 180f
                val rr = arcSize.width / 2
                val head = Offset(ctr.x + cos(ang) * rr, ctr.y + sin(ang) * rr)
                drawCircle(Brush.radialGradient(listOf(color.copy(alpha = 0.7f), Color.Transparent), center = head, radius = s * 1.8f), s * 1.8f, head)
                drawCircle(Color.White, s * 0.32f, head)
            }
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
        if (p > 0f) {
            val fw = max(size.height, size.width * p)
            drawRoundRect(
                Brush.horizontalGradient(listOf(color.copy(alpha = 0.55f), color), startX = 0f, endX = fw),
                size = Size(fw, size.height), cornerRadius = r,
            )
            drawCircle(Color.White.copy(alpha = 0.85f), size.height * 0.28f, Offset(fw - size.height / 2, size.height / 2))
        }
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
        Modifier.size(size).clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(color.copy(alpha = 0.32f), color.copy(alpha = 0.08f))))
            .border(1.dp, color.copy(alpha = 0.45f), RoundedCornerShape(14.dp)),
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
        modifier = modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun StatTile(emoji: String, value: String, label: String, modifier: Modifier = Modifier, accent: Color = MaterialTheme.colorScheme.primary) {
    GlassCard(modifier, padding = 14.dp) {
        Box(
            Modifier.size(36.dp).drawBehind {
                drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = 0.45f), Color.Transparent)), size.minDimension * 0.75f)
            }.clip(CircleShape).border(1.dp, accent.copy(alpha = 0.5f), CircleShape),
            contentAlignment = Alignment.Center,
        ) { Text(emoji, fontSize = 18.sp) }
        Spacer(Modifier.height(8.dp))
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
            .background(if (selected) Brush.linearGradient(listOf(color.copy(alpha = 0.28f), color.copy(alpha = 0.08f))) else androidx.compose.ui.graphics.SolidColor(Color.Transparent))
            .border(if (selected) 2.dp else 1.dp, if (selected) color else Mz.colors.cardBorder, RoundedCornerShape(18.dp)),
        contentAlignment = Alignment.Center,
    ) { content() }
}


/** The Wafr mark: the launcher icon layers, clipped to a rounded tile. */
@Composable
fun WafrLogo(size: Dp = 96.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(size * 0.28f))) {
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(com.wafr.app.R.drawable.ic_launcher_background), null,
            Modifier.matchParentSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop,
        )
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(com.wafr.app.R.drawable.ic_launcher_foreground), null,
            Modifier.matchParentSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop,
        )
    }
}
