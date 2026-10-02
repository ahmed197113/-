package com.reminder.salawat

import android.content.Context
import android.icu.util.Calendar as IcuCalendar
import android.icu.util.ULocale
import java.util.Calendar
import java.util.Date

data class HijriDay(val year: Int, val month: Int /* 1..12 */, val day: Int)

data class IslamicEvent(val title: String, val note: String, val fasting: Boolean = false)

/**
 * Hijri dates via ICU's Umm al-Qura calendar (offline, API 24+), with a user adjustment of ±2 days
 * because the start of months depends on local moon sighting.
 */
object HijriDate {
    const val KEY_OFFSET = "hijri_offset"

    val MONTHS = listOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    )

    /** Umm al-Qura calendar; the locale keyword selects the calculation on every API level. */
    private fun icu(): IcuCalendar = IcuCalendar.getInstance(ULocale("ar@calendar=islamic-umalqura"))

    private var cachedOffset: Int? = null

    fun offset(context: Context?): Int {
        if (context == null) return cachedOffset ?: 0
        return Prefs.get(context).getInt(KEY_OFFSET, 0).also { cachedOffset = it }
    }

    fun setOffset(context: Context, days: Int) {
        Prefs.get(context).edit().putInt(KEY_OFFSET, days).apply()
        cachedOffset = days
    }

    fun of(context: Context?, gregorian: Calendar): HijriDay {
        val cal = icu()
        cal.timeInMillis = gregorian.timeInMillis
        cal.add(IcuCalendar.DAY_OF_MONTH, offset(context))
        return HijriDay(cal.get(IcuCalendar.YEAR), cal.get(IcuCalendar.MONTH) + 1, cal.get(IcuCalendar.DAY_OF_MONTH))
    }

    fun today(context: Context? = null): String = runCatching { format(of(context, Calendar.getInstance()), withWeekday = true) }.getOrDefault("")

    fun format(h: HijriDay, withWeekday: Boolean = false): String {
        val base = "${QuranData.toArabicDigits(h.day)} ${MONTHS[h.month - 1]} ${QuranData.toArabicDigits(h.year)} هـ"
        if (!withWeekday) return base
        return "${weekday(Calendar.getInstance())} $base"
    }

    fun weekday(cal: Calendar): String = WEEKDAYS[cal.get(Calendar.DAY_OF_WEEK) - 1]

    private val WEEKDAYS = listOf("الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت")

    /** Gregorian date of the first day of a Hijri month (respecting the user offset). */
    fun firstDayOf(context: Context?, year: Int, month: Int): Calendar {
        val cal = icu()
        cal.clear()
        cal.set(year, month - 1, 1, 12, 0, 0)
        cal.add(IcuCalendar.DAY_OF_MONTH, -offset(context))
        return Calendar.getInstance().apply { timeInMillis = cal.timeInMillis }
    }

    fun monthLength(context: Context?, year: Int, month: Int): Int {
        val start = firstDayOf(context, year, month)
        val next = if (month == 12) firstDayOf(context, year + 1, 1) else firstDayOf(context, year, month + 1)
        return ((next.timeInMillis - start.timeInMillis + 12 * 3600_000L) / 86_400_000L).toInt()
    }

    /** Occasions and recommended fasts for a Hijri day (and the Gregorian weekday for Monday/Thursday fasts). */
    fun events(h: HijriDay, gregorian: Calendar? = null): List<IslamicEvent> {
        val list = ArrayList<IslamicEvent>()
        when (h.month to h.day) {
            1 to 1 -> list.add(IslamicEvent("رأس السنة الهجرية", "بداية عام هجري جديد"))
            1 to 9 -> list.add(IslamicEvent("تاسوعاء", q("tasua", "صيام اليوم التاسع من المحرم"), fasting = true))
            1 to 10 -> list.add(IslamicEvent("يوم عاشوراء", q("arafa_ashura", "صيام يوم عاشوراء"), fasting = true))
            9 to 1 -> list.add(IslamicEvent("أول أيام رمضان", "شهر الصيام والقرآن"))
            10 to 1 -> list.add(IslamicEvent("عيد الفطر", q("eid_fast", "لا يُصام يوم العيد")))
            12 to 8 -> list.add(IslamicEvent("يوم التروية", "بداية مناسك الحج"))
            12 to 9 -> list.add(IslamicEvent("يوم عرفة", q("arafa_ashura", "صيام يوم عرفة"), fasting = true))
            12 to 10 -> list.add(IslamicEvent("عيد الأضحى", q("eid_fast", "لا يُصام يوم العيد")))
        }
        if (h.month == 12 && h.day in 11..13) list.add(IslamicEvent("أيام التشريق", q("tashreeq", "أيام التشريق")))
        if (h.month == 12 && h.day in 1..7) list.add(IslamicEvent("العشر من ذي الحجة", q("dhulhijja", "العمل الصالح في العشر")))
        if (h.month == 9 && h.day >= 21) list.add(IslamicEvent("العشر الأواخر", q("qadr", "تحرّي ليلة القدر")))
        if (h.month == 10 && h.day in 2..30) list.add(IslamicEvent("صيام ست من شوال", q("shawwal", "صيام ست من شوال"), fasting = true))
        val noFast = (h.month == 10 && h.day == 1) || (h.month == 12 && h.day in 10..13) || h.month == 9
        if (!noFast && h.day in 13..15) list.add(IslamicEvent("الأيام البيض", q("white_days", "صيام الأيام البيض"), fasting = true))
        if (!noFast && gregorian != null) {
            when (gregorian.get(Calendar.DAY_OF_WEEK)) {
                Calendar.MONDAY -> list.add(IslamicEvent("صيام الإثنين", q("monthu", "صيام الإثنين"), fasting = true))
                Calendar.THURSDAY -> list.add(IslamicEvent("صيام الخميس", q("monthu", "صيام الخميس"), fasting = true))
            }
        }
        if (gregorian?.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY) {
            list.add(IslamicEvent("يوم الجمعة", "قراءة سورة الكهف والإكثار من الصلاة على النبي ﷺ"))
        }
        return list
    }

    /** The authenticated hadith for an occasion (verbatim, with its reference), or a plain label if unavailable. */
    private fun q(key: String, fallback: String) = HadithQuotes.cite(key) ?: fallback

    fun isRamadan(context: Context): Boolean = of(context, Calendar.getInstance()).month == 9

    @Suppress("unused")
    private fun now() = Date()
}
