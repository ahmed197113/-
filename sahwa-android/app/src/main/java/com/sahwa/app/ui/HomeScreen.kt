package com.sahwa.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.AppData
import com.sahwa.app.data.BrainLevel
import com.sahwa.app.data.OBSERVE_DAYS
import com.sahwa.app.data.STAGES
import com.sahwa.app.data.Store
import com.sahwa.app.data.brainLevel
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

fun brainColor(score: Float): Color {
    val h = (score / 100f).coerceIn(0f, 1f)
    return if (h > 0.5f) lerp(C.Violet, C.Cyan, (h - 0.5f) * 2f) else lerp(C.Rot, C.Violet, h * 2f)
}

@Composable
fun HomeScreen(d: AppData, now: Long, onOpenTab: (Tab) -> Unit) {
    val ctx = LocalContext.current
    val guardOn = remember(now / 3000) { isGuardEnabled(ctx) }
    val stalled = remember(now / 3000) { isGuardStalled(ctx, now) }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { ScreenHeader("صحوة", "استعد عقلك من التمرير اللانهائي") }
        item { BrainCard(d) }
        if (!guardOn) item { GuardCta() }
        if (stalled) item { GuardStalledCard() }
        if (d.justLeveledUp) item { LevelUpCard(d) }
        item { LadderCard(d) }
        item { BudgetCard(d, onOpenTab) }
        item { RulesStrip(d, now) }
        item { FocusCard(d, now) }
        item { TodayRow(d) }
        item { ScienceCard() }
    }
}

@Composable
fun BrainOrb(score: Float, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "orb")
    val pulse by t.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(3200, easing = LinearEasing), RepeatMode.Restart),
        label = "pulse",
    )
    val health = (score / 100f).coerceIn(0f, 1f)
    val main = brainColor(score)
    val nodes = remember {
        val r = Random(7)
        List(36) {
            val a = r.nextFloat() * 2f * PI.toFloat()
            val rad = sqrt(r.nextFloat()) * 0.9f
            Offset(cos(a) * rad, sin(a) * rad * 0.82f)
        }
    }
    Canvas(modifier) {
        val c = center
        val radius = size.minDimension / 2f
        drawCircle(
            Brush.radialGradient(listOf(main.copy(alpha = 0.35f), Color.Transparent), c, radius),
            radius,
            c,
        )
        val pts = nodes.map { Offset(c.x + it.x * radius * 0.78f, c.y + it.y * radius * 0.78f) }
        for (i in pts.indices) {
            for (j in i + 1 until pts.size) {
                val dist = (pts[i] - pts[j]).getDistance()
                if (dist < radius * 0.42f) {
                    val active = ((i * 7 + j * 13) % 100) / 100f < health
                    drawLine(
                        color = if (active) main.copy(alpha = 0.5f) else Color(0x33808080),
                        start = pts[i],
                        end = pts[j],
                        strokeWidth = if (active) 2.dp.toPx() else 1.dp.toPx(),
                    )
                }
            }
        }
        pts.forEachIndexed { i, p ->
            val phase = (pulse + i * 0.137f) % 1f
            val glow = 0.5f + 0.5f * sin(phase * 2f * PI.toFloat())
            val alive = (i % 10) / 10f < health
            drawCircle(
                color = if (alive) main.copy(alpha = 0.45f + 0.55f * glow) else C.Rot.copy(alpha = 0.55f),
                radius = (if (alive) 3.5f + 2.5f * glow else 3f).dp.toPx(),
                center = p,
            )
        }
        drawCircle(
            color = main.copy(alpha = (1f - pulse) * 0.5f * (0.3f + health)),
            radius = radius * 0.25f + radius * 0.7f * pulse,
            center = c,
            style = Stroke(2.dp.toPx()),
        )
    }
}

