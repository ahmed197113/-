package com.contracting.academy.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** يحمّل المحتوى التعليمي من ملفات JSON داخل assets/content مرة واحدة عند بدء التطبيق. */
class ContentRepository(context: Context) {

    val tracks: List<Track>
    val lessons: Map<String, Lesson>
    val glossary: List<Term>
    val sources: Map<String, Source>

    /** ترتيب الدروس كما يظهر في المسارات والوحدات. */
    val orderedLessons: List<Lesson>

    init {
        val assets = context.assets
        fun read(name: String) = assets.open("content/$name").bufferedReader(Charsets.UTF_8).use { it.readText() }

        tracks = JSONArray(read("tracks.json")).objects().map(::parseTrack)

        val lessonFiles = assets.list("content")!!.filter { it.startsWith("lessons_") }.sorted()
        lessons = lessonFiles
            .flatMap { JSONArray(read(it)).objects().map(::parseLesson) }
            .associateBy { it.id }

        orderedLessons = tracks.flatMap { t -> t.units.flatMap { it.lessonIds } }.mapNotNull { lessons[it] }

        glossary = JSONArray(read("glossary.json")).objects().map {
            Term(it.getString("ar"), it.optString("en"), it.getString("def"), it.optString("cat"))
        }.sortedBy { it.ar }

        sources = JSONArray(read("sources.json")).objects().map {
            Source(
                id = it.getString("id"),
                title = it.getString("title"),
                issuer = it.optString("issuer"),
                type = it.optString("type"),
                description = it.optString("desc"),
                url = it.optString("url"),
            )
        }.associateBy { it.id }
    }

    fun track(id: String) = tracks.firstOrNull { it.id == id }

    fun lessonsOf(track: Track) = track.units.flatMap { it.lessonIds }.mapNotNull { lessons[it] }

    fun nextLesson(id: String): Lesson? {
        val i = orderedLessons.indexOfFirst { it.id == id }
        return orderedLessons.getOrNull(i + 1)?.takeIf { it.track == orderedLessons[i].track }
    }

    private fun parseTrack(o: JSONObject) = Track(
        id = o.getString("id"),
        title = o.getString("title"),
        subtitle = o.optString("subtitle"),
        icon = o.optString("icon"),
        color = o.optString("color", "#1F3A5F").removePrefix("#").toLong(16) or 0xFF000000,
        comingSoon = o.optBoolean("comingSoon"),
        units = o.optJSONArray("units").objects().map { u ->
            LessonUnit(u.getString("title"), u.optJSONArray("lessons").strings())
        },
    )

    private fun parseLesson(o: JSONObject) = Lesson(
        id = o.getString("id"),
        track = o.getString("track"),
        title = o.getString("title"),
        level = Level.from(o.optString("level")),
        minutes = o.optInt("minutes", 5),
        summary = o.optString("summary"),
        blocks = o.optJSONArray("blocks").objects().map(::parseBlock),
        sources = o.optJSONArray("sources").strings(),
        quiz = o.optJSONArray("quiz").objects().map {
            Question(
                question = it.getString("q"),
                options = it.getJSONArray("options").strings(),
                answer = it.getInt("answer"),
                explanation = it.optString("explain"),
            )
        },
        practice = o.optJSONArray("practice").objects().map {
            Practice(
                scenario = it.getString("scenario"),
                accounts = it.getJSONArray("accounts").strings(),
                debit = it.getJSONArray("debit").ints().toSet(),
                credit = it.getJSONArray("credit").ints().toSet(),
                explanation = it.optString("explain"),
            )
        },
    )

    private fun parseBlock(o: JSONObject) = Block(
        type = o.optString("type", "text"),
        title = o.optString("title"),
        text = o.optString("text"),
        items = o.optJSONArray("items").strings(),
        headers = o.optJSONArray("headers").strings(),
        rows = o.optJSONArray("rows").arrays().map { it.strings() },
        lines = o.optJSONArray("lines").arrays().map {
            EntryLine(it.getString(0), it.optDouble(1, 0.0), it.optDouble(2, 0.0))
        },
        note = o.optString("note"),
        map = o.optJSONObject("map")?.let(::parseMap),
    )

    private fun parseMap(o: JSONObject): MapNode =
        MapNode(o.getString("t"), o.optJSONArray("c").objects().map(::parseMap))

    /** بطاقات مراجعة مولدة من فروع الخريطة الذهنية وخلاصة الدرس. */
    fun flashcards(lesson: Lesson): List<Flashcard> {
        val cards = mutableListOf<Flashcard>()
        lesson.mindMap?.let { root ->
            root.children.forEach { b ->
                if (b.children.isNotEmpty()) {
                    cards += Flashcard(b.text, b.children.joinToString("\n") { "• " + it.text }, root.text)
                }
            }
        }
        lesson.blocks.filter { it.type == "mistakes" }.forEach { b ->
            b.rows.forEach { r -> if (r.size >= 2) cards += Flashcard("صحّح الخطأ: " + r[0], "✔ " + r[1], "خطأ شائع") }
        }
        return cards
    }

    /** خريطة ذهنية للمنهج كاملاً: المسارات ← الوحدات ← الدروس. */
    val curriculumMap: MapNode by lazy {
        MapNode(
            "المنهج",
            tracks.map { t ->
                MapNode(t.title, t.units.map { u ->
                    MapNode(u.title, u.lessonIds.mapNotNull { lessons[it] }.map { MapNode(it.title, emptyList(), it.id) })
                })
            },
        )
    }

    /** جميع المصطلحات كبطاقات. */
    fun termCards(category: String?): List<Flashcard> =
        glossary.filter { category == null || it.category == category }
            .map { Flashcard(it.ar + if (it.en.isNotBlank()) "\n" + it.en else "", it.definition, it.category) }
}

private fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else List(length()) { getJSONObject(it) }

private fun JSONArray?.arrays(): List<JSONArray> =
    if (this == null) emptyList() else List(length()) { getJSONArray(it) }

private fun JSONArray?.ints(): List<Int> =
    if (this == null) emptyList() else List(length()) { getInt(it) }

private fun JSONArray?.strings(): List<String> =
    if (this == null) emptyList() else List(length()) { getString(it) }
