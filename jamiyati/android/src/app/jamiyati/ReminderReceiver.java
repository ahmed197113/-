package app.jamiyati;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** يعرض التذكير عند حلول موعده، ويعيد الجدولة بعد إعادة تشغيل الجهاز أو تحديث التطبيق */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Reminders.rearm(c);
            return;
        }
        String id = intent.getStringExtra("id");
        Reminders.show(c, id == null ? 0 : id.hashCode(), intent.getStringExtra("title"), intent.getStringExtra("body"));
    }
}
