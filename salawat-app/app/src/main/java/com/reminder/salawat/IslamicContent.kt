package com.reminder.salawat

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.zip.GZIPInputStream

data class AllahName(val number: Int, val name: String)

object AllahNames {
    @Volatile private var cache: List<AllahName>? = null

    fun all(context: Context): List<AllahName> = cache ?: run {
        val arr = JSONArray(context.assets.open("names99.json").bufferedReader().use { it.readText() })
        (0 until arr.length()).map { i -> arr.getJSONObject(i).let { AllahName(i + 1, it.getString("n")) } }
            .also { cache = it }
    }
}

/** Quran passages commonly recited for ruqyah, as (surah, fromAyah, toAyah). */
/**
 * Hadith quotations shown around the app (dhikr of the day, fasting days). assets/hadith_quotes.json is generated
 * by tools/prepare_hadith.py, which cuts each quotation verbatim out of the authenticated hadith library.
 */
object HadithQuotes {
    @Volatile private var map: Map<String, Pair<String, String>> = emptyMap()

    fun init(context: Context) {
        if (map.isNotEmpty()) return
        runCatching {
            val o = JSONObject(context.assets.open("hadith_quotes.json").bufferedReader(Charsets.UTF_8).use { it.readText() })
            map = o.keys().asSequence().associateWith { k -> o.getJSONObject(k).let { it.getString("t") to it.getString("s") } }
        }
    }

    /** «text» — source, or null if the key is unknown. */
    fun cite(key: String): String? = map[key]?.let { "«${it.first}» — ${it.second}" }
}

object Ruqyah {
    val PASSAGES = listOf(
        Triple(1, 1, 7), Triple(2, 1, 5), Triple(2, 102, 102), Triple(2, 163, 164), Triple(2, 255, 257),
        Triple(2, 284, 286), Triple(3, 18, 19), Triple(7, 54, 56), Triple(7, 117, 122), Triple(10, 79, 82),
        Triple(20, 65, 70), Triple(23, 115, 118), Triple(37, 1, 10), Triple(46, 29, 32), Triple(55, 33, 36),
        Triple(59, 21, 24), Triple(72, 1, 9), Triple(112, 1, 4), Triple(113, 1, 5), Triple(114, 1, 6)
    )

    fun ayahs(context: Context, passage: Triple<Int, Int, Int>): List<QAyah> =
        QuranData.ensureLoaded(context).filter { it.surah == passage.first && it.ayah in passage.second..passage.third }
}

object QuranSearch {
    /** Diacritic- and alef-insensitive form, so typed words match the Uthmani script (single fast pass). */
    fun normalize(text: String): String {
        val sb = StringBuilder(text.length)
        var lastSpace = true
        for (c in text) {
            when {
                c in '\u0610'..'\u061A' || c in '\u064B'..'\u065F' || c == '\u0670' || c in '\u06D6'..'\u06ED' || c == '\u0640' -> Unit
                c == 'ا' || c == 'أ' || c == 'إ' || c == 'آ' || c == 'ٱ' || c == 'ء' -> Unit
                c.isWhitespace() -> if (!lastSpace) { sb.append(' '); lastSpace = true }
                else -> {
                    sb.append(
                        when (c) {
                            'ة' -> 'ه'
                            'ى' -> 'ي'
                            'ؤ' -> 'و'
                            'ئ' -> 'ي'
                            else -> c
                        }
                    )
                    lastSpace = false
                }
            }
        }
        return sb.toString().trim()
    }

    /** Builds the search index ahead of time (call when the search screen opens). */
    suspend fun warmUp(context: Context) = withContext(Dispatchers.Default) {
        if (index == null) index = QuranData.ensureLoaded(context).map { normalize(it.text) }
    }

    @Volatile private var index: List<String>? = null

    suspend fun search(context: Context, query: String, limit: Int = 300): List<QAyah> = withContext(Dispatchers.Default) {
        val q = normalize(query)
        if (q.length < 2) return@withContext emptyList()
        val ayahs = QuranData.ensureLoaded(context)
        val idx = index ?: ayahs.map { normalize(it.text) }.also { index = it }
        val out = ArrayList<QAyah>()
        for (i in ayahs.indices) {
            if (idx[i].contains(q)) {
                out.add(ayahs[i])
                if (out.size >= limit) break
            }
        }
        out
    }
}

data class Hadith(val number: Int, val chapter: Int, val text: String)
data class HadithBook(val id: String, val title: String, val author: String, val chapters: List<Pair<Int, String>>, val hadiths: List<Hadith>)
data class HadithBookInfo(val id: String, val title: String, val author: String, val count: Int, val sizeMb: String, val grading: String, val bundled: Boolean = false)

