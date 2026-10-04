package com.mizan.budget.domain

import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** A budget cycle, e.g. salary day 27 → 27 Sep … 26 Oct. [end] is exclusive. */
data class Period(val start: LocalDate, val end: LocalDate) {
    val totalDays: Int get() = ChronoUnit.DAYS.between(start, end).toInt()
    val startMillis: Long get() = start.toMillis()
    val endMillis: Long get() = end.toMillis()

    fun previous(cycleDay: Int): Period = forDate(start.minusDays(1), cycleDay)

    companion object {
        fun forDate(date: LocalDate, cycleDay: Int): Period {
            val thisMonthStart = date.withDayOfMonth(cycleDay.coerceAtMost(date.lengthOfMonth()))
            val start = if (date.isBefore(thisMonthStart)) {
                val prev = date.minusMonths(1)
                prev.withDayOfMonth(cycleDay.coerceAtMost(prev.lengthOfMonth()))
            } else thisMonthStart
            val nextMonth = start.plusMonths(1)
            val end = nextMonth.withDayOfMonth(cycleDay.coerceAtMost(nextMonth.lengthOfMonth()))
            return Period(start, end)
        }
    }
}

val zone: ZoneId get() = ZoneId.systemDefault()

fun LocalDate.toMillis(): Long = atStartOfDay(zone).toInstant().toEpochMilli()

fun Long.toLocalDate(): LocalDate = java.time.Instant.ofEpochMilli(this).atZone(zone).toLocalDate()
