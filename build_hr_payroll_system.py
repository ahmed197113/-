# -*- coding: utf-8 -*-
"""
مولّد ملف نظام الرواتب والمخصصات (مسير 12 شهر + نهاية الخدمة + الإجازات + التذاكر + لوحة تحكم)
ينتج: HR_Payroll_Provisions_System.xlsx
"""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule, CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as CL, column_index_from_string as CI

OUT = "HR_Payroll_Provisions_System.xlsx"

# ---------------------------------------------------------------- الألوان والتنسيقات
FONT = "Arial"
NAVY, NAVY2 = "1F3A5F", "2C5282"
TEAL, TEAL_L = "2E7D7A", "DCEFEE"
CARD_BG = "FFFFFF"
LINE = "C9D3DD"
INPUT = "FFF8E1"
INPUT_FONT = "1A4FA0"
GREEN, GREEN_L = "2E7D32", "E8F5E9"
RED, RED_L = "C62828", "FDECEA"
GOLD = "9A6B00"
PURPLE = "5E35B1"
GREY_TXT = "5A6772"
ALT = "F5F8FB"
FORMULA_BG = "F2F4F7"

ACC = '_-* #,##0.00_-;[Red]_-* (#,##0.00)_-;_-* "-"??_-;_-@_-'
ACC0 = '_-* #,##0_-;[Red]_-* (#,##0)_-;_-* "-"??_-;_-@_-'
PCT = '0.00%;[Red]-0.00%;"-"'
DATE = "yyyy/mm/dd"
DAYS = '0.00;[Red]-0.00;"-"'
INT = '0;[Red]-0;"-"'

MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
          "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
MSHEETS = [f"مسير {m}" for m in MONTHS]

S_HOME = "الرئيسية"
S_DASH = "لوحة التحكم"
S_SET = "الإعدادات"
S_EMP = "الموظفون"
S_MOV = "الحركات الشهرية"
S_MSUM = "الملخص الشهري"
S_ESUM = "ملخص الموظفين السنوي"
S_EOS = "مخصص نهاية الخدمة"
S_LV = "مخصص الإجازات"
S_TK = "مخصص التذاكر"
S_JE = "قيود الرواتب"
S_SLIP = "قسيمة الراتب"

E0, E1, ET = 6, 105, 106          # صفوف الموظفين (100 موظف) + صف الإجمالي
M0, M1 = 6, 1005                  # صفوف الحركات الشهرية (1000 حركة)


def R(sheet):
    return f"'{sheet}'!"


EM, MV = R(S_EMP), R(S_MOV)

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


def setup(ws, widths, tab, landscape=True):
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 90
    ws.sheet_properties.tabColor = tab
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


SUBTITLE = '=cfg_CO&"   |   السنة المالية "&cfg_FY&"   |   شهر التقرير: "&INDEX(L_MONTH,cfg_VAL_M)&"   |   المبالغ بـ "&cfg_CUR'


def banner(ws, first, last, title, subtitle=SUBTITLE):
    put(ws, f"{first}1", title, font(18, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"{first}1:{last}1")
    ws.row_dimensions[1].height = 38
    put(ws, f"{first}2", subtitle, font(10, False, "FFFFFF", True), fill(NAVY2), align("center"), merge=f"{first}2:{last}2")
    ws.row_dimensions[2].height = 20
    ws.row_dimensions[3].height = 26
    ws.row_dimensions[4].height = 8


def button(ws, ref, text, target, color=TEAL, merge=None):
    c = put(ws, ref, text, font(10, True, "FFFFFF"), fill(color), align("center"),
            Border(left=Side("thin", "FFFFFF"), right=Side("thin", "FFFFFF"),
                   top=Side("thin", "FFFFFF"), bottom=Side("medium", NAVY)), merge=merge)
    c.hyperlink = Hyperlink(ref=ref, location=f"'{target}'!A1", display=text)
    return c


NAV_ALL = [("🏠 الرئيسية", S_HOME, NAVY), ("📊 لوحة التحكم", S_DASH, PURPLE), ("⚙ الإعدادات", S_SET, TEAL),
           ("👥 الموظفون", S_EMP, TEAL), ("✍ الحركات", S_MOV, TEAL), ("📅 الملخص الشهري", S_MSUM, TEAL),
           ("🧾 القيود", S_JE, TEAL), ("💳 القسيمة", S_SLIP, TEAL)]


def nav(ws, cols, skip=None):
    items = [n for n in NAV_ALL if n[1] != skip]
    for col, (t, s, c) in zip(cols, items):
        button(ws, f"{col}3", t, s, c)


def card(ws, row, c1, c2, label, value, fmt=ACC0, color=NAVY, big=15):
    put(ws, f"{c1}{row}", label, font(9, True, GREY_TXT), fill(CARD_BG), align("center", wrap=True),
        merge=f"{c1}{row}:{c2}{row}")
    put(ws, f"{c1}{row+1}", value, font(big, True, color), fill(CARD_BG), align("center"),
        fmt=fmt, merge=f"{c1}{row+1}:{c2}{row+1}")
    for r in (row, row + 1):
        for ci in range(CI(c1), CI(c2) + 1):
            ws.cell(r, ci).border = Border(left=Side("thin", LINE), right=Side("thin", LINE),
                                           top=Side("medium", color) if r == row else None,
                                           bottom=Side("thin", LINE) if r == row + 1 else None)
    ws.row_dimensions[row].height = 22
    ws.row_dimensions[row + 1].height = 32


def section(ws, ref, text, merge, color=TEAL):
    put(ws, ref, text, font(11, True, "FFFFFF"), fill(color), align("right", indent=1), merge=merge)
    ws.row_dimensions[ws[ref].row].height = 22


def headers(ws, row, cols_titles, color=NAVY, height=40):
    for col, t in cols_titles:
        put(ws, f"{col}{row}", t, font(10, True, "FFFFFF"), fill(color), align("center", wrap=True), BORDER)
    ws.row_dimensions[row].height = height


def add_name(wb, name, ref):
    wb.defined_names[name] = DefinedName(name, attr_text=ref)


def dv_list(ws, src, rng, title="اختيار من القائمة", msg=None, strict=True):
    dv = DataValidation(type="list", formula1=f"={src}" if not src.startswith('"') else src, allow_blank=True,
                        showErrorMessage=strict, errorStyle="stop" if strict else "warning")
    dv.errorTitle = "قيمة غير مسموحة"
    dv.error = "من فضلك اختر قيمة من القائمة المنسدلة."
    if msg:
        dv.promptTitle, dv.prompt, dv.showInputMessage = title, msg, True
    ws.add_data_validation(dv)
    dv.add(rng)


def dv_num(ws, rng, kind="decimal", lo=0, hi=None, msg=None):
    op = "between" if hi is not None else "greaterThanOrEqual"
    dv = DataValidation(type=kind, operator=op, formula1=str(lo), formula2=str(hi) if hi is not None else None,
                        allow_blank=True, showErrorMessage=True)
    dv.errorTitle, dv.error = "قيمة غير صحيحة", msg or "القيمة المدخلة خارج النطاق المسموح."
    ws.add_data_validation(dv)
    dv.add(rng)


def status_cf(ws, rng, first):
    for sym, bg, fg in (("✔", GREEN_L, GREEN), ("✖", RED_L, RED), ("⚠", "FFF3CD", GOLD)):
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'ISNUMBER(SEARCH("{sym}",{first}))'],
                                                       fill=fill(bg), font=Font(color=fg, bold=True)))


def data_rows(ws, cols, r0, r1, spec):
    """spec: {col: (kind, fmt)} — kind: 'in' إدخال | 'f' معادلة"""
    for r in range(r0, r1 + 1):
        band = fill(ALT) if (r - r0) % 2 else fill(CARD_BG)
        for col in cols:
            kind, fmt = spec.get(col, ("f", None))
            c = ws[f"{col}{r}"]
            c.border = BORDER
            c.alignment = align("center")
            if kind == "in":
                c.font, c.fill = font(10, False, INPUT_FONT), fill(INPUT)
            else:
                c.font, c.fill = font(10), band
            if fmt:
                c.number_format = fmt


