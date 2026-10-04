package com.mizan.budget.domain

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

object Money {
    private val symbols = DecimalFormatSymbols(Locale.US)
    private val whole = DecimalFormat("#,##0", symbols)
    private val fraction = DecimalFormat("#,##0.00", symbols)

    /** Formats minor units: 125050 -> "1,250.50". Whole amounts drop the decimals. */
    fun plain(minor: Long): String {
        val value = minor / 100.0
        return if (minor % 100 == 0L) whole.format(value) else fraction.format(value)
    }

    fun format(minor: Long, currency: String): String = "${plain(minor)} $currency"

    /** Compact form for widgets and tiles: 12,500 -> "12.5K". */
    fun compact(minor: Long, currency: String): String {
        val v = abs(minor) / 100.0
        val sign = if (minor < 0) "-" else ""
        val s = when {
            v >= 1_000_000 -> DecimalFormat("0.#", symbols).format(v / 1_000_000) + "M"
            v >= 10_000 -> DecimalFormat("0.#", symbols).format(v / 1_000) + "K"
            else -> whole.format(v)
        }
        return "$sign$s $currency"
    }

    fun toMinor(value: Double): Long = (value * 100).roundToLong()

    /** Converts Arabic-Indic / Persian digits and separators to ASCII so they can be parsed. */
    fun normalizeDigits(text: String): String = buildString {
        for (c in text) {
            append(
                when (c) {
                    in '٠'..'٩' -> '0' + (c - '٠')
                    in '۰'..'۹' -> '0' + (c - '۰')
                    '٫' -> '.'
                    '٬', '،' -> ','
                    else -> c
                }
            )
        }
    }

    /**
     * Parses free text like "25 قهوة", "قهوة ٢٥٫٥" or "1,200 ايجار" into an amount
     * (minor units) and the remaining note. Returns null when no number is present.
     */
    fun parseEntry(raw: String): Pair<Long, String>? {
        val text = normalizeDigits(raw).trim()
        val match = Regex("""\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?""").find(text) ?: return null
        val number = match.value.replace(",", "").toDoubleOrNull() ?: return null
        if (number <= 0) return null
        val note = (text.removeRange(match.range)).replace(Regex("\\s+"), " ").trim()
        return toMinor(number) to note
    }
}