object Hadiths {
    private const val BASE = "https://github.com/ahmed197113/-/releases/download/salawat-hadith-v2/"
    private val SUNAN_NOTE get() = Lang.pick("الأحاديث التي صححها الشيخ الألباني فقط", "Only the hadith graded sahih by Sheikh al-Albani")
    private val SAHIH_NOTE get() = Lang.pick("جميع أحاديث الكتاب صحيحة", "Every hadith in this book is sahih")

    /** Authentic hadith only — see tools/prepare_hadith.py for the exact selection rules. (Texts stay Arabic.) */
    val BOOKS get() = listOf(
        HadithBookInfo("bukhari", Lang.pick("صحيح البخاري", "Sahih al-Bukhari"), Lang.pick("الإمام البخاري", "Imam al-Bukhari"), 7580, Lang.pick("١٫٤", "1.4"), SAHIH_NOTE),
        HadithBookInfo("muslim", Lang.pick("صحيح مسلم", "Sahih Muslim"), Lang.pick("الإمام مسلم", "Imam Muslim"), 7357, Lang.pick("١٫١", "1.1"), SAHIH_NOTE),
        HadithBookInfo("abudawud", Lang.pick("سنن أبي داود", "Sunan Abi Dawud"), Lang.pick("الإمام أبو داود", "Imam Abu Dawud"), 3330, Lang.pick("٠٫٥", "0.5"), SUNAN_NOTE),
        HadithBookInfo("tirmidhi", Lang.pick("جامع الترمذي", "Jami at-Tirmidhi"), Lang.pick("الإمام الترمذي", "Imam at-Tirmidhi"), 2472, Lang.pick("٠٫٥", "0.5"), SUNAN_NOTE),
        HadithBookInfo("nasai", Lang.pick("سنن النسائي", "Sunan an-Nasai"), Lang.pick("الإمام النسائي", "Imam an-Nasai"), 4396, Lang.pick("٠٫٦", "0.6"), SUNAN_NOTE),
        HadithBookInfo("ibnmajah", Lang.pick("سنن ابن ماجه", "Sunan Ibn Majah"), Lang.pick("الإمام ابن ماجه", "Imam Ibn Majah"), 2822, Lang.pick("٠٫٤", "0.4"), SUNAN_NOTE)
    )

    private val DAILY get() = HadithBookInfo("daily", Lang.pick("من الصحيحين", "From the two Sahihs"), "", 0, "", SAHIH_NOTE, bundled = true)

    private fun file(context: Context, id: String) = File(File(context.filesDir, "hadith2"), "$id.json.gz")

    fun isAvailable(context: Context, info: HadithBookInfo) = info.bundled || file(context, info.id).exists()

    suspend fun download(context: Context, info: HadithBookInfo, onProgress: (Int) -> Unit) =
        Net.download(BASE + "${info.id}.json.gz", file(context, info.id), onProgress)

    fun delete(context: Context, info: HadithBookInfo) {
        file(context, info.id).delete()
    }

    @Volatile private var memo: HadithBook? = null

    suspend fun load(context: Context, info: HadithBookInfo): HadithBook = withContext(Dispatchers.IO) {
        memo?.takeIf { it.id == info.id }?.let { return@withContext it }
        val text = if (info.bundled) {
            context.assets.open("hadith_${info.id}.json").bufferedReader().use { it.readText() }
        } else {
            GZIPInputStream(file(context, info.id).inputStream()).bufferedReader().use { it.readText() }
        }
        parse(info.id, text).also { memo = it }
    }

    private fun parse(id: String, text: String): HadithBook {
        val o = JSONObject(text)
        val c = o.getJSONArray("c")
        val chapters = (0 until c.length()).map { i -> c.getJSONArray(i).let { it.getInt(0) to it.getString(1) } }
        val h = o.getJSONArray("h")
        val hadiths = (0 until h.length()).map { i -> h.getJSONArray(i).let { Hadith(it.optInt(0), it.optInt(1), it.getString(2)) } }
        return HadithBook(id, o.optString("t"), o.optString("a"), chapters, hadiths)
    }

    /** A hadith for today from a bundled selection of Sahih al-Bukhari and Sahih Muslim (changes daily). */
    suspend fun ofTheDay(context: Context): Pair<String, Hadith> {
        val book = load(context, DAILY)
        val day = Calendar.getInstance().let { it.get(Calendar.YEAR) * 366 + it.get(Calendar.DAY_OF_YEAR) }
        val h = book.hadiths[day % book.hadiths.size]
        val source = when (h.chapter) {
            1 -> Lang.pick("صحيح البخاري", "Sahih al-Bukhari")
            2 -> Lang.pick("صحيح مسلم", "Sahih Muslim")
            else -> book.chapters.firstOrNull { it.first == h.chapter }?.second ?: book.title
        }
        return source to h
    }
}
