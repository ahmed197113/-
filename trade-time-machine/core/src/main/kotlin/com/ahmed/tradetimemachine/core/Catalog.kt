package com.ahmed.tradetimemachine.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Mirrors design/eras_goods.json (the project's source of truth for eras and goods). */
@Serializable
data class Catalog(val version: Int, val eras: List<Era>)

@Serializable
data class Era(
    val id: String,
    val name_ar: String,
    val name_en: String,
    val year: String,
    val currency: String,
    val base_good: String,
    val goods: List<Good>,
)

@Serializable
data class Good(
    val id: String,
    val name_ar: String,
    val name_en: String,
    val unit: String,
    /** 1 (plentiful) .. 5 (very rare). */
    val scarcity: Int,
    /** Relative to the era's base good (= 1). */
    val base_price: Double,
    val fact_ar: String,
)

object CatalogLoader {
    private val json = Json { ignoreUnknownKeys = true }

    fun parse(text: String): Catalog = json.decodeFromString(Catalog.serializer(), text)

    fun loadDefault(): Catalog {
        val stream = CatalogLoader::class.java.getResourceAsStream("/eras_goods.json")
            ?: error("eras_goods.json missing from resources")
        return parse(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
    }
}
