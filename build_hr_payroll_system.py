# -*- coding: utf-8 -*-
"""
مولّد ملف نظام الرواتب والمخصصات
(مسير 12 شهر + سجل الإجازات والحالات + الإقامات ورخص العمل + نهاية الخدمة + الإجازات + التذاكر + لوحة تحكم)
ينتج: HR_Payroll_Provisions_System.xlsx
"""
import datetime as dt
import os
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as CL, column_index_from_string as CI

FULL_OUT = "HR_Payroll_Provisions_System.xlsx"
DEMO_OUT = "HR_Payroll_Free_Demo.xlsx"
DEMO = "--demo" in sys.argv          # python build_hr_payroll_system.py --demo  ← النسخة المجانية
OUT = DEMO_OUT if DEMO else FULL_OUT
BUY_URL = "https://accopro.net/"
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "AccoPro@2026")
TRIAL_EMP, TRIAL_REG, TRIAL_MOV = 5, 10, 20   # خانات التجربة المفتوحة في النسخة المجانية
# خطوات البناء:
#   python build_hr_payroll_system.py                  ← النسخة الكاملة ثم أعد احتسابها (recalc)
#   python build_hr_payroll_system.py --demo           ← النسخة التجريبية ثم أعد احتسابها
#   python build_hr_payroll_system.py --finalize-demo  ← إعادة قفل هيكل المصنف بعد إعادة الاحتساب

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
BROWN = "8D6E63"
BLUE = "1A73E8"
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
S_REG = "سجل الإجازات والحالات"
S_MOV = "الحركات الشهرية"
S_GOV = "الإقامات ورخص العمل"
S_MSUM = "الملخص الشهري"
S_ESUM = "ملخص الموظفين السنوي"
S_EOS = "مخصص نهاية الخدمة"
S_LV = "مخصص الإجازات"
S_TK = "مخصص التذاكر"
S_JE = "قيود الرواتب"
S_SLIP = "قسيمة الراتب"

E0, E1, ET = 6, 105, 106          # صفوف الموظفين (100 موظف) + صف الإجمالي
M0, M1 = 6, 1005                  # الحركات الشهرية (1000 حركة)
G0, G1 = 6, 505                   # سجل الإجازات والحالات (500 سجل)


def R(sheet):
    return f"'{sheet}'!"


EM, MV, RG = R(S_EMP), R(S_MOV), R(S_REG)

# ---------------------------------------------------------------- أعمدة ورقة الموظفين
EC = dict(seq="A", id="B", name="C", nat="D", cat="E", dept="F", job="G", hire="H",
          iqno="I", iqexp="J", wpexp="K",
          basic="L", hous="M", trans="N", oth="O", total="P", eosw="Q", lvw="R", gosiw="S",
          lvdays="T", tkt="U", tktv="V", tktc="W",
          iqfee="X", wpfee="Y", med="Z", ofee="AA", govtot="AB",
          oplv="AC", optk="AD", term="AE", reason="AF", est="AG", cst="AH",
          bank="AI", iban="AJ", notes="AK")


def em(key, r):
    return f"{EM}${EC[key]}{r}"


def fee_iq(r):
    return f'IF({em("iqfee", r)}<>"",{em("iqfee", r)},IF({em("cat", r)}="غير سعودي",cfg_IQ,0))'


def fee_wp(r):
    return f'IF({em("wpfee", r)}<>"",{em("wpfee", r)},IF({em("cat", r)}="غير سعودي",cfg_WP,0))'


def fee_med(r):
    return f'IF({em("med", r)}<>"",{em("med", r)},cfg_MED)'


def fee_oth(r):
    return f'N({em("ofee", r)})'


# ---------------------------------------------------------------- أعمدة سجل الإجازات
REG_A = [CL(CI("V") + i) for i in range(12)]    # أيام مخصومة من الراتب في كل شهر
REG_B = [CL(CI("AH") + i) for i in range(12)]   # أيام لا تحتسب في الخدمة (تراكمي حتى نهاية الشهر)
REG_C = [CL(CI("AT") + i) for i in range(12)]   # أيام تخصم من رصيد الإجازة في الشهر (غير المقدمة)


def reg_sum(col, r, idcol="$B"):
    return f"SUMIFS({RG}${col}${G0}:${col}${G1},{RG}$B${G0}:$B${G1},{idcol}{r})"


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
           ("👥 الموظفون", S_EMP, TEAL), ("🌴 سجل الإجازات", S_REG, GREEN), ("✍ الحركات", S_MOV, TEAL),
           ("🪪 الإقامات", S_GOV, BROWN), ("📅 الملخص الشهري", S_MSUM, TEAL), ("🧾 القيود", S_JE, TEAL),
           ("💳 القسيمة", S_SLIP, TEAL)]


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


def dv_date(ws, *rngs):
    dvd = DataValidation(type="date", operator="greaterThan", formula1="1", allow_blank=True, showErrorMessage=True)
    dvd.errorTitle, dvd.error = "تاريخ غير صحيح", "أدخل تاريخاً صحيحاً بالصيغة yyyy/mm/dd"
    ws.add_data_validation(dvd)
    for rng in rngs:
        dvd.add(rng)


def status_cf(ws, rng, first):
    for sym, bg, fg in (("✔", GREEN_L, GREEN), ("✖", RED_L, RED), ("⚠", "FFF3CD", GOLD),
                        ("✈", "E3F2FD", BLUE), ("⛔", RED_L, RED), ("🌴", GREEN_L, GREEN), ("⏳", "F3E5F5", PURPLE)):
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


def end_at(r, d):
    """تاريخ نهاية الخدمة المحسوبة حتى التاريخ d"""
    return f'IF(OR({em("term", r)}="",{em("term", r)}>{d}),{d},{em("term", r)})'


# ================================================================ بيانات العينة
D = dt.date
DEPTS = ["الإدارة العليا", "المالية", "الموارد البشرية", "المبيعات", "العمليات", "تقنية المعلومات", "المشاريع"]
REASONS = ["استقالة", "إنهاء من صاحب العمل", "انتهاء مدة العقد", "اتفاق الطرفين", "وفاة أو عجز"]
YN = ["نعم", "لا"]
CATS = ["سعودي", "غير سعودي"]
# (النوع, نسبة الأجر, يخصم من رصيد الإجازة, يحتسب في الخدمة, راتب مقدم, الشرح)
LTYPES = [
    ("إجازة سنوية (تُصرف مع الراتب)", 1, "نعم", "نعم", "لا", "يستمر الراتب في المسير، وتُخصم الأيام من رصيد الإجازة ويُحمَّل راتبها على المخصص."),
    ("إجازة سنوية (راتب مقدم قبل السفر)", 1, "نعم", "نعم", "نعم", "يُصرف راتب الإجازة كاملاً في شهر بدايتها، ولا يُصرف راتب عن أيامها في المسيرات."),
    ("إجازة بدون راتب", 0, "لا", "لا", "لا", "لا راتب ولا تحتسب في الخدمة ولا تكتسب عنها إجازة أو تذكرة (المادة 116)."),
    ("إجازة مرضية بأجر كامل", 1, "لا", "نعم", "لا", "المادة 117: أول 30 يوماً في السنة بأجر كامل."),
    ("إجازة مرضية بثلاثة أرباع الأجر", 0.75, "لا", "نعم", "لا", "المادة 117: الستون يوماً التالية بثلاثة أرباع الأجر."),
    ("إجازة مرضية بدون أجر", 0, "لا", "نعم", "لا", "المادة 117: الثلاثون يوماً التالية بدون أجر."),
    ("إجازة استثنائية مدفوعة (زواج/وفاة/مولود/حج)", 1, "لا", "نعم", "لا", "المادتان 113 و114."),
    ("إيقاف عن العمل (تحقيق/جزاء)", 0, "لا", "نعم", "لا", "يوقف الراتب خلال مدة الإيقاف."),
    ("انقطاع عن العمل / بلاغ تغيب", 0, "لا", "لا", "لا", "يوقف الراتب ولا تحتسب المدة في الخدمة."),
    ("إيقاف الراتب مؤقتاً", 0, "لا", "نعم", "لا", "لأي سبب إداري آخر (مثلاً: خارج المملكة بانتظار العودة)."),
]

EMPLOYEES = [
    dict(id="E001", name="عبدالله محمد العتيبي", nat="سعودي", cat="سعودي", dept="الإدارة العليا", job="المدير العام",
         hire=D(2012, 1, 15), iqno="1012345678", iqexp=D(2029, 5, 10), basic=28000, hous=7000, trans=2800, oth=3000,
         tkt="لا", tktv=0, tktc=12, med=4800, oplv=18, optk=0, bank="الراجحي", iban="SA0380000000608010167519"),
    dict(id="E002", name="أحمد سعيد القحطاني", nat="سعودي", cat="سعودي", dept="المالية", job="مدير مالي",
         hire=D(2016, 6, 1), iqno="1023456789", iqexp=D(2028, 2, 3), basic=18000, hous=4500, trans=1800, oth=1000,
         tkt="لا", tktv=0, tktc=12, med=3600, oplv=12, optk=0, bank="الأهلي", iban="SA4410000011100000000001"),
    dict(id="E003", name="محمد علي حسن", nat="مصري", cat="غير سعودي", dept="المالية", job="محاسب أول",
         hire=D(2018, 9, 10), iqno="2312345678", iqexp=D(2026, 11, 20), wpexp=D(2026, 11, 20), basic=8500, hous=2125,
         trans=850, oth=500, tkt="نعم", tktv=3200, tktc=24, med=2400, oplv=20, optk=1600, bank="الراجحي",
         iban="SA0380000000608010167520"),
    dict(id="E004", name="نورة خالد الدوسري", nat="سعودية", cat="سعودي", dept="الموارد البشرية", job="مديرة موارد بشرية",
         hire=D(2019, 2, 1), iqno="1034567890", iqexp=D(2030, 7, 14), basic=14000, hous=3500, trans=1400, oth=0,
         tkt="لا", tktv=0, tktc=12, med=3600, oplv=9, optk=0, bank="الإنماء", iban="SA6005000068200000000002"),
    dict(id="E005", name="راجيش كومار", nat="هندي", cat="غير سعودي", dept="تقنية المعلومات", job="مهندس شبكات",
         hire=D(2020, 4, 12), iqno="2323456789", iqexp=D(2027, 1, 30), wpexp=D(2027, 1, 30), basic=9000, hous=2250,
         trans=900, oth=700, tkt="نعم", tktv=2800, tktc=12, med=2400, oplv=14, optk=900, bank="الأهلي",
         iban="SA4410000011100000000003"),
    dict(id="E006", name="فهد ناصر الشمري", nat="سعودي", cat="سعودي", dept="المبيعات", job="مدير مبيعات",
         hire=D(2017, 11, 5), iqno="1045678901", iqexp=D(2031, 3, 22), basic=13000, hous=3250, trans=1300, oth=2500,
         tkt="لا", tktv=0, tktc=12, med=3600, oplv=25, optk=0, bank="الراجحي", iban="SA0380000000608010167521"),
    dict(id="E007", name="خالد يوسف الأحمد", nat="أردني", cat="غير سعودي", dept="المشاريع", job="مهندس مشاريع",
         hire=D(2021, 1, 20), iqno="2334567890", iqexp=D(2026, 10, 25), wpexp=D(2026, 9, 15), basic=11000, hous=2750,
         trans=1100, oth=800, tkt="نعم", tktv=4500, tktc=12, med=2400, ofee=4800, oplv=16, optk=2400, bank="البلاد",
         iban="SA1515000999100000000004", notes="المنشأة تتحمل رسوم مرافق واحد"),
    dict(id="E008", name="سارة عبدالرحمن الزهراني", nat="سعودية", cat="سعودي", dept="المالية", job="محاسبة",
         hire=D(2023, 3, 1), iqno="1056789012", iqexp=D(2032, 9, 9), basic=7500, hous=1875, trans=750, oth=0,
         tkt="لا", tktv=0, tktc=12, med=2400, oplv=6, optk=0, bank="الإنماء", iban="SA6005000068200000000005"),
    dict(id="E009", name="محمد رفيق", nat="باكستاني", cat="غير سعودي", dept="العمليات", job="مشرف عمليات",
         hire=D(2014, 8, 18), iqno="2345678901", iqexp=D(2027, 6, 1), wpexp=D(2027, 6, 1), basic=6500, hous=1625,
         trans=650, oth=300, lvdays=30, tkt="نعم", tktv=2200, tktc=24, med=1800, oplv=35, optk=2000,
         bank="الراجحي", iban="SA0380000000608010167522"),
    dict(id="E010", name="ريم سلطان المطيري", nat="سعودية", cat="سعودي", dept="المبيعات", job="أخصائية تسويق",
         hire=D(2026, 4, 15), iqno="1067890123", iqexp=D(2033, 1, 1), basic=9000, hous=2250, trans=900, oth=0,
         tkt="لا", tktv=0, tktc=12, med=2400, oplv=0, optk=0, bank="الأهلي", iban="SA4410000011100000000006"),
    dict(id="E011", name="جون ماتيو", nat="فلبيني", cat="غير سعودي", dept="العمليات", job="فني صيانة",
         hire=D(2019, 3, 1), iqno="2356789012", iqexp=D(2027, 4, 4), wpexp=D(2027, 4, 4), basic=5000, hous=1250,
         trans=500, oth=0, tkt="نعم", tktv=2600, tktc=24, med=1800, oplv=22, optk=1800, term=D(2026, 6, 30),
         reason="استقالة", bank="الراجحي", iban="SA0380000000608010167523"),
    dict(id="E012", name="عمر حسين البيشي", nat="سعودي", cat="سعودي", dept="تقنية المعلومات", job="مطور برمجيات",
         hire=D(2022, 7, 10), iqno="1078901234", iqexp=D(2029, 12, 12), basic=12000, hous=3000, trans=1200, oth=1500,
         tkt="لا", tktv=0, tktc=12, med=2400, oplv=10, optk=0, bank="البلاد", iban="SA1515000999100000000007"),
]

# (رقم, النوع (رقم في LTYPES), من, إلى, ملاحظات)
REGISTER = [
    ("E001", 0, D(2026, 3, 8), D(2026, 3, 17), "إجازة سنوية 10 أيام"),
    ("E007", 0, D(2026, 3, 5), D(2026, 3, 25), "إجازة سنوية + تذكرة"),
    ("E003", 3, D(2026, 5, 10), D(2026, 5, 14), "تقرير طبي"),
    ("E009", 1, D(2026, 6, 1), D(2026, 6, 30), "إجازة سنوية — صُرف راتبها مقدماً"),
    ("E004", 0, D(2026, 7, 5), D(2026, 7, 19), "إجازة سنوية"),
    ("E002", 0, D(2026, 7, 12), D(2026, 7, 31), "إجازة سنوية"),
    ("E005", 1, D(2026, 8, 3), D(2026, 8, 23), "إجازة سنوية — راتب مقدم + تذكرة"),
    ("E008", 2, D(2026, 8, 10), D(2026, 8, 12), "ظرف خاص"),
    ("E006", 2, D(2026, 9, 20), D(2026, 10, 19), "إجازة بدون راتب شهر — جارية في تاريخ التقرير"),
    ("E012", 4, D(2026, 9, 1), D(2026, 9, 10), "إجازة مرضية (بعد استنفاد 30 يوماً)"),
    ("E003", 1, D(2026, 12, 1), D(2026, 12, 30), "إجازة سنوية مخططة — راتب مقدم"),
]

