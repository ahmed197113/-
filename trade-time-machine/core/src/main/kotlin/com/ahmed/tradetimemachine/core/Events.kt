package com.ahmed.tradetimemachine.core

/** A historical happening that shifts one good's price when the player arrives in an era. */
data class MarketEvent(
    val eraId: String,
    val goodId: String,
    val multiplier: Double,
    val text_ar: String,
)

val DEFAULT_EVENTS = listOf(
    MarketEvent("abbasid_baghdad", "silk", 0.6, "وصلت قافلة كبيرة من طريق الحرير: كثرة المعروض خفّضت سعر الحرير."),
    MarketEvent("abbasid_baghdad", "spices", 1.6, "تأخرت سفن الهند بسبب الرياح الموسمية: التوابل شحيحة وسعرها ارتفع."),
    MarketEvent("abbasid_baghdad", "books", 1.4, "بيت الحكمة يشتري المخطوطات للترجمة: الطلب على الكتب ارتفع."),
    MarketEvent("ancient_rome", "wheat", 1.8, "تأخرت سفن القمح القادمة من الإسكندرية: الخبز غالٍ في روما."),
    MarketEvent("ancient_rome", "pepper", 0.7, "وصل أسطول من الهند إلى ميناء أوستيا: الفلفل أرخص هذا الموسم."),
    MarketEvent("ancient_rome", "marble", 1.5, "الإمبراطور يبني معبدًا جديدًا: الطلب على الرخام ارتفع."),
    MarketEvent("pharaonic_egypt", "grain", 0.6, "فيضان النيل كان وفيرًا هذا العام: الحبوب كثيرة ورخيصة."),
    MarketEvent("pharaonic_egypt", "grain", 2.0, "فيضان النيل كان ضعيفًا: الحبوب نادرة وسعرها تضاعف."),
    MarketEvent("pharaonic_egypt", "incense", 0.6, "عادت بعثة من بلاد بونت محمّلة بالبخور: سعره انخفض."),
)
