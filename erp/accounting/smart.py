"""
المساعد الذكي للتوجيه المحاسبي.

يقترح الحساب/المشروع/الضريبة المناسبة لأي بيان (سطر فاتورة، سند صرف، سطر قيد) من ثلاثة مصادر:
1) قاموس كلمات مفتاحية خاص بالمقاولات والمصروفات في مصر.
2) التعلّم من السجل: كل بيان سبق ترحيله وإلى أي حساب ذهب (كلما زاد الاستخدام زادت الدقة).
3) عادة جهة التعامل: الحسابات والمشروعات التي يتكرر استخدامها مع نفس المورد/العميل.
ويقدّم أيضاً تنبيهات على مستوى المستند (فاتورة مكررة، مقاول باطن، أصل ثابت، تكلفة مباشرة بدون مشروع).
"""
import datetime as dt
import math
import re
from collections import Counter, defaultdict
from decimal import Decimal

from .models import Account, Tax

_DIACRITICS = re.compile(r"[ؗ-ًؚ-ْـ]")
_STOP = {"من", "الى", "على", "في", "عن", "مع", "و", "او", "رقم", "عدد", "شهر", "سنه", "بتاريخ", "قيمه", "مبلغ",
         "فاتوره", "توريد", "سداد", "دفع", "صرف", "خاص", "لصالح", "حساب", "عن", "ذلك", "هذا", "مم", "طن",
         "م3", "م2", "متر", "كيلو", "كجم", "لتر", "عدد"}


def normalize(text):
    t = _DIACRITICS.sub("", str(text or "").lower())
    t = re.sub("[إأآا]", "ا", t)
    t = t.replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def tokens(text):
    out = []
    for w in normalize(text).split():
        if w.isdigit() or len(w) < 2:
            continue
        for pre in ("وال", "بال", "لل", "ال"):
            if w.startswith(pre) and len(w) - len(pre) >= 3:
                w = w[len(pre):]
                break
        if w not in _STOP:
            out.append(w)
    return out