# (شهر, رقم, غياب, بدون راتب, ساعات إضافي, مكافآت, إضافات, سلف, جزاءات, إجازة يدوية, إجازة نقداً, تذاكر مستخدمة, نهاية خدمة مدفوعة, ملاحظات)
MOVES = [
    (1, "E003", 0, 0, 12, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 1/5"),
    (1, "E009", 1, 0, 20, 0, 0, 0, 100, 0, 0, 0, 0, "غياب يوم"),
    (2, "E003", 0, 0, 8, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 2/5"),
    (2, "E006", 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0, 0, "عمولة مبيعات الربع الرابع"),
    (3, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 3/5"),
    (3, "E007", 0, 0, 10, 0, 0, 0, 0, 0, 0, 4500, 0, "تذكرة الإجازة"),
    (4, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 4/5"),
    (4, "E012", 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "غياب يومين"),
    (5, "E003", 0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, "قسط سلفة 5/5"),
    (5, "E005", 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, ""),
    (6, "E009", 0, 0, 0, 0, 0, 0, 0, 0, 0, 2200, 0, "تذكرة الإجازة"),
    (6, "E006", 0, 0, 0, 6500, 0, 0, 0, 0, 0, 0, 0, "عمولة مبيعات"),
    (7, "E011", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "تسوية مستحقات نهاية الخدمة"),
    (8, "E005", 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 0, "تذكرة الإجازة"),
    (9, "E010", 0, 0, 6, 0, 1500, 0, 0, 0, 0, 0, 0, "بدل مهمة عمل"),
    (9, "E006", 0, 0, 0, 0, 0, 0, 250, 0, 0, 0, 0, "جزاء تأخير"),
]
SETTLE_ROW = M0 + 12   # سطر تسوية E011

wb = Workbook()
ws_home = wb.active
ws_home.title = S_HOME
ws_dash = wb.create_sheet(S_DASH)
ws_set = wb.create_sheet(S_SET)
ws_emp = wb.create_sheet(S_EMP)
ws_reg = wb.create_sheet(S_REG)
ws_mov = wb.create_sheet(S_MOV)
ws_months = [wb.create_sheet(s) for s in MSHEETS]
ws_msum = wb.create_sheet(S_MSUM)
ws_esum = wb.create_sheet(S_ESUM)
ws_gov = wb.create_sheet(S_GOV)
ws_eos = wb.create_sheet(S_EOS)
ws_lv = wb.create_sheet(S_LV)
ws_tk = wb.create_sheet(S_TK)
ws_je = wb.create_sheet(S_JE)
ws_slip = wb.create_sheet(S_SLIP)

# ================================================================ الإعدادات
ws = ws_set
setup(ws, {"A": 2, "B": 44, "C": 18, "D": 58, "E": 3, "F": 20, "G": 22, "H": 9, "I": 14, "J": 11, "K": 16,
           "L": 3, "M": 40, "N": 11, "O": 11, "P": 11, "Q": 11, "R": 60}, TEAL)
banner(ws, "B", "K", "⚙ الإعدادات والثوابت النظامية")
nav(ws, list("BCDFGHIJK"), S_SET)
headers(ws, 5, [("B", "البند"), ("C", "القيمة"), ("D", "الشرح / المصدر")], height=26)

SETTINGS = [
    (6, "اسم المنشأة", "شركة النخبة للتجارة والمقاولات", None, "cfg_CO", "يظهر في رؤوس جميع الأوراق والقسائم.", True),
    (7, "السنة المالية", 2026, "0", "cfg_FY", "كل التواريخ الشهرية تُبنى على هذه السنة.", True),
    (8, "العملة", "ريال سعودي", None, "cfg_CUR", "", True),
    (9, "شهر التقرير (1-12)", 9, "0", "cfg_VAL_M", "يتحكم في: المخصصات كما في نهاية الشهر، حالة الموظفين، مؤشرات لوحة التحكم (من بداية السنة حتى هذا الشهر)، وتمييز الأشهر الفعلية عن المتوقعة.", True),
    (10, "بداية السنة المالية", "=DATE(cfg_FY,1,1)", DATE, "cfg_Y_START", "معادلة — لا تعدّل.", False),
    (11, "تاريخ التقرير (نهاية شهر التقرير)", "=EOMONTH(DATE(cfg_FY,cfg_VAL_M,1),0)", DATE, "cfg_VAL_DATE", "معادلة — لا تعدّل.", False),
    (13, "أساس أيام الشهر", 30, "0", "cfg_DAYS_M", "الأجر اليومي = الأجر الشهري ÷ 30 (العرف المحاسبي ونظام العمل).", True),
    (14, "ساعات العمل اليومية", 8, "0", "cfg_HRS", "المادة 98 من نظام العمل: 8 ساعات يومياً.", True),
    (15, "علاوة العمل الإضافي على الأجر الأساسي", 0.5, PCT, "cfg_OT_P", "المادة 107: أجر الساعة + 50% من الأجر الأساسي للساعة.", True),
    (17, "سعودي — حصة الموظف", 0.0975, PCT, "cfg_G_SE", "معاشات 9% + ساند 0.75%. المشتركون الجدد بعد 3/7/2025 تتدرج نسبتهم سنوياً — عدّل عند الحاجة.", True),
    (18, "سعودي — حصة المنشأة", 0.1175, PCT, "cfg_G_SR", "معاشات 9% + ساند 0.75% + أخطار مهنية 2%.", True),
    (19, "غير سعودي — حصة الموظف", 0, PCT, "cfg_G_NE", "لا يُستقطع من غير السعودي.", True),
    (20, "غير سعودي — حصة المنشأة", 0.02, PCT, "cfg_G_NR", "أخطار مهنية 2%.", True),
    (21, "الحد الأعلى لأجر الاشتراك", 45000, ACC0, "cfg_G_CAP", "أجر الاشتراك = الأساسي + السكن بحد أقصى 45,000. تستمر الاشتراكات خلال الإجازات والإيقاف ما دام العامل على رأس العمل.", True),
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
    (45, "رسوم إصدار / تجديد الإقامة (سنوياً)", 650, ACC0, "cfg_IQ", "رسوم الجوازات للإقامة. تُطبَّق تلقائياً على غير السعودي إذا تُركت خانة الموظف فارغة.", True),
    (46, "المقابل المالي لرخصة العمل (كرت العمل) سنوياً", 9600, ACC0, "cfg_WP", "800 ريال شهرياً للعامل الوافد. عدّله حسب نشاط المنشأة ونطاقها في نطاقات.", True),
    (47, "التأمين الطبي السنوي الافتراضي", 0, ACC0, "cfg_MED", "يُطبَّق على كل موظف لم تُحدَّد له قيمة في ورقة الموظفين.", True),
    (48, "تاريخ متابعة الإقامات ورخص العمل", "=TODAY()", DATE, "cfg_TRACK", "افتراضياً تاريخ اليوم — يمكنك كتابة تاريخ محدد بدلاً من المعادلة.", True),
    (49, "أيام التنبيه قبل انتهاء الإقامة / الرخصة", 60, "0", "cfg_ALERT", "", True),
]
section(ws, "B12", "💰 الرواتب والعمل الإضافي", "B12:D12")
section(ws, "B16", "🏛 التأمينات الاجتماعية (GOSI)", "B16:D16")
section(ws, "B22", "🎁 مكافأة نهاية الخدمة", "B22:D22")
section(ws, "B29", "🌴 الإجازات السنوية", "B29:D29")
section(ws, "B44", "🪪 الإقامة ورخصة العمل والتأمين الطبي (القيم الافتراضية)", "B44:D44", BROWN)
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
note(ws, "B51", "الخلايا الصفراء بالخط الأزرق = مدخلات قابلة للتعديل. الخلايا الرمادية = معادلات. "
     "النسب والحدود مأخوذة من نظام العمل السعودي ونظام التأمينات الاجتماعية ورسوم الجوازات ووزارة الموارد البشرية — راجعها عند صدور أي تعديل نظامي.", "B51:D51", 34)
dv_list(ws, "L_YN", "C26:C28")
dv_list(ws, "L_YN", "C33:C35")
dv_num(ws, "C9", "whole", 1, 12, "شهر التقرير من 1 إلى 12")
dv_num(ws, "C7", "whole", 2000, 2100)

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
# جدول أنواع الإجازات والحالات
headers(ws, 5, [("M", "نوع الإجازة / الحالة"), ("N", "نسبة الأجر المدفوع"), ("O", "يُخصم من رصيد الإجازة السنوية؟"),
                ("P", "يُحتسب ضمن مدة الخدمة؟"), ("Q", "يُصرف راتبها مقدماً؟"), ("R", "الشرح")], GREEN, 48)
for i in range(12):
    r = 6 + i
    lt = LTYPES[i] if i < len(LTYPES) else (None,) * 6
    for col, v, fmt in zip("MNOPQR", lt, [None, PCT, None, None, None, None]):
        put(ws, f"{col}{r}", v, font(10, col == "M", INPUT_FONT if col != "R" else GREY_TXT),
            fill(INPUT if col != "R" else CARD_BG), align("center" if col in "NOPQ" else "right", wrap=col == "R"), BORDER, fmt)
    ws.row_dimensions[r].height = max(ws.row_dimensions[r].height or 22, 28)
add_name(wb, "cfg_LT", f"{R(S_SET)}$M$6:$Q$17")
add_name(wb, "L_LTYPE", f"{R(S_SET)}$M$6:$M$17")
dv_list(ws, "L_YN", "O6:Q17")
note(ws, "M19", "يمكنك إضافة نوعين إضافيين في الصفين الفارغين أو تعديل النسب. أي تغيير هنا ينعكس فوراً على سجل الإجازات والمسيرات.", "M19:R19", 30)
add_name(wb, "L_EMPID", f"{EM}$B${E0}:$B${E1}")
ws.freeze_panes = "A6"

# ================================================================ الموظفون
ws = ws_emp
EMP_COLS = [
    ("seq", "م", 5, "f", "0"), ("id", "الرقم الوظيفي", 11, "in", None), ("name", "اسم الموظف", 26, "in", None),
    ("nat", "الجنسية", 11, "in", None), ("cat", "فئة التأمينات", 12, "in", None), ("dept", "القسم", 16, "in", None),
    ("job", "المسمى الوظيفي", 18, "in", None), ("hire", "تاريخ التعيين", 12, "in", DATE),
    ("iqno", "رقم الإقامة / الهوية", 13, "in", "@"), ("iqexp", "تاريخ انتهاء الإقامة / الهوية", 12, "in", DATE),
    ("wpexp", "تاريخ انتهاء رخصة العمل", 12, "in", DATE),
    ("basic", "الراتب الأساسي", 13, "in", ACC), ("hous", "بدل السكن", 12, "in", ACC), ("trans", "بدل النقل", 11, "in", ACC),
    ("oth", "بدلات أخرى", 11, "in", ACC), ("total", "إجمالي الراتب الشهري", 14, "f", ACC),
    ("eosw", "أجر احتساب نهاية الخدمة", 14, "f", ACC), ("lvw", "أجر احتساب الإجازة", 13, "f", ACC),
    ("gosiw", "أجر الاشتراك في التأمينات", 13, "f", ACC),
    ("lvdays", "أيام الإجازة السنوية (اختياري — يلغي الآلي)", 13, "in", "0"),
    ("tkt", "يستحق تذكرة سفر؟", 10, "in", None), ("tktv", "قيمة التذكرة (له ولمن يعول)", 13, "in", ACC),
    ("tktc", "دورية التذكرة (شهر)", 10, "in", "0"),
    ("iqfee", "رسوم الإقامة السنوية (فارغ = الافتراضي)", 13, "in", ACC),
    ("wpfee", "المقابل المالي لرخصة العمل سنوياً (فارغ = الافتراضي)", 14, "in", ACC),
    ("med", "التأمين الطبي السنوي (فارغ = الافتراضي)", 13, "in", ACC),
    ("ofee", "رسوم أخرى سنوية على المنشأة (مرافقين، خروج وعودة...)", 15, "in", ACC),
    ("govtot", "إجمالي التكاليف الحكومية والتأمين السنوية", 15, "f", ACC),
    ("oplv", "رصيد إجازات افتتاحي (يوم) في 1/1", 12, "in", DAYS),
    ("optk", "رصيد مخصص تذاكر افتتاحي في 1/1", 13, "in", ACC),
    ("term", "تاريخ انتهاء الخدمة", 12, "in", DATE), ("reason", "سبب انتهاء الخدمة", 16, "in", None),
    ("est", "حالة التوظيف", 15, "f", None), ("cst", "الوضع في تاريخ التقرير", 20, "f", None),
    ("bank", "البنك", 10, "in", None), ("iban", "رقم الآيبان IBAN", 27, "in", None), ("notes", "ملاحظات", 24, "in", None),
]
setup(ws, {EC[k]: w for k, _, w, _, _ in EMP_COLS}, NAVY)
banner(ws, "A", "AH", "👥 سجل بيانات الموظفين الرئيسي")
nav(ws, ["B", "C", "E", "F", "G", "H", "J", "L", "M"], S_EMP)
headers(ws, 5, [(EC[k], t) for k, t, _, _, _ in EMP_COLS], height=66)
data_rows(ws, [EC[k] for k, *_ in EMP_COLS], E0, E1, {EC[k]: (kd, f) for k, _, _, kd, f in EMP_COLS})
C = EC
for r in range(E0, E1 + 1):
    b = f'{C["id"]}{r}=""'
    ws[f"{C['seq']}{r}"] = f'=IF({b},"",ROW()-{E0-1})'
    ws[f"{C['total']}{r}"] = f'=IF({b},"",SUM({C["basic"]}{r}:{C["oth"]}{r}))'
    ws[f"{C['eosw']}{r}"] = (f'=IF({b},"",{C["basic"]}{r}+IF(cfg_EOS_H="نعم",{C["hous"]}{r},0)'
                             f'+IF(cfg_EOS_T="نعم",{C["trans"]}{r},0)+IF(cfg_EOS_O="نعم",{C["oth"]}{r},0))')
    ws[f"{C['lvw']}{r}"] = (f'=IF({b},"",{C["basic"]}{r}+IF(cfg_LV_H="نعم",{C["hous"]}{r},0)'
                            f'+IF(cfg_LV_T="نعم",{C["trans"]}{r},0)+IF(cfg_LV_O="نعم",{C["oth"]}{r},0))')
    ws[f"{C['gosiw']}{r}"] = f'=IF({b},"",MIN(cfg_G_CAP,{C["basic"]}{r}+{C["hous"]}{r}))'
    ws[f"{C['govtot']}{r}"] = (f'=IF({b},"",IF({C["iqfee"]}{r}<>"",{C["iqfee"]}{r},IF({C["cat"]}{r}="غير سعودي",cfg_IQ,0))'
                               f'+IF({C["wpfee"]}{r}<>"",{C["wpfee"]}{r},IF({C["cat"]}{r}="غير سعودي",cfg_WP,0))'
                               f'+IF({C["med"]}{r}<>"",{C["med"]}{r},cfg_MED)+N({C["ofee"]}{r}))')
    t = C["term"]
    ws[f"{C['est']}{r}"] = (f'=IF({b},"",IF(AND({t}{r}<>"",{t}{r}<=cfg_VAL_DATE),"✖ منتهي الخدمة",'
                            f'IF({C["hire"]}{r}>cfg_VAL_DATE,"⏳ لم يباشر بعد","✔ على رأس العمل")))')
    onleave = (f'COUNTIFS({RG}$B${G0}:$B${G1},{C["id"]}{r},{RG}$E${G0}:$E${G1},"<="&cfg_VAL_DATE,'
               f'{RG}$F${G0}:$F${G1},">="&cfg_VAL_DATE)')
    ws[f"{C['cst']}{r}"] = (f'=IF({b},"",IF({C["est"]}{r}<>"✔ على رأس العمل",{C["est"]}{r},'
                            f'IF({onleave}>0,"✈ "&INDEX({RG}$D${G0}:$D${G1},MATCH(1,INDEX(({RG}$B${G0}:$B${G1}={C["id"]}{r})'
                            f'*({RG}$E${G0}:$E${G1}<=cfg_VAL_DATE)*({RG}$F${G0}:$F${G1}>=cfg_VAL_DATE),0),0)),"✔ على رأس العمل")))')
for i, e in enumerate(EMPLOYEES):
    r = E0 + i
    for k, v in e.items():
        if v is not None:
            ws[f"{EC[k]}{r}"] = v
tot_emp = [EC[k] for k in ("basic", "hous", "trans", "oth", "total", "eosw", "lvw", "gosiw", "tktv", "govtot", "optk")]
total_row(ws, ET, "C", "الإجمالي", tot_emp, E0, E1, ACC, "A", "AK")
ws[f"B{ET}"] = f'=COUNTA(B{E0}:B{E1})&" موظف"'
dv_list(ws, "L_CAT", f"E{E0}:E{E1}", "فئة التأمينات", "سعودي / غير سعودي — تحدد نسب التأمينات ورسوم الإقامة.")
dv_list(ws, "L_DEPT", f"F{E0}:F{E1}", "القسم", "اختر القسم (تُضاف الأقسام من ورقة الإعدادات).")
dv_list(ws, "L_YN", f"U{E0}:U{E1}")
dv_list(ws, "L_REASON", f"AF{E0}:AF{E1}", "سبب انتهاء الخدمة", "يحدد نسبة الاستحقاق (الاستقالة وفق المادة 85).")
dv_list(ws, '"12,24"', f"W{E0}:W{E1}", "دورية التذكرة", "12 = تذكرة سنوية، 24 = كل سنتين.")
dup = DataValidation(type="custom", formula1=f"COUNTIF($B${E0}:$B${E1},B{E0})=1", showErrorMessage=True)
dup.errorTitle, dup.error = "رقم مكرر", "الرقم الوظيفي مستخدم من قبل. كل موظف له رقم فريد."
ws.add_data_validation(dup)
dup.add(f"B{E0}:B{E1}")
dv_num(ws, f"L{E0}:O{E1}", "decimal", 0)
dv_num(ws, f"X{E0}:AA{E1}", "decimal", 0)
dv_date(ws, f"H{E0}:H{E1}", f"J{E0}:K{E1}", f"AE{E0}:AE{E1}")
status_cf(ws, f"AG{E0}:AH{E1}", f"AG{E0}")
for col in ("J", "K"):
    ws.conditional_formatting.add(f"{col}{E0}:{col}{E1}", FormulaRule(
        formula=[f'AND({col}{E0}<>"",{col}{E0}<=cfg_TRACK+cfg_ALERT)'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
ws.conditional_formatting.add(f"AF{E0}:AF{E1}", FormulaRule(formula=[f'AND(AE{E0}<>"",AF{E0}="")'], fill=fill(RED_L)))
ws["J5"].comment = Comment("تُلوَّن بالأحمر إذا انتهت أو ستنتهي خلال أيام التنبيه (الإعدادات).", "النظام")
ws["T5"].comment = Comment("اتركها فارغة ليحسبها النظام آلياً (21 يوماً ثم 30 بعد 5 سنوات). "
                           "اكتب رقماً إذا كان العقد يمنح أياماً أكثر.", "النظام")
ws["X5"].comment = Comment("اتركها فارغة لتطبيق القيمة الافتراضية من الإعدادات على غير السعودي. اكتب 0 إذا كان العامل يتحمل الرسوم.", "النظام")
ws["AE5"].comment = Comment("اتركه فارغاً للموظف على رأس العمل. عند إدخاله يتوقف الراتب والمخصصات بعد هذا التاريخ.", "النظام")
ws["AH5"].comment = Comment("يُقرأ تلقائياً من «سجل الإجازات والحالات»: يظهر نوع الإجازة أو الإيقاف إذا كان الموظف فيها في تاريخ التقرير.", "النظام")
ws.freeze_panes = f"D{E0}"
ws.auto_filter.ref = f"A5:AK{E1}"

# ================================================================ سجل الإجازات والحالات
ws = ws_reg
REG_COLS = [
    ("A", "م", 5, "f", "0"), ("B", "الرقم الوظيفي", 11, "in", None), ("C", "اسم الموظف (تلقائي)", 24, "f", None),
    ("D", "نوع الإجازة / الحالة", 30, "in", None), ("E", "من تاريخ", 12, "in", DATE), ("F", "إلى تاريخ (آخر يوم)", 12, "in", DATE),
    ("G", "عدد الأيام", 8, "f", INT), ("H", "نسبة الأجر حسب النوع", 9, "f", PCT),
    ("I", "نسبة أجر مخصصة (اختياري)", 9, "in", PCT), ("J", "نسبة الأجر المطبقة", 9, "f", PCT),
    ("K", "يخصم من رصيد الإجازة؟", 8, "f", None), ("L", "يحتسب في الخدمة؟", 8, "f", None),
    ("M", "راتب مقدم؟", 7, "f", None), ("N", "مبلغ راتب الإجازة المقدم", 12, "f", ACC),
    ("O", "شهر صرف المقدم", 7, "f", "0"), ("P", "الحالة", 22, "f", None), ("Q", "ملاحظات", 28, "in", None),
    ("R", "أيام خارج الخدمة حتى 31/12 السابق", 9, "f", INT), ("S", "أيام خارج الخدمة حتى تاريخ التقرير", 9, "f", INT),
    ("T", "أيام مخصومة من رصيد الإجازة (السنة حتى تاريخ التقرير)", 10, "f", INT),
]
widths = {c: w for c, _, w, _, _ in REG_COLS}
widths["U"] = 2
widths.update({c: 6 for c in REG_A + REG_B + REG_C})
setup(ws, widths, GREEN)
banner(ws, "A", "Q", "🌴 سجل الإجازات والحالات — الإجازات والإيقاف ووقف الراتب بالتواريخ")
nav(ws, list("ABCDEFGHI"), S_REG)
for blk, title, clr in ((REG_A, "أيام مخصومة من الراتب في كل شهر", RED), (REG_B, "أيام خارج الخدمة (تراكمي حتى نهاية الشهر)", BROWN),
                        (REG_C, "أيام مخصومة من رصيد الإجازة في الشهر", GREEN)):
    put(ws, f"{blk[0]}4", title, font(9, True, "FFFFFF"), fill(clr), align("center"), merge=f"{blk[0]}4:{blk[-1]}4")
    for i, c in enumerate(blk):
        put(ws, f"{c}5", MONTHS[i], font(8, True, "FFFFFF"), fill(clr), align("center", wrap=True), BORDER)
ws.row_dimensions[4].height = 18
headers(ws, 5, [(c, t) for c, t, _, _, _ in REG_COLS], GREEN, height=62)
data_rows(ws, [c for c, *_ in REG_COLS] + REG_A + REG_B + REG_C, G0, G1,
          {**{c: (k, f) for c, _, _, k, f in REG_COLS}, **{c: ("f", INT) for c in REG_A + REG_B + REG_C}})
for r in range(G0, G1 + 1):
    blank = f'OR($B{r}="",$E{r}="",$F{r}="")'
    lk = lambda n: f'IFERROR(VLOOKUP($D{r},cfg_LT,{n},FALSE),"")'
    f = {
        "A": f'=IF(B{r}="","",ROW()-{G0-1})',
        "C": (f'=IF(B{r}="","",IFERROR(INDEX({EM}$C${E0}:$C${E1},MATCH(B{r},{EM}$B${E0}:$B${E1},0)),'
              f'"✖ رقم غير موجود"))'),
        "G": f'=IF({blank},"",MAX(0,F{r}-E{r}+1))',
        "H": f'=IF(D{r}="","",IFERROR(VLOOKUP(D{r},cfg_LT,2,FALSE),1))',
        "J": f'=IF(D{r}="","",IF(I{r}<>"",I{r},H{r}))',
        "K": f'=IF(D{r}="","",{lk(3)})',
        "L": f'=IF(D{r}="","",{lk(4)})',
        "M": f'=IF(D{r}="","",{lk(5)})',
        "N": (f'=IF(OR({blank},M{r}<>"نعم"),0,G{r}*J{r}*IFERROR(INDEX({EM}$R${E0}:$R${E1},'
              f'MATCH(B{r},{EM}$B${E0}:$B${E1},0)),0)/cfg_DAYS_M)'),
        "O": f'=IF(OR({blank},M{r}<>"نعم"),"",IF(YEAR(E{r})=cfg_FY,MONTH(E{r}),""))',
        "P": (f'=IF(B{r}="","",IF(OR(D{r}="",E{r}="",F{r}=""),"⚠ أكمل النوع والتواريخ",IF(F{r}<E{r},"✖ النهاية قبل البداية",'
              f'IF(COUNTIFS($B${G0}:$B${G1},B{r},$E${G0}:$E${G1},"<="&F{r},$F${G0}:$F${G1},">="&E{r})>1,"⚠ تداخل مع سجل آخر",'
              f'IF(E{r}>cfg_VAL_DATE,"⏳ قادمة",IF(F{r}<cfg_VAL_DATE,"✔ منتهية","✈ جارية في تاريخ التقرير"))))))'),
        "R": f'=IF(OR({blank},L{r}<>"لا"),0,MAX(0,MIN(F{r},cfg_Y_START-1)-E{r}+1))',
        "S": f'=IF(OR({blank},L{r}<>"لا"),0,MAX(0,MIN(F{r},cfg_VAL_DATE)-E{r}+1))',
        "T": (f'=IF(OR({blank},K{r}<>"نعم"),0,IF(M{r}="نعم",IF(AND(ISNUMBER(O{r}),N(O{r})<=cfg_VAL_M),G{r},0),'
              f'MAX(0,MIN(F{r},cfg_VAL_DATE)-MAX(E{r},cfg_Y_START)+1)))'),
    }
    for m in range(1, 13):
        ms, me = f"DATE(cfg_FY,{m},1)", f"EOMONTH(DATE(cfg_FY,{m},1),0)"
        ov = f"MAX(0,MIN($F{r},{me})-MAX($E{r},{ms})+1)"
        f[REG_A[m - 1]] = f'=IF({blank},0,{ov}*(1-IF($M{r}="نعم",0,N($J{r}))))'
        f[REG_B[m - 1]] = f'=IF(OR({blank},$L{r}<>"لا"),0,MAX(0,MIN($F{r},{me})-$E{r}+1))'
        f[REG_C[m - 1]] = f'=IF(OR({blank},$K{r}<>"نعم",$M{r}="نعم"),0,{ov})'
    for col, v in f.items():
        ws[f"{col}{r}"] = v
for i, (eid, ti, d1, d2, nt) in enumerate(REGISTER):
    r = G0 + i
    ws[f"B{r}"], ws[f"D{r}"], ws[f"E{r}"], ws[f"F{r}"], ws[f"Q{r}"] = eid, LTYPES[ti][0], d1, d2, nt
dv_list(ws, "L_EMPID", f"B{G0}:B{G1}", "الرقم الوظيفي", "اختر رقم الموظف")
dv_list(ws, "L_LTYPE", f"D{G0}:D{G1}", "نوع الإجازة / الحالة", "يحدد نسبة الأجر وأثره على رصيد الإجازة ومدة الخدمة (من الإعدادات).")
dv_date(ws, f"E{G0}:F{G1}")
dv_num(ws, f"I{G0}:I{G1}", "decimal", 0, 1, "النسبة بين 0% و100%")
status_cf(ws, f"P{G0}:P{G1}", f"P{G0}")
status_cf(ws, f"C{G0}:C{G1}", f"C{G0}")
ws["D5"].comment = Comment("مثال: موظف مسافر إجازة بدون راتب ← اختر «إجازة بدون راتب» واكتب من/إلى؛ "
                           "المسير يخصم الأيام الواقعة في كل شهر تلقائياً دون حذف الموظف.", "النظام")
ws["I5"].comment = Comment("اتركها فارغة لتطبيق نسبة النوع. مثال: إجازة مرضية بنصف راتب ← اكتب 50%.", "النظام")
ws.freeze_panes = f"E{G0}"
ws.auto_filter.ref = f"A5:T{G1}"

# ================================================================ الحركات الشهرية
ws = ws_mov
MOV_COLS = [
    ("A", "الشهر (1-12)", 8, "in", "0"), ("B", "الرقم الوظيفي", 11, "in", None), ("C", "اسم الموظف (تلقائي)", 26, "f", None),
    ("D", "أيام غياب", 9, "in", DAYS), ("E", "أيام بدون راتب (يدوي)", 10, "in", DAYS),
    ("F", "ساعات عمل إضافي", 10, "in", DAYS), ("G", "مكافآت وعمولات", 12, "in", ACC),
    ("H", "إضافات أخرى / فروقات", 12, "in", ACC), ("I", "أقساط سلف", 12, "in", ACC),
    ("J", "خصومات وجزاءات", 12, "in", ACC), ("K", "إجازة سنوية مأخوذة (يوم) — يدوي", 11, "in", DAYS),
    ("L", "إجازة مصروفة نقداً (يوم)", 11, "in", DAYS), ("M", "قيمة تذاكر مستخدمة", 12, "in", ACC),
    ("N", "مكافأة نهاية خدمة مدفوعة", 13, "in", ACC), ("O", "ملاحظات", 28, "in", None),
]
setup(ws, {c: w for c, _, w, _, _ in MOV_COLS}, BLUE)
banner(ws, "A", "O", "✍ الحركات الشهرية المتغيرة (غياب — إضافي — مكافآت — سلف — جزاءات — تذاكر — تسويات)")
nav(ws, list("ABCDEFGHI"), S_MOV)
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
# تسوية نهاية الخدمة للمستقيل E011 — معادلات تقرأ الاستحقاق والرصيد من أوراق المخصصات (مثال على الترابط)
sr = SETTLE_ROW
at = lambda sh, c: f"INDEX({R(sh)}${c}${E0}:${c}${E1},MATCH(B{sr},{R(sh)}$B${E0}:$B${E1},0))"
ws[f"N{sr}"] = f"={at(S_EOS, 'O')}"
ws[f"L{sr}"] = f"={at(S_LV, 'H')}+{at(S_LV, 'L')}-{at(S_LV, 'M')}"
ws[f"H{sr}"] = f"=L{sr}*{at(S_LV, 'G')}"
ws[f"O{sr}"] = "تسوية نهاية خدمة: المكافأة + صرف رصيد الإجازات نقداً (في الإضافات)"
dv_num(ws, f"A{M0}:A{M1}", "whole", 1, 12, "الشهر رقم من 1 إلى 12")
dv_list(ws, "L_EMPID", f"B{M0}:B{M1}", "الرقم الوظيفي", "اختر رقم الموظف من القائمة")
dv_num(ws, f"D{M0}:N{M1}", "decimal", 0, None, "القيم يجب أن تكون موجبة")
status_cf(ws, f"C{M0}:C{M1}", f"C{M0}")
ws.freeze_panes = f"D{M0}"
ws.auto_filter.ref = f"A5:O{M1}"
ws["A5"].comment = Comment("سجّل كل حركة في سطر: الشهر + رقم الموظف + القيم. الإجازات والإيقاف تُسجَّل بالتواريخ في «سجل الإجازات والحالات»؛ "
                           "استخدم عمودي «بدون راتب» و«الإجازة اليدوية» هنا فقط للتسويات السريعة.", "النظام")
ws["L5"].comment = Comment("أيام الإجازة التي صُرفت نقداً (تُخصم من رصيد الإجازات). أدخل مبلغها في «إضافات أخرى» ليُصرف مع الراتب.", "النظام")

# ================================================================ مسير الرواتب الشهري × 12
PAY_COLS = [
    ("A", "م", 5, "0"), ("B", "الرقم الوظيفي", 10, None), ("C", "اسم الموظف", 24, None), ("D", "القسم", 14, None),
    ("E", "الفئة", 10, None), ("F", "الوضع خلال الشهر", 20, None),
    ("G", "أيام الاستحقاق", 8, DAYS), ("H", "أيام الغياب", 8, DAYS),
    ("I", "أيام إجازة / إيقاف بدون أجر", 9, DAYS), ("J", "أيام مدفوعة", 8, DAYS),
    ("K", "الأساسي", 12, ACC), ("L", "السكن", 11, ACC), ("M", "النقل", 10, ACC), ("N", "أخرى", 10, ACC),
    ("O", "ساعات إضافي", 7, DAYS), ("P", "قيمة الإضافي", 11, ACC), ("Q", "مكافآت وعمولات", 11, ACC),
    ("R", "إضافات أخرى", 11, ACC), ("S", "راتب إجازة مدفوع مقدماً", 11, ACC), ("T", "إجمالي المستحقات", 13, ACC),
    ("U", "تأمينات (حصة الموظف)", 11, ACC), ("V", "أقساط سلف", 10, ACC), ("W", "خصومات وجزاءات", 10, ACC),
    ("X", "إجمالي الاستقطاعات", 12, ACC), ("Y", "صافي الراتب", 13, ACC),
    ("Z", "تأمينات (حصة المنشأة)", 11, ACC), ("AA", "مخصص نهاية الخدمة للشهر", 12, ACC),
    ("AB", "مخصص الإجازات للشهر", 11, ACC), ("AC", "مخصص التذاكر للشهر", 11, ACC),
    ("AD", "رسوم الإقامة + رخصة العمل للشهر", 12, ACC), ("AE", "التأمين الطبي للشهر", 11, ACC),
    ("AF", "رسوم أخرى للشهر", 10, ACC), ("AG", "إجمالي تكلفة الموظف على المنشأة", 14, ACC),
    ("AH", "سنوات الخدمة نهاية الشهر", 9, "0.000"), ("AI", "سنوات الخدمة نهاية الشهر السابق", 9, "0.000"),
    ("AJ", "أيام تكتسب عنها إجازة وتذكرة", 9, INT), ("AK", "أيام التوظيف التقويمية", 9, INT),
    ("AL", "أيام إجازة سنوية مستخدمة", 9, DAYS), ("AM", "استخدام مخصص الإجازات (قيمة)", 11, ACC),
    ("AN", "أيام مخصومة من السجل (خام)", 9, DAYS),
]
PAY_GROUP = {c: g for g, cs in ((NAVY, ["A", "B", "C", "D", "E", "F"]), ("4A5568", "GHIJ"),
                                (TEAL, ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"]),
                                (RED, "UVWX"), (GREEN, "Y"), (PURPLE, ["Z", "AA", "AB", "AC"]),
                                (BROWN, ["AD", "AE", "AF"]), ("311B92", ["AG"]),
                                ("8795A1", ["AH", "AI", "AJ", "AK", "AL", "AM", "AN"])) for c in cs}


def mv_sum(col, r):
    return (f"SUMIFS({MV}${col}${M0}:${col}${M1},{MV}$B${M0}:$B${M1},$B{r},"
            f"{MV}$A${M0}:$A${M1},$C$3)")


for m, ws in enumerate(ws_months, start=1):
    setup(ws, {c: w for c, _, w, _ in PAY_COLS}, "B7791F" if m % 2 else "C05621")
    banner(ws, "A", "AG", f'="💵 مسير رواتب شهر {MONTHS[m-1]} "&cfg_FY')
    put(ws, "B3", "الشهر", font(10, True, GREY_TXT), None, align("center"))
    put(ws, "C3", m, font(12, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, "0")
    put(ws, "D3", "من / إلى", font(10, True, GREY_TXT), None, align("center"))
    put(ws, "E3", "=DATE(cfg_FY,C3,1)", font(10, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, DATE)
    put(ws, "F3", "=EOMONTH(E3,0)", font(10, True, NAVY), fill(FORMULA_BG), align("center"), BORDER, DATE)
    put(ws, "G3", '=IF(C3<=cfg_VAL_M,"✔ فعلي","⚠ متوقع")', font(10, True), None, align("center"), BORDER, merge="G3:H3")
    status_cf(ws, "G3", "G3")
    if m > 1:
        button(ws, "J3", "◀ الشهر السابق", MSHEETS[m - 2], "4A5568", merge="J3:K3")
    if m < 12:
        button(ws, "L3", "الشهر التالي ▶", MSHEETS[m], "4A5568", merge="L3:M3")
    for col, item in zip(["O", "P", "R", "S", "U", "W", "Y"],
                         [NAV_ALL[0], NAV_ALL[1], NAV_ALL[3], NAV_ALL[4], NAV_ALL[5], NAV_ALL[7], NAV_ALL[8]]):
        button(ws, f"{col}3", item[0], item[1], item[2])
    for col, t, _, _ in PAY_COLS:
        put(ws, f"{col}5", t, font(9, True, "FFFFFF"), fill(PAY_GROUP[col]), align("center", wrap=True), BORDER)
    ws.row_dimensions[5].height = 52
    data_rows(ws, [c for c, *_ in PAY_COLS], E0, E1, {c: ("f", f) for c, _, _, f in PAY_COLS})
    nsB = REG_B[m - 1]
    nsP = REG_B[m - 2] if m > 1 else "R"
    for r in range(E0, E1 + 1):
        B = f'$B{r}=""'
        emp_end = end_at(r, "$F$3")
        f = {
            "A": f'=IF({B},"",{em("seq", r)})',
            "B": f'=IF({em("id", r)}="","",{em("id", r)})',
            "C": f'=IF({B},"",{em("name", r)})',
            "D": f'=IF({B},"",{em("dept", r)})',
            "E": f'=IF({B},"",{em("cat", r)})',
            "AK": f'=IF({B},"",MAX(0,{emp_end}-MAX($E$3,{em("hire", r)})+1))',
            "G": f'=IF({B},"",IF(AK{r}>=DAY($F$3),cfg_DAYS_M,MIN(AK{r},cfg_DAYS_M)))',
            "AN": f'=IF({B},"",{reg_sum(REG_A[m-1], r)})',
            "H": f'=IF({B},"",{mv_sum("D", r)})',
            "I": f'=IF({B},"",MIN(G{r},IF(AND(AK{r}>0,AN{r}>=AK{r}),G{r},AN{r})+{mv_sum("E", r)}))',
            "J": f'=IF({B},"",MAX(0,G{r}-H{r}-I{r}))',
            "K": f'=IF({B},"",{em("basic", r)}*$J{r}/cfg_DAYS_M)',
            "L": f'=IF({B},"",{em("hous", r)}*$J{r}/cfg_DAYS_M)',
            "M": f'=IF({B},"",{em("trans", r)}*$J{r}/cfg_DAYS_M)',
            "N": f'=IF({B},"",{em("oth", r)}*$J{r}/cfg_DAYS_M)',
            "O": f'=IF({B},"",{mv_sum("F", r)})',
            "P": f'=IF({B},"",O{r}*({em("total", r)}+{em("basic", r)}*cfg_OT_P)/cfg_DAYS_M/cfg_HRS)',
            "Q": f'=IF({B},"",{mv_sum("G", r)})',
            "R": f'=IF({B},"",{mv_sum("H", r)})',
            "S": (f'=IF({B},"",SUMIFS({RG}$N${G0}:$N${G1},{RG}$B${G0}:$B${G1},$B{r},'
                  f'{RG}$O${G0}:$O${G1},$C$3))'),
            "T": f'=IF({B},"",SUM(K{r}:N{r})+SUM(P{r}:S{r}))',
            "U": f'=IF({B},"",{em("gosiw", r)}*IF(E{r}="سعودي",cfg_G_SE,cfg_G_NE)*G{r}/cfg_DAYS_M)',
            "V": f'=IF({B},"",{mv_sum("I", r)})',
            "W": f'=IF({B},"",{mv_sum("J", r)})',
            "X": f'=IF({B},"",SUM(U{r}:W{r}))',
            "Y": f'=IF({B},"",T{r}-X{r})',
            "Z": f'=IF({B},"",{em("gosiw", r)}*IF(E{r}="سعودي",cfg_G_SR,cfg_G_NR)*G{r}/cfg_DAYS_M)',
            "AH": f'=IF({B},"",MAX(0,{emp_end}-{em("hire", r)}+1-{reg_sum(nsB, r)})/cfg_DAYS_Y)',
            "AI": (f'=IF({B},"",MAX(0,{end_at(r, "($E$3-1)")}-{em("hire", r)}+1-{reg_sum(nsP, r)})'
                   f'/cfg_DAYS_Y)'),
            "AJ": f'=IF({B},"",MAX(0,AK{r}-({reg_sum(nsB, r)}-{reg_sum(nsP, r)})))',
            "AA": (f'=IF({B},"",{em("eosw", r)}*(cfg_EOS_R1*(MIN(AH{r},cfg_EOS_TH)-MIN(AI{r},cfg_EOS_TH))'
                   f'+cfg_EOS_R2*(MAX(AH{r}-cfg_EOS_TH,0)-MAX(AI{r}-cfg_EOS_TH,0))))'),
            "AB": (f'=IF({B},"",IF({em("lvdays", r)}<>"",{em("lvdays", r)},IF(AH{r}>=cfg_LV_TH,cfg_LV_D2,cfg_LV_D1))'
                   f'/cfg_DAYS_Y*AJ{r}*{em("lvw", r)}/cfg_DAYS_M)'),
            "AC": (f'=IF({B},"",IF(AND({em("tkt", r)}="نعم",N({em("tktc", r)})>0),'
                   f'{em("tktv", r)}/{em("tktc", r)}*12/cfg_DAYS_Y*AJ{r},0))'),
            "AD": f'=IF({B},"",({fee_iq(r)}+{fee_wp(r)})/12*G{r}/cfg_DAYS_M)',
            "AE": f'=IF({B},"",{fee_med(r)}/12*G{r}/cfg_DAYS_M)',
            "AF": f'=IF({B},"",{fee_oth(r)}/12*G{r}/cfg_DAYS_M)',
            "AG": f'=IF({B},"",T{r}+SUM(Z{r}:AF{r}))',
            "AL": f'=IF({B},"",{reg_sum(REG_C[m-1], r)}+{mv_sum("K", r)})',
            "AM": f'=IF({B},"",AL{r}*{em("lvw", r)}/cfg_DAYS_M+S{r})',
            "F": (f'=IF({B},"",IF(AK{r}=0,IF(AND({em("term", r)}<>"",{em("term", r)}<$E$3),"✖ منتهي الخدمة","⏳ لم يباشر"),'
                  f'IF(S{r}>0,"✈ راتب إجازة مقدم",IF(J{r}=0,"⛔ بدون راتب هذا الشهر",IF(I{r}>0,"✈ خصم "&ROUND(I{r},2)&" يوم بدون أجر",'
                  f'IF(AL{r}>0,"🌴 إجازة سنوية "&ROUND(AL{r},2)&" يوم",IF(H{r}>0,"⚠ غياب "&ROUND(H{r},2)&" يوم","✔ على رأس العمل")))))))'),
        }
        for col, v in f.items():
            ws[f"{col}{r}"] = v
        ws[f"Y{r}"].font = font(10, True, GREEN)
        ws[f"T{r}"].font = font(10, True)
        ws[f"AG{r}"].font = font(10, True, PURPLE)
    tot_cols = ["H", "I", "J"] + [CL(i) for i in range(CI("K"), CI("AG") + 1)] + ["AL", "AM"]
    total_row(ws, ET, "C", "الإجمالي", tot_cols, E0, E1, ACC, "A", "AN")
    ws[f"B{ET}"] = f'=COUNTIF(G{E0}:G{E1},">0")&" موظف"'
    ws[f"F{ET}"] = f'=COUNTIFS(G{E0}:G{E1},">0",J{E0}:J{E1},0)&" بدون راتب"'
    for c in ("H", "I", "J", "O", "AL"):
        ws[f"{c}{ET}"].number_format = DAYS
    status_cf(ws, f"F{E0}:F{E1}", f"F{E0}")
    ws.conditional_formatting.add(f"G{E0}:AN{E1}", FormulaRule(
        formula=[f'AND($B{E0}<>"",$J{E0}=0)'], font=Font(color="A0AEC0", italic=True)))
    ws.conditional_formatting.add(f"Y{E0}:Y{E1}", FormulaRule(
        formula=[f'AND(ISNUMBER(Y{E0}),Y{E0}<0)'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    note(ws, f"A{ET+1}",
         "لا تحذف أي موظف: أيام الإجازة بدون راتب والمرضية والإيقاف تُخصم تلقائياً من «سجل الإجازات والحالات» حسب التواريخ، والمنتهية خدمته يتوقف راتبه بعد تاريخ الانتهاء. "
         "أيام الاستحقاق = 30 للشهر الكامل أو الأيام الفعلية للتعيين/الانتهاء • الإضافي = الساعات × (إجمالي الأجر + 50% من الأساسي) ÷ 30 ÷ 8 • "
         "التأمينات على (الأساسي + السكن) بحد 45,000 • نهاية الخدمة = الاستحقاق التراكمي نهاية الشهر − نهاية الشهر السابق (بعد استبعاد المدد غير المحتسبة) • "
         "الإقامة ورخصة العمل والتأمين الطبي = التكلفة السنوية ÷ 12 × أيام التوظيف ÷ 30. الأعمدة الرمادية الأخيرة مساعدة للاحتساب.",
         f"A{ET+1}:AN{ET+1}", 48)
    ws.freeze_panes = f"D{E0}"
    ws.auto_filter.ref = f"A5:AN{E1}"
    ws.print_title_rows = "5:5"

# ================================================================ الملخص الشهري
ws = ws_msum
MS_COLS = [("B", "الشهر", 11, None, None), ("C", "رقم", 6, "0", None), ("D", "عدد الموظفين", 9, INT, None),
           ("E", "موظفون بخصم أيام", 9, INT, None),
           ("F", "الرواتب الأساسية", 14, ACC, "K"), ("G", "البدلات", 14, ACC, "L+M+N"), ("H", "العمل الإضافي", 12, ACC, "P"),
           ("I", "مكافآت وإضافات", 13, ACC, "Q+R"), ("J", "رواتب إجازات مقدمة", 13, ACC, "S"),
           ("K", "إجمالي المستحقات", 15, ACC, "T"),
           ("L", "تأمينات الموظف", 12, ACC, "U"), ("M", "سلف وخصومات", 12, ACC, "V+W"), ("N", "صافي الرواتب", 15, ACC, "Y"),
           ("O", "تأمينات المنشأة", 13, ACC, "Z"), ("P", "مخصص نهاية الخدمة", 13, ACC, "AA"),
           ("Q", "مخصص الإجازات", 12, ACC, "AB"), ("R", "مخصص التذاكر", 12, ACC, "AC"),
           ("S", "الإقامة ورخص العمل ورسوم أخرى", 14, ACC, "AD+AF"), ("T", "التأمين الطبي", 12, ACC, "AE"),
           ("U", "إجمالي تكلفة العمالة", 15, ACC, "AG"), ("V", "الحالة", 11, None, None)]
MSV = [c for c, *_, s in MS_COLS if s]
setup(ws, {"A": 2, **{c: w for c, _, w, _, _ in MS_COLS}}, PURPLE)
banner(ws, "B", "V", "📅 الملخص الشهري للرواتب والمخصصات والتكاليف الحكومية — 12 شهراً")
nav(ws, list("BCDEFGHIJ"), S_MSUM)
headers(ws, 5, [(c, t) for c, t, *_ in MS_COLS], height=44)
data_rows(ws, [c for c, *_ in MS_COLS], 6, 17, {c: ("f", f) for c, _, _, f, _ in MS_COLS})
for i in range(12):
    r, sh = 6 + i, R(MSHEETS[i])
    ws[f"B{r}"] = MONTHS[i]
    ws[f"B{r}"].hyperlink = Hyperlink(ref=f"B{r}", location=f"{sh}A1", display=MONTHS[i])
    ws[f"B{r}"].font = font(10, True, INPUT_FONT)
    ws[f"C{r}"] = i + 1
    ws[f"D{r}"] = f'=COUNTIF({sh}$G${E0}:$G${E1},">0")'
    ws[f"E{r}"] = f'=COUNTIF({sh}$I${E0}:$I${E1},">0")'
    for c, _, _, _, src in MS_COLS:
        if src:
            ws[f"{c}{r}"] = "=" + "+".join(f"{sh}{s}{ET}" for s in src.split("+"))
    ws[f"V{r}"] = f'=IF(C{r}<=cfg_VAL_M,"✔ فعلي","⚠ متوقع")'
total_row(ws, 18, "B", "إجمالي السنة", MSV, 6, 17, ACC, "B", "V")
for c in MSV:
    put(ws, f"{c}19", f'=SUMIF($C$6:$C$17,"<="&cfg_VAL_M,{c}6:{c}17)', font(10, True, "FFFFFF"), fill(TEAL),
        align("center"), BORDER, ACC)
put(ws, "B19", '="حتى "&INDEX(L_MONTH,cfg_VAL_M)', font(10, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
for c in "CDEV":
    put(ws, f"{c}19", None, fl=fill(TEAL), bd=BORDER)
ws["D19"] = "=INDEX(D6:D17,cfg_VAL_M)"
ws["D19"].number_format = INT
status_cf(ws, "V6:V17", "V6")
ws.conditional_formatting.add("B6:U17", FormulaRule(formula=["$C6=cfg_VAL_M"], fill=fill("FFF3CD")))
note(ws, "B20", "الصف المظلل بالأصفر = شهر التقرير. الأشهر «المتوقعة» محسوبة على الرواتب الثابتة الحالية والإجازات المخططة في السجل (موازنة تقديرية). "
     "اضغط اسم الشهر للانتقال إلى مسيره.", "B20:V20")
ch = BarChart()
ch.type, ch.grouping = "col", "clustered"
ch.title = "إجمالي المستحقات مقابل إجمالي تكلفة العمالة شهرياً"
ch.y_axis.numFmt = "#,##0"
ch.add_data(Reference(ws, min_col=CI("K"), min_row=5, max_row=17), titles_from_data=True)
ch.add_data(Reference(ws, min_col=CI("U"), min_row=5, max_row=17), titles_from_data=True)
ch.set_categories(Reference(ws, min_col=2, min_row=6, max_row=17))
for s_, colr in zip(ch.series, [TEAL, PURPLE]):
    s_.graphicalProperties.solidFill = colr
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
nav(ws, list("BCDEFGHIJ"), None)
section(ws, "F4", "إجمالي المستحقات الشهرية", "F4:R4", TEAL)
section(ws, "T4", "إجمالي تكلفة الموظف على المنشأة (راتب + تأمينات + مخصصات + إقامة ورخصة عمل وتأمين طبي)", "T4:AF4", PURPLE)
ws.row_dimensions[4].height = 22
hdr = [("B", "الرقم"), ("C", "اسم الموظف"), ("D", "القسم"), ("E", "الفئة")]
hdr += [(c, MONTHS[i]) for i, c in enumerate(g_cols)] + [("R", "المستحقات حتى شهر التقرير")]
hdr += [(c, MONTHS[i]) for i, c in enumerate(c_cols)] + [("AF", "التكلفة حتى شهر التقرير"),
                                                        ("AG", "صافي المدفوع حتى شهر التقرير"), ("AH", "متوسط التكلفة الشهرية")]
headers(ws, 5, hdr, height=40)
data_rows(ws, [h[0] for h in hdr], E0, E1, {h[0]: ("f", ACC) for h in hdr[4:]})
for r in range(E0, E1 + 1):
    B = f'{em("id", r)}=""'
    ws[f"B{r}"] = f'=IF({B},"",{em("id", r)})'
    ws[f"C{r}"] = f'=IF({B},"",{em("name", r)})'
    ws[f"D{r}"] = f'=IF({B},"",{em("dept", r)})'
    ws[f"E{r}"] = f'=IF({B},"",{em("cat", r)})'
    for i in range(12):
        ws[f"{g_cols[i]}{r}"] = f'=IF($B{r}="","",{R(MSHEETS[i])}T{r})'
        ws[f"{c_cols[i]}{r}"] = f'=IF($B{r}="","",{R(MSHEETS[i])}AG{r})'
    ytd = lambda col: "+".join(f"IF({i+1}<=cfg_VAL_M,{R(MSHEETS[i])}{col}{r},0)" for i in range(12))
    ws[f"R{r}"] = f'=IF($B{r}="","",{ytd("T")})'
    ws[f"AF{r}"] = f'=IF($B{r}="","",{ytd("AG")})'
    ws[f"AG{r}"] = f'=IF($B{r}="","",{ytd("Y")})'
    ws[f"AH{r}"] = f'=IF($B{r}="","",AF{r}/cfg_VAL_M)'
    for c in ("R", "AF", "AG"):
        ws[f"{c}{r}"].font = font(10, True, NAVY)
total_row(ws, ET, "C", "الإجمالي", g_cols + ["R"] + c_cols + ["AF", "AG", "AH"], E0, E1, ACC, "B", "AH")
ws[f"S{ET}"].fill = fill("FFFFFF")
ws.freeze_panes = f"D{E0}"

# ================================================================ الإقامات ورخص العمل
ws = ws_gov
GOV_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "الجنسية", 10, None), ("E", "الفئة", 10, None),
            ("F", "حالة التوظيف", 15, None), ("G", "رقم الإقامة / الهوية", 13, None),
            ("H", "انتهاء الإقامة / الهوية", 12, DATE), ("I", "الأيام المتبقية", 9, INT), ("J", "حالة الإقامة", 19, None),
            ("K", "انتهاء رخصة العمل", 12, DATE), ("L", "الأيام المتبقية", 9, INT), ("M", "حالة رخصة العمل", 19, None),
            ("N", "رسوم الإقامة السنوية", 12, ACC), ("O", "المقابل المالي السنوي", 12, ACC),
            ("P", "التأمين الطبي السنوي", 12, ACC), ("Q", "رسوم أخرى سنوية", 11, ACC),
            ("R", "إجمالي التكلفة السنوية", 13, ACC), ("S", "التكلفة الشهرية", 12, ACC),
            ("T", "المحمّل حتى شهر التقرير", 13, ACC), ("U", "مبلغ تجديد متوقع خلال فترة التنبيه", 14, ACC)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in GOV_COLS}}, BROWN)
banner(ws, "B", "U", '="🪪 متابعة الإقامات ورخص العمل وتكلفتها — كما في "&TEXT(cfg_TRACK,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHIJ"), S_GOV)
headers(ws, 5, [(c, t) for c, t, _, _ in GOV_COLS], BROWN, height=52)
data_rows(ws, [c for c, *_ in GOV_COLS], E0, E1, {c: ("f", f) for c, _, _, f in GOV_COLS})


def expiry_status(dcol, dayscol, r):
    return (f'=IF(OR($B{r}="",$F{r}="✖ منتهي الخدمة"),"",IF({dcol}{r}="",IF($E{r}="غير سعودي","⚠ أدخل التاريخ","-"),'
            f'IF({dayscol}{r}<0,"✖ منتهية منذ "&TEXT(-{dayscol}{r},"0")&" يوم",IF({dayscol}{r}<=cfg_ALERT,"⚠ تنتهي خلال "&TEXT({dayscol}{r},"0")&" يوم","✔ سارية"))))')


for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    ytd = "+".join(f"IF({i+1}<=cfg_VAL_M,{R(MSHEETS[i])}AD{r}+{R(MSHEETS[i])}AE{r}+{R(MSHEETS[i])}AF{r},0)" for i in range(12))
    f = {
        "B": f'=IF({em("id", r)}="","",{em("id", r)})',
        "C": f'=IF({B},"",{em("name", r)})',
        "D": f'=IF({B},"",{em("nat", r)})',
        "E": f'=IF({B},"",{em("cat", r)})',
        "F": f'=IF({B},"",{em("est", r)})',
        "G": f'=IF({B},"",IF({em("iqno", r)}="","",{em("iqno", r)}))',
        "H": f'=IF({B},"",IF({em("iqexp", r)}="","",{em("iqexp", r)}))',
        "I": f'=IF(OR({B},H{r}=""),"",H{r}-cfg_TRACK)',
        "J": expiry_status("H", "I", r),
        "K": f'=IF({B},"",IF({em("wpexp", r)}="","",{em("wpexp", r)}))',
        "L": f'=IF(OR({B},K{r}=""),"",K{r}-cfg_TRACK)',
        "M": expiry_status("K", "L", r),
        "N": f'=IF({B},"",IF(F{r}="✖ منتهي الخدمة",0,{fee_iq(r)}))',
        "O": f'=IF({B},"",IF(F{r}="✖ منتهي الخدمة",0,{fee_wp(r)}))',
        "P": f'=IF({B},"",IF(F{r}="✖ منتهي الخدمة",0,{fee_med(r)}))',
        "Q": f'=IF({B},"",IF(F{r}="✖ منتهي الخدمة",0,{fee_oth(r)}))',
        "R": f'=IF({B},"",SUM(N{r}:Q{r}))',
        "S": f'=IF({B},"",R{r}/12)',
        "T": f'=IF({B},"",{ytd})',
        "U": (f'=IF(OR({B},F{r}="✖ منتهي الخدمة"),"",IF(AND(ISNUMBER(I{r}),I{r}<=cfg_ALERT),N{r},0)'
              f'+IF(AND(ISNUMBER(L{r}),L{r}<=cfg_ALERT),O{r},0))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
total_row(ws, ET, "C", "الإجمالي", list("NOPQRSTU"), E0, E1, ACC, "B", "U")
status_cf(ws, f"J{E0}:J{E1}", f"J{E0}")
status_cf(ws, f"M{E0}:M{E1}", f"M{E0}")
status_cf(ws, f"F{E0}:F{E1}", f"F{E0}")
note(ws, f"B{ET+1}", "التكلفة السنوية تُحمَّل على المسير شهرياً (÷ 12 حسب أيام التوظيف) ضمن «تكلفة الموظف على المنشأة»، وتظهر في القيود كإطفاء لمصروفات مدفوعة مقدماً. "
     "«مبلغ تجديد متوقع» = رسوم الإقامة و/أو المقابل المالي لمن تنتهي وثيقته خلال فترة التنبيه — للتخطيط النقدي. "
     "لتغيير القيم لموظف معين عدّلها في ورقة الموظفين؛ القيم الافتراضية في الإعدادات.", f"B{ET+1}:U{ET+1}", 40)
ws.freeze_panes = f"D{E0}"
ws.auto_filter.ref = f"B5:U{E1}"

# ================================================================ مخصص نهاية الخدمة
ws = ws_eos
EOS_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "تاريخ التعيين", 12, DATE),
            ("E", "تاريخ الاحتساب", 12, DATE), ("F", "مدة الخدمة", 22, None), ("G", "أيام غير محتسبة (بدون راتب/انقطاع)", 10, INT),
            ("H", "سنوات الخدمة المحتسبة", 9, "0.000"), ("I", "أجر الاحتساب", 12, ACC),
            ("J", "استحقاق السنوات الأولى", 13, ACC), ("K", "استحقاق ما بعدها", 13, ACC),
            ("L", "الاستحقاق الكامل (م 84)", 14, ACC), ("M", "الحالة / سبب الانتهاء", 17, None),
            ("N", "نسبة الاستحقاق عند الاستقالة (م 85)", 11, PCT), ("O", "الاستحقاق النظامي (رصيد المخصص المطلوب)", 15, ACC),
            ("P", "الرصيد الافتتاحي 1/1", 13, ACC), ("Q", "المكوّن خلال الفترة", 13, ACC),
            ("R", "المدفوع خلال الفترة", 12, ACC), ("S", "الرصيد الختامي", 14, ACC), ("T", "الفحص", 18, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in EOS_COLS}}, GOLD)
banner(ws, "B", "T", '="🎁 مخصص مكافأة نهاية الخدمة كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHIJ"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in EOS_COLS], GOLD, height=58)
data_rows(ws, [c for c, *_ in EOS_COLS], E0, E1, {c: ("f", f) for c, _, _, f in EOS_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    y0 = (f'(MAX(0,IF(OR({em("term", r)}="",{em("term", r)}>=cfg_Y_START),cfg_Y_START-1,{em("term", r)})-D{r}+1'
          f'-{reg_sum("R", r)})/cfg_DAYS_Y)')
    f = {
        "B": f'=IF({em("id", r)}="","",{em("id", r)})',
        "C": f'=IF({B},"",{em("name", r)})',
        "D": f'=IF({B},"",{em("hire", r)})',
        "E": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "F": (f'=IF({B},"",IF(E{r}<D{r},"لم يباشر",DATEDIF(D{r},E{r}+1,"y")&" سنة "&DATEDIF(D{r},E{r}+1,"ym")&" شهر "'
              f'&DATEDIF(D{r},E{r}+1,"md")&" يوم"))'),
        "G": f'=IF({B},"",{reg_sum("S", r)})',
        "H": f'=IF({B},"",MAX(0,E{r}-D{r}+1-G{r})/cfg_DAYS_Y)',
        "I": f'=IF({B},"",{em("eosw", r)})',
        "J": f'=IF({B},"",I{r}*cfg_EOS_R1*MIN(H{r},cfg_EOS_TH))',
        "K": f'=IF({B},"",I{r}*cfg_EOS_R2*MAX(H{r}-cfg_EOS_TH,0))',
        "L": f'=IF({B},"",J{r}+K{r})',
        "M": (f'=IF({B},"",IF(AND({em("term", r)}<>"",{em("term", r)}<=cfg_VAL_DATE),'
              f'IF({em("reason", r)}="","⚠ حدد السبب",{em("reason", r)}),"على رأس العمل"))'),
        "N": f'=IF({B},"",VLOOKUP(H{r},cfg_RES,2,TRUE))',
        "O": f'=IF({B},"",IF(M{r}="استقالة",L{r}*N{r},L{r}))',
        "P": f'=IF({B},"",I{r}*(cfg_EOS_R1*MIN({y0},cfg_EOS_TH)+cfg_EOS_R2*MAX({y0}-cfg_EOS_TH,0)))',
        "Q": f'=IF({B},"",O{r}-P{r})',
        "R": (f'=IF({B},"",SUMIFS({MV}$N${M0}:$N${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "S": f'=IF({B},"",P{r}+Q{r}-R{r})',
        "T": (f'=IF({B},"",IF(S{r}<-0.01,"✖ صرف أكثر من المستحق",IF(AND(M{r}<>"على رأس العمل",S{r}>0.01),'
              f'"⚠ مستحق لم يُصرف","✔ سليم")))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"S{r}"].font = font(10, True, GOLD)
total_row(ws, ET, "C", "الإجمالي", ["J", "K", "L", "O", "P", "Q", "R", "S"], E0, E1, ACC, "B", "T")
status_cf(ws, f"T{E0}:T{E1}", f"T{E0}")
note(ws, f"B{ET+1}", "أساس المخصص: الاستحقاق الكامل وفق المادة 84 للموظف على رأس العمل (الأحوط محاسبياً)، وللمستقيل نسبة المادة 85. "
     "تُستبعد من مدة الخدمة الأنواع المعرّفة في الإعدادات بأنها «لا تحتسب في الخدمة» (الإجازة بدون راتب والانقطاع). "
     "الرصيد الافتتاحي = الاستحقاق في 31/12 من السنة السابقة بالأجر الحالي. المدفوع يُسحب تلقائياً من الحركات الشهرية.", f"B{ET+1}:T{ET+1}", 44)
ws.freeze_panes = f"D{E0}"

# ================================================================ مخصص الإجازات
ws = ws_lv
LV_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "تاريخ التعيين", 12, DATE),
           ("E", "سنوات الخدمة", 9, "0.00"), ("F", "الاستحقاق السنوي (يوم)", 10, INT),
           ("G", "أجر اليوم", 11, ACC), ("H", "رصيد افتتاحي (يوم)", 10, DAYS),
           ("I", "بداية الاستحقاق هذه السنة", 12, DATE), ("J", "نهاية الاستحقاق", 12, DATE),
           ("K", "أيام العمل المحتسبة", 10, INT), ("L", "أيام مكتسبة", 10, DAYS),
           ("M", "أيام مأخوذة (السجل + اليدوي)", 10, DAYS), ("N", "أيام مصروفة نقداً", 10, DAYS),
           ("O", "الرصيد الختامي (يوم)", 11, DAYS), ("P", "قيمة المخصص الختامي", 14, ACC),
           ("Q", "قيمة الرصيد الافتتاحي", 13, ACC), ("R", "تكلفة الإجازات المأخوذة", 13, ACC), ("S", "الفحص", 18, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in LV_COLS}}, GREEN)
banner(ws, "B", "S", '="🌴 مخصص الإجازات السنوية كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHIJ"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in LV_COLS], GREEN, height=52)
data_rows(ws, [c for c, *_ in LV_COLS], E0, E1, {c: ("f", f) for c, _, _, f in LV_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    f = {
        "B": f'=IF({em("id", r)}="","",{em("id", r)})',
        "C": f'=IF({B},"",{em("name", r)})',
        "D": f'=IF({B},"",{em("hire", r)})',
        "J": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "E": f'=IF({B},"",MAX(0,J{r}-D{r}+1-{reg_sum("S", r)})/cfg_DAYS_Y)',
        "F": f'=IF({B},"",IF({em("lvdays", r)}<>"",{em("lvdays", r)},IF(E{r}>=cfg_LV_TH,cfg_LV_D2,cfg_LV_D1)))',
        "G": f'=IF({B},"",{em("lvw", r)}/cfg_DAYS_M)',
        "H": f'=IF({B},"",N({em("oplv", r)}))',
        "I": f'=IF({B},"",MAX(cfg_Y_START,D{r}))',
        "K": f'=IF({B},"",MAX(0,MAX(0,J{r}-I{r}+1)-({reg_sum("S", r)}-{reg_sum("R", r)})))',
        "L": f'=IF({B},"",F{r}/cfg_DAYS_Y*K{r})',
        "M": (f'=IF({B},"",{reg_sum("T", r)}+SUMIFS({MV}$K${M0}:$K${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "N": (f'=IF({B},"",SUMIFS({MV}$L${M0}:$L${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "O": f'=IF({B},"",H{r}+L{r}-M{r}-N{r})',
        "P": f'=IF({B},"",O{r}*G{r})',
        "Q": f'=IF({B},"",H{r}*G{r})',
        "R": f'=IF({B},"",(M{r}+N{r})*G{r})',
        "S": (f'=IF({B},"",IF(O{r}<-0.01,"✖ رصيد سالب",IF(O{r}>F{r}*2,"⚠ رصيد مرتفع (أكثر من سنتين)",'
              f'IF(AND({em("term", r)}<>"",{em("term", r)}<=cfg_VAL_DATE,O{r}>0.01),"⚠ منتهي الخدمة برصيد","✔ سليم"))))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"P{r}"].font = font(10, True, GREEN)
total_row(ws, ET, "C", "الإجمالي", ["H", "L", "M", "N", "O", "P", "Q", "R"], E0, E1, ACC, "B", "S")
for c in "HLMNO":
    ws[f"{c}{ET}"].number_format = DAYS
status_cf(ws, f"S{E0}:S{E1}", f"S{E0}")
note(ws, f"B{ET+1}", "الرصيد (يوم) = الافتتاحي + المكتسب (الاستحقاق السنوي ÷ 365 × أيام العمل المحتسبة) − المأخوذ − المصروف نقداً. "
     "الأيام المأخوذة تُسحب من «سجل الإجازات والحالات» (للإجازة ذات الراتب المقدم تُخصم كاملة في شهر صرفها) ومن العمود اليدوي في الحركات. "
     "أيام الإجازة بدون راتب والانقطاع لا تُكتسب عنها إجازة. قيمة المخصص = الرصيد × أجر اليوم الحالي.",
     f"B{ET+1}:S{ET+1}", 40)
ws.freeze_panes = f"D{E0}"

# ================================================================ مخصص التذاكر
ws = ws_tk
TK_COLS = [("B", "الرقم", 9, None), ("C", "اسم الموظف", 24, None), ("D", "يستحق تذكرة؟", 9, None),
           ("E", "قيمة التذكرة", 12, ACC), ("F", "الدورية (شهر)", 9, INT), ("G", "التكلفة الشهرية", 11, ACC),
           ("H", "بداية الاستحقاق هذه السنة", 12, DATE), ("I", "نهاية الاستحقاق", 12, DATE),
           ("J", "أيام العمل المحتسبة", 9, INT), ("K", "المكوّن خلال الفترة", 13, ACC), ("L", "الرصيد الافتتاحي", 13, ACC),
           ("M", "المستخدم خلال الفترة", 13, ACC), ("N", "الرصيد الختامي", 14, ACC),
           ("O", "ما يعادله من تذاكر", 10, "0.00"), ("P", "الفحص", 22, None)]
setup(ws, {"A": 2, **{c: w for c, _, w, _ in TK_COLS}}, BLUE)
banner(ws, "B", "P", '="✈ مخصص تذاكر السفر كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")')
nav(ws, list("BCDEFGHIJ"), None)
headers(ws, 5, [(c, t) for c, t, _, _ in TK_COLS], BLUE, height=52)
data_rows(ws, [c for c, *_ in TK_COLS], E0, E1, {c: ("f", f) for c, _, _, f in TK_COLS})
for r in range(E0, E1 + 1):
    B = f'$B{r}=""'
    f = {
        "B": f'=IF({em("id", r)}="","",{em("id", r)})',
        "C": f'=IF({B},"",{em("name", r)})',
        "D": f'=IF({B},"",IF({em("tkt", r)}="نعم","نعم","لا"))',
        "E": f'=IF({B},"",N({em("tktv", r)}))',
        "F": f'=IF({B},"",N({em("tktc", r)}))',
        "G": f'=IF({B},"",IF(AND(D{r}="نعم",F{r}>0),E{r}/F{r},0))',
        "H": f'=IF({B},"",MAX(cfg_Y_START,{em("hire", r)}))',
        "I": f'=IF({B},"",{end_at(r, "cfg_VAL_DATE")})',
        "J": f'=IF({B},"",MAX(0,MAX(0,I{r}-H{r}+1)-({reg_sum("S", r)}-{reg_sum("R", r)})))',
        "K": f'=IF({B},"",G{r}*12/cfg_DAYS_Y*J{r})',
        "L": f'=IF({B},"",N({em("optk", r)}))',
        "M": (f'=IF({B},"",SUMIFS({MV}$M${M0}:$M${M1},{MV}$B${M0}:$B${M1},B{r},'
              f'{MV}$A${M0}:$A${M1},"<="&cfg_VAL_M))'),
        "N": f'=IF({B},"",L{r}+K{r}-M{r})',
        "O": f'=IF({B},"",IF(E{r}>0,N{r}/E{r},0))',
        "P": (f'=IF({B},"",IF(AND(D{r}="لا",N{r}<>0),"⚠ غير مستحق وله رصيد",IF(N{r}<-0.01,"✖ استخدام أكثر من المكوّن",'
              f'IF(AND(D{r}="نعم",O{r}>=1),"⚠ تذكرة مستحقة للصرف","✔ سليم"))))'),
    }
    for col, v in f.items():
        ws[f"{col}{r}"] = v
    ws[f"N{r}"].font = font(10, True, BLUE)
total_row(ws, ET, "C", "الإجمالي", ["G", "K", "L", "M", "N"], E0, E1, ACC, "B", "P")
status_cf(ws, f"P{E0}:P{E1}", f"P{E0}")
note(ws, f"B{ET+1}", "المكوّن = (قيمة التذكرة ÷ دورية الاستحقاق × 12 ÷ 365) × أيام العمل المحتسبة خلال السنة حتى تاريخ التقرير (تُستبعد الإجازة بدون راتب والانقطاع). "
     "المستخدم يُسحب من عمود «قيمة تذاكر مستخدمة» في الحركات الشهرية. «ما يعادله من تذاكر» ≥ 1 يعني أن الموظف استحق تذكرة كاملة.",
     f"B{ET+1}:P{ET+1}", 34)
ws.freeze_panes = f"D{E0}"

# ================================================================ قيود الرواتب
ws = ws_je
mcols = [CL(CI("E") + i) for i in range(12)]           # E..P
setup(ws, {"A": 2, "B": 8, "C": 40, "D": 7, **{c: 12.5 for c in mcols}, "Q": 15, "R": 15}, "4A5568")
banner(ws, "B", "R", "🧾 القيود المحاسبية الشهرية للرواتب والمخصصات والتكاليف الحكومية (جاهزة للترحيل)")
nav(ws, list("BCDEFGHIJ"), S_JE)
put(ws, "C4", "رقم الشهر ←", font(8, False, GREY_TXT), None, align("left"))
for i, c in enumerate(mcols):
    put(ws, f"{c}4", i + 1, font(8, False, GREY_TXT), None, align("center"), fmt="0")
ws.row_dimensions[4].height = 14
headers(ws, 5, [("B", "رمز الحساب"), ("C", "اسم الحساب"), ("D", "الطبيعة")] +
        [(c, MONTHS[i]) for i, c in enumerate(mcols)] + [("Q", "إجمالي السنة"), ("R", "حتى شهر التقرير")], height=30)


def mv_month(col, m):
    return f"SUMIFS({MV}${col}${M0}:${col}${M1},{MV}$A${M0}:$A${M1},{m})"


JE = [
    ("section", "① قيد استحقاق رواتب الشهر"),
    ("5101", "مصروف الرواتب الأساسية", "مدين", "K"),
    ("5102", "مصروف بدل السكن", "مدين", "L"),
    ("5103", "مصروف بدل النقل", "مدين", "M"),
    ("5104", "مصروف بدلات أخرى", "مدين", "N"),
    ("5105", "مصروف العمل الإضافي", "مدين", "P"),
    ("5106", "مصروف المكافآت والعمولات والإضافات", "مدين", "Q+R"),
    ("5114", "رواتب إجازات مدفوعة مقدماً", "مدين", "S"),
    ("5107", "مصروف التأمينات الاجتماعية (حصة المنشأة)", "مدين", "Z"),
    ("2105", "المؤسسة العامة للتأمينات الاجتماعية — مستحق", "دائن", "U+Z"),
    ("1106", "سلف الموظفين", "دائن", "V"),
    ("4901", "إيرادات خصومات وجزاءات الموظفين", "دائن", "W"),
    ("2104", "رواتب مستحقة الدفع", "دائن", "Y"),
    ("section", "② قيد تكوين المخصصات"),
    ("5108", "مصروف مكافأة نهاية الخدمة", "مدين", "AA"),
    ("2202", "مخصص مكافأة نهاية الخدمة", "دائن", "AA"),
    ("5109", "مصروف الإجازات السنوية", "مدين", "AB"),
    ("2106", "مخصص الإجازات السنوية", "دائن", "AB"),
    ("5110", "مصروف تذاكر السفر", "مدين", "AC"),
    ("2107", "مخصص تذاكر السفر", "دائن", "AC"),
    ("section", "③ تحميل رواتب الإجازات المأخوذة على المخصص"),
    ("2106", "مخصص الإجازات السنوية (استخدام)", "مدين", "AM"),
    ("5109", "مصروف الإجازات السنوية (رد — مُحمَّل على المخصص)", "دائن", "AM"),
    ("section", "④ إطفاء رسوم الإقامة ورخص العمل والتأمين الطبي"),
    ("5111", "مصروف رسوم الإقامة ورخص العمل والرسوم الحكومية", "مدين", "AD+AF"),
    ("1107", "رسوم حكومية مدفوعة مقدماً", "دائن", "AD+AF"),
    ("5112", "مصروف التأمين الطبي", "مدين", "AE"),
    ("1108", "تأمين طبي مدفوع مقدماً", "دائن", "AE"),
    ("section", "⑤ صرف الرواتب ومستحقات نهاية الخدمة والتذاكر"),
    ("2104", "رواتب مستحقة الدفع", "مدين", "Y"),
    ("2202", "مخصص مكافأة نهاية الخدمة (مدفوع)", "مدين", ("mov", "N")),
    ("2107", "مخصص تذاكر السفر (مستخدم)", "مدين", ("mov", "M")),
    ("1102", "البنك", "دائن", ("sum", ["Y", ("mov", "N"), ("mov", "M")])),
]


def je_formula(src, i):
    sh = R(MSHEETS[i])
    if isinstance(src, str):
        return "=" + "+".join(f"{sh}{s}{ET}" for s in src.split("+"))
    if src[0] == "mov":
        return "=" + mv_month(src[1], i + 1)
    return "=" + "+".join(je_formula(p, i)[1:] for p in src[1])


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
            put(ws, f"{c}{r}", je_formula(src, i), font(10), fill(CARD_BG), align("center"), BORDER, ACC)
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
     "القيد ③ ينقل راتب أيام الإجازة المأخوذة من المصروف إلى المخصص حتى لا يُحمَّل مرتين. القيد ④ يفترض أن الرسوم تُسجَّل عند سدادها في «مدفوعة مقدماً» ثم تُطفأ شهرياً. "
     "كل خلية مرتبطة مباشرة بصف الإجمالي في مسير الشهر المقابل أو بالحركات الشهرية.",
     f"B{r+2}:R{r+2}", 40)
ws.freeze_panes = "E6"

# ================================================================ قسيمة الراتب
ws = ws_slip
setup(ws, {"A": 2, "B": 24, "C": 18, "D": 4, "E": 24, "F": 18, "G": 3, "H": 12, "I": 30}, "C05621", landscape=False)
banner(ws, "B", "F", '="قسيمة راتب — "&cfg_CO')
nav(ws, ["B", "C", "E", "F"], S_SLIP)
put(ws, "B5", "اختر الشهر (1-12):", font(10, True), fill(CARD_BG), align(), BORDER)
put(ws, "C5", 9, font(12, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, "0")
put(ws, "E5", "اختر الرقم الوظيفي:", font(10, True), fill(CARD_BG), align(), BORDER)
put(ws, "F5", "E012", font(12, True, INPUT_FONT), fill(INPUT), align("center"), BORDER)
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


def emp(key):
    col = EC[key]
    return f'=IF($I$5="","",INDEX({EM}${col}${E0}:${col}${E1},$I$5-{E0-1}))'


def pay(col, text=False):
    if text:
        return f'=IF($I$5="","",INDIRECT("\'"&$I$6&"\'!{col}"&$I$5))'
    return f'=IF($I$5="",0,N(INDIRECT("\'"&$I$6&"\'!{col}"&$I$5)))'


info = [("B9", "اسم الموظف", "C9", emp("name"), None), ("E9", "الرقم الوظيفي", "F9", "=F5", None),
        ("B10", "القسم", "C10", emp("dept"), None), ("E10", "المسمى الوظيفي", "F10", emp("job"), None),
        ("B11", "الجنسية", "C11", emp("nat"), None), ("E11", "تاريخ التعيين", "F11", emp("hire"), DATE),
        ("B12", "البنك", "C12", emp("bank"), None), ("E12", "رقم الآيبان", "F12", emp("iban"), None),
        ("B13", "أيام الاستحقاق", "C13", pay("G"), DAYS), ("E13", "أيام مدفوعة", "F13", pay("J"), DAYS),
        ("B14", "الوضع خلال الشهر", "C14", pay("F", True), None), ("E14", "أيام غياب + بدون أجر", "F14",
                                                                 f'={pay("H")[1:]}+{pay("I")[1:]}', DAYS)]
for lr, lt, vr, vf, fmt in info:
    put(ws, lr, lt, font(10, True, GREY_TXT), fill(ALT), align(), BORDER)
    put(ws, vr, vf, font(10, True), fill(CARD_BG), align("center", wrap=True), BORDER, fmt)
ws["F12"].font = font(8, True)
ws.row_dimensions[14].height = 30
status_cf(ws, "C14", "C14")
section(ws, "B16", "المستحقات", "B16:C16", TEAL)
section(ws, "E16", "الاستقطاعات", "E16:F16", RED)
earn = [("الراتب الأساسي", "K"), ("بدل السكن", "L"), ("بدل النقل", "M"), ("بدلات أخرى", "N"),
        ("العمل الإضافي", "P"), ("مكافآت وعمولات", "Q"), ("إضافات أخرى", "R"), ("راتب إجازة مدفوع مقدماً", "S")]
ded = [("التأمينات الاجتماعية", "U"), ("أقساط السلف", "V"), ("خصومات وجزاءات", "W")]
for i, (t, c) in enumerate(earn):
    put(ws, f"B{17+i}", t, font(10), fill(CARD_BG), align(), BORDER)
    put(ws, f"C{17+i}", pay(c), font(10), fill(CARD_BG), align("center"), BORDER, ACC)
for i in range(len(earn)):
    t, c = ded[i] if i < len(ded) else (None, None)
    put(ws, f"E{17+i}", t, font(10), fill(CARD_BG), align(), BORDER)
    put(ws, f"F{17+i}", pay(c) if c else None, font(10), fill(CARD_BG), align("center"), BORDER, ACC)
put(ws, "B25", "إجمالي المستحقات", font(11, True, "FFFFFF"), fill(TEAL), align(), BORDER)
put(ws, "C25", "=SUM(C17:C24)", font(11, True, "FFFFFF"), fill(TEAL), align("center"), BORDER, ACC)
put(ws, "E25", "إجمالي الاستقطاعات", font(11, True, "FFFFFF"), fill(RED), align(), BORDER)
put(ws, "F25", "=SUM(F17:F24)", font(11, True, "FFFFFF"), fill(RED), align("center"), BORDER, ACC)
put(ws, "B27", "صافي الراتب المستحق", font(14, True, "FFFFFF"), fill(GREEN), align("center"), merge="B27:C27")
put(ws, "E27", "=C25-F25", font(16, True, "FFFFFF"), fill(GREEN), align("center"), fmt=ACC, merge="E27:F27")
ws.row_dimensions[27].height = 34
put(ws, "B28", '=IF(ROUND(E27-' + pay("Y")[1:] + ',2)=0,"✔ مطابق لمسير الشهر","✖ غير مطابق للمسير")',
    font(9, True), None, align("center"), merge="B28:F28")
status_cf(ws, "B28", "B28")
section(ws, "B30", "معلومات للمنشأة: التكلفة الكاملة والأرصدة (كما في تاريخ التقرير)", "B30:F30", PURPLE)
extra = [("B31", "تأمينات حصة المنشأة", "C31", pay("Z")), ("E31", "مخصص نهاية الخدمة للشهر", "F31", pay("AA")),
         ("B32", "مخصص الإجازات للشهر", "C32", pay("AB")), ("E32", "مخصص التذاكر للشهر", "F32", pay("AC")),
         ("B33", "الإقامة ورخصة العمل للشهر", "C33", pay("AD")), ("E33", "التأمين الطبي ورسوم أخرى للشهر", "F33",
                                                                  f'={pay("AE")[1:]}+{pay("AF")[1:]}'),
         ("B34", "إجمالي تكلفة الموظف للشهر", "C34", pay("AG")),
         ("E34", "رصيد الإجازات (يوم)", "F34", f'=IF($I$5="","",INDEX({R(S_LV)}$O${E0}:$O${E1},$I$5-{E0-1}))'),
         ("B35", "رصيد مكافأة نهاية الخدمة", "C35", f'=IF($I$5="","",INDEX({R(S_EOS)}$S${E0}:$S${E1},$I$5-{E0-1}))'),
         ("E35", "رصيد مخصص التذاكر", "F35", f'=IF($I$5="","",INDEX({R(S_TK)}$N${E0}:$N${E1},$I$5-{E0-1}))')]
for lr, lt, vr, vf in extra:
    put(ws, lr, lt, font(10, True, GREY_TXT), fill(ALT), align(), BORDER)
    put(ws, vr, vf, font(10, True, PURPLE), fill(CARD_BG), align("center"), BORDER, DAYS if vr == "F34" else ACC)
put(ws, "B38", "توقيع المحاسب: ....................", font(10), None, align())
put(ws, "E38", "توقيع الموظف: ....................", font(10), None, align())
ws.print_area = "B1:F38"

# ================================================================ لوحة التحكم
ws = ws_dash
setup(ws, {"A": 2, **{CL(i): 12.5 for i in range(2, 15)}}, PURPLE)
banner(ws, "B", "N", "📊 لوحة التحكم — الرواتب والمخصصات والتكاليف الحكومية")
nav(ws, list("BCDEFGH"), S_DASH)
put(ws, "J3", "شهر التقرير ←", font(10, True, GREY_TXT), None, align("left"))
put(ws, "K3", "=INDEX(L_MONTH,cfg_VAL_M)&\" \"&cfg_FY", font(11, True, NAVY), fill(INPUT), align("center"), BORDER,
    merge="K3:L3")
button(ws, "M3", "⚙ تغيير الشهر", S_SET, GOLD, merge="M3:N3")
MSR = R(S_MSUM)
EST = f'{EM}$AG${E0}:$AG${E1}'
ACT = f'{EST},"✔ على رأس العمل"'
section(ws, "B5", "👥 القوى العاملة", "B5:N5", NAVY)
card(ws, 6, "B", "D", "الموظفون على رأس العمل", f"=COUNTIF({ACT})", INT)
card(ws, 6, "E", "G", "في إجازة / إيقاف حالياً", f'=COUNTIF({EM}$AH${E0}:$AH${E1},"✈*")', INT, BLUE)
card(ws, 6, "H", "J", "نسبة التوطين (السعودة)",
     f'=IFERROR(COUNTIFS({ACT},{EM}$E${E0}:$E${E1},"سعودي")/B7,0)', PCT, GREEN)
card(ws, 6, "K", "N", "متوسط إجمالي الراتب الشهري", f'=IFERROR(AVERAGEIF({ACT},{EM}$P${E0}:$P${E1}),0)', ACC0, TEAL)
section(ws, "B9", '="💵 الرواتب من بداية السنة حتى "&INDEX(L_MONTH,cfg_VAL_M)', "B9:N9", TEAL)
card(ws, 10, "B", "D", "إجمالي المستحقات", f"={MSR}K19", ACC0, TEAL)
card(ws, 10, "E", "G", "صافي الرواتب المدفوعة", f"={MSR}N19", ACC0, GREEN)
card(ws, 10, "H", "J", "التأمينات (موظف + منشأة)", f"={MSR}L19+{MSR}O19", ACC0, RED)
card(ws, 10, "K", "N", "إجمالي تكلفة العمالة", f"={MSR}U19", ACC0, PURPLE)
section(ws, "B13", "🪪 الإقامات ورخص العمل والتأمين الطبي", "B13:N13", BROWN)
card(ws, 14, "B", "D", "المحمّل حتى تاريخه (إقامة + رخص + طبي)", f"={MSR}S19+{MSR}T19", ACC0, BROWN)
card(ws, 14, "E", "G", "التكلفة السنوية المتوقعة", f"={R(S_GOV)}R{ET}", ACC0, BROWN)
card(ws, 14, "H", "J", "تجديدات متوقعة خلال فترة التنبيه", f"={R(S_GOV)}U{ET}", ACC0, RED)
card(ws, 14, "K", "N", "متوسط تكلفة الموظف الشهرية الكاملة",
     f'=IFERROR({MSR}U19/SUMIF({MSR}$C$6:$C$17,"<="&cfg_VAL_M,{MSR}$D$6:$D$17),0)', ACC0, PURPLE)
section(ws, "B17", '="🏦 أرصدة المخصصات كما في "&TEXT(cfg_VAL_DATE,"yyyy/mm/dd")', "B17:N17", GOLD)
card(ws, 18, "B", "D", "مخصص نهاية الخدمة", f"={R(S_EOS)}S{ET}", ACC0, GOLD)
card(ws, 18, "E", "G", "مخصص الإجازات", f"={R(S_LV)}P{ET}", ACC0, GREEN)
card(ws, 18, "H", "J", "مخصص تذاكر السفر", f"={R(S_TK)}N{ET}", ACC0, BLUE)
card(ws, 18, "K", "N", "إجمالي المخصصات", "=B19+E19+H19", ACC0, NAVY)
for ref, tgt in (("B18", S_EOS), ("E18", S_LV), ("H18", S_TK), ("B14", S_GOV), ("H14", S_GOV), ("E6", S_REG)):
    ws[ref].hyperlink = Hyperlink(ref=ref, location=f"'{tgt}'!A1", display=ws[ref].value)

section(ws, "B21", "🔔 تنبيهات وفحوصات الترابط", "B21:G21", RED)
GV = R(S_GOV)
ALERTS = [
    ("إقامات منتهية أو تنتهي قريباً", f'=COUNTIF({GV}$J${E0}:$J${E1},"✖*")+COUNTIF({GV}$J${E0}:$J${E1},"⚠*")'),
    ("رخص عمل منتهية أو تنتهي قريباً", f'=COUNTIF({GV}$M${E0}:$M${E1},"✖*")+COUNTIF({GV}$M${E0}:$M${E1},"⚠*")'),
    ("أخطاء أو تداخل في سجل الإجازات", f'=COUNTIF({RG}$P${G0}:$P${G1},"✖*")+COUNTIF({RG}$P${G0}:$P${G1},"⚠*")'),
    ("موظفون منتهية خدماتهم بمستحقات لم تُصرف", f'=COUNTIF({R(S_EOS)}$T${E0}:$T${E1},"⚠*")'),
    ("أرصدة إجازات سالبة أو مرتفعة", f'=COUNTIF({R(S_LV)}$S${E0}:$S${E1},"✖*")+COUNTIF({R(S_LV)}$S${E0}:$S${E1},"⚠ رصيد مرتفع*")'),
    ("تذاكر مستحقة للصرف", f'=COUNTIF({R(S_TK)}$P${E0}:$P${E1},"⚠ تذكرة*")'),
    ("حركات برقم وظيفي غير صحيح", f'=COUNTIF({MV}$C${M0}:$C${M1},"✖*")+COUNTIF({RG}$C${G0}:$C${G1},"✖*")'),
    ("رواتب صافية بالسالب (كل الأشهر)",
     "=" + "+".join(f'COUNTIF({R(s)}$Y${E0}:$Y${E1},"<0")' for s in MSHEETS)),
]
for i, (t, fml) in enumerate(ALERTS):
    rr = 22 + i
    put(ws, f"B{rr}", t, font(10), fill(CARD_BG), align(), BORDER, merge=f"B{rr}:E{rr}")
    put(ws, f"F{rr}", fml, font(11, True), fill(CARD_BG), align("center"), BORDER, "0")
    put(ws, f"G{rr}", f'=IF(F{rr}=0,"✔","⚠")', font(11, True), fill(CARD_BG), align("center"), BORDER)
rr = 22 + len(ALERTS)
put(ws, f"B{rr}", "توازن قيود الرواتب (حتى شهر التقرير)", font(10), fill(CARD_BG), align(), BORDER, merge=f"B{rr}:E{rr}")
put(ws, f"F{rr}", f"={JE_CHECK}", font(10, True), fill(CARD_BG), align("center"), BORDER, merge=f"F{rr}:G{rr}")
status_cf(ws, f"F{rr}", f"F{rr}")
ws.conditional_formatting.add(f"G22:G{rr-1}", FormulaRule(formula=['G22="✔"'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
ws.conditional_formatting.add(f"G22:G{rr-1}", FormulaRule(formula=['G22="⚠"'], fill=fill("FFF3CD"), font=Font(color=GOLD, bold=True)))

section(ws, "I21", "🌍 التوزيع حسب الفئة", "I21:N21", GREEN)
headers(ws, 22, [("I", "الفئة"), ("J", "العدد"), ("K", "النسبة"), ("L", "الرواتب الشهرية")], GREEN, 22)
ws.merge_cells("L22:N22")
for i, cat in enumerate(CATS):
    rr2 = 23 + i
    put(ws, f"I{rr2}", cat, font(10, True), fill(CARD_BG), align("center"), BORDER)
    put(ws, f"J{rr2}", f'=COUNTIFS({ACT},{EM}$E${E0}:$E${E1},I{rr2})', font(10), fill(CARD_BG), align("center"), BORDER, INT)
    put(ws, f"K{rr2}", f"=IFERROR(J{rr2}/SUM($J$23:$J$24),0)", font(10), fill(CARD_BG), align("center"), BORDER, PCT)
    put(ws, f"L{rr2}", f'=SUMIFS({EM}$P${E0}:$P${E1},{ACT},{EM}$E${E0}:$E${E1},I{rr2})', font(10), fill(CARD_BG),
        align("center"), BORDER, ACC0, merge=f"L{rr2}:N{rr2}")
pie = PieChart()
pie.title = "الموظفون حسب الفئة"
pie.add_data(Reference(ws, min_col=CI("J"), min_row=22, max_row=24), titles_from_data=True)
pie.set_categories(Reference(ws, min_col=CI("I"), min_row=23, max_row=24))
pie.dataLabels = DataLabelList()
pie.dataLabels.showPercent = True
pie.dataLabels.showVal = pie.dataLabels.showCatName = pie.dataLabels.showSerName = pie.dataLabels.showLeaderLines = False
pie.height, pie.width = 6.2, 9.5
ws.add_chart(pie, "I25")

DR0 = 38
section(ws, f"B{DR0}", '="🏢 تحليل التكلفة حسب القسم حتى "&INDEX(L_MONTH,cfg_VAL_M)', f"B{DR0}:G{DR0}", NAVY2)
headers(ws, DR0 + 1, [("B", "القسم"), ("C", "عدد الموظفين"), ("D", "الرواتب الشهرية"), ("E", "المستحقات حتى تاريخه"),
                      ("F", "التكلفة الكاملة حتى تاريخه"), ("G", "النسبة من التكلفة")], NAVY2, 36)
ESR = R(S_ESUM)
for i in range(15):
    rr3 = DR0 + 2 + i
    put(ws, f"B{rr3}", f'=IF(INDEX(L_DEPT,{i+1})="","",INDEX(L_DEPT,{i+1}))', font(10, True), fill(CARD_BG), align(), BORDER)
    put(ws, f"C{rr3}", f'=IF(B{rr3}="","",COUNTIFS({ACT},{EM}$F${E0}:$F${E1},B{rr3}))', font(10), fill(CARD_BG), align("center"), BORDER, INT)
    put(ws, f"D{rr3}", f'=IF(B{rr3}="","",SUMIFS({EM}$P${E0}:$P${E1},{ACT},{EM}$F${E0}:$F${E1},B{rr3}))', font(10), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"E{rr3}", f'=IF(B{rr3}="","",SUMIF({ESR}$D${E0}:$D${E1},B{rr3},{ESR}$R${E0}:$R${E1}))', font(10), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"F{rr3}", f'=IF(B{rr3}="","",SUMIF({ESR}$D${E0}:$D${E1},B{rr3},{ESR}$AF${E0}:$AF${E1}))', font(10, True), fill(CARD_BG), align("center"), BORDER, ACC0)
    put(ws, f"G{rr3}", f'=IF(B{rr3}="","",IFERROR(F{rr3}/SUM($F${DR0+2}:$F${DR0+16}),0))', font(10), fill(CARD_BG), align("center"), BORDER, PCT)
DT = DR0 + 17
put(ws, f"B{DT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), BORDER)
for c, fmt in (("C", INT), ("D", ACC0), ("E", ACC0), ("F", ACC0), ("G", PCT)):
    put(ws, f"{c}{DT}", f"=SUM({c}{DR0+2}:{c}{DR0+16})", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), BORDER, fmt)
put(ws, f"B{DT+1}", '=IF(ROUND(F' + str(DT) + f'-{MSR}U19,0)=0,"✔ مطابق للملخص الشهري","⚠ يوجد موظفون بدون قسم أو قسم غير مدرج")',
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

TR = DT + 3
section(ws, f"B{TR}", "📈 الاتجاه الشهري لمكونات تكلفة العمالة (12 شهراً)", f"B{TR}:N{TR}", PURPLE)
headers(ws, TR + 1, [("B", "الشهر"), ("C", "صافي الرواتب"), ("D", "التأمينات (موظف + منشأة)"),
                     ("E", "سلف وخصومات"), ("F", "المخصصات"), ("G", "إقامات ورخص وتأمين طبي"), ("H", "إجمالي التكلفة")],
        PURPLE, 44)
for i in range(12):
    rr4, sr = TR + 2 + i, 6 + i
    vals = [f"={MSR}B{sr}", f"={MSR}N{sr}", f"={MSR}L{sr}+{MSR}O{sr}", f"={MSR}M{sr}",
            f"={MSR}P{sr}+{MSR}Q{sr}+{MSR}R{sr}", f"={MSR}S{sr}+{MSR}T{sr}", f"=SUM(C{rr4}:G{rr4})"]
    for c, v in zip("BCDEFGH", vals):
        put(ws, f"{c}{rr4}", v, font(10, c in "BH"), fill(ALT if i % 2 else CARD_BG), align("center"), BORDER,
            None if c == "B" else ACC0)
ws.conditional_formatting.add(f"B{TR+2}:H{TR+13}", FormulaRule(formula=[f"ROW()-{TR+1}=cfg_VAL_M"], fill=fill("FFF3CD")))
TT = TR + 14
put(ws, f"B{TT}", "إجمالي السنة", font(10, True, "FFFFFF"), fill(PURPLE), align("center"), BORDER)
for c in "CDEFGH":
    put(ws, f"{c}{TT}", f"=SUM({c}{TR+2}:{c}{TR+13})", font(10, True, "FFFFFF"), fill(PURPLE), align("center"), BORDER, ACC0)
put(ws, f"B{TT+1}", f'=IF(ROUND(H{TT}-{MSR}U18,0)=0,"✔ مطابق لإجمالي تكلفة العمالة في الملخص الشهري","✖ غير مطابق")',
    font(9, True), None, align(), merge=f"B{TT+1}:H{TT+1}")
status_cf(ws, f"B{TT+1}", f"B{TT+1}")
col = BarChart()
col.type, col.grouping, col.overlap = "col", "stacked", 100
col.title = "مكونات تكلفة العمالة شهرياً"
col.y_axis.numFmt = "#,##0"
col.add_data(Reference(ws, min_col=3, max_col=7, min_row=TR + 1, max_row=TR + 13), titles_from_data=True)
col.set_categories(Reference(ws, min_col=2, min_row=TR + 2, max_row=TR + 13))
for s_, clr in zip(col.series, [GREEN, RED, "F6AD55", GOLD, BROWN]):
    s_.graphicalProperties.solidFill = clr
col.height, col.width = 8.5, 14
ws.add_chart(col, f"J{TR+1}")
note(ws, f"B{TT+3}", "كل الأرقام في هذه اللوحة معادلات مرتبطة بالأوراق الأخرى — لا تُدخل فيها أي بيانات. غيّر «شهر التقرير» من الإعدادات لتتحدث اللوحة والمخصصات والقيود. "
     "الصف المظلل في جدول الاتجاه = شهر التقرير.", f"B{TT+3}:N{TT+3}", 26)

# ================================================================ الرئيسية
ws = ws_home
setup(ws, {"A": 2, "B": 5, "C": 30, "D": 64, "E": 3, "F": 22, "G": 22}, NAVY)
banner(ws, "B", "G", "🏢 نظام الرواتب والمخصصات المتكامل")
put(ws, "B3", "مسير 12 شهراً • سجل الإجازات والإيقاف بالتواريخ • الإقامات ورخص العمل • نهاية الخدمة • الإجازات • التذاكر • التأمينات • القيود • القسيمة • لوحة التحكم",
    font(10, True, TEAL), None, align("center", wrap=True), merge="B3:G3")
ws.row_dimensions[3].height = 30
section(ws, "B5", "🧭 خطوات العمل", "B5:D5", NAVY)
STEPS = [
    ("1", S_SET, "مرة واحدة: اسم المنشأة والسنة وشهر التقرير، النسب النظامية، رسوم الإقامة ورخصة العمل، وأنواع الإجازات."),
    ("2", S_EMP, "سجّل الموظفين: الرواتب والبدلات، الإقامة ورخصة العمل وتكلفتها، التأمين الطبي، التذاكر، والأرصدة الافتتاحية."),
    ("3", S_REG, "عند أي إجازة أو إيقاف: سجّل النوع ومن/إلى — المسير يخصم الأيام تلقائياً ولا حاجة لحذف الموظف."),
    ("4", S_MOV, "كل شهر: الغياب والإضافي والمكافآت والسلف والجزاءات والتذاكر ومستحقات نهاية الخدمة."),
    ("5", MSHEETS[0], "راجع مسير الشهر (12 ورقة جاهزة) — عمود «الوضع خلال الشهر» يوضح حالة كل موظف."),
    ("6", S_GOV, "تابع انتهاء الإقامات ورخص العمل وتكلفتها وتجديداتها المتوقعة."),
    ("7", S_EOS, "المخصصات كما في شهر التقرير: نهاية الخدمة ← الإجازات ← التذاكر مع الفحوصات."),
    ("8", S_JE, "انسخ القيود الشهرية المتوازنة إلى نظامك المحاسبي."),
    ("9", S_SLIP, "اطبع قسيمة راتب أي موظف لأي شهر."),
    ("10", S_DASH, "تابع المؤشرات والتنبيهات والرسوم البيانية."),
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
section(ws, "B18", "🎨 دليل الألوان والرموز", "B18:D18", NAVY)
for i, (smp, fnt, fl, desc) in enumerate([
        ("123", INPUT_FONT, INPUT, "خلية إدخال — اكتب فيها (خط أزرق على خلفية صفراء)."),
        ("ƒx معادلة", "1F2933", FORMULA_BG, "خلية معادلة — لا تعدّلها؛ تتحدث تلقائياً."),
        ("✔ سليم", GREEN, GREEN_L, "فحص ناجح / على رأس العمل."),
        ("✈ إجازة", BLUE, "E3F2FD", "في إجازة أو إيقاف (من سجل الإجازات)."),
        ("⚠ تنبيه", GOLD, "FFF3CD", "يحتاج مراجعة."),
        ("✖ خطأ", RED, RED_L, "خطأ يجب تصحيحه / منتهي.")]):
    rr = 19 + i
    put(ws, f"C{rr}", smp, font(10, True, fnt), fill(fl), align("center"), BORDER)
    put(ws, f"D{rr}", desc, font(10), fill(CARD_BG), align(), BORDER)
section(ws, "B26", "🔗 خريطة الترابط", "B26:G26", TEAL)
put(ws, "B27", "الإعدادات ➜ الموظفون + سجل الإجازات والحالات + الحركات الشهرية ➜ مسيرات 12 شهراً ➜ الملخص الشهري + ملخص الموظفين + الإقامات ورخص العمل ➜ "
    "المخصصات (نهاية الخدمة / الإجازات / التذاكر) ➜ القيود المحاسبية ➜ قسيمة الراتب + لوحة التحكم",
    font(11, True, NAVY), fill(TEAL_L), align("center", wrap=True), merge="B27:G27")
ws.row_dimensions[27].height = 48
section(ws, "B29", "❓ أمثلة سريعة", "B29:G29", GREEN)
EX = [("موظف سافر إجازة بدون راتب شهرين", "سجل الإجازات: النوع «إجازة بدون راتب» + من/إلى ← يُخصم من المسيرين تلقائياً، ولا تُحتسب المدة في الخدمة ولا تُكتسب عنها إجازة أو تذكرة."),
      ("موظف صُرف راتب إجازته قبل السفر", "النوع «إجازة سنوية (راتب مقدم قبل السفر)» ← يُصرف المبلغ في شهر البداية، ولا راتب عن أيام الإجازة في المسيرات، ويُخصم الرصيد."),
      ("موظف موقوف أو متغيب (بلاغ)", "النوع «إيقاف عن العمل» أو «انقطاع عن العمل» ← يتوقف الراتب في الأيام المحددة؛ ويظهر «⛔ بدون راتب» في المسير."),
      ("إجازة مرضية بنسبة خاصة", "اختر النوع المرضي، أو اكتب النسبة في عمود «نسبة أجر مخصصة» (مثلاً 50%)."),
      ("موظف ترك العمل نهائياً", "ورقة الموظفين: تاريخ انتهاء الخدمة + السبب ← يتوقف كل شيء بعده، وتُحسب المكافأة والتسوية.")]
for i, (q, a) in enumerate(EX):
    rr = 30 + i
    put(ws, f"B{rr}", q, font(10, True, NAVY), fill(ALT), align(wrap=True), BORDER, merge=f"B{rr}:C{rr}")
    put(ws, f"D{rr}", a, font(10), fill(CARD_BG), align(wrap=True), BORDER, merge=f"D{rr}:G{rr}")
    ws.row_dimensions[rr].height = 34
note(ws, "B36", "البيانات الحالية (12 موظفاً وإجازاتهم وحركاتهم) أمثلة توضيحية لإظهار طريقة العمل — امسح خلايا الإدخال الصفراء في «الموظفون» و«سجل الإجازات» و«الحركات الشهرية» وأدخل بياناتك. "
     "يستوعب الملف 100 موظف و500 إجازة و1,000 حركة. الأحكام مبنية على نظام العمل السعودي (المواد 84، 85، 98، 107، 109، 113، 116، 117) ونظام التأمينات الاجتماعية، وجميع النسب والرسوم قابلة للتعديل من الإعدادات.",
     "B36:G36", 50)



# ================================================================ النسخة المجانية (عرض فقط)
def apply_demo(wb):
    """يحوّل الملف إلى نسخة عرض: نتائج بدون معادلات + خلايا مقفلة + إعلان النسخة الكاملة."""
    from openpyxl import load_workbook
    from openpyxl.cell.cell import MergedCell
    from openpyxl.styles import Protection
    from openpyxl.workbook.protection import WorkbookProtection

    if not os.path.exists(FULL_OUT):
        sys.exit(f"أنشئ النسخة الكاملة وأعد احتسابها أولاً: {FULL_OUT}")
    cached = load_workbook(FULL_OUT, data_only=True)

    # 1) إخفاء المعادلات من شريط الصيغة + قفل كل الخلايا، وفتح خانات التجربة فقط
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if not isinstance(c, MergedCell) and isinstance(c.value, str) and c.value.startswith("="):
                    c.protection = Protection(locked=True, hidden=True)
    LOCKED_FILL, LOCKED_FONT = fill("ECEFF1"), font(10, False, "90A4AE")

    def open_cells(ws, cols, r0, r1, trial_rows, max_row):
        for r in range(r0, max_row + 1):
            for col in cols:
                c = ws[f"{col}{r}"]
                if r < r0 + trial_rows:
                    c.protection = Protection(locked=False)
                else:
                    c.fill, c.font = LOCKED_FILL, LOCKED_FONT

    emp_in = [EC[k] for k, _, _, kd, _ in EMP_COLS if kd == "in"]
    open_cells(ws_emp, emp_in, E0, E1, TRIAL_EMP, E1)
    open_cells(ws_reg, [c for c, _, _, kd, _ in REG_COLS if kd == "in"], G0, G1, TRIAL_REG, G1)
    open_cells(ws_mov, [c for c, _, _, kd, _ in MOV_COLS if kd == "in"], M0, M1, TRIAL_MOV, M1)
    ws_set["C9"].protection = Protection(locked=False)
    for ws, ref, txt in ((ws_emp, "A4", f"🧪 خانات التجربة: أول {TRIAL_EMP} موظفين (الخلايا الصفراء) — باقي الصفوف مقفلة في النسخة المجانية"),
                         (ws_reg, "A4", f"🧪 خانات التجربة: أول {TRIAL_REG} سجلات — للمزيد اشترِ النسخة الكاملة"),
                         (ws_mov, "A4", f"🧪 خانات التجربة: أول {TRIAL_MOV} حركة — للمزيد اشترِ النسخة الكاملة")):
        put(ws, ref, txt, font(10, True, "E65100"), fill("FFF3E0"), align(), merge=f"A4:G4")
        ws.row_dimensions[4].height = 20
    # الإعدادات: كل القيم مقفلة ما عدا شهر التقرير
    for r in range(6, 50):
        c = ws_set[f"C{r}"]
        if r != 9 and c.fill is not None and c.fill.start_color.rgb in ("00" + INPUT, "FF" + INPUT, INPUT):
            c.fill, c.font = LOCKED_FILL, font(11, True, "90A4AE")
    put(ws_set, "E9", "🧪", font(12), None, align("center"))

    # 2) إخفاء الأعمدة المساعدة التي تكشف منطق الاحتساب
    for ws in ws_months:
        for c in ["AH", "AI", "AJ", "AK", "AL", "AM", "AN"]:
            ws.column_dimensions[c].hidden = True
    for c in ["R", "S", "T", "U"] + REG_A + REG_B + REG_C:
        ws_reg.column_dimensions[c].hidden = True

    # 3) شريط الإعلان في رأس كل ورقة + ترويسة الطباعة
    promo = "🛒 نسخة تجريبية — للنسخة الكاملة اضغط هنا ← accopro.net"
    for ws in wb.worksheets:
        for mr in ws.merged_cells.ranges:
            if mr.min_row == 1 and mr.max_row == 1:
                a = ws.cell(1, mr.min_col)
                v = str(a.value or "")
                a.value = v + '&"   🔒 نسخة تجريبية"' if v.startswith("=") else v + "   🔒 نسخة تجريبية"
            if mr.min_row == 2 and mr.max_row == 2:
                a = ws.cell(2, mr.min_col)
                v = str(a.value or "")
                a.value = f'="{promo}   |   "&' + v[1:] if v.startswith("=") else promo
                a.font = font(11, True, "FFD54F")
                a.hyperlink = BUY_URL
        ws.oddHeader.center.text = "نسخة تجريبية — النسخة الكاملة: accopro.net"
        ws.oddFooter.center.text = "AccoPro — https://accopro.net"

    def buy_button(ws, ref, text, merge=None, size=11):
        c = put(ws, ref, text, font(size, True, "FFFFFF"), fill("E65100"), align("center", wrap=True),
                Border(bottom=Side("medium", "BF360C")), merge=merge)
        c.hyperlink = BUY_URL
        return c

    buy_button(ws_home, "B3", "🛒 نسخة تجريبية كاملة الوظائف بخانات محدودة — اشترِ النسخة الكاملة من accopro.net (اضغط هنا)", "B3:G3")
    ws_dash["M3"].hyperlink = None
    buy_button(ws_dash, "M3", "🛒 اشترِ الكاملة")

    # 4) ورقة «النسخة الكاملة»
    ws = wb.create_sheet("🛒 النسخة الكاملة", 1)
    setup(ws, {"A": 2, "B": 46, "C": 24, "D": 24, "E": 2}, "E65100")
    put(ws, "B1", "🛒 احصل على النسخة الكاملة من نظام الرواتب والمخصصات", font(18, True, "FFFFFF"), fill(NAVY),
        align("center"), merge="B1:D1")
    ws.row_dimensions[1].height = 40
    put(ws, "B2", f"النسخة التجريبية تعمل بكامل المعادلات والتقارير، لكن الخلايا مقفلة ما عدا خانات التجربة: {TRIAL_EMP} موظفين، {TRIAL_REG} إجازات، {TRIAL_MOV} حركة، وشهر التقرير.",
        font(10, False, "FFFFFF", True), fill(NAVY2), align("center", wrap=True), merge="B2:D2")
    ws.row_dimensions[2].height = 30
    buy_button(ws, "B4", "🛒 اضغط هنا لشراء النسخة الكاملة ← https://accopro.net/", "B4:D5", 16)
    ws.row_dimensions[4].height = 30
    ws.row_dimensions[5].height = 30
    headers(ws, 7, [("B", "الميزة"), ("C", "النسخة المجانية"), ("D", "النسخة الكاملة")], NAVY, 28)
    FEATS = [
        ("مسير رواتب 12 شهراً بكل المعادلات", "✔ يعمل", "✔ يعمل"),
        ("عدد الموظفين القابل للإدخال والتعديل", f"🧪 {TRIAL_EMP} موظفين", "✔ حتى 100 موظف"),
        ("سجل الإجازات والإيقاف ووقف الراتب بالتواريخ", f"🧪 {TRIAL_REG} سجلات", "✔ حتى 500 سجل"),
        ("الحركات الشهرية (غياب، إضافي، سلف، مكافآت...)", f"🧪 {TRIAL_MOV} حركة", "✔ حتى 1,000 حركة"),
        ("الإقامات ورخص العمل وتكلفتها وتنبيهات الانتهاء", "✔ يعمل", "✔ يعمل"),
        ("مخصصات نهاية الخدمة والإجازات والتذاكر", "✔ يعمل", "✔ يعمل"),
        ("القيود المحاسبية الشهرية ولوحة التحكم", "✔ يعمل", "✔ يعمل"),
        ("قسيمة الراتب لأي موظف وأي شهر", "✔ يعمل", "✔ يعمل"),
        ("تغيير شهر التقرير", "✔ متاح", "✔ متاح"),
        ("تعديل اسم المنشأة والسنة والنسب والرسوم وأنواع الإجازات", "✖ مقفل", "✔"),
        ("رؤية المعادلات وتعديلها وتخصيص الملف", "✖ مخفية ومقفلة", "✔ مفتوحة بالكامل"),
        ("إضافة أوراق أو أعمدة أو صفوف", "✖ مقفل", "✔"),
        ("الدعم الفني والتحديثات", "✖", "✔"),
    ]
    for i, (f_, a_, b_) in enumerate(FEATS):
        a_ = a_
        r = 8 + i
        put(ws, f"B{r}", f_, font(10, True), fill(ALT if i % 2 else CARD_BG), align(wrap=True), BORDER)
        put(ws, f"C{r}", a_, font(10, True, RED if "✖" in a_ else GREY_TXT), fill(RED_L if "✖" in a_ else CARD_BG),
            align("center"), BORDER)
        put(ws, f"D{r}", b_, font(10, True, GREEN), fill(GREEN_L), align("center"), BORDER)
        ws.row_dimensions[r].height = 24
    r = 8 + len(FEATS) + 1
    buy_button(ws, f"B{r}", "🛒 اشترِ الآن من accopro.net", f"B{r}:D{r+1}", 14)
    button(ws, f"B{r+3}", "🏠 العودة إلى الرئيسية", S_HOME, NAVY, merge=f"B{r+3}:D{r+3}")
    ws.sheet_view.showGridLines = False

    # 5) قفل كل الأوراق — المفتوح فقط: اختيار الشهر والموظف في قسيمة الراتب
    for c in ("C5", "F5"):
        ws_slip[c].protection = Protection(locked=False)
    for ws in wb.worksheets:
        p = ws.protection
        p.sheet = True
        p.password = DEMO_PASSWORD
        p.selectLockedCells = False      # يسمح بالتنقل والضغط على الأزرار
        p.selectUnlockedCells = False
        p.formatCells = p.formatColumns = p.formatRows = True
        p.insertColumns = p.insertRows = p.insertHyperlinks = True
        p.deleteColumns = p.deleteRows = p.sort = p.autoFilter = p.pivotTables = p.objects = p.scenarios = True
    wb.security = WorkbookProtection(workbookPassword=DEMO_PASSWORD, lockStructure=True)
    wb.properties.title = "نظام الرواتب والمخصصات — نسخة تجريبية"
    wb.properties.creator = "AccoPro — accopro.net"


def finalize_demo(path=DEMO_OUT):
    """بعد إعادة الاحتساب بـ LibreOffice: إعادة قفل هيكل المصنف (LibreOffice يُسقطه عند الحفظ)."""
    import re
    import shutil
    import zipfile
    from openpyxl.utils.protection import hash_password
    tag = f'<workbookProtection workbookPassword="{hash_password(DEMO_PASSWORD)}" lockStructure="1"/>'
    tmp = path + ".tmp"
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "xl/workbook.xml":
                xml = re.sub(r"<workbookProtection[^>]*/>", "", data.decode("utf-8"))
                xml = xml.replace("<bookViews>", tag + "<bookViews>", 1)
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, path)
    print("structure locked:", path)


if DEMO:
    apply_demo(wb)

if "--finalize-demo" in sys.argv:
    finalize_demo()
    sys.exit(0)

wb.active = 0
for s in wb.worksheets:
    s.sheet_view.tabSelected = s.title == S_HOME
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print("saved", OUT)
