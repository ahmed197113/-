package com.timetrade.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#14110d"));
        getWindow().setNavigationBarColor(Color.parseColor("#211c16"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#14110d"));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // لحفظ التقدم في localStorage
        s.setAllowFileAccess(true);
        webView.setWebViewClient(new WebViewClient());
        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // اللعبة تقرر: إغلاق نافذة مفتوحة أو العودة للسوق، وإلا يُغلق التطبيق
        webView.evaluateJavascript(
                "window.onAndroidBack ? window.onAndroidBack() : false",
                handled -> {
                    if (!"true".equals(handled)) finish();
                });
    }
}
