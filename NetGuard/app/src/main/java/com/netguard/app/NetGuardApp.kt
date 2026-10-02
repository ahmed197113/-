package com.netguard.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.netguard.app.network.OuiLookup

class NetGuardApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createChannels()
        OuiLookup.warmUp(this)
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CH_ALERT, "تنبيهات الأجهزة", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "تنبيه عند دخول جهاز جديد للشبكة" }
            )
            nm.createNotificationChannel(
                NotificationChannel(CH_MONITOR, "المراقبة المستمرة", NotificationManager.IMPORTANCE_LOW)
                    .apply { description = "إشعار المراقبة في الخلفية" }
            )
        }
    }

    companion object {
        const val CH_ALERT = "alerts"
        const val CH_MONITOR = "monitor"
    }
}
