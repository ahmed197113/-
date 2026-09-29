# -*- coding: utf-8 -*-
"""
مولّد ملف أوامر الدفع (سند صرف نقدي / شيك / تحويل بنكي) — الإصدار 2 (ماكرو)
ينتج: Cash_Payment_Voucher.xlsm

الفكرة: إدخال واحد فقط.
  - تكتب مباشرة على شكل السند في ورقة «سند الصرف» ثم تضغط «حفظ + سند جديد».
  - الماكرو يحفظ السند في «سجل السندات» و«بنود السندات» ويجهّز سنداً جديداً برقم تلقائي.
  - أي سند محفوظ يُستدعى بالرقم أو بالسابق/التالي أو بالنقر المزدوج في السجل، ويُعدّل ويُطبع ويُصدَّر PDF.
  - الطرف الدائن (الصندوق/البنك) يُحسب تلقائياً = إجمالي المدين، فلا تكتب المبلغ مرتين.

التشغيل:
  python build_payment_voucher.py           # يبني + يعيد الحساب (LibreOffice) + يحقن الماكرو
"""
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment

from vba_project import build_vba_project, document_module, standard_module

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "Cash_Payment_Voucher.xlsm")

# ---------------------------------------------------------------- الألوان والتنسيقات
FONT = "Arial"
NAVY, NAVY2 = "1F3A5F", "2C5282"
TEAL, TEAL_L = "2E7D7A", "DCEFEE"
GOLD, GOLD_L = "9A6B00", "FBF3E0"
LINE = "C9D3DD"
INPUT = "FFF8E1"
INPUT_FONT = "1A4FA0"
GREEN, GREEN_L = "2E7D32", "E8F5E9"
RED, RED_L = "C62828", "FDECEA"
GREY_TXT = "5A6772"
ALT = "F5F8FB"
FORMULA_BG = "F2F4F7"
PURPLE = "6A1B9A"

ACC = '#,##0.00;[Red](#,##0.00);"-"'
DATE = "dd/mm/yyyy"
HIJRI = 'B2dd/mm/yyyy"هـ"'

S_FORM = "سند الصرف"
S_REG = "سجل السندات"
S_LNS = "بنود السندات"
S_SUM = "التقارير"
S_SET = "الإعدادات"
S_TAF = "تفقيط"
S_SYS = "النظام"

CODE = {S_FORM: "shForm", S_REG: "shReg", S_LNS: "shLns", S_SUM: "shSum",
        S_SET: "shSet", S_TAF: "shTaf", S_SYS: "shSys"}

DATA0 = 5                 # أول صف بيانات في السجل والبنود
REG_MAX = 20000           # مدى المعادلات على السجل
REG_COLS = 16
LNS_COLS = 9
STYLE_ROWS_REG = 2000     # صفوف مجهزة بالتنسيق الشرطي
STYLE_ROWS_LNS = 6000

LN0, LNN = 20, 10         # بنود السند على النموذج: الصفوف 20..29
AUTO_R = LN0 + LNN        # 30 — سطر الطرف الدائن التلقائي
TOT_R = AUTO_R + 1        # 31


def Q(sheet):
    return f"'{sheet}'!"


thin = Side(style="thin", color=LINE)
dark = Side(style="thin", color="000000")
thick = Side(style="medium", color="000000")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
BOX = Border(left=dark, right=dark, top=dark, bottom=dark)
UNLOCK = Protection(locked=False)


def font(size=10, bold=False, color="1F2933", italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)


def fill(c):
    return PatternFill("solid", start_color=c, end_color=c)


def align(h="right", v="center", wrap=False, indent=0, shrink=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap, indent=indent,
                     shrink_to_fit=shrink, readingOrder=2)


def cells(ws, rng):
    c = ws[rng]
    if not isinstance(c, tuple):
        return ((c,),)
    if not isinstance(c[0], tuple):
        return (c,)
    return c


def style(ws, rng, f=None, fl=None, al=None, bd=None, fmt=None, prot=None):
    for row in cells(ws, rng):
        for c in row:
            if f: c.font = f
            if fl: c.fill = fl
            if al: c.alignment = al
            if bd: c.border = bd
            if fmt: c.number_format = fmt
            if prot: c.protection = prot


def put(ws, ref, value, f=None, fl=None, al=None, bd=None, fmt=None, merge=None, prot=None):
    if merge:
        ws.merge_cells(merge)
        style(ws, merge, f, fl, al, bd, fmt, prot)
    c = ws[ref]
    c.value = value
    style(ws, ref, f, fl, al, bd, fmt, prot)
    return c


def outline(ws, rng, side=dark):
    rows = cells(ws, rng)
    for i, row in enumerate(rows):
        for j, c in enumerate(row):
            b = c.border
            c.border = Border(top=side if i == 0 else b.top,
                              bottom=side if i == len(rows) - 1 else b.bottom,
                              right=side if j == 0 else b.right,
                              left=side if j == len(row) - 1 else b.left)


def setup(ws, widths, tab, landscape=False):
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 90
    ws.sheet_properties.tabColor = tab
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def banner(ws, first, last, title, sub):
    put(ws, f"{first}1", title, font(16, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"{first}1:{last}1")
    put(ws, f"{first}2", sub, font(10, False, "FFFFFF", True), fill(NAVY2), align("center"), merge=f"{first}2:{last}2")
    ws.row_dimensions[1].height = 34
    ws.row_dimensions[2].height = 20


def link(ws, ref, text, sheet, cell="A1", color=TEAL, merge=None):
    c = put(ws, ref, text, font(10, True, "FFFFFF"), fill(color), align("center"),
            Border(bottom=Side("medium", NAVY)), merge=merge)
    c.hyperlink = Hyperlink(ref=ref, location=f"'{sheet}'!{cell}", display=text)
    return c


def headers(ws, row, cols_titles, color=NAVY, h=32):
    for col, t in cols_titles:
        put(ws, f"{col}{row}", t, font(10, True, "FFFFFF"), fill(color), align("center", wrap=True), BORDER)
    ws.row_dimensions[row].height = h


def add_name(wb, name, ref):
    wb.defined_names[name] = DefinedName(name, attr_text=ref)


def dv_list(ws, src, rng, msg=None, strict=True):
    dv = DataValidation(type="list", formula1=src if src.startswith('"') else f"={src}", allow_blank=True,
                        showErrorMessage=True, errorStyle="stop" if strict else "warning")
    dv.errorTitle = "قيمة غير موجودة في القائمة"
    dv.error = "اختر من القائمة المنسدلة (أو أضف القيمة في ورقة الإعدادات)."
    if msg:
        dv.promptTitle, dv.prompt, dv.showInputMessage = "تلميح", msg, True
    ws.add_data_validation(dv)
    dv.add(rng)


# ================================================================ التفقيط (أرقام → كلمات)
ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
        "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر",
        "ثمانية عشر", "تسعة عشر"]
TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]
HUNDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"]


def words(n):
    if n == 0:
        return ""
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(HUNDS[h])
    if r:
        if r < 20:
            parts.append(ONES[r])
        else:
            t, o = divmod(r, 10)
            parts.append(f"{ONES[o]} و{TENS[t]}" if o else TENS[t])
    return " و".join(parts)


def scaled(n, one, two, plural, acc):
    if n == 0:
        return ""
    if n == 1:
        return one
    if n == 2:
        return two
    r = n % 100
    if 3 <= r <= 10:
        return f"{words(n)} {plural}"
    if r >= 11:
        return f"{words(n)} {acc}"
    return f"{words(n)} {one}"


def halala(n):
    return {0: "", 1: "هللة واحدة", 2: "هللتان"}.get(n, scaled(n, "هللة", "هللتان", "هللات", "هللة"))


def tafqeet_py(x, cur="ريال سعودي"):
    """نفس منطق معادلة التفقيط — لبيانات المثال المحفوظة في السجل."""
    a = round(x, 2)
    r = int(a)
    m, t, u, h = r // 10**6, (r % 10**6) // 1000, r % 1000, round((a - r) * 100)
    body = "صفر" if r == 0 else (("" if not m else " و" + scaled(m, "مليون", "مليونان", "ملايين", "مليوناً"))
                                 + ("" if not t else " و" + scaled(t, "ألف", "ألفان", "آلاف", "ألفاً"))
                                 + ("" if not u else " و" + words(u)))[2:]
    return f"فقط {body} {cur}" + (f" و{halala(h)}" if h else "") + " لا غير"


TAF = lambda col: f"{Q(S_TAF)}${col}$2:${col}$1001"


