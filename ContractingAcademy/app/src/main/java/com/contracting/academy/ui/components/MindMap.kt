package com.contracting.academy.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.contracting.academy.data.MapNode

/** ألوان الفروع: متمايزة وواضحة في الوضعين الفاتح والداكن. */
val BranchColors = listOf(
    Color(0xFF2E7D7A), Color(0xFFB7860B), Color(0xFF6A4C93), Color(0xFFC0504D),
    Color(0xFF2C6FB7), Color(0xFF3D8B37), Color(0xFFD9772B), Color(0xFF8E5A3C),
)

private class Placed(
    val node: MapNode,
    val depth: Int,
    val color: Color,
    val text: TextLayoutResult,
    val w: Float,
    val h: Float,
) {
    val kids = mutableListOf<Placed>()
    var x = 0f
    var y = 0f
    var subH = 0f
    val cy get() = y + h / 2
}

private class MapLayout(val nodes: List<Placed>, val root: Placed, val width: Float, val height: Float)

@Composable
private fun rememberMapLayout(root: MapNode): MapLayout {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val primary = MaterialTheme.colorScheme.primary
    val onSurface = MaterialTheme.colorScheme.onSurface
    return remember(root, density, primary, onSurface) {
        with(density) {
            val padH = 10.dp.toPx()
            val padV = 7.dp.toPx()
            val gapX = 34.dp.toPx()
            val gapY = 8.dp.toPx()
            val maxW = listOf(108.dp, 132.dp, 150.dp, 160.dp).map { it.toPx() }
            val styles = listOf(
                TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White),
                TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White),
                TextStyle(fontSize = 12.sp, color = onSurface),
            ).map { it.copy(textDirection = TextDirection.Rtl, textAlign = TextAlign.Center, lineHeight = it.fontSize * 1.3) }

            val all = mutableListOf<Placed>()
            fun build(n: MapNode, depth: Int, color: Color): Placed {
                val st = styles[minOf(depth, 2)]
                val mw = maxW[minOf(depth, 3)]
                val tl = measurer.measure(n.text, st, constraints = Constraints(maxWidth = (mw - 2 * padH).toInt()))
                val p = Placed(n, depth, color, tl, tl.size.width + 2 * padH, tl.size.height + 2 * padV)
                all += p
                n.children.forEachIndexed { i, c ->
                    p.kids += build(c, depth + 1, if (depth == 0) BranchColors[i % BranchColors.size] else color)
                }
                return p
            }
            val r = build(root, 0, primary)

            fun measureSub(p: Placed): Float {
                val kidsH = p.kids.sumOf { measureSub(it).toDouble() }.toFloat() + gapY * (p.kids.size - 1).coerceAtLeast(0)
                p.subH = maxOf(p.h, kidsH)
                return p.subH
            }
            measureSub(r)

            fun place(p: Placed, top: Float) {
                if (p.kids.isEmpty()) {
                    p.y = top + (p.subH - p.h) / 2
                    return
                }
                val kidsH = p.kids.sumOf { it.subH.toDouble() }.toFloat() + gapY * (p.kids.size - 1)
                var t = top + (p.subH - kidsH) / 2
                p.kids.forEach { k -> place(k, t); t += k.subH + gapY }
                p.y = (p.kids.first().cy + p.kids.last().cy) / 2 - p.h / 2
            }
            place(r, 0f)

            // الأعمدة من اليمين لليسار: الجذر في أقصى اليمين والفروع تتجه يساراً
            val levels = (all.maxOf { it.depth }) + 1
            val colW = FloatArray(levels) { d -> all.filter { it.depth == d }.maxOf { it.w } }
            val totalW = colW.sum() + gapX * (levels - 1)
            all.forEach { p ->
                var right = totalW
                for (d in 0 until p.depth) right -= colW[d] + gapX
                p.x = right - p.w
            }
            MapLayout(all, r, totalW, r.subH)
        }
    }
}

private fun DrawScope.drawMap(m: MapLayout, primary: Color, surface: Color) {
    val corner = CornerRadius(12.dp.toPx())
    m.nodes.forEach { p ->
        p.kids.forEach { k ->
            val start = Offset(p.x, p.cy)
            val end = Offset(k.x + k.w, k.cy)
            val midX = (start.x + end.x) / 2
            val path = Path().apply {
                moveTo(start.x, start.y)
                cubicTo(midX, start.y, midX, end.y, end.x, end.y)
            }
            drawPath(path, k.color, style = Stroke(width = if (p.depth == 0) 3.dp.toPx() else 1.8.dp.toPx()))
        }
    }
    m.nodes.forEach { p ->
        val tl = Offset(p.x, p.y)
        val sz = Size(p.w, p.h)
        when (p.depth) {
            0 -> drawRoundRect(primary, tl, sz, CornerRadius(18.dp.toPx()))
            1 -> drawRoundRect(p.color, tl, sz, corner)
            else -> {
                drawRoundRect(surface, tl, sz, corner)
                drawRoundRect(p.color.copy(alpha = 0.13f), tl, sz, corner)
                drawRoundRect(p.color, tl, sz, corner, style = Stroke(1.2.dp.toPx()))
            }
        }
        drawText(p.text, topLeft = Offset(p.x + (p.w - p.text.size.width) / 2, p.y + (p.h - p.text.size.height) / 2))
    }
}

