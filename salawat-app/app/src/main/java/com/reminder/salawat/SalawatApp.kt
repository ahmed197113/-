package com.reminder.salawat

import android.app.Application

class SalawatApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        PrayerRefreshWorker.ensurePeriodic(this)
    }
}
