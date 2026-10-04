package com.sahwa.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Rings on the alarm stream until the web UI reports the missions are done.
 * Sticky: if the system kills it, it comes back and rings again.
 */
public class AlarmService extends Service {
    static final String ACTION_RING = "com.sahwa.alarm.RING";
    static final String ACTION_STOP = "com.sahwa.alarm.STOP";
    private static final String CHANNEL = "alarm";
    private static final long VOICE_SWITCH_MS = 25_000;

    static volatile boolean ringing = false;

    private volatile boolean run = false;
    private Thread player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_RING : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopRinging();
            stopSelf();
            return START_NOT_STICKY;
        }
        goForeground();
        if (!run) startRinging();
        return START_STICKY;
    }

    private void goForeground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "المنبه", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);

        Intent open = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 3, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("صحوة: قم الآن")
                .setContentText("المنبه لن يسكت حتى تُكمل المهام")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(1, n);
        }
        try { startActivity(open); } catch (Exception ignored) { /* background launch may be blocked; the full-screen intent covers it */ }
    }

    private void startRinging() {
        run = true;
        ringing = true;
        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sahwa:ring");
        wakeLock.acquire(60 * 60 * 1000L);

        vibrator = getSystemService(Vibrator.class);
        if (vibrator != null && vibrator.hasVibrator()) {
            AudioAttributes va = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
            vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 600, 200, 600, 300}, 0), va);
        }

        player = new Thread(this::playLoop, "sahwa-alarm");
        player.start();
    }

    private void playLoop() {
        int min = AudioTrack.getMinBufferSize(Voices.SR, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                .setAudioFormat(new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(Voices.SR)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build())
                .setBufferSizeInBytes(min * 4)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
        track.play();

        AudioManager am = getSystemService(AudioManager.class);
        Random rnd = new Random();
        // A fresh voice order each time, never opening with the last opener.
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < Voices.COUNT; i++) order.add(i);
        Collections.shuffle(order, rnd);
        if (order.get(0) == Prefs.lastVoice(this)) Collections.rotate(order, -1);
        Prefs.lastVoice(this, order.get(0));
        float pitch = 0.85f + rnd.nextFloat() * 0.35f;
        long start = System.currentTimeMillis();

        while (run) {
            try { // keep the alarm volume pinned at max, even if the user turns it down
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            } catch (SecurityException ignored) { /* Do Not Disturb policy */ }
            long t = System.currentTimeMillis() - start;
            int voice = order.get((int) ((t / VOICE_SWITCH_MS) % order.size()));
            float gain = Math.min(1f, 0.45f + t / 30_000f * 0.55f);
            short[] beat = Voices.render(voice, pitch, gain, rnd);
            track.write(beat, 0, beat.length);
        }
        track.pause();
        track.flush();
        track.release();
    }

    private void stopRinging() {
        run = false;
        ringing = false;
        if (player != null) {
            try { player.join(1500); } catch (InterruptedException ignored) { }
            player = null;
        }
        if (vibrator != null) vibrator.cancel();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    @Override
    public void onDestroy() {
        if (run) stopRinging();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    static void ring(Context c) {
        androidx.core.content.ContextCompat.startForegroundService(c, new Intent(c, AlarmService.class).setAction(ACTION_RING));
    }

    static void stop(Context c) {
        c.startService(new Intent(c, AlarmService.class).setAction(ACTION_STOP));
    }
}