def total_row(ws, r, label_col, label, cols, r0, r1, fmt=ACC, first=None, last=None):
    first = first or label_col
    for ci in range(CI(first), CI(last) + 1):
        put(ws, f"{CL(ci)}{r}", None, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
    ws[f"{label_col}{r}"].value = label
    for col in cols:
        ws[f"{col}{r}"].value = f"=SUM({col}{r0}:{col}{r1})"
    ws.row_dimensions[r].height = 24


def note(ws, ref, text, merge, h=30):
    put(ws, ref, text, font(9, False, GREY_TXT, True), None, align(wrap=True), merge=merge)
    ws.row_dimensions[ws[ref].row].height = h


# ================================================================ بيانات العينة
D = dt.date
DEPTS = ["الإدارة العليا", "المالية", "الموارد البشرية", "المبيعات", "العمليات", "تقنية المعلومات", "المشاريع"]
REASONS = ["استقالة", "إنهاء من صاحب العمل", "انتهاء مدة العقد", "اتفاق الطرفين", "وفاة أو عجز"]
YN = ["نعم", "لا"]
CATS = ["سعودي", "غير سعودي"]

# (رقم, اسم, جنسية, فئة, قسم, مسمى, تعيين, انتهاء هوية, أساسي, سكن, نقل, أخرى, أيام إجازة يدوي,
#  تذكرة؟, قيمة التذكرة, دورية, رصيد إجازة افتتاحي, رصيد تذاكر افتتاحي, تاريخ انتهاء, سبب, بنك, آيبان)
EMPLOYEES = [
    ("E001", "عبدالله محمد العتيبي", "سعودي", "سعودي", "الإدارة العليا", "المدير العام", D(2012, 1, 15), D(2029, 5, 10),
     28000, 7000, 2800, 3000, None, "لا", 0, 12, 18, 0, None, None, "الراجحي", "SA0380000000608010167519"),
    ("E002", "أحمد سعيد القحطاني", "سعودي", "سعودي", "المالية", "مدير مالي", D(2016, 6, 1), D(2028, 2, 3),
     18000, 4500, 1800, 1000, None, "لا", 0, 12, 12, 0, None, None, "الأهلي", "SA4410000011100000000001"),
    ("E003", "محمد علي حسن", "مصري", "غير سعودي", "المالية", "محاسب أول", D(2018, 9, 10), D(2026, 11, 20),
     8500, 2125, 850, 500, None, "نعم", 3200, 24, 20, 1600, None, None, "الراجحي", "SA0380000000608010167520"),
    ("E004", "نورة خالد الدوسري", "سعودية", "سعودي", "الموارد البشرية", "مديرة موارد بشرية", D(2019, 2, 1), D(2030, 7, 14),
     14000, 3500, 1400, 0, None, "لا", 0, 12, 9, 0, None, None, "الإنماء", "SA6005000068200000000002"),
    ("E005", "راجيش كومار", "هندي", "غير سعودي", "تقنية المعلومات", "مهندس شبكات", D(2020, 4, 12), D(2027, 1, 30),
     9000, 2250, 900, 700, None, "نعم", 2800, 12, 14, 900, None, None, "الأهلي", "SA4410000011100000000003"),
    ("E006", "فهد ناصر الشمري", "سعودي", "سعودي", "المبيعات", "مدير مبيعات", D(2017, 11, 5), D(2031, 3, 22),
     13000, 3250, 1300, 2500, None, "لا", 0, 12, 25, 0, None, None, "الراجحي", "SA0380000000608010167521"),
    ("E007", "خالد يوسف الأحمد", "أردني", "غير سعودي", "المشاريع", "مهندس مشاريع", D(2021, 1, 20), D(2026, 10, 25),
     11000, 2750, 1100, 800, None, "نعم", 4500, 12, 16, 2400, None, None, "البلاد", "SA1515000999100000000004"),
    ("E008", "سارة عبدالرحمن الزهراني", "سعودية", "سعودي", "المالية", "محاسبة", D(2023, 3, 1), D(2032, 9, 9),
     7500, 1875, 750, 0, None, "لا", 0, 12, 6, 0, None, None, "الإنماء", "SA6005000068200000000005"),
    ("E009", "محمد رفيق", "باكستاني", "غير سعودي", "العمليات", "مشرف عمليات", D(2014, 8, 18), D(2027, 6, 1),
     6500, 1625, 650, 300, 30, "نعم", 2200, 24, 35, 2000, None, None, "الراجحي", "SA0380000000608010167522"),
    ("E010", "ريم سلطان المطيري", "سعودية", "سعودي", "المبيعات", "أخصائية تسويق", D(2026, 4, 15), D(2033, 1, 1),
     9000, 2250, 900, 0, None, "لا", 0, 12, 0, 0, None, None, "الأهلي", "SA4410000011100000000006"),
    ("E011", "جون ماتيو", "فلبيني", "غير سعودي", "العمليات", "فني صيانة", D(2019, 3, 1), D(2027, 4, 4),
     5000, 1250, 500, 0, None, "نعم", 2600, 24, 22, 1800, D(2026, 6, 30), "استقالة", "الراجحي", "SA0380000000608010167523"),
    ("E012", "عمر حسين البيشي", "سعودي", "سعودي", "تقنية المعلومات", "مطور برمجيات", D(2022, 7, 10), D(2029, 12, 12),
     12000, 3000, 1200, 1500, None, "لا", 0, 12, 10, 0, None, None, "البلاد", "SA1515000999100000000007"),
]

# (شهر, رقم, غياب, بدون راتب, ساعات إضافي, مكافآت, إضافات, سلف, جزاءات, إجازة مأخوذة, إجازة نقداً, تذاكر مستخدمة, نهاية خدمة مدفوعة, ملاحظات)
MOVES = [
    (1, "E003", 0, 0, 12, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 1/5"),
    (1, "E009", 1, 0, 20, 0, 0, 0, 100, 0, 0, 0, 0, "غياب يوم"),
    (2, "E003", 0, 0, 8, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 2/5"),
    (2, "E006", 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0, 0, "عمولة مبيعات الربع الرابع"),
    (3, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 3/5"),
    (3, "E001", 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, "إجازة سنوية"),
    (3, "E007", 0, 0, 10, 0, 0, 0, 0, 21, 0, 4500, 0, "إجازة سنوية + تذكرة"),
    (4, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 4/5"),
    (4, "E012", 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "غياب يومين"),
    (5, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 5/5"),
    (5, "E005", 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, ""),
    (6, "E009", 0, 0, 0, 0, 0, 0, 0, 30, 0, 2200, 0, "إجازة سنوية + تذكرة"),
    (6, "E006", 0, 0, 0, 6500, 0, 0, 0, 0, 0, 0, 0, "عمولة مبيعات"),
    (6, "E011", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "آخر يوم عمل 30/06"),
    (7, "E011", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "تسوية مستحقات نهاية الخدمة"),
    (7, "E004", 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, "إجازة سنوية"),
    (7, "E002", 0, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, "إجازة سنوية"),
    (8, "E008", 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, "إجازة بدون راتب"),
    (8, "E005", 0, 0, 0, 0, 0, 0, 0, 21, 0, 2800, 0, "إجازة سنوية + تذكرة"),
    (9, "E010", 0, 0, 6, 0, 1500, 0, 0, 0, 0, 0, 0, "بدل مهمة عمل"),
    (9, "E006", 0, 0, 0, 0, 0, 0, 250, 0, 0, 0, 0, "جزاء تأخير"),
]

wb = Workbook()
ws_home = wb.active
ws_home.title = S_HOME
ws_dash = wb.create_sheet(S_DASH)
ws_set = wb.create_sheet(S_SET)
ws_emp = wb.create_sheet(S_EMP)
ws_mov = wb.create_sheet(S_MOV)
ws_months = [wb.create_sheet(s) for s in MSHEETS]
ws_msum = wb.create_sheet(S_MSUM)
ws_esum = wb.create_sheet(S_ESUM)
ws_eos = wb.create_sheet(S_EOS)
ws_lv = wb.create_sheet(S_LV)
ws_tk = wb.create_sheet(S_TK)
ws_je = wb.create_sheet(S_JE)
ws_slip = wb.create_sheet(S_SLIP)

# ================================================================ الإعدادات
ws = ws_set
setup(ws, {"A": 2, "B": 44, "C": 18, "D": 58, "E": 3, "F": 20, "G": 22, "H": 9, "I": 14, "J": 11, "K": 16}, TEAL)
banner(ws, "B", "K", "⚙ الإعدادات والثوابت النظامية")
nav(ws, list("BCDFGHIJ"), S_SET)
headers(ws, 5, [("B", "البند"), ("C", "القيمة"), ("D", "الشرح / المصدر")], height=26)

SETTINGS = [
    # (row, label, value, fmt, name, note, input?)
    (6, "اسم المنشأة", "شركة النخبة للتجارة والمقاولات", None, "cfg_CO", "يظهر في رؤوس جميع الأوراق والقسائم.", True),
    (7, "السنة المالية", 2026, "0", "cfg_FY", "كل التواريخ الشهرية تُبنى على هذه السنة.", True),
    (8, "العملة", "ريال سعودي", None, "cfg_CUR", "", True),
    (9, "شهر التقرير (1-12)", 9, "0", "cfg_VAL_M", "يتحكم في: المخصصات كما في نهاية الشهر، مؤشرات لوحة التحكم (من بداية السنة حتى هذا الشهر)، وتمييز الأشهر الفعلية عن المتوقعة.", True),
    (10, "بداية السنة المالية", "=DATE(cfg_FY,1,1)", DATE, "cfg_Y_START", "معادلة — لا تعدّل.", False),
    (11, "تاريخ التقرير (نهاية شهر التقرير)", "=EOMONTH(DATE(cfg_FY,cfg_VAL_M,1),0)", DATE, "cfg_VAL_DATE", "معادلة — لا تعدّل.", False),
    (13, "أساس أيام الشهر", 30, "0", "cfg_DAYS_M", "الأجر اليومي = الأجر الشهري ÷ 30 (العرف المحاسبي ونظام العمل).", True),
    (14, "ساعات العمل اليومية", 8, "0", "cfg_HRS", "المادة 98 من نظام العمل: 8 ساعات يومياً.", True),
    (15, "علاوة العمل الإضافي على الأجر الأساسي", 0.5, PCT, "cfg_OT_P", "المادة 107: أجر الساعة + 50% من الأجر الأساسي للساعة.", True),
    (17, "سعودي — حصة الموظف", 0.0975, PCT, "cfg_G_SE", "معاشات 9% + ساند 0.75%. المشتركون الجدد بعد 3/7/2025 تتدرج نسبتهم سنوياً — عدّل عند الحاجة.", True),
    (18, "سعودي — حصة المنشأة", 0.1175, PCT, "cfg_G_SR", "معاشات 9% + ساند 0.75% + أخطار مهنية 2%.", True),
    (19, "غير سعودي — حصة الموظف", 0, PCT, "cfg_G_NE", "لا يُستقطع من غير السعودي.", True),
    (20, "غير سعودي — حصة المنشأة", 0.02, PCT, "cfg_G_NR", "أخطار مهنية 2%.", True),
    (21, "الحد الأعلى لأجر الاشتراك", 45000, ACC0, "cfg_G_CAP", "أجر الاشتراك = الأساسي + السكن بحد أقصى 45,000.", True),
    (23, "عدد السنوات الأولى", 5, "0", "cfg_EOS_TH", "المادة 84: نصف شهر عن كل سنة من السنوات الخمس الأولى.", True),
    (24, "أجر كل سنة من السنوات الأولى (بالأشهر)", 0.5, "0.00", "cfg_EOS_R1", "", True),
    (25, "أجر كل سنة بعدها (بالأشهر)", 1, "0.00", "cfg_EOS_R2", "أجر شهر كامل عن كل سنة تالية.", True),
    (26, "يدخل بدل السكن في أجر نهاية الخدمة؟", "نعم", None, "cfg_EOS_H", "الأجر الفعلي حسب المادة 2: الأساسي + البدلات الثابتة.", True),
    (27, "يدخل بدل النقل في أجر نهاية الخدمة؟", "نعم", None, "cfg_EOS_T", "", True),
    (28, "تدخل البدلات الأخرى في أجر نهاية الخدمة؟", "لا", None, "cfg_EOS_O", "", True),
    (30, "أيام الإجازة السنوية (قبل الحد)", 21, "0", "cfg_LV_D1", "المادة 109: 21 يوماً.", True),
    (31, "أيام الإجازة السنوية (بعد الحد)", 30, "0", "cfg_LV_D2", "30 يوماً بعد إتمام 5 سنوات متصلة.", True),
    (32, "عدد سنوات الحد للإجازة", 5, "0", "cfg_LV_TH", "", True),
    (33, "يدخل السكن في أجر الإجازة؟", "نعم", None, "cfg_LV_H", "", True),
    (34, "يدخل النقل في أجر الإجازة؟", "نعم", None, "cfg_LV_T", "", True),
    (35, "تدخل البدلات الأخرى في أجر الإجازة؟", "لا", None, "cfg_LV_O", "", True),
    (36, "عدد أيام السنة لاحتساب مدة الخدمة", 365, "0", "cfg_DAYS_Y", "", True),
]
section(ws, "B12", "💰 الرواتب والعمل الإضافي", "B12:D12")
section(ws, "B16", "🏛 التأمينات الاجتماعية (GOSI)", "B16:D16")
section(ws, "B22", "🎁 مكافأة نهاية الخدمة", "B22:D22")
section(ws, "B29", "🌴 الإجازات السنوية", "B29:D29")
for r, lab, val, fmt, nm, nt, is_in in SETTINGS:
    put(ws, f"B{r}", lab, font(10, True), fill(CARD_BG), align(), BORDER)
    put(ws, f"C{r}", val, font(11, True, INPUT_FONT if is_in else NAVY), fill(INPUT if is_in else FORMULA_BG),
        align("center"), BORDER, fmt)
    put(ws, f"D{r}", nt, font(9, False, GREY_TXT), fill(CARD_BG), align(wrap=True), BORDER)
    add_name(wb, nm, f"{R(S_SET)}$C${r}")
    ws.row_dimensions[r].height = 30 if len(nt) > 60 else 22
section(ws, "B37", "📐 نسب استحقاق مكافأة نهاية الخدمة عند الاستقالة (المادة 85)", "B37:D37")
headers(ws, 38, [("B", "مدة الخدمة من (سنة)"), ("C", "نسبة الاستحقاق"), ("D", "الشرح")], height=24)
for i, (y, f, t) in enumerate([(0, 0, "أقل من سنتين: لا يستحق"), (2, "=1/3", "من سنتين إلى أقل من 5: ثلث المكافأة"),
                               (5, "=2/3", "من 5 إلى أقل من 10: ثلثا المكافأة"), (10, 1, "10 سنوات فأكثر: المكافأة كاملة")]):
    r = 39 + i
    put(ws, f"B{r}", y, font(10, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, "0")
    put(ws, f"C{r}", f, font(10, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, PCT)
    put(ws, f"D{r}", t, font(9, False, GREY_TXT), fill(CARD_BG), align(), BORDER)
add_name(wb, "cfg_RES", f"{R(S_SET)}$B$39:$C$42")
note(ws, "B44", "الخلايا الصفراء بالخط الأزرق = مدخلات قابلة للتعديل. الخلايا الرمادية = معادلات. "
     "النسب والحدود مأخوذة من نظام العمل السعودي ونظام التأمينات الاجتماعية — راجعها عند صدور أي تعديل نظامي.", "B44:D44", 34)
dv_list(ws, "L_YN", "C26:C28")
dv_list(ws, "L_YN", "C33:C35")
dv_num(ws, "C9", "whole", 1, 12, "شهر التقرير من 1 إلى 12")
for c in ("C7",):
    dv_num(ws, c, "whole", 2000, 2100)

# القوائم
LISTS = [("F", "الأقسام", DEPTS, 15, "L_DEPT"), ("G", "أسباب انتهاء الخدمة", REASONS, 5, "L_REASON"),
         ("H", "نعم / لا", YN, 2, "L_YN"), ("I", "فئة التأمينات", CATS, 2, "L_CAT"),
         ("J", "الأشهر", MONTHS, 12, "L_MONTH"), ("K", "أوراق المسير", MSHEETS, 12, "L_MSHEET")]
for col, title, items, size, nm in LISTS:
    put(ws, f"{col}5", title, font(10, True, "FFFFFF"), fill(TEAL), align("center", wrap=True), BORDER)
    for i in range(size):
        v = items[i] if i < len(items) else None
        editable = nm in ("L_DEPT",)
        put(ws, f"{col}{6+i}", v, font(10, False, INPUT_FONT if editable else "1F2933"),
            fill(INPUT if editable else CARD_BG), align("center"), BORDER)
    add_name(wb, nm, f"{R(S_SET)}${col}$6:${col}${5+size}")
ws["F5"].comment = Comment("أضف أقسامك في الخانات الفارغة (حتى 15 قسماً).", "النظام")
add_name(wb, "L_EMPID", f"{EM}$B${E0}:$B${E1}")
ws.freeze_panes = "A6"

# ================================================================ الموظفون
ws = ws_emp
EMP_COLS = [
    ("A", "م", 5, "f", "0"), ("B", "الرقم الوظيفي", 11, "in", None), ("C", "اسم الموظف", 26, "in", None),
    ("D", "الجنسية", 11, "in", None), ("E", "فئة التأمينات", 12, "in", None), ("F", "القسم", 16, "in", None),
    ("G", "المسمى الوظيفي", 18, "in", None), ("H", "تاريخ التعيين", 12, "in", DATE),
    ("I", "انتهاء الهوية / الإقامة", 12, "in", DATE),
    ("J", "الراتب الأساسي", 13, "in", ACC), ("K", "بدل السكن", 12, "in", ACC), ("L", "بدل النقل", 11, "in", ACC),
    ("M", "بدلات أخرى", 11, "in", ACC), ("N", "إجمالي الراتب الشهري", 14, "f", ACC),
    ("O", "أجر احتساب نهاية الخدمة", 14, "f", ACC), ("P", "أجر احتساب الإجازة", 13, "f", ACC),
    ("Q", "أجر الاشتراك في التأمينات", 13, "f", ACC),
    ("R", "أيام الإجازة السنوية (اختياري — يلغي الآلي)", 13, "in", "0"),
    ("S", "يستحق تذكرة سفر؟", 10, "in", None), ("T", "قيمة التذكرة (له ولمن يعول)", 13, "in", ACC),
    ("U", "دورية التذكرة (شهر)", 10, "in", "0"),
    ("V", "رصيد إجازات افتتاحي (يوم) في 1/1", 12, "in", DAYS),
    ("W", "رصيد مخصص تذاكر افتتاحي في 1/1", 13, "in", ACC),
    ("X", "تاريخ انتهاء الخدمة", 12, "in", DATE), ("Y", "سبب انتهاء الخدمة", 16, "in", None),
    ("Z", "الحالة في تاريخ التقرير", 14, "f", None),
    ("AA", "البنك", 10, "in", None), ("AB", "رقم الآيبان IBAN", 27, "in", None), ("AC", "ملاحظات", 20, "in", None),
]
setup(ws, {c: w for c, _, w, _, _ in EMP_COLS}, NAVY)
banner(ws, "A", "Z", "👥 سجل بيانات الموظفين الرئيسي")
nav(ws, ["B", "C", "E", "F", "G", "H", "J"], S_EMP)
headers(ws, 5, [(c, t) for c, t, _, _, _ in EMP_COLS], height=58)
data_rows(ws, [c for c, *_ in EMP_COLS], E0, E1, {c: (k, f) for c, _, _, k, f in EMP_COLS})
for r in range(E0, E1 + 1):
    ws[f"A{r}"] = f'=IF(B{r}="","",ROW()-{E0-1})'
    ws[f"N{r}"] = f'=IF(B{r}="","",SUM(J{r}:M{r}))'
    ws[f"O{r}"] = f'=IF(B{r}="","",J{r}+IF(cfg_EOS_H="نعم",K{r},0)+IF(cfg_EOS_T="نعم",L{r},0)+IF(cfg_EOS_O="نعم",M{r},0))'
    ws[f"P{r}"] = f'=IF(B{r}="","",J{r}+IF(cfg_LV_H="نعم",K{r},0)+IF(cfg_LV_T="نعم",L{r},0)+IF(cfg_LV_O="نعم",M{r},0))'
    ws[f"Q{r}"] = f'=IF(B{r}="","",MIN(cfg_G_CAP,J{r}+K{r}))'
    ws[f"Z{r}"] = (f'=IF(B{r}="","",IF(AND(X{r}<>"",X{r}<=cfg_VAL_DATE),"✖ منتهي الخدمة",'
                   f'IF(H{r}>cfg_VAL_DATE,"⚠ لم يباشر بعد","✔ على رأس العمل")))')
for i, e in enumerate(EMPLOYEES):
    r = E0 + i
    vals = dict(zip("BCDEFGHIJKLMRSTUVWXY", e[:20]))
    vals["AA"], vals["AB"] = e[20], e[21]
    for col, v in vals.items():
        if v is not None:
            ws[f"{col}{r}"] = v
total_row(ws, ET, "C", "الإجمالي", list("JKLMNOPQ") + ["T", "W"], E0, E1, ACC, "A", "AC")
ws[f"B{ET}"] = f'=COUNTA(B{E0}:B{E1})&" موظف"'
dv_list(ws, "L_CAT", f"E{E0}:E{E1}", "فئة التأمينات", "سعودي / غير سعودي — تحدد نسب التأمينات.")
dv_list(ws, "L_DEPT", f"F{E0}:F{E1}", "القسم", "اختر القسم (تُضاف الأقسام من ورقة الإعدادات).")
dv_list(ws, "L_YN", f"S{E0}:S{E1}")
dv_list(ws, "L_REASON", f"Y{E0}:Y{E1}", "سبب انتهاء الخدمة", "يحدد نسبة الاستحقاق (الاستقالة وفق المادة 85).")
dv_list(ws, '"12,24"', f"U{E0}:U{E1}", "دورية التذكرة", "12 = تذكرة سنوية، 24 = كل سنتين.")
dup = DataValidation(type="custom", formula1=f"COUNTIF($B${E0}:$B${E1},B{E0})=1", showErrorMessage=True)
dup.errorTitle, dup.error = "رقم مكرر", "الرقم الوظيفي مستخدم من قبل. كل موظف له رقم فريد."
ws.add_data_validation(dup)
dup.add(f"B{E0}:B{E1}")
dv_num(ws, f"J{E0}:M{E1}", "decimal", 0)
dvd = DataValidation(type="date", operator="greaterThan", formula1="1", allow_blank=True, showErrorMessage=True)
dvd.errorTitle, dvd.error = "تاريخ غير صحيح", "أدخل تاريخاً صحيحاً بالصيغة yyyy/mm/dd"
ws.add_data_validation(dvd)
for rng in (f"H{E0}:H{E1}", f"I{E0}:I{E1}", f"X{E0}:X{E1}"):
    dvd.add(rng)
status_cf(ws, f"Z{E0}:Z{E1}", f"Z{E0}")
ws.conditional_formatting.add(f"I{E0}:I{E1}", FormulaRule(
    formula=[f'AND(I{E0}<>"",I{E0}<=cfg_VAL_DATE+60)'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.conditional_formatting.add(f"Y{E0}:Y{E1}", FormulaRule(
    formula=[f'AND(X{E0}<>"",Y{E0}="")'], fill=fill(RED_L)))
ws["I5"].comment = Comment("تُلوَّن بالأحمر إذا انتهت أو ستنتهي خلال 60 يوماً من تاريخ التقرير.", "النظام")
ws["R5"].comment = Comment("اتركها فارغة ليحسبها النظام آلياً (21 يوماً ثم 30 بعد 5 سنوات). "
                           "اكتب رقماً إذا كان العقد يمنح أياماً أكثر.", "النظام")
ws["X5"].comment = Comment("اتركه فارغاً للموظف على رأس العمل. عند إدخاله يتوقف الراتب والمخصصات بعد هذا التاريخ.", "النظام")
ws["V5"].comment = Comment("رصيد الأيام غير المستخدمة كما في 1 يناير من السنة المالية (للموظف المعين خلال السنة: صفر).", "النظام")
ws.freeze_panes = f"D{E0}"
ws.auto_filter.ref = f"A5:AC{E1}"

# ================================================================ الحركات الشهرية
ws = ws_mov
MOV_COLS = [
    ("A", "الشهر (1-12)", 8, "in", "0"), ("B", "الرقم الوظيفي", 11, "in", None), ("C", "اسم الموظف (تلقائي)", 26, "f", None),
    ("D", "أيام غياب", 9, "in", DAYS), ("E", "إجازة بدون راتب (يوم)", 10, "in", DAYS),
    ("F", "ساعات عمل إضافي", 10, "in", DAYS), ("G", "مكافآت وعمولات", 12, "in", ACC),
    ("H", "إضافات أخرى / فروقات", 12, "in", ACC), ("I", "أقساط سلف", 12, "in", ACC),
    ("J", "خصومات وجزاءات", 12, "in", ACC), ("K", "إجازة سنوية مأخوذة (يوم)", 11, "in", DAYS),
    ("L", "إجازة مصروفة نقداً (يوم)", 11, "in", DAYS), ("M", "قيمة تذاكر مستخدمة", 12, "in", ACC),
    ("N", "مكافأة نهاية خدمة مدفوعة", 13, "in", ACC), ("O", "ملاحظات", 28, "in", None),
]
setup(ws, {c: w for c, _, w, _, _ in MOV_COLS}, "1A73E8")
banner(ws, "A", "O", "✍ الحركات الشهرية المتغيرة (غياب — إضافي — مكافآت — سلف — إجازات — تذاكر)")
nav(ws, list("ABCDEFGH"), S_MOV)
headers(ws, 5, [(c, t) for c, t, _, _, _ in MOV_COLS], height=48)
data_rows(ws, [c for c, *_ in MOV_COLS], M0, M1, {c: (k, f) for c, _, _, k, f in MOV_COLS})
for r in range(M0, M1 + 1):
    ws[f"C{r}"] = (f'=IF(B{r}="","",IFERROR(INDEX({EM}$C${E0}:$C${E1},MATCH(B{r},{EM}$B${E0}:$B${E1},0)),'
                   f'"✖ رقم غير موجود"))')
for i, mv in enumerate(MOVES):
    r = M0 + i
    for col, v in zip("ABDEFGHIJKLMNO", mv):
        if v not in (0, "", None):
            ws[f"{col}{r}"] = v
# تسوية نهاية الخدمة للموظف المستقيل E011 — معادلة تقرأ الاستحقاق من ورقة المخصص (مثال على الترابط)
ws[f"N{M0+14}"] = f"=INDEX({R(S_EOS)}$O${E0}:$O${E1},MATCH(B{M0+14},{R(S_EOS)}$B${E0}:$B${E1},0))"
lv_at = lambda c: f"INDEX({R(S_LV)}${c}${E0}:${c}${E1},MATCH(B{M0+14},{R(S_LV)}$B${E0}:$B${E1},0))"
ws[f"L{M0+14}"] = f"={lv_at('H')}+{lv_at('L')}-{lv_at('M')}"
ws[f"H{M0+14}"] = f"=L{M0+14}*INDEX({R(S_LV)}$G${E0}:$G${E1},MATCH(B{M0+14},{R(S_LV)}$B${E0}:$B${E1},0))"
ws[f"O{M0+14}"] = "تسوية نهاية خدمة: المكافأة + صرف رصيد الإجازات نقداً (في الإضافات)"
dv_num(ws, f"A{M0}:A{M1}", "whole", 1, 12, "الشهر رقم من 1 إلى 12")
dv_list(ws, "L_EMPID", f"B{M0}:B{M1}", "الرقم الوظيفي", "اختر رقم الموظف من القائمة")
dv_num(ws, f"D{M0}:N{M1}", "decimal", 0, None, "القيم يجب أن تكون موجبة")
status_cf(ws, f"C{M0}:C{M1}", f"C{M0}")
note(ws, "A4", "", "A4:O4", 8)
ws.freeze_panes = f"D{M0}"
ws.auto_filter.ref = f"A5:O{M1}"
ws["A5"].comment = Comment("سجّل كل حركة في سطر: الشهر + رقم الموظف + القيم. يمكن تكرار الموظف في نفس الشهر؛ "
                           "المسير يجمع كل الحركات تلقائياً.", "النظام")
ws["L5"].comment = Comment("أيام الإجازة التي صُرفت نقداً (تُخصم من رصيد الإجازات). أدخل مبلغها في «إضافات أخرى» ليُصرف مع الراتب.", "النظام")

# ================================================================ مسير الرواتب الشهري × 12
PAY_COLS = [
    ("A", "م", 5, "0"), ("B", "الرقم الوظيفي", 10, None), ("C", "اسم الموظف", 24, None), ("D", "القسم", 14, None),
    ("E", "الفئة", 10, None), ("F", "أيام الاستحقاق", 9, DAYS), ("G", "أيام الغياب", 8, DAYS),
    ("H", "بدون راتب", 8, DAYS), ("I", "أيام مدفوعة", 9, DAYS),
    ("J", "الأساسي", 12, ACC), ("K", "السكن", 11, ACC), ("L", "النقل", 10, ACC), ("M", "أخرى", 10, ACC),
    ("N", "ساعات إضافي", 8, DAYS), ("O", "قيمة الإضافي", 11, ACC), ("P", "مكافآت وعمولات", 11, ACC),
    ("Q", "إضافات أخرى", 11, ACC), ("R", "إجمالي المستحقات", 13, ACC),
    ("S", "تأمينات (حصة الموظف)", 11, ACC), ("T", "أقساط سلف", 10, ACC), ("U", "خصومات وجزاءات", 10, ACC),
    ("V", "إجمالي الاستقطاعات", 12, ACC), ("W", "صافي الراتب", 13, ACC),
    ("X", "تأمينات (حصة المنشأة)", 11, ACC), ("Y", "مخصص نهاية الخدمة للشهر", 12, ACC),
    ("Z", "مخصص الإجازات للشهر", 11, ACC), ("AA", "مخصص التذاكر للشهر", 11, ACC),
    ("AB", "إجمالي تكلفة الموظف", 13, ACC),
    ("AC", "سنوات الخدمة نهاية الشهر", 9, "0.000"), ("AD", "سنوات الخدمة نهاية الشهر السابق", 9, "0.000"),
    ("AE", "أيام العمل الفعلية (تقويمي)", 9, INT),
]
PAY_GROUP = {c: g for g, cs in ((NAVY, "ABCDE"), ("4A5568", "FGHI"), (TEAL, ["J", "K", "L", "M", "N", "O", "P", "Q", "R"]),
                                (RED, "STUV"), (GREEN, "W"), (PURPLE, ["X", "Y", "Z", "AA", "AB"]),
                                ("8795A1", ["AC", "AD", "AE"])) for c in cs}


def mv_sum(col, r):
    return (f"SUMIFS({MV}${col}${M0}:${col}${M1},{MV}$B${M0}:$B${M1},$B{r},"
            f"{MV}$A${M0}:$A${M1},$C$3)")


def end_at(r, d):
    """تاريخ نهاية الخدمة المحسوبة حتى التاريخ d"""
    return f'IF(OR({EM}$X{r}="",{EM}$X{r}>{d}),{d},{EM}$X{r})'


for m, ws in enumerate(ws_months, start=1):
    setup(ws, {c: w for c, _, w, _ in PAY_COLS}, "B7791F" if m % 2 else "C05621")
    banner(ws, "A", "AB", f'="💵 مسير رواتب شهر {MONTHS[m-1]} "&cfg_FY')
    put(ws, "B3", "الشهر", font(10, True, GREY_TXT), None, align("center"))
    put(ws, "C3", m, font(12, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, "0")
    put(ws, "D3", "من", font(10, True, GREY_TXT), None, align("center"))
    put(ws, "E3", "=DATE(cfg_FY,C3,1)", font(10, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, DATE)
    put(ws, "F3", "إلى", font(10, True, GREY_TXT), None, align("center"))
    put(ws, "G3", "=EOMONTH(E3,0)", font(10, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, DATE)
    put(ws, "H3", '=IF(C3<=cfg_VAL_M,"✔ فعلي","⚠ متوقع")', font(10, True), None, align("center"), BORDER)
    status_cf(ws, "H3", "H3")
    prev = MSHEETS[m - 2] if m > 1 else None
    nxt = MSHEETS[m] if m < 12 else None
    if prev:
        button(ws, "J3", "◀ الشهر السابق", prev, "4A5568", merge="J3:K3")
    if nxt:
        button(ws, "L3", "الشهر التالي ▶", nxt, "4A5568", merge="L3:M3")
    for col, (t, s, c) in zip(["O", "P", "R", "S", "U", "W"],
                              [NAV_ALL[0], NAV_ALL[1], NAV_ALL[3], NAV_ALL[4], NAV_ALL[5], NAV_ALL[6]]):
        button(ws, f"{col}3", t, s, c)
    for col, t, _, _ in PAY_COLS:
        put(ws, f"{col}5", t, font(9, True, "FFFFFF"), fill(PAY_GROUP[col]), align("center", wrap=True), BORDER)
    ws.row_dimensions[5].height = 48
    data_rows(ws, [c for c, *_ in PAY_COLS], E0, E1, {c: ("f", f) for c, _, _, f in PAY_COLS})
    for r in range(E0, E1 + 1):
        B = f'$B{r}=""'
        f = {
            "A": f'=IF({B},"",{EM}$A{r})',
            "B": f'=IF({EM}$B{r}="","",{EM}$B{r})',
            "C": f'=IF({B},"",{EM}$C{r})',
            "D": f'=IF({B},"",{EM}$F{r})',
            "E": f'=IF({B},"",{EM}$E{r})',
            "AE": f'=IF({B},"",MAX(0,{end_at(r, "$G$3")}-MAX($E$3,{EM}$H{r})+1))',
            "F": f'=IF({B},"",IF(AE{r}>=DAY($G$3),cfg_DAYS_M,MIN(AE{r},cfg_DAYS_M)))',
            "G": f'=IF({B},"",{mv_sum("D", r)})',
            "H": f'=IF({B},"",{mv_sum("E", r)})',
            "I": f'=IF({B},"",MAX(0,F{r}-G{r}-H{r}))',
            "J": f'=IF({B},"",{EM}$J{r}*$I{r}/cfg_DAYS_M)',
            "K": f'=IF({B},"",{EM}$K{r}*$I{r}/cfg_DAYS_M)',
            "L": f'=IF({B},"",{EM}$L{r}*$I{r}/cfg_DAYS_M)',
            "M": f'=IF({B},"",{EM}$M{r}*$I{r}/cfg_DAYS_M)',
            "N": f'=IF({B},"",{mv_sum("F", r)})',
            "O": f'=IF({B},"",N{r}*({EM}$N{r}+{EM}$J{r}*cfg_OT_P)/cfg_DAYS_M/cfg_HRS)',
            "P": f'=IF({B},"",{mv_sum("G", r)})',
            "Q": f'=IF({B},"",{mv_sum("H", r)})',
            "R": f'=IF({B},"",SUM(J{r}:M{r})+SUM(O{r}:Q{r}))',
            "S": f'=IF({B},"",{EM}$Q{r}*IF(E{r}="سعودي",cfg_G_SE,cfg_G_NE)*F{r}/cfg_DAYS_M)',
            "T": f'=IF({B},"",{mv_sum("I", r)})',
            "U": f'=IF({B},"",{mv_sum("J", r)})',
            "V": f'=IF({B},"",SUM(S{r}:U{r}))',
            "W": f'=IF({B},"",R{r}-V{r})',
            "X": f'=IF({B},"",{EM}$Q{r}*IF(E{r}="سعودي",cfg_G_SR,cfg_G_NR)*F{r}/cfg_DAYS_M)',
            "AC": f'=IF({B},"",MAX(0,{end_at(r, "$G$3")}-{EM}$H{r}+1)/cfg_DAYS_Y)',
            "AD": f'=IF({B},"",MAX(0,{end_at(r, "($E$3-1)")}-{EM}$H{r}+1)/cfg_DAYS_Y)',
            "Y": (f'=IF({B},"",{EM}$O{r}*(cfg_EOS_R1*(MIN(AC{r},cfg_EOS_TH)-MIN(AD{r},cfg_EOS_TH))'
                  f'+cfg_EOS_R2*(MAX(AC{r}-cfg_EOS_TH,0)-MAX(AD{r}-cfg_EOS_TH,0))))'),
            "Z": (f'=IF({B},"",IF({EM}$R{r}<>"",{EM}$R{r},IF(AC{r}>=cfg_LV_TH,cfg_LV_D2,cfg_LV_D1))'
                  f'/cfg_DAYS_Y*AE{r}*{EM}$P{r}/cfg_DAYS_M)'),
            "AA": (f'=IF({B},"",IF(AND({EM}$S{r}="نعم",N({EM}$U{r})>0),'
                   f'{EM}$T{r}/{EM}$U{r}*12/cfg_DAYS_Y*AE{r},0))'),
            "AB": f'=IF({B},"",R{r}+SUM(X{r}:AA{r}))',
        }
        for col, v in f.items():
            ws[f"{col}{r}"] = v
        ws[f"W{r}"].font = font(10, True, GREEN)
        ws[f"R{r}"].font = font(10, True)
        ws[f"AB{r}"].font = font(10, True, PURPLE)
    tot_cols = ["G", "H", "I"] + [CL(i) for i in range(CI("J"), CI("AB") + 1)]
    total_row(ws, ET, "C", "الإجمالي", tot_cols, E0, E1, ACC, "A", "AE")
    ws[f"B{ET}"] = f'=COUNTIF(F{E0}:F{E1},">0")&" موظف"'
    for c in ("G", "H", "I", "N"):
        ws[f"{c}{ET}"].number_format = DAYS
    ws.conditional_formatting.add(f"A{E0}:AE{E1}", FormulaRule(
        formula=[f'AND($B{E0}<>"",$F{E0}=0)'], font=Font(color="A0AEC0", italic=True)))
    ws.conditional_formatting.add(f"W{E0}:W{E1}", FormulaRule(
        formula=[f'AND(ISNUMBER(W{E0}),W{E0}<0)'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    note(ws, f"A{ET+1}",
         "المعادلات: أيام الاستحقاق = 30 للشهر الكامل أو الأيام الفعلية للتعيين/الانتهاء خلال الشهر • الإضافي = الساعات × (إجمالي الأجر + 50% من الأساسي) ÷ 30 ÷ 8 • "
         "التأمينات على (الأساسي + السكن) بحد 45,000 • مخصص نهاية الخدمة = الاستحقاق التراكمي نهاية الشهر − نهاية الشهر السابق • "
         "الإجازات = (أيام الاستحقاق السنوي ÷ 365) × أيام العمل × أجر اليوم • التذاكر = قيمة التذكرة ÷ الدورية × 12 ÷ 365 × أيام العمل. "
         "الأعمدة الرمادية الأخيرة مساعدة للاحتساب.", f"A{ET+1}:AE{ET+1}", 44)
    ws.freeze_panes = f"D{E0}"
    ws.auto_filter.ref = f"A5:AE{E1}"
    ws.print_title_rows = "5:5"

# ================================================================ الملخص الشهري
ws = ws_msum
MS_COLS = [("B", "الشهر", 11, None, None), ("C", "رقم", 6, "0", None), ("D", "عدد الموظفين", 9, INT, None),
           ("E", "الرواتب الأساسية", 14, ACC, "J"), ("F", "البدلات", 14, ACC, "K+L+M"), ("G", "العمل الإضافي", 12, ACC, "O"),
           ("H", "مكافآت وإضافات", 13, ACC, "P+Q"), ("I", "إجمالي المستحقات", 15, ACC, "R"),
           ("J", "تأمينات الموظف", 12, ACC, "S"), ("K", "سلف وخصومات", 12, ACC, "T+U"), ("L", "صافي الرواتب", 15, ACC, "W"),
           ("M", "تأمينات المنشأة", 13, ACC, "X"), ("N", "مخصص نهاية الخدمة", 13, ACC, "Y"),
           ("O", "مخصص الإجازات", 12, ACC, "Z"), ("P", "مخصص التذاكر", 12, ACC, "AA"),
           ("Q", "إجمالي تكلفة العمالة", 15, ACC, "AB"), ("R", "الحالة", 11, None, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _, _ in MS_COLS}}, PURPLE)
banner(ws, "B", "R", "📅 الملخص الشهري للرواتب والمخصصات — 12 شهراً")
nav(ws, list("BCDEFGHI"), S_MSUM)
headers(ws, 5, [(c, t) for c, t, *_ in MS_COLS], height=40)
data_rows(ws, [c for c, *_ in MS_COLS], 6, 17, {c: ("f", f) for c, _, _, f, _ in MS_COLS})
for i in range(12):
    r, sh = 6 + i, R(MSHEETS[i])
    ws[f"B{r}"] = MONTHS[i]
    ws[f"B{r}"].hyperlink = Hyperlink(ref=f"B{r}", location=f"{sh}A1", display=MONTHS[i])
    ws[f"B{r}"].font = font(10, True, INPUT_FONT)
    ws[f"C{r}"] = i + 1
    ws[f"D{r}"] = f'=COUNTIF({sh}$F${E0}:$F${E1},">0")'
    for c, _, _, _, src in MS_COLS:
        if src:
            ws[f"{c}{r}"] = "=" + "+".join(f"{sh}{s}{ET}" for s in src.split("+"))
    ws[f"R{r}"] = f'=IF(C{r}<=cfg_VAL_M,"✔ فعلي","⚠ متوقع")'
total_row(ws, 18, "B", "إجمالي السنة", [c for c, *_, s in MS_COLS if s], 6, 17, ACC, "B", "R")
for c in [c for c, *_, s in MS_COLS if s]:
    put(ws, f"{c}19", f'=SUMIF($C$6:$C$17,"<="&cfg_VAL_M,{c}6:{c}17)', font(10, True, "FFFFFF"), fill(TEAL),
        align("center"), BORDER, ACC)
put(ws, "B19", '="حتى "&INDEX(L_MONTH,cfg_VAL_M)', font(10, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
for c in "CDR":
    put(ws, f"{c}19", None, fl=fill(TEAL), bd=BORDER)
ws["D18"], ws["D19"] = None, f"=INDEX(D6:D17,cfg_VAL_M)"
ws["D19"].number_format = INT
status_cf(ws, "R6:R17", "R6")
ws.conditional_formatting.add("B6:Q17", FormulaRule(formula=["$C6=cfg_VAL_M"], fill=fill("FFF3CD")))
note(ws, "B20", "الصف المظلل بالأصفر = شهر التقرير. الأشهر «المتوقعة» محسوبة على الرواتب الثابتة الحالية (موازنة تقديرية) وتتحول لفعلية بإدخال حركاتها. "
     "اضغط اسم الشهر للانتقال إلى مسيره.", "B20:R20")
ch = BarChart()
ch.type, ch.grouping = "col", "clustered"
ch.title = "إجمالي المستحقات مقابل إجمالي تكلفة العمالة شهرياً"
ch.y_axis.numFmt = "#,##0"
ch.add_data(Reference(ws, min_col=CI("I"), min_row=5, max_row=17), titles_from_data=True)
ch.add_data(Reference(ws, min_col=CI("Q"), min_row=5, max_row=17), titles_from_data=True)
ch.set_categories(Reference(ws, min_col=2, min_row=6, max_row=17))
for s, colr in zip(ch.series, [TEAL, PURPLE]):
    s.graphicalProperties.solidFill = colr
ch.height, ch.width = 9, 26
ws.add_chart(ch, "B22")
ws.freeze_panes = "C6"

# ================================================================ ملخص الموظفين السنوي
ws = ws_esum
g_cols = [CL(CI("F") + i) for i in range(12)]          # F..Q إجمالي المستحقات
c_cols = [CL(CI("T") + i) for i in range(12)]          # T..AE إجمالي التكلفة
widths = {"A": 2, "B": 10, "C": 24, "D": 15, "E": 10, "R": 14, "S": 3, "AF": 14, "AG": 14, "AH": 14}
widths.update({c: 10.5 for c in g_cols + c_cols})
setup(ws, widths, PURPLE)
banner(ws, "B", "AH", "📑 ملخص الموظفين السنوي — المستحقات والتكلفة شهراً بشهر")
nav(ws, list("BCDEFGHI"), None)
section(ws, "F4", "إجمالي المستحقات الشهرية", "F4:R4", TEAL)
section(ws, "T4", "إجمالي تكلفة الموظف على المنشأة (راتب + تأمينات + مخصصات)", "T4:AF4", PURPLE)
ws.row_dimensions[4].height = 22
hdr = [("B", "الرقم"), ("C", "اسم الموظف"), ("D", "القسم"), ("E", "الفئة")]
hdr += [(c, MONTHS[i]) for i, c in enumerate(g_cols)] + [("R", "المستحقات حتى شهر التقرير")]
hdr += [(c, MONTHS[i]) for i, c in enumerate(c_cols)] + [("AF", "التكلفة حتى شهر التقرير"),
                                                        ("AG", "صافي المدفوع حتى شهر التقرير"), ("AH", "متوسط التكلفة الشهرية")]
headers(ws, 5, hdr, height=40)
data_rows(ws, [h[0] for h in hdr], E0, E1, {h[0]: ("f", ACC) for h in hdr[4:]})
for r in range(E0, E1 + 1):
    B = f'{EM}$B{r}=""'
    ws[f"B{r}"] = f'=IF({B},"",{EM}$B{r})'
    ws[f"C{r}"] = f'=IF({B},"",{EM}$C{r})'
    ws[f"D{r}"] = f'=IF({B},"",{EM}$F{r})'
    ws[f"E{r}"] = f'=IF({B},"",{EM}$E{r})'
    for i in range(12):
        ws[f"{g_cols[i]}{r}"] = f'=IF($B{r}="","",{R(MSHEETS[i])}R{r})'
        ws[f"{c_cols[i]}{r}"] = f'=IF($B{r}="","",{R(MSHEETS[i])}AB{r})'
    ytd = lambda col: "+".join(f"IF({i+1}<=cfg_VAL_M,{R(MSHEETS[i])}{col}{r},0)" for i in range(12))
    ws[f"R{r}"] = f'=IF($B{r}="","",{ytd("R")})'
    ws[f"AF{r}"] = f'=IF($B{r}="","",{ytd("AB")})'
    ws[f"AG{r}"] = f'=IF($B{r}="","",{ytd("W")})'
    ws[f"AH{r}"] = f'=IF($B{r}="","",AF{r}/cfg_VAL_M)'
    for c in ("R", "AF", "AG"):
        ws[f"{c}{r}"].font = font(10, True, NAVY)
total_row(ws, ET, "C", "الإجمالي", g_cols + ["R"] + c_cols + ["AF", "AG", "AH"], E0, E1, ACC, "B", "AH")
ws[f"S{ET}"].fill = fill("FFFFFF")
ws.freeze_panes = f"D{E0}"

# ================================================================ مخصص نهاية الخدمة
ws = ws_eos
EOS_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "تاريخ التعيين", 12, DATE),
            ("E", "تاريخ الاحتساب", 12, DATE), ("F", "مدة الخدمة", 22, None), ("G", "سنوات الخدمة", 9, "0.000"),
            ("H", "أجر الاحتساب", 12, ACC), ("I", "استحقاق السنوات الأولى", 13, ACC),
            ("J", "استحقاق ما بعدها", 13, ACC), ("K", "الاستحقاق الكامل (م 84)", 14, ACC),
            ("L", "الحالة / سبب الانتهاء", 17, None), ("M", "نسبة الاستحقاق عند الاستقالة (م 85)", 11, PCT),
            ("N", "المستحق لو استقال", 13, ACC), ("O", "الاستحقاق النظامي (رصيد المخصص المطلوب)", 15, ACC),
            ("P", "الرصيد الافتتاحي 1/1", 13, ACC), ("Q", "المكوّن خلال الفترة", 13, ACC),
            ("R", "المدفوع خلال الفترة", 12, ACC), ("S", "الرصيد الختامي", 14, ACC), ("T", "الفحص", 18, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in EOS_COLS}}, GOLD)
banner(ws, "B", "T", '="🎁 مخصص مكافأة نهاية الخدمة كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHI"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in EOS_COLS], GOLD, height=58)
data_rows(ws, [c for c, *_ in EOS_COLS], E0, E1, {c: ("f", f) for c, _, _, f in EOS_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    y0 = f'(MAX(0,IF(OR({EM}$X{r}="",{EM}$X{r}>=cfg_Y_START),cfg_Y_START-1,{EM}$X{r})-D{r}+1)/cfg_DAYS_Y)'
    f = {
        "B": f'=IF({EM}$B{r}="","",{EM}$B{r})',
        "C": f'=IF({B},"",{EM}$C{r})',
        "D": f'=IF({B},"",{EM}$H{r})',
        "E": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "F": (f'=IF({B},"",IF(E{r}<D{r},"لم يباشر",DATEDIF(D{r},E{r}+1,"y")&" سنة "&DATEDIF(D{r},E{r}+1,"ym")&" شهر "'
              f'&DATEDIF(D{r},E{r}+1,"md")&" يوم"))'),
        "G": f'=IF({B},"",MAX(0,E{r}-D{r}+1)/cfg_DAYS_Y)',
        "H": f'=IF({B},"",{EM}$O{r})',
        "I": f'=IF({B},"",H{r}*cfg_EOS_R1*MIN(G{r},cfg_EOS_TH))',
        "J": f'=IF({B},"",H{r}*cfg_EOS_R2*MAX(G{r}-cfg_EOS_TH,0))',
        "K": f'=IF({B},"",I{r}+J{r})',
        "L": f'=IF({B},"",IF(AND({EM}$X{r}<>"",{EM}$X{r}<=cfg_VAL_DATE),IF({EM}$Y{r}="","⚠ حدد السبب",{EM}$Y{r}),"على رأس العمل"))',
        "M": f'=IF({B},"",VLOOKUP(G{r},cfg_RES,2,TRUE))',
        "N": f'=IF({B},"",K{r}*M{r})',
        "O": f'=IF({B},"",IF(L{r}="استقالة",N{r},K{r}))',
        "P": f'=IF({B},"",H{r}*(cfg_EOS_R1*MIN({y0},cfg_EOS_TH)+cfg_EOS_R2*MAX({y0}-cfg_EOS_TH,0)))',
        "Q": f'=IF({B},"",O{r}-P{r})',
        "R": (f'=IF({B},"",SUMIFS({MV}$N${M0}:$N${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "S": f'=IF({B},"",P{r}+Q{r}-R{r})',
        "T": (f'=IF({B},"",IF(S{r}<-0.01,"✖ صرف أكثر من المستحق",IF(AND(L{r}<>"على رأس العمل",S{r}>0.01),'
              f'"⚠ مستحق لم يُصرف","✔ سليم")))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"S{r}"].font = font(10, True, GOLD)
total_row(ws, ET, "C", "الإجمالي", ["I", "J", "K", "N", "O", "P", "Q", "R", "S"], E0, E1, ACC, "B", "T")
status_cf(ws, f"T{E0}:T{E1}", f"T{E0}")
note(ws, f"B{ET+1}", "أساس المخصص: الاستحقاق الكامل وفق المادة 84 للموظف على رأس العمل (الأحوط محاسبياً)، وللمستقيل نسبة المادة 85. "
     "الرصيد الافتتاحي = الاستحقاق في 31/12 من السنة السابقة بالأجر الحالي. المكوّن خلال الفترة = الاستحقاق النظامي − الافتتاحي (يشمل أثر تغير الأجر وردّ الفرق للمستقيل). "
     "المدفوع يُسحب تلقائياً من عمود «مكافأة نهاية خدمة مدفوعة» في الحركات الشهرية.", f"B{ET+1}:T{ET+1}", 44)
ws.freeze_panes = f"D{E0}"

# ================================================================ مخصص الإجازات
ws = ws_lv
LV_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "تاريخ التعيين", 12, DATE),
           ("E", "سنوات الخدمة", 9, "0.00"), ("F", "الاستحقاق السنوي (يوم)", 10, INT),
           ("G", "أجر اليوم", 11, ACC), ("H", "رصيد افتتاحي (يوم)", 10, DAYS),
           ("I", "بداية الاستحقاق هذه السنة", 12, DATE), ("J", "نهاية الاستحقاق", 12, DATE),
           ("K", "أيام العمل خلال الفترة", 10, INT), ("L", "أيام مكتسبة", 10, DAYS),
           ("M", "أيام مأخوذة", 10, DAYS), ("N", "أيام مصروفة نقداً", 10, DAYS),
           ("O", "الرصيد الختامي (يوم)", 11, DAYS), ("P", "قيمة المخصص الختامي", 14, ACC),
           ("Q", "قيمة الرصيد الافتتاحي", 13, ACC), ("R", "تكلفة الإجازات المأخوذة", 13, ACC), ("S", "الفحص", 18, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in LV_COLS}}, GREEN)
banner(ws, "B", "S", '="🌴 مخصص الإجازات السنوية كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHI"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in LV_COLS], GREEN, height=52)
data_rows(ws, [c for c, *_ in LV_COLS], E0, E1, {c: ("f", f) for c, _, _, f in LV_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    f = {
        "B": f'=IF({EM}$B{r}="","",{EM}$B{r})',
        "C": f'=IF({B},"",{EM}$C{r})',
        "D": f'=IF({B},"",{EM}$H{r})',
        "J": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "E": f'=IF({B},"",MAX(0,J{r}-D{r}+1)/cfg_DAYS_Y)',
        "F": f'=IF({B},"",IF({EM}$R{r}<>"",{EM}$R{r},IF(E{r}>=cfg_LV_TH,cfg_LV_D2,cfg_LV_D1)))',
        "G": f'=IF({B},"",{EM}$P{r}/cfg_DAYS_M)',
        "H": f'=IF({B},"",N({EM}$V{r}))',
        "I": f'=IF({B},"",MAX(cfg_Y_START,D{r}))',
        "K": f'=IF({B},"",MAX(0,J{r}-I{r}+1))',
        "L": f'=IF({B},"",F{r}/cfg_DAYS_Y*K{r})',
        "M": (f'=IF({B},"",SUMIFS({MV}$K${M0}:$K${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "N": (f'=IF({B},"",SUMIFS({MV}$L${M0}:$L${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "O": f'=IF({B},"",H{r}+L{r}-M{r}-N{r})',
        "P": f'=IF({B},"",O{r}*G{r})',
        "Q": f'=IF({B},"",H{r}*G{r})',
        "R": f'=IF({B},"",(M{r}+N{r})*G{r})',
        "S": (f'=IF({B},"",IF(O{r}<-0.01,"✖ رصيد سالب",IF(O{r}>F{r}*2,"⚠ رصيد مرتفع (أكثر من سنتين)",'
              f'IF(AND({EM}$X{r}<>"",{EM}$X{r}<=cfg_VAL_DATE,O{r}>0.01),"⚠ منتهي الخدمة برصيد","✔ سليم"))))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"P{r}"].font = font(10, True, GREEN)
total_row(ws, ET, "C", "الإجمالي", ["H", "L", "M", "N", "O", "P", "Q", "R"], E0, E1, ACC, "B", "S")
for c in "HLMNO":
    ws[f"{c}{ET}"].number_format = DAYS
status_cf(ws, f"S{E0}:S{E1}", f"S{E0}")
note(ws, f"B{ET+1}", "الرصيد (يوم) = الافتتاحي + المكتسب (الاستحقاق السنوي ÷ 365 × أيام العمل) − المأخوذ − المصروف نقداً. "
     "قيمة المخصص = الرصيد × أجر اليوم الحالي (إعادة تقييم تلقائية عند تغير الراتب). الأيام المأخوذة تُسحب من الحركات الشهرية.",
     f"B{ET+1}:S{ET+1}", 34)
ws.freeze_panes = f"D{E0}"

# ================================================================ مخصص التذاكر
ws = ws_tk
TK_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "يستحق تذكرة؟", 9, None),
           ("E", "قيمة التذكرة", 12, ACC), ("F", "الدورية (شهر)", 9, INT), ("G", "التكلفة الشهرية", 11, ACC),
           ("H", "بداية الاستحقاق هذه السنة", 12, DATE), ("I", "نهاية الاستحقاق", 12, DATE),
           ("J", "أيام العمل", 9, INT), ("K", "المكوّن خلال الفترة", 13, ACC), ("L", "الرصيد الافتتاحي", 13, ACC),
           ("M", "المستخدم خلال الفترة", 13, ACC), ("N", "الرصيد الختامي", 14, ACC),
           ("O", "ما يعادله من تذاكر", 10, "0.00"), ("P", "الفحص", 22, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in TK_COLS}}, "1A73E8")
banner(ws, "B", "P", '="✈ مخصص تذاكر السفر كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHI"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in TK_COLS], "1A73E8", height=52)
data_rows(ws, [c for c, *_ in TK_COLS], E0, E1, {c: ("f", f) for c, _, _, f in TK_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    f = {
        "B": f'=IF({EM}$B{r}="","",{EM}$B{r})',
        "C": f'=IF({B},"",{EM}$C{r})',
        "D": f'=IF({B},"",IF({EM}$S{r}="نعم","نعم","لا"))',
        "E": f'=IF({B},"",N({EM}$T{r}))',
        "F": f'=IF({B},"",N({EM}$U{r}))',
        "G": f'=IF({B},"",IF(AND(D{r}="نعم",F{r}>0),E{r}/F{r},0))',
        "H": f'=IF({B},"",MAX(cfg_Y_START,{EM}$H{r}))',
        "I": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "J": f'=IF({B},"",MAX(0,I{r}-H{r}+1))',
        "K": f'=IF({B},"",G{r}*12/cfg_DAYS_Y*J{r})',
        "L": f'=IF({B},"",N({EM}$W{r}))',
        "M": (f'=IF({B},"",SUMIFS({MV}$M${M0}:$M${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "N": f'=IF({B},"",L{r}+K{r}-M{r})',
        "O": f'=IF({B},"",IF(E{r}>0,N{r}/E{r},0))',
        "P": (f'=IF({B},"",IF(AND(D{r}="لا",N{r}<>0),"⚠ غير مستحق وله رصيد",IF(N{r}<-0.01,"✖ استخدام أكثر من المكوّن",'
              f'IF(AND(D{r}="نعم",O{r}>=1),"⚠ تذكرة مستحقة للصرف","✔ سليم"))))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"N{r}"].font = font(10, True, "1A73E8")
total_row(ws, ET, "C", "الإجمالي", ["G", "K", "L", "M", "N"], E0, E1, ACC, "B", "P")
status_cf(ws, f"P{E0}:P{E1}", f"P{E0}")
note(ws, f"B{ET+1}", "المكوّن = (قيمة التذكرة ÷ دورية الاستحقاق × 12 ÷ 365) × أيام العمل خلال السنة حتى تاريخ التقرير. "
     "المستخدم يُسحب من عمود «قيمة تذاكر مستخدمة» في الحركات الشهرية. «ما يعادله من تذاكر» ≥ 1 يعني أن الموظف استحق تذكرة كاملة.",
     f"B{ET+1}:P{ET+1}", 34)
ws.freeze_panes = f"D{E0}"

# ================================================================ قيود الرواتب
ws = ws_je
mcols = [CL(CI("E") + i) for i in range(12)]           # E..P
setup(ws, {"A": 2, "B": 8, "C": 36, "D": 7, **{c: 12.5 for c in mcols}, "Q": 15, "R": 15}, "4A5568")
banner(ws, "B", "R", "🧾 القيود المحاسبية الشهرية للرواتب والمخصصات (جاهزة للترحيل)")
nav(ws, list("BCDEFGHI"), S_JE)
put(ws, "C4", "رقم الشهر ←", font(8, False, GREY_TXT), None, align("left"))
for i, c in enumerate(mcols):
    put(ws, f"{c}4", i + 1, font(8, False, GREY_TXT), None, align("center"), fmt="0")
ws.row_dimensions[4].height = 14
headers(ws, 5, [("B", "رمز الحساب"), ("C", "اسم الحساب"), ("D", "الطبيعة")] +
        [(c, MONTHS[i]) for i, c in enumerate(mcols)] + [("Q", "إجمالي السنة"), ("R", "حتى شهر التقرير")], height=30)
JE = [
    ("section", "① قيد استحقاق رواتب الشهر"),
    ("5101", "مصروف الرواتب الأساسية", "مدين", "J"),
    ("5102", "مصروف بدل السكن", "مدين", "K"),
    ("5103", "مصروف بدل النقل", "مدين", "L"),
    ("5104", "مصروف بدلات أخرى", "مدين", "M"),
    ("5105", "مصروف العمل الإضافي", "مدين", "O"),
    ("5106", "مصروف المكافآت والعمولات والإضافات", "مدين", "P+Q"),
    ("5107", "مصروف التأمينات الاجتماعية (حصة المنشأة)", "مدين", "X"),
    ("2105", "المؤسسة العامة للتأمينات الاجتماعية — مستحق", "دائن", "S+X"),
    ("1106", "سلف الموظفين", "دائن", "T"),
    ("4901", "إيرادات خصومات وجزاءات الموظفين", "دائن", "U"),
    ("2104", "رواتب مستحقة الدفع", "دائن", "W"),
    ("section", "② قيد تكوين المخصصات"),
    ("5108", "مصروف مكافأة نهاية الخدمة", "مدين", "Y"),
    ("2202", "مخصص مكافأة نهاية الخدمة", "دائن", "Y"),
    ("5109", "مصروف الإجازات السنوية", "مدين", "Z"),
    ("2106", "مخصص الإجازات السنوية", "دائن", "Z"),
    ("5110", "مصروف تذاكر السفر", "مدين", "AA"),
    ("2107", "مخصص تذاكر السفر", "دائن", "AA"),
    ("section", "③ قيد صرف الرواتب (تحويل بنكي / حماية الأجور)"),
    ("2104", "رواتب مستحقة الدفع", "مدين", "W"),
    ("1102", "البنك", "دائن", "W"),
]
r = 6
je_rows = []
for item in JE:
    if item[0] == "section":
        section(ws, f"B{r}", item[1], f"B{r}:R{r}", NAVY2)
    else:
        code, name, side, src = item
        clr = "1F2933" if side == "مدين" else GOLD
        put(ws, f"B{r}", code, font(10, True), fill(CARD_BG), align("center"), BORDER)
        put(ws, f"C{r}", name if side == "مدين" else "      " + name, font(10, side == "مدين", clr), fill(CARD_BG),
            align(), BORDER)
        put(ws, f"D{r}", side, font(9, True, clr), fill(CARD_BG), align("center"), BORDER)
        for i, c in enumerate(mcols):
            put(ws, f"{c}{r}", "=" + "+".join(f"{R(MSHEETS[i])}{s}{ET}" for s in src.split("+")),
                font(10), fill(CARD_BG), align("center"), BORDER, ACC)
        put(ws, f"Q{r}", f"=SUM(E{r}:P{r})", font(10, True), fill(FORMULA_BG), align("center"), BORDER, ACC)
        put(ws, f"R{r}", f"=SUMPRODUCT(($E$4:$P$4<=cfg_VAL_M)*E{r}:P{r})", font(10, True, NAVY), fill(FORMULA_BG),
            align("center"), BORDER, ACC)
        je_rows.append(r)
    r += 1
r0, r1 = je_rows[0], je_rows[-1]
r += 1
for lab, crit, clr in (("إجمالي المدين", "مدين", NAVY), ("إجمالي الدائن", "دائن", GOLD)):
    put(ws, f"B{r}", lab, font(10, True, "FFFFFF"), fill(clr), align("center"), BORDER, merge=f"B{r}:D{r}")
    for c in mcols + ["Q", "R"]:
        put(ws, f"{c}{r}", f'=SUMIF($D${r0}:$D${r1},"{crit}",{c}{r0}:{c}{r1})', font(10, True, "FFFFFF"),
            fill(clr), align("center"), BORDER, ACC)
    r += 1
put(ws, f"B{r}", "التوازن", font(10, True), fill(FORMULA_BG), align("center"), BORDER, merge=f"B{r}:D{r}")
for c in mcols + ["Q", "R"]:
    put(ws, f"{c}{r}", f'=IF(ROUND({c}{r-2}-{c}{r-1},2)=0,"✔ متوازن","✖ "&TEXT({c}{r-2}-{c}{r-1},"#,##0.00"))',
        font(10, True), fill(FORMULA_BG), align("center"), BORDER)
status_cf(ws, f"E{r}:R{r}", f"E{r}")
JE_CHECK = f"{R(S_JE)}$R${r}"
note(ws, f"B{r+2}", "رموز الحسابات استرشادية — طابقها مع دليل حساباتك (مثلاً 2202 مخصص نهاية الخدمة كما في ملف النظام المحاسبي). "
     "كل خلية مرتبطة مباشرة بصف الإجمالي في مسير الشهر المقابل؛ أي تعديل في الموظفين أو الحركات ينعكس فوراً على القيود.",
     f"B{r+2}:R{r+2}", 30)
ws.freeze_panes = "E6"

# ================================================================ قسيمة الراتب
ws = ws_slip
setup(ws, {"A": 2, "B": 24, "C": 16, "D": 4, "E": 24, "F": 16, "G": 3, "H": 12, "I": 30}, "C05621", landscape=False)
banner(ws, "B", "F", '="💳 قسيمة راتب — "&cfg_CO')
nav(ws, ["B", "C", "E", "F"], S_SLIP)
put(ws, "B5", "اختر الشهر (1-12):", font(10, True), fill(CARD_BG), align(), BORDER)
put(ws, "C5", 9, font(12, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, "0")
put(ws, "E5", "اختر الرقم الوظيفي:", font(10, True), fill(CARD_BG), align(), BORDER)
put(ws, "F5", "E003", font(12, True, INPUT_FONT), fill(INPUT), align("center"), BORDER)
dv_num(ws, "C5", "whole", 1, 12, "الشهر من 1 إلى 12")
dv_list(ws, "L_EMPID", "F5", "الرقم الوظيفي", "اختر الموظف")
put(ws, "H5", "صف الموظف", font(8, False, GREY_TXT), None, align())
put(ws, "I5", f"=IFERROR(MATCH(F5,{EM}$B${E0}:$B${E1},0)+{E0-1},\"\")", font(8, False, GREY_TXT))
put(ws, "H6", "ورقة المسير", font(8, False, GREY_TXT), None, align())
put(ws, "I6", "=INDEX(L_MSHEET,C5)", font(8, False, GREY_TXT))
ws.column_dimensions["H"].hidden = True
ws.column_dimensions["I"].hidden = True
put(ws, "B7", '="قسيمة راتب شهر "&INDEX(L_MONTH,C5)&" "&cfg_FY&IF(I5="","   ✖ الرقم الوظيفي غير موجود","")',
    font(13, True, "FFFFFF"), fill(TEAL), align("center"), merge="B7:F7")
ws.row_dimensions[7].height = 28


def emp(col):
    return f'=IF($I$5="","",INDEX({EM}${col}${E0}:${col}${E1},$I$5-{E0-1}))'


def pay(col):
    return f'=IF($I$5="",0,N(INDIRECT("\'"&$I$6&"\'!{col}"&$I$5)))'


info = [("B9", "اسم الموظف", "C9", emp("C"), None), ("E9", "الرقم الوظيفي", "F9", "=F5", None),
        ("B10", "القسم", "C10", emp("F"), None), ("E10", "المسمى الوظيفي", "F10", emp("G"), None),
        ("B11", "الجنسية", "C11", emp("D"), None), ("E11", "تاريخ التعيين", "F11", emp("H"), DATE),
        ("B12", "البنك", "C12", emp("AA"), None), ("E12", "رقم الآيبان", "F12", emp("AB"), None),
        ("B13", "أيام الاستحقاق", "C13", pay("F"), DAYS), ("E13", "أيام الغياب + بدون راتب", "F13",
                                                          f'={pay("G")[1:]}+{pay("H")[1:]}', DAYS)]
for lr, lt, vr, vf, fmt in info:
    put(ws, lr, lt, font(10, True, GREY_TXT), fill(ALT), align(), BORDER)
    put(ws, vr, vf, font(10, True), fill(CARD_BG), align("center"), BORDER, fmt)
ws["F12"].font = font(8, True)
section(ws, "B15", "المستحقات", "B15:C15", TEAL)
section(ws, "E15", "الاستقطاعات", "E15:F15", RED)
earn = [("الراتب الأساسي", "J"), ("بدل السكن", "K"), ("بدل النقل", "L"), ("بدلات أخرى", "M"),
        ("العمل الإضافي", "O"), ("مكافآت وعمولات", "P"), ("إضافات أخرى", "Q")]
ded = [("التأمينات الاجتماعية", "S"), ("أقساط السلف", "T"), ("خصومات وجزاءات", "U")]
for i, (t, c) in enumerate(earn):
    put(ws, f"B{16+i}", t, font(10), fill(CARD_BG), align(), BORDER)
    put(ws, f"C{16+i}", pay(c), font(10), fill(CARD_BG), align("center"), BORDER, ACC)
for i in range(7):
    t, c = ded[i] if i < len(ded) else (None, None)
    put(ws, f"E{16+i}", t, font(10), fill(CARD_BG), align(), BORDER)
    put(ws, f"F{16+i}", pay(c) if c else None, font(10), fill(CARD_BG), align("center"), BORDER, ACC)
put(ws, "B23", "إجمالي المستحقات", font(11, True, "FFFFFF"), fill(TEAL), align(), BORDER)
put(ws, "C23", "=SUM(C16:C22)", font(11, True, "FFFFFF"), fill(TEAL), align("center"), BORDER, ACC)
put(ws, "E23", "إجمالي الاستقطاعات", font(11, True, "FFFFFF"), fill(RED), align(), BORDER)
put(ws, "F23", "=SUM(F16:F22)", font(11, True, "FFFFFF"), fill(RED), align("center"), BORDER, ACC)
put(ws, "B25", "صافي الراتب المستحق", font(14, True, "FFFFFF"), fill(GREEN), align("center"), merge="B25:C25")
put(ws, "E25", "=C23-F23", font(16, True, "FFFFFF"), fill(GREEN), align("center"), fmt=ACC, merge="E25:F25")
ws.row_dimensions[25].height = 34
put(ws, "B26", '=IF(ROUND(E25-' + pay("W")[1:] + ',2)=0,"✔ مطابق لمسير الشهر","✖ غير مطابق للمسير")',
    font(9, True), None, align("center"), merge="B26:F26")
status_cf(ws, "B26", "B26")
section(ws, "B28", "معلومات للمنشأة: التكلفة الكاملة والأرصدة (كما في تاريخ التقرير)", "B28:F28", PURPLE)
extra = [("B29", "تأمينات حصة المنشأة", "C29", pay("X")), ("E29", "مخصص نهاية الخدمة للشهر", "F29", pay("Y")),
         ("B30", "مخصص الإجازات للشهر", "C30", pay("Z")), ("E30", "مخصص التذاكر للشهر", "F30", pay("AA")),
         ("B31", "إجمالي تكلفة الموظف للشهر", "C31", pay("AB")),
         ("E31", "رصيد الإجازات (يوم)", "F31", f'=IF($I$5="","",INDEX({R(S_LV)}$O${E0}:$O${E1},$I$5-{E0-1}))'),
         ("B32", "رصيد مكافأة نهاية الخدمة", "C32", f'=IF($I$5="","",INDEX({R(S_EOS)}$S${E0}:$S${E1},$I$5-{E0-1}))'),
         ("E32", "رصيد مخصص التذاكر", "F32", f'=IF($I$5="","",INDEX({R(S_TK)}$N${E0}:$N${E1},$I$5-{E0-1}))')]
for lr, lt, vr, vf in extra:
    put(ws, lr, lt, font(10, True, GREY_TXT), fill(ALT), align(), BORDER)
    put(ws, vr, vf, font(10, True, PURPLE), fill(CARD_BG), align("center"), BORDER, DAYS if vr == "F31" else ACC)
put(ws, "B35", "توقيع المحاسب: ....................", font(10), None, align())
put(ws, "E35", "توقيع الموظف: ....................", font(10), None, align())
ws.print_area = "B1:F35"

# ================================================================ لوحة التحكم
ws = ws_dash
setup(ws, {"A": 2, **{CL(i): 12.5 for i in range(2, 15)}}, PURPLE)
banner(ws, "B", "N", "📊 لوحة التحكم — الرواتب والمخصصات")
nav(ws, list("BCDEFGH"), S_DASH)
put(ws, "J3", "شهر التقرير ←", font(10, True, GREY_TXT), None, align("left"))
put(ws, "K3", "=INDEX(L_MONTH,cfg_VAL_M)&\" \"&cfg_FY", font(11, True, NAVY), fill(INPUT), align("center"), BORDER,
    merge="K3:L3")
button(ws, "M3", "⚙ تغيير الشهر", S_SET, GOLD, merge="M3:N3")
MSR = R(S_MSUM)
ACT = f'{EM}$Z${E0}:$Z${E1},"✔ على رأس العمل"'
section(ws, "B5", "👥 القوى العاملة", "B5:N5", NAVY)
card(ws, 6, "B", "D", "الموظفون على رأس العمل", f"=COUNTIF({ACT})", INT)
card(ws, 6, "E", "G", "نسبة التوطين (السعودة)",
     f'=IFERROR(COUNTIFS({ACT},{EM}$E${E0}:$E${E1},"سعودي")/B7,0)', PCT, GREEN)
card(ws, 6, "H", "J", "متوسط إجمالي الراتب الشهري", f'=IFERROR(AVERAGEIF({ACT},{EM}$N${E0}:$N${E1}),0)', ACC0, TEAL)
card(ws, 6, "K", "N", "إجمالي الرواتب الشهرية الثابتة", f'=SUMIF({ACT},{EM}$N${E0}:$N${E1})', ACC0, NAVY2)
section(ws, "B9", '="💵 الرواتب من بداية السنة حتى "&INDEX(L_MONTH,cfg_VAL_M)', "B9:N9", TEAL)
card(ws, 10, "B", "D", "إجمالي المستحقات", f"={MSR}I19", ACC0, TEAL)
card(ws, 10, "E", "G", "صافي الرواتب المدفوعة", f"={MSR}L19", ACC0, GREEN)
card(ws, 10, "H", "J", "التأمينات (موظف + منشأة)", f"={MSR}J19+{MSR}M19", ACC0, RED)
card(ws, 10, "K", "N", "إجمالي تكلفة العمالة", f"={MSR}Q19", ACC0, PURPLE)
section(ws, "B13", '="🏦 أرصدة المخصصات كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")', "B13:N13", GOLD)
card(ws, 14, "B", "D", "مخصص نهاية الخدمة", f"={R(S_EOS)}S{ET}", ACC0, GOLD)
card(ws, 14, "E", "G", "مخصص الإجازات", f"={R(S_LV)}P{ET}", ACC0, GREEN)
card(ws, 14, "H", "J", "مخصص تذاكر السفر", f"={R(S_TK)}N{ET}", ACC0, "1A73E8")
card(ws, 14, "K", "N", "إجمالي المخصصات", "=B15+E15+H15", ACC0, NAVY)
for ref, tgt in (("B14", S_EOS), ("E14", S_LV), ("H14", S_TK)):
    ws[ref].hyperlink = Hyperlink(ref=ref, location=f"'{tgt}'!A1", display=ws[ref].value)

# التنبيهات
section(ws, "B17", "🔔 تنبيهات وفحوصات الترابط", "B17:G17", RED)
ALERTS = [
    ("هويات / إقامات منتهية أو تنتهي خلال 60 يوماً",
     f'=COUNTIFS({EM}$I${E0}:$I${E1},"<="&(cfg_VAL_DATE+60),{EM}$Z${E0}:$Z${E1},"✔ على رأس العمل")'),
    ("موظفون منتهية خدماتهم بمستحقات لم تُصرف", f'=COUNTIF({R(S_EOS)}$T${E0}:$T${E1},"⚠*")'),
    ("أرصدة إجازات سالبة أو مرتفعة", f'=COUNTIF({R(S_LV)}$S${E0}:$S${E1},"✖*")+COUNTIF({R(S_LV)}$S${E0}:$S${E1},"⚠ رصيد مرتفع*")'),
    ("تذاكر مستحقة للصرف", f'=COUNTIF({R(S_TK)}$P${E0}:$P${E1},"⚠ تذكرة*")'),
    ("حركات برقم وظيفي غير صحيح", f'=COUNTIF({MV}$C${M0}:$C${M1},"✖*")'),
    ("رواتب صافية بالسالب (كل الأشهر)",
     "=" + "+".join(f'COUNTIF({R(s)}$W${E0}:$W${E1},"<0")' for s in MSHEETS)),
]
for i, (t, fml) in enumerate(ALERTS):
    rr = 18 + i
    put(ws, f"B{rr}", t, font(10), fill(CARD_BG), align(), BORDER, merge=f"B{rr}:E{rr}")
    put(ws, f"F{rr}", fml, font(11, True), fill(CARD_BG), align("center"), BORDER, "0")
    put(ws, f"G{rr}", f'=IF(F{rr}=0,"✔","⚠")', font(11, True), fill(CARD_BG), align("center"), BORDER)
rr = 18 + len(ALERTS)
put(ws, f"B{rr}", "توازن قيود الرواتب (حتى شهر التقرير)", font(10), fill(CARD_BG), align(), BORDER, merge=f"B{rr}:E{rr}")
put(ws, f"F{rr}", f"={JE_CHECK}", font(10, True), fill(CARD_BG), align("center"), BORDER, merge=f"F{rr}:G{rr}")
status_cf(ws, f"F18:G{rr}", "G18")
status_cf(ws, f"F{rr}", f"F{rr}")
ws.conditional_formatting.add(f"G18:G{rr-1}", FormulaRule(formula=['G18="✔"'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
ws.conditional_formatting.add(f"G18:G{rr-1}", FormulaRule(formula=['G18="⚠"'], fill=fill("FFF3CD"), font=Font(color=GOLD, bold=True)))

# توزيع حسب الجنسية
section(ws, "I17", "🌍 التوزيع حسب الفئة", "I17:N17", GREEN)
headers(ws, 18, [("I", "الفئة"), ("J", "العدد"), ("K", "النسبة"), ("L", "الرواتب الشهرية")], GREEN, 22)
ws.merge_cells("L18:N18")
for i, cat in enumerate(CATS):
    rr2 = 19 + i
    put(ws, f"I{rr2}", cat, font(10, True), fill(CARD_BG), align("center"), BORDER)
    put(ws, f"J{rr2}", f'=COUNTIFS({ACT},{EM}$E${E0}:$E${E1},I{rr2})', font(10), fill(CARD_BG), align("center"), BORDER, INT)
    put(ws, f"K{rr2}", f"=IFERROR(J{rr2}/SUM($J$19:$J$20),0)", font(10), fill(CARD_BG), align("center"), BORDER, PCT)
    put(ws, f"L{rr2}", f'=SUMIFS({EM}$N${E0}:$N${E1},{ACT},{EM}$E${E0}:$E${E1},I{rr2})', font(10), fill(CARD_BG),
        align("center"), BORDER, ACC0, merge=f"L{rr2}:N{rr2}")
pie = PieChart()
pie.title = "الموظفون حسب الفئة"
pie.add_data(Reference(ws, min_col=CI("J"), min_row=18, max_row=20), titles_from_data=True)
pie.set_categories(Reference(ws, min_col=CI("I"), min_row=19, max_row=20))
pie.dataLabels = DataLabelList()
pie.dataLabels.showPercent = True
pie.dataLabels.showVal = pie.dataLabels.showCatName = pie.dataLabels.showSerName = pie.dataLabels.showLeaderLines = False
pie.height, pie.width = 6.2, 9.5
ws.add_chart(pie, "I21")

# تحليل الأقسام
DR0 = 34
section(ws, f"B{DR0}", '="🏢 تحليل التكلفة حسب القسم حتى "&INDEX(L_MONTH,cfg_VAL_M)', f"B{DR0}:G{DR0}", NAVY2)
headers(ws, DR0 + 1, [("B", "القسم"), ("C", "عدد الموظفين"), ("D", "الرواتب الشهرية"), ("E", "المستحقات حتى تاريخه"),
                      ("F", "التكلفة الكاملة حتى تاريخه"), ("G", "النسبة من التكلفة")], NAVY2, 36)
ESR = R(S_ESUM)
for i in range(15):
    rr3 = DR0 + 2 + i
    put(ws, f"B{rr3}", f'=IF(INDEX(L_DEPT,{i+1})="","",INDEX(L_DEPT,{i+1}))', font(10, True), fill(CARD_BG), align(), BORDER)
    put(ws, f"C{rr3}", f'=IF(B{rr3}="","",COUNTIFS({ACT},{EM}$F${E0}:$F${E1},B{rr3}))', font(10), fill(CARD_BG), align("center"), BORDER, INT)
    put(ws, f"D{rr3}", f'=IF(B{rr3}="","",SUMIFS({EM}$N${E0}:$N${E1},{ACT},{EM}$F${E0}:$F${E1},B{rr3}))', font(10), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"E{rr3}", f'=IF(B{rr3}="","",SUMIF({ESR}$D${E0}:$D${E1},B{rr3},{ESR}$R${E0}:$R${E1}))', font(10), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"F{rr3}", f'=IF(B{rr3}="","",SUMIF({ESR}$D${E0}:$D${E1},B{rr3},{ESR}$AF${E0}:$AF${E1}))', font(10, True), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"G{rr3}", f'=IF(B{rr3}="","",IFERROR(F{rr3}/SUM($F${DR0+2}:$F${DR0+16}),0))', font(10), fill(CARD_BG), align("center"), BORDER, PCT)
DT = DR0 + 17
put(ws, f"B{DT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), BORDER)
for c, fmt in (("C", INT), ("D", ACC0), ("E", ACC0), ("F", ACC0), ("G", PCT)):
    put(ws, f"{c}{DT}", f"=SUM({c}{DR0+2}:{c}{DR0+16})", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), BORDER, fmt)
put(ws, f"B{DT+1}", '=IF(ROUND(F' + str(DT) + f'-{MSR}Q19,0)=0,"✔ مطابق للملخص الشهري","⚠ يوجد موظفون بدون قسم أو قسم غير مدرج")',
    font(9, True), None, align(), merge=f"B{DT+1}:G{DT+1}")
status_cf(ws, f"B{DT+1}", f"B{DT+1}")
bar = BarChart()
bar.type = "bar"
bar.title = "التكلفة الكاملة حسب القسم"
bar.add_data(Reference(ws, min_col=CI("F"), min_row=DR0 + 1, max_row=DR0 + 2 + len(DEPTS) - 1), titles_from_data=True)
bar.set_categories(Reference(ws, min_col=2, min_row=DR0 + 2, max_row=DR0 + 2 + len(DEPTS) - 1))
bar.legend = None
bar.x_axis.numFmt = "#,##0"
bar.series[0].graphicalProperties.solidFill = NAVY2
bar.height, bar.width = 9, 13
ws.add_chart(bar, f"I{DR0}")

# الاتجاه الشهري
TR = DT + 3
section(ws, f"B{TR}", "📈 الاتجاه الشهري لمكونات تكلفة العمالة (12 شهراً)", f"B{TR}:N{TR}", PURPLE)
headers(ws, TR + 1, [("B", "الشهر"), ("C", "صافي الرواتب"), ("D", "التأمينات (موظف + منشأة)"),
                     ("E", "سلف وخصومات"), ("F", "المخصصات (نهاية خدمة + إجازات + تذاكر)"), ("G", "إجمالي التكلفة")],
        PURPLE, 44)
for i in range(12):
    rr4, sr = TR + 2 + i, 6 + i
    vals = [f"={MSR}B{sr}", f"={MSR}L{sr}", f"={MSR}J{sr}+{MSR}M{sr}", f"={MSR}K{sr}",
            f"={MSR}N{sr}+{MSR}O{sr}+{MSR}P{sr}", f"=SUM(C{rr4}:F{rr4})"]
    for c, v in zip("BCDEFG", vals):
        put(ws, f"{c}{rr4}", v, font(10, c in "BG"), fill(ALT if i % 2 else CARD_BG), align("center"), BORDER,
            None if c == "B" else ACC0)
ws.conditional_formatting.add(f"B{TR+2}:G{TR+13}", FormulaRule(formula=[f"ROW()-{TR+1}=cfg_VAL_M"], fill=fill("FFF3CD")))
TT = TR + 14
put(ws, f"B{TT}", "إجمالي السنة", font(10, True, "FFFFFF"), fill(PURPLE), align("center"), BORDER)
for c in "CDEFG":
    put(ws, f"{c}{TT}", f"=SUM({c}{TR+2}:{c}{TR+13})", font(10, True, "FFFFFF"), fill(PURPLE), align("center"), BORDER, ACC0)
put(ws, f"B{TT+1}", f'=IF(ROUND(G{TT}-{MSR}Q18,0)=0,"✔ مطابق لإجمالي تكلفة العمالة في الملخص الشهري","✖ غير مطابق")',
    font(9, True), None, align(), merge=f"B{TT+1}:G{TT+1}")
status_cf(ws, f"B{TT+1}", f"B{TT+1}")
col = BarChart()
col.type, col.grouping, col.overlap = "col", "stacked", 100
col.title = "مكونات تكلفة العمالة شهرياً"
col.y_axis.numFmt = "#,##0"
col.add_data(Reference(ws, min_col=3, max_col=6, min_row=TR + 1, max_row=TR + 13), titles_from_data=True)
col.set_categories(Reference(ws, min_col=2, min_row=TR + 2, max_row=TR + 13))
for s_, clr in zip(col.series, [GREEN, RED, "F6AD55", GOLD]):
    s_.graphicalProperties.solidFill = clr
col.height, col.width = 8.5, 16
ws.add_chart(col, f"I{TR+1}")
note(ws, f"B{TT+3}", "كل الأرقام في هذه اللوحة معادلات مرتبطة بالأوراق الأخرى — لا تُدخل فيها أي بيانات. غيّر «شهر التقرير» من الإعدادات لتتحدث اللوحة والمخصصات والقيود. "
     "الصف المظلل في جدول الاتجاه = شهر التقرير.", f"B{TT+3}:N{TT+3}", 26)

# ================================================================ الرئيسية
ws = ws_home
setup(ws, {"A": 2, "B": 5, "C": 30, "D": 62, "E": 3, "F": 22, "G": 22}, NAVY)
banner(ws, "B", "G", "🏢 نظام الرواتب والمخصصات المتكامل")
put(ws, "B3", "مسير رواتب 12 شهراً • مكافأة نهاية الخدمة • مخصص الإجازات • مخصص تذاكر السفر • التأمينات الاجتماعية • القيود المحاسبية • قسيمة الراتب • لوحة التحكم",
    font(10, True, TEAL), None, align("center", wrap=True), merge="B3:G3")
ws.row_dimensions[3].height = 30
section(ws, "B5", "🧭 خطوات العمل الشهرية", "B5:D5", NAVY)
STEPS = [
    ("1", S_SET, "أدخل اسم المنشأة والسنة المالية وشهر التقرير وراجع النسب النظامية (مرة واحدة)."),
    ("2", S_EMP, "سجّل الموظفين: الرواتب والبدلات، تاريخ التعيين، التذاكر، والأرصدة الافتتاحية في 1/1."),
    ("3", S_MOV, "كل شهر: سجّل الغياب والإضافي والمكافآت والسلف والإجازات والتذاكر ومستحقات نهاية الخدمة."),
    ("4", MSHEETS[0], "راجع مسير الشهر (12 ورقة جاهزة يناير ← ديسمبر) — كل شيء محسوب آلياً."),
    ("5", S_EOS, "المخصصات كما في شهر التقرير: نهاية الخدمة ← الإجازات ← التذاكر مع الفحوصات."),
    ("6", S_JE, "انسخ القيود الشهرية المتوازنة إلى نظامك المحاسبي."),
    ("7", S_SLIP, "اطبع قسيمة راتب أي موظف لأي شهر."),
    ("8", S_DASH, "تابع المؤشرات والتنبيهات والرسوم البيانية."),
]
headers(ws, 6, [("B", "#"), ("C", "الورقة"), ("D", "ماذا تفعل")], height=24)
for i, (n, sh, desc) in enumerate(STEPS):
    rr = 7 + i
    put(ws, f"B{rr}", n, font(12, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
    button(ws, f"C{rr}", sh, sh, NAVY2)
    put(ws, f"D{rr}", desc, font(10), fill(CARD_BG), align(wrap=True), BORDER)
    ws.row_dimensions[rr].height = 30
section(ws, "F5", "📅 مسيرات الأشهر", "F5:G5", GOLD)
for i, s in enumerate(MSHEETS):
    button(ws, f"{'F' if i < 6 else 'G'}{6 + i % 6}", s, s, "B7791F" if i % 2 == 0 else "C05621")
for i, (t, s) in enumerate([("📅 الملخص الشهري", S_MSUM), ("📑 ملخص الموظفين", S_ESUM),
                            ("🌴 مخصص الإجازات", S_LV), ("✈ مخصص التذاكر", S_TK)]):
    button(ws, f"{'F' if i % 2 == 0 else 'G'}{13 + i // 2}", t, s, PURPLE)
section(ws, "B16", "🎨 دليل الألوان", "B16:D16", NAVY)
for i, (smp, fnt, fl, desc) in enumerate([
        ("123", INPUT_FONT, INPUT, "خلية إدخال — اكتب فيها (خط أزرق على خلفية صفراء)."),
        ("ƒx معادلة", "1F2933", FORMULA_BG, "خلية معادلة — لا تعدّلها؛ تتحدث تلقائياً."),
        ("✔ سليم", GREEN, GREEN_L, "فحص ناجح."),
        ("⚠ تنبيه", GOLD, "FFF3CD", "يحتاج مراجعة."),
        ("✖ خطأ", RED, RED_L, "خطأ يجب تصحيحه.")]):
    rr = 17 + i
    put(ws, f"C{rr}", smp, font(10, True, fnt), fill(fl), align("center"), BORDER)
    put(ws, f"D{rr}", desc, font(10), fill(CARD_BG), align(), BORDER)
section(ws, "B23", "🔗 خريطة الترابط", "B23:G23", TEAL)
put(ws, "B24", "الإعدادات ➜ الموظفون ➜ الحركات الشهرية ➜ مسيرات 12 شهراً ➜ الملخص الشهري + ملخص الموظفين ➜ "
    "المخصصات (نهاية الخدمة / الإجازات / التذاكر) ➜ القيود المحاسبية ➜ قسيمة الراتب + لوحة التحكم",
    font(11, True, NAVY), fill(TEAL_L), align("center", wrap=True), merge="B24:G24")
ws.row_dimensions[24].height = 44
note(ws, "B26", "البيانات الحالية (12 موظفاً وحركاتهم) أمثلة توضيحية لإظهار طريقة العمل — امسح خلايا الإدخال الصفراء في «الموظفون» و«الحركات الشهرية» وأدخل بياناتك. "
     "يستوعب الملف 100 موظف و1,000 حركة. الأحكام مبنية على نظام العمل السعودي (المواد 84، 85، 98، 107، 109) ونظام التأمينات الاجتماعية، وجميع النسب قابلة للتعديل من الإعدادات.",
     "B26:G26", 46)

# ترتيب الأوراق وإعدادات عامة
wb.active = 0
for s in wb.worksheets:
    s.sheet_view.tabSelected = s.title == S_HOME
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print("saved", OUT)
