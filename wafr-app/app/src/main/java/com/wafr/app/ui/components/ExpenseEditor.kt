package com.wafr.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Category
import com.wafr.app.data.Expense
import com.wafr.app.domain.CategoryDetector
import com.wafr.app.domain.Money
import com.wafr.app.domain.Suggestion
import com.wafr.app.domain.toLocalDate
import com.wafr.app.domain.toMillis
import com.wafr.app.ui.theme.Mz
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * The 3-second entry sheet: keypad, need/want switch, category chips, note and date.
 * Used inside the app, from the widget, the quick-settings tile and notifications.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseEditor(
    categories: List<Category>,
    currency: String,
    initial: Expense? = null,
    presetNeed: Boolean? = null,
    categorySpent: Map<Long, Long> = emptyMap(),
    suggestions: List<Suggestion> = emptyList(),
    onSave: (amount: Long, isNeed: Boolean, categoryId: Long?, note: String, timestamp: Long) -> Unit,
    onDelete: (() -> Unit)? = null,
    onClose: () -> Unit,
) {
    val c = Mz.colors
    val haptic = LocalHapticFeedback.current
    var amountText by rememberSaveable { mutableStateOf(initial?.let { Money.plain(it.amount).replace(",", "") } ?: "") }
    var note by rememberSaveable { mutableStateOf(initial?.note ?: "") }
    var categoryId by rememberSaveable { mutableStateOf(initial?.categoryId) }
    var manualCategory by rememberSaveable { mutableStateOf(initial != null) }
    var need by rememberSaveable { mutableStateOf(initial?.isNeed ?: presetNeed) }
    var dateMillis by rememberSaveable { mutableStateOf(initial?.timestamp?.toLocalDate()?.toMillis() ?: LocalDate.now().toMillis()) }
    var showDatePicker by remember { mutableStateOf(false) }

    val selectedCategory = categories.firstOrNull { it.id == categoryId }
    val effectiveNeed = need ?: selectedCategory?.defaultNeed ?: true
    val accent by animateColorAsState(if (effectiveNeed) c.need else c.want, label = "accent")
    val amountMinor = amountText.toDoubleOrNull()?.let { Money.toMinor(it) } ?: 0L
    val today = LocalDate.now().toMillis()

    fun press(key: String) {
        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        amountText = when (key) {
            "⌫" -> amountText.dropLast(1)
            "." -> if (amountText.contains('.')) amountText else (amountText.ifEmpty { "0" } + ".")
            else -> {
                val dot = amountText.indexOf('.')
                when {
                    dot >= 0 && amountText.length - dot > 2 -> amountText
                    dot < 0 && amountText.length >= 9 -> amountText
                    amountText == "0" -> key
                    else -> amountText + key
                }
            }
        }
    }

    // Compact layout for short screens / large font sizes so everything fits.
    val compact = LocalConfiguration.current.screenHeightDp / LocalDensity.current.fontScale < 760
    val keyHeight = if (compact) 40.dp else 54.dp
    val gap = if (compact) 6.dp else 10.dp
    // The save button lives outside the scrollable area so it is ALWAYS visible.
    Column(Modifier.fillMaxWidth()) {
    Column(
        Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (initial == null) "مصروف جديد" else "تعديل المصروف", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
            if (onDelete != null) IconButton(onClick = onDelete) { Icon(Icons.Outlined.DeleteOutline, "حذف", tint = c.danger) }
            IconButton(onClick = onClose) { Icon(Icons.Outlined.Close, "إغلاق") }
        }

        if (initial == null && suggestions.isNotEmpty()) {
            Text("⚡ تسجيل بلمسة", style = MaterialTheme.typography.labelMedium, color = c.muted)
            Spacer(Modifier.height(6.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(suggestions) { sg ->
                    val cat = categories.firstOrNull { it.id == sg.categoryId }
                    FilterChip(
                        selected = false,
                        onClick = { onSave(sg.amount, sg.isNeed, sg.categoryId, sg.note, System.currentTimeMillis()) },
                        label = { Text("${cat?.emoji ?: ""} ${sg.note} • ${Money.plain(sg.amount)}") },
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
        }

        // Amount
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Bottom) {
                Text(
                    amountText.ifEmpty { "0" }, fontSize = if (compact) 36.sp else 52.sp, fontWeight = FontWeight.ExtraBold, color = accent,
                    maxLines = 1,
                )
                Spacer(Modifier.width(8.dp))
                Text(currency, style = MaterialTheme.typography.titleLarge, color = accent.copy(alpha = 0.7f), modifier = Modifier.padding(bottom = 10.dp))
            }
        }

        // Need / want
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NeedOption("✅", "ضروري", "لا غنى عنه", effectiveNeed, c.need, Modifier.weight(1f), compact) { need = true }
            NeedOption("🛍️", "كمالي", "أقدر أستغني عنه", !effectiveNeed, c.want, Modifier.weight(1f), compact) { need = false }
        }
        Spacer(Modifier.height(gap))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(vertical = 2.dp)) {
            items(categories, key = { it.id }) { cat ->
                FilterChip(
                    selected = cat.id == categoryId,
                    onClick = { categoryId = cat.id; manualCategory = true },
                    label = { Text("${cat.emoji} ${cat.name}") },
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = note,
            onValueChange = {
                note = it
                if (!manualCategory) CategoryDetector.detect(it, categories)?.let { cat -> categoryId = cat.id }
            },
            placeholder = { Text("وصف (اختياري) — مثال: قهوة، بنزين") },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        val yesterday = LocalDate.now().minusDays(1).toMillis()
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = dateMillis == today, onClick = { dateMillis = today }, label = { Text("اليوم") })
            FilterChip(selected = dateMillis == yesterday, onClick = { dateMillis = yesterday }, label = { Text("أمس") })
            val other = dateMillis != today && dateMillis != yesterday
            FilterChip(
                selected = other, onClick = { showDatePicker = true },
                label = { Text(if (other) dateMillis.toLocalDate().let { "${it.dayOfMonth}/${it.monthValue}" } else "تاريخ آخر 📅") },
            )
        }
        Spacer(Modifier.height(10.dp))

        // Live category budget check: warn before the user commits.
        selectedCategory?.takeIf { it.monthlyLimit > 0 && amountMinor > 0 }?.let { cat ->
            val already = (categorySpent[cat.id] ?: 0L) - (if (initial?.categoryId == cat.id) initial?.amount ?: 0L else 0L)
            val after = already + amountMinor
            val (msg, color) = when {
                after > cat.monthlyLimit -> "🚨 هذا المبلغ يتجاوز ميزانية «${cat.name}» بـ ${Money.format(after - cat.monthlyLimit, currency)}" to c.danger
                after * 100 >= cat.monthlyLimit * 80 -> "⚠️ بعد هذا المبلغ يتبقى ${Money.format(cat.monthlyLimit - after, currency)} فقط في «${cat.name}»" to c.want
                else -> "✓ ضمن ميزانية «${cat.name}» — يتبقى ${Money.format(cat.monthlyLimit - after, currency)}" to c.good
            }
            Text(
                msg, color = color, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(color.copy(alpha = 0.12f)).padding(10.dp),
            )
            Spacer(Modifier.height(10.dp))
        }

        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Column(verticalArrangement = Arrangement.spacedBy(if (compact) 5.dp else 8.dp)) {
                listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf(".", "0", "⌫")).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { k ->
                            Box(
                                Modifier.weight(1f).height(keyHeight).clip(RoundedCornerShape(16.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                                    .clickable { press(k) },
                                contentAlignment = Alignment.Center,
                            ) {
                                if (k == "⌫") Icon(Icons.AutoMirrored.Outlined.Backspace, "مسح")
                                else Text(k, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
        Button(
            onClick = {
                val ts = when {
                    initial != null && initial.timestamp.toLocalDate().toMillis() == dateMillis -> initial.timestamp
                    dateMillis == today -> System.currentTimeMillis()
                    else -> dateMillis + 12 * 3_600_000L
                }
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                onSave(amountMinor, effectiveNeed, categoryId, note.trim(), ts)
            },
            enabled = amountMinor > 0,
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 12.dp).height(56.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color(0xFF02101A)),
        ) {
            Text(
                if (amountMinor > 0) "سجّل ${Money.format(amountMinor, currency)}" else "أدخل المبلغ",
                fontWeight = FontWeight.Bold, fontSize = 17.sp,
            )
        }
    }

    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = dateMillis.toLocalDate().atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        val d = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                        dateMillis = d.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    }
                    showDatePicker = false
                }) { Text("تم") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("إلغاء") } },
        ) { DatePicker(state = state) }
    }
}

@Composable
private fun NeedOption(emoji: String, title: String, subtitle: String, selected: Boolean, color: Color, modifier: Modifier, compact: Boolean, onClick: () -> Unit) {
    OutlinedBox(modifier.height(if (compact) 50.dp else 64.dp).clickable(onClick = onClick), selected = selected, color = color) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(emoji, fontSize = 22.sp)
            Spacer(Modifier.width(8.dp))
            Column {
                Text(title, fontWeight = FontWeight.Bold, color = if (selected) color else MaterialTheme.colorScheme.onSurface)
                Text(subtitle, fontSize = 11.sp, color = Mz.colors.muted)
            }
        }
    }
}
