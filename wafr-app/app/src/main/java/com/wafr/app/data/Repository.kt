package com.wafr.app.data

import android.content.Context
import com.wafr.app.domain.CategoryDetector
import com.wafr.app.domain.Money
import com.wafr.app.domain.Snapshot
import com.wafr.app.domain.toMillis
import com.wafr.app.notify.Notifications
import com.wafr.app.notify.Refresher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

class Repository(private val context: Context) {
    private val db = AppDatabase.get(context)
    val settingsStore = SettingsStore(context)

    val settings: Flow<Settings> = settingsStore.flow
    val categories: Flow<List<Category>> = db.categories().active()
    val expenses: Flow<List<Expense>> = db.expenses().all()
    val goals: Flow<List<Goal>> = db.goals().all()
    val wishes: Flow<List<WishItem>> = db.wishes().all()
    val bills: Flow<List<Bill>> = db.bills().all()
    val checkInCount: Flow<Int> = db.checkIns().count()

    val snapshot: Flow<Snapshot> = combine(settings, categories, expenses, bills) { s, c, e, b ->
        Snapshot.compute(s, c, e, b)
    }

    suspend fun snapshotOnce(): Snapshot = Snapshot.compute(
        settingsStore.current(), categoriesOnce(), db.expenses().allOnce(), db.bills().allOnce(),
    )

    suspend fun categoriesOnce(): List<Category> = db.categories().allOnce().filter { !it.archived }

    suspend fun ensureSeeded() {
        if (db.categories().count() == 0) db.categories().insertAll(DefaultCategories.list)
        val s = settingsStore.current()
        if (s.firstUse == 0L) settingsStore.update { it.copy(firstUse = System.currentTimeMillis()) }
    }

    /**
     * Logs an expense. When [categoryId] is null the category is guessed from the note,
     * which is what makes one-line entries from the notification work.
     */
    suspend fun addExpense(
        amount: Long,
        isNeed: Boolean?,
        note: String,
        source: Int,
        categoryId: Long? = null,
        timestamp: Long = System.currentTimeMillis(),
    ): Expense {
        val cats = categoriesOnce()
        val category = categoryId?.let { id -> cats.firstOrNull { it.id == id } }
            ?: CategoryDetector.detect(note, cats)
            ?: CategoryDetector.fallback(cats)
        val expense = Expense(
            amount = amount,
            categoryId = category?.id ?: 0,
            isNeed = isNeed ?: category?.defaultNeed ?: true,
            note = note,
            timestamp = timestamp,
            source = source,
        )
        val id = db.expenses().insert(expense)
        changed()
        category?.let { checkCategoryLimit(it, amount) }
        return expense.copy(id = id)
    }

    /** Warns (by notification) when a category crosses 80% or 100% of its monthly limit. */
    private suspend fun checkCategoryLimit(category: Category, added: Long) {
        if (category.monthlyLimit <= 0) return
        val snap = snapshotOnce()
        val after = snap.byCategory.firstOrNull { it.category.id == category.id }?.spent ?: return
        val before = after - added
        val limit = category.monthlyLimit
        val currency = snap.currency
        when {
            after > limit -> Notifications.showCategoryAlert(
                context, category,
                if (before <= limit) "🚨 تجاوزت ميزانية ${category.name}!" else "🚨 ما زلت فوق ميزانية ${category.name}",
                "صرفت ${Money.format(after, currency)} من حد ${Money.format(limit, currency)} — تجاوز بـ ${Money.format(after - limit, currency)}. " +
                    "المتبقي للدورة كلها ${Money.format(snap.remaining, currency)}.",
            )
            after * 100 >= limit * 80 && before * 100 < limit * 80 -> Notifications.showCategoryAlert(
                context, category, "⚠️ اقتربت من حد ${category.name}",
                "استهلكت ${after * 100 / limit}% — باقي ${Money.format(limit - after, currency)} فقط لهذا البند حتى نهاية الدورة.",
            )
        }
    }

    suspend fun updateExpense(e: Expense) { db.expenses().update(e); changed() }
    suspend fun deleteExpense(e: Expense) { db.expenses().delete(e); changed() }
    suspend fun restoreExpense(e: Expense) { db.expenses().insert(e); changed() }
    suspend fun expenseById(id: Long): Expense? = db.expenses().byId(id)

    suspend fun saveCategory(c: Category) {
        if (c.id == 0L) db.categories().insert(c) else db.categories().update(c)
        changed()
    }

    suspend fun archiveCategory(c: Category) {
        val fallback = CategoryDetector.fallback(categoriesOnce().filter { it.id != c.id })
        if (fallback != null) db.expenses().moveCategory(c.id, fallback.id)
        db.categories().update(c.copy(archived = true))
        changed()
    }

