package com.reminder.salawat

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.zip.GZIPInputStream

data class AllahName(val number: Int, val name: String, val meaning: String)

object AllahNames {
    @Volatile private var cache: List<AllahName>? = null

    fun all(context: Context): List<AllahName> = cache ?: run {
        val arr = JSONArray(context.assets.open("names99.json").bufferedReader().use { it.readText() })
        (0 until arr.length()).map { i -> arr.getJSONObject(i).let { AllahName(i + 1, it.getString("n"), it.getString("m")) } }
            .also { cache = it }
    }
}

/** Quran passages commonly recited for ruqyah, as (surah, fromAyah, toAyah). */
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
    private const val SUNAN_NOTE = "الأحاديث التي صححها الشيخ الألباني فقط"
    private const val SAHIH_NOTE = "جميع أحاديث الكتاب صحيحة"

    /** Authentic hadith only — see tools/prepare_hadith.py for the exact selection rules. */
    val BOOKS = listOf(
        HadithBookInfo("bukhari", "صحيح البخاري", "الإمام البخاري", 7580, "١٫٤", SAHIH_NOTE),
        HadithBookInfo("muslim", "صحيح مسلم", "الإمام مسلم", 7357, "١٫١", SAHIH_NOTE),
        HadithBookInfo("abudawud", "سنن أبي داود", "الإمام أبو داود", 3330, "٠٫٥", SUNAN_NOTE),
        HadithBookInfo("tirmidhi", "جامع الترمذي", "الإمام الترمذي", 2472, "٠٫٥", SUNAN_NOTE),
        HadithBookInfo("nasai", "سنن النسائي", "الإمام النسائي", 4396, "٠٫٦", SUNAN_NOTE),
        HadithBookInfo("ibnmajah", "سنن ابن ماجه", "الإمام ابن ماجه", 2822, "٠٫٤", SUNAN_NOTE)
    )

    private val DAILY = HadithBookInfo("daily", "من الصحيحين", "", 0, "", SAHIH_NOTE, bundled = true)

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
        val source = book.chapters.firstOrNull { it.first == h.chapter }?.second ?: book.title
        return source to h
    }
}
