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
            } else {
                row.btnPrayerBell.visibility = View.INVISIBLE
            }
            rows[prayer] = row
        }
        buildSettings()

        binding.btnPrevDay.setOnClickListener { dayOffset--; render() }
        binding.btnNextDay.setOnClickListener { dayOffset++; render() }
        binding.layoutDate.setOnClickListener { dayOffset = 0; render() }
        binding.btnPrayerSetup.setOnClickListener { openLocation() }
        binding.swipeRefresh.setColorSchemeResources(R.color.teal_primary)
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
        val dayName = SimpleDateFormat("EEEE، d MMMM", Locale("ar")).format(day.time)
        b.textDay.text = if (dayOffset == 0) "${getString(R.string.today)} — $dayName" else dayName
        b.textPrayerPlace.text = PrayerRepository.placeLabel(context) ?: getString(R.string.home_place_unknown)

        val timings = if (configured) PrayerRepository.dayTimings(context, day) else null
        b.textDayHijri.text = timings?.hijriDate?.takeIf { it.isNotBlank() } ?: if (dayOffset == 0) HijriDate.today() else ""
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
            val textColor = ContextCompat.getColor(context, if (isNext) R.color.accent_text else R.color.text_primary_light)
            row.textPrayerName.setTextColor(textColor)
            row.textPrayerTime.setTextColor(textColor)
            if (prayer.isSalah) {
                val on = alertsOn && PrayerRepository.isAlertEnabled(context, prayer)
                row.btnPrayerBell.setImageResource(if (on) R.drawable.ic_bell else R.drawable.ic_bell_off)
                row.btnPrayerBell.alpha = if (on) 1f else 0.45f
            }
        }

        rowPlace?.let { Ui.setValue(it, PrayerRepository.placeLabel(context) ?: getString(R.string.home_place_unknown)) }
        rowMethod?.let { Ui.setValue(it, Ui.methodLabel(context)) }
        rowAdhan?.let { Ui.setValue(it, Ui.adhanLabel(context)) }
        rowAlerts?.let {
            it.switchSetting.isChecked = alertsOn
            val count = Prayer.values().count { p -> PrayerRepository.isAlertEnabled(context, p) }
            Ui.setValue(it, if (alertsOn) getString(R.string.settings_prayer_alerts_on, count) else getString(R.string.settings_off))
        }
    }

    companion object {
        private val DAY_PRAYERS = setOf(Prayer.SUNRISE, Prayer.DHUHR, Prayer.ASR)
    }
}
