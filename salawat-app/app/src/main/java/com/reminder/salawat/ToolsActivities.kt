package com.reminder.salawat

import android.app.TimePickerDialog
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.GridLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.reminder.salawat.databinding.ActivitySettingsBinding
import com.reminder.salawat.databinding.ViewNumberFieldBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** Base for screens built from cards in a scrolling column (shares the Settings layout). */
abstract class ColumnActivity : AppCompatActivity() {
    protected lateinit var binding: ActivitySettingsBinding
    protected val column get() = binding.settingsContainer
    abstract val titleRes: Int

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.toolbar.setTitle(titleRes)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }
    }

    override fun onResume() {
        super.onResume()
        column.removeAllViews()
        build()
    }

    abstract fun build()

    protected fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    protected fun text(parent: ViewGroup, value: CharSequence, style: Int, color: Int, gravity: Int = Gravity.START): TextView {
        val tv = TextView(this, null, 0, style)
        tv.text = value
        tv.setTextColor(Themes.color(this, color))
        tv.gravity = gravity
        parent.addView(tv, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        return tv
    }

    protected fun padded(card: LinearLayout) = card.apply { setPadding(dp(16), dp(14), dp(16), dp(14)) }

    protected fun refresh() {
        column.removeAllViews()
        build()
    }
}

// ---------------------------------------------------------------- Hijri calendar

class CalendarActivity : ColumnActivity() {
    override val titleRes = R.string.tool_calendar
    private var year = 0
    private var month = 0
    private var selected: Calendar? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val today = HijriDate.of(this, Calendar.getInstance())
        year = today.year
        month = today.month
    }

    override fun build() {
        // Month switcher
        val nav = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(12), 0, dp(4)) }
        column.addView(nav)
        nav.addView(navButton(R.drawable.ic_chevron_prev) { shift(-1) })
        val title = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
        nav.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        text(title, "${HijriDate.MONTHS[month - 1]} ${QuranData.toArabicDigits(year)} هـ", R.style.Text_TitleLarge, R.color.accent_text, Gravity.CENTER)
        val first = HijriDate.firstDayOf(this, year, month)
        val length = HijriDate.monthLength(this, year, month)
        val last = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, length - 1) }
        val fmt = SimpleDateFormat("d MMMM yyyy", Locale("ar"))
        text(title, "${fmt.format(first.time)} — ${fmt.format(last.time)}", R.style.Text_BodySmall, R.color.text_secondary_light, Gravity.CENTER)
        nav.addView(navButton(R.drawable.ic_chevron_next) { shift(1) })

        // Grid
        val card = Ui.card(column)
        val grid = GridLayout(this).apply { columnCount = 7; setPadding(dp(6), dp(8), dp(6), dp(8)) }
        card.addView(grid)
        listOf("أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت").forEach { d ->
            grid.addView(cell(d, null, header = true))
        }
        val lead = first.get(Calendar.DAY_OF_WEEK) - 1
        repeat(lead) { grid.addView(cell("", null)) }
        val todayKey = PrayerTracker.dayKey(Calendar.getInstance())
        for (i in 0 until length) {
            val g = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, i) }
            val h = HijriDay(year, month, i + 1)
            val events = HijriDate.events(h, g).filter { it.title != "يوم الجمعة" && !it.title.startsWith("صيام الإثنين") && !it.title.startsWith("صيام الخميس") }
            val v = cell(QuranData.toArabicDigits(i + 1), g.get(Calendar.DAY_OF_MONTH).toString())
            val isToday = PrayerTracker.dayKey(g) == todayKey
            val isSelected = selected?.let { PrayerTracker.dayKey(it) == PrayerTracker.dayKey(g) } == true
            v.setBackgroundResource(
                when {
                    isToday -> R.drawable.bg_chip_prayer_active
                    isSelected || events.isNotEmpty() -> R.drawable.bg_row_active
                    else -> 0
                }
            )
            v.setOnClickListener { selected = g; refresh() }
            grid.addView(v)
        }

        // Selected day
        selected?.let { g ->
            val h = HijriDate.of(this, g)
            val events = HijriDate.events(h, g)
            Ui.sectionTitle(column, "${HijriDate.weekday(g)} ${HijriDate.format(h)}")
            val list = padded(Ui.card(column))
            if (events.isEmpty()) text(list, getString(R.string.calendar_no_events), R.style.Text_BodyMedium, R.color.text_secondary_light)
            events.forEach { e -> eventLine(list, e) }
        }

        // Month events
        Ui.sectionTitle(column, getString(R.string.calendar_events))
        val list = padded(Ui.card(column))
        // Group repeated occasions (e.g. the three White Days) into one line.
        val grouped = LinkedHashMap<String, Pair<IslamicEvent, MutableList<Int>>>()
        for (i in 0 until length) {
            HijriDate.events(HijriDay(year, month, i + 1), null).forEach { e ->
                grouped.getOrPut(e.title) { e to mutableListOf() }.second.add(i)
            }
        }
        val any = grouped.isNotEmpty()
        grouped.values.forEach { (e, days) ->
            val hijriDays = days.joinToString("، ") { QuranData.toArabicDigits(it + 1) }
            val g = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, days.first()) }
            eventLine(list, e, "$hijriDays ${HijriDate.MONTHS[month - 1]} — ${fmt.format(g.time)}")
        }
        if (!any) text(list, getString(R.string.calendar_no_events), R.style.Text_BodyMedium, R.color.text_secondary_light)
        text(column, getString(R.string.calendar_hint), R.style.Hint, R.color.text_secondary_light, Gravity.CENTER).setPadding(dp(8), dp(16), dp(8), 0)
    }

    private fun eventLine(parent: LinearLayout, e: IslamicEvent, date: String? = null) {
        val t = text(parent, (if (e.fasting) "🌙 " else "✦ ") + e.title, R.style.Text_TitleSmall, if (e.fasting) R.color.accent_text else R.color.text_primary_light)
        t.setPadding(0, dp(8), 0, 0)
        text(parent, listOfNotNull(date, e.note).joinToString(" • "), R.style.Text_BodySmall, R.color.text_secondary_light)
    }

    private fun shift(delta: Int) {
        month += delta
        if (month < 1) { month = 12; year-- }
        if (month > 12) { month = 1; year++ }
        selected = null
        refresh()
    }

    private fun navButton(icon: Int, onClick: () -> Unit) = ImageButton(this).apply {
        setImageResource(icon)
        setBackgroundResource(R.drawable.bg_icon_circle)
        setColorFilter(Themes.color(context, R.color.accent_text))
        layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
        setOnClickListener { onClick() }
    }

    private fun cell(main: String, sub: String?, header: Boolean = false): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            minimumHeight = dp(if (header) 28 else 52)
        }
        val lp = GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED), GridLayout.spec(GridLayout.UNDEFINED, 1f))
        lp.width = 0
        lp.setMargins(dp(2), dp(2), dp(2), dp(2))
        box.layoutParams = lp
        val t = TextView(this, null, 0, if (header) R.style.Text_LabelSmall else R.style.Text_TitleSmall)
        t.text = main
        t.gravity = Gravity.CENTER
        t.setTextColor(Themes.color(this, if (header) R.color.text_secondary_light else R.color.text_primary_light))
        box.addView(t)
        if (sub != null) {
            val s = TextView(this, null, 0, R.style.Text_LabelSmall)
            s.text = sub
            s.gravity = Gravity.CENTER
            s.setTextColor(Themes.color(this, R.color.text_secondary_light))
            box.addView(s)
        }
        return box
    }
}

