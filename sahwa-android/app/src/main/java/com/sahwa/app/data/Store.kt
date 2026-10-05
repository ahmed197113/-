package com.sahwa.app.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

/** Lowest daily budget the ladder ever asks for. */
const val MIN_BUDGET = 15

/** Maximum swipes that can be earned back per day by doing rescue activities. */
const val MAX_EARN_PER_DAY = 30

/** Cooling-off period before an emergency exit from strict mode takes effect. */
const val UNLOCK_DELAY_MS = 24L * 60 * 60 * 1000

/** Days the first (observation) stage lasts to measure the user's own baseline. */
const val OBSERVE_DAYS = 3

/** Budget used when the observation stage recorded nothing (e.g. the shield was off). */
const val DEFAULT_BASELINE = 60

/** How the shield reacts once today's budget is spent. */
enum class Wall { NONE, NUDGE, SOFT, HARD }

/**
 * One rung of the recovery ladder. Restrictions grow only after the user succeeds at the
 * current rung (graded exposure / shaping), never by the calendar alone.
 */
data class Stage(
    val emoji: String,
    val name: String,
    val desc: String,
    /** Share of the personal baseline allowed per day. */
    val factor: Float,
    /** Breathing wait before a session; 0 = no gate at all. */
    val gateSec: Int,
    val wall: Wall,
    /** For a SOFT wall: wait before "continue" unlocks. */
    val wallSec: Int,
    /** Swipes between repeated nudges/soft walls once over budget. */
    val nudgeEvery: Int,
    val zombie: Boolean,
    /** Session lengths offered at the gate, in minutes. */
    val sessions: List<Int>,
)

val STAGES = listOf(
    Stage("🔍", "المراقبة", "نقيس عادتك الحقيقية لأيام قليلة دون أي منع. مجرد رؤية العدّاد تقلل التمرير.", 1f, 0, Wall.NONE, 0, 0, false, listOf(10)),
    Stage("🌱", "الوعي", "لحظة تنفّس قصيرة قبل الدخول. هدفك = متوسطك نفسه، وعند تجاوزه تذكير لطيف فقط.", 1f, 3, Wall.NUDGE, 0, 15, false, listOf(5, 10)),
    Stage("🎯", "النيّة", "تختار مدة جلستك قبل الدخول. الهدف ينخفض 15٪، وتجاوزه يطلب منك 10 ثوانٍ تفكير.", 0.85f, 5, Wall.SOFT, 10, 10, true, listOf(3, 5)),
    Stage("🧱", "الاحتكاك", "الهدف ينخفض إلى 70٪ من متوسطك. التجاوز ممكن لكنه أصعب قليلًا.", 0.7f, 8, Wall.SOFT, 20, 5, true, listOf(2, 5)),
    Stage("🤝", "الالتزام", "وصلت هنا لأنك نجحت. الهدف 55٪، وعند انتهائه تكسب المزيد بنشاط حقيقي.", 0.55f, 10, Wall.HARD, 0, 0, true, listOf(2, 5)),
    Stage("👑", "التحكّم", "أنت من يقود الآن. 40٪ من عادتك القديمة — حافظ عليها، فهذه هي الحرية.", 0.4f, 10, Wall.HARD, 0, 0, true, listOf(2, 5)),
)

/** Recovery pace: days spent on each rung before it can be passed. */
enum class Pace(val days: Int, val label: String, val desc: String) {
    GENTLE(7, "هادئ", "أسبوع لكل مرحلة — الأنسب لمن جرّب وانتكس من قبل"),
    BALANCED(5, "متوازن", "5 أيام لكل مرحلة — موصى به"),
    FAST(3, "سريع", "3 أيام لكل مرحلة — لمن لديه دافع قوي الآن"),
}

data class Habit(
    val id: String,
    val name: String,
    val emoji: String,
    val done: Set<String> = emptySet(),
) {
    fun isDone(day: LocalDate) = day.toString() in done

    fun streak(today: LocalDate = LocalDate.now()): Int {
        var d = if (isDone(today)) today else today.minusDays(1)
        var n = 0
        while (isDone(d)) {
            n++
            d = d.minusDays(1)
        }
        return n
    }
}

