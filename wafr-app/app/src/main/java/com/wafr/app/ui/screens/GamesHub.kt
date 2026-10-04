package com.wafr.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Settings
import com.wafr.app.domain.Game
import com.wafr.app.domain.Money
import com.wafr.app.domain.Quiz
import com.wafr.app.domain.Rush
import com.wafr.app.domain.TimeMachine
import com.wafr.app.ui.MainViewModel
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LinearMeter
import com.wafr.app.ui.components.NeonButton
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private enum class G { HUB, FREEDOM, RUSH, QUIZ, TIME }

@Composable
fun GameHeader(title: String, onBack: () -> Unit, subtitle: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "رجوع") }
        Column {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            if (subtitle != null) Text(subtitle, color = Mz.colors.muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun GamesHub(vm: MainViewModel, settings: Settings, freedom: Game.State, contentPadding: PaddingValues) {
    var current by rememberSaveable { mutableStateOf(G.HUB) }
    BackHandler(enabled = current != G.HUB) { current = G.HUB }
    val back = { current = G.HUB }
    AnimatedContent(current, transitionSpec = { (fadeIn() + slideInHorizontally { -it / 6 }) togetherWith fadeOut() }, label = "games") { g ->
        when (g) {
            G.HUB -> Hub(settings, freedom, contentPadding) { current = it }
            G.FREEDOM -> FreedomGame(freedom, settings.gameBest, contentPadding, back, onUpdate = { vm.saveGame(it) }, onReset = { vm.resetGame() })
            G.RUSH -> RushGame(settings.rushBest, contentPadding, back) { vm.saveBest(rush = it) }
            G.QUIZ -> QuizGame(settings.quizBest, contentPadding, back) { vm.saveBest(quiz = it) }
            G.TIME -> TimeMachineGame(settings, contentPadding, back)
        }
    }
}

@Composable
private fun Hub(settings: Settings, freedom: Game.State, contentPadding: PaddingValues, open: (G) -> Unit) {
    val c = Mz.colors
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text("العب وتعلّم 🎮", style = MaterialTheme.typography.headlineSmall)
            Text("ألعاب قصيرة تبني عقلية الثراء — دقيقة يومياً تكفي.", color = c.muted, style = MaterialTheme.typography.bodySmall)
        }
        item {
            GameCard(
                "⚡", "ضروري أم كمالي؟", "لعبة سرعة: 30 ثانية، صنّف أكبر عدد من المشتريات. الكومبو يضاعف نقاطك!",
                if (settings.rushBest > 0) "🏆 أفضل نتيجة: ${settings.rushBest}" else "جديدة",
                listOf(Color(0xFFFFB020), Color(0xFFFF4D6D)),
            ) { open(G.RUSH) }
        }
        item {
            GameCard(
                "🧠", "تحدّي الثقافة المالية", "10 أسئلة من كتب الثراء، 3 قلوب، وشرح بعد كل إجابة.",
                if (settings.quizBest > 0) "⭐ أفضل نتيجة: ${settings.quizBest}/10" else "جديدة",
                listOf(Color(0xFF8A5CFF), Color(0xFF3DD8FF)),
            ) { open(G.QUIZ) }
        }
        item {
            GameCard(
                "🎲", "سباق الحرية", "اشترِ أصولاً وتجنّب الالتزامات حتى يغطي دخلك السلبي مصاريفك.",
                when {
                    settings.gameBest > 0 -> "🏆 تحررت في ${settings.gameBest} شهراً"
                    freedom.started -> "متابعة: الشهر ${freedom.month}"
                    else -> "مستوحاة من «الأب الغني والأب الفقير»"
                },
                listOf(Color(0xFF00F5C4), Color(0xFF00A8FF)),
            ) { open(G.FREEDOM) }
        }
        item {
            GameCard(
                "⏳", "آلة الزمن", "شاهد ادخارك الشهري يكبر بالفائدة المركبة… متى تصل لأول مليون؟",
                "محاكاة تفاعلية",
                listOf(Color(0xFF00C8FF), Color(0xFF8A5CFF)),
            ) { open(G.TIME) }
        }
    }
}