// ---------------------------------------------------------------- Zakat calculator

class ZakatActivity : ColumnActivity() {
    override val titleRes = R.string.tool_zakat
    private val fields = LinkedHashMap<Int, ViewNumberFieldBinding>()
    private val values = HashMap<Int, String>()
    private var result: TextView? = null

    override fun build() {
        text(column, getString(R.string.zakat_intro), R.style.Hint, R.color.text_secondary_light, Gravity.CENTER).setPadding(dp(8), dp(16), dp(8), dp(8))
        val card = padded(Ui.card(column))
        fields.clear()
        listOf(
            R.string.zakat_gold_price, R.string.zakat_cash, R.string.zakat_gold_24, R.string.zakat_gold_21,
            R.string.zakat_gold_18, R.string.zakat_silver, R.string.zakat_silver_price, R.string.zakat_trade,
            R.string.zakat_receivables, R.string.zakat_debts
        ).forEach { res ->
            val f = ViewNumberFieldBinding.inflate(LayoutInflater.from(this), card, true)
            f.root.hint = getString(res)
            f.editNumber.setText(values[res] ?: Prefs.get(this).getString("zakat_$res", ""))
            fields[res] = f
        }
        val calc = MaterialButton(this).apply {
            setText(R.string.zakat_calculate)
            setOnClickListener { calculate() }
        }
        card.addView(calc, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply { topMargin = dp(12) })

        val resCard = padded(Ui.card(column))
        (resCard.parent as View).let { (it.layoutParams as LinearLayout.LayoutParams).topMargin = dp(12) }
        result = text(resCard, getString(R.string.zakat_need_price), R.style.Text_BodyLarge, R.color.text_primary_light)
        result?.setLineSpacing(0f, 1.4f)

        Ui.sectionTitle(column, getString(R.string.zakat_fitr_title))
        text(padded(Ui.card(column)), getString(R.string.zakat_fitr_text), R.style.Text_BodyMedium, R.color.text_primary_light)
        text(column, getString(R.string.zakat_note), R.style.Hint, R.color.text_secondary_light, Gravity.CENTER).setPadding(dp(8), dp(16), dp(8), 0)
        calculate()
    }

