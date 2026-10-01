package com.reminder.salawat

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class NextPrayerWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        update(context, appWidgetManager, appWidgetIds)
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, NextPrayerWidget::class.java))
            if (ids.isNotEmpty()) update(context, manager, ids)
        }

        private fun update(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val views = RemoteViews(context.packageName, R.layout.widget_next_prayer)
            val next = PrayerRepository.nextPrayer(context)
            if (next != null) {
                views.setTextViewText(R.id.widgetPrayerName, context.getString(next.prayer.nameRes))
                views.setTextViewText(R.id.widgetPrayerTime, next.time)
            } else {
                views.setTextViewText(R.id.widgetPrayerName, context.getString(R.string.prayer_times_title))
                views.setTextViewText(R.id.widgetPrayerTime, context.getString(R.string.widget_no_data))
            }
            views.setTextViewText(R.id.widgetHijri, HijriDate.today())
            val open = PendingIntent.getActivity(
                context, 2, Intent(context, PrayerTimesActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetRoot, open)
            manager.updateAppWidget(ids, views)
        }
    }
}
