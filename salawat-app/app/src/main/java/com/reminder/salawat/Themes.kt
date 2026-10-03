package com.reminder.salawat

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import android.util.TypedValue
import androidx.core.content.ContextCompat
import java.util.WeakHashMap

/** Colour themes: each is a set of brand colours applied over the base theme, in light and dark mode. */
object Themes {
    data class Palette(val id: String, val nameRes: Int, val style: Int, val swatch: Int)

    val ALL = listOf(
        Palette("teal", R.string.theme_teal, R.style.Theme_Salawat, R.color.teal_primary),
        Palette("green", R.string.theme_green, R.style.Theme_Salawat_Green, R.color.th_green_primary),
        Palette("blue", R.string.theme_blue, R.style.Theme_Salawat_Blue, R.color.th_blue_primary),
        Palette("purple", R.string.theme_purple, R.style.Theme_Salawat_Purple, R.color.th_purple_primary),
        Palette("brown", R.string.theme_brown, R.style.Theme_Salawat_Brown, R.color.th_brown_primary),
        Palette("slate", R.string.theme_slate, R.style.Theme_Salawat_Slate, R.color.th_slate_primary)
    )

    private const val KEY_PALETTE = "color_theme"

    fun selected(context: Context): Palette {
        val id = Prefs.get(context).getString(KEY_PALETTE, null)
        return ALL.firstOrNull { it.id == id } ?: ALL.first()
    }

    fun select(context: Context, palette: Palette) {
        Prefs.get(context).edit().putString(KEY_PALETTE, palette.id).apply()
        version++
    }

    @Volatile private var version = 0
    private val applied = WeakHashMap<Activity, Int>()

    /** Applies the chosen palette to every activity before it inflates, and refreshes open ones after a change. */
    fun install(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
                activity.setTheme(selected(activity).style)
                applied[activity] = version
            }
            override fun onActivityPostCreated(activity: Activity, savedInstanceState: Bundle?) {
                EdgeToEdge.apply(activity)
            }
            override fun onActivityResumed(activity: Activity) {
                val v = applied[activity]
                if (v != null && v != version) {
                    applied[activity] = version
                    activity.recreate()
                }
            }
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) { applied.remove(activity) }
        })
    }

    private val BRAND_ATTRS = mapOf(
        R.color.teal_dark to R.attr.brandDark,
        R.color.teal_primary to R.attr.brandPrimary,
        R.color.teal_light to R.attr.brandLight,
        R.color.accent_text to R.attr.brandAccentText,
        R.color.on_brand_secondary to R.attr.brandOnSecondary,
        R.color.nav_indicator to R.attr.brandIndicator,
        R.color.card_tint to R.attr.brandTint
    )

    /** A colour resource, with brand colours taken from the current theme. */
    fun color(context: Context, res: Int): Int {
        val attr = BRAND_ATTRS[res] ?: return ContextCompat.getColor(context, res)
        val tv = TypedValue()
        return if (context.theme.resolveAttribute(attr, tv, true)) tv.data else ContextCompat.getColor(context, res)
    }
}
