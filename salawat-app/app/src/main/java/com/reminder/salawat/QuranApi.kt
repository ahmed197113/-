package com.reminder.salawat

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object QuranApi {
    private const val BASE_URL = "https://api.alquran.cloud/v1/surah/"

    @Volatile private var surahList: List<SurahRef>? = null

    fun loadSurahList(context: Context): List<SurahRef> {
        surahList?.let { return it }
        val text = context.assets.open("surah_list.json").bufferedReader(Charsets.UTF_8).use { it.readText() }.stripBom()
        val array = JSONArray(text)
        val list = (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            SurahRef(
                o.getInt("number"), o.getString("name"), o.getString("englishName"),
                o.getString("englishNameTranslation"), o.getInt("numberOfAyahs"), o.getString("revelationType")
            )
        }
        surahList = list
        return list
    }

    suspend fun fetchTafsir(context: Context, number: Int, edition: String): Map<Int, String> =
        fetchCached(cacheFile(context, number, "tafsir_$edition"), "$BASE_URL$number/$edition", ::parseTafsir)

    private suspend fun <T> fetchCached(file: File, url: String, parser: (String) -> T): T {
        val cached = withContext(Dispatchers.IO) {
            if (file.exists()) runCatching { parser(file.readText(Charsets.UTF_8)) }.getOrNull() else null
        }
        if (cached != null) return cached
        val body = Net.get(url)
        val parsed = parser(body)
        withContext(Dispatchers.IO) { file.writeTextAtomic(body) }
        return parsed
    }

    private fun parseTafsir(body: String): Map<Int, String> {
        val ayahsJson = JSONObject(body.stripBom()).getJSONObject("data").getJSONArray("ayahs")
        val map = LinkedHashMap<Int, String>()
        for (i in 0 until ayahsJson.length()) {
            val o = ayahsJson.getJSONObject(i)
            map[o.getInt("numberInSurah")] = o.getString("text")
        }
        return map
    }

    private fun cacheFile(context: Context, number: Int, kind: String) =
        File(File(context.filesDir, "quran_cache"), "${number}_$kind.json")
}
