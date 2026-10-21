package com.custody.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;

/** يستقبل منبه التذكير ويعرض الإشعار، ويعالج زر "لا، لم أصرف" دون فتح التطبيق. */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_ALARM = "com.custody.app.REMINDER";
    static final String ACTION_NO = "com.custody.app.ANSWER_NO";
    static final int NOTIFICATION_ID = 1001;

    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        if (ACTION_ALARM.equals(action)) {
            JSONObject cfg = ReminderScheduler.config(c);
            if (cfg != null && ReminderScheduler.inWorkHours(cfg, Calendar.getInstance())) showNotification(c);
            ReminderScheduler.scheduleNext(c);
        } else if (ACTION_NO.equals(action)) {
            c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
            PendingResult pending = goAsync();
            new Thread(() -> {
                postCheckin(c);
                pending.finish();
            }).start();
        }
    }

    static void showNotification(Context c) {
        ReminderScheduler.createChannel(c);
        Intent open = new Intent(c, MainActivity.class).putExtra(MainActivity.EXTRA_REMINDER, "ask")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent yes = new Intent(c, MainActivity.class).putExtra(MainActivity.EXTRA_REMINDER, "yes")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent no = new Intent(c, ReminderReceiver.class).setAction(ACTION_NO);
        int f = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;

        Notification n = new Notification.Builder(c, ReminderScheduler.CHANNEL)
                .setSmallIcon(R.drawable.ic_notify)
                .setColor(Color.parseColor("#0F5C4D"))
                .setContentTitle("🔔 تذكير العهدة")
                .setContentText("هل صرفت شيئاً خلال آخر نصف ساعة؟ ولأي مشروع؟")
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, 10, open, f))
                .addAction(new Notification.Action.Builder(null, "نعم، سأسجل المصروف", PendingIntent.getActivity(c, 11, yes, f)).build())
                .addAction(new Notification.Action.Builder(null, "لا، لم أصرف", PendingIntent.getBroadcast(c, 12, no, f)).build())
                .build();
        try {
            c.getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
        } catch (SecurityException ignored) { /* لم يمنح المستخدم إذن الإشعارات */ }
    }

    /** يرسل "لم أصرف" للخادم ليظهر للمدير في متابعة التنبيهات. */
    private static void postCheckin(Context c) {
        try {
            JSONObject cfg = ReminderScheduler.config(c);
            String server = c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getString("server", BuildConfig.SERVER_URL);
            if (cfg == null || server == null || server.isEmpty()) return;
            HttpURLConnection con = (HttpURLConnection) new URL(server + "/api/checkins").openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(15000);
            con.setReadTimeout(15000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("Authorization", "Bearer " + cfg.optString("token"));
            try (OutputStream os = con.getOutputStream()) {
                os.write("{\"answer\":\"no\"}".getBytes(StandardCharsets.UTF_8));
            }
            con.getResponseCode();
            con.disconnect();
        } catch (Exception ignored) { }
    }
}
