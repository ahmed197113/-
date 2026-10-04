package com.sahwa.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Intent ring = new Intent(c, AlarmService.class).setAction(AlarmService.ACTION_RING);
        ContextCompat.startForegroundService(c, ring);
    }
}
