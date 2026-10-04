package com.wafr.app.notify

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.quicksettings.TileService
import androidx.glance.appwidget.updateAll
import com.wafr.app.appScope
import com.wafr.app.data.Settings
import com.wafr.app.domain.Snapshot
import com.wafr.app.repo
import com.wafr.app.tile.QuickAddTileService
import com.wafr.app.widget.BudgetWidget
import com.wafr.app.widget.CompactWidget
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
                ReminderScheduler.ensure(app)
                repo.changed()
            } finally {
                pending.finish()
            }
        }
    }
}
