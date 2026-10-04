package com.wafr.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.wafr.app.data.Settings
import com.wafr.app.domain.Money
import com.wafr.app.domain.Snapshot
import com.wafr.app.domain.Suggestions
import com.wafr.app.notify.Notifications
import com.wafr.app.ui.components.ExpenseEditor
import com.wafr.app.ui.theme.WafrTheme
import kotlinx.coroutines.launch

/**
 * A floating "add expense" sheet that opens on top of whatever the user is doing.
 * Launched from the quick-settings tile, the home-screen widget and notifications.
 */
class QuickAddActivity : ComponentActivity() {
    companion object {
        private const val EXTRA_NEED = "need"
        private const val EXTRA_SOURCE = "source"

        fun intent(context: Context, need: Boolean?, source: Int): Intent =
            Intent(context, QuickAddActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .setData(android.net.Uri.parse("wafr://add/${need ?: "any"}/$source"))
                .putExtra(EXTRA_NEED, when (need) { true -> 1; false -> 0; null -> -1 })
                .putExtra(EXTRA_SOURCE, source)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val needExtra = intent.getIntExtra(EXTRA_NEED, -1)
        val preset = when (needExtra) { 1 -> true; 0 -> false; else -> null }
        val source = intent.getIntExtra(EXTRA_SOURCE, 0)
        Notifications.cancel(this, Notifications.ID_CHECKIN)

        setContent {
            val settings by repo.settings.collectAsState(initial = null as Settings?)
            val categories by repo.categories.collectAsState(initial = emptyList())
            val snap by repo.snapshot.collectAsState(initial = null as Snapshot?)
            val expenses by repo.expenses.collectAsState(initial = emptyList())
            val suggestions = remember(expenses) { Suggestions.frequent(expenses) }
            WafrTheme(settings?.themeMode ?: 2) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Box(
                        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f))
                            .clickable(remember { MutableInteractionSource() }, null) { finish() },
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        Surface(
                            modifier = Modifier.fillMaxWidth().clickable(remember { MutableInteractionSource() }, null) {},
                            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                            color = MaterialTheme.colorScheme.surface,
                            contentColor = MaterialTheme.colorScheme.onSurface,
                        ) {
                            Column(
                                Modifier.navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.Bottom,
                            ) {
                                val s = settings
                                if (s != null && categories.isNotEmpty()) {
                                    ExpenseEditor(
                                        categories = categories, currency = s.currency, presetNeed = preset,
                                        categorySpent = snap?.byCategory?.associate { it.category.id to it.spent } ?: emptyMap(),
                                        suggestions = suggestions,
                                        onSave = { amount, need, catId, note, ts ->
                                            appScope.launch { repo.addExpense(amount, need, note, source, catId, ts) }
                                            Toast.makeText(this@QuickAddActivity, "✓ سُجّل ${Money.format(amount, s.currency)}", Toast.LENGTH_SHORT).show()
                                            finish()
                                        },
                                        onClose = { finish() },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
