package com.sahwa.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import com.sahwa.app.data.Store
import com.sahwa.app.ui.SahwaRoot
import com.sahwa.app.ui.Tab

class MainActivity : ComponentActivity() {

    private val tab = mutableStateOf(Tab.HOME)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(this)
        handleIntent(intent)
        setContent { SahwaRoot(tab) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.getStringExtra(EXTRA_TAB) == TAB_RESCUE) tab.value = Tab.RESCUE
    }

    companion object {
        const val EXTRA_TAB = "tab"
        const val TAB_RESCUE = "rescue"
    }
}
