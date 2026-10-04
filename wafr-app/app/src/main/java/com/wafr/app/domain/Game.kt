package com.wafr.app.domain

import org.json.JSONArray
import org.json.JSONObject
import kotlin.random.Random

/**
 * "سباق الحرية": a tiny turn-based game inspired by the ideas popularised in
 * *Rich Dad Poor Dad*. Each turn is one month. Assets add passive income, liabilities add
 * monthly expenses, and you win when passive income covers your expenses.
 */
object Game {
    enum class Kind { DEAL, DOODAD, EVENT, LEARN, SELL }

    data class Card(
        val kind: Kind,
        val emoji: String,
        val title: String,
        val body: String,
        val cost: Int = 0,
        val income: Int = 0,
        val expense: Int = 0,
        val cash: Int = 0,
        val salary: Int = 0,
        val lesson: String,
    )

    data class Item(val name: String, val emoji: String, val amount: Int, val cost: Int = 0)

    data class Job(val title: String, val emoji: String, val salary: Int, val expenses: Int, val cash: Int)

    val jobs = listOf(
        Job("موظف", "💼", 8000, 6200, 3000),
        Job("معلّم", "📚", 6500, 4900, 2500),
        Job("مهندس", "🛠️", 12000, 9800, 4000),
    )

    data class State(
        val job: Int = -1,
        val month: Int = 0,
        val cash: Int = 0,
        val salary: Int = 0,
        val baseExpenses: Int = 0,
        val assets: List<Item> = emptyList(),
        val liabilities: List<Item> = emptyList(),
        val card: Int = -1,
        val message: String = "",
        val won: Boolean = false,
    ) {
        val passive: Int get() = assets.sumOf { it.amount }
        val expenses: Int get() = baseExpenses + liabilities.sumOf { it.amount }
        val cashflow: Int get() = salary + passive - expenses
        val freedom: Float get() = if (expenses > 0) passive.toFloat() / expenses else 0f
        val started: Boolean get() = job >= 0
        val currentCard: Card? get() = cards.getOrNull(card)
    }

    val lessons = listOf(
        "🧱" to "الأصل يضع المال في جيبك، والالتزام يُخرجه منه. قبل أي شراء اسأل: في أي عمود سيقع؟",
        "💰" to "ادفع لنفسك أولاً: اقتطع جزءاً للادخار والاستثمار فور استلام الراتب، ثم اصرف الباقي.",
        "🔁" to "الراتب يحرّكك في دائرة؛ الدخل السلبي هو ما يخرجك منها.",
        "🛍️" to "ابنِ أصولك أولاً، ثم دَع دخلها يدفع ثمن الكماليات — لا العكس.",
        "🎓" to "المعرفة المالية أعلى استثمار عائداً: تعلّم قبل أن تكسب.",
        "💳" to "الدَّين الاستهلاكي يجعل مستقبلك يدفع ثمن متعة اليوم.",
        "📈" to "زيادة الدخل مع زيادة المصاريف تُبقيك في نفس المكان. ارفع دخلك وثبّت مصاريفك.",
        "🧠" to "لا تدع الخوف يُضيّع الفرص، ولا الطمع يدفعك لمخاطرة لا تفهمها.",
    )