data class DayStat(
    val swipes: Int = 0,
    val shortsSec: Int = 0,
    val resisted: Int = 0,
    val activities: Int = 0,
    val earned: Int = 0,
    val focusMin: Int = 0,
    val sessions: Int = 0,
    /** Budget that applied on that day (0 = no budget, observation stage). */
    val budget: Int = 0,
) {
    val overBudget: Boolean get() = budget > 0 && swipes > budget + earned
}

data class AppData(
    val brain: Float = 60f,
    val habits: List<Habit> = defaultHabits(),
    val days: Map<String, DayStat> = emptyMap(),
    val stage: Int = 0,
    val stageDays: Int = 0,
    val stageGoodDays: Int = 0,
    val baseline: Int = 0,
    val pace: Pace = Pace.BALANCED,
    /** Set when the user just climbed a rung, cleared once celebrated in the UI. */
    val justLeveledUp: Boolean = false,
    val focusUntil: Long = 0L,
    val focusMinutes: Int = 0,
    val focusRewarded: Boolean = true,
    val nightShield: Boolean = false,
    val nightStart: Int = 23,
    val nightEnd: Int = 6,
    val zombieCheck: Boolean = true,
    val futureMsg: String = "أنا أقوى من خوارزمية صُمّمت لتسرق وقتي.",
    val lastDay: String = LocalDate.now().toString(),
    val onboarded: Boolean = false,
    val strictUntil: Long = 0L,
    val unlockRequestAt: Long = 0L,
) {
    val strictActive: Boolean get() = strictUntil > System.currentTimeMillis()

    /** Time left (ms) before a pending emergency unlock takes effect, or null when none is pending. */
    val unlockLeftMs: Long?
        get() = if (unlockRequestAt == 0L) null
        else (unlockRequestAt + UNLOCK_DELAY_MS - System.currentTimeMillis()).coerceAtLeast(0L)

    val todayKey: String get() = LocalDate.now().toString()
    val today: DayStat get() = day(todayKey)

    fun day(key: String): DayStat = days[key] ?: DayStat()

    val stageInfo: Stage get() = STAGES[stage.coerceIn(0, STAGES.lastIndex)]

    val observing: Boolean get() = stage == 0

    /** Today's swipe budget from the personal baseline; 0 while observing (no limit). */
    val baseBudget: Int
        get() {
            if (observing) return 0
            val base = if (baseline > 0) baseline else DEFAULT_BASELINE
            val floor = minOf(MIN_BUDGET, base)
            return (base * stageInfo.factor).toInt().coerceAtLeast(floor)
        }

    val totalBudget: Int get() = if (observing) 0 else baseBudget + today.earned

    val remaining: Int get() = if (observing) Int.MAX_VALUE else (totalBudget - today.swipes).coerceAtLeast(0)

    val overBudget: Boolean get() = !observing && today.swipes >= totalBudget

    val focusActive: Boolean get() = focusUntil > System.currentTimeMillis()

    fun nightActive(): Boolean {
        if (!nightShield) return false
        val h = LocalTime.now().hour
        return if (nightStart > nightEnd) h >= nightStart || h < nightEnd else h in nightStart until nightEnd
    }

    /** Good days needed on the current rung to climb. */
    val goodDaysNeeded: Int get() = (pace.days * 0.6f).let { kotlin.math.ceil(it).toInt() }
}

enum class BrainLevel(val label: String, val desc: String) {
    RADIANT("متوهّج", "وصلاتك العصبية في أقوى حالاتها. تركيز حاد وذهن صافٍ."),
    CLEAR("صافٍ", "عقل متوازن. استمر وستصل للتوهّج."),
    FOGGY("ضبابي", "بدأ الضباب الذهني. عادة واحدة أو نشاط بديل سيعيد الصفاء."),
    ROTTING("يتعفّن", "التمرير اللانهائي يستنزف دماغك. لا بأس — كل خطوة صغيرة تعيده."),
}

fun brainLevel(score: Float): BrainLevel = when {
    score >= 80f -> BrainLevel.RADIANT
    score >= 60f -> BrainLevel.CLEAR
    score >= 40f -> BrainLevel.FOGGY
    else -> BrainLevel.ROTTING
}

