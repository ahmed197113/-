package com.wafr.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.domain.Game
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.LinearMeter
import com.wafr.app.ui.components.NeonButton
import com.wafr.app.ui.components.SectionTitle
import com.wafr.app.ui.theme.Mz

/** "سباق الحرية": learn the asset/liability mindset one month at a time. */
@Composable
fun FreedomGame(state: Game.State, best: Int, contentPadding: PaddingValues, onBack: () -> Unit, onUpdate: (Game.State) -> Unit, onReset: () -> Unit) {
    val c = Mz.colors
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            GameHeader("سباق الحرية 🎲", onBack)
            Text("لعبة بسيطة مستوحاة من أفكار كتاب «الأب الغني والأب الفقير»: اشترِ أصولاً، تجنّب الالتزامات، واخرج من سباق الفئران.", color = c.muted, style = MaterialTheme.typography.bodySmall)
            if (best > 0) Text("🏆 أفضل رقم لك: الحرية في $best شهراً", color = c.want, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
        if (!state.started) {
            item {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("كيف تلعب؟", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text("1️⃣ كل دور = شهر: تستلم راتبك وتدفع مصاريفك.\n2️⃣ تظهر لك بطاقة: فرصة استثمار، أو إغراء استهلاكي، أو مفاجأة.\n3️⃣ الأصول تضيف «دخلاً سلبياً»، والالتزامات تضيف «مصاريف».\n4️⃣ تفوز عندما يغطي دخلك السلبي كل مصاريفك 🎉", style = MaterialTheme.typography.bodyMedium)
                }
            }
            item { SectionTitle("اختر شخصيتك") }
            Game.jobs.forEachIndexed { i, j ->
                item {
                    GlassCard(Modifier.fillMaxWidth(), onClick = { onUpdate(Game.nextMonth(Game.start(i))) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(j.emoji, fontSize = 34.sp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(j.title, style = MaterialTheme.typography.titleMedium)
                                Text("راتب ${j.salary} • مصاريف ${j.expenses} • رصيد ${j.cash}", color = c.muted, fontSize = 12.sp)
                            }
                            Text("ابدأ ←", color = c.good, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            item { LessonsCard() }
            return@LazyColumn
        }

        item { StatsBoard(state) }
        item {
            if (state.message.isNotBlank()) {
                Text(
                    state.message, fontWeight = FontWeight.SemiBold, color = c.text,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.glow2.copy(alpha = 0.12f)).padding(12.dp),
                )
            }
        }
        item {
            AnimatedContent(state.card to state.month, transitionSpec = { (scaleIn(initialScale = 0.9f) + fadeIn()) togetherWith fadeOut() }, label = "card") { (cardIdx, _) ->
                val card = Game.cards.getOrNull(cardIdx)
                when {
                    state.won -> WinCard(state, onReset)
                    card != null -> CardView(card, state, onUpdate)
                    else -> NeonButton("الشهر التالي ⏭", Modifier.fillMaxWidth()) { onUpdate(Game.nextMonth(state)) }
                }
            }
        }
        if (state.assets.isNotEmpty() || state.liabilities.isNotEmpty()) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    GlassCard(Modifier.weight(1f), padding = 12.dp) {
                        Text("🧱 أصولي", fontWeight = FontWeight.Bold, color = c.good)
                        if (state.assets.isEmpty()) Text("لا شيء بعد", fontSize = 12.sp, color = c.muted)
                        state.assets.forEach { Text("${it.emoji} ${it.name} +${it.amount}", fontSize = 12.sp) }
                    }
                    GlassCard(Modifier.weight(1f), padding = 12.dp) {
                        Text("💳 التزاماتي", fontWeight = FontWeight.Bold, color = c.danger)
                        if (state.liabilities.isEmpty()) Text("لا شيء 👏", fontSize = 12.sp, color = c.muted)
                        state.liabilities.forEach { Text("${it.emoji} ${it.name} -${it.amount}", fontSize = 12.sp) }
                    }
                }
            }
        }
        item { TextButton(onClick = onReset) { Text("بدء لعبة جديدة ↺", color = c.muted) } }
        item { LessonsCard() }
    }
}

@Composable
private fun StatsBoard(s: Game.State) {
    val c = Mz.colors
    GlassCard(Modifier.fillMaxWidth()) {
        Row {
            Text("الشهر ${s.month}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text("💵 ${s.cash}", style = MaterialTheme.typography.titleMedium, color = c.good)
        }
        Spacer(Modifier.height(10.dp))
        Row {
            Mini("الراتب", "${s.salary}", c.text, Modifier.weight(1f))
            Mini("دخل سلبي", "${s.passive}", c.good, Modifier.weight(1f))
            Mini("مصاريف", "${s.expenses}", c.danger, Modifier.weight(1f))
            Mini("صافي الشهر", "${s.cashflow}", if (s.cashflow >= 0) c.need else c.danger, Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        Text("مقياس الحرية: الدخل السلبي ÷ المصاريف = ${(s.freedom * 100).toInt()}%", fontSize = 12.sp, color = c.muted)
        Spacer(Modifier.height(6.dp))
        LinearMeter(s.freedom, c.good, height = 10.dp)
    }
}

@Composable
private fun Mini(label: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, color = color)
        Text(label, fontSize = 11.sp, color = Mz.colors.muted)
    }
}

@Composable
private fun CardView(card: Game.Card, s: Game.State, onUpdate: (Game.State) -> Unit) {
    val c = Mz.colors
    val (tag, color) = when (card.kind) {
        Game.Kind.DEAL -> "فرصة استثمار" to c.good
        Game.Kind.DOODAD -> "إغراء استهلاكي" to c.want
        Game.Kind.EVENT -> "مفاجأة" to c.need
        Game.Kind.LEARN -> "استثمر في نفسك" to Color(0xFFFF7AD9)
        Game.Kind.SELL -> "سوق" to Color(0xFF8A5CFF)
    }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp))
            .background(Brush.linearGradient(listOf(color.copy(alpha = 0.22f), c.card)))
            .border(1.5.dp, color.copy(alpha = 0.7f), RoundedCornerShape(28.dp))
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(tag, color = color, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Text(card.emoji, fontSize = 56.sp)
        Text(card.title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(card.body, color = c.muted, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        val details = when (card.kind) {
            Game.Kind.DEAL -> "السعر ${card.cost} • دخل شهري +${card.income}"
            Game.Kind.DOODAD -> "مصروف شهري جديد -${card.expense}"
            Game.Kind.EVENT -> buildString {
                if (card.cash != 0) append(if (card.cash > 0) "+${card.cash} نقداً" else "${card.cash} نقداً")
                if (card.salary > 0) append("راتب +${card.salary} • مصاريف +${card.expense}")
            }
            Game.Kind.LEARN -> "التكلفة ${card.cost} • راتب +${card.salary} دائماً"
            Game.Kind.SELL -> "يعرض ضعف ثمن أغلى أصل لديك"
        }
        Text(details, fontWeight = FontWeight.Bold, color = color)
        Spacer(Modifier.height(10.dp))
        Text("💡 ${card.lesson}", fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(c.muted.copy(alpha = 0.08f)).padding(10.dp))
        Spacer(Modifier.height(14.dp))
        if (card.kind == Game.Kind.EVENT) {
            NeonButton("حسناً", Modifier.fillMaxWidth()) { onUpdate(Game.choose(s, true)) }
        } else {
            val (yes, no) = when (card.kind) {
                Game.Kind.DEAL -> "اشترِ الأصل" to "تجاوز"
                Game.Kind.DOODAD -> "خذها" to "لا، شكراً 💪"
                Game.Kind.LEARN -> "سجّل في الدورة" to "لاحقاً"
                else -> "بِع" to "احتفظ"
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { onUpdate(Game.choose(s, false)) }, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(16.dp)) {
                    Text(no, color = c.text)
                }
                NeonButton(yes, Modifier.weight(1f)) { onUpdate(Game.choose(s, true)) }
            }
        }
    }
}

@Composable
private fun WinCard(s: Game.State, onReset: () -> Unit) {
    val c = Mz.colors
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.hero).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("🎉", fontSize = 64.sp)
        Text("حرية مالية!", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Text("خرجت من سباق الفئران في ${s.month} شهراً. دخلك السلبي ${s.passive} يغطي مصاريفك ${s.expenses}.", color = Color.White.copy(alpha = 0.85f), textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        Text("الآن طبّق نفس الفكرة في حياتك: كل ريال تدّخره في «وَفْر» يمكن أن يصبح أصلاً.", color = c.good, textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(16.dp))
        NeonButton("العب مجدداً", Modifier.fillMaxWidth(), onClick = onReset)
    }
}

@Composable
private fun LessonsCard() {
    val c = Mz.colors
    GlassCard(Modifier.fillMaxWidth()) {
        Text("📚 دروس الثراء", style = MaterialTheme.typography.titleMedium)
        Text("أفكار مستوحاة من كتب الثراء الشهيرة، بصياغة مبسّطة", fontSize = 12.sp, color = c.muted)
        Spacer(Modifier.height(8.dp))
        Game.lessons.forEach { (e, t) ->
            Row(Modifier.padding(vertical = 5.dp)) {
                Text(e, fontSize = 18.sp)
                Spacer(Modifier.width(8.dp))
                Text(t, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

