"""
البيانات الأساسية: دليل حسابات مناسب لشركات المقاولات والتجارة في مصر،
التوجيه المحاسبي، الضرائب، القيود الجاهزة.
"""
from decimal import Decimal

from django.db import transaction

from .models import Account, AccountMapping, Company, JournalTemplate, JournalTemplateLine, Tax

# (الكود، الاسم، النوع، الطبيعة الخاصة) - الحساب التجميعي يُستنتج من وجود أبناء
COA = [
    ("1", "الأصول", "asset", "other"),
    ("11", "الأصول غير المتداولة", "asset", "other"),
    ("111", "الأصول الثابتة", "asset", "other"),
    ("1111", "الأراضي", "asset", "other"),
    ("1112", "المباني والإنشاءات", "asset", "other"),
    ("1113", "الآلات والمعدات الثقيلة", "asset", "other"),
    ("1114", "السيارات ووسائل النقل", "asset", "other"),
    ("1115", "الأثاث والتجهيزات المكتبية", "asset", "other"),
    ("1116", "أجهزة الحاسب الآلي", "asset", "other"),
    ("1117", "العدد والأدوات والشدات", "asset", "other"),
    ("112", "مجمع إهلاك الأصول الثابتة", "asset", "other"),
    ("1121", "مجمع إهلاك المباني", "asset", "other"),
    ("1122", "مجمع إهلاك الآلات والمعدات", "asset", "other"),
    ("1123", "مجمع إهلاك السيارات", "asset", "other"),
    ("1124", "مجمع إهلاك الأثاث", "asset", "other"),
    ("1125", "مجمع إهلاك الحاسبات", "asset", "other"),
    ("1126", "مجمع إهلاك العدد والشدات", "asset", "other"),
    ("113", "مشروعات وأصول تحت الإنشاء", "asset", "other"),
    ("1131", "أصول تحت الإنشاء", "asset", "other"),
    ("12", "الأصول المتداولة", "asset", "other"),
    ("121", "النقدية وما في حكمها", "asset", "other"),
    ("1211", "الخزينة الرئيسية", "asset", "cash"),
    ("1212", "عهد خزائن المواقع", "asset", "cash"),
    ("1213", "البنك الأهلي المصري - جاري", "asset", "bank"),
    ("1214", "بنك مصر - جاري", "asset", "bank"),
    ("122", "العملاء والمدينون", "asset", "other"),
    ("1221", "العملاء", "asset", "receivable"),
    ("1222", "أوراق القبض (شيكات تحت التحصيل)", "asset", "other"),
    ("1223", "محتجزات ضمان أعمال لدى العملاء", "asset", "other"),
    ("1224", "سلف وعهد العاملين", "asset", "other"),
    ("1225", "دفعات مقدمة للموردين ومقاولي الباطن", "asset", "other"),
    ("1226", "تأمينات لدى الغير وخطابات ضمان", "asset", "other"),
    ("1227", "مصروفات مدفوعة مقدماً", "asset", "other"),
    ("1228", "مدينون متنوعون", "asset", "other"),
    ("123", "المخزون", "asset", "other"),
    ("1231", "مخزون المواد والخامات", "asset", "other"),
    ("124", "ضرائب مدينة", "asset", "other"),
    ("1241", "ضريبة القيمة المضافة - مدخلات", "asset", "other"),
    ("1242", "ضرائب خصم من المنبع مخصومة منا", "asset", "other"),
    ("125", "أعمال تحت التنفيذ", "asset", "other"),
    ("1251", "أعمال منفذة لم يصدر بها مستخلصات", "asset", "other"),
    ("2", "الخصوم", "liability", "other"),
    ("21", "الخصوم طويلة الأجل", "liability", "other"),
    ("2101", "قروض طويلة الأجل", "liability", "other"),
    ("22", "الخصوم المتداولة", "liability", "other"),
    ("221", "الموردون والدائنون", "liability", "other"),
    ("2211", "الموردون", "liability", "payable"),
    ("2212", "مقاولو الباطن", "liability", "payable"),
    ("2213", "أوراق الدفع (شيكات صادرة)", "liability", "other"),
    ("2214", "محتجزات ضمان أعمال مقاولي الباطن", "liability", "other"),
    ("2215", "دفعات مقدمة من العملاء", "liability", "other"),
    ("2216", "مصروفات مستحقة", "liability", "other"),
    ("2217", "مرتبات وأجور مستحقة", "liability", "other"),
    ("2218", "دائنون متنوعون", "liability", "other"),
    ("222", "الضرائب والتأمينات المستحقة", "liability", "other"),
    ("2221", "ضريبة القيمة المضافة - مخرجات", "liability", "other"),
    ("2222", "ضريبة الخصم والإضافة المستحقة", "liability", "other"),
    ("2223", "تأمينات اجتماعية مستحقة على مقاولي الباطن", "liability", "other"),
    ("2224", "ضريبة كسب العمل", "liability", "other"),
    ("2225", "تأمينات اجتماعية مستحقة - العاملين", "liability", "other"),
    ("2226", "ضريبة الدخل المستحقة", "liability", "other"),
    ("223", "بنوك وقروض قصيرة الأجل", "liability", "other"),
    ("2231", "بنوك سحب على المكشوف", "liability", "other"),
    ("3", "حقوق الملكية", "equity", "other"),
    ("3101", "رأس المال", "equity", "other"),
    ("3201", "الاحتياطي القانوني", "equity", "other"),
    ("3301", "الأرباح (الخسائر) المرحلة", "equity", "other"),
    ("3401", "جاري الشركاء", "equity", "other"),
    ("3501", "أرصدة افتتاحية", "equity", "other"),
    ("4", "الإيرادات", "income", "other"),
    ("41", "إيرادات النشاط", "income", "other"),
    ("4101", "إيرادات مستخلصات المشروعات", "income", "other"),
    ("4102", "إيرادات المبيعات", "income", "other"),
    ("4103", "مردودات ومسموحات المبيعات", "income", "other"),
    ("4104", "إيرادات الخدمات وتأجير المعدات", "income", "other"),
    ("42", "إيرادات أخرى", "income", "other"),
    ("4201", "إيرادات متنوعة", "income", "other"),
    ("4202", "خصم مكتسب", "income", "other"),
    ("4203", "أرباح بيع أصول ثابتة", "income", "other"),
    ("4204", "فوائد دائنة", "income", "other"),
    ("5", "التكاليف والمصروفات", "expense", "other"),
    ("51", "تكاليف المشروعات المباشرة", "expense", "other"),
    ("5101", "مواد وخامات مستخدمة بالمشروعات", "expense", "other"),
    ("5102", "تكلفة أعمال مقاولي الباطن", "expense", "other"),
    ("5103", "أجور ومرتبات المواقع", "expense", "other"),
    ("5104", "إيجار معدات", "expense", "other"),
    ("5105", "وقود وزيوت", "expense", "other"),
    ("5106", "نقل ومشال", "expense", "other"),
    ("5107", "تأمينات اجتماعية على المستخلصات", "expense", "other"),
    ("5108", "مصروفات مواقع متنوعة", "expense", "other"),
    ("5109", "تكلفة البضاعة المباعة", "expense", "other"),
    ("5110", "فروق جرد وتسويات المخزون", "expense", "other"),
    ("52", "المصروفات العمومية والإدارية", "expense", "other"),
    ("5201", "مرتبات وأجور إدارية", "expense", "other"),
    ("5202", "إيجار مكاتب", "expense", "other"),
    ("5203", "كهرباء ومياه", "expense", "other"),
    ("5204", "اتصالات وإنترنت", "expense", "other"),
    ("5205", "أدوات كتابية ومطبوعات", "expense", "other"),
    ("5206", "مصروفات وعمولات بنكية", "expense", "other"),
    ("5207", "أتعاب مهنية واستشارات", "expense", "other"),
    ("5208", "صيانة وإصلاحات", "expense", "other"),
    ("5209", "ضيافة ونظافة", "expense", "other"),
    ("5210", "انتقالات وبدلات سفر", "expense", "other"),
    ("5211", "غرامات وجزاءات", "expense", "other"),
    ("5212", "رسوم واشتراكات حكومية", "expense", "other"),
    ("5213", "خصم مسموح به", "expense", "other"),
    ("5214", "دعاية وإعلان", "expense", "other"),
    ("53", "الإهلاكات", "expense", "other"),
    ("5301", "مصروف إهلاك الأصول الثابتة", "expense", "other"),
    ("54", "المصروفات التمويلية", "expense", "other"),
    ("5401", "فوائد ومصروفات تمويلية", "expense", "other"),
    ("55", "الضرائب على الدخل", "expense", "other"),
    ("5501", "ضريبة الدخل", "expense", "other"),
]

