package com.reminder.salawat

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object AzkarApi {
    private const val BASE_URL = "https://www.hisnmuslim.com/api/ar/"

    fun loadCategoryList(context: Context): List<AzkarCategoryRef> {
        val text = context.assets.open("azkar_categories.json").bufferedReader(Charsets.UTF_8).use { it.readText() }.stripBom()
        val array = JSONArray(text)
        return (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            AzkarCategoryRef(o.getInt("id"), o.getString("title"))
        }
    }

    suspend fun fetchCategory(context: Context, id: Int): AzkarCategory {
        val file = File(File(context.filesDir, "azkar_cache"), "$id.json")
        val cached = withContext(Dispatchers.IO) {
            if (file.exists()) runCatching { parse(file.readText(Charsets.UTF_8)) }.getOrNull() else null
        }
        if (cached != null) return cached
        val body = Net.get("$BASE_URL$id.json")
        val parsed = parse(body)
        withContext(Dispatchers.IO) { file.writeTextAtomic(body) }
        return parsed
    }

    private fun parse(text: String): AzkarCategory {
        val json = JSONObject(text.stripBom())
        val title = json.keys().next()
        val array = json.getJSONArray(title)
        val items = (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            AzkarItem(o.optString("ARABIC_TEXT").trim(), o.optInt("REPEAT", 1).coerceAtLeast(1), o.optString("AUDIO", "").toHttps())
        }
        return AzkarCategory(title, items)
    }
}

/** Android blocks cleartext HTTP by default; the Hisn al-Muslim API returns http:// audio links. */
private fun String.toHttps(): String = if (startsWith("http://")) "https://" + removePrefix("http://") else this
