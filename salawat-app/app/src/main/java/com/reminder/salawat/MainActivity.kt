package com.reminder.salawat

import android.Manifest
import android.app.TimePickerDialog
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.reminder.salawat.databinding.ActivityMainBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) setReminderEnabled(true) else binding.switchReminder.isChecked = false
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs.get(this)

        setupReminder()
        setupTasbih()

        binding.btnPrayerTimes.setOnClickListener { startActivity(Intent(this, PrayerTimesActivity::class.java)) }
        binding.cardNextPrayer.setOnClickListener { startActivity(Intent(this, PrayerTimesActivity::class.java)) }
        binding.btnAzkar.setOnClickListener { startActivity(Intent(this, AzkarCategoriesActivity::class.java)) }
        binding.btnQuran.setOnClickListener { startActivity(Intent(this, SurahListActivity::class.java)) }
        binding.btnQibla.setOnClickListener { startActivity(Intent(this, QiblaActivity::class.java)) }

        // Keep the next-prayer countdown current while the screen is visible.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    refreshHeader()
                    delay(30_000)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // The notification permission can be revoked from system settings while we're away.
        if (prefs.getBoolean(Prefs.KEY_REMINDER_ENABLED, false) && !Notifications.canPost(this)) {
            binding.switchReminder.isChecked = false
        }
        PrayerScheduler.refreshDependents(this)
    }

    private fun refreshHeader() {
        binding.textHijri.text = HijriDate.today()
        val next = PrayerRepository.nextPrayer(this)
        if (next == null) {
            binding.textNextPrayer.text = getString(R.string.next_prayer_unknown)
            binding.textNextPrayerRemaining.visibility = View.GONE
        } else {
            binding.textNextPrayer.text = getString(R.string.next_prayer, getString(next.prayer.nameRes), next.time)
            binding.textNextPrayerRemaining.text = getString(R.string.next_prayer_remaining, formatRemaining(this, next.millis))
            binding.textNextPrayerRemaining.visibility = View.VISIBLE
        }
    }

    // ---- Reminder ----

    private fun setupReminder() {
        val enabled = prefs.getBoolean(Prefs.KEY_REMINDER_ENABLED, false) && Notifications.canPost(this)
        binding.switchReminder.isChecked = enabled
        binding.switchReminder.setOnCheckedChangeListener { _, checked ->
            when {
                !checked -> setReminderEnabled(false)
                Notifications.canPost(this) -> setReminderEnabled(true)
                Build.VERSION.SDK_INT >= 33 -> notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                else -> setReminderEnabled(true)
            }
        }

        val labels = resources.getStringArray(R.array.reminder_interval_labels)
        binding.spinnerInterval.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, labels).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        val currentIndex = Prefs.INTERVAL_OPTIONS.indexOf(Prefs.reminderInterval(this)).coerceAtLeast(0)
        binding.spinnerInterval.setSelection(currentIndex, false)
        updateStatusText(enabled)
        binding.spinnerInterval.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val minutes = Prefs.INTERVAL_OPTIONS[position]
                if (minutes == Prefs.reminderInterval(this@MainActivity)) return
                prefs.edit().putLong(Prefs.KEY_REMINDER_INTERVAL, minutes).apply()
                ReminderWorker.apply(this@MainActivity)
                updateStatusText(binding.switchReminder.isChecked)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        binding.switchQuiet.isChecked = prefs.getBoolean(Prefs.KEY_QUIET_ENABLED, false)
        binding.switchQuiet.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(Prefs.KEY_QUIET_ENABLED, checked).apply()
            updateQuietRange()
        }
        binding.textQuietRange.setOnClickListener { pickQuietHours() }
        updateQuietRange()
    }

    private fun setReminderEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, enabled).apply()
        updateStatusText(enabled)
        ReminderWorker.apply(this)
    }

    private fun updateStatusText(enabled: Boolean) {
        binding.textStatus.text = if (enabled) {
            getString(R.string.status_on, binding.spinnerInterval.selectedItem?.toString().orEmpty())
        } else {
            getString(R.string.status_off)
        }
    }

    private fun updateQuietRange() {
        binding.textQuietRange.visibility = if (binding.switchQuiet.isChecked) View.VISIBLE else View.GONE
        binding.textQuietRange.text = getString(
            R.string.quiet_hours_range,
            Prefs.formatMinutes(Prefs.quietStart(this)),
            Prefs.formatMinutes(Prefs.quietEnd(this))
        )
    }

    private fun pickQuietHours() {
        val start = Prefs.quietStart(this)
        TimePickerDialog(this, { _, h, m ->
            prefs.edit().putInt(Prefs.KEY_QUIET_START, h * 60 + m).apply()
            val end = Prefs.quietEnd(this)
            TimePickerDialog(this, { _, h2, m2 ->
                prefs.edit().putInt(Prefs.KEY_QUIET_END, h2 * 60 + m2).apply()
                updateQuietRange()
            }, end / 60, end % 60, true).apply { setTitle(R.string.quiet_hours_pick_end) }.show()
        }, start / 60, start % 60, true).apply { setTitle(R.string.quiet_hours_pick_start) }.show()
    }

    // ---- Tasbih ----

    private fun setupTasbih() {
        refreshTasbihUi()
        binding.btnTasbihCount.setOnClickListener { view ->
            val index = prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0)
            val key = Prefs.KEY_TASBIH_COUNT_PREFIX + index
            val newCount = prefs.getInt(key, 0) + 1
            prefs.edit().putInt(key, newCount).apply()
            val target = prefs.getInt(Prefs.KEY_TASBIH_TARGET, 33)
            if (target > 0 && newCount % target == 0) {
                vibrate(400)
                Toast.makeText(this, getString(R.string.tasbih_target_reached, newCount), Toast.LENGTH_SHORT).show()
            } else {
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                vibrate(25)
            }
            refreshTasbihUi()
        }
        binding.btnTasbihNext.setOnClickListener {
            val index = (prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0) + 1) % DHIKR_PHRASES.size
            prefs.edit().putInt(Prefs.KEY_TASBIH_INDEX, index).apply()
            refreshTasbihUi()
        }
        binding.btnTasbihReset.setOnClickListener {
            val index = prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0)
            prefs.edit().putInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index, 0).apply()
            refreshTasbihUi()
        }
        binding.textTasbihTarget.setOnClickListener { pickTarget() }
    }

    private fun pickTarget() {
        val options = intArrayOf(33, 100, 1000, 0)
        val labels = options.map { if (it == 0) getString(R.string.tasbih_target_none) else it.toString() }.toTypedArray()
        AlertDialog.Builder(this)
            .setItems(labels) { _, which ->
                prefs.edit().putInt(Prefs.KEY_TASBIH_TARGET, options[which]).apply()
                refreshTasbihUi()
            }
            .show()
    }

    private fun refreshTasbihUi() {
        val index = prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0).coerceIn(0, DHIKR_PHRASES.size - 1)
        val count = prefs.getInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index, 0)
        val target = prefs.getInt(Prefs.KEY_TASBIH_TARGET, 33)
        binding.textDhikrPhrase.text = DHIKR_PHRASES[index]
        binding.textTasbihCount.text = count.toString()
        binding.textTasbihTarget.text = getString(
            R.string.tasbih_target,
            if (target == 0) getString(R.string.tasbih_target_none) else "${count % target} / $target"
        )
    }

    @Suppress("DEPRECATION")
    private fun vibrate(millis: Long) {
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= 26) {
            vibrator.vibrate(VibrationEffect.createOneShot(millis, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            vibrator.vibrate(millis)
        }
    }

    companion object {
        private val DHIKR_PHRASES = arrayOf("سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله")

        fun formatRemaining(context: Context, targetMillis: Long): String {
            val totalMinutes = ((targetMillis - System.currentTimeMillis()) / 60_000L).coerceAtLeast(0).toInt() + 1
            val hours = totalMinutes / 60
            val minutes = totalMinutes % 60
            return if (hours > 0) context.getString(R.string.hours_minutes, hours, minutes)
            else context.getString(R.string.minutes_only, minutes)
        }
    }
}
