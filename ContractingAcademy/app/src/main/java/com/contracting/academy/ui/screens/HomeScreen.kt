package com.contracting.academy.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Level
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.IconBadge
import com.contracting.academy.ui.components.SectionTitle
import com.contracting.academy.ui.components.iconFor
import com.contracting.academy.ui.components.levelColor
import com.contracting.academy.ui.theme.Navy
import com.contracting.academy.ui.theme.Teal
import java.time.LocalDate

@Composable
fun HomeScreen(nav: Nav) {
    val content = App.content
    val progress = App.progress
    val all = content.orderedLessons
    val done = all.count { progress.isDone(it.id) }
    val last = progress.lastLesson?.let { content.lessons[it] }
    val term = remember {
        content.glossary.getOrNull(LocalDate.now().dayOfYear % content.glossary.size.coerceAtLeast(1))
    }

    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 24.dp)) {
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Navy, Teal)))
                    .padding(20.dp)
            ) {
                Text("أكاديمية محاسبة المقاولات", color = Color.White, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(4.dp))
                Text(
                    "من القيد الأول حتى إقفال المشروع — بشرح بسيط ومراجع موثوقة",
                    color = Color.White.copy(alpha = 0.85f),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(16.dp))
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { nav.search() },
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Search, null, tint = Navy)
                        Spacer(Modifier.width(8.dp))
                        Text("ابحث في الدروس والمصطلحات والمصادر…", color = Color(0xFF5A6772))
                    }
                }
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("تقدّمك: $done من ${all.size} درس", color = Color.White, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    Text("${if (all.isEmpty()) 0 else done * 100 / all.size}%", color = Color.White)
                }
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { if (all.isEmpty()) 0f else done.toFloat() / all.size },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = Color(0xFFF2C75C),
                    trackColor = Color.White.copy(alpha = 0.25f),
                )
            }
        }

        if (last != null) {
            item {
                Card(
                    onClick = { nav.lesson(last.id) },
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(top = 16.dp)
                        .fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBadge(Icons.Filled.PlayArrow, MaterialTheme.colorScheme.secondary)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("تابع من حيث توقفت", style = MaterialTheme.typography.labelLarge)
                            Text(last.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                        }
                    }
                }
            }
        }

        item { SectionTitle("ابدأ حسب مستواك", Modifier.padding(horizontal = 16.dp)) }
        item {
            Row(
                Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Level.entries.forEach { level ->
                    val lessons = all.filter { it.level == level }
                    val next = lessons.firstOrNull { !progress.isDone(it.id) } ?: lessons.firstOrNull()
                    val c = levelColor(level)
                    OutlinedCard(
                        onClick = { next?.let { nav.lesson(it.id) } },
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text(level.label, color = c, style = MaterialTheme.typography.titleMedium)
                            Text(
                                when (level) {
                                    Level.BEGINNER -> "حديث التخرج"
                                    Level.INTERMEDIATE -> "محاسب ممارس"
                                    Level.EXPERT -> "مدير مالي / مراجع"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "${lessons.count { progress.isDone(it.id) }}/${lessons.size}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        item { SectionTitle("طرق مختلفة للفهم", Modifier.padding(horizontal = 16.dp)) }
        item {
            LazyRow(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val ways = listOf(
                    Triple("🗺", "خريطة المنهج", "كل الدروس في خريطة واحدة"),
                    Triple("🧠", "الخرائط الذهنية", "خريطة لكل درس"),
                    Triple("🃏", "بطاقات المصطلحات", "مراجعة بالقلب والتذكّر"),
                    Triple("🧮", "الحاسبات", "طبّق بالأرقام"),
                )
                items(ways.size) { i ->
                    val (icon, title, sub) = ways[i]
                    Card(
                        onClick = {
                            when (i) {
                                0 -> nav.mindMap("curriculum")
                                1 -> nav.maps()
                                2 -> nav.termCards()
                                else -> nav.tab("tools")
                            }
                        },
                        modifier = Modifier.width(150.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(icon, style = MaterialTheme.typography.headlineSmall)
                            Spacer(Modifier.height(6.dp))
                            Text(title, style = MaterialTheme.typography.titleSmall)
                            Text(sub, style = MaterialTheme.typography.labelSmall, maxLines = 2, minLines = 2)
                        }
                    }
                }
            }
        }

        item {
            SectionTitle("مسارات التعلم", Modifier.padding(horizontal = 16.dp)) {
                TextButton(onClick = { nav.tab("library") }) { Text("الكل") }
            }
        }
        items(content.tracks, key = { it.id }) { track ->
            TrackCard(track, nav, Modifier.padding(horizontal = 16.dp, vertical = 5.dp))
        }

        item { SectionTitle("أدوات وحاسبات سريعة", Modifier.padding(horizontal = 16.dp)) }
        item {
            LazyRow(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(tools, key = { it.id }) { tool ->
                    Card(onClick = { nav.tool(tool.id) }, modifier = Modifier.width(150.dp)) {
                        Column(Modifier.padding(14.dp)) {
                            IconBadge(iconFor(tool.icon), MaterialTheme.colorScheme.primary, 38)
                            Spacer(Modifier.height(8.dp))
                            Text(tool.title, style = MaterialTheme.typography.labelLarge, maxLines = 2, minLines = 2)
                        }
                    }
                }
            }
        }

        if (term != null) {
            item { SectionTitle("مصطلح اليوم", Modifier.padding(horizontal = 16.dp)) }
            item {
                Card(
                    Modifier
                        .padding(horizontal = 16.dp)
                        .fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                ) {
                    Row(Modifier.padding(16.dp)) {
                        Icon(Icons.Filled.Lightbulb, null, tint = MaterialTheme.colorScheme.tertiary)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(term.ar, style = MaterialTheme.typography.titleMedium)
                            if (term.en.isNotBlank()) {
                                Text(term.en, style = MaterialTheme.typography.labelMedium)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(term.definition, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }

        item {
            Row(
                Modifier
                    .padding(horizontal = 16.dp)
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                QuickLink("المفضلة (${progress.bookmarks.size})", Icons.Filled.Bookmark, Modifier.weight(1f)) {
                    nav.bookmarks()
                }
                QuickLink("حول التطبيق", Icons.Filled.Info, Modifier.weight(1f)) { nav.about() }
            }
        }
    }
}

@Composable
private fun QuickLink(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit) {
    OutlinedCard(onClick = onClick, modifier = modifier) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(16.dp))
        }
    }
}
