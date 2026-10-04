package com.mizan.budget.domain

import com.mizan.budget.data.Category

/** Picks the most likely category for a free-text note ("بنزين" → مواصلات). */
object CategoryDetector {
    private fun normalize(s: String) = s.lowercase()
        .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
        .replace('ة', 'ه').replace('ى', 'ي')

    fun detect(note: String, categories: List<Category>): Category? {
        if (note.isBlank()) return null
        val n = normalize(note)
        return categories.firstOrNull { c ->
            normalize(c.name).split(" ").any { it.length > 2 && n.contains(it) } ||
                c.keywords.split(" ").filter { it.isNotBlank() }.any { n.contains(normalize(it)) }
        }
    }

    fun fallback(categories: List<Category>): Category? =
        categories.firstOrNull { it.name == "أخرى" } ?: categories.lastOrNull()
}
