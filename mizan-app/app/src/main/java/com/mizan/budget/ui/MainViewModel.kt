package com.mizan.budget.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mizan.budget.data.Category
import com.mizan.budget.data.Expense
import com.mizan.budget.data.Goal
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Insight
import com.mizan.budget.domain.Insights
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.notify.ReminderScheduler
import com.mizan.budget.repo
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
    val snapshot: StateFlow<Snapshot?> = repo.snapshot.map<Snapshot, Snapshot?> { it }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val insights: StateFlow<List<Insight>> = combine(repo.snapshot, repo.expenses) { s, e -> Insights.build(s, e) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    fun addExpense(amount: Long, isNeed: Boolean, categoryId: Long?, note: String, timestamp: Long, source: Int) =
        viewModelScope.launch { repo.addExpense(amount, isNeed, note, source, categoryId, timestamp) }

    fun updateExpense(e: Expense) = viewModelScope.launch { repo.updateExpense(e) }
    fun deleteExpense(e: Expense) = viewModelScope.launch { repo.deleteExpense(e) }
    fun restoreExpense(e: Expense) = viewModelScope.launch { repo.restoreExpense(e) }

    fun saveCategory(c: Category) = viewModelScope.launch { repo.saveCategory(c) }
    fun archiveCategory(c: Category) = viewModelScope.launch { repo.archiveCategory(c) }

    fun saveGoal(g: Goal) = viewModelScope.launch { repo.saveGoal(g) }
    fun deleteGoal(g: Goal) = viewModelScope.launch { repo.deleteGoal(g) }

    fun updateSettings(reschedule: Boolean = false, transform: (Settings) -> Settings) = viewModelScope.launch {
        repo.updateSettings(transform)
        val s = repo.settingsStore.current()
        if (reschedule) ReminderScheduler.reschedule(getApplication(), s) else ReminderScheduler.apply(getApplication(), s)
    }

    fun wipe() = viewModelScope.launch { repo.wipeExpenses() }
}
