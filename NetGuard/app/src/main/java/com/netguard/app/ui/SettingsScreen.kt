package com.netguard.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.netguard.app.router.RouterBrand
import com.netguard.app.router.RouterCredentials
import com.netguard.app.viewmodel.ScanViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: ScanViewModel, modifier: Modifier = Modifier) {
    val creds by vm.credentials.collectAsStateWithLifecycle()
    val monitor by vm.monitorEnabled.collectAsStateWithLifecycle()
    val interval by vm.scanInterval.collectAsStateWithLifecycle()
    val wifi by vm.ui.collectAsStateWithLifecycle()

    var host by remember(creds) { mutableStateOf(creds?.host ?: (wifi.wifi?.gatewayIp ?: "192.168.1.1")) }
    var user by remember(creds) { mutableStateOf(creds?.username ?: "admin") }
    var pass by remember(creds) { mutableStateOf(creds?.password ?: "") }
    var brand by remember(creds) { mutableStateOf(creds?.brand ?: RouterBrand.AUTO) }

    Column(
        modifier.padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("إعدادات الراوتر", fontWeight = FontWeight.Bold, fontSize = 18.sp)

        Card {
            Column(Modifier.padding(16.dp)) {
                OutlinedTextField(host, { host = it }, label = { Text("عنوان الراوتر (IP)") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(user, { user = it }, label = { Text("اسم المستخدم") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(pass, { pass = it }, label = { Text("كلمة المرور") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(10.dp))

                Text("نوع الراوتر", fontSize = 13.sp)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    RouterBrand.entries.forEach { b ->
                        FilterChip(
                            selected = brand == b,
                            onClick = { brand = b },
                            label = { Text(b.labelAr, fontSize = 11.sp) },
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { vm.saveRouter(RouterCredentials(host.trim(), user.trim(), pass, brand)) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("حفظ بيانات الراوتر") }
            }
        }

        Text("المراقبة المستمرة", fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Card {
            Column(Modifier.padding(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("تشغيل المراقبة في الخلفية", fontWeight = FontWeight.Medium)
                        Text("فحص دوري وتنبيه عند دخول جهاز جديد + حساب مدة التواجد.",
                            fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = monitor, onCheckedChange = { vm.setMonitor(it) })
                }
                Spacer(Modifier.height(10.dp))
                Text("كل كام دقيقة يتم الفحص: $interval دقيقة", fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(15, 30, 60, 120).forEach { m ->
                        FilterChip(selected = interval == m, onClick = { vm.setInterval(m) },
                            label = { Text("$m د") })
                    }
                }
            }
        }

        Card {
            Column(Modifier.padding(16.dp)) {
                Text("ملاحظات مهمة", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "• الحظر الحقيقي والدائم يتم من الراوتر عبر فلتر الـ MAC؛ التطبيق يقوم به تلقائيًا إن كان الموديل مدعومًا، وإلا يعرض لك الخطوات الدقيقة.\n" +
                    "• نوع الجهاز تخمين تقريبي من الشركة المصنّعة واسم المضيف.\n" +
                    "• حجم الاستهلاك الدقيق لكل جهاز يتطلب راوترًا يدعم عدّادات الاستهلاك؛ وإلا نعرض مدة التواجد فقط.\n" +
                    "• استخدم التطبيق على شبكتك أنت فقط.",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Spacer(Modifier.height(20.dp))
    }
}
