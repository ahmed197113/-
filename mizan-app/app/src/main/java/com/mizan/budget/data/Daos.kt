package com.mizan.budget.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE timestamp >= :from AND timestamp < :to ORDER BY timestamp DESC")
    fun between(from: Long, to: Long): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE timestamp >= :from AND timestamp < :to ORDER BY timestamp DESC")
    suspend fun betweenOnce(from: Long, to: Long): List<Expense>

    @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
    fun all(): Flow<List<Expense>>

    @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
    suspend fun allOnce(): List<Expense>

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun byId(id: Long): Expense?

    @Insert
    suspend fun insert(expense: Expense): Long

    @Update
    suspend fun update(expense: Expense)

    @Delete
    suspend fun delete(expense: Expense)

    @Query("UPDATE expenses SET categoryId = :to WHERE categoryId = :from")
    suspend fun moveCategory(from: Long, to: Long)

    @Query("DELETE FROM expenses")
    suspend fun clear()
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories WHERE archived = 0 ORDER BY sortOrder, id")
    fun active(): Flow<List<Category>>

    @Query("SELECT * FROM categories ORDER BY sortOrder, id")
    suspend fun allOnce(): List<Category>

    @Query("SELECT COUNT(*) FROM categories")
    suspend fun count(): Int

    @Insert
    suspend fun insertAll(items: List<Category>)

    @Insert
    suspend fun insert(item: Category): Long

    @Update
    suspend fun update(item: Category)
}

@Dao
interface GoalDao {
    @Query("SELECT * FROM goals ORDER BY createdAt")
    fun all(): Flow<List<Goal>>

    @Insert
    suspend fun insert(goal: Goal): Long

    @Update
    suspend fun update(goal: Goal)

    @Delete
    suspend fun delete(goal: Goal)
}

@Dao
interface CheckInDao {
    @Insert
    suspend fun insert(checkIn: CheckIn)

    @Query("SELECT * FROM checkins WHERE timestamp >= :from ORDER BY timestamp DESC")
    fun since(from: Long): Flow<List<CheckIn>>
}
