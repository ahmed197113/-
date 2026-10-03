package com.reminder.salawat

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * App language: Arabic (default) or English, chosen in Settings or in the phone's per-app language settings.
 * The Quran, dhikr and hadith texts always stay in Arabic, exactly as in their sources.
 */
object Lang {
    @Volatile var arabic = true
        private set

    val SUPPORTED = listOf("ar", "en")

    /** On first run the app is Arabic; afterwards whatever the user (or the system per-app setting) picked. */
    fun install() {
        if (AppCompatDelegate.getApplicationLocales().isEmpty) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("ar"))
        }
    }

    fun current(): String = AppCompatDelegate.getApplicationLocales()[0]?.language?.takeIf { it in SUPPORTED } ?: "ar"

    fun set(tag: String) = AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))

    fun refresh(context: Context) {
        arabic = context.resources.configuration.locales[0].language != "en"
    }

    fun pick(ar: String, en: String) = if (arabic) ar else en
}
