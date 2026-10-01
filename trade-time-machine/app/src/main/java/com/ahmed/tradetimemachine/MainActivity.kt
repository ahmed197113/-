package com.ahmed.tradetimemachine

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.ahmed.tradetimemachine.core.Game
import com.ahmed.tradetimemachine.core.Offer
import com.ahmed.tradetimemachine.core.TradeResult
import com.ahmed.tradetimemachine.core.TravelResult

class MainActivity : Activity() {
    private lateinit var game: Game
    private lateinit var root: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        setContentView(ScrollView(this).apply { addView(root) })
        newGame()
    }

    private fun newGame() {
        game = Game()
        render()
        info(
            "مرحبًا بك في آلة الزمن",
            "معك ${game.coins} قطعة زمنية و${game.config.days} رحلة.\n" +
                "اشترِ ما هو متوفر ورخيص في عصر، وبِعه حيث يكون نادرًا.\n" +
                "اضغط على اسم أي سلعة لتقرأ معلومة تاريخية عنها."
        )
    }

    private fun render() {
        root.removeAllViews()
        val era = game.currentEra
        root.addView(text("⏳ ${era.name_ar}", 24f, bold = true))
        root.addView(text("${era.year} · النقد: ${era.currency}", 13f, color = GREY))
        root.addView(
            text(
                "💰 ${game.coins} قطعة   📦 ${game.cargoUsed}/${game.config.cargoCapacity}   " +
                    "🗓️ ${game.daysLeft} رحلات   الثروة: ${game.netWorth()}",
                15f, bold = true
            ).apply { setPadding(0, dp(12), 0, dp(12)) }
        )

        root.addView(text("السوق", 18f, bold = true))
        for (offer in game.offers()) root.addView(offerRow(offer))

        root.addView(text("السفر عبر الزمن (${game.config.travelCost} قطعة)", 18f, bold = true)
            .apply { setPadding(0, dp(16), 0, dp(4)) })
        for (e in game.catalog.eras.filter { it.id != era.id }) {
            root.addView(button("${e.name_ar} — ${e.year}") { travel(e.id) })
        }
        root.addView(button("إنهاء الرحلة وحساب النتيجة") { finishGame() })
    }

    private fun offerRow(offer: Offer): View {
        val g = offer.good
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(8), 0, dp(8))
        }
        val stars = "★".repeat(g.scarcity) + "☆".repeat(5 - g.scarcity)
        val title = if (offer.isExotic) "${g.name_ar} (سلعة غريبة على هذا العصر)" else "${g.name_ar} $stars"
        row.addView(text(title, 16f, bold = true).apply {
            setOnClickListener { info(g.name_ar, g.fact_ar) }
        })
        val buy = offer.buyPrice?.let { "شراء $it" } ?: "لا تُباع هنا"
        row.addView(text("$buy · بيع ${offer.sellPrice} · لكل ${g.unit} · عندك ${offer.owned}", 14f, color = GREY))
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        if (offer.buyPrice != null) buttons.addView(button("اشترِ") { trade(game.buy(g.id)) })
        if (offer.owned > 0) {
            buttons.addView(button("بِع") { trade(game.sell(g.id)) })
            buttons.addView(button("بِع الكل") { trade(game.sell(g.id, offer.owned)) })
        }
        row.addView(buttons)
        return row
    }

    private fun trade(result: TradeResult) {
        when (result) {
            is TradeResult.Ok -> result.lesson?.let { info("درس في الاقتصاد", it) }
            TradeResult.NotEnoughCoins -> toast("لا تملك ما يكفي من القطع")
            TradeResult.CargoFull -> toast("مخزن آلة الزمن ممتلئ")
            TradeResult.NothingToSell -> toast("لا تملك هذه السلعة")
            TradeResult.NotSoldHere -> toast("هذه السلعة لا تُباع في هذا العصر")
            TradeResult.GameOver -> toast("انتهت اللعبة")
        }
        render()
    }

    private fun travel(eraId: String) {
        when (val r = game.travel(eraId)) {
            is TravelResult.Arrived -> {
                render()
                r.event?.let { info("خبر من ${r.era.name_ar}", it.text_ar) }
            }
            TravelResult.NotEnoughCoins -> toast("لا تكفي قطعك لتشغيل آلة الزمن")
            TravelResult.NoDaysLeft -> toast("نفدت الرحلات، بِع بضاعتك ثم أنهِ اللعبة")
            TravelResult.SameEra -> Unit
            TravelResult.GameOver -> toast("انتهت اللعبة")
        }
    }

    private fun finishGame() {
        val start = game.config.startingCoins
        val score = game.finish()
        val verdict = when {
            score >= start * 5 -> "تاجر أسطوري عبر العصور!"
            score > start -> "تاجر ناجح."
            else -> "الزمن كان قاسيًا هذه المرة."
        }
        AlertDialog.Builder(this)
            .setTitle("انتهت الرحلة")
            .setMessage("بدأت بـ$start وانتهيت بـ$score قطعة.\n$verdict")
            .setCancelable(false)
            .setPositiveButton("لعبة جديدة") { _, _ -> newGame() }
            .show()
    }

    private fun info(title: String, message: String) {
        AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("حسنًا", null).show()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun text(s: String, size: Float, bold: Boolean = false, color: Int = Color.BLACK) =
        TextView(this).apply {
            text = s
            textSize = size
            setTextColor(color)
            gravity = Gravity.START
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }

    private fun button(label: String, onClick: () -> Unit) =
        Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { onClick() }
        }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        private const val GREY = 0xFF666666.toInt()
    }
}
