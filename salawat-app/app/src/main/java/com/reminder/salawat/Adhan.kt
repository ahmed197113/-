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
    fun sourceFor(context: Context, prayer: Prayer): Uri? {
        var id = selectedId(context, fajrSlot = prayer == Prayer.FAJR)
        if (id == SAME_AS_OTHERS) id = selectedId(context, fajrSlot = false)
        if (!isAvailable(context, id)) id = BUNDLED
        return uriFor(context, id)
    }

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
                downloadTo(url, target, onProgress)
                return@withContext
            } catch (e: Exception) {
                ensureActive()
                last = e
            }
        }
        throw last ?: IOException("download failed")
    }

    private suspend fun downloadTo(url: String, target: File, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, target.name + ".part")
        var connection = URL(url).openConnection() as HttpURLConnection
        var redirects = 0
        // HttpURLConnection does not follow redirects that change host on some versions; do it by hand.
        while (true) {
            connection.connectTimeout = 20_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = false
            val code = connection.responseCode
            if (code in 300..399 && redirects < 6) {
                val location = connection.getHeaderField("Location") ?: throw IOException("redirect without location")
                connection.disconnect()
                connection = URL(URL(url), location).openConnection() as HttpURLConnection
                redirects++
                continue
            }
            if (code != 200) throw IOException("HTTP $code")
            break
        }
        try {
            val total = connection.contentLengthLong
            connection.inputStream.use { input ->
                tmp.outputStream().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var done = 0L
                    var lastPercent = -1
                    while (true) {
                        ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        done += read
                        if (total > 0) {
                            val percent = (done * 100 / total).toInt()
                            if (percent != lastPercent) {
                                lastPercent = percent
                                withContext(Dispatchers.Main) { onProgress(percent) }
                            }
                        }
                    }
                }
            }
            if (tmp.length() < 10_000) throw IOException("file too small")
            if (!tmp.renameTo(target)) throw IOException("rename failed")
        } finally {
            connection.disconnect()
            tmp.delete()
        }
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
        val notification = buildNotification(this, prayer)
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
        player = AudioPlayer(this, AudioAttributes.USAGE_ALARM) { finish(keepNotification = true) }.also { it.play(uri) }
        return START_NOT_STICKY
    }

    private fun finish(keepNotification: Boolean) {
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

        fun stop(context: Context) {
            runCatching { context.startService(Intent(context, AdhanService::class.java).setAction(ACTION_STOP)) }
        }

        private fun buildNotification(context: Context, prayer: Prayer): android.app.Notification {
            val stopIntent = PendingIntent.getService(
                context, 10, Intent(context, AdhanService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val openApp = PendingIntent.getActivity(
                context, 11, Intent(context, PrayerTimesActivity::class.java),
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
                .setAutoCancel(true)
                .build()
        }
    }
}
