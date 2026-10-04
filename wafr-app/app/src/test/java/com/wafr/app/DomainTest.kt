package com.wafr.app

import com.wafr.app.data.Bill
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.data.Settings
import com.wafr.app.domain.Game
import com.wafr.app.domain.Money
import com.wafr.app.domain.Period
import com.wafr.app.domain.SalaryPlanner
import com.wafr.app.domain.Snapshot
import com.wafr.app.domain.TimeMachine
import com.wafr.app.domain.toMillis
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class DomainTest {
    @Test fun parsesWesternAndArabicDigits() {
        assertEquals(2500L to "قهوة", Money.parseEntry("25 قهوة"))
        assertEquals(2550L to "قهوة", Money.parseEntry("قهوة ٢٥٫٥"))
        assertEquals(120000L to "ايجار", Money.parseEntry("1,200 ايجار"))
        assertNull(Money.parseEntry("بدون رقم"))
        assertNull(Money.parseEntry("0"))
    }

    @Test fun formatsMoney() {
        assertEquals("1,250.50", Money.plain(125050))
        assertEquals("1,250", Money.plain(125000))
    }

    @Test fun periodFollowsSalaryDay() {
        val p = Period.forDate(LocalDate.of(2026, 10, 4), 27)
        assertEquals(LocalDate.of(2026, 9, 27), p.start)
        assertEquals(LocalDate.of(2026, 10, 27), p.end)
        val feb = Period.forDate(LocalDate.of(2026, 2, 28), 31)
        assertEquals(LocalDate.of(2026, 2, 28), feb.start)
    }

    private val food = Category(id = 1, name = "طعام", emoji = "🛒", color = 0, monthlyLimit = 10000)
    private val fun_ = Category(id = 2, name = "ترفيه", emoji = "🎮", color = 0, defaultNeed = false)

    @Test fun snapshotComputesAllowanceAndSplit() {
        val today = LocalDate.of(2026, 10, 11)
        val s = Settings(monthlyBudget = 310000, cycleStartDay = 1)
        val ex = listOf(
            Expense(amount = 50000, categoryId = 1, isNeed = true, timestamp = LocalDate.of(2026, 10, 2).toMillis()),
            Expense(amount = 20000, categoryId = 2, isNeed = false, timestamp = LocalDate.of(2026, 10, 5).toMillis()),
            Expense(amount = 3000, categoryId = 2, isNeed = false, timestamp = today.toMillis() + 3_600_000),
        )
        val snap = Snapshot.compute(s, listOf(food, fun_), ex, emptyList(), today)
        assertEquals(73000L, snap.spent)
        assertEquals(50000L, snap.needs)
        assertEquals(23000L, snap.wants)
        assertEquals(21, snap.daysLeft)
        // (310000 - 70000) / 21 = 11428, minus today's 3000
        assertEquals(11428L, snap.dailyAllowance)
        assertEquals(8428L, snap.safeToday)
        assertTrue(snap.byCategory.first { it.category.id == 1L }.overLimit)
    }

    @Test fun unpaidBillsAreReserved() {
        val today = LocalDate.of(2026, 10, 1)
        val s = Settings(monthlyBudget = 310000, cycleStartDay = 1)
        val bill = Bill(id = 1, name = "إيجار", emoji = "🏠", amount = 155000, dayOfMonth = 27, categoryId = 1)
        val snap = Snapshot.compute(s, listOf(food), emptyList(), listOf(bill), today)
        assertEquals(155000L, snap.reservedBills)
        assertEquals(5000L, snap.dailyAllowance)
    }

    @Test fun plannerSplitsSalary() {
        val m = SalaryPlanner.methods.first { it.id == "50-30-20" }
        val plan = SalaryPlanner.plan(m, 1000000, emptyList(), "ر.س")
        assertEquals(800000L, plan.spendBudget)
        assertEquals(200000L, plan.saveTotal)
        SalaryPlanner.methods.forEach { assertEquals(100, it.buckets.sumOf { b -> b.pct }) }
    }

    @Test fun freedomGameCanBeWonAndRoundTrips() {
        var s = Game.start(0)
        s = s.copy(cash = 1_000_000, card = Game.cards.indexOfFirst { it.title == "شقة للإيجار" })
        repeat(6) {
            s = Game.choose(s.copy(card = Game.cards.indexOfFirst { it.title == "شقة للإيجار" }), true)
        }
        assertTrue(s.won)
        val back = Game.decode(Game.encode(s))
        assertEquals(s.assets.size, back.assets.size)
        assertEquals(s.cash, back.cash)
    }

    @Test fun timeMachineCompounds() {
        val flat = TimeMachine.series(1000.0, 10, 0.0).last()
        assertEquals(120000.0, flat.second, 0.01)
        val grow = TimeMachine.series(1000.0, 10, 0.07).last()
        assertTrue(grow.second > 170000)
        assertTrue((TimeMachine.yearsTo(1_000_000.0, 1000.0, 0.07) ?: 99) in 25..40)
    }
}
