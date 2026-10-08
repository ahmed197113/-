package com.reminder.salawat

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import java.io.File

/**
 * Shares an ayah or a hadith as a picture (1080×1350, the size social apps show uncropped): the text in full,
 * never shortened, with its exact reference. If a long text cannot fit legibly, it is shared as text instead.
 */
object ShareImage {
    private const val W = 1080
    private const val H = 1350
    private const val MARGIN = 110f

    fun ayah(context: Context, ayah: QAyah) {
        val quran = Ui.quranTypeface(context) ?: Typeface.SERIF
        val reference = context.getString(R.string.share_image_ayah_ref,
            QuranData.surahName(context, ayah.surah), QuranData.toArabicDigits(ayah.ayah))
        val bmp = render(context, "﴿ ${ayah.text} ﴾", quran, reference, quran, maxSize = 76f, minSize = 34f)
        if (bmp == null) {
            shareText(context, "${ayah.text}\n[$reference]")
            return
        }
        share(context, bmp, "${ayah.text}\n[$reference]")
    }

    fun hadith(context: Context, text: String, reference: String) {
        val font = ResourcesCompat.getFont(context, R.font.tajawal_medium) ?: Typeface.DEFAULT
        val bmp = render(context, text, font, reference, font, maxSize = 54f, minSize = 30f)
        if (bmp == null) {
            Toast.makeText(context, R.string.share_image_too_long, Toast.LENGTH_SHORT).show()
            shareText(context, "$text\n[$reference]")
            return
        }
        share(context, bmp, "$text\n[$reference]")
    }

    private fun render(
        context: Context, text: String, font: Typeface, reference: String, refFont: Typeface,
        maxSize: Float, minSize: Float
    ): Bitmap? {
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val dark = Themes.color(context, R.color.teal_dark)
        val primary = Themes.color(context, R.color.teal_primary)
        val gold = Themes.color(context, R.color.gold)
        val bg = Paint().apply { shader = LinearGradient(0f, 0f, 0f, H.toFloat(), primary, dark, Shader.TileMode.CLAMP) }
        c.drawRect(0f, 0f, W.toFloat(), H.toFloat(), bg)

        // Double gold frame with corner ornaments.
        val frame = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = gold; strokeWidth = 5f }
        c.drawRoundRect(RectF(40f, 40f, W - 40f, H - 40f), 36f, 36f, frame)
        frame.strokeWidth = 2f
        c.drawRoundRect(RectF(58f, 58f, W - 58f, H - 58f), 28f, 28f, frame)
        val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = gold }
        for ((x, y) in listOf(40f to 40f, W - 40f to 40f, 40f to H - 40f, W - 40f to H - 40f)) c.drawCircle(x, y, 12f, dot)

        // Footer: app name and the dedication.
        val footer = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xCCFFFFFF.toInt()
            textSize = 30f
            textAlign = Paint.Align.CENTER
            typeface = ResourcesCompat.getFont(context, R.font.tajawal_bold) ?: Typeface.DEFAULT_BOLD
        }
        c.drawText(context.getString(R.string.app_name), W / 2f, H - 120f, footer)
        footer.textSize = 24f
        footer.color = 0x99FFFFFF.toInt()
        footer.typeface = ResourcesCompat.getFont(context, R.font.tajawal_regular) ?: Typeface.DEFAULT
        c.drawText(context.getString(R.string.share_image_footer), W / 2f, H - 84f, footer)

        // Reference line (gold) and the text above it, as large as fits.
        val refPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = gold; textSize = 40f; typeface = refFont }
        val width = (W - 2 * MARGIN).toInt()
        val refLayout = layout(reference, refPaint, width)
        val top = 140f
        val bottomLimit = H - 200f - refLayout.height - 40f
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); typeface = font }
        var size = maxSize
        var body: StaticLayout
        while (true) {
            paint.textSize = size
            body = layout(text, paint, width, spacing = 1.25f)
            if (top + body.height <= bottomLimit) break
            size -= 2f
            if (size < minSize) return null
        }
        val blockH = body.height + 40f + refLayout.height
        val y = top + (bottomLimit + refLayout.height + 40f - top - blockH) / 2f
        c.save(); c.translate(MARGIN, y); body.draw(c); c.restore()
        c.save(); c.translate(MARGIN, y + body.height + 40f); refLayout.draw(c); c.restore()
        return bmp
    }

    private fun layout(text: CharSequence, paint: TextPaint, width: Int, spacing: Float = 1f): StaticLayout =
        StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setLineSpacing(0f, spacing)
            .setIncludePad(true)
            .build()

    private fun share(context: Context, bmp: Bitmap, caption: String) {
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "rafiq.png")
        file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bmp.recycle()
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        val intent = Intent(Intent.ACTION_SEND).setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, caption)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(intent, null))
    }

    private fun shareText(context: Context, text: String) {
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
    }
}
