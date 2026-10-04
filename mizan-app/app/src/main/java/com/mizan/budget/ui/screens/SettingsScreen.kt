package com.mizan.budget.ui.screens

import android.app.StatusBarManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.mizan.budget.R
import com.mizan.budget.data.Settings
import com.mizan.budget.domain.Money
import com.mizan.budget.repo
import com.mizan.budget.tile.QuickAddTileService
import com.mizan.budget.ui.MainViewModel
import com.mizan.budget.ui.components.GlassCard
import com.mizan.budget.ui.components.Hairline
import com.mizan.budget.ui.components.SectionTitle
import com.mizan.budget.ui.theme.Mz
import com.mizan.budget.widget.BudgetWidgetReceiver
import com.mizan.budget.widget.CompactWidgetReceiver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.ZoneId

val currencies = listOf("ر.س", "د.إ", "ج.م", "د.ك", "ر.ق", "د.ب", "ر.ع", "د.أ", "د.ع", "ل.س", "د.م", "د.ج", "د.ت", "$", "€")

fun requestTile(context: Context) {
    if (Build.VERSION.SDK_INT >= 33) {
        val sbm = context.getSystemService(StatusBarManager::class.java)
        sbm.requestAddTileService(
            ComponentName(context, QuickAddTileService::class.java),
            "سجّل مصروف",
            Icon.createWithResource(context, R.drawable.ic_tile),
            context.mainExecutor,
        ) { }
    } else {
        Toast.makeText(context, "اسحب ستارة الإشعارات ← اضغط ✏️ تعديل ← اسحب «سجّل مصروف» للأعلى", Toast.LENGTH_LONG).show()
    }
}

fun requestWidget(context: Context, compact: Boolean) {
    val awm = AppWidgetManager.getInstance(context)
    val provider = ComponentName(context, if (compact) CompactWidgetReceiver::class.java else BudgetWidgetReceiver::class.java)
    if (awm.isRequestPinAppWidgetSupported) {
        awm.requestPinAppWidget(provider, null, null)
    } else {
        Toast.makeText(context, "اضغط مطولاً على الشاشة الرئيسية ← الأدوات ← ميزاني", Toast.LENGTH_LONG).show()
    }
}

