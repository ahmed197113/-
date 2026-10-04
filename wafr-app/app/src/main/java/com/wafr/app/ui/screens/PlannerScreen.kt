package com.wafr.app.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Bill
import com.wafr.app.data.Settings
import com.wafr.app.domain.Money
import com.wafr.app.domain.SalaryPlanner
import com.wafr.app.ui.MainViewModel
import com.wafr.app.ui.components.AmountField
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.NeonButton
import com.wafr.app.ui.components.SectionTitle
import com.wafr.app.ui.components.amountText
import com.wafr.app.ui.components.parseAmount
import com.wafr.app.ui.theme.Mz

private fun kindColor(k: SalaryPlanner.Kind, c: com.wafr.app.ui.theme.WafrColors): Color = when (k) {
    SalaryPlanner.Kind.NEED -> c.need
    SalaryPlanner.Kind.WANT -> c.want
    SalaryPlanner.Kind.SAVE -> c.good
    SalaryPlanner.Kind.INVEST -> Color(0xFF8A5CFF)
    SalaryPlanner.Kind.LEARN -> Color(0xFFFF7AD9)
    SalaryPlanner.Kind.GIVE -> Color(0xFF7CE38B)
}

/** "قل لي راتبك": splits the salary with a book method, checks commitments, applies it. */
@Composable
fun PlannerScreen(vm: MainViewModel, settings: Settings, bills: List<Bill>, contentPadding: PaddingValues, onBack: () -> Unit) {
    val c = Mz.colors
    var salaryText by rememberSaveable { mutableStateOf(amountText(settings.monthlyIncome)) }
    var methodId by rememberSaveable { mutableStateOf(SalaryPlanner.methods.first().id) }
    var applied by remember { mutableStateOf(false) }
    val salary = parseAmount(salaryText) ?: 0L
    val method = SalaryPlanner.methods.first { it.id == methodId }
    val plan = SalaryPlanner.plan(method, salary, bills, settings.currency)

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "رجوع") }
                Column {
                    Text("مخطط الراتب 🧭", style = MaterialTheme.typography.headlineSmall)
                    Text("قل لي راتبك، وأقول لك أين يذهب كل ريال", color = c.muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                AmountField(salaryText, { salaryText = it; applied = false }, "راتبك الشهري الصافي", settings.currency)
            }
        }
        item { SectionTitle("اختر منهجك") }
        items(SalaryPlanner.methods, key = { it.id }) { m ->
            val selected = m.id == methodId
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                    .background(if (selected) c.glow1.copy(alpha = 0.10f) else c.card)
                    .border(if (selected) 2.dp else 1.dp, if (selected) c.glow1 else c.cardBorder, RoundedCornerShape(22.dp))
                    .clickable { methodId = m.id; applied = false }
                    .padding(16.dp)
                    .animateContentSize(),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(m.name, style = MaterialTheme.typography.titleMedium, color = if (selected) c.good else c.text, modifier = Modifier.weight(1f))
                    Text(m.buckets.joinToString("/") { "${it.pct}" }, color = c.muted, fontSize = 12.sp)
                }
                Text("📖 ${m.source}", color = c.muted, fontSize = 12.sp)
                if (selected) {
                    Spacer(Modifier.height(6.dp))
                    Text(m.idea, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (salary > 0) {
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("توزيع ${Money.format(salary, settings.currency)}", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    Canvas(Modifier.fillMaxWidth().height(18.dp).clip(RoundedCornerShape(9.dp))) {
                        var x = size.width
                        plan.lines.forEach { l ->
                            val w = size.width * l.bucket.pct / 100f
                            x -= w
                            drawRect(kindColor(l.bucket.kind, c), Offset(x, 0f), Size(w - 3f, size.height))
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    plan.lines.forEach { l ->
                        val color = kindColor(l.bucket.kind, c)
                        Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.Top) {
                            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(color.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                                Text(l.bucket.emoji, fontSize = 20.sp)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Row {
                                    Text("${l.bucket.name} ${l.bucket.pct}%", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                    Text(Money.format(l.amount, settings.currency), fontWeight = FontWeight.Bold, color = color)
                                }
                                Text(l.bucket.tip, fontSize = 12.sp, color = c.muted)
                            }
                        }
                    }
                }
            }
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("التزاماتك مقابل الخطة", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    if (bills.isEmpty()) Text("لم تضف التزامات بعد (من «الخطة» ← التزاماتي الشهرية).", color = c.muted, fontSize = 13.sp)
                    bills.forEach { b ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                            Text("${b.emoji} ${b.name}", modifier = Modifier.weight(1f))
                            Text(Money.format(b.amount, settings.currency), color = c.muted)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    plan.advice.forEach { a ->
                        Text(a, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
                    }
                }
            }
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("عند التطبيق:", fontWeight = FontWeight.Bold)
                    Text("• دخلك الشهري = ${Money.format(salary, settings.currency)}", fontSize = 13.sp)
                    Text("• ميزانية الصرف الشهرية = ${Money.format(plan.spendBudget, settings.currency)}", fontSize = 13.sp)
                    Text("• حدود الفئات تُوزّع تلقائياً، وينبّهك وَفْر عند تجاوز أي بند", fontSize = 13.sp)
                    Text("• الادخار والاستثمار ${Money.format(plan.saveTotal, settings.currency)} لا تُصرف — حوّلها يوم الراتب", fontSize = 13.sp)
                    Spacer(Modifier.height(12.dp))
                    NeonButton(if (applied) "✓ تم تطبيق الخطة" else "طبّق هذه الخطة على ميزانيتي", Modifier.fillMaxWidth(), enabled = !applied) {
                        vm.applyPlan(plan); applied = true
                    }
                }
            }
        }
    }
}
