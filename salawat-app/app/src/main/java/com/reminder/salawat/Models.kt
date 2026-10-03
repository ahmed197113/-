package com.reminder.salawat

data class SurahRef(
    val number: Int,
    val name: String,
    val englishName: String,
    val englishNameTranslation: String,
    val numberOfAyahs: Int,
    val revelationType: String
)

data class AzkarCategoryRef(val id: Int, val title: String)

data class AzkarItem(val text: String, val repeat: Int, val audioUrl: String)

data class AzkarCategory(val title: String, val items: List<AzkarItem>)