    val cards = listOf(
        Card(Kind.DEAL, "🏪", "متجر إلكتروني صغير", "متجر قائم يحقق أرباحاً شهرية ثابتة.", cost = 3000, income = 250, lesson = lessons[0].second),
        Card(Kind.DEAL, "📊", "أسهم توزيعات", "أسهم شركة مستقرة توزّع أرباحاً كل شهر.", cost = 5000, income = 320, lesson = lessons[2].second),
        Card(Kind.DEAL, "🏢", "شقة للإيجار", "شقة صغيرة مؤجّرة بعقد سنوي.", cost = 20000, income = 1300, lesson = lessons[0].second),
        Card(Kind.DEAL, "🥤", "آلة بيع ذاتي", "آلة في مكان مزدحم تعمل وأنت نائم.", cost = 2500, income = 190, lesson = lessons[2].second),
        Card(Kind.DEAL, "📱", "تطبيق صغير", "تطبيق باشتراكات شهرية يحتاج صيانة بسيطة.", cost = 8000, income = 620, lesson = lessons[3].second),
        Card(Kind.DEAL, "🚗", "حصة في مغسلة سيارات", "شراكة صامتة بعائد شهري.", cost = 12000, income = 850, lesson = lessons[0].second),
        Card(Kind.DEAL, "✍️", "كتاب إلكتروني تؤلفه", "تتعب عليه مرة، ويبيع كل شهر.", cost = 1000, income = 95, lesson = lessons[2].second),
        Card(Kind.DEAL, "🌾", "أرض مؤجّرة", "أرض زراعية بإيجار ثابت.", cost = 15000, income = 980, lesson = lessons[0].second),
        Card(Kind.DOODAD, "🏎️", "سيارة فارهة بالتقسيط", "قسط شهري جديد لسيارة لا تُدرّ دخلاً.", expense = 900, lesson = lessons[5].second),
        Card(Kind.DOODAD, "📲", "هاتف أحدث بالتقسيط", "هاتفك يعمل جيداً… لكن الجديد يلمع.", expense = 250, lesson = lessons[3].second),
        Card(Kind.DOODAD, "🛋️", "أثاث فاخر بالتقسيط", "قسط شهري لتجديد الصالة.", expense = 180, lesson = lessons[5].second),
        Card(Kind.DOODAD, "🏝️", "إجازة على البطاقة الائتمانية", "متعة أسبوع… وقسط لأشهر.", expense = 320, lesson = lessons[5].second),
        Card(Kind.EVENT, "🔧", "عطل مفاجئ في السيارة", "مصروف طارئ لا مفرّ منه.", cash = -1500, lesson = lessons[1].second),
        Card(Kind.EVENT, "🎉", "مكافأة عمل", "مديرك راضٍ عن أدائك!", cash = 2000, lesson = lessons[1].second),
        Card(Kind.EVENT, "🏥", "فاتورة طبية", "صندوق الطوارئ يُثبت قيمته الآن.", cash = -1000, lesson = lessons[1].second),
        Card(Kind.LEARN, "🎓", "دورة احترافية", "استثمر في مهاراتك ليرتفع راتبك.", cost = 1500, salary = 600, lesson = lessons[4].second),
        Card(Kind.LEARN, "📖", "ورشة معرفة مالية", "تعلّم قراءة الفرص وتقييمها.", cost = 600, salary = 250, lesson = lessons[4].second),
        Card(Kind.SELL, "🤝", "مشترٍ مهتم", "مستثمر يعرض شراء أحد أصولك بضعف ثمنه.", lesson = lessons[7].second),
        Card(Kind.EVENT, "💸", "عرض ترقية مع مصاريف", "راتب أعلى… ونمط حياة أغلى.", salary = 1000, cash = 0, expense = 900, lesson = lessons[6].second),
    )

    fun start(jobIndex: Int): State {
        val j = jobs[jobIndex]
        return State(job = jobIndex, cash = j.cash, salary = j.salary, baseExpenses = j.expenses, message = "ابدأ رحلتك: هدفك أن يغطي دخلك السلبي مصاريفك.")
    }

    /** Pays the month and draws a new card. */
    fun nextMonth(s: State, rnd: Random = Random.Default): State {
        if (s.won) return s
        var cash = s.cash + s.cashflow
        var liabilities = s.liabilities
        var msg = "استلمت صافي الشهر: ${sign(s.cashflow)}"
        if (cash < 0) {
            cash += 5000
            liabilities = liabilities + Item("قرض بنكي", "🏦", 550)
            msg = "رصيدك نفد، فاضطررت لقرض بنكي (+550 قسط شهري). المصاريف أكبر من دخلك!"
        }
        var idx = rnd.nextInt(cards.size)
        if (cards[idx].kind == Kind.SELL && s.assets.isEmpty()) idx = rnd.nextInt(8)
        return s.copy(month = s.month + 1, cash = cash, liabilities = liabilities, card = idx, message = msg)
    }

