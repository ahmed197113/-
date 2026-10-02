package com.reminder.salawat

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.reminder.salawat.databinding.ActivityTasbihBinding

class TasbihActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTasbihBinding
    private val prefs by lazy { Prefs.get(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTasbihBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.toolbar.setTitle(R.string.more_tasbih)
        binding.toolbar.toolbar.setNavigationOnClickListener { finish() }

        val selected = prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0).coerceIn(0, PHRASES.size - 1)
        PHRASES.forEachIndexed { index, phrase ->
            val chip = Chip(this).apply {
                id = 1000 + index
                text = phrase
                isCheckable = true
                isChecked = index == selected
                setOnClickListener {
                    prefs.edit().putInt(Prefs.KEY_TASBIH_INDEX, index).apply()
                    refresh()
                }
            }
            binding.chipsDhikr.addView(chip)
        }

        binding.btnCount.setOnClickListener { view ->
            val key = Prefs.KEY_TASBIH_COUNT_PREFIX + index()
            val count = prefs.getInt(key, 0) + 1
            prefs.edit().putInt(key, count).apply()
            val target = target()
            if (target > 0 && count % target == 0) vibrate(350) else {
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                vibrate(20)
            }
            refresh()
        }
        binding.btnReset.setOnClickListener {
            prefs.edit().putInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index(), 0).apply()
            refresh()
        }
        binding.btnTarget.setOnClickListener {
            val options = intArrayOf(33, 100, 1000, 0)
            val labels = options.map { if (it == 0) getString(R.string.tasbih_target_none) else it.toString() }.toTypedArray()
            AlertDialog.Builder(this)
                .setTitle(R.string.tasbih_target_btn.let { getString(it, "") })
                .setSingleChoiceItems(labels, options.indexOf(target()).coerceAtLeast(0)) { dialog, which ->
                    prefs.edit().putInt(Prefs.KEY_TASBIH_TARGET, options[which]).apply()
                    dialog.dismiss()
                    refresh()
                }
                .show()
        }
        refresh()
    }

    private fun index() = prefs.getInt(Prefs.KEY_TASBIH_INDEX, 0).coerceIn(0, PHRASES.size - 1)

    private fun target() = prefs.getInt(Prefs.KEY_TASBIH_TARGET, 33)

    private fun refresh() {
        val count = prefs.getInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index(), 0)
        val target = target()
        binding.textDhikr.text = PHRASES[index()]
        if (target > 0) {
            val round = count % target
            binding.textCount.text = round.toString()
            binding.textTarget.text = getString(R.string.tasbih_of_target, target)
            binding.progressTarget.max = target
            binding.progressTarget.setProgressCompat(round, true)
        } else {
            binding.textCount.text = count.toString()
            binding.textTarget.text = ""
            binding.progressTarget.max = 1
            binding.progressTarget.setProgressCompat(0, false)
        }
        binding.textTotal.text = getString(R.string.tasbih_total, count)
        binding.btnTarget.text = getString(
            R.string.tasbih_target_btn, if (target == 0) getString(R.string.tasbih_target_none) else target.toString()
        )
    }

    @Suppress("DEPRECATION")
    private fun vibrate(millis: Long) {
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(millis, VibrationEffect.DEFAULT_AMPLITUDE))
        else vibrator.vibrate(millis)
    }

    companion object {
        private val PHRASES = listOf(
            "سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله",
            "اللهم صلِّ على محمد", "لا حول ولا قوة إلا بالله", "سبحان الله وبحمده"
        )
    }
}
