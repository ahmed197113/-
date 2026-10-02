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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.LevelChip
import com.contracting.academy.ui.components.MindMapPreview
import com.contracting.academy.ui.components.MindMapViewer
import com.contracting.academy.ui.components.SectionTitle

/** خريطة بملء الشاشة. المعرّف "curriculum" يعرض خريطة المنهج كاملاً. */
@Composable
fun MindMapScreen(id: String, nav: Nav) {
    val content = App.content
    val isCurriculum = id == "curriculum"
    val root = if (isCurriculum) content.curriculumMap else content.lessons[id]?.mindMap
    val title = if (isCurriculum) "خريطة المنهج كاملاً" else content.lessons[id]?.title ?: ""
    Scaffold(topBar = { AppBar(title, onBack = { nav.back() }) }) { pad ->
        Column(Modifier.padding(pad)) {
            Text(
                if (isCurriculum) "اضغط على أي درس في الخريطة لفتحه • كبّر بإصبعين واسحب للتنقل"
                else "كبّر بإصبعين واسحب للتنقل • نقرتان للملاءمة",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
            )
            if (root != null) {
                MindMapViewer(root, Modifier.fillMaxSize()) { node -> node.ref?.let { nav.lesson(it) } }
            }
        }
    }
}

/** معرض الخرائط الذهنية لكل الدروس. */
@Composable
fun MapsGalleryScreen(nav: Nav) {
    val content = App.content
    Scaffold(topBar = { AppBar("الخرائط الذهنية", onBack = { nav.back() }) }) { pad ->
        LazyColumn(
            Modifier.padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Card(onClick = { nav.mindMap("curriculum") }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Text("🗺 خريطة المنهج كاملاً", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "كل المسارات والوحدات والدروس في خريطة واحدة — اضغط على أي درس لفتحه.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
            content.tracks.forEach { t ->
                item(key = "t_${t.id}") { SectionTitle(t.title) }
                items(content.lessonsOf(t).filter { it.mindMap != null }, key = { it.id }) { l ->
                    Card(onClick = { nav.mindMap(l.id) }, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Row {
                                Text(l.title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                                LevelChip(l.level)
                            }
                            Spacer(Modifier.height(8.dp))
                            MindMapPreview(l.mindMap!!, Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }
    }
}

/** بطاقات مراجعة المصطلحات مع تصفية حسب التصنيف وخلط عشوائي. */
@Composable
fun TermCardsScreen(nav: Nav) {
    val content = App.content
    val cats = remember { content.glossary.map { it.category }.filter { it.isNotBlank() }.distinct() }
    var cat by rememberSaveable { mutableStateOf<String?>(null) }
    var seed by rememberSaveable { mutableIntStateOf(0) }
    val cards = remember(cat, seed) {
        val list = content.termCards(cat)
        if (seed == 0) list else list.shuffled(kotlin.random.Random(seed))
    }
    Scaffold(topBar = {
        AppBar("بطاقات المصطلحات", onBack = { nav.back() }) {
            IconButton(onClick = { seed = (1..100000).random() }) { Icon(Icons.Filled.Shuffle, "خلط") }
        }
    }) { pad ->
        Column(Modifier.padding(pad)) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item { FilterChip(selected = cat == null, onClick = { cat = null }, label = { Text("الكل") }) }
                items(cats) { c -> FilterChip(selected = cat == c, onClick = { cat = c }, label = { Text(c) }) }
            }
            FlipCards(cards)
            Spacer(Modifier.width(1.dp))
        }
    }
}