    /** Applies the player's choice on the current card. */
    fun choose(s: State, accept: Boolean): State {
        val c = s.currentCard ?: return s
        var n = s.copy(card = -1)
        n = when (c.kind) {
            Kind.DEAL -> if (accept) {
                if (s.cash < c.cost) n.copy(message = "رصيدك لا يكفي. ادّخر أكثر لتقتنص الفرصة القادمة!")
                else n.copy(cash = s.cash - c.cost, assets = s.assets + Item(c.title, c.emoji, c.income, c.cost), message = "أضفت أصلاً جديداً: +${c.income} دخل سلبي شهرياً ✅")
            } else n.copy(message = "تجاوزت الفرصة.")
            Kind.DOODAD -> if (accept) n.copy(liabilities = s.liabilities + Item(c.title, c.emoji, c.expense), message = "التزام جديد: +${c.expense} مصروف شهري 📉")
            else n.copy(message = "أحسنت! قلت «لا» لالتزام جديد 💪")
            Kind.EVENT -> n.copy(
                cash = s.cash + c.cash, salary = s.salary + c.salary,
                liabilities = if (c.expense > 0) s.liabilities + Item("نمط حياة أغلى", "🍽️", c.expense) else s.liabilities,
                message = if (c.cash >= 0 && c.salary == 0) "حصلت على ${sign(c.cash)}" else if (c.salary > 0) "راتبك +${c.salary} لكن مصاريفك +${c.expense}" else "دفعت ${-c.cash}",
            )
            Kind.LEARN -> if (accept) {
                if (s.cash < c.cost) n.copy(message = "رصيدك لا يكفي للدورة الآن.")
                else n.copy(cash = s.cash - c.cost, salary = s.salary + c.salary, message = "استثمرت في نفسك: راتبك +${c.salary} 🎓")
            } else n.copy(message = "أجّلت التعلّم.")
            Kind.SELL -> if (accept && s.assets.isNotEmpty()) {
                val a = s.assets.maxBy { it.cost }
                n.copy(cash = s.cash + a.cost * 2, assets = s.assets - a, message = "بعت «${a.name}» بـ ${a.cost * 2} 💰 — استثمر الربح في أصل جديد!")
            } else n.copy(message = "احتفظت بأصولك.")
        }
        return if (n.passive >= n.expenses && n.passive > 0) n.copy(won = true, message = "🎉 خرجت من سباق الفئران! دخلك السلبي يغطي مصاريفك.") else n
    }

    private fun sign(v: Int) = if (v >= 0) "+$v" else "$v"

    fun encode(s: State): String = JSONObject().apply {
        put("job", s.job); put("month", s.month); put("cash", s.cash); put("salary", s.salary)
        put("base", s.baseExpenses); put("card", s.card); put("msg", s.message); put("won", s.won)
        put("assets", items(s.assets)); put("liab", items(s.liabilities))
    }.toString()

    fun decode(text: String): State = runCatching {
        val o = JSONObject(text)
        State(
            job = o.getInt("job"), month = o.getInt("month"), cash = o.getInt("cash"), salary = o.getInt("salary"),
            baseExpenses = o.getInt("base"), card = o.optInt("card", -1), message = o.optString("msg"), won = o.optBoolean("won"),
            assets = parse(o.optJSONArray("assets")), liabilities = parse(o.optJSONArray("liab")),
        )
    }.getOrDefault(State())

    private fun items(list: List<Item>) = JSONArray().apply {
        list.forEach { put(JSONObject().apply { put("n", it.name); put("e", it.emoji); put("a", it.amount); put("c", it.cost) }) }
    }

    private fun parse(arr: JSONArray?): List<Item> =
        if (arr == null) emptyList() else (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            Item(o.getString("n"), o.getString("e"), o.getInt("a"), o.optInt("c"))
        }
}
