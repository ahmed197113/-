package com.wafr.app.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LinearMeter
import com.wafr.app.ui.components.NeonButton
import com.wafr.app.ui.theme.Mz
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

// =====================================================================  صائد الثروة (2D arcade)

private enum class DropType { GOOD, BAD, SHIELD, BOOST }

private data class DropKind(val emoji: String, val name: String, val value: Int, val type: DropType, val weight: Int, val lesson: String)

private val dropKinds = listOf(
    DropKind("🪙", "عملة", 10, DropType.GOOD, 34, ""),
    DropKind("💵", "ادخار", 25, DropType.GOOD, 16, "كل ريال تدّخره يقرّبك من الحرية."),
    DropKind("📈", "سهم توزيعات", 60, DropType.GOOD, 8, "الأصل يضع المال في جيبك كل شهر."),
    DropKind("🏠", "عقار مؤجَّر", 120, DropType.GOOD, 4, "العقار المؤجَّر أصل يدرّ دخلاً سلبياً."),
    DropKind("💳", "دين بطاقة", 60, DropType.BAD, 12, "الدين الاستهلاكي يأكل مستقبلك بفوائده."),
    DropKind("🛍️", "شراء اندفاعي", 40, DropType.BAD, 11, "فكّر 48 ساعة قبل أي شراء غير ضروري."),
    DropKind("🍔", "توصيل يومي", 25, DropType.BAD, 9, "المصاريف الصغيرة المتكررة تتراكم لمبالغ ضخمة."),
    DropKind("🎰", "مضاربة عشوائية", 100, DropType.BAD, 4, "لا تستثمر فيما لا تفهمه — هذا قمار لا استثمار."),
    DropKind("🛡️", "صندوق طوارئ", 0, DropType.SHIELD, 3, "صندوق الطوارئ يحميك من الضربة القادمة."),
    DropKind("⏳", "فائدة مركبة", 0, DropType.BOOST, 3, "الفائدة المركبة: أرباحك تولّد أرباحاً — ×2 لـ 6 ثوانٍ!"),
)

private class Drop(val kind: DropKind, val x: Float, var y: Float, val speed: Float)
private class Floater(val text: String, val color: Color, val x: Float, var y: Float, var life: Float)

private class CatcherState {
    var playerX = 0.5f
    val drops = ArrayList<Drop>()
    val floaters = ArrayList<Floater>()
    var score = 0
    var lives = 3
    var shield = false
    var boostLeft = 0f
    var spawnIn = 0.6f
    var time = 0f
    var banner = ""
    var bannerLeft = 0f
    val learned = LinkedHashSet<String>()
    val level: Int get() = 1 + score / 250
}

