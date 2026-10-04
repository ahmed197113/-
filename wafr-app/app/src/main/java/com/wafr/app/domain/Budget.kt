package com.wafr.app.domain

import com.wafr.app.data.Bill
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.data.Settings
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.roundToLong

data class CategorySpend(val category: Category, val spent: Long, val count: Int) {
    val overLimit: Boolean get() = category.monthlyLimit > 0 && spent > category.monthlyLimit
    val limitProgress: Float
        get() = if (category.monthlyLimit > 0) spent.toFloat() / category.monthlyLimit else 0f
}

/** Everything the UI, widget, tile and notifications need to know about the current cycle. */
data class Snapshot(
    val period: Period,
    val today: LocalDate,
    val currency: String,
    val budget: Long,
    val spent: Long,
    val needs: Long,
    val wants: Long,
    val spentToday: Long,
    val wantsToday: Long,
    val countToday: Int,
    val daysLeft: Int,
    val daysElapsed: Int,
    /** What can still be spent today without breaking the cycle budget. */
    val safeToday: Long,
    /** The even daily allowance computed at the start of today. */
    val dailyAllowance: Long,
    val projected: Long,
    val byCategory: List<CategorySpend>,
    /** Totals per day of the cycle, index 0 = period start. */
    val daily: List<Long>,
    val dailyWants: List<Long>,
    val streak: Int,
    val score: Int,
    val previousSpentSameDay: Long,
    val expenses: List<Expense>,
    /** Bills not yet paid this cycle; their total is held back from the daily allowance. */
    val unpaidBills: List<Bill> = emptyList(),
) {
    val reservedBills: Long get() = unpaidBills.sumOf { it.amount }
    val freeRemaining: Long get() = remaining - reservedBills
    val remaining: Long get() = budget - spent
    val hasBudget: Boolean get() = budget > 0
    val usedFraction: Float get() = if (budget > 0) spent.toFloat() / budget else 0f
    val elapsedFraction: Float get() = daysElapsed.toFloat() / period.totalDays
    val wantsShare: Float get() = if (spent > 0) wants.toFloat() / spent else 0f
    val overPace: Boolean get() = hasBudget && usedFraction > elapsedFraction + 0.05f

    val scoreLabel: String
        get() = when {
            score >= 85 -> "ممتاز 🏆"
            score >= 70 -> "جيد جداً 👌"
            score >= 50 -> "مقبول 🙂"
            else -> "يحتاج انتباه ⚠️"
        }

    fun money(v: Long) = Money.format(v, currency)

    companion object {
        fun compute(
            settings: Settings,
            categories: List<Category>,
            history: List<Expense>,
            bills: List<Bill> = emptyList(),
            today: LocalDate = LocalDate.now(),
        ): Snapshot {
            val period = Period.forDate(today, settings.cycleStartDay)
            val inPeriod = history.filter { it.timestamp >= period.startMillis && it.timestamp < period.endMillis }
            val todayStart = today.toMillis()
            val todayEnd = today.plusDays(1).toMillis()
            val todays = inPeriod.filter { it.timestamp in todayStart until todayEnd }

            val spent = inPeriod.sumOf { it.amount }
            val needs = inPeriod.filter { it.isNeed }.sumOf { it.amount }
            val spentToday = todays.sumOf { it.amount }
            val daysElapsed = ChronoUnit.DAYS.between(period.start, today).toInt() + 1
            val daysLeft = max(1, period.totalDays - daysElapsed + 1)

            val budget = settings.monthlyBudget
            val spentBeforeToday = spent - spentToday
            val unpaid = bills.filter { it.paidCycleStart != period.startMillis }
            val reserved = unpaid.sumOf { it.amount }
            val dailyAllowance = if (budget > 0) max(0L, (budget - spentBeforeToday - reserved) / daysLeft) else 0L
            val safeToday = dailyAllowance - spentToday
            val projected = if (daysElapsed > 0) (spent.toDouble() / daysElapsed * period.totalDays).roundToLong() else spent

            val byId = categories.associateBy { it.id }
            val byCategory = inPeriod.groupBy { it.categoryId }
                .mapNotNull { (id, list) -> byId[id]?.let { CategorySpend(it, list.sumOf { e -> e.amount }, list.size) } }
                .sortedByDescending { it.spent }
            // Categories with a limit but no spending still show up in the plan view.
            val withLimits = byCategory + categories
                .filter { it.monthlyLimit > 0 && byCategory.none { cs -> cs.category.id == it.id } }
                .map { CategorySpend(it, 0, 0) }

            val daily = MutableList(period.totalDays) { 0L }
            val dailyWants = MutableList(period.totalDays) { 0L }
            for (e in inPeriod) {
                val idx = ChronoUnit.DAYS.between(period.start, e.timestamp.toLocalDate()).toInt()
                if (idx in daily.indices) {
                    daily[idx] += e.amount
                    if (!e.isNeed) dailyWants[idx] += e.amount
                }
            }

            val streak = wantsFreeStreak(history, today, settings.firstUse)
            val prev = period.previous(settings.cycleStartDay)
            val prevCutoff = prev.start.plusDays(daysElapsed.toLong()).toMillis()
            val previousSpentSameDay = history
                .filter { it.timestamp >= prev.startMillis && it.timestamp < min(prevCutoff, prev.endMillis) }
                .sumOf { it.amount }

            val draft = Snapshot(
                period = period, today = today, currency = settings.currency, budget = budget,
                spent = spent, needs = needs, wants = spent - needs, spentToday = spentToday,
                wantsToday = todays.filter { !it.isNeed }.sumOf { it.amount }, countToday = todays.size,
                daysLeft = daysLeft, daysElapsed = daysElapsed, safeToday = safeToday,
                dailyAllowance = dailyAllowance, projected = projected, byCategory = withLimits,
                daily = daily, dailyWants = dailyWants, streak = streak, score = 0,
                previousSpentSameDay = previousSpentSameDay, expenses = inPeriod, unpaidBills = unpaid,
            )
            return draft.copy(score = score(draft))
        }

        /** Consecutive days (ending today, or yesterday if today already has a "want") with no wants. */
        private fun wantsFreeStreak(history: List<Expense>, today: LocalDate, firstUse: Long): Int {
            val wantDays = history.filter { !it.isNeed }.map { it.timestamp.toLocalDate() }.toSet()
            val firstDay = if (firstUse > 0) firstUse.toLocalDate() else today
            var day = if (today in wantDays) today.minusDays(1) else today
            var count = 0
            while (!day.isBefore(firstDay) && day !in wantDays && count < 365) {
                count++
                day = day.minusDays(1)
            }
            return count
        }

        private fun score(s: Snapshot): Int {
            val pace = if (s.hasBudget) {
                val ratio = if (s.elapsedFraction > 0) s.usedFraction / s.elapsedFraction else 0f
                if (ratio <= 1f) 50f else 50f * max(0f, 1f - (ratio - 1f))
            } else 35f
            val wantsPart = 30f * (1f - ((s.wantsShare - 0.2f) / 0.5f).coerceIn(0f, 1f))
            val streakPart = min(s.streak, 10) * 2f
            return (pace + wantsPart + streakPart).roundToInt().coerceIn(0, 100)
        }
    }
}
