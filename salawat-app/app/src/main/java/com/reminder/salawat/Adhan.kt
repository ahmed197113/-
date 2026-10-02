package com.reminder.salawat

import android.app.PendingIntent
import android.app.Service
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class AdhanSound(val id: String, val name: String, val archiveUrl: String = "", val fajr: Boolean = false)

object AdhanCatalog {
    /** Play only the regular notification sound. */
    const val NOTIFICATION_ONLY = "notification"
    /** A sound file the user picked from the phone. */
    const val CUSTOM = "custom"
    /** Fajr slot only: use the same adhan as the other prayers. */
    const val SAME_AS_OTHERS = "same"
    /** Shipped inside the APK so the adhan works right after installing. */
    const val BUNDLED = "nooman_madinah"

    private const val RELEASE_BASE = "https://github.com/ahmed197113/-/releases/download/salawat-adhan-v1/"
    private const val ARCHIVE = "https://archive.org/download/"

    val ALL = listOf(
        AdhanSound("mulla_makkah", "الحرم المكي — الشيخ علي أحمد ملا", ARCHIVE + "adan-madeenah-nu3man/adan-mullah-al7aram-1414.mp3"),
        AdhanSound("farooq_makkah", "الحرم المكي — الشيخ فاروق حضراوي", ARCHIVE + "adan-madeenah-nu3man/makkah-farooq.mp3"),
        AdhanSound(BUNDLED, "الحرم النبوي (المدينة المنورة) ١"),
        AdhanSound("madinah2", "الحرم النبوي (المدينة المنورة) ٢", ARCHIVE + "adhan-mp3-collection/adhan-al-haram-al-madani-al-madinah-1.mp3"),
        AdhanSound("minshawi", "الشيخ محمد صديق المنشاوي", ARCHIVE + "SalatTimesMP3Adhan/Adhans_mp3_files/Adhan/menshawi_rast.mp3"),
        AdhanSound("abdulbasit", "الشيخ عبد الباسط عبد الصمد", ARCHIVE + "adhan-mp3-collection/abdulbasit-abdusamad-1-egypt.mp3"),
        AdhanSound("husary", "الشيخ محمود خليل الحصري", ARCHIVE + "adan-madeenah-nu3man/adan-al7usary.mp3"),
        AdhanSound("shuaisha", "الشيخ أبو العينين شعيشع", ARCHIVE + "adhan-mp3-collection/abul-ainain-shuaisha-cairo.mp3"),
        AdhanSound("alafasy", "الشيخ مشاري راشد العفاسي", ARCHIVE + "AdhanMisharyRashid/Adhan%20Mishary%20Rashid.mp3"),
        AdhanSound("qatami", "الشيخ ناصر القطامي", ARCHIVE + "SalatTimesMP3Adhan/Adhans_mp3_files/Adhan/naser_qotami2.mp3"),
        AdhanSound("aqsa", "المسجد الأقصى المبارك", ARCHIVE + "adhan-mp3-collection/adhan-al-aqsa-jerusalem.mp3"),
        AdhanSound("fajr_makkah", "أذان الفجر — الحرم المكي", ARCHIVE + "adhan-mp3-collection/adhan-fajr-al-haram-al-maki.mp3", fajr = true),
        AdhanSound("fajr_madinah", "أذان الفجر — الحرم النبوي", ARCHIVE + "adhan-mp3-collection/adhan-fajr-al-haram-al-madani.mp3", fajr = true),
        AdhanSound("fajr_abdulbasit", "أذان الفجر — الشيخ عبد الباسط عبد الصمد", ARCHIVE + "adhan-mp3-collection/abdulbasit-abdusamad-7-fajr-egypt.mp3", fajr = true),
        AdhanSound("fajr_alafasy", "أذان الفجر — الشيخ مشاري العفاسي", ARCHIVE + "SalatTimesMP3Adhan/Adhans_mp3_files/Adhan/afasi_sobh_hejaz.mp3", fajr = true)
    )

    fun byId(id: String) = ALL.firstOrNull { it.id == id }

    fun file(context: Context, id: String) = File(File(context.filesDir, "adhan"), "$id.mp3")

    fun isAvailable(context: Context, id: String): Boolean = when (id) {
        BUNDLED, NOTIFICATION_ONLY, SAME_AS_OTHERS -> true
        CUSTOM -> Prefs.get(context).getString(Prefs.KEY_ADHAN_CUSTOM_URI, null) != null
        else -> file(context, id).exists()
    }

