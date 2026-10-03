package com.reminder.salawat

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.TypedValue
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Android 15+ draws every app edge to edge. Each screen keeps its look: the content is padded clear of the
 * status bar, navigation bar, display cutout and keyboard, and the bars' strips are painted in the brand colour
 * (top) and the surface colour (bottom), as the bar colours used to do.
 */
object EdgeToEdge {
    fun apply(activity: Activity) {
        if (Build.VERSION.SDK_INT < 35) return
        val window = activity.window
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
        val night = (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val bars = BarsBackground(
            color(activity, R.attr.brandDark),
            color(activity, com.google.android.material.R.attr.colorSurface),
            color(activity, android.R.attr.colorBackground)
        )
        content.background = bars
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = !night
        }
        ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
            val sys = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val bottom = maxOf(sys.bottom, ime.bottom)
            v.setPadding(sys.left, sys.top, sys.right, bottom)
            bars.top = sys.top
            bars.bottom = sys.bottom
            bars.invalidateSelf()
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(content)
    }

    private fun color(activity: Activity, attr: Int): Int {
        val tv = TypedValue()
        activity.theme.resolveAttribute(attr, tv, true)
        return if (tv.resourceId != 0) activity.getColor(tv.resourceId) else tv.data
    }

    private class BarsBackground(topColor: Int, bottomColor: Int, fillColor: Int) : Drawable() {
        var top = 0
        var bottom = 0
        private val topPaint = Paint().apply { color = topColor }
        private val bottomPaint = Paint().apply { color = bottomColor }
        private val fillPaint = Paint().apply { color = fillColor }

        override fun draw(canvas: Canvas) {
            val b = bounds
            canvas.drawRect(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), b.bottom.toFloat(), fillPaint)
            canvas.drawRect(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), (b.top + top).toFloat(), topPaint)
            canvas.drawRect(b.left.toFloat(), (b.bottom - bottom).toFloat(), b.right.toFloat(), b.bottom.toFloat(), bottomPaint)
        }
        override fun setAlpha(alpha: Int) {}
        override fun setColorFilter(colorFilter: ColorFilter?) {}
        @Deprecated("Deprecated in Java")
        override fun getOpacity() = PixelFormat.OPAQUE
    }
}
