package com.contracting.academy.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Flashcard
import com.contracting.academy.data.Lesson
import com.contracting.academy.data.Practice
import com.contracting.academy.data.Source
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.LevelChip
import com.contracting.academy.ui.components.MindMapViewer
import com.contracting.academy.ui.theme.Danger
import com.contracting.academy.ui.theme.Success

private val tabTitles = listOf("الشرح", "الخريطة", "البطاقات", "تدرّب")

@Composable
fun LessonScreen(id: String, nav: Nav) {
    val content = App.content
    val progress = App.progress
    val lesson = content.lessons[id] ?: return
    val track = content.track(lesson.track)
    val marked = id in progress.bookmarks
    var tab by rememberSaveable(id) { mutableIntStateOf(0) }

    LaunchedEffect(id) { progress.openLesson(id) }

    Scaffold(
        topBar = {
            AppBar(track?.title ?: "درس", onBack = { nav.back() }) {
                IconButton(onClick = { progress.toggleBookmark(id) }) {
                    Icon(if (marked) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder, contentDescription = "حفظ في المفضلة")
                }
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad)) {
            TabRow(selectedTabIndex = tab) {
                tabTitles.forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) })
                }
            }
            when (tab) {
                0 -> ExplainTab(lesson, nav, Color(track?.color ?: 0xFF1F3A5F)) { tab = 1 }
                1 -> MapTab(lesson, nav)
                2 -> CardsTab(lesson)
                else -> PracticeTab(lesson, nav)
            }
        }
    }
}

