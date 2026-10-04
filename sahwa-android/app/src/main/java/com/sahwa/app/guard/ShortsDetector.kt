package com.sahwa.app.guard

import android.view.accessibility.AccessibilityNodeInfo

/**
 * Decides whether the user is currently inside an infinite short-video feed.
 *
 * Apps that are *entirely* a short-video feed (TikTok & co.) are always considered shorts.
 * For mixed apps (YouTube, Instagram, …) only the short-video screen is detected, by looking
 * for its view-id markers in the window tree, so normal use of those apps stays untouched.
 * The markers are best-effort and may need updating when the apps change their layouts.
 */
object ShortsDetector {

    val FULL_SHORT_APPS: Set<String> = setOf(
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.zhiliaoapp.musically.go",
        "video.like",
        "com.kwai.video",
        "com.kwai.bulldog",
    )

    private val FEED_MARKERS: Map<String, List<String>> = mapOf(
        "com.google.android.youtube" to listOf(
            "reel_recycler",
            "reel_player_page_container",
            "reel_watch_player",
            "reel_watch_fragment_root",
            "reel_progress_bar",
        ),
        "com.instagram.android" to listOf(
            "clips_viewer",
            "clips_video_container",
            "clips_ufi",
        ),
        "com.facebook.katana" to listOf(
            "reels_viewer",
            "reel_viewer",
            "video_reels",
        ),
        "com.snapchat.android" to listOf(
            "spotlight",
        ),
    )

    val NAMES: Map<String, String> = mapOf(
        "com.google.android.youtube" to "YouTube Shorts",
        "com.instagram.android" to "Instagram Reels",
        "com.facebook.katana" to "Facebook Reels",
        "com.snapchat.android" to "Snapchat Spotlight",
        "com.zhiliaoapp.musically" to "TikTok",
        "com.ss.android.ugc.trill" to "TikTok",
        "com.zhiliaoapp.musically.go" to "TikTok Lite",
        "video.like" to "Likee",
        "com.kwai.video" to "Kwai",
        "com.kwai.bulldog" to "Kwai",
    )

    val ALL: Set<String> = FULL_SHORT_APPS + FEED_MARKERS.keys

    fun isMonitored(pkg: String) = pkg in ALL

    fun isShorts(root: AccessibilityNodeInfo?, pkg: String): Boolean {
        if (pkg in FULL_SHORT_APPS) return true
        val markers = FEED_MARKERS[pkg] ?: return false
        if (root == null) return false
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.addLast(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 450) {
            val node = queue.removeFirst()
            visited++
            val id = node.viewIdResourceName?.lowercase()
            if (id != null && markers.any { id.contains(it) }) return true
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.addLast(it) }
            }
        }
        return false
    }
}
