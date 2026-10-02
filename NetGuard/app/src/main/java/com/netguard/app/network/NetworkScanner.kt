package com.netguard.app.network

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import java.net.InetAddress

data class ScanResult(
    val mac: String,
    val ip: String,
    val hostname: String?,
    val vendor: String?,
    val deviceType: String,
    val isGateway: Boolean,
    val isSelf: Boolean,
)

/**
 * ماسح الشبكة: يرسل ping لكل العناوين في الشبكة الفرعية بالتوازي لملء جدول ARP،
 * ثم يقرأ الجدول ويربط IP↔MAC، ويستنتج الشركة والنوع واسم المضيف.
 */
class NetworkScanner(private val context: Context) {

    suspend fun scan(onProgress: (Int, Int) -> Unit = { _, _ -> }): List<ScanResult> {
        OuiLookup.warmUp(context)
        val status = NetworkInfoProvider.currentStatus(context)
        val hosts = status.hostAddresses()
        if (hosts.isEmpty()) return emptyList()

        // 1) مسح نشِط بالتوازي (دفعات لتفادي استهلاك كل الخيوط)
        val total = hosts.size
        var done = 0
        withContext(Dispatchers.IO) {
            hosts.chunked(64).forEach { batch ->
                coroutineScope {
                    batch.map { ip ->
                        async {
                            NetworkInfoProvider.reachable(ip, 400)
                            synchronized(this@NetworkScanner) {
                                done++
                                onProgress(done, total)
                            }
                        }
                    }.awaitAll()
                }
            }
        }

        // 2) قراءة جدول ARP بعد امتلائه
        val arp = ArpTable.read().toMutableMap()

        // تأكد من إدراج البوابة وجهازنا حتى لو لم يظهرا في ARP
        status.gatewayIp?.let { gw -> if (!arp.containsKey(gw)) resolveMac(gw)?.let { arp[gw] = it } }

        // 3) بناء النتائج
        return withContext(Dispatchers.IO) {
            arp.entries.map { (ip, mac) ->
                async {
                    val hostname = resolveHostname(ip)
                    val vendor = OuiLookup.vendorFor(mac)
                    val isGateway = ip == status.gatewayIp
                    val isSelf = ip == status.localIp
                    val type = DeviceTypeClassifier.classify(vendor, hostname, isGateway)
                    ScanResult(mac, ip, hostname, vendor, type, isGateway, isSelf)
                }
            }.awaitAll()
        }
    }

    private fun resolveHostname(ip: String): String? = try {
        val name = InetAddress.getByName(ip).canonicalHostName
        if (name == ip) null else name
    } catch (_: Exception) { null }

    /** محاولة الحصول على MAC لعنوان IP من جدول ARP بعد ping مباشر. */
    private fun resolveMac(ip: String): String? {
        NetworkInfoProvider.reachable(ip, 500)
        return ArpTable.read()[ip]
    }
}
