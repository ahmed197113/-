# -*- coding: utf-8 -*-
"""
مولّد شيت تتبع مستخلصات المشاريع / العقود
Payment Certificates & Billing Tracker
ينتج: Payment_Certificates_Tracker.xlsx
"""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule, DataBarRule, CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.chart import BarChart, LineChart, DoughnutChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as CL

OUT = "Payment_Certificates_Tracker.xlsx"

# ---------------------------------------------------------------- الألوان والتنسيقات
FONT = "Arial"
NAVY, NAVY2 = "1F3A5F", "2C5282"
TEAL, TEAL_L = "2E7D7A", "DCEFEE"
CARD_BG = "FFFFFF"
LINE = "C9D3DD"
INPUT = "FFF8E1"
INPUT_FONT = "0000FF"
LINK_FONT = "008000"
GREEN, GREEN_L = "2E7D32", "E8F5E9"
RED, RED_L = "C62828", "FDECEA"
GOLD, GOLD_L = "9A6B00", "FFF3CD"
GREY_TXT = "5A6772"
ALT = "EEF4F8"
TOTAL_BG = "D9E2EC"

ACC = '#,##0.00;[Red](#,##0.00);"-"'
ACC0 = '#,##0;[Red](#,##0);"-"'
QTY = '#,##0.00;[Red]-#,##0.00;;@'          # الصفر يظهر فارغاً
PCT = '0.0%;[Red]-0.0%;"-"'
DATE = "yyyy/mm/dd"

S_GUIDE = "التعليمات"
S_SET = "بيانات العقد"
S_BOQ = "جدول الكميات"
S_QTY = "الكميات المنفذة"
S_VO = "الأوامر التغييرية"
S_TD = "الاستقطاعات الفنية"
S_REG = "سجل المستخلصات"
S_FORM = "نموذج المستخلص"
S_DASH = "لوحة التحكم"

N_IPC = 24                  # عدد المستخلصات المتاحة
BOQ_FIRST, BOQ_LAST = 6, 105  # 100 بند
REG_FIRST = 6
REG_LAST = REG_FIRST + N_IPC - 1   # 29
REG_TOT = REG_LAST + 1
VO_FIRST, VO_LAST = 6, 55
TD_FIRST, TD_LAST = 6, 105


def R(sheet):
    return f"'{sheet}'!"


thin = Side(style="thin", color=LINE)
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def font(size=10, bold=False, color="1F2933", italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)


def fill(c):
    return PatternFill("solid", start_color=c, end_color=c)


def align(h="right", v="center", wrap=False, indent=0):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap, indent=indent, readingOrder=2)


def style(ws, rng, f=None, fl=None, al=None, bd=None, fmt=None):
    for row in ws[rng]:
        for c in row:
            if f: c.font = f
            if fl: c.fill = fl
            if al: c.alignment = al
            if bd: c.border = bd
            if fmt: c.number_format = fmt


def put(ws, ref, value, f=None, fl=None, al=None, bd=None, fmt=None, merge=None):
    if merge:
        ws.merge_cells(merge)
        style(ws, merge, f, fl, al, bd, fmt)
    c = ws[ref]
    c.value = value
    if f: c.font = f
    if fl: c.fill = fl
    if al: c.alignment = al
    if bd: c.border = bd
    if fmt: c.number_format = fmt
    return c


def setup(ws, widths, tab, zoom=90):
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = zoom
    ws.sheet_properties.tabColor = tab
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.oddFooter.center.text = "صفحة &P من &N"
    ws.oddFooter.right.text = "&A"


SUBTITLE = (f"={R(S_SET)}$C$5&\"   |   عقد رقم: \"&{R(S_SET)}$C$6"
            f"&\"   |   المبالغ بـ \"&{R(S_SET)}$C$14")


def banner(ws, first, last, title, subtitle=SUBTITLE):
    put(ws, f"{first}1", title, font(18, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"{first}1:{last}1")
    ws.row_dimensions[1].height = 38
    put(ws, f"{first}2", subtitle, font(10, False, "FFFFFF", True), fill(NAVY2), align("center"),
        merge=f"{first}2:{last}2")
    ws.row_dimensions[2].height = 20
    ws.row_dimensions[3].height = 26


def button(ws, ref, text, target, color=TEAL):
    c = put(ws, ref, text, font(10, True, "FFFFFF"), fill(color), align("center"),
            Border(left=Side("thin", "FFFFFF"), right=Side("thin", "FFFFFF"),
                   top=Side("thin", "FFFFFF"), bottom=Side("medium", NAVY)))
    c.hyperlink = Hyperlink(ref=ref, location=f"'{target}'!A1", display=text)
    return c


NAV_ALL = [("📊 لوحة التحكم", S_DASH, NAVY), ("⚙ بيانات العقد", S_SET, TEAL), ("📋 الكميات", S_BOQ, TEAL),
           ("📐 المنفذ", S_QTY, TEAL), ("🔁 التغييرية", S_VO, TEAL), ("✂ الاستقطاعات", S_TD, TEAL),
           ("🗂 السجل", S_REG, TEAL), ("🧾 النموذج", S_FORM, TEAL)]


def nav(ws, cols, skip):
    items = [n for n in NAV_ALL if n[1] != skip]
    for col, (t, s, c) in zip(cols, items):
        button(ws, f"{col}3", t, s, c)


def headers(ws, row, cols_titles, color=NAVY, height=40):
    for col, t in cols_titles:
        put(ws, f"{col}{row}", t, font(10, True, "FFFFFF"), fill(color), align("center", wrap=True), BORDER)
    ws.row_dimensions[row].height = height


def section(ws, ref, text, merge, color=TEAL):
    put(ws, ref, text, font(11, True, "FFFFFF"), fill(color), align("right", indent=1), merge=merge)
    ws.row_dimensions[ws[ref].row].height = 22


def add_name(wb, name, ref):
    wb.defined_names[name] = DefinedName(name, attr_text=ref)


def dv_list(ws, formula, rng, msg=None):
    dv = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=True)
    dv.errorTitle = "قيمة غير مسموحة"
    dv.error = "من فضلك اختر قيمة من القائمة المنسدلة."
    if msg:
        dv.promptTitle, dv.prompt, dv.showInputMessage = "إرشاد", msg, True
    ws.add_data_validation(dv)
    for part in rng.split():
        dv.add(part)


