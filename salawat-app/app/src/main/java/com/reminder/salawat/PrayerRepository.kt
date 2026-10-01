package com.reminder.salawat

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

enum class Prayer(val apiKey: String, val nameRes: Int, val isSalah: Boolean) {
    FAJR("Fajr", R.string.prayer_fajr, true),
    SUNRISE("Sunrise", R.string.prayer_sunrise, false),
    DHUHR("Dhuhr", R.string.prayer_dhuhr, true),
    ASR("Asr", R.string.prayer_asr, true),
    MAGHRIB("Maghrib", R.string.prayer_maghrib, true),
    ISHA("Isha", R.string.prayer_isha, true)
}

data class DayTimings(
    val year: Int,
    val month: Int, // 1..12
    val day: Int,
    val times: Map<Prayer, String>, // "HH:mm"
    val readableDate: String,
    val hijriDate: String,
    val timeZone: TimeZone
) {
    fun millisOf(prayer: Prayer): Long? {
        val parts = times[prayer]?.split(":") ?: return null
        val hour = parts.getOrNull(0)?.toIntOrNull() ?: return null
        val minute = parts.getOrNull(1)?.toIntOrNull() ?: return null
        return Calendar.getInstance(timeZone).apply {
            clear()
            set(year, month - 1, day, hour, minute, 0)
        }.timeInMillis
    }
}

data class UpcomingPrayer(val prayer: Prayer, val time: String, val millis: Long)

/**
 * Prayer times for the configured location. A whole month is fetched at once and cached on disk,
 * so the screen, the widget and the prayer alarms all work offline afterwards.
 */
object PrayerRepository {
    private const val PREFS = "prayer_times_prefs"
    const val KEY_CITY = "city"
    const val KEY_COUNTRY = "country"
    const val KEY_USE_LOCATION = "use_location"
    const val KEY_LAT = "lat"
    const val KEY_LNG = "lng"
    const val KEY_METHOD = "method"
    const val KEY_ALERTS = "prayer_alerts"
    private const val KEY_CONFIG_SIG = "config_sig"
    private const val KEY_LAST_FETCH = "last_fetch"

    /** Aladhan method ids, in the order of R.array.prayer_method_labels. */
    val METHOD_IDS = intArrayOf(5, 3, 4, 1, 2, 9, 10, 16, 13)
    const val DEFAULT_METHOD = 5 // Egyptian General Authority of Survey

    fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isConfigured(context: Context): Boolean {
        val p = prefs(context)
        return if (p.getBoolean(KEY_USE_LOCATION, false)) p.contains(KEY_LAT)
        else !p.getString(KEY_CITY, "").isNullOrBlank()
    }

    fun location(context: Context): Pair<Double, Double>? {
        val p = prefs(context)
        if (!p.contains(KEY_LAT)) return null
        return p.getFloat(KEY_LAT, 0f).toDouble() to p.getFloat(KEY_LNG, 0f).toDouble()
    }

    private fun configSignature(p: SharedPreferences): String =
        if (p.getBoolean(KEY_USE_LOCATION, false)) {
            "loc:${p.getFloat(KEY_LAT, 0f)},${p.getFloat(KEY_LNG, 0f)}:${p.getInt(KEY_METHOD, DEFAULT_METHOD)}"
        } else {
            "city:${p.getString(KEY_CITY, "")},${p.getString(KEY_COUNTRY, "")}:${p.getInt(KEY_METHOD, DEFAULT_METHOD)}"
        }

    private fun cacheDir(context: Context) = File(context.filesDir, "prayer_cache")

    private fun monthFile(context: Context, year: Int, month: Int) =
        File(cacheDir(context), String.format(Locale.US, "%04d-%02d.json", year, month))

    /** Drops cached months when the location or calculation method has changed. */
    private fun invalidateIfConfigChanged(context: Context) {
        val p = prefs(context)
        val sig = configSignature(p)
        if (p.getString(KEY_CONFIG_SIG, null) != sig) {
            cacheDir(context).deleteRecursively()
            p.edit().putString(KEY_CONFIG_SIG, sig).apply()
        }
    }

    /** Downloads the current month (and the next one near the month's end). */
    suspend fun refresh(context: Context) {
        invalidateIfConfigChanged(context)
        val now = Calendar.getInstance()
        val year = now.get(Calendar.YEAR)
        val month = now.get(Calendar.MONTH) + 1
        fetchMonth(context, year, month)
        if (now.get(Calendar.DAY_OF_MONTH) >= 20) {
            val next = (now.clone() as Calendar).apply { add(Calendar.MONTH, 1) }
            runCatching { fetchMonth(context, next.get(Calendar.YEAR), next.get(Calendar.MONTH) + 1) }
        }
        prefs(context).edit().putLong(KEY_LAST_FETCH, System.currentTimeMillis()).apply()
    }

