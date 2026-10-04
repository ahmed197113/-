package com.wafr.app

import android.app.Activity
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import com.wafr.app.widget.BudgetWidgetReceiver
import com.wafr.app.widget.CompactWidgetReceiver

/** Debug-only: binds and shows both widgets like a launcher would. */
class WidgetPreviewActivity : Activity() {
    private lateinit var host: AppWidgetHost

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        host = AppWidgetHost(this, 4242)
        val mgr = AppWidgetManager.getInstance(this)
        val density = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF2B3A55.toInt())
            setPadding((24 * density).toInt(), (80 * density).toInt(), (24 * density).toInt(), 0)
        }
        for ((cls, size) in listOf(BudgetWidgetReceiver::class.java to (320 to 210), CompactWidgetReceiver::class.java to (250 to 80))) {
            val id = host.allocateAppWidgetId()
            val cn = ComponentName(this, cls)
            if (mgr.bindAppWidgetIdIfAllowed(id, cn)) {
                val opts = Bundle().apply {
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, size.first)
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, size.first)
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, size.second)
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, size.second)
                }
                mgr.updateAppWidgetOptions(id, opts)
                val view = host.createView(this, id, mgr.getAppWidgetInfo(id))
                root.addView(view, LinearLayout.LayoutParams((size.first * density).toInt(), (size.second * density).toInt()).apply { bottomMargin = (24 * density).toInt() })
                sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(cn).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(id)))
            } else {
                root.addView(TextView(this).apply { text = "bind not allowed: ${cls.simpleName}"; setTextColor(0xFFFFFFFF.toInt()) })
            }
        }
        setContentView(root)
    }

    override fun onStart() { super.onStart(); host.startListening() }
    override fun onStop() { super.onStop(); host.stopListening() }
}
