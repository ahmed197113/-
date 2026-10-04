package com.wafr.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.IconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.domain.toLocalDate
import com.wafr.app.ui.components.ExpenseRow
import com.wafr.app.ui.theme.Mz
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dayFmt = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale("ar"))

@Composable
fun HistoryScreen(
    expenses: List<Expense>,
    categories: List<Category>,
    currency: String,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onEdit: (Expense) -> Unit,
) {
    val c = Mz.colors
    var query by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf(0) } // 0 all, 1 needs, 2 wants
    var categoryFilter by rememberSaveable { mutableStateOf<Long?>(null) }
    val byId = categories.associateBy { it.id }

    val filtered = remember(expenses, query, kind, categoryFilter) {
        val q = Money.normalizeDigits(query.trim())
        expenses.filter { e ->
            (kind == 0 || (kind == 1) == e.isNeed) &&
                (categoryFilter == null || e.categoryId == categoryFilter) &&
                (q.isEmpty() || e.note.contains(q, true) || (byId[e.categoryId]?.name?.contains(q) == true) ||
                    Money.plain(e.amount).replace(",", "").contains(q))
        }
    }
    val groups = remember(filtered) { filtered.groupBy { it.timestamp.toLocalDate() }.toSortedMap(compareByDescending { it }) }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding()),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "رجوع") }
                Text("السجل الكامل", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                placeholder = { Text("ابحث بالوصف أو الفئة أو المبلغ") },
                singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(kind == 0, { kind = 0 }, { Text("الكل") })
                FilterChip(kind == 1, { kind = 1 }, { Text("✅ ضروري") })
                FilterChip(kind == 2, { kind = 2 }, { Text("🛍️ كمالي") })
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categories, key = { it.id }) { cat ->
                    FilterChip(
                        cat.id == categoryFilter,
                        { categoryFilter = if (categoryFilter == cat.id) null else cat.id },
                        { Text("${cat.emoji} ${cat.name}") },
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "${filtered.size} عملية • المجموع ${Money.format(filtered.sumOf { it.amount }, currency)}",
                color = c.muted, style = MaterialTheme.typography.bodySmall,
            )
        }
        if (filtered.isEmpty()) {
            item {
                Column(Modifier.fillMaxWidth().padding(top = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🔎", fontSize = 40.sp)
                    Text("لا توجد نتائج", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        groups.forEach { (day, list) ->
            item(key = "h$day") {
                Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    val title = when (day) {
                        LocalDate.now() -> "اليوم"
                        LocalDate.now().minusDays(1) -> "أمس"
                        else -> dayFmt.format(day)
                    }
                    Text(title, style = MaterialTheme.typography.labelLarge, color = c.muted, modifier = Modifier.weight(1f))
                    Text(Money.format(list.sumOf { it.amount }, currency), style = MaterialTheme.typography.labelLarge, color = c.muted)
                }
            }
            items(list, key = { it.id }) { e -> ExpenseRow(e, byId[e.categoryId], currency, onClick = { onEdit(e) }) }
        }
    }
}