    private suspend fun fetchMonth(context: Context, year: Int, month: Int) {
        val p = prefs(context)
        val method = p.getInt(KEY_METHOD, DEFAULT_METHOD)
        val url = if (p.getBoolean(KEY_USE_LOCATION, false)) {
            "https://api.aladhan.com/v1/calendar/$year/$month?latitude=${p.getFloat(KEY_LAT, 0f)}" +
                "&longitude=${p.getFloat(KEY_LNG, 0f)}&method=$method"
        } else {
            val city = URLEncoder.encode(p.getString(KEY_CITY, "").orEmpty(), "UTF-8")
            val country = URLEncoder.encode(p.getString(KEY_COUNTRY, "").orEmpty(), "UTF-8")
            "https://api.aladhan.com/v1/calendarByCity/$year/$month?city=$city&country=$country&method=$method"
        }
        val body = Net.get(url)
        val json = JSONObject(body)
        if (json.optInt("code") != 200) throw IllegalStateException("API error: ${json.optString("status")}")
        parseMonth(body) // validate before caching
        withContext(Dispatchers.IO) { monthFile(context, year, month).writeTextAtomic(body) }
    }

    private fun parseMonth(body: String): List<DayTimings> {
        val data = JSONObject(body.stripBom()).getJSONArray("data")
        return (0 until data.length()).map { i ->
            val o = data.getJSONObject(i)
            val timings = o.getJSONObject("timings")
            val date = o.getJSONObject("date")
            val gregorian = date.getJSONObject("gregorian").getString("date").split("-") // dd-MM-yyyy
            val hijri = date.optJSONObject("hijri")
            val hijriText = if (hijri != null) {
                "${hijri.optString("day")} ${hijri.optJSONObject("month")?.optString("ar").orEmpty()} ${hijri.optString("year")} هـ"
            } else ""
            val tzId = o.optJSONObject("meta")?.optString("timezone")
            DayTimings(
                year = gregorian[2].toInt(),
                month = gregorian[1].toInt(),
                day = gregorian[0].toInt(),
                times = Prayer.values().associateWith { timings.getString(it.apiKey).substringBefore(" ").trim() },
                readableDate = date.optString("readable"),
                hijriDate = hijriText,
                timeZone = if (tzId.isNullOrBlank()) TimeZone.getDefault() else TimeZone.getTimeZone(tzId)
            )
        }
    }

    private val monthMemo = HashMap<String, List<DayTimings>>()

    private fun loadMonth(context: Context, year: Int, month: Int): List<DayTimings>? {
        val file = monthFile(context, year, month)
        if (!file.exists()) return null
        val key = "${file.path}:${file.lastModified()}"
        synchronized(monthMemo) { monthMemo[key]?.let { return it } }
        val parsed = runCatching { parseMonth(file.readText(Charsets.UTF_8)) }.getOrNull() ?: return null
        synchronized(monthMemo) {
            monthMemo.clear()
            monthMemo[key] = parsed
        }
        return parsed
    }

    fun dayTimings(context: Context, calendar: Calendar): DayTimings? {
        val y = calendar.get(Calendar.YEAR)
        val m = calendar.get(Calendar.MONTH) + 1
        val d = calendar.get(Calendar.DAY_OF_MONTH)
        return loadMonth(context, y, m)?.firstOrNull { it.day == d && it.month == m && it.year == y }
    }

    fun today(context: Context): DayTimings? = dayTimings(context, Calendar.getInstance())

    fun hasToday(context: Context): Boolean = today(context) != null

    /** Next salah (sunrise excluded) after [now], looking up to two days ahead in the cache. */
    fun nextPrayer(context: Context, now: Long = System.currentTimeMillis()): UpcomingPrayer? {
        val cal = Calendar.getInstance().apply { timeInMillis = now }
        repeat(3) {
            val day = dayTimings(context, cal)
            if (day != null) {
                for (prayer in Prayer.values()) {
                    if (!prayer.isSalah) continue
                    val millis = day.millisOf(prayer) ?: continue
                    if (millis > now) return UpcomingPrayer(prayer, day.times.getValue(prayer), millis)
                }
            }
            cal.add(Calendar.DAY_OF_MONTH, 1)
        }
        return null
    }
}
