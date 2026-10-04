package com.wafr.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.wafr.app.notify.Notifications
import com.wafr.app.notify.ReminderScheduler
import com.wafr.app.ui.MainViewModel
import androidx.compose.runtime.mutableStateOf
import com.wafr.app.ui.NavRequest
import com.wafr.app.ui.Overlay
import com.wafr.app.ui.Tab
import com.wafr.app.ui.WafrRoot
import com.wafr.app.ui.screens.OnboardingScreen
import com.wafr.app.ui.theme.WafrTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()
    private val nav = mutableStateOf(NavRequest())
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        appScope.launch { repo.changed() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        nav.value = parse(intent)
        // Debug-only hooks used by the CI screenshot job.
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("demo", false) == true) {
            appScope.launch { if (repo.allExpenses().isEmpty()) repo.seedDemo() }
        }
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("notify", false) == true) {
            appScope.launch {
                val snap = repo.snapshotOnce()
                Notifications.showCheckIn(this@MainActivity, snap, 5)
                Notifications.showStatus(this@MainActivity, snap, repo.settingsStore.current())
            }
        }
        setContent {
            val settings by vm.settings.collectAsStateWithLifecycle()
            WafrTheme(settings?.themeMode ?: 2) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Box(Modifier.fillMaxSize().background(com.wafr.app.ui.theme.Mz.colors.bg)) {
                        val s = settings
                        when {
                            s == null -> {}
                            !s.onboarded -> OnboardingScreen(
                                onFinish = { transform ->
                                    vm.updateSettings(reschedule = true, transform = transform)
                                    askNotifications()
                                },
                                onAskNotifications = { askNotifications() },
                            )
                            else -> WafrRoot(vm, nav.value)
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        nav.value = parse(intent)
    }

    private fun parse(i: Intent?) = NavRequest(
        tab = i?.getStringExtra("tab")?.let { t -> Tab.entries.firstOrNull { it.name == t } },
        overlay = i?.getStringExtra("overlay")?.let { o -> Overlay.entries.firstOrNull { it.name == o } },
        add = i?.action == ACTION_ADD,
    )

    override fun onResume() {
        super.onResume()
        appScope.launch {
            repo.changed()
            ReminderScheduler.apply(this@MainActivity, repo.settingsStore.current())
        }
    }

    private fun askNotifications() {
        if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    companion object {
        const val ACTION_ADD = "com.wafr.app.ADD"
        fun addIntent(activity: android.content.Context) = Intent(activity, MainActivity::class.java).setAction(ACTION_ADD)
    }
}
