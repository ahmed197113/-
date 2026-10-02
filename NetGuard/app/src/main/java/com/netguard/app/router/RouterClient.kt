package com.netguard.app.router

interface RouterClient {
    /** تسجيل الدخول والتحقق من صحة البيانات. */
    suspend fun login(): RouterResult

    /** إضافة MAC إلى قائمة الحظر (MAC Filter / Blacklist). */
    suspend fun blockMac(mac: String): RouterResult

    /** إزالة MAC من قائمة الحظر. */
    suspend fun unblockMac(mac: String): RouterResult

    /** قائمة عناوين MAC المحظورة حاليًا على الراوتر. */
    suspend fun listBlocked(): List<String>

    /** استهلاك الأجهزة إن دعم الراوتر ذلك (قد تعود فارغة). */
    suspend fun fetchTraffic(): List<RouterTraffic> = emptyList()

    companion object {
        fun create(creds: RouterCredentials): RouterClient = when (creds.brand) {
            RouterBrand.HUAWEI -> HuaweiRouterClient(creds)
            RouterBrand.ZTE -> ZteRouterClient(creds)
            RouterBrand.GENERIC -> GenericRouterClient(creds)
            RouterBrand.AUTO -> AutoDetectRouterClient(creds)
        }
    }
}
