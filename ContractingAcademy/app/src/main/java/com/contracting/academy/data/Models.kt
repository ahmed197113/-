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
    val practice: List<Practice>,
) {
    val mindMap: MapNode? get() = blocks.firstOrNull { it.type == "mindmap" }?.map
}

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
 * simple, text, points, steps, example, entry, table, tip, warning, expert, tree,
 * mindmap, analogy, flow, compare, mistakes, summary, formula, taccount
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
    val map: MapNode? = null,
)

/** عقدة في الخريطة الذهنية. [ref] يربط العقدة بدرس (في خريطة المنهج). */
data class MapNode(val text: String, val children: List<MapNode>, val ref: String? = null)

/** تمرين تفاعلي: يحدد المتعلم الطرف المدين والدائن لعملية. */
data class Practice(
    val scenario: String,
    val accounts: List<String>,
    val debit: Set<Int>,
    val credit: Set<Int>,
    val explanation: String,
)

data class Flashcard(val front: String, val back: String, val hint: String)

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
