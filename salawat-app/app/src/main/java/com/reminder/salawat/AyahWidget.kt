package com.reminder.salawat

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.widget.RemoteViews

/**
 * Home-screen widget: the ayah of the day (the same one as on the home screen). Widgets cannot use the app's
 * fonts, and the Uthmani script is only correct in the Mushaf font, so the ayah is drawn into a picture.
 */
class AyahWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        update(context, appWidgetManager, appWidgetIds)
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, AyahWidget::class.java))
            if (ids.isNotEmpty()) update(context, manager, ids)
        }

        private fun update(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val ayah = QuranData.ayahOfDay(context)
            val views = RemoteViews(context.packageName, R.layout.widget_ayah)
            views.setImageViewBitmap(R.id.widgetAyahImage, render(context, ayah))
            val open = PendingIntent.getActivity(
                context, 3,
                Intent(context, QuranPagerActivity::class.java)
                    .putExtra(QuranPagerActivity.EXTRA_PAGE, ayah.page)
                    .putExtra(QuranPagerActivity.EXTRA_HIGHLIGHT_GLOBAL, ayah.global),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetAyahRoot, open)
            manager.updateAppWidget(ids, views)
        }

        private fun render(context: Context, ayah: QAyah): Bitmap {
            val w = 1000
            val h = 460
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val quran = Ui.quranTypeface(context) ?: Typeface.SERIF
            val ref = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFF1D98B.toInt(); textSize = 34f; typeface = quran }
            val refText = context.getString(R.string.share_image_ayah_ref, QuranData.surahName(context, ayah.surah), QuranData.toArabicDigits(ayah.ayah))
            val refLayout = StaticLayout.Builder.obtain(refText, 0, refText.length, ref, w).setAlignment(Layout.Alignment.ALIGN_CENTER).build()
            val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); typeface = quran }
            val text = "﴿ ${ayah.text} ﴾"
            var size = 56f
            var body: StaticLayout
            while (true) {
                paint.textSize = size
                body = StaticLayout.Builder.obtain(text, 0, text.length, paint, w)
                    .setAlignment(Layout.Alignment.ALIGN_CENTER).setLineSpacing(0f, 1.15f).build()
                if (body.height + refLayout.height + 16 <= h || size <= 24f) break
                size -= 2f
            }
            val top = ((h - body.height - refLayout.height - 16) / 2f).coerceAtLeast(0f)
            c.save(); c.translate(0f, top); body.draw(c); c.restore()
            c.save(); c.translate(0f, top + body.height + 16); refLayout.draw(c); c.restore()
            return bmp
        }
    }
}
