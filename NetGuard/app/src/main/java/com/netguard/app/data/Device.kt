package com.netguard.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * جهاز مكتشَف على الشبكة. المفتاح هو الـ MAC لأنه ثابت بينما الـ IP قد يتغير.
 */
@Entity(tableName = "devices")
data class Device(
    @PrimaryKey val mac: String,
    val ip: String,
    val hostname: String? = null,
    val vendor: String? = null,
    val deviceType: String = "unknown",
    /** اسم مخصّص يكتبه المستخدم (مثلاً: موبايل أحمد) */
    val customName: String? = null,
    /** هل هذا جهاز موثوق (معروف للمستخدم) */
    val trusted: Boolean = false,
    /** هل الجهاز محظور حاليًا على الراوتر */
    val blocked: Boolean = false,
    /** هذا هو جهاز المستخدم نفسه */
    val isSelf: Boolean = false,
    /** هذا هو الراوتر (البوابة) */
    val isGateway: Boolean = false,
    val firstSeen: Long = System.currentTimeMillis(),
    val lastSeen: Long = System.currentTimeMillis(),
    val online: Boolean = true,
) {
    val displayName: String
        get() = customName
            ?: hostname?.takeIf { it.isNotBlank() }
            ?: vendor?.takeIf { it.isNotBlank() }
            ?: "جهاز غير معروف"
}
