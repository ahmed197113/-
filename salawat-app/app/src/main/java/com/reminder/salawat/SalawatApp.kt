package com.reminder.salawat

import android.app.Application
import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

class SalawatApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // The whole UI is Arabic: force the Arabic locale so dialogs, pickers and layouts are right-to-left
        // even on phones set to another language.
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("ar"))
        applyTheme(this)
        Themes.install(this)
        HadithQuotes.init(this)
        Notifications.createChannels(this)
        PrayerRefreshWorker.ensurePeriodic(this)
        // Make sure the salawat reminder's alarm exists (it keeps its pending time if already armed).
        ReminderWorker.apply(this)
        // v1 hadith books included non-sahih collections; they are replaced by the sahih-only v2 library.
        java.io.File(filesDir, "hadith").takeIf { it.exists() }?.deleteRecursively()
        Reminders.schedule(this)
    }

    companion object {
        fun applyTheme(context: Context) {
            AppCompatDelegate.setDefaultNightMode(
                when (Prefs.get(context).getInt(Prefs.KEY_THEME, 0)) {
                    1 -> AppCompatDelegate.MODE_NIGHT_NO
                    2 -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                }
            )
        }
    }
}
