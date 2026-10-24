package com.metallines.mawqi;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.List;

/**
 * «المشاريع» — a thin shell around the company site (app.metal-lines.com/m).
 * Everything the user sees comes from the server, so every change on the site
 * reaches the phone immediately with no new APK. The page keeps working offline
 * through its own service worker.
 */
public class MainActivity extends Activity {
    private static final int REQ_FILE = 1, REQ_PERMS = 2;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private WebChromeClient.FileChooserParams pendingParams;
    private PermissionRequest pendingWebPermission;
    private final String home = BuildConfig.APP_URL;
    private final String host = Uri.parse(BuildConfig.APP_URL).getHost();

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(0xFF1E1757);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setGeolocationEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " MawqiApp/2");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (host.equals(u.getHost()) && !isDownload(u)) return false;
                openOutside(u);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                // Only when the whole app cannot load (first run with no internet and nothing cached).
                if (req.isForMainFrame()) view.loadDataWithBaseURL(home, offlinePage(), "text/html", "utf-8", null);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) { super.onPageStarted(view, url, favicon); }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                pendingParams = params;
                if (needPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO})) return true;
                openChooser(params);
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                pendingWebPermission = request;
                if (!needPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO})) {
                    request.grant(request.getResources());
                    pendingWebPermission = null;
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                needPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION});
                callback.invoke(origin, true, false);
            }
        });

        // Excel / PDF downloads open in the phone's browser, which saves them.
        web.setDownloadListener((url, ua, cd, mime, len) -> openOutside(Uri.parse(url)));

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(home);
    }

    private boolean isDownload(Uri u) {
        String p = u.toString();
        return p.contains("format=csv") || p.contains("/api/export/") || p.contains("/api/files/");
    }

    private void openOutside(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
    }

    private boolean needPermissions(String[] perms) {
        if (Build.VERSION.SDK_INT < 23) return false;
        List<String> missing = new ArrayList<>();
        for (String p : perms) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        if (missing.isEmpty()) return false;
        requestPermissions(missing.toArray(new String[0]), REQ_PERMS);
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_PERMS) return;
        if (pendingParams != null && fileCallback != null) openChooser(pendingParams);
        if (pendingWebPermission != null) {
            boolean ok = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            if (ok) pendingWebPermission.grant(pendingWebPermission.getResources()); else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
    }

    /** Camera (photo or video) or gallery, depending on what the page asks for. */
    private void openChooser(WebChromeClient.FileChooserParams params) {
        pendingParams = null;
        String accept = String.join(",", params.getAcceptTypes() == null ? new String[0] : params.getAcceptTypes()).toLowerCase();
        boolean images = accept.isEmpty() || accept.contains("image") || accept.contains("*");
        boolean videos = accept.isEmpty() || accept.contains("video") || accept.contains("*");
        boolean camOk = Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

        List<Intent> cams = new ArrayList<>();
        cameraUri = null;
        if (camOk && images) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, "mawqi_" + System.currentTimeMillis() + ".jpg");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                Intent photo = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                photo.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                photo.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                cams.add(photo);
            } catch (Exception ignored) { cameraUri = null; }
        }
        if (camOk && videos) {
            Intent video = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
            video.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 180);
            cams.add(video);
        }

        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType(images && !videos ? "image/*" : videos && !images ? "video/*" : "*/*");
        if (images && videos) pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

        Intent target;
        if (params.isCaptureEnabled() && !cams.isEmpty()) {
            target = cams.size() == 1 ? cams.get(0) : Intent.createChooser(cams.get(0), "التصوير").putExtra(Intent.EXTRA_INITIAL_INTENTS, cams.subList(1, cams.size()).toArray(new Intent[0]));
        } else {
            target = Intent.createChooser(pick, "اختر صورة أو فيديو");
            target.putExtra(Intent.EXTRA_INITIAL_INTENTS, cams.toArray(new Intent[0]));
        }
        try { startActivityForResult(target, REQ_FILE); }
        catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != REQ_FILE || fileCallback == null) return;
        Uri[] out = null;
        if (result == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                out = new Uri[]{data.getData()};
            } else if (cameraUri != null) {
                out = new Uri[]{cameraUri};
            }
        } else if (cameraUri != null) {
            try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) { }
        }
        fileCallback.onReceiveValue(out);
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    private String offlinePage() {
        return "<!doctype html><html dir='rtl' lang='ar'><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;"
            + "background:#1e1757;color:#fff;font-family:sans-serif;text-align:center;padding:24px}button{background:#c0743f;color:#fff;border:0;"
            + "border-radius:14px;padding:14px 28px;font-size:18px;font-weight:700}p{opacity:.85;line-height:1.7}</style></head><body>"
            + "<h2>لا يوجد اتصال بالإنترنت</h2><p>افتح التطبيق مرة واحدة والإنترنت متاح،<br>وبعدها يعمل بدون إنترنت ويرسل ما سجلته لاحقاً.</p>"
            + "<button onclick=\"location.href='" + home + "'\">إعادة المحاولة</button></body></html>";
    }
}
