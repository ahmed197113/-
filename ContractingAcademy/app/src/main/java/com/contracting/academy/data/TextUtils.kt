package com.contracting.academy.data

import java.util.Locale

/** توحيد النص العربي للبحث: إزالة التشكيل وتوحيد الهمزات والتاء المربوطة والألف المقصورة. */
fun normalizeArabic(s: String): String {
    val sb = StringBuilder(s.length)
    for (c in s.lowercase(Locale.ROOT)) {
        when (c) {
            in 'ً'..'ْ', 'ـ' -> Unit // تشكيل وتطويل
            'أ', 'إ', 'آ', 'ٱ' -> sb.append('ا')
            'ة' -> sb.append('ه')
            'ى' -> sb.append('ي')
            'ؤ' -> sb.append('و')
            'ئ' -> sb.append('ي')
            in '٠'..'٩' -> sb.append('0' + (c - '٠'))
            else -> sb.append(c)
        }
    }
    return sb.toString()
}

/** يحوّل نص إدخال المستخدم إلى رقم مع دعم الأرقام العربية والفواصل. */
fun parseAmount(s: String): Double? {
    val cleaned = buildString {
        for (c in s) {
            when (c) {
                in '٠'..'٩' -> append('0' + (c - '٠'))
                '٫' -> append('.')
                ',', '٬', ' ' -> Unit
                else -> append(c)
            }
        }
    }
    return cleaned.toDoubleOrNull()
}

fun money(v: Double): String = String.format(Locale.US, "%,.2f", v)

fun percent(v: Double): String = String.format(Locale.US, "%.2f%%", v * 100)
