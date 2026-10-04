package com.mizan.budget.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [Expense::class, Category::class, Goal::class, CheckIn::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun expenses(): ExpenseDao
    abstract fun categories(): CategoryDao
    abstract fun goals(): GoalDao
    abstract fun checkIns(): CheckInDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "mizani.db")
                .build()
                .also { instance = it }
        }
    }
}