# (كلمات مفتاحية، كود الحساب، التصنيف، تلميح إضافي)
RULES = [
    (["حديد", "تسليح", "اسمنت", "رمل", "زلط", "سن", "طوب", "بلوك", "خرسانه", "جاهزه", "سيراميك", "بلاط", "رخام",
      "دهان", "بويه", "معجون", "خشب", "موسير", "مواسير", "كابل", "كابلات", "عزل", "بيتومين", "جبس", "سلك",
      "مسامير", "زجاج", "الوميتال", "بورسلين", "انترلوك", "بردورات", "اسفلت", "مونه", "حوائط", "كمر", "صاج",
      "مواد", "خامات"], "5101", "مواد وخامات للمشروع",
     "تكلفة مباشرة: حدد المشروع. ولو الصنف بيتخزن قبل الصرف سجّله كصنف مخزني ثم اصرفه بإذن صرف للمشروع"),
    (["سولار", "بنزين", "وقود", "زيت", "زيوت", "شحوم", "جاز", "غاز"], "5105", "وقود وزيوت",
     "غالباً تكلفة على معدات مشروع - حدد المشروع"),
    (["لودر", "حفار", "بلدوزر", "ونش", "هراس", "معده", "معدات", "كساره", "بوكلين", "جريدر", "رافعه", "اوناش",
      "قلاب", "خلاطه", "مضخه", "شده", "سقاله"], "5104", "إيجار معدات",
     "لو دي فاتورة شراء معدة (مش إيجار) فهي أصل ثابت وليست مصروفاً"),
    (["نقل", "مشال", "نولون", "شحن", "تحميل", "تنزيل", "عربيه نقل"], "5106", "نقل ومشال", None),
    (["عماله", "يوميات", "يوميه", "انفار", "اجور", "اجر", "مصنعيه"], "5103", "أجور عمالة موقع", None),
    (["مقاول", "مقاولات", "مستخلص", "تركيب", "اعمال"], "5102", "أعمال مقاولي باطن",
     "لو الطرف مقاول باطن له عقد، الأفضل تسجيلها كمستخلص على العقد لحساب المحتجزات والدفعات المقدمة"),
    (["ايجار مكتب", "ايجار مقر", "ايجار الشركه", "ايجار شقه"], "5202", "إيجار مكاتب", None),
    (["كهرباء", "مياه", "عداد"], "5203", "كهرباء ومياه", None),
    (["انترنت", "تليفون", "موبايل", "اتصالات", "كارت شحن", "باقه", "فودافون", "اورنج", "اتصالات", "وي"], "5204",
     "اتصالات وإنترنت", None),
    (["ورق", "احبار", "حبر", "طباعه", "تصوير", "ادوات كتابيه", "مطبوعات", "دفاتر", "اقلام", "ملفات"], "5205",
     "أدوات كتابية ومطبوعات", None),
    (["عموله بنكيه", "مصاريف بنكيه", "مصروفات بنكيه", "رسوم تحويل", "دفتر شيكات", "كشف حساب"], "5206",
     "مصروفات بنكية", None),
    (["اتعاب", "محاسب", "محامي", "استشاري", "استشارات", "مراجعه", "مراجع", "تدقيق", "قانوني"], "5207",
     "أتعاب مهنية", "غالباً يخضع لخصم وإضافة 5%"),
    (["صيانه", "اصلاح", "قطع غيار", "تصليح", "كاوتش", "اطارات", "بطاريه"], "5208", "صيانة وإصلاحات", None),
    (["ضيافه", "بوفيه", "شاي", "قهوه", "سكر", "نظافه", "منظفات", "وجبات", "اكل", "مياه شرب"], "5209",
     "ضيافة ونظافة", None),
    (["انتقالات", "سفر", "مواصلات", "تذاكر", "فندق", "اقامه", "بدل سفر", "تاكسي", "اوبر"], "5210",
     "انتقالات وسفر", None),
    (["غرامه", "مخالفه", "جزاء"], "5211", "غرامات وجزاءات", "الغرامات غالباً مصروف غير قابل للخصم ضريبياً"),
    (["رسوم", "ترخيص", "تراخيص", "دمغه", "نقابه", "اشتراك", "سجل تجاري", "غرفه تجاريه", "شهر عقاري"], "5212",
     "رسوم واشتراكات حكومية", None),
    (["اعلان", "دعايه", "تسويق", "لافته", "يافطه", "بروشور"], "5214", "دعاية وإعلان", None),
    (["فوائد", "فايده", "تمويل"], "5401", "فوائد ومصروفات تمويلية", None),
]

ASSET_RULES = [
    (["سياره", "عربيه", "ميكروباص", "نصف نقل", "ربع نقل", "جيب", "دبل كابينه"], "1114", "سيارات"),
    (["كمبيوتر", "حاسب", "لابتوب", "طابعه", "سيرفر", "شاشه", "راوتر"], "1116", "أجهزة حاسب"),
    (["مكتب", "كرسي", "كراسي", "دولاب", "اثاث", "تكييف", "ثلاجه"], "1115", "أثاث وتجهيزات"),
    (["لودر", "حفار", "بلدوزر", "ونش", "هراس", "خلاطه", "مولد", "كمبروسر", "معده", "بوكلين", "جريدر"], "1113",
     "آلات ومعدات"),
    (["شده", "سقاله", "عدد", "معدات يدويه"], "1117", "عدد وشدات"),
]
ASSET_TRIGGERS = ["شراء", "اقتناء", "جديد", "جديده", "موديل"]

SALE_RULES = [
    (["تاجير", "ايجار", "معدات", "لودر", "ونش"], "4104", "إيرادات تأجير معدات وخدمات", None),
    (["خرده", "سكراب", "مخلفات", "هالك"], "4201", "إيرادات متنوعة (بيع خردة)", None),
    (["مستخلص", "اعمال", "مقاولات"], "4101", "إيرادات أعمال مقاولات",
     "لو دي أعمال على عقد عميل، الأفضل إصدار مستخلص من موديول المقاولات"),
]


def _norm_kw(kw):
    return " ".join(tokens(kw)) or normalize(kw)


