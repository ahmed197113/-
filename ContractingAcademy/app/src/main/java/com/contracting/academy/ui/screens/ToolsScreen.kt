package com.contracting.academy.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.contracting.academy.App
import com.contracting.academy.data.Block
import com.contracting.academy.data.EntryLine
import com.contracting.academy.data.money
import com.contracting.academy.data.parseAmount
import com.contracting.academy.data.percent
import com.contracting.academy.ui.Nav
import com.contracting.academy.ui.components.AppBar
import com.contracting.academy.ui.components.IconBadge
import com.contracting.academy.ui.components.iconFor
import com.contracting.academy.ui.theme.Danger
import com.contracting.academy.ui.theme.Success

data class ToolInfo(val id: String, val title: String, val desc: String, val icon: String, val lesson: String)

val tools = listOf(
    ToolInfo("progress", "نسبة الإنجاز والإيراد (IFRS 15)", "طريقة التكلفة إلى التكلفة لحساب الإيراد وأصل/التزام العقد والعقود الخاسرة", "percent", "c05"),
    ToolInfo("ipc", "حاسبة المستخلص", "صافي المستحق بعد المحتجزات واسترداد الدفعة المقدمة والضريبة مع القيد", "invoice", "c07"),
    ToolInfo("depreciation", "إهلاك المعدات", "جدول الإهلاك بالقسط الثابت أو المتناقص لمعدات المشروعات", "depreciation", "c13"),
    ToolInfo("vat", "ضريبة القيمة المضافة 15%", "استخراج الضريبة من مبلغ شامل أو إضافتها لمبلغ غير شامل", "calc", "c17"),
    ToolInfo("zakat", "الزكاة التقريبية", "احتساب الزكاة على الوعاء الزكوي بالسنة الهجرية أو الميلادية", "bank", "c17"),
)

