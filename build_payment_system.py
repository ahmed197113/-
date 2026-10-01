# -*- coding: utf-8 -*-
"""
مولّد نظام تتبع المستخلصات متعدد المشاريع
- ملف مستخلصات لكل مشروع في فولدر مستقل (20 مستخلص مترابط): Project_NN/IPC_Project_NN.xlsx (50 مشروع)
- ملف تقارير مجمع مربوط بها: Projects_Billing_Reports.xlsx (50 شيت مشروع + الإجمالي العام)
- متوافق مع متطلبات السوق السعودي: ض.ق.م 15%، الفاتورة الضريبية، الضمانات البنكية، المستندات النظامية
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


def banner(ws, first, last, title, subtitle):
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


# =====================================================================================
#                               الإعدادات العامة للنظام
# =====================================================================================
import os
import glob
import shutil
import subprocess
import json
from openpyxl import load_workbook
from openpyxl.workbook.external_link.external import (ExternalBook, ExternalLink, ExternalSheetNames,
                                                      ExternalSheetDataSet, ExternalSheetData, ExternalRow,
                                                      ExternalCell)
from openpyxl.packaging.relationship import Relationship
from openpyxl.worksheet.pagebreak import Break

OUT_DIR = "Payment_Certificates_System"
N_PROJ = int(os.environ.get("PCS_N_PROJ", 50))
N_IPC = 20
CERT_FILE = "IPC_Project_{:02d}.xlsx"
PROJ_DIR = "Project_{:02d}"


def cert_rel(p):
    """المسار النسبي لملف المشروع من ملف التقارير"""
    return f"{PROJ_DIR.format(p)}/{CERT_FILE.format(p)}"
REPORT_FILE = "Projects_Billing_Reports.xlsx"

S_GUIDE = "التعليمات"
S_SET = "بيانات العقد"
S_BOQ = "جدول الكميات"
S_VO = "الأوامر التغييرية"
S_TD = "الاستقطاعات الفنية"
S_REG = "سجل المستخلصات"
S_BUD = "الموازنة والتكاليف"
ELEMENTS = ["المواد", "العمالة", "مقاولو الباطن", "المعدات", "مصروفات الموقع"]
# نسب توزيع التكلفة المباشرة على العناصر لكل قسم (للبيانات التوضيحية)
ELEM_SPLIT = {0: [.15, .15, .20, .45, .05], 1: [.55, .20, .10, .10, .05], 2: [.50, .35, .05, .03, .07],
              3: [.50, .20, .25, .00, .05], 4: [.50, .25, .18, .02, .05], 5: [.40, .10, .45, .00, .05],
              6: [.40, .10, .45, .00, .05], 7: [.45, .05, .45, .00, .05], 8: [.40, .20, .20, .15, .05]}
COST_RATIO = {1: 0.83, 2: 0.91, 3: 0.79}     # التكلفة الفعلية المباشرة ÷ قيمة الأعمال (مثال)
# مواقع شيت الموازنة
BG_SET = 5
BM_HDR, BM_R1 = 10, 11
BM_RN = BM_R1 + 12 - 1                       # 22
BM_TOT, BM_GA, BM_CT, BM_BAC, BM_PP = 23, 24, 25, 26, 27
BA_HDR, BA_R1 = 30, 31
BA_RN = BA_R1 + N_IPC - 1                       # 50
BA_TOT = BA_RN + 1                           # 51
BE_HDR, BE_R1 = 54, 55                       # مقارنة العناصر
BK_R1 = 66                                   # ملخص المؤشرات (D66..)
BK = dict(bac=66, rev_c=67, pprofit=68, pmargin=69, cost=70, revenue=71, profit=72, margin=73, cpi=74, eac=75,
          fprofit=76, fmargin=77, cash=78, status=79)
S_ALL = "الإجمالي العام"


def S_IPC(n):
    return f"مستخلص {n:02d}"


def S_PRJ(p):
    return f"مشروع {p:02d}"


BOQ_FIRST, BOQ_LAST = 6, 105
VO_FIRST, VO_LAST = 6, 55
TD_FIRST, TD_LAST = 6, 105
REG_FIRST = 6
REG_LAST = REG_FIRST + N_IPC - 1        # 25
REG_TOT = REG_LAST + 1                  # 26
SEC_HDR = REG_TOT + 5                   # 31  عناوين جدول الأقسام
SEC_FIRST = SEC_HDR + 1                 # 32
N_SEC = 12
SEC_LAST = SEC_FIRST + N_SEC - 1        # 43

# صفوف شيت المستخلص
FIN = dict(work=19, vo=20, mat=21, gross=22, adv=23, ret=24, rel=25, td=26, pen=27, net=28, vat=29, wht=30, due=31)
DOC_ROW = 37                        # قسم المستندات المطلوبة للصرف
SIG_ROW = 45                        # قسم الاعتمادات
BOQ_SEC = 49                        # قسم حصر البنود
D_FIRST = BOQ_SEC + 2
D_LAST = D_FIRST + (BOQ_LAST - BOQ_FIRST)   # 142
D_TOT = D_LAST + 1

SECTIONS = ["أعمال الحفر والردم", "الخرسانة العادية والمسلحة", "أعمال المباني", "أعمال العزل",
            "أعمال التشطيبات", "الأعمال الكهربائية", "الأعمال الصحية", "أعمال التكييف", "أعمال الموقع العام"]
IPC_STATUS = ["مسودة", "مقدم للاستشاري", "تحت المراجعة", "معتمد", "مرفوض"]
VO_STATUS = ["معتمد", "قيد الدراسة", "مرفوض"]
TD_TYPE = ["أعمال غير مطابقة", "أعمال ناقصة", "ملاحظات فنية", "اختبارات غير مستكملة", "مستندات غير مستكملة", "أخرى"]

BOQ_ITEMS = [  # الكود، القسم، الوصف، الوحدة، الكمية، السعر (ريال سعودي)
    ("01-001", 0, "حفر عام للأساسات حتى المنسوب التصميمي مع نقل الناتج خارج الموقع", "م3", 4500, 25),
    ("01-002", 0, "ردم بالتربة المختارة على طبقات مع الدمك حتى 95% بروكتور معدل", "م3", 2200, 18),
    ("01-003", 0, "إحلال تربة بمواد مختارة (Sub-base) مع الدمك والاختبارات", "م3", 1800, 75),
    ("02-001", 1, "خرسانة عادية للنظافة قوة 20 ميجا باسكال", "م3", 380, 380),
    ("02-002", 1, "خرسانة مسلحة للقواعد والميد قوة 35 ميجا باسكال (بدون حديد)", "م3", 950, 950),
    ("02-003", 1, "خرسانة مسلحة للأعمدة والجدران الخرسانية قوة 35 ميجا باسكال", "م3", 420, 1150),
    ("02-004", 1, "خرسانة مسلحة للأسقف والكمرات والدرج قوة 35 ميجا باسكال", "م3", 1650, 1050),
    ("02-005", 1, "توريد وتركيب حديد تسليح عالي المقاومة (مطابق للمواصفات السعودية)", "طن", 480, 3400),
    ("03-001", 2, "مباني بلوك أسمنتي مصمت سماكة 20 سم", "م2", 7800, 75),
    ("03-002", 2, "مباني بلوك أسمنتي سماكة 15 سم للقواطع", "م2", 3600, 60),
    ("04-001", 3, "عزل مائي للأساسات بالبيتومين على وجهين", "م2", 2400, 30),
    ("04-002", 3, "عزل مائي وحراري للأسطح بالممبرين والبوليسترين", "م2", 1900, 120),
    ("05-001", 4, "لياسة داخلية للجدران والأسقف", "م2", 21000, 32),
    ("05-002", 4, "لياسة خارجية للواجهات", "م2", 6500, 40),
    ("05-003", 4, "توريد وتركيب بلاط بورسلين 60×60 درجة أولى", "م2", 7200, 140),
    ("05-004", 4, "دهانات داخلية (أساس + وجهين)", "م2", 21000, 28),
    ("05-005", 4, "تكسيات واجهات حجر طبيعي سماكة 3 سم", "م2", 2800, 260),
    ("05-006", 4, "توريد وتركيب أبواب خشبية داخلية كاملة", "عدد", 160, 1800),
    ("05-007", 4, "توريد وتركيب نوافذ ألمنيوم مع زجاج مزدوج", "م2", 950, 650),
    ("06-001", 5, "تأسيس نقاط إنارة وأفياش بالمواسير والأسلاك", "نقطة", 3200, 120),
    ("06-002", 5, "توريد وتركيب لوحات توزيع فرعية", "عدد", 24, 6500),
    ("06-003", 5, "كابلات تغذية رئيسية نحاس معزولة", "م.ط", 1800, 160),
    ("06-004", 5, "توريد وتركيب وحدات إنارة LED", "عدد", 1400, 280),
    ("07-001", 6, "تمديدات تغذية مياه بمواسير PPR", "نقطة", 420, 350),
    ("07-002", 6, "تمديدات صرف صحي بمواسير UPVC", "نقطة", 380, 300),
    ("07-003", 6, "توريد وتركيب أطقم صحية كاملة", "طقم", 96, 2800),
    ("08-001", 7, "توريد وتركيب وحدات تكييف سبليت", "عدد", 120, 4200),
    ("08-002", 7, "مجاري هواء صاج مجلفن معزولة", "م2", 2600, 220),
    ("09-001", 8, "بردورات وأرصفة خرسانية", "م.ط", 1200, 85),
    ("09-002", 8, "أعمال بلاط متداخل (إنترلوك) سماكة 8 سم", "م2", 3500, 70),
]
# جدول زمني نمطي لكل قسم كنسبة من مدة المشروع (البداية، المدة)
SEC_SCHED = {0: (0.0, 0.18), 1: (0.05, 0.45), 2: (0.30, 0.35), 3: (0.15, 0.60), 4: (0.45, 0.50),
             5: (0.35, 0.60), 6: (0.35, 0.60), 7: (0.60, 0.35), 8: (0.80, 0.20)}

# بيانات المشاريع التوضيحية (باقي المشاريع قوالب فارغة جاهزة)
SAMPLE = {
    1: dict(name="مشروع إنشاء مبنى إداري - الرياض", no="CT-2026-014", ctype="خاص - FIDIC",
            owner="شركة رؤية للتطوير العقاري", eng="مكتب البنيان للاستشارات الهندسية",
            vat_c="310123456700003", cr="1010123456", vat_o="300987654300003",
            start=dt.date(2026, 3, 1), dur=18, factor=1.0, perf=1.08, n_ipc=6,
            materials=[0, 90000, 180000, 120000, 220000, 150000], pen={5: 5000},
            vos=[("VO-01", dt.date(2026, 5, 18), "إضافة غرفة محولات ولوحة جهد متوسط خارجية", "إضافة", 250000, "معتمد", 250000, 4),
                 ("VO-02", dt.date(2026, 7, 2), "تعديل مواصفة البورسلين بموافقة المالك", "خصم", 64000, "معتمد", 64000, 5),
                 ("VO-03", dt.date(2026, 8, 25), "أعمال تنسيق موقع وزراعة إضافية", "إضافة", 180000, "قيد الدراسة", None, None)],
            tds=[("TD-01", dt.date(2026, 5, 3), 2, "02-002", "تعشيش في خرسانة بعض القواعد يلزم معالجته", "أعمال غير مطابقة", 17000, "نعم", 4),
                 ("TD-02", dt.date(2026, 6, 4), 3, "04-001", "عدم تقديم نتائج اختبار التصاق العزل", "اختبارات غير مستكملة", 8000, "لا", None),
                 ("TD-03", dt.date(2026, 8, 4), 5, "02-004", "ملاحظات على استواء أسطح بلاطات الدور الأول", "ملاحظات فنية", 24000, "لا", None),
                 ("TD-04", dt.date(2026, 9, 3), 6, "03-001", "مباني بلوك غير مطابقة للمواصفات (عدم ضبط الرأسية)", "أعمال غير مطابقة", 13000, "لا", None)],
            partial={5: 0.6}, review=set()),
    2: dict(name="مشروع إنشاء مدرسة ابتدائية 24 فصلاً - جدة", no="GOV-1447-087", ctype="حكومي - نظام المنافسات والمشتريات الحكومية",
            owner="جهة حكومية (مثال توضيحي)", eng="المركز الاستشاري للتصاميم الهندسية",
            vat_c="310123456700003", cr="1010123456", vat_o="300555444300003",
            start=dt.date(2025, 11, 1), dur=14, factor=0.55, perf=0.88, n_ipc=10,
            materials=[0, 30000, 60000, 84000, 76000, 52000, 100000, 90000, 60000, 40000], pen={8: 8000},
            vos=[("VO-01", dt.date(2026, 2, 10), "زيادة عدد دورات المياه بالدور الأرضي", "إضافة", 128000, "معتمد", 128000, 5),
                 ("VO-02", dt.date(2026, 6, 15), "إلغاء التكسيات الحجرية بالواجهة الخلفية", "خصم", 42000, "معتمد", 42000, 8)],
            tds=[("TD-01", dt.date(2026, 3, 4), 4, "02-003", "انحراف في رأسية بعض الأعمدة", "أعمال غير مطابقة", 12000, "نعم", 6),
                 ("TD-02", dt.date(2026, 7, 5), 8, "05-001", "لياسة غير مستوية بالدور الأول", "ملاحظات فنية", 11000, "لا", None)],
            partial={9: 0.5}, review={10}),
    3: dict(name="مشروع مجمع فلل سكنية 12 فيلا - الدمام", no="CT-2026-033", ctype="خاص - عقد مقاولة",
            owner="شركة الواحة للاستثمار العقاري", eng="دار الخبرة للاستشارات الهندسية",
            vat_c="310123456700003", cr="1010123456", vat_o="300111222300003",
            start=dt.date(2026, 6, 1), dur=12, factor=0.35, perf=0.97, n_ipc=3,
            materials=[20000, 50000, 36000], pen={},
            vos=[], tds=[("TD-01", dt.date(2026, 9, 2), 3, "01-003", "عدم استكمال اختبارات دمك الإحلال", "اختبارات غير مستكملة", 6000, "لا", None)],
            partial={}, review={3}),
}
SAUDI_NOTES = [
    ("ضريبة القيمة المضافة", "15% (نظام ضريبة القيمة المضافة). وعاء الضريبة = صافي المستخلص بعد استرداد الدفعة المقدمة، ويشمل المحتجزات "
                             "إذا فُوترت مع المستخلص، ولا تُخفضه غرامات التأخير افتراضياً — كلها قابلة للضبط في «بيانات العقد»."),
    ("الفاتورة الضريبية", "يُسجل رقم وتاريخ الفاتورة الضريبية لكل مستخلص. الفاتورة نفسها تُصدر من نظام فوترة إلكترونية متوافق مع "
                          "متطلبات «فاتورة» لهيئة الزكاة والضريبة والجمارك (رمز QR والربط في المرحلة الثانية) — المستخلص ليس بديلاً عنها."),
    ("الرقم الضريبي", "15 رقماً يبدأ وينتهي بالرقم 3 — مع تحقق آلي من الصيغة للمقاول وصاحب العمل."),
    ("الدفعة المقدمة", "في العقود الحكومية لا تتجاوز 10% من قيمة العقد وبمقابل ضمان بنكي مساوٍ لها، وتُسترد من المستخلصات."),
    ("الضمان النهائي", "5% من قيمة العقد (خطاب ضمان بنكي) مع تنبيه آلي قبل انتهاء الصلاحية بـ 30 يوماً."),
    ("غرامات التأخير", "حد أقصى قابل للضبط (افتراضياً 10% من قيمة العقد) مع تنبيه عند تجاوزه."),
    ("ضريبة الاستقطاع", "لا تُطبق على المقاول المقيم (0%)، وتُستخدم فقط للمدفوعات لغير المقيم وفق نظام ضريبة الدخل."),
    ("المستندات النظامية", "قائمة تحقق لكل مستخلص: الزكاة، التأمينات الاجتماعية (GOSI)، نطاقات، السجل التجاري والغرفة، الضمانات، التأمين (CAR)."),
    ("التاريخ الهجري", "تظهر فترة كل مستخلص بالتاريخ الهجري بجوار الميلادي."),
    ("تنبيه مهم", "النسب والحدود الافتراضية مبنية على الممارسة الشائعة؛ تُراجع مع شروط عقدك والمستشار القانوني والضريبي قبل الاعتماد."),
]
CONTRACT_TYPES = ["حكومي - نظام المنافسات والمشتريات الحكومية", "خاص - FIDIC", "خاص - عقد مقاولة"]
DOCS = ["الفاتورة الضريبية الإلكترونية (متوافقة مع فاتورة - ZATCA)", "شهادة الزكاة والضريبة سارية",
        "شهادة التأمينات الاجتماعية (GOSI) سارية", "شهادة نطاقات (التوطين) سارية",
        "السجل التجاري وعضوية الغرفة التجارية سارية", "محضر حصر الكميات معتمد من الاستشاري",
        "ضمان الدفعة المقدمة ساري", "الضمان النهائي ساري",
        "وثيقة التأمين على الأعمال (CAR) سارية", "تقرير الاستشاري الشهري"]


def add_months(d, m):
    y, mo = d.year + (d.month - 1 + m) // 12, (d.month - 1 + m) % 12 + 1
    return dt.date(y, mo, 1)


def sched_frac(sec, month, dur):
    """نسبة الكمية المخططة للقسم خلال الشهر (0-based)"""
    s, l = SEC_SCHED[sec]
    a, b = s * dur, (s + l) * dur
    lo, hi = max(month, a), min(month + 1, b)
    return max(0.0, hi - lo) / (b - a)


def project_items(p):
    sp = SAMPLE[p]
    return [(c, sec, d, u, round(q * sp["factor"], 0) if q > 50 else max(1, round(q * sp["factor"])), r)
            for c, sec, d, u, q, r in BOQ_ITEMS]


def planned_curve(p):
    sp = SAMPLE[p]
    items = project_items(p)
    tot = sum(i[4] * i[5] for i in items)
    cum, out = 0.0, []
    for m in range(sp["dur"]):
        cum += sum(i[4] * i[5] * sched_frac(i[1], m, sp["dur"]) for i in items)
        out.append(round(min(1.0, cum / tot), 4))
    return out


def actual_qty(p):
    """كميات الفترة الفعلية: {(row_index, ipc): qty}"""
    sp = SAMPLE[p]
    out = {}
    for i, it in enumerate(project_items(p)):
        done = 0.0
        for n in range(sp["n_ipc"]):
            f = sched_frac(it[1], n, sp["dur"]) * sp["perf"]
            q = round(min(it[4] - done, it[4] * f), 2)
            if q > 0.004:
                out[(i, n + 1)] = q
                done += q
    return out


# =====================================================================================
#                                  ملف المستخلصات (لكل مشروع)
# =====================================================================================
def build_cert(p, paid=None):
    sp = SAMPLE.get(p)
    wb = Workbook()
    wsG = wb.active
    wsG.title = S_GUIDE
    wsS = wb.create_sheet(S_SET)
    wsB = wb.create_sheet(S_BOQ)
    wsV = wb.create_sheet(S_VO)
    wsT = wb.create_sheet(S_TD)
    wsC = wb.create_sheet(S_BUD)
    wsR = wb.create_sheet(S_REG)
    ipc_ws = [wb.create_sheet(S_IPC(n)) for n in range(1, N_IPC + 1)]

    SUB = (f"=IF({R(S_SET)}$C$5=\"\",\"مشروع رقم {p:02d} — أدخل بيانات العقد\",{R(S_SET)}$C$5&\"   |   عقد رقم: \"&{R(S_SET)}$C$6)"
           f"&\"   |   المبالغ بـ \"&{R(S_SET)}$C$14")
    NAV = [("🗂 سجل المستخلصات", S_REG, NAVY), ("⚙ بيانات العقد", S_SET, TEAL), ("📋 جدول الكميات", S_BOQ, TEAL),
           ("🔁 التغييرية", S_VO, TEAL), ("✂ الاستقطاعات", S_TD, TEAL), ("💰 الموازنة", S_BUD, "6A1B9A"), ("🧾 مستخلص 01", S_IPC(1), GOLD)]

    def nav(ws, cols, skip):
        for col, (t, s, c) in zip(cols, [n for n in NAV if n[1] != skip]):
            button(ws, f"{col}3", t, s, c)

    # ------------------------------------------------------------- بيانات العقد
    ws = wsS
    setup(ws, {"A": 2, "B": 40, "C": 30, "D": 58, "E": 3, "F": 30, "G": 22, "H": 22, "I": 26}, NAVY2)
    banner(ws, "B", "I", f"⚙ بيانات العقد والإعدادات التعاقدية — مشروع رقم {p:02d}", SUB)
    nav(ws, ["B", "C", "D", "F", "G", "H"], S_SET)
    headers(ws, 4, [("B", "البيان"), ("C", "القيمة"), ("D", "ملاحظات / الأساس التعاقدي")], height=26)
    SETTINGS = [
        (5, "اسم المشروع", sp and sp["name"], None, "يظهر في جميع الشيتات وفي ملف التقارير المجمع", "in"),
        (6, "رقم العقد", sp and sp["no"], None, "", "in"),
        (7, "صاحب العمل (المالك)", sp and sp["owner"], None, "", "in"),
        (8, "الاستشاري / المهندس", sp and sp["eng"], None, "", "in"),
        (9, "المقاول", "شركة البناء الحديث للمقاولات" if sp else None, None, "", "in"),
        (10, "تاريخ توقيع العقد", sp and sp["start"] - dt.timedelta(days=14), DATE, "", "in"),
        (11, "تاريخ بدء الأعمال (أمر المباشرة)", sp and sp["start"], DATE, "بداية احتساب المدة الزمنية", "in"),
        (12, "مدة العقد (بالشهور)", sp and sp["dur"], "0", "", "in"),
        (13, "تاريخ الانتهاء التعاقدي", '=IF(OR(C11="",C12=""),"",EDATE(C11,C12)-1)', DATE, "محسوب = البدء + المدة", "f"),
        (14, "العملة", "ريال سعودي", None, "", "in"),
        (16, "قيمة العقد الأصلية", f"={R(S_BOQ)}H{BOQ_LAST+1}", ACC, "مرتبطة تلقائياً بإجمالي جدول الكميات", "link"),
        (17, "صافي الأوامر التغييرية المعتمدة",
         f"=SUMIFS({R(S_VO)}$G${VO_FIRST}:$G${VO_LAST},{R(S_VO)}$H${VO_FIRST}:$H${VO_LAST},\"معتمد\")", ACC,
         "مرتبطة بشيت الأوامر التغييرية (المعتمدة فقط)", "link"),
        (18, "قيمة العقد المعدلة", "=C16+C17", ACC, "الأصلية + صافي التغييرية المعتمدة", "f"),
        (20, "نسبة الدفعة المقدمة", 0.10, PCT, "من قيمة العقد الأصلية — في العقود الحكومية لا تتجاوز 10% وبمقابل ضمان بنكي مساوٍ لها", "in"),
        (21, "قيمة الدفعة المقدمة", "=C16*C20", ACC, "محسوبة", "f"),
        (22, "تاريخ صرف الدفعة المقدمة", sp and sp["start"] + dt.timedelta(days=9), DATE, "تُصدر عنها فاتورة ضريبية عند الاستلام، ويُخفض الاسترداد وعاء الضريبة في المستخلصات التالية", "in"),
        (23, "نسبة الاسترداد من قيمة الأعمال", 0.125, PCT, "تُخصم من كل مستخلص كنسبة من (الأعمال المنفذة + التغييرية)", "in"),
        (24, "بدء الاسترداد عند نسبة إنجاز", 0.0, PCT, "مثال FIDIC: يبدأ الاسترداد بعد تجاوز 10% من قيمة العقد", "in"),
        (25, "استرداد كامل الرصيد عند نسبة إنجاز", 0.80, PCT, "عند بلوغ هذه النسبة يُسترد كامل الرصيد المتبقي", "in"),
        (27, "نسبة ضمان الأعمال (المحتجزات)", 0.10, PCT, "تُحتجز من إجمالي قيمة الأعمال التراكمية", "in"),
        (28, "الحد الأقصى للضمان (% من العقد المعدل)", 0.05, PCT, "يتوقف الاحتجاز عند بلوغ الحد", "in"),
        (29, "الحد الأقصى للضمان (قيمة)", "=C18*C28", ACC, "محسوب", "f"),
        (31, "نسبة ضريبة القيمة المضافة", 0.15, PCT, "15% وفق نظام ضريبة القيمة المضافة في المملكة (منذ يوليو 2020)", "in"),
        (32, "احتساب الضريبة قبل خصم الضمان؟", "نعم", None, "نعم: الفاتورة الضريبية تصدر بكامل قيمة المستخلص شاملة المحتجزات — لا: تُفوتر المحتجزات وتُحتسب ضريبتها عند الإفراج", "in"),
        (33, "نسبة ضريبة الاستقطاع (للمقاول غير المقيم فقط)", 0.0, PCT, "0% للمقاول المقيم بالمملكة — تُطبق فقط على المدفوعات لغير المقيم وفق نظام ضريبة الدخل", "in"),
        (34, "خصم الغرامات من وعاء ض.ق.م؟", "لا", None, "لا: غرامات التأخير تعويض وليست تخفيضاً لقيمة التوريد فلا تُخفض وعاء الضريبة (راجع مستشارك الضريبي)", "in"),
        (36, "نوع العقد", sp and sp["ctype"], None, "يحدد المرجعية: نظام المنافسات والمشتريات الحكومية ولائحته التنفيذية أو شروط العقد الخاص (FIDIC)", "in"),
        (37, "الرقم الضريبي للمقاول", sp and sp["vat_c"], "@", "15 رقماً يبدأ وينتهي بالرقم 3 (يظهر في الفاتورة الضريبية)", "in"),
        (38, "السجل التجاري للمقاول", sp and sp["cr"], "@", "", "in"),
        (39, "الرقم الضريبي لصاحب العمل", sp and sp["vat_o"], "@", "مطلوب في الفاتورة الضريبية بين المنشآت (B2B)", "in"),
        (40, "نسبة الضمان النهائي", 0.05, PCT, "خطاب ضمان بنكي — 5% من قيمة العقد في العقود الحكومية (أو حسب العقد)", "in"),
        (41, "قيمة الضمان النهائي", "=C18*C40", ACC, "محسوبة على قيمة العقد المعدلة", "f"),
        (42, "تاريخ انتهاء الضمان النهائي", sp and add_months(sp["start"], sp["dur"] + 12), DATE, "تنبيه أحمر إذا تبقى أقل من 30 يوماً", "in"),
        (43, "تاريخ انتهاء ضمان الدفعة المقدمة", sp and add_months(sp["start"], 12) - dt.timedelta(days=1), DATE, "يجب أن يظل سارياً حتى استرداد الدفعة بالكامل", "in"),
        (44, "الحد الأقصى لغرامات التأخير (% من العقد)", 0.10, PCT, "حسب العقد / نظام المنافسات والمشتريات الحكومية ولائحته", "in"),
        (45, "قيمة الحد الأقصى للغرامات", "=C18*C44", ACC, "محسوبة", "f"),
        (46, "الغرامات المحتسبة حتى تاريخه", f"=-{R(S_IPC(N_IPC))}$L${FIN['pen']}", ACC, "تراكمي من آخر مستخلص", "link"),
        (47, "حالة الغرامات", '=IF(C46>C45,"⚠ تجاوزت الحد الأقصى","✔ ضمن الحد المسموح")', None, "", "f"),
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
    for r, t in [(15, "القيم التعاقدية"), (19, "الدفعة المقدمة واستردادها"), (26, "ضمان الأعمال"), (30, "الضرائب (هيئة الزكاة والضريبة والجمارك)"),
                 (35, "البيانات النظامية والضمانات البنكية (المملكة العربية السعودية)")]:
        section(ws, f"B{r}", t, f"B{r}:D{r}")
    dv_list(ws, '"نعم,لا"', "C32")
    dv_list(ws, '"نعم,لا"', "C34")
    dv_list(ws, '"' + ",".join(CONTRACT_TYPES) + '"', "C36")
    vdv = DataValidation(type="custom", formula1='AND(LEN(C37)=15,LEFT(C37,1)="3",RIGHT(C37,1)="3")', allow_blank=True)
    vdv.showErrorMessage, vdv.errorTitle, vdv.error = True, "رقم ضريبي غير صحيح", "الرقم الضريبي 15 رقماً يبدأ وينتهي بالرقم 3"
    ws.add_data_validation(vdv)
    vdv.add("C37")
    vdv.add("C39")
    for ref in ("C42", "C43"):
        ws.conditional_formatting.add(ref, FormulaRule(formula=[f'AND({ref}<>"",{ref}-TODAY()<=30)'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add("C47", FormulaRule(formula=['ISNUMBER(SEARCH("⚠",C47))'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add("C47", FormulaRule(formula=['ISNUMBER(SEARCH("✔",C47))'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
    dv_num(ws, "C20 C23:C25 C27:C28 C31 C33", lo=0, hi=1, msg="أدخل النسبة (مثال: 10%)")
    dv_date(ws, "C10:C11 C22 C42:C43")
    for name, ref in [("ContractValue", "C16"), ("VOApproved", "C17"), ("RevisedContract", "C18"),
                      ("AdvPct", "C20"), ("AdvAmount", "C21"), ("RecRate", "C23"), ("RecStart", "C24"),
                      ("RecFull", "C25"), ("RetPct", "C27"), ("RetCap", "C29"), ("VATPct", "C31"),
                      ("VATBeforeRet", "C32"), ("WHTPct", "C33"), ("PenInVAT", "C34"), ("PenCap", "C45"), ("StartDate", "C11"), ("EndDate", "C13"), ("AdvDate", "C22")]:
        add_name(wb, name, f"{R(S_SET)}${ref[0]}${ref[1:]}")
    section(ws, "F4", "القوائم المنسدلة (قابلة للتعديل)", "F4:I4", NAVY2)
    for col, title, items in [("F", "أقسام الأعمال", SECTIONS), ("G", "حالة المستخلص", IPC_STATUS),
                              ("H", "حالة الأمر التغييري", VO_STATUS), ("I", "نوع الاستقطاع الفني", TD_TYPE)]:
        put(ws, f"{col}5", title, font(10, True, "FFFFFF"), fill(TEAL), align("center", wrap=True), BORDER)
        for i in range(N_SEC):
            c = ws[f"{col}{6+i}"]
            c.value = items[i] if i < len(items) else None
            inp(c, al=align("right", indent=1))
    add_name(wb, "L_Sections", f"{R(S_SET)}$F$6:$F$17")
    add_name(wb, "L_IPCStatus", f"{R(S_SET)}$G$6:$G$17")
    add_name(wb, "L_VOStatus", f"{R(S_SET)}$H$6:$H$17")
    add_name(wb, "L_TDType", f"{R(S_SET)}$I$6:$I$17")
    ws.freeze_panes = "A5"

    # ------------------------------------------------------------- جدول الكميات
    ws = wsB
    items = project_items(p) if sp else []
    setup(ws, {"A": 6, "B": 11, "C": 24, "D": 52, "E": 8, "F": 13, "G": 14, "H": 18, "I": 10}, TEAL)
    banner(ws, "A", "I", "📋 جدول الكميات والأسعار التعاقدي (BOQ)", SUB)
    nav(ws, ["A", "B", "C", "D", "F", "G"], S_BOQ)
    put(ws, "A4", "أدخل بنود العقد في الخلايا الصفراء فقط (حتى 100 بند) — الإجمالي يغذي قيمة العقد وكل المستخلصات تلقائياً.",
        font(9, False, GREY_TXT, True), merge="A4:I4", al=align("right"))
    headers(ws, 5, [("A", "م"), ("B", "كود البند"), ("C", "القسم"), ("D", "وصف البند"), ("E", "الوحدة"),
                    ("F", "الكمية التعاقدية"), ("G", "سعر الوحدة"), ("H", "الإجمالي"), ("I", "الوزن النسبي")])
    T = BOQ_LAST + 1
    for i, r in enumerate(range(BOQ_FIRST, BOQ_LAST + 1)):
        it = items[i] if i < len(items) else None
        ws[f"A{r}"] = f'=IF(B{r}="","",COUNTA($B${BOQ_FIRST}:B{r}))'
        calc(ws[f"A{r}"], color=GREY_TXT)
        for col, val, fmt, al in [("B", it and it[0], None, None), ("C", it and SECTIONS[it[1]], None, align("right", indent=1)),
                                  ("D", it and it[2], None, align("right", wrap=True, indent=1)), ("E", it and it[3], None, None),
                                  ("F", it and it[4], QTY, None), ("G", it and it[5], QTY, None)]:
            ws[f"{col}{r}"] = val
            inp(ws[f"{col}{r}"], fmt, al)
        ws[f"H{r}"] = f"=F{r}*G{r}"
        calc(ws[f"H{r}"], QTY)
        ws[f"I{r}"] = f"=IF($H${T}>0,H{r}/$H${T},0)"
        calc(ws[f"I{r}"], '0.00%;-0.00%;;@')
    put(ws, f"A{T}", "إجمالي قيمة العقد الأصلية", font(11, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"A{T}:G{T}")
    put(ws, f"H{T}", f"=SUM(H{BOQ_FIRST}:H{BOQ_LAST})", font(11, True, "FFFFFF"), fill(NAVY), align("center"), fmt=ACC)
    put(ws, f"I{T}", f"=SUM(I{BOQ_FIRST}:I{BOQ_LAST})", font(11, True, "FFFFFF"), fill(NAVY), align("center"), fmt=PCT)
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

    # ------------------------------------------------------------- الأوامر التغييرية
    ws = wsV
    vos = sp["vos"] if sp else []
    setup(ws, {"A": 5, "B": 11, "C": 12, "D": 48, "E": 9, "F": 16, "G": 16, "H": 13, "I": 16, "J": 16,
               "K": 12, "L": 30}, "7B4F9D")
    banner(ws, "A", "L", "🔁 سجل الأوامر التغييرية (Variation Orders)", SUB)
    nav(ws, ["A", "B", "C", "D", "F", "G"], S_VO)
    put(ws, "A4", "«قيمة الأمر» تعدّل قيمة العقد عند الاعتماد — «القيمة المدرجة» تُصرف في المستخلص المحدد "
                  "(للصرف على دفعات: كرر الأمر في سطر جديد بقيمة أمر = 0 ومستخلص مختلف).",
        font(9, False, GREY_TXT, True), merge="A4:L4", al=align("right", wrap=True))
    ws.row_dimensions[4].height = 28
    headers(ws, 5, [("A", "م"), ("B", "رقم الأمر"), ("C", "تاريخ الأمر"), ("D", "وصف الأمر التغييري"),
                    ("E", "النوع"), ("F", "قيمة الأمر"), ("G", "الأثر على العقد (±)"), ("H", "الحالة"),
                    ("I", "القيمة المدرجة بالمستخلص"), ("J", "الأثر على المستخلص (±)"),
                    ("K", "رقم المستخلص المدرج به"), ("L", "ملاحظات")])
    for i, r in enumerate(range(VO_FIRST, VO_LAST + 1)):
        v = vos[i] if i < len(vos) else (None,) * 8
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
    put(ws, f"H{T}", f'="معتمد: "&COUNTIF(H{VO_FIRST}:H{VO_LAST},"معتمد")', font(10, True, "FFFFFF"), fill(NAVY), align("center"))
    dv_list(ws, '"إضافة,خصم"', f"E{VO_FIRST}:E{VO_LAST}")
    dv_list(ws, "=L_VOStatus", f"H{VO_FIRST}:H{VO_LAST}")
    dv_num(ws, f"K{VO_FIRST}:K{VO_LAST}", "whole", 1, N_IPC, f"رقم المستخلص من 1 إلى {N_IPC}")
    dv_num(ws, f"F{VO_FIRST}:F{VO_LAST} I{VO_FIRST}:I{VO_LAST}", lo=0, msg="أدخل القيمة موجبة واختر النوع إضافة/خصم")
    dv_date(ws, f"C{VO_FIRST}:C{VO_LAST}")
    rng = f"A{VO_FIRST}:L{VO_LAST}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="معتمد"'], fill=fill(GREEN_L)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="قيد الدراسة"'], fill=fill(GOLD_L)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{VO_FIRST}="مرفوض"'], fill=fill(RED_L),
                                                   font=Font(strike=True, color=RED)))
    ws.freeze_panes = f"C{VO_FIRST}"
    ws.auto_filter.ref = f"A5:L{VO_LAST}"

    # ------------------------------------------------------------- الاستقطاعات الفنية
    ws = wsT
    tds = sp["tds"] if sp else []
    setup(ws, {"A": 5, "B": 11, "C": 12, "D": 11, "E": 11, "F": 38, "G": 42, "H": 20, "I": 15, "J": 11,
               "K": 12, "L": 15, "M": 26}, "C0504D")
    banner(ws, "A", "M", "✂ سجل الاستقطاعات الفنية (Technical Deductions)", SUB)
    nav(ws, ["A", "B", "C", "D", "F", "G"], S_TD)
    put(ws, "A4", "يُخصم المبلغ من المستخلص المحدد ويستمر محتجزاً تراكمياً حتى يتم الإفراج عنه في «مستخلص الإفراج».",
        font(9, False, GREY_TXT, True), merge="A4:M4", al=align("right"))
    headers(ws, 5, [("A", "م"), ("B", "رقم الاستقطاع"), ("C", "التاريخ"), ("D", "رقم المستخلص"), ("E", "كود البند"),
                    ("F", "وصف البند (آلي)"), ("G", "سبب الاستقطاع"), ("H", "نوع الاستقطاع"), ("I", "المبلغ المستقطع"),
                    ("J", "تم الإفراج؟"), ("K", "مستخلص الإفراج"), ("L", "الرصيد المحتجز"), ("M", "ملاحظات")])
    for i, r in enumerate(range(TD_FIRST, TD_LAST + 1)):
        t = tds[i] if i < len(tds) else (None,) * 9
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
    dv_list(ws, f"={R(S_BOQ)}$B${BOQ_FIRST}:$B${BOQ_LAST}", f"E{TD_FIRST}:E{TD_LAST}")
    dv_list(ws, "=L_TDType", f"H{TD_FIRST}:H{TD_LAST}")
    dv_list(ws, '"نعم,لا"', f"J{TD_FIRST}:J{TD_LAST}")
    dv_num(ws, f"D{TD_FIRST}:D{TD_LAST} K{TD_FIRST}:K{TD_LAST}", "whole", 1, N_IPC, f"رقم المستخلص من 1 إلى {N_IPC}")
    dv_num(ws, f"I{TD_FIRST}:I{TD_LAST}", lo=0)
    dv_date(ws, f"C{TD_FIRST}:C{TD_LAST}")
    rng = f"A{TD_FIRST}:M{TD_LAST}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$J{TD_FIRST}="نعم"'], fill=fill(GREEN_L)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'AND($J{TD_FIRST}<>"نعم",N($I{TD_FIRST})>0)'], fill=fill(RED_L)))
    ws.freeze_panes = f"C{TD_FIRST}"
    ws.auto_filter.ref = f"A5:M{TD_LAST}"

    # ------------------------------------------------------------- شيتات المستخلصات 1..20
    plan = planned_curve(p) if sp else []
    aq = actual_qty(p) if sp else {}
    n_act = sp["n_ipc"] if sp else 0
    VS, TS, BS = R(S_VO), R(S_TD), R(S_BOQ)
    for n, ws in enumerate(ipc_ws, 1):
        prev = R(S_IPC(n - 1)) if n > 1 else None
        active = n <= n_act
        setup(ws, {"A": 2, "B": 10, "C": 38, "D": 8, "E": 12, "F": 12, "G": 12, "H": 12, "I": 12, "J": 10,
                   "K": 16, "L": 16, "M": 17, "N": 2}, GOLD if active else "BFBFBF", zoom=85)
        ws.page_setup.orientation = "portrait"
        banner(ws, "B", "M", f"🧾 مستخلص أعمال رقم ({n}) — شهادة دفع مؤقتة (Interim Payment Certificate)", SUB)
        nav(ws, ["B", "C", "E", "G", "I"], S_IPC(1))
        if n > 1:
            button(ws, "K3", "◄ المستخلص السابق", S_IPC(n - 1), GOLD)
        if n < N_IPC:
            button(ws, "L3", "المستخلص التالي ►", S_IPC(n + 1), GOLD)
        # --- بيانات المستخلص
        p_from = add_months(sp["start"], n - 1) if active else None
        p_to = (add_months(sp["start"], n) - dt.timedelta(days=1)) if active else None
        in_review = active and n in sp["review"]
        appr = (p_to + dt.timedelta(days=20 + n % 3)) if active and not in_review else None
        info = [(5, "رقم المستخلص", n), (6, "المشروع", f"={R(S_SET)}C5"), (7, "رقم العقد", f"={R(S_SET)}C6"),
                (8, "صاحب العمل", f"={R(S_SET)}C7"), (9, "الاستشاري", f"={R(S_SET)}C8"), (10, "المقاول", f"={R(S_SET)}C9")]
        for r, lab, v in info:
            put(ws, f"B{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
            put(ws, f"C{r}", v, font(12 if r == 5 else 10, True, GOLD if r == 5 else LINK_FONT), None,
                align("right", indent=1), BORDER, '"مستخلص رقم "0' if r == 5 else None, merge=f"C{r}:G{r}")
        info2 = [(5, "حالة المستخلص", ("تحت المراجعة" if in_review else "معتمد") if active else None, None),
                 (6, "الفترة من", p_from, DATE), (7, "الفترة إلى", p_to, DATE),
                 (8, "تاريخ التقديم", p_to and p_to + dt.timedelta(days=5), DATE), (9, "تاريخ الاعتماد", appr, DATE)]
        for r, lab, v, fmt in info2:
            put(ws, f"H{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"H{r}:I{r}")
            put(ws, f"J{r}", v, merge=f"J{r}:K{r}")
            for cc in ("J", "K"):
                inp(ws[f"{cc}{r}"], fmt)
        put(ws, "H10", "قيمة العقد المعدلة", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge="H10:I10")
        put(ws, "J10", "=RevisedContract", font(10, True, LINK_FONT), None, align("center"), BORDER, ACC, merge="J10:K10")
        dv_list(ws, "=L_IPCStatus", "J5")
        dv_date(ws, "J6:J9")
        for r, lab, v, fmt, is_in in [(5, "نسبة الإنجاز الفعلية",
                                       f"=IF(ContractValue+L{FIN['vo']}>0,(L{FIN['work']}+L{FIN['vo']})/(ContractValue+L{FIN['vo']}),0)", PCT, False),
                                      (7, "نسبة الإنجاز المخططة (من البرنامج)", plan[n - 1] if n <= len(plan) else None, PCT, True),
                                      (9, "الانحراف عن المخطط", '=IF(L8="","",L6-L8)', PCT, False)]:
            put(ws, f"L{r}", lab, font(9, True, GREY_TXT), fill(ALT), align("center", wrap=True), BORDER, merge=f"L{r}:M{r}")
            put(ws, f"L{r+1}", v, font(15, True, TEAL), None, align("center"), BORDER, fmt, merge=f"L{r+1}:M{r+1}")
            if is_in:
                for cc in ("L", "M"):
                    inp(ws[f"{cc}{r+1}"], fmt)
                ws[f"L{r+1}"].font = font(15, True, INPUT_FONT)
        dv_num(ws, "L8", lo=0, hi=1, msg="النسبة التراكمية المخططة حتى نهاية هذا المستخلص")
        ws.conditional_formatting.add("L10", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=RED, bold=True)))
        put(ws, "B11", "الرقم الضريبي للمقاول", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
        put(ws, "C11", f'=IF({R(S_SET)}C37="","",{R(S_SET)}C37)', font(10, True, LINK_FONT), None, align("right", indent=1),
            BORDER, merge="C11:G11")
        put(ws, "H11", "الفترة بالتاريخ الهجري", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge="H11:I11")
        for cc, src in (("J", "J6"), ("K", "J7")):
            put(ws, f"{cc}11", f'=IF({src}="","",{src})', font(9, True, GREY_TXT), None, align("center"), BORDER, "B2yyyy/mm/dd")
        # --- مدخلات الفترة
        section(ws, "B12", "أولاً: بيانات الفترة (إدخال)", "B12:M12", NAVY2)
        mat = sp["materials"][n - 1] if active and n - 1 < len(sp["materials"]) else None
        pen = sp["pen"].get(n) if active else None
        paid_v = paid.get(n) if (paid and active) else None
        paid_d = (appr + dt.timedelta(days=25 + (n * 7) % 16)) if (paid_v and appr) else None
        ins = [(13, "B", "رصيد المواد الموردة بالموقع (نهاية الفترة)", "E", mat, ACC),
               (13, "H", "إفراج عن ضمان الأعمال خلال الفترة", "K", None, ACC),
               (14, "B", "غرامات تأخير / خصومات أخرى خلال الفترة", "E", pen, ACC),
               (14, "H", "سبب الغرامة / الخصم", "K", "مخالفة اشتراطات السلامة بالموقع" if pen else None, None),
               (15, "B", "المبلغ المحصل من هذا المستخلص", "E", paid_v, ACC),
               (15, "H", "تاريخ التحصيل", "K", paid_d, DATE),
               (16, "B", "رقم الفاتورة الضريبية (من نظام الفوترة الإلكترونية)", "E",
                f"INV-{appr.year}-{p:02d}{n:03d}" if appr else None, "@"),
               (16, "H", "تاريخ الفاتورة الضريبية", "K", appr, DATE)]
        for r, lc, lab, vc, v, fmt in ins:
            le = "D" if lc == "B" else "J"
            ve = "F" if vc == "E" else "M"
            put(ws, f"{lc}{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"{lc}{r}:{le}{r}")
            put(ws, f"{vc}{r}", v, merge=f"{vc}{r}:{ve}{r}")
            for ci in range(ws[f"{vc}1"].column, ws[f"{ve}1"].column + 1):
                inp(ws.cell(r, ci), fmt)
            ws.row_dimensions[r].height = 20
        dv_num(ws, "E13 K13 E14 E15", lo=0)
        dv_date(ws, "K15 K16")
        # --- الملخص المالي
        section(ws, "B17", "ثانياً: الملخص المالي للمستخلص", "B17:M17", NAVY2)
        put(ws, "B18", "م", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
        put(ws, "C18", "البيان", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge="C18:G18")
        for col, t, mg in [("H", "السابق", "H18:I18"), ("J", "الحالي", "J18:K18"), ("L", "الإجمالي التراكمي", "L18:M18")]:
            put(ws, f"{col}18", t, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=mg)
        F_ = FIN
        lines = [
            ("work", "قيمة الأعمال المنفذة طبقاً لحصر البنود", f"=M{D_TOT}", "n"),
            ("vo", "قيمة الأوامر التغييرية المعتمدة",
             f'=SUMIFS({VS}$J${VO_FIRST}:$J${VO_LAST},{VS}$H${VO_FIRST}:$H${VO_LAST},"معتمد",{VS}$K${VO_FIRST}:$K${VO_LAST},"<="&$C$5)', "n"),
            ("mat", "المواد الموردة بالموقع (رصيد)", "=N(E13)", "n"),
            ("gross", "إجمالي قيمة الأعمال", f"=SUM(L{F_['work']}:L{F_['mat']})", "t"),
            ("adv", "يُخصم: استرداد الدفعة المقدمة",
             f"=-ROUND(IF(L6>=RecFull,AdvAmount,MIN(AdvAmount,MAX(0,L{F_['work']}+L{F_['vo']}-RecStart*ContractValue)*RecRate)),2)", "d"),
            ("ret", "يُخصم: ضمان الأعمال المحتسب", f"=-ROUND(MIN(L{F_['gross']}*RetPct,RetCap),2)", "d"),
            ("rel", "يُضاف: المفرج عنه من ضمان الأعمال", f"=H{F_['rel']}+N(K13)", "n"),
            ("td", "يُخصم: الاستقطاعات الفنية المحتجزة",
             f'=-(SUMIFS({TS}$I${TD_FIRST}:$I${TD_LAST},{TS}$D${TD_FIRST}:$D${TD_LAST},"<="&$C$5)'
             f'-SUMIFS({TS}$I${TD_FIRST}:$I${TD_LAST},{TS}$J${TD_FIRST}:$J${TD_LAST},"نعم",{TS}$K${TD_FIRST}:$K${TD_LAST},"<="&$C$5))', "d"),
            ("pen", "يُخصم: الغرامات والخصومات الأخرى", f"=H{F_['pen']}-N(E14)", "d"),
            ("net", "صافي القيمة قبل الضرائب", f"=SUM(L{F_['gross']}:L{F_['pen']})", "t"),
            ("vat", "يُضاف: ضريبة القيمة المضافة",
             f'=ROUND(VATPct*(L{F_["net"]}+IF(VATBeforeRet="نعم",-(L{F_["ret"]}+L{F_["rel"]}),0)'
             f'+IF(PenInVAT="لا",-L{F_["pen"]},0)),2)', "n"),
            ("wht", "يُخصم: ضريبة الاستقطاع (غير المقيم)", f"=-ROUND(WHTPct*(L{F_['net']}-(L{F_['ret']}+L{F_['rel']})),2)", "d"),
            ("due", "صافي المستحق", f"=L{F_['net']}+L{F_['vat']}+L{F_['wht']}", "g"),
        ]
        for i, (key, lab, cum, st) in enumerate(lines):
            r = F_[key]
            bg = {"n": None, "d": None, "t": TOTAL_BG, "g": NAVY}[st]
            fc = {"n": "1F2933", "d": RED, "t": "1F2933", "g": "FFFFFF"}[st]
            bold = st in ("t", "g")
            fl_ = fill(bg) if bg else None
            put(ws, f"B{r}", i + 1, font(10, bold, fc), fl_, align("center"), BORDER)
            put(ws, f"C{r}", lab, font(10, bold, fc), fl_, align("right", indent=1), BORDER, merge=f"C{r}:G{r}")
            put(ws, f"H{r}", f"={prev}L{r}" if prev else 0, font(10, bold, LINK_FONT if (prev and st != "g") else fc), fl_,
                align("center"), BORDER, ACC, merge=f"H{r}:I{r}")
            put(ws, f"L{r}", cum, font(10, bold, fc), fl_, align("center"), BORDER, ACC, merge=f"L{r}:M{r}")
            put(ws, f"J{r}", f"=L{r}-H{r}", font(10, True, fc), fl_ or fill("F7FBFF"), align("center"), BORDER, ACC, merge=f"J{r}:K{r}")
            ws.row_dimensions[r].height = 20
        put(ws, "B32", "صافي المبلغ المستحق صرفه عن هذا المستخلص", font(13, True, "FFFFFF"), fill(TEAL), align("center"), merge="B32:I32")
        put(ws, "J32", f"=J{F_['due']}", font(15, True, "FFFFFF"), fill(TEAL), align("center"), fmt=ACC, merge="J32:M32")
        ws.row_dimensions[32].height = 32
        put(ws, "B33", "المحصل من هذا المستخلص", font(10, True, GREEN), fill(GREEN_L), align("right", indent=1), BORDER, merge="B33:I33")
        put(ws, "J33", "=N(E15)", font(11, True, GREEN), fill(GREEN_L), align("center"), BORDER, ACC, merge="J33:M33")
        put(ws, "B34", "المتبقي غير المحصل", font(10, True, RED), fill(RED_L), align("right", indent=1), BORDER, merge="B34:I34")
        put(ws, "J34", "=J32-J33", font(11, True, RED), fill(RED_L), align("center"), BORDER, ACC, merge="J34:M34")
        put(ws, "B35", "فقط وقدره:", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
        put(ws, "C35", None, merge="C35:M35")
        for ci in range(3, 14):
            inp(ws.cell(35, ci), al=align("right", indent=1))
        # --- المستندات المطلوبة للصرف (متطلبات نظامية)
        section(ws, f"B{DOC_ROW}", "ثالثاً: المستندات والمتطلبات النظامية للصرف (المملكة العربية السعودية)", f"B{DOC_ROW}:M{DOC_ROW}", NAVY2)
        for i, d in enumerate(DOCS):
            r = DOC_ROW + 1 + i // 2
            lc, le, vc, ve = ("B", "E", "F", "G") if i % 2 == 0 else ("H", "K", "L", "M")
            put(ws, f"{lc}{r}", d, font(9, True, NAVY), fill(ALT), align("right", indent=1, wrap=True), BORDER, merge=f"{lc}{r}:{le}{r}")
            put(ws, f"{vc}{r}", ("نعم" if (active and (appr or i >= 5)) else None), merge=f"{vc}{r}:{ve}{r}")
            for ci in range(ws[f"{vc}1"].column, ws[f"{ve}1"].column + 1):
                inp(ws.cell(r, ci))
            ws.row_dimensions[r].height = 22
        d1, d2 = DOC_ROW + 1, DOC_ROW + 5
        DOC_A, DOC_B = f"F{d1}:F{d2}", f"L{d1}:L{d2}"
        dv_list(ws, '"نعم,لا,غير مطلوب"', f"F{d1}:G{d2} L{d1}:M{d2}")
        for rng_ in (f"F{d1}:G{d2}", f"L{d1}:M{d2}"):
            ws.conditional_formatting.add(rng_, FormulaRule(formula=[f'{rng_.split(":")[0]}="لا"'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
            ws.conditional_formatting.add(rng_, FormulaRule(formula=[f'{rng_.split(":")[0]}="نعم"'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
        rs = DOC_ROW + 6
        put(ws, f"B{rs}", "حالة المستندات:", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"B{rs}:D{rs}")
        put(ws, f"E{rs}", (f'=IF(COUNTIF({DOC_A},"لا")+COUNTIF({DOC_B},"لا")+COUNTBLANK({DOC_A})+COUNTBLANK({DOC_B})=0,'
                           f'"✔ مكتملة — جاهز للصرف","⚠ ناقص "&(COUNTIF({DOC_A},"لا")+COUNTIF({DOC_B},"لا")+COUNTBLANK({DOC_A})+COUNTBLANK({DOC_B}))&" مستند")'),
            font(10, True, GOLD), None, align("center"), BORDER, merge=f"E{rs}:G{rs}")
        put(ws, f"H{rs}", "الرقم الضريبي لصاحب العمل:", font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"H{rs}:J{rs}")
        put(ws, f"K{rs}", f'=IF({R(S_SET)}C39="","",{R(S_SET)}C39)', font(10, True, LINK_FONT), None, align("center"), BORDER, merge=f"K{rs}:M{rs}")
        ws.conditional_formatting.add(f"E{rs}", FormulaRule(formula=[f'ISNUMBER(SEARCH("✔",E{rs}))'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
        ws.conditional_formatting.add(f"E{rs}", FormulaRule(formula=[f'ISNUMBER(SEARCH("⚠",E{rs}))'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
        # --- الاعتمادات
        section(ws, f"B{SIG_ROW}", "رابعاً: الاعتمادات", f"B{SIG_ROW}:M{SIG_ROW}", NAVY2)
        for col, c2_, t in [("B", "E", "إعداد: مهندس المقاول"), ("F", "I", "مراجعة: المهندس الاستشاري"),
                            ("J", "M", "اعتماد: صاحب العمل")]:
            put(ws, f"{col}{SIG_ROW+1}", t, font(10, True, NAVY), fill(ALT), align("center"), BORDER, merge=f"{col}{SIG_ROW+1}:{c2_}{SIG_ROW+1}")
            put(ws, f"{col}{SIG_ROW+2}", "الاسم: ....................\nالتوقيع: ..................\nالتاريخ: ..................",
                font(9, False, GREY_TXT), None, align("right", "top", True, 1), BORDER, merge=f"{col}{SIG_ROW+2}:{c2_}{SIG_ROW+2}")
        ws.row_dimensions[SIG_ROW + 2].height = 60
        # --- حصر البنود
        section(ws, f"B{BOQ_SEC}", "خامساً: حصر الأعمال المنفذة حسب بنود جدول الكميات — أدخل «الكمية الحالية» فقط", f"B{BOQ_SEC}:M{BOQ_SEC}", NAVY2)
        headers(ws, BOQ_SEC + 1, [("B", "كود البند"), ("C", "الوصف"), ("D", "الوحدة"), ("E", "الكمية التعاقدية"),
                                  ("F", "سعر الوحدة"), ("G", "الكمية السابقة"), ("H", "الكمية الحالية"),
                                  ("I", "الكمية التراكمية"), ("J", "نسبة الإنجاز"), ("K", "القيمة السابقة"),
                                  ("L", "القيمة الحالية"), ("M", "القيمة التراكمية")])
        ws[f"H{BOQ_SEC+1}"].fill = fill("8C6D1F")
        for i in range(D_LAST - D_FIRST + 1):
            r, q = D_FIRST + i, BOQ_FIRST + i
            for col, f, fmt, al in [("B", f'=IF({BS}B{q}="","",{BS}B{q})', None, None),
                                    ("C", f'=IF({BS}D{q}="","",{BS}D{q})', None, align("right", wrap=True, indent=1)),
                                    ("D", f'=IF({BS}E{q}="","",{BS}E{q})', None, None),
                                    ("E", f"=N({BS}F{q})", QTY, None), ("F", f"=N({BS}G{q})", QTY, None)]:
                ws[f"{col}{r}"] = f
                calc(ws[f"{col}{r}"], fmt, al, color=LINK_FONT)
                ws[f"{col}{r}"].font = font(9, False, LINK_FONT)
            ws[f"G{r}"] = f"={prev}I{r}" if prev else 0
            calc(ws[f"G{r}"], QTY, color=LINK_FONT)
            ws[f"H{r}"] = aq.get((i, n))
            inp(ws[f"H{r}"], QTY)
            for col, f, fmt in [("I", f"=G{r}+H{r}", QTY), ("J", f"=IF(E{r}>0,I{r}/E{r},0)", '0.0%;[Red]-0.0%;;@'),
                                ("K", f"=G{r}*F{r}", QTY), ("L", f"=N(H{r})*F{r}", QTY), ("M", f"=I{r}*F{r}", QTY)]:
                ws[f"{col}{r}"] = f
                calc(ws[f"{col}{r}"], fmt, bold=col in ("L",), fl="F7FBFF" if col == "L" else None)
                ws[f"{col}{r}"].font = font(9, col == "L")
        put(ws, f"B{D_TOT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{D_TOT}:J{D_TOT}")
        for col in "KLM":
            put(ws, f"{col}{D_TOT}", f"=SUM({col}{D_FIRST}:{col}{D_LAST})", font(10, True, "FFFFFF"), fill(NAVY),
                align("center"), BORDER, ACC)
        dv_num(ws, f"H{D_FIRST}:H{D_LAST}", lo=-1e12, msg="كمية هذه الفترة فقط (السالب للتصحيح)")
        ws.conditional_formatting.add(f"B{D_FIRST}:M{D_LAST}", FormulaRule(formula=[f"N($H{D_FIRST})<>0"], fill=fill("FFF9E6")))
        ws.conditional_formatting.add(f"I{D_FIRST}:J{D_LAST}", FormulaRule(formula=[f"$I{D_FIRST}>$E{D_FIRST}+0.0001"],
                                                                           fill=fill(RED_L), font=Font(color=RED, bold=True)))
        ws.conditional_formatting.add(f"J{D_FIRST}:J{D_LAST}",
                                      DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
        ws.print_area = f"B1:M{D_TOT}"
        ws.print_title_rows = f"{BOQ_SEC+1}:{BOQ_SEC+1}"
        ws.row_breaks.append(Break(id=BOQ_SEC - 1))
        ws.freeze_panes = "A4"

    # ------------------------------------------------------------- سجل المستخلصات (يغذي ملف التقارير)
    ws = wsR
    REG_COLS = [
        ("A", "رقم المستخلص", 9, "0"), ("B", "الفترة من", 11.5, DATE), ("C", "الفترة إلى", 11.5, DATE),
        ("D", "تاريخ التقديم", 11.5, DATE), ("E", "تاريخ الاعتماد", 11.5, DATE), ("F", "حالة المستخلص", 13, None),
        ("G", "قيمة الأعمال المنفذة التراكمية", 16, ACC), ("H", "أعمال الفترة", 15, ACC),
        ("I", "الأوامر التغييرية التراكمية", 15, ACC), ("J", "رصيد المواد بالموقع", 15, ACC),
        ("K", "إجمالي القيمة التراكمية", 16, ACC), ("L", "نسبة الإنجاز الفعلية", 10, PCT),
        ("M", "نسبة الإنجاز المخططة", 10, PCT), ("N", "الانحراف عن المخطط", 10, PCT),
        ("O", "استرداد الدفعة المقدمة التراكمي", 15, ACC), ("P", "ضمان الأعمال المحتسب", 15, ACC),
        ("Q", "المفرج عنه من الضمان", 14, ACC), ("R", "صافي الضمان المحتجز", 15, ACC),
        ("S", "الاستقطاعات الفنية المحتجزة", 14, ACC), ("T", "الغرامات والخصومات التراكمية", 14, ACC),
        ("U", "الصافي التراكمي قبل الضرائب", 16, ACC), ("V", "ضريبة القيمة المضافة", 14, ACC),
        ("W", "ضريبة الاستقطاع (غير المقيم)", 13, ACC), ("X", "صافي المستحق التراكمي", 16, ACC),
        ("Y", "المعتمد في المستخلصات السابقة", 16, ACC), ("Z", "صافي المستحق للمستخلص الحالي", 16, ACC),
        ("AA", "المبلغ المحصل", 15, ACC), ("AB", "تاريخ التحصيل", 11.5, DATE),
        ("AC", "المتبقي غير المحصل", 15, ACC), ("AD", "مدة التحصيل (يوم)", 10, '0;-0;"-"'), ("AE", "حالة التحصيل", 15, None),
        ("AF", "رقم الفاتورة الضريبية", 17, "@"), ("AG", "حالة المستندات النظامية", 20, None),
    ]
    setup(ws, {k: w for k, _, w, _ in REG_COLS}, NAVY, zoom=85)
    banner(ws, "A", "AE", f"🗂 سجل المستخلصات — مشروع رقم {p:02d} (يُحدَّث آلياً من شيتات المستخلصات ويغذي ملف التقارير)", SUB)
    nav(ws, ["B", "D", "F", "H", "J"], S_REG)
    for a, b, t, colr in [("A", "F", "بيانات المستخلص", NAVY2), ("G", "N", "قيمة الأعمال ونسب الإنجاز", TEAL),
                          ("O", "T", "الاستقطاعات (تراكمي)", "C0504D"), ("U", "Z", "صافي المستحق والضرائب", NAVY),
                          ("AA", "AE", "التحصيل", GREEN), ("AF", "AG", "الفوترة والمستندات", GOLD)]:
        put(ws, f"{a}4", t, font(10, True, "FFFFFF"), fill(colr), align("center"), BORDER, merge=f"{a}4:{b}4")
    headers(ws, 5, [(k, t) for k, t, _, _ in REG_COLS], height=58)
    for n in range(1, N_IPC + 1):
        r = REG_FIRST + n - 1
        S = R(S_IPC(n))
        a = f'{S}$J$7=""'
        d = lambda ref: f'=IF(OR({a},{S}{ref}=""),"",{S}{ref})'
        L = lambda key: f"{S}$L${FIN[key]}"
        F = {
            "B": d("$J$6"), "C": f'=IF({a},"",{S}$J$7)', "D": d("$J$8"), "E": d("$J$9"), "F": d("$J$5"),
            "G": f'=IF({a},"",{L("work")})', "H": f'=IF({a},"",{S}$J${FIN["work"]})', "I": f'=IF({a},"",{L("vo")})',
            "J": f'=IF({a},"",{L("mat")})', "K": f'=IF({a},"",{L("gross")})', "L": f'=IF({a},"",{S}$L$6)',
            "M": d("$L$8"), "N": f'=IF(OR({a},M{r}=""),"",L{r}-M{r})',
            "O": f'=IF({a},"",-{L("adv")})', "P": f'=IF({a},"",-{L("ret")})', "Q": f'=IF({a},"",{L("rel")})',
            "R": f'=IF({a},"",P{r}-Q{r})', "S": f'=IF({a},"",-{L("td")})', "T": f'=IF({a},"",-{L("pen")})',
            "U": f'=IF({a},"",{L("net")})', "V": f'=IF({a},"",{L("vat")})', "W": f'=IF({a},"",-{L("wht")})',
            "X": f'=IF({a},"",{L("due")})', "Y": f'=IF({a},"",{S}$H${FIN["due"]})', "Z": f'=IF({a},"",{S}$J${FIN["due"]})',
            "AA": f'=IF({a},"",N({S}$E$15))', "AB": d("$K$15"), "AC": f'=IF({a},"",Z{r}-AA{r})',
            "AD": f'=IF(OR(AB{r}="",E{r}=""),"",AB{r}-E{r})',
            "AE": (f'=IF({a},"",IF(N(AA{r})=0,IF(E{r}="","⏳ بانتظار الاعتماد","✖ غير محصل"),'
                   f'IF(AC{r}<=1,"✔ محصل بالكامل","⚠ محصل جزئياً")))'),
            "AF": d("$E$16"), "AG": f'=IF({a},"",{S}$E${DOC_ROW + 6})',
        }
        c = put(ws, f"A{r}", n, font(10, True, NAVY), fill(ALT), align("center"), BORDER, '"مستخلص "0')
        c.hyperlink = Hyperlink(ref=f"A{r}", location=f"'{S_IPC(n)}'!A1", display=str(n))
        for k, _, _, fmt in REG_COLS[1:]:
            ws[f"{k}{r}"] = F[k]
            calc(ws[f"{k}{r}"], fmt, bold=k in ("X", "Z"), fl="F7FBFF" if k in ("X", "Z") else None)
    T = REG_TOT
    put(ws, f"A{T}", "الإجمالي / آخر رصيد", font(10, True, "FFFFFF"), fill(NAVY), align("center"), merge=f"A{T}:F{T}")
    LAT = f"{R(S_REG)}$AG$3"
    for k, _, _, fmt in REG_COLS[6:]:
        if k in ("H", "Z", "AA", "AC"):
            v = f"=SUM({k}{REG_FIRST}:{k}{REG_LAST})"
        elif k == "AD":
            v = f"=IFERROR(AVERAGE(AD{REG_FIRST}:AD{REG_LAST}),0)"
        elif k in ("AB", "AE", "M", "N", "Y", "AF", "AG"):
            v = None
        else:
            v = f"=IF($AJ$3=0,0,INDEX({k}{REG_FIRST}:{k}{REG_LAST},$AJ$3))"
        put(ws, f"{k}{T}", v, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
    put(ws, "AI3", "آخر مستخلص:", font(10, True, NAVY), al=align("left"))
    put(ws, "AJ3", f'=SUMPRODUCT(MAX((C{REG_FIRST}:C{REG_LAST}<>"")*A{REG_FIRST}:A{REG_LAST}))', font(12, True, "FFFFFF"),
        fill(GOLD), align("center"), fmt="0")
    ws.column_dimensions["AI"].width = 13
    ws.column_dimensions["AJ"].width = 8
    put(ws, f"A{T+2}", "هذا السجل للعرض فقط (لا يُدخل فيه شيء) — كل البيانات تُدخل في شيت كل مستخلص. "
                       "يصبح المستخلص فعالاً بمجرد إدخال «الفترة إلى» في شيته. اضغط على رقم المستخلص للانتقال إليه.",
        font(9, False, GREY_TXT, True), merge=f"A{T+2}:AE{T+2}", al=align("right", wrap=True))
    full = f"A{REG_FIRST}:AE{REG_LAST}"
    ws.conditional_formatting.add(full, FormulaRule(formula=[f"$A{REG_FIRST}=$AJ$3"],
                                                    border=Border(top=Side("medium", GOLD), bottom=Side("medium", GOLD))))
    ws.conditional_formatting.add(f"N{REG_FIRST}:N{REG_LAST}", CellIsRule(operator="lessThan", formula=["-0.0001"],
                                                                        fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"N{REG_FIRST}:N{REG_LAST}", CellIsRule(operator="between", formula=["0", "10"],
                                                                        fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
    for sym, bg, fc in [("✔", GREEN_L, GREEN), ("✖", RED_L, RED), ("⚠", GOLD_L, GOLD)]:
        ws.conditional_formatting.add(f"AE{REG_FIRST}:AE{REG_LAST}", FormulaRule(
            formula=[f'ISNUMBER(SEARCH("{sym}",AE{REG_FIRST}))'], fill=fill(bg), font=Font(color=fc, bold=True)))
    ws.conditional_formatting.add(f"L{REG_FIRST}:L{REG_LAST}",
                                  DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    # جدول الإنجاز حسب القسم (من آخر شيت لأنه يحمل الكميات التراكمية)
    section(ws, f"B{SEC_HDR-1}", "الإنجاز حسب أقسام الأعمال", f"B{SEC_HDR-1}:H{SEC_HDR-1}", TEAL)
    for col, t, mg in [("B", "القسم", f"B{SEC_HDR}:D{SEC_HDR}"), ("E", "القيمة التعاقدية", None),
                       ("F", "القيمة المنفذة التراكمية", None), ("G", "نسبة الإنجاز", None), ("H", "الوزن من العقد", None)]:
        put(ws, f"{col}{SEC_HDR}", t, font(10, True, "FFFFFF"), fill(NAVY), align("center", wrap=True), BORDER, merge=mg)
    ws.row_dimensions[SEC_HDR].height = 30
    LS = R(S_IPC(N_IPC))
    for i in range(N_SEC):
        r = SEC_FIRST + i
        put(ws, f"B{r}", f'=IF({R(S_SET)}F{6+i}="","",{R(S_SET)}F{6+i})', font(10, True), fill(ALT), align("right", indent=1),
            BORDER, merge=f"B{r}:D{r}")
        put(ws, f"E{r}", f'=IF(B{r}="",0,SUMIF({BS}$C${BOQ_FIRST}:$C${BOQ_LAST},B{r},{BS}$H${BOQ_FIRST}:$H${BOQ_LAST}))',
            font(10), None, align("center"), BORDER, ACC)
        put(ws, f"F{r}", f'=IF(B{r}="",0,SUMIF({BS}$C${BOQ_FIRST}:$C${BOQ_LAST},B{r},{LS}$M${D_FIRST}:$M${D_LAST}))',
            font(10), None, align("center"), BORDER, ACC)
        put(ws, f"G{r}", f"=IF(E{r}>0,F{r}/E{r},0)", font(10, True), None, align("center"), BORDER, PCT)
        put(ws, f"H{r}", f"=IF(ContractValue>0,E{r}/ContractValue,0)", font(10), None, align("center"), BORDER, PCT)
    ws.conditional_formatting.add(f"G{SEC_FIRST}:G{SEC_LAST}",
                                  DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    ws.freeze_panes = f"G{REG_FIRST}"
    ws.print_title_rows = "4:5"

    # ------------------------------------------------------------- الموازنة والتكاليف (داخلي — لا يُطبع مع المستخلص)
    ws = wsC
    RS = R(S_REG)
    setup(ws, {"A": 2, "B": 14, "C": 24, **{CL(c): 14.5 for c in range(4, 20)}, "T": 2}, "6A1B9A", zoom=85)
    banner(ws, "B", "S", "💰 الموازنة التقديرية والتكاليف الفعلية والربحية (Budget & Cost Control) — داخلي", SUB)
    nav(ws, ["B", "C", "D", "F", "G", "H"], S_BUD)
    section(ws, f"B{BG_SET}", "إعدادات الموازنة", f"B{BG_SET}:L{BG_SET}", "6A1B9A")
    for r, lab, ref, v, note in [(6, "نسبة المصروفات العمومية والإدارية (من التكلفة المباشرة)", "E6", 0.06, "تُحمّل على الموازنة وعلى التكلفة الفعلية لكل مستخلص"),
                                 (7, "نسبة احتياطي الطوارئ (من التكلفة المباشرة)", "E7", 0.03, "تُضاف للموازنة فقط"),
                                 (8, "نسبة الربح المستهدفة من الإدارة", "E8", 0.12, "للمقارنة مع الربح المخطط والفعلي")]:
        put(ws, f"B{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"B{r}:D{r}")
        put(ws, ref, v)
        inp(ws[ref], PCT)
        put(ws, f"F{r}", note, font(9, False, GREY_TXT, True), al=align("right"), merge=f"F{r}:L{r}")
    dv_num(ws, "E6:E8", lo=0, hi=1)
    add_name(wb, "GAPct", f"{R(S_BUD)}$E$6")
    add_name(wb, "ContPct", f"{R(S_BUD)}$E$7")
    # --- أولاً: مصفوفة الموازنة
    section(ws, f"B{BM_HDR-1}", "أولاً: الموازنة التقديرية حسب أقسام الأعمال وعناصر التكلفة (إدخال)", f"B{BM_HDR-1}:L{BM_HDR-1}", "6A1B9A")
    headers(ws, BM_HDR, [("B", "القسم"), ("D", "القيمة التعاقدية للقسم")] + [(CL(5 + i), e) for i, e in enumerate(ELEMENTS)]
            + [("J", "إجمالي التكلفة المباشرة"), ("K", "الربح المباشر للقسم"), ("L", "هامش القسم")], height=36)
    ws.merge_cells(f"B{BM_HDR}:C{BM_HDR}")
    for i in range(N_SEC):
        r = BM_R1 + i
        put(ws, f"B{r}", f'=IF({R(S_SET)}F{6+i}="","",{R(S_SET)}F{6+i})', font(10, True, LINK_FONT), fill(ALT),
            align("right", indent=1), BORDER, merge=f"B{r}:C{r}")
        put(ws, f"D{r}", f'=IF(B{r}="",0,SUMIF({BS}$C${BOQ_FIRST}:$C${BOQ_LAST},B{r},{BS}$H${BOQ_FIRST}:$H${BOQ_LAST}))',
            font(10, False, LINK_FONT), None, align("center"), BORDER, ACC0)
        for k in range(5):
            c = ws.cell(r, 5 + k)
            if sp and i < len(SECTIONS):
                sec_val = sum(it[4] * it[5] for it in items if it[1] == i)
                c.value = round(sec_val * (0.80 + 0.02 * ((i % 3) - 1)) * ELEM_SPLIT[i][k], -2) or None
            inp(c, ACC0)
        put(ws, f"J{r}", f"=SUM(E{r}:I{r})", font(10, True), None, align("center"), BORDER, ACC0)
        put(ws, f"K{r}", f"=D{r}-J{r}", font(10), None, align("center"), BORDER, ACC0)
        put(ws, f"L{r}", f"=IF(D{r}>0,K{r}/D{r},0)", font(10), None, align("center"), BORDER, PCT)
    dv_num(ws, f"E{BM_R1}:I{BM_RN}", lo=0)
    tot_rows = [(BM_TOT, "إجمالي التكلفة المباشرة", f"=SUM(J{BM_R1}:J{BM_RN})"),
                (BM_GA, "يُضاف: المصروفات العمومية والإدارية", f"=ROUND(J{BM_TOT}*GAPct,2)"),
                (BM_CT, "يُضاف: احتياطي الطوارئ", f"=ROUND(J{BM_TOT}*ContPct,2)"),
                (BM_BAC, "إجمالي الموازنة عند الإنجاز (BAC)", f"=SUM(J{BM_TOT}:J{BM_CT})"),
                (BM_PP, "الربح المخطط (قيمة العقد الأصلية − الموازنة)", f"=D{BM_TOT}-J{BM_BAC}")]
    for r, lab, f in tot_rows:
        big = r in (BM_BAC, BM_PP)
        put(ws, f"B{r}", lab, font(10, True, "FFFFFF" if big else NAVY), fill(NAVY if big else TOTAL_BG), align("right", indent=1),
            BORDER, merge=f"B{r}:{'C' if r == BM_TOT else 'I'}{r}")
        put(ws, f"J{r}", f, font(11 if big else 10, True, "FFFFFF" if big else "1F2933"), fill(NAVY if big else TOTAL_BG),
            align("center"), BORDER, ACC0)
    for k in range(5):
        col = CL(5 + k)
        put(ws, f"{col}{BM_TOT}", f"=SUM({col}{BM_R1}:{col}{BM_RN})", font(10, True), fill(TOTAL_BG), align("center"), BORDER, ACC0)
    put(ws, f"D{BM_TOT}", f"=SUM(D{BM_R1}:D{BM_RN})", font(10, True), fill(TOTAL_BG), align("center"), BORDER, ACC0)
    put(ws, f"K{BM_PP}", f"=IF(D{BM_TOT}>0,J{BM_PP}/D{BM_TOT},0)", font(11, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, PCT)
    put(ws, f"L{BM_PP}", f'=IF(J{BM_BAC}=0,"",IF(K{BM_PP}>=$E$8,"✔ يحقق المستهدف","⚠ أقل من المستهدف"))', font(9, True, GOLD), None, align("center"), BORDER)
    add_name(wb, "BAC", f"{R(S_BUD)}$J${BM_BAC}")
    # --- ثانياً: التكاليف الفعلية لكل مستخلص
    section(ws, f"B{BA_HDR-1}", "ثانياً: التكاليف الفعلية لكل فترة مستخلص (إدخال التكاليف المباشرة) والربحية والقيمة المكتسبة", f"B{BA_HDR-1}:S{BA_HDR-1}", "6A1B9A")
    headers(ws, BA_HDR, [("B", "رقم المستخلص"), ("C", "الفترة إلى")] + [(CL(4 + i), e) for i, e in enumerate(ELEMENTS)]
            + [("I", "مصروفات عمومية (محسوبة)"), ("J", "إجمالي تكلفة الفترة"), ("K", "التكلفة التراكمية"),
               ("L", "الإيراد التراكمي (إجمالي قيمة الأعمال)"), ("M", "الربح التراكمي"), ("N", "هامش الربح"),
               ("O", "القيمة المكتسبة بالتكلفة (EV)"), ("P", "مؤشر أداء التكلفة CPI"), ("Q", "التكلفة المتوقعة عند الإنجاز EAC"),
               ("R", "الربح المتوقع عند الإنجاز"), ("S", "الموقف النقدي (محصل + مقدمة − تكلفة)")], height=52)
    ratio = COST_RATIO.get(p, 0.85)
    elem_w = None
    if sp:
        tot_dir = {k: sum(sum(it[4] * it[5] for it in items if it[1] == i) * ELEM_SPLIT[i][k] for i in range(len(SECTIONS))) for k in range(5)}
        sm = sum(tot_dir.values())
        elem_w = [tot_dir[k] / sm for k in range(5)]
    for n in range(1, N_IPC + 1):
        r, rr = BA_R1 + n - 1, REG_FIRST + n - 1
        put(ws, f"B{r}", n, font(10, True, NAVY), fill(ALT), align("center"), BORDER, '"مستخلص "0')
        put(ws, f"C{r}", f'=IF({RS}C{rr}="","",{RS}C{rr})', font(10, False, LINK_FONT), None, align("center"), BORDER, DATE)
        period_val = sum(q * items[i][5] for (i, m), q in aq.items() if m == n) if sp else 0
        for k in range(5):
            c = ws.cell(r, 4 + k)
            if sp and period_val and n <= n_act:
                c.value = round(period_val * ratio * elem_w[k], 2)
            inp(c, ACC0)
        a = f'C{r}=""'
        F = {"I": f"=ROUND(SUM(D{r}:H{r})*GAPct,2)", "J": f"=SUM(D{r}:I{r})",
             "K": f'=IF(AND({a},J{r}=0),"",SUM($J${BA_R1}:J{r}))',
             "L": f'=IF({a},"",N({RS}K{rr}))', "M": f'=IF(OR(L{r}="",K{r}=""),"",L{r}-K{r})',
             "N": f'=IF(OR(M{r}="",N(L{r})=0),"",M{r}/L{r})', "O": f'=IF({a},"",BAC*N({RS}L{rr}))',
             "P": f'=IF(OR(O{r}="",N(K{r})=0),"",O{r}/K{r})', "Q": f'=IF(P{r}="","",IF(P{r}>0,BAC/P{r},BAC))',
             "R": f'=IF(Q{r}="","",RevisedContract-Q{r})',
             "S": (f'=IF({a},"",SUMIF({RS}$A${REG_FIRST}:$A${REG_LAST},"<="&B{r},{RS}$AA${REG_FIRST}:$AA${REG_LAST})'
                   f'+IF(AND(AdvDate<>"",N(AdvDate)<=N(C{r})),AdvAmount,0)-N(K{r}))')}
        for col, f in F.items():
            put(ws, f"{col}{r}", f, font(10, col in ("M", "R")), None, align("center"), BORDER,
                PCT if col == "N" else ("0.00" if col == "P" else ACC0))
    dv_num(ws, f"D{BA_R1}:H{BA_RN}", lo=0, msg="التكاليف المباشرة الفعلية خلال فترة هذا المستخلص")
    put(ws, f"B{BA_TOT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{BA_TOT}:C{BA_TOT}")
    for col in "DEFGHIJ":
        put(ws, f"{col}{BA_TOT}", f"=SUM({col}{BA_R1}:{col}{BA_RN})", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, ACC0)
    for col in "KLMNOPQRS":
        put(ws, f"{col}{BA_TOT}", None, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
    ws.conditional_formatting.add(f"P{BA_R1}:P{BA_RN}", CellIsRule(operator="lessThan", formula=["0.95"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"P{BA_R1}:P{BA_RN}", CellIsRule(operator="greaterThanOrEqual", formula=["1"], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
    ws.conditional_formatting.add(f"M{BA_R1}:M{BA_RN}", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"S{BA_R1}:S{BA_RN}", CellIsRule(operator="lessThan", formula=["0"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    # --- ثالثاً: مقارنة الموازنة بالفعلي حسب العنصر
    section(ws, f"B{BE_HDR-1}", "ثالثاً: مقارنة الموازنة بالفعلي حسب عنصر التكلفة", f"B{BE_HDR-1}:H{BE_HDR-1}", "6A1B9A")
    headers(ws, BE_HDR, [("B", "عنصر التكلفة"), ("D", "الموازنة"), ("E", "الفعلي التراكمي"), ("F", "المتبقي من الموازنة"),
                         ("G", "نسبة الاستهلاك"), ("H", "مقارنة بنسبة الإنجاز")], height=34)
    ws.merge_cells(f"B{BE_HDR}:C{BE_HDR}")
    rows_e = [(e, f"={CL(5 + k)}{BM_TOT}", f"={CL(4 + k)}{BA_TOT}") for k, e in enumerate(ELEMENTS)]
    rows_e += [("المصروفات العمومية والإدارية", f"=J{BM_GA}", f"=I{BA_TOT}"), ("احتياطي الطوارئ", f"=J{BM_CT}", "=0")]
    for i, (lab, b, a_) in enumerate(rows_e):
        r = BE_R1 + i
        put(ws, f"B{r}", lab, font(10, True), fill(ALT), align("right", indent=1), BORDER, merge=f"B{r}:C{r}")
        put(ws, f"D{r}", b, font(10), None, align("center"), BORDER, ACC0)
        put(ws, f"E{r}", a_, font(10), None, align("center"), BORDER, ACC0)
        put(ws, f"F{r}", f"=D{r}-E{r}", font(10), None, align("center"), BORDER, ACC0)
        put(ws, f"G{r}", f"=IF(D{r}>0,E{r}/D{r},0)", font(10, True), None, align("center"), BORDER, PCT)
        put(ws, f"H{r}", f'=IF(D{r}=0,"",IF(G{r}>N({RS}L{REG_TOT})+0.05,"⚠ استهلاك أعلى من الإنجاز","✔ ضمن المعدل"))',
            font(9, True), None, align("center"), BORDER)
    BE_T = BE_R1 + len(rows_e)
    put(ws, f"B{BE_T}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{BE_T}:C{BE_T}")
    for col, f, fmt in [("D", f"=SUM(D{BE_R1}:D{BE_T-1})", ACC0), ("E", f"=SUM(E{BE_R1}:E{BE_T-1})", ACC0),
                        ("F", f"=D{BE_T}-E{BE_T}", ACC0), ("G", f"=IF(D{BE_T}>0,E{BE_T}/D{BE_T},0)", PCT), ("H", None, None)]:
        put(ws, f"{col}{BE_T}", f, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
    ws.conditional_formatting.add(f"G{BE_R1}:G{BE_T-1}", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="9575CD"))
    for sym, fc in (("⚠", RED), ("✔", GREEN)):
        ws.conditional_formatting.add(f"H{BE_R1}:H{BE_T-1}", FormulaRule(formula=[f'ISNUMBER(SEARCH("{sym}",H{BE_R1}))'], font=Font(color=fc, bold=True)))
    # --- رابعاً: ملخص المؤشرات (يغذي ملف التقارير)
    section(ws, f"B{BK_R1-1}", "رابعاً: ملخص الربحية ومؤشرات التكلفة", f"B{BK_R1-1}:E{BK_R1-1}", "6A1B9A")
    lastreg = lambda col: f"N({RS}{col}{REG_TOT})"
    kp = [("bac", "إجمالي الموازنة عند الإنجاز (BAC)", "=BAC", ACC0),
          ("rev_c", "قيمة العقد المعدلة", "=RevisedContract", ACC0),
          ("pprofit", "الربح المخطط (على العقد المعدل)", f"=D{BK['rev_c']}-D{BK['bac']}", ACC0),
          ("pmargin", "هامش الربح المخطط", f"=IF(D{BK['rev_c']}>0,D{BK['pprofit']}/D{BK['rev_c']},0)", PCT),
          ("cost", "التكلفة الفعلية التراكمية", f"=J{BA_TOT}", ACC0),
          ("revenue", "الإيراد التراكمي (إجمالي قيمة الأعمال)", f"={lastreg('K')}", ACC0),
          ("profit", "الربح الفعلي التراكمي", f"=D{BK['revenue']}-D{BK['cost']}", ACC0),
          ("margin", "هامش الربح الفعلي", f"=IF(D{BK['revenue']}>0,D{BK['profit']}/D{BK['revenue']},0)", PCT),
          ("cpi", "مؤشر أداء التكلفة (CPI)", f"=IF(D{BK['cost']}>0,BAC*{lastreg('L')}/D{BK['cost']},0)", "0.00"),
          ("eac", "التكلفة المتوقعة عند الإنجاز (EAC)", f"=IF(D{BK['cpi']}>0,BAC/D{BK['cpi']},BAC)", ACC0),
          ("fprofit", "الربح المتوقع عند الإنجاز", f"=D{BK['rev_c']}-D{BK['eac']}", ACC0),
          ("fmargin", "هامش الربح المتوقع", f"=IF(D{BK['rev_c']}>0,D{BK['fprofit']}/D{BK['rev_c']},0)", PCT),
          ("cash", "الموقف النقدي الحالي", f"=SUM({RS}AA{REG_FIRST}:AA{REG_LAST})+IF(AdvDate<>\"\",AdvAmount,0)-D{BK['cost']}", ACC0),
          ("status", "حالة التكلفة", f'=IF(D{BK["cost"]}=0,"لا توجد تكاليف مسجلة",IF(D{BK["cpi"]}<0.95,"⚠ تجاوز في التكاليف",IF(D{BK["cpi"]}<1,"متابعة — قريب من الموازنة","✔ ضمن الموازنة")))', None)]
    for key, lab, f, fmt in kp:
        r = BK[key]
        put(ws, f"B{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER, merge=f"B{r}:C{r}")
        put(ws, f"D{r}", f, font(11, True, "6A1B9A"), None, align("center"), BORDER, fmt, merge=f"D{r}:E{r}")
    for ref, rule in ((f"D{BK['profit']}", "lessThan"), (f"D{BK['fprofit']}", "lessThan"), (f"D{BK['cash']}", "lessThan")):
        ws.conditional_formatting.add(ref, CellIsRule(operator=rule, formula=["0"], font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"D{BK['status']}", FormulaRule(formula=[f'ISNUMBER(SEARCH("⚠",D{BK["status"]}))'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"D{BK['status']}", FormulaRule(formula=[f'ISNUMBER(SEARCH("✔",D{BK["status"]}))'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
    chb = BarChart()
    chb.type = "col"
    chb.title = "الموازنة مقابل الفعلي حسب عنصر التكلفة"
    chb.add_data(Reference(ws, min_col=4, max_col=5, min_row=BE_HDR, max_row=BE_T - 1), titles_from_data=True)
    chb.set_categories(Reference(ws, min_col=2, min_row=BE_R1, max_row=BE_T - 1))
    chb.series[0].graphicalProperties.solidFill = "B39DDB"
    chb.series[1].graphicalProperties.solidFill = "6A1B9A"
    chb.y_axis.numFmt = "#,##0"
    chb.y_axis.majorGridlines = None
    for ax in (chb.x_axis, chb.y_axis):
        ax.delete = False
    chb.legend.position = "b"
    chb.height, chb.width = 9, 18
    ws.add_chart(chb, f"G{BK_R1-1}")
    chp = LineChart()
    chp.title = "التكلفة التراكمية مقابل الإيراد التراكمي"
    chp.add_data(Reference(ws, min_col=11, max_col=12, min_row=BA_HDR, max_row=BA_RN), titles_from_data=True)
    chp.set_categories(Reference(ws, min_col=2, min_row=BA_R1, max_row=BA_RN))
    chp.series[0].graphicalProperties.line.solidFill = "C0504D"
    chp.series[1].graphicalProperties.line.solidFill = "2E7D7A"
    chp.y_axis.numFmt = "#,##0"
    chp.y_axis.majorGridlines = None
    for ax in (chp.x_axis, chp.y_axis):
        ax.delete = False
    chp.legend.position = "b"
    chp.height, chp.width = 9, 18
    ws.add_chart(chp, f"M{BK_R1-1}")
    ws.freeze_panes = "A4"

    # ------------------------------------------------------------- التعليمات
    ws = wsG
    setup(ws, {"A": 2, "B": 26, "C": 95}, GOLD)
    banner(ws, "B", "C", f"📘 ملف مستخلصات المشروع رقم {p:02d} — {N_IPC} مستخلص مترابط", SUB)
    button(ws, "B3", "⚙ ابدأ ببيانات العقد", S_SET, NAVY)
    button(ws, "C3", "🧾 الانتقال إلى المستخلص الأول", S_IPC(1), GOLD)
    r = 5
    section(ws, f"B{r}", "دليل الألوان", f"B{r}:C{r}", NAVY2)
    for lab, desc, bg, fc in [("إدخال يدوي", "خلايا صفراء بخط أزرق — هي الخلايا الوحيدة التي تُعدّل.", INPUT, INPUT_FONT),
                              ("معادلة محسوبة", "خط أسود — لا تكتب فوقها.", "FFFFFF", "1F2933"),
                              ("ربط", "خط أخضر — قيمة مسحوبة من شيت آخر (مثل «السابق» من المستخلص الذي قبله).", "FFFFFF", LINK_FONT),
                              ("تنبيه", "تظليل أحمر: تجاوز الكمية التعاقدية، كود مكرر، تأخر عن البرنامج.", RED_L, RED)]:
        r += 1
        put(ws, f"B{r}", lab, font(10, True, fc), fill(bg), align("center"), BORDER)
        put(ws, f"C{r}", desc, font(10), None, align("right", wrap=True, indent=1), BORDER)
    r += 2
    section(ws, f"B{r}", "خطوات العمل", f"B{r}:C{r}", NAVY2)
    for s, d in [(S_SET, "أدخل بيانات المشروع والنسب التعاقدية (مرة واحدة)."),
                 (S_BOQ, "أدخل بنود جدول الكميات والأسعار (حتى 100 بند)."),
                 (S_IPC(1), "في كل مستخلص: أدخل الفترة والتواريخ والحالة والنسبة المخططة، ثم «الكمية الحالية» لكل بند، "
                            "ورصيد المواد والغرامات والإفراج عن الضمان إن وجد، وبيانات التحصيل. "
                            "«السابق» يُسحب آلياً من المستخلص الذي قبله، والتراكمي = السابق + الحالي."),
                 (S_VO, "سجل الأوامر التغييرية واختر رقم المستخلص الذي تُدرج به."),
                 (S_TD, "سجل الاستقطاعات الفنية برقم المستخلص، وحدد مستخلص الإفراج عند المعالجة."),
                 (S_BUD, "أدخل الموازنة التقديرية لكل قسم حسب عناصر التكلفة مرة واحدة، ثم التكاليف الفعلية المباشرة لكل فترة مستخلص؛ "
                         "يحسب الشيت الربح والهامش وCPI والتكلفة المتوقعة عند الإنجاز والموقف النقدي (شيت داخلي لا يُطبع مع المستخلص)."),
                 (S_REG, "يتجمع كل شيء آلياً في السجل، ومنه ينتقل إلى ملف التقارير المجمع لكل المشاريع.")]:
        r += 1
        c = put(ws, f"B{r}", s, font(10, True, "FFFFFF"), fill(TEAL), align("center"), BORDER)
        c.hyperlink = Hyperlink(ref=f"B{r}", location=f"'{s}'!A1", display=s)
        put(ws, f"C{r}", d, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 36
    r += 2
    section(ws, f"B{r}", "التوافق مع الأنظمة السعودية", f"B{r}:C{r}", "006C35")
    for a_, b_ in SAUDI_NOTES:
        r += 1
        put(ws, f"B{r}", a_, font(10, True, "006C35"), fill(GREEN_L), align("right", indent=1), BORDER)
        put(ws, f"C{r}", b_, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 34
    r += 2
    section(ws, f"B{r}", "الربط مع ملف التقارير", f"B{r}:C{r}", GOLD)
    for d in [f"اسم هذا الملف يجب أن يبقى «{CERT_FILE.format(p)}» داخل فولدر «{PROJ_DIR.format(p)}»، والفولدر بجوار ملف «{REPORT_FILE}».",
              "بعد حفظ هذا الملف، افتح ملف التقارير واضغط «تمكين المحتوى / تحديث» ليتم سحب الأرقام الجديدة.",
              "لا تحذف صفوفاً أو أعمدة ولا تغيّر أسماء الشيتات حتى لا ينقطع الربط."]:
        r += 1
        put(ws, f"B{r}", "•", font(12, True, GOLD), None, align("center"), BORDER)
        put(ws, f"C{r}", d, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 24

    wb.active = wb.sheetnames.index(S_REG)
    wb.calculation.fullCalcOnLoad = True
    os.makedirs(os.path.join(OUT_DIR, PROJ_DIR.format(p)), exist_ok=True)
    path = os.path.join(OUT_DIR, PROJ_DIR.format(p), CERT_FILE.format(p))
    wb.save(path)
    return path


# =====================================================================================
#                               إعادة الحساب (للتحقق وتخزين القيم)
# =====================================================================================
RECALC = (glob.glob("/root/.claude/skills/synced/*/xlsx/scripts/recalc.py") or [None])[0]
CALC_DIR = os.environ.get("PCS_CALC_DIR", "/tmp/pcs_calc")


def recalc_copy(path):
    """يعيد حساب نسخة من الملف بـ LibreOffice ويرجع مسار النسخة (الملف الأصلي لا يتغير)"""
    if not RECALC:
        return None
    os.makedirs(CALC_DIR, exist_ok=True)
    dst = os.path.join(CALC_DIR, os.path.basename(path))
    shutil.copy(path, dst)
    out = subprocess.run(["python", RECALC, dst, "300", "--force"], capture_output=True, text=True)
    res = json.loads(out.stdout[out.stdout.index("{"):])
    print(os.path.basename(path), res.get("status"), res.get("total_errors"), res.get("total_formulas"))
    if res.get("status") != "success":
        print(json.dumps(res, ensure_ascii=False)[:1500])
    return dst


# =====================================================================================
#                                  ملف التقارير المجمع
# =====================================================================================
class Ext:
    """يسجل كل مرجع خارجي لبناء الذاكرة المؤقتة (cache) للربط"""

    def __init__(self):
        self.refs = {}   # p -> {sheet: set(cells)}

    def __call__(self, p, sheet, cell):
        self.refs.setdefault(p, {}).setdefault(sheet, set()).add(cell.replace("$", ""))
        return f"'[{p}]{sheet}'!{cell}"


def build_report(cert_values):
    E = Ext()
    wb = Workbook()
    wsG = wb.active
    wsG.title = S_GUIDE
    prj_ws = [wb.create_sheet(S_PRJ(p)) for p in range(1, N_PROJ + 1)]
    wsA = wb.create_sheet(S_ALL)
    SUB = '="تقارير المستخلصات المجمعة لكل المشاريع   |   تاريخ التقرير: "&TEXT(TODAY(),"yyyy/mm/dd")'

    def nav_top(ws, p=None):
        button(ws, "B3", "🏠 الإجمالي العام", S_ALL, NAVY)
        if p is None:
            button(ws, "C3", "📊 أول مشروع", S_PRJ(1), TEAL)
            return
        if p > 1:
            button(ws, "C3", "◄ المشروع السابق", S_PRJ(p - 1), TEAL)
        if p < N_PROJ:
            button(ws, "D3", "المشروع التالي ►", S_PRJ(p + 1), TEAL)

    KPI = {}   # p -> {key: cell}
    TBL = [  # عمود التقرير، عمود السجل، العنوان، التنسيق
        ("C", "C", "الفترة إلى", DATE), ("D", "E", "تاريخ الاعتماد", DATE), ("E", "F", "حالة المستخلص", None),
        ("F", "H", "أعمال الفترة", ACC), ("G", "G", "الأعمال المنفذة التراكمية", ACC), ("H", "I", "التغييرية التراكمية", ACC),
        ("I", "J", "رصيد المواد بالموقع", ACC), ("J", "K", "إجمالي القيمة التراكمية", ACC), ("K", "L", "نسبة الإنجاز الفعلية", PCT),
        ("L", "M", "نسبة الإنجاز المخططة", PCT), ("M", "N", "الانحراف", PCT), ("N", "O", "استرداد الدفعة المقدمة", ACC),
        ("O", "R", "صافي الضمان المحتجز", ACC), ("P", "S", "الاستقطاعات الفنية", ACC), ("Q", "T", "الغرامات والخصومات", ACC),
        ("R", "V", "ضريبة القيمة المضافة", ACC), ("S", "W", "ضريبة الاستقطاع", ACC), ("T", "X", "صافي المستحق التراكمي", ACC),
        ("U", "Z", "المستحق للمستخلص الحالي", ACC), ("V", "AA", "المحصل", ACC), ("W", "AC", "المتبقي", ACC),
        ("X", "AD", "مدة التحصيل (يوم)", '0;-0;"-"'), ("Y", "AE", "حالة التحصيل", None),
    ]
    T1, TN = 25, 25 + N_IPC - 1
    TT = TN + 1
    SH = TT + 3          # عنوان جدول الأقسام
    S1 = SH + 1
    for p, ws in enumerate(prj_ws, 1):
        fname = cert_rel(p)
        setup(ws, {"A": 2, **{CL(c): 12.5 for c in range(2, 26)}, "Z": 2, "AA": 30, "AB": 18}, TEAL if p in SAMPLE else "BFBFBF", zoom=80)
        name_f = f'IF({E(p, S_SET, "$C$5")}="","مشروع رقم {p:02d} — غير مُفعّل",{E(p, S_SET, "$C$5")})'
        banner(ws, "B", "Y", f"=\"📊 \"&{name_f}", SUB)
        nav_top(ws, p)
        c = put(ws, "F3", f"📂 فتح ملف المستخلصات: {fname}", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), merge="F3:L3")
        c.hyperlink = fname
        put(ws, "N3", "يُحدَّث آلياً من ملف المستخلصات (تمكين المحتوى ← تحديث الروابط)", font(9, False, GREY_TXT, True),
            al=align("right"), merge="N3:Y3")
        # بيانات مرتبطة (AA:AB)
        put(ws, "AA4", "بيانات مرتبطة من ملف المستخلصات", font(10, True, "FFFFFF"), fill(NAVY2), align("center"), merge="AA4:AB4")
        LINKS = [("ContractValue", "قيمة العقد الأصلية", "$C$16", ACC), ("VO", "صافي التغييرية المعتمدة", "$C$17", ACC),
                 ("Revised", "قيمة العقد المعدلة", "$C$18", ACC), ("AdvPct", "نسبة الدفعة المقدمة", "$C$20", PCT),
                 ("Adv", "قيمة الدفعة المقدمة", "$C$21", ACC), ("RetPct", "نسبة ضمان الأعمال", "$C$27", PCT),
                 ("RetCap", "الحد الأقصى للضمان", "$C$29", ACC), ("VAT", "ضريبة القيمة المضافة", "$C$31", PCT),
                 ("WHT", "ضريبة الاستقطاع (غير المقيم)", "$C$33", PCT), ("Start", "تاريخ البدء", "$C$11", DATE),
                 ("End", "تاريخ الانتهاء التعاقدي", "$C$13", DATE), ("Dur", "المدة (شهر)", "$C$12", "0"),
                 ("Ctype", "نوع العقد", "$C$36", None), ("VATc", "الرقم الضريبي للمقاول", "$C$37", "@"),
                 ("VATo", "الرقم الضريبي لصاحب العمل", "$C$39", "@"), ("PB", "انتهاء الضمان النهائي", "$C$42", DATE),
                 ("APB", "انتهاء ضمان الدفعة المقدمة", "$C$43", DATE), ("PenSt", "حالة غرامات التأخير", "$C$47", None)]
        L = {}
        for i, (k, lab, ref, fmt) in enumerate(LINKS):
            r = 5 + i
            put(ws, f"AA{r}", lab, font(9, True), fill(ALT), align("right", indent=1), BORDER)
            x = E(p, S_SET, ref)
            v = f'=IF({x}="","",{x})' if k in ("Start", "End", "Dur", "Ctype", "VATc", "VATo", "PB", "APB", "PenSt") else f"=N({x})"
            put(ws, f"AB{r}", v, font(9, False, LINK_FONT), None, align("center"), BORDER, fmt)
            L[k] = f"$AB${r}"
        ra = 5 + len(LINKS) + 1
        put(ws, f"AA{ra}", "التنبيهات النظامية", font(10, True, "FFFFFF"), fill(RED), align("center"), merge=f"AA{ra}:AB{ra}")
        put(ws, f"AA{ra+1}", (f'=IF({L["Revised"]}=0,"",IF(AND({L["PB"]}<>"",N({L["PB"]})-TODAY()<=30),"⚠ الضمان النهائي ينتهي خلال 30 يوماً — ","")'
                              f'&IF(AND({L["APB"]}<>"",N({L["APB"]})-TODAY()<=30,$F$18>0),"⚠ ضمان الدفعة المقدمة ينتهي والرصيد لم يُسترد — ","")'
                              f'&IF(ISNUMBER(SEARCH("⚠",{L["PenSt"]})),"⚠ الغرامات تجاوزت الحد الأقصى — ","")'
                              f'&IF($J$15>0,"مستحقات غير محصلة","")&"")'),
            font(9, True, RED), fill(RED_L), align("right", "top", True, 1), BORDER, merge=f"AA{ra+1}:AB{ra+4}")
        K_ALERT = f"'{S_PRJ(p)}'!$AA${ra+1}"
        for k in ("PB", "APB"):
            ws.conditional_formatting.add(L[k].replace("$", ""), FormulaRule(formula=[f'AND({L[k]}<>"",N({L[k]})-TODAY()<=30)'],
                                                                            fill=fill(RED_L), font=Font(color=RED, bold=True)))
        # معلومات المشروع
        infos = [(5, "B", "المشروع", "C", "F", "$C$5"), (5, "G", "رقم العقد", "H", "K", "$C$6"),
                 (5, "L", "صاحب العمل", "M", "Q", "$C$7"), (5, "R", "الاستشاري", "S", "Y", "$C$8"),
                 (6, "B", "المقاول", "C", "F", "$C$9"), (6, "G", "تاريخ البدء", "H", "K", "$C$11"),
                 (6, "L", "الانتهاء التعاقدي", "M", "Q", "$C$13"), (6, "R", "العملة", "S", "Y", "$C$14")]
        for r, lc, lab, v1, v2, ref in infos:
            put(ws, f"{lc}{r}", lab, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
            x = E(p, S_SET, ref)
            put(ws, f"{v1}{r}", f'=IF({x}="","",{x})', font(10, True, LINK_FONT), None, align("right", indent=1),
                BORDER, DATE if ref in ("$C$11", "$C$13") else None, merge=f"{v1}{r}:{v2}{r}")
            ws.row_dimensions[r].height = 22
        # جدول المستخلصات
        put(ws, f"B{T1-2}", "سجل المستخلصات (مرتبط)", font(11, True, "FFFFFF"), fill(TEAL), align("right", indent=1), merge=f"B{T1-2}:Y{T1-2}")
        headers(ws, T1 - 1, [("B", "رقم المستخلص")] + [(c, t) for c, _, t, _ in TBL], height=48)
        for n in range(1, N_IPC + 1):
            r = T1 + n - 1
            put(ws, f"B{r}", n, font(10, True, NAVY), fill(ALT), align("center"), BORDER, "0")
            for col, rc, _, fmt in TBL:
                x = E(p, S_REG, f"${rc}${REG_FIRST + n - 1}")
                ws[f"{col}{r}"] = f'=IF({x}="","",{x})'
                calc(ws[f"{col}{r}"], fmt, color=LINK_FONT, bold=col in ("T", "U"))
        LAT = "$V$9"
        last = lambda col: f"IF({LAT}=0,0,N(INDEX(${col}${T1}:${col}${TN},{LAT})))"
        put(ws, f"B{TT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER)
        for col, rc, _, fmt in TBL:
            if col in ("F", "U", "V", "W"):
                v = f"=SUM({col}{T1}:{col}{TN})"
            elif col == "X":
                v = f"=IFERROR(AVERAGE(X{T1}:X{TN}),0)"
            elif col in ("C", "D", "E", "L", "M", "Y"):
                v = None
            else:
                v = f"={last(col)}"
            put(ws, f"{col}{TT}", v, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
        ws.conditional_formatting.add(f"M{T1}:M{TN}", CellIsRule(operator="lessThan", formula=["-0.0001"], font=Font(color=RED, bold=True)))
        for sym, bg, fc in [("✔", GREEN_L, GREEN), ("✖", RED_L, RED), ("⚠", GOLD_L, GOLD)]:
            ws.conditional_formatting.add(f"Y{T1}:Y{TN}", FormulaRule(formula=[f'ISNUMBER(SEARCH("{sym}",Y{T1}))'],
                                                                     fill=fill(bg), font=Font(color=fc, bold=True)))
        ws.conditional_formatting.add(f"B{T1}:Y{TN}", FormulaRule(formula=[f"$B{T1}={LAT}"],
                                                                 border=Border(top=Side("medium", GOLD), bottom=Side("medium", GOLD))))
        ws.conditional_formatting.add(f"K{T1}:K{TN}", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
        # بطاقات المؤشرات
        K = {}
        bud = lambda key: f"=N({E(p, S_BUD, '$D$' + str(BK[key]))})"
        spans = [("B", "E"), ("F", "I"), ("J", "M"), ("N", "Q"), ("R", "U"), ("V", "Y")]
        cards = [
            (8, [("cv", "قيمة العقد الأصلية", f"={L['ContractValue']}", ACC, NAVY),
                 ("vo", "صافي الأوامر التغييرية", f"={L['VO']}", ACC, "7B4F9D"),
                 ("rev", "قيمة العقد المعدلة", f"={L['Revised']}", ACC, NAVY),
                 ("gross", "إجمالي قيمة الأعمال التراكمية", f"={last('J')}", ACC, TEAL),
                 ("rem", "الأعمال المتبقية", f"=MAX(0,{L['Revised']}-{last('G')}-{last('H')})", ACC, GREY_TXT),
                 ("lat", "آخر مستخلص فعال", f'=SUMPRODUCT(MAX((C{T1}:C{TN}<>"")*B{T1}:B{TN}))', '"مستخلص "0', GOLD)]),
            (11, [("act", "نسبة الإنجاز الفعلية", f"={last('K')}", PCT, TEAL),
                  ("pln", "نسبة الإنجاز المخططة", f"={last('L')}", PCT, NAVY),
                  ("var", "الانحراف (فعلي - مخطط)", "=B12-F12", PCT, GOLD),
                  ("ela", "نسبة المدة المنقضية",
                   f'=IF(OR({LAT}=0,{L["Start"]}="",{L["End"]}=""),0,MIN(1,MAX(0,(INDEX(C{T1}:C{TN},{LAT})-{L["Start"]}+1)/({L["End"]}-{L["Start"]}+1))))',
                   PCT, GREY_TXT),
                  ("spi", "مؤشر أداء الجدول (SPI)", "=IF(F12>0,B12/F12,0)", "0.00", NAVY),
                  ("st", "حالة المشروع",
                   f'=IF({L["Revised"]}=0,"غير مُفعّل",IF({LAT}=0,"لم يبدأ الصرف",IF(J12<-0.05,"⚠ متأخر",IF(J12<0,"متأخر قليلاً","✔ مطابق / متقدم"))))',
                   None, NAVY)]),
            (14, [("due", "صافي المستحق التراكمي", f"={last('T')}", ACC, NAVY),
                  ("paid", "إجمالي المحصل", f"=V{TT}", ACC, GREEN),
                  ("out", "مستحقات غير محصلة", f"=W{TT}", ACC, RED),
                  ("colp", "نسبة التحصيل", "=IF(B15>0,F15/B15,0)", PCT, GREEN),
                  ("days", "متوسط مدة التحصيل (يوم)", f"=X{TT}", '0" يوم"', GREY_TXT),
                  ("latd", "تاريخ آخر مستخلص", f'=IF({LAT}=0,"",INDEX(C{T1}:C{TN},{LAT}))', DATE, GOLD)]),
            (17, [("ret", "ضمان الأعمال المحتجز", f"={last('O')}", ACC, "C0504D"),
                  ("advb", "رصيد الدفعة المقدمة غير المسترد", f"=MAX(0,{L['Adv']}-{last('N')})", ACC, "C0504D"),
                  ("td", "الاستقطاعات الفنية المحتجزة", f"={last('P')}", ACC, "C0504D"),
                  ("pen", "الغرامات والخصومات", f"={last('Q')}", ACC, "C0504D"),
                  ("cur", "مستحق آخر مستخلص", f"={last('U')}", ACC, TEAL),
                  ("napp", "عدد المستخلصات المعتمدة", f'=COUNTIF(E{T1}:E{TN},"معتمد")', "0", NAVY)]),
            (20, [("bac", "الموازنة التقديرية (BAC)", bud("bac"), ACC, "6A1B9A"),
                  ("cost", "التكلفة الفعلية التراكمية", bud("cost"), ACC, "6A1B9A"),
                  ("profit", "الربح الفعلي التراكمي", bud("profit"), ACC, "6A1B9A"),
                  ("margin", "هامش الربح الفعلي", bud("margin"), PCT, "6A1B9A"),
                  ("cpi", "مؤشر أداء التكلفة (CPI)", bud("cpi"), "0.00", "6A1B9A"),
                  ("fprofit", "الربح المتوقع عند الإنجاز", bud("fprofit"), ACC, "6A1B9A")]),
        ]
        for row, items_ in cards:
            for (c1, c2), (key, lab, f, fmt, colr) in zip(spans, items_):
                card(ws, row, c1, c2, lab, f, fmt or "General", colr, 14 if key != "st" else 12)
                K[key] = f"'{S_PRJ(p)}'!${c1}${row+1}"
        K["alert"] = K_ALERT
        KPI[p] = K
        ws.conditional_formatting.add("V12", FormulaRule(formula=['ISNUMBER(SEARCH("⚠",V12))'], font=Font(color=RED, bold=True)))
        ws.conditional_formatting.add("J12", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=RED, bold=True)))
        # جدول الأقسام
        put(ws, f"B{SH}", "الإنجاز حسب أقسام الأعمال", font(11, True, "FFFFFF"), fill(TEAL), align("right", indent=1), merge=f"B{SH}:G{SH}")
        for col, t, mg in [("B", "القسم", f"B{S1}:D{S1}"), ("E", "القيمة التعاقدية", None), ("F", "القيمة المنفذة", None),
                           ("G", "نسبة الإنجاز", None)]:
            put(ws, f"{col}{S1}", t, font(10, True, "FFFFFF"), fill(NAVY), align("center", wrap=True), BORDER, merge=mg)
        for i in range(N_SEC):
            r = S1 + 1 + i
            xs = E(p, S_REG, f"$B${SEC_FIRST+i}")
            put(ws, f"B{r}", f'=IF({xs}="","",{xs})', font(10, True, LINK_FONT), fill(ALT), align("right", indent=1), BORDER, merge=f"B{r}:D{r}")
            put(ws, f"E{r}", f"=N({E(p, S_REG, f'$E${SEC_FIRST+i}')})", font(10, False, LINK_FONT), None, align("center"), BORDER, ACC)
            put(ws, f"F{r}", f"=N({E(p, S_REG, f'$F${SEC_FIRST+i}')})", font(10, False, LINK_FONT), None, align("center"), BORDER, ACC)
            put(ws, f"G{r}", f"=IF(E{r}>0,F{r}/E{r},0)", font(10, True), None, align("center"), BORDER, PCT)
        SE = S1 + N_SEC
        ws.conditional_formatting.add(f"G{S1+1}:G{SE}", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
        # الرسوم البيانية
        ch = BarChart()
        ch.type = "col"
        ch.title = "منحنى الإنجاز: الفعلي (أعمدة) مقابل المخطط (خط)"
        ch.y_axis.numFmt = "0%"
        ch.y_axis.scaling.min, ch.y_axis.scaling.max = 0, 1
        ch.y_axis.majorGridlines = None
        ch.add_data(Reference(ws, min_col=11, min_row=T1 - 1, max_row=TN), titles_from_data=True)
        cats = Reference(ws, min_col=2, min_row=T1, max_row=TN)
        ch.set_categories(cats)
        ch.series[0].graphicalProperties.solidFill = "2E7D7A"
        ln = LineChart()
        ln.add_data(Reference(ws, min_col=12, min_row=T1 - 1, max_row=TN), titles_from_data=True)
        ln.series[0].graphicalProperties.line.solidFill = "C0504D"
        ln.series[0].graphicalProperties.line.width = 28000
        ln.series[0].smooth = True
        ch += ln
        for ax in (ch.x_axis, ch.y_axis):
            ax.delete = False
        ch.legend.position = "b"
        ch.height, ch.width = 8.5, 20
        ws.add_chart(ch, f"I{SH}")
        c2 = BarChart()
        c2.type = "col"
        c2.title = "المستحق مقابل المحصل لكل مستخلص"
        c2.add_data(Reference(ws, min_col=21, min_row=T1 - 1, max_row=TN), titles_from_data=True)
        c2.add_data(Reference(ws, min_col=22, min_row=T1 - 1, max_row=TN), titles_from_data=True)
        c2.set_categories(cats)
        c2.series[0].graphicalProperties.solidFill = "1F3A5F"
        c2.series[1].graphicalProperties.solidFill = "63BE7B"
        c2.y_axis.numFmt = "#,##0"
        c2.y_axis.majorGridlines = None
        for ax in (c2.x_axis, c2.y_axis):
            ax.delete = False
        c2.legend.position = "b"
        c2.height, c2.width = 8.5, 17
        ws.add_chart(c2, f"S{SH}")
        ws.freeze_panes = "A4"

    # ------------------------------------------------------------- الإجمالي العام
    ws = wsA
    COLS = [("B", "م", 5, "0"), ("C", "المشروع", 34, None), ("D", "رقم العقد", 13, None), ("E", "صاحب العمل", 24, None),
            ("F", "قيمة العقد الأصلية", 15, ACC0), ("G", "صافي التغييرية", 13, ACC0), ("H", "قيمة العقد المعدلة", 15, ACC0),
            ("I", "إجمالي قيمة الأعمال", 15, ACC0), ("J", "الإنجاز الفعلي", 9, PCT), ("K", "الإنجاز المخطط", 9, PCT),
            ("L", "الانحراف", 9, PCT), ("M", "SPI", 7, "0.00"), ("N", "آخر مستخلص", 8, '0;-0;"-"'),
            ("O", "صافي المستحق التراكمي", 15, ACC0), ("P", "المحصل", 15, ACC0), ("Q", "غير المحصل", 14, ACC0),
            ("R", "نسبة التحصيل", 9, PCT), ("S", "الضمان المحتجز", 13, ACC0), ("T", "رصيد الدفعة المقدمة", 13, ACC0),
            ("U", "الاستقطاعات الفنية", 12, ACC0), ("V", "الغرامات", 11, ACC0), ("W", "حالة المشروع", 15, None),
            ("X", "التنبيهات النظامية", 34, None), ("Y", "الموازنة التقديرية", 15, ACC0), ("Z", "التكلفة الفعلية", 15, ACC0),
            ("AA", "الربح الفعلي", 14, ACC0), ("AB", "هامش الربح", 9, PCT), ("AC", "CPI", 7, "0.00"),
            ("AD", "الربح المتوقع عند الإنجاز", 15, ACC0)]
    setup(ws, {"A": 2, **{c: w for c, _, w, _ in COLS}, "AE": 2}, NAVY, zoom=80)
    banner(ws, "B", "AD", "🏢 الإجمالي العام — ملخص المستخلصات لكل المشاريع (Portfolio Billing Summary)", SUB)
    nav_top(ws)
    A1, AN = 17, 17 + N_PROJ - 1
    AT = AN + 1
    cards = [
        (5, [("B", "D", "إجمالي قيمة العقود المعدلة", f"=H{AT}", ACC0, NAVY),
             ("E", "G", "إجمالي قيمة الأعمال المنفذة", f"=I{AT}", ACC0, TEAL),
             ("H", "J", "متوسط الإنجاز المرجح", f"=J{AT}", PCT, TEAL),
             ("K", "M", "متوسط المخطط المرجح", f"=K{AT}", PCT, NAVY),
             ("N", "P", "عدد المشاريع المفعّلة", f'=COUNTIF(W{A1}:W{AN},"<>غير مُفعّل")', "0", GOLD),
             ("Q", "S", "مشاريع متأخرة", f'=COUNTIF(W{A1}:W{AN},"*متأخر*")', "0", RED),
             ("T", "X", "الأعمال المتبقية", f"=MAX(0,H{AT}-SUMPRODUCT(H{A1}:H{AN},J{A1}:J{AN}))", ACC0, GREY_TXT)]),
        (8, [("B", "D", "صافي المستحق التراكمي", f"=O{AT}", ACC0, NAVY),
             ("E", "G", "إجمالي المحصل", f"=P{AT}", ACC0, GREEN),
             ("H", "J", "إجمالي غير المحصل", f"=Q{AT}", ACC0, RED),
             ("K", "M", "نسبة التحصيل", f"=R{AT}", PCT, GREEN),
             ("N", "P", "ضمان الأعمال المحتجز", f"=S{AT}", ACC0, "C0504D"),
             ("Q", "S", "أرصدة الدفعات المقدمة", f"=T{AT}", ACC0, "C0504D"),
             ("T", "X", "الاستقطاعات الفنية + الغرامات", f"=U{AT}+V{AT}", ACC0, "C0504D")]),
        (11, [("B", "D", "إجمالي الموازنات التقديرية", f"=Y{AT}", ACC0, "6A1B9A"),
              ("E", "G", "إجمالي التكاليف الفعلية", f"=Z{AT}", ACC0, "6A1B9A"),
              ("H", "J", "الربح الفعلي الإجمالي", f"=AA{AT}", ACC0, "6A1B9A"),
              ("K", "M", "هامش الربح الإجمالي", f"=AB{AT}", PCT, "6A1B9A"),
              ("N", "P", "مؤشر أداء التكلفة المرجح", f"=AC{AT}", "0.00", "6A1B9A"),
              ("Q", "S", "مشاريع تتجاوز الموازنة", f'=COUNTIFS(Z{A1}:Z{AN},">0",AC{A1}:AC{AN},"<0.95")', "0", RED),
              ("T", "X", "الربح المتوقع عند الإنجاز", f"=AD{AT}", ACC0, "6A1B9A")]),
    ]
    for row, its in cards:
        for c1, c2, lab, f, fmt, colr in its:
            card(ws, row, c1, c2, lab, f, fmt, colr, 14)
    put(ws, f"B{A1-2}", "ملخص المشاريع (اضغط على اسم المشروع للانتقال إلى تقريره)", font(11, True, "FFFFFF"), fill(TEAL),
        align("right", indent=1), merge=f"B{A1-2}:AD{A1-2}")
    headers(ws, A1 - 1, [(c, t) for c, t, _, _ in COLS], height=44)
    for p in range(1, N_PROJ + 1):
        r = A1 + p - 1
        K = KPI[p]
        PS = f"'{S_PRJ(p)}'!"
        vals = {"B": p, "C": f"={PS}$C$5", "D": f"={PS}$H$5", "E": f"={PS}$M$5",
                "F": f"={K['cv']}", "G": f"={K['vo']}", "H": f"={K['rev']}", "I": f"={K['gross']}",
                "J": f"={K['act']}", "K": f"={K['pln']}", "L": f"=J{r}-K{r}", "M": f"={K['spi']}", "N": f"={K['lat']}",
                "O": f"={K['due']}", "P": f"={K['paid']}", "Q": f"={K['out']}", "R": f"=IF(O{r}>0,P{r}/O{r},0)",
                "S": f"={K['ret']}", "T": f"={K['advb']}", "U": f"={K['td']}", "V": f"={K['pen']}", "W": f"={K['st']}", "X": f"={K['alert']}",
                "Y": f"={K['bac']}", "Z": f"={K['cost']}", "AA": f"={K['profit']}", "AB": f"={K['margin']}", "AC": f"={K['cpi']}",
                "AD": f"={K['fprofit']}"}
        vals["C"] = f'=IF({PS}$C$5="","مشروع رقم {p:02d}",{PS}$C$5)'
        for c, _, _, fmt in COLS:
            ws[f"{c}{r}"] = vals[c]
            calc(ws[f"{c}{r}"], fmt, align("right", wrap=True, indent=1) if c in ("C", "E", "X") else None,
                 bold=c in ("C", "J", "O"), fl=ALT if p % 2 == 0 else None)
        ws[f"C{r}"].hyperlink = Hyperlink(ref=f"C{r}", location=f"'{S_PRJ(p)}'!A1", display=S_PRJ(p))
        ws[f"C{r}"].font = font(10, True, NAVY2)
        ws.row_dimensions[r].height = 30
    put(ws, f"B{AT}", "الإجمالي", font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, merge=f"B{AT}:E{AT}")
    for c, _, _, fmt in COLS[4:]:
        if c in ("J", "K"):
            v = f"=IF(H{AT}>0,SUMPRODUCT({c}{A1}:{c}{AN},H{A1}:H{AN})/H{AT},0)"
        elif c == "L":
            v = f"=J{AT}-K{AT}"
        elif c == "M":
            v = f"=IF(K{AT}>0,J{AT}/K{AT},0)"
        elif c == "R":
            v = f"=IF(O{AT}>0,P{AT}/O{AT},0)"
        elif c in ("N", "W", "X"):
            v = None
        elif c == "AB":
            v = f"=IF(I{AT}>0,AA{AT}/I{AT},0)"
        elif c == "AC":
            v = f"=IF(Z{AT}>0,SUMPRODUCT(Y{A1}:Y{AN},J{A1}:J{AN})/Z{AT},0)"
        else:
            v = f"=SUM({c}{A1}:{c}{AN})"
        put(ws, f"{c}{AT}", v, font(10, True, "FFFFFF"), fill(NAVY), align("center"), BORDER, fmt)
    ws.row_dimensions[AT].height = 26
    ws.conditional_formatting.add(f"L{A1}:L{AN}", CellIsRule(operator="lessThan", formula=["-0.0001"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"J{A1}:J{AN}", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    ws.conditional_formatting.add(f"R{A1}:R{AN}", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="5B9BD5"))
    ws.conditional_formatting.add(f"W{A1}:W{AN}", FormulaRule(formula=[f'ISNUMBER(SEARCH("متأخر",W{A1}))'], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"W{A1}:W{AN}", FormulaRule(formula=[f'ISNUMBER(SEARCH("✔",W{A1}))'], fill=fill(GREEN_L), font=Font(color=GREEN, bold=True)))
    ws.conditional_formatting.add(f"B{A1}:AD{AN}", FormulaRule(formula=[f'$W{A1}="غير مُفعّل"'], font=Font(color="A0A0A0")))
    # الرسوم
    CR = AT + 3
    cats = Reference(ws, min_col=3, min_row=A1, max_row=AN)
    c1 = BarChart()
    c1.type = "bar"
    c1.title = "نسبة الإنجاز الفعلية مقابل المخططة لكل مشروع"
    c1.add_data(Reference(ws, min_col=10, max_col=11, min_row=A1 - 1, max_row=AN), titles_from_data=True)
    c1.set_categories(cats)
    c1.series[0].graphicalProperties.solidFill = "2E7D7A"
    c1.series[1].graphicalProperties.solidFill = "C9D3DD"
    c1.y_axis.numFmt = "0%"
    c1.y_axis.scaling.min, c1.y_axis.scaling.max = 0, 1
    c1.y_axis.majorGridlines = None
    for ax in (c1.x_axis, c1.y_axis):
        ax.delete = False
    c1.legend.position = "b"
    c1.height, c1.width = 28, 20
    ws.add_chart(c1, f"B{CR}")
    c2 = BarChart()
    c2.type = "col"
    c2.title = "صافي المستحق مقابل المحصل وغير المحصل لكل مشروع"
    c2.add_data(Reference(ws, min_col=15, max_col=17, min_row=A1 - 1, max_row=AN), titles_from_data=True)
    c2.set_categories(cats)
    for s, colr in zip(c2.series, ["1F3A5F", "63BE7B", "C0504D"]):
        s.graphicalProperties.solidFill = colr
    c2.y_axis.numFmt = "#,##0"
    c2.y_axis.majorGridlines = None
    for ax in (c2.x_axis, c2.y_axis):
        ax.delete = False
    c2.legend.position = "b"
    c2.height, c2.width = 12, 34
    ws.add_chart(c2, f"J{CR}")
    ws.conditional_formatting.add(f"AC{A1}:AC{AN}", FormulaRule(formula=[f"AND(Z{A1}>0,AC{A1}<0.95)"], fill=fill(RED_L), font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"AA{A1}:AA{AN}", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=RED, bold=True)))
    ws.conditional_formatting.add(f"AD{A1}:AD{AN}", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=RED, bold=True)))
    c3 = BarChart()
    c3.type = "col"
    c3.title = "الموازنة مقابل التكلفة الفعلية والربح لكل مشروع"
    c3.add_data(Reference(ws, min_col=25, max_col=27, min_row=A1 - 1, max_row=AN), titles_from_data=True)
    c3.set_categories(cats)
    for s_, colr in zip(c3.series, ["B39DDB", "6A1B9A", "2E7D7A"]):
        s_.graphicalProperties.solidFill = colr
    c3.y_axis.numFmt = "#,##0"
    c3.y_axis.majorGridlines = None
    for ax in (c3.x_axis, c3.y_axis):
        ax.delete = False
    c3.legend.position = "b"
    c3.height, c3.width = 12, 34
    ws.add_chart(c3, f"J{CR+26}")
    ws.freeze_panes = "A4"

    # ------------------------------------------------------------- التعليمات
    ws = wsG
    setup(ws, {"A": 2, "B": 30, "C": 95}, GOLD)
    banner(ws, "B", "C", "📘 نظام تتبع المستخلصات متعدد المشاريع — دليل الاستخدام والربط", SUB)
    button(ws, "B3", "🏠 الإجمالي العام", S_ALL, NAVY)
    button(ws, "C3", "📊 تقرير المشروع 01", S_PRJ(1), TEAL)
    r = 5
    section(ws, f"B{r}", "مكونات النظام (فولدر رئيسي: ملف التقارير + فولدر مستقل لكل مشروع)", f"B{r}:C{r}", NAVY2)
    comps = [(REPORT_FILE, f"ملف التقارير (هذا الملف): {N_PROJ} شيتات تقرير — شيت لكل مشروع — والشيت الأخير «{S_ALL}» يجمع كل المشاريع."),
             (cert_rel(1) + "\n…\n" + cert_rel(N_PROJ),
              f"ملف مستخلصات لكل مشروع: بيانات العقد، جدول الكميات، التغييرية، الاستقطاعات، {N_IPC} شيت مستخلص مترابطة، وسجل المستخلصات.")]
    for a, b in comps:
        r += 1
        put(ws, f"B{r}", a, font(10, True, NAVY), fill(ALT), align("center", wrap=True), BORDER)
        put(ws, f"C{r}", b, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 36
    r += 2
    section(ws, f"B{r}", "طريقة العمل", f"B{r}:C{r}", NAVY2)
    for a, b in [("1. افتح ملف المشروع", "مثلاً Project_01/IPC_Project_01.xlsx — أدخل بيانات العقد وجدول الكميات مرة واحدة، وضع مستندات المشروع (عقود، محاضر، فواتير) في نفس فولدره."),
                 ("2. اعمل المستخلص", "في شيت «مستخلص NN»: الفترة والتواريخ والكميات الحالية والمواد والغرامات والتحصيل. "
                                      "السابق يُسحب آلياً من المستخلص الذي قبله."),
                 ("3. احفظ الملف", "كل الحسابات تتجمع في «سجل المستخلصات» داخل ملف المشروع."),
                 ("4. افتح ملف التقارير", "اضغط «تمكين المحتوى» ثم «تحديث» عند ظهور رسالة الروابط — تنتقل الأرقام آلياً لتقرير "
                                          "المشروع وللإجمالي العام. (يمكن أيضاً: بيانات ← تحرير الارتباطات ← تحديث القيم)."),
                 ("مشروع جديد", f"المشاريع 4 إلى {N_PROJ} قوالب فارغة جاهزة كل منها في فولدره: افتح ملف المشروع وابدأ بإدخال البيانات، وسيظهر آلياً في التقارير."),
                 ("تغيير مكان الملفات", "انقل الفولدر الرئيسي كاملاً بما فيه فولدرات المشاريع. لا تغيّر أسماء الفولدرات أو الملفات؛ وإن لزم: بيانات ← تحرير الارتباطات ← تغيير المصدر.")]:
        r += 1
        put(ws, f"B{r}", a, font(10, True, "FFFFFF"), fill(TEAL), align("center", wrap=True), BORDER)
        put(ws, f"C{r}", b, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 38
    r += 2
    section(ws, f"B{r}", "التوافق مع الأنظمة السعودية", f"B{r}:C{r}", "006C35")
    for a_, b_ in SAUDI_NOTES:
        r += 1
        put(ws, f"B{r}", a_, font(10, True, "006C35"), fill(GREEN_L), align("right", indent=1), BORDER)
        put(ws, f"C{r}", b_, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 34
    r += 2
    section(ws, f"B{r}", "منطق الاحتساب (كل القيم تراكمية — الحالي = التراكمي − السابق)", f"B{r}:C{r}", NAVY2)
    for a, b in [("قيمة الأعمال", "Σ (الكمية التراكمية لكل بند × سعر الوحدة)، والكمية التراكمية = السابقة + الحالية."),
                 ("نسبة الإنجاز", "(الأعمال + التغييرية المدرجة) ÷ (قيمة العقد الأصلية + التغييرية المدرجة)."),
                 ("استرداد الدفعة المقدمة", "MIN(قيمة الدفعة ، MAX(0 ، الأعمال − نسبة البدء × العقد) × نسبة الاسترداد)، ويُسترد الرصيد كاملاً عند نسبة الاسترداد الكامل."),
                 ("ضمان الأعمال", "MIN(إجمالي القيمة × نسبة الضمان ، الحد الأقصى) − المفرج عنه تراكمياً."),
                 ("الاستقطاعات الفنية", "المستقطع حتى المستخلص − المفرج عنه حتى المستخلص."),
                 ("الضرائب", "ض.ق.م على الصافي (+ الضمان إن كان الإعداد «نعم»)، وضريبة الاستقطاع (لغير المقيم فقط) على الصافي قبل خصم الضمان، والغرامات لا تُخفض وعاء الضريبة افتراضياً."),
                 ("SPI", "الإنجاز الفعلي ÷ المخطط — أقل من 1 = تأخر."),
                 ("الموازنة والربحية", "BAC = التكلفة المباشرة + العمومية + الطوارئ. الربح = إجمالي قيمة الأعمال − التكلفة الفعلية. "
                                       "CPI = (BAC × نسبة الإنجاز) ÷ التكلفة الفعلية؛ أقل من 0.95 = تجاوز. EAC = BAC ÷ CPI."),
                 ("الإجمالي العام", "متوسطات الإنجاز مرجحة بقيمة العقد المعدلة لكل مشروع.")]:
        r += 1
        put(ws, f"B{r}", a, font(10, True, NAVY), fill(ALT), align("right", indent=1), BORDER)
        put(ws, f"C{r}", b, font(10), None, align("right", wrap=True, indent=1), BORDER)
        ws.row_dimensions[r].height = 30

    # ------------------------------------------------------------- روابط الملفات الخارجية + القيم المخزنة
    def serial(v):
        if isinstance(v, dt.datetime):
            return str((v - dt.datetime(1899, 12, 30)).total_seconds() / 86400)
        if isinstance(v, dt.date):
            return str((v - dt.date(1899, 12, 30)).days)
        return None

    for p in range(1, N_PROJ + 1):
        vals = cert_values.get(p)
        names = vals.sheetnames if vals else [S_GUIDE, S_SET, S_BOQ, S_VO, S_TD, S_REG] + [S_IPC(n) for n in range(1, N_IPC + 1)]
        sdata = []
        for sheet, cells in E.refs.get(p, {}).items():
            rows = {}
            for ref in cells:
                v = vals[sheet][ref].value if vals else None
                if v is None or v == "":
                    ec = ExternalCell(r=ref, t="str", v="")
                elif isinstance(v, bool):
                    ec = ExternalCell(r=ref, t="b", v=str(int(v)))
                elif isinstance(v, (int, float)):
                    ec = ExternalCell(r=ref, v=repr(float(v)) if isinstance(v, float) else str(v))
                elif serial(v):
                    ec = ExternalCell(r=ref, v=serial(v))
                else:
                    ec = ExternalCell(r=ref, t="str", v=str(v))
                rn = int("".join(ch for ch in ref if ch.isdigit()))
                rows.setdefault(rn, []).append(ec)
            col_key = lambda c: (len(c.r.rstrip("0123456789")), c.r.rstrip("0123456789"))
            sdata.append(ExternalSheetData(sheetId=names.index(sheet),
                                           row=[ExternalRow(r=rn, cell=sorted(cs, key=col_key)) for rn, cs in sorted(rows.items())]))
        sdata.sort(key=lambda s: s.sheetId)
        bk = ExternalBook(sheetNames=ExternalSheetNames(list(names)), sheetDataSet=ExternalSheetDataSet(sdata), id="rId1")
        lk = ExternalLink(externalBook=bk)
        lk.file_link = Relationship(type="externalLinkPath", Target=cert_rel(p), TargetMode="External", Id="rId1")
        wb._external_links.append(lk)

    wb.active = wb.sheetnames.index(S_ALL)
    wb.calculation.fullCalcOnLoad = True
    path = os.path.join(OUT_DIR, REPORT_FILE)
    wb.save(path)
    return path


# =====================================================================================
if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    # المرحلة 1: بناء ملفات المستخلصات وحساب صافي كل مستخلص لتوليد بيانات تحصيل توضيحية
    paid_map = {}
    for p in range(1, N_PROJ + 1):
        path = build_cert(p)
        if p in SAMPLE and RECALC:
            c = load_workbook(recalc_copy(path), data_only=True)[S_REG]
            sp = SAMPLE[p]
            pm = {}
            for n in range(1, sp["n_ipc"] + 1):
                z = c[f"Z{REG_FIRST + n - 1}"].value
                appr = c[f"E{REG_FIRST + n - 1}"].value
                if not appr or n == sp["n_ipc"]:
                    continue
                pm[n] = round(round(z, 2) * sp["partial"].get(n, 1), -3 if n in sp["partial"] else 2)
            paid_map[p] = pm
    # المرحلة 2: إعادة البناء بالتحصيل ثم القيم النهائية
    cert_values = {}
    for p in range(1, N_PROJ + 1):
        path = build_cert(p, paid_map.get(p))
        if RECALC:
            cert_values[p] = load_workbook(recalc_copy(path), data_only=True)
    rep = build_report(cert_values)
    if RECALC:
        # يتم التحقق من نسخة في فولدر الحساب (مع وجود ملفات المشاريع المحسوبة بجوارها)
        recalc_copy(rep)
    print("done")
