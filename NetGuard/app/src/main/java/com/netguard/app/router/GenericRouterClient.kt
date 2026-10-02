package com.netguard.app.router

/** راوتر عام غير معروف الموديل — خطوات يدوية إرشادية. */
class GenericRouterClient(private val creds: RouterCredentials) : HttpSupport(creds.host), RouterClient {

    override suspend fun login(): RouterResult {
        return if (reachable()) RouterResult.Success
        else RouterResult.Error("تعذّر الوصول إلى الراوتر على ${creds.host}.")
    }

    override suspend fun blockMac(mac: String): RouterResult = RouterResult.ManualRequired(
        loginUrl = loginUrl(),
        stepsAr = listOf(
            "افتح عنوان الراوتر في المتصفح: ${loginUrl()}",
            "سجّل الدخول (جرّب admin/admin أو البيانات خلف الراوتر).",
            "ابحث عن قسم اسمه: MAC Filter / Access Control / Parental Control / Device Blocking.",
            "اجعل الوضع Blacklist / Deny.",
            "أضف العنوان: $mac",
            "احفظ (Apply / Save) — سيُفصل الجهاز خلال ثوانٍ.",
        )
    )

    override suspend fun unblockMac(mac: String): RouterResult = RouterResult.ManualRequired(
        loginUrl = loginUrl(),
        stepsAr = listOf(
            "ادخل على ${loginUrl()} ← قسم MAC Filter / Access Control.",
            "احذف العنوان $mac ثم احفظ.",
        )
    )

    override suspend fun listBlocked(): List<String> = emptyList()

    private fun loginUrl() =
        if (creds.host.startsWith("http")) creds.host else "http://${creds.host}"
}