MAPPINGS = {
    "receivable": "1221", "payable": "2211", "subcontractor_payable": "2212", "sales": "4102",
    "sales_return": "4103", "purchase": "5108", "inventory": "1231", "cogs": "5109",
    "project_materials": "5101", "stock_adjustment": "5110", "vat_out": "2221", "vat_in": "1241",
    "wht_receivable": "1242", "wht_payable": "2222", "customer_advance": "2215", "supplier_advance": "1225",
    "retention_receivable": "1223", "retention_payable": "2214", "contract_revenue": "4101",
    "subcontract_cost": "5102", "social_ins_expense": "5107", "social_ins_payable": "2223",
    "retained_earnings": "3301", "opening_equity": "3501", "discount_allowed": "5213",
    "discount_received": "4202",
}

TAXES = [
    ("ض.ق.م 14%", "vat", "14", "both"),
    ("ض.ق.م 5% (مقاولات - جدول)", "vat", "5", "both"),
    ("معفي / صفر", "vat", "0", "both"),
    ("خصم وإضافة 1% (مقاولات وتوريدات)", "wht", "1", "both"),
    ("خصم وإضافة 3% (خدمات)", "wht", "3", "both"),
    ("خصم وإضافة 5% (مهن حرة وعمولات)", "wht", "5", "both"),
]

