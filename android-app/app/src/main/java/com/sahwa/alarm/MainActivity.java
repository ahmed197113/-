package com.sahwa.alarm;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/sahwa.html";
    private static final int REQ_CAMERA = 7;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri photoUri;
    /** Camera is open on our behalf: leaving the app is not an escape. */
    private boolean inCamera = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Served from a secure origin so localStorage, Web Audio and motion sensors all work.
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (HOST.equals(req.getUrl().getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                return openCamera(cb);
            }
        });

        web.addJavascriptInterface(new Bridge(this), "SahwaNative");
        if (state == null) web.loadUrl(START_URL); else web.restoreState(state);
        askPermissions();
    }

    /** Proof photos always come from the camera, never the gallery. */
    private boolean openCamera(ValueCallback<Uri[]> cb) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = cb;
        try {
            File dir = new File(getCacheDir(), "shots");
            if (!dir.exists()) dir.mkdirs();
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            File shot = new File(dir, "shot_" + System.currentTimeMillis() + ".jpg");
            photoUri = FileProvider.getUriForFile(this, getPackageName() + ".files", shot);
            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    .putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            inCamera = true;
            startActivityForResult(cam, REQ_CAMERA);
            return true;
        } catch (Exception e) {
            inCamera = false;
            fileCallback = null;
            cb.onReceiveValue(null);
            Toast.makeText(this, "تعذر فتح الكاميرا", Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req != REQ_CAMERA) return;
        inCamera = false;
        if (fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && photoUri != null ? new Uri[]{photoUri} : null);
            fileCallback = null;
        }
    }

    private void askPermissions() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        if (Build.VERSION.SDK_INT >= 34 && !Prefs.asked(this, "fsi")) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (!nm.canUseFullScreenIntent()) {
                Prefs.asked(this, "fsi", true);
                Toast.makeText(this, "فعّل \"إشعارات ملء الشاشة\" ليظهر المنبه فوق شاشة القفل", Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) { }
            }
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        AlarmScheduler.cancel(this, AlarmScheduler.ESCAPE);
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Left the app during the morning guard: ring again in a minute unless they come back.
        if (Prefs.guard(this) && !inCamera && !isChangingConfigurations()) {
            AlarmScheduler.set(this, System.currentTimeMillis() + 60_000, AlarmScheduler.ESCAPE);
        }
    }

    @Override
    public void onBackPressed() {
        if (Prefs.guard(this) || AlarmService.ringing) {
            Toast.makeText(this, "لا رجوع قبل أن تُكمل صباحك", Toast.LENGTH_SHORT).show();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
