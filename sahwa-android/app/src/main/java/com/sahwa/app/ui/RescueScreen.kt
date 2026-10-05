package com.sahwa.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.AppData
import com.sahwa.app.data.MAX_EARN_PER_DAY
import kotlinx.coroutines.delay
import kotlin.random.Random

enum class RescueKind { URGE, BREATH, PUSHUPS, GRATITUDE, EYES, MEMORY, READ, WALK, TIDY }

data class Rescue(
    val kind: RescueKind,
    val emoji: String,
    val title: String,
    val subtitle: String,
    val color: Color,
    val points: Float = 4f,
    val credits: Int = 5,
)

val RESCUES = listOf(
    Rescue(RescueKind.URGE, "🌊", "اركب موجة الرغبة", "90 ثانية تراقب الرغبة حتى تهدأ", C.Cyan, points = 5f, credits = 5),
    Rescue(RescueKind.BREATH, "🌬️", "تنفّس 4-7-8", "دقيقة تهدّئ الجهاز العصبي", C.Cyan),
    Rescue(RescueKind.MEMORY, "🧩", "تحدّي الذاكرة", "درّب ذاكرتك العاملة", C.Violet, points = 5f),
    Rescue(RescueKind.PUSHUPS, "💪", "10 تمارين ضغط", "دوبامين حقيقي من الحركة", C.Pink, points = 5f),
    Rescue(RescueKind.GRATITUDE, "🙏", "3 نِعَم", "اكتب 3 أشياء ممتن لها", C.Amber),
    Rescue(RescueKind.EYES, "👁️", "قاعدة 20-20-20", "أرح عينيك 20 ثانية", C.Green, points = 2f, credits = 3),
    Rescue(RescueKind.READ, "📖", "اقرأ صفحتين", "3 دقائق مع كتاب حقيقي", C.Indigo, points = 6f, credits = 8),
    Rescue(RescueKind.WALK, "🚶", "مشي 5 دقائق", "تحرك بعيدًا عن الشاشة", C.Green, points = 6f, credits = 8),
    Rescue(RescueKind.TIDY, "🧹", "رتّب مكانك", "دقيقتان لترتيب ما حولك", C.Amber, points = 3f, credits = 4),
)

