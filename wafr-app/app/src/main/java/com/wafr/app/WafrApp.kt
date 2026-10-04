package com.wafr.app

import android.app.Application
import android.content.Context
import com.wafr.app.data.Repository
import com.wafr.app.notify.Notifications
import com.wafr.app.notify.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class WafrApp : Application() {
    val repository by lazy { Repository(this) }
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        scope.launch {
            repository.ensureSeeded()
            ReminderScheduler.apply(this@WafrApp, repository.settingsStore.current())
        }
    }
}

val Context.repo: Repository get() = (applicationContext as WafrApp).repository
val Context.appScope: CoroutineScope get() = (applicationContext as WafrApp).scope
