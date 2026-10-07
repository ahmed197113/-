package app.barr

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Shows over the lock screen ONLY when opened by a medication alarm
 * (full-screen notification), so caregiver data is never exposed on a
 * locked phone. Flutter calls `release` when the alarm screen closes.
 */
class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLockScreen(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        applyLockScreen(intent)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "barr/lockscreen")
            .setMethodCallHandler { call, result ->
                if (call.method == "release") {
                    setShowOverLockScreen(false)
                    result.success(null)
                } else {
                    result.notImplemented()
                }
            }
    }

    private fun applyLockScreen(intent: Intent?) {
        setShowOverLockScreen(intent?.action == "SELECT_NOTIFICATION")
    }

    @Suppress("DEPRECATION")
    private fun setShowOverLockScreen(show: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show)
            setTurnScreenOn(show)
        } else {
            val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (show) window.addFlags(flags) else window.clearFlags(flags)
        }
    }
}