def _match_rules(text, rules):
    norm = " " + " ".join(tokens(text)) + " "
    raw = " " + normalize(text) + " "
    hits = []
    for rule in rules:
        kws, code, label = rule[0], rule[1], rule[2]
        hint = rule[3] if len(rule) > 3 else None
        matched = [k for k in kws if f" {_norm_kw(k)} " in norm or f" {normalize(k)} " in raw]
        if matched:
            hits.append((code, label, hint, matched))
    # العبارة الأطول تغلب: «كارت شحن» تلغي مطابقة «شحن» المنفردة في قاعدة أخرى
    phrases = [normalize(k) for h in hits for k in h[3] if " " in normalize(k)]
    out = []
    for code, label, hint, matched in hits:
        kept = [k for k in matched if not any(normalize(k) != ph and f" {normalize(k)} " in f" {ph} " for ph in phrases)]
        if kept:
            out.append((code, label, hint, kept))
    return out


# ---------------------------------------------------------------------------- التعلّم من السجل
_cache = {"at": None, "model": None}


def _history_model():
    """فهرس: كلمة -> عداد الحسابات، مبني من سطور الفواتير والسندات وقيود اليومية المرحّلة."""
    now = dt.datetime.now()
    if _cache["at"] and (now - _cache["at"]).seconds < 120:
        return _cache["model"]
    from commerce.models import InvoiceLine, Payment
    from .models import JournalLine
    word_acc = defaultdict(Counter)
    docs = 0
    for desc, acc in (InvoiceLine.objects.filter(invoice__state="posted").exclude(description="")
                      .values_list("description", "account_id")[:20000]):
        if acc:
            for w in set(tokens(desc)):
                word_acc[w][acc] += 1
            docs += 1
    for memo, acc in (Payment.objects.filter(state="posted", purpose="account").exclude(memo="")
                      .values_list("memo", "counter_account_id")[:20000]):
        for w in set(tokens(memo)):
            word_acc[w][acc] += 1
        docs += 1
    for label, acc in (JournalLine.objects.filter(entry__state="posted", entry__source="manual",
                                                  account__type__in=("expense", "income", "asset"))
                       .exclude(label="").values_list("label", "account_id")[:20000]):
        for w in set(tokens(label)):
            word_acc[w][acc] += 1
        docs += 1
    model = dict(word_acc=word_acc, docs=max(docs, 1))
    _cache.update(at=now, model=model)
    return model


def invalidate_cache():
    _cache["at"] = None


def _partner_habits(partner, side):
    """أكثر الحسابات والمشروعات والضرائب استخداماً مع هذه الجهة."""
    from commerce.models import InvoiceLine
    kinds = ("sale", "sale_return") if side == "sale" else ("purchase", "purchase_return")
    qs = InvoiceLine.objects.filter(invoice__partner=partner, invoice__state="posted", invoice__kind__in=kinds)
    accounts = Counter()
    projects = Counter()
    vats = Counter()
    for acc, prd_exp, prd_inc, prj, inv_prj, vat in qs.values_list(
            "account_id", "product__expense_account_id", "product__income_account_id", "project_id",
            "invoice__project_id", "vat_id")[:2000]:
        a = acc or (prd_inc if side == "sale" else prd_exp)
        if a:
            accounts[a] += 1
        if prj or inv_prj:
            projects[prj or inv_prj] += 1
        vats[vat] += 1
    from commerce.models import Invoice
    whts = Counter(Invoice.objects.filter(partner=partner, state="posted", kind__in=kinds)
                   .values_list("wht_id", flat=True)[:500])
    return dict(accounts=accounts, projects=projects, vats=vats, whts=whts, count=qs.count())


