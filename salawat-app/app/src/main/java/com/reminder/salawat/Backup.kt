package com.reminder.salawat

import android.content.Context
import android.net.Uri
import org.json.JSONObject

/**
 * Backup to a file the user chooses (Drive, Downloads…) and restore from it on a new phone: settings, location,
 * khatma, bookmarks, tasbih counts, prayer log and reminders. Nothing leaves the phone unless the user moves the file.
 */
object Backup {
    private val FILES = listOf("salawat_prefs", "prayer_times_prefs", "prayer_tracker")
    private const val FORMAT = "rafiq-backup"

    fun export(context: Context, uri: Uri) {
        val root = JSONObject().put("format", FORMAT).put("version", 1).put("created", System.currentTimeMillis())
        val all = JSONObject()
        for (name in FILES) {
            val o = JSONObject()
            for ((key, value) in context.getSharedPreferences(name, Context.MODE_PRIVATE).all) {
                val (t, v) = when (value) {
                    is Boolean -> "b" to value
                    is Int -> "i" to value
                    is Long -> "l" to value
                    is Float -> "f" to value.toDouble()
                    is String -> "s" to value
                    is Set<*> -> "S" to org.json.JSONArray(value.map { it.toString() })
                    else -> continue
                }
                o.put(key, JSONObject().put("t", t).put("v", v))
            }
            all.put(name, o)
        }
        root.put("prefs", all)
        context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(root.toString(1).toByteArray(Charsets.UTF_8)) }
            ?: error("cannot write")
    }

    /** Replaces the current data with the backup's, then re-arms every alarm. Throws on a file that is not a backup. */
    fun restore(context: Context, uri: Uri) {
        val text = context.contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } ?: error("cannot read")
        val root = JSONObject(text)
        require(root.optString("format") == FORMAT) { "not a backup" }
        val all = root.getJSONObject("prefs")
        for (name in FILES) {
            val o = all.optJSONObject(name) ?: continue
            val editor = context.getSharedPreferences(name, Context.MODE_PRIVATE).edit().clear()
            for (key in o.keys()) {
                val e = o.getJSONObject(key)
                when (e.getString("t")) {
                    "b" -> editor.putBoolean(key, e.getBoolean("v"))
                    "i" -> editor.putInt(key, e.getInt("v"))
                    "l" -> editor.putLong(key, e.getLong("v"))
                    "f" -> editor.putFloat(key, e.getDouble("v").toFloat())
                    "s" -> editor.putString(key, e.getString("v"))
                    "S" -> editor.putStringSet(key, e.getJSONArray("v").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() })
                }
            }
            editor.commit()
        }
        // Prayer times are recomputed for the restored location and settings.
        java.io.File(context.filesDir, "prayer_cache").deleteRecursively()
        PrayerRepository.settingsChanged(context)
        PrayerScheduler.refreshDependents(context)
        ReminderWorker.apply(context)
        SalawatApp.applyTheme(context)
    }
}
