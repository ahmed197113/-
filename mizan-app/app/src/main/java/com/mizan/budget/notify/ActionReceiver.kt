package com.mizan.budget.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import com.mizan.budget.appScope
import com.mizan.budget.data.Expense
import com.mizan.budget.domain.Money
import com.mizan.budget.repo
import kotlinx.coroutines.launch

/** Handles the buttons and inline replies on Mizani notifications without opening the app. */
class ActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ENTRY = "com.mizan.budget.ENTRY"
        const val ACTION_NONE = "com.mizan.budget.NONE"
        const val ACTION_UNDO = "com.mizan.budget.UNDO"
        const val EXTRA_NEED = "need"
        const val EXTRA_ORIGIN = "origin"
        const val EXTRA_EXPENSE_ID = "expense_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext
        app.appScope.launch {
            try {
                handle(app, intent)
            } finally {
                pending.finish()
            }
        }
    }

    private suspend fun handle(context: Context, intent: Intent) {
        val repo = context.repo
        when (intent.action) {
            ACTION_ENTRY -> {
                val need = intent.getBooleanExtra(EXTRA_NEED, true)
                val origin = intent.getIntExtra(EXTRA_ORIGIN, Notifications.ID_CHECKIN)
                val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(Notifications.KEY_ENTRY)?.toString().orEmpty()
                val parsed = Money.parseEntry(text)
                if (parsed == null) {
                    Notifications.showParseError(context, origin, need)
                    repo.changed()
                    return
                }
                val (amount, note) = parsed
                val expense = repo.addExpense(amount, need, note, Expense.Source.NOTIFICATION)
                repo.recordCheckIn(spent = true)
                if (origin == Notifications.ID_CHECKIN) Notifications.cancel(context, Notifications.ID_CHECKIN)
                val snap = repo.snapshotOnce()
                val cat = repo.categoriesOnce().firstOrNull { it.id == expense.categoryId }
                val kind = if (need) "ضروري" else "كمالي"
                val remainingLine = if (snap.hasBudget) {
                    if (snap.safeToday >= 0) "باقي لك اليوم ${snap.money(snap.safeToday)}" else "تجاوزت حد اليوم بـ ${snap.money(-snap.safeToday)}"
                } else "مجموع اليوم ${snap.money(snap.spentToday)}"
                Notifications.showConfirmation(
                    context,
                    "✓ سُجّل ${snap.money(amount)} — ${cat?.emoji ?: ""} ${cat?.name ?: ""} ($kind)",
                    remainingLine,
                    expense.id,
                )
            }
            ACTION_NONE -> {
                repo.recordCheckIn(spent = false)
                Notifications.cancel(context, Notifications.ID_CHECKIN)
                val snap = repo.snapshotOnce()
                val streak = if (snap.streak >= 2) " 🔥 سلسلتك: ${snap.streak} أيام بلا كماليات" else ""
                Notifications.showConfirmation(context, "أحسنت! 👏", "يوم منضبط.$streak", null)
            }
            ACTION_UNDO -> {
                val id = intent.getLongExtra(EXTRA_EXPENSE_ID, -1)
                val db = com.mizan.budget.data.AppDatabase.get(context)
                db.expenses().byId(id)?.let { repo.deleteExpense(it) }
                Notifications.cancel(context, Notifications.ID_CONFIRM)
            }
        }
    }
}
