package com.netguard.app.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.os.Build
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface

data class WifiStatus(
    val connected: Boolean,
    val ssid: String?,
    val localIp: String?,
    val gatewayIp: String?,
    /** عدد البتات في قناع الشبكة، مثلاً 24 لـ 255.255.255.0 */
    val prefixLength: Int,
) {
    /** قائمة كل عناوين IP الممكنة في الشبكة الفرعية (للمسح) */
    fun hostAddresses(): List<String> {
        val ip = localIp ?: return emptyList()
        val parts = ip.split(".")
        if (parts.size != 4) return emptyList()
        // ندعم /24 وما يماثله عمليًا (أغلب الشبكات المنزلية)
        val base = "${parts[0]}.${parts[1]}.${parts[2]}."
        return (1..254).map { base + it }
    }
}

object NetworkInfoProvider {

    fun currentStatus(context: Context): WifiStatus {
        val wifi = context.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as WifiManager
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        val connected = cm.activeNetwork != null
        val ssid = readSsid(wifi)
        val localIp = localIpv4()
        val gateway = gatewayIp(wifi, localIp)
        val prefix = prefixLength(context)

        return WifiStatus(connected, ssid, localIp, gateway, prefix)
    }

    @Suppress("DEPRECATION")
    private fun readSsid(wifi: WifiManager): String? {
        return try {
            val raw = wifi.connectionInfo?.ssid ?: return null
            raw.trim('"').takeIf { it.isNotBlank() && it != "<unknown ssid>" }
        } catch (_: Exception) { null }
    }

    private fun localIpv4(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces().toList()
                .filter { it.isUp && !it.isLoopback }
                .flatMap { it.inetAddresses.toList() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress && it.isSiteLocalAddress }
                ?.hostAddress
        } catch (_: Exception) { null }
    }

    @Suppress("DEPRECATION")
    private fun gatewayIp(wifi: WifiManager, localIp: String?): String? {
        // المحاولة الأولى: DHCP info
        try {
            val gw = wifi.dhcpInfo?.gateway ?: 0
            if (gw != 0) {
                return String.format(
                    "%d.%d.%d.%d",
                    gw and 0xff, gw shr 8 and 0xff, gw shr 16 and 0xff, gw shr 24 and 0xff
                )
            }
        } catch (_: Exception) {}
        // احتياطي: نفترض .1 في نفس الشبكة
        val parts = localIp?.split(".") ?: return null
        if (parts.size != 4) return null
        return "${parts[0]}.${parts[1]}.${parts[2]}.1"
    }

    private fun prefixLength(context: Context): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val net = cm.activeNetwork ?: return 24
                val props = cm.getLinkProperties(net)
                props?.linkAddresses?.forEach { la ->
                    if (la.address is Inet4Address) return la.prefixLength
                }
            } catch (_: Exception) {}
        }
        return 24
    }

    fun reachable(ip: String, timeoutMs: Int = 300): Boolean = try {
        InetAddress.getByName(ip).isReachable(timeoutMs)
    } catch (_: Exception) { false }
}
