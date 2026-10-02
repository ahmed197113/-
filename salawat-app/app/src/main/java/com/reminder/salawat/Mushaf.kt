package com.reminder.salawat

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * The printed Madinah Mushaf, page for page: the King Fahd Complex's QCF (v2) glyphs as quran.com uses them.
 * Each of the 604 pages has 15 lines; every word is one glyph of that page's own font, so lines break and
 * words look exactly as in the print. Layout (assets/mushaf_layout_v2.json.gz) is bundled; the page fonts
 * are downloaded once, on first view of each page.
 */
object MushafLayout {
    data class Word(val glyphs: String, val surah: Int, val ayah: Int, val isEnd: Boolean)

    /** A line is either words, a surah header, or a basmala. */
    sealed class Line {
        data class Words(val words: List<Word>) : Line()
        data class Header(val surah: Int) : Line()
        object Basmala : Line()
        object Blank : Line()
    }

    @Volatile private var pages: JSONObject? = null

    private fun load(context: Context): JSONObject = pages ?: synchronized(this) {
        pages ?: JSONObject(
            GZIPInputStream(context.assets.open("mushaf_layout_v2.json.gz")).bufferedReader().use { it.readText() }
        ).also { pages = it }
    }

    /** The 15 lines of [page]: lines without words are the surah header and basmala above a surah's first ayah. */
    fun page(context: Context, page: Int): List<Line> {
        val json = load(context).optJSONObject(page.toString()) ?: return emptyList()
        val lines = arrayOfNulls<Line>(15)
        for (key in json.keys()) {
            val n = key.toInt()
            if (n !in 1..15) continue
            val arr = json.getJSONArray(key)
            lines[n - 1] = Line.Words((0 until arr.length()).map { i ->
                val w = arr.getJSONArray(i)
                val (s, a) = w.getString(1).split(":").map { it.toInt() }
                Word(w.getString(0), s, a, w.getInt(2) == 1)
            })
        }
        for (i in 0 until 15) {
            val words = (lines[i] as? Line.Words)?.words ?: continue
            val first = words.first()
            if (first.ayah != 1) continue
            // ayah 1 starts this line: the empty lines just above it are its header (and basmala)
            if (first.surah == 1 || first.surah == 9) {
                if (i >= 1 && lines[i - 1] == null) lines[i - 1] = Line.Header(first.surah)
            } else {
                if (i >= 1 && lines[i - 1] == null) lines[i - 1] = Line.Basmala
                if (i >= 2 && lines[i - 2] == null) lines[i - 2] = Line.Header(first.surah)
            }
        }
        val count = if (page <= 2) 8 else 15
        return (0 until count).map { lines[it] ?: Line.Blank }
    }
}

object MushafFonts {
    private const val BASE = "https://github.com/ahmed197113/-/releases/download/rafiq-mushaf-fonts-v2/"
    private val cache = HashMap<Int, Typeface>()
    private val mutex = Mutex()

    private fun file(context: Context, page: Int) = File(File(context.filesDir, "qcf_v2"), "p$page.ttf")

    fun cached(context: Context, page: Int): Typeface? = synchronized(cache) {
        cache[page] ?: file(context, page).takeIf { it.exists() && it.length() > 1000 }
            ?.let { runCatching { Typeface.createFromFile(it) }.getOrNull() }
            ?.also { cache[page] = it }
    }

    /** The page's font, downloading it first if needed (≈350 KB). Throws when offline and not yet downloaded. */
    suspend fun get(context: Context, page: Int): Typeface {
        cached(context, page)?.let { return it }
        mutex.withLock {
            cached(context, page)?.let { return it }
            withContext(Dispatchers.IO) { Net.download(BASE + "p$page.ttf", file(context, page)) { } }
        }
        return cached(context, page) ?: error("font")
    }

    fun downloadedCount(context: Context): Int =
        File(context.filesDir, "qcf_v2").listFiles()?.count { it.name.endsWith(".ttf") } ?: 0
}

