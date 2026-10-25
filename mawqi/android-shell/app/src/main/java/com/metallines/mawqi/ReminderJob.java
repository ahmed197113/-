package com.metallines.mawqi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Daily attendance reminder: every half hour the phone asks the server which of the user's sites
 * have no attendance yet today, and shows a notification until it is recorded (at most once an hour).
 */
public class ReminderJob extends JobService {
    static final String PREFS = "mawqi";
    private static final int JOB_ID = 7101;
    private static final String CHANNEL = "attendance";

    /** Called when the user signs in (or the app opens signed in). */
    static void schedule(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB_ID) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, ReminderJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(30 * 60 * 1000L)
            .setPersisted(true)
            .build());
    }

    static void cancel(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try { check(); } catch (Exception ignored) { }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }

    private void check() throws Exception {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        String server = p.getString("server", ""), token = p.getString("token", "");
        if (server.isEmpty() || token.isEmpty()) return;
        long last = p.getLong("lastNotified", 0);
        if (System.currentTimeMillis() - last < 55 * 60 * 1000L) return;

        HttpURLConnection con = (HttpURLConnection) new URL(server + "/api/attendance/reminders?_=" + System.currentTimeMillis()).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(15000);
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setRequestProperty("Accept", "application/json");
        if (con.getResponseCode() != 200) return;
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        JSONArray due = new JSONObject(sb.toString()).optJSONArray("due");
        if (due == null || due.length() == 0) return;

        StringBuilder names = new StringBuilder();
        for (int i = 0; i < due.length(); i++) {
            if (i > 0) names.append("، ");
            names.append(due.getJSONObject(i).optString("name"));
        }
        int first = due.getJSONObject(0).optInt("id");
        notify("لم يُسجَّل حضور اليوم", "سجّل حضور العمال في: " + names, first);
        p.edit().putLong("lastNotified", System.currentTimeMillis()).apply();
    }

    private void notify(String title, String text, int projectId) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "تذكير الحضور اليومي", NotificationManager.IMPORTANCE_HIGH));
        }
        Intent open = new Intent(this, MainActivity.class)
            .putExtra("open", "attendance?project=" + projectId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pi);
        nm.notify(42, b.build());
    }
}