def tafqeet(x, cur):
    a = f"ROUND({x},2)"
    r = f"INT({a})"
    m = f"INT({r}/1000000)"
    t = f"INT(MOD({r},1000000)/1000)"
    u = f"MOD({r},1000)"
    h = f"ROUND(({a}-{r})*100,0)"
    body = (f'IF({r}=0,"صفر",MID(IF({m}>0," و"&INDEX({TAF("D")},{m}+1),"")'
            f'&IF({t}>0," و"&INDEX({TAF("C")},{t}+1),"")'
            f'&IF({u}>0," و"&INDEX({TAF("B")},{u}+1),""),3,400))')
    return f'"فقط "&{body}&" "&{cur}&IF({h}>0," و"&INDEX({TAF("E")},{h}+1),"")&" لا غير"'


# ================================================================ المصنف
wb = Workbook()
wb.code_name = "ThisWorkbook"
ws_f = wb.active
ws_f.title = S_FORM
ws_r = wb.create_sheet(S_REG)
ws_l = wb.create_sheet(S_LNS)
ws_s = wb.create_sheet(S_SUM)
ws_c = wb.create_sheet(S_SET)
ws_t = wb.create_sheet(S_TAF)
ws_y = wb.create_sheet(S_SYS)
for ws in wb.worksheets:
    ws.sheet_properties.codeName = CODE[ws.title]

RV = lambda col: f"{Q(S_REG)}${col}${DATA0}:${col}${REG_MAX}"
LV = lambda col: f"{Q(S_LNS)}${col}${DATA0}:${col}${REG_MAX * 3}"

# ---------------------------------------------------------------- ورقة التفقيط (مخفية)
ws_t.sheet_view.rightToLeft = True
for i, t in enumerate(["الرقم", "آحاد", "آلاف", "ملايين", "هللات"], 1):
    ws_t.cell(1, i, t).font = font(10, True)
for n in range(1000):
    ws_t.cell(n + 2, 1, n)
    ws_t.cell(n + 2, 2, words(n))
    ws_t.cell(n + 2, 3, scaled(n, "ألف", "ألفان", "آلاف", "ألفاً"))
    ws_t.cell(n + 2, 4, scaled(n, "مليون", "مليونان", "ملايين", "مليوناً"))
    ws_t.cell(n + 2, 5, halala(n))
for col, w in {"A": 8, "B": 40, "C": 40, "D": 40, "E": 30}.items():
    ws_t.column_dimensions[col].width = w
ws_t.sheet_state = "hidden"

# ---------------------------------------------------------------- ورقة النظام (مخفية): رسائل الماكرو
MSGS = [
    ("MSG_TITLE", "أوامر الدفع"),
    ("MSG_NEW", "🆕 سند جديد جاهز — املأ البيانات ثم اضغط «حفظ + سند جديد».  الرقم: "),
    ("MSG_SAVED", "✔ تم حفظ السند "),
    ("MSG_READY_NEW", "—  وجاهز لسند جديد رقم "),
    ("MSG_NEED_PAYEE", "✘ اكتب اسم المستفيد في خانة «ادفعوا لأمر»"),
    ("MSG_NEED_DATE", "✘ اكتب تاريخ السند بشكل صحيح (يوم/شهر/سنة)"),
    ("MSG_NEED_AMOUNT", "✘ أدخل مبلغاً واحداً على الأقل في خانة «مدين» بجدول البنود"),
    ("MSG_NEED_FROM", "✘ اختر الحساب الذي يُصرف منه (خانة «يُصرف من»)"),
    ("MSG_UNBAL", "✘ السند غير متوازن: الدائن اليدوي أكبر من المدين — راجع المبالغ"),
    ("MSG_LINE_BOTH", "✘ بند فيه مدين ودائن معاً — اكتب واحداً فقط. السطر رقم "),
    ("MSG_LINE_DESC", "✘ اكتب البيان/الحساب للبند. السطر رقم "),
    ("MSG_LINE_NUM", "✘ مبلغ غير صحيح (يجب أن يكون رقماً موجباً). السطر رقم "),
    ("MSG_DUP_CHQ", "تنبيه: رقم الشيك/الحوالة مستخدم من قبل في السند "),
    ("MSG_CONTINUE", "هل تريد المتابعة والحفظ؟"),
    ("MSG_CONFIRM_EDIT", "سيتم تعديل السند المحفوظ واستبدال بياناته القديمة. متابعة؟\n"),
    ("MSG_NOTFOUND", "✘ لا يوجد سند محفوظ بهذا الرقم"),
    ("MSG_LOADED", "📂 تم فتح السند "),
    ("MSG_NO_PREV", "لا يوجد سند سابق"),
    ("MSG_NO_NEXT", "لا يوجد سند تالٍ — اضغط «سند جديد» لإنشاء سند"),
    ("MSG_NOT_SAVED", "✘ هذا السند لم يُحفظ بعد — لا يوجد ما يُحذف"),
    ("MSG_CONFIRM_DEL", "هل تريد حذف السند نهائياً من السجل؟\n"),
    ("MSG_DELETED", "🗑 تم حذف السند "),
    ("MSG_PDF", "📄 تم الحفظ وإنشاء ملف PDF: "),
    ("MSG_PRINTED", "🖨 تم الحفظ والإرسال للطابعة — السند "),
    ("MSG_DUP", "📋 تم نسخ البيانات كسند جديد (بتاريخ اليوم) — عدّل ثم احفظ. الرقم: "),
    ("MSG_ERR", "✘ خطأ غير متوقع في "),
    ("TXT_MANUAL", "يدوي"),
    ("TXT_AUTO", "تلقائي"),
]
MSG_ROW = {}
ws_y.sheet_view.rightToLeft = True
ws_y["A1"], ws_y["B1"] = "الماكرو مفعّل؟", 0
ws_y["C1"] = "(يصبح 1 تلقائياً عند فتح الملف مع تفعيل الماكرو)"
for i, (k, v) in enumerate(MSGS):
    r = 3 + i
    MSG_ROW[k] = r
    ws_y[f"A{r}"], ws_y[f"B{r}"] = k, v
ws_y.column_dimensions["A"].width = 20
ws_y.column_dimensions["B"].width = 80
ws_y.sheet_state = "hidden"

# ---------------------------------------------------------------- الإعدادات
setup(ws_c, {"A": 2, "B": 28, "C": 42, "D": 3, "E": 24, "F": 3, "G": 32, "H": 3, "I": 22}, GOLD)
banner(ws_c, "B", "I", "⚙ الإعدادات وبيانات الشركة",
       "الخلايا الصفراء فقط للتعديل — أي تغيير هنا ينعكس تلقائياً على كل السندات والطباعة")
