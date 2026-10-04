package com.wafr.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Category
import com.wafr.app.data.DefaultCategories
import com.wafr.app.data.Goal
import com.wafr.app.domain.Money

fun parseAmount(text: String): Long? =
    Money.normalizeDigits(text).replace(",", "").trim().toDoubleOrNull()?.takeIf { it >= 0 }?.let { Money.toMinor(it) }

fun amountText(minor: Long): String = if (minor == 0L) "" else Money.plain(minor).replace(",", "")

@Composable
fun AmountField(value: String, onChange: (String) -> Unit, label: String, suffix: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, suffix = { Text(suffix) },
        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        shape = RoundedCornerShape(16.dp), modifier = modifier.fillMaxWidth(),
    )
}

@Composable
fun AmountDialog(title: String, initial: Long, currency: String, hint: String? = null, onDismiss: () -> Unit, onConfirm: (Long) -> Unit) {
    var text by remember { mutableStateOf(amountText(initial)) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                AmountField(text, { text = it }, "المبلغ", currency)
                if (hint != null) { Spacer(Modifier.height(8.dp)); Text(hint, fontSize = 12.sp) }
            }
        },
        confirmButton = { TextButton(onClick = { parseAmount(text)?.let(onConfirm) }) { Text("حفظ") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

private val emojis = listOf("🛒", "☕", "⛽", "🏠", "🛍️", "💊", "🎮", "📚", "🎁", "✨", "🍔", "🚗", "📱", "✈️", "🐱", "💇", "🏋️", "🕌", "👶", "💡", "🧾", "🎓", "🍰", "🚬")

@Composable
fun CategoryDialog(initial: Category?, currency: String, onDismiss: () -> Unit, onArchive: (() -> Unit)?, onSave: (Category) -> Unit) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var emoji by remember { mutableStateOf(initial?.emoji ?: "✨") }
    var color by remember { mutableStateOf(initial?.color ?: DefaultCategories.palette.random()) }
    var limit by remember { mutableStateOf(amountText(initial?.monthlyLimit ?: 0L)) }
    var need by remember { mutableStateOf(initial?.defaultNeed ?: true) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "فئة جديدة" else "تعديل الفئة") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("الاسم") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth())
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(emojis) { e ->
                        Box(
                            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                                .background(if (e == emoji) Color(color).copy(alpha = 0.3f) else Color.Transparent)
                                .clickable { emoji = e },
                            contentAlignment = androidx.compose.ui.Alignment.Center,
                        ) { Text(e, fontSize = 20.sp) }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DefaultCategories.palette.forEach { p ->
                        Box(
                            Modifier.size(22.dp).clip(CircleShape).background(Color(p))
                                .border(if (p == color) 3.dp else 0.dp, Color.White, CircleShape)
                                .clickable { color = p },
                        )
                    }
                }
                AmountField(limit, { limit = it }, "حد شهري (اختياري)", currency)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(need, { need = true }, { Text("✅ ضروري افتراضياً") })
                    FilterChip(!need, { need = false }, { Text("🛍️ كمالي") })
                }
                if (onArchive != null) {
                    TextButton(onClick = onArchive) { Text("حذف الفئة (تنتقل مصاريفها إلى «أخرى»)", color = Color(0xFFFF5C7A)) }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank(),
                onClick = {
                    val base = initial ?: Category(name = name, emoji = emoji, color = color, sortOrder = 50)
                    onSave(base.copy(name = name.trim(), emoji = emoji, color = color, monthlyLimit = parseAmount(limit) ?: 0L, defaultNeed = need))
                },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

private val goalEmojis = listOf("🎯", "🚗", "🏠", "✈️", "💍", "📱", "💻", "🎓", "🕋", "🛟", "👶", "🏖️")

@Composable
fun GoalDialog(initial: Goal?, currency: String, onDismiss: () -> Unit, onDelete: (() -> Unit)?, onSave: (Goal) -> Unit) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var emoji by remember { mutableStateOf(initial?.emoji ?: "🎯") }
    var target by remember { mutableStateOf(amountText(initial?.target ?: 0L)) }
    var deposit by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "هدف ادخار جديد" else "${initial.emoji} ${initial.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (initial == null) {
                    OutlinedTextField(name, { name = it }, label = { Text("اسم الهدف") }, placeholder = { Text("مثال: سيارة، عمرة، صندوق طوارئ") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth())
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(goalEmojis) { e ->
                            Box(
                                Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                                    .background(if (e == emoji) Color(0x3300F5C4) else Color.Transparent)
                                    .clickable { emoji = e },
                                contentAlignment = androidx.compose.ui.Alignment.Center,
                            ) { Text(e, fontSize = 20.sp) }
                        }
                    }
                }
                AmountField(target, { target = it }, "المبلغ المستهدف", currency)
                if (initial != null) {
                    Text("المدّخر حتى الآن: ${Money.format(initial.saved, currency)}")
                    AmountField(deposit, { deposit = it }, "إيداع جديد (أو سالب للسحب)", currency)
                    if (onDelete != null) TextButton(onClick = onDelete) { Text("حذف الهدف", color = Color(0xFFFF5C7A)) }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = (initial != null || name.isNotBlank()) && (parseAmount(target) ?: 0L) > 0,
                onClick = {
                    val t = parseAmount(target) ?: 0L
                    val dep = Money.normalizeDigits(deposit).replace(",", "").trim().toDoubleOrNull()?.let { Money.toMinor(it) } ?: 0L
                    val g = initial?.copy(target = t, saved = (initial.saved + dep).coerceAtLeast(0))
                        ?: Goal(name = name.trim(), emoji = emoji, target = t)
                    onSave(g)
                },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

private val billEmojis = listOf("🏠", "💡", "💧", "🌐", "📱", "🚗", "🎓", "🏥", "📺", "🏋️", "💳", "🧾")

@Composable
fun BillDialog(initial: com.wafr.app.data.Bill?, categories: List<Category>, currency: String, onDismiss: () -> Unit, onDelete: (() -> Unit)?, onSave: (com.wafr.app.data.Bill) -> Unit) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var emoji by remember { mutableStateOf(initial?.emoji ?: "🧾") }
    var amount by remember { mutableStateOf(amountText(initial?.amount ?: 0L)) }
    var day by remember { mutableStateOf((initial?.dayOfMonth ?: 1).toFloat()) }
    var catId by remember { mutableStateOf(initial?.categoryId ?: (categories.firstOrNull { it.name == "فواتير وسكن" } ?: categories.firstOrNull())?.id ?: 0L) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "التزام شهري جديد" else "تعديل الالتزام") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("الاسم") }, placeholder = { Text("إيجار، إنترنت، قسط…") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth())
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(billEmojis) { e ->
                        Box(
                            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                                .background(if (e == emoji) Color(0x3300F5C4) else Color.Transparent)
                                .clickable { emoji = e },
                            contentAlignment = androidx.compose.ui.Alignment.Center,
                        ) { Text(e, fontSize = 20.sp) }
                    }
                }
                AmountField(amount, { amount = it }, "المبلغ الشهري", currency)
                Text("يوم الاستحقاق: ${day.toInt()}")
                androidx.compose.material3.Slider(day, { day = it }, valueRange = 1f..31f, steps = 29)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(categories) { c -> FilterChip(c.id == catId, { catId = c.id }, { Text("${c.emoji} ${c.name}") }) }
                }
                if (onDelete != null) TextButton(onClick = onDelete) { Text("حذف الالتزام", color = Color(0xFFFF4D6D)) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && (parseAmount(amount) ?: 0L) > 0,
                onClick = {
                    val a = parseAmount(amount) ?: 0L
                    val b = initial?.copy(name = name.trim(), emoji = emoji, amount = a, dayOfMonth = day.toInt(), categoryId = catId)
                        ?: com.wafr.app.data.Bill(name = name.trim(), emoji = emoji, amount = a, dayOfMonth = day.toInt(), categoryId = catId)
                    onSave(b)
                },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

@Composable
fun WishDialog(currency: String, onDismiss: () -> Unit, onSave: (String, Long) -> Unit) {
    var name by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🧊 فكّر قبل الشراء") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("ضع الشيء الذي تريد شراءه هنا، وسأذكّرك بعد 48 ساعة. أغلب الرغبات الاندفاعية تختفي خلال يومين!", fontSize = 13.sp)
                OutlinedTextField(name, { name = it }, label = { Text("ماذا تريد أن تشتري؟") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth())
                AmountField(amount, { amount = it }, "السعر", currency)
            }
        },
        confirmButton = {
            TextButton(enabled = name.isNotBlank() && (parseAmount(amount) ?: 0L) > 0, onClick = { onSave(name.trim(), parseAmount(amount) ?: 0L) }) { Text("أضف") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}