@Composable
private fun BrainCard(d: AppData) {
    val level = brainLevel(d.brain)
    val score by animateFloatAsState(d.brain, tween(800), label = "score")
    val color = brainColor(score)
    GlowCard(accent = color) {
        Box(Modifier.fillMaxWidth().height(250.dp), contentAlignment = Alignment.Center) {
            BrainOrb(score, Modifier.size(250.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${score.toInt()}%", color = C.Text, fontSize = 44.sp, fontWeight = FontWeight.Black)
                Text("صحة الدماغ", color = C.Muted, fontSize = 13.sp)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("الحالة: ", color = C.Muted, fontSize = 15.sp)
            Text(level.label, color = color, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("التعفّن ${(100 - score).toInt()}%", color = if (level == BrainLevel.ROTTING) C.Red else C.Muted, fontSize = 13.sp)
        }
        Text(level.desc, color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun GuardCta() {
    val ctx = LocalContext.current
    var show by remember { mutableStateOf(false) }
    GlowCard(accent = C.Amber) {
        Text("🛡️ الدرع غير مفعّل", color = C.Amber, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            "فعّل «درع صحوة» ليكتشف دخولك للـ Shorts و Reels و TikTok ويعرض بوابة الوعي ويحسب تمريراتك.",
            color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 8.dp),
        )
        Button(
            onClick = { show = true },
            colors = ButtonDefaults.buttonColors(containerColor = C.Amber, contentColor = Color.Black),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("تفعيل الدرع", fontWeight = FontWeight.Bold) }
    }
    if (show) {
        AlertDialog(
            onDismissRequest = { show = false },
            containerColor = C.Panel2,
            title = { Text("إفصاح مهم عن الخصوصية") },
            text = {
                Text(
                    "يستخدم «صحوة» خدمة إمكانية الوصول (Accessibility) لغرض واحد فقط: معرفة متى تكون داخل شاشة المقاطع القصيرة " +
                        "في تطبيقات مثل YouTube و Instagram و TikTok، لعرض بوابة الوعي وعدّ التمريرات وتطبيق حدودك.\n\n" +
                        "• لا نقرأ رسائلك أو كلمات مرورك أو أي نص تكتبه.\n• لا يوجد إنترنت ولا خوادم — كل البيانات على هاتفك فقط.\n\n" +
                        "في الشاشة التالية اختر «درع صحوة» ثم فعّله.",
                    color = C.Muted,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    show = false
                    openAccessibilitySettings(ctx)
                }) { Text("موافق، افتح الإعدادات") }
            },
            dismissButton = { TextButton(onClick = { show = false }) { Text("لاحقًا") } },
        )
    }
}

/** Shows, in one line each, which rules are active right now, so a block is never a surprise. */
@Composable
private fun RulesStrip(d: AppData, now: Long) {
    val rules = buildList {
        if (d.focusUntil > now) add("🎯 التركيز مفعّل — المقاطع مغلقة حتى ينتهي" to C.Violet)
        if (d.nightActive()) {
            add("🌙 درع الليل يعمل الآن (حتى %02d:00)".format(d.nightEnd) to C.Indigo)
        } else if (d.nightShield) {
            add("🌙 درع الليل يبدأ الساعة %02d:00".format(d.nightStart) to C.Muted)
        }
        val yesterday = d.day(java.time.LocalDate.now().minusDays(1).toString())
        if (yesterday.overBudget && !d.overBudget) {
            add("🔁 أمس تجاوزت هدفك — لا بأس. القاعدة: لا تتجاوزه يومين متتاليين" to C.Amber)
        }
        if (d.strictActive) add("🔒 الوضع الصارم مفعّل" to C.Red)
    }
    if (rules.isEmpty()) return
    GlowCard(accent = C.Indigo, padding = PaddingValues(14.dp)) {
        rules.forEach { (text, color) ->
            Text(text, color = color, fontSize = 13.sp, modifier = Modifier.padding(vertical = 2.dp))
        }
    }
}

@Composable
private fun GuardStalledCard() {
    val ctx = LocalContext.current
    GlowCard(accent = C.Red) {
        Text("⚠️ النظام أوقف الدرع", color = C.Red, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            "الدرع مفعّل في الإعدادات لكنه لا يعمل — غالبًا أوقفه توفير البطارية. لهذا يعمل أحيانًا ولا يعمل أحيانًا.\n" +
                "1) اسمح لصحوة بالعمل في الخلفية.\n2) أطفئ «درع صحوة» وشغّله مرة أخرى.",
            color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { requestIgnoreBattery(ctx) },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = C.Red, contentColor = Color.Black),
            ) { Text("🔋 البطارية") }
            OutlinedButton(onClick = { openAccessibilitySettings(ctx) }, modifier = Modifier.weight(1f)) {
                Text("🛡️ إعادة التشغيل")
            }
        }
    }
}

@Composable
private fun BudgetCard(d: AppData, onOpenTab: (Tab) -> Unit) {
    if (d.observing) {
        GlowCard(accent = C.Cyan) {
            SectionTitle("🔍 مرآة اليوم")
            Text(
                "${d.today.swipes} مقطعًا • ${formatDuration(d.today.shortsSec.toLong())}",
                color = C.Cyan, fontSize = 28.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(vertical = 6.dp),
            )
            Text("لا حدود الآن — فقط لاحظ. سنبني هدفك على أرقامك الحقيقية.", color = C.Muted, fontSize = 12.sp)
        }
        return
    }
    val total = d.totalBudget
    val used = d.today.swipes
    val frac = if (total == 0) 0f else (used / total.toFloat()).coerceIn(0f, 1f)
    val color = when {
        frac < 0.6f -> C.Cyan
        frac < 1f -> C.Amber
        else -> C.Red
    }
    GlowCard(accent = color) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                SectionTitle("🎯 هدف اليوم")
                Text("مقاطع قصيرة — مبني على متوسطك (${d.baseline})", color = C.Muted, fontSize = 13.sp)
            }
            Text("$used", color = color, fontSize = 36.sp, fontWeight = FontWeight.Black)
            Text(" / $total", color = C.Muted, fontSize = 16.sp)
        }
        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { frac },
            modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)),
            color = color,
            trackColor = C.Panel2,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (d.overBudget) "تجاوزت الهدف — لا بأس. نشاط بديل واحد يعيد لك التوازن (+5)."
            else "متبقٍ ${d.remaining} • كسبت +${d.today.earned} من الأنشطة البديلة",
            color = C.Muted, fontSize = 12.sp,
        )
        if (d.overBudget) {
            OutlinedButton(onClick = { onOpenTab(Tab.RESCUE) }, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                Text("⚡ نشاط بديل")
            }
        }
    }
}

