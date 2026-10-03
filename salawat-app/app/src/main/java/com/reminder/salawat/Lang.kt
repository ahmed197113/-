package com.reminder.salawat

import android.app.LocaleManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * App language: Arabic (default) or English, chosen in Settings or in the phone's per-app language settings.
 * The Quran, dhikr and hadith texts always stay in Arabic, exactly as in their sources.
 *
 * On Android 13+ the per-app language lives in the system's LocaleManager. AppCompat's helpers only reach it
 * through an open activity, so from Application.onCreate they did nothing and a phone set to English opened
 * the app in English; the platform API is used directly there.
 */
object Lang {
    @Volatile var arabic = true
        private set

    val SUPPORTED = listOf("ar", "en")

    private fun manager(context: Context): LocaleManager? =
        if (Build.VERSION.SDK_INT >= 33) context.getSystemService(LocaleManager::class.java) else null

    /** On first run the app is Arabic; afterwards whatever the user (or the system per-app setting) picked. */
    fun install(context: Context) {
        val lm = manager(context)
        if (lm != null) {
            if (lm.applicationLocales.isEmpty) lm.applicationLocales = LocaleList.forLanguageTags("ar")
        } else if (AppCompatDelegate.getApplicationLocales().isEmpty) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("ar"))
        }
    }

    fun current(context: Context): String {
        val tag = manager(context)?.applicationLocales?.get(0)?.language
            ?: AppCompatDelegate.getApplicationLocales()[0]?.language
        return tag?.takeIf { it in SUPPORTED } ?: "ar"
    }

    fun set(context: Context, tag: String) {
        val lm = manager(context)
        if (lm != null) lm.applicationLocales = LocaleList.forLanguageTags(tag)
        else AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
    }

    fun refresh(context: Context) {
        arabic = context.resources.configuration.locales[0].language != "en"
    }

    fun pick(ar: String, en: String) = if (arabic) ar else en
}
