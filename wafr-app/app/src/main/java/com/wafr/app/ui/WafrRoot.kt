package com.wafr.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.AutoGraph
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.ui.components.AuroraBackground
import com.wafr.app.ui.components.ExpenseEditor
import com.wafr.app.ui.screens.GamesHub
import com.wafr.app.ui.screens.HistoryScreen
import com.wafr.app.ui.screens.HomeScreen
import com.wafr.app.ui.screens.InsightsScreen
import com.wafr.app.ui.screens.PlanScreen
import com.wafr.app.ui.screens.PlannerScreen
import com.wafr.app.ui.screens.SettingsScreen
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.launch

enum class Tab(val label: String, val icon: ImageVector) {
    HOME("الرئيسية", Icons.Outlined.Home),
    HISTORY("السجل", Icons.Outlined.ReceiptLong),
    INSIGHTS("التحليلات", Icons.Outlined.AutoGraph),
    PLAN("الخطة", Icons.Outlined.AccountBalanceWallet),
    GAME("العب وتعلّم", Icons.Outlined.SportsEsports),
}

enum class Overlay { NONE, SETTINGS, HISTORY, PLANNER }

/** A navigation request from an intent (launcher shortcut, notification, widget). */
data class NavRequest(val tab: Tab? = null, val overlay: Overlay? = null, val add: Boolean = false, val id: Long = System.nanoTime())

/** Editor sheet state: null = closed. */
private data class EditorState(val expense: Expense? = null)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WafrRoot(vm: MainViewModel, request: NavRequest) {
    val settings by vm.settings.collectAsStateWithLifecycle()
    val snap by vm.snapshot.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    val expenses by vm.expenses.collectAsStateWithLifecycle()
    val goals by vm.goals.collectAsStateWithLifecycle()
    val wishes by vm.wishes.collectAsStateWithLifecycle()
    val bills by vm.bills.collectAsStateWithLifecycle()
    val insights by vm.insights.collectAsStateWithLifecycle()
    val achievements by vm.achievements.collectAsStateWithLifecycle()
    val suggestions by vm.suggestions.collectAsStateWithLifecycle()
    val game by vm.game.collectAsStateWithLifecycle()

    var tab by rememberSaveable { mutableStateOf(request.tab ?: Tab.HOME) }
    var overlay by rememberSaveable { mutableStateOf(request.overlay ?: Overlay.NONE) }
    var editor by remember { mutableStateOf(if (request.add) EditorState() else null) }
    LaunchedEffect(request.id) {
        request.tab?.let { tab = it; overlay = Overlay.NONE }
        request.overlay?.let { if (it == Overlay.HISTORY) { tab = Tab.HISTORY; overlay = Overlay.NONE } else overlay = it }
        if (request.add) editor = EditorState()
    }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val s = settings ?: return
    val sn = snap ?: return

    BackHandler(enabled = overlay != Overlay.NONE || tab != Tab.HOME) {
        if (overlay != Overlay.NONE) overlay = Overlay.NONE else tab = Tab.HOME
    }

    val sys = WindowInsets.systemBars.asPaddingValues()
    val padding = PaddingValues(top = sys.calculateTopPadding(), bottom = sys.calculateBottomPadding() + 84.dp)

