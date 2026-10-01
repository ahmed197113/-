package com.reminder.salawat

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

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
