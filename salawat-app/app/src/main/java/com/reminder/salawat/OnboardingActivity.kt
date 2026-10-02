package com.reminder.salawat

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import com.reminder.salawat.databinding.ActivityOnboardingBinding

/** First-run setup in three short steps: welcome → location → alerts. */
class OnboardingActivity : AppCompatActivity(), PermissionHost {

    override val permissions = PermissionRequester(this)
    private lateinit var binding: ActivityOnboardingBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repeat(STEPS) {
            val dot = ImageView(this)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 4
            lp.marginEnd = 4
            dot.layoutParams = lp
            binding.dots.addView(dot)
        }
        val step = savedInstanceState?.getInt(STATE_STEP) ?: 0
        binding.flipper.displayedChild = step

        binding.btnOnboardingLocation.setOnClickListener {
            LocationSheet.show(this, permissions) { updateStep() }
        }
        binding.btnOnboardingSkip.setOnClickListener { finishSetup(applyChoices = false) }
        binding.btnOnboardingNext.setOnClickListener {
            if (binding.flipper.displayedChild < STEPS - 1) {
                binding.flipper.showNext()
                updateStep()
            } else {
                finishSetup(applyChoices = true)
            }
        }
        updateStep()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(STATE_STEP, binding.flipper.displayedChild)
    }

    private fun updateStep() {
        val step = binding.flipper.displayedChild
        for (i in 0 until binding.dots.childCount) {
            (binding.dots.getChildAt(i) as ImageView).setImageResource(if (i == step) R.drawable.dot_active else R.drawable.dot)
        }
        binding.btnOnboardingNext.setText(if (step == STEPS - 1) R.string.onboarding_done else R.string.onboarding_next)
        binding.btnOnboardingSkip.visibility = if (step == STEPS - 1) View.INVISIBLE else View.VISIBLE

        val place = PrayerRepository.placeLabel(this)
        if (place != null) {
            binding.textOnboardingPlace.text = "✓ $place — ${Ui.methodLabel(this)}"
            binding.textOnboardingPlace.visibility = View.VISIBLE
            binding.btnOnboardingLocation.setText(R.string.location_change)
        }
    }

    private fun finishSetup(applyChoices: Boolean) {
        val prefs = Prefs.get(this)
        if (!applyChoices) {
            done()
            return
        }
        val wantAdhan = binding.switchOnboardingAdhan.isChecked
        val wantReminder = binding.switchOnboardingReminder.isChecked
        if (!wantAdhan && !wantReminder) {
            done()
            return
        }
        permissions.requestNotifications { granted ->
            PrayerRepository.prefs(this).edit().putBoolean(PrayerRepository.KEY_ALERTS, granted && wantAdhan).apply()
            prefs.edit().putBoolean(Prefs.KEY_REMINDER_ENABLED, granted && wantReminder).apply()
            ReminderWorker.apply(this)
            PrayerScheduler.refreshDependents(this)
            done()
        }
    }

    private fun done() {
        Prefs.get(this).edit().putBoolean(Prefs.KEY_ONBOARDED, true).apply()
        startActivity(MainActivity.intent(this, MainActivity.TAB_HOME))
        finish()
    }

    companion object {
        private const val STEPS = 3
        private const val STATE_STEP = "step"
    }
}
