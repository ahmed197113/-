package com.mizan.budget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.mizan.budget.MainActivity
import com.mizan.budget.QuickAddActivity
import com.mizan.budget.R
import com.mizan.budget.data.Expense
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.repo
import android.content.Intent

private val White = ColorProvider(Color(0xFFF1F5FF))
private val Muted = ColorProvider(Color(0xFF9AA6C4))
private val Mint = ColorProvider(Color(0xFF2EE6A6))
private val Amber = ColorProvider(Color(0xFFFFB547))
private val Danger = ColorProvider(Color(0xFFFF5C7A))
private val Track = ColorProvider(Color(0x33FFFFFF))

private fun headline(s: Snapshot): Pair<String, ColorProvider> = when {
    !s.hasBudget -> Money.format(s.spentToday, s.currency) to White
    s.safeToday >= 0 -> Money.format(s.safeToday, s.currency) to Mint
    else -> "-" + Money.format(-s.safeToday, s.currency) to Danger
}

private fun headlineLabel(s: Snapshot) = when {
    !s.hasBudget -> "صرفت اليوم"
    s.safeToday >= 0 -> "مسموح لك اليوم"
    else -> "تجاوزت حد اليوم"
}

@Composable
private fun AddButton(label: String, need: Boolean, bg: Int, modifier: GlanceModifier = GlanceModifier) {
    val context = LocalContext.current
    Box(
        modifier = modifier
            .height(38.dp)
            .background(ImageProvider(bg))
            .cornerRadius(19.dp)
            .clickable(actionStartActivity(QuickAddActivity.intent(context, need, Expense.Source.WIDGET))),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = TextStyle(color = White, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
}

/** The main home-screen widget: today's allowance, cycle progress and two quick-add buttons. */
class BudgetWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(
        setOf(DpSize(160.dp, 110.dp), DpSize(250.dp, 110.dp), DpSize(250.dp, 200.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val initial = context.repo.snapshotOnce()
        provideContent {
            val snap by context.repo.snapshot.collectAsState(initial = initial)
            Content(snap)
        }
    }

    @Composable
    private fun Content(s: Snapshot) {
        val context = LocalContext.current
        val size = LocalSize.current
        val tall = size.height >= 180.dp
        val (amount, color) = headline(s)
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ImageProvider(R.drawable.widget_bg))
                .cornerRadius(24.dp)
                .padding(14.dp)
                .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
        ) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("⚖️ ميزاني", style = TextStyle(color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
                Spacer(GlanceModifier.defaultWeight())
                if (s.streak >= 2) Text("🔥 ${s.streak}", style = TextStyle(color = Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold))
            }
            Spacer(GlanceModifier.height(6.dp))
            Text(headlineLabel(s), style = TextStyle(color = Muted, fontSize = 12.sp))
            Text(amount, style = TextStyle(color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            if (s.hasBudget) {
                Spacer(GlanceModifier.height(6.dp))
                LinearProgressIndicator(
                    progress = s.usedFraction.coerceIn(0f, 1f),
                    modifier = GlanceModifier.fillMaxWidth().height(6.dp),
                    color = if (s.overPace) Amber else Mint,
                    backgroundColor = Track,
                )
                Spacer(GlanceModifier.height(4.dp))
                Text(
                    "المتبقي ${Money.compact(s.remaining, s.currency)} • ${s.daysLeft} يوم",
                    style = TextStyle(color = Muted, fontSize = 11.sp), maxLines = 1,
                )
            }
            if (tall) {
                Spacer(GlanceModifier.height(8.dp))
                Row(modifier = GlanceModifier.fillMaxWidth()) {
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text("ضروري", style = TextStyle(color = Muted, fontSize = 11.sp))
                        Text(Money.compact(s.needs, s.currency), style = TextStyle(color = White, fontSize = 13.sp, fontWeight = FontWeight.Bold))
                    }
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text("كمالي", style = TextStyle(color = Muted, fontSize = 11.sp))
                        Text(Money.compact(s.wants, s.currency), style = TextStyle(color = Amber, fontSize = 13.sp, fontWeight = FontWeight.Bold))
                    }
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text("الانضباط", style = TextStyle(color = Muted, fontSize = 11.sp))
                        Text("${s.score}/100", style = TextStyle(color = Mint, fontSize = 13.sp, fontWeight = FontWeight.Bold))
                    }
                }
            }
            Spacer(GlanceModifier.defaultWeight())
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                AddButton("+ ضروري", true, R.drawable.widget_btn_need, GlanceModifier.defaultWeight())
                Spacer(GlanceModifier.width(8.dp))
                AddButton("+ كمالي", false, R.drawable.widget_btn_want, GlanceModifier.defaultWeight())
            }
        }
    }
}

/** A tiny 2×1 widget: just today's number and a "+" button. */
class CompactWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val initial = context.repo.snapshotOnce()
        provideContent {
            val snap by context.repo.snapshot.collectAsState(initial = initial)
            Content(snap)
        }
    }

    @Composable
    private fun Content(s: Snapshot) {
        val context = LocalContext.current
        val (amount, color) = headline(s)
        Row(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ImageProvider(R.drawable.widget_bg))
                .cornerRadius(24.dp)
                .padding(horizontal = 14.dp, vertical = 8.dp)
                .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(headlineLabel(s), style = TextStyle(color = Muted, fontSize = 11.sp), maxLines = 1)
                Text(amount, style = TextStyle(color = color, fontSize = 18.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            }
            Box(
                modifier = GlanceModifier
                    .width(44.dp).height(44.dp)
                    .background(ImageProvider(R.drawable.widget_btn_need))
                    .cornerRadius(22.dp)
                    .clickable(actionStartActivity(QuickAddActivity.intent(context, null, Expense.Source.WIDGET))),
                contentAlignment = Alignment.Center,
            ) {
                Text("+", style = TextStyle(color = White, fontSize = 22.sp, fontWeight = FontWeight.Bold))
            }
        }
    }
}

class BudgetWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BudgetWidget()
}

class CompactWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CompactWidget()
}
