package com.wafr.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.domain.toLocalDate
import com.wafr.app.domain.toMillis
import com.wafr.app.ui.components.ExpenseRow
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LegendDot
import com.wafr.app.ui.components.LinearMeter
import com.wafr.app.ui.components.SplitBar
import com.wafr.app.ui.theme.Mz
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private val dayFmt = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale("ar"))
private val shortFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ar"))
private val monthFmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale("ar"))

/** The period the history is filtered by. Default: the current calendar month. */
enum class RangeKind { MONTH, YEAR, WEEK, ALL, CUSTOM }

/**
 * The full log of every recorded expense, filtered by a date range (calendar month by default,
 * navigable month by month or year by year, or any custom range) with totals for that range.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    expenses: List<Expense>,
    categories: List<Category>,
    currency: String,
    contentPadding: PaddingValues,
    onEdit: (Expense) -> Unit,
    header: @Composable () -> Unit = {},
) {
    val c = Mz.colors
    val today = LocalDate.now()
    var kind by rememberSaveable { mutableStateOf(RangeKind.MONTH) }
    var anchor by rememberSaveable { mutableStateOf(today.withDayOfMonth(1).toEpochDay()) }
    var customFrom by rememberSaveable { mutableStateOf(today.withDayOfMonth(1).toEpochDay()) }
    var customTo by rememberSaveable { mutableStateOf(today.toEpochDay()) }
    var showPicker by remember { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var needFilter by rememberSaveable { mutableStateOf(0) } // 0 all, 1 needs, 2 wants
    var categoryFilter by rememberSaveable { mutableStateOf<Long?>(null) }
    val byId = categories.associateBy { it.id }

    val a = LocalDate.ofEpochDay(anchor)
    // [from, to] inclusive
    val (from, to) = when (kind) {
        RangeKind.MONTH -> a.withDayOfMonth(1) to a.withDayOfMonth(a.lengthOfMonth())
        RangeKind.YEAR -> a.withDayOfYear(1) to a.withDayOfYear(a.lengthOfYear())
        RangeKind.WEEK -> today.minusDays(6) to today
        RangeKind.ALL -> (expenses.minOfOrNull { it.timestamp }?.toLocalDate() ?: today) to today
        RangeKind.CUSTOM -> LocalDate.ofEpochDay(customFrom) to LocalDate.ofEpochDay(customTo)
    }
    val title = when (kind) {
        RangeKind.MONTH -> monthFmt.format(a)
        RangeKind.YEAR -> "سنة ${a.year}"
        RangeKind.WEEK -> "آخر 7 أيام"
        RangeKind.ALL -> "كل العمليات"
        RangeKind.CUSTOM -> "فترة مخصصة"
    }
    val canStep = kind == RangeKind.MONTH || kind == RangeKind.YEAR
    fun step(dir: Long) {
        anchor = if (kind == RangeKind.MONTH) a.plusMonths(dir).toEpochDay() else a.plusYears(dir).toEpochDay()
    }

    val inRange = remember(expenses, from, to) {
        val f = from.toMillis(); val t = to.plusDays(1).toMillis()
        expenses.filter { it.timestamp in f until t }
    }
    val filtered = remember(inRange, query, needFilter, categoryFilter) {
        val q = Money.normalizeDigits(query.trim())
        inRange.filter { e ->
            (needFilter == 0 || (needFilter == 1) == e.isNeed) &&
                (categoryFilter == null || e.categoryId == categoryFilter) &&
                (q.isEmpty() || e.note.contains(q, true) || (byId[e.categoryId]?.name?.contains(q) == true) ||
                    Money.plain(e.amount).replace(",", "").contains(q))
        }
    }
    val total = filtered.sumOf { it.amount }
    val needs = filtered.filter { it.isNeed }.sumOf { it.amount }
    val days = (ChronoUnit.DAYS.between(from, minOf(to, today)) + 1).coerceAtLeast(1)
    val groups = remember(filtered) { filtered.groupBy { it.timestamp.toLocalDate() }.toSortedMap(compareByDescending { it }) }
    val topCats = filtered.groupBy { it.categoryId }.mapValues { (_, l) -> l.sumOf { it.amount } }.entries.sortedByDescending { it.value }.take(4)

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
    ) {
        item { header() }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(kind == RangeKind.MONTH, { kind = RangeKind.MONTH; anchor = today.withDayOfMonth(1).toEpochDay() }, { Text("📅 الشهر") }) }
                item { FilterChip(kind == RangeKind.YEAR, { kind = RangeKind.YEAR; anchor = today.withDayOfYear(1).toEpochDay() }, { Text("🗓️ السنة") }) }
                item { FilterChip(kind == RangeKind.WEEK, { kind = RangeKind.WEEK }, { Text("آخر 7 أيام") }) }
                item { FilterChip(kind == RangeKind.CUSTOM, { showPicker = true }, { Text("✏️ فترة مخصصة") }) }
                item { FilterChip(kind == RangeKind.ALL, { kind = RangeKind.ALL }, { Text("الكل") }) }
            }
            Spacer(Modifier.height(10.dp))
            // Range header with month/year stepping (RTL: right arrow = previous).
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.card).padding(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (canStep) IconButton(onClick = { step(-1) }) { Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, "السابق") }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(title, style = MaterialTheme.typography.titleMedium)
                    Text("${shortFmt.format(from)} — ${shortFmt.format(to)}", style = MaterialTheme.typography.bodySmall, color = c.muted)
                }
                if (canStep) IconButton(onClick = { step(1) }) { Icon(Icons.AutoMirrored.Outlined.KeyboardArrowLeft, "التالي") }
            }
            Spacer(Modifier.height(12.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Column(Modifier.weight(1f)) {
                        Text("إجمالي المصروف", color = c.muted, style = MaterialTheme.typography.bodySmall)
                        Text(Money.format(total, currency), style = MaterialTheme.typography.headlineSmall, color = c.good)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${filtered.size} عملية", fontWeight = FontWeight.Bold)
                        Text("متوسط ${Money.format(total / days, currency)}/يوم", color = c.muted, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(10.dp))
                SplitBar(needs, total - needs)
                Spacer(Modifier.height(8.dp))
                Row {
                    Box(Modifier.weight(1f)) { LegendDot(c.need, "ضروري", Money.format(needs, currency)) }
                    Box(Modifier.weight(1f)) { LegendDot(c.want, "كمالي", Money.format(total - needs, currency)) }
                }
                if (topCats.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    topCats.forEach { (id, v) ->
                        val cat = byId[id]
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(8.dp).clip(CircleShape).background(Color(cat?.color ?: 0xFF94A3B8)))
                            Spacer(Modifier.width(6.dp))
                            Text("${cat?.emoji ?: ""} ${cat?.name ?: ""}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text(Money.format(v, currency), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                        LinearMeter(if (total > 0) v.toFloat() / total else 0f, Color(cat?.color ?: 0xFF94A3B8), height = 4.dp)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                placeholder = { Text("ابحث بالوصف أو الفئة أو المبلغ") },
                singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(needFilter == 0, { needFilter = 0 }, { Text("الكل") })
                FilterChip(needFilter == 1, { needFilter = 1 }, { Text("✅ ضروري") })
                FilterChip(needFilter == 2, { needFilter = 2 }, { Text("🛍️ كمالي") })
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
        }
        if (filtered.isEmpty()) {
            item {
                Column(Modifier.fillMaxWidth().padding(top = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🗂️", fontSize = 40.sp)
                    Text("لا توجد عمليات في هذه الفترة", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        groups.forEach { (day, list) ->
            item(key = "h$day") {
                Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    val label = when (day) {
                        today -> "اليوم"
                        today.minusDays(1) -> "أمس"
                        else -> dayFmt.format(day)
                    }
                    Text(label, style = MaterialTheme.typography.labelLarge, color = c.muted, modifier = Modifier.weight(1f))
                    Text(Money.format(list.sumOf { it.amount }, currency), style = MaterialTheme.typography.labelLarge, color = c.muted)
                }
            }
            items(list, key = { it.id }) { e -> ExpenseRow(e, byId[e.categoryId], currency, onClick = { onEdit(e) }) }
        }
    }

    if (showPicker) {
        val state = rememberDateRangePickerState(
            initialSelectedStartDateMillis = LocalDate.ofEpochDay(customFrom).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
            initialSelectedEndDateMillis = LocalDate.ofEpochDay(customTo).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val s = state.selectedStartDateMillis
                    val e = state.selectedEndDateMillis ?: s
                    if (s != null && e != null) {
                        customFrom = Instant.ofEpochMilli(s).atZone(ZoneOffset.UTC).toLocalDate().toEpochDay()
                        customTo = Instant.ofEpochMilli(e).atZone(ZoneOffset.UTC).toLocalDate().toEpochDay()
                        kind = RangeKind.CUSTOM
                    }
                    showPicker = false
                }) { Text("تم") }
            },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("إلغاء") } },
        ) {
            DateRangePicker(state = state, modifier = Modifier.weight(1f), title = { Text("اختر الفترة", modifier = Modifier.padding(16.dp)) })
        }
    }
}