@Composable
private fun LessonHeader(lesson: Lesson, color: Color) {
    val unit = App.content.track(lesson.track)?.units?.firstOrNull { lesson.id in it.lessonIds }?.title
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(color, color.copy(alpha = 0.75f))))
            .padding(16.dp)
    ) {
        if (unit != null) Text(unit, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelMedium)
        Text(lesson.title, color = Color.White, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.clip(RoundedCornerShape(50)).background(Color.White)) { LevelChip(lesson.level) }
            Text("⏱ ${lesson.minutes} دقائق", color = Color.White, style = MaterialTheme.typography.labelMedium)
            if (App.progress.isDone(lesson.id)) Text("✔ مكتمل", color = Color.White, style = MaterialTheme.typography.labelMedium)
        }
        if (lesson.summary.isNotBlank()) {
            Spacer(Modifier.height(10.dp))
            Text(rich(lesson.summary), color = Color.White, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun MethodsRow(lesson: Lesson) {
    val types = lesson.blocks.map { it.type }.toSet()
    val methods = buildList {
        if ("mindmap" in types) add("🧠 خريطة ذهنية")
        if ("analogy" in types) add("💡 تشبيه")
        if ("flow" in types) add("🔀 مخطط")
        if ("compare" in types) add("⚖ مقارنة")
        if ("example" in types) add("✍ أمثلة")
        if ("entry" in types || "taccount" in types) add("📒 قيود")
        if ("mistakes" in types) add("⚠ أخطاء شائعة")
        add("🃏 بطاقات")
        if (lesson.practice.isNotEmpty()) add("🎯 تمارين")
        if (lesson.quiz.isNotEmpty()) add("❓ اختبار")
    }
    Text(
        "طرق الفهم في هذا الدرس:  " + methods.joinToString("  •  "),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun ExplainTab(lesson: Lesson, nav: Nav, color: Color, openMap: () -> Unit) {
    val refs = lesson.sources.mapNotNull { App.content.sources[it] }
    val next = App.content.nextLesson(lesson.id)
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { LessonHeader(lesson, color) }
        item { MethodsRow(lesson) }
        items(lesson.blocks) { BlockView(it, onOpenMap = openMap) }
        if (refs.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("المراجع المعتمدة لهذا الدرس", style = MaterialTheme.typography.titleMedium)
                    refs.forEach { SourceCard(it) }
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.TouchApp, null, tint = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        "أنهيت القراءة؟ راجع «البطاقات» ثم انتقل إلى «تدرّب» لحل التمارين والاختبار.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
        if (next != null) {
            item {
                OutlinedButton(onClick = { nav.replaceLesson(next.id) }, modifier = Modifier.fillMaxWidth()) {
                    Text("الدرس التالي: ${next.title}", maxLines = 1)
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
                }
            }
        }
        item {
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

@Composable
private fun MapTab(lesson: Lesson, nav: Nav) {
    val root = lesson.mindMap
    if (root == null) {
        Text("لا توجد خريطة لهذا الدرس.", Modifier.padding(24.dp))
        return
    }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "كبّر بإصبعين واسحب للتنقل • نقرتان للملاءمة",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { nav.mindMap(lesson.id) }) {
                Icon(Icons.Filled.OpenInFull, null, Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("ملء الشاشة")
            }
        }
        MindMapViewer(root, Modifier.fillMaxSize())
    }
}

@Composable
fun FlipCards(cards: List<Flashcard>, modifier: Modifier = Modifier, emptyText: String = "لا توجد بطاقات.") {
    if (cards.isEmpty()) {
        Text(emptyText, modifier.padding(24.dp))
        return
    }
    var index by remember(cards) { mutableIntStateOf(0) }
    var flipped by remember(cards) { mutableStateOf(false) }
    val rotation by animateFloatAsState(if (flipped) 180f else 0f, tween(400), label = "flip")
    val card = cards[index.coerceIn(0, cards.lastIndex)]
    val cs = MaterialTheme.colorScheme

    Column(modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("البطاقة ${index + 1} من ${cards.size} — اضغط على البطاقة لقلبها", style = MaterialTheme.typography.labelLarge)
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 260.dp)
                .graphicsLayer {
                    rotationY = rotation
                    cameraDistance = 12f * density
                }
                .clip(RoundedCornerShape(20.dp))
                .background(
                    if (rotation <= 90f) Brush.linearGradient(listOf(cs.primary, cs.secondary))
                    else Brush.linearGradient(listOf(cs.surfaceVariant, cs.surfaceVariant))
                )
                .clickable { flipped = !flipped }
                .padding(22.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (rotation <= 90f) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (card.hint.isNotBlank()) {
                        Text(card.hint, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(10.dp))
                    }
                    Text(rich(card.front), color = Color.White, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(16.dp))
                    Text("🔄 اضغط لرؤية الإجابة", color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall)
                }
            } else {
                Text(
                    rich(card.back),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.graphicsLayer { rotationY = 180f },
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = { flipped = false; index = (index - 1 + cards.size) % cards.size },
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null)
                Spacer(Modifier.width(6.dp))
                Text("السابقة")
            }
            Button(
                onClick = { flipped = false; index = (index + 1) % cards.size },
                modifier = Modifier.weight(1f),
            ) {
                Text("التالية")
                Spacer(Modifier.width(6.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
            }
        }
    }
}

@Composable
private fun CardsTab(lesson: Lesson) {
    val cards = remember(lesson.id) { App.content.flashcards(lesson) }
    Column(Modifier.fillMaxSize()) {
        Text(
            "بطاقات مراجعة سريعة مولّدة من الخريطة الذهنية والأخطاء الشائعة. حاول تذكّر الإجابة قبل قلب البطاقة — هذا «الاسترجاع النشط» من أقوى طرق التثبيت.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp),
        )
        FlipCards(cards)
    }
}

@Composable
private fun PracticeTab(lesson: Lesson, nav: Nav) {
    val progress = App.progress
    val done = progress.isDone(lesson.id)
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (lesson.practice.isNotEmpty()) {
            item {
                Text("🎯 تمارين القيود التفاعلية", style = MaterialTheme.typography.titleMedium)
                Text(
                    "حدّد لكل حساب: هل هو مدين أم دائن أم لا علاقة له بالعملية؟ ثم اضغط «تحقق».",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            itemsIndexed(lesson.practice) { i, p -> PracticeCard(i + 1, p) }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                HorizontalDivider()
                if (lesson.quiz.isNotEmpty()) {
                    Button(onClick = { nav.quiz(lesson.id) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Filled.Quiz, null)
                        Spacer(Modifier.width(8.dp))
                        Text("اختبر فهمك (${lesson.quiz.size} أسئلة)")
                    }
                }
                OutlinedButton(onClick = { progress.setDone(lesson.id, !done) }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.CheckCircle, null, tint = if (done) Success else MaterialTheme.colorScheme.outline)
                    Spacer(Modifier.width(8.dp))
                    Text(if (done) "تم إنهاء الدرس (إلغاء)" else "أنهيت هذا الدرس")
                }
                App.content.nextLesson(lesson.id)?.let { next ->
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
            }
        }
    }
}

/** 0 = لا علاقة، 1 = مدين، 2 = دائن */
@Composable
private fun PracticeCard(number: Int, p: Practice) {
    val choice = remember(p) { mutableStateMapOf<Int, Int>() }
    var checked by remember(p) { mutableStateOf(false) }
    fun expected(i: Int) = when (i) {
        in p.debit -> 1
        in p.credit -> 2
        else -> 0
    }
    val allRight = p.accounts.indices.all { (choice[it] ?: 0) == expected(it) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("تمرين $number", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Text(rich(p.scenario), style = MaterialTheme.typography.bodyLarge)
            p.accounts.forEachIndexed { i, acc ->
                val c = choice[i] ?: 0
                val ok = c == expected(i)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (checked) {
                        Icon(
                            if (ok) Icons.Filled.CheckCircle else Icons.Filled.Cancel,
                            null,
                            tint = if (ok) Success else Danger,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(acc, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    FilterChip(
                        selected = c == 1,
                        onClick = { if (!checked) choice[i] = if (c == 1) 0 else 1 },
                        label = { Text("مدين") },
                    )
                    Spacer(Modifier.width(6.dp))
                    FilterChip(
                        selected = c == 2,
                        onClick = { if (!checked) choice[i] = if (c == 2) 0 else 2 },
                        label = { Text("دائن") },
                    )
                }
            }
            if (!checked) {
                Button(onClick = { checked = true }, modifier = Modifier.fillMaxWidth()) { Text("تحقق") }
            } else {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (allRight) Success.copy(alpha = 0.1f) else Danger.copy(alpha = 0.08f)
                    )
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(
                            if (allRight) "ممتاز! القيد صحيح ✔" else "ليس تماماً — الإجابة الصحيحة:",
                            style = MaterialTheme.typography.titleSmall,
                            color = if (allRight) Success else Danger,
                        )
                        if (!allRight) {
                            p.debit.forEach { Text("من حـ/ ${p.accounts[it]}", style = MaterialTheme.typography.bodyMedium) }
                            p.credit.forEach { Text("      إلى حـ/ ${p.accounts[it]}", style = MaterialTheme.typography.bodyMedium) }
                        }
                        if (p.explanation.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(rich(p.explanation), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                TextButton(onClick = { choice.clear(); checked = false }) {
                    Icon(Icons.Filled.Refresh, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("حاول مرة أخرى")
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
