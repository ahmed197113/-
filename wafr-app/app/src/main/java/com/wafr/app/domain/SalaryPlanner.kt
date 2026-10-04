package com.wafr.app.domain

import com.wafr.app.data.Bill
import com.wafr.app.data.Category

/** Well-known salary-split methods from personal-finance books, and how to apply them. */
object SalaryPlanner {
    enum class Kind { NEED, WANT, SAVE, INVEST, LEARN, GIVE }

    data class Bucket(val emoji: String, val name: String, val pct: Int, val kind: Kind, val tip: String)

    data class Method(val id: String, val name: String, val source: String, val idea: String, val buckets: List<Bucket>) {
        /** What you are allowed to spend in the month (everything that is not saved or invested). */
        val spendPct: Int get() = buckets.filter { it.kind == Kind.NEED || it.kind == Kind.WANT || it.kind == Kind.LEARN || it.kind == Kind.GIVE }.sumOf { it.pct }
    }

    val methods = listOf(
        Method(
            "50-30-20", "قاعدة 50/30/20", "كتاب «All Your Worth» — إليزابيث وارن",
            "الأبسط والأشهر: نصف الدخل للضروريات، وثلثه تقريباً لما تحب، وخُمسه لمستقبلك.",
            listOf(
                Bucket("🏠", "الضروريات", 50, Kind.NEED, "سكن، طعام، فواتير، مواصلات، صحة — ما لا تستطيع العيش بدونه."),
                Bucket("🛍️", "الكماليات", 30, Kind.WANT, "مطاعم، تسوق، ترفيه، اشتراكات — استمتع بلا شعور بالذنب ضمن هذا الحد."),
                Bucket("💎", "ادخار واستثمار", 20, Kind.SAVE, "صندوق طوارئ أولاً (3–6 أشهر مصاريف)، ثم استثمار طويل الأمد."),
            ),
        ),
        Method(
            "jars", "الحسابات الستة", "كتاب «أسرار عقل المليونير» — هارف إيكر",
            "قسّم كل راتب إلى ستة «أوعية» لكل منها هدف؛ يبني عادة الثراء خطوة بخطوة.",
            listOf(
                Bucket("🏠", "الضروريات", 55, Kind.NEED, "كل مصاريف الحياة الأساسية."),
                Bucket("🌳", "الحرية المالية", 10, Kind.INVEST, "«الدجاجة التي تبيض ذهباً»: لا تُصرف أبداً، تُستثمر فقط ليصبح دخلها دخلك."),
                Bucket("🛟", "ادخار طويل المدى", 10, Kind.SAVE, "للمشتريات الكبيرة: سيارة، زواج، طوارئ."),
                Bucket("🎓", "التعلّم", 10, Kind.LEARN, "كتب، دورات، مهارات — أعلى استثمار عائداً."),
                Bucket("🎉", "المتعة", 10, Kind.WANT, "يجب أن تُصرف كل شهر! تكافئ نفسك فتستمر على الخطة."),
                Bucket("🤲", "العطاء", 5, Kind.GIVE, "صدقة وهدايا ومساعدة الآخرين."),
            ),
        ),
        Method(
            "pay-first", "ادفع لنفسك أولاً", "«أغنى رجل في بابل» و«الأب الغني والأب الفقير»",
            "أول من يُدفع له من راتبك هو أنت: اقتطع للاستثمار فور استلام الراتب، وعِش بالباقي.",
            listOf(
                Bucket("🌳", "أصول تُدرّ دخلاً", 15, Kind.INVEST, "اشترِ أصولاً تضع المال في جيبك: أسهم توزيعات، عقار، مشروع."),
                Bucket("🛟", "صندوق الطوارئ", 10, Kind.SAVE, "يحميك من الديون عند المفاجآت."),
                Bucket("🏠", "الضروريات", 55, Kind.NEED, "عِش بأقل مما تكسب."),
                Bucket("🛍️", "الكماليات", 20, Kind.WANT, "الأغنياء يشترون الكماليات من دخل أصولهم لا من راتبهم."),
            ),
        ),
        Method(
            "70-20-10", "قاعدة 70/20/10", "منهج شائع في التخطيط المالي الشخصي",
            "مناسبة لمن مصاريفه الأساسية مرتفعة: 70% للمعيشة كاملة، 20% ادخار، 10% عطاء أو سداد ديون.",
            listOf(
                Bucket("🏠", "الضروريات", 50, Kind.NEED, "الجزء الأساسي من الـ70%."),
                Bucket("🛍️", "الكماليات", 20, Kind.WANT, "بقية الـ70% لنمط حياتك."),
                Bucket("💎", "ادخار واستثمار", 20, Kind.SAVE, "ابنِ ثروتك بثبات."),
                Bucket("🤲", "عطاء / سداد ديون", 10, Kind.GIVE, "إن كان عليك دين استهلاكي فابدأ به أولاً."),
            ),
        ),
    )

