package com.reminder.salawat

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.ensureActive

object Net {
    private const val ATTEMPTS = 3

    /** GET with retries; runs on the IO dispatcher. */
    suspend fun get(url: String): String = withContext(Dispatchers.IO) {
        var last: Exception? = null
        for (attempt in 1..ATTEMPTS) {
            try {
                return@withContext getOnce(url)
            } catch (e: Exception) {
                last = e
                if (attempt < ATTEMPTS) delay(1500L * attempt)
            }
        }
        throw last ?: IOException("Request failed")
    }

    private fun getOnce(url: String): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            val code = connection.responseCode
            if (code != 200) throw IOException("HTTP $code")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }.stripBom()
        } finally {
            connection.disconnect()
        }
    }

    /** Downloads [url] to [target] (via a temp file), following redirects across hosts; reports 0..100. */
    suspend fun download(url: String, target: File, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, target.name + ".part")
        var connection = URL(url).openConnection() as HttpURLConnection
        var redirects = 0
        // HttpURLConnection does not follow redirects that change host on some versions; do it by hand.
        while (true) {
            connection.connectTimeout = 20_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = false
            val code = connection.responseCode
            if (code in 300..399 && redirects < 6) {
                val location = connection.getHeaderField("Location") ?: throw IOException("redirect without location")
                connection.disconnect()
                connection = URL(URL(url), location).openConnection() as HttpURLConnection
                redirects++
                continue
            }
            if (code != 200) throw IOException("HTTP $code")
            break
        }
        try {
            val total = connection.contentLengthLong
            connection.inputStream.use { input ->
                tmp.outputStream().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var done = 0L
                    var lastPercent = -1
                    while (true) {
                        ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        done += read
                        if (total > 0) {
                            val percent = (done * 100 / total).toInt()
                            if (percent != lastPercent) {
                                lastPercent = percent
                                withContext(Dispatchers.Main) { onProgress(percent) }
                            }
                        }
                    }
                }
            }
            if (tmp.length() < 10_000) throw IOException("file too small")
            if (!tmp.renameTo(target)) throw IOException("rename failed")
        } finally {
            connection.disconnect()
            tmp.delete()
        }
    }
}


fun String.stripBom(): String = trimStart('﻿')

/** Writes through a temp file so an interrupted write never leaves a corrupt cache. */
fun File.writeTextAtomic(text: String) {
    parentFile?.mkdirs()
    val tmp = File(parentFile, "$name.tmp")
    tmp.writeText(text, Charsets.UTF_8)
    if (!tmp.renameTo(this)) {
        writeText(text, Charsets.UTF_8)
        tmp.delete()
    }
}
