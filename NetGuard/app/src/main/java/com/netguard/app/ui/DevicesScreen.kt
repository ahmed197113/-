package com.netguard.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.netguard.app.data.Device
import com.netguard.app.network.DeviceTypeClassifier
import com.netguard.app.viewmodel.ScanViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevicesScreen(vm: ScanViewModel, modifier: Modifier = Modifier) {
    val devices by vm.devices.collectAsStateWithLifecycle()
    val onlineCount by vm.onlineCount.collectAsStateWithLifecycle()
    val ui by vm.ui.collectAsStateWithLifecycle()

    val snackbar = remember { SnackbarHostState() }
    var selected by remember { mutableStateOf<Device?>(null) }

    LaunchedEffect(Unit) {
        vm.refreshWifi()
        if (devices.isEmpty()) vm.scan()
    }
    LaunchedEffect(ui.message) {
        ui.message?.let { snackbar.showSnackbar(it); vm.clearMessage() }
    }

    Scaffold(
        modifier = modifier,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { inner ->
        Column(Modifier.padding(inner).padding(12.dp)) {
            HeaderCard(
                ssid = ui.wifi?.ssid,
                connected = ui.wifi?.connected == true,
                onlineCount = onlineCount,
                totalCount = devices.size,
                scanning = ui.scanning,
                progress = ui.progress,
                onScan = { vm.scan() },
            )
            Spacer(Modifier.height(10.dp))

            if (devices.isEmpty() && !ui.scanning) {
                EmptyState()
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(devices, key = { it.mac }) { d ->
                        DeviceRow(d) { selected = d }
                    }
                }
            }
        }
    }

    selected?.let { dev ->
        DeviceDetailSheet(
            device = dev,
            vm = vm,
            onDismiss = { selected = null },
        )
    }

    ui.manualSteps?.let { steps ->
        ManualStepsDialog(steps) { vm.clearManual() }
    }
}

@Composable
private fun HeaderCard(
    ssid: String?,
    connected: Boolean,
    onlineCount: Int,
    totalCount: Int,
    scanning: Boolean,
    progress: Pair<Int, Int>,
    onScan: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)) {
        Column(Modifier.padding(16.dp).fillMaxWidth()) {
            Text(
                if (connected) "متصل بشبكة: ${ssid ?: "غير معروف"}" else "غير متصل بشبكة واي فاي",
                color = androidx.compose.ui.graphics.Color.White,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "$onlineCount",
                    color = androidx.compose.ui.graphics.Color.White,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("جهاز متصل الآن", color = androidx.compose.ui.graphics.Color.White)
                    Text("من إجمالي $totalCount جهاز معروف",
                        color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.8f),
                        fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(onClick = onScan, enabled = !scanning) {
                if (scanning) {
                    CircularProgressIndicator(Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(if (progress.second > 0) "جارٍ الفحص ${progress.first}/${progress.second}" else "جارٍ الفحص…")
                } else {
                    Text("🔍 فحص الشبكة الآن")
                }
            }
            if (scanning && progress.second > 0) {
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress.first.toFloat() / progress.second },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun DeviceRow(d: Device, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(
            Modifier.padding(12.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(DeviceTypeClassifier.emojiFor(d.deviceType), fontSize = 28.sp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(d.displayName, fontWeight = FontWeight.Bold)
                    if (d.isSelf) { Spacer(Modifier.width(6.dp)); Badge("جهازك", MaterialTheme.colorScheme.secondary) }
                    if (d.isGateway) { Spacer(Modifier.width(6.dp)); Badge("الراوتر", MaterialTheme.colorScheme.primary) }
                }
                Text("${d.ip} • ${d.mac}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "${DeviceTypeClassifier.labelAr(d.deviceType)}${d.vendor?.let { " • $it" } ?: ""}",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val (txt, col) = when {
                    d.blocked -> "محظور" to BlockedColor
                    d.online -> "متصل" to OnlineColor
                    else -> "غير متصل" to MaterialTheme.colorScheme.onSurfaceVariant
                }
                Badge(txt, col)
            }
        }
    }
}

@Composable
private fun Badge(text: String, color: androidx.compose.ui.graphics.Color) {
    Surface(color = color, shape = MaterialTheme.shapes.small) {
        Text(text, color = androidx.compose.ui.graphics.Color.White,
            fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
    }
}

@Composable
private fun EmptyState() {
    Column(
        Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("لا توجد أجهزة بعد", fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text("اضغط «فحص الشبكة الآن» لاكتشاف الأجهزة المتصلة.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
