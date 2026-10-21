package com.custody.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** يعيد جدولة التنبيهات بعد إعادة تشغيل الجوال أو تحديث التطبيق. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        ReminderScheduler.scheduleNext(c);
    }
}
