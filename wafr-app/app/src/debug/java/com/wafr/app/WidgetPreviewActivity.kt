package com.wafr.app

import android.app.Activity
import android.os.Bundle
import android.widget.LinearLayout
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.ExperimentalGlanceRemoteViewsApi
import androidx.glance.appwidget.GlanceRemoteViews
import com.wafr.app.widget.BudgetWidgetContent
import com.wafr.app.widget.CompactWidgetContent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Debug-only: renders the real Glance widgets into RemoteViews so CI can screenshot them. */
@OptIn(ExperimentalGlanceRemoteViewsApi::class)
class WidgetPreviewActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val density = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF2B3A55.toInt())
            setPadding((24 * density).toInt(), (80 * density).toInt(), (24 * density).toInt(), 0)
        }
        setContentView(root)
        CoroutineScope(Dispatchers.Main).launch {
            val snap = repo.snapshotOnce()
            val glance = GlanceRemoteViews()
            val big = glance.compose(this@WidgetPreviewActivity, DpSize(320.dp, 210.dp)) { BudgetWidgetContent(snap) }
            root.addView(big.remoteViews.apply(this@WidgetPreviewActivity, root), LinearLayout.LayoutParams((320 * density).toInt(), (210 * density).toInt()).apply { bottomMargin = (24 * density).toInt() })
            val small = glance.compose(this@WidgetPreviewActivity, DpSize(250.dp, 80.dp)) { CompactWidgetContent(snap) }
            root.addView(small.remoteViews.apply(this@WidgetPreviewActivity, root), LinearLayout.LayoutParams((250 * density).toInt(), (80 * density).toInt()))
        }
    }
}