    fun selectedId(context: Context, fajrSlot: Boolean): String {
        val prefs = Prefs.get(context)
        return if (fajrSlot) prefs.getString(Prefs.KEY_ADHAN_FAJR, SAME_AS_OTHERS) ?: SAME_AS_OTHERS
        else prefs.getString(Prefs.KEY_ADHAN, BUNDLED) ?: BUNDLED
    }

    /** The adhan to play for [prayer], or null when only a notification sound should be used. */
    fun sourceFor(context: Context, prayer: Prayer): Uri? = uriFor(context, resolvedId(context, prayer))

    /** The adhan actually used for [prayer] (after "same as others" and availability fallbacks). */
    fun resolvedId(context: Context, prayer: Prayer): String {
        var id = selectedId(context, fajrSlot = prayer == Prayer.FAJR)
        if (id == SAME_AS_OTHERS) id = selectedId(context, fajrSlot = false)
        if (!isAvailable(context, id)) id = BUNDLED
        return id
    }

    /**
     * Where the opening "Allahu akbar, Allahu akbar" ends in each recording (ms) — the first pause after at least
     * five seconds of voice, measured from the audio's loudness envelope. Recordings without a clear pause, and
     * the user's own file, stop at [TAKBIR_DEFAULT_MS] with a fade.
     */
    private val TAKBIR_END_MS = mapOf(
        "abdulbasit" to 10900, "alafasy" to 18850, "aqsa" to 11050, "fajr_abdulbasit" to 5950, "fajr_madinah" to 16500,
        "fajr_makkah" to 11300, "farooq_makkah" to 7300, "husary" to 12450, "madinah2" to 10250, "minshawi" to 12200,
        "nooman_madinah" to 7150, "qatami" to 10750, "shuaisha" to 20500
    )
    private const val TAKBIR_DEFAULT_MS = 10000

    fun takbirEndMs(id: String): Int = TAKBIR_END_MS[id] ?: TAKBIR_DEFAULT_MS

    fun uriFor(context: Context, id: String): Uri? = when (id) {
        NOTIFICATION_ONLY, SAME_AS_OTHERS -> null
        BUNDLED -> Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${R.raw.adhan_default}")
        CUSTOM -> Prefs.get(context).getString(Prefs.KEY_ADHAN_CUSTOM_URI, null)?.let(Uri::parse)
        else -> file(context, id).takeIf { it.exists() }?.let(Uri::fromFile)
    }

    fun streamUrl(id: String) = RELEASE_BASE + "$id.mp3"

    /** Downloads [sound] (GitHub release first, archive.org as a fallback), reporting 0..100. */
    suspend fun download(context: Context, sound: AdhanSound, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        val target = file(context, sound.id)
        val urls = listOf(streamUrl(sound.id), sound.archiveUrl).filter { it.isNotBlank() }
        var last: Exception? = null
        for (url in urls) {
            try {
                Net.download(url, target, onProgress)
                return@withContext
            } catch (e: Exception) {
                ensureActive()
                last = e
            }
        }
        throw last ?: IOException("download failed")
    }
}

/** Plays the full adhan in a foreground service so it isn't cut off, with a "stop" action. */
class AdhanService : Service() {

