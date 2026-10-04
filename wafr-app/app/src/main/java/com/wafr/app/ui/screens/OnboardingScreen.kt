package com.wafr.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wafr.app.data.Settings
import com.wafr.app.domain.Money
import com.wafr.app.ui.components.AmountField
import com.wafr.app.ui.components.AuroraBackground
import com.wafr.app.ui.components.WafrLogo
import com.wafr.app.ui.components.GlassCard
import com.wafr.app.ui.components.NeonButton
import com.wafr.app.ui.components.parseAmount
import com.wafr.app.ui.theme.Mz

@Composable
fun OnboardingScreen(onFinish: (transform: (Settings) -> Settings) -> Unit, onAskNotifications: () -> Unit) {
    val c = Mz.colors
    var step by rememberSaveable { mutableIntStateOf(0) }
    var name by rememberSaveable { mutableStateOf("") }
    var currency by rememberSaveable { mutableStateOf("ر.س") }
    var income by rememberSaveable { mutableStateOf("") }
    var budget by rememberSaveable { mutableStateOf("") }
    var day by rememberSaveable { mutableStateOf(1f) }

    AuroraBackground(Modifier.systemBarsPadding()) {
        Column(Modifier.fillMaxSize().padding(24.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(4) { i ->
                    Box(
                        Modifier.height(5.dp).width(if (i == step) 28.dp else 12.dp).clip(CircleShape)
                            .background(if (i <= step) MaterialTheme.colorScheme.primary else c.muted.copy(alpha = 0.3f)),
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
            AnimatedContent(
                targetState = step, modifier = Modifier.weight(1f),
                transitionSpec = { (slideInHorizontally { -it / 3 } + fadeIn()) togetherWith fadeOut() }, label = "onboarding",
            ) { s ->
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    when (s) {
                        0 -> {
                            Spacer(Modifier.height(30.dp))
                            WafrLogo()
                            Spacer(Modifier.height(24.dp))
                            Wordmark(52)
                            Text("ميزانيتك من المستقبل… لثروتك اليوم.", style = MaterialTheme.typography.titleLarge, color = c.text)
                            Spacer(Modifier.height(28.dp))
                            Feature("⚡", "سجّل في 3 ثوانٍ", "من الإشعار، أو ستارة الإشعارات، أو الويدجت، دون فتح التطبيق.")
                            Feature("💭", "يسألك كل 5 ساعات", "«هل صرفت شيئاً؟» وتجيب بكتابة المبلغ مباشرة في الإشعار.")
                            Feature("🛍️", "ضروري أم كمالي؟", "كل مصروف يُصنّف… فتعرف بالضبط كم كان يمكنك أن توفّر.")
                            Feature("🎯", "المسموح لك اليوم", "رقم واحد واضح يوميّاً، وتنبيه فوري عند تجاوز ميزانية أي بند.")
                            Feature("🧭", "مخطط الراتب", "قل لي راتبك وأوزّعه لك حسب قواعد كتب الثراء.")
                            Feature("🎲", "العب وتعلّم", "لعبة «سباق الحرية» المستوحاة من «الأب الغني والأب الفقير».")
                            Feature("🔒", "خصوصية تامة", "بياناتك على جهازك فقط. بلا إعلانات ولا اشتراكات.")
                        }
                        1 -> {
                            Title("لنتعرّف 👋", "سنخصّص وَفْر لك في أقل من دقيقة.")
                            OutlinedTextField(name, { name = it }, label = { Text("اسمك (اختياري)") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth())
                            Spacer(Modifier.height(18.dp))
                            Text("عملتك", fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                items(currencies) { cur -> FilterChip(cur == currency, { currency = cur }, { Text(cur) }) }
                            }
                            Spacer(Modifier.height(18.dp))
                            AmountField(income, { income = it }, "دخلك الشهري (اختياري)", currency)
                            Text("يساعدنا على اقتراح ميزانية وحساب نسبة ادّخارك.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                        }
                        2 -> {
                            Title("ميزانيتك الشهرية 🎯", "كم تريد أن تصرف كحد أقصى في الشهر؟ (بدون الادخار)")
                            val inc = parseAmount(income) ?: 0L
                            AmountField(budget, { budget = it }, "الميزانية", currency)
                            if (inc > 0) {
                                Spacer(Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf(60, 70, 80).forEach { pct ->
                                        val v = inc * pct / 100
                                        FilterChip(parseAmount(budget) == v, { budget = Money.plain(v).replace(",", "") }, { Text("$pct% • ${Money.compact(v, "")}") })
                                    }
                                }
                            }
                            Spacer(Modifier.height(22.dp))
                            Text("يبدأ شهرك يوم: ${day.toInt()}", fontWeight = FontWeight.SemiBold)
                            Text("اختر يوم نزول الراتب، فتتطابق الميزانية مع واقعك.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                            Slider(day, { day = it }, valueRange = 1f..28f, steps = 26)
                            val b = parseAmount(budget) ?: 0L
                            if (b > 0) {
                                GlassCard(Modifier.fillMaxWidth()) {
                                    Text("هذا يعني تقريباً", color = c.muted, style = MaterialTheme.typography.bodySmall)
                                    Text("${Money.format(b / 30, currency)} يومياً", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                        else -> {
                            Title("صديقك الذي يذكّرك 💭", "كل 5 ساعات سيسألك وَفْر إن صرفت شيئاً، وتجيب من الإشعار نفسه:")
                            GlassCard(Modifier.fillMaxWidth()) {
                                Text("هل صرفت شيئاً؟ 💭", fontWeight = FontWeight.Bold)
                                Text("باقي لك اليوم 120 $currency", color = c.muted, style = MaterialTheme.typography.bodySmall)
                                Spacer(Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                    Text("ضروري ✍️", color = c.need, fontWeight = FontWeight.Bold)
                                    Text("كمالي ✍️", color = c.want, fontWeight = FontWeight.Bold)
                                    Text("لم أصرف ✓", color = c.good, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            Text("اكتب «25 قهوة» وسيفهم وَفْر المبلغ ويختار الفئة تلقائياً. لا إزعاج في أوقات النوم.", color = c.muted)
                            Spacer(Modifier.height(16.dp))
                            NeonButton("🔔 السماح بالإشعارات", Modifier.fillMaxWidth(), onClick = onAskNotifications)
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (step > 0) TextButton(onClick = { step-- }) { Text("رجوع") }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        if (step < 3) step++ else onFinish { s ->
                            s.copy(
                                onboarded = true, userName = name.trim(), currency = currency,
                                monthlyIncome = parseAmount(income) ?: 0L, monthlyBudget = parseAmount(budget) ?: 0L,
                                cycleStartDay = day.toInt(),
                            )
                        }
                    },
                    shape = RoundedCornerShape(16.dp), modifier = Modifier.height(52.dp),
                ) { Text(if (step < 3) "التالي" else "انطلق 🚀", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp)) }
            }
        }
    }
}

@Composable
private fun Title(title: String, subtitle: String) {
    Text(title, style = MaterialTheme.typography.headlineMedium)
    Spacer(Modifier.height(6.dp))
    Text(subtitle, color = Mz.colors.muted)
    Spacer(Modifier.height(22.dp))
}

@Composable
private fun Feature(emoji: String, title: String, body: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.Top) {
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
            Text(emoji, fontSize = 22.sp)
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(title, fontWeight = FontWeight.Bold)
            Text(body, style = MaterialTheme.typography.bodySmall, color = Mz.colors.muted, textAlign = TextAlign.Start)
        }
    }
}