@Composable
fun WealthCatcherGame(best: Int, contentPadding: PaddingValues, onBack: () -> Unit, onBest: (Int) -> Unit) {
    val c = Mz.colors
    val haptic = LocalHapticFeedback.current
    var game by remember { mutableStateOf(CatcherState()) }
    var running by remember { mutableStateOf(false) }
    var over by remember { mutableStateOf(false) }
    var frame by remember { mutableLongStateOf(0L) }
    val measurer = rememberTextMeasurer()
    val emojiCache = remember { HashMap<String, TextLayoutResult>() }

    fun pick(): DropKind {
        var r = Random.nextInt(dropKinds.sumOf { it.weight })
        for (k in dropKinds) { r -= k.weight; if (r < 0) return k }
        return dropKinds.first()
    }

    LaunchedEffect(running) {
        if (!running) return@LaunchedEffect
        var last = withFrameNanos { it }
        while (running) {
            val now = withFrameNanos { it }
            val dt = ((now - last) / 1e9f).coerceAtMost(0.05f)
            last = now
            val g = game
            g.time += dt
            g.spawnIn -= dt
            if (g.spawnIn <= 0f) {
                g.drops += Drop(pick(), Random.nextFloat() * 0.84f + 0.08f, -0.05f, 0.22f + 0.045f * g.level + Random.nextFloat() * 0.08f)
                g.spawnIn = (0.85f - 0.06f * g.level).coerceAtLeast(0.32f)
            }
            if (g.boostLeft > 0) g.boostLeft -= dt
            if (g.bannerLeft > 0) g.bannerLeft -= dt
            val it = g.drops.iterator()
            while (it.hasNext()) {
                val d = it.next()
                d.y += d.speed * dt
                val caught = d.y in 0.80f..0.92f && abs(d.x - g.playerX) < 0.11f
                if (caught) {
                    it.remove()
                    when (d.kind.type) {
                        DropType.GOOD -> {
                            val v = d.kind.value * (if (g.boostLeft > 0) 2 else 1)
                            g.score += v
                            g.floaters += Floater("+$v", c.good, d.x, 0.8f, 0.8f)
                            if (d.kind.lesson.isNotEmpty() && g.learned.add(d.kind.lesson)) { g.banner = "${d.kind.emoji} ${d.kind.lesson}"; g.bannerLeft = 2.6f }
                        }
                        DropType.BAD -> {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            if (g.shield) {
                                g.shield = false
                                g.banner = "🛡️ صندوق الطوارئ أنقذك من «${d.kind.name}»!"; g.bannerLeft = 2.2f
                            } else {
                                g.lives--
                                g.score = (g.score - d.kind.value).coerceAtLeast(0)
                                g.floaters += Floater("-${d.kind.value}", c.danger, d.x, 0.8f, 0.9f)
                                g.learned.add(d.kind.lesson)
                                g.banner = "${d.kind.emoji} ${d.kind.name}: ${d.kind.lesson}"; g.bannerLeft = 2.8f
                            }
                        }
                        DropType.SHIELD -> { g.shield = true; g.banner = "🛡️ ${d.kind.lesson}"; g.bannerLeft = 2.2f; g.learned.add(d.kind.lesson) }
                        DropType.BOOST -> { g.boostLeft = 6f; g.banner = "⏳ ${d.kind.lesson}"; g.bannerLeft = 2.4f; g.learned.add(d.kind.lesson) }
                    }
                } else if (d.y > 1.05f) it.remove()
            }
            val fl = g.floaters.iterator()
            while (fl.hasNext()) { val f = fl.next(); f.y -= 0.12f * dt; f.life -= dt; if (f.life <= 0) fl.remove() }
            if (g.lives <= 0) { running = false; over = true; onBest(g.score) }
            frame++
        }
    }

    fun start() { game = CatcherState(); over = false; running = true }

    Column(Modifier.fillMaxSize().padding(start = 14.dp, end = 14.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 8.dp)) {
        GameHeader("صائد الثروة 🪙", { running = false; onBack() }, if (best > 0) "🏆 أفضل ثروة: $best" else "التقط الأصول وتجنّب الفخاخ")
        val g = game
        frame.let { }
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("❤️".repeat(g.lives.coerceAtLeast(0)) + "🖤".repeat((3 - g.lives).coerceIn(0, 3)), fontSize = 18.sp)
            if (g.shield) Text(" 🛡️", fontSize = 18.sp)
            if (g.boostLeft > 0) Text(" ⏳×2", fontSize = 16.sp, color = c.want, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("مستوى ${g.level}  ", color = c.muted, fontSize = 13.sp)
            Text("💰 ${g.score}", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = c.good)
        }
        Box(
            Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(28.dp))
                .border(1.dp, c.border, RoundedCornerShape(28.dp))
                .pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) {
                            val e = awaitPointerEvent()
                            e.changes.firstOrNull()?.let { ch -> game.playerX = (ch.position.x / size.width).coerceIn(0.1f, 0.9f) }
                        }
                    }
                },
        ) {
            Canvas(Modifier.fillMaxSize()) {
                frame.let { }
                val w = size.width; val h = size.height
                drawRect(Brush.verticalGradient(listOf(Color(0xFF061A33), Color(0xFF120B3A), Color(0xFF240E4E))))
                // parallax stars
                for (i in 0 until 40) {
                    val sx = ((i * 97) % 100) / 100f * w
                    val sy = (((i * 53) % 100) / 100f * h + g.time * (12 + i % 5 * 8)) % h
                    drawCircle(Color.White.copy(alpha = 0.25f + (i % 3) * 0.15f), radius = 1.5f + (i % 3), center = Offset(sx, sy))
                }
                // floor glow
                drawRect(Brush.verticalGradient(listOf(Color.Transparent, c.glow1.copy(alpha = 0.18f)), startY = h * 0.8f, endY = h), topLeft = Offset(0f, h * 0.8f), size = Size(w, h * 0.2f))
                val emojiSize = 30.sp
                for (d in g.drops) {
                    val layout = emojiCache.getOrPut(d.kind.emoji) { measurer.measure(d.kind.emoji, TextStyle(fontSize = emojiSize)) }
                    if (d.kind.type == DropType.BAD) drawCircle(c.danger.copy(alpha = 0.22f), radius = layout.size.width * 0.75f, center = Offset(d.x * w, d.y * h))
                    if (d.kind.type == DropType.GOOD && d.kind.value >= 60) drawCircle(c.glow1.copy(alpha = 0.25f), radius = layout.size.width * 0.8f, center = Offset(d.x * w, d.y * h))
                    drawText(layout, topLeft = Offset(d.x * w - layout.size.width / 2f, d.y * h - layout.size.height / 2f))
                }
                // player wallet
                val pw = w * 0.22f; val ph = h * 0.06f
                val px = g.playerX * w - pw / 2; val py = h * 0.86f
                if (g.shield) drawRoundRect(Color(0x553DD8FF), Offset(px - 10, py - 10), Size(pw + 20, ph + 20), CornerRadius(ph, ph))
                drawRoundRect(Brush.horizontalGradient(listOf(Color(0xFF00F5C4), Color(0xFF00C8FF), Color(0xFF8A5CFF)), startX = px, endX = px + pw), Offset(px, py), Size(pw, ph), CornerRadius(ph / 2, ph / 2))
                val wallet = emojiCache.getOrPut("👛") { measurer.measure("👛", TextStyle(fontSize = 26.sp)) }
                drawText(wallet, topLeft = Offset(g.playerX * w - wallet.size.width / 2f, py - wallet.size.height * 0.85f))
                for (f in g.floaters) {
                    val l = measurer.measure(f.text, TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold, color = f.color.copy(alpha = f.life.coerceIn(0f, 1f))))
                    drawText(l, topLeft = Offset(f.x * w - l.size.width / 2f, f.y * h))
                }
            }
            if (g.bannerLeft > 0 && g.banner.isNotEmpty()) {
                Text(
                    g.banner, color = Color.White, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, fontSize = 14.sp,
                    modifier = Modifier.align(Alignment.TopCenter).padding(12.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xCC0A1226)).padding(10.dp),
                )
            }
            if (!running) {
                Column(
                    Modifier.align(Alignment.Center).padding(20.dp).clip(RoundedCornerShape(24.dp)).background(Color(0xE60A1226)).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    if (over) {
                        Text(if (g.score >= best && g.score > 0) "🏆 رقم قياسي!" else "انتهت الجولة", color = c.want, style = MaterialTheme.typography.titleLarge)
                        Text("💰 ${g.score}", fontSize = 44.sp, fontWeight = FontWeight.Bold, color = c.good)
                        if (g.learned.isNotEmpty()) {
                            Text("ما تعلّمته:", color = Color.White, fontWeight = FontWeight.Bold)
                            g.learned.take(4).forEach { Text("• $it", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp) }
                        }
                    } else {
                        Text("🪙📈🏠  التقطها", color = c.good, fontWeight = FontWeight.Bold)
                        Text("💳🛍️🎰  تجنّبها", color = c.danger, fontWeight = FontWeight.Bold)
                        Text("🛡️ صندوق طوارئ يحميك • ⏳ فائدة مركبة ×2", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
                        Text("حرّك إصبعك يميناً ويساراً لتحريك محفظتك", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    NeonButton(if (over) "العب مجدداً" else "ابدأ 🚀", Modifier.width(200.dp)) { start() }
                }
            }
        }
    }
}

