package com.sahwa.app.guard

import android.graphics.Rect
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

    /**
     * View-id fragments of the *full-screen* short-video pager in mixed apps.
     * A match only counts when the node is visible and covers most of the screen,
     * so a Reels post in the normal feed or a "Shorts" tab button never triggers.
     */
    private val FEED_MARKERS: Map<String, List<String>> = mapOf(
        "com.google.android.youtube" to listOf(
            "reel_recycler",
            "reel_player_page_container",
            "reel_watch_player",
            "reel_watch_fragment_root",
        ),
        "com.instagram.android" to listOf(
            "clips_viewer_view_pager",
            "clips_viewer",
            "clips_video_container",
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

    /**
     * Whether the active window shows a short-video feed.
     * Returns null when the screen can't be read right now (unknown), so callers
     * don't mistake a momentary read failure for the user having left the feed.
     */
    fun detect(root: AccessibilityNodeInfo?, screenHeight: Int): Boolean? {
        if (root == null) return null
        val pkg = root.packageName?.toString() ?: return null
        if (pkg in FULL_SHORT_APPS) return true
        val markers = FEED_MARKERS[pkg] ?: return false
        val minHeight = (screenHeight * 0.6f).toInt()
        val rect = Rect()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.addLast(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 2500) {
            val node = queue.removeFirst()
            visited++
            // Hidden fragments (e.g. Shorts kept alive in the back stack) must not count.
            if (!node.isVisibleToUser) continue
            val id = node.viewIdResourceName?.lowercase()
            if (id != null && markers.any { id.contains(it) }) {
                node.getBoundsInScreen(rect)
                if (rect.height() >= minHeight) return true
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.addLast(it) }
            }
        }
        return false
    }
}
