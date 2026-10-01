package com.reminder.salawat

import android.media.AudioAttributes
import android.media.MediaPlayer

/** Plays one URL at a time; lives in a ViewModel so playback survives screen rotation. */
class AudioPlayer(private val onFinished: (completed: Boolean) -> Unit) {
    private var player: MediaPlayer? = null

    val isPlaying: Boolean get() = player != null

    fun play(url: String) {
        stop()
        if (url.isBlank()) {
            onFinished(false)
            return
        }
        val mp = MediaPlayer()
        player = mp
        mp.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        mp.setOnPreparedListener { if (player === it) it.start() }
        mp.setOnCompletionListener { if (player === it) { release(); onFinished(true) } }
        mp.setOnErrorListener { p, _, _ -> if (player === p) { release(); onFinished(false) }; true }
        try {
            mp.setDataSource(url)
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