    suspend fun saveGoal(g: Goal) { if (g.id == 0L) db.goals().insert(g) else db.goals().update(g) }
    suspend fun deleteGoal(g: Goal) = db.goals().delete(g)

    // ---- Wishes: the 48-hour "think before you buy" list ----
    suspend fun addWish(name: String, amount: Long, hours: Int = 48) {
        val now = System.currentTimeMillis()
        db.wishes().insert(WishItem(name = name, amount = amount, createdAt = now, decideAfter = now + hours * 3_600_000L))
    }

    suspend fun wishById(id: Long) = db.wishes().byId(id)
    suspend fun wishesOnce() = db.wishes().allOnce()
    suspend fun markWishNotified(w: WishItem) = db.wishes().update(w.copy(notified = true))

    suspend fun decideWish(w: WishItem, bought: Boolean) {
        db.wishes().update(
            w.copy(status = if (bought) WishItem.Status.BOUGHT else WishItem.Status.SKIPPED, decidedAt = System.currentTimeMillis())
        )
        if (bought) addExpense(w.amount, false, w.name, Expense.Source.APP) else changed()
    }

    suspend fun deleteWish(w: WishItem) = db.wishes().delete(w)

    // ---- Bills ----
    suspend fun saveBill(b: Bill) { if (b.id == 0L) db.bills().insert(b) else db.bills().update(b); changed() }
    suspend fun deleteBill(b: Bill) { db.bills().delete(b); changed() }
    suspend fun billsOnce() = db.bills().allOnce()
    suspend fun billById(id: Long) = db.bills().byId(id)

    suspend fun payBill(b: Bill) {
        val period = snapshotOnce().period
        db.bills().update(b.copy(paidCycleStart = period.startMillis))
        addExpense(b.amount, true, b.name, Expense.Source.APP, b.categoryId)
    }

    suspend fun markBillNotified(b: Bill) = db.bills().update(b.copy(lastNotifiedDay = LocalDate.now().toMillis()))

    suspend fun recordCheckIn(spent: Boolean) {
        db.checkIns().insert(CheckIn(spent = spent))
    }

    suspend fun updateSettings(transform: (Settings) -> Settings) {
        settingsStore.update(transform)
        changed()
    }

    suspend fun allExpenses(): List<Expense> = db.expenses().allOnce()

    suspend fun wipeExpenses() { db.expenses().clear(); changed() }

    // ---- Backup ----
    suspend fun exportJson(): String {
        val root = JSONObject()
        val s = settingsStore.current()
        root.put("version", 2)
        root.put("settings", JSONObject().apply {
            put("userName", s.userName); put("currency", s.currency); put("budget", s.monthlyBudget)
            put("income", s.monthlyIncome); put("cycleDay", s.cycleStartDay)
        })
        root.put("categories", JSONArray().apply {
            db.categories().allOnce().forEach { c ->
                put(JSONObject().apply {
                    put("id", c.id); put("name", c.name); put("emoji", c.emoji); put("color", c.color)
                    put("limit", c.monthlyLimit); put("need", c.defaultNeed); put("keywords", c.keywords)
                    put("order", c.sortOrder); put("archived", c.archived)
                })
            }
        })
        root.put("expenses", JSONArray().apply {
            db.expenses().allOnce().forEach { e ->
                put(JSONObject().apply {
                    put("amount", e.amount); put("cat", e.categoryId); put("need", e.isNeed)
                    put("note", e.note); put("ts", e.timestamp); put("src", e.source)
                })
            }
        })
        root.put("goals", JSONArray().apply {
            db.goals().allOnce().forEach { g ->
                put(JSONObject().apply { put("name", g.name); put("emoji", g.emoji); put("target", g.target); put("saved", g.saved) })
            }
        })
        root.put("bills", JSONArray().apply {
            db.bills().allOnce().forEach { b ->
                put(JSONObject().apply {
                    put("name", b.name); put("emoji", b.emoji); put("amount", b.amount)
                    put("day", b.dayOfMonth); put("cat", b.categoryId)
                })
            }
        })
        return root.toString()
    }

