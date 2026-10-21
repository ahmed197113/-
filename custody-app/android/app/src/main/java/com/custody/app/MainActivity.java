package com.custody.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
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
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * غلاف WebView للتطبيق. ثلاث طرق تشغيل:
 * local  — النظام كاملاً على الجوال (الملفات من داخل التطبيق والبيانات في IndexedDB)
 * demo   — مثل local ببيانات تجريبية منفصلة
 * server — الاتصال بخادم الشركة لمشاركة البيانات بين المدير والموظفين
 */
public class MainActivity extends Activity {
    static final String PREFS = "custody";
    static final String EXTRA_REMINDER = "reminder";
    /** عنوان وهمي يُخدَم من ملفات التطبيق نفسه */
    static final String LOCAL_ORIGIN = "https://app.local";
    private static final int REQ_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        migratePrefs();
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // تثبيت حجم الخط: لا يتضخم التطبيق مع إعداد حجم خط النظام في الجوال
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " CustodyApp/2");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String server = prefs().getString("server", "");
                if ("file".equals(u.getScheme()) || "app.local".equals(u.getHost()) || (!server.isEmpty() && u.toString().startsWith(server))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"app.local".equals(u.getHost())) return null;
                String path = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
                String ext = path.substring(path.lastIndexOf('.') + 1);
                String mime = ext.equals("html") ? "text/html" : ext.equals("js") ? "text/javascript" : ext.equals("css") ? "text/css"
                        : ext.equals("svg") ? "image/svg+xml" : ext.equals("webmanifest") ? "application/manifest+json" : "application/octet-stream";
                try {
                    return new WebResourceResponse(mime, "utf-8", getAssets().open(path));
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
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

        ReminderScheduler.createChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
        }
        loadStart(getIntent());
    }

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }

    /** نسخة 1.x كانت تحفظ الوضع التجريبي كعنوان خادم */
    private void migratePrefs() {
        SharedPreferences p = prefs();
        if (p.contains("mode")) return;
        String server = p.getString("server", BuildConfig.SERVER_URL);
        if (LOCAL_ORIGIN.equals(server)) p.edit().putString("mode", "demo").putString("server", "").apply();
        else if (server != null && !server.isEmpty()) p.edit().putString("mode", "server").putString("server", server).apply();
    }

    private void loadStart(Intent intent) {
        String mode = prefs().getString("mode", "");
        String answer = intent != null ? intent.getStringExtra(EXTRA_REMINDER) : null;
        String hash = answer != null ? "#/reminder/" + answer : "";
        if ("local".equals(mode) || "demo".equals(mode)) web.loadUrl(LOCAL_ORIGIN + "/?mode=" + mode + hash);
        else if ("server".equals(mode) && !prefs().getString("server", "").isEmpty()) web.loadUrl(prefs().getString("server", "") + "/" + hash);
        else web.loadUrl("file:///android_asset/setup.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String answer = intent.getStringExtra(EXTRA_REMINDER);
        String url = web.getUrl();
        if (answer == null) return;
        if (url != null && url.startsWith("http")) web.evaluateJavascript("location.hash='#/reminder/" + answer + "'", null);
        else loadStart(intent);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    // ---------- إرفاق صور الفواتير (كاميرا / معرض / PDF، مع تعدد الملفات) ----------
    private boolean openFileChooser(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = cb;
        Intent pick = params.createIntent();
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        Intent chooser = Intent.createChooser(pick, "إرفاق صورة الفاتورة");
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
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) result = new Uri[]{data.getData()};
        }
        boolean usedCamera = resultCode == RESULT_OK && result == null && cameraUri != null;
        if (usedCamera) result = new Uri[]{cameraUri};
        else if (cameraUri != null) getContentResolver().delete(cameraUri, null, null);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    // ---------- حفظ ملفات Excel والنسخ الاحتياطية في مجلد التنزيلات ----------
    private void saveFile(String name, String mime, String base64) {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        try {
            Uri uri;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, name);
                try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                runOnUiThread(() -> Toast.makeText(this, "تم الحفظ في: " + f.getAbsolutePath(), Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> Toast.makeText(this, "تم الحفظ في مجلد التنزيلات: " + name, Toast.LENGTH_LONG).show());
            Intent open = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try { startActivity(Intent.createChooser(open, "فتح " + name)); } catch (Exception ignored) { }
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(this, "تعذر حفظ الملف: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    /** الدوال المتاحة لصفحة الويب عبر window.AndroidBridge */
    class Bridge {
        @JavascriptInterface
        public String getServer() { return prefs().getString("server", ""); }

        @JavascriptInterface
        public String getMode() { return prefs().getString("mode", ""); }

        @JavascriptInterface
        public void setServer(String url) {
            String clean = url.trim().replaceAll("/+$", "");
            if (!clean.startsWith("http")) clean = "http://" + clean;
            prefs().edit().putString("server", clean).putString("mode", "server").apply();
            runOnUiThread(() -> loadStart(null));
        }

        @JavascriptInterface
        public void startLocal() { prefs().edit().putString("mode", "local").apply(); runOnUiThread(() -> loadStart(null)); }

        @JavascriptInterface
        public void startDemo() { prefs().edit().putString("mode", "demo").apply(); runOnUiThread(() -> loadStart(null)); }

        @JavascriptInterface
        public void changeServer() {
            ReminderScheduler.stop(MainActivity.this);
            prefs().edit().putString("mode", "").apply();
            runOnUiThread(() -> web.loadUrl("file:///android_asset/setup.html"));
        }

        @JavascriptInterface
        public void reload() { runOnUiThread(() -> loadStart(null)); }

        /** يبدأ تنبيهات "هل صرفت شيئاً؟" — config: JSON فيه token و workStart و workEnd و workDays و minutes و local */
        @JavascriptInterface
        public void startReminders(String config) {
            prefs().edit().putString("reminder", config).apply();
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
        public void saveFile(String name, String mime, String base64) { MainActivity.this.saveFile(name, mime, base64); }

        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                pm.print("إدارة العهد", web.createPrintDocumentAdapter("custody"), null);
            });
        }
    }
}
