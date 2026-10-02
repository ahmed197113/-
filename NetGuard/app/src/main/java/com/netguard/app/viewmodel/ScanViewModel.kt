package com.netguard.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.netguard.app.MonitorWorker
import com.netguard.app.data.Device
import com.netguard.app.data.DeviceRepository
import com.netguard.app.data.SettingsStore
import com.netguard.app.network.NetworkInfoProvider
import com.netguard.app.network.WifiStatus
import com.netguard.app.router.RouterClient
import com.netguard.app.router.RouterCredentials
import com.netguard.app.router.RouterResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class DeviceUsage(val presenceMinutes: Int, val bytes: Long)

data class UiState(
    val wifi: WifiStatus? = null,
    val scanning: Boolean = false,
    val progress: Pair<Int, Int> = 0 to 0,
    val lastScanEpoch: Long = 0,
    val message: String? = null,
    val manualSteps: RouterResult.ManualRequired? = null,
)

class ScanViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = DeviceRepository(app)
    private val settings = SettingsStore(app)

    val devices: StateFlow<List<Device>> =
        repo.observeDevices().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val onlineCount: StateFlow<Int> =
        repo.observeOnlineCount().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    val credentials: StateFlow<RouterCredentials?> =
        settings.credentialsFlow.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val monitorEnabled: StateFlow<Boolean> =
        settings.monitorEnabledFlow.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val scanInterval: StateFlow<Int> =
        settings.scanIntervalFlow.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 15)

    fun refreshWifi() {
        _ui.value = _ui.value.copy(wifi = NetworkInfoProvider.currentStatus(getApplication()))
    }

    fun scan() {
        if (_ui.value.scanning) return
        viewModelScope.launch {
            _ui.value = _ui.value.copy(scanning = true, progress = 0 to 0, message = null)
            refreshWifi()
            val interval = settings.scanInterval()
            runCatching {
                repo.scanAndSync(interval) { d, t ->
                    _ui.value = _ui.value.copy(progress = d to t)
                }
            }.onFailure {
                _ui.value = _ui.value.copy(message = "فشل المسح: ${it.message}")
            }
            _ui.value = _ui.value.copy(scanning = false, lastScanEpoch = System.currentTimeMillis())
        }
    }

    fun rename(mac: String, name: String?) = viewModelScope.launch { repo.rename(mac, name) }
    fun setTrusted(mac: String, trusted: Boolean) = viewModelScope.launch { repo.setTrusted(mac, trusted) }

    suspend fun usageFor(mac: String): DeviceUsage = withContext(Dispatchers.IO) {
        DeviceUsage(repo.presenceThisMonth(mac), repo.bytesThisMonth(mac))
    }

    /** حظر/إلغاء حظر جهاز عبر الراوتر. */
    fun toggleBlock(device: Device) {
        viewModelScope.launch {
            val creds = settings.credentials()
            if (creds == null) {
                _ui.value = _ui.value.copy(message = "من فضلك اضبط بيانات الراوتر أولًا من الإعدادات.")
                return@launch
            }
            val client = RouterClient.create(creds)
            val result = withContext(Dispatchers.IO) {
                when (val login = client.login()) {
                    is RouterResult.Error -> login
                    else -> if (device.blocked) client.unblockMac(device.mac)
                    else client.blockMac(device.mac)
                }
            }
            when (result) {
                is RouterResult.Success -> {
                    repo.setBlocked(device.mac, !device.blocked)
                    _ui.value = _ui.value.copy(
                        message = if (device.blocked) "تم إلغاء الحظر." else "تم حظر الجهاز."
                    )
                }
                is RouterResult.ManualRequired -> {
                    // نعتبر النية مسجّلة محليًا، ونعرض الخطوات اليدوية
                    repo.setBlocked(device.mac, !device.blocked)
                    _ui.value = _ui.value.copy(manualSteps = result)
                }
                is RouterResult.Error -> {
                    _ui.value = _ui.value.copy(message = result.messageAr)
                }
            }
        }
    }

    fun saveRouter(creds: RouterCredentials) = viewModelScope.launch {
        settings.saveCredentials(creds)
        _ui.value = _ui.value.copy(message = "تم حفظ بيانات الراوتر.")
    }

    fun setMonitor(enabled: Boolean) = viewModelScope.launch {
        settings.setMonitorEnabled(enabled)
        if (enabled) MonitorWorker.schedule(getApplication(), settings.scanInterval())
        else MonitorWorker.cancel(getApplication())
    }

    fun setInterval(min: Int) = viewModelScope.launch {
        settings.setScanInterval(min)
        if (monitorEnabled.value) MonitorWorker.schedule(getApplication(), min)
    }

    fun clearMessage() { _ui.value = _ui.value.copy(message = null) }
    fun clearManual() { _ui.value = _ui.value.copy(manualSteps = null) }
}