    AuroraBackground {
        AnimatedContent(
            targetState = overlay to tab,
            transitionSpec = { (fadeIn(tween(250)) + slideInVertically(tween(300)) { it / 24 }) togetherWith fadeOut(tween(150)) },
            label = "screens",
        ) { (ov, t) ->
            when (ov) {
                Overlay.SETTINGS -> SettingsScreen(vm, s, padding, onBack = { overlay = Overlay.NONE })
                Overlay.HISTORY -> {}
                Overlay.PLANNER -> PlannerScreen(vm, s, bills, padding, onBack = { overlay = Overlay.NONE })
                Overlay.NONE -> when (t) {
                    Tab.HOME -> HomeScreen(
                        s, sn, categories, insights, padding,
                        onSettings = { overlay = Overlay.SETTINGS }, onSeeAll = { tab = Tab.HISTORY },
                        onEdit = { editor = EditorState(it) }, onInsights = { tab = Tab.INSIGHTS },
                        onPlanner = { overlay = Overlay.PLANNER }, onPayBill = { vm.payBill(it) },
                    )
                    Tab.HISTORY -> HistoryScreen(
                        expenses, categories, s.currency, padding, onEdit = { editor = EditorState(it) },
                        header = { HistoryToggle(false) { tab = Tab.INSIGHTS } },
                    )
                    Tab.INSIGHTS -> InsightsScreen(sn, insights, achievements, padding, header = { HistoryToggle(true) { tab = Tab.HISTORY } })
                    Tab.PLAN -> PlanScreen(vm, s, sn, categories, goals, wishes, bills, padding, onPlanner = { overlay = Overlay.PLANNER })
                    Tab.GAME -> GamesHub(vm, s, game, padding)
                }
            }
        }

        if (overlay == Overlay.NONE) {
            FloatingNav(
                tab = tab, onTab = { tab = it }, onAdd = { editor = EditorState() },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp).navigationBarsPadding())
    }

    editor?.let { state ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { editor = null }, sheetState = sheet,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = Mz.colors.text,
        ) {
            Box(Modifier.navigationBarsPadding()) {
                ExpenseEditor(
                    categories = categories, currency = s.currency, initial = state.expense,
                    categorySpent = sn.byCategory.associate { it.category.id to it.spent },
                    suggestions = suggestions,
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

/** Floating glass pill navigation with a glowing centre "+" button. */
@Composable
private fun FloatingNav(tab: Tab, onTab: (Tab) -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    val c = Mz.colors
    val pulse = rememberInfiniteTransition(label = "pulse")
    val glow by pulse.animateFloat(0.92f, 1.06f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "g")
    Box(modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 14.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
        Row(
            Modifier.fillMaxWidth().height(66.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(if (c.isDark) Color(0xF00A1226) else Color(0xF7FFFFFF))
                .border(1.dp, c.border, RoundedCornerShape(26.dp)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            NavItem(Tab.HOME, tab, onTab)
            NavItem(Tab.HISTORY, tab, onTab)
            Spacer(Modifier.size(64.dp))
            NavItem(Tab.PLAN, tab, onTab)
            NavItem(Tab.GAME, tab, onTab)
        }
        Box(
            Modifier.size(64.dp).scale(glow).clip(CircleShape).background(c.glow1.copy(alpha = 0.25f)),
        )
        Box(
            Modifier.size(56.dp).clip(CircleShape).background(c.neon)
                .clickable(onClick = onAdd),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Filled.Add, "إضافة مصروف", tint = Color(0xFF02101A), modifier = Modifier.size(30.dp)) }
    }
}

@Composable
private fun NavItem(t: Tab, current: Tab, onTab: (Tab) -> Unit) {
    val c = Mz.colors
    val selected = t == current || (t == Tab.HISTORY && current == Tab.INSIGHTS)
    val color = if (selected) c.glow1 else c.muted
    Column(
        Modifier.clip(RoundedCornerShape(16.dp))
            .clickable(remember { MutableInteractionSource() }, null) { onTab(t) }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(t.icon, t.label, tint = color, modifier = Modifier.size(24.dp))
        Text(t.label, color = color, fontSize = 10.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
        Box(Modifier.padding(top = 2.dp).size(width = if (selected) 16.dp else 0.dp, height = 3.dp).clip(CircleShape).background(c.neonH))
    }
}

/** Switches the السجل tab between the full log and the current-cycle analytics. */
@Composable
private fun HistoryToggle(insights: Boolean, onSwitch: () -> Unit) {
    val c = Mz.colors
    Column {
        Text("السجل", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(10.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.card).border(1.dp, c.border, RoundedCornerShape(18.dp)).padding(4.dp),
        ) {
            listOf(false to "📋 كل العمليات", true to "📊 تحليلات الدورة").forEach { (isIns, label) ->
                val sel = isIns == insights
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(14.dp))
                        .background(if (sel) c.neon else androidx.compose.ui.graphics.SolidColor(Color.Transparent))
                        .clickable(enabled = !sel, onClick = onSwitch)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(label, fontWeight = FontWeight.Bold, color = if (sel) Color(0xFF02101A) else c.muted)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}
