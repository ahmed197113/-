package com.mizan.budget.data

import android.content.Context
import com.mizan.budget.domain.CategoryDetector
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.notify.Refresher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first

class Repository(private val context: Context) {
    private val db = AppDatabase.get(context)
    val settingsStore = SettingsStore(context)

    val settings: Flow<Settings> = settingsStore.flow
    val categories: Flow<List<Category>> = db.categories().active()
    val expenses: Flow<List<Expense>> = db.expenses().all()
    val goals: Flow<List<Goal>> = db.goals().all()

    val snapshot: Flow<Snapshot> = combine(settings, categories, expenses) { s, c, e ->
        Snapshot.compute(s, c, e)
    }

    suspend fun snapshotOnce(): Snapshot =
        Snapshot.compute(settingsStore.current(), db.categories().allOnce().filter { !it.archived }, db.expenses().allOnce())

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
        return expense.copy(id = id)
    }

    suspend fun updateExpense(e: Expense) { db.expenses().update(e); changed() }
    suspend fun deleteExpense(e: Expense) { db.expenses().delete(e); changed() }
    suspend fun restoreExpense(e: Expense) { db.expenses().insert(e); changed() }

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

    suspend fun recordCheckIn(spent: Boolean) {
        db.checkIns().insert(CheckIn(spent = spent))
    }

    suspend fun updateSettings(transform: (Settings) -> Settings) {
        settingsStore.update(transform)
        changed()
    }

    suspend fun allExpenses(): List<Expense> = db.expenses().allOnce()

    suspend fun wipeExpenses() { db.expenses().clear(); changed() }

    /** Pushes fresh numbers to the widget, quick-settings tile and status notification. */
    suspend fun changed() = Refresher.refreshAll(context, snapshotOnce(), settings.first())
}