// =====================================================================  شهر في حياتك (swipe cards)

private data class MonthCard(
    val emoji: String, val title: String, val desc: String, val cost: Int,
    val happyYes: Int, val happyNo: Int, val need: Boolean, val fine: Int = 0, val gift: Boolean = false,
)

private val monthNeeds = listOf(
    MonthCard("💡", "فاتورة الكهرباء", "استحقت فاتورة هذا الشهر.", 300, 0, -15, true, fine = 150),
    MonthCard("🛒", "مقاضي البيت", "طعام الأسبوعين القادمين.", 700, 5, -25, true, fine = 0),
    MonthCard("⛽", "بنزين للعمل", "بدونه لن تصل لعملك.", 250, 0, -10, true, fine = 200),
    MonthCard("💊", "دواء ضروري", "وصفة طبية لا تحتمل التأجيل.", 180, 5, -25, true, fine = 0),
    MonthCard("🌐", "فاتورة الإنترنت", "تحتاجه للعمل والدراسة.", 230, 0, -8, true, fine = 100),
)
private val monthWants = listOf(
    MonthCard("🎬", "سينما مع الأصدقاء", "سهرة ممتعة نهاية الأسبوع.", 120, 12, -4, false),
    MonthCard("📱", "هاتف جديد", "هاتفك يعمل… لكن الجديد يلمع!", 2800, 18, -3, false),
    MonthCard("🍣", "عشاء فاخر", "مطعم جديد الكل يتحدث عنه.", 350, 10, -3, false),
    MonthCard("👟", "حذاء ماركة", "تخفيض 30% لفترة محدودة!", 600, 8, -2, false),
    MonthCard("☕", "قهوة يومية لأسبوع", "قهوتك المفضلة كل صباح.", 140, 7, -3, false),
    MonthCard("🎮", "لعبة جديدة", "إصدار جديد لسلسلتك المفضلة.", 300, 10, -3, false),
    MonthCard("✈️", "رحلة نهاية أسبوع", "عرض سفر مغري.", 1500, 20, -4, false),
    MonthCard("🛋️", "تجديد الأثاث", "الصالة تحتاج لمسة جديدة.", 1200, 9, -2, false),
    MonthCard("🎁", "هدية لصديق", "عيد ميلاد صديق مقرّب.", 200, 12, -10, false),
    MonthCard("📚", "دورة تطوير مهارات", "استثمار في نفسك يرفع دخلك مستقبلاً.", 400, 10, -2, false),
    MonthCard("🍔", "توصيل طعام", "تعبان ولا رغبة لك بالطبخ.", 90, 6, -4, false),
)
private val monthEvents = listOf(
    MonthCard("🎉", "مكافأة عمل!", "مديرك أعجب بأدائك.", -800, 10, 10, false, gift = true),
    MonthCard("🔧", "عطل في السيارة", "إصلاح طارئ لا مفرّ منه.", 600, -5, -20, true, fine = 900),
)