# ---------------------------------------------------------------------------- اقتراح سطر
def suggest_line(text, partner=None, side="purchase", amount=None):
    """يرجع قائمة اقتراحات مرتبة: [{account_id, account, confidence, reasons, hint}]."""
    scores = defaultdict(float)
    reasons = defaultdict(list)
    hints = {}
    codes = {a.code: a for a in Account.objects.filter(is_group=False, active=True)}
    by_id = {a.id: a for a in codes.values()}

    # 1) القواعد
    rules = SALE_RULES if side == "sale" else RULES
    toks = tokens(text)
    is_asset = side == "purchase" and any(t in toks for t in ASSET_TRIGGERS)
    if is_asset:
        for code, label, _, matched in _match_rules(text, [(r[0], r[1], r[2]) for r in ASSET_RULES]):
            if code in codes:
                a = codes[code]
                scores[a.id] += 3.0
                reasons[a.id].append(f"شراء أصل ({label}): «{'، '.join(matched)}»")
                hints[a.id] = "ده غالباً أصل ثابت: بعد ترحيل الفاتورة سجّله في شاشة الأصول الثابتة لحساب الإهلاك آلياً"
    for code, label, hint, matched in _match_rules(text, rules):
        if code in codes:
            a = codes[code]
            scores[a.id] += 1.5 + 0.3 * (len(matched) - 1)
            reasons[a.id].append(f"كلمات دالة على «{label}»: {'، '.join(matched)}")
            if hint and a.id not in hints:
                hints[a.id] = hint

    # 2) التعلّم من السجل (TF-IDF مبسط)
    if toks:
        m = _history_model()
        for w in set(toks):
            counter = m["word_acc"].get(w)
            if not counter:
                continue
            total = sum(counter.values())
            idf = math.log(1 + m["docs"] / (1 + total))
            for acc_id, n in counter.most_common(3):
                if acc_id in by_id:
                    share = n / total
                    scores[acc_id] += 2.0 * share * min(idf, 3) / 3 + 0.4 * share
                    reasons[acc_id].append(f"«{w}» سُجّلت على هذا الحساب {n} مرة سابقاً")

    # 3) عادة جهة التعامل
    if partner is not None:
        habits = _partner_habits(partner, side)
        tot = sum(habits["accounts"].values())
        for acc_id, n in habits["accounts"].most_common(2):
            if acc_id in by_id:
                scores[acc_id] += 1.2 * n / tot
                reasons[acc_id].append(f"{partner.name}: {n} من {tot} سطر سابق على هذا الحساب")

    if not scores:
        return []
    top = sorted(scores.items(), key=lambda kv: -kv[1])[:3]
    best = top[0][1]
    out = []
    for acc_id, sc in top:
        conf = min(98, round(100 * (1 - math.exp(-sc / 1.6)) * (sc / best) ** 0.5))
        a = by_id[acc_id]
        out.append(dict(account_id=acc_id, account=str(a), confidence=conf, reasons=reasons[acc_id][:3],
                        hint=hints.get(acc_id), is_cost=a.code.startswith("51")))
    return out


def suggest_project(text, partner=None, side="purchase"):
    from contracting.models import Project
    active = list(Project.objects.filter(status__in=("active", "planning", "completed")))
    norm = normalize(text)
    for p in active:
        names = [normalize(p.code), normalize(p.name)] + [t for t in tokens(p.name) if len(t) > 3]
        if any(n and n in norm for n in names):
            return dict(id=p.id, name=str(p), reason="اسم/كود المشروع مذكور في البيان")
    if partner is not None:
        habits = _partner_habits(partner, side)
        if habits["projects"]:
            pid, n = habits["projects"].most_common(1)[0]
            p = next((x for x in active if x.id == pid), None)
            if p:
                return dict(id=p.id, name=str(p), reason=f"آخر تعاملات {partner.name} كانت على هذا المشروع ({n})")
        if side == "sale":
            p = next((x for x in active if x.customer_id == partner.id), None)
            if p:
                return dict(id=p.id, name=str(p), reason="العميل هو مالك هذا المشروع")
    if len(active) == 1:
        return dict(id=active[0].id, name=str(active[0]), reason="المشروع الوحيد الجاري")
    return None


def suggest_taxes(partner=None, side="purchase", product=None):
    vat = wht = None
    reason_v = reason_w = ""
    if product is not None:
        t = product.sale_tax if side == "sale" else product.purchase_tax
        if t:
            vat, reason_v = t, "ضريبة الصنف"
    if partner is not None:
        h = _partner_habits(partner, side)
        if vat is None and h["vats"]:
            vid, _ = h["vats"].most_common(1)[0]
            if vid:
                vat, reason_v = Tax.objects.filter(pk=vid).first(), "المعتاد مع هذه الجهة"
        if h["whts"]:
            wid, _ = h["whts"].most_common(1)[0]
            if wid:
                wht, reason_w = Tax.objects.filter(pk=wid).first(), "المعتاد مع هذه الجهة"
        if vat is None and partner.tax_id:
            vat, reason_v = Tax.objects.filter(kind="vat", rate=14, active=True).first(), "الجهة مسجلة ضريبياً"
    return dict(vat=dict(id=vat.id, name=vat.name, reason=reason_v) if vat else None,
                wht=dict(id=wht.id, name=wht.name, reason=reason_w) if wht else None)


