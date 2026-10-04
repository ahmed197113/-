package com.wafr.app.domain

import com.wafr.app.data.Expense
import java.time.DayOfWeek

enum class Tone { GOOD, INFO, WARN }

data class Insight(val emoji: String, val title: String, val body: String, val tone: Tone)

/** Rule based coaching: turns raw numbers into short, actionable sentences. */
object Insights {
    private val dayNames = mapOf(
        DayOfWeek.SATURDAY to "السبت", DayOfWeek.SUNDAY to "الأحد", DayOfWeek.MONDAY to "الاثنين",
        DayOfWeek.TUESDAY to "الثلاثاء", DayOfWeek.WEDNESDAY to "الأربعاء", DayOfWeek.THURSDAY to "الخميس",
        DayOfWeek.FRIDAY to "الجمعة",
    )

    fun build(s: Snapshot, history: List<Expense>): List<Insight> {
        val out = mutableListOf<Insight>()
        if (s.expenses.isEmpty()) {
            out += Insight("🌱", "بداية نظيفة", "سجّل أول مصروف لتبدأ التحليلات الذكية بالعمل. كل مصروف يُسجَّل يجعل الصورة أوضح.", Tone.INFO)
            return out
        }

        if (s.hasBudget) {
            if (s.remaining < 0) {
                out += Insight("🚨", "تجاوزت الميزانية", "تجاوزت ميزانية الدورة بمقدار ${s.money(-s.remaining)}. ركّز على الضروريات فقط حتى ${s.period.end.dayOfMonth}/${s.period.end.monthValue}.", Tone.WARN)
            } else if (s.projected > s.budget) {
                out += Insight("📉", "انتبه للوتيرة", "بهذا المعدل ستتجاوز ميزانيتك بحوالي ${s.money(s.projected - s.budget)}. حاول ألا تتعدى ${s.money(s.dailyAllowance)} يومياً.", Tone.WARN)
            } else {
                out += Insight("🎯", "أنت على المسار الصحيح", "بهذا المعدل ستنهي الدورة وقد وفّرت حوالي ${s.money(s.budget - s.projected)}. استمر!", Tone.GOOD)
            }
        }

        if (s.spent > 0 && s.wantsShare >= 0.35f) {
            val pct = (s.wantsShare * 100).toInt()
            out += Insight("🛍️", "الكماليات $pct% من صرفك", "لو خفّضت الكماليات للنصف لوفّرت ${s.money(s.wants / 2)} هذه الدورة وحدها.", Tone.WARN)
        } else if (s.spent > 0) {
            out += Insight("🧠", "قرارات واعية", "${(100 - s.wantsShare * 100).toInt()}% من صرفك على أشياء ضرورية. هذا انضباط رائع.", Tone.GOOD)
        }

        s.byCategory.filter { it.overLimit }.forEach {
            out += Insight(it.category.emoji, "تجاوزت حد ${it.category.name}", "صرفت ${s.money(it.spent)} من أصل ${s.money(it.category.monthlyLimit)}.", Tone.WARN)
        }
        s.byCategory.filter { !it.overLimit && it.limitProgress >= 0.8f }.forEach {
            out += Insight(it.category.emoji, "اقتربت من حد ${it.category.name}", "استهلكت ${(it.limitProgress * 100).toInt()}% من الحد. المتبقي ${s.money(it.category.monthlyLimit - it.spent)}.", Tone.INFO)
        }

        s.byCategory.firstOrNull { it.spent > 0 }?.let {
            val pct = (it.spent * 100 / s.spent).toInt()
            out += Insight(it.category.emoji, "أكبر بند: ${it.category.name}", "يستحوذ على $pct% من مصروفك (${s.money(it.spent)} في ${it.count} عملية).", Tone.INFO)
        }

        val smallWants = s.expenses.filter { !it.isNeed && it.amount <= 3000 }
        if (smallWants.size >= 5) {
            out += Insight("☕", "المصاريف الصغيرة تتراكم", "${smallWants.size} مصروفات كمالية صغيرة مجموعها ${s.money(smallWants.sumOf { it.amount })}. هذا ما يُسمى «تأثير اللاتيه».", Tone.INFO)
        }

        if (s.streak >= 2) {
            out += Insight("🔥", "${s.streak} أيام بلا كماليات", "سلسلة رائعة! لا تكسرها اليوم.", Tone.GOOD)
        }

        if (s.previousSpentSameDay > 0) {
            val diff = s.spent - s.previousSpentSameDay
            val pct = (kotlin.math.abs(diff) * 100 / s.previousSpentSameDay).toInt()
            if (pct >= 5) {
                out += if (diff < 0) Insight("📊", "أفضل من الدورة السابقة", "صرفت $pct% أقل مقارنة بنفس الفترة من الدورة الماضية.", Tone.GOOD)
                else Insight("📊", "أعلى من الدورة السابقة", "صرفت $pct% أكثر مقارنة بنفس الفترة من الدورة الماضية.", Tone.WARN)
            }
        }

        val byWeekday = history.groupBy { it.timestamp.toLocalDate().dayOfWeek }.mapValues { (_, l) -> l.sumOf { it.amount } }
        if (byWeekday.size >= 4) {
            val top = byWeekday.maxBy { it.value }
            out += Insight("📅", "يوم ${dayNames[top.key]} هو الأغلى", "تميل للصرف أكثر في هذا اليوم. خطّط له مسبقاً.", Tone.INFO)
        }
        return out
    }
}