    private fun v(res: Int): Double = fields[res]?.editNumber?.text?.toString()?.replace(',', '.')?.toDoubleOrNull() ?: 0.0

    private fun calculate() {
        val prefs = Prefs.get(this).edit()
        fields.forEach { (res, f) ->
            val s = f.editNumber.text?.toString().orEmpty()
            values[res] = s
            prefs.putString("zakat_$res", s)
        }
        prefs.apply()
        val goldPrice = v(R.string.zakat_gold_price)
        if (goldPrice <= 0) {
            result?.setText(R.string.zakat_need_price)
            return
        }
        val pureGold = v(R.string.zakat_gold_24) + v(R.string.zakat_gold_21) * 21 / 24 + v(R.string.zakat_gold_18) * 18 / 24
        val total = v(R.string.zakat_cash) + pureGold * goldPrice + v(R.string.zakat_silver) * v(R.string.zakat_silver_price) +
            v(R.string.zakat_trade) + v(R.string.zakat_receivables) - v(R.string.zakat_debts)
        val nisab = 85 * goldPrice
        val nf = NumberFormat.getNumberInstance(Locale("ar")).apply { maximumFractionDigits = 2 }
        val lines = mutableListOf(getString(R.string.zakat_total, nf.format(total.coerceAtLeast(0.0))), getString(R.string.zakat_nisab, nf.format(nisab)))
        lines.add(if (total >= nisab) getString(R.string.zakat_due, nf.format(total * 0.025)) else getString(R.string.zakat_not_due))
        result?.text = lines.joinToString("\n")
    }
}

// ---------------------------------------------------------------- Prayer tracker

class TrackerActivity : ColumnActivity() {
    override val titleRes = R.string.tool_tracker

    override fun build() {
        val today = Calendar.getInstance()
        Ui.sectionTitle(column, getString(R.string.tracker_today))
        val todayCard = padded(Ui.card(column))
        val row = LinearLayout(this)
        todayCard.addView(row)
        PrayerTracker.SALAH.forEach { p ->
            val done = PrayerTracker.isDone(this, today, p)
            val chip = MaterialButton(this, null, if (done) com.google.android.material.R.attr.materialButtonStyle else com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = getString(p.nameRes)
                textSize = 13f
                minWidth = 0
                setPadding(0, 0, 0, 0)
                if (done) setIconResource(R.drawable.ic_check)
                iconPadding = 0
                setOnClickListener { PrayerTracker.toggle(this@TrackerActivity, today, p); refresh() }
            }
            row.addView(chip, LinearLayout.LayoutParams(0, dp(52), 1f).apply { marginStart = dp(2); marginEnd = dp(2) })
        }
        text(todayCard, getString(R.string.tracker_hint), R.style.Hint, R.color.text_secondary_light, Gravity.CENTER).setPadding(0, dp(10), 0, 0)

        // Last 7 days grid
        Ui.sectionTitle(column, getString(R.string.tracker_week))
        val weekCard = padded(Ui.card(column))
        for (back in 6 downTo 0) {
            val day = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, -back) }
            val line = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(4), 0, dp(4)) }
            weekCard.addView(line)
            val label = TextView(this, null, 0, R.style.Text_BodyMedium)
            label.text = if (back == 0) getString(R.string.calendar_today) else HijriDate.weekday(day)
            label.setTextColor(Themes.color(this, R.color.text_primary_light))
            line.addView(label, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            PrayerTracker.SALAH.forEach { p ->
                val dot = TextView(this, null, 0, R.style.Text_LabelLarge)
                val done = PrayerTracker.isDone(this, day, p)
                dot.text = if (done) "●" else "○"
                dot.gravity = Gravity.CENTER
                dot.setTextColor(Themes.color(this, if (done) R.color.teal_primary else R.color.outline))
                dot.setOnClickListener { PrayerTracker.toggle(this, day, p); refresh() }
                line.addView(dot, LinearLayout.LayoutParams(dp(36), dp(36)))
            }
        }

        // Stats
        Ui.sectionTitle(column, getString(R.string.tracker_stats))
        val stats = Ui.card(column)
        val (d7, t7) = PrayerTracker.stats(this, 7)
        val (d30, t30) = PrayerTracker.stats(this, 30)
        Ui.row(stats, R.drawable.ic_star, getString(R.string.tracker_streak),
            getString(R.string.tracker_streak_value, QuranData.toArabicDigits(PrayerTracker.streak(this)))) {}
        Ui.row(stats, R.drawable.ic_clock, getString(R.string.tracker_7days), "${QuranData.toArabicDigits(d7)} / ${QuranData.toArabicDigits(t7)}") {}
        Ui.row(stats, R.drawable.ic_clock, getString(R.string.tracker_30days), "${QuranData.toArabicDigits(d30)} / ${QuranData.toArabicDigits(t30)}") {}

        // Qada
        Ui.sectionTitle(column, getString(R.string.tracker_qada))
        val qada = padded(Ui.card(column))
        text(qada, getString(R.string.tracker_qada_hint), R.style.Hint, R.color.text_secondary_light)
        PrayerTracker.SALAH.forEach { p ->
            val line = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(6), 0, 0) }
            qada.addView(line)
            val name = TextView(this, null, 0, R.style.Text_TitleSmall)
            name.text = getString(p.nameRes)
            name.setTextColor(Themes.color(this, R.color.text_primary_light))
            line.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            line.addView(stepper(p, -1, "−"))
            val count = TextView(this, null, 0, R.style.Text_TitleMedium)
            count.text = QuranData.toArabicDigits(PrayerTracker.qada(this, p))
            count.gravity = Gravity.CENTER
            count.setTextColor(Themes.color(this, R.color.accent_text))
            line.addView(count, LinearLayout.LayoutParams(dp(56), ViewGroup.LayoutParams.WRAP_CONTENT))
            line.addView(stepper(p, 1, "+"))
        }
    }

    private fun stepper(p: Prayer, delta: Int, label: String) =
        MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = label
            textSize = 18f
            minWidth = 0
            minimumWidth = 0
            setPadding(0, 0, 0, 0)
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
            setOnClickListener {
                PrayerTracker.setQada(this@TrackerActivity, p, PrayerTracker.qada(this@TrackerActivity, p) + delta)
                refresh()
            }
        }
}


