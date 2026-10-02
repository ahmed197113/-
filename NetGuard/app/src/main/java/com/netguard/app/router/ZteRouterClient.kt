package com.netguard.app.router

/** راوترات ZTE ZXHN (تُوزَّع أحيانًا مع WE). نفس المنطق: تحقق ثم خطوات يدوية. */
class ZteRouterClient(private val creds: RouterCredentials) : HttpSupport(creds.host), RouterClient {

    override suspend fun login(): RouterResult {
        if (!reachable())
            return RouterResult.Error("تعذّر الوصول إلى الراوتر على ${creds.host}.")
        return RouterResult.Success
    }

    override suspend fun blockMac(mac: String): RouterResult = RouterResult.ManualRequired(
        loginUrl = loginUrl(),
        stepsAr = listOf(
            "افتح: ${loginUrl()} وسجّل الدخول (admin غالبًا).",
            "اذهب إلى: Management & Diagnosis ← Access Management، أو Security ← MAC Filter.",
            "فعّل الفلتر واجعله Blacklist.",
            "أضف العنوان: $mac ثم Submit / Apply.",
        )
    )

    override suspend fun unblockMac(mac: String): RouterResult = RouterResult.ManualRequired(
        loginUrl = loginUrl(),
        stepsAr = listOf(
            "ادخل على ${loginUrl()} ← قائمة MAC Filter.",
            "احذف العنوان $mac ثم Apply.",
        )
    )

    override suspend fun listBlocked(): List<String> = emptyList()

    private fun loginUrl() =
        if (creds.host.startsWith("http")) creds.host else "http://${creds.host}"
}
