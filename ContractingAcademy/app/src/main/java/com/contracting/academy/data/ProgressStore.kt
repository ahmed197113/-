package com.contracting.academy.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** يحفظ تقدّم المتعلم محلياً على الجهاز: الدروس المنجزة، المفضلة، ونتائج الاختبارات. */
class ProgressStore(context: Context) {

    private val prefs = context.getSharedPreferences("progress", Context.MODE_PRIVATE)

    var completed by mutableStateOf(prefs.getStringSet(KEY_DONE, emptySet())!!.toSet())
        private set

    var bookmarks by mutableStateOf(prefs.getStringSet(KEY_MARKS, emptySet())!!.toSet())
        private set

    /** معرف الدرس ← (أفضل نتيجة، عدد الأسئلة) */
    var scores by mutableStateOf(decodeScores(prefs.getString(KEY_SCORES, "").orEmpty()))
        private set

    var lastLesson by mutableStateOf(prefs.getString(KEY_LAST, null))
        private set

    fun isDone(id: String) = id in completed

    fun setDone(id: String, done: Boolean) {
        completed = if (done) completed + id else completed - id
        prefs.edit().putStringSet(KEY_DONE, completed).apply()
    }

    fun toggleBookmark(id: String) {
        bookmarks = if (id in bookmarks) bookmarks - id else bookmarks + id
        prefs.edit().putStringSet(KEY_MARKS, bookmarks).apply()
    }

    fun saveScore(id: String, score: Int, total: Int) {
        val best = scores[id]
        if (best == null || score >= best.first) {
            scores = scores + (id to (score to total))
            prefs.edit().putString(KEY_SCORES, encodeScores(scores)).apply()
        }
        // اجتياز 70% فأكثر يُعد إتماماً للدرس
        if (total > 0 && score * 10 >= total * 7) setDone(id, true)
    }

    fun openLesson(id: String) {
        lastLesson = id
        prefs.edit().putString(KEY_LAST, id).apply()
    }

    fun reset() {
        prefs.edit().clear().apply()
        completed = emptySet()
        bookmarks = emptySet()
        scores = emptyMap()
        lastLesson = null
    }

    private fun encodeScores(m: Map<String, Pair<Int, Int>>) =
        m.entries.joinToString(";") { "${it.key}:${it.value.first}/${it.value.second}" }

    private fun decodeScores(s: String): Map<String, Pair<Int, Int>> =
        s.split(';').mapNotNull { part ->
            val id = part.substringBefore(':', "")
            val nums = part.substringAfter(':', "").split('/')
            val a = nums.getOrNull(0)?.toIntOrNull()
            val b = nums.getOrNull(1)?.toIntOrNull()
            if (id.isEmpty() || a == null || b == null) null else id to (a to b)
        }.toMap()

    private companion object {
        const val KEY_DONE = "completed"
        const val KEY_MARKS = "bookmarks"
        const val KEY_SCORES = "scores"
        const val KEY_LAST = "last"
    }
}
