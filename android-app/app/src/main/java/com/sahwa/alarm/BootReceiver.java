package com.sahwa.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms do not survive a reboot; put the pending one back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        long at = Prefs.alarmAt(c), now = System.currentTimeMillis();
        if (at > now) {
            AlarmScheduler.set(c, at, AlarmScheduler.MAIN);
        } else if (at > 0 || Prefs.guard(c)) {
            // The morning was left unfinished across a restart: ring now.
            AlarmScheduler.set(c, now + 30_000, AlarmScheduler.MAIN);
        }
    }
}
