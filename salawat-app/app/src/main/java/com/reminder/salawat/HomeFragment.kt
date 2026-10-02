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
        binding.tileAzkar.setOnClickListener { host.select(MainActivity.TAB_AZKAR) }
        binding.tileTasbih.setOnClickListener { startActivity(Intent(host, TasbihActivity::class.java)) }
        binding.tileQibla.setOnClickListener { startActivity(Intent(host, QiblaActivity::class.java)) }
        binding.tileAdhan.setOnClickListener { startActivity(Intent(host, AdhanSettingsActivity::class.java)) }
        binding.tileSettings.setOnClickListener { startActivity(Intent(host, SettingsActivity::class.java)) }

        binding.cardReminder.setOnClickListener { binding.switchReminder.toggle() }
        reminderListener = CompoundButton.OnCheckedChangeListener { _, checked -> setReminder(host, checked) }
        binding.switchReminder.setOnCheckedChangeListener(reminderListener)

        val dayOfYear = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        binding.textDhikrOfDay.text = DAILY_DHIKR[dayOfYear % DAILY_DHIKR.size]

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
        b.textHijri.text = HijriDate.today()
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
            b.textContinue.text = getString(
                R.string.continue_reading_value, QuranData.surahName(context, surah), QuranData.toArabicDigits(lastPage)
            )
            b.cardContinue.visibility = View.VISIBLE
        } else {
            b.cardContinue.visibility = View.GONE
        }
    }

    private fun renderNext() {
        val b = _binding ?: return
        val context = b.root.context
        val configured = PrayerRepository.isConfigured(context)
        b.layoutSetup.visibility = if (configured) View.GONE else View.VISIBLE
        b.layoutNext.visibility = if (configured) View.VISIBLE else View.GONE
        b.rowPrayerChips.visibility = if (configured) View.VISIBLE else View.GONE
        if (!configured) return

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
        private val DAILY_DHIKR = listOf(
            "«إنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا»",
            "قال ﷺ: «مَن صلّى عليّ صلاةً واحدة صلّى الله عليه بها عشراً»",
            "سبحان الله وبحمده، سبحان الله العظيم",
            "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
            "اللهم صلِّ على محمد وعلى آل محمد كما صليت على إبراهيم وعلى آل إبراهيم إنك حميد مجيد",
            "أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه",
            "لا حول ولا قوة إلا بالله",
            "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم",
            "رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً"
        )
    }
}