def dv_num(ws, rng, kind="decimal", lo=0, hi=None, msg=None):
    if hi is None:
        dv = DataValidation(type=kind, operator="greaterThanOrEqual", formula1=str(lo), allow_blank=True)
    else:
        dv = DataValidation(type=kind, operator="between", formula1=str(lo), formula2=str(hi), allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle = "قيمة غير صحيحة"
    dv.error = "أدخل رقماً صحيحاً ضمن الحدود المسموحة."
    if msg:
        dv.promptTitle, dv.prompt, dv.showInputMessage = "إرشاد", msg, True
    ws.add_data_validation(dv)
    for part in rng.split():
        dv.add(part)


def dv_date(ws, rng):
    dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle, dv.error = "تاريخ غير صحيح", "أدخل تاريخاً صحيحاً بالصيغة yyyy/mm/dd"
    ws.add_data_validation(dv)
    for part in rng.split():
        dv.add(part)


def inp(c, fmt=None, al=None):
    """تنسيق خلية إدخال"""
    c.font = font(10, False, INPUT_FONT)
    c.fill = fill(INPUT)
    c.border = BORDER
    c.alignment = al or align("center")
    if fmt: c.number_format = fmt


def calc(c, fmt=None, al=None, color="1F2933", bold=False, fl=None):
    """تنسيق خلية معادلة"""
    c.font = font(10, bold, color)
    c.border = BORDER
    c.alignment = al or align("center")
    if fl: c.fill = fill(fl)
    if fmt: c.number_format = fmt


def card(ws, row, c1, c2, label, value, fmt=ACC, color=NAVY, big=15):
    put(ws, f"{c1}{row}", label, font(9, True, GREY_TXT), fill(CARD_BG), align("center", wrap=True),
        merge=f"{c1}{row}:{c2}{row}")
    put(ws, f"{c1}{row+1}", value, font(big, True, color), fill(CARD_BG), align("center"),
        fmt=fmt, merge=f"{c1}{row+1}:{c2}{row+1}")
    for r in (row, row + 1):
        for ci in range(ws[f"{c1}1"].column, ws[f"{c2}1"].column + 1):
            ws.cell(r, ci).border = Border(left=Side("thin", LINE), right=Side("thin", LINE),
                                           top=Side("thick", color) if r == row else None,
                                           bottom=Side("thin", LINE) if r == row + 1 else None)
    ws.row_dimensions[row].height = 24
    ws.row_dimensions[row + 1].height = 32


# ---------------------------------------------------------------- القوائم
SECTIONS = ["أعمال الحفر والردم", "الخرسانة العادية والمسلحة", "أعمال المباني", "أعمال العزل",
            "أعمال التشطيبات", "الأعمال الكهربائية", "الأعمال الصحية", "أعمال التكييف", "أعمال الموقع العام"]
IPC_STATUS = ["مسودة", "مقدم للاستشاري", "تحت المراجعة", "معتمد", "مرفوض"]
VO_STATUS = ["معتمد", "قيد الدراسة", "مرفوض"]
VO_TYPE = ["إضافة", "خصم"]
TD_TYPE = ["أعمال غير مطابقة", "أعمال ناقصة", "ملاحظات فنية", "اختبارات غير مستكملة", "مستندات غير مستكملة", "أخرى"]
YESNO = ["نعم", "لا"]

# ---------------------------------------------------------------- بيانات المثال
START = dt.date(2026, 3, 1)
BOQ_ITEMS = [  # الكود، القسم، الوصف، الوحدة، الكمية، السعر
    ("01-001", 0, "حفر عام للأساسات حتى المنسوب التصميمي مع نقل الناتج", "م3", 4500, 120),
    ("01-002", 0, "ردم بناتج الحفر على طبقات مع الدمك والرش", "م3", 2200, 85),
    ("01-003", 0, "إحلال تربة بخليط الزلط والرمل بنسبة 1:1 مع الدمك", "م3", 1800, 450),
    ("02-001", 1, "خرسانة عادية للأساسات عيار 250 كجم أسمنت", "م3", 380, 2600),
    ("02-002", 1, "خرسانة مسلحة للقواعد والسملات (بدون حديد)", "م3", 950, 6800),
    ("02-003", 1, "خرسانة مسلحة للأعمدة والحوائط الخرسانية", "م3", 420, 7500),
    ("02-004", 1, "خرسانة مسلحة للأسقف والكمرات والسلالم", "م3", 1650, 7200),
    ("02-005", 1, "توريد وتركيب حديد تسليح عالي المقاومة", "طن", 480, 48000),
    ("03-001", 2, "مباني طوب أسمنتي مصمت سمك 20 سم", "م2", 7800, 380),
    ("03-002", 2, "مباني طوب أسمنتي سمك 12 سم للقواطيع", "م2", 3600, 290),
    ("04-001", 3, "عزل رطوبة للأساسات بالبيتومين على وجهين", "م2", 2400, 160),
    ("04-002", 3, "عزل مائي وحراري للأسطح بالأغشية والفوم", "م2", 1900, 650),
    ("05-001", 4, "بياض داخلي للحوائط والأسقف", "م2", 21000, 145),
    ("05-002", 4, "بياض خارجي للواجهات بالطرطشة والبؤج", "م2", 6500, 190),
    ("05-003", 4, "توريد وتركيب أرضيات بورسلين 60×60 فرز أول", "م2", 7200, 780),
    ("05-004", 4, "دهانات بلاستيك داخلية 3 أوجه", "م2", 21000, 95),
    ("05-005", 4, "تكسيات واجهات حجر هاشمي سمك 3 سم", "م2", 2800, 1450),
    ("05-006", 4, "توريد وتركيب أبواب خشبية داخلية كاملة", "عدد", 160, 9500),
    ("05-007", 4, "توريد وتركيب شبابيك ألومنيوم قطاع ثقيل", "م2", 950, 3800),
    ("06-001", 5, "تأسيس نقاط إنارة وقوى بالمواسير والأسلاك", "نقطة", 3200, 650),
    ("06-002", 5, "توريد وتركيب لوحات توزيع فرعية", "عدد", 24, 38000),
    ("06-003", 5, "كابلات تغذية رئيسية نحاس معزولة", "م.ط", 1800, 950),
    ("06-004", 5, "توريد وتركيب وحدات إنارة LED", "عدد", 1400, 1250),
    ("07-001", 6, "تغذية مياه بمواسير PPR", "نقطة", 420, 1800),
    ("07-002", 6, "صرف صحي بمواسير UPVC", "نقطة", 380, 1500),
    ("07-003", 6, "توريد وتركيب أجهزة صحية كاملة", "طقم", 96, 14500),
    ("08-001", 7, "توريد وتركيب وحدات تكييف سبليت", "عدد", 120, 42000),
    ("08-002", 7, "مجاري هواء صاج مجلفن معزولة", "م2", 2600, 980),
    ("09-001", 8, "أرصفة وبردورات خرسانية", "م.ط", 1200, 650),
    ("09-002", 8, "أعمال إنترلوك سمك 8 سم على طبقة رمل", "م2", 3500, 420),
]
# نسب التنفيذ (من الكمية التعاقدية) لكل مستخلص من 1 إلى 6
PROG = {
    "01-001": [.35, .40, .20, .05, 0, 0], "01-002": [0, .15, .35, .30, .10, 0],
    "01-003": [.40, .45, .15, 0, 0, 0], "02-001": [.15, .45, .35, .05, 0, 0],
    "02-002": [.05, .35, .40, .15, .05, 0], "02-003": [0, .05, .12, .14, .14, .15],
    "02-004": [0, 0, .06, .10, .11, .12], "02-005": [.04, .14, .12, .10, .09, .10],
    "03-001": [0, 0, 0, .04, .07, .09], "03-002": [0, 0, 0, 0, .03, .05],
    "04-001": [0, .30, .50, .20, 0, 0], "06-001": [0, 0, 0, .02, .04, .06],
    "07-001": [0, 0, .04, .05, .05, .06], "07-002": [0, 0, .06, .05, .05, .05],
}
PLANNED = [.02, .05, .10, .16, .23, .31, .39, .47, .55, .63, .70, .77, .83, .88, .92, .95, .98, 1.0]
MATERIALS = [0, 450000, 900000, 600000, 1100000, 750000]
PENALTIES = {5: 25000}
# التحصيل: (المبلغ المحصل، عدد الأيام بعد الاعتماد)
PAID = {1: (1693779.75, 28), 2: (6422014.94, 35), 3: (6938872.11, 31), 4: (5641921.70, 40), 5: (2400000.00, 29)}
VOS = [
    ("VO-01", dt.date(2026, 5, 18), "إضافة غرفة محولات ولوحة جهد متوسط خارجية", "إضافة", 1250000, "معتمد", 1250000, 4),
    ("VO-02", dt.date(2026, 7, 2), "تعديل مواصفة البورسلين إلى فرز تجاري بموافقة المالك", "خصم", 320000, "معتمد", 320000, 5),
    ("VO-03", dt.date(2026, 8, 25), "أعمال تنسيق موقع وزراعة إضافية", "إضافة", 900000, "قيد الدراسة", None, None),
]
TDS = [
    ("TD-01", dt.date(2026, 5, 3), 2, "02-002", "تعشيش في خرسانة بعض القواعد يلزم معالجته", "أعمال غير مطابقة", 85000, "نعم", 4),
    ("TD-02", dt.date(2026, 6, 4), 3, "04-001", "عدم تقديم نتائج اختبار التصاق العزل", "اختبارات غير مستكملة", 40000, "لا", None),
    ("TD-03", dt.date(2026, 8, 4), 5, "02-004", "ملاحظات على استواء أسطح بلاطات الدور الأول", "ملاحظات فنية", 120000, "لا", None),
    ("TD-04", dt.date(2026, 9, 3), 6, "03-001", "مباني غير مطابقة للمواصفات (عدم ضبط الرأسية)", "أعمال غير مطابقة", 65000, "لا", None),
]


def add_months(d, m):
    y, mo = d.year + (d.month - 1 + m) // 12, (d.month - 1 + m) % 12 + 1
    return dt.date(y, mo, 1)


wb = Workbook()
wsG = wb.active
wsG.title = S_GUIDE
wsD = wb.create_sheet(S_DASH)
wsS = wb.create_sheet(S_SET)
wsB = wb.create_sheet(S_BOQ)
wsQ = wb.create_sheet(S_QTY)
wsV = wb.create_sheet(S_VO)
wsT = wb.create_sheet(S_TD)
wsR = wb.create_sheet(S_REG)
wsF = wb.create_sheet(S_FORM)

# ================================================================= بيانات العقد
ws = wsS
setup(ws, {"A": 2, "B": 40, "C": 30, "D": 58, "E": 3, "F": 30, "G": 22, "H": 22, "I": 26, "J": 12}, NAVY2)
banner(ws, "B", "J", "⚙ بيانات العقد والإعدادات التعاقدية")
nav(ws, ["B", "C", "D", "F", "G", "H", "I"], S_SET)
headers(ws, 4, [("B", "البيان"), ("C", "القيمة"), ("D", "ملاحظات / الأساس التعاقدي")], height=26)

SETTINGS = [  # (row, label, value, fmt, note, kind)  kind: in / f
    (5, "اسم المشروع", "مشروع إنشاء المبنى الإداري - المرحلة الأولى", None, "يظهر في جميع الشيتات والنموذج", "in"),
    (6, "رقم العقد", "CT-2026-014", None, "", "in"),
    (7, "صاحب العمل (المالك)", "شركة النماء للتطوير العقاري", None, "", "in"),
    (8, "الاستشاري / المهندس", "مكتب الهندسة المتحدة للاستشارات", None, "", "in"),
    (9, "المقاول", "شركة البناء الحديث للمقاولات", None, "", "in"),
    (10, "تاريخ توقيع العقد", dt.date(2026, 2, 15), DATE, "", "in"),
    (11, "تاريخ بدء الأعمال (أمر المباشرة)", START, DATE, "بداية احتساب المدة الزمنية", "in"),
    (12, "مدة العقد (بالشهور)", 18, "0", "", "in"),
    (13, "تاريخ الانتهاء التعاقدي", "=EDATE(C11,C12)-1", DATE, "محسوب = البدء + المدة", "f"),
    (14, "العملة", "جنيه مصري", None, "تظهر في عناوين الشيتات", "in"),
    (16, "قيمة العقد الأصلية", f"={R(S_BOQ)}H{BOQ_LAST+1}", ACC, "مرتبطة تلقائياً بإجمالي جدول الكميات", "link"),
    (17, "صافي الأوامر التغييرية المعتمدة", f"=SUMIFS({R(S_VO)}$G${VO_FIRST}:$G${VO_LAST},{R(S_VO)}$H${VO_FIRST}:$H${VO_LAST},\"معتمد\")", ACC, "مرتبطة بشيت الأوامر التغييرية (المعتمدة فقط)", "link"),
    (18, "قيمة العقد المعدلة", "=C16+C17", ACC, "الأصلية + صافي التغييرية المعتمدة", "f"),
    (20, "نسبة الدفعة المقدمة", 0.10, PCT, "من قيمة العقد الأصلية", "in"),
    (21, "قيمة الدفعة المقدمة", "=C16*C20", ACC, "محسوبة", "f"),
    (22, "تاريخ صرف الدفعة المقدمة", dt.date(2026, 3, 10), DATE, "", "in"),
    (23, "نسبة الاسترداد من قيمة الأعمال", 0.125, PCT, "تُخصم من كل مستخلص كنسبة من (الأعمال المنفذة + التغييرية)", "in"),
    (24, "بدء الاسترداد عند نسبة إنجاز", 0.0, PCT, "مثال FIDIC: يبدأ الاسترداد بعد تجاوز 10% من قيمة العقد", "in"),
    (25, "استرداد كامل الرصيد عند نسبة إنجاز", 0.80, PCT, "عند بلوغ هذه النسبة يُسترد كامل الرصيد المتبقي", "in"),
    (27, "نسبة ضمان الأعمال (المحتجزات)", 0.10, PCT, "تُحتجز من إجمالي قيمة الأعمال التراكمية", "in"),
    (28, "الحد الأقصى للضمان (% من العقد المعدل)", 0.05, PCT, "يتوقف الاحتجاز عند بلوغ الحد", "in"),
    (29, "الحد الأقصى للضمان (قيمة)", "=C18*C28", ACC, "محسوب", "f"),
    (31, "نسبة ضريبة القيمة المضافة", 0.14, PCT, "ضع 0% إن لم تكن مطبقة", "in"),
    (32, "احتساب الضريبة قبل خصم الضمان؟", "نعم", None, "نعم = وعاء الضريبة يشمل مبلغ الضمان المحتجز", "in"),
    (33, "نسبة ضريبة الخصم من المنبع", 0.01, PCT, "تُحسب على صافي القيمة قبل خصم الضمان - ضع 0% إن لم تطبق", "in"),
]
for row, label, val, fmt, note, kind in SETTINGS:
    put(ws, f"B{row}", label, font(10, True), fill(ALT), align("right", indent=1), BORDER)
    c = ws[f"C{row}"]
    c.value = val
    if kind == "in":
        inp(c, fmt)
    else:
        calc(c, fmt, color=LINK_FONT if kind == "link" else "1F2933", bold=True, fl="F2F4F7")
    put(ws, f"D{row}", note, font(9, False, GREY_TXT, True), None, align("right", wrap=True), BORDER)
for r, t in [(15, "القيم التعاقدية"), (19, "الدفعة المقدمة واستردادها"), (26, "ضمان الأعمال"), (30, "الضرائب")]:
    section(ws, f"B{r}", t, f"B{r}:D{r}")
dv_list(ws, '"نعم,لا"', "C32")
dv_num(ws, "C20 C23:C25 C27:C28 C31 C33", lo=0, hi=1, msg="أدخل النسبة (مثال: 10%)")
dv_date(ws, "C10:C11 C22")

for name, ref in [("ContractValue", "C16"), ("VOApproved", "C17"), ("RevisedContract", "C18"),
                  ("AdvPct", "C20"), ("AdvAmount", "C21"), ("RecRate", "C23"), ("RecStart", "C24"),
                  ("RecFull", "C25"), ("RetPct", "C27"), ("RetCapPct", "C28"), ("RetCap", "C29"),
                  ("VATPct", "C31"), ("VATBeforeRet", "C32"), ("WHTPct", "C33"),
                  ("StartDate", "C11"), ("EndDate", "C13")]:
    add_name(wb, name, f"{R(S_SET)}${ref[0]}${ref[1:]}")

# القوائم المنسدلة
section(ws, "F4", "القوائم المنسدلة (قابلة للتعديل)", "F4:I4", NAVY2)
lists = [("F", "أقسام الأعمال", SECTIONS), ("G", "حالة المستخلص", IPC_STATUS),
         ("H", "حالة الأمر التغييري", VO_STATUS), ("I", "نوع الاستقطاع الفني", TD_TYPE)]
for col, title, items in lists:
    put(ws, f"{col}5", title, font(10, True, "FFFFFF"), fill(TEAL), align("center", wrap=True), BORDER)
    for i in range(12):
        c = ws[f"{col}{6+i}"]
        c.value = items[i] if i < len(items) else None
        inp(c, al=align("right", indent=1))
add_name(wb, "L_Sections", f"{R(S_SET)}$F$6:$F$17")
add_name(wb, "L_IPCStatus", f"{R(S_SET)}$G$6:$G$17")
add_name(wb, "L_VOStatus", f"{R(S_SET)}$H$6:$H$17")
add_name(wb, "L_TDType", f"{R(S_SET)}$I$6:$I$17")
ws.freeze_panes = "A5"

# ================================================================= جدول الكميات
ws = wsB
setup(ws, {"A": 6, "B": 11, "C": 24, "D": 52, "E": 8, "F": 13, "G": 14, "H": 18, "I": 10}, TEAL)
banner(ws, "A", "I", "📋 جدول الكميات والأسعار التعاقدي (BOQ)")
nav(ws, ["A", "B", "C", "D", "F", "G", "H", "I"], S_BOQ)
put(ws, "A4", "أدخل بنود العقد في الخلايا الصفراء فقط (حتى 100 بند) — الإجمالي يغذي قيمة العقد تلقائياً.",
    font(9, False, GREY_TXT, True), merge="A4:I4", al=align("right"))
headers(ws, 5, [("A", "م"), ("B", "كود البند"), ("C", "القسم"), ("D", "وصف البند"), ("E", "الوحدة"),
                ("F", "الكمية التعاقدية"), ("G", "سعر الوحدة"), ("H", "الإجمالي"), ("I", "الوزن النسبي")])
for i, r in enumerate(range(BOQ_FIRST, BOQ_LAST + 1)):
    item = BOQ_ITEMS[i] if i < len(BOQ_ITEMS) else None
    calc(ws[f"A{r}"], al=align("center"), color=GREY_TXT)
    ws[f"A{r}"] = f'=IF(B{r}="","",COUNTA($B${BOQ_FIRST}:B{r}))'
    for col, val, fmt, al in [("B", item and item[0], None, align("center")),
                              ("C", item and SECTIONS[item[1]], None, align("right", indent=1)),
                              ("D", item and item[2], None, align("right", wrap=True, indent=1)),
                              ("E", item and item[3], None, align("center")),
                              ("F", item and item[4], QTY, align("center")),
                              ("G", item and item[5], QTY, align("center"))]:
        c = ws[f"{col}{r}"]
        c.value = val
        inp(c, fmt, al)
    ws[f"H{r}"] = f"=F{r}*G{r}"
    calc(ws[f"H{r}"], QTY)
    ws[f"I{r}"] = f"=IF($H${BOQ_LAST+1}>0,H{r}/$H${BOQ_LAST+1},0)"
    calc(ws[f"I{r}"], '0.00%;-0.00%;;@')
T = BOQ_LAST + 1
put(ws, f"A{T}", "إجمالي قيمة العقد الأصلية", font(11, True, "FFFFFF"), fill(NAVY), align("center"),
    merge=f"A{T}:G{T}")
put(ws, f"H{T}", f"=SUM(H{BOQ_FIRST}:H{BOQ_LAST})", font(11, True, "FFFFFF"), fill(NAVY), align("center"), fmt=ACC)
put(ws, f"I{T}", f"=SUM(I{BOQ_FIRST}:I{BOQ_LAST})", font(11, True, "FFFFFF"), fill(NAVY), align("center"), fmt=PCT)
ws.row_dimensions[T].height = 26
dv_list(ws, "=L_Sections", f"C{BOQ_FIRST}:C{BOQ_LAST}")
dv_num(ws, f"F{BOQ_FIRST}:G{BOQ_LAST}", lo=0)
ws.conditional_formatting.add(f"I{BOQ_FIRST}:I{BOQ_LAST}",
                              DataBarRule(start_type="num", start_value=0, end_type="max", color="5B9BD5"))
ws.conditional_formatting.add(f"B{BOQ_FIRST}:B{BOQ_LAST}", FormulaRule(
    formula=[f'AND(B{BOQ_FIRST}<>"",COUNTIF($B${BOQ_FIRST}:$B${BOQ_LAST},B{BOQ_FIRST})>1)'],
    fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.freeze_panes = f"E{BOQ_FIRST}"
ws.auto_filter.ref = f"A5:I{BOQ_LAST}"
ws.print_title_rows = "5:5"

# ================================================================= الكميات المنفذة
ws = wsQ
IPC_C1, IPC_CN = 7, 7 + N_IPC - 1            # G .. AD
cG, cAD = CL(IPC_C1), CL(IPC_CN)
cTot, cRem, cPct, cVal, cSt = (CL(IPC_CN + k) for k in range(1, 6))  # AE AF AG AH AI
widths = {"A": 10, "B": 40, "C": 7, "D": 20, "E": 12, "F": 12}
for ci in range(IPC_C1, IPC_CN + 1):
    widths[CL(ci)] = 11
widths.update({cTot: 13, cRem: 13, cPct: 11, cVal: 17, cSt: 14})
setup(ws, widths, TEAL, zoom=85)
banner(ws, "A", cSt, "📐 الكميات المنفذة خلال كل مستخلص (حصر الأعمال)")
nav(ws, ["A", "B", "D", "E", "F", "G", "H", "I"], S_QTY)
put(ws, "J3", "أدخل كمية الفترة فقط (غير تراكمية) أمام كل بند تحت رقم المستخلص — يتم حساب التراكمي آلياً.",
    font(9, True, GOLD), fill(GOLD_L), align("right", wrap=True), merge=f"J3:{cSt}3")
put(ws, f"{cG}4", "الكميات المنفذة خلال الفترة (إدخال)", font(10, True, "FFFFFF"), fill(TEAL), align("center"),
    merge=f"{cG}4:{cAD}4")
put(ws, f"{cTot}4", "التحليل التراكمي (محسوب)", font(10, True, "FFFFFF"), fill(NAVY2), align("center"),
    merge=f"{cTot}4:{cSt}4")
headers(ws, 5, [("A", "كود البند"), ("B", "وصف البند"), ("C", "الوحدة"), ("D", "القسم"),
                ("E", "الكمية التعاقدية"), ("F", "سعر الوحدة"),
                (cTot, "إجمالي الكمية المنفذة"), (cRem, "الكمية المتبقية"), (cPct, "نسبة إنجاز البند"),
                (cVal, "القيمة المنفذة التراكمية"), (cSt, "حالة البند")])
for k in range(N_IPC):
    c = ws.cell(5, IPC_C1 + k, k + 1)
    c.font, c.fill, c.alignment, c.border = font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER
    c.number_format = '"مستخلص "0'
for i, r in enumerate(range(BOQ_FIRST, BOQ_LAST + 1)):
    b = R(S_BOQ)
    for col, f, fmt, al in [("A", f'=IF({b}B{r}="","",{b}B{r})', None, align("center")),
                            ("B", f'=IF({b}D{r}="","",{b}D{r})', None, align("right", indent=1)),
                            ("C", f'=IF({b}E{r}="","",{b}E{r})', None, align("center")),
                            ("D", f'=IF({b}C{r}="","",{b}C{r})', None, align("right", indent=1)),
                            ("E", f"=N({b}F{r})", QTY, None), ("F", f"=N({b}G{r})", QTY, None)]:
        ws[f"{col}{r}"] = f
        calc(ws[f"{col}{r}"], fmt, al, color=LINK_FONT)
    item = BOQ_ITEMS[i] if i < len(BOQ_ITEMS) else None
    prog = PROG.get(item[0]) if item else None
    for k in range(N_IPC):
        c = ws.cell(r, IPC_C1 + k)
        if prog and k < len(prog) and prog[k]:
            c.value = round(item[4] * prog[k], 2)
        inp(c, QTY)
    ws[f"{cTot}{r}"] = f"=SUM({cG}{r}:{cAD}{r})"
    ws[f"{cRem}{r}"] = f"=E{r}-{cTot}{r}"
    ws[f"{cPct}{r}"] = f"=IF(E{r}>0,{cTot}{r}/E{r},0)"
    ws[f"{cVal}{r}"] = f"={cTot}{r}*F{r}"
    ws[f"{cSt}{r}"] = (f'=IF(A{r}="","",IF({cTot}{r}>E{r}+0.0001,"⚠ تجاوز الكمية",IF({cPct}{r}>=1,"✔ مكتمل",'
                       f'IF({cTot}{r}>0,"جاري التنفيذ","لم يبدأ"))))')
    for col, fmt in [(cTot, QTY), (cRem, QTY), (cPct, '0.0%;[Red]-0.0%;;@'), (cVal, QTY), (cSt, None)]:
        calc(ws[f"{col}{r}"], fmt, bold=(col == cVal))
T = BOQ_LAST + 1
put(ws, f"A{T}", "قيمة أعمال الفترة لكل مستخلص", font(10, True, "FFFFFF"), fill(NAVY), align("center"),
    merge=f"A{T}:F{T}")
put(ws, f"A{T+1}", "القيمة التراكمية حتى المستخلص", font(10, True, "FFFFFF"), fill(NAVY2), align("center"),
    merge=f"A{T+1}:F{T+1}")
for k in range(N_IPC):
    col = CL(IPC_C1 + k)
    put(ws, f"{col}{T}", f"=SUMPRODUCT($F${BOQ_FIRST}:$F${BOQ_LAST},{col}{BOQ_FIRST}:{col}{BOQ_LAST})",
        font(9, True), fill(TOTAL_BG), align("center"), BORDER, ACC0)
    put(ws, f"{col}{T+1}", f"=SUM(${cG}{T}:{col}{T})", font(9, True), fill(TOTAL_BG), align("center"), BORDER, ACC0)
put(ws, f"{cVal}{T}", f"=SUM({cVal}{BOQ_FIRST}:{cVal}{BOQ_LAST})", font(10, True, "FFFFFF"), fill(NAVY),
    align("center"), BORDER, ACC)
put(ws, f"{cPct}{T}", f"=IF(ContractValue>0,{cVal}{T}/ContractValue,0)", font(10, True, "FFFFFF"), fill(NAVY),
    align("center"), BORDER, PCT)
dv_num(ws, f"{cG}{BOQ_FIRST}:{cAD}{BOQ_LAST}", lo=-1e12, msg="كمية الفترة فقط (السالب للتصحيح)")
ws.conditional_formatting.add(f"{cPct}{BOQ_FIRST}:{cPct}{BOQ_LAST}",
                              DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
ws.conditional_formatting.add(f"{cTot}{BOQ_FIRST}:{cSt}{BOQ_LAST}", FormulaRule(
    formula=[f"${cTot}{BOQ_FIRST}>$E{BOQ_FIRST}+0.0001"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.conditional_formatting.add(f"{cSt}{BOQ_FIRST}:{cSt}{BOQ_LAST}", FormulaRule(
    formula=[f'ISNUMBER(SEARCH("✔",{cSt}{BOQ_FIRST}))'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
# تمييز عمود آخر مستخلص
ws.conditional_formatting.add(f"{cG}5:{cAD}5", FormulaRule(formula=[f"{cG}$5=LatestIPC"], fill=fill(GOLD)))
ws.freeze_panes = f"{cG}{BOQ_FIRST}"
ws.print_title_rows = "4:5"

# ================================================================= الأوامر التغييرية
ws = wsV
setup(ws, {"A": 5, "B": 11, "C": 12, "D": 48, "E": 9, "F": 16, "G": 16, "H": 13, "I": 16, "J": 16,
           "K": 12, "L": 30}, "7B4F9D")
banner(ws, "A", "L", "🔁 سجل الأوامر التغييرية (Variation Orders)")
nav(ws, ["A", "B", "C", "D", "F", "G", "H", "I"], S_VO)
put(ws, "A4", "«قيمة الأمر» تعدّل قيمة العقد عند الاعتماد — «القيمة المدرجة» هي ما يُصرف في المستخلص المحدد "
              "(للصرف على دفعات: كرر الأمر في سطر جديد بقيمة أمر = 0 ومستخلص مختلف).",
    font(9, False, GREY_TXT, True), merge="A4:L4", al=align("right", wrap=True))
ws.row_dimensions[4].height = 28
headers(ws, 5, [("A", "م"), ("B", "رقم الأمر"), ("C", "تاريخ الأمر"), ("D", "وصف الأمر التغييري"),
                ("E", "النوع"), ("F", "قيمة الأمر"), ("G", "الأثر على العقد (±)"), ("H", "الحالة"),
                ("I", "القيمة المدرجة بالمستخلص"), ("J", "الأثر على المستخلص (±)"),
                ("K", "رقم المستخلص المدرج به"), ("L", "ملاحظات")])
for i, r in enumerate(range(VO_FIRST, VO_LAST + 1)):
    v = VOS[i] if i < len(VOS) else (None,) * 8
    ws[f"A{r}"] = f'=IF(B{r}="","",COUNTA($B${VO_FIRST}:B{r}))'
    calc(ws[f"A{r}"], color=GREY_TXT)
    for col, val, fmt, al in [("B", v[0], None, None), ("C", v[1], DATE, None),
                              ("D", v[2], None, align("right", wrap=True, indent=1)), ("E", v[3], None, None),
                              ("F", v[4], ACC, None), ("H", v[5], None, None), ("I", v[6], ACC, None),
                              ("K", v[7], "0", None), ("L", None, None, align("right", wrap=True))]:
        ws[f"{col}{r}"] = val
        inp(ws[f"{col}{r}"], fmt, al)
    ws[f"G{r}"] = f'=IF(E{r}="خصم",-1,1)*N(F{r})'
    ws[f"J{r}"] = f'=IF(E{r}="خصم",-1,1)*N(I{r})'
    calc(ws[f"G{r}"], ACC)
    calc(ws[f"J{r}"], ACC)
T = VO_LAST + 1
put(ws, f"A{T}", "الإجمالي", font(11, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"A{T}:E{T}")
for col in "FGIJ":
    put(ws, f"{col}{T}", f"=SUM({col}{VO_FIRST}:{col}{VO_LAST})", font(10, True, "FFFFFF"), fill(NAVY),
        align("center"), fmt=ACC)
put(ws, f"H{T}", f'="معتمد: "&COUNTIF(H{VO_FIRST}:H{VO_LAST},"معتمد")', font(10, True, "FFFFFF"), fill(NAVY),
    align("center"))
dv_list(ws, '"إضافة,خصم"', f"E{VO_FIRST}:E{VO_LAST}")
dv_list(ws, "=L_VOStatus", f"H{VO_FIRST}:H{VO_LAST}")
dv_num(ws, f"K{VO_FIRST}:K{VO_LAST}", "whole", 1, N_IPC, "رقم المستخلص من 1 إلى 24")
dv_num(ws, f"F{VO_FIRST}:F{VO_LAST} I{VO_FIRST}:I{VO_LAST}", lo=0, msg="أدخل القيمة موجبة واختر النوع إضافة/خصم")
dv_date(ws, f"C{VO_FIRST}:C{VO_LAST}")
rng = f"A{VO_FIRST}:L{VO_LAST}"
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="معتمد"'], fill=fill(GREEN_L)))
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="قيد الدراسة"'], fill=fill(GOLD_L)))
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="مرفوض"'], fill=fill(RED_L),
                                               font=Font(strike=True, color=RED)))
ws.conditional_formatting.add(f"I{VO_FIRST}:K{VO_LAST}", FormulaRule(
    formula=[f'AND($H{VO_FIRST}="معتمد",N($I{VO_FIRST})>0,$K{VO_FIRST}="")'],
    fill=fill("F8CBAD")))
ws.freeze_panes = f"C{VO_FIRST}"
ws.auto_filter.ref = f"A5:L{VO_LAST}"

# ================================================================= الاستقطاعات الفنية
ws = wsT
setup(ws, {"A": 5, "B": 11, "C": 12, "D": 11, "E": 11, "F": 38, "G": 42, "H": 20, "I": 15, "J": 11,
           "K": 12, "L": 15, "M": 26}, "C0504D")
banner(ws, "A", "M", "✂ سجل الاستقطاعات الفنية (Technical Deductions)")
nav(ws, ["A", "B", "C", "D", "F", "G", "H", "I"], S_TD)
put(ws, "A4", "يُخصم المبلغ من المستخلص المحدد ويستمر محتجزاً تراكمياً حتى يتم الإفراج عنه في «مستخلص الإفراج».",
    font(9, False, GREY_TXT, True), merge="A4:M4", al=align("right"))
headers(ws, 5, [("A", "م"), ("B", "رقم الاستقطاع"), ("C", "التاريخ"), ("D", "رقم المستخلص"), ("E", "كود البند"),
                ("F", "وصف البند (آلي)"), ("G", "سبب الاستقطاع"), ("H", "نوع الاستقطاع"), ("I", "المبلغ المستقطع"),
                ("J", "تم الإفراج؟"), ("K", "مستخلص الإفراج"), ("L", "الرصيد المحتجز"), ("M", "ملاحظات")])
for i, r in enumerate(range(TD_FIRST, TD_LAST + 1)):
    t = TDS[i] if i < len(TDS) else (None,) * 9
    ws[f"A{r}"] = f'=IF(B{r}="","",COUNTA($B${TD_FIRST}:B{r}))'
    calc(ws[f"A{r}"], color=GREY_TXT)
    for col, val, fmt, al in [("B", t[0], None, None), ("C", t[1], DATE, None), ("D", t[2], "0", None),
                              ("E", t[3], None, None), ("G", t[4], None, align("right", wrap=True, indent=1)),
                              ("H", t[5], None, None), ("I", t[6], ACC, None), ("J", t[7], None, None),
                              ("K", t[8], "0", None), ("M", None, None, align("right", wrap=True))]:
        ws[f"{col}{r}"] = val
        inp(ws[f"{col}{r}"], fmt, al)
    ws[f"F{r}"] = (f'=IF(E{r}="","",IFERROR(INDEX({R(S_BOQ)}$D${BOQ_FIRST}:$D${BOQ_LAST},'
                   f'MATCH(E{r},{R(S_BOQ)}$B${BOQ_FIRST}:$B${BOQ_LAST},0)),"⚠ كود غير موجود"))')
    calc(ws[f"F{r}"], al=align("right", wrap=True, indent=1), color=LINK_FONT)
    ws[f"L{r}"] = f'=IF(J{r}="نعم",0,N(I{r}))'
    calc(ws[f"L{r}"], ACC, bold=True)
T = TD_LAST + 1
put(ws, f"A{T}", "الإجمالي", font(11, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"A{T}:H{T}")
for col in "IL":
    put(ws, f"{col}{T}", f"=SUM({col}{TD_FIRST}:{col}{TD_LAST})", font(10, True, "FFFFFF"), fill(NAVY),
        align("center"), fmt=ACC)
put(ws, f"J{T}", f"=I{T}-L{T}", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), fmt=ACC, merge=f"J{T}:K{T}")
ws[f"J{T}"].comment = Comment("إجمالي المبالغ التي تم الإفراج عنها", "Tracker")
dv_list(ws, f"={R(S_BOQ)}$B${BOQ_FIRST}:$B${BOQ_LAST}", f"E{TD_FIRST}:E{TD_LAST}")
dv_list(ws, "=L_TDType", f"H{TD_FIRST}:H{TD_LAST}")
dv_list(ws, '"نعم,لا"', f"J{TD_FIRST}:J{TD_LAST}")
dv_num(ws, f"D{TD_FIRST}:D{TD_LAST} K{TD_FIRST}:K{TD_LAST}", "whole", 1, N_IPC, "رقم المستخلص من 1 إلى 24")
dv_num(ws, f"I{TD_FIRST}:I{TD_LAST}", lo=0)
dv_date(ws, f"C{TD_FIRST}:C{TD_LAST}")
rng = f"A{TD_FIRST}:M{TD_LAST}"
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$J{TD_FIRST}="نعم"'], fill=fill(GREEN_L)))
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'AND($J{TD_FIRST}<>"نعم",N($I{TD_FIRST})>0)'],
                                               fill=fill(RED_L)))
ws.conditional_formatting.add(f"K{TD_FIRST}:K{TD_LAST}", FormulaRule(
    formula=[f'OR(AND($J{TD_FIRST}="نعم",$K{TD_FIRST}=""),AND($K{TD_FIRST}<>"",$K{TD_FIRST}<$D{TD_FIRST}))'],
    fill=fill("F8CBAD"), font=Font(bold=True, color=RED)))
ws.freeze_panes = f"C{TD_FIRST}"
ws.auto_filter.ref = f"A5:M{TD_LAST}"

# ================================================================= سجل المستخلصات
ws = wsR
REG_COLS = [  # key, title, width, kind (in/f), fmt
    ("A", "رقم المستخلص", 9, "fix", "0"),
    ("B", "الفترة من", 11.5, "in", DATE), ("C", "الفترة إلى", 11.5, "in", DATE),
    ("D", "تاريخ التقديم", 11.5, "in", DATE), ("E", "تاريخ الاعتماد", 11.5, "in", DATE),
    ("F", "حالة المستخلص", 13, "in", None),
    ("G", "قيمة الأعمال المنفذة التراكمية", 16, "f", ACC), ("H", "أعمال الفترة", 15, "f", ACC),
    ("I", "الأوامر التغييرية التراكمية", 15, "f", ACC), ("J", "رصيد المواد الموردة بالموقع", 15, "in", ACC),
    ("K", "إجمالي القيمة التراكمية", 16, "f", ACC), ("L", "نسبة الإنجاز الفعلية", 10, "f", PCT),
    ("M", "نسبة الإنجاز المخططة", 10, "in", PCT), ("N", "الانحراف عن المخطط", 10, "f", PCT),
    ("O", "استرداد الدفعة المقدمة التراكمي", 15, "f", ACC), ("P", "ضمان الأعمال المحتسب التراكمي", 15, "f", ACC),
    ("Q", "إفراج عن الضمان خلال الفترة", 14, "in", ACC), ("R", "صافي الضمان المحتجز", 15, "f", ACC),
    ("S", "الاستقطاعات الفنية المحتجزة", 14, "f", ACC), ("T", "غرامات وخصومات خلال الفترة", 14, "in", ACC),
    ("U", "الصافي التراكمي قبل الضرائب", 16, "f", ACC), ("V", "ضريبة القيمة المضافة", 14, "f", ACC),
    ("W", "ضريبة الخصم من المنبع", 13, "f", ACC), ("X", "صافي المستحق التراكمي", 16, "f", ACC),
    ("Y", "المعتمد في المستخلصات السابقة", 16, "f", ACC), ("Z", "صافي المستحق للمستخلص الحالي", 16, "f", ACC),
    ("AA", "المبلغ المحصل", 15, "in", ACC), ("AB", "تاريخ التحصيل", 11.5, "in", DATE),
    ("AC", "المتبقي غير المحصل", 15, "f", ACC), ("AD", "مدة التحصيل (يوم)", 10, "f", '0;-0;"-"'),
    ("AE", "حالة التحصيل", 15, "f", None),
]
setup(ws, {k: w for k, _, w, _, _ in REG_COLS}, NAVY, zoom=85)
banner(ws, "A", "AE", "🗂 سجل المستخلصات والحسابات التراكمية (Payment Certificates Register)")
nav(ws, ["B", "D", "F", "H", "J", "L", "N", "P"], S_REG)
groups = [("A", "F", "بيانات المستخلص", NAVY2), ("G", "N", "قيمة الأعمال ونسب الإنجاز", TEAL),
          ("O", "T", "الاستقطاعات (تراكمي)", "C0504D"), ("U", "Z", "صافي المستحق والضرائب", NAVY),
          ("AA", "AE", "التحصيل", GREEN)]
for a, b, t, colr in groups:
    put(ws, f"{a}4", t, font(10, True, "FFFFFF"), fill(colr), align("center"), BORDER, merge=f"{a}4:{b}4")
headers(ws, 5, [(k, t) for k, t, _, _, _ in REG_COLS], height=58)
for k, t, _, kind, _ in REG_COLS:
    if kind == "in":
        ws[f"{k}5"].fill = fill("8C6D1F")

QS = R(S_QTY)
VS = R(S_VO)
TS = R(S_TD)
for n in range(1, N_IPC + 1):
    r = REG_FIRST + n - 1
    a = f'$C{r}=""'
    F = {
        "A": n,
        "G": (f'=IF({a},"",SUMPRODUCT({QS}$F${BOQ_FIRST}:$F${BOQ_LAST}*{QS}${cG}${BOQ_FIRST}:${cAD}${BOQ_LAST}'
              f'*({QS}${cG}$5:${cAD}$5<=$A{r})))'),
        "H": f'=IF({a},"",G{r}-N(G{r-1}))',
        "I": (f'=IF({a},"",SUMIFS({VS}$J${VO_FIRST}:$J${VO_LAST},{VS}$H${VO_FIRST}:$H${VO_LAST},"معتمد",'
              f'{VS}$K${VO_FIRST}:$K${VO_LAST},"<="&$A{r}))'),
        "K": f'=IF({a},"",G{r}+I{r}+N(J{r}))',
        "L": f'=IF({a},"",IF(ContractValue+I{r}>0,(G{r}+I{r})/(ContractValue+I{r}),0))',
        "N": f'=IF(OR({a},M{r}=""),"",L{r}-M{r})',
        "O": (f'=IF({a},"",ROUND(IF(L{r}>=RecFull,AdvAmount,'
              f'MIN(AdvAmount,MAX(0,G{r}+I{r}-RecStart*ContractValue)*RecRate)),2))'),
        "P": f'=IF({a},"",ROUND(MIN(K{r}*RetPct,RetCap),2))',
        "R": f'=IF({a},"",P{r}-SUM($Q${REG_FIRST}:Q{r}))',
        "S": (f'=IF({a},"",SUMIFS({TS}$I${TD_FIRST}:$I${TD_LAST},{TS}$D${TD_FIRST}:$D${TD_LAST},"<="&$A{r})'
              f'-SUMIFS({TS}$I${TD_FIRST}:$I${TD_LAST},{TS}$J${TD_FIRST}:$J${TD_LAST},"نعم",'
              f'{TS}$K${TD_FIRST}:$K${TD_LAST},"<="&$A{r}))'),
        "U": f'=IF({a},"",K{r}-O{r}-R{r}-S{r}-SUM($T${REG_FIRST}:T{r}))',
        "V": f'=IF({a},"",ROUND(VATPct*(U{r}+IF(VATBeforeRet="نعم",R{r},0)),2))',
        "W": f'=IF({a},"",ROUND(WHTPct*(U{r}+R{r}),2))',
        "X": f'=IF({a},"",U{r}+V{r}-W{r})',
        "Y": f'=IF({a},"",N(X{r-1}))',
        "Z": f'=IF({a},"",X{r}-Y{r})',
        "AC": f'=IF({a},"",Z{r}-N(AA{r}))',
        "AD": f'=IF(OR(AB{r}="",E{r}=""),"",AB{r}-E{r})',
        "AE": (f'=IF({a},"",IF(N(AA{r})=0,IF(E{r}="","⏳ بانتظار الاعتماد","✖ غير محصل"),'
               f'IF(AC{r}<=1,"✔ محصل بالكامل","⚠ محصل جزئياً")))'),
    }
    # بيانات المثال (أول 6 مستخلصات)
    if n <= 6:
        p_from = add_months(START, n - 1)
        p_to = add_months(START, n) - dt.timedelta(days=1)
        sample = {"B": p_from, "C": p_to, "D": p_to + dt.timedelta(days=5), "E": p_to + dt.timedelta(days=20 + n % 3),
                  "F": "معتمد", "J": MATERIALS[n - 1], "T": PENALTIES.get(n)}
        if n in PAID:
            sample["AA"] = PAID[n][0]
            sample["AB"] = sample["E"] + dt.timedelta(days=PAID[n][1])
    else:
        sample = {}
    for k, t, _, kind, fmt in REG_COLS:
        c = ws[f"{k}{r}"]
        if kind == "in":
            c.value = sample.get(k)
            if k == "M" and n <= len(PLANNED):
                c.value = PLANNED[n - 1]
            inp(c, fmt)
        elif kind == "fix":
            c.value = n
            calc(c, fmt, bold=True, fl=ALT)
        else:
            c.value = F[k]
            calc(c, fmt, bold=k in ("X", "Z"), fl="F7FBFF" if k in ("X", "Z") else None)
T = REG_TOT
put(ws, f"A{T}", "الإجمالي / آخر رصيد", font(10, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"A{T}:F{T}")
LASTV = lambda col: f"=IF(LatestIPC=0,0,INDEX({col}{REG_FIRST}:{col}{REG_LAST},LatestIPC))"
for k, t, _, kind, fmt in REG_COLS[6:]:
    if k in ("H", "Q", "T", "Z", "AA", "AC"):
        v = f"=SUM({k}{REG_FIRST}:{k}{REG_LAST})"
    elif k == "AD":
        v = f'=IFERROR(AVERAGE(AD{REG_FIRST}:AD{REG_LAST}),0)'
    elif k in ("AB", "AE", "M", "N"):
        v = None
    else:
        v = LASTV(k)
    put(ws, f"{k}{T}", v, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
ws.row_dimensions[T].height = 26
put(ws, f"A{T+2}", "ملاحظات: الخلايا الصفراء إدخال يدوي — يصبح المستخلص فعالاً بمجرد إدخال «الفترة إلى». "
                   "رصيد المواد = الرصيد القائم بالموقع في نهاية الفترة (وليس الإضافة). "
                   "الإفراج عن الضمان والغرامات = مبالغ الفترة فقط ويتم تجميعها آلياً.",
    font(9, False, GREY_TXT, True), merge=f"A{T+2}:AE{T+2}", al=align("right", wrap=True))
ws.row_dimensions[T + 2].height = 30
REG_RNG = f"{REG_FIRST}:{REG_LAST}"
dv_list(ws, "=L_IPCStatus", f"F{REG_FIRST}:F{REG_LAST}")
dv_date(ws, f"B{REG_FIRST}:E{REG_LAST} AB{REG_FIRST}:AB{REG_LAST}")
dv_num(ws, f"M{REG_FIRST}:M{REG_LAST}", lo=0, hi=1, msg="النسبة التراكمية المخططة من البرنامج الزمني")
dv_num(ws, f"J{REG_FIRST}:J{REG_LAST} Q{REG_FIRST}:Q{REG_LAST} T{REG_FIRST}:T{REG_LAST} AA{REG_FIRST}:AA{REG_LAST}", lo=0)
full = f"A{REG_FIRST}:AE{REG_LAST}"
ws.conditional_formatting.add(full, FormulaRule(formula=[f"$A{REG_FIRST}=LatestIPC"],
                                                border=Border(top=Side("medium", GOLD), bottom=Side("medium", GOLD))))
ws.conditional_formatting.add(f"N{REG_FIRST}:N{REG_LAST}",
                              CellIsRule(operator="lessThan", formula=["-0.0001"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.conditional_formatting.add(f"N{REG_FIRST}:N{REG_LAST}",
                              CellIsRule(operator="greaterThanOrEqual", formula=["0"], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
for sym, bg, fc in [("✔", GREEN_L, GREEN), ("✖", RED_L, RED), ("⚠", GOLD_L, GOLD)]:
    ws.conditional_formatting.add(f"AE{REG_FIRST}:AE{REG_LAST}", FormulaRule(
        formula=[f'ISNUMBER(SEARCH("{sym}",AE{REG_FIRST}))'], fill=fill(bg), font=Font(color=fc, bold=True)))
ws.conditional_formatting.add(f"F{REG_FIRST}:F{REG_LAST}", FormulaRule(formula=[f'F{REG_FIRST}="معتمد"'],
                                                                     font=Font(color=GREEN, bold=True)))
ws.conditional_formatting.add(f"F{REG_FIRST}:F{REG_LAST}", FormulaRule(formula=[f'F{REG_FIRST}="مرفوض"'],
                                                                     font=Font(color=RED, bold=True)))
ws.conditional_formatting.add(f"L{REG_FIRST}:L{REG_LAST}",
                              DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
ws.freeze_panes = f"G{REG_FIRST}"
ws.print_title_rows = "4:5"

# ================================================================= لوحة التحكم
ws = wsD
setup(ws, {c: 13 for c in "ABCDEFGHIJKLMNOP"} | {"A": 2, "Q": 2}, NAVY, zoom=85)
banner(ws, "B", "P", "📊 لوحة تحكم المستخلصات — Payment Certificates & Billing Dashboard")
nav(ws, ["B", "C", "D", "E", "F", "G", "H"], S_DASH)
put(ws, "J3", "آخر مستخلص فعال:", font(10, True, NAVY), al=align("left"), merge="J3:K3")
put(ws, "L3", f'=SUMPRODUCT(MAX(({R(S_REG)}$C${REG_FIRST}:$C${REG_LAST}<>"")*{R(S_REG)}$A${REG_FIRST}:$A${REG_LAST}))',
    font(14, True, "FFFFFF"), fill(GOLD), align("center"), fmt='"مستخلص رقم "0')
ws.merge_cells("L3:M3")
put(ws, "N3", f'=IF(L3=0,"",TEXT(INDEX({R(S_REG)}$C${REG_FIRST}:$C${REG_LAST},L3),"yyyy/mm/dd"))',
    font(10, True, NAVY), al=align("center"), merge="N3:P3")
add_name(wb, "LatestIPC", f"{R(S_DASH)}$L$3")


def last(col):
    return f"IF(LatestIPC=0,0,N(INDEX({R(S_REG)}${col}${REG_FIRST}:${col}${REG_LAST},LatestIPC)))"


def tot(col):
    return f"SUM({R(S_REG)}${col}${REG_FIRST}:${col}${REG_LAST})"


section(ws, "B5", "المؤشرات التعاقدية والإنجاز", "B5:P5", NAVY2)
card(ws, 6, "B", "D", "قيمة العقد الأصلية", "=ContractValue")
card(ws, 6, "E", "G", "صافي الأوامر التغييرية", "=VOApproved", color="7B4F9D")
card(ws, 6, "H", "J", "قيمة العقد المعدلة", "=RevisedContract")
card(ws, 6, "K", "M", "إجمالي قيمة الأعمال التراكمية", f"={last('K')}", color=TEAL)
card(ws, 6, "N", "P", "الأعمال المتبقية", f"=RevisedContract-{last('G')}-{last('I')}", color=GREY_TXT)
card(ws, 9, "B", "D", "نسبة الإنجاز الفعلية", f"={last('L')}", PCT, TEAL, 20)
card(ws, 9, "E", "G", "نسبة الإنجاز المخططة",
     f"=IF(LatestIPC=0,0,N(INDEX({R(S_REG)}$M${REG_FIRST}:$M${REG_LAST},LatestIPC)))", PCT, NAVY, 20)
card(ws, 9, "H", "J", "الانحراف (فعلي - مخطط)", "=B10-E10", PCT, GOLD, 20)
card(ws, 9, "K", "M", "نسبة المدة المنقضية",
     f'=IF(LatestIPC=0,0,MIN(1,MAX(0,(INDEX({R(S_REG)}$C${REG_FIRST}:$C${REG_LAST},LatestIPC)-StartDate+1)/(EndDate-StartDate+1))))',
     PCT, GREY_TXT, 20)
card(ws, 9, "N", "P", "مؤشر أداء الجدول (SPI)", "=IF(E10>0,B10/E10,0)", '0.00', NAVY, 20)

section(ws, "B12", "الموقف المالي والتحصيل", "B12:P12", NAVY2)
card(ws, 13, "B", "D", "صافي المستحق التراكمي", f"={last('X')}")
card(ws, 13, "E", "G", "إجمالي المحصل", f"={tot('AA')}", color=GREEN)
card(ws, 13, "H", "J", "مستحقات غير محصلة", f"={tot('AC')}", color=RED)
card(ws, 13, "K", "M", "نسبة التحصيل", "=IF(B14>0,E14/B14,0)", PCT, GREEN)
card(ws, 13, "N", "P", "متوسط مدة التحصيل (يوم)", f"=IFERROR(AVERAGE({R(S_REG)}$AD${REG_FIRST}:$AD${REG_LAST}),0)",
     '0" يوم"', GREY_TXT)
card(ws, 16, "B", "D", "ضمان الأعمال المحتجز", f"={last('R')}", color="C0504D")
card(ws, 16, "E", "G", "رصيد الدفعة المقدمة غير المسترد", f"=AdvAmount-{last('O')}", color="C0504D")
card(ws, 16, "H", "J", "الاستقطاعات الفنية المحتجزة", f"={last('S')}", color="C0504D")
card(ws, 16, "K", "M", "إجمالي الغرامات والخصومات", f"={tot('T')}", color="C0504D")
card(ws, 16, "N", "P", "صافي المستحق - آخر مستخلص", f"={last('Z')}", color=TEAL)

# جدول الإنجاز حسب القسم
section(ws, "B19", "الإنجاز حسب أقسام الأعمال", "B19:H19", TEAL)
for col, t, mg in [("B", "القسم", "B20:D20"), ("E", "القيمة التعاقدية", "E20:E20"), ("F", "القيمة المنفذة", "F20:F20"),
                   ("G", "نسبة الإنجاز", "G20:G20"), ("H", "الوزن من العقد", "H20:H20")]:
    put(ws, f"{col}20", t, font(10, True, "FFFFFF"), fill(NAVY), align("center", wrap=True), BORDER, merge=mg)
ws.row_dimensions[20].height = 30
for i in range(len(SECTIONS)):
    r = 21 + i
    put(ws, f"B{r}", f"={R(S_SET)}F{6+i}", font(10, True), fill(ALT), align("right", indent=1), BORDER, merge=f"B{r}:D{r}")
    put(ws, f"E{r}", f"=SUMIF({R(S_BOQ)}$C${BOQ_FIRST}:$C${BOQ_LAST},B{r},{R(S_BOQ)}$H${BOQ_FIRST}:$H${BOQ_LAST})",
        font(10), None, align("center"), BORDER, ACC0)
    put(ws, f"F{r}", f"=SUMIF({QS}$D${BOQ_FIRST}:$D${BOQ_LAST},B{r},{QS}${cVal}${BOQ_FIRST}:${cVal}${BOQ_LAST})",
        font(10), None, align("center"), BORDER, ACC0)
    put(ws, f"G{r}", f"=IF(E{r}>0,F{r}/E{r},0)", font(10, True), None, align("center"), BORDER, PCT)
    put(ws, f"H{r}", f"=IF(ContractValue>0,E{r}/ContractValue,0)", font(10), None, align("center"), BORDER, PCT)
SR = 21 + len(SECTIONS)
put(ws, f"B{SR}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{SR}:D{SR}")
for col, f, fmt in [("E", f"=SUM(E21:E{SR-1})", ACC0), ("F", f"=SUM(F21:F{SR-1})", ACC0),
                    ("G", f"=IF(E{SR}>0,F{SR}/E{SR},0)", PCT), ("H", f"=SUM(H21:H{SR-1})", PCT)]:
    put(ws, f"{col}{SR}", f, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
ws.conditional_formatting.add(f"G21:G{SR-1}",
                              DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))

# جدول توزيع قيمة العقد (للرسم الدائري)
section(ws, "J19", "توزيع قيمة العقد المعدلة", "J19:P19", TEAL)
put(ws, "J20", "البند", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge="J20:M20")
put(ws, "N20", "القيمة", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge="N20:O20")
put(ws, "P20", "النسبة", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
DIST = [("صافي الأعمال المعتمدة قبل الضرائب", f"={last('U')}"),
        ("دفعة مقدمة مستردة", f"={last('O')}"),
        ("ضمان أعمال محتجز", "=B17"),
        ("استقطاعات فنية وغرامات", "=H17+K17"),
        ("أعمال متبقية", "=MAX(0,N7)"),
        ("مواد موردة بالموقع", f"={last('J')}")]
for i, (t, f) in enumerate(DIST):
    r = 21 + i
    put(ws, f"J{r}", t, font(10, True), fill(ALT), align("right", indent=1), BORDER, merge=f"J{r}:M{r}")
    put(ws, f"N{r}", f, font(10), None, align("center"), BORDER, ACC0, merge=f"N{r}:O{r}")
    put(ws, f"P{r}", f"=IF($N$27>0,N{r}/$N$27,0)", font(10), None, align("center"), BORDER, PCT)
put(ws, "J27", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge="J27:M27")
put(ws, "N27", "=SUM(N21:O26)", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, ACC0, merge="N27:O27")
put(ws, "P27", "=SUM(P21:P26)", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, PCT)
put(ws, "J28", "ملاحظة: الإجمالي = قيمة العقد المعدلة + رصيد المواد بالموقع (المبالغ قبل الضرائب).",
    font(8, False, GREY_TXT, True), al=align("right", wrap=True), merge="J28:P29")


def nice_axes(ch):
    for ax in (ch.x_axis, ch.y_axis):
        ax.delete = False
    ch.legend.position = "b"


# منحنى S: فعلي (أعمدة) مقابل مخطط (خط)
c1 = BarChart()
c1.type = "col"
c1.title = "منحنى الإنجاز التراكمي (S-Curve): الفعلي مقابل المخطط"
c1.y_axis.title = "نسبة الإنجاز"
c1.y_axis.numFmt = "0%"
c1.y_axis.scaling.min, c1.y_axis.scaling.max = 0, 1
c1.y_axis.majorGridlines = None
c1.add_data(Reference(wsR, min_col=12, min_row=5, max_row=REG_LAST), titles_from_data=True)
cats = Reference(wsR, min_col=1, min_row=REG_FIRST, max_row=REG_LAST)
c1.set_categories(cats)
c1.series[0].graphicalProperties.solidFill = "2E7D7A"
c1.gapWidth = 60
l1 = LineChart()
l1.add_data(Reference(wsR, min_col=13, min_row=5, max_row=REG_LAST), titles_from_data=True)
l1.series[0].graphicalProperties.line.solidFill = "C0504D"
l1.series[0].graphicalProperties.line.width = 28000
l1.series[0].smooth = True
c1 += l1
nice_axes(c1)
c1.height, c1.width = 9, 26
ws.add_chart(c1, "B32")

# المستحق مقابل المحصل لكل مستخلص
c2 = BarChart()
c2.type = "col"
c2.title = "صافي المستحق مقابل المحصل لكل مستخلص"
c2.add_data(Reference(wsR, min_col=26, min_row=5, max_row=REG_LAST), titles_from_data=True)
c2.add_data(Reference(wsR, min_col=27, min_row=5, max_row=REG_LAST), titles_from_data=True)
c2.set_categories(cats)
c2.series[0].graphicalProperties.solidFill = "1F3A5F"
c2.series[1].graphicalProperties.solidFill = "63BE7B"
c2.y_axis.numFmt = "#,##0"
c2.y_axis.majorGridlines = None
nice_axes(c2)
c2.height, c2.width = 9, 26
ws.add_chart(c2, "B51")

# الإنجاز حسب القسم
c3 = BarChart()
c3.type = "bar"
c3.title = "نسبة الإنجاز حسب القسم"
c3.add_data(Reference(ws, min_col=7, min_row=20, max_row=SR - 1), titles_from_data=True)
c3.set_categories(Reference(ws, min_col=2, min_row=21, max_row=SR - 1))
c3.series[0].graphicalProperties.solidFill = "2E7D7A"
c3.x_axis.numFmt = "0%"
c3.y_axis.numFmt = "0%"
c3.y_axis.scaling.min, c3.y_axis.scaling.max = 0, 1
c3.y_axis.majorGridlines = None
c3.legend = None
for ax in (c3.x_axis, c3.y_axis):
    ax.delete = False
c3.height, c3.width = 9, 15
ws.add_chart(c3, "B70")

# توزيع قيمة العقد
c4 = DoughnutChart()
c4.title = "توزيع قيمة العقد المعدلة"
c4.add_data(Reference(ws, min_col=14, min_row=21, max_row=26))
c4.set_categories(Reference(ws, min_col=10, min_row=21, max_row=26))
c4.dataLabels = DataLabelList()
c4.dataLabels.showPercent = True
for attr in ("showVal", "showCatName", "showSerName", "showLegendKey"):
    setattr(c4.dataLabels, attr, False)
c4.holeSize = 50
c4.legend.position = "r"
c4.height, c4.width = 9, 14
ws.add_chart(c4, "J70")

# ================================================================= نموذج المستخلص
ws = wsF
setup(ws, {"A": 2, "B": 10, "C": 38, "D": 8, "E": 12, "F": 12, "G": 12, "H": 12, "I": 12, "J": 10,
           "K": 16, "L": 16, "M": 17, "N": 2}, GOLD, zoom=85)
ws.page_setup.orientation = "portrait"
banner(ws, "B", "M", "🧾 شهادة الدفع المؤقتة — مستخلص أعمال (Interim Payment Certificate)")
nav(ws, ["B", "C", "E", "G", "I", "K", "L"], S_FORM)
put(ws, "B5", "اختر رقم المستخلص ◄", font(11, True, NAVY), al=align("left"), merge="B5:C5")
put(ws, "D5", 6, font(16, True, INPUT_FONT), fill(INPUT), align("center"), Border(
    left=Side("medium", GOLD), right=Side("medium", GOLD), top=Side("medium", GOLD), bottom=Side("medium", GOLD)),
    merge="D5:E5")
dv_num(ws, "D5", "whole", 1, N_IPC, "اختر رقم المستخلص المراد عرضه وطباعته (1 - 24)")
add_name(wb, "SelIPC", f"{R(S_FORM)}$D$5")
put(ws, "F5", f'=IF(INDEX({R(S_REG)}$C${REG_FIRST}:$C${REG_LAST},SelIPC)="","⚠ هذا المستخلص غير مُدخل بعد في السجل",'
              f'"الحالة: "&INDEX({R(S_REG)}$F${REG_FIRST}:$F${REG_LAST},SelIPC))',
    font(11, True, GOLD), al=align("right"), merge="F5:J5")
ws.row_dimensions[5].height = 28

reg = lambda col: f"{R(S_REG)}${col}${REG_FIRST}:${col}${REG_LAST}"
info = [("B7", "المشروع:", "=" + R(S_SET) + "C5"), ("B8", "رقم العقد:", "=" + R(S_SET) + "C6"),
        ("B9", "صاحب العمل:", "=" + R(S_SET) + "C7"), ("B10", "الاستشاري:", "=" + R(S_SET) + "C8"),
        ("B11", "المقاول:", "=" + R(S_SET) + "C9")]
for ref, lab, f in info:
    r = ws[ref].row
    put(ws, f"B{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
    put(ws, f"C{r}", f, font(10, True), None, align("right", indent=1), BORDER, merge=f"C{r}:G{r}")
info2 = [(7, "رقم المستخلص:", "=SelIPC", '"مستخلص رقم "0'),
         (8, "الفترة من:", f"=INDEX({reg('B')},SelIPC)", DATE), (9, "الفترة إلى:", f"=INDEX({reg('C')},SelIPC)", DATE),
         (10, "تاريخ التقديم:", f"=INDEX({reg('D')},SelIPC)", DATE),
         (11, "قيمة العقد المعدلة:", "=RevisedContract", ACC)]
for r, lab, f, fmt in info2:
    put(ws, f"H{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"H{r}:I{r}")
    put(ws, f"J{r}", f, font(10, True), None, align("center"), BORDER, fmt, merge=f"J{r}:K{r}")
for r, lab, f, fmt in [(7, "نسبة الإنجاز الفعلية", f"=N(INDEX({reg('L')},SelIPC))", PCT),
                       (9, "نسبة الإنجاز المخططة", f"=N(INDEX({reg('M')},SelIPC))", PCT)]:
    put(ws, f"L{r}", lab, font(9, True, GREY_TXT), fill(ALT), align("center"), BORDER, merge=f"L{r}:M{r}")
    put(ws, f"L{r+1}", f, font(16, True, TEAL), None, align("center"), BORDER, fmt, merge=f"L{r+1}:M{r+1}")
put(ws, "L11", f'=IF(N(INDEX({reg("C")},SelIPC))=0,"",IF(L8>=L10,"✔ متقدم/مطابق للبرنامج","⚠ متأخر عن البرنامج"))',
    font(9, True, GOLD), al=align("center"), merge="L11:M11", bd=BORDER)

# جدول الملخص المالي
section(ws, "B13", "أولاً: الملخص المالي للمستخلص", "B13:M13", NAVY2)
put(ws, "B14", "م", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
put(ws, "C14", "البيان", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge="C14:G14")
for col, t, mg in [("H", "السابق", "H14:I14"), ("J", "الحالي", "J14:K14"), ("L", "الإجمالي التراكمي", "L14:M14")]:
    put(ws, f"{col}14", t, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=mg)
ws.row_dimensions[14].height = 26


def cum_expr(col, mode, n):
    """قيمة تراكمية من السجل عند المستخلص n"""
    if mode == "idx":
        return f"N(INDEX({reg(col)},{n}))"
    return f"SUMIF({reg('A')},\"<=\"&{n},{reg(col)})"   # تجميع مبالغ الفترات


LINES = [  # (label, register col, mode, sign, style)
    ("قيمة الأعمال المنفذة طبقاً لجدول الكميات", "G", "idx", 1, "n"),
    ("قيمة الأوامر التغييرية المعتمدة", "I", "idx", 1, "n"),
    ("المواد الموردة بالموقع (رصيد)", "J", "idx", 1, "n"),
    ("إجمالي قيمة الأعمال", "K", "idx", 1, "t"),
    ("يُخصم: استرداد الدفعة المقدمة", "O", "idx", -1, "d"),
    ("يُخصم: ضمان الأعمال المحتجز (صافي)", "R", "idx", -1, "d"),
    ("يُخصم: الاستقطاعات الفنية", "S", "idx", -1, "d"),
    ("يُخصم: الغرامات والخصومات الأخرى", "T", "sum", -1, "d"),
    ("صافي القيمة قبل الضرائب", "U", "idx", 1, "t"),
    ("يُضاف: ضريبة القيمة المضافة", "V", "idx", 1, "n"),
    ("يُخصم: ضريبة الخصم من المنبع", "W", "idx", -1, "d"),
    ("صافي المستحق", "X", "idx", 1, "g"),
]
for i, (lab, col, mode, sign, st) in enumerate(LINES):
    r = 15 + i
    sg = "-" if sign < 0 else ""
    cum = cum_expr(col, mode, "SelIPC")
    prev = f"IF(SelIPC>1,{cum_expr(col, mode, 'SelIPC-1')},0)"
    bg = {"n": None, "d": None, "t": TOTAL_BG, "g": NAVY}[st]
    fc = {"n": "1F2933", "d": RED, "t": "1F2933", "g": "FFFFFF"}[st]
    bold = st in ("t", "g")
    put(ws, f"B{r}", i + 1, font(10, bold, fc), fill(bg) if bg else None, align("center"), BORDER)
    put(ws, f"C{r}", lab, font(10, bold, fc), fill(bg) if bg else None, align("right", indent=1), BORDER, merge=f"C{r}:G{r}")
    put(ws, f"H{r}", f"={sg}{prev}", font(10, bold, fc), fill(bg) if bg else None, align("center"), BORDER, ACC, merge=f"H{r}:I{r}")
    put(ws, f"L{r}", f"={sg}{cum}", font(10, bold, fc), fill(bg) if bg else None, align("center"), BORDER, ACC, merge=f"L{r}:M{r}")
    put(ws, f"J{r}", f"=L{r}-H{r}", font(10, True, fc), fill(bg) if bg else fill("F7FBFF"), align("center"), BORDER, ACC,
        merge=f"J{r}:K{r}")
    ws.row_dimensions[r].height = 20
NET = 15 + len(LINES)
put(ws, f"B{NET+1}", "صافي المبلغ المستحق صرفه عن هذا المستخلص", font(13, True, "FFFFFF"), fill(TEAL),
    align("center"), merge=f"B{NET+1}:I{NET+1}")
put(ws, f"J{NET+1}", f"=J{NET-1}", font(15, True, "FFFFFF"), fill(TEAL), align("center"), fmt=ACC, merge=f"J{NET+1}:M{NET+1}")
ws.row_dimensions[NET + 1].height = 32
put(ws, f"B{NET+2}", f'="التحقق مع السجل: "&IF(ABS(J{NET-1}-N(INDEX({reg("Z")},SelIPC)))<0.01,"✔ مطابق","✖ غير مطابق")',
    font(9, True, GREEN), al=align("right"), merge=f"B{NET+2}:M{NET+2}")

# التوقيعات
SG = NET + 4
section(ws, f"B{SG}", "ثانياً: الاعتمادات", f"B{SG}:M{SG}", NAVY2)
for col, mg, t in [("B", f"B{SG+1}:E{SG+1}", "إعداد: مهندس المقاول"),
                   ("F", f"F{SG+1}:I{SG+1}", "مراجعة: المهندس الاستشاري"),
                   ("J", f"J{SG+1}:M{SG+1}", "اعتماد: صاحب العمل")]:
    put(ws, f"{col}{SG+1}", t, font(10, True, NAVY), fill(ALT), align("center"), BORDER, merge=mg)
    c2_ = mg.replace(str(SG + 1), str(SG + 2))
    put(ws, f"{col}{SG+2}", "الاسم: ....................\nالتوقيع: ..................\nالتاريخ: ..................",
        font(9, False, GREY_TXT), None, align("right", "top", True, 1), BORDER, merge=c2_)
ws.row_dimensions[SG + 2].height = 60

# تفاصيل البنود
DT = SG + 4
section(ws, f"B{DT}", "ثالثاً: تفاصيل الأعمال المنفذة حسب بنود جدول الكميات", f"B{DT}:M{DT}", NAVY2)
headers(ws, DT + 1, [("B", "كود البند"), ("C", "الوصف"), ("D", "الوحدة"), ("E", "الكمية التعاقدية"),
                     ("F", "سعر الوحدة"), ("G", "الكمية السابقة"), ("H", "الكمية الحالية"),
                     ("I", "الكمية التراكمية"), ("J", "نسبة الإنجاز"), ("K", "القيمة السابقة"),
                     ("L", "القيمة الحالية"), ("M", "القيمة التراكمية")])
hdr = f"{QS}${cG}$5:${cAD}$5"
for i in range(BOQ_LAST - BOQ_FIRST + 1):
    r, q = DT + 2 + i, BOQ_FIRST + i
    row = f"{QS}${cG}{q}:${cAD}{q}"
    vals = [("B", f"={QS}A{q}", None, align("center")), ("C", f"={QS}B{q}", None, align("right", wrap=True, indent=1)),
            ("D", f"={QS}C{q}", None, align("center")), ("E", f"={QS}E{q}", QTY, None), ("F", f"={QS}F{q}", QTY, None),
            ("G", f'=SUMIF({hdr},"<"&SelIPC,{row})', QTY, None), ("H", f"=SUMIF({hdr},SelIPC,{row})", QTY, None),
            ("I", f"=G{r}+H{r}", QTY, None), ("J", f"=IF(E{r}>0,I{r}/E{r},0)", '0.0%;-0.0%;;@', None),
            ("K", f"=G{r}*F{r}", QTY, None), ("L", f"=H{r}*F{r}", QTY, None), ("M", f"=I{r}*F{r}", QTY, None)]
    for col, f, fmt, al in vals:
        ws[f"{col}{r}"] = f
        calc(ws[f"{col}{r}"], fmt, al, bold=col in ("H", "L"), fl="F7FBFF" if col in ("H", "L") else None)
        ws[f"{col}{r}"].font = font(9, col in ("H", "L"))
DL = DT + 2 + (BOQ_LAST - BOQ_FIRST + 1)
put(ws, f"B{DL}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{DL}:J{DL}")
for col in "KLM":
    put(ws, f"{col}{DL}", f"=SUM({col}{DT+2}:{col}{DL-1})", font(10, True, "FFFFFF"), fill(NAVY), align("center"),
        BORDER, ACC)
ws.conditional_formatting.add(f"B{DT+2}:M{DL-1}", FormulaRule(formula=[f"$H{DT+2}<>0"], fill=fill("FFF9E6")))
ws.conditional_formatting.add(f"I{DT+2}:I{DL-1}", FormulaRule(formula=[f"$I{DT+2}>$E{DT+2}+0.0001"],
                                                              fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.print_area = f"B1:M{DL}"
ws.print_title_rows = f"{DT+1}:{DT+1}"
ws.row_breaks.append(__import__("openpyxl").worksheet.pagebreak.Break(id=DT - 1))
ws.freeze_panes = "A6"

# ================================================================= التعليمات
ws = wsG
setup(ws, {"A": 2, "B": 26, "C": 95, "D": 2}, GOLD)
banner(ws, "B", "C", "📘 دليل استخدام شيت تتبع المستخلصات — Payment Certificates & Billing Tracker",
       "نظام متكامل لاحتساب نسب الإنجاز والدفعة المقدمة وضمان الأعمال والاستقطاعات الفنية لكل مستخلص بالتراكمي")
button(ws, "B3", "📊 الانتقال للوحة التحكم", S_DASH, NAVY)
button(ws, "C3", "⚙ ابدأ ببيانات العقد", S_SET)
r = 5
section(ws, f"B{r}", "دليل الألوان", f"B{r}:C{r}", NAVY2)
legend = [("إدخال يدوي", "خلايا صفراء بخط أزرق — هي الخلايا الوحيدة التي تُعدّل.", INPUT, INPUT_FONT),
          ("معادلة محسوبة", "خط أسود — لا تكتب فوقها.", "FFFFFF", "1F2933"),
          ("ربط من شيت آخر", "خط أخضر — قيمة مسحوبة آلياً من شيت آخر.", "FFFFFF", LINK_FONT),
          ("تنبيه", "تظليل أحمر/برتقالي: تجاوز كمية، كود مكرر، بيانات ناقصة، تأخر عن البرنامج.", RED_L, RED)]
for lab, desc, bg, fc in legend:
    r += 1
    put(ws, f"B{r}", lab, font(10, True, fc), fill(bg), align("center"), BORDER)
    put(ws, f"C{r}", desc, font(10), None, align("right", wrap=True, indent=1), BORDER)
r += 2
section(ws, f"B{r}", "خطوات العمل", f"B{r}:C{r}", NAVY2)
steps = [
    (S_SET, "أدخل بيانات المشروع والنسب التعاقدية: الدفعة المقدمة وطريقة استردادها، ضمان الأعمال وحده الأقصى، "
            "الضرائب. يمكن تعديل القوائم المنسدلة من نفس الشيت."),
    (S_BOQ, "أدخل بنود جدول الكميات (كود فريد، القسم، الوصف، الوحدة، الكمية، السعر). الإجمالي = قيمة العقد الأصلية."),
    (S_QTY, "في كل مستخلص أدخل الكمية المنفذة خلال الفترة فقط تحت عمود رقم المستخلص؛ يتم حساب التراكمي ونسبة "
            "إنجاز كل بند وتنبيه تجاوز الكمية التعاقدية آلياً."),
    (S_VO, "سجل الأوامر التغييرية: قيمة الأمر تعدّل قيمة العقد عند الاعتماد، والقيمة المدرجة تدخل المستخلص المحدد."),
    (S_TD, "سجل الاستقطاعات الفنية برقم المستخلص الذي خُصمت منه، وعند المعالجة اختر «نعم» وحدد مستخلص الإفراج."),
    (S_REG, "أدخل تواريخ المستخلص (إدخال «الفترة إلى» يُفعّل المستخلص)، الحالة، رصيد المواد بالموقع، النسبة المخططة، "
            "الإفراج عن الضمان والغرامات إن وجدت، ثم بيانات التحصيل. كل الحسابات تراكمية."),
    (S_FORM, "اختر رقم المستخلص من الخلية الصفراء لعرض شهادة الدفع (سابق / حالي / تراكمي) مع تفاصيل البنود، جاهزة للطباعة."),
    (S_DASH, "تابع المؤشرات: الإنجاز الفعلي مقابل المخطط، SPI، الموقف المالي، التحصيل، المحتجزات، والرسوم البيانية."),
]
for s, d in steps:
    r += 1
    c = put(ws, f"B{r}", s, font(10, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
    c.hyperlink = Hyperlink(ref=f"B{r}", location=f"'{s}'!A1", display=s)
    put(ws, f"C{r}", d, font(10), None, align("right", wrap=True, indent=1), BORDER)
    ws.row_dimensions[r].height = 34
r += 2
section(ws, f"B{r}", "منطق الاحتساب (كل القيم تراكمية ثم: الحالي = التراكمي − السابق)", f"B{r}:C{r}", NAVY2)
logic = [
    ("قيمة الأعمال المنفذة", "Σ (سعر الوحدة × مجموع كميات البند حتى المستخلص الحالي) — SUMPRODUCT ديناميكي على مصفوفة الكميات."),
    ("نسبة الإنجاز", "(الأعمال المنفذة + التغييرية المدرجة) ÷ (قيمة العقد الأصلية + التغييرية المدرجة)."),
    ("استرداد الدفعة المقدمة", "MIN(قيمة الدفعة ، MAX(0 ، الأعمال − نسبة البدء × العقد) × نسبة الاسترداد)، "
                               "ويُسترد كامل الرصيد عند بلوغ نسبة «الاسترداد الكامل»."),
    ("ضمان الأعمال", "MIN(إجمالي القيمة التراكمية × نسبة الضمان ، الحد الأقصى) − مجموع المفرج عنه."),
    ("الاستقطاعات الفنية", "مجموع المستقطع حتى المستخلص − مجموع المفرج عنه حتى المستخلص (SUMIFS)."),
    ("الصافي قبل الضرائب", "إجمالي القيمة − الاسترداد − صافي الضمان − الاستقطاعات الفنية − الغرامات التراكمية."),
    ("ضريبة القيمة المضافة", "النسبة × (الصافي + الضمان إن كان الإعداد «نعم»)."),
    ("ضريبة الخصم من المنبع", "النسبة × (الصافي قبل خصم الضمان)."),
    ("المستحق الحالي", "صافي المستحق التراكمي للمستخلص − صافي المستحق التراكمي للمستخلص السابق."),
    ("SPI", "نسبة الإنجاز الفعلية ÷ المخططة: أقل من 1 = تأخر، 1 أو أكثر = مطابق/متقدم."),
]
for lab, d in logic:
    r += 1
    put(ws, f"B{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
    put(ws, f"C{r}", d, font(10), None, align("right", wrap=True, indent=1), BORDER)
    ws.row_dimensions[r].height = 30
r += 2
section(ws, f"B{r}", "ملاحظات", f"B{r}:C{r}", GOLD)
for d in ["البيانات الحالية مثال توضيحي لمشروع (6 مستخلصات) — امسح الخلايا الصفراء وابدأ ببيانات مشروعك.",
          "السعة: 100 بند، 24 مستخلص، 50 أمر تغييري، 100 استقطاع فني. لا تحذف صفوفاً من داخل الجداول.",
          "رقم «آخر مستخلص فعال» يُحدد آلياً ويُميَّز في السجل وفي شيت الكميات المنفذة باللون الذهبي."]:
    r += 1
    put(ws, f"B{r}", "•", font(12, True, GOLD), None, align("center"), BORDER)
    put(ws, f"C{r}", d, font(10), None, align("right", wrap=True, indent=1), BORDER)
    ws.row_dimensions[r].height = 24

wb.active = 1
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print("saved", OUT)
