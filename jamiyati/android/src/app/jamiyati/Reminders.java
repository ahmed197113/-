package app.jamiyati;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * التذكيرات المجدولة: تحسبها الواجهة (قبل 3 أيام، يوم الاستحقاق، بعد التأخير، يوم الدور، ملخص المنظم)
 * وتُسلَّم هنا لتُجدول في AlarmManager فتصل حتى والتطبيق مغلق، وتُعاد جدولتها بعد إعادة تشغيل الجهاز.
 */
final class Reminders {
    static final String CHANNEL = "reminders";
    static final String PREFS = "jamiyati";
    static final String KEY = "scheduled";

    private Reminders() {}

    static boolean enabled(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "تذكيرات الجمعيات", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("مواعيد الأقساط والاستلام وإثباتات الدفع");
        nm.createNotificationChannel(ch);
    }

    static void show(Context c, int id, String title, String body) {
        if (!enabled(c)) return;
        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = c.getResources().getIdentifier("ic_stat", "drawable", c.getPackageName());
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(icon != 0 ? icon : c.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setColor(0xFF0F766E)
                .setAutoCancel(true)
                .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(id, b.build());
    }

    private static PendingIntent alarmIntent(Context c, String id, String title, String body) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("app.jamiyati.REMINDER");
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** يلغي الجدولة السابقة ويجدول القائمة الجديدة */
    static synchronized void schedule(Context c, String json) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray old = new JSONArray(p.getString(KEY, "[]"));
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                am.cancel(alarmIntent(c, o.getString("id"), o.optString("title"), o.optString("body")));
            }
        } catch (Exception ignored) {
        }
        p.edit().putString(KEY, json).apply();
        arm(c, json);
    }

    static void arm(Context c, String json) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        try {
            JSONArray arr = new JSONArray(json);
            for (int k = 0; k < arr.length(); k++) {
                JSONObject o = arr.getJSONObject(k);
                long at = o.getLong("at");
                if (at <= now) continue;
                PendingIntent pi = alarmIntent(c, o.getString("id"), o.getString("title"), o.getString("body"));
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception ignored) {
        }
    }

    static void rearm(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        arm(c, p.getString(KEY, "[]"));
    }
}
