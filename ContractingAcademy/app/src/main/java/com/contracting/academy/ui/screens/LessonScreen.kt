package com.contracting.academy.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.TipsAndUpdates
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Block
import com.contracting.academy.data.Source
import com.contracting.academy.data.money
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.LevelChip
import com.contracting.academy.ui.theme.Danger
import com.contracting.academy.ui.theme.Gold
import com.contracting.academy.ui.theme.Success
import kotlin.math.abs

/** نص بسيط يدعم **الخط العريض**. */
fun rich(text: String): AnnotatedString = buildAnnotatedString {
    val parts = text.split("**")
    parts.forEachIndexed { i, p ->
        if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(p) } else append(p)
    }
}

@Composable
fun LessonScreen(id: String, nav: Nav) {
    val content = App.content
    val progress = App.progress
    val lesson = content.lessons[id] ?: return
    val track = content.track(lesson.track)
    val next = content.nextLesson(id)
    val done = progress.isDone(id)
    val marked = id in progress.bookmarks

    LaunchedEffect(id) { progress.openLesson(id) }

    Scaffold(
        topBar = {
            AppBar(track?.title ?: "درس", onBack = { nav.back() }) {
                IconButton(onClick = { progress.toggleBookmark(id) }) {
                    Icon(
                        if (marked) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                        contentDescription = "حفظ في المفضلة",
                    )
                }
            }
        },
    ) { pad ->
        LazyColumn(
            Modifier.padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Column {
                    Text(lesson.title, style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LevelChip(lesson.level)
                        Text("⏱ ${lesson.minutes} دقائق قراءة", style = MaterialTheme.typography.labelMedium)
                        if (done) Text("✔ مكتمل", color = Success, style = MaterialTheme.typography.labelMedium)
                    }
                    if (lesson.summary.isNotBlank()) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            rich(lesson.summary),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            items(lesson.blocks) { BlockView(it) }

            val refs = lesson.sources.mapNotNull { content.sources[it] }
            if (refs.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("المراجع المعتمدة لهذا الدرس", style = MaterialTheme.typography.titleMedium)
                        refs.forEach { SourceCard(it) }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    HorizontalDivider()
                    if (lesson.quiz.isNotEmpty()) {
                        Button(onClick = { nav.quiz(id) }, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Filled.Quiz, null)
                            Spacer(Modifier.width(8.dp))
                            Text("اختبر فهمك (${lesson.quiz.size} أسئلة)")
                        }
                    }
                    OutlinedButton(onClick = { progress.setDone(id, !done) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Filled.CheckCircle, null, tint = if (done) Success else MaterialTheme.colorScheme.outline)
                        Spacer(Modifier.width(8.dp))
                        Text(if (done) "تم إنهاء الدرس (إلغاء)" else "أنهيت هذا الدرس")
                    }
                    if (next != null) {
                        Button(
                            onClick = { nav.replaceLesson(next.id) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        ) {
                            Text("الدرس التالي: ${next.title}", maxLines = 1)
                            Spacer(Modifier.width(8.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
                        }
                    }
                    Text(
                        "المحتوى تعليمي ومبني على المعايير والأنظمة المذكورة؛ راجع النص الرسمي المحدَّث قبل أي تطبيق مهني.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
fun SourceCard(s: Source) {
    val uri = LocalUriHandler.current
    OutlinedCard(
        onClick = { if (s.url.isNotBlank()) runCatching { uri.openUri(s.url) } },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Link, null, tint = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(s.title, style = MaterialTheme.typography.titleSmall)
                Text(
                    listOf(s.issuer, s.type).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
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
private fun Bullets(items: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach {
            Row {
                Text("•", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.width(8.dp))
                Text(rich(it), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
fun BlockView(b: Block) {
    val cs = MaterialTheme.colorScheme
    when (b.type) {
        "simple" -> Callout(Icons.Filled.Lightbulb, b.title.ifBlank { "ببساطة" }, cs.secondary, cs.secondaryContainer) {
            Body(b.text); if (b.items.isNotEmpty()) Bullets(b.items)
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
                            Icon(
                                Icons.Filled.Folder,
                                null,
                                tint = if (depth == 0) Gold else cs.secondary,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(rich(line.trim()), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
        "points" -> Column {
            if (b.title.isNotBlank()) BlockTitle(b.title)
            Body(b.text)
            Bullets(b.items)
        }
        else -> Column {
            if (b.title.isNotBlank()) BlockTitle(b.title)
            Body(b.text)
            if (b.items.isNotEmpty()) Bullets(b.items)
        }
    }
}

@Composable
private fun BlockTitle(t: String) {
    Text(t, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 6.dp))
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
                // الطرف الدائن يُزاح قليلاً كما في دفتر اليومية التقليدي
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
                    if (row.isEmpty()) return@forEachIndexed
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
