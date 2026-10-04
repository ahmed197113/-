package com.mizan.budget.notify

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.quicksettings.TileService
import androidx.glance.appwidget.updateAll
import com.mizan.budget.appScope
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Snapshot
import com.mizan.budget.repo
import com.mizan.budget.tile.QuickAddTileService
import com.mizan.budget.widget.BudgetWidget
import com.mizan.budget.widget.CompactWidget
import kotlinx.coroutines.launch

object Refresher {
    suspend fun refreshAll(context: Context, snap: Snapshot, settings: Settings) {
        Notifications.showStatus(context, snap, settings)
        runCatching { BudgetWidget().updateAll(context) }
        runCatching { CompactWidget().updateAll(context) }
        runCatching {
            TileService.requestListeningState(context, ComponentName(context, QuickAddTileService::class.java))
        }
    }
}

/** Restores the status notification after a reboot or app update. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext
        app.appScope.launch {
            try {
                val repo = app.repo
                ReminderScheduler.apply(app, repo.settingsStore.current())
                repo.changed()
            } finally {
                pending.finish()
            }
        }
    }
}
