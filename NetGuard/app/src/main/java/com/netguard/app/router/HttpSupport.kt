package com.netguard.app.router

import okhttp3.CookieJar
import okhttp3.Cookie
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import java.util.concurrent.TimeUnit

/**
 * عميل HTTP بسيط مع حفظ الكوكيز في الذاكرة (جلسة الراوتر).
 */
open class HttpSupport(protected val host: String) {

    private val cookieStore = mutableListOf<Cookie>()

    protected val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                synchronized(cookieStore) {
                    cookies.forEach { c -> cookieStore.removeAll { it.name == c.name }; cookieStore.add(c) }
                }
            }
            override fun loadForRequest(url: HttpUrl): List<Cookie> =
                synchronized(cookieStore) { cookieStore.toList() }
        })
        .build()

    protected fun baseUrl(): String =
        if (host.startsWith("http")) host.trimEnd('/') else "http://${host.trimEnd('/')}"

    protected fun get(path: String): String? = runCatching {
        client.newCall(Request.Builder().url(baseUrl() + path).build())
            .execute().use { it.body?.string() }
    }.getOrNull()

    protected fun post(path: String, form: Map<String, String>): String? = runCatching {
        val body: RequestBody = FormBody.Builder().apply {
            form.forEach { (k, v) -> add(k, v) }
        }.build()
        client.newCall(Request.Builder().url(baseUrl() + path).post(body).build())
            .execute().use { it.body?.string() }
    }.getOrNull()

    protected fun postRaw(path: String, body: RequestBody, contentType: String? = null): String? = runCatching {
        val req = Request.Builder().url(baseUrl() + path).post(body)
        client.newCall(req.build()).execute().use { it.body?.string() }
    }.getOrNull()

    protected fun reachable(): Boolean = runCatching {
        client.newCall(Request.Builder().url(baseUrl() + "/").build())
            .execute().use { it.isSuccessful || it.code in 300..499 }
    }.getOrDefault(false)
}
