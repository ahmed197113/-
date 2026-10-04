package app.jamiyati;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.StrictMode;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * جمعيتي — غلاف أندرويد أصلي لتطبيق الويب.
 * الواجهة تُخدم من assets/www عبر أصل https وهمي (app.jamiyati.local) ليكون "سياقاً آمناً":
 * يعمل التخزين المحلي وIndexedDB وcrypto.subtle تماماً كما في المتصفح، ودون أي اتصال بالإنترنت.
 */
public class MainActivity extends Activity {
    static final String HOST = "app.jamiyati.local";
    static final String START_URL = "https://" + HOST + "/index.html";
    static final int REQ_FILE = 11;
    static final int REQ_NOTIF = 12;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // مشاركة ملفات file:// على الأجهزة الأقدم من أندرويد 10
        StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder().build());

        web = new WebView(this);
        web.setBackgroundColor(isNight() ? Color.parseColor("#0B1412") : Color.parseColor("#F4F7F6"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " JamiyatiAndroid/" + BuildInfo.VERSION);

        web.addJavascriptInterface(new Bridge(), "JamiyatiNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return serveAsset(u.getPath());
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                String[] types = params.getAcceptTypes();
                if (types != null && types.length > 0 && types[0] != null && types[0].length() > 0) {
                    pick.setType(types[0]);
                }
                try {
                    startActivityForResult(Intent.createChooser(pick, "اختر صورة الإثبات"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("لا يوجد تطبيق لاختيار الصور");
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    private boolean isNight() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    // ───────── خدمة ملفات الواجهة من assets ─────────

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("woff2", "font/woff2");
        MIME.put("woff", "font/woff");
        MIME.put("ico", "image/x-icon");
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/") || path.length() == 0) path = "/index.html";
        String rel = "www" + path;
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache");
        try {
            InputStream in = getAssets().open(rel);
            boolean text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
            return new WebResourceResponse(mime, text ? "UTF-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
        }
    }

    // ───────── التنقل والنتائج ─────────

    void openExternal(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            toast("لا يوجد تطبيق لفتح هذا الرابط");
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    void toast(final String msg) {
        runOnUiThread(new Runnable() {
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("jamiyati", MODE_PRIVATE);
    }

    // ───────── الجسر مع JavaScript (window.JamiyatiNative) ─────────

    class Bridge {
        @JavascriptInterface
        public String appVersion() {
            return BuildInfo.VERSION;
        }

        /** يحفظ الملف في التنزيلات/Jamiyati ويفتح قائمة المشاركة عند الطلب */
        @JavascriptInterface
        public String saveFile(String base64, String filename, String mime, boolean share) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Uri uri;
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver r = getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Jamiyati");
                    uri = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IOException("insert failed");
                    OutputStream os = r.openOutputStream(uri);
                    os.write(bytes);
                    os.close();
                    where = "التنزيلات/Jamiyati";
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Jamiyati");
                    dir.mkdirs();
                    File f = new File(dir, filename);
                    FileOutputStream os = new FileOutputStream(f);
                    os.write(bytes);
                    os.close();
                    uri = Uri.fromFile(f);
                    where = f.getAbsolutePath();
                }
                if (share) {
                    final Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mime);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    runOnUiThread(new Runnable() {
                        public void run() {
                            try {
                                startActivity(Intent.createChooser(send, "مشاركة"));
                            } catch (ActivityNotFoundException ignored) {
                            }
                        }
                    });
                }
                toast("حُفظ الملف في " + where);
                return where;
            } catch (Exception e) {
                toast("تعذر حفظ الملف: " + e.getMessage());
                return "";
            }
        }

        /** طباعة الصفحة أو حفظها PDF عبر خدمة الطباعة في أندرويد */
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(new Runnable() {
                public void run() {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    String name = title == null || title.length() == 0 ? "Jamiyati" : title;
                    PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(name);
                    pm.print(name, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                }
            });
        }

        @JavascriptInterface
        public void notify(String title, String body) {
            Reminders.show(MainActivity.this, (title + body).hashCode(), title, body);
        }

        @JavascriptInterface
        public String notificationPermission() {
            if (!Reminders.enabled(MainActivity.this)) {
                if (Build.VERSION.SDK_INT >= 33 && !prefs().getBoolean("notifAsked", false)) return "default";
                return "denied";
            }
            return "granted";
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(new Runnable() {
                public void run() {
                    if (Build.VERSION.SDK_INT >= 33 && !prefs().getBoolean("notifAsked", false)) {
                        prefs().edit().putBoolean("notifAsked", true).apply();
                        requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
                    } else {
                        // سبق الرفض: نفتح إعدادات الإشعارات للتطبيق
                        Intent i = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
                        i.putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
                        try {
                            startActivity(i);
                        } catch (ActivityNotFoundException ignored) {
                        }
                    }
                }
            });
        }

        /** جدولة التذكيرات في نظام أندرويد لتصل والتطبيق مغلق */
        @JavascriptInterface
        public void scheduleReminders(String json) {
            Reminders.schedule(MainActivity.this, json);
        }

        @JavascriptInterface
        public boolean biometricAvailable() {
            if (Build.VERSION.SDK_INT >= 29) {
                BiometricManager bm = (BiometricManager) getSystemService(Context.BIOMETRIC_SERVICE);
                return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
            }
            return Build.VERSION.SDK_INT == 28 && getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
        }

        @JavascriptInterface
        public void authenticate(final String requestId, final String title) {
            if (Build.VERSION.SDK_INT < 28) {
                bioResult(requestId, false);
                return;
            }
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        BiometricPrompt prompt = new BiometricPrompt.Builder(MainActivity.this)
                                .setTitle(title)
                                .setSubtitle("جمعيتي")
                                .setNegativeButton("إلغاء", getMainExecutor(), new DialogInterface.OnClickListener() {
                                    public void onClick(DialogInterface d, int w) {
                                        bioResult(requestId, false);
                                    }
                                })
                                .build();
                        prompt.authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                bioResult(requestId, true);
                            }

                            @Override
                            public void onAuthenticationError(int code, CharSequence msg) {
                                bioResult(requestId, false);
                            }
                        });
                    } catch (Exception e) {
                        bioResult(requestId, false);
                    }
                }
            });
        }

        @JavascriptInterface
        public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("Jamiyati", text));
        }

        @JavascriptInterface
        public void openExternal(String url) {
            MainActivity.this.openExternal(Uri.parse(url));
        }
    }

    void bioResult(final String id, final boolean ok) {
        runOnUiThread(new Runnable() {
            public void run() {
                String safe = id.replaceAll("[^A-Za-z0-9_-]", "");
                web.evaluateJavascript("window.__jamiyatiBio && window.__jamiyatiBio('" + safe + "'," + ok + ")", null);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
    }
}
