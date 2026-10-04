package com.mizan.budget

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
import com.mizan.budget.notify.ReminderScheduler
import com.mizan.budget.ui.MainViewModel
import com.mizan.budget.ui.MizaniRoot
import com.mizan.budget.ui.screens.OnboardingScreen
import com.mizan.budget.ui.theme.MizaniTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        appScope.launch { repo.changed() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val openAdd = intent?.action == ACTION_ADD
        setContent {
            val settings by vm.settings.collectAsStateWithLifecycle()
            MizaniTheme(settings?.themeMode ?: 2) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
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
                            else -> MizaniRoot(vm, openAdd)
                        }
                    }
                }
            }
        }
    }

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
        const val ACTION_ADD = "com.mizan.budget.ADD"
        fun addIntent(activity: android.content.Context) = Intent(activity, MainActivity::class.java).setAction(ACTION_ADD)
    }
}
