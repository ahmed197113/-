package com.wafr.app.domain

import com.wafr.app.data.Expense
import com.wafr.app.data.Goal
import com.wafr.app.data.WishItem

data class Achievement(val emoji: String, val title: String, val description: String, val unlocked: Boolean)

object Achievements {
    fun build(s: Snapshot, all: List<Expense>, goals: List<Goal>, wishes: List<WishItem>, checkIns: Int, gameBest: Int): List<Achievement> {
        val skipped = wishes.count { it.status == WishItem.Status.SKIPPED }
        return listOf(
            Achievement("🌱", "البداية", "سجّل أول مصروف", all.isNotEmpty()),
            Achievement("🔥", "3 أيام انضباط", "3 أيام متتالية بلا كماليات", s.streak >= 3),
            Achievement("⚡", "أسبوع حديدي", "7 أيام متتالية بلا كماليات", s.streak >= 7),
            Achievement("💭", "صادق مع نفسك", "أجب على 10 تذكيرات", checkIns >= 10),
            Achievement("🧊", "عقل بارد", "استغنِ عن 3 رغبات بعد فترة التفكير", skipped >= 3),
            Achievement("🎯", "صاحب هدف", "أنشئ هدف ادخار", goals.isNotEmpty()),
            Achievement("🏆", "هدف محقق", "أكمل هدف ادخار", goals.any { it.target > 0 && it.saved >= it.target }),
            Achievement("🧠", "قرارات واعية", "اجعل الكماليات أقل من 20% من صرفك", s.spent > 0 && s.wantsShare < 0.2f),
            Achievement("📊", "مئة عملية", "سجّل 100 مصروف", all.size >= 100),
            Achievement("🚀", "حرية مالية", "اربح لعبة سباق الحرية", gameBest > 0),
        )
    }
}

data class Suggestion(val note: String, val amount: Long, val categoryId: Long, val isNeed: Boolean)

object Suggestions {
    /** The most repeated (note, amount) pairs: one tap re-logs your usual coffee. */
    fun frequent(all: List<Expense>, limit: Int = 4): List<Suggestion> {
        val since = System.currentTimeMillis() - 60L * 24 * 3_600_000
        return all.asSequence()
            .filter { it.timestamp >= since && it.note.isNotBlank() }
            .groupBy { it.note.trim() to it.amount }
            .filter { it.value.size >= 2 }
            .entries.sortedByDescending { it.value.size }
            .take(limit)
            .map { (k, v) -> Suggestion(k.first, k.second, v.first().categoryId, v.first().isNeed) }
    }
}
