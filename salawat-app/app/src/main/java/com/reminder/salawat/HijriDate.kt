package com.reminder.salawat

import android.content.Context
import android.icu.util.Calendar as IcuCalendar
import android.icu.util.ULocale
import java.util.Calendar
import java.util.Date

data class HijriDay(val year: Int, val month: Int /* 1..12 */, val day: Int)

data class IslamicEvent(val title: String, val note: String, val fasting: Boolean = false, val weekly: Boolean = false)

/**
 * Hijri dates via ICU's Umm al-Qura calendar (offline, API 24+), with a user adjustment of ±2 days
 * because the start of months depends on local moon sighting.
 */
object HijriDate {
    const val KEY_OFFSET = "hijri_offset"

    private val MONTHS_AR = listOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    )
    private val MONTHS_EN = listOf(
        "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Akhir", "Jumada al-Ula", "Jumada al-Akhirah",
        "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul-Qadah", "Dhul-Hijjah"
    )
    val MONTHS get() = if (Lang.arabic) MONTHS_AR else MONTHS_EN

    /** " هـ" / " AH" after a Hijri year. */
    val ERA get() = Lang.pick("هـ", "AH")

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
        val base = "${QuranData.toArabicDigits(h.day)} ${MONTHS[h.month - 1]} ${QuranData.toArabicDigits(h.year)} $ERA"
        if (!withWeekday) return base
        return "${weekday(Calendar.getInstance())} $base"
    }

    fun weekday(cal: Calendar): String = WEEKDAYS[cal.get(Calendar.DAY_OF_WEEK) - 1]

    private val WEEKDAYS get() = if (Lang.arabic) listOf("الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت")
        else listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

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
            1 to 1 -> list.add(IslamicEvent(Lang.pick("رأس السنة الهجرية", "Islamic New Year"), Lang.pick("بداية عام هجري جديد", "The start of a new Hijri year")))
            1 to 9 -> list.add(IslamicEvent(Lang.pick("تاسوعاء", "Tasu'a (9 Muharram)"), q("tasua", Lang.pick("صيام اليوم التاسع من المحرم", "Fasting the 9th of Muharram")), fasting = true))
            1 to 10 -> list.add(IslamicEvent(Lang.pick("يوم عاشوراء", "Day of Ashura"), q("arafa_ashura", Lang.pick("صيام يوم عاشوراء", "Fasting the day of Ashura")), fasting = true))
            9 to 1 -> list.add(IslamicEvent(Lang.pick("أول أيام رمضان", "First day of Ramadan"), Lang.pick("شهر الصيام والقرآن", "The month of fasting and the Quran")))
            10 to 1 -> list.add(IslamicEvent(Lang.pick("عيد الفطر", "Eid al-Fitr"), q("eid_fast", Lang.pick("لا يُصام يوم العيد", "No fasting on the day of Eid"))))
            12 to 8 -> list.add(IslamicEvent(Lang.pick("يوم التروية", "Day of Tarwiyah"), Lang.pick("بداية مناسك الحج", "The rites of Hajj begin")))
            12 to 9 -> list.add(IslamicEvent(Lang.pick("يوم عرفة", "Day of Arafah"), q("arafa_ashura", Lang.pick("صيام يوم عرفة", "Fasting the day of Arafah")), fasting = true))
            12 to 10 -> list.add(IslamicEvent(Lang.pick("عيد الأضحى", "Eid al-Adha"), q("eid_fast", Lang.pick("لا يُصام يوم العيد", "No fasting on the day of Eid"))))
        }
        if (h.month == 12 && h.day in 11..13) list.add(IslamicEvent(Lang.pick("أيام التشريق", "Days of Tashreeq"), q("tashreeq", Lang.pick("أيام التشريق", "Days of Tashreeq"))))
        if (h.month == 12 && h.day in 1..7) list.add(IslamicEvent(Lang.pick("العشر من ذي الحجة", "First ten days of Dhul-Hijjah"), q("dhulhijja", Lang.pick("العمل الصالح في العشر", "Good deeds in the ten days"))))
        if (h.month == 9 && h.day >= 21) list.add(IslamicEvent(Lang.pick("العشر الأواخر", "Last ten nights"), q("qadr", Lang.pick("تحرّي ليلة القدر", "Seek Laylat al-Qadr"))))
        if (h.month == 10 && h.day in 2..30) list.add(IslamicEvent(Lang.pick("صيام ست من شوال", "Six days of Shawwal"), q("shawwal", Lang.pick("صيام ست من شوال", "Fasting six days of Shawwal")), fasting = true))
        val noFast = (h.month == 10 && h.day == 1) || (h.month == 12 && h.day in 10..13) || h.month == 9
        if (!noFast && h.day in 13..15) list.add(IslamicEvent(Lang.pick("الأيام البيض", "The White Days"), q("white_days", Lang.pick("صيام الأيام البيض", "Fasting the 13th, 14th and 15th")), fasting = true))
        if (!noFast && gregorian != null) {
            when (gregorian.get(Calendar.DAY_OF_WEEK)) {
                Calendar.MONDAY -> list.add(IslamicEvent(Lang.pick("صيام الإثنين", "Monday fast"), q("monthu", Lang.pick("صيام الإثنين", "Fasting on Monday")), fasting = true, weekly = true))
                Calendar.THURSDAY -> list.add(IslamicEvent(Lang.pick("صيام الخميس", "Thursday fast"), q("monthu", Lang.pick("صيام الخميس", "Fasting on Thursday")), fasting = true, weekly = true))
            }
        }
        if (gregorian?.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY) {
            list.add(IslamicEvent(Lang.pick("يوم الجمعة", "Friday"), Lang.pick("قراءة سورة الكهف والإكثار من الصلاة على النبي ﷺ", "Read Surah al-Kahf and send abundant salawat upon the Prophet ﷺ"), weekly = true))
        }
        return list
    }

    /** The authenticated hadith for an occasion (verbatim, with its reference), or a plain label if unavailable. */
    private fun q(key: String, fallback: String) = HadithQuotes.cite(key) ?: fallback

    fun isRamadan(context: Context): Boolean = of(context, Calendar.getInstance()).month == 9

    @Suppress("unused")
    private fun now() = Date()
}