@Composable
fun RescueScreen(d: AppData, onStart: (Rescue) -> Unit) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(span = { GridItemSpan(2) }) {
            ScreenHeader("بدائل الدوبامين", "استبدل التمرير بنشاط حقيقي — واكسب رصيدًا")
        }
        item(span = { GridItemSpan(2) }) {
            GlowCard(accent = C.Cyan) {
                Text(
                    "كل نشاط يرفع صحة دماغك ويضيف تمريرات لمحفظتك (حتى $MAX_EARN_PER_DAY يوميًا). " +
                        "أنت لا تحرم نفسك — أنت تجعل المتعة مستحقّة.",
                    color = C.Muted, fontSize = 13.sp,
                )
                Text(
                    "كسبت اليوم: +${d.today.earned} ⚡",
                    color = C.Cyan, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
        items(RESCUES) { r ->
            GlowCard(
                accent = r.color,
                padding = PaddingValues(14.dp),
                modifier = Modifier.clip(RoundedCornerShape(24.dp)).clickable { onStart(r) },
            ) {
                Text(r.emoji, fontSize = 32.sp)
                Spacer(Modifier.height(6.dp))
                Text(r.title, color = C.Text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text(r.subtitle, color = C.Muted, fontSize = 12.sp, minLines = 2)
                Spacer(Modifier.height(6.dp))
                Text("+${r.points.toInt()} 🧠  +${r.credits} ⚡", color = r.color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun RescueRunner(rescue: Rescue, onDone: () -> Unit, onClose: () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(C.Bg, Color(0xFF120A2A), C.Bg)))
            .clickable(enabled = false) {},
    ) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("${rescue.emoji} ${rescue.title}", color = C.Text, fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                Text("✕", color = C.Muted, fontSize = 22.sp, modifier = Modifier.clickable(onClick = onClose).padding(8.dp))
            }
            Spacer(Modifier.height(24.dp))
            when (rescue.kind) {
                RescueKind.URGE -> UrgeSurf(onDone)
                RescueKind.BREATH -> Breathing(onDone)
                RescueKind.PUSHUPS -> Counter(10, "اضغط الدائرة بعد كل تمرين", rescue.color, onDone)
                RescueKind.GRATITUDE -> Gratitude(onDone)
                RescueKind.EYES -> TimedTask(20, "انظر إلى شيء يبعد 6 أمتار على الأقل. لا تنظر للشاشة.", rescue.color, onDone)
                RescueKind.MEMORY -> MemoryGame(onDone)
                RescueKind.READ -> TimedTask(180, "امسك كتابًا ورقيًا واقرأ. الهاتف مقلوب على الطاولة.", rescue.color, onDone)
                RescueKind.WALK -> TimedTask(300, "قم وتحرك. ضع الهاتف في جيبك ولا تنظر إليه.", rescue.color, onDone)
                RescueKind.TIDY -> TimedTask(120, "رتّب مكتبك أو غرفتك. المكان المرتّب = ذهن مرتّب.", rescue.color, onDone)
            }
        }
    }
}

@Composable
private fun DoneButton(enabled: Boolean, color: Color, onDone: () -> Unit) {
    Button(
        onClick = onDone,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(56.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color, contentColor = Color.Black),
    ) { Text(if (enabled) "أنجزت ✓ اجمع المكافأة" else "استمر…", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
}

@Composable
private fun Breathing(onDone: () -> Unit) {
    var phase by remember { mutableStateOf("استعد") }
    var cycle by remember { mutableIntStateOf(0) }
    var done by remember { mutableStateOf(false) }
    val scale = remember { Animatable(0.5f) }
    LaunchedEffect(Unit) {
        delay(1000)
        repeat(4) { i ->
            cycle = i + 1
            phase = "شهيق… 4"
            scale.animateTo(1f, tween(4000, easing = LinearEasing))
            phase = "احبس… 7"
            delay(7000)
            phase = "زفير… 8"
            scale.animateTo(0.5f, tween(8000, easing = LinearEasing))
        }
        phase = "أحسنت 🌿"
        done = true
    }
    Box(Modifier.size(260.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(240.dp)
                .scale(scale.value)
                .clip(CircleShape)
                .background(Brush.radialGradient(listOf(C.Cyan, C.Violet.copy(alpha = 0.5f), Color.Transparent))),
        )
        Text(phase, color = C.Text, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
    Text("الدورة $cycle من 4", color = C.Muted, modifier = Modifier.padding(vertical = 16.dp))
    DoneButton(done, C.Cyan, onDone)
}

@Composable
private fun Counter(target: Int, hint: String, color: Color, onDone: () -> Unit) {
    var n by remember { mutableIntStateOf(0) }
    Text(hint, color = C.Muted, textAlign = TextAlign.Center)
    Spacer(Modifier.height(24.dp))
    Box(
        Modifier
            .size(220.dp)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(color.copy(alpha = 0.6f), color.copy(alpha = 0.1f))))
            .clickable { if (n < target) n++ },
        contentAlignment = Alignment.Center,
    ) {
        Text("$n / $target", color = C.Text, fontSize = 40.sp, fontWeight = FontWeight.Black)
    }
    Spacer(Modifier.height(24.dp))
    DoneButton(n >= target, color, onDone)
}

@Composable
private fun TimedTask(seconds: Int, instruction: String, color: Color, onDone: () -> Unit) {
    var left by remember { mutableIntStateOf(seconds) }
    LaunchedEffect(Unit) {
        while (left > 0) {
            delay(1000)
            left--
        }
    }
    Text(instruction, color = C.Muted, textAlign = TextAlign.Center, fontSize = 16.sp)
    Spacer(Modifier.height(28.dp))
    Box(contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            progress = { 1f - left / seconds.toFloat() },
            modifier = Modifier.size(220.dp),
            color = color,
            strokeWidth = 10.dp,
            trackColor = C.Panel2,
        )
        Text("%d:%02d".format(left / 60, left % 60), color = C.Text, fontSize = 44.sp, fontWeight = FontWeight.Black)
    }
    Spacer(Modifier.height(28.dp))
    DoneButton(left == 0, color, onDone)
}

@Composable
private fun Gratitude(onDone: () -> Unit) {
    val items = remember { mutableStateListOf("", "", "") }
    Text("اكتب 3 أشياء صغيرة أو كبيرة ممتن لها الآن.\nالامتنان يعيد برمجة نظام المكافأة في دماغك.", color = C.Muted, textAlign = TextAlign.Center)
    Spacer(Modifier.height(16.dp))
    items.indices.forEach { i ->
        OutlinedTextField(
            value = items[i],
            onValueChange = { items[i] = it.take(120) },
            label = { Text("${i + 1}. أنا ممتن لـ…") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        )
    }
    Spacer(Modifier.height(16.dp))
    DoneButton(items.all { it.isNotBlank() }, C.Amber, onDone)
}

private fun newSequence(len: Int) = (1..len).map { Random.nextInt(10) }.joinToString("")

@Composable
private fun MemoryGame(onDone: () -> Unit) {
    var level by remember { mutableIntStateOf(5) }
    var seq by remember { mutableStateOf(newSequence(5)) }
    var showing by remember { mutableStateOf(true) }
    var input by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf("") }
    var wins by remember { mutableIntStateOf(0) }

    LaunchedEffect(seq) {
        showing = true
        delay(1000L + level * 600L)
        showing = false
    }

    Text("احفظ الرقم ثم اكتبه. فز 3 مرات لتكمل التحدي.", color = C.Muted, textAlign = TextAlign.Center)
    Text("الانتصارات: $wins / 3", color = C.Violet, fontWeight = FontWeight.Bold, modifier = Modifier.padding(8.dp))
    Spacer(Modifier.height(16.dp))
    Box(
        Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(24.dp)).background(C.Panel2),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (showing) seq else "؟ ".repeat(level).trim(),
            color = if (showing) C.Violet else C.Muted,
            fontSize = 40.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 6.sp,
        )
    }
    Spacer(Modifier.height(16.dp))
    if (wins >= 3) {
        Text("ذاكرة حادة! 🧠✨", color = C.Green, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))
        DoneButton(true, C.Violet, onDone)
    } else if (!showing) {
        OutlinedTextField(
            value = input,
            onValueChange = { v -> input = v.filter { it.isDigit() }.take(12) },
            label = { Text("اكتب الرقم") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = {
                if (input == seq) {
                    wins++
                    level++
                    msg = "صحيح! المستوى التالي أصعب."
                } else {
                    msg = "كان الرقم $seq — جرّب رقمًا جديدًا."
                }
                input = ""
                seq = newSequence(level)
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = C.Violet, contentColor = Color.Black),
        ) { Text("تحقّق", fontWeight = FontWeight.Bold) }
        if (msg.isNotEmpty()) Text(msg, color = C.Muted, modifier = Modifier.padding(top = 8.dp))
    }
}

private val URGE_PROMPTS = listOf(
    "لاحظ الرغبة دون أن تطيعها. أين تشعر بها في جسمك؟",
    "تنفّس ببطء. الرغبة موجة — ارتفعت، وستنخفض وحدها.",
    "سمِّها: «هذه رغبة في الهروب من الملل» — التسمية تضعفها.",
    "لاحظ أنها تتغير. هل هي أقوى أم أضعف من البداية؟",
    "أنت الشاطئ، والرغبة موجة تمر. لا تحتاج أن تفعل شيئًا.",
    "ابقَ هنا قليلًا. الدماغ يتعلّم الآن أن الرغبة تمر دون استجابة.",
)

/** Urge surfing (mindfulness-based relapse prevention): rate, observe for 90s, rate again. */
@Composable
private fun UrgeSurf(onDone: () -> Unit) {
    var before by remember { mutableIntStateOf(0) }
    var after by remember { mutableIntStateOf(0) }
    var phase by remember { mutableIntStateOf(0) } // 0 rate, 1 surf, 2 rate again, 3 result
    var left by remember { mutableIntStateOf(90) }

    LaunchedEffect(phase) {
        if (phase == 1) {
            left = 90
            while (left > 0) {
                delay(1000)
                left--
            }
            phase = 2
        }
    }

    when (phase) {
        0, 2 -> {
            Text(
                if (phase == 0) "كم قوة رغبتك في فتح المقاطع الآن؟" else "والآن، كم قوتها؟",
                color = C.Text, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            (1..10).chunked(5).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 4.dp)) {
                    row.forEach { n ->
                        Box(
                            Modifier
                                .size(52.dp)
                                .clip(CircleShape)
                                .background(C.Cyan.copy(alpha = 0.08f + n * 0.06f))
                                .clickable {
                                    if (phase == 0) {
                                        before = n
                                        phase = 1
                                    } else {
                                        after = n
                                        phase = 3
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) { Text("$n", color = C.Text, fontSize = 18.sp, fontWeight = FontWeight.Bold) }
                    }
                }
            }
            Text("1 = ضعيفة جدًا • 10 = لا تقاوَم", color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        }
        1 -> {
            val prompt = URGE_PROMPTS[((90 - left) / 15).coerceIn(0, URGE_PROMPTS.lastIndex)]
            Box(contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { 1f - left / 90f },
                    modifier = Modifier.size(220.dp),
                    color = C.Cyan,
                    strokeWidth = 10.dp,
                    trackColor = C.Panel2,
                )
                Text("🌊 $left", color = C.Text, fontSize = 40.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(24.dp))
            Text(prompt, color = C.Text, fontSize = 17.sp, textAlign = TextAlign.Center)
        }
        else -> {
            val drop = before - after
            Text(
                if (drop > 0) "انخفضت رغبتك من $before إلى $after 🎉" else "رغبتك $before ← $after",
                color = C.Green, fontSize = 22.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
            )
            Text(
                if (drop > 0) "هذا هو الدليل: الرغبة تمر وحدها. كل مرة تركبها، تصبح الموجة القادمة أضعف."
                else "لا بأس — أحيانًا تحتاج الموجة وقتًا أطول. مجرد ملاحظتها تمرين يقوّي دماغك.",
                color = C.Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 16.dp),
            )
            DoneButton(true, C.Cyan, onDone)
        }
    }
}
