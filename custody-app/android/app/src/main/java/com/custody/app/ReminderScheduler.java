package com.custody.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/** جدولة تنبيه "هل صرفت شيئاً؟" كل فترة محددة خلال ساعات وأيام الدوام فقط. */
final class ReminderScheduler {
    static final String CHANNEL = "custody_reminders";
    private ReminderScheduler() { }

    static void createChannel(Context c) {
        NotificationChannel ch = new NotificationChannel(CHANNEL, "تذكير المصروفات", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("تنبيه دوري خلال الدوام: هل صرفت شيئاً من العهدة؟");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 300, 150, 300});
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    static JSONObject config(Context c) {
        String s = c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getString("reminder", null);
        if (s == null) return null;
        try { return new JSONObject(s); } catch (Exception e) { return null; }
    }

    private static int toMin(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }

    private static boolean isWorkDay(JSONObject cfg, Calendar c) {
        JSONArray days = cfg.optJSONArray("workDays");
        if (days == null) return true;
        int jsDay = c.get(Calendar.DAY_OF_WEEK) - 1; // الأحد = 0 كما في JavaScript
        for (int i = 0; i < days.length(); i++) if (days.optInt(i) == jsDay) return true;
        return false;
    }

    static boolean inWorkHours(JSONObject cfg, Calendar c) {
        int m = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
        return isWorkDay(cfg, c) && m >= toMin(cfg.optString("workStart", "08:00")) && m <= toMin(cfg.optString("workEnd", "17:00"));
    }

    /** وقت التنبيه القادم: بعد الفترة المحددة إن كان داخل الدوام، وإلا بعد بداية أقرب يوم عمل بفترة واحدة. */
    static long nextTrigger(JSONObject cfg, long from) {
        long interval = Math.max(5, cfg.optInt("minutes", 30)) * 60_000L;
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(from + interval);
        if (inWorkHours(cfg, c)) return c.getTimeInMillis();
        int start = toMin(cfg.optString("workStart", "08:00"));
        for (int i = 0; i < 8; i++) {
            Calendar d = Calendar.getInstance();
            d.setTimeInMillis(from);
            d.add(Calendar.DAY_OF_YEAR, i);
            d.set(Calendar.HOUR_OF_DAY, start / 60);
            d.set(Calendar.MINUTE, start % 60);
            d.set(Calendar.SECOND, 0);
            d.set(Calendar.MILLISECOND, 0);
            long t = d.getTimeInMillis() + interval;
            if (d.getTimeInMillis() > from && isWorkDay(cfg, d)) return t;
        }
        return -1;
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ReminderReceiver.ACTION_ALARM);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void scheduleNext(Context c) {
        JSONObject cfg = config(c);
        if (cfg == null) return;
        long at = nextTrigger(cfg, System.currentTimeMillis());
        if (at < 0) return;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = alarmIntent(c);
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void stop(Context c) {
        c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).edit().remove("reminder").apply();
        c.getSystemService(AlarmManager.class).cancel(alarmIntent(c));
        c.getSystemService(NotificationManager.class).cancel(ReminderReceiver.NOTIFICATION_ID);
    }
}
