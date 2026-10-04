package com.wafr.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "wafr_settings")

data class Settings(
    val onboarded: Boolean = false,
    val userName: String = "",
    val currency: String = "ر.س",
    /** Monthly spending budget in minor units. */
    val monthlyBudget: Long = 0,
    val monthlyIncome: Long = 0,
    /** Day of month the budget cycle restarts (salary day). */
    val cycleStartDay: Int = 1,
    val remindersEnabled: Boolean = true,
    val reminderHours: Int = 5,
    val quietStart: Int = 23,
    val quietEnd: Int = 8,
    val statusNotification: Boolean = true,
    /** 0 = follow system, 1 = light, 2 = dark. */
    val themeMode: Int = 2,
    val firstUse: Long = 0,
    val lastCheckInAt: Long = 0,
    val eveningSummary: Boolean = true,
    val lastSummaryDay: Long = 0,
    val gameBest: Int = 0,
    val gameState: String = "",
)

class SettingsStore(private val context: Context) {
    private object K {
        val onboarded = booleanPreferencesKey("onboarded")
        val userName = stringPreferencesKey("user_name")
        val currency = stringPreferencesKey("currency")
        val budget = longPreferencesKey("budget")
        val income = longPreferencesKey("income")
        val cycleDay = intPreferencesKey("cycle_day")
        val reminders = booleanPreferencesKey("reminders")
        val reminderHours = intPreferencesKey("reminder_hours")
        val quietStart = intPreferencesKey("quiet_start")
        val quietEnd = intPreferencesKey("quiet_end")
        val status = booleanPreferencesKey("status_notification")
        val theme = intPreferencesKey("theme")
        val firstUse = longPreferencesKey("first_use")
        val lastCheckIn = longPreferencesKey("last_checkin")
        val evening = booleanPreferencesKey("evening_summary")
        val lastSummary = longPreferencesKey("last_summary_day")
        val gameBest = intPreferencesKey("game_best")
        val gameState = stringPreferencesKey("game_state")
    }

    val flow: Flow<Settings> = context.dataStore.data.map { currentFrom(it) }

    suspend fun current(): Settings = flow.first()

    suspend fun update(transform: (Settings) -> Settings) {
        context.dataStore.edit { p ->
            val s = transform(currentFrom(p))
            p[K.onboarded] = s.onboarded
            p[K.userName] = s.userName
            p[K.currency] = s.currency
            p[K.budget] = s.monthlyBudget
            p[K.income] = s.monthlyIncome
            p[K.cycleDay] = s.cycleStartDay
            p[K.reminders] = s.remindersEnabled
            p[K.reminderHours] = s.reminderHours
            p[K.quietStart] = s.quietStart
            p[K.quietEnd] = s.quietEnd
            p[K.status] = s.statusNotification
            p[K.theme] = s.themeMode
            p[K.firstUse] = s.firstUse
            p[K.lastCheckIn] = s.lastCheckInAt
            p[K.evening] = s.eveningSummary
            p[K.lastSummary] = s.lastSummaryDay
            p[K.gameBest] = s.gameBest
            p[K.gameState] = s.gameState
        }
    }

    private fun currentFrom(p: Preferences): Settings {
        val d = Settings()
        return Settings(
            onboarded = p[K.onboarded] ?: d.onboarded,
            userName = p[K.userName] ?: d.userName,
            currency = p[K.currency] ?: d.currency,
            monthlyBudget = p[K.budget] ?: d.monthlyBudget,
            monthlyIncome = p[K.income] ?: d.monthlyIncome,
            cycleStartDay = p[K.cycleDay] ?: d.cycleStartDay,
            remindersEnabled = p[K.reminders] ?: d.remindersEnabled,
            reminderHours = p[K.reminderHours] ?: d.reminderHours,
            quietStart = p[K.quietStart] ?: d.quietStart,
            quietEnd = p[K.quietEnd] ?: d.quietEnd,
            statusNotification = p[K.status] ?: d.statusNotification,
            themeMode = p[K.theme] ?: d.themeMode,
            firstUse = p[K.firstUse] ?: d.firstUse,
            lastCheckInAt = p[K.lastCheckIn] ?: d.lastCheckInAt,
            eveningSummary = p[K.evening] ?: d.eveningSummary,
            lastSummaryDay = p[K.lastSummary] ?: d.lastSummaryDay,
            gameBest = p[K.gameBest] ?: d.gameBest,
            gameState = p[K.gameState] ?: d.gameState,
        )
    }
}
