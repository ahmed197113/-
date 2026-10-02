package com.netguard.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.netguard.app.router.RouterBrand
import com.netguard.app.router.RouterCredentials
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

/**
 * تخزين الإعدادات محليًا. ملاحظة أمان: كلمة مرور الراوتر تُخزَّن على الجهاز؛
 * للإنتاج يُفضَّل تشفيرها عبر Jetpack Security (EncryptedSharedPreferences) أو Keystore.
 */
class SettingsStore(private val context: Context) {

    private object Keys {
        val HOST = stringPreferencesKey("router_host")
        val USER = stringPreferencesKey("router_user")
        val PASS = stringPreferencesKey("router_pass")
        val BRAND = stringPreferencesKey("router_brand")
        val INTERVAL = intPreferencesKey("scan_interval_min")
        val MONITOR = booleanPreferencesKey("monitor_enabled")
        val NOTIFY_NEW = booleanPreferencesKey("notify_new_device")
    }

    val credentialsFlow = context.dataStore.data.map { p ->
        val host = p[Keys.HOST]
        if (host.isNullOrBlank()) null
        else RouterCredentials(
            host = host,
            username = p[Keys.USER].orEmpty(),
            password = p[Keys.PASS].orEmpty(),
            brand = runCatching { RouterBrand.valueOf(p[Keys.BRAND] ?: "AUTO") }.getOrDefault(RouterBrand.AUTO),
        )
    }

    val scanIntervalFlow = context.dataStore.data.map { it[Keys.INTERVAL] ?: 15 }
    val monitorEnabledFlow = context.dataStore.data.map { it[Keys.MONITOR] ?: false }
    val notifyNewFlow = context.dataStore.data.map { it[Keys.NOTIFY_NEW] ?: true }

    suspend fun credentials(): RouterCredentials? = credentialsFlow.first()
    suspend fun scanInterval(): Int = scanIntervalFlow.first()

    suspend fun saveCredentials(c: RouterCredentials) {
        context.dataStore.edit { p ->
            p[Keys.HOST] = c.host
            p[Keys.USER] = c.username
            p[Keys.PASS] = c.password
            p[Keys.BRAND] = c.brand.name
        }
    }

    suspend fun setScanInterval(min: Int) {
        context.dataStore.edit { it[Keys.INTERVAL] = min }
    }

    suspend fun setMonitorEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.MONITOR] = enabled }
    }

    suspend fun setNotifyNew(enabled: Boolean) {
        context.dataStore.edit { it[Keys.NOTIFY_NEW] = enabled }
    }
}
