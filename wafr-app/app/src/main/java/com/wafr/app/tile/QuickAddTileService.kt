package com.wafr.app.tile

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.wafr.app.QuickAddActivity
import com.wafr.app.R
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.repo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Quick Settings tile: one tap from the notification shade opens the quick-add sheet. */
class QuickAddTileService : TileService() {
    private var scope: CoroutineScope? = null

    override fun onStartListening() {
        super.onStartListening()
        val s = CoroutineScope(SupervisorJob() + Dispatchers.Default).also { scope = it }
        s.launch {
            val snap = applicationContext.repo.snapshotOnce()
            val subtitle = when {
                !snap.hasBudget -> "اليوم ${Money.compact(snap.spentToday, snap.currency)}"
                snap.safeToday >= 0 -> "باقي ${Money.compact(snap.safeToday, snap.currency)}"
                else -> "تجاوزت ${Money.compact(-snap.safeToday, snap.currency)}"
            }
            withContext(Dispatchers.Main) {
                qsTile?.apply {
                    label = "سجّل مصروف"
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) this.subtitle = subtitle
                    contentDescription = "وَفْر: $subtitle"
                    icon = Icon.createWithResource(this@QuickAddTileService, R.drawable.ic_tile)
                    state = Tile.STATE_ACTIVE
                    updateTile()
                }
            }
        }
    }

    override fun onStopListening() {
        scope?.cancel()
        scope = null
        super.onStopListening()
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    override fun onClick() {
        super.onClick()
        val intent = QuickAddActivity.intent(this, null, Expense.Source.TILE)
        if (Build.VERSION.SDK_INT >= 34) {
            val pi = PendingIntent.getActivity(this, 50, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            startActivityAndCollapse(pi)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
