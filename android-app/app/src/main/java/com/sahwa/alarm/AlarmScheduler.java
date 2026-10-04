package com.sahwa.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Exact alarms through the system alarm clock: they fire in Doze, with the app closed. */
final class AlarmScheduler {
    static final int MAIN = 1;
    /** Fires one minute after the user leaves the app during the morning guard. */
    static final int ESCAPE = 2;

    private AlarmScheduler() {}

    private static PendingIntent operation(Context c, int code) {
        Intent i = new Intent(c, AlarmReceiver.class).putExtra("code", code);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void set(Context c, long at, int code) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent op = operation(c, code);
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, op);
            return;
        }
        Intent show = new Intent(c, MainActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(c, 10 + code, show, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), op);
    }

    static void cancel(Context c, int code) {
        c.getSystemService(AlarmManager.class).cancel(operation(c, code));
    }
}
