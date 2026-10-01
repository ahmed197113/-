package com.reminder.salawat

import android.content.Context

data class QAyah(val global: Int, val surah: Int, val ayah: Int, val page: Int, val juz: Int, val text: String)

/** The full Uthmani text (bundled, works offline) indexed by Mushaf page (1..604). */
object QuranData {
    const val PAGE_COUNT = 604

    @Volatile private var ayahs: List<QAyah>? = null
    private lateinit var pageStart: IntArray // index of the first ayah of each page; size PAGE_COUNT + 2
    private val surahStartPage = IntArray(115)
    private val juzStartPage = IntArray(31)

    fun ensureLoaded(context: Context): List<QAyah> {
        ayahs?.let { return it }
        synchronized(this) {
            ayahs?.let { return it }
            val list = ArrayList<QAyah>(6236)
            context.assets.open("quran_uthmani.tsv").bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    if (line.isBlank()) return@forEach
                    val parts = line.split('\t', limit = 6)
                    list.add(QAyah(parts[0].toInt(), parts[1].toInt(), parts[2].toInt(), parts[3].toInt(), parts[4].toInt(), parts[5]))
                }
            }
            val starts = IntArray(PAGE_COUNT + 2) { list.size }
            for (i in list.indices.reversed()) {
                val a = list[i]
                starts[a.page] = i
                surahStartPage[a.surah] = a.page
                juzStartPage[a.juz] = a.page
            }
            for (p in PAGE_COUNT downTo 1) if (starts[p] > starts[p + 1]) starts[p] = starts[p + 1]
            pageStart = starts
            ayahs = list
            return list
        }
    }

    fun page(context: Context, page: Int): List<QAyah> {
        val list = ensureLoaded(context)
        return list.subList(pageStart[page], pageStart[page + 1])
    }

    fun byGlobal(context: Context, global: Int): QAyah? = ensureLoaded(context).getOrNull(global - 1)

    fun surahStartPage(context: Context, surah: Int): Int {
        ensureLoaded(context)
        return surahStartPage[surah].coerceIn(1, PAGE_COUNT)
    }

    fun juzStartPage(context: Context, juz: Int): Int {
        ensureLoaded(context)
        return juzStartPage[juz].coerceIn(1, PAGE_COUNT)
    }

    fun surahName(context: Context, surah: Int): String =
        QuranApi.loadSurahList(context).getOrNull(surah - 1)?.name ?: "$surah"

    fun toArabicDigits(n: Int): String = n.toString().map { if (it in '0'..'9') '٠' + (it - '0') else it }.joinToString("")
}

data class Reciter(val id: String, val name: String, val bitrate: Int) {
    fun ayahUrl(global: Int) = "https://cdn.islamic.network/quran/audio/$bitrate/$id/$global.mp3"
}

object Reciters {
    /** Editions verified on the islamic.network CDN (bitrate = best available ≤128 kbps). */
    val ALL = listOf(
        Reciter("ar.alafasy", "مشاري راشد العفاسي", 128),
        Reciter("ar.minshawi", "محمد صديق المنشاوي (مرتّل)", 128),
        Reciter("ar.minshawimujawwad", "محمد صديق المنشاوي (مجوّد)", 64),
        Reciter("ar.husary", "محمود خليل الحصري (مرتّل)", 128),
        Reciter("ar.husarymujawwad", "محمود خليل الحصري (مجوّد)", 128),
        Reciter("ar.abdulbasitmurattal", "عبد الباسط عبد الصمد (مرتّل)", 64),
        Reciter("ar.abdulsamad", "عبد الباسط عبد الصمد (مجوّد)", 64),
        Reciter("ar.mahermuaiqly", "ماهر المعيقلي", 128),
        Reciter("ar.abdurrahmaansudais", "عبد الرحمن السديس", 64),
        Reciter("ar.saoodshuraym", "سعود الشريم", 64),
        Reciter("ar.shaatree", "أبو بكر الشاطري", 128),
        Reciter("ar.ahmedajamy", "أحمد بن علي العجمي", 128),
        Reciter("ar.hudhaify", "علي الحذيفي", 128),
        Reciter("ar.muhammadayyoub", "محمد أيوب", 128),
        Reciter("ar.muhammadjibreel", "محمد جبريل", 128),
        Reciter("ar.abdullahbasfar", "عبد الله بصفر", 64),
        Reciter("ar.hanirifai", "هاني الرفاعي", 64),
        Reciter("ar.aymanswoaid", "أيمن سويد", 64),
        Reciter("ar.ibrahimakhbar", "إبراهيم الأخضر", 32)
    )

    fun selected(context: Context): Reciter {
        val id = Prefs.get(context).getString(Prefs.KEY_RECITER, null)
        return ALL.firstOrNull { it.id == id } ?: ALL.first()
    }
}

object Tafasir {
    val ALL = listOf(
        "ar.muyassar" to "التفسير الميسر",
        "ar.jalalayn" to "تفسير الجلالين",
        "ar.waseet" to "التفسير الوسيط",
        "ar.baghawi" to "تفسير البغوي",
        "ar.qurtubi" to "تفسير القرطبي",
        "ar.miqbas" to "تنوير المقباس"
    )

    fun selected(context: Context): Pair<String, String> {
        val id = Prefs.get(context).getString(Prefs.KEY_TAFSIR, null)
        return ALL.firstOrNull { it.first == id } ?: ALL.first()
    }
}
