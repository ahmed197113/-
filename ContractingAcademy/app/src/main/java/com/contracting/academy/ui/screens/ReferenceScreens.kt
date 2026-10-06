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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Lesson
import com.contracting.academy.data.Term
import com.contracting.academy.data.normalizeArabic
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.SectionTitle
import com.contracting.academy.ui.theme.Danger

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit, hint: String) {
    OutlinedTextField(
        value = query,
        onValueChange = onChange,
        placeholder = { Text(hint) },
        leadingIcon = { Icon(Icons.Filled.Search, null) },
        trailingIcon = {
            if (query.isNotEmpty()) IconButton(onClick = { onChange("") }) { Icon(Icons.Filled.Clear, "مسح") }
        },
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
fun TermCard(t: Term) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(t.ar, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (t.category.isNotBlank()) {
                    Text(t.category, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                }
            }
            if (t.en.isNotBlank()) {
                Text(t.en, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.height(4.dp))
            Text(rich(t.definition), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun GlossaryScreen() {
    var query by rememberSaveable { mutableStateOf("") }
    var cat by rememberSaveable { mutableStateOf<String?>(null) }
    val all = App.content.glossary
    val cats = remember { all.map { it.category }.filter { it.isNotBlank() }.distinct() }
    val q = normalizeArabic(query.trim())
    val list = all.filter {
        (cat == null || it.category == cat) &&
            (q.isEmpty() || normalizeArabic(it.ar + " " + it.en + " " + it.definition).contains(q))
    }
    Scaffold(topBar = { AppBar("قاموس المصطلحات (${all.size})") }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 24.dp)) {
            item { SearchField(query, { query = it }, "ابحث بالعربية أو الإنجليزية…") }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item { FilterChip(selected = cat == null, onClick = { cat = null }, label = { Text("الكل") }) }
                    items(cats) { c -> FilterChip(selected = cat == c, onClick = { cat = c }, label = { Text(c) }) }
                }
            }
            items(list, key = { it.ar + it.en }) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) { TermCard(it) }
            }
            if (list.isEmpty()) {
                item { Text("لا توجد نتائج", Modifier.padding(24.dp)) }
            }
        }
    }
}

