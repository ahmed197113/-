package com.sahwa.app.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.UUID

/** Minimum daily swipe budget the recovery program converges to. */
const val TARGET_BUDGET = 15

/** Maximum swipes that can be earned back per day by doing rescue activities. */
const val MAX_EARN_PER_DAY = 30

/** Cooling-off period before an emergency exit from strict mode takes effect. */
const val UNLOCK_DELAY_MS = 24L * 60 * 60 * 1000

/** Length of the recovery program in days. */
const val PROGRAM_DAYS = 30

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
)

data class AppData(
    val brain: Float = 60f,
    val habits: List<Habit> = defaultHabits(),
    val days: Map<String, DayStat> = emptyMap(),
    val startBudget: Int = 60,
    val programStart: String = LocalDate.now().toString(),
    val focusUntil: Long = 0L,
    val focusMinutes: Int = 0,
    val focusRewarded: Boolean = true,
    val nightShield: Boolean = true,
    val nightStart: Int = 23,
    val nightEnd: Int = 6,
    val zombieCheck: Boolean = true,
    val gateSeconds: Int = 6,
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

    val programDay: Int
        get() {
            val start = runCatching { LocalDate.parse(programStart) }.getOrDefault(LocalDate.now())
            return ChronoUnit.DAYS.between(start, LocalDate.now()).toInt().coerceAtLeast(0) + 1
        }

    /** Daily swipe allowance: shrinks linearly from [startBudget] to [TARGET_BUDGET] over the program. */
    val baseBudget: Int
        get() {
            val floor = minOf(startBudget, TARGET_BUDGET)
            val d = (programDay - 1).coerceIn(0, PROGRAM_DAYS)
            return (startBudget - (startBudget - floor) * d / PROGRAM_DAYS).coerceAtLeast(floor)
        }

    val remaining: Int get() = (baseBudget + today.earned - today.swipes).coerceAtLeast(0)

    val focusActive: Boolean get() = focusUntil > System.currentTimeMillis()

    fun nightActive(): Boolean {
        if (!nightShield) return false
        val h = LocalTime.now().hour
        return if (nightStart > nightEnd) h >= nightStart || h < nightEnd else h in nightStart until nightEnd
    }
}

enum class BrainLevel(val label: String, val desc: String) {
    RADIANT("متوهّج", "وصلاتك العصبية في أقوى حالاتها. تركيز حاد وذهن صافٍ."),
    CLEAR("صافٍ", "عقل متوازن. استمر وستصل للتوهّج."),
    FOGGY("ضبابي", "بدأ الضباب الذهني. عادة واحدة أو نشاط بديل سيعيد الصفاء."),
    ROTTING("يتعفّن", "التمرير اللانهائي يستنزف دماغك. حان وقت الصحوة."),
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

    private fun AppData.withToday(f: (DayStat) -> DayStat) = copy(days = days + (todayKey to f(today)))

    private fun AppData.brainBy(delta: Float) = copy(brain = (brain + delta).coerceIn(0f, 100f))

    /** Day rollover and focus rewards. Safe to call often. */
    fun tick() {
        val d = _state.value
        val todayKey = LocalDate.now().toString()
        if (d.lastDay != todayKey) {
            update {
                val y = it.day(it.lastDay)
                val bonus = when {
                    y.swipes <= it.baseBudget / 2 -> 5f
                    y.swipes > it.baseBudget -> -3f
                    else -> 1f
                }
                val cutoff = LocalDate.now().minusDays(90).toString()
                it.brainBy(bonus).copy(lastDay = todayKey, days = it.days.filterKeys { k -> k >= cutoff })
            }
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

    fun recordSwipe() = update { it.brainBy(-0.3f).withToday { s -> s.copy(swipes = s.swipes + 1) } }

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

    fun cancelFocus() = update { it.copy(focusUntil = 0L, focusRewarded = true).brainBy(-1f) }

    fun setStartBudget(v: Int) = update { it.copy(startBudget = v) }
    fun setGateSeconds(v: Int) = update { it.copy(gateSeconds = v) }
    fun setNightShield(v: Boolean) = update { it.copy(nightShield = v) }
    fun setNightHours(start: Int, end: Int) = update { it.copy(nightStart = start, nightEnd = end) }
    fun setZombieCheck(v: Boolean) = update { it.copy(zombieCheck = v) }
    fun setFutureMsg(v: String) = update { it.copy(futureMsg = v) }
    fun startStrict(days: Int) = update {
        it.copy(strictUntil = System.currentTimeMillis() + days * 24L * 60 * 60 * 1000, unlockRequestAt = 0L)
    }

    fun requestUnlock() = update { if (it.strictActive) it.copy(unlockRequestAt = System.currentTimeMillis()) else it }
    fun cancelUnlock() = update { it.copy(unlockRequestAt = 0L) }

    fun finishOnboarding(budget: Int, gate: Int, msg: String, strictDays: Int) = update {
        val base = it.copy(
            onboarded = true,
            startBudget = budget,
            gateSeconds = gate,
            futureMsg = msg.ifBlank { it.futureMsg },
            programStart = LocalDate.now().toString(),
        )
        if (strictDays > 0) {
            base.copy(strictUntil = System.currentTimeMillis() + strictDays * 24L * 60 * 60 * 1000, unlockRequestAt = 0L)
        } else base
    }

    fun restartProgram() = update { it.copy(programStart = LocalDate.now().toString()) }

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
                })
            }
        })
        o.put("startBudget", d.startBudget)
        o.put("programStart", d.programStart)
        o.put("focusUntil", d.focusUntil)
        o.put("focusMinutes", d.focusMinutes)
        o.put("focusRewarded", d.focusRewarded)
        o.put("nightShield", d.nightShield)
        o.put("nightStart", d.nightStart)
        o.put("nightEnd", d.nightEnd)
        o.put("zombieCheck", d.zombieCheck)
        o.put("gateSeconds", d.gateSeconds)
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
                )
            }
        }
        return AppData(
            brain = o.optDouble("brain", def.brain.toDouble()).toFloat(),
            habits = habits,
            days = days,
            startBudget = o.optInt("startBudget", def.startBudget),
            programStart = o.optString("programStart", def.programStart),
            focusUntil = o.optLong("focusUntil", 0L),
            focusMinutes = o.optInt("focusMinutes", 0),
            focusRewarded = o.optBoolean("focusRewarded", true),
            nightShield = o.optBoolean("nightShield", def.nightShield),
            nightStart = o.optInt("nightStart", def.nightStart),
            nightEnd = o.optInt("nightEnd", def.nightEnd),
            zombieCheck = o.optBoolean("zombieCheck", def.zombieCheck),
            gateSeconds = o.optInt("gateSeconds", def.gateSeconds),
            futureMsg = o.optString("futureMsg", def.futureMsg),
            lastDay = o.optString("lastDay", def.lastDay),
            onboarded = o.optBoolean("onboarded", false),
            strictUntil = o.optLong("strictUntil", 0L),
            unlockRequestAt = o.optLong("unlockRequestAt", 0L),
        )
    }
}