// ---------------------------------------------------------------- Reminders

class RemindersActivity : ColumnActivity(), PermissionHost {
    override val titleRes = R.string.tool_reminders
    override val permissions = PermissionRequester(this)

    override fun build() {
        Ui.sectionTitle(column, getString(R.string.tool_reminders_desc))
        val card = Ui.card(column)
        ReminderType.values().forEach { type ->
            val on = Reminders.isOn(this, type)
            val m = Reminders.minutes(this, type)
            val value = getString(type.descRes) + "\n" + when {
                !on -> getString(R.string.settings_off)
                type.isTimeOfDay -> getString(R.string.rem_at, Ui.time(this, Prefs.formatMinutes(m)))
                type == ReminderType.IQAMA -> getString(R.string.rem_minutes_after, m)
                else -> getString(R.string.rem_minutes_before, m)
            }
            val icon = when (type) {
                ReminderType.MORNING -> R.drawable.ic_sun
                ReminderType.EVENING, ReminderType.SLEEP -> R.drawable.ic_moon
                ReminderType.KAHF, ReminderType.WIRD -> R.drawable.ic_quran
                ReminderType.FASTING -> R.drawable.ic_star
                ReminderType.PRE_ADHAN, ReminderType.IQAMA -> R.drawable.ic_bell
            }
            Ui.row(card, icon, getString(type.titleRes), value, switchChecked = on) {
                if (on) {
                    AlertDialog.Builder(this)
                        .setTitle(type.titleRes)
                        .setItems(arrayOf(getString(if (type.isTimeOfDay) R.string.rem_change_time else R.string.rem_change_minutes), getString(R.string.rem_turn_off))) { _, which ->
                            if (which == 0) pickTime(type) else { Reminders.setOn(this, type, false); refresh() }
                        }.show()
                } else {
                    permissions.requestNotifications { granted ->
                        if (granted) {
                            Reminders.setOn(this, type, true)
                            pickTime(type)
                        }
                        refresh()
                    }
                }
            }
        }
    }

    private fun pickTime(type: ReminderType) {
        val m = Reminders.minutes(this, type)
        if (!type.isTimeOfDay) {
            val options = if (type == ReminderType.IQAMA) intArrayOf(5, 10, 15, 20, 25, 30) else intArrayOf(5, 10, 15, 20, 30)
            val label = if (type == ReminderType.IQAMA) R.string.rem_minutes_after else R.string.rem_minutes_before
            AlertDialog.Builder(this)
                .setTitle(type.titleRes)
                .setSingleChoiceItems(options.map { getString(label, it) }.toTypedArray(), options.indexOf(m)) { d, w ->
                    Reminders.setMinutes(this, type, options[w]); d.dismiss(); refresh()
                }.show()
            return
        }
        TimePickerDialog(this, { _, h, min -> Reminders.setMinutes(this, type, h * 60 + min); refresh() }, m / 60, m % 60, false)
            .apply { setTitle(type.titleRes) }.show()
    }
}
