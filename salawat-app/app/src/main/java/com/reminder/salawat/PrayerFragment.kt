package com.reminder.salawat

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewModelScope
import com.reminder.salawat.databinding.FragmentPrayerBinding
import com.reminder.salawat.databinding.ItemPrayerRowBinding
import com.reminder.salawat.databinding.ItemSettingRowBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class PrayerViewModel(app: Application) : AndroidViewModel(app) {
    val loading = MutableLiveData(false)
    val error = MutableLiveData<Int?>(null)
    /** Bumped after every successful refresh so screens re-read the cache. */
    val version = MutableLiveData(0)

    fun refresh() {
        val context = getApplication<Application>()
        if (loading.value == true || !PrayerRepository.isConfigured(context)) {
            loading.value = false
            return
        }
        loading.value = true
        error.value = null
        viewModelScope.launch {
            try {
                PrayerRepository.refresh(context)
                PrayerScheduler.refreshDependents(context)
                version.value = (version.value ?: 0) + 1
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = if (PrayerRepository.hasToday(context)) R.string.prayer_fetch_error_cached
                else R.string.prayer_fetch_error
            } finally {
                loading.value = false
            }
        }
    }
}

class PrayerFragment : Fragment(R.layout.fragment_prayer) {

    private var _binding: FragmentPrayerBinding? = null
    private val binding get() = _binding!!
    private val viewModel: PrayerViewModel by activityViewModels()
    private val rows = LinkedHashMap<Prayer, ItemPrayerRowBinding>()
    private var dayOffset = 0
    private var rowPlace: ItemSettingRowBinding? = null
    private var rowMethod: ItemSettingRowBinding? = null
    private var rowAdhan: ItemSettingRowBinding? = null
    private var rowAlerts: ItemSettingRowBinding? = null