@Composable
private fun GameCard(emoji: String, title: String, desc: String, badge: String, colors: List<Color>, onClick: () -> Unit) {
    val c = Mz.colors
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp))
            .background(Brush.linearGradient(listOf(colors[0].copy(alpha = 0.28f), colors[1].copy(alpha = 0.12f), c.card)))
            .border(1.dp, Brush.linearGradient(colors.map { it.copy(alpha = 0.7f) }), RoundedCornerShape(28.dp))
            .clickable(onClick = onClick)
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(72.dp).clip(RoundedCornerShape(22.dp)).background(Brush.linearGradient(colors)),
            contentAlignment = Alignment.Center,
        ) { Text(emoji, fontSize = 36.sp) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(desc, color = c.muted, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(6.dp))
            Text(badge, color = colors[0], fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

// ---------------------------------------------------------------- Rush

@Composable
private fun RushGame(best: Int, contentPadding: PaddingValues, onBack: () -> Unit, onBest: (Int) -> Unit) {
    val c = Mz.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var running by remember { mutableStateOf(false) }
    var finished by remember { mutableStateOf(false) }
    var timeLeft by remember { mutableIntStateOf(30) }
    var score by remember { mutableIntStateOf(0) }
    var combo by remember { mutableIntStateOf(0) }
    var answered by remember { mutableIntStateOf(0) }
    var correct by remember { mutableIntStateOf(0) }
    var deck by remember { mutableStateOf(Rush.items.shuffled()) }
    var index by remember { mutableIntStateOf(0) }
    var flash by remember { mutableStateOf<Boolean?>(null) }
    val mistakes = remember { mutableStateListOf<Rush.Item>() }
    val shake = remember { Animatable(0f) }

    LaunchedEffect(running) {
        while (running && timeLeft > 0) {
            delay(1000)
            timeLeft--
        }
        if (running) {
            running = false; finished = true
            onBest(score)
        }
    }

    fun answer(need: Boolean) {
        if (!running) return
        val item = deck[index % deck.size]
        answered++
        if (item.need == need) {
            correct++; combo++
            score += 10 * (1 + combo / 3)
            flash = true
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        } else {
            combo = 0; timeLeft = (timeLeft - 3).coerceAtLeast(0)
            mistakes += item
            flash = false
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            scope.launch {
                for (x in listOf(18f, -14f, 10f, -6f, 0f)) shake.animateTo(x, tween(45))
            }
        }
        index++
        if (index >= deck.size) { deck = Rush.items.shuffled(); index = 0 }
    }

    fun start() {
        score = 0; combo = 0; answered = 0; correct = 0; timeLeft = 30; mistakes.clear()
        deck = Rush.items.shuffled(); index = 0; finished = false; running = true
    }

    Column(
        Modifier.fillMaxSize().padding(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 12.dp),
    ) {
        GameHeader("ضروري أم كمالي؟ ⚡", onBack, if (best > 0) "🏆 أفضل نتيجة: $best" else null)
        Spacer(Modifier.height(10.dp))
        when {
            finished -> {
                val acc = if (answered > 0) correct * 100 / answered else 0
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (score >= best && score > 0) "🏆 رقم قياسي جديد!" else "انتهى الوقت ⏱️", style = MaterialTheme.typography.titleLarge, color = c.want)
                        Text("$score", fontSize = 64.sp, fontWeight = FontWeight.Bold, color = c.good)
                        Text("دقة $acc% • $correct إجابة صحيحة من $answered", color = c.muted)
                    }
                }
                Spacer(Modifier.height(12.dp))
                if (mistakes.isNotEmpty()) {
                    GlassCard(Modifier.fillMaxWidth().weight(1f, fill = false)) {
                        Text("تعلّم من أخطائك", style = MaterialTheme.typography.titleMedium)
                        mistakes.distinct().take(5).forEach { m ->
                            Text("${m.emoji} ${m.name} — ${if (m.need) "ضروري" else "كمالي"}: ${m.why}", fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }
                NeonButton("العب مجدداً", Modifier.fillMaxWidth()) { start() }
            }
            !running -> {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("كيف تلعب؟", style = MaterialTheme.typography.titleMedium)
                    Text("سيظهر لك شيء تشتريه. قرّر بسرعة: ضروري أم كمالي؟\n✅ إجابة صحيحة = نقاط، و3 صحيحة متتالية تضاعف النقاط.\n❌ إجابة خاطئة = تخسر 3 ثوانٍ والكومبو.", style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(16.dp))
                NeonButton("ابدأ ⚡", Modifier.fillMaxWidth()) { start() }
            }
            else -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("⏱️ $timeLeft", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = if (timeLeft <= 5) c.danger else c.text, modifier = Modifier.weight(1f))
                    if (combo >= 3) Text("🔥 ×${1 + combo / 3}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = c.want)
                    Spacer(Modifier.width(12.dp))
                    Text("$score", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = c.good)
                }
                Spacer(Modifier.height(6.dp))
                LinearMeter(timeLeft / 30f, if (timeLeft <= 5) c.danger else c.good, height = 6.dp)
                Spacer(Modifier.height(20.dp))
                val item = deck[index % deck.size]
                val border by animateFloatAsState(if (flash == null) 0f else 1f, label = "flash")
                Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    AnimatedContent(index, transitionSpec = { scaleIn(spring(dampingRatio = Spring.DampingRatioMediumBouncy), initialScale = 0.7f) + fadeIn() togetherWith fadeOut(tween(80)) }, label = "item") { _ ->
                        Column(
                            Modifier.offset { IntOffset(shake.value.roundToInt(), 0) }.fillMaxWidth().clip(RoundedCornerShape(32.dp))
                                .background(Brush.linearGradient(listOf(c.glow3.copy(alpha = 0.25f), c.card)))
                                .border(2.dp, (if (flash == false) c.danger else c.glow1).copy(alpha = 0.3f + 0.5f * border), RoundedCornerShape(32.dp))
                                .padding(vertical = 36.dp, horizontal = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(item.emoji, fontSize = 84.sp)
                            Spacer(Modifier.height(10.dp))
                            Text(item.name, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    BigChoice("✅", "ضروري", c.need, Modifier.weight(1f)) { answer(true) }
                    BigChoice("🛍️", "كمالي", c.want, Modifier.weight(1f)) { answer(false) }
                }
            }
        }
    }
}

@Composable
private fun BigChoice(emoji: String, label: String, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.height(96.dp).clip(RoundedCornerShape(26.dp))
            .background(Brush.verticalGradient(listOf(color.copy(alpha = 0.35f), color.copy(alpha = 0.12f))))
            .border(2.dp, color, RoundedCornerShape(26.dp))
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(emoji, fontSize = 30.sp)
        Text(label, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = color)
    }
}

// ---------------------------------------------------------------- Quiz

@Composable
private fun QuizGame(best: Int, contentPadding: PaddingValues, onBack: () -> Unit, onBest: (Int) -> Unit) {
    val c = Mz.colors
    var round by remember { mutableStateOf(Quiz.questions.shuffled().take(10)) }
    var i by remember { mutableIntStateOf(0) }
    var hearts by remember { mutableIntStateOf(3) }
    var score by remember { mutableIntStateOf(0) }
    var picked by remember { mutableStateOf<Int?>(null) }
    var done by remember { mutableStateOf(false) }

    fun restart() { round = Quiz.questions.shuffled().take(10); i = 0; hearts = 3; score = 0; picked = null; done = false }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { GameHeader("تحدّي الثقافة المالية 🧠", onBack, if (best > 0) "⭐ أفضل نتيجة: $best/10" else null) }
        if (done) {
            item {
                val stars = when { score >= 9 -> 3; score >= 6 -> 2; score >= 3 -> 1; else -> 0 }
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("⭐".repeat(stars) + "☆".repeat(3 - stars), fontSize = 40.sp, color = c.want)
                        Text("$score / 10", fontSize = 48.sp, fontWeight = FontWeight.Bold, color = c.good)
                        Text(
                            when (stars) { 3 -> "عقلية مليونير! 🏆"; 2 -> "ممتاز، أنت على الطريق 👏"; 1 -> "بداية جيدة، العب مرة أخرى 💪"; else -> "كل خبير بدأ من هنا 🌱" },
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(14.dp))
                        NeonButton("تحدٍّ جديد", Modifier.fillMaxWidth()) { restart() }
                    }
                }
            }
            return@LazyColumn
        }
        val q = round[i]
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("سؤال ${i + 1}/10", color = c.muted, modifier = Modifier.weight(1f))
                Text("❤️".repeat(hearts) + "🖤".repeat(3 - hearts), fontSize = 18.sp)
            }
            Spacer(Modifier.height(6.dp))
            LinearMeter((i + if (picked != null) 1 else 0) / 10f, c.glow3, height = 6.dp)
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) { Text(q.text, style = MaterialTheme.typography.titleLarge) }
        }
        q.options.forEachIndexed { idx, opt ->
            item {
                val state = when {
                    picked == null -> 0
                    idx == q.answer -> 1
                    idx == picked -> 2
                    else -> 3
                }
                val color = when (state) { 1 -> c.good; 2 -> c.danger; else -> c.cardBorder }
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(if (state == 1) c.good.copy(alpha = 0.14f) else if (state == 2) c.danger.copy(alpha = 0.14f) else c.card)
                        .border(if (state in 1..2) 2.dp else 1.dp, color, RoundedCornerShape(18.dp))
                        .clickable(enabled = picked == null) {
                            picked = idx
                            if (idx == q.answer) score++ else hearts--
                        }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(30.dp).clip(CircleShape).background(c.muted.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                        Text(listOf("أ", "ب", "ج", "د")[idx], fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(opt, modifier = Modifier.weight(1f), fontWeight = if (state == 1) FontWeight.Bold else FontWeight.Normal)
                    if (state == 1) Text("✓", color = c.good, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    if (state == 2) Text("✗", color = c.danger, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                }
            }
        }
        if (picked != null) {
            item {
                Text(
                    "💡 ${q.explain}", modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.glow2.copy(alpha = 0.12f)).padding(14.dp),
                )
            }
            item {
                NeonButton(if (i == 9 || hearts == 0) "النتيجة" else "التالي ←", Modifier.fillMaxWidth()) {
                    if (i == 9 || hearts == 0) { done = true; onBest(score) } else { i++; picked = null }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Time machine

@Composable
private fun TimeMachineGame(settings: Settings, contentPadding: PaddingValues, onBack: () -> Unit) {
    val c = Mz.colors
    val defaultMonthly = if (settings.monthlyIncome > 0) (settings.monthlyIncome / 100 * 0.2f).coerceIn(100f, 20000f) else 1000f
    var monthly by rememberSaveable { mutableStateOf(defaultMonthly.roundToInt().toFloat()) }
    var years by rememberSaveable { mutableStateOf(20f) }
    var rate by rememberSaveable { mutableStateOf(7f) }
    val series = TimeMachine.series(monthly.toDouble(), years.roundToInt(), rate / 100.0)
    val (deposited, total) = series.lastOrNull() ?: (0.0 to 0.0)
    val toMillion = TimeMachine.yearsTo(1_000_000.0, monthly.toDouble(), rate / 100.0)
    val late = TimeMachine.series(monthly.toDouble(), (years.roundToInt() - 5).coerceAtLeast(1), rate / 100.0).last().second
    val cur = settings.currency
    fun m(v: Double) = Money.format(Money.toMinor(v), cur)

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { GameHeader("آلة الزمن ⏳", onBack, "حرّك المؤشرات وشاهد قوة الفائدة المركبة") }
        item {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.hero).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("بعد ${years.roundToInt()} سنة سيكون لديك", color = Color.White.copy(alpha = 0.75f))
                Text(m(total), fontSize = 34.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("دفعت ${m(deposited)} فقط • الباقي ${m(total - deposited)} أرباح 🌱", color = c.good, fontSize = 13.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(14.dp))
                GrowthChart(series)
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("ادخار شهري: ${m(monthly.toDouble())}", fontWeight = FontWeight.SemiBold)
                Slider(monthly, { monthly = (it / 50f).roundToInt() * 50f }, valueRange = 100f..10000f)
                Text("المدة: ${years.roundToInt()} سنة", fontWeight = FontWeight.SemiBold)
                Slider(years, { years = it }, valueRange = 1f..40f)
                Text("العائد السنوي المتوقع: ${rate.roundToInt()}%", fontWeight = FontWeight.SemiBold)
                Slider(rate, { rate = it }, valueRange = 0f..12f)
                Text("تذكير: العوائد غير مضمونة، والأرقام توضيحية للتعلّم.", fontSize = 11.sp, color = c.muted)
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("🎯 تحدّي المليون", style = MaterialTheme.typography.titleMedium, color = c.want)
                Text(
                    if (toMillion != null) "بادخار ${m(monthly.toDouble())} شهرياً تصل لأول مليون بعد $toMillion سنة." else "زِد الادخار أو العائد لتصل للمليون.",
                )
                Spacer(Modifier.height(8.dp))
                Text("⏰ لو تأخرت 5 سنوات في البدء: ${m(late)} فقط — خسارة ${m(total - late)}!", color = c.danger, fontSize = 13.sp)
                if (rate > 0) Text("🔁 قاعدة 72: مالك يتضاعف كل ${"%.1f".format(TimeMachine.doublingYears(rate / 100.0))} سنة تقريباً.", fontSize = 13.sp, color = c.muted)
            }
        }
    }
}

@Composable
private fun GrowthChart(series: List<Pair<Double, Double>>) {
    val c = Mz.colors
    val anim = remember { Animatable(0f) }
    LaunchedEffect(series.size) { anim.snapTo(0f); anim.animateTo(1f, tween(900)) }
    Canvas(Modifier.fillMaxWidth().height(150.dp)) {
        if (series.isEmpty()) return@Canvas
        val maxV = series.maxOf { it.second }.coerceAtLeast(1.0)
        val n = series.size
        fun pt(i: Int, v: Double) = Offset(size.width - size.width * (i + 1) / n, size.height - (size.height * (v / maxV) * anim.value).toFloat())
        val total = Path().apply { moveTo(size.width, size.height); series.forEachIndexed { i, p -> lineTo(pt(i, p.second).x, pt(i, p.second).y) }; lineTo(0f, size.height); close() }
        val dep = Path().apply { moveTo(size.width, size.height); series.forEachIndexed { i, p -> lineTo(pt(i, p.first).x, pt(i, p.first).y) }; lineTo(0f, size.height); close() }
        drawPath(total, Brush.verticalGradient(listOf(c.glow1.copy(alpha = 0.7f), c.glow1.copy(alpha = 0.05f))))
        drawPath(dep, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.35f), Color.White.copy(alpha = 0.05f))))
        val line = Path().apply { series.forEachIndexed { i, p -> val o = pt(i, p.second); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) } }
        drawPath(line, c.glow1, style = Stroke(3.dp.toPx()))
    }
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("■ الأرباح", color = c.glow1, fontSize = 11.sp)
        Text("■ ما دفعته", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
    }
}