@Composable
fun SettingsScreen(vm: MainViewModel, settings: Settings, contentPadding: PaddingValues, onBack: () -> Unit) {
    val c = Mz.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var editName by remember { mutableStateOf(false) }
    var confirmWipe by remember { mutableStateOf(false) }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = contentPadding.calculateTopPadding() + 8.dp, bottom = contentPadding.calculateBottomPadding() + 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "رجوع") }
                Text("الإعدادات", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
        }

        item { SectionTitle("الوصول السريع ⚡") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ActionRow("🔔", "اختصار في ستارة الإشعارات", "زر «سجّل مصروف» في الإعدادات السريعة") { requestTile(context) }
                Hairline()
                ActionRow("🧩", "ويدجت الميزانية (كبير)", "المسموح اليوم + أزرار ضروري/كمالي") { requestWidget(context, false) }
                Hairline()
                ActionRow("➕", "ويدجت صغير", "رقم اليوم وزر إضافة") { requestWidget(context, true) }
                Hairline()
                SwitchRow("📌", "إشعار ثابت بالرصيد", "يبقى في الستارة: المتبقي اليوم + إضافة بكتابة المبلغ", settings.statusNotification) { on ->
                    vm.updateSettings { it.copy(statusNotification = on) }
                }
            }
        }

        item { SectionTitle("التذكير الدوري 🔁") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SwitchRow("💭", "اسألني «هل صرفت شيئاً؟»", "تجيب من الإشعار مباشرة: ضروري / كمالي / لم أصرف", settings.remindersEnabled) { on ->
                    vm.updateSettings(reschedule = true) { it.copy(remindersEnabled = on) }
                }
                if (settings.remindersEnabled) {
                    Spacer(Modifier.height(8.dp))
                    Text("كل ${settings.reminderHours} ساعات", fontWeight = FontWeight.Bold)
                    var hours by remember(settings.reminderHours) { mutableStateOf(settings.reminderHours.toFloat()) }
                    Slider(
                        value = hours, onValueChange = { hours = it }, valueRange = 1f..12f, steps = 10,
                        onValueChangeFinished = { vm.updateSettings(reschedule = true) { it.copy(reminderHours = hours.toInt()) } },
                    )
                    Text("أوقات الهدوء (بدون تذكير): من ${settings.quietStart}:00 إلى ${settings.quietEnd}:00", style = MaterialTheme.typography.bodySmall, color = c.muted)
                    HourPicker("بداية الهدوء", settings.quietStart) { h -> vm.updateSettings { it.copy(quietStart = h) } }
                    HourPicker("نهاية الهدوء", settings.quietEnd) { h -> vm.updateSettings { it.copy(quietEnd = h) } }
                    Text("💡 تذكير ذكي: لا يزعجك إن كنت سجّلت مصروفاً خلال آخر ساعة ونصف.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                }
            }
        }

        item { SectionTitle("الحساب 👤") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ActionRow("🙂", "الاسم", settings.userName.ifBlank { "اضغط للإضافة" }) { editName = true }
                Hairline()
                Text("العملة", modifier = Modifier.padding(top = 12.dp, bottom = 6.dp), fontWeight = FontWeight.SemiBold)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(currencies) { cur ->
                        FilterChip(cur == settings.currency, { vm.updateSettings { it.copy(currency = cur) } }, { Text(cur) })
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text("يوم بداية الشهر (يوم الراتب): ${settings.cycleStartDay}", fontWeight = FontWeight.SemiBold)
                var day by remember(settings.cycleStartDay) { mutableStateOf(settings.cycleStartDay.toFloat()) }
                Slider(
                    value = day, onValueChange = { day = it }, valueRange = 1f..28f, steps = 26,
                    onValueChangeFinished = { vm.updateSettings { it.copy(cycleStartDay = day.toInt()) } },
                )
                Hairline()
                Text("المظهر", modifier = Modifier.padding(top = 12.dp, bottom = 6.dp), fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(settings.themeMode == 2, { vm.updateSettings { it.copy(themeMode = 2) } }, { Text("🌙 داكن") })
                    FilterChip(settings.themeMode == 1, { vm.updateSettings { it.copy(themeMode = 1) } }, { Text("☀️ فاتح") })
                    FilterChip(settings.themeMode == 0, { vm.updateSettings { it.copy(themeMode = 0) } }, { Text("📱 تلقائي") })
                }
            }
        }

        item { SectionTitle("البيانات 🔒") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("بياناتك محفوظة على جهازك فقط — بلا حسابات، بلا إعلانات، بلا تتبع.", style = MaterialTheme.typography.bodySmall, color = c.muted)
                Spacer(Modifier.height(6.dp))
                ActionRow("📤", "تصدير إلى Excel (CSV)", "شارك سجلك كاملاً") {
                    scope.launch { exportCsv(context, settings) }
                }
                Hairline()
                ActionRow("🗑️", "حذف كل المصاريف", "لا يمكن التراجع") { confirmWipe = true }
            }
        }
        item {
            Text(
                "ميزاني 1.0 — صُنع بعناية ليجعل كل ريال تحت السيطرة ⚖️",
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp), color = c.muted, fontSize = 12.sp,
            )
        }
    }

    if (editName) {
        var name by remember { mutableStateOf(settings.userName) }
        AlertDialog(
            onDismissRequest = { editName = false },
            title = { Text("اسمك") },
            text = { OutlinedTextField(name, { name = it }, singleLine = true, shape = RoundedCornerShape(16.dp)) },
            confirmButton = { TextButton(onClick = { vm.updateSettings { it.copy(userName = name.trim()) }; editName = false }) { Text("حفظ") } },
            dismissButton = { TextButton(onClick = { editName = false }) { Text("إلغاء") } },
        )
    }
    if (confirmWipe) {
        AlertDialog(
            onDismissRequest = { confirmWipe = false },
            title = { Text("حذف كل المصاريف؟") },
            text = { Text("سيتم حذف السجل بالكامل نهائياً. الفئات والأهداف والإعدادات ستبقى.") },
            confirmButton = { TextButton(onClick = { vm.wipe(); confirmWipe = false }) { Text("حذف", color = c.danger) } },
            dismissButton = { TextButton(onClick = { confirmWipe = false }) { Text("إلغاء") } },
        )
    }
}

private suspend fun exportCsv(context: Context, settings: Settings) {
    val repo = context.repo
    val file = withContext(Dispatchers.IO) {
        val cats = repo.categoriesOnce().associateBy { it.id }
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val f = File(dir, "mizani-export.csv")
        f.bufferedWriter().use { w ->
            w.write("﻿") // BOM so Excel shows Arabic correctly
            w.write("التاريخ,الوقت,المبلغ,العملة,الفئة,النوع,الوصف\n")
            repo.allExpenses().forEach { e ->
                val dt = Instant.ofEpochMilli(e.timestamp).atZone(ZoneId.systemDefault())
                val note = e.note.replace("\"", "\"\"")
                w.write("${dt.toLocalDate()},${dt.toLocalTime().withNano(0)},${Money.plain(e.amount).replace(",", "")},${settings.currency},${cats[e.categoryId]?.name ?: ""},${if (e.isNeed) "ضروري" else "كمالي"},\"$note\"\n")
            }
        }
        f
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val share = Intent(Intent.ACTION_SEND).setType("text/csv").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(Intent.createChooser(share, "تصدير السجل"))
}

@Composable
private fun ActionRow(emoji: String, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(emoji, fontSize = 22.sp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Mz.colors.muted)
        }
    }
}

@Composable
private fun SwitchRow(emoji: String, title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(emoji, fontSize = 22.sp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Mz.colors.muted)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun HourPicker(label: String, hour: Int, onPick: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.width(96.dp), style = MaterialTheme.typography.bodySmall)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            items((0..23).toList()) { h ->
                FilterChip(h == hour, { onPick(h) }, { Text("$h") })
            }
        }
    }
}
