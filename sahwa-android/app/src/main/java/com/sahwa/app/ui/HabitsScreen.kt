package com.sahwa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.AppData
import com.sahwa.app.data.Habit
import com.sahwa.app.data.Store
import java.time.LocalDate

private val HABIT_IDEAS = listOf(
    "📵" to "ساعة بلا هاتف قبل النوم",
    "✍️" to "كتابة يومية 5 دقائق",
    "🧘" to "تأمل 10 دقائق",
    "📚" to "تعلّم مهارة جديدة 20 دقيقة",
    "🤝" to "مكالمة مع شخص تحبه",
    "🍎" to "وجبة صحية بلا شاشة",
)

@Composable
fun HabitsScreen(d: AppData) {
    var showAdd by remember { mutableStateOf(false) }
    var toDelete by remember { mutableStateOf<Habit?>(null) }
    val today = LocalDate.now()
    val doneCount = d.habits.count { it.isDone(today) }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { ScreenHeader("العادات", "كل عادة تنجزها تعيد بناء وصلاتك العصبية (+3 🧠)") }
        item {
            GlowCard(accent = C.Green) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        SectionTitle("إنجاز اليوم")
                        Text(
                            if (doneCount == d.habits.size && d.habits.isNotEmpty()) "يوم كامل! أنت تبني نسخة أفضل منك 🌟"
                            else "الدماغ يتغير بالتكرار، لا بالحماس.",
                            color = C.Muted, fontSize = 13.sp,
                        )
                    }
                    Text("$doneCount/${d.habits.size}", color = C.Green, fontSize = 30.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = { if (d.habits.isEmpty()) 0f else doneCount / d.habits.size.toFloat() },
                    modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)),
                    color = C.Green,
                    trackColor = C.Panel2,
                )
            }
        }
        items(d.habits, key = { it.id }) { h ->
            HabitRow(h, today, onToggle = { Store.toggleHabit(h.id) }, onDelete = { toDelete = h })
        }
        item {
            Button(
                onClick = { showAdd = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = C.Green.copy(alpha = 0.18f), contentColor = C.Green),
            ) { Text("➕ أضف عادة جديدة", fontWeight = FontWeight.Bold) }
        }
    }

    if (showAdd) AddHabitDialog(onDismiss = { showAdd = false })
    toDelete?.let { h ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            containerColor = C.Panel2,
            title = { Text("حذف «${h.name}»؟") },
            text = { Text("ستفقد سلسلة الأيام الخاصة بها.", color = C.Muted) },
            confirmButton = {
                TextButton(onClick = {
                    Store.deleteHabit(h.id)
                    toDelete = null
                }) { Text("حذف", color = C.Red) }
            },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text("إلغاء") } },
        )
    }
}

@Composable
private fun HabitRow(h: Habit, today: LocalDate, onToggle: () -> Unit, onDelete: () -> Unit) {
    val done = h.isDone(today)
    val streak = h.streak(today)
    GlowCard(accent = if (done) C.Green else C.Indigo, padding = PaddingValues(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(C.Panel2),
                contentAlignment = Alignment.Center,
            ) { Text(h.emoji, fontSize = 24.sp) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(h.name, color = C.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (streak > 0) "🔥 $streak يوم" else "ابدأ السلسلة اليوم",
                        color = if (streak > 0) C.Amber else C.Muted, fontSize = 12.sp,
                    )
                    Spacer(Modifier.width(10.dp))
                    // last 7 days, oldest first (rendered right-to-left)
                    for (i in 6 downTo 0) {
                        val day = today.minusDays(i.toLong())
                        Box(
                            Modifier
                                .padding(horizontal = 2.dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (h.isDone(day)) C.Green else C.Panel2),
                        )
                    }
                }
            }
            Text(
                "✕",
                color = C.Muted.copy(alpha = 0.6f),
                fontSize = 14.sp,
                modifier = Modifier.clickable(onClick = onDelete).padding(8.dp),
            )
            Box(
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(if (done) C.Green else Color.Transparent)
                    .border(2.dp, if (done) C.Green else C.Muted, CircleShape)
                    .clickable(onClick = onToggle),
                contentAlignment = Alignment.Center,
            ) {
                if (done) Text("✓", color = Color.Black, fontSize = 20.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun AddHabitDialog(onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("✨") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = C.Panel2,
        title = { Text("عادة جديدة") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = emoji,
                        onValueChange = { emoji = it.take(4) },
                        label = { Text("رمز") },
                        singleLine = true,
                        modifier = Modifier.width(80.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it.take(40) },
                        label = { Text("اسم العادة") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                }
                Text("أفكار:", color = C.Muted, fontSize = 12.sp)
                HABIT_IDEAS.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        pair.forEach { (e, n) ->
                            Text(
                                "$e $n",
                                color = C.Cyan,
                                fontSize = 12.sp,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(C.Cyan.copy(alpha = 0.1f))
                                    .clickable {
                                        emoji = e
                                        name = n
                                    }
                                    .padding(8.dp),
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank(),
                onClick = {
                    Store.addHabit(name.trim(), emoji.trim())
                    onDismiss()
                },
            ) { Text("إضافة") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}