# (الاسم، البيان، [ (كود الحساب، الجانب، النسبة، البيان، يحمل الجهة، يحمل المشروع) ], يطلب جهة، يطلب مشروع)
TEMPLATES = [
    ("صرف مرتبات الإدارة نقداً", "صرف مرتبات شهر", [
        ("5201", "debit", 100, "مرتبات إدارية", False, False),
        ("1211", "credit", 100, "صرف المرتبات من الخزينة", False, False)], False, False),
    ("صرف أجور عمالة موقع", "صرف أجور عمالة الموقع", [
        ("5103", "debit", 100, "أجور عمالة", False, True),
        ("1212", "credit", 100, "من عهدة الموقع", False, False)], False, True),
    ("صرف عهدة لموقع", "صرف عهدة نقدية للموقع", [
        ("1212", "debit", 100, "عهدة موقع", False, False),
        ("1211", "credit", 100, "من الخزينة الرئيسية", False, False)], False, False),
    ("إيداع نقدية بالبنك", "إيداع نقدية بالبنك", [
        ("1213", "debit", 100, "إيداع", False, False),
        ("1211", "credit", 100, "من الخزينة", False, False)], False, False),
    ("مصروفات بنكية", "عمولات ومصروفات بنكية", [
        ("5206", "debit", 100, "مصروفات بنكية", False, False),
        ("1213", "credit", 100, "خصم من البنك", False, False)], False, False),
    ("سداد إيجار مكتب", "سداد إيجار المكتب", [
        ("5202", "debit", 100, "إيجار", False, False),
        ("1211", "credit", 100, "نقداً", False, False)], False, False),
    ("سداد كهرباء ومياه", "سداد فواتير كهرباء ومياه", [
        ("5203", "debit", 100, "كهرباء ومياه", False, False),
        ("1211", "credit", 100, "نقداً", False, False)], False, False),
    ("شراء وقود لمعدات المشروع", "وقود وزيوت", [
        ("5105", "debit", 100, "وقود وزيوت", False, True),
        ("1212", "credit", 100, "من عهدة الموقع", False, False)], False, True),
    ("إيجار معدات للمشروع (مستحق للمورد)", "إيجار معدات", [
        ("5104", "debit", 100, "إيجار معدات", False, True),
        ("2211", "credit", 100, "مستحق للمؤجر", True, False)], True, True),
    ("زيادة رأس المال نقداً", "زيادة رأس المال", [
        ("1213", "debit", 100, "إيداع رأس المال", False, False),
        ("3101", "credit", 100, "رأس المال", False, False)], False, False),
    ("مسحوبات / جاري الشركاء", "مسحوبات شخصية", [
        ("3401", "debit", 100, "جاري الشركاء", False, False),
        ("1211", "credit", 100, "نقداً", False, False)], False, False),
    ("سلفة لموظف", "سلفة موظف", [
        ("1224", "debit", 100, "سلفة", True, False),
        ("1211", "credit", 100, "نقداً", False, False)], True, False),
    ("سداد ضريبة الخصم والإضافة", "توريد ضريبة الخصم والإضافة", [
        ("2222", "debit", 100, "توريد خصم وإضافة", False, False),
        ("1213", "credit", 100, "من البنك", False, False)], False, False),
    ("سداد ضريبة القيمة المضافة", "سداد إقرار ض.ق.م", [
        ("2221", "debit", 100, "سداد ض.ق.م", False, False),
        ("1213", "credit", 100, "من البنك", False, False)], False, False),
    ("توريد تأمينات مقاولي الباطن", "توريد التأمينات المخصومة من مقاولي الباطن", [
        ("2223", "debit", 100, "توريد تأمينات", False, False),
        ("1213", "credit", 100, "من البنك", False, False)], False, False),
    ("خطاب ضمان (تأمين نقدي لدى البنك)", "غطاء نقدي لخطاب ضمان", [
        ("1226", "debit", 100, "تأمين خطاب ضمان", False, True),
        ("1213", "credit", 100, "من البنك", False, False)], False, True),
    ("إثبات أعمال منفذة لم يصدر بها مستخلص (نهاية الفترة)", "إثبات أعمال تحت التنفيذ", [
        ("1251", "debit", 100, "أعمال تحت التنفيذ", False, True),
        ("4101", "credit", 100, "إيراد أعمال منفذة", False, True)], False, True),
]


