package com.sahwa.app.guard

import android.accessibilityservice.AccessibilityService
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.sahwa.app.MainActivity
import com.sahwa.app.data.AppData
import com.sahwa.app.data.Store

/**
 * The "Sahwa shield". Watches only for short-video feeds and interrupts the autopilot:
 *  - an awareness gate (breathing + intention) before each session, longer with every session,
 *  - a daily swipe budget ("dopamine wallet") that blocks the feed when spent,
 *  - zombie-mode detection when swiping becomes compulsive,
 *  - hard blocks during focus mode and night shield hours.
 */
class GuardService : AccessibilityService() {

    private lateinit var wm: WindowManager
    private val handler = Handler(Looper.getMainLooper())

    private var inShorts = false
    private var shortsPkg: String? = null
    private var lastCheck = 0L
    private var lastPositive = 0L
    private var lastSwipe = 0L
    private var lastIndex = -1
    private val indexReliable = mutableSetOf<String>()
    private var lastScrollEvent = 0L
    private var tickCount = 0
    private val swipeTimes = ArrayDeque<Long>()
    private var allowedUntil = 0L
    private var zombieSnoozeUntil = 0L

    private var overlay: View? = null
    private var hud: TextView? = null
    private val overlayAnimators = mutableListOf<Animator>()
    private val overlayRunnables = mutableListOf<Runnable>()

