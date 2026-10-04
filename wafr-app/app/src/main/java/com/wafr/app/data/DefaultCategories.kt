package com.wafr.app.data

/** Starter categories, tuned for everyday spending in the Arab world. */
object DefaultCategories {
    val list = listOf(
        Category(name = "طعام وبقالة", emoji = "🛒", color = 0xFF34D399, defaultNeed = true, sortOrder = 0,
            keywords = "بقالة سوبرماركت خضار فواكه لحم دجاج خبز تموينات بنده كارفور لولو عثيم طعام اكل أكل"),
        Category(name = "مطاعم وقهوة", emoji = "☕", color = 0xFFFBBF24, defaultNeed = false, sortOrder = 1,
            keywords = "قهوة كوفي مطعم برجر بيتزا شاورما عشاء غداء فطور ستاربكس كافيه حلا توصيل هنقرستيشن طلبات جاهز مرسول"),
        Category(name = "مواصلات ووقود", emoji = "⛽", color = 0xFF60A5FA, defaultNeed = true, sortOrder = 2,
            keywords = "بنزين وقود اوبر أوبر كريم تاكسي مواصلات باص مترو قطار موقف غسيل سيارة صيانة"),
        Category(name = "فواتير وسكن", emoji = "🏠", color = 0xFFA78BFA, defaultNeed = true, sortOrder = 3,
            keywords = "ايجار إيجار كهرباء ماء انترنت إنترنت جوال شحن رصيد فاتورة غاز سكن"),
        Category(name = "تسوق وملابس", emoji = "🛍️", color = 0xFFF472B6, defaultNeed = false, sortOrder = 4,
            keywords = "ملابس حذاء جزمة عطر نون أمازون امازون شي ان تسوق ساعة شنطة اكسسوارات"),
        Category(name = "صحة", emoji = "💊", color = 0xFF2DD4BF, defaultNeed = true, sortOrder = 5,
            keywords = "صيدلية دواء مستشفى طبيب عيادة تحليل اسنان أسنان نظارة"),
        Category(name = "ترفيه", emoji = "🎮", color = 0xFFFB7185, defaultNeed = false, sortOrder = 6,
            keywords = "سينما لعبة العاب ألعاب نتفلكس اشتراك شاهد سبوتيفاي رحلة نزهة ملاهي بلايستيشن"),
        Category(name = "تعليم", emoji = "📚", color = 0xFF818CF8, defaultNeed = true, sortOrder = 7,
            keywords = "كتاب دورة مدرسة جامعة رسوم قرطاسية تعليم كورس"),
        Category(name = "عائلة وهدايا", emoji = "🎁", color = 0xFFFDBA74, defaultNeed = true, sortOrder = 8,
            keywords = "هدية عيدية صدقة زكاة اطفال أطفال حفاضات حليب عائلة"),
        Category(name = "أخرى", emoji = "✨", color = 0xFF94A3B8, defaultNeed = true, sortOrder = 99, keywords = ""),
    )

    val palette = listOf(
        0xFF34D399, 0xFFFBBF24, 0xFF60A5FA, 0xFFA78BFA, 0xFFF472B6,
        0xFF2DD4BF, 0xFFFB7185, 0xFF818CF8, 0xFFFDBA74, 0xFF94A3B8,
    )
}
