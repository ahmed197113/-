package com.netguard.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface DeviceDao {
    @Query("SELECT * FROM devices ORDER BY online DESC, lastSeen DESC")
    fun observeAll(): Flow<List<Device>>

    @Query("SELECT * FROM devices")
    suspend fun getAll(): List<Device>

    @Query("SELECT * FROM devices WHERE mac = :mac")
    suspend fun getByMac(mac: String): Device?

    @Upsert
    suspend fun upsert(device: Device)

    @Query("UPDATE devices SET online = 0 WHERE lastSeen < :threshold")
    suspend fun markStaleOffline(threshold: Long)

    @Query("UPDATE devices SET blocked = :blocked WHERE mac = :mac")
    suspend fun setBlocked(mac: String, blocked: Boolean)

    @Query("UPDATE devices SET customName = :name WHERE mac = :mac")
    suspend fun rename(mac: String, name: String?)

    @Query("UPDATE devices SET trusted = :trusted WHERE mac = :mac")
    suspend fun setTrusted(mac: String, trusted: Boolean)

    @Query("SELECT COUNT(*) FROM devices WHERE online = 1")
    fun observeOnlineCount(): Flow<Int>
}

@Dao
interface PresenceDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(log: PresenceLog)

    /** إجمالي دقائق الحضور لجهاز خلال فترة زمنية */
    @Query("SELECT COALESCE(SUM(intervalMinutes),0) FROM presence_logs WHERE mac = :mac AND timestamp >= :since")
    suspend fun minutesSince(mac: String, since: Long): Int

    @Query("SELECT COALESCE(SUM(bytesDelta),0) FROM presence_logs WHERE mac = :mac AND timestamp >= :since")
    suspend fun bytesSince(mac: String, since: Long): Long

    @Query("DELETE FROM presence_logs WHERE timestamp < :before")
    suspend fun purgeOlderThan(before: Long)
}
