package com.munasaba.munasaba

import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Hosts the `app.munasaba/share` channel for one-tap sharing straight into
 * WhatsApp (Status picker), Snapchat, Instagram Stories and TikTok.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "app.munasaba/share")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "shareToApp" -> {
                        val path = call.argument<String>("path")
                        val pkg = call.argument<String>("package")
                        val story = call.argument<Boolean>("story") ?: false
                        val text = call.argument<String>("text") ?: ""
                        if (path == null || pkg == null) {
                            result.error("bad_args", "path and package are required", null)
                        } else {
                            result.success(shareToApp(File(path), pkg, story, text))
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun shareToApp(file: File, pkg: String, story: Boolean, text: String): Boolean {
        if (!file.exists()) return false
        if (packageManager.getLaunchIntentForPackage(pkg) == null) return false
        val uri = FileProvider.getUriForFile(this, "$packageName.munasaba.share", file)
        val intent = if (story) {
            Intent("com.instagram.share.ADD_TO_STORY").apply {
                setDataAndType(uri, "image/png")
            }
        } else {
            Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
            }
        }
        intent.setPackage(pkg)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        return try {
            startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }
}
