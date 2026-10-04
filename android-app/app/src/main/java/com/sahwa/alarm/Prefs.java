package com.sahwa.alarm;

import android.content.Context;
import android.content.SharedPreferences;

/** Small persisted state the native side needs when the web UI is not running. */
final class Prefs {
    private Prefs() {}

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("sahwa", Context.MODE_PRIVATE);
    }

    static long alarmAt(Context c) { return p(c).getLong("alarmAt", 0); }
    static void alarmAt(Context c, long at) { p(c).edit().putLong("alarmAt", at).apply(); }

    /** True while the morning guard runs: leaving the app re-arms the alarm. */
    static boolean guard(Context c) { return p(c).getBoolean("guard", false); }
    static void guard(Context c, boolean on) { p(c).edit().putBoolean("guard", on).apply(); }

    static int lastVoice(Context c) { return p(c).getInt("lastVoice", -1); }
    static void lastVoice(Context c, int v) { p(c).edit().putInt("lastVoice", v).apply(); }

    static boolean asked(Context c, String key) { return p(c).getBoolean("asked." + key, false); }
    static void asked(Context c, String key, boolean v) { p(c).edit().putBoolean("asked." + key, v).apply(); }
}
