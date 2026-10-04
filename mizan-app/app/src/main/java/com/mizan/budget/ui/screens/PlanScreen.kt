package com.mizan.budget.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mizan.budget.data.Category
import com.mizan.budget.data.Goal
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.ui.MainViewModel
import com.mizan.budget.ui.components.AmountDialog
import com.mizan.budget.ui.components.CategoryBadge
import com.mizan.budget.ui.components.CategoryDialog
import com.mizan.budget.ui.components.GlassCard
import com.mizan.budget.ui.components.GoalDialog
import com.mizan.budget.ui.components.LinearMeter
import com.mizan.budget.ui.components.SectionTitle
import com.mizan.budget.ui.theme.Mz

private sealed interface PlanDialog {
    data object Budget : PlanDialog
    data object Income : PlanDialog
    data class Cat(val category: Category?) : PlanDialog
    data class GoalEdit(val goal: Goal?) : PlanDialog
}

@Composable
fun PlanScreen(
    vm: MainViewModel,
    settings: Settings,
    snap: Snapshot,
    categories: List<Category>,
    goals: List<Goal>,
    contentPadding: PaddingValues,
) {
    val c = Mz.colors
    var dialog by remember { mutableStateOf<PlanDialog?>(null) }
    val spentById = snap.byCategory.associate { it.category.id to it.spent }
    val limitsTotal = categories.sumOf { it.monthlyLimit }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("الخطة", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GlassCard(Modifier.weight(1f), onClick = { dialog = PlanDialog.Budget }) {
                    Text("الميزانية الشهرية", color = c.muted, style = MaterialTheme.typography.bodySmall)
                    Text(if (settings.monthlyBudget > 0) Money.format(settings.monthlyBudget, settings.currency) else "حدّدها ✏️", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }
                GlassCard(Modifier.weight(1f), onClick = { dialog = PlanDialog.Income }) {
                    Text("الدخل الشهري", color = c.muted, style = MaterialTheme.typography.bodySmall)
                    Text(if (settings.monthlyIncome > 0) Money.format(settings.monthlyIncome, settings.currency) else "أضفه ✏️", style = MaterialTheme.typography.titleLarge)
                }
            }
        }
        if (settings.monthlyIncome > 0 && settings.monthlyBudget > 0) {
            item {
                val save = settings.monthlyIncome - settings.monthlyBudget
                val rate = (save * 100 / settings.monthlyIncome).toInt()
                GlassCard(Modifier.fillMaxWidth()) {
                    Text(
                        if (save >= 0) "💰 خطتك تدّخر ${Money.format(save, settings.currency)} شهرياً ($rate% من دخلك)"
                        else "⚠️ ميزانيتك أعلى من دخلك بـ ${Money.format(-save, settings.currency)}",
                        fontWeight = FontWeight.SemiBold,
                        color = if (save >= 0) c.good else c.danger,
                    )
                    Text(
                        "القاعدة الذهبية 50/30/20: 50% ضروريات، 30% كماليات، 20% ادخار.",
                        style = MaterialTheme.typography.bodySmall, color = c.muted,
                    )
                }
            }
        }
        item {
            SectionTitle("حدود الفئات", action = "+ فئة", onAction = { dialog = PlanDialog.Cat(null) })
            if (limitsTotal > 0 && settings.monthlyBudget > 0) {
                Text(
                    "مجموع الحدود ${Money.format(limitsTotal, settings.currency)} من ميزانية ${Money.format(settings.monthlyBudget, settings.currency)}",
                    style = MaterialTheme.typography.bodySmall, color = if (limitsTotal > settings.monthlyBudget) c.danger else c.muted,
                )
            }
        }
        items(categories, key = { it.id }) { cat ->
            val spent = spentById[cat.id] ?: 0L
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { dialog = PlanDialog.Cat(cat) }.padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CategoryBadge(cat)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row {
                        Text(cat.name, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text(
                            if (cat.monthlyLimit > 0) "${Money.plain(spent)} / ${Money.plain(cat.monthlyLimit)}" else Money.plain(spent),
                            color = if (cat.monthlyLimit in 1 until spent) c.danger else c.muted, fontSize = 13.sp,
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    if (cat.monthlyLimit > 0) {
                        val p = spent.toFloat() / cat.monthlyLimit
                        LinearMeter(p, when { p > 1f -> c.danger; p > 0.8f -> c.want; else -> Color(cat.color) }, height = 6.dp)
                    } else {
                        Text("بدون حد • اضغط لتحديد حد شهري", fontSize = 11.sp, color = c.muted)
                    }
                }
            }
        }
        item { SectionTitle("أهداف الادخار", action = "+ هدف", onAction = { dialog = PlanDialog.GoalEdit(null) }) }
        if (goals.isEmpty()) {
            item {
                GlassCard(Modifier.fillMaxWidth(), onClick = { dialog = PlanDialog.GoalEdit(null) }) {
                    Text("🎯 حدّد هدفاً تدّخر له", style = MaterialTheme.typography.titleMedium)
                    Text("سيارة، عمرة، صندوق طوارئ… رؤية الهدف تجعل قول «لا» للكماليات أسهل.", color = c.muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        items(goals, key = { "g${it.id}" }) { g ->
            val p = if (g.target > 0) g.saved.toFloat() / g.target else 0f
            GlassCard(Modifier.fillMaxWidth(), onClick = { dialog = PlanDialog.GoalEdit(g) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(g.emoji, fontSize = 28.sp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(g.name, style = MaterialTheme.typography.titleMedium)
                        Text("${Money.format(g.saved, settings.currency)} من ${Money.format(g.target, settings.currency)}", color = c.muted, style = MaterialTheme.typography.bodySmall)
                    }
                    Text(if (p >= 1f) "✅" else "${(p * 100).toInt()}%", fontWeight = FontWeight.Bold, color = c.good)
                }
                Spacer(Modifier.height(10.dp))
                LinearMeter(p, c.good)
            }
        }
    }

    when (val d = dialog) {
        PlanDialog.Budget -> AmountDialog(
            "الميزانية الشهرية", settings.monthlyBudget, settings.currency,
            hint = if (settings.monthlyIncome > 0) "اقتراح: ${Money.format(settings.monthlyIncome * 7 / 10, settings.currency)} (70% من دخلك)" else null,
            onDismiss = { dialog = null },
        ) { v -> vm.updateSettings { it.copy(monthlyBudget = v) }; dialog = null }
        PlanDialog.Income -> AmountDialog("الدخل الشهري", settings.monthlyIncome, settings.currency, onDismiss = { dialog = null }) { v ->
            vm.updateSettings { it.copy(monthlyIncome = v) }; dialog = null
        }
        is PlanDialog.Cat -> CategoryDialog(
            d.category, settings.currency, onDismiss = { dialog = null },
            onArchive = d.category?.takeIf { it.name != "أخرى" }?.let { cat -> { vm.archiveCategory(cat); dialog = null; Unit } },
        ) { vm.saveCategory(it); dialog = null }
        is PlanDialog.GoalEdit -> GoalDialog(
            d.goal, settings.currency, onDismiss = { dialog = null },
            onDelete = d.goal?.let { g -> { vm.deleteGoal(g); dialog = null; Unit } },
        ) { vm.saveGoal(it); dialog = null }
        null -> {}
    }
}
