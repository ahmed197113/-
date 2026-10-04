package com.mizan.budget.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** All money values are stored as minor units (amount × 100) to avoid floating point drift. */
@Entity(tableName = "categories")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val emoji: String,
    val color: Long,
    val monthlyLimit: Long = 0,
    val defaultNeed: Boolean = true,
    /** Space separated words used to auto-detect this category from a free-text note. */
    val keywords: String = "",
    val sortOrder: Int = 0,
    val archived: Boolean = false,
)

@Entity(
    tableName = "expenses",
    indices = [Index("timestamp"), Index("categoryId")],
)
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val amount: Long,
    val categoryId: Long,
    val isNeed: Boolean,
    val note: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    /** Where it was logged from: see [Source]. */
    val source: Int = Source.APP,
) {
    object Source {
        const val APP = 0
        const val NOTIFICATION = 1
        const val WIDGET = 2
        const val TILE = 3
    }
}

@Entity(tableName = "goals")
data class Goal(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val emoji: String,
    val target: Long,
    val saved: Long = 0,
    val createdAt: Long = System.currentTimeMillis(),
)

/** One answer to the periodic "did you spend anything?" check-in. */
@Entity(tableName = "checkins", indices = [Index("timestamp")])
data class CheckIn(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val spent: Boolean,
)
