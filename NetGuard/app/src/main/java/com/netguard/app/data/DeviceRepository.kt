package com.netguard.app.data

import android.content.Context
import com.netguard.app.network.NetworkScanner
import com.netguard.app.util.UsageEstimator
import kotlinx.coroutines.flow.Flow

/**
 * الطبقة التي تجمع المسح + قاعدة البيانات + سجل الحضور.
 */
class DeviceRepository(context: Context) {

    private val db = AppDatabase.get(context)
    private val deviceDao = db.deviceDao()
    private val presenceDao = db.presenceDao()
    private val scanner = NetworkScanner(context)

    fun observeDevices(): Flow<List<Device>> = deviceDao.observeAll()
    fun observeOnlineCount(): Flow<Int> = deviceDao.observeOnlineCount()

    /**
     * يجري مسحًا، يحدّث قاعدة البيانات، ويسجّل الحضور.
     * @return قائمة MAC للأجهزة الجديدة التي لم تُرَ من قبل.
     */
    suspend fun scanAndSync(
        intervalMinutes: Int,
        onProgress: (Int, Int) -> Unit = { _, _ -> },
    ): List<String> {
        val results = scanner.scan(onProgress)
        val now = System.currentTimeMillis()
        val newlyDiscovered = mutableListOf<String>()

        results.forEach { r ->
            val existing = deviceDao.getByMac(r.mac)
            if (existing == null) newlyDiscovered += r.mac
            val merged = (existing ?: Device(mac = r.mac, ip = r.ip)).copy(
                ip = r.ip,
                hostname = r.hostname ?: existing?.hostname,
                vendor = r.vendor ?: existing?.vendor,
                deviceType = if (r.deviceType != "unknown") r.deviceType else (existing?.deviceType ?: "unknown"),
                isSelf = r.isSelf,
                isGateway = r.isGateway,
                lastSeen = now,
                online = true,
            )
            deviceDao.upsert(merged)
            presenceDao.insert(
                PresenceLog(mac = r.mac, timestamp = now, intervalMinutes = intervalMinutes)
            )
        }

        // أي جهاز لم يُرَ خلال آخر فترتين نعتبره غير متصل
        deviceDao.markStaleOffline(now - intervalMinutes * 60_000L * 2)
        // تنظيف سجلات أقدم من 90 يومًا
        presenceDao.purgeOlderThan(now - 90L * 24 * 60 * 60 * 1000)
        return newlyDiscovered
    }

    suspend fun setBlocked(mac: String, blocked: Boolean) = deviceDao.setBlocked(mac, blocked)
    suspend fun rename(mac: String, name: String?) = deviceDao.rename(mac, name?.ifBlank { null })
    suspend fun setTrusted(mac: String, trusted: Boolean) = deviceDao.setTrusted(mac, trusted)
    suspend fun getByMac(mac: String) = deviceDao.getByMac(mac)

    /** دقائق تواجد الجهاز هذا الشهر. */
    suspend fun presenceThisMonth(mac: String): Int =
        presenceDao.minutesSince(mac, UsageEstimator.startOfMonth())

    suspend fun bytesThisMonth(mac: String): Long =
        presenceDao.bytesSince(mac, UsageEstimator.startOfMonth())
}