@Composable
fun MonthSwipeGame(best: Int, contentPadding: PaddingValues, onBack: () -> Unit, onBest: (Int) -> Unit) {
    val c = Mz.colors
    val salary = 6000; val rent = 2000; val target = 1000
    val scope = rememberCoroutineScope()
    fun newDeck() = (monthNeeds + monthWants.shuffled().take(8) + monthEvents.shuffled().take(1)).shuffled()
    var deck by remember { mutableStateOf(newDeck()) }
    var i by remember { mutableIntStateOf(0) }
    var cash by remember { mutableIntStateOf(salary - rent) }
    var happy by remember { mutableIntStateOf(60) }
    var log by remember { mutableStateOf(listOf<String>()) }
    var started by remember { mutableStateOf(false) }
    val drag = remember { Animatable(0f) }
    val finished = started && (i >= deck.size || cash < 0 || happy <= 0)

    fun restart() { deck = newDeck(); i = 0; cash = salary - rent; happy = 60; log = emptyList(); started = true }

    fun decide(yes: Boolean) {
        val card = deck.getOrNull(i) ?: return
        if (card.gift) {
            cash -= card.cost; happy += card.happyYes; log = log + "🎉 حصلت على ${-card.cost}"
        } else if (yes) {
            cash -= card.cost; happy += card.happyYes
            log = log + "${card.emoji} دفعت ${card.cost} لـ ${card.title}"
        } else {
            happy += card.happyNo
            if (card.need && card.fine > 0) { cash -= card.fine; log = log + "⚠️ أجّلت ${card.title}: غرامة ${card.fine}" }
            else log = log + "✋ رفضت ${card.title}"
        }
        happy = happy.coerceIn(0, 100)
        i++
        scope.launch { drag.snapTo(0f) }
    }

    Column(Modifier.fillMaxSize().padding(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 8.dp)) {
        GameHeader("شهر في حياتك 🗓️", onBack, if (best > 0) "⭐ أفضل نتيجة: $best نجوم" else "وازن بين مالك وسعادتك")
        if (!started) {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("راتبك $salary، والإيجار $rent دُفع تلقائياً.", fontWeight = FontWeight.Bold)
                    Text("ستظهر لك مواقف الشهر واحداً تلو الآخر:\n👉 اسحب يميناً = ادفع ✅\n👈 اسحب يساراً = ارفض ❌", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("🎯 الهدف: تنهي الشهر وقد ادّخرت $target على الأقل، دون أن تنهار سعادتك.\n⚠️ تأجيل الضروريات له غرامات… والحرمان التام يقتل سعادتك.", color = c.muted, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(14.dp))
                NeonButton("ابدأ الشهر 🚀", Modifier.fillMaxWidth()) { restart() }
            }
            return@Column
        }
        // meters
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Column(Modifier.weight(1f)) {
                Text("💵 $cash", fontWeight = FontWeight.Bold, color = if (cash >= target) c.good else c.text)
                LinearMeter((cash.toFloat() / (salary - rent)).coerceIn(0f, 1f), c.good, height = 6.dp)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text("${if (happy >= 50) "😊" else if (happy >= 25) "😐" else "😟"} $happy", fontWeight = FontWeight.Bold)
                LinearMeter(happy / 100f, if (happy >= 40) c.want else c.danger, height = 6.dp)
            }
        }
        Text("الموقف ${(i + 1).coerceAtMost(deck.size)} من ${deck.size} • هدف الادخار $target", color = c.muted, fontSize = 12.sp)
        Spacer(Modifier.height(10.dp))
        if (finished) {
            val saved = cash
            val stars = when {
                saved >= target && happy >= 50 -> 3
                saved >= target && happy >= 30 -> 2
                saved > 0 && happy > 0 -> 1
                else -> 0
            }
            LaunchedEffect(Unit) { onBest(stars) }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("⭐".repeat(stars) + "☆".repeat(3 - stars), fontSize = 40.sp, color = c.want)
                        Text(
                            when {
                                cash < 0 -> "💸 اضطررت للاستدانة!"
                                happy <= 0 -> "😩 احترقت من الحرمان!"
                                stars == 3 -> "🏆 توازن مثالي!"
                                stars == 2 -> "👏 أحسنت، ادّخرت الهدف"
                                else -> "حاول أن تدّخر الهدف"
                            },
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Text("ادّخرت $saved • السعادة $happy", color = c.muted)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "💡 الدرس: الحرمان التام لا يدوم، والصرف بلا حساب لا يبني ثروة. خصّص للمتعة حصة محددة (مثل 30%) وادّخر أولاً.",
                            fontSize = 13.sp, textAlign = TextAlign.Center,
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                log.takeLast(8).forEach { Text(it, fontSize = 12.sp, color = c.muted) }
                Spacer(Modifier.height(12.dp))
                NeonButton("شهر جديد ↺", Modifier.fillMaxWidth()) { restart() }
            }
            return@Column
        }
        val card = deck[i]
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            // next card peeking behind
            deck.getOrNull(i + 1)?.let {
                Box(Modifier.fillMaxWidth(0.9f).height(300.dp).offset(y = 14.dp).clip(RoundedCornerShape(30.dp)).background(c.card.copy(alpha = 0.6f)))
            }
            val color = if (card.need) c.need else if (card.gift) c.good else c.want
            Column(
                Modifier.fillMaxWidth().height(330.dp)
                    .offset { IntOffset(drag.value.roundToInt(), 0) }
                    .graphicsLayer { rotationZ = drag.value / 40f }
                    .clip(RoundedCornerShape(30.dp))
                    .background(Brush.linearGradient(listOf(color.copy(alpha = 0.30f), c.card)))
                    .border(2.dp, color.copy(alpha = 0.8f), RoundedCornerShape(30.dp))
                    .pointerInput(i) {
                        detectDragGestures(
                            onDragEnd = {
                                val v = drag.value
                                if (abs(v) > size.width * 0.28f) {
                                    scope.launch { drag.animateTo(if (v > 0) size.width * 1.5f else -size.width * 1.5f, tween(180)); decide(v > 0) }
                                } else scope.launch { drag.animateTo(0f, tween(200)) }
                            },
                        ) { change, amount -> change.consume(); scope.launch { drag.snapTo(drag.value + amount.x) } }
                    }
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(if (card.need) "ضروري" else if (card.gift) "مفاجأة سعيدة" else "رغبة", color = color, fontWeight = FontWeight.Bold)
                Text(card.emoji, fontSize = 72.sp)
                Text(card.title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
                Text(card.desc, color = c.muted, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
                Text(if (card.gift) "+${-card.cost}" else "التكلفة ${card.cost}", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = color)
                val hint = drag.value
                if (abs(hint) > 30) {
                    Text(if (hint > 0) "✅ ادفع" else "❌ ارفض", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = if (hint > 0) c.good else c.danger)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (card.gift) NeonButton("رائع! 🎉", Modifier.weight(1f)) { decide(true) }
            else {
                Box(
                    Modifier.weight(1f).height(56.dp).clip(RoundedCornerShape(18.dp)).background(c.danger.copy(alpha = 0.18f))
                        .border(2.dp, c.danger, RoundedCornerShape(18.dp))
                        .clickable { decide(false) },
                    contentAlignment = Alignment.Center,
                ) { Text("❌ ارفض", color = c.danger, fontWeight = FontWeight.Bold) }
                NeonButton("✅ ادفع", Modifier.weight(1f)) { decide(true) }
            }
        }
    }
}
