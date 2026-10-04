package com.mizan.budget.notify

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import com.mizan.budget.MainActivity
import com.mizan.budget.QuickAddActivity
import com.mizan.budget.R
import com.mizan.budget.data.Expense
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Money
import com.mizan.budget.domain.Snapshot

object Notifications {
    const val CH_CHECKIN = "checkin"
    const val CH_STATUS = "status"
    const val CH_CONFIRM = "confirm"

    const val ID_CHECKIN = 1001
    const val ID_STATUS = 1002
    const val ID_CONFIRM = 1003

    const val KEY_ENTRY = "entry"

    private const val ACCENT = 0xFF2EE6A6.toInt()

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(
            listOf(
                NotificationChannel(CH_CHECKIN, "تذكير: هل صرفت شيئاً؟", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "سؤال دوري لتسجيل مصاريفك قبل أن تنساها"
                },
                NotificationChannel(CH_STATUS, "رصيدك في ستارة الإشعارات", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "إشعار ثابت يعرض المتبقي لك اليوم مع إضافة سريعة"
                    setShowBadge(false)
                },
                NotificationChannel(CH_CONFIRM, "تأكيد التسجيل", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "تأكيد بعد تسجيل مصروف من الإشعار"
                    setSound(null, null)
                },
            )
        )
    }

    fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun post(context: Context, id: Int, n: Notification) {
        if (!canPost(context)) return
        try {
            NotificationManagerCompat.from(context).notify(id, n)
        } catch (_: SecurityException) {
        }
    }

    fun cancel(context: Context, id: Int) = NotificationManagerCompat.from(context).cancel(id)

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context, 10, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun quickAdd(context: Context, need: Boolean?, request: Int): PendingIntent = PendingIntent.getActivity(
        context, request, QuickAddActivity.intent(context, need, Expense.Source.NOTIFICATION),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** An action with an inline text box: the user types "25 قهوة" without opening the app. */
    private fun replyAction(context: Context, need: Boolean, origin: Int, label: String): NotificationCompat.Action {
        val intent = Intent(context, ActionReceiver::class.java)
            .setAction(ActionReceiver.ACTION_ENTRY)
            .putExtra(ActionReceiver.EXTRA_NEED, need)
            .putExtra(ActionReceiver.EXTRA_ORIGIN, origin)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        val pi = PendingIntent.getBroadcast(context, origin * 10 + if (need) 1 else 2, intent, flags)
        val input = RemoteInput.Builder(KEY_ENTRY)
            .setLabel("المبلغ ووصف قصير — مثال: 25 قهوة")
            .build()
        return NotificationCompat.Action.Builder(R.drawable.ic_add, label, pi)
            .addRemoteInput(input)
            .setAllowGeneratedReplies(false)
            .build()
    }

    private fun broadcast(context: Context, action: String, request: Int, extra: (Intent) -> Unit = {}): PendingIntent =
        PendingIntent.getBroadcast(
            context, request, Intent(context, ActionReceiver::class.java).setAction(action).also(extra),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private val prompts = listOf(
        "هل صرفت شيئاً؟ 💭" to "مرّت بضع ساعات. سجّل أي مصروف الآن قبل أن تنساه — ثانيتان فقط.",
        "لحظة محاسبة سريعة ⚖️" to "أي مشتريات منذ آخر مرة؟ اكتب المبلغ هنا مباشرة.",
        "ميزاني يسأل 👀" to "قهوة؟ بنزين؟ توصيل؟ سجّلها الآن وحدد: ضروري أم كمالي؟",
        "تذكير لطيف 🌿" to "ما لا يُسجَّل لا يُدار. هل صرفت شيئاً خلال الساعات الماضية؟",
    )

    fun showCheckIn(context: Context, snap: Snapshot, hours: Int) {
        val (title, base) = prompts[((System.currentTimeMillis() / 3_600_000) % prompts.size).toInt()]
        val status = when {
            !snap.hasBudget -> "صرفت اليوم ${snap.money(snap.spentToday)}"
            snap.safeToday >= 0 -> "باقي لك اليوم ${snap.money(snap.safeToday)}"
            else -> "تجاوزت حد اليوم بـ ${snap.money(-snap.safeToday)}"
        }
        val body = "$base\n$status"
        val n = NotificationCompat.Builder(context, CH_CHECKIN)
            .setSmallIcon(R.drawable.ic_stat_mizani)
            .setColor(ACCENT)
            .setContentTitle(title)
            .setContentText(status)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSubText("كل $hours ساعات")
            .setContentIntent(quickAdd(context, null, 20))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addAction(replyAction(context, need = true, origin = ID_CHECKIN, label = "ضروري ✍️"))
            .addAction(replyAction(context, need = false, origin = ID_CHECKIN, label = "كمالي ✍️"))
            .addAction(R.drawable.ic_check, "لم أصرف ✓", broadcast(context, ActionReceiver.ACTION_NONE, 30))
            .build()
        post(context, ID_CHECKIN, n)
    }

    fun showStatus(context: Context, snap: Snapshot, settings: Settings) {
        if (!settings.statusNotification || !settings.onboarded) {
            cancel(context, ID_STATUS); return
        }
        val title = when {
            !snap.hasBudget -> "صرفت اليوم ${snap.money(snap.spentToday)}"
            snap.safeToday >= 0 -> "باقي لك اليوم ${snap.money(snap.safeToday)}"
            else -> "تجاوزت حد اليوم بـ ${snap.money(-snap.safeToday)}"
        }
        val text = if (snap.hasBudget)
            "المتبقي للدورة ${Money.compact(snap.remaining, snap.currency)} • ${snap.daysLeft} يوم"
        else "هذه الدورة ${snap.money(snap.spent)}"
        val progress = (snap.usedFraction.coerceIn(0f, 1f) * 100).toInt()
        val n = NotificationCompat.Builder(context, CH_STATUS)
            .setSmallIcon(R.drawable.ic_stat_mizani)
            .setColor(ACCENT)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(openApp(context))
            .apply { if (snap.hasBudget) setProgress(100, progress, false) }
            .addAction(replyAction(context, need = true, origin = ID_STATUS, label = "+ ضروري"))
            .addAction(replyAction(context, need = false, origin = ID_STATUS, label = "+ كمالي"))
            .addAction(R.drawable.ic_add, "تفاصيل", quickAdd(context, null, 21))
            .build()
        post(context, ID_STATUS, n)
    }

    fun showConfirmation(context: Context, title: String, text: String, undoId: Long?) {
        val n = NotificationCompat.Builder(context, CH_CONFIRM)
            .setSmallIcon(R.drawable.ic_stat_mizani)
            .setColor(ACCENT)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setTimeoutAfter(15_000)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp(context))
            .apply {
                if (undoId != null) addAction(
                    R.drawable.ic_undo, "تراجع",
                    broadcast(context, ActionReceiver.ACTION_UNDO, 40) { it.putExtra(ActionReceiver.EXTRA_EXPENSE_ID, undoId) },
                )
            }
            .build()
        post(context, ID_CONFIRM, n)
    }

    /** Re-posts the check-in with an error so the inline reply spinner stops. */
    fun showParseError(context: Context, origin: Int, need: Boolean) {
        val n = NotificationCompat.Builder(context, CH_CONFIRM)
            .setSmallIcon(R.drawable.ic_stat_mizani)
            .setColor(ACCENT)
            .setContentTitle("لم أفهم المبلغ 🤔")
            .setContentText("اكتب رقماً ثم وصفاً، مثال: 25 قهوة")
            .setAutoCancel(true)
            .addAction(replyAction(context, need, origin, "حاول مجدداً ✍️"))
            .build()
        post(context, if (origin == ID_STATUS) ID_CONFIRM else origin, n)
    }
}