@Composable
fun SourcesScreen(nav: Nav) {
    val sources = App.content.sources.values.toList()
    val groups = sources.groupBy { it.type.ifBlank { "أخرى" } }
    Scaffold(topBar = { AppBar("المصادر والمراجع المعتمدة", onBack = { nav.back() }) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(
                        "كل درس في التطبيق مربوط بمراجعه. هذه هي الجهات والمعايير الرسمية التي بُني عليها المحتوى. " +
                            "اضغط على أي مصدر لفتح موقعه الرسمي والتحقق من آخر إصدار، فالمعايير والأنظمة تُحدَّث دورياً.",
                        Modifier.padding(14.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            groups.forEach { (type, list) ->
                item(key = "g_$type") { SectionTitle("$type (${list.size})") }
                items(list, key = { it.id }) { s ->
                    Column(Modifier.padding(vertical = 4.dp)) {
                        SourceCard(s)
                        if (s.description.isNotBlank()) {
                            Text(
                                s.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun Lesson.searchText(): String = buildString {
    append(title).append(' ').append(summary).append(' ')
    blocks.forEach { b ->
        append(b.title).append(' ').append(b.text).append(' ')
        b.items.forEach { append(it).append(' ') }
        b.rows.forEach { r -> r.forEach { append(it).append(' ') } }
        b.lines.forEach { append(it.account).append(' ') }
        append(b.note).append(' ')
    }
}

@Composable
fun SearchScreen(nav: Nav) {
    var query by rememberSaveable { mutableStateOf("") }
    val content = App.content
    val index = remember { content.orderedLessons.map { it to normalizeArabic(it.searchText()) } }
    val q = normalizeArabic(query.trim())
    val words = q.split(' ').filter { it.isNotBlank() }
    val lessons = if (words.isEmpty()) emptyList() else index.filter { (_, t) -> words.all { t.contains(it) } }.map { it.first }
    val terms = if (words.isEmpty()) emptyList() else content.glossary.filter { t ->
        val s = normalizeArabic(t.ar + " " + t.en + " " + t.definition); words.all { s.contains(it) }
    }
    val sources = if (words.isEmpty()) emptyList() else content.sources.values.filter { s ->
        val x = normalizeArabic(s.title + " " + s.issuer + " " + s.description); words.all { x.contains(it) }
    }

    Scaffold(topBar = { AppBar("البحث", onBack = { nav.back() }) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 24.dp)) {
            item { SearchField(query, { query = it }, "مثال: المحتجزات، IFRS 15، أرشفة…") }
            if (words.isEmpty()) {
                item {
                    Column(Modifier.padding(16.dp)) {
                        Text("اقتراحات:", style = MaterialTheme.typography.labelLarge)
                        Spacer(Modifier.height(8.dp))
                        listOf("نسبة الإنجاز", "المستخلص", "المحتجزات", "أوامر التغيير", "الأرشفة الإلكترونية", "ضريبة القيمة المضافة", "عقد خاسر")
                            .forEach { s -> TextButton(onClick = { query = s }) { Text(s) } }
                    }
                }
            }
            if (lessons.isNotEmpty()) {
                item { SectionTitle("الدروس (${lessons.size})", Modifier.padding(horizontal = 16.dp)) }
                items(lessons, key = { "l_" + it.id }) {
                    LessonRow(it, null, nav, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
            }
            if (terms.isNotEmpty()) {
                item { SectionTitle("المصطلحات (${terms.size})", Modifier.padding(horizontal = 16.dp)) }
                items(terms, key = { "t_" + it.ar + it.en }) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) { TermCard(it) }
                }
            }
            if (sources.isNotEmpty()) {
                item { SectionTitle("المصادر (${sources.size})", Modifier.padding(horizontal = 16.dp)) }
                items(sources, key = { "s_" + it.id }) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) { SourceCard(it) }
                }
            }
            if (words.isNotEmpty() && lessons.isEmpty() && terms.isEmpty() && sources.isEmpty()) {
                item { Text("لا توجد نتائج لـ \"$query\"", Modifier.padding(24.dp)) }
            }
        }
    }
}

@Composable
fun AboutScreen(nav: Nav) {
    var confirm by remember { mutableStateOf(false) }
    Scaffold(topBar = { AppBar("حول التطبيق", onBack = { nav.back() }) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("أكاديمية المحاسب", style = MaterialTheme.typography.headlineSmall)
            Text("الإصدار 2.0", style = MaterialTheme.typography.labelMedium)
            Text(
                "تطبيق تعليمي يشرح المحاسبة من الصفر حتى مستوى الخبير: الأساسيات، المعايير الدولية IFRS و IAS بشرح مبسط، " +
                    "التكاليف والإدارية والمراجعة والضرائب والزكاة، ومحاسبة القطاعات وفي مقدمتها المقاولات، " +
                    "مع خرائط ذهنية وصور توضيحية وأمثلة وقيود وتمارين واختبارات.",
                style = MaterialTheme.typography.bodyLarge,
            )
            SectionTitle("كيف تستخدم التطبيق؟")
            listOf(
                "**المبتدئ**: ابدأ بمسار «أساسيات المحاسبة» بالترتيب، واقرأ صندوق «ببساطة» أولاً في كل درس.",
                "**المتوسط**: ادرس المعايير الدولية ومجال تخصصك (تكاليف، مراجعة، مقاولات…) وطبّق على الحاسبات.",
                "**الخبير**: ركّز على صناديق «للخبير والمحترف» والمراجع الرسمية المرفقة بكل درس.",
                "اجتياز اختبار الدرس بنسبة 70% أو أكثر يسجّله مكتملاً تلقائياً.",
                "كل المحتوى يعمل بدون إنترنت، والمصادر تُفتح من مواقعها الرسمية.",
            ).forEach { Text(rich("• $it"), style = MaterialTheme.typography.bodyMedium) }
            SectionTitle("إخلاء مسؤولية")
            Text(
                "المحتوى لأغراض تعليمية وتم إعداده بالرجوع إلى المعايير الدولية للتقرير المالي (IFRS) المعتمدة في المملكة " +
                    "والأنظمة الصادرة عن الجهات الرسمية. الأنظمة والنسب قد تتغير؛ تحقق دائماً من النص الرسمي الأحدث " +
                    "واستشر مختصاً مرخّصاً قبل اتخاذ قرارات مهنية.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { confirm = true }) { Text("مسح التقدّم والمفضلة", color = Danger, fontWeight = FontWeight.Bold) }
        }
    }
    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("مسح التقدّم؟") },
            text = { Text("سيتم حذف الدروس المكتملة ونتائج الاختبارات والمفضلة من هذا الجهاز.") },
            confirmButton = { TextButton(onClick = { App.progress.reset(); confirm = false }) { Text("مسح", color = Danger) } },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("إلغاء") } },
        )
    }
}
