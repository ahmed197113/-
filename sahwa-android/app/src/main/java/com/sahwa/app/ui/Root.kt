package com.sahwa.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import com.sahwa.app.data.Store
import kotlinx.coroutines.delay

enum class Tab(val label: String, val icon: String) {
    HOME("العقل", "🧠"),
    HABITS("العادات", "🌱"),
    RESCUE("بدائل", "⚡"),
    STATS("التقدم", "📈"),
    SETTINGS("الدرع", "🛡️"),
}

@Composable
fun SahwaRoot(tab: MutableState<Tab>) {
    SahwaTheme {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            val data by Store.state.collectAsState()
            var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
            var running by remember { mutableStateOf<Rescue?>(null) }

            LaunchedEffect(Unit) {
                while (true) {
                    Store.tick()
                    now = System.currentTimeMillis()
                    delay(1000)
                }
            }

            if (!data.onboarded) {
                OnboardingScreen(now)
                return@CompositionLocalProvider
            }

            Box(Modifier.fillMaxSize()) {
                Scaffold(
                    containerColor = C.Bg,
                    bottomBar = {
                        NavigationBar(containerColor = C.Panel) {
                            Tab.entries.forEach { t ->
                                NavigationBarItem(
                                    selected = tab.value == t,
                                    onClick = { tab.value = t },
                                    icon = { Text(t.icon, fontSize = 20.sp) },
                                    label = { Text(t.label) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedTextColor = C.Cyan,
                                        unselectedTextColor = C.Muted,
                                        indicatorColor = C.Cyan.copy(alpha = 0.15f),
                                    ),
                                )
                            }
                        }
                    },
                ) { pad ->
                    Box(Modifier.padding(pad).fillMaxSize()) {
                        when (tab.value) {
                            Tab.HOME -> HomeScreen(data, now, onOpenTab = { tab.value = it })
                            Tab.HABITS -> HabitsScreen(data)
                            Tab.RESCUE -> RescueScreen(data, onStart = { running = it })
                            Tab.STATS -> StatsScreen(data, now)
                            Tab.SETTINGS -> SettingsScreen(data, now)
                        }
                    }
                }
                running?.let { r ->
                    RescueRunner(
                        rescue = r,
                        onDone = {
                            Store.completeActivity(r.points, r.credits)
                            running = null
                        },
                        onClose = { running = null },
                    )
                }
            }
        }
    }
}
