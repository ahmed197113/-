package com.contracting.academy.data

data class Track(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: String,
    val color: Long,
    val comingSoon: Boolean,
    val units: List<LessonUnit>,
)

data class LessonUnit(val title: String, val lessonIds: List<String>)

data class Lesson(
    val id: String,
    val track: String,
    val title: String,
    val level: Level,
    val minutes: Int,
    val summary: String,
    val blocks: List<Block>,
    val sources: List<String>,
    val quiz: List<Question>,
)

enum class Level(val label: String) {
    BEGINNER("مبتدئ"),
    INTERMEDIATE("متوسط"),
    EXPERT("خبير");

    companion object {
        fun from(label: String) = entries.firstOrNull { it.label == label } ?: BEGINNER
    }
}

/**
 * عنصر محتوى داخل الدرس. يحدد [type] طريقة العرض:
 * simple, text, points, steps, example, entry, table, tip, warning, expert, archive
 */
data class Block(
    val type: String,
    val title: String,
    val text: String,
    val items: List<String>,
    val headers: List<String>,
    val rows: List<List<String>>,
    val lines: List<EntryLine>,
    val note: String,
)

data class EntryLine(val account: String, val debit: Double, val credit: Double)

data class Question(
    val question: String,
    val options: List<String>,
    val answer: Int,
    val explanation: String,
)

data class Term(
    val ar: String,
    val en: String,
    val definition: String,
    val category: String,
)

data class Source(
    val id: String,
    val title: String,
    val issuer: String,
    val type: String,
    val description: String,
    val url: String,
)
