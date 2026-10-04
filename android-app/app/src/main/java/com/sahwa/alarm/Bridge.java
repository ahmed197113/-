package com.sahwa.alarm;

import android.webkit.JavascriptInterface;

/** Exposed to the web UI as window.SahwaNative. */
final class Bridge {
    private final MainActivity a;

    Bridge(MainActivity a) { this.a = a; }

    @JavascriptInterface
    public void schedule(double atMs) {
        long at = (long) atMs;
        Prefs.alarmAt(a, at);
        AlarmScheduler.set(a, at, AlarmScheduler.MAIN);
    }

    @JavascriptInterface
    public void cancel() {
        Prefs.alarmAt(a, 0);
        AlarmScheduler.cancel(a, AlarmScheduler.MAIN);
    }

    @JavascriptInterface
    public void startRing() { AlarmService.ring(a); }

    @JavascriptInterface
    public void stopRing() { if (AlarmService.ringing) AlarmService.stop(a); }

    @JavascriptInterface
    public void setGuard(boolean on) {
        Prefs.guard(a, on);
        if (!on) AlarmScheduler.cancel(a, AlarmScheduler.ESCAPE);
    }

    @JavascriptInterface
    public boolean isRinging() { return AlarmService.ringing; }
}