/** خريطة ذهنية مصغّرة تُعرض بعرض الشاشة داخل الدرس. */
@Composable
fun MindMapPreview(root: MapNode, modifier: Modifier = Modifier) {
    val m = rememberMapLayout(root)
    val primary = MaterialTheme.colorScheme.primary
    val surface = MaterialTheme.colorScheme.surface
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier) {
            val density = LocalDensity.current
            val avail = with(density) { maxWidth.toPx() }
            val s = minOf(1f, avail / m.width)
            Canvas(
                Modifier.size(
                    with(density) { (m.width * s).toDp() },
                    with(density) { (m.height * s).toDp() },
                )
            ) {
                scale(s, s, pivot = Offset.Zero) { drawMap(m, primary, surface) }
            }
        }
    }
}

/** خريطة ذهنية تفاعلية: تكبير بإصبعين، سحب، ونقر على العقد المرتبطة بدروس. */
@Composable
fun MindMapViewer(root: MapNode, modifier: Modifier = Modifier, onNodeTap: (MapNode) -> Unit = {}) {
    val m = rememberMapLayout(root)
    val primary = MaterialTheme.colorScheme.primary
    val surface = MaterialTheme.colorScheme.surface
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier.clipToBounds().background(MaterialTheme.colorScheme.background)) {
            val density = LocalDensity.current
            val vw = with(density) { maxWidth.toPx() }
            val vh = with(density) { maxHeight.toPx() }
            val fit = minOf(1f, vw / m.width, (vh / m.height).coerceAtLeast(0.35f))
            // نبدأ بعرض الجذر (يمين) وبمقياس يناسب العرض
            var s by remember(m) { mutableFloatStateOf(fit) }
            var tx by remember(m) { mutableFloatStateOf(vw - m.width * fit) }
            var ty by remember(m) { mutableFloatStateOf(((vh - m.height * fit) / 2).coerceAtLeast(16f)) }

            fun reset() {
                s = fit; tx = vw - m.width * fit; ty = ((vh - m.height * fit) / 2).coerceAtLeast(16f)
            }

            fun zoomBy(z: Float, c: Offset) {
                val ns = (s * z).coerceIn(0.25f, 3.5f)
                tx = c.x - (c.x - tx) * (ns / s)
                ty = c.y - (c.y - ty) * (ns / s)
                s = ns
            }

            Canvas(
                Modifier
                    .fillMaxSize()
                    .pointerInput(m) {
                        detectTransformGestures { centroid, pan, zoom, _ ->
                            zoomBy(zoom, centroid)
                            tx += pan.x; ty += pan.y
                        }
                    }
                    .pointerInput(m) {
                        detectTapGestures(
                            onDoubleTap = { reset() },
                            onTap = { p ->
                                val cx = (p.x - tx) / s
                                val cy = (p.y - ty) / s
                                m.nodes.firstOrNull { cx in it.x..(it.x + it.w) && cy in it.y..(it.y + it.h) }
                                    ?.let { onNodeTap(it.node) }
                            },
                        )
                    }
            ) {
                translate(tx, ty) { scale(s, s, pivot = Offset.Zero) { drawMap(m, primary, surface) } }
            }

            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(12.dp)
            ) {
                FilledTonalIconButton(onClick = { zoomBy(1.25f, Offset(vw / 2, vh / 2)) }) { Icon(Icons.Filled.Add, "تكبير") }
                FilledTonalIconButton(onClick = { zoomBy(0.8f, Offset(vw / 2, vh / 2)) }) { Icon(Icons.Filled.Remove, "تصغير") }
                FilledTonalIconButton(onClick = { reset() }) { Icon(Icons.Filled.CenterFocusStrong, "ملاءمة") }
            }
        }
    }
}

/** نقطة ملونة صغيرة تُستخدم في عرض الخريطة كقائمة. */
@Composable
fun Dot(color: Color) {
    Box(
        Modifier
            .size(10.dp)
            .background(color, CircleShape)
    )
}
