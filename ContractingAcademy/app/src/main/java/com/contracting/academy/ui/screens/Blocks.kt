package com.contracting.academy.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiObjects
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Functions
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.TipsAndUpdates
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.contracting.academy.data.Block
import com.contracting.academy.data.money
import com.contracting.academy.ui.components.BranchColors
import com.contracting.academy.ui.components.MindMapPreview
import com.contracting.academy.ui.theme.Danger
import com.contracting.academy.ui.theme.Gold
import com.contracting.academy.ui.theme.Success
import kotlin.math.abs

/** نص بسيط يدعم **الخط العريض**. */
fun rich(text: String): AnnotatedString = buildAnnotatedString {
    text.split("**").forEachIndexed { i, p ->
        if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(p) } else append(p)
    }
}

@Composable
private fun Callout(
    icon: ImageVector,
    label: String,
    color: Color,
    container: Color,
    border: Boolean = false,
    body: @Composable () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = container),
        border = if (border) BorderStroke(1.5.dp, color) else null,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(label, color = color, style = MaterialTheme.typography.titleSmall)
            }
            Spacer(Modifier.height(6.dp))
            body()
        }
    }
}

@Composable
private fun Body(text: String) {
    if (text.isNotBlank()) Text(rich(text), style = MaterialTheme.typography.bodyLarge)
}