    private var player: AudioPlayer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            finish(keepNotification = false)
            return START_NOT_STICKY
        }
        val prayer = intent?.getStringExtra(EXTRA_PRAYER)?.let { runCatching { Prayer.valueOf(it) }.getOrNull() } ?: Prayer.DHUHR
        val uri = intent?.getStringExtra(EXTRA_URI)?.let(Uri::parse) ?: AdhanCatalog.sourceFor(this, prayer)
        val takbirMinutes = intent?.getIntExtra(EXTRA_TAKBIR_MINUTES, -1) ?: -1
        val notification = if (takbirMinutes >= 0) buildTakbirNotification(this, prayer, takbirMinutes) else buildNotification(this, prayer)
        try {
            ServiceCompat.startForeground(
                this, NOTIFICATION_ID, notification,
                if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
            )
        } catch (e: Exception) {
            // Background start refused (e.g. inexact alarm on Android 12+): fall back to a sounding notification.
            postPrayerNotification(this, prayer)
            stopSelf()
            return START_NOT_STICKY
        }
        if (uri == null) {
            finish(keepNotification = true)
            return START_NOT_STICKY
        }
        player?.stop()
        handler.removeCallbacksAndMessages(null)
        val p = AudioPlayer(this, AudioAttributes.USAGE_ALARM) { finish(keepNotification = true) }
        player = p
        p.play(uri)
        if (takbirMinutes >= 0) {
            // Only the opening takbir: fade out over the last 1.2 s, then stop and leave the notice.
            val end = AdhanCatalog.takbirEndMs(AdhanCatalog.resolvedId(this, prayer)).toLong()
            val fadeSteps = 12
            for (i in 1..fadeSteps) {
                handler.postDelayed({ p.setVolume(1f - i / fadeSteps.toFloat()) }, end - 1200 + i * 100L)
            }
            handler.postDelayed({ finish(keepNotification = true) }, end + 100)
        }
        return START_NOT_STICKY
    }

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private fun finish(keepNotification: Boolean) {
        handler.removeCallbacksAndMessages(null)
        player?.stop()
        player = null
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(if (keepNotification) STOP_FOREGROUND_DETACH else STOP_FOREGROUND_REMOVE)
        }
        if (!keepNotification) androidx.core.app.NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID)
        stopSelf()
    }

    override fun onDestroy() {
        player?.stop()
        super.onDestroy()
    }

    companion object {
        const val ACTION_PLAY = "com.reminder.salawat.PLAY_ADHAN"
        const val ACTION_STOP = "com.reminder.salawat.STOP_ADHAN"
        const val EXTRA_PRAYER = "prayer"
        const val EXTRA_URI = "uri"
        const val EXTRA_TAKBIR_MINUTES = "takbir_minutes"
        private const val NOTIFICATION_ID = 3100

        /** Starts the adhan; returns false if the system refused (caller should fall back to a plain notification). */
        fun start(context: Context, prayer: Prayer, uri: Uri? = null): Boolean = try {
            val intent = Intent(context, AdhanService::class.java)
                .setAction(ACTION_PLAY)
                .putExtra(EXTRA_PRAYER, prayer.name)
            if (uri != null) intent.putExtra(EXTRA_URI, uri.toString())
            ContextCompat.startForegroundService(context, intent)
            true
        } catch (e: Exception) {
            false
        }

        /**
         * Plays just the opening "Allahu akbar, Allahu akbar" of the user's adhan, [minutes] before [prayer].
         * Returns false when there is nothing to play (notification-only) or the system refused.
         */
        fun startTakbir(context: Context, prayer: Prayer, minutes: Int): Boolean {
            if (AdhanCatalog.sourceFor(context, prayer) == null) return false
            return try {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, AdhanService::class.java).setAction(ACTION_PLAY)
                        .putExtra(EXTRA_PRAYER, prayer.name)
                        .putExtra(EXTRA_TAKBIR_MINUTES, minutes)
                )
                true
            } catch (e: Exception) {
                false
            }
        }

        private fun buildTakbirNotification(context: Context, prayer: Prayer, minutes: Int): android.app.Notification {
            val stopIntent = PendingIntent.getService(
                context, 12, Intent(context, AdhanService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val openApp = PendingIntent.getActivity(
                context, 13, MainActivity.intent(context, MainActivity.TAB_PRAYER),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            return NotificationCompat.Builder(context, Notifications.CHANNEL_ADHAN)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.rem_pre_adhan_title, minutes, context.getString(prayer.nameRes)))
                .setContentText(context.getString(R.string.rem_pre_adhan_text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setContentIntent(openApp)
                .setDeleteIntent(stopIntent)
                .addAction(0, context.getString(R.string.adhan_stop), stopIntent)
                .setAutoCancel(true)
                .build()
        }

        fun stop(context: Context) {
            runCatching { context.startService(Intent(context, AdhanService::class.java).setAction(ACTION_STOP)) }
        }

        private fun buildNotification(context: Context, prayer: Prayer): android.app.Notification {
            val stopIntent = PendingIntent.getService(
                context, 10, Intent(context, AdhanService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val openApp = PendingIntent.getActivity(
                context, 11, MainActivity.intent(context, MainActivity.TAB_PRAYER),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            return NotificationCompat.Builder(context, Notifications.CHANNEL_ADHAN)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.prayer_notif_title, context.getString(prayer.nameRes)))
                .setContentText(context.getString(R.string.prayer_notif_text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(openApp)
                .setDeleteIntent(stopIntent)
                .addAction(0, context.getString(R.string.adhan_stop), stopIntent)
                .addAction(0, context.getString(R.string.tracker_prayed_action), prayedPendingIntent(context, prayer, NOTIFICATION_ID))
                .setAutoCancel(true)
                .build()
        }
    }
}
