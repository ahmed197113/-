package com.netguard.app.util

import java.util.Calendar

object UsageEstimator {

    /** بداية الشهر الحالي بالمللي ثانية. */
    fun startOfMonth(): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.DAY_OF_MONTH, 1)
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    /** تحويل دقائق الحضور إلى نص مقروء (مثل: 3 يوم 5 س). */
    fun formatPresence(minutes: Int): String {
        val d = minutes / (60 * 24)
        val h = (minutes % (60 * 24)) / 60
        val m = minutes % 60
        return buildString {
            if (d > 0) append("$d يوم ")
            if (h > 0) append("$h س ")
            append("$m د")
        }.trim()
    }

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "—"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        var v = bytes.toDouble(); var i = 0
        while (v >= 1024 && i < units.size - 1) { v /= 1024; i++ }
        return String.format("%.1f %s", v, units[i])
    }
}
