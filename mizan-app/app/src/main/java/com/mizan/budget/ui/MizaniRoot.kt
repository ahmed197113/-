package com.mizan.budget.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mizan.budget.data.Expense
import com.mizan.budget.domain.Money
import com.mizan.budget.ui.components.ExpenseEditor
import com.mizan.budget.ui.screens.HistoryScreen
import com.mizan.budget.ui.screens.HomeScreen
import com.mizan.budget.ui.screens.InsightsScreen
import com.mizan.budget.ui.screens.PlanScreen
import com.mizan.budget.ui.screens.SettingsScreen
import kotlinx.coroutines.launch

private enum class Tab(val label: String, val icon: ImageVector) {
    HOME("الرئيسية", Icons.Outlined.Home),
    HISTORY("السجل", Icons.Outlined.ReceiptLong),
    INSIGHTS("التحليلات", Icons.Outlined.Insights),
    PLAN("الخطة", Icons.Outlined.AccountBalanceWallet),
}

/** Editor sheet state: null = closed. */
private data class EditorState(val expense: Expense? = null)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MizaniRoot(vm: MainViewModel, openAddOnStart: Boolean) {
    val settings by vm.settings.collectAsStateWithLifecycle()
    val snap by vm.snapshot.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val expenses by vm.expenses.collectAsStateWithLifecycle()
    val goals by vm.goals.collectAsStateWithLifecycle()
    val insights by vm.insights.collectAsStateWithLifecycle()

    var tab by rememberSaveable { mutableStateOf(Tab.HOME) }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var editor by remember { mutableStateOf(if (openAddOnStart) EditorState() else null) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val s = settings ?: return
    val sn = snap ?: return

    BackHandler(enabled = showSettings || tab != Tab.HOME) {
        if (showSettings) showSettings = false else tab = Tab.HOME
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (!showSettings) NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t, onClick = { tab = t },
                        icon = { Icon(t.icon, t.label) }, label = { Text(t.label) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (!showSettings) FloatingActionButton(
                onClick = { editor = EditorState() },
                shape = RoundedCornerShape(20.dp),
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color(0xFF00281A),
            ) { Icon(Icons.Filled.Add, "إضافة مصروف") }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize()) {
            if (showSettings) {
                SettingsScreen(vm, s, padding, onBack = { showSettings = false })
            } else {
                AnimatedContent(tab, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "tabs") { t ->
                    when (t) {
                        Tab.HOME -> HomeScreen(
                            s, sn, categories, insights, padding,
                            onSettings = { showSettings = true }, onSeeAll = { tab = Tab.HISTORY },
                            onEdit = { editor = EditorState(it) }, onInsights = { tab = Tab.INSIGHTS },
                        )
                        Tab.HISTORY -> HistoryScreen(expenses, categories, s.currency, padding, onEdit = { editor = EditorState(it) })
                        Tab.INSIGHTS -> InsightsScreen(sn, insights, padding)
                        Tab.PLAN -> PlanScreen(vm, s, sn, categories, goals, padding)
                    }
                }
            }
        }
    }

    editor?.let { state ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { editor = null }, sheetState = sheet,
            containerColor = MaterialTheme.colorScheme.surface,
        ) {
            Box(Modifier.navigationBarsPadding()) {
                ExpenseEditor(
                    categories = categories, currency = s.currency, initial = state.expense,
                    onSave = { amount, need, catId, note, ts ->
                        val e = state.expense
                        if (e == null) vm.addExpense(amount, need, catId, note, ts, Expense.Source.APP)
                        else vm.updateExpense(e.copy(amount = amount, isNeed = need, categoryId = catId ?: e.categoryId, note = note, timestamp = ts))
                        editor = null
                        scope.launch { snackbar.showSnackbar(if (e == null) "✓ سُجّل ${Money.format(amount, s.currency)}" else "✓ تم التعديل") }
                    },
                    onDelete = state.expense?.let { e ->
                        {
                            vm.deleteExpense(e)
                            editor = null
                            scope.launch {
                                val r = snackbar.showSnackbar("حُذف المصروف", actionLabel = "تراجع", withDismissAction = true)
                                if (r == SnackbarResult.ActionPerformed) vm.restoreExpense(e)
                            }
                            Unit
                        }
                    },
                    onClose = { editor = null },
                )
            }
        }
    }
}