@Composable
private fun Bullets(items: List<String>, color: Color = MaterialTheme.colorScheme.secondary) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach {
            Row {
                Text("•", color = color, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.width(8.dp))
                Text(rich(it), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
private fun BlockTitle(t: String) {
    Text(t, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
fun BlockView(b: Block, onOpenMap: () -> Unit = {}) {
    val cs = MaterialTheme.colorScheme
    when (b.type) {
        "mindmap" -> b.map?.let { root ->
            OutlinedCard(onClick = onOpenMap, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.AccountTree, null, tint = cs.primary, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(b.title.ifBlank { "الخريطة الذهنية للدرس" }, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Icon(Icons.Filled.OpenInFull, "ملء الشاشة", tint = cs.primary, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.height(10.dp))
                    MindMapPreview(root, Modifier.fillMaxWidth())
                    Text(
                        "اضغط لفتح الخريطة بملء الشاشة مع التكبير",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.onSurfaceVariant,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }
        "simple" -> Callout(Icons.Filled.Lightbulb, b.title.ifBlank { "ببساطة" }, cs.secondary, cs.secondaryContainer) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
        }
        "analogy" -> Callout(Icons.Filled.EmojiObjects, b.title.ifBlank { "تشبيه من الواقع" }, Color(0xFF6A4C93), Color(0xFF6A4C93).copy(alpha = 0.09f)) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items, Color(0xFF6A4C93))
        }
        "example" -> Callout(Icons.Filled.Edit, b.title.ifBlank { "مثال عملي" }, cs.primary, cs.primaryContainer.copy(alpha = 0.5f)) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
        }
        "tip" -> Callout(Icons.Filled.TipsAndUpdates, b.title.ifBlank { "نصيحة عملية" }, Success, Success.copy(alpha = 0.08f)) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
        }
        "warning" -> Callout(Icons.Filled.Warning, b.title.ifBlank { "تنبيه" }, Danger, Danger.copy(alpha = 0.07f)) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
        }
        "expert" -> Callout(Icons.Filled.WorkspacePremium, b.title.ifBlank { "للخبير والمحترف" }, Gold, cs.surface, border = true) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
        }
        "summary" -> Callout(Icons.Filled.TaskAlt, b.title.ifBlank { "الخلاصة — احفظ هذه النقاط" }, cs.primary, cs.surface, border = true) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                b.items.forEachIndexed { i, s ->
                    Row(verticalAlignment = Alignment.Top) {
                        Box(
                            Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(BranchColors[i % BranchColors.size]),
                            contentAlignment = Alignment.Center,
                        ) { Text("${i + 1}", color = Color.White, style = MaterialTheme.typography.labelMedium) }
                        Spacer(Modifier.width(10.dp))
                        Text(rich(s), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        "mistakes" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BlockTitle(b.title.ifBlank { "أخطاء شائعة وتصحيحها" })
            b.rows.forEach { r ->
                Card(Modifier.fillMaxWidth()) {
                    Column {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(Danger.copy(alpha = 0.08f))
                                .padding(12.dp),
                        ) {
                            Icon(Icons.Filled.Cancel, null, tint = Danger, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(rich(r.getOrElse(0) { "" }), style = MaterialTheme.typography.bodyMedium)
                        }
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(Success.copy(alpha = 0.08f))
                                .padding(12.dp),
                        ) {
                            Icon(Icons.Filled.CheckCircle, null, tint = Success, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(rich(r.getOrElse(1) { "" }), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
        "flow" -> FlowView(b)
        "compare" -> CompareView(b)
        "formula" -> Card(
            colors = CardDefaults.cardColors(containerColor = cs.primary),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Functions, null, tint = cs.onPrimary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(b.title.ifBlank { "القاعدة" }, color = cs.onPrimary.copy(alpha = 0.8f), style = MaterialTheme.typography.labelLarge)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    rich(b.text),
                    color = cs.onPrimary,
                    style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp, lineHeight = 30.sp),
                    textAlign = TextAlign.Center,
                )
                if (b.items.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = cs.onPrimary.copy(alpha = 0.3f))
                    Spacer(Modifier.height(8.dp))
                    b.items.forEach {
                        Text(rich(it), color = cs.onPrimary, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
        "taccount" -> TAccountView(b)
        "entry" -> EntryView(b)
        "table" -> TableView(b)
        "steps" -> Column {
            if (b.title.isNotBlank()) BlockTitle(b.title)
            Body(b.text)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                b.items.forEachIndexed { i, s ->
                    Row {
                        Box(
                            Modifier
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(cs.primary),
                            contentAlignment = Alignment.Center,
                        ) { Text("${i + 1}", color = cs.onPrimary, style = MaterialTheme.typography.labelMedium) }
                        Spacer(Modifier.width(10.dp))
                        Text(rich(s), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        "tree" -> Column {
            if (b.title.isNotBlank()) BlockTitle(b.title)
            Body(b.text)
            Card(colors = CardDefaults.cardColors(containerColor = cs.surfaceVariant), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    b.items.forEach { line ->
                        val depth = line.takeWhile { it == ' ' }.length / 2
                        Row(Modifier.padding(start = (depth * 18).dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Folder, null, tint = if (depth == 0) Gold else cs.secondary, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(rich(line.trim()), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
        else -> Column {
            if (b.title.isNotBlank()) BlockTitle(b.title)
            Body(b.text)
            if (b.items.isNotEmpty()) Bullets(b.items)
        }
    }
}

/** مخطط انسيابي عمودي: صناديق متتابعة بأسهم. */
@Composable
private fun FlowView(b: Block) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        BlockTitle("🔀 " + b.title.ifBlank { "المخطط الانسيابي" })
        b.items.forEachIndexed { i, s ->
            val c = BranchColors[i % BranchColors.size]
            Row(
                Modifier
                    .fillMaxWidth(0.92f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(c.copy(alpha = 0.12f))
                    .border(1.5.dp, c, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(c),
                    contentAlignment = Alignment.Center,
                ) { Text("${i + 1}", color = Color.White, style = MaterialTheme.typography.labelLarge) }
                Spacer(Modifier.width(10.dp))
                Text(rich(s), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            }
            if (i < b.items.lastIndex) {
                Icon(Icons.Filled.ArrowDownward, null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(vertical = 2.dp))
            }
        }
        if (b.note.isNotBlank()) {
            Text(rich(b.note), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

/** مقارنة بين مفهومين في عمودين متقابلين. */
@Composable
private fun CompareView(b: Block) {
    val a = BranchColors[0]
    val c = BranchColors[1]
    Column {
        BlockTitle("⚖ " + b.title.ifBlank { "مقارنة" })
        Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0 to a, 1 to c).forEach { (col, color) ->
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.5.dp, color, RoundedCornerShape(12.dp))
                ) {
                    Text(
                        b.headers.getOrElse(col) { "" },
                        color = Color.White,
                        style = MaterialTheme.typography.titleSmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(color)
                            .padding(10.dp),
                    )
                    b.rows.forEachIndexed { i, r ->
                        Text(
                            rich(r.getOrElse(col) { "" }),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(if (i % 2 == 0) color.copy(alpha = 0.07f) else Color.Transparent)
                                .padding(10.dp),
                        )
                    }
                }
            }
        }
    }
}

/** حساب على شكل حرف T: المدين يميناً والدائن يساراً. */
@Composable
private fun TAccountView(b: Block) {
    val cs = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth()) {
        BlockTitle("📊 حساب T: " + b.title)
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline, RoundedCornerShape(10.dp))
                .padding(10.dp)
        ) {
            Row {
                Text("مدين", Modifier.weight(1f), color = Success, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("دائن", Modifier.weight(1f), color = Danger, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            }
            HorizontalDivider(thickness = 2.dp, color = cs.onSurface)
            Row(Modifier.height(IntrinsicSize.Min)) {
                Column(Modifier.weight(1f).padding(end = 6.dp)) {
                    b.rows.filter { it.getOrElse(1) { "" }.isNotBlank() }.forEach { r -> TLine(r[0], r[1]) }
                }
                Box(
                    Modifier
                        .width(2.dp)
                        .fillMaxHeight()
                        .background(cs.onSurface)
                )
                Column(Modifier.weight(1f).padding(start = 6.dp)) {
                    b.rows.filter { it.getOrElse(2) { "" }.isNotBlank() }.forEach { r -> TLine(r[0], r[2]) }
                }
            }
            if (b.note.isNotBlank()) {
                HorizontalDivider(Modifier.padding(vertical = 6.dp))
                Text(rich(b.note), style = MaterialTheme.typography.labelLarge, color = cs.primary)
            }
        }
    }
}

@Composable
private fun TLine(label: String, amount: String) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(amount, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun EntryView(b: Block) {
    val cs = MaterialTheme.colorScheme
    val totalD = b.lines.sumOf { it.debit }
    val totalC = b.lines.sumOf { it.credit }
    val balanced = abs(totalD - totalC) < 0.005
    Column {
        BlockTitle("📒 " + b.title.ifBlank { "القيد المحاسبي" })
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, cs.outline, RoundedCornerShape(10.dp))
        ) {
            EntryRow("البيان", "مدين", "دائن", header = true)
            b.lines.forEach { l ->
                val acc = if (l.credit > 0 && l.debit == 0.0) "      إلى حـ/ ${l.account}" else "من حـ/ ${l.account}"
                EntryRow(acc, if (l.debit != 0.0) money(l.debit) else "", if (l.credit != 0.0) money(l.credit) else "")
            }
            EntryRow("الإجمالي", money(totalD), money(totalC), total = true)
        }
        Text(
            if (balanced) "✔ القيد متوازن: مجموع المدين = مجموع الدائن" else "✖ القيد غير متوازن",
            color = if (balanced) Success else Danger,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (b.note.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(rich(b.note), style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant)
        }
    }
}

@Composable
private fun EntryRow(a: String, d: String, c: String, header: Boolean = false, total: Boolean = false) {
    val cs = MaterialTheme.colorScheme
    val bg = when {
        header -> cs.primary
        total -> cs.surfaceVariant
        else -> cs.surface
    }
    val fg = if (header) cs.onPrimary else cs.onSurface
    val style = if (header || total) MaterialTheme.typography.labelLarge else MaterialTheme.typography.bodyMedium
    Row(
        Modifier
            .fillMaxWidth()
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(a, color = fg, style = style, modifier = Modifier.weight(1.6f))
        Text(d, color = fg, style = style, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        Text(c, color = fg, style = style, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
    }
}

@Composable
private fun TableView(b: Block) {
    val cs = MaterialTheme.colorScheme
    Column {
        if (b.title.isNotBlank()) BlockTitle(b.title)
        Body(b.text)
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, cs.outline, RoundedCornerShape(10.dp))
                .horizontalScroll(rememberScrollState())
        ) {
            Column {
                val all = listOf(b.headers) + b.rows
                all.forEachIndexed { r, row ->
                    if (row.isNotEmpty()) {
                        val header = r == 0 && b.headers.isNotEmpty()
                        Row(
                            Modifier.background(
                                when {
                                    header -> cs.primary
                                    r % 2 == 0 -> cs.surfaceVariant
                                    else -> cs.surface
                                }
                            )
                        ) {
                            row.forEachIndexed { ci, cell ->
                                Text(
                                    rich(cell),
                                    color = if (header) cs.onPrimary else cs.onSurface,
                                    style = if (header || ci == 0) MaterialTheme.typography.labelLarge else MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier
                                        .width(if (ci == 0) 150.dp else 170.dp)
                                        .widthIn(min = 120.dp)
                                        .padding(10.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
