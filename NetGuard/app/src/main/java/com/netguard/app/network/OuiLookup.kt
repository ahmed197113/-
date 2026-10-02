package com.netguard.app.network

import android.content.Context

/**
 * تحديد الشركة المصنّعة من أول 3 بايتات من الـ MAC (OUI).
 *
 * يحتوي على قائمة مدمجة بأشهر الشركات. لتغطية كاملة ضع ملف IEEE الرسمي
 * باسم "oui.txt" داخل app/src/main/assets/ وسيُحمَّل تلقائيًا ويُدمج مع القائمة.
 * تنزيله من: https://standards-oui.ieee.org/oui/oui.txt
 */
object OuiLookup {

    @Volatile private var assetMap: Map<String, String>? = null

    fun vendorFor(mac: String): String? {
        val prefix = mac.lowercase().replace('-', ':').split(":").take(3).joinToString(":")
        return assetMap?.get(prefix) ?: BUILT_IN[prefix]
    }

    /** يُستدعى مرة عند الإقلاع لتحميل ملف OUI الكامل إن وُجد في assets. */
    fun warmUp(context: Context) {
        if (assetMap != null) return
        synchronized(this) {
            if (assetMap != null) return
            assetMap = runCatching { loadFromAssets(context) }.getOrDefault(emptyMap())
        }
    }

    private fun loadFromAssets(context: Context): Map<String, String> {
        val out = HashMap<String, String>(40000)
        context.assets.open("oui.txt").bufferedReader().useLines { lines ->
            lines.forEach { line ->
                // صيغة IEEE: "AABBCC     (base 16)        Vendor Name"
                val idx = line.indexOf("(base 16)")
                if (idx > 0) {
                    val hex = line.substring(0, idx).trim().replace("-", "")
                    if (hex.length >= 6) {
                        val p = hex.substring(0, 6).lowercase()
                        val key = "${p.substring(0,2)}:${p.substring(2,4)}:${p.substring(4,6)}"
                        out[key] = line.substring(idx + 9).trim()
                    }
                }
            }
        }
        return out
    }

    // قائمة مختصرة بأشهر الشركات — كافية لتصنيف معظم الأجهزة المنزلية دون ملف خارجي.
    private val BUILT_IN: Map<String, String> = mapOf(
        "fc:fb:fb" to "Apple", "a4:83:e7" to "Apple", "f0:18:98" to "Apple",
        "3c:15:c2" to "Apple", "d0:81:7a" to "Apple", "ac:bc:32" to "Apple",
        "88:66:5a" to "Apple", "f4:f1:5a" to "Apple",
        "00:1a:11" to "Google", "f4:f5:d8" to "Google", "da:a1:19" to "Google",
        "94:eb:2c" to "Samsung", "b4:07:f9" to "Samsung", "5c:0a:5b" to "Samsung",
        "8c:77:12" to "Samsung", "a0:21:95" to "Samsung", "e8:50:8b" to "Samsung",
        "cc:07:ab" to "Xiaomi", "64:09:80" to "Xiaomi", "28:6c:07" to "Xiaomi",
        "f8:a4:5f" to "Xiaomi", "50:8f:4c" to "Xiaomi",
        "00:e0:4c" to "Realtek", "52:54:00" to "QEMU/Virtual",
        "48:3b:38" to "Huawei", "00:e0:fc" to "Huawei", "ac:e2:15" to "Huawei",
        "80:fb:06" to "Huawei", "c4:07:2f" to "Huawei", "28:3c:e4" to "Huawei",
        "00:1e:10" to "Huawei", "70:72:3c" to "Huawei",
        "00:24:a5" to "Buffalo", "00:1d:0f" to "TP-Link", "50:c7:bf" to "TP-Link",
        "a4:2b:b0" to "TP-Link", "c0:06:c3" to "TP-Link", "98:da:c4" to "TP-Link",
        "00:1f:c6" to "ASUSTek", "2c:fd:a1" to "ASUSTek", "04:d4:c4" to "ASUSTek",
        "00:05:5d" to "D-Link", "14:d6:4d" to "D-Link",
        "00:17:88" to "Philips Hue", "ec:fa:bc" to "Espressif (IoT)",
        "24:0a:c4" to "Espressif (IoT)", "a0:20:a6" to "Espressif (IoT)",
        "b8:27:eb" to "Raspberry Pi", "dc:a6:32" to "Raspberry Pi", "e4:5f:01" to "Raspberry Pi",
        "00:50:56" to "VMware", "08:00:27" to "VirtualBox",
        "00:1b:44" to "SanDisk", "00:24:e4" to "Withings",
        "18:b4:30" to "Nest", "64:16:66" to "Nest",
        "00:04:4b" to "NVIDIA", "48:b0:2d" to "NVIDIA",
        "fc:a1:83" to "Amazon", "44:65:0d" to "Amazon", "68:54:fd" to "Amazon",
        "ac:63:be" to "Amazon", "40:b4:cd" to "Amazon",
        "00:09:18" to "Samsung Electro-Mechanics",
        "74:da:38" to "Edimax", "00:0c:29" to "VMware",
        "60:38:e0" to "Belkin", "ec:1a:59" to "Belkin (WeMo)",
        "00:21:6a" to "Intel", "34:13:e8" to "Intel", "a0:a8:cd" to "Intel",
        "7c:7a:91" to "Intel", "e4:a7:a0" to "Intel",
        "00:16:ea" to "Intel", "3c:a9:f4" to "Intel",
        "d4:6e:0e" to "TP-Link", "c4:6e:1f" to "TP-Link",
        "00:11:32" to "Synology", "90:09:d0" to "Synology",
    )
}
