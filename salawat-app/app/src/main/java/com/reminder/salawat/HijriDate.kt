package com.reminder.salawat

import android.icu.text.SimpleDateFormat
import android.icu.util.ULocale
import java.util.Date

/** Offline Hijri date using ICU's Umm al-Qura calendar (available since API 24). */
object HijriDate {
    fun today(): String = runCatching {
        SimpleDateFormat("EEEE d MMMM y", ULocale("ar@calendar=islamic-umalqura")).format(Date()) + " هـ"
    }.getOrDefault("")
}