    private val ticker = object : Runnable {
        override fun run() {
            tick()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Store.init(this)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        handler.removeCallbacks(ticker)
        handler.post(ticker)
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        removeOverlay()
        hideHud()
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName || pkg == "com.android.systemui" ||
            pkg.contains("inputmethod") || pkg.contains("keyboard")
        ) return

        if (!ShortsDetector.isMonitored(pkg)) {
            // A real switch to another app (launcher, WhatsApp…): leave right away.
            if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && inShorts) evaluate()
            return
        }
        val now = SystemClock.uptimeMillis()
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> evaluate()
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> if (now - lastCheck > 800) evaluate()
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                if (!inShorts) evaluate()
                if (inShorts) onScroll(event, pkg, now)
            }
        }
    }

    private fun screenHeight() = resources.displayMetrics.heightPixels

    /**
     * Re-reads the screen. Entering is immediate; leaving needs [LEAVE_GRACE_MS] without any
     * positive reading (or a confirmed switch to another app), so a momentary read glitch never
     * removes and re-shows the gate.
     */
    private fun evaluate() {
        val now = SystemClock.uptimeMillis()
        lastCheck = now
        val root = rootInActiveWindow ?: return
        val rootPkg = root.packageName?.toString() ?: return
        if (rootPkg == packageName || rootPkg == "com.android.systemui" ||
            rootPkg.contains("inputmethod") || rootPkg.contains("keyboard")
        ) return
        val shorts = ShortsDetector.detect(root, screenHeight()) ?: return
        if (shorts) {
            lastPositive = now
            if (!inShorts) enterShorts(rootPkg)
        } else if (inShorts) {
            val otherApp = !ShortsDetector.isMonitored(rootPkg)
            if (otherApp || now - lastPositive > LEAVE_GRACE_MS) leaveShorts()
        }
    }

    private fun enterShorts(pkg: String) {
        inShorts = true
        shortsPkg = pkg
        Store.tick()
        val d = Store.state.value
        val reason = blockReason(d)
        when {
            reason != null -> showBlock(reason.first, reason.second)
            System.currentTimeMillis() < allowedUntil -> showHud()
            else -> showGate()
        }
    }

    private fun leaveShorts() {
        inShorts = false
        shortsPkg = null
        lastIndex = -1
        swipeTimes.clear()
        hideHud()
        removeOverlay()
    }

    /**
     * Counts one swipe per new video. Only full-screen vertical scrolls count, so scrolling
     * comments, descriptions or side carousels never drains the budget. When the app reports
     * item indexes, a swipe is a change of index; otherwise a burst of scroll events.
     */
    private fun onScroll(event: AccessibilityEvent, pkg: String, now: Long) {
        if (overlay != null) return
        event.source?.let { src ->
            val r = Rect()
            src.getBoundsInScreen(r)
            if (r.height() < screenHeight() * 0.55f) return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            event.scrollDeltaX != 0 && event.scrollDeltaY == 0
        ) return

        val idx = event.fromIndex
        val gap = now - lastScrollEvent
        lastScrollEvent = now
        val newSwipe = if (idx >= 0 && pkg in indexReliable) {
            val changed = idx != lastIndex
            lastIndex = idx
            changed && now - lastSwipe > 350
        } else {
            if (idx >= 0) {
                if (lastIndex >= 0 && idx != lastIndex) indexReliable += pkg
                lastIndex = idx
            }
            gap > 650
        }
        if (!newSwipe) return
        lastSwipe = now

        Store.recordSwipe()
        swipeTimes.addLast(now)
        while (swipeTimes.isNotEmpty() && now - swipeTimes.first() > 60_000) swipeTimes.removeFirst()

        val d = Store.state.value
        if (d.remaining <= 0) {
            showBlock("نفد رصيد التمرير اليوم", "استهلكت ميزانيتك (${d.baseBudget + d.today.earned} تمريرة). يمكنك كسب رصيد إضافي بنشاط بديل حقيقي.")
            return
        }
        if (d.zombieCheck && swipeTimes.size >= 12 && now > zombieSnoozeUntil) {
            showZombie(swipeTimes.size)
            return
        }
        updateHud()
    }

    private fun tick() {
        Store.guardHeartbeat = System.currentTimeMillis()
        Store.tick()
        if (!inShorts) return
        tickCount++
        if (tickCount % 2 == 0) {
            evaluate()
            if (!inShorts) return
        }
        if (overlay != null) return
        Store.addShortsTime(1)
        val d = Store.state.value
        val reason = blockReason(d)
        val now = System.currentTimeMillis()
        if (reason != null) {
            showBlock(reason.first, reason.second)
        } else if (allowedUntil in 1..now) {
            allowedUntil = 0L
            showSessionEnd()
        } else if (allowedUntil == 0L && hud == null) {
            showGate()
        } else {
            updateHud()
        }
    }

    private fun blockReason(d: AppData): Pair<String, String>? = when {
        d.focusActive -> "وضع التركيز مفعّل" to "أنت في جلسة تركيز عميق. المقاطع القصيرة مغلقة حتى تنتهي. عقلك يبني شيئًا الآن."
        d.nightActive() -> "درع الليل 🌙" to "المقاطع القصيرة مغلقة من ${d.nightStart}:00 حتى ${d.nightEnd}:00. نومك أثمن من أي فيديو."
        d.remaining <= 0 -> "نفد رصيد التمرير اليوم" to "استهلكت ميزانيتك اليومية. يمكنك كسب رصيد إضافي بنشاط بديل حقيقي."
        else -> null
    }

    // ---------------- actions ----------------

    private fun startSession(minutes: Int) {
        allowedUntil = System.currentTimeMillis() + minutes * 60_000L
        Store.recordSession()
        removeOverlay()
        showHud()
    }

    private fun goHome() {
        removeOverlay()
        hideHud()
        inShorts = false
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    private fun goToRescue() {
        goHome()
        handler.postDelayed({
            val i = Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_TAB, MainActivity.TAB_RESCUE)
            runCatching { startActivity(i) }
        }, 350)
    }

    // ---------------- overlays ----------------

    private fun showGate() {
        removeOverlay()
        val d = Store.state.value
        val wait = (d.gateSeconds + d.today.sessions * 3).coerceAtMost(30)
        val p = panel()
        p.addView(text("🧠 لحظة وعي", 28f, WHITE, bold = true))
        p.addView(text("أنت على وشك دخول المقاطع القصيرة. توقّف وتنفّس.", 15f, MUTED))

        val orb = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(80).toFloat()
                colors = intArrayOf(CYAN, VIOLET_DEEP, 0x00000000)
            }
        }
        p.addView(orb, LinearLayout.LayoutParams(dp(160), dp(160)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(18)
            bottomMargin = dp(8)
        })
        val breath = text("شهيق…", 20f, CYAN, bold = true)
        p.addView(breath)
        val anim = ValueAnimator.ofFloat(0.55f, 1f).apply {
            duration = 4000
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener {
                val v = it.animatedValue as Float
                orb.scaleX = v
                orb.scaleY = v
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationRepeat(animation: Animator) {
                    breath.text = if (breath.text.startsWith("شهيق")) "زفير…" else "شهيق…"
                }
            })
            start()
        }
        overlayAnimators += anim

        p.addView(text("«${d.futureMsg}»", 17f, VIOLET).apply { setPadding(0, dp(18), 0, dp(6)) })
        p.addView(text("— رسالة من نفسك المستقبلية", 12f, MUTED))
        p.addView(
            text(
                "تمريرات اليوم: ${d.today.swipes}   •   رصيدك: ${d.remaining}\n" +
                    "هذه جلستك رقم ${d.today.sessions + 1} اليوم — الانتظار يطول مع كل جلسة",
                13f, MUTED,
            ).apply { setPadding(0, dp(16), 0, dp(4)) }
        )
        val counter = text("انتظر $wait ث…", 14f, AMBER, bold = true)
        p.addView(counter)

        val b2 = button("🎯 دقيقتان بنيّة واضحة", primary = true) { startSession(2) }
        val b5 = button("⏳ 5 دقائق", primary = false) { startSession(5) }
        listOf(b2, b5).forEach {
            it.isEnabled = false
            it.alpha = 0.3f
            p.addView(it)
        }
        p.addView(button("💪 تراجعت — خذني لشيء أفضل (+2 🧠)", primary = false) {
            Store.recordResisted()
            goToRescue()
        })
        p.addView(button("🏠 خروج", primary = false) {
            Store.recordResisted()
            goHome()
        })

        var left = wait
        val r = object : Runnable {
            override fun run() {
                left--
                if (left <= 0) {
                    counter.text = "اختر بوعي، لا بعادة."
                    listOf(b2, b5).forEach { it.isEnabled = true; it.alpha = 1f }
                } else {
                    counter.text = "انتظر $left ث…"
                    handler.postDelayed(this, 1000)
                }
            }
        }
        overlayRunnables += r
        handler.postDelayed(r, 1000)
        showOverlay(p)
    }

    private fun showBlock(title: String, msg: String) {
        removeOverlay()
        hideHud()
        val p = panel()
        p.addView(text("🛡️", 64f, WHITE))
        p.addView(text(title, 26f, WHITE, bold = true))
        p.addView(text(msg, 16f, MUTED).apply { setPadding(0, dp(10), 0, dp(18)) })
        val d = Store.state.value
        p.addView(text("🧠 صحة دماغك: ${d.brain.toInt()}%", 15f, CYAN, bold = true))
        p.addView(button("⚡ نشاط بديل يكسبك رصيدًا", primary = true) { goToRescue() })
        p.addView(button("🏠 الخروج الآن", primary = false) { goHome() })
        showOverlay(p)
    }

    private fun showZombie(count: Int) {
        removeOverlay()
        hideHud()
        val p = panel()
        p.addView(text("🧟", 64f, WHITE))
        p.addView(text("رصدنا وضع الزومبي", 26f, WHITE, bold = true))
        p.addView(
            text(
                "$count تمريرة في أقل من دقيقة.\nعقلك يعمل على الطيار الآلي ولم يعد يستمتع فعلًا — إنه فقط يطارد الجرعة التالية.",
                16f, MUTED,
            ).apply { setPadding(0, dp(10), 0, dp(10)) }
        )
        p.addView(text("سؤال صحوة: هل تتذكر عن ماذا كان آخر 3 مقاطع؟", 16f, AMBER, bold = true))
        val counter = text("", 14f, MUTED)
        p.addView(counter)
        val cont = button("🙂 أتذكّر، سأكمل بوعي", primary = false) {
            zombieSnoozeUntil = SystemClock.uptimeMillis() + 3 * 60_000
            swipeTimes.clear()
            removeOverlay()
            showHud()
        }
        cont.isEnabled = false
        cont.alpha = 0.3f
        p.addView(button("😮 لا أتذكر… أخرجني (+2 🧠)", primary = true) {
            Store.recordResisted()
            goToRescue()
        })
        p.addView(cont)
        var left = 10
        val r = object : Runnable {
            override fun run() {
                if (left <= 0) {
                    counter.text = ""
                    cont.isEnabled = true
                    cont.alpha = 1f
                } else {
                    counter.text = "يمكنك المتابعة بعد $left ث"
                    left--
                    handler.postDelayed(this, 1000)
                }
            }
        }
        overlayRunnables += r
        handler.post(r)
        showOverlay(p)
    }

    private fun showSessionEnd() {
        removeOverlay()
        hideHud()
        val p = panel()
        p.addView(text("⏰", 64f, WHITE))
        p.addView(text("انتهت جلستك", 26f, WHITE, bold = true))
        p.addView(text("التزمت بالنية التي اخترتها. هذا هو الفرق بين من يستخدم الهاتف ومن يستخدمه الهاتف.", 16f, MUTED).apply {
            setPadding(0, dp(10), 0, dp(18))
        })
        p.addView(button("✅ إنهاء بشرف (+1 🧠)", primary = true) {
            Store.rewardBrain(1f)
            goHome()
        })
        p.addView(button("⚡ نشاط بديل", primary = false) { goToRescue() })
        showOverlay(p)
    }

    /**
     * Attaches [content] as the full-screen overlay. Callers clear the previous overlay with
     * [removeOverlay] *before* starting the new one's countdowns and animations; doing it here
     * would cancel them (the gate countdown froze on its first number because of that).
     */
    private fun showOverlay(content: View) {
        overlay?.let { runCatching { wm.removeView(it) } }
        overlay = null
        val root = ScrollView(this).apply {
            isFillViewport = true
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xFF060A13.toInt(), 0xFF120A2A.toInt(), 0xFF060A13.toInt()),
            )
            addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        )
        runCatching {
            wm.addView(root, lp)
            overlay = root
        }
    }

    private fun removeOverlay() {
        overlayAnimators.forEach { it.cancel() }
        overlayAnimators.clear()
        overlayRunnables.forEach { handler.removeCallbacks(it) }
        overlayRunnables.clear()
        overlay?.let { runCatching { wm.removeView(it) } }
        overlay = null
    }

    private fun showHud() {
        if (hud != null) {
            updateHud()
            return
        }
        val tv = TextView(this).apply {
            textSize = 13f
            setTextColor(WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(14), dp(6), dp(14), dp(6))
            background = GradientDrawable().apply {
                cornerRadius = dp(20).toFloat()
                setColor(0xCC0B1020.toInt())
                setStroke(dp(1), 0x8822D3EE.toInt())
            }
        }
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(36)
        }
        runCatching {
            wm.addView(tv, lp)
            hud = tv
        }
        updateHud()
    }

    private fun updateHud() {
        val tv = hud ?: return
        val d = Store.state.value
        val leftMs = (allowedUntil - System.currentTimeMillis()).coerceAtLeast(0)
        val m = leftMs / 60_000
        val s = (leftMs / 1000) % 60
        tv.text = "🧠 ${d.brain.toInt()}   ⚡ ${d.remaining}   ⏱ $m:${s.toString().padStart(2, '0')}"
    }

    private fun hideHud() {
        hud?.let { runCatching { wm.removeView(it) } }
        hud = null
    }

    // ---------------- view helpers ----------------

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun panel() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        setPadding(dp(28), dp(48), dp(28), dp(48))
    }

    private fun text(s: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = s
        textSize = size
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dp(4), 0, dp(4))
        setLineSpacing(0f, 1.2f)
    }

    private fun button(label: String, primary: Boolean, onClick: () -> Unit) = TextView(this).apply {
        text = label
        textSize = 16f
        gravity = Gravity.CENTER
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(if (primary) 0xFF041016.toInt() else WHITE)
        background = GradientDrawable().apply {
            cornerRadius = dp(18).toFloat()
            if (primary) {
                orientation = GradientDrawable.Orientation.LEFT_RIGHT
                colors = intArrayOf(CYAN, 0xFF818CF8.toInt())
            } else {
                setColor(0x1AFFFFFF)
                setStroke(dp(1), 0x40FFFFFF)
            }
        }
        setPadding(dp(16), dp(15), dp(16), dp(15))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(12) }
        setOnClickListener { if (isEnabled) onClick() }
    }

    companion object {
        /** How long the feed must be absent before the shield considers the user gone. */
        private const val LEAVE_GRACE_MS = 2500L

        private val WHITE = 0xFFE6EDF7.toInt()
        private val MUTED = 0xFF8A97B0.toInt()
        private val CYAN = 0xFF22D3EE.toInt()
        private val VIOLET = 0xFFC4B5FD.toInt()
        private val VIOLET_DEEP = 0xAA7C3AED.toInt()
        private val AMBER = 0xFFFBBF24.toInt()
    }
}