/** The recovery ladder: where the user is and what it takes to climb. */
@Composable
private fun LadderCard(d: AppData) {
    val st = d.stageInfo
    GlowCard(accent = C.Green) {
        SectionTitle("🪜 سلّم التعافي")
        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            STAGES.forEachIndexed { i, s ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    i < d.stage -> C.Green
                                    i == d.stage -> C.Green.copy(alpha = 0.3f)
                                    else -> C.Panel2
                                },
                            ),
                        contentAlignment = Alignment.Center,
                    ) { Text(if (i < d.stage) "✓" else s.emoji, fontSize = 15.sp, color = Color.Black) }
                    Text(s.name, color = if (i == d.stage) C.Green else C.Muted, fontSize = 10.sp, maxLines = 1)
                }
            }
        }
        Text("${st.emoji} مرحلة ${st.name}", color = C.Text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(st.desc, color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        val progress = if (d.observing) {
            "يوم ${(d.stageDays + 1).coerceAtMost(OBSERVE_DAYS)} من $OBSERVE_DAYS"
        } else if (d.stage == STAGES.lastIndex) {
            "القمة 👑 — حافظ على هدفك. أيام ناجحة هذه الدورة: ${d.stageGoodDays}"
        } else {
            "أيام ناجحة: ${d.stageGoodDays} من ${d.goodDaysNeeded} مطلوبة • اليوم ${d.stageDays + 1} من ${d.pace.days}"
        }
        Text(progress, color = C.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun LevelUpCard(d: AppData) {
    val st = d.stageInfo
    GlowCard(accent = C.Amber) {
        Text("🎉 صعدت درجة!", color = C.Amber, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(
            if (d.stage == 1) "انتهت المراقبة. متوسطك ${d.baseline} مقطعًا يوميًا — ومن هنا نبدأ معًا، خطوة خطوة."
            else "نجحت في المرحلة السابقة، فانتقلت إلى «${st.name}». دماغك يتعلم أنه يستطيع.",
            color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 8.dp),
        )
        Button(
            onClick = { Store.clearLevelUp() },
            colors = ButtonDefaults.buttonColors(containerColor = C.Amber, contentColor = Color.Black),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("هيا بنا ${st.emoji}", fontWeight = FontWeight.Bold) }
    }
}

/** Short, honest explanation of the principles behind the design. */
@Composable
private fun ScienceCard() {
    var open by remember { mutableStateOf(false) }
    GlowCard(accent = C.Indigo, modifier = Modifier.clip(RoundedCornerShape(24.dp)).clickable { open = !open }) {
        SectionTitle("🔬 لماذا يعمل صحوة؟ ${if (open) "▲" else "▼"}")
        if (open) {
            SCIENCE.forEach { (title, body) ->
                Text(title, color = C.Indigo, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                Text(body, color = C.Muted, fontSize = 13.sp)
            }
        } else {
            Text("المبادئ النفسية وراء التصميم", color = C.Muted, fontSize = 12.sp)
        }
    }
}

private val SCIENCE = listOf(
    "التدرّج بدل الحرمان" to "المنع المفاجئ يولّد «مقاومة نفسية» (Reactance) فيترك الناس التطبيق. لذلك نبدأ بالمراقبة ثم نشدد فقط بعد نجاحك — مثل بناء العضلة.",
    "الاحتكاك لا المنع" to "«العادات الذرية» لجيمس كلير: اجعل العادة السيئة صعبة. ثوانٍ قليلة من التوقف تكسر الطيار الآلي دون أن تحرمك.",
    "النيّة قبل الفعل" to "أبحاث «نوايا التنفيذ» (Gollwitzer): من يحدد مسبقًا متى وكم، يلتزم أكثر بكثير. لذلك تختار مدة جلستك قبل الدخول.",
    "ركوب الموجة" to "الرغبة تعلو ثم تهدأ خلال دقائق إذا راقبتها دون أن تطيعها (Urge Surfing — برامج منع الانتكاس، وكتاب «Indistractable» لنير إيال).",
    "استبدال لا حذف" to "«أمة الدوبامين» لآنا ليمبكي: الدماغ يحتاج مصادر متعة صحية. الأنشطة البديلة تكسبك رصيدًا وتعيد التوازن.",
    "الرحمة بالنفس" to "الانتكاسة الصغيرة لا تُعاقب. جلد الذات يقود لانتكاسة أكبر (أثر «خرق الامتناع»). القاعدة فقط: لا تتجاوز يومين متتاليين.",
    "ابدأ صغيرًا واحتفل" to "«العادات الصغيرة» لـ BJ Fogg: النجاح الصغير المتكرر والاحتفال به هو ما يرسّخ العادة.",
)

@Composable
private fun FocusCard(d: AppData, now: Long) {
    GlowCard(accent = C.Violet) {
        SectionTitle("🎯 تركيز عميق")
        if (d.focusUntil > now) {
            val left = (d.focusUntil - now) / 1000
            Text(
                "%02d:%02d".format(left / 60, left % 60),
                color = C.Violet, fontSize = 48.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
            )
            Text(
                "المقاطع القصيرة مغلقة تمامًا. ستكسب +${d.focusMinutes / 5} 🧠 عند الانتهاء.",
                color = C.Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
            )
            if (!d.strictActive) {
                OutlinedButton(onClick = { Store.cancelFocus() }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text("إنهاء مبكر", color = C.Muted)
                }
            }
        } else {
            Text("اغلق المقاطع القصيرة كليًا واعمل على ما يهم.", color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(25, 50, 90).forEach { m ->
                    Button(
                        onClick = { Store.startFocus(m) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = C.Violet.copy(alpha = 0.2f), contentColor = C.Violet),
                    ) { Text("$m د", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun TodayRow(d: AppData) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        MiniStat("⏱", formatDuration(d.today.shortsSec.toLong()), "في المقاطع", C.Pink, Modifier.weight(1f))
        MiniStat("💪", "${d.today.resisted}", "مرة قاومت", C.Green, Modifier.weight(1f))
        MiniStat("⚡", "${d.today.activities}", "نشاط بديل", C.Cyan, Modifier.weight(1f))
    }
}

@Composable
fun MiniStat(icon: String, value: String, label: String, color: Color, modifier: Modifier = Modifier) {
    GlowCard(modifier = modifier, accent = color, padding = PaddingValues(12.dp)) {
        Text(icon, fontSize = 20.sp)
        Text(value, color = color, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text(label, color = C.Muted, fontSize = 11.sp)
    }
}
