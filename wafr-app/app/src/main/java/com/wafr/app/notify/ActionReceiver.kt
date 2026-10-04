package com.wafr.app.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import com.wafr.app.appScope
import com.wafr.app.data.Expense
import com.wafr.app.domain.Money
import com.wafr.app.repo
import kotlinx.coroutines.launch

/** Handles the buttons and inline replies on Wafr notifications without opening the app. */
class ActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ENTRY = "com.wafr.app.ENTRY"
        const val ACTION_NONE = "com.wafr.app.NONE"
        const val ACTION_UNDO = "com.wafr.app.UNDO"
        const val EXTRA_NEED = "need"
        const val EXTRA_ORIGIN = "origin"
        const val EXTRA_EXPENSE_ID = "expense_id"
        const val ACTION_PAY_BILL = "com.wafr.app.PAY_BILL"
        const val ACTION_WISH_BUY = "com.wafr.app.WISH_BUY"
        const val ACTION_WISH_SKIP = "com.wafr.app.WISH_SKIP"
        const val EXTRA_ID = "id"
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
                if (origin != Notifications.ID_STATUS) Notifications.cancel(context, origin)
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
            ACTION_PAY_BILL -> {
                val id = intent.getLongExtra(EXTRA_ID, -1)
                repo.billById(id)?.let { b ->
                    repo.payBill(b)
                    Notifications.cancel(context, Notifications.ID_BILL_BASE + b.id.toInt())
                    val s = repo.settingsStore.current()
                    Notifications.showConfirmation(context, "✓ سُجّلت ${b.name}", Money.format(b.amount, s.currency), null)
                }
            }
            ACTION_WISH_BUY, ACTION_WISH_SKIP -> {
                val id = intent.getLongExtra(EXTRA_ID, -1)
                repo.wishById(id)?.let { w ->
                    val bought = intent.action == ACTION_WISH_BUY
                    repo.decideWish(w, bought)
                    Notifications.cancel(context, Notifications.ID_WISH_BASE + w.id.toInt())
                    val s = repo.settingsStore.current()
                    if (!bought) Notifications.showConfirmation(context, "وفّرت ${Money.format(w.amount, s.currency)} 💪", "قرار ذكي! هذا هو معنى «وَفْر».", null)
                }
            }
            ACTION_UNDO -> {
                val id = intent.getLongExtra(EXTRA_EXPENSE_ID, -1)
                repo.expenseById(id)?.let { repo.deleteExpense(it) }
                Notifications.cancel(context, Notifications.ID_CONFIRM)
            }
        }
    }
}