SETTINGS = [
    ("اسم الشركة (عربي)", "شركة الخطوط المعدنية للمقاولات العامة", "CO_AR"),
    ("اسم الشركة (إنجليزي)", "Metal Lines General Contracting Co.", "CO_EN"),
    ("الإدارة", "الإدارة المالية", "DEPT"),
    ("المدينة", "مكة المكرمة", "CITY"),
    ("السجل التجاري", "4031000000", "CR"),
    ("الرقم الضريبي", "300000000000003", "VAT"),
    ("اسم العملة (للتفقيط)", "ريال سعودي", "CUR"),
    ("رمز العملة", "S.R", "CUR_EN"),
    ("بادئة رقم السند", "CP", "PREFIX"),
    ("رقم أول سند", 1001, "START_NO"),
    ("أمين الصندوق", "احمد عبدالعظيم", "CASHIER"),
    ("المحاسب", "", "ACCOUNTANT"),
    ("المدير العام", "حيدر شماع", "GM"),
    ("طريقة الدفع الافتراضية", "نقدي", "DEF_METHOD"),
    ("يُصرف من (افتراضي)", "الرياض 940", "DEF_FROM"),
    ("فرع الصرف الافتراضي", "مكة", "DEF_BRANCH"),
]
SET_ROW = {}
put(ws_c, "B4", "البند", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
put(ws_c, "C4", "القيمة", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
for i, (lbl, val, name) in enumerate(SETTINGS):
    r = 5 + i
    SET_ROW[name] = r
    put(ws_c, f"B{r}", lbl, font(10, True), fill(ALT), align("right", indent=1), BORDER)
    put(ws_c, f"C{r}", val, font(10, False, INPUT_FONT), fill(INPUT), align("right", indent=1), BORDER)
    add_name(wb, name, f"{Q(S_SET)}$C${r}")
ws_c[f"C{SET_ROW['START_NO']}"].number_format = "0"
ws_c[f"C{SET_ROW['START_NO']}"].comment = Comment("أول سند يأخذ هذا الرقم، وكل سند جديد = أكبر رقم محفوظ + 1", "النظام")

LISTS = {
    "E": ("الفروع", "BRANCHES", ["مكة", "الرياض", "جدة", "المدينة المنورة", "الدمام", "الطائف"]),
    "G": ("الحسابات / البيان", "ACCOUNTS",
          ["الرياض 940", "الصندوق الرئيسي", "البنك الأهلي", "مصرف الراجحي", "عهد وسلف موظفين",
           "ذمم موظفين", "مصروفات عمومية وإدارية", "رواتب وأجور", "مواد ومشتريات مشاريع", "مقاولو الباطن",
           "إيجارات", "صيانة معدات", "وقود ومحروقات", "ضريبة القيمة المضافة (مدخلات)", "جاري المالك"]),
    "I": ("طرق الدفع", "PAY_METHODS", ["نقدي", "شيك", "تحويل بنكي"]),
}
for col, (title, name, items) in LISTS.items():
    put(ws_c, f"{col}4", title, font(10, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
    n_rows = 60 if name != "PAY_METHODS" else 3
    for k in range(n_rows):
        v = items[k] if k < len(items) else None
        put(ws_c, f"{col}{5+k}", v, font(10, False, INPUT_FONT if name != "PAY_METHODS" else "1F2933"),
            fill(INPUT) if name != "PAY_METHODS" else fill(FORMULA_BG), align("right", indent=1), BORDER)
    add_name(wb, name, f"OFFSET({Q(S_SET)}${col}$5,0,0,MAX(1,COUNTA({Q(S_SET)}${col}$5:${col}${4+n_rows})),1)")
ws_c["I9"].value = "⚠ لا تغيّر أسماء طرق الدفع (يعتمد عليها عنوان السند)"
ws_c["I9"].font = font(8, False, RED, True)
ws_c["I9"].alignment = align("right", wrap=True)
dv_list(ws_c, "PAY_METHODS", f"C{SET_ROW['DEF_METHOD']}")
dv_list(ws_c, "ACCOUNTS", f"C{SET_ROW['DEF_FROM']}", strict=False)
dv_list(ws_c, "BRANCHES", f"C{SET_ROW['DEF_BRANCH']}")

guide = [
    ("طريقة الاستخدام — إدخال واحد فقط", None),
    ("1", "افتح الملف واضغط «تمكين المحتوى / Enable Content» مرة واحدة لتفعيل الأزرار. لو ظهرت رسالة حمراء «Microsoft has blocked macros» (ملف منزّل من الإنترنت): أغلق الملف ← كليك يمين عليه ← خصائص ← علّم «إلغاء الحظر / Unblock» ← موافق، ثم افتحه."),
    ("2", "في ورقة «سند الصرف» اكتب مباشرة على السند: التاريخ، ادفعوا لأمر، وذلك مقابل، والبنود (المدين)."),
    ("3", "الطرف الدائن (الصندوق/البنك) يُضاف تلقائياً بنفس المبلغ من خانة «يُصرف من» — لا تكتب المبلغ مرتين."),
    ("4", "اضغط «💾 حفظ + سند جديد»: يُحفظ السند في السجل ويظهر سند جديد فارغ برقم جديد. كرّر لأي عدد من السندات."),
    ("5", "لإعادة طباعة/تعديل سند قديم: اختر رقمه في «استدعاء سند» أو استخدم السابق/التالي أو انقر مرتين على صفه في السجل."),
    ("★", "«🖨 حفظ وطباعة» و«📄 حفظ PDF» يحفظان أولاً ثم يطبعان — ملفات PDF تُحفظ في مجلد Vouchers_PDF بجوار الملف."),
    ("★", "المبلغ كتابةً، التاريخ الهجري، عنوان السند حسب طريقة الدفع، والتوازن — كلها تلقائية."),
    ("★", "الخلايا الصفراء = إدخال • باقي الخلايا محمية حتى لا تُمسح المعادلات بالخطأ (إلغاء الحماية: مراجعة ← إلغاء حماية الورقة، بدون كلمة مرور)."),
    ("★", "السند يُطبع أبيض وأسود تلقائياً فلا تظهر ألوان خلايا الإدخال على الورق."),
]
for i, (a, b) in enumerate(guide):
    r = 24 + i
    if b is None:
        put(ws_c, f"B{r}", a, font(11, True, "FFFFFF"), fill(NAVY), align("right", indent=1), merge=f"B{r}:C{r}")
    else:
        put(ws_c, f"B{r}", a, font(11, True, TEAL), fill(TEAL_L), align("center"), BORDER)
        put(ws_c, f"C{r}", b, font(10), fill("FFFFFF"), align("right", wrap=True, indent=1), BORDER)
        ws_c.row_dimensions[r].height = 42

# ---------------------------------------------------------------- سجل السندات (يكتبه الماكرو)
REG_HDR = [("A", "رقم السند", 10), ("B", "المرجع", 16), ("C", "التاريخ", 12), ("D", "المستفيد", 24),
           ("E", "طريقة الدفع", 12), ("F", "رقم الشيك / الحوالة", 14), ("G", "وذلك مقابل", 30),
           ("H", "يُصرف من", 18), ("I", "فرع الصرف", 12), ("J", "ملاحظة", 24), ("K", "المستلم", 18),
           ("L", "المبلغ", 14), ("M", "المبلغ كتابةً", 55), ("N", "البنود", 7), ("O", "تاريخ الحفظ", 16),
           ("P", "بواسطة", 14)]
assert len(REG_HDR) == REG_COLS
setup(ws_r, {c: w for c, _, w in REG_HDR}, NAVY, landscape=True)
banner(ws_r, "A", "P", "🧾 سجل أوامر الدفع",
       "يُملأ تلقائياً عند الحفظ من ورقة «سند الصرف» — انقر مرتين على أي سند لفتحه وتعديله أو إعادة طباعته")
put(ws_r, "A3", f'="عدد السندات: "&COUNT(A{DATA0}:A{REG_MAX})&"   |   الإجمالي: "&TEXT(SUM(L{DATA0}:L{REG_MAX}),"#,##0.00")&" "&CUR_EN',
    font(10, True, NAVY), merge="A3:F3")
link(ws_r, "G3", "✍ سند الصرف", S_FORM, "C12", RED)
link(ws_r, "H3", "📊 التقارير", S_SUM, "A1", PURPLE)
headers(ws_r, 4, [(c, h) for c, h, _ in REG_HDR])
ws_r.freeze_panes = f"C{DATA0}"
ws_r.auto_filter.ref = f"A4:P{STYLE_ROWS_REG}"

# ---------------------------------------------------------------- بنود السندات (يكتبها الماكرو)
LNS_HDR = [("A", "رقم السند", 10), ("B", "م", 5), ("C", "الفرع", 14), ("D", "البيان / الحساب", 34),
           ("E", "مدين", 14), ("F", "دائن", 14), ("G", "التاريخ", 12), ("H", "المستفيد", 26), ("I", "نوع البند", 10)]
assert len(LNS_HDR) == LNS_COLS
setup(ws_l, {c: w for c, _, w in LNS_HDR}, TEAL, landscape=True)
banner(ws_l, "A", "I", "📋 بنود السندات (القيود)",
       "يُملأ تلقائياً عند الحفظ — «تلقائي» = الطرف الدائن المحسوب من «يُصرف من». انقر مرتين لفتح السند")
put(ws_l, "A3", f'="مدين: "&TEXT(SUM(E{DATA0}:E{REG_MAX*3}),"#,##0.00")&"   |   دائن: "&TEXT(SUM(F{DATA0}:F{REG_MAX*3}),"#,##0.00")',
    font(10, True, NAVY), merge="A3:D3")
link(ws_l, "E3", "✍ سند الصرف", S_FORM, "C12", RED)
link(ws_l, "F3", "🧾 السجل", S_REG, "A1", NAVY)
headers(ws_l, 4, [(c, h) for c, h, _ in LNS_HDR], TEAL)
ws_l.freeze_panes = f"B{DATA0}"
ws_l.auto_filter.ref = f"A4:I{STYLE_ROWS_LNS}"

for ws, last_col, nrows in ((ws_r, "P", STYLE_ROWS_REG), (ws_l, "I", STYLE_ROWS_LNS)):
    rng = f"A{DATA0}:{last_col}{nrows}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'AND($A{DATA0}<>"",MOD(ROW(),2)=0)'],
                                                   fill=fill(ALT), border=BORDER))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$A{DATA0}<>""'], border=BORDER))
    style(ws, rng, font(10), None, align("right"))
ws_l.conditional_formatting.add(f"I{DATA0}:I{STYLE_ROWS_LNS}",
                                FormulaRule(formula=[f'$I{DATA0}={Q(S_SYS)}$B${MSG_ROW["TXT_AUTO"]}'],
                                            font=Font(color=TEAL, italic=True)))
for c in "ACEINO":
    style(ws_r, f"{c}{DATA0}:{c}{STYLE_ROWS_REG}", al=align("center"))
for c in "ABCGI":
    style(ws_l, f"{c}{DATA0}:{c}{STYLE_ROWS_LNS}", al=align("center"))
style(ws_r, f"A{DATA0}:A{STYLE_ROWS_REG}", f=font(10, True, NAVY), al=align("center"))
style(ws_r, f"M{DATA0}:M{STYLE_ROWS_REG}", f=font(9, False, GREY_TXT))

add_name(wb, "V_NOS", f"OFFSET({Q(S_REG)}$A${DATA0},0,0,MAX(1,COUNT({RV('A')})),1)")

# ---------------------------------------------------------------- نموذج السند (الإدخال + الطباعة)
# RTL: العمود B على اليمين.  B:C مدين | D:E دائن | F:H البيان | I الفرع
setup(ws_f, {"A": 2, "B": 13, "C": 9, "D": 11, "E": 9, "F": 15, "G": 15, "H": 15, "I": 14, "J": 2,
             "K": 16, "L": 13, "M": 13, "N": 13}, RED)
ws_f.sheet_view.zoomScale = 100
ws_f.page_margins.left = ws_f.page_margins.right = 0.4
ws_f.page_margins.top = ws_f.page_margins.bottom = 0.4
ws_f.print_options.horizontalCentered = True
ws_f.page_setup.blackAndWhite = True   # طباعة نظيفة: بدون ألوان خلايا الإدخال
ws_f.column_dimensions["Z"].hidden = True

F = dict(DATE="C11", PAYEE="C12", WORDS="C13", BEING="C14", METHOD="C15", CHEQUE="F15",
         FROM="C16", FROMBR="G16", NOTE=f"F{TOT_R}", RECV="B35", REF="B6",
         LOADED="Z1", NEXT="Z2", CUR="Z3", TDR="Z5", TCRM="Z6", AUTO="Z7", TCR="Z8",
         LOADNO="L10", MSG="K16", COPYTYPE="L21", COPIES="L22")

# --- قيم مساعدة مخفية (Z)
ws_f["Z1"] = 1001                                            # السند المفتوح (فارغ = سند جديد)
ws_f["Z2"] = f"=MAX(START_NO-1,MAX({RV('A')}))+1"            # الرقم التالي
ws_f["Z3"] = '=IF(Z1="",Z2,Z1)'                               # الرقم المعروض
ws_f["Z5"] = f"=ROUND(SUM(B{LN0}:B{LN0+LNN-1}),2)"           # إجمالي المدين
ws_f["Z6"] = f"=ROUND(SUM(D{LN0}:D{LN0+LNN-1}),2)"           # الدائن اليدوي
ws_f["Z7"] = "=MAX(0,ROUND(Z5-Z6,2))"                         # الدائن التلقائي
ws_f["Z8"] = "=ROUND(Z6+Z7,2)"                                # إجمالي الدائن

# --- الرأس
put(ws_f, "B1", "=CO_AR", font(18, True, NAVY), None, align("center"), merge="B1:I1")
put(ws_f, "B2", "=CO_EN", font(10, True, GREY_TXT, True), None, align("center"), merge="B2:I2")
put(ws_f, "B3", '=DEPT&"  —  "&CITY&"   |   س.ت: "&CR&"   |   الرقم الضريبي: "&VAT',
    font(9, False, GREY_TXT), None, align("center"), merge="B3:I3")
for c in "BCDEFGHI":
    ws_f[f"{c}3"].border = Border(bottom=Side("medium", NAVY))
ws_f.row_dimensions[1].height = 32
ws_f.row_dimensions[4].height = 8

put(ws_f, "D5", f'=IF({F["METHOD"]}="شيك","أمر دفع بشيك",IF({F["METHOD"]}="تحويل بنكي","أمر تحويل بنكي","أمر دفع نقدي"))',
    font(16, True, "000000"), None, align("center"), merge="D5:G5")
put(ws_f, "D6", f'=IF({F["METHOD"]}="شيك","CHEQUE PAYMENT ORDER",IF({F["METHOD"]}="تحويل بنكي","BANK TRANSFER ORDER","CASH PAYMENT ORDER"))',
    font(13, True, "000000"), None, align("center"), merge="D6:G6")
ws_f.row_dimensions[5].height = 24
ws_f.row_dimensions[6].height = 22
put(ws_f, "H5", f"={F['COPYTYPE']}", font(10, True, RED), None, align("center"), merge="H5:I5")
put(ws_f, "B5", "رقم السند  No.", font(9, True, GREY_TXT), None, align("center"), merge="B5:C5")
put(ws_f, "B6", '=PREFIX&"-"&IF(ISNUMBER(C11),YEAR(C11),YEAR(TODAY()))&"-"&Z3',
    font(13, True, RED), None, align("center"), BOX, merge="B6:C6")
outline(ws_f, "B6:C6")

# مربع المبلغ (يمين — مثل النموذج الورقي)
put(ws_f, "B8", '=CUR&"  "&CUR_EN', font(11, True), None, align("center"), merge="B8:D8")
put(ws_f, "B9", '=IF(Z5=0,"","#   "&TEXT(Z5,"#,##0.00")&"   #")',
    font(16, True, "000000"), fill(GOLD_L), align("center"), merge="B9:D9")
outline(ws_f, "B9:D9", thick)
ws_f.row_dimensions[9].height = 30

# حقول البيانات
def label_ar(r, text, col="B"):
    put(ws_f, f"{col}{r}", text, font(10, True), None, align("right"))


def label_en(r, text):
    put(ws_f, f"I{r}", text, font(9, True), None, Alignment(horizontal="left", vertical="center"))


def field(rng, value=None, fmt=None, inp=True, size=12, color=INPUT_FONT, al=None):
    first = rng.split(":")[0]
    put(ws_f, first, value, font(size, False, color), fill(INPUT) if inp else None,
        al or align("center", shrink=True), None, fmt, merge=rng if ":" in rng else None,
        prot=UNLOCK if inp else None)
    for row in cells(ws_f, rng):
        for c in row:
            c.border = Border(bottom=Side("dotted", "7A7A7A"))


label_ar(11, "التاريخ :")
field("C11:D11", dt.date(2026, 8, 15), DATE)
label_ar(11, "الموافق :", "E")
field("F11:G11", '=IF(ISNUMBER(C11),C11,"")', HIJRI, inp=False, size=11, color="1F2933")
label_en(11, "DATE :")
label_ar(12, "ادفعوا لأمر :")
field("C12:H12", "حيدر شماع")
label_en(12, "PAY TO :")
label_ar(13, "مبلغ وقدره :")
field("C13:H13", f'=IF(Z5=0,"",{tafqeet("Z5", "CUR")})', inp=False, size=11, color="1F2933")
label_en(13, "The Sum of :")
label_ar(14, "وذلك مقابل :")
field("C14:H14", "ذمم")
label_en(14, "Being :")
label_ar(15, "طريقة الدفع :")
field("C15:D15", "نقدي", size=11)
label_ar(15, "رقم الشيك :", "E")
field("F15:G15", None, "@", size=11)
label_en(15, "Method :")
label_ar(16, "يُصرف من :")
field("C16:E16", "الرياض 940", size=11)
label_ar(16, "فرع الصرف :", "F")
field("G16:H16", "مكة", size=11)
label_en(16, "Paid from :")
for r in range(11, 17):
    ws_f.row_dimensions[r].height = 24

# جدول البنود
HR = LN0 - 2
put(ws_f, f"B{HR}", "مدين", font(10, True), fill(TEAL_L), align("center"), BOX, merge=f"B{HR}:C{HR}")
put(ws_f, f"D{HR}", "دائن", font(10, True), fill(TEAL_L), align("center"), BOX, merge=f"D{HR}:E{HR}")
put(ws_f, f"F{HR}", "البيـــــــــــــــــان", font(10, True), fill(TEAL_L), align("center"), BOX, merge=f"F{HR}:H{HR+1}")
put(ws_f, f"I{HR}", "الفرع", font(10, True), fill(TEAL_L), align("center"), BOX, merge=f"I{HR}:I{HR+1}")
put(ws_f, f"B{HR+1}", '="ريال  "&CUR_EN', font(9, True), fill(TEAL_L), align("center"), BOX, merge=f"B{HR+1}:C{HR+1}")
put(ws_f, f"D{HR+1}", '="ريال  "&CUR_EN', font(9, True), fill(TEAL_L), align("center"), BOX, merge=f"D{HR+1}:E{HR+1}")
style(ws_f, f"B{HR}:I{HR+1}", bd=BOX)

LINE_BORDER = Border(left=dark, right=dark, bottom=Side("hair", "9AA5B1"))
for r in range(LN0, LN0 + LNN):
    for rng in (f"B{r}:C{r}", f"D{r}:E{r}", f"F{r}:H{r}"):
        ws_f.merge_cells(rng)
    style(ws_f, f"B{r}:I{r}", font(11, False, INPUT_FONT), fill(INPUT), align("center", shrink=True),
          LINE_BORDER, prot=UNLOCK)
    style(ws_f, f"F{r}:H{r}", al=align("right", indent=1, shrink=True))
    style(ws_f, f"B{r}:E{r}", fmt="#,##0.00", f=font(11, True, INPUT_FONT))
    ws_f.row_dimensions[r].height = 21
# سطر الطرف الدائن التلقائي
AR = AUTO_R
for rng in (f"B{AR}:C{AR}", f"D{AR}:E{AR}", f"F{AR}:H{AR}"):
    ws_f.merge_cells(rng)
ws_f[f"D{AR}"] = '=IF(Z7>0,Z7,"")'
ws_f[f"F{AR}"] = '=IF(Z7>0,IF(C16="","⚠ اختر حساب «يُصرف من»",C16),"")'
ws_f[f"I{AR}"] = '=IF(Z7>0,G16,"")'
style(ws_f, f"B{AR}:I{AR}", font(11, False, "1F2933"), fill("FFFFFF"), align("center", shrink=True),
      Border(left=dark, right=dark, bottom=dark, top=Side("hair", "9AA5B1")))
style(ws_f, f"D{AR}:E{AR}", fmt="#,##0.00", f=font(11, True))
style(ws_f, f"F{AR}:H{AR}", al=align("right", indent=1, shrink=True))
ws_f.row_dimensions[AR].height = 21

# المجموع
TR = TOT_R
put(ws_f, f"B{TR}", "=Z5", font(11, True), fill(GOLD_L), align("center"), BOX, "#,##0.00", merge=f"B{TR}:C{TR}")
put(ws_f, f"D{TR}", "=Z8", font(11, True), fill(GOLD_L), align("center"), BOX, "#,##0.00", merge=f"D{TR}:E{TR}")
put(ws_f, f"F{TR}", "رد ذمم حيدر شماع للمالك", font(11, False, INPUT_FONT), fill(INPUT), align("center", shrink=True),
    merge=f"F{TR}:H{TR}", prot=UNLOCK)
put(ws_f, f"I{TR}", "المجموع", font(11, True), fill(GOLD_L), align("center"), BOX)
outline(ws_f, f"B{TR}:I{TR}")
style(ws_f, f"B{TR}:E{TR}", bd=BOX)
ws_f.row_dimensions[TR].height = 26
put(ws_f, f"B{TR+1}", '=IF(ROUND(Z5-Z8,2)<>0,"⚠ غير متوازن: الدائن اليدوي أكبر من المدين بمقدار "&TEXT(Z6-Z5,"#,##0.00"),"")',
    font(9, True, RED), None, align("right"), merge=f"B{TR+1}:I{TR+1}")

# التواقيع
SR = TR + 3
SIGS = [("B", "C", "اسم المستلم", None), ("D", "E", "أمين الصندوق", "CASHIER"),
        ("F", "G", "المحاسب", "ACCOUNTANT"), ("H", "I", "المدير العام", "GM")]
for c1, c2, title, name in SIGS:
    put(ws_f, f"{c1}{SR}", title, font(10, True), fill(ALT), align("center"), merge=f"{c1}{SR}:{c2}{SR}")
    if name:
        put(ws_f, f"{c1}{SR+1}", f'=IF({name}="","",{name})', font(11, False, "1F2933"), None,
            align("center", shrink=True), merge=f"{c1}{SR+1}:{c2}{SR+1}")
    else:
        put(ws_f, f"{c1}{SR+1}", "حيدر شماع", font(11, False, INPUT_FONT), fill(INPUT),
            align("center", shrink=True), merge=f"{c1}{SR+1}:{c2}{SR+1}", prot=UNLOCK)
    put(ws_f, f"{c1}{SR+2}", "التوقيع", font(8, False, GREY_TXT), None, align("center", v="bottom"),
        merge=f"{c1}{SR+2}:{c2}{SR+2}")
    for c in (c1, c2):
        ws_f[f"{c}{SR+2}"].border = Border(top=Side("dotted", "7A7A7A"))
ws_f.row_dimensions[SR + 1].height = 24
ws_f.row_dimensions[SR + 2].height = 34
assert f"B{SR+1}" == F["RECV"]

FR = SR + 4
put(ws_f, f"B{FR}", '="تاريخ الطباعة: "&TEXT(NOW(),"dd/mm/yyyy hh:mm")&"   |   "&B6',
    font(8, False, GREY_TXT, True), None, align("center"), merge=f"B{FR}:I{FR}")
for c in "BCDEFGHI":
    ws_f[f"{c}{FR}"].border = Border(top=Side("thin", NAVY))
ws_f.print_area = f"A1:J{FR}"

# --- التحقق من الإدخال
dv_date = DataValidation(type="date", operator="between", formula1="DATE(2000,1,1)", formula2="DATE(2100,12,31)",
                         allow_blank=True, showErrorMessage=True, errorTitle="تاريخ غير صحيح",
                         error="اكتب التاريخ بالشكل يوم/شهر/سنة")
ws_f.add_data_validation(dv_date)
dv_date.add(F["DATE"])
dv_list(ws_f, "PAY_METHODS", F["METHOD"], "اختر طريقة الدفع — يتغير عنوان السند تلقائياً")
dv_list(ws_f, "ACCOUNTS", F["FROM"], "الحساب الدائن (الصندوق/البنك) — يُحسب مبلغه تلقائياً", strict=False)
dv_list(ws_f, "BRANCHES", F["FROMBR"])
dv_list(ws_f, "ACCOUNTS", f"F{LN0}:F{LN0+LNN-1}", "اختر من القائمة أو اكتب بياناً حراً", strict=False)
dv_list(ws_f, "BRANCHES", f"I{LN0}:I{LN0+LNN-1}", "اتركه فارغاً ليأخذ فرع الصرف")
dv_amt = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True,
                        showErrorMessage=True, errorTitle="مبلغ غير صحيح", error="المبلغ يجب أن يكون رقماً موجباً")
ws_f.add_data_validation(dv_amt)
dv_amt.add(f"B{LN0}:B{LN0+LNN-1}")
dv_amt.add(f"D{LN0}:D{LN0+LNN-1}")

# --- لوحة التحكم (خارج منطقة الطباعة)
put(ws_f, "K2", "🎛 لوحة التحكم (لا تُطبع)", font(12, True, "FFFFFF"), fill(NAVY), align("center"), merge="K2:N2")
put(ws_f, "K3", f'=IF({Q(S_SYS)}$B$1=1,"✔ الأزرار مفعّلة","⚠ الأزرار غير مفعّلة: اضغط «تمكين المحتوى / Enable Content». لو ظهر «Microsoft has blocked macros»: أغلق الملف ← كليك يمين عليه ← خصائص ← علّم «إلغاء الحظر / Unblock» ← موافق")',
    font(9, True, GREY_TXT), None, align("center", wrap=True), merge="K3:N3")
ws_f.row_dimensions[2].height = 26
ws_f.row_dimensions[3].height = 58
ws_f.conditional_formatting.add("K3", FormulaRule(formula=[f"{Q(S_SYS)}$B$1<>1"],
                                                  font=Font(color=RED, bold=True), fill=fill(RED_L)))

BUTTONS = [  # (cell, merge, text, macro, color)
    ("K4", "K4:N4", "💾  حفظ + سند جديد", "SaveAndNew", GREEN),
    ("K5", "K5:L5", "💾 حفظ فقط", "SaveVoucher", TEAL),
    ("M5", "M5:N5", "➕ سند جديد (مسح)", "NewVoucher", TEAL),
    ("K6", "K6:L6", "🖨 حفظ وطباعة", "SaveAndPrint", NAVY),
    ("M6", "M6:N6", "👁 معاينة الطباعة", "PreviewVoucher", NAVY2),
    ("K7", "K7:L7", "📄 حفظ PDF", "SaveAsPDF", NAVY),
    ("M7", "M7:N7", "📋 نسخ كسند جديد", "DuplicateVoucher", NAVY2),
    ("M10", "M10:N10", "📂 فتح السند", "LoadFromInput", GOLD),
    ("K11", "K11:L11", "▶ السابق", "PrevVoucher", GOLD),
    ("M11", "M11:N11", "التالي ◀", "NextVoucher", GOLD),
    ("K12", "K12:N12", "🗑 حذف السند المعروض", "DeleteVoucher", RED),
]
BTN_BORDER = Border(left=Side("medium", "FFFFFF"), right=Side("medium", "FFFFFF"),
                    top=Side("medium", "FFFFFF"), bottom=Side("medium", "FFFFFF"))
for cell, rng, text, macro, color in BUTTONS:
    c = put(ws_f, cell, text, font(12 if cell == "K4" else 10, True, "FFFFFF"), fill(color), align("center"),
            BTN_BORDER, merge=rng)
    c.hyperlink = Hyperlink(ref=cell, location=f"'{S_FORM}'!{cell}", display=text)
    c.comment = None
for r in (4, 5, 6, 7, 10, 11, 12):
    ws_f.row_dimensions[r].height = 28 if r == 4 else 24
ws_f.row_dimensions[4].height = 32

put(ws_f, "K9", "📂 استدعاء سند محفوظ", font(10, True, "FFFFFF"), fill(GOLD), align("right", indent=1), merge="K9:N9")
put(ws_f, "K10", "رقم السند ⬅", font(10, True), fill(ALT), align("center"), BORDER)
put(ws_f, F["LOADNO"], 1001, font(13, True, RED), fill(INPUT), align("center"),
    Border(left=thick, right=thick, top=thick, bottom=thick), prot=UNLOCK)
dv_list(ws_f, "V_NOS", F["LOADNO"], "اختر رقم السند — يُفتح تلقائياً")

put(ws_f, "K14", "📌 الحالة", font(10, True, "FFFFFF"), fill(NAVY2), align("right", indent=1), merge="K14:N14")
put(ws_f, "K15", '=IF(Z1="","🆕 سند جديد — لم يُحفظ بعد","💾 سند محفوظ ("&B6&")")&"   |   "&IF(Z5=0,"لا توجد مبالغ",IF(ROUND(Z5-Z8,2)=0,"متوازن ✔","غير متوازن ✘"))',
    font(10, True, NAVY), fill(FORMULA_BG), align("center", wrap=True), merge="K15:N15")
ws_f.row_dimensions[15].height = 30
ws_f.conditional_formatting.add("K15", FormulaRule(formula=['ISNUMBER(SEARCH("✘",K15))'],
                                                   font=Font(color=RED, bold=True), fill=fill(RED_L)))
ws_f.conditional_formatting.add("K15", FormulaRule(formula=['Z1=""'], font=Font(color=GOLD, bold=True), fill=fill(GOLD_L)))
put(ws_f, F["MSG"], "📂 تم فتح السند CP-2026-1001", font(10, True, GREEN), fill(GREEN_L),
    align("center", wrap=True), merge="K16:N18")

put(ws_f, "K20", "🖨 الطباعة", font(10, True, "FFFFFF"), fill(NAVY2), align("right", indent=1), merge="K20:N20")
put(ws_f, "K21", "نوع النسخة", font(10, True), fill(ALT), align("center"), BORDER)
put(ws_f, F["COPYTYPE"], "الأصل", font(11, True, INPUT_FONT), fill(INPUT), align("center"), BORDER,
    merge="L21:N21", prot=UNLOCK)
dv_list(ws_f, '"الأصل,صورة - الحسابات,صورة - الصندوق,صورة - المستفيد"', F["COPYTYPE"])
put(ws_f, "K22", "عدد النسخ", font(10, True), fill(ALT), align("center"), BORDER)
put(ws_f, F["COPIES"], 1, font(11, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, "0", prot=UNLOCK)
dv_n = DataValidation(type="whole", operator="between", formula1="1", formula2="10", allow_blank=True)
ws_f.add_data_validation(dv_n)
dv_n.add(F["COPIES"])

put(ws_f, "K24", "📊 إحصائيات سريعة", font(10, True, "FFFFFF"), fill(PURPLE), align("right", indent=1), merge="K24:N24")
STATS = [("K25", "السندات المحفوظة", "L25", f"=COUNT({RV('A')})", "0"),
         ("M25", "آخر رقم", "N25", f'=IF(COUNT({RV("A")})=0,"-",MAX({RV("A")}))', "0"),
         ("K26", "مدفوعات اليوم", "L26", f"=SUMIFS({RV('L')},{RV('C')},TODAY())", ACC),
         ("M26", "مدفوعات الشهر", "N26",
          f'=SUMIFS({RV("L")},{RV("C")},">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),{RV("C")},"<="&TODAY())', ACC)]
for lc, lt, vc, vf, fmt in STATS:
    put(ws_f, lc, lt, font(9, True, GREY_TXT), fill(ALT), align("center", wrap=True), BORDER)
    put(ws_f, vc, vf, font(11, True, PURPLE), fill("FFFFFF"), align("center"), BORDER, fmt)
ws_f.row_dimensions[25].height = 28
ws_f.row_dimensions[26].height = 28

link(ws_f, "K28", "🧾 سجل السندات", S_REG, "A1", NAVY, "K28:L28")
link(ws_f, "M28", "📋 بنود السندات", S_LNS, "A1", TEAL, "M28:N28")
link(ws_f, "K29", "📊 التقارير", S_SUM, "A1", PURPLE, "K29:L29")
link(ws_f, "M29", "⚙ الإعدادات", S_SET, "A1", GOLD, "M29:N29")
tips = ["• اكتب في الخلايا الصفراء فقط.",
        "• اكتب المدين فقط — الدائن من «يُصرف من» يُحسب تلقائياً.",
        "• لو تركت فرع البند فارغاً يأخذ «فرع الصرف».",
        "• «حفظ + سند جديد» لإدخال سندات متتالية بسرعة."]
for i, t in enumerate(tips):
    put(ws_f, f"K{31+i}", t, font(9, False, GREY_TXT), None, align("right", wrap=True), merge=f"K{31+i}:N{31+i}")

ws_f.protection.sheet = True
ws_f.protection.formatCells = True
ws_f.protection.formatColumns = True
ws_f.protection.formatRows = True

# ---------------------------------------------------------------- التقارير
setup(ws_s, {"A": 2, "B": 24, "C": 15, "D": 15, "E": 3, "F": 14, "G": 12, "H": 15, "I": 3,
             "J": 16, "K": 15, "L": 10, "M": 3, "N": 30, "O": 15, "P": 15}, PURPLE, landscape=True)
banner(ws_s, "B", "P", "📊 تقارير أوامر الدفع", "تتحدث تلقائياً من السجل والبنود — غيّر السنة أو الفترة من الخلايا الصفراء")
link(ws_s, "B3", "✍ سند الصرف", S_FORM, "C12", RED)
link(ws_s, "C3", "🧾 السجل", S_REG, "A1", NAVY)
link(ws_s, "D3", "📋 البنود", S_LNS, "A1", TEAL)
put(ws_s, "J3", "السنة ⬅", font(10, True), None, align("left"))
put(ws_s, "K3", "=YEAR(TODAY())", font(12, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, "0")

CARDS = [("B", "C", "عدد السندات", f"=COUNT({RV('A')})", "0", NAVY),
         ("D", "F", "إجمالي المدفوعات", f"=SUM({RV('L')})", ACC, TEAL),
         ("G", "H", "متوسط السند", f"=IFERROR(AVERAGE({RV('L')}),0)", ACC, GOLD),
         ("J", "K", "أكبر سند", f"=MAX({RV('L')})", ACC, PURPLE),
         ("N", "P", "مدفوعات هذا الشهر", STATS[3][3], ACC, RED)]
for c1, c2, lbl, f, fmt, col in CARDS:
    put(ws_s, f"{c1}5", lbl, font(9, True, GREY_TXT), fill("FFFFFF"), align("center"), merge=f"{c1}5:{c2}5")
    put(ws_s, f"{c1}6", f, font(16, True, col), fill("FFFFFF"), align("center"), fmt=fmt, merge=f"{c1}6:{c2}6")
    outline(ws_s, f"{c1}5:{c2}6", Side("medium", col))
ws_s.row_dimensions[6].height = 32


def total_row(ws, r, label, cols_fmts):
    put(ws, f"{cols_fmts[0][0]}{r}", label, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
    for col, f, fmt in cols_fmts[1:]:
        put(ws, f"{col}{r}", f, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)


def body(ws, rng, fmt_map):
    for row in cells(ws, rng):
        for c in row:
            c.border = BORDER
            c.font = font(10, c.column_letter in ("B", "F", "J", "N"))
            c.alignment = align("center")
            if c.column_letter in fmt_map:
                c.number_format = fmt_map[c.column_letter]


# حسب الفرع
headers(ws_s, 8, [("B", "الفرع"), ("C", "مدين"), ("D", "دائن")], TEAL)
for k in range(12):
    r = 9 + k
    ws_s[f"B{r}"] = f'=IFERROR(INDEX({Q(S_SET)}$E$5:$E$64,{k+1})&"","")'
    ws_s[f"C{r}"] = f'=IF(B{r}="","",SUMIFS({LV("E")},{LV("C")},B{r}))'
    ws_s[f"D{r}"] = f'=IF(B{r}="","",SUMIFS({LV("F")},{LV("C")},B{r}))'
body(ws_s, "B9:D20", {"C": ACC, "D": ACC})
total_row(ws_s, 21, "الإجمالي", [("B",), ("C", "=SUM(C9:C20)", ACC), ("D", "=SUM(D9:D20)", ACC)])

# حسب الشهر
headers(ws_s, 8, [("F", "الشهر"), ("G", "عدد السندات"), ("H", "المبلغ")], NAVY)
MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
for k, mname in enumerate(MONTHS):
    r = 9 + k
    d1, d2 = f"DATE($K$3,{k+1},1)", f"DATE($K$3,{k+2},1)"
    ws_s[f"F{r}"] = mname
    ws_s[f"G{r}"] = f'=COUNTIFS({RV("C")},">="&{d1},{RV("C")},"<"&{d2})'
    ws_s[f"H{r}"] = f'=SUMIFS({RV("L")},{RV("C")},">="&{d1},{RV("C")},"<"&{d2})'
body(ws_s, "F9:H20", {"G": '0;-0;"-"', "H": ACC})
total_row(ws_s, 21, "الإجمالي", [("F",), ("G", "=SUM(G9:G20)", "0"), ("H", "=SUM(H9:H20)", ACC)])

# حسب طريقة الدفع
headers(ws_s, 8, [("J", "طريقة الدفع"), ("K", "المبلغ"), ("L", "العدد")], GOLD)
for k in range(3):
    r = 9 + k
    ws_s[f"J{r}"] = f"=INDEX({Q(S_SET)}$I$5:$I$7,{k+1})"
    ws_s[f"K{r}"] = f'=SUMIFS({RV("L")},{RV("E")},J{r})'
    ws_s[f"L{r}"] = f'=COUNTIFS({RV("E")},J{r})'
body(ws_s, "J9:L11", {"K": ACC, "L": "0"})
total_row(ws_s, 12, "الإجمالي", [("J",), ("K", "=SUM(K9:K11)", ACC), ("L", "=SUM(L9:L11)", "0")])

# حركة الحسابات خلال فترة
put(ws_s, "N8", "حركة الحسابات خلال فترة", font(10, True, "FFFFFF"), fill(PURPLE), align("center"), merge="N8:P8")
put(ws_s, "N9", "من تاريخ", font(10, True), fill(ALT), align("center"), BORDER)
put(ws_s, "O9", f"=DATE($K$3,1,1)", font(11, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, DATE, merge="O9:P9")
put(ws_s, "N10", "إلى تاريخ", font(10, True), fill(ALT), align("center"), BORDER)
put(ws_s, "O10", f"=DATE($K$3,12,31)", font(11, True, INPUT_FONT), fill(INPUT), align("center"), BORDER, DATE, merge="O10:P10")
headers(ws_s, 11, [("N", "الحساب / البيان"), ("O", "مدين"), ("P", "دائن")], PURPLE)
ACC_N = 25
for k in range(ACC_N):
    r = 12 + k
    ws_s[f"N{r}"] = f'=IFERROR(INDEX({Q(S_SET)}$G$5:$G$64,{k+1})&"","")'
    for col, src in (("O", "E"), ("P", "F")):
        ws_s[f"{col}{r}"] = (f'=IF(N{r}="","",SUMIFS({LV(src)},{LV("D")},N{r},{LV("G")},">="&$O$9,'
                             f'{LV("G")},"<="&$O$10))')
body(ws_s, f"N12:P{11+ACC_N}", {"O": ACC, "P": ACC})
total_row(ws_s, 12 + ACC_N, "الإجمالي", [("N",), ("O", f"=SUM(O12:O{11+ACC_N})", ACC), ("P", f"=SUM(P12:P{11+ACC_N})", ACC)])
put(ws_s, f"N{13+ACC_N}", "* البنود المكتوبة بنص حر (غير موجود في قائمة الحسابات) لا تظهر هنا — تجدها في «بنود السندات».",
    font(8, False, GREY_TXT, True), None, align("right", wrap=True), merge=f"N{13+ACC_N}:P{14+ACC_N}")

ch = BarChart()
ch.type = "col"
ch.style = 10
ch.title = "المدفوعات حسب الشهر"
ch.add_data(Reference(ws_s, min_col=8, min_row=8, max_row=20), titles_from_data=True)
ch.set_categories(Reference(ws_s, min_col=6, min_row=9, max_row=20))
ch.legend = None
ch.height, ch.width = 8, 16
ws_s.add_chart(ch, "B24")

ch2 = BarChart()
ch2.type = "bar"
ch2.style = 12
ch2.title = "المدين حسب الفرع"
ch2.add_data(Reference(ws_s, min_col=3, min_row=8, max_row=20), titles_from_data=True)
ch2.set_categories(Reference(ws_s, min_col=2, min_row=9, max_row=20))
ch2.legend = None
ch2.height, ch2.width = 8, 12
ws_s.add_chart(ch2, "G24")

# ================================================================ بيانات مثال (كما يكتبها الماكرو)
SAMPLES = [
    dict(no=1001, date=dt.date(2026, 8, 15), payee="حيدر شماع", method="نقدي", chq="", being="ذمم",
         frm="الرياض 940", br="مكة", note="رد ذمم حيدر شماع للمالك", recv="حيدر شماع",
         lines=[("مكة", "ذمم موظفين", 3000)]),
    dict(no=1002, date=dt.date(2026, 8, 20), payee="مؤسسة البناء الحديث", method="شيك", chq="000457",
         being="دفعة مقدمة — توريد حديد مشروع العزيزية", frm="البنك الأهلي", br="مكة",
         note="دفعة أولى من عقد التوريد", recv="سالم الحربي",
         lines=[("مكة", "مواد ومشتريات مشاريع", 25000), ("جدة", "مواد ومشتريات مشاريع", 12500.5)]),
    dict(no=1003, date=dt.date(2026, 9, 3), payee="شركة الوقود المتحدة", method="تحويل بنكي", chq="TRX-88213",
         being="محروقات معدات شهر أغسطس", frm="مصرف الراجحي", br="الرياض",
         note="شامل ضريبة القيمة المضافة", recv="محمد القرشي",
         lines=[("الرياض", "وقود ومحروقات", 4200), ("الرياض", "ضريبة القيمة المضافة (مدخلات)", 630)]),
]
lr = DATA0
for i, s in enumerate(SAMPLES):
    r = DATA0 + i
    total = round(sum(x[2] for x in s["lines"]), 2)
    vals = [s["no"], f"CP-{s['date'].year}-{s['no']}", s["date"], s["payee"], s["method"], s["chq"], s["being"],
            s["frm"], s["br"], s["note"], s["recv"], total, tafqeet_py(total), len(s["lines"]) + 1,
            dt.datetime(2026, 9, 29, 9, 0), "admin"]
    for j, v in enumerate(vals, 1):
        ws_r.cell(r, j, v)
    ws_r.cell(r, 3).number_format = DATE
    ws_r.cell(r, 6).number_format = "@"
    ws_r.cell(r, 12).number_format = "#,##0.00"
    ws_r.cell(r, 15).number_format = "dd/mm/yyyy hh:mm"
    seq = 0
    for br, desc, amt in s["lines"] + [(s["br"], s["frm"], None)]:
        seq += 1
        auto = amt is None
        row = [s["no"], seq, br, desc, None if auto else amt, total if auto else None, s["date"], s["payee"],
               "تلقائي" if auto else "يدوي"]
        for j, v in enumerate(row, 1):
            ws_l.cell(lr, j, v)
        ws_l.cell(lr, 5).number_format = ws_l.cell(lr, 6).number_format = "#,##0.00"
        ws_l.cell(lr, 7).number_format = DATE
        lr += 1

# النموذج يعرض السند 1001 مفتوحاً
ws_f[f"B{LN0}"] = 3000
ws_f[f"F{LN0}"] = "ذمم موظفين"
ws_f[f"I{LN0}"] = "مكة"

ws_f.sheet_view.tabSelected = True
ws_f.sheet_view.selection[0].activeCell = F["PAYEE"]
ws_f.sheet_view.selection[0].sqref = F["PAYEE"]
wb.active = 0
wb.calculation.fullCalcOnLoad = True

# ================================================================ الماكرو
def vba_sources():
    consts = [f'Private Const {k} As Long = {v}' for k, v in MSG_ROW.items()]
    for k in ("DATE", "PAYEE", "WORDS", "BEING", "METHOD", "CHEQUE", "FROM", "FROMBR", "NOTE", "RECV", "REF",
              "LOADED", "CUR", "TDR", "TCR", "AUTO", "LOADNO", "MSG", "COPIES"):
        consts.append(f'Private Const F_{k} As String = "{F[k]}"')
    consts += [f"Private Const LN0 As Long = {LN0}", f"Private Const LNN As Long = {LNN}",
               'Private Const LC_DR As String = "B"', 'Private Const LC_CR As String = "D"',
               'Private Const LC_DESC As String = "F"', 'Private Const LC_BR As String = "I"',
               f"Private Const DATA0 As Long = {DATA0}", f"Private Const REG_COLS As Long = {REG_COLS}",
               f"Private Const LNS_COLS As Long = {LNS_COLS}",
               f'Private Const S_DEF_METHOD As String = "C{SET_ROW["DEF_METHOD"]}"',
               f'Private Const S_DEF_FROM As String = "C{SET_ROW["DEF_FROM"]}"',
               f'Private Const S_DEF_BRANCH As String = "C{SET_ROW["DEF_BRANCH"]}"']
    dispatch = [f'        Case "{cell}": {macro}' for cell, _, _, macro, _ in BUTTONS]
    src = open(os.path.join(HERE, "vba", "modVoucher.bas"), encoding="ascii").read()
    src = src.replace("'@@CONSTANTS@@", "\n".join(consts)).replace("'@@DISPATCH@@", "\n".join(dispatch))
    for k in MSG_ROW:
        assert k in src or k in ("MSG_READY_NEW",), k

    form_mod = """Option Explicit

Private Sub Worksheet_FollowHyperlink(ByVal Target As Hyperlink)
    RunButton Target.Range.Cells(1, 1).Address(False, False)
End Sub

Private Sub Worksheet_Change(ByVal Target As Range)
    FormChanged Target
End Sub
"""
    list_mod = """Option Explicit

Private Sub Worksheet_BeforeDoubleClick(ByVal Target As Range, Cancel As Boolean)
    If Target.Row >= 5 And Not IsEmpty(Me.Cells(Target.Row, 1).Value) Then
        Cancel = True
        OpenFromList Me, Target.Row
    End If
End Sub
"""
    wb_mod = f"""Option Explicit

Private Sub Workbook_Open()
    On Error Resume Next
    shSys.Range("B1").Value = 1
    shForm.Activate
    shForm.Range("{F['PAYEE']}").Select
    ThisWorkbook.Saved = True
End Sub

Private Sub Workbook_BeforeSave(ByVal SaveAsUI As Boolean, Cancel As Boolean)
    shSys.Range("B1").Value = 0
End Sub

Private Sub Workbook_AfterSave(ByVal Success As Boolean)
    shSys.Range("B1").Value = 1
    ThisWorkbook.Saved = True
End Sub
"""
    mods = [dict(name="ThisWorkbook", document=True, code=document_module("ThisWorkbook", "workbook", wb_mod))]
    for sheet, code in CODE.items():
        bodytxt = form_mod if code == "shForm" else (list_mod if code in ("shReg", "shLns") else "Option Explicit\n")
        mods.append(dict(name=code, document=True, code=document_module(code, "sheet", bodytxt)))
    mods.append(dict(name="modVoucher", document=False, code=standard_module("modVoucher", src)))
    return mods


# ================================================================ الحفظ → إعادة الحساب → حقن الماكرو
def recalc(path):
    skill = os.environ.get("RECALC")
    if not skill or not os.path.exists(skill):
        print("! RECALC not set — skipping LibreOffice recalculation (Excel will calculate on open)")
        return
    res = subprocess.run([sys.executable, skill, path, "600"], capture_output=True, text=True)
    print(res.stdout.strip())
    if '"errors_found"' in res.stdout or '"error"' in res.stdout:
        sys.exit("recalc failed")


def inject_vba(xlsx_path, out_path, vba_bin):
    zin = zipfile.ZipFile(xlsx_path)
    names = zin.namelist()
    wb_xml = zin.read("xl/workbook.xml").decode("utf-8")
    rels = zin.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    # خريطة: اسم الورقة → ملف XML
    rid_target = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    rid_target.update({a: b for b, a in re.findall(r'<Relationship[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    sheet_file = {}
    for m in re.finditer(r'<sheet\b[^>]*/>', wb_xml):
        tag = m.group(0)
        name = re.search(r'name="([^"]+)"', tag).group(1)
        rid = re.search(r'r:id="([^"]+)"', tag).group(1)
        tgt = rid_target[rid].lstrip("/")
        sheet_file[name.replace("&amp;", "&")] = tgt if tgt.startswith("xl/") else "xl/" + tgt

    def set_codename_wb(x):
        if "<workbookPr" in x:
            x = re.sub(r'(<workbookPr\b[^>]*?)\s+codeName="[^"]*"', r"\1", x)
            return re.sub(r"<workbookPr\b", '<workbookPr codeName="ThisWorkbook"', x, count=1)
        return re.sub(r"(<bookViews\b)", r'<workbookPr codeName="ThisWorkbook"/>\1', x, count=1)

    def set_codename_ws(x, code):
        if "<sheetPr" in x:
            x = re.sub(r'(<sheetPr\b[^>]*?)\s+codeName="[^"]*"', r"\1", x)
            return re.sub(r"<sheetPr\b", f'<sheetPr codeName="{code}"', x, count=1)
        return re.sub(r"(<worksheet\b[^>]*>)", rf'\1<sheetPr codeName="{code}"/>', x, count=1)

    zout = zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED)
    for n in names:
        data = zin.read(n)
        if n == "[Content_Types].xml":
            x = data.decode("utf-8")
            x = x.replace("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
                          "application/vnd.ms-excel.sheet.macroEnabled.main+xml")
            if 'Extension="bin"' not in x:
                x = x.replace("<Default ", '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Default ', 1)
            data = x.encode("utf-8")
        elif n == "xl/_rels/workbook.xml.rels":
            x = data.decode("utf-8")
            x = x.replace("</Relationships>",
                          '<Relationship Id="rIdVBA1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>')
            data = x.encode("utf-8")
        elif n == "xl/workbook.xml":
            data = set_codename_wb(data.decode("utf-8")).encode("utf-8")
        else:
            for sname, f in sheet_file.items():
                if n == f:
                    data = set_codename_ws(data.decode("utf-8"), CODE[sname]).encode("utf-8")
        zout.writestr(n, data)
    zout.writestr("xl/vbaProject.bin", vba_bin)
    zout.close()
    return sheet_file


if __name__ == "__main__":
    tmpdir = tempfile.mkdtemp()
    tmp = os.path.join(tmpdir, "voucher.xlsx")
    wb.save(tmp)
    recalc(tmp)
    vba_bin = build_vba_project(vba_sources())
    with open(os.path.join(HERE, "vba", "vbaProject.bin"), "wb") as fh:
        fh.write(vba_bin)
    inject_vba(tmp, OUT, vba_bin)
    shutil.rmtree(tmpdir)
    print("saved", OUT)
