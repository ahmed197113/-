package com.mizan.budget

import android.app.Application
import android.content.Context
import com.mizan.budget.data.Repository
import com.mizan.budget.notify.Notifications
import com.mizan.budget.notify.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MizaniApp : Application() {
    val repository by lazy { Repository(this) }
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        scope.launch {
            repository.ensureSeeded()
            ReminderScheduler.apply(this@MizaniApp, repository.settingsStore.current())
        }
    }
}

val Context.repo: Repository get() = (applicationContext as MizaniApp).repository
val Context.appScope: CoroutineScope get() = (applicationContext as MizaniApp).scope
