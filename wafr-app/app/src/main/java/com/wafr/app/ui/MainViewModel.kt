package com.wafr.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.wafr.app.data.Bill
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.data.Goal
import com.wafr.app.data.Settings
import com.wafr.app.data.WishItem
import com.wafr.app.domain.Achievement
import com.wafr.app.domain.Achievements
import com.wafr.app.domain.Game
import com.wafr.app.domain.Insight
import com.wafr.app.domain.Insights
import com.wafr.app.domain.SalaryPlanner
import com.wafr.app.domain.Snapshot
import com.wafr.app.domain.Suggestion
import com.wafr.app.domain.Suggestions
import com.wafr.app.notify.ReminderScheduler
import com.wafr.app.repo
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = app.repo

    val settings: StateFlow<Settings?> = repo.settings.map<Settings, Settings?> { it }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val categories: StateFlow<List<Category>> = repo.categories.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val expenses: StateFlow<List<Expense>> = repo.expenses.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val goals: StateFlow<List<Goal>> = repo.goals.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val wishes: StateFlow<List<WishItem>> = repo.wishes.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val bills: StateFlow<List<Bill>> = repo.bills.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val snapshot: StateFlow<Snapshot?> = repo.snapshot.map<Snapshot, Snapshot?> { it }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val insights: StateFlow<List<Insight>> = combine(repo.snapshot, repo.expenses) { s, e -> Insights.build(s, e) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val suggestions: StateFlow<List<Suggestion>> = repo.expenses.map { Suggestions.frequent(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val achievements: StateFlow<List<Achievement>> = combine(
        repo.snapshot, repo.expenses, repo.goals, repo.wishes, combine(repo.checkInCount, repo.settings) { c, s -> c to s.gameBest },
    ) { s, e, g, w, (checks, best) -> Achievements.build(s, e, g, w, checks, best) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val game: StateFlow<Game.State> = repo.settings.map { if (it.gameState.isBlank()) Game.State() else Game.decode(it.gameState) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, Game.State())

    fun addExpense(amount: Long, isNeed: Boolean, categoryId: Long?, note: String, timestamp: Long, source: Int) =
        viewModelScope.launch { repo.addExpense(amount, isNeed, note, source, categoryId, timestamp) }

    fun updateExpense(e: Expense) = viewModelScope.launch { repo.updateExpense(e) }
    fun deleteExpense(e: Expense) = viewModelScope.launch { repo.deleteExpense(e) }
    fun restoreExpense(e: Expense) = viewModelScope.launch { repo.restoreExpense(e) }

    fun saveCategory(c: Category) = viewModelScope.launch { repo.saveCategory(c) }
    fun archiveCategory(c: Category) = viewModelScope.launch { repo.archiveCategory(c) }

    fun saveGoal(g: Goal) = viewModelScope.launch { repo.saveGoal(g) }
    fun deleteGoal(g: Goal) = viewModelScope.launch { repo.deleteGoal(g) }

    fun addWish(name: String, amount: Long) = viewModelScope.launch { repo.addWish(name, amount) }
    fun decideWish(w: WishItem, bought: Boolean) = viewModelScope.launch { repo.decideWish(w, bought) }
    fun deleteWish(w: WishItem) = viewModelScope.launch { repo.deleteWish(w) }

    fun saveBill(b: Bill) = viewModelScope.launch { repo.saveBill(b) }
    fun deleteBill(b: Bill) = viewModelScope.launch { repo.deleteBill(b) }
    fun payBill(b: Bill) = viewModelScope.launch { repo.payBill(b) }

    /** Applies a salary plan: income, spending budget and per-category limits. */
    fun applyPlan(plan: SalaryPlanner.Plan) = viewModelScope.launch {
        val limits = SalaryPlanner.categoryLimits(plan, categories.value)
        categories.value.forEach { c -> limits[c.id]?.let { repo.saveCategory(c.copy(monthlyLimit = it)) } }
        repo.updateSettings { it.copy(monthlyIncome = plan.salary, monthlyBudget = plan.spendBudget) }
    }

    fun saveGame(state: Game.State) = viewModelScope.launch {
        repo.settingsStore.update { s ->
            val best = if (state.won && (s.gameBest == 0 || state.month < s.gameBest)) state.month else s.gameBest
            s.copy(gameState = Game.encode(state), gameBest = best)
        }
    }

    fun resetGame() = viewModelScope.launch { repo.settingsStore.update { it.copy(gameState = "") } }

    fun updateSettings(reschedule: Boolean = false, transform: (Settings) -> Settings) = viewModelScope.launch {
        repo.updateSettings(transform)
        val s = repo.settingsStore.current()
        if (reschedule) ReminderScheduler.reschedule(getApplication(), s) else ReminderScheduler.apply(getApplication(), s)
    }

    fun wipe() = viewModelScope.launch { repo.wipeExpenses() }
}