@Composable
fun ToolsScreen(nav: Nav) {
    Scaffold(topBar = { AppBar("الأدوات والحاسبات") }) { pad ->
        LazyColumn(
            Modifier.padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text(
                    "حاسبات عملية مبنية على ما تشرحه الدروس، مع عرض القيد المحاسبي الناتج لتربط الرقم بالمعالجة.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            items(tools, key = { it.id }) { t ->
                Card(onClick = { nav.tool(t.id) }, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBadge(iconFor(t.icon), MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(t.title, style = MaterialTheme.typography.titleMedium)
                            Text(t.desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ToolScreen(id: String, nav: Nav) {
    val info = tools.firstOrNull { it.id == id } ?: return
    Scaffold(topBar = { AppBar(info.title, onBack = { nav.back() }) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(info.desc, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            when (id) {
                "progress" -> ProgressTool()
                "ipc" -> IpcTool()
                "depreciation" -> DepreciationTool()
                "vat" -> VatTool()
                "zakat" -> ZakatTool()
            }
            App.content.lessons[info.lesson]?.let { l ->
                HorizontalDivider()
                Text("للفهم الكامل راجع درس:", style = MaterialTheme.typography.labelLarge)
                LessonRow(l, null, nav)
            }
        }
    }
}

// ------------------------------------------------------------------ عناصر مشتركة

@Composable
private fun AmountField(label: String, value: String, onChange: (String) -> Unit, suffix: String = "") {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        suffix = { if (suffix.isNotEmpty()) Text(suffix) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        isError = value.isNotBlank() && parseAmount(value) == null,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ResultCard(title: String, rows: List<Pair<String, String>>, highlight: Int = -1) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f))) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            rows.forEachIndexed { i, (k, v) ->
                Row {
                    Text(k, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (i == highlight) FontWeight.Bold else FontWeight.Normal)
                    Text(v, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End,
                        fontWeight = if (i == highlight) FontWeight.Bold else FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun Note(text: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(rich(text), style = MaterialTheme.typography.bodySmall, color = color)
}

private fun entry(title: String, note: String, vararg lines: EntryLine) =
    Block("entry", title, "", emptyList(), emptyList(), emptyList(), lines.filter { it.debit != 0.0 || it.credit != 0.0 }, note)

private fun v(s: String) = parseAmount(s) ?: 0.0

// ------------------------------------------------------------------ نسبة الإنجاز

@Composable
private fun ProgressTool() {
    var price by rememberSaveable { mutableStateOf("10000000") }
    var estCost by rememberSaveable { mutableStateOf("8000000") }
    var costToDate by rememberSaveable { mutableStateOf("3200000") }
    var prevRevenue by rememberSaveable { mutableStateOf("2500000") }
    var billed by rememberSaveable { mutableStateOf("3500000") }

    AmountField("سعر العقد (شامل أوامر التغيير المعتمدة)", price, { price = it })
    AmountField("إجمالي التكلفة التقديرية للعقد", estCost, { estCost = it })
    AmountField("التكلفة الفعلية المتكبدة حتى تاريخه", costToDate, { costToDate = it })
    AmountField("الإيراد المعترف به في فترات سابقة", prevRevenue, { prevRevenue = it })
    AmountField("إجمالي ما تمت فوترته (المستخلصات) حتى تاريخه", billed, { billed = it })

    val p = v(price); val e = v(estCost); val c = v(costToDate)
    if (p <= 0 || e <= 0) {
        Note("أدخل سعر العقد والتكلفة التقديرية لعرض النتائج.")
        return
    }
    val pct = (c / e).coerceIn(0.0, 1.0)
    val cumRevenue = p * pct
    val periodRevenue = cumRevenue - v(prevRevenue)
    val expectedProfit = p - e
    val cumProfit = cumRevenue - c
    val position = cumRevenue - v(billed)
    val onerous = expectedProfit < 0

    ResultCard(
        "النتائج",
        listOf(
            "نسبة الإنجاز (تكلفة فعلية ÷ تكلفة تقديرية)" to percent(pct),
            "الإيراد التراكمي المعترف به" to money(cumRevenue),
            "إيراد الفترة الحالية" to money(periodRevenue),
            "مجمل الربح التراكمي" to money(cumProfit),
            "الربح (الخسارة) المتوقعة للعقد كاملاً" to money(expectedProfit),
            (if (position >= 0) "أصل عقد (أعمال منفذة غير مفوترة)" else "التزام عقد (فوترة بالزيادة)") to money(kotlin.math.abs(position)),
        ),
        highlight = 2,
    )
    if (onerous) {
        Note(
            "⚠ **عقد خاسر**: التكلفة التقديرية تتجاوز سعر العقد. وفق IAS 37 يُعترف فوراً بمخصص للخسارة المتوقعة بالكامل " +
                "(${money(-expectedProfit)}) وليس بنسبة الإنجاز فقط.",
            Danger,
        )
    }
    BlockView(
        entry(
            "قيد الاعتراف بإيراد الفترة",
            "يُسجَّل الفرق بين الإيراد التراكمي وما فُوتر في حساب أصل العقد (مدين) أو التزام العقد (دائن) — IFRS 15 الفقرات 105-108. " +
                "القيد أعلاه مبسط ويفترض أن المستخلصات سُجلت مسبقاً على حساب العملاء مقابل حساب أصل/التزام العقد.",
            EntryLine("أصل العقد / التزام العقد", if (periodRevenue > 0) periodRevenue else 0.0, if (periodRevenue < 0) -periodRevenue else 0.0),
            EntryLine("إيرادات العقود", if (periodRevenue < 0) -periodRevenue else 0.0, if (periodRevenue > 0) periodRevenue else 0.0),
        )
    )
    Note("تنبيه: تُستبعد من التكلفة الفعلية التكاليف التي لا تعكس تقدّم الأداء مثل المواد غير المركبة والهدر غير العادي (IFRS 15 فقرة B19).")
}

// ------------------------------------------------------------------ المستخلص

@Composable
private fun IpcTool() {
    var cumWork by rememberSaveable { mutableStateOf("2500000") }
    var prevWork by rememberSaveable { mutableStateOf("1500000") }
    var retPct by rememberSaveable { mutableStateOf("10") }
    var advPct by rememberSaveable { mutableStateOf("15") }
    var vatPct by rememberSaveable { mutableStateOf("15") }

    AmountField("إجمالي الأعمال المنفذة التراكمية حتى هذا المستخلص", cumWork, { cumWork = it })
    AmountField("إجمالي الأعمال في المستخلصات السابقة", prevWork, { prevWork = it })
    AmountField("نسبة محتجزات ضمان حسن التنفيذ", retPct, { retPct = it }, "%")
    AmountField("نسبة استرداد الدفعة المقدمة", advPct, { advPct = it }, "%")
    AmountField("نسبة ضريبة القيمة المضافة", vatPct, { vatPct = it }, "%")

    val work = v(cumWork) - v(prevWork)
    if (work <= 0) {
        Note("قيمة أعمال هذا المستخلص يجب أن تكون أكبر من صفر.")
        return
    }
    val retention = work * v(retPct) / 100
    val advance = work * v(advPct) / 100
    val taxable = work - advance
    val vat = taxable * v(vatPct) / 100
    val net = work - retention - advance + vat

    ResultCard(
        "مستخلص الفترة",
        listOf(
            "قيمة أعمال هذا المستخلص" to money(work),
            "(-) محتجزات ضمان حسن التنفيذ" to money(retention),
            "(-) استرداد الدفعة المقدمة" to money(advance),
            "وعاء الضريبة (الأعمال - الاسترداد)" to money(taxable),
            "(+) ضريبة القيمة المضافة" to money(vat),
            "صافي المستحق للصرف" to money(net),
        ),
        highlight = 5,
    )
    BlockView(
        entry(
            "قيد إثبات المستخلص لدى المقاول",
            "المحتجزات تبقى أصلاً للمقاول (مستحقة لاحقاً)، واسترداد الدفعة المقدمة يخفض الالتزام المسجل عند استلامها. " +
                "افترضنا أن ضريبة الدفعة المقدمة سُددت عند استلامها، لذا تُحتسب ضريبة المستخلص على الأعمال بعد خصم الاسترداد. " +
                "طريقة الاحتساب قد تختلف حسب العقد وتاريخ الاستحقاق الضريبي — راجع أدلة هيئة الزكاة والضريبة والجمارك.",
            EntryLine("العملاء (صافي المستحق)", net, 0.0),
            EntryLine("محتجزات ضمان لدى العملاء", retention, 0.0),
            EntryLine("دفعات مقدمة من العملاء", advance, 0.0),
            EntryLine("إيرادات العقود / أصل العقد", 0.0, work),
            EntryLine("ضريبة القيمة المضافة المستحقة (مخرجات)", 0.0, vat),
        )
    )
}

// ------------------------------------------------------------------ الإهلاك

@Composable
private fun DepreciationTool() {
    var cost by rememberSaveable { mutableStateOf("1200000") }
    var salvage by rememberSaveable { mutableStateOf("120000") }
    var life by rememberSaveable { mutableStateOf("5") }
    var declining by rememberSaveable { mutableStateOf(false) }

    AmountField("تكلفة المعدة (شاملة النقل والتركيب)", cost, { cost = it })
    AmountField("القيمة المتبقية المقدرة", salvage, { salvage = it })
    AmountField("العمر الإنتاجي بالسنوات", life, { life = it })
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = !declining, onClick = { declining = false }, label = { Text("القسط الثابت") })
        FilterChip(selected = declining, onClick = { declining = true }, label = { Text("المتناقص المضاعف") })
    }

    val c = v(cost); val s = v(salvage); val n = v(life).toInt()
    if (c <= 0 || n !in 1..50 || s >= c) {
        Note("أدخل تكلفة أكبر من القيمة المتبقية وعمراً بين 1 و 50 سنة.")
        return
    }
    val rows = mutableListOf<List<String>>()
    var book = c
    var acc = 0.0
    var firstDep = 0.0
    for (y in 1..n) {
        // في المتناقص نستكمل الإهلاك في السنة الأخيرة حتى القيمة المتبقية
        val raw = when {
            !declining -> (c - s) / n
            y == n -> book - s
            else -> minOf(book * 2.0 / n, book - s)
        }
        val dep = raw.coerceAtLeast(0.0)
        if (y == 1) firstDep = dep
        acc += dep
        book -= dep
        rows += listOf("السنة $y", money(dep), money(acc), money(book))
    }
    BlockView(
        Block(
            "table", "جدول الإهلاك", "", emptyList(),
            listOf("السنة", "قسط الإهلاك", "مجمع الإهلاك", "القيمة الدفترية"), rows, emptyList(), "",
        )
    )
    BlockView(
        entry(
            "قيد إهلاك السنة الأولى",
            "إهلاك المعدات المخصصة لمشروع يُحمَّل على تكلفة العقد (ويدخل في نسبة الإنجاز)، أما إهلاك أصول الإدارة فمصروف عمومي — IAS 16.",
            EntryLine("إهلاك معدات المشروعات (تكلفة العقد)", firstDep, 0.0),
            EntryLine("مجمع إهلاك المعدات", 0.0, firstDep),
        )
    )
}

// ------------------------------------------------------------------ ضريبة القيمة المضافة

@Composable
private fun VatTool() {
    var amount by rememberSaveable { mutableStateOf("115000") }
    var inclusive by rememberSaveable { mutableStateOf(true) }
    var rate by rememberSaveable { mutableStateOf("15") }

    AmountField("المبلغ", amount, { amount = it })
    AmountField("النسبة", rate, { rate = it }, "%")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = inclusive, onClick = { inclusive = true }, label = { Text("المبلغ شامل الضريبة") })
        FilterChip(selected = !inclusive, onClick = { inclusive = false }, label = { Text("غير شامل") })
    }
    val a = v(amount); val r = v(rate) / 100
    val base = if (inclusive) a / (1 + r) else a
    val tax = base * r
    ResultCard(
        "النتيجة",
        listOf("المبلغ قبل الضريبة" to money(base), "قيمة الضريبة" to money(tax), "الإجمالي شامل الضريبة" to money(base + tax)),
        highlight = 1,
    )
    Note("في المملكة العربية السعودية النسبة الأساسية 15% منذ 1 يوليو 2020. استخراج الضريبة من مبلغ شامل = المبلغ × 15 ÷ 115.")
}

// ------------------------------------------------------------------ الزكاة

@Composable
private fun ZakatTool() {
    var base by rememberSaveable { mutableStateOf("4000000") }
    var gregorian by rememberSaveable { mutableStateOf(true) }
    AmountField("الوعاء الزكوي (بعد الإضافات والحسميات النظامية)", base, { base = it })
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = gregorian, onClick = { gregorian = true }, label = { Text("سنة ميلادية") })
        FilterChip(selected = !gregorian, onClick = { gregorian = false }, label = { Text("سنة هجرية") })
    }
    val rate = if (gregorian) 0.025 * 365 / 354 else 0.025
    val z = v(base).coerceAtLeast(0.0) * rate
    ResultCard("الزكاة المستحقة", listOf("النسبة المطبقة" to percent(rate), "مبلغ الزكاة" to money(z)), highlight = 1)
    Spacer(Modifier.height(4.dp))
    Note(
        "النسبة 2.5% للسنة الهجرية، وتُعدَّل للسنة الميلادية بنسبة الأيام (365 ÷ 354) فتصبح نحو 2.578%. " +
            "تحديد الوعاء الزكوي نفسه يتطلب تطبيق اللائحة التنفيذية لجباية الزكاة الصادرة عن هيئة الزكاة والضريبة والجمارك؛ هذه الحاسبة تعليمية فقط.",
    )
    Note("مثال قيد الاستحقاق: من حـ/ مصروف الزكاة  إلى حـ/ مخصص الزكاة.", Success)
}
