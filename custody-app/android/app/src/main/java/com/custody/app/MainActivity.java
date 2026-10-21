package com.custody.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** غلاف WebView للتطبيق مع جسر JavaScript للتنبيهات الأصلية والطباعة ورفع الصور. */
public class MainActivity extends Activity {
    static final String PREFS = "custody";
    static final String EXTRA_REMINDER = "reminder";
    private static final int REQ_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " CustodyApp/1");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String server = getServer();
                if ("file".equals(u.getScheme()) || (!server.isEmpty() && u.toString().startsWith(server))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                return openFileChooser(cb, params);
            }
        });
        web.setDownloadListener((url, ua, disposition, mime, length) -> download(url, disposition, mime));

        ReminderScheduler.createChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
        }
        loadStart(getIntent());
    }

    private String getServer() {
        String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString("server", null);
        return saved != null ? saved : BuildConfig.SERVER_URL;
    }

    private void loadStart(Intent intent) {
        String server = getServer();
        if (server.isEmpty()) { web.loadUrl("file:///android_asset/setup.html"); return; }
        String answer = intent != null ? intent.getStringExtra(EXTRA_REMINDER) : null;
        web.loadUrl(server + "/" + (answer != null ? "#/reminder/" + answer : ""));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String answer = intent.getStringExtra(EXTRA_REMINDER);
        String url = web.getUrl();
        if (answer == null) return;
        if (url != null && url.startsWith("http")) {
            web.evaluateJavascript("location.hash='#/reminder/" + answer + "'", null);
        } else {
            loadStart(intent);
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    // ---------- رفع صورة الإيصال (من الكاميرا أو المعرض) ----------
    private boolean openFileChooser(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = cb;
        Intent pick = params.createIntent();
        Intent chooser = Intent.createChooser(pick, "صورة الإيصال");
        cameraUri = null;
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, "receipt_" + System.currentTimeMillis() + ".jpg");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            } catch (Exception ignored) { cameraUri = null; }
        }
        try {
            startActivityForResult(chooser, REQ_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        boolean usedCamera = resultCode == RESULT_OK && (result == null || result.length == 0) && cameraUri != null;
        if (usedCamera) result = new Uri[]{cameraUri};
        else if (cameraUri != null) getContentResolver().delete(cameraUri, null, null);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    // ---------- تنزيل ملفات Excel ----------
    private void download(String url, String disposition, String mime) {
        try {
            String name = URLUtil.guessFileName(url, disposition, mime);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                    .setMimeType(mime)
                    .setTitle(name)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            Toast.makeText(this, "جارٍ التنزيل إلى مجلد التنزيلات", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        }
    }

    /** الدوال المتاحة لصفحة الويب عبر window.AndroidBridge */
    class Bridge {
        @JavascriptInterface
        public String getServer() { return MainActivity.this.getServer(); }

        @JavascriptInterface
        public void setServer(String url) {
            String clean = url.trim().replaceAll("/+$", "");
            if (!clean.startsWith("http")) clean = "http://" + clean;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("server", clean).apply();
            runOnUiThread(() -> loadStart(null));
        }

        @JavascriptInterface
        public void changeServer() {
            ReminderScheduler.stop(MainActivity.this);
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("server", "").apply();
            runOnUiThread(() -> web.loadUrl("file:///android_asset/setup.html"));
        }

        @JavascriptInterface
        public void reload() { runOnUiThread(() -> loadStart(null)); }

        /** يبدأ تنبيهات "هل صرفت شيئاً؟" — config: JSON فيه token و workStart و workEnd و workDays و minutes */
        @JavascriptInterface
        public void startReminders(String config) {
            SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            p.edit().putString("reminder", config).apply();
            ReminderScheduler.scheduleNext(MainActivity.this);
        }

        /** يؤجل التنبيه القادم بعد تسجيل مصروف */
        @JavascriptInterface
        public void snooze() { ReminderScheduler.scheduleNext(MainActivity.this); }

        @JavascriptInterface
        public void stopReminders() { ReminderScheduler.stop(MainActivity.this); }

        @JavascriptInterface
        public boolean notificationsEnabled() {
            return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33) runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2));
        }

        @JavascriptInterface
        public void testReminder() { ReminderReceiver.showNotification(MainActivity.this); }

        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                pm.print("كشف العهدة", web.createPrintDocumentAdapter("custody"), null);
            });
        }
    }
}