/** Draws one Mushaf page: 15 lines, each line justified edge to edge like the print. */
class MushafPageView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    var page = 0
        private set
    private var lines: List<MushafLayout.Line> = emptyList()
    private var font: Typeface? = null
    private val wordPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val framePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val wordBoxes = ArrayList<Pair<RectF, MushafLayout.Word>>()

    var textColor = 0xFF1B1F1E.toInt()
    var accentColor = 0xFF0F5C56.toInt()
    var goldColor = 0xFFC9A227.toInt()
    var highlightColor = 0x55D4AF37
    /** (surah, ayah) pairs to highlight: the selected and the playing ayah. */
    var highlighted: Set<Pair<Int, Int>> = emptySet()
        set(value) { field = value; invalidate() }
    var onWordClick: ((surah: Int, ayah: Int) -> Unit)? = null

    fun bind(page: Int, lines: List<MushafLayout.Line>, font: Typeface) {
        this.page = page
        this.lines = lines
        this.font = font
        requestLayout()
        invalidate()
    }

    private val lineCount get() = if (page in 1..2) 8 else 15

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        // A printed page is about 1 : 1.6; fit the whole page on screen when the screen allows it.
        var height = (width * 1.62f).toInt()
        if (maxPageHeight > 0) height = height.coerceAtMost(maxPageHeight)
        setMeasuredDimension(width, if (page in 1..2) (height * 0.62f).toInt() else height)
    }

    companion object {
        /** Room the reading screen has for a page (set by the activity once laid out). */
        var maxPageHeight = 0
    }

    override fun onDraw(canvas: Canvas) {
        val tf = font ?: return
        val w = width.toFloat()
        val lineH = height.toFloat() / lineCount
        wordPaint.typeface = tf
        wordPaint.color = textColor
        // One text size for the whole page: the widest line fills the width with a small gap between words.
        wordPaint.textSize = 100f
        val minGap = 100f * 0.12f
        var widest = 1f
        for (line in lines) {
            val words = (line as? MushafLayout.Line.Words)?.words ?: continue
            val natural = words.sumOf { wordPaint.measureText(it.glyphs).toDouble() }.toFloat() + minGap * (words.size - 1)
            if (natural > widest) widest = natural
        }
        val size = (100f * w / widest).coerceAtMost(lineH * 0.82f)
        wordPaint.textSize = size
        val gapMin = size * 0.12f
        wordBoxes.clear()
        lines.forEachIndexed { index, line ->
            val top = index * lineH
            val baseline = top + lineH * 0.72f
            when (line) {
                is MushafLayout.Line.Words -> drawWords(canvas, line.words, top, baseline, lineH, w, gapMin)
                is MushafLayout.Line.Header -> drawHeader(canvas, line.surah, top, lineH, w)
                MushafLayout.Line.Basmala -> drawCentered(canvas, QuranData.basmala, top, lineH, w, size * 0.82f, textColor)
                MushafLayout.Line.Blank -> Unit
            }
        }
    }

    private fun drawWords(canvas: Canvas, words: List<MushafLayout.Word>, top: Float, baseline: Float, lineH: Float, w: Float, gapMin: Float) {
        val widths = words.map { wordPaint.measureText(it.glyphs) }
        val total = widths.sum()
        val centered = page in 1..2 || total + gapMin * (words.size - 1) < w * 0.8f
        val gap = if (centered || words.size < 2) gapMin else (w - total) / (words.size - 1)
        var x = if (centered) (w + total + gap * (words.size - 1)) / 2f else w
        words.forEachIndexed { i, word ->
            val right = x
            val left = x - widths[i]
            val box = RectF(left - gap / 2, top, right + gap / 2, top + lineH)
            if (highlighted.contains(word.surah to word.ayah)) {
                highlightPaint.color = highlightColor
                canvas.drawRect(box, highlightPaint)
            }
            canvas.drawText(word.glyphs, left, baseline, wordPaint)
            wordBoxes.add(box to word)
            x = left - gap
        }
    }

    private fun drawHeader(canvas: Canvas, surah: Int, top: Float, lineH: Float, w: Float) {
        val pad = lineH * 0.12f
        val rect = RectF(pad, top + pad, w - pad, top + lineH - pad)
        framePaint.color = goldColor
        framePaint.strokeWidth = lineH * 0.04f
        canvas.drawRoundRect(rect, lineH * 0.2f, lineH * 0.2f, framePaint)
        framePaint.strokeWidth = lineH * 0.015f
        val inner = RectF(rect.left + lineH * 0.08f, rect.top + lineH * 0.08f, rect.right - lineH * 0.08f, rect.bottom - lineH * 0.08f)
        canvas.drawRoundRect(inner, lineH * 0.15f, lineH * 0.15f, framePaint)
        drawCentered(canvas, QuranData.surahName(context, surah), top, lineH, w, lineH * 0.42f, accentColor)
    }

    private fun drawCentered(canvas: Canvas, text: String, top: Float, lineH: Float, w: Float, size: Float, color: Int) {
        headerPaint.typeface = Ui.quranTypeface(context)
        headerPaint.textSize = size
        headerPaint.color = color
        headerPaint.textAlign = Paint.Align.CENTER
        val fm = headerPaint.fontMetrics
        canvas.drawText(text, w / 2f, top + lineH / 2f - (fm.ascent + fm.descent) / 2f, headerPaint)
    }

    private val gestures = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent) = true
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            val hit = wordBoxes.firstOrNull { it.first.contains(e.x, e.y) }?.second ?: return false
            performClick()
            onWordClick?.invoke(hit.surah, hit.ayah)
            return true
        }
    })

    override fun onTouchEvent(event: MotionEvent): Boolean = gestures.onTouchEvent(event) || super.onTouchEvent(event)

    override fun performClick(): Boolean = super.performClick()
}
