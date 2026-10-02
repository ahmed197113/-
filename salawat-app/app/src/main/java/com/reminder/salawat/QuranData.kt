package com.reminder.salawat

import android.content.Context

/**
 * [full] is the Tanzil text exactly as published. [text] is the same characters with the leading basmala of
 * ayah 1 split off (it is shown as the surah header instead, as in the printed Mushaf).
 */
data class QAyah(val global: Int, val surah: Int, val ayah: Int, val page: Int, val juz: Int, val full: String, val text: String)

/**
 * The Quran text is the official Tanzil Project Uthmani text (tanzil.net, v1.1), bundled verbatim with its
 * copyright notice in assets/quran/tanzil-uthmani.txt — never edited by hand. CI checks its SHA-256 and that it
 * is identical to the Quran Foundation (quran.com) Uthmani text. Page/juz numbers follow the Madinah Mushaf.
 */
object QuranData {
    const val PAGE_COUNT = 604
    const val TANZIL_SHA256 = "7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326"

    /** The basmala exactly as Tanzil writes it (ayah 1:1). */
    @Volatile var basmala: String = ""
        private set

    @Volatile private var ayahs: List<QAyah>? = null
    private lateinit var pageStart: IntArray // index of the first ayah of each page; size PAGE_COUNT + 2
    private val surahStartPage = IntArray(115)
    private val juzStartPage = IntArray(31)

    fun ensureLoaded(context: Context): List<QAyah> {
        ayahs?.let { return it }
        synchronized(this) {
            ayahs?.let { return it }
            val list = ArrayList<QAyah>(6236)
            val texts = ArrayList<String>(6236)
            context.assets.open("quran/tanzil-uthmani.txt").bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    if (line.isEmpty() || !line[0].isDigit()) return@forEach // copyright block
                    texts.add(line.split('|', limit = 3)[2])
                }
            }
            basmala = texts[0]
            context.assets.open("quran/meta.tsv").bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    if (line.isBlank()) return@forEach
                    val p = line.split('\t')
                    val global = p[0].toInt()
                    val surah = p[1].toInt()
                    val ayah = p[2].toInt()
                    val full = texts[global - 1]
                    list.add(QAyah(global, surah, ayah, p[3].toInt(), p[4].toInt(), full, bodyOf(surah, ayah, full)))
                }
            }
            check(list.size == 6236) { "Quran text incomplete" }
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

    /** Ayah 1 of every surah except 1 and 9 begins with the basmala's four words in Tanzil's text. */
    private fun bodyOf(surah: Int, ayah: Int, full: String): String {
        if (ayah != 1 || surah == 1 || surah == 9) return full
        var idx = -1
        repeat(4) { idx = full.indexOf(' ', idx + 1); if (idx < 0) return full }
        return full.substring(idx + 1)
    }

    /** The basmala that opens [surah] in the Mushaf (95 and 97 carry a shadda on the first letter), or null. */
    fun surahBasmala(context: Context, surah: Int): String? {
        if (surah == 1 || surah == 9) return null
        val a = ensureLoaded(context).first { it.surah == surah }
        return a.full.removeSuffix(a.text).trimEnd()
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

    /** "[surah name]" ready for a TextView: the name in the Mushaf font, the rest unchanged. */
    fun styledName(context: Context, text: String, vararg surahs: Int): CharSequence =
        Ui.quranNames(context, text, *surahs.map { surahName(context, it) }.toTypedArray())

    fun surahName(context: Context, surah: Int): String =
        QuranApi.loadSurahList(context).getOrNull(surah - 1)?.name ?: "$surah"

    fun toArabicDigits(n: Int): String = n.toString().map { if (it in '0'..'9') '٠' + (it - '0') else it }.joinToString("")
}

/**
 * A reciter with one recording per ayah: either an islamic.network edition ([bitrate]/[id]) or, when
 * [everyAyahFolder] is set, a folder on everyayah.com (files named SSSAAA.mp3).
 */
data class Reciter(val id: String, val name: String, val bitrate: Int, val everyAyahFolder: String? = null) {
    fun ayahUrl(context: Context, global: Int): String {
        everyAyahFolder?.let { folder ->
            val a = QuranData.byGlobal(context, global) ?: return ""
            return "https://everyayah.com/data/$folder/%03d%03d.mp3".format(java.util.Locale.US, a.surah, a.ayah)
        }
        return "https://cdn.islamic.network/quran/audio/$bitrate/$id/$global.mp3"
    }
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
        Reciter("everyayah.yasserdussary", "ياسر الدوسري", 128, everyAyahFolder = "Yasser_Ad-Dussary_128kbps"),
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
