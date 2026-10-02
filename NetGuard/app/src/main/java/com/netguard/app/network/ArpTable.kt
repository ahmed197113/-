package com.netguard.app.network

import java.io.File

/**
 * قراءة جدول ARP الخاص بالنظام من /proc/net/arp للربط بين IP و MAC.
 * متاح بدون صلاحيات root على أغلب أجهزة أندرويد (قد يُحجب في إصدارات حديثة جدًا،
 * ولذلك نكمّل بمسح نشِط ping-sweep قبل القراءة لملء الجدول).
 */
object ArpTable {

    data class Entry(val ip: String, val mac: String)

    private const val INVALID_MAC = "00:00:00:00:00:00"

    fun read(): Map<String, String> {
        val result = LinkedHashMap<String, String>()
        try {
            File("/proc/net/arp").bufferedReader().useLines { lines ->
                lines.drop(1).forEach { line ->
                    val cols = line.trim().split(Regex("\\s+"))
                    if (cols.size >= 4) {
                        val ip = cols[0]
                        val mac = cols[3].lowercase()
                        if (mac != INVALID_MAC && mac.matches(MAC_REGEX)) {
                            result[ip] = normalize(mac)
                        }
                    }
                }
            }
        } catch (_: Exception) { /* قد يكون محجوبًا */ }
        return result
    }

    fun normalize(mac: String): String = mac.lowercase().replace('-', ':')

    private val MAC_REGEX = Regex("^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$")
}
