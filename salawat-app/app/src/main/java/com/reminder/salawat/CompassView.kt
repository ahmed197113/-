package com.reminder.salawat

import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View
import androidx.core.content.res.ResourcesCompat
import kotlin.math.abs
import kotlin.math.min

/**
 * The Qibla compass: a dial that turns with the phone (north stays north), the Ka'bah marked on its rim at the
 * Qibla bearing, and a gold needle pointing at it. The centre shows how far the phone is from the Qibla; when it
 * faces the Qibla the whole compass glows.
 */
class CompassView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    /** Direction the top of the phone points, degrees from true north. */
    var heading = 0f
        set(value) { field = value; invalidate() }
    /** Qibla bearing from true north. */
    var qibla = 0f
        set(value) { field = value; invalidate() }
    /** No sensor: the dial stays put and the needle shows the bearing from north. */
    var staticMode = false
        set(value) { field = value; invalidate() }

    var brand = 0xFF0F5C56.toInt()
    var brandDark = 0xFF0A3A36.toInt()
    var gold = 0xFFD4AF37.toInt()
    var textColor = 0xFF1B1F1E.toInt()
    var surface = 0xFFFFFFFF.toInt()

    private val arabic get() = Lang.arabic
    private val ui: Typeface = ResourcesCompat.getFont(context, R.font.tajawal_bold) ?: Typeface.DEFAULT_BOLD
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = ui }

    /** The needle's angle from the top of the screen, and how far from the Qibla the phone points (0..180). */
    private val needle get() = ((qibla - (if (staticMode) 0f else heading)) % 360f + 360f) % 360f
    val offBy: Float get() = needle.let { if (it > 180f) 360f - it else it }
    val aligned get() = !staticMode && abs(offBy) < 4f

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = MeasureSpec.getSize(heightMeasureSpec)
        val size = if (MeasureSpec.getMode(heightMeasureSpec) == MeasureSpec.UNSPECIFIED) w else min(w, h)
        setMeasuredDimension(size, size)
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = min(cx, cy) * 0.86f
        val glow = aligned

        // Halo when aligned.
        if (glow) {
            p.style = Paint.Style.FILL
            p.shader = RadialGradient(cx, cy, r * 1.16f, intArrayOf(withAlpha(gold, 140), withAlpha(gold, 0)), floatArrayOf(0.7f, 1f), Shader.TileMode.CLAMP)
            canvas.drawCircle(cx, cy, r * 1.16f, p)
            p.shader = null
        }

        // Dial face: deep brand gradient with a gold bezel.
        p.style = Paint.Style.FILL
        p.shader = RadialGradient(cx, cy - r * 0.3f, r * 1.3f, brand, brandDark, Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, cy, r, p)
        p.shader = null
        p.style = Paint.Style.STROKE
        p.strokeWidth = r * 0.035f
        p.shader = LinearGradient(cx - r, cy - r, cx + r, cy + r, intArrayOf(0xFFF1D98B.toInt(), gold, 0xFF9C7A1E.toInt(), gold), null, Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, cy, r, p)
        p.shader = null
        p.strokeWidth = r * 0.008f
        p.color = withAlpha(gold, 150)
        canvas.drawCircle(cx, cy, r * 0.9f, p)
        canvas.drawCircle(cx, cy, r * 0.42f, p)

        // Everything on the dial turns so that north stays north.
        canvas.save()
        canvas.rotate(if (staticMode) 0f else -heading, cx, cy)
        drawTicks(canvas, cx, cy, r)
        drawCardinals(canvas, cx, cy, r)
        drawStar(canvas, cx, cy, r * 0.36f)
        drawKaaba(canvas, cx, cy - r * 0.78f, r * 0.11f, qibla)
        canvas.restore()

        // Needle towards the Qibla.
        canvas.save()
        canvas.rotate(needle, cx, cy)
        drawNeedle(canvas, cx, cy, r, glow)
        canvas.restore()

        // Fixed marker at the top: where the phone points.
        p.style = Paint.Style.FILL
        p.color = if (glow) gold else 0xFFFFFFFF.toInt()
        val tri = Path().apply {
            moveTo(cx, cy - r - r * 0.02f)
            lineTo(cx - r * 0.06f, cy - r - r * 0.13f)
            lineTo(cx + r * 0.06f, cy - r - r * 0.13f)
            close()
        }
        canvas.drawPath(tri, p)

        // Centre: degrees left to turn.
        p.color = surface
        canvas.drawCircle(cx, cy, r * 0.2f, p)
        p.style = Paint.Style.STROKE
        p.strokeWidth = r * 0.015f
        p.color = gold
        canvas.drawCircle(cx, cy, r * 0.2f, p)
        p.style = Paint.Style.FILL
        text.color = if (glow) brand else textColor
        text.textSize = r * 0.13f
        val deg = if (staticMode) qibla.toInt() else offBy.toInt()
        val label = if (glow) "✓" else QuranData.toArabicDigits(deg) + "°"
        canvas.drawText(label, cx, cy + text.textSize * 0.36f, text)
    }

    private fun drawTicks(canvas: Canvas, cx: Float, cy: Float, r: Float) {
        p.style = Paint.Style.STROKE
        p.strokeCap = Paint.Cap.ROUND
        for (d in 0 until 360 step 5) {
            val major = d % 30 == 0
            p.color = if (major) 0xFFFFFFFF.toInt() else 0x99FFFFFF.toInt()
            p.strokeWidth = if (major) r * 0.014f else r * 0.007f
            val inner = if (major) r * 0.8f else r * 0.84f
            canvas.save()
            canvas.rotate(d.toFloat(), cx, cy)
            canvas.drawLine(cx, cy - r * 0.89f, cx, cy - inner, p)
            canvas.restore()
        }
        p.strokeCap = Paint.Cap.BUTT
    }

    private fun drawCardinals(canvas: Canvas, cx: Float, cy: Float, r: Float) {
        val names = if (arabic) listOf("ش", "ق", "ج", "غ") else listOf("N", "E", "S", "W")
        text.textSize = r * 0.12f
        val dialTurn = if (staticMode) 0f else -heading
        names.forEachIndexed { i, n ->
            // Placed around the dial, but each letter stays upright on the screen.
            val a = Math.toRadians((i * 90).toDouble())
            val x = cx + (r * 0.64f * kotlin.math.sin(a)).toFloat()
            val y = cy - (r * 0.64f * kotlin.math.cos(a)).toFloat()
            text.color = if (i == 0) 0xFFF1D98B.toInt() else 0xFFFFFFFF.toInt()
            canvas.save()
            canvas.rotate(-dialTurn, x, y)
            canvas.drawText(n, x, y + text.textSize * 0.36f, text)
            canvas.restore()
        }
    }

    /** Eight-pointed star (rub el hizb) at the centre of the dial. */
    private fun drawStar(canvas: Canvas, cx: Float, cy: Float, s: Float) {
        p.style = Paint.Style.STROKE
        p.strokeWidth = s * 0.03f
        p.color = withAlpha(gold, 110)
        for (rot in listOf(0f, 45f)) {
            canvas.save()
            canvas.rotate(rot, cx, cy)
            canvas.drawRect(cx - s * 0.7f, cy - s * 0.7f, cx + s * 0.7f, cy + s * 0.7f, p)
            canvas.restore()
        }
    }

    /** The Ka'bah on the rim, at [bearing]. */
    private fun drawKaaba(canvas: Canvas, cx: Float, y: Float, s: Float, bearing: Float) {
        canvas.save()
        canvas.rotate(bearing, cx, height / 2f)
        // keep the cube upright-looking relative to its position on the rim
        p.style = Paint.Style.FILL
        p.color = withAlpha(gold, 90)
        p.maskFilter = BlurMaskFilter(s * 0.6f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(cx, y, s * 1.2f, p)
        p.maskFilter = null
        p.color = 0xFF111111.toInt()
        val body = RectF(cx - s, y - s, cx + s, y + s)
        canvas.drawRoundRect(body, s * 0.15f, s * 0.15f, p)
        p.color = gold
        canvas.drawRect(cx - s, y - s * 0.45f, cx + s, y - s * 0.22f, p)
        p.color = 0xFFF1D98B.toInt()
        canvas.drawRect(cx - s * 0.25f, y + s * 0.25f, cx + s * 0.25f, y + s, p)
        canvas.restore()
    }

    private fun drawNeedle(canvas: Canvas, cx: Float, cy: Float, r: Float, glow: Boolean) {
        val tip = cy - r * 0.66f
        val tail = cy + r * 0.5f
        val w = r * 0.08f
        p.style = Paint.Style.FILL
        // shadow
        p.color = 0x55000000
        p.maskFilter = BlurMaskFilter(r * 0.03f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawPath(needlePath(cx + r * 0.015f, cy + r * 0.02f, tip, tail, w), p)
        p.maskFilter = null
        // gold half towards the Qibla (lit side and shaded side), light half behind
        p.color = 0xFFE9C55A.toInt()
        canvas.drawPath(Path().apply { moveTo(cx, tip); lineTo(cx, cy); lineTo(cx - w, cy); close() }, p)
        p.color = 0xFFC79A22.toInt()
        canvas.drawPath(Path().apply { moveTo(cx, tip); lineTo(cx + w, cy); lineTo(cx, cy); close() }, p)
        p.color = if (glow) 0xFFF1D98B.toInt() else 0xFFE8EFEE.toInt()
        val back = Path().apply { moveTo(cx, tail); lineTo(cx + w, cy); lineTo(cx - w, cy); close() }
        canvas.drawPath(back, p)
        p.style = Paint.Style.STROKE
        p.strokeWidth = r * 0.006f
        p.color = withAlpha(Color.BLACK, 60)
        canvas.drawLine(cx, tip, cx, tail, p)
    }

    private fun needlePath(cx: Float, cy: Float, tip: Float, tail: Float, w: Float) = Path().apply {
        moveTo(cx, tip); lineTo(cx + w, cy); lineTo(cx, tail); lineTo(cx - w, cy); close()
    }

    private fun withAlpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a shl 24)
}
