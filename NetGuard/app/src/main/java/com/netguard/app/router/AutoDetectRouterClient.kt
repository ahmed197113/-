package com.netguard.app.router

/**
 * يحاول تمييز نوع الراوتر من صفحته الرئيسية ثم يفوّض إلى العميل المناسب.
 */
class AutoDetectRouterClient(private val creds: RouterCredentials) : HttpSupport(creds.host), RouterClient {

    private val delegate: RouterClient by lazy { detect() }

    private fun detect(): RouterClient {
        val page = get("/")?.lowercase().orEmpty()
        val brand = when {
            page.contains("huawei") || page.contains("echolife") || page.contains("hg8") -> RouterBrand.HUAWEI
            page.contains("zte") || page.contains("zxhn") -> RouterBrand.ZTE
            else -> RouterBrand.GENERIC
        }
        return RouterClient.create(creds.copy(brand = brand))
    }

    override suspend fun login() = delegate.login()
    override suspend fun blockMac(mac: String) = delegate.blockMac(mac)
    override suspend fun unblockMac(mac: String) = delegate.unblockMac(mac)
    override suspend fun listBlocked() = delegate.listBlocked()
    override suspend fun fetchTraffic() = delegate.fetchTraffic()
}
