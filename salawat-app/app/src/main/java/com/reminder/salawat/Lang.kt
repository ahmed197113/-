package com.reminder.salawat

import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

/**
 * App language: Arabic (default) or English, chosen in Settings or in the phone's per-app language settings.
 * The Quran, dhikr and hadith texts always stay in Arabic, exactly as in their sources.
 *
 * Every screen applies the language itself (see [LocalizedActivity]): relying on the system's per-app locale alone
 * left the first screen in the phone's language on some devices.
 */
object Lang {
    @Volatile var arabic = true
        private set

    val SUPPORTED = listOf("ar", "en")
    private const val KEY = "app_language"

    private fun manager(context: Context): LocaleManager? =
        if (Build.VERSION.SDK_INT >= 33) context.getSystemService(LocaleManager::class.java) else null

    /** The chosen language: the phone's per-app setting if the user set one there, else the app's own choice (Arabic). */
    fun current(context: Context): String {
        manager(context)?.applicationLocales?.get(0)?.language?.takeIf { it in SUPPORTED }?.let { return it }
        return Prefs.get(context).getString(KEY, null)?.takeIf { it in SUPPORTED } ?: "ar"
    }

    /** Keeps the phone's per-app language setting in step with the app (Android 13+). */
    fun install(context: Context) {
        val lm = manager(context) ?: return
        if (lm.applicationLocales.isEmpty) lm.applicationLocales = LocaleList.forLanguageTags(current(context))
    }

    fun set(context: Context, tag: String) {
        Prefs.get(context).edit().putString(KEY, tag).apply()
        val lm = manager(context)
        if (lm != null) lm.applicationLocales = LocaleList.forLanguageTags(tag) // the system recreates the screens
        else Themes.refreshAll()
    }

    /** [base] with the app language applied (used by every screen). */
    fun wrap(base: Context): Context {
        val locale = Locale.forLanguageTag(current(base))
        arabic = locale.language != "en"
        // Views set to follow the locale, number and date formats read the default locale: keep it the app's.
        Locale.setDefault(locale)
        val config = Configuration(base.resources.configuration)
        config.setLocale(locale)
        config.setLayoutDirection(locale)
        return base.createConfigurationContext(config)
    }

    fun refresh(context: Context) {
        arabic = context.resources.configuration.locales[0].language != "en"
    }

    fun pick(ar: String, en: String) = if (arabic) ar else en
}

/** Base of every screen: applies the app language. */
abstract class LocalizedActivity : AppCompatActivity() {
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(Lang.wrap(newBase))
    }
}
