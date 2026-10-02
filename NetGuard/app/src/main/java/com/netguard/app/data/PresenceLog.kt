package com.netguard.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * سجل حضور: كل مرة يُكتشف فيها جهاز أثناء فحص دوري نسجّل نقطة.
 * من تراكم هذه النقاط نُقدّر زمن تواجد الجهاز على الشبكة (وبالتالي تقدير الاستهلاك).
 */
@Entity(tableName = "presence_logs")
data class PresenceLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mac: String,
    val timestamp: Long,
    /** دقائق الفترة التي يمثّلها هذا السجل (= الفاصل بين الفحوصات) */
    val intervalMinutes: Int,
    /** تقدير البايتات المنقولة خلال الفترة، إن توفّر من الراوتر (وإلا 0) */
    val bytesDelta: Long = 0,
)