    data class Line(val bucket: Bucket, val amount: Long)

    data class Plan(
        val method: Method,
        val salary: Long,
        val lines: List<Line>,
        val bills: Long,
        val spendBudget: Long,
        val advice: List<String>,
    ) {
        val needs: Long get() = lines.filter { it.bucket.kind == Kind.NEED }.sumOf { it.amount }
        val saveTotal: Long get() = lines.filter { it.bucket.kind == Kind.SAVE || it.bucket.kind == Kind.INVEST }.sumOf { it.amount }
    }

    fun plan(method: Method, salary: Long, bills: List<Bill>, currency: String): Plan {
        val lines = method.buckets.map { Line(it, salary * it.pct / 100) }
        val billsTotal = bills.sumOf { it.amount }
        val needs = lines.filter { it.bucket.kind == Kind.NEED }.sumOf { it.amount }
        val save = lines.filter { it.bucket.kind == Kind.SAVE || it.bucket.kind == Kind.INVEST }.sumOf { it.amount }
        val advice = mutableListOf<String>()
        if (salary > 0) {
            if (billsTotal > needs) {
                advice += "⚠️ التزاماتك الثابتة (${Money.format(billsTotal, currency)}) أكبر من حصة الضروريات. راجع أكبر التزام: هل يمكن تخفيضه أو استبداله؟"
            } else if (billsTotal > 0) {
                advice += "✅ التزاماتك الثابتة تأخذ ${billsTotal * 100 / needs.coerceAtLeast(1)}% من حصة الضروريات، والباقي ${Money.format(needs - billsTotal, currency)} للطعام والمواصلات وغيرها."
            } else {
                advice += "💡 أضف التزاماتك الثابتة (إيجار، إنترنت، أقساط) من «الخطة» ليحجزها التطبيق تلقائياً من ميزانيتك."
            }
            advice += "🛟 هدف صندوق الطوارئ المناسب لك: ${Money.format(needs * 3, currency)} إلى ${Money.format(needs * 6, currency)} (3–6 أشهر ضروريات)."
            if (save > 0) {
                val year = save * 12
                advice += "📈 بادخار ${Money.format(save, currency)} شهرياً تجمع ${Money.format(year, currency)} في سنة، وأكثر من ${Money.format(year * 5, currency)} في 5 سنوات قبل أي عائد استثمار."
            }
            advice += "🔁 حوّل حصة الادخار تلقائياً يوم نزول الراتب — ما لا تراه لا تصرفه."
        }
        return Plan(method, salary, lines, billsTotal, salary * method.spendPct / 100, advice)
    }

    private val needWeights = mapOf(
        "فواتير وسكن" to 40, "طعام وبقالة" to 30, "مواصلات ووقود" to 15, "صحة" to 8, "تعليم" to 7, "عائلة وهدايا" to 0,
    )
    private val wantWeights = mapOf("مطاعم وقهوة" to 40, "تسوق وملابس" to 30, "ترفيه" to 30)

    /** Spreads the need and want buckets over categories as monthly limits. */
    fun categoryLimits(plan: Plan, categories: List<Category>): Map<Long, Long> {
        val needPool = plan.lines.filter { it.bucket.kind == Kind.NEED }.sumOf { it.amount }
        val wantPool = plan.lines.filter { it.bucket.kind == Kind.WANT }.sumOf { it.amount }
        val learnPool = plan.lines.filter { it.bucket.kind == Kind.LEARN }.sumOf { it.amount }
        val givePool = plan.lines.filter { it.bucket.kind == Kind.GIVE }.sumOf { it.amount }
        val out = mutableMapOf<Long, Long>()
        val needCats = categories.filter { it.name in needWeights && needWeights[it.name]!! > 0 }
        val needSum = needCats.sumOf { needWeights[it.name]!! }.coerceAtLeast(1)
        needCats.forEach { out[it.id] = needPool * needWeights[it.name]!! / needSum }
        val wantCats = categories.filter { it.name in wantWeights }
        val wantSum = wantCats.sumOf { wantWeights[it.name]!! }.coerceAtLeast(1)
        wantCats.forEach { out[it.id] = wantPool * wantWeights[it.name]!! / wantSum }
        categories.firstOrNull { it.name == "تعليم" }?.let { if (learnPool > 0) out[it.id] = learnPool }
        categories.firstOrNull { it.name == "عائلة وهدايا" }?.let { if (givePool > 0) out[it.id] = givePool }
        return out
    }
}
