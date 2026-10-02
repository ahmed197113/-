package com.netguard.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.netguard.app.data.Device
import com.netguard.app.network.DeviceTypeClassifier
import com.netguard.app.util.UsageEstimator
import com.netguard.app.viewmodel.DeviceUsage
import com.netguard.app.viewmodel.ScanViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceDetailSheet(device: Device, vm: ScanViewModel, onDismiss: () -> Unit) {
    var usage by remember { mutableStateOf<DeviceUsage?>(null) }
    var name by remember { mutableStateOf(device.customName ?: "") }

    LaunchedEffect(device.mac) { usage = vm.usageFor(device.mac) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp)) {
            Text(
                "${DeviceTypeClassifier.emojiFor(device.deviceType)} ${device.displayName}",
                fontSize = 20.sp, fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(12.dp))

            InfoRow("النوع", DeviceTypeClassifier.labelAr(device.deviceType))
            InfoRow("عنوان IP", device.ip)
            InfoRow("عنوان MAC", device.mac)
            InfoRow("الشركة المصنّعة", device.vendor ?: "غير معروف")
            device.hostname?.let { InfoRow("اسم المضيف", it) }
            InfoRow("الحالة", if (device.blocked) "محظور" else if (device.online) "متصل" else "غير متصل")

            Spacer(Modifier.height(12.dp))
            Text("الاستهلاك هذا الشهر", fontWeight = FontWeight.Bold)
            val u = usage
            if (u == null) {
                Text("جارٍ الحساب…", fontSize = 13.sp)
            } else {
                InfoRow("مدة التواجد", UsageEstimator.formatPresence(u.presenceMinutes))
                InfoRow("البيانات (من الراوتر)", UsageEstimator.formatBytes(u.bytes))
                Text(
                    "ملاحظة: مدة التواجد تُحسب من المراقبة الدورية. حجم البيانات الدقيق لكل جهاز لا يتوفّر إلا إذا كان الراوتر يدعم عدّادات الاستهلاك.",
                    fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = name, onValueChange = { name = it },
                label = { Text("اسم مخصّص للجهاز") },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { vm.rename(device.mac, name) }) { Text("حفظ الاسم") }
                FilterChip(
                    selected = device.trusted,
                    onClick = { vm.setTrusted(device.mac, !device.trusted) },
                    label = { Text(if (device.trusted) "موثوق ✓" else "وضع كموثوق") },
                )
            }

            Spacer(Modifier.height(16.dp))
            if (!device.isSelf && !device.isGateway) {
                Button(
                    onClick = { vm.toggleBlock(device); onDismiss() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (device.blocked) MaterialTheme.colorScheme.secondary else BlockedColor
                    ),
                ) {
                    Text(if (device.blocked) "🔓 إلغاء الحظر" else "🚫 حظر هذا الجهاز من الراوتر")
                }
            } else {
                Text(
                    if (device.isSelf) "لا يمكنك حظر جهازك." else "لا يمكن حظر الراوتر.",
                    fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        Text(value, fontWeight = FontWeight.Medium, fontSize = 13.sp)
    }
}
