package com.netguard.app.network

/**
 * تخمين نوع الجهاز اعتمادًا على اسم الشركة المصنّعة واسم المضيف (hostname).
 * ملاحظة: التخمين تقريبي وليس مؤكدًا 100% — لا توجد وسيلة دقيقة تمامًا دون
 * بروتوكولات إضافية (mDNS/UPnP) أو وصول للراوتر.
 */
object DeviceTypeClassifier {

    // الأنواع: phone, computer, tv, iot, console, printer, router, tablet, unknown
    fun classify(vendor: String?, hostname: String?, isGateway: Boolean): String {
        if (isGateway) return "router"
        val v = vendor?.lowercase().orEmpty()
        val h = hostname?.lowercase().orEmpty()
        val s = "$v $h"

        fun any(vararg k: String) = k.any { s.contains(it) }

        return when {
            any("iphone", "android-", "galaxy", "redmi", "oppo", "vivo", "pixel", "oneplus") -> "phone"
            any("ipad", "tablet", "tab-") -> "tablet"
            any("macbook", "imac", "desktop", "laptop", "pc-", "windows", "thinkpad", "-pc") -> "computer"
            any("tv", "bravia", "aquos", "roku", "chromecast", "firestick", "appletv", "shield") -> "tv"
            any("playstation", "ps4", "ps5", "xbox", "nintendo", "switch") -> "console"
            any("printer", "hp-", "canon", "epson", "brother") -> "printer"
            any("espressif", "esp", "tuya", "sonoff", "nest", "hue", "wemo", "shelly", "iot", "camera", "cam-") -> "iot"
            any("raspberry") -> "computer"
            any("apple") -> "phone"            // أغلب أجهزة أبل المنزلية هواتف/تابلت
            any("samsung", "xiaomi", "huawei", "realme") -> "phone"
            any("tp-link", "asus", "d-link", "huawei", "zte", "we ", "router", "gateway") -> "router"
            else -> "unknown"
        }
    }

    fun emojiFor(type: String): String = when (type) {
        "phone" -> "📱"
        "tablet" -> "📟"
        "computer" -> "💻"
        "tv" -> "📺"
        "console" -> "🎮"
        "printer" -> "🖨️"
        "iot" -> "💡"
        "router" -> "🌐"
        else -> "❔"
    }

    fun labelAr(type: String): String = when (type) {
        "phone" -> "هاتف"
        "tablet" -> "تابلت"
        "computer" -> "كمبيوتر"
        "tv" -> "تلفزيون"
        "console" -> "جهاز ألعاب"
        "printer" -> "طابعة"
        "iot" -> "جهاز ذكي"
        "router" -> "راوتر"
        else -> "غير معروف"
    }
}
