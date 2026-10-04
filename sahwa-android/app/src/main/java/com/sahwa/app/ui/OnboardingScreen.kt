package com.sahwa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.Store

private data class Plan(
    val emoji: String,
    val name: String,
    val desc: String,
    val budget: Int,
    val gate: Int,
    val strictDays: Int,
    val color: Color,
)

private val PLANS = listOf(
    Plan("🌤️", "خفيف", "100 تمريرة يوميًا تقل تدريجيًا • بوابة 5 ثوانٍ", 100, 5, 0, C.Green),
    Plan("⚖️", "متوازن", "60 تمريرة يوميًا تقل حتى 15 • بوابة 8 ثوانٍ", 60, 8, 0, C.Cyan),
    Plan("🔥", "جذري", "30 تمريرة فقط • بوابة 15 ثانية • وضع صارم 7 أيام لا يمكن تخفيفه", 30, 15, 7, C.Red),
)

@Composable
fun OnboardingScreen(now: Long) {
    val ctx = LocalContext.current
    var step by remember { mutableIntStateOf(0) }
    var plan by remember { mutableIntStateOf(2) }
    var msg by remember { mutableStateOf("أنا أقوى من خوارزمية صُمّمت لتسرق وقتي.") }
    val guardOn = remember(now / 2000) { isGuardEnabled(ctx) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(C.Bg, Color(0xFF0E0A24), C.Bg))),
    ) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // progress dots
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)) {
                repeat(4) { i ->
                    Box(
                        Modifier.size(width = if (i == step) 28.dp else 8.dp, height = 8.dp)
                            .clip(CircleShape)
                            .background(if (i <= step) C.Cyan else C.Panel2),
                    )
                }
            }
            when (step) {
                0 -> {
                    BrainOrb(70f, Modifier.size(260.dp))
                    Text("صحوة", color = C.Text, fontSize = 40.sp, fontWeight = FontWeight.Black)
                    Text(
                        "المقاطع القصيرة مصممة لتسرق انتباهك.\nصحوة يعيده إليك — بدون حرمان، وبدون تعقيد.",
                        color = C.Muted, fontSize = 16.sp, textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 16.dp),
                    )
                    Bullet("🌬️", "قبل كل دخول للمقاطع: لحظة تنفّس ونيّة واضحة")
                    Bullet("⚡", "رصيد يومي للتمرير يقل تدريجيًا خلال 30 يومًا")
                    Bullet("💪", "أنشطة حقيقية بدل التمرير تكسبك رصيدًا")
                    Bullet("🧠", "دماغ حيّ يتوهج أو يتعفّن حسب اختياراتك")
                    Spacer(Modifier.height(24.dp))
                    PrimaryButton("ابدأ رحلة الصحوة") { step = 1 }
                }
                1 -> {
                    StepTitle("اختر قوة العلاج", "يمكنك تشديده لاحقًا في أي وقت")
                    PLANS.forEachIndexed { i, p ->
                        val selected = plan == i
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                                .clip(RoundedCornerShape(22.dp))
                                .background(if (selected) p.color.copy(alpha = 0.14f) else C.Panel)
                                .border(if (selected) 2.dp else 1.dp, if (selected) p.color else C.Panel2, RoundedCornerShape(22.dp))
                                .clickable { plan = i }
                                .padding(18.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(p.emoji, fontSize = 28.sp)
                                Text(
                                    "  ${p.name}", color = if (selected) p.color else C.Text,
                                    fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f),
                                )
                                if (i == 2) Text("موصى به", color = C.Red, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(p.desc, color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                    PrimaryButton("التالي") { step = 2 }
                }
                2 -> {
                    StepTitle("رسالة من نفسك المستقبلية", "ستراها كل مرة تحاول فيها فتح المقاطع القصيرة")
                    OutlinedTextField(
                        value = msg,
                        onValueChange = { msg = it.take(140) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                    )
                    Text("أمثلة: «تذكّر هدفك في الامتحان» • «أولادك يحتاجون انتباهك» • «لن أضيّع عمري في التمرير»",
                        color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    Spacer(Modifier.height(24.dp))
                    PrimaryButton("التالي") { step = 3 }
                }
                else -> {
                    StepTitle("فعّل الدرع", "الخطوة الأهم — بدونها لا يستطيع صحوة حمايتك")
                    GlowCard(accent = if (guardOn) C.Green else C.Amber) {
                        Text(
                            "يستخدم صحوة خدمة «إمكانية الوصول» فقط ليعرف متى تكون داخل Shorts أو Reels أو TikTok.\n\n" +
                                "• لا يقرأ رسائلك ولا ما تكتبه.\n• لا إنترنت — كل شيء على هاتفك.\n\n" +
                                "اضغط الزر ← اختر «درع صحوة» ← فعّله ← ارجع هنا.",
                            color = C.Muted, fontSize = 14.sp,
                        )
                        Text(
                            "إذا ظهر «إعداد مقيّد»: معلومات تطبيق صحوة ← ⋮ ← السماح بالإعدادات المقيدة.",
                            color = C.Amber, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                    Spacer(Modifier.height(16.dp))
                    if (guardOn) {
                        Text("✅ الدرع يعمل!", color = C.Green, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    } else {
                        PrimaryButton("🛡️ تفعيل الدرع", C.Amber) { openAccessibilitySettings(ctx) }
                    }
                    Spacer(Modifier.height(12.dp))
                    PrimaryButton(if (guardOn) "انطلق 🚀" else "إنهاء (سأفعّله لاحقًا)", if (guardOn) C.Cyan else C.Panel2) {
                        val p = PLANS[plan]
                        Store.finishOnboarding(p.budget, p.gate, msg, p.strictDays)
                    }
                }
            }
            if (step > 0) {
                TextButton(onClick = { step-- }, modifier = Modifier.padding(top = 8.dp)) { Text("رجوع", color = C.Muted) }
            }
        }
    }
}

@Composable
private fun StepTitle(title: String, sub: String) {
    Text(title, color = C.Text, fontSize = 26.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
    Text(sub, color = C.Muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp, bottom = 20.dp))
}

@Composable
private fun Bullet(icon: String, text: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(C.Panel2), contentAlignment = Alignment.Center) {
            Text(icon, fontSize = 18.sp)
        }
        Text(text, color = C.Text, fontSize = 15.sp, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
private fun PrimaryButton(label: String, color: Color = C.Cyan, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = if (color == C.Panel2) C.Text else Color.Black,
        ),
    ) { Text(label, fontWeight = FontWeight.Bold, fontSize = 17.sp) }
}