# ---------------------------------------------------------------------------- تنبيهات المستند
def review_invoice(kind, partner=None, date=None, reference="", total=None, lines=(), invoice_id=None,
                   project_id=None):
    """
    lines: [{"text":..., "account_id":..., "project_id":..., "amount":...}]
    يرجع قائمة تنبيهات: [{level: info|warning|danger, text, link?}]
    """
    from commerce.models import Invoice
    from contracting.models import Contract
    notes = []
    side = "sale" if kind.startswith("sale") else "purchase"
    total = Decimal(str(total or 0))

    if partner is not None:
        dup = Invoice.objects.filter(partner=partner, kind=kind).exclude(pk=invoice_id).exclude(state="cancelled")
        if reference:
            same_ref = dup.filter(reference__iexact=reference.strip()).first()
            if same_ref:
                notes.append(dict(level="danger", text=f"رقم الفاتورة «{reference}» مسجل من قبل لنفس الجهة في {same_ref.number}",
                                  link=same_ref.get_absolute_url()))
        if total and date:
            d = date if isinstance(date, dt.date) else dt.date.fromisoformat(str(date))
            near = dup.filter(total=total, date__gte=d - dt.timedelta(days=10), date__lte=d + dt.timedelta(days=10)).first()
            if near:
                notes.append(dict(level="warning", text=f"توجد فاتورة بنفس القيمة ({total:,.2f}) لنفس الجهة بتاريخ قريب: {near.number} — تأكد أنها ليست مكررة",
                                  link=near.get_absolute_url()))
        if side == "purchase" and partner.type == "subcontractor":
            c = Contract.objects.filter(partner=partner, kind="sub", status="active").first()
            if c:
                notes.append(dict(level="info", text=f"{partner.name} مقاول باطن وله عقد ساري ({c.number}). يُفضل تسجيل أعماله كمستخلص لضبط المحتجزات والتأمينات والدفعات المقدمة",
                                  link=f"/certificates/new/?kind=sub&contract={c.id}"))
        if side == "sale":
            c = Contract.objects.filter(partner=partner, kind="client", status="active").first()
            if c:
                notes.append(dict(level="info", text=f"العميل له عقد مقاولات ساري ({c.number}). لو الفاتورة عن أعمال منفذة فالأصح إصدار مستخلص",
                                  link=f"/certificates/new/?kind=client&contract={c.id}"))
            if partner.credit_limit and partner.balance() + total > partner.credit_limit:
                notes.append(dict(level="warning", text=f"الفاتورة ستتجاوز حد ائتمان العميل ({partner.credit_limit:,.2f})"))

    accs = {a.id: a for a in Account.objects.filter(id__in=[ln.get("account_id") for ln in lines if ln.get("account_id")])}
    for i, ln in enumerate(lines, 1):
        a = accs.get(ln.get("account_id"))
        if a and a.code.startswith("51") and not (ln.get("project_id") or project_id):
            notes.append(dict(level="warning", text=f"السطر {i}: «{a.name}» تكلفة مباشرة مشروعات — حدد المشروع حتى تظهر في ربحيته"))
        if side == "purchase" and ln.get("text"):
            toks = tokens(ln["text"])
            if any(t in toks for t in ASSET_TRIGGERS) and _match_rules(ln["text"], [(r[0], r[1], r[2]) for r in ASSET_RULES]) \
                    and not (a and a.type == "asset"):
                notes.append(dict(level="info", text=f"السطر {i}: يبدو شراء أصل ثابت — وجّهه لحساب الأصل بدلاً من المصروف"))
    if side == "purchase" and total >= 0 and partner is not None and not partner.tax_id and total > 50000:
        notes.append(dict(level="info", text="المورد غير مسجل برقم ضريبي — راجع خصم الضريبة وإمكانية خصم ض.ق.م"))
    return notes