    /** Replaces categories and expenses with the backup's; returns how many expenses were restored. */
    suspend fun importJson(text: String): Int {
        val root = JSONObject(text)
        val cats = root.getJSONArray("categories")
        val idMap = mutableMapOf<Long, Long>()
        db.expenses().clear()
        db.categories().clear()
        for (i in 0 until cats.length()) {
            val o = cats.getJSONObject(i)
            val newId = db.categories().insert(
                Category(
                    name = o.getString("name"), emoji = o.getString("emoji"), color = o.getLong("color"),
                    monthlyLimit = o.optLong("limit"), defaultNeed = o.optBoolean("need", true),
                    keywords = o.optString("keywords"), sortOrder = o.optInt("order"), archived = o.optBoolean("archived"),
                )
            )
            idMap[o.getLong("id")] = newId
        }
        val ex = root.getJSONArray("expenses")
        val list = (0 until ex.length()).map { i ->
            val o = ex.getJSONObject(i)
            Expense(
                amount = o.getLong("amount"), categoryId = idMap[o.getLong("cat")] ?: 0, isNeed = o.getBoolean("need"),
                note = o.optString("note"), timestamp = o.getLong("ts"), source = o.optInt("src"),
            )
        }
        db.expenses().insertAll(list)
        root.optJSONArray("goals")?.let { arr ->
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                db.goals().insert(Goal(name = o.getString("name"), emoji = o.getString("emoji"), target = o.getLong("target"), saved = o.optLong("saved")))
            }
        }
        root.optJSONArray("bills")?.let { arr ->
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                db.bills().insert(
                    Bill(name = o.getString("name"), emoji = o.getString("emoji"), amount = o.getLong("amount"),
                        dayOfMonth = o.getInt("day"), categoryId = idMap[o.getLong("cat")] ?: 0)
                )
            }
        }
        root.optJSONObject("settings")?.let { o ->
            settingsStore.update {
                it.copy(
                    onboarded = true, userName = o.optString("userName", it.userName), currency = o.optString("currency", it.currency),
                    monthlyBudget = o.optLong("budget", it.monthlyBudget), monthlyIncome = o.optLong("income", it.monthlyIncome),
                    cycleStartDay = o.optInt("cycleDay", it.cycleStartDay),
                )
            }
        }
        changed()
        return list.size
    }

    /** Fills the app with a realistic month so first-time users (and screenshots) see it alive. */
    suspend fun seedDemo() {
        ensureSeeded()
        settingsStore.update {
            it.copy(onboarded = true, userName = "أحمد", monthlyBudget = 600000, monthlyIncome = 900000, cycleStartDay = 1)
        }
        val cats = categoriesOnce().associateBy { it.name }
        fun c(name: String) = cats[name]?.id ?: 0L
        val today = LocalDate.now()
        val start = today.withDayOfMonth(1)
        val rows = listOf(
            Triple("طعام وبقالة", 32000L, "بقالة الأسبوع"), Triple("مطاعم وقهوة", 1800L, "قهوة"),
            Triple("مواصلات ووقود", 12000L, "بنزين"), Triple("تسوق وملابس", 24900L, "حذاء رياضي"),
            Triple("مطاعم وقهوة", 6500L, "عشاء مع الأصدقاء"), Triple("فواتير وسكن", 25000L, "إنترنت"),
            Triple("صحة", 8500L, "صيدلية"), Triple("ترفيه", 4500L, "اشتراك نتفلكس"),
            Triple("مطاعم وقهوة", 2200L, "قهوة"), Triple("طعام وبقالة", 18000L, "خضار وفواكه"),
            Triple("مواصلات ووقود", 3500L, "أوبر"), Triple("عائلة وهدايا", 15000L, "هدية"),
        )
        var d = start
        var i = 0
        val list = mutableListOf<Expense>()
        while (!d.isAfter(today)) {
            repeat(if (d == today) 2 else 1 + (d.dayOfMonth % 2)) {
                val (cat, amount, note) = rows[i % rows.size]
                val category = cats[cat]
                list += Expense(
                    amount = amount, categoryId = c(cat), isNeed = category?.defaultNeed ?: true, note = note,
                    timestamp = d.toMillis() + (9 + (i * 3) % 12) * 3_600_000L,
                )
                i++
            }
            d = d.plusDays(1)
        }
        db.expenses().insertAll(list)
        db.goals().insert(Goal(name = "صندوق الطوارئ", emoji = "🛟", target = 2000000, saved = 850000))
        db.goals().insert(Goal(name = "رحلة الصيف", emoji = "✈️", target = 800000, saved = 210000))
        db.bills().insert(Bill(name = "الإيجار", emoji = "🏠", amount = 150000, dayOfMonth = 27, categoryId = c("فواتير وسكن")))
        db.bills().insert(Bill(name = "اشتراك الجوال", emoji = "📱", amount = 11500, dayOfMonth = 15, categoryId = c("فواتير وسكن")))
        val now = System.currentTimeMillis()
        db.wishes().insert(WishItem(name = "سماعات لاسلكية", amount = 79900, createdAt = now - 20 * 3_600_000L, decideAfter = now + 28 * 3_600_000L))
        db.wishes().insert(WishItem(name = "ساعة ذكية", amount = 129900, createdAt = now - 72 * 3_600_000L, decideAfter = now - 24 * 3_600_000L, status = WishItem.Status.SKIPPED, decidedAt = now))
        changed()
    }

    /** Pushes fresh numbers to the widget, quick-settings tile and status notification. */
    suspend fun changed() = Refresher.refreshAll(context, snapshotOnce(), settings.first())

}
