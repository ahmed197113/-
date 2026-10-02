package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.CompoundButton
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.reminder.salawat.databinding.FragmentHomeBinding
import com.reminder.salawat.databinding.ItemPrayerChipBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class HomeFragment : Fragment(R.layout.fragment_home) {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val chips = LinkedHashMap<Prayer, ItemPrayerChipBinding>()
    private var reminderListener: CompoundButton.OnCheckedChangeListener? = null
    private val myPrayerChips = LinkedHashMap<Prayer, com.google.android.material.button.MaterialButton>()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        _binding = FragmentHomeBinding.bind(view)
        val host = requireActivity() as MainActivity

        for (prayer in Prayer.values().filter { it.isSalah }) {
            val chip = ItemPrayerChipBinding.inflate(LayoutInflater.from(view.context), binding.rowPrayerChips, true)
            chip.textChipName.setText(prayer.nameRes)
            chips[prayer] = chip
        }

        val openLocation = View.OnClickListener {
            LocationSheet.show(host, host.permissions) { renderStatic() }
        }
        binding.textPlace.setOnClickListener(openLocation)
        binding.btnSetupLocation.setOnClickListener(openLocation)
        binding.btnHomeSettings.setOnClickListener { startActivity(Intent(host, SettingsActivity::class.java)) }
        binding.layoutNext.setOnClickListener { host.select(MainActivity.TAB_PRAYER) }
        binding.rowPrayerChips.setOnClickListener { host.select(MainActivity.TAB_PRAYER) }
        binding.cardContinue.setOnClickListener { startActivity(Intent(host, QuranPagerActivity::class.java)) }

        binding.tileQuran.setOnClickListener { startActivity(Intent(host, QuranPagerActivity::class.java)) }
        binding.tileHadith.setOnClickListener { startActivity(Intent(host, HadithBooksActivity::class.java)) }
        binding.tileAzkar.setOnClickListener { host.select(MainActivity.TAB_AZKAR) }
        binding.tileTasbih.setOnClickListener { startActivity(Intent(host, TasbihActivity::class.java)) }
        binding.tileQibla.setOnClickListener { startActivity(Intent(host, QiblaActivity::class.java)) }
        binding.tileCalendar.setOnClickListener { startActivity(Intent(host, CalendarActivity::class.java)) }
        binding.tileTracker.setOnClickListener { startActivity(Intent(host, TrackerActivity::class.java)) }
        binding.tileNames.setOnClickListener { startActivity(Intent(host, NamesActivity::class.java)) }
        binding.tileAll.setOnClickListener { host.select(MainActivity.TAB_MORE) }
        binding.cardMyPrayers.setOnClickListener { startActivity(Intent(host, TrackerActivity::class.java)) }
        binding.cardOccasion.setOnClickListener { startActivity(Intent(host, CalendarActivity::class.java)) }
        for (prayer in PrayerTracker.SALAH) {
            val chip = com.google.android.material.button.MaterialButton(
                view.context, null, com.google.android.material.R.attr.materialButtonOutlinedStyle
            ).apply {
                text = getString(prayer.nameRes)
                textSize = 12f
                minWidth = 0
                minimumWidth = 0
                setPadding(0, 0, 0, 0)
                insetTop = 0
                insetBottom = 0
                setOnClickListener {
                    PrayerTracker.toggle(context, Calendar.getInstance(), prayer)
                    renderMyPrayers()
                }
            }
            val lp = android.widget.LinearLayout.LayoutParams(0, (44 * resources.displayMetrics.density).toInt(), 1f)
            lp.marginStart = 3; lp.marginEnd = 3
            binding.rowMyPrayers.addView(chip, lp)
            myPrayerChips[prayer] = chip
        }

        binding.cardReminder.setOnClickListener { binding.switchReminder.toggle() }
        reminderListener = CompoundButton.OnCheckedChangeListener { _, checked -> setReminder(host, checked) }
        binding.switchReminder.setOnCheckedChangeListener(reminderListener)

        val dayOfYear = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        binding.textDhikrOfDay.text = HadithQuotes.cite(DAILY_DHIKR[dayOfYear % DAILY_DHIKR.size]).orEmpty()
        renderDaily()

        // Live countdown to the next prayer while the screen is visible.
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                renderStatic()
                while (true) {
                    renderNext()
                    delay(1000)
                }
            }
        }
    }

    override fun onHiddenChanged(hidden: Boolean) {
        super.onHiddenChanged(hidden)
        if (!hidden && _binding != null) renderStatic()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        chips.clear()
        myPrayerChips.clear()
        _binding = null
    }

    private fun setReminder(activity: MainActivity, enabled: Boolean) {
        if (!enabled) {
            Prefs.get(activity).edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, false).apply()
            ReminderWorker.apply(activity)
            renderStatic()
            return
        }
        activity.permissions.requestNotifications { granted ->
            Prefs.get(activity).edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, granted).apply()
            ReminderWorker.apply(activity)
            renderStatic()
        }
    }

    private fun renderStatic() {
        val b = _binding ?: return
        val context = b.root.context
        b.textHijri.text = HijriDate.today(context)
        renderMyPrayers()
        renderOccasion()
        b.textGregorian.text = SimpleDateFormat("EEEE، d MMMM yyyy", Locale("ar")).format(Date())
        b.textPlace.text = PrayerRepository.placeLabel(context) ?: getString(R.string.home_place_unknown)

        val reminderOn = Prefs.get(context).getBoolean(Prefs.KEY_REMINDER_ENABLED, false) && Notifications.canPost(context)
        // Update the switch without re-triggering its listener.
        b.switchReminder.setOnCheckedChangeListener(null)
        b.switchReminder.isChecked = reminderOn
        b.switchReminder.setOnCheckedChangeListener(reminderListener)
        b.textReminderStatus.text = if (reminderOn) getString(R.string.reminder_every, Ui.intervalLabel(context))
        else getString(R.string.reminder_off)

        val lastPage = Prefs.get(context).getInt(Prefs.KEY_LAST_PAGE, 0)
        if (lastPage > 0) {
            val surah = QuranData.page(context, lastPage).firstOrNull()?.surah ?: 1
            b.textContinue.text = QuranData.styledName(context, getString(
                R.string.continue_reading_value, QuranData.surahName(context, surah), QuranData.toArabicDigits(lastPage)
            ), surah)
            b.cardContinue.visibility = View.VISIBLE
        } else {
            b.cardContinue.visibility = View.GONE
        }
    }

    private fun renderMyPrayers() {
        val b = _binding ?: return
        val context = b.root.context
        val today = Calendar.getInstance()
        myPrayerChips.forEach { (prayer, chip) ->
            val done = PrayerTracker.isDone(context, today, prayer)
            chip.setBackgroundColor(ContextCompat.getColor(context, if (done) R.color.teal_primary else android.R.color.transparent))
            chip.setTextColor(ContextCompat.getColor(context, if (done) R.color.on_brand else R.color.accent_text))
            chip.icon = if (done) ContextCompat.getDrawable(context, R.drawable.ic_check) else null
            chip.iconTint = android.content.res.ColorStateList.valueOf(ContextCompat.getColor(context, R.color.on_brand))
            chip.iconPadding = 0
        }
        b.textMyPrayers.text = getString(
            R.string.home_my_prayers_value,
            QuranData.toArabicDigits(PrayerTracker.countForDay(context, today)),
            QuranData.toArabicDigits(PrayerTracker.streak(context))
        )
    }

    private fun renderOccasion() {
        val b = _binding ?: return
        val context = b.root.context
        val today = Calendar.getInstance()
        val todayEvents = HijriDate.events(HijriDate.of(context, today), today)
        val tomorrow = Reminders.fastingTomorrow(context, today)
        val (label, text) = when {
            todayEvents.isNotEmpty() -> getString(R.string.today_occasion) to todayEvents.joinToString("\n") { "${it.title} — ${it.note}" }
            tomorrow != null -> getString(R.string.tomorrow_occasion) to tomorrow
            else -> null to null
        }
        b.cardOccasion.visibility = if (text == null) View.GONE else View.VISIBLE
        b.textOccasionLabel.text = label
        b.textOccasion.text = text
    }

    private fun renderRamadan(now: Long) {
        val b = _binding ?: return
        val context = b.root.context
        val today = Calendar.getInstance()
        val hijri = HijriDate.of(context, today)
        val day = if (hijri.month == 9) PrayerRepository.today(context) else null
        if (day == null) {
            b.cardRamadan.visibility = View.GONE
            return
        }
        b.cardRamadan.visibility = View.VISIBLE
        b.textRamadanTitle.text = getString(R.string.ramadan_title, QuranData.toArabicDigits(hijri.day))
        val imsak = day.extras["Imsak"]
        val iftar = day.times[Prayer.MAGHRIB]
        b.textRamadanTimes.text = "${getString(R.string.ramadan_imsak)}: ${Ui.time(context, imsak)}   •   ${getString(R.string.ramadan_iftar)}: ${Ui.time(context, iftar)}"
        val imsakAt = day.millisOfTime(imsak)
        val iftarAt = day.millisOfTime(iftar)
        b.textRamadanCountdown.text = when {
            imsakAt != null && now < imsakAt -> getString(R.string.ramadan_to_imsak, Ui.countdown(imsakAt - now))
            iftarAt != null && now < iftarAt -> getString(R.string.ramadan_to_iftar, Ui.countdown(iftarAt - now))
            else -> ""
        }
    }

    private fun renderDaily() {
        val b = _binding ?: return
        val context = b.root.context
        val ayahs = QuranData.ensureLoaded(context)
        val day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR) + Calendar.getInstance().get(Calendar.YEAR) * 366
        // Prefer short, self-contained ayahs for the card.
        val candidates = ayahs.filter { it.text.length in 60..220 }
        val ayah = candidates[(day * 7919) % candidates.size]
        b.textAyahOfDay.text = "${ayah.text} ﴿${QuranData.toArabicDigits(ayah.ayah)}﴾"
        b.textAyahOfDayRef.text = QuranData.styledName(
            context, "${QuranData.surahName(context, ayah.surah)} • ${getString(R.string.quran_page_number, QuranData.toArabicDigits(ayah.page))}", ayah.surah
        )
        b.cardAyah.setOnClickListener {
            startActivity(Intent(context, QuranPagerActivity::class.java)
                .putExtra(QuranPagerActivity.EXTRA_PAGE, ayah.page)
                .putExtra(QuranPagerActivity.EXTRA_HIGHLIGHT_GLOBAL, ayah.global))
        }
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { Hadiths.ofTheDay(context) }.getOrNull()?.let { (book, h) ->
                val bb = _binding ?: return@let
                bb.textHadithOfDay.text = h.text
                bb.textHadithOfDayRef.text = "$book • ${getString(R.string.hadith_number, QuranData.toArabicDigits(h.number))}"
            }
        }
        b.cardHadith.setOnClickListener { startActivity(Intent(context, HadithBooksActivity::class.java)) }
    }

    private fun renderNext() {
        val b = _binding ?: return
        val context = b.root.context
        val configured = PrayerRepository.isConfigured(context)
        b.layoutSetup.visibility = if (configured) View.GONE else View.VISIBLE
        b.layoutNext.visibility = if (configured) View.VISIBLE else View.GONE
        b.rowPrayerChips.visibility = if (configured) View.VISIBLE else View.GONE
        if (!configured) return

        renderRamadan(System.currentTimeMillis())
        val next = PrayerRepository.nextPrayer(context)
        if (next == null) {
            b.textNextLabel.text = getString(R.string.prayer_fetch_error_cached)
            b.textCountdown.text = "--:--:--"
            b.textNextTime.text = ""
        } else {
            b.textNextLabel.text = getString(R.string.home_next_prayer, getString(next.prayer.nameRes))
            b.textCountdown.text = Ui.countdown(next.millis - System.currentTimeMillis())
            b.textNextTime.text = getString(R.string.home_next_time, Ui.time(context, next.time))
        }
        val today = PrayerRepository.today(context)
        chips.forEach { (prayer, chip) ->
            chip.textChipTime.text = Ui.time(context, today?.times?.get(prayer)).replace(" ", " ")
            val active = next != null && next.prayer == prayer && today?.times?.get(prayer) == next.time
            chip.root.setBackgroundResource(if (active) R.drawable.bg_chip_prayer_active else R.drawable.bg_chip_prayer)
            val nameColor = if (active) R.color.teal_dark else R.color.on_brand_secondary
            val timeColor = if (active) R.color.teal_dark else R.color.on_brand
            chip.textChipName.setTextColor(ContextCompat.getColor(context, nameColor))
            chip.textChipTime.setTextColor(ContextCompat.getColor(context, timeColor))
        }
    }

    companion object {
        /** Keys into HadithQuotes: each is quoted verbatim from Bukhari, Muslim or a hadith al-Albani graded sahih. */
        private val DAILY_DHIKR = listOf("salah_ten", "tasbih", "tahlil", "ibrahimiyya", "istighfar", "hawqala", "radeet")
    }
}
