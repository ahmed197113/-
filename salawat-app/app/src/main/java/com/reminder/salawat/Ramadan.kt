package com.reminder.salawat

import android.content.Intent
import android.graphics.Typeface
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Ramadan: the month's timetable (imsak, fajr, maghrib for every day, from the same prayer-time settings as the rest
 * of the app), the suhoor reminder, and two sahih hadith on suhoor and breaking the fast.
 */
class RamadanActivity : ColumnActivity() {
    override val titleRes = R.string.ramadan_screen

    override fun build() {
        val today = Calendar.getInstance()
        val h = HijriDate.of(this, today)
        val year = if (h.month > 9) h.year + 1 else h.year
        val first = HijriDate.firstDayOf(this, year, 9)
        val length = HijriDate.monthLength(this, year, 9)

        val head = padded(Ui.card(column))
        val status = if (h.month == 9 && h.year == year) {
            getString(R.string.ramadan_day, QuranData.toArabicDigits(h.day))
        } else {
            val days = ((first.timeInMillis - today.timeInMillis) / 86_400_000L + 1).coerceAtLeast(1).toInt()
            getString(R.string.ramadan_countdown, QuranData.toArabicDigits(days))
        }
        text(head, getString(R.string.ramadan_year, QuranData.toArabicDigits(year)), R.style.Text_TitleLarge, R.color.accent_text, Gravity.CENTER)
        text(head, status, R.style.Text_BodyLarge, R.color.text_primary_light, Gravity.CENTER)

        listOf("suhoor", "iftar_hasten").forEach { key ->
            HadithQuotes.cite(key)?.let { text(padded(Ui.card(column)), it, R.style.Text_BodyMedium, R.color.text_primary_light) }
        }

        val remCard = Ui.card(column)
        val on = Reminders.isOn(this, ReminderType.SUHOOR)
        Ui.row(remCard, R.drawable.ic_bell, getString(R.string.rem_suhoor),
            if (on) getString(R.string.rem_minutes_before, arabicMinutes(Reminders.minutes(this, ReminderType.SUHOOR)))
            else getString(R.string.settings_off)) {
            startActivity(Intent(this, RemindersActivity::class.java))
        }

        Ui.sectionTitle(column, getString(R.string.ramadan_table))
        val table = padded(Ui.card(column))
        row(table, listOf(getString(R.string.ramadan_col_day), getString(R.string.ramadan_col_imsak),
            getString(R.string.prayer_fajr), getString(R.string.prayer_maghrib)), header = true)
        val loading = text(table, getString(R.string.quran_loading), R.style.Text_BodySmall, R.color.text_secondary_light, Gravity.CENTER)
        text(padded(Ui.card(column)), getString(R.string.ramadan_note), R.style.Text_BodySmall, R.color.text_secondary_light)

        lifecycleScope.launch {
            val days = (0 until length).map { i -> (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, i) } }
            try {
                days.map { it.get(Calendar.YEAR) to it.get(Calendar.MONTH) + 1 }.distinct().forEach { (y, m) ->
                    PrayerRepository.ensureMonth(this@RamadanActivity, y, m)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                loading.setText(R.string.ramadan_offline)
                return@launch
            }
            if (!PrayerRepository.isConfigured(this@RamadanActivity)) {
                loading.setText(R.string.ramadan_no_location)
                return@launch
            }
            table.removeView(loading)
            days.forEachIndexed { i, day ->
                val t = PrayerRepository.dayTimings(this@RamadanActivity, day)
                val label = "${QuranData.toArabicDigits(i + 1)} · ${HijriDate.weekday(day)} ${QuranData.toArabicDigits(day.get(Calendar.DAY_OF_MONTH))}/${QuranData.toArabicDigits(day.get(Calendar.MONTH) + 1)}"
                val isToday = day.get(Calendar.YEAR) == today.get(Calendar.YEAR) && day.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR)
                row(table, listOf(label,
                    Ui.time(this@RamadanActivity, t?.extras?.get("Imsak")),
                    Ui.time(this@RamadanActivity, t?.times?.get(Prayer.FAJR)),
                    Ui.time(this@RamadanActivity, t?.times?.get(Prayer.MAGHRIB))), highlight = isToday)
            }
        }
    }

    private fun row(parent: ViewGroup, cells: List<String>, header: Boolean = false, highlight: Boolean = false) {
        val line = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(7), 0, dp(7))
            if (highlight) setBackgroundColor(Themes.color(this@RamadanActivity, R.color.ayah_highlight))
        }
        cells.forEachIndexed { i, value ->
            val tv = TextView(this, null, 0, if (header) R.style.Text_LabelMedium else R.style.Text_BodySmall)
            tv.text = value
            tv.gravity = if (i == 0) Gravity.START or Gravity.CENTER_VERTICAL else Gravity.CENTER
            tv.setTextColor(Themes.color(this, if (header) R.color.accent_text else R.color.text_primary_light))
            if (highlight) tv.setTypeface(tv.typeface, Typeface.BOLD)
            line.addView(tv, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, if (i == 0) 1.6f else 1f))
        }
        parent.addView(line, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
}
