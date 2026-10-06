package com.contracting.academy.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.theme.Danger
import com.contracting.academy.ui.theme.Gold
import com.contracting.academy.ui.theme.Success

@Composable
fun QuizScreen(id: String, nav: Nav) {
    val quiz = androidx.compose.runtime.saveable.rememberSaveable(id) { mutableStateOf(0) }
    val (title, questions) = androidx.compose.runtime.remember(id, quiz.value) { App.content.quizFor(id) }
    if (questions.isEmpty()) return
    var index by rememberSaveable { mutableIntStateOf(0) }
    var chosen by rememberSaveable { mutableIntStateOf(-1) }
    var correct by rememberSaveable { mutableIntStateOf(0) }
    var finished by rememberSaveable { mutableStateOf(false) }

    Scaffold(topBar = { AppBar(title, onBack = { nav.back() }) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (finished) {
                val pct = if (questions.isEmpty()) 0 else correct * 100 / questions.size
                val passed = pct >= 70
                Spacer(Modifier.height(24.dp))
                Icon(
                    Icons.Filled.EmojiEvents,
                    null,
                    tint = if (passed) Gold else MaterialTheme.colorScheme.outline,
                    modifier = Modifier
                        .size(96.dp)
                        .align(Alignment.CenterHorizontally),
                )
                Text(
                    "نتيجتك: $correct من ${questions.size} ($pct%)",
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    if (passed) "أحسنت! اجتزت الاختبار وتم احتساب الدرس مكتملاً."
                    else "تحتاج 70% للاجتياز. راجع الدرس وحاول مرة أخرى — التكرار يثبّت المعلومة.",
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    index = 0; chosen = -1; correct = 0; finished = false; quiz.value++
                }, modifier = Modifier.fillMaxWidth()) { Text("إعادة الاختبار") }
                OutlinedButton(onClick = { nav.back() }, modifier = Modifier.fillMaxWidth()) { Text("العودة للدرس") }
            }

            val q = questions.getOrNull(index)
            if (!finished && q != null) {
            Text("السؤال ${index + 1} من ${questions.size}", style = MaterialTheme.typography.labelLarge)
            LinearProgressIndicator(
                progress = { (index + 1).toFloat() / questions.size },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
            )
            Text(rich(q.question), style = MaterialTheme.typography.titleLarge)

            q.options.forEachIndexed { i, opt ->
                val answered = chosen >= 0
                val isRight = i == q.answer
                val color = when {
                    answered && isRight -> Success
                    answered && i == chosen -> Danger
                    else -> MaterialTheme.colorScheme.outline
                }
                Card(
                    onClick = {
                        if (!answered) {
                            chosen = i
                            if (isRight) correct++
                        }
                    },
                    border = BorderStroke(if (answered && (isRight || i == chosen)) 2.dp else 1.dp, color),
                    colors = CardDefaults.cardColors(
                        containerColor = if (answered && isRight) Success.copy(alpha = 0.08f)
                        else if (answered && i == chosen) Danger.copy(alpha = 0.07f)
                        else MaterialTheme.colorScheme.surface
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${"أبجد"[i % 4]})", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(10.dp))
                        Text(rich(opt), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                        if (answered && isRight) Icon(Icons.Filled.CheckCircle, null, tint = Success)
                        if (answered && i == chosen && !isRight) Icon(Icons.Filled.Cancel, null, tint = Danger)
                    }
                }
            }

            if (chosen >= 0) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            if (chosen == q.answer) "إجابة صحيحة ✔" else "الإجابة الصحيحة: ${q.options[q.answer]}",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        if (q.explanation.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(rich(q.explanation), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                Button(onClick = {
                    if (index + 1 < questions.size) {
                        index++; chosen = -1
                    } else {
                        finished = true
                        if (!id.startsWith("bank:")) App.progress.saveScore(id, correct, questions.size)
                    }
                }, modifier = Modifier.fillMaxWidth()) {
                    Text(if (index + 1 < questions.size) "السؤال التالي" else "عرض النتيجة")
                }
            }
            }
        }
    }
}
