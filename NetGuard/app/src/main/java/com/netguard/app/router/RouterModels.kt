package com.netguard.app.router

/** بيانات الدخول على الراوتر، تُخزَّن محليًا ومشفّرة قدر الإمكان على الجهاز. */
data class RouterCredentials(
    val host: String,          // مثال: 192.168.1.1
    val username: String,      // مثال: admin
    val password: String,
    val brand: RouterBrand = RouterBrand.AUTO,
)

enum class RouterBrand(val labelAr: String) {
    AUTO("كشف تلقائي"),
    HUAWEI("هواوي (WE / EchoLife)"),
    ZTE("ZTE"),
    GENERIC("عام / آخر"),
}

sealed interface RouterResult {
    data object Success : RouterResult
    data class Error(val messageAr: String, val cause: Throwable? = null) : RouterResult
    /**
     * الراوتر غير مدعوم آليًا لهذا الموديل — نوفّر للمستخدم خطوات يدوية
     * داخل التطبيق لحظر الـ MAC من صفحة الراوتر.
     */
    data class ManualRequired(val stepsAr: List<String>, val loginUrl: String) : RouterResult
}

/** استهلاك جهاز كما يراه الراوتر (إن دعم ذلك). */
data class RouterTraffic(
    val mac: String,
    val rxBytes: Long,
    val txBytes: Long,
)
