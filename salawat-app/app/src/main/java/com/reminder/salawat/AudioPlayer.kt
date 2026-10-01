package com.reminder.salawat

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.PowerManager

/**
 * Plays one source at a time. Lives in a ViewModel so playback survives screen rotation,
 * and holds a partial wake lock (when given a context) so recitation continues with the screen off.
 */
class AudioPlayer(
    private val context: Context? = null,
    private val usage: Int = AudioAttributes.USAGE_MEDIA,
    private val onStarted: () -> Unit = {},
    private val onFinished: (completed: Boolean) -> Unit
) {
    private var player: MediaPlayer? = null

    val isPlaying: Boolean get() = player != null

    fun play(url: String) {
        if (url.isBlank()) {
            stop()
            onFinished(false)
            return
        }
        start { it.setDataSource(url) }
    }

    fun play(uri: Uri) {
        val ctx = context ?: return onFinished(false)
        start { it.setDataSource(ctx, uri) }
    }

    private fun start(setSource: (MediaPlayer) -> Unit) {
        stop()
        val mp = MediaPlayer()
        player = mp
        mp.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(usage)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        context?.let { mp.setWakeMode(it.applicationContext, PowerManager.PARTIAL_WAKE_LOCK) }
        mp.setOnPreparedListener {
            if (player === it) {
                it.start()
                onStarted()
            }
        }
        mp.setOnCompletionListener {
            if (player === it) {
                release()
                onFinished(true)
            }
        }
        mp.setOnErrorListener { p, _, _ ->
            if (player === p) {
                release()
                onFinished(false)
            }
            true
        }
        try {
            setSource(mp)
            mp.prepareAsync()
        } catch (e: Exception) {
            release()
            onFinished(false)
        }
    }

    fun stop() = release()

    private fun release() {
        val mp = player ?: return
        player = null
        try {
            mp.reset()
            mp.release()
        } catch (_: Exception) {
        }
    }
}
