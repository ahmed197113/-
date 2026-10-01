package com.reminder.salawat

data class SurahRef(
    val number: Int,
    val name: String,
    val englishName: String,
    val englishNameTranslation: String,
    val numberOfAyahs: Int,
    val revelationType: String
)

data class Ayah(val numberInSurah: Int, val text: String, val audioUrl: String)

data class SurahDetail(val number: Int, val name: String, val ayahs: List<Ayah>)

data class AzkarCategoryRef(val id: Int, val title: String)

data class AzkarItem(val text: String, val repeat: Int, val audioUrl: String)

data class AzkarCategory(val title: String, val items: List<AzkarItem>)