    private val host get() = requireActivity() as MainActivity

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        _binding = FragmentPrayerBinding.bind(view)
        val inflater = LayoutInflater.from(view.context)
        for (prayer in Prayer.values()) {
            val row = ItemPrayerRowBinding.inflate(inflater, binding.listPrayers, true)
            row.textPrayerName.setText(prayer.nameRes)
            row.iconPrayer.setImageResource(if (prayer in DAY_PRAYERS) R.drawable.ic_sun else R.drawable.ic_moon)
            if (prayer.isSalah) {
                row.btnPrayerBell.setOnClickListener { toggleBell(prayer) }
                row.btnPrayerDone.setOnClickListener {
                    val day = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, dayOffset) }
                    PrayerTracker.toggle(requireContext(), day, prayer)
                    render()
                }
            } else {
                row.btnPrayerBell.visibility = View.INVISIBLE
                row.btnPrayerDone.visibility = View.INVISIBLE
            }
            rows[prayer] = row
        }
        buildSettings()

        binding.btnPrevDay.setOnClickListener { dayOffset--; render() }
        binding.btnNextDay.setOnClickListener { dayOffset++; render() }
        binding.layoutDate.setOnClickListener { dayOffset = 0; render() }
        binding.btnPrayerSetup.setOnClickListener { openLocation() }
        binding.swipeRefresh.setColorSchemeColors(Themes.color(requireContext(), R.color.teal_primary))
        binding.swipeRefresh.setOnRefreshListener { viewModel.refresh() }

        viewModel.loading.observe(viewLifecycleOwner) { binding.swipeRefresh.isRefreshing = it }
        viewModel.error.observe(viewLifecycleOwner) { res ->
            binding.textPrayerError.visibility = if (res == null) View.GONE else View.VISIBLE
            if (res != null) binding.textPrayerError.setText(res)
        }
        viewModel.version.observe(viewLifecycleOwner) { render() }

        if (savedInstanceState == null && PrayerRepository.isConfigured(view.context) && !PrayerRepository.hasToday(view.context)) {
            viewModel.refresh()
        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    render()
                    delay(30_000)
                }
            }
        }
    }

    override fun onHiddenChanged(hidden: Boolean) {
        super.onHiddenChanged(hidden)
        if (!hidden && _binding != null) render()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rows.clear()
        _binding = null
    }

    private fun openLocation() {
        LocationSheet.show(host, host.permissions) {
            viewModel.version.value = (viewModel.version.value ?: 0) + 1
        }
    }

    private fun toggleBell(prayer: Prayer) {
        val context = requireContext()
        val alertsOn = PrayerRepository.alertsOn(context)
        val enable = !(alertsOn && PrayerRepository.isAlertEnabled(context, prayer))
        if (!enable) {
            PrayerRepository.setAlertEnabled(context, prayer, false)
            PrayerScheduler.schedule(context)
            render()
            return
        }
        host.permissions.requestNotifications { granted ->
            if (granted) {
                PrayerRepository.setAlertEnabled(context, prayer, true)
                PrayerRepository.prefs(context).edit().putBoolean(PrayerRepository.KEY_ALERTS, true).apply()
                PrayerScheduler.schedule(context)
            }
            render()
        }
    }

    private fun buildSettings() {
        val list = binding.listPrayerSettings
        val context = requireContext()
        rowPlace = Ui.row(list, R.drawable.ic_location, getString(R.string.location_change)) { openLocation() }
        rowMethod = Ui.row(list, R.drawable.ic_clock, getString(R.string.method_title)) { chooseMethod() }
        rowAdhan = Ui.row(list, R.drawable.ic_volume, getString(R.string.tile_adhan)) {
            startActivity(Intent(context, AdhanSettingsActivity::class.java))
        }
        rowAlerts = Ui.row(list, R.drawable.ic_bell, getString(R.string.settings_prayer_alerts), switchChecked = false) { row ->
            val turnOn = !row.switchSetting.isChecked
            if (!turnOn) {
                PrayerRepository.prefs(context).edit().putBoolean(PrayerRepository.KEY_ALERTS, false).apply()
                PrayerScheduler.schedule(context)
                render()
            } else {
                host.permissions.requestNotifications { granted ->
                    PrayerRepository.prefs(context).edit().putBoolean(PrayerRepository.KEY_ALERTS, granted).apply()
                    PrayerScheduler.schedule(context)
                    if (granted && !PrayerScheduler.canScheduleExact(context) && Build.VERSION.SDK_INT >= 31) {
                        runCatching {
                            startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
                        }
                    }
                    render()
                }
            }
        }
    }

    private fun chooseMethod() {
        val context = requireContext()
        val labels = resources.getStringArray(R.array.prayer_method_labels)
        val current = PrayerRepository.METHOD_IDS.indexOf(
            PrayerRepository.prefs(context).getInt(PrayerRepository.KEY_METHOD, PrayerRepository.DEFAULT_METHOD)
        )
        AlertDialog.Builder(context)
            .setTitle(R.string.method_title)
            .setSingleChoiceItems(labels, current) { dialog, which ->
                PrayerRepository.prefs(context).edit().putInt(PrayerRepository.KEY_METHOD, PrayerRepository.METHOD_IDS[which]).apply()
                dialog.dismiss()
                viewModel.refresh()
                render()
            }
            .show()
    }

    private fun render() {
        val b = _binding ?: return
        val context = b.root.context
        val configured = PrayerRepository.isConfigured(context)
        b.layoutPrayerEmpty.visibility = if (configured) View.GONE else View.VISIBLE
        b.cardTimes.visibility = if (configured) View.VISIBLE else View.GONE
        b.textPrayerHint.visibility = if (configured) View.VISIBLE else View.GONE
        b.swipeRefresh.isEnabled = configured
        b.btnPrevDay.isEnabled = configured
        b.btnNextDay.isEnabled = configured

        val day = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, dayOffset) }
        val dayName = SimpleDateFormat(Lang.pick("EEEE، d MMMM", "EEEE, d MMMM"), Ui.locale()).format(day.time)
        b.textDay.text = if (dayOffset == 0) "${getString(R.string.today)} — $dayName" else dayName
        b.textPrayerPlace.text = PrayerRepository.placeLabel(context) ?: getString(R.string.home_place_unknown)

        val timings = if (configured) PrayerRepository.dayTimings(context, day) else null
        b.textDayHijri.text = HijriDate.format(HijriDate.of(context, day))
        if (configured && timings == null && viewModel.loading.value != true && viewModel.error.value == null) {
            b.textPrayerError.text = getString(R.string.prayer_no_day_data)
            b.textPrayerError.visibility = View.VISIBLE
        } else if (viewModel.error.value == null) {
            b.textPrayerError.visibility = View.GONE
        }

        val next = if (dayOffset == 0) PrayerRepository.nextPrayer(context) else null
        val alertsOn = PrayerRepository.alertsOn(context)
        rows.forEach { (prayer, row) ->
            val time = timings?.times?.get(prayer)
            row.textPrayerTime.text = Ui.time(context, time)
            val isNext = next != null && next.prayer == prayer && next.time == time
            row.root.setBackgroundResource(if (isNext) R.drawable.bg_row_active else 0)
            row.textPrayerSub.visibility = if (isNext || !prayer.isSalah) View.VISIBLE else View.GONE
            row.textPrayerSub.text = when {
                isNext -> getString(R.string.prayer_next_badge, Ui.remaining(context, next!!.millis))
                !prayer.isSalah -> getString(R.string.sunrise_no_adhan)
                else -> ""
            }
            val textColor = Themes.color(context, if (isNext) R.color.accent_text else R.color.text_primary_light)
            row.textPrayerName.setTextColor(textColor)
            row.textPrayerTime.setTextColor(textColor)
            if (prayer.isSalah) {
                val done = PrayerTracker.isDone(context, day, prayer)
                row.btnPrayerDone.visibility = if (dayOffset <= 0) View.VISIBLE else View.INVISIBLE
                row.btnPrayerDone.alpha = if (done) 1f else 0.3f
                row.btnPrayerDone.setBackgroundResource(if (done) R.drawable.bg_icon_circle else 0)
                val on = alertsOn && PrayerRepository.isAlertEnabled(context, prayer)
                row.btnPrayerBell.setImageResource(if (on) R.drawable.ic_bell else R.drawable.ic_bell_off)
                row.btnPrayerBell.alpha = if (on) 1f else 0.45f
            }
        }

        renderExtraTimes(timings)
        rowPlace?.let { Ui.setValue(it, PrayerRepository.placeLabel(context) ?: getString(R.string.home_place_unknown)) }
        rowMethod?.let { Ui.setValue(it, Ui.methodLabel(context)) }
        rowAdhan?.let { Ui.setValue(it, Ui.adhanLabel(context)) }
        rowAlerts?.let {
            it.switchSetting.isChecked = alertsOn
            val count = Prayer.values().count { p -> PrayerRepository.isAlertEnabled(context, p) }
            Ui.setValue(it, if (alertsOn) getString(R.string.settings_prayer_alerts_on, count) else getString(R.string.settings_off))
        }
    }

    private fun renderExtraTimes(timings: DayTimings?) {
        val b = _binding ?: return
        val context = b.root.context
        b.titleExtraTimes.visibility = if (timings == null) View.GONE else View.VISIBLE
        b.cardExtraTimes.visibility = if (timings == null) View.GONE else View.VISIBLE
        val list = b.listExtraTimes
        list.removeAllViews()
        if (timings == null) return
        fun shift(hhmm: String?, minutes: Int): String? {
            val parts = hhmm?.split(":") ?: return null
            val total = ((parts[0].toIntOrNull() ?: return null) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0) + minutes + 1440) % 1440
            return Prefs.formatMinutes(total)
        }
        timings.extras["Imsak"]?.let { Ui.row(list, R.drawable.ic_moon, getString(R.string.time_imsak), Ui.time(context, it)) {} }
        val duhaFrom = shift(timings.times[Prayer.SUNRISE], 15)
        val duhaTo = shift(timings.times[Prayer.DHUHR], -10)
        if (duhaFrom != null && duhaTo != null) {
            Ui.row(list, R.drawable.ic_sun, getString(R.string.time_duha),
                getString(R.string.time_duha_value, Ui.time(context, duhaFrom), Ui.time(context, duhaTo))) {}
        }
        timings.extras["Midnight"]?.let { Ui.row(list, R.drawable.ic_moon, getString(R.string.time_midnight), Ui.time(context, it)) {} }
        timings.extras["Lastthird"]?.let { Ui.row(list, R.drawable.ic_star, getString(R.string.time_last_third), Ui.time(context, it)) {} }
        for (i in 0 until list.childCount) {
            list.getChildAt(i).findViewById<View>(R.id.chevronSetting)?.visibility = View.GONE
        }
    }

    companion object {
        private val DAY_PRAYERS = setOf(Prayer.SUNRISE, Prayer.DHUHR, Prayer.ASR)
    }
}
