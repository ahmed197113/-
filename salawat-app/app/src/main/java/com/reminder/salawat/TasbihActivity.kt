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
                    // Choosing a dhikr by hand starts a fresh round of it.
                    prefs.edit().putInt(Prefs.KEY_TASBIH_INDEX, index)
                        .putInt(KEY_BASE + index, prefs.getInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index, 0)).apply()
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
            if (target > 0 && (count - base(index())) % target == 0) {
                vibrate(350)
                advance()
            } else {
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                vibrate(20)
            }
            refresh()
        }
        binding.btnReset.setOnClickListener {
            prefs.edit().putInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index(), 0).putInt(KEY_BASE + index(), 0).apply()
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

    /** The total at which the current round of this dhikr started. */
    private fun base(i: Int) = prefs.getInt(KEY_BASE + i, 0)

    /** A round is complete: move on to the next dhikr automatically, starting a fresh round there. */
    private fun advance() {
        val next = (index() + 1) % PHRASES.size
        val nextTotal = prefs.getInt(Prefs.KEY_TASBIH_COUNT_PREFIX + next, 0)
        prefs.edit().putInt(Prefs.KEY_TASBIH_INDEX, next).putInt(KEY_BASE + next, nextTotal).apply()
        (binding.chipsDhikr.getChildAt(next) as? Chip)?.isChecked = true
        binding.chipsDhikr.getChildAt(next)?.let { chip ->
            (binding.chipsDhikr.parent as? android.widget.HorizontalScrollView)?.smoothScrollTo(chip.left, 0)
        }
        android.widget.Toast.makeText(this, getString(R.string.tasbih_next, PHRASES[next]), android.widget.Toast.LENGTH_SHORT).show()
    }

    private fun target() = prefs.getInt(Prefs.KEY_TASBIH_TARGET, 33)

    private fun refresh() {
        val count = prefs.getInt(Prefs.KEY_TASBIH_COUNT_PREFIX + index(), 0)
        val target = target()
        binding.textDhikr.text = PHRASES[index()]
        if (target > 0) {
            val round = (count - base(index())).coerceAtLeast(0) % target
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
        private const val KEY_BASE = "tasbih_round_base_"
        private val PHRASES = listOf(
            "سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله",
            "اللهم صلِّ على محمد", "لا حول ولا قوة إلا بالله", "سبحان الله وبحمده"
        )
    }
}
