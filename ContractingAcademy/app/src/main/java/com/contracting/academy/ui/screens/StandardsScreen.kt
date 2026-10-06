package com.contracting.academy.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.contracting.academy.data.normalizeArabic
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.SectionTitle
import com.contracting.academy.ui.theme.Success

/** فهرس المعايير الدولية: كل معيار في بطاقة برمزه وتعريفه في جملة واحدة. */
@Composable
fun StandardsScreen(nav: Nav) {
    val content = App.content
    val track = content.track("standards")
    var query by rememberSaveable { mutableStateOf("") }
    var family by rememberSaveable { mutableStateOf("") }
    val q = normalizeArabic(query.trim())
    fun match(l: Lesson) =
        (family.isEmpty() || l.code.startsWith(family)) &&
            (q.isEmpty() || normalizeArabic(l.code + " " + l.title + " " + l.summary).contains(q))

    Scaffold(topBar = { AppBar("المعايير الدولية IFRS / IAS") }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Text(
                    "كل معيار بشرح بسيط جداً: جملة واحدة، تشبيه، صورة للعملية، مثال بالأرقام والقيد، خريطة ذهنية، وأسئلة.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
            item {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("ابحث: إيجار، مخزون، IFRS 16…") },
                    leadingIcon = { Icon(Icons.Filled.Search, null) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                )
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(listOf("" to "الكل", "IFRS" to "IFRS", "IAS" to "IAS")) { (k, label) ->
                        FilterChip(selected = family == k, onClick = { family = k }, label = { Text(label) })
                    }
                }
            }
            if (track != null) {
                item {
                    Button(
                        onClick = { nav.quiz("bank:standards") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                    ) {
                        Icon(Icons.Filled.Quiz, null)
                        Spacer(Modifier.width(8.dp))
                        Text("اختبار عشوائي في المعايير (15 سؤالاً)")
                    }
                }
                track.units.forEach { u ->
                    val ls = u.lessonIds.mapNotNull { content.lessons[it] }.filter(::match)
                    if (ls.isNotEmpty()) {
                        item(key = "u_${u.title}") { SectionTitle(u.title, Modifier.padding(horizontal = 16.dp)) }
                        items(ls, key = { it.id }) { l -> StandardCard(l, nav) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StandardCard(l: Lesson, nav: Nav) {
    val done = App.progress.isDone(l.id)
    val isIfrs = l.code.startsWith("IFRS")
    val color = if (isIfrs) Color(0xFF2C6FB7) else Color(0xFF2E7D7A)
    Card(
        onClick = { nav.lesson(l.id) },
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .width(72.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    l.code.ifBlank { "مقدمة" },
                    color = Color.White,
                    style = MaterialTheme.typography.labelLarge,
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(l.title, style = MaterialTheme.typography.titleSmall)
                Text(
                    rich(l.summary),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
            if (done) Icon(Icons.Filled.CheckCircle, "مكتمل", tint = Success, modifier = Modifier.size(20.dp))
        }
    }
}
