package com.reminder.salawat

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.reminder.salawat.databinding.ActivityMainBinding

/** App shell: bottom navigation between the five main sections. */
class MainActivity : AppCompatActivity(), PermissionHost {

    override val permissions = PermissionRequester(this)
    private lateinit var binding: ActivityMainBinding
    private var currentTab = TAB_HOME

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Prefs.get(this).getBoolean(Prefs.KEY_ONBOARDED, false)) {
            startActivity(Intent(this, OnboardingActivity::class.java))
            finish()
            return
        }
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.bottomNav.setOnItemSelectedListener { item ->
            show(TABS.entries.first { it.value == item.itemId }.key)
            true
        }
        binding.bottomNav.setOnItemReselectedListener { }

        val start = savedInstanceState?.getString(STATE_TAB) ?: intent.getStringExtra(EXTRA_TAB) ?: TAB_HOME
        select(start)

        // Users who set the app up before the adhan became on-by-default are asked once for what it needs.
        val prefs = Prefs.get(this)
        if (savedInstanceState == null && !prefs.getBoolean(KEY_ALERT_PERMS_ASKED, false)) {
            prefs.edit().putBoolean(KEY_ALERT_PERMS_ASKED, true).apply()
            if (PrayerRepository.alertsOn(this)) {
                AlertPermissions.requestAll(this, permissions) { PrayerScheduler.refreshDependents(this) }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (currentTab != TAB_HOME) {
                    select(TAB_HOME)
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_TAB)?.let { select(it) }
    }

    override fun onResume() {
        super.onResume()
        PrayerScheduler.refreshDependents(this)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_TAB, currentTab)
    }

    fun select(tab: String) {
        val id = TABS[tab] ?: return
        if (binding.bottomNav.selectedItemId != id) binding.bottomNav.selectedItemId = id else show(tab)
    }

    /** Fragments are kept alive (hidden) so each tab keeps its scroll position and state. */
    private fun show(tab: String) {
        currentTab = tab
        val fm = supportFragmentManager
        val tx = fm.beginTransaction().setReorderingAllowed(true)
        TABS.keys.forEach { key ->
            val existing = fm.findFragmentByTag(key)
            if (key == tab) {
                if (existing == null) tx.add(R.id.fragmentContainer, create(key), key) else tx.show(existing)
            } else if (existing != null) {
                tx.hide(existing)
            }
        }
        tx.commitNow()
    }

    private fun create(tab: String): Fragment = when (tab) {
        TAB_PRAYER -> PrayerFragment()
        TAB_QURAN -> QuranFragment()
        TAB_AZKAR -> AzkarFragment()
        TAB_MORE -> MoreFragment()
        else -> HomeFragment()
    }

    companion object {
        private const val KEY_ALERT_PERMS_ASKED = "alert_perms_asked_v6"
        const val EXTRA_TAB = "tab"
        private const val STATE_TAB = "current_tab"
        const val TAB_HOME = "home"
        const val TAB_PRAYER = "prayer"
        const val TAB_QURAN = "quran"
        const val TAB_AZKAR = "azkar"
        const val TAB_MORE = "more"

        private val TABS = linkedMapOf(
            TAB_HOME to R.id.tab_home,
            TAB_PRAYER to R.id.tab_prayer,
            TAB_QURAN to R.id.tab_quran,
            TAB_AZKAR to R.id.tab_azkar,
            TAB_MORE to R.id.tab_more
        )

        fun intent(context: Context, tab: String): Intent =
            Intent(context, MainActivity::class.java)
                .putExtra(EXTRA_TAB, tab)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
}
