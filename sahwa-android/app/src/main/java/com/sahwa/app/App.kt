package com.sahwa.app

import android.app.Application
import com.sahwa.app.data.Store

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Store.init(this)
    }
}