fun defaultHabits(): List<Habit> = listOf(
    Habit("h_read", "قراءة 10 صفحات", "📖"),
    Habit("h_move", "رياضة أو مشي 20 دقيقة", "🏃"),
    Habit("h_pray", "الصلاة في وقتها / ذكر", "🤲"),
    Habit("h_water", "شرب 8 أكواب ماء", "💧"),
    Habit("h_morning", "أول ساعة بلا هاتف", "🌅"),
    Habit("h_sleep", "النوم قبل منتصف الليل", "🌙"),
)

/**
 * Single source of truth shared by the UI and the accessibility guard (same process).
 * Persisted as one JSON blob in SharedPreferences.
 */
object Store {
    private const val KEY = "data"
    private lateinit var prefs: SharedPreferences
    private val _state = MutableStateFlow(AppData())
    val state: StateFlow<AppData> = _state

    /** Last time the shield service ticked (in-memory). Used to spot a shield the system killed. */
    @Volatile
    var guardHeartbeat: Long = 0L

    fun init(ctx: Context) {
        if (::prefs.isInitialized) return
        prefs = ctx.applicationContext.getSharedPreferences("sahwa", Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.let { raw ->
            runCatching { fromJson(raw) }.getOrNull()?.let { _state.value = it }
        }
        tick()
    }

    @Synchronized
    private fun update(f: (AppData) -> AppData) {
        val next = f(_state.value)
        _state.value = next
        if (::prefs.isInitialized) prefs.edit().putString(KEY, toJson(next)).apply()
    }

    private fun AppData.withToday(f: (DayStat) -> DayStat) =
        copy(days = days + (todayKey to f(today).copy(budget = baseBudget)))

    private fun AppData.brainBy(delta: Float) = copy(brain = (brain + delta).coerceIn(0f, 100f))

    /** Day rollover, ladder progress and focus rewards. Safe to call often. */
    fun tick() {
        val d = _state.value
        val todayDate = LocalDate.now()
        if (d.lastDay != todayDate.toString()) {
            update { closeDays(it, todayDate) }
        }
        val now = System.currentTimeMillis()
        if (d.unlockRequestAt > 0 && (now >= d.unlockRequestAt + UNLOCK_DELAY_MS || d.strictUntil <= now)) {
            update { it.copy(strictUntil = 0L, unlockRequestAt = 0L) }
        }
        if (!d.focusRewarded && d.focusUntil in 1..now) {
            update {
                it.brainBy(it.focusMinutes / 5f)
                    .withToday { s -> s.copy(focusMin = s.focusMin + it.focusMinutes) }
                    .copy(focusRewarded = true, focusUntil = 0L)
            }
        }
    }

    /**
     * Closes every finished day since [AppData.lastDay]. Each day either counts as "good"
     * (within budget) or not; a rung is climbed after enough good days. Bad days never push
     * the user back down — a slip is information, not failure.
     */
    private fun closeDays(start: AppData, today: LocalDate): AppData {
        var a = start
        var day = runCatching { LocalDate.parse(a.lastDay) }.getOrDefault(today)
        var guard = 0
        while (day.isBefore(today) && guard < 60) {
            guard++
            val s = a.day(day.toString())
            if (a.observing) {
                a = a.copy(stageDays = a.stageDays + 1)
                if (a.stageDays >= OBSERVE_DAYS) {
                    a = a.copy(baseline = computeBaseline(a, day), stage = 1, stageDays = 0, stageGoodDays = 0, justLeveledUp = true)
                }
            } else {
                val good = !s.overBudget
                a = a.brainBy(if (good) 3f else 0f)
                    .copy(stageDays = a.stageDays + 1, stageGoodDays = a.stageGoodDays + if (good) 1 else 0)
                if (a.stageDays >= a.pace.days) {
                    a = if (a.stageGoodDays >= a.goodDaysNeeded && a.stage < STAGES.lastIndex) {
                        a.copy(stage = a.stage + 1, stageDays = 0, stageGoodDays = 0, justLeveledUp = true)
                    } else {
                        // Repeat the rung (or stay at the top) — no punishment.
                        a.copy(stageDays = 0, stageGoodDays = 0)
                    }
                }
            }
            day = day.plusDays(1)
        }
        val cutoff = today.minusDays(90).toString()
        return a.copy(lastDay = today.toString(), days = a.days.filterKeys { k -> k >= cutoff })
    }

    private fun computeBaseline(a: AppData, lastObserved: LocalDate): Int {
        val counts = (0 until OBSERVE_DAYS).map { a.day(lastObserved.minusDays(it.toLong()).toString()).swipes }
        val avg = counts.sum() / OBSERVE_DAYS
        return if (avg <= 0) DEFAULT_BASELINE else avg.coerceIn(MIN_BUDGET, 400)
    }

    /** Swipes within budget cost nothing — the budget is permission, not temptation. */
    fun recordSwipe() = update {
        val over = !it.observing && it.today.swipes >= it.totalBudget
        it.brainBy(if (over) -0.5f else 0f).withToday { s -> s.copy(swipes = s.swipes + 1) }
    }

    fun addShortsTime(sec: Int) = update { it.withToday { s -> s.copy(shortsSec = s.shortsSec + sec) } }

    fun recordSession() = update { it.withToday { s -> s.copy(sessions = s.sessions + 1) } }

    fun recordResisted() = update { it.brainBy(2f).withToday { s -> s.copy(resisted = s.resisted + 1) } }

    fun rewardBrain(delta: Float) = update { it.brainBy(delta) }

    /** A completed rescue activity heals the brain and earns back a few swipes. */
    fun completeActivity(points: Float = 4f, credits: Int = 5) = update {
        it.brainBy(points).withToday { s ->
            val earn = credits.coerceAtMost(MAX_EARN_PER_DAY - s.earned).coerceAtLeast(0)
            s.copy(activities = s.activities + 1, earned = s.earned + earn)
        }
    }

    fun toggleHabit(id: String) = update { d ->
        val key = d.todayKey
        var delta = 0f
        val habits = d.habits.map { h ->
            if (h.id != id) h
            else if (key in h.done) {
                delta = -3f
                h.copy(done = h.done - key)
            } else {
                delta = 3f
                h.copy(done = h.done + key)
            }
        }
        d.copy(habits = habits).brainBy(delta)
    }

    fun addHabit(name: String, emoji: String) = update {
        it.copy(habits = it.habits + Habit("h_" + UUID.randomUUID().toString().take(8), name, emoji.ifBlank { "✨" }))
    }

    fun deleteHabit(id: String) = update { it.copy(habits = it.habits.filterNot { h -> h.id == id }) }

    fun startFocus(minutes: Int) = update {
        it.copy(
            focusUntil = System.currentTimeMillis() + minutes * 60_000L,
            focusMinutes = minutes,
            focusRewarded = false,
        )
    }

    fun cancelFocus() = update { if (it.strictActive) it else it.copy(focusUntil = 0L, focusRewarded = true) }

    fun clearLevelUp() = update { it.copy(justLeveledUp = false) }

    fun setPace(p: Pace) = update { if (it.strictActive && p.days > it.pace.days) it else it.copy(pace = p) }

    /** Step down one rung when the current one feels too hard (self-compassion, not failure). */
    fun stepDown() = update {
        if (it.strictActive || it.stage <= 1) it else it.copy(stage = it.stage - 1, stageDays = 0, stageGoodDays = 0)
    }

    fun restartLadder() = update {
        if (it.strictActive) it else it.copy(stage = 0, stageDays = 0, stageGoodDays = 0, baseline = 0)
    }

    fun setNightShield(v: Boolean) = update { it.copy(nightShield = v) }
    fun setNightHours(start: Int, end: Int) = update { it.copy(nightStart = start, nightEnd = end) }
    fun setZombieCheck(v: Boolean) = update { it.copy(zombieCheck = v) }
    fun setFutureMsg(v: String) = update { it.copy(futureMsg = v) }
    fun startStrict(days: Int) = update {
        it.copy(strictUntil = System.currentTimeMillis() + days * 24L * 60 * 60 * 1000, unlockRequestAt = 0L)
    }

    fun requestUnlock() = update { if (it.strictActive) it.copy(unlockRequestAt = System.currentTimeMillis()) else it }
    fun cancelUnlock() = update { it.copy(unlockRequestAt = 0L) }

    fun finishOnboarding(pace: Pace, msg: String, nightShield: Boolean) = update {
        it.copy(
            onboarded = true,
            pace = pace,
            nightShield = nightShield,
            futureMsg = msg.ifBlank { it.futureMsg },
            stage = 0,
            stageDays = 0,
            stageGoodDays = 0,
            baseline = 0,
        )
    }

    // ---------- JSON ----------

    private fun toJson(d: AppData): String {
        val o = JSONObject()
        o.put("brain", d.brain.toDouble())
        o.put("habits", JSONArray().apply {
            d.habits.forEach { h ->
                put(JSONObject().apply {
                    put("id", h.id)
                    put("name", h.name)
                    put("emoji", h.emoji)
                    put("done", JSONArray(h.done.toList()))
                })
            }
        })
        o.put("days", JSONObject().apply {
            d.days.forEach { (k, v) ->
                put(k, JSONObject().apply {
                    put("sw", v.swipes)
                    put("sec", v.shortsSec)
                    put("res", v.resisted)
                    put("act", v.activities)
                    put("earn", v.earned)
                    put("focus", v.focusMin)
                    put("ses", v.sessions)
                    put("bud", v.budget)
                })
            }
        })
        o.put("stage", d.stage)
        o.put("stageDays", d.stageDays)
        o.put("stageGoodDays", d.stageGoodDays)
        o.put("baseline", d.baseline)
        o.put("pace", d.pace.name)
        o.put("justLeveledUp", d.justLeveledUp)
        o.put("focusUntil", d.focusUntil)
        o.put("focusMinutes", d.focusMinutes)
        o.put("focusRewarded", d.focusRewarded)
        o.put("nightShield", d.nightShield)
        o.put("nightStart", d.nightStart)
        o.put("nightEnd", d.nightEnd)
        o.put("zombieCheck", d.zombieCheck)
        o.put("futureMsg", d.futureMsg)
        o.put("lastDay", d.lastDay)
        o.put("onboarded", d.onboarded)
        o.put("strictUntil", d.strictUntil)
        o.put("unlockRequestAt", d.unlockRequestAt)
        return o.toString()
    }

    private fun fromJson(raw: String): AppData {
        val o = JSONObject(raw)
        val def = AppData()
        val habits = o.optJSONArray("habits")?.let { arr ->
            List(arr.length()) { i ->
                val h = arr.getJSONObject(i)
                val done = h.optJSONArray("done")
                Habit(
                    id = h.getString("id"),
                    name = h.getString("name"),
                    emoji = h.optString("emoji", "✨"),
                    done = if (done == null) emptySet() else List(done.length()) { j -> done.getString(j) }.toSet(),
                )
            }
        } ?: def.habits
        val days = HashMap<String, DayStat>()
        o.optJSONObject("days")?.let { dj ->
            dj.keys().forEach { k ->
                val v = dj.getJSONObject(k)
                days[k] = DayStat(
                    swipes = v.optInt("sw"),
                    shortsSec = v.optInt("sec"),
                    resisted = v.optInt("res"),
                    activities = v.optInt("act"),
                    earned = v.optInt("earn"),
                    focusMin = v.optInt("focus"),
                    sessions = v.optInt("ses"),
                    budget = v.optInt("bud"),
                )
            }
        }
        return AppData(
            brain = o.optDouble("brain", def.brain.toDouble()).toFloat(),
            habits = habits,
            days = days,
            stage = o.optInt("stage", 0).coerceIn(0, STAGES.lastIndex),
            stageDays = o.optInt("stageDays", 0),
            stageGoodDays = o.optInt("stageGoodDays", 0),
            baseline = o.optInt("baseline", 0),
            pace = runCatching { Pace.valueOf(o.optString("pace", def.pace.name)) }.getOrDefault(def.pace),
            justLeveledUp = o.optBoolean("justLeveledUp", false),
            focusUntil = o.optLong("focusUntil", 0L),
            focusMinutes = o.optInt("focusMinutes", 0),
            focusRewarded = o.optBoolean("focusRewarded", true),
            nightShield = o.optBoolean("nightShield", def.nightShield),
            nightStart = o.optInt("nightStart", def.nightStart),
            nightEnd = o.optInt("nightEnd", def.nightEnd),
            zombieCheck = o.optBoolean("zombieCheck", def.zombieCheck),
            futureMsg = o.optString("futureMsg", def.futureMsg),
            lastDay = o.optString("lastDay", def.lastDay),
            onboarded = o.optBoolean("onboarded", false),
            strictUntil = o.optLong("strictUntil", 0L),
            unlockRequestAt = o.optLong("unlockRequestAt", 0L),
        )
    }
}