@transaction.atomic
def seed_basics(company_name=None):
    company = Company.get()
    if company_name:
        company.name = company_name
        company.save()

    codes = {c for c, *_ in COA}
    parents_with_children = set()
    for code, *_ in COA:
        for i in range(1, len(code)):
            if code[:i] in codes:
                parents_with_children.add(code[:i])

    accounts = {}
    for code, name, typ, kind in COA:
        parent = None
        for i in range(len(code) - 1, 0, -1):
            if code[:i] in accounts:
                parent = accounts[code[:i]]
                break
        acc, _ = Account.objects.get_or_create(
            code=code, defaults=dict(name=name, type=typ, kind=kind, parent=parent,
                                     is_group=code in parents_with_children))
        accounts[code] = acc

    for role, code in MAPPINGS.items():
        AccountMapping.objects.get_or_create(role=role, defaults={"account": Account.objects.get(code=code)})

    for name, kind, rate, scope in TAXES:
        Tax.objects.get_or_create(name=name, defaults=dict(kind=kind, rate=Decimal(rate), scope=scope))

    for name, memo, lines, ask_partner, ask_project in TEMPLATES:
        if JournalTemplate.objects.filter(name=name).exists():
            continue
        t = JournalTemplate.objects.create(name=name, memo=memo, ask_partner=ask_partner, ask_project=ask_project)
        for code, side, pct, label, up, uprj in lines:
            JournalTemplateLine.objects.create(template=t, account=Account.objects.get(code=code), side=side,
                                               percent=pct, label=label, use_partner=up, use_project=uprj)

    from commerce.models import Warehouse
    Warehouse.objects.get_or_create(code="WH1", defaults={"name": "المخزن الرئيسي"})
    return company
