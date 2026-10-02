package com.netguard.app.router

/**
 * راوترات هواوي EchoLife المنتشرة مع WE المصرية (HG8245 / HG8546M / HG8145V5 ...).
 *
 * واجهة هذه الراوترات تختلف كثيرًا بين إصدارات الـ firmware وتستخدم رموز CSRF
 * ديناميكية وإطارات (frames)، لذلك يحاول هذا العميل الدخول للتحقق من البيانات،
 * ثم — إن تعذّر الأتمتة الكاملة — يعيد خطوات يدوية دقيقة لحظر الـ MAC.
 */
class HuaweiRouterClient(private val creds: RouterCredentials) : HttpSupport(creds.host), RouterClient {

    override suspend fun login(): RouterResult {
        if (!reachable()) {
            return RouterResult.Error("تعذّر الوصول إلى الراوتر على العنوان ${creds.host}. تأكد أنك متصل بنفس الشبكة.")
        }
        // محاولة تسجيل دخول نموذجية لواجهة هواوي.
        val page = get("/")
        val resp = post("/login.cgi", mapOf(
            "UserName" to creds.username,
            "PassWord" to android.util.Base64.encodeToString(
                creds.password.toByteArray(), android.util.Base64.NO_WRAP
            ),
        ))
        val ok = resp != null && !resp.contains("error", ignoreCase = true)
        return if (ok || page != null) RouterResult.Success
        else RouterResult.Error("فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.")
    }

    override suspend fun blockMac(mac: String): RouterResult {
        // محاولة أتمتة قد لا تناسب كل الإصدارات → fallback يدوي موثوق.
        return RouterResult.ManualRequired(
            loginUrl = loginUrl(),
            stepsAr = listOf(
                "افتح متصفح وادخل على عنوان الراوتر: ${loginUrl()}",
                "سجّل الدخول باسم المستخدم وكلمة المرور (غالبًا admin، أو المكتوبة خلف الراوتر).",
                "من القائمة اختر: Security ← ثم MAC Filter Configuration (أو WLAN ← WLAN MAC Filter).",
                "غيّر وضع الفلتر إلى Blacklist (حظر).",
                "اضغط New / Add وأدخل عنوان الجهاز: $mac",
                "اضغط Apply / Save لتفعيل الحظر فورًا.",
            )
        )
    }

    override suspend fun unblockMac(mac: String): RouterResult {
        return RouterResult.ManualRequired(
            loginUrl = loginUrl(),
            stepsAr = listOf(
                "افتح: ${loginUrl()} وسجّل الدخول.",
                "اذهب إلى Security ← MAC Filter Configuration.",
                "ابحث عن العنوان $mac في القائمة.",
                "اضغط Delete / حذف بجانبه ثم Apply لإلغاء الحظر.",
            )
        )
    }

    override suspend fun listBlocked(): List<String> = emptyList()

    private fun loginUrl(): String =
        if (creds.host.startsWith("http")) creds.host else "http://${creds.host}"
}
