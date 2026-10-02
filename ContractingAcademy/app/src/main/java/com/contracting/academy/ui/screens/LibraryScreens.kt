package com.contracting.academy.ui.screens

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Lesson
import com.contracting.academy.data.Level
import com.contracting.academy.data.Track
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.IconBadge
import com.contracting.academy.ui.components.LevelChip
import com.contracting.academy.ui.components.SectionTitle
import com.contracting.academy.ui.components.iconFor
import com.contracting.academy.ui.theme.Success

@Composable
fun TrackCard(track: Track, nav: Nav, modifier: Modifier = Modifier) {
    val lessons = App.content.lessonsOf(track)
    val done = lessons.count { App.progress.isDone(it.id) }
    val color = Color(track.color)
    Card(onClick = { nav.track(track.id) }, modifier = modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBadge(iconFor(track.icon), color, 48)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(track.title, style = MaterialTheme.typography.titleMedium)
                Text(
                    track.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                if (track.comingSoon) {
                    Text("محتوى تأسيسي — يتوسع في التحديثات القادمة", style = MaterialTheme.typography.labelSmall, color = color)
                } else {
                    LinearProgressIndicator(
                        progress = { if (lessons.isEmpty()) 0f else done.toFloat() / lessons.size },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = color,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text("$done / ${lessons.size} درس", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
fun LessonRow(lesson: Lesson, number: Int?, nav: Nav, modifier: Modifier = Modifier) {
    val progress = App.progress
    val done = progress.isDone(lesson.id)
    val score = progress.scores[lesson.id]
    Card(onClick = { nav.lesson(lesson.id) }, modifier = modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                contentDescription = if (done) "مكتمل" else "غير مكتمل",
                tint = if (done) Success else MaterialTheme.colorScheme.outline,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    (if (number != null) "$number. " else "") + lesson.title,
                    style = MaterialTheme.typography.titleSmall,
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LevelChip(lesson.level)
                    Icon(Icons.Filled.Timer, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${lesson.minutes} د", style = MaterialTheme.typography.labelSmall)
                    if (score != null) {
                        Text("اختبار ${score.first}/${score.second}", style = MaterialTheme.typography.labelSmall, color = Success)
                    }
                    if (lesson.id in progress.bookmarks) {
                        Icon(Icons.Filled.Bookmark, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.tertiary)
                    }
                }
            }
        }
    }
}

@Composable
fun LevelFilter(selected: Level?, onSelect: (Level?) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text("كل المستويات") }) }
        items(Level.entries) { l ->
            FilterChip(selected = selected == l, onClick = { onSelect(l) }, label = { Text(l.label) })
        }
    }
}

@Composable
fun LibraryScreen(nav: Nav) {
    var level by rememberSaveable { mutableStateOf<Level?>(null) }
    val content = App.content
    Scaffold(topBar = { AppBar("مكتبة الدروس") }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 24.dp)) {
            item { LevelFilter(level) { level = it } }
            if (level == null) {
                items(content.tracks, key = { it.id }) { t ->
                    TrackCard(t, nav, Modifier.padding(horizontal = 16.dp, vertical = 5.dp))
                }
            } else {
                content.tracks.forEach { t ->
                    val ls = content.lessonsOf(t).filter { it.level == level }
                    if (ls.isNotEmpty()) {
                        item(key = "h_${t.id}") { SectionTitle(t.title, Modifier.padding(horizontal = 16.dp)) }
                        items(ls, key = { "${t.id}_${it.id}" }) { l ->
                            LessonRow(l, null, nav, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TrackScreen(id: String, nav: Nav) {
    val track = App.content.track(id) ?: return
    var level by rememberSaveable { mutableStateOf<Level?>(null) }
    Scaffold(topBar = { AppBar(track.title, onBack = { nav.back() }) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Text(
                    track.subtitle,
                    Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item { LevelFilter(level) { level = it } }
            var n = 0
            track.units.forEachIndexed { ui, unit ->
                val ls = unit.lessonIds.mapNotNull { App.content.lessons[it] }
                val shown = ls.filter { level == null || it.level == level }
                val numbers = ls.associate { it.id to ++n }
                if (shown.isNotEmpty()) {
                    item(key = "u$ui") {
                        SectionTitle("الوحدة ${ui + 1}: ${unit.title}", Modifier.padding(horizontal = 16.dp))
                    }
                    items(shown, key = { it.id }) { l ->
                        LessonRow(l, numbers[l.id], nav, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun BookmarksScreen(nav: Nav) {
    val marks = App.content.orderedLessons.filter { it.id in App.progress.bookmarks }
    Scaffold(topBar = { AppBar("الدروس المفضلة", onBack = { nav.back() }) }) { pad ->
        if (marks.isEmpty()) {
            Column(Modifier.padding(pad).fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "لا توجد دروس محفوظة بعد.\nاضغط على أيقونة الحفظ أعلى أي درس لإضافته هنا.",
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        } else {
            LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(marks, key = { it.id }) { LessonRow(it, null, nav) }
            }
        }
    }
}
