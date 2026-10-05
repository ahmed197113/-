from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.urls import reverse

ZERO = Decimal("0")
D2 = Decimal("0.01")


def r2(x):
    return (Decimal(x or 0)).quantize(D2)


class Company(models.Model):
    """بيانات الشركة والإعدادات العامة (سجل واحد فقط)."""

    name = models.CharField("اسم الشركة", max_length=200, default="شركتي للمقاولات")
    legal_name = models.CharField("الاسم القانوني", max_length=200, blank=True)
    tax_id = models.CharField("رقم التسجيل الضريبي", max_length=50, blank=True)
    commercial_reg = models.CharField("السجل التجاري", max_length=50, blank=True)
    address = models.CharField("العنوان", max_length=300, blank=True)
    phone = models.CharField("التليفون", max_length=50, blank=True)
    email = models.EmailField("البريد الإلكتروني", blank=True)
    currency = models.CharField("العملة", max_length=10, default="ج.م")
    currency_name = models.CharField("اسم العملة", max_length=30, default="جنيه")
    currency_sub = models.CharField("اسم الكسر", max_length=30, default="قرش")
    fiscal_year_start = models.DateField("بداية السنة المالية", null=True, blank=True)
    lock_date = models.DateField(
        "تاريخ إقفال الفترات",
        null=True,
        blank=True,
        help_text="لا يُسمح بإنشاء أو تعديل أي قيد بتاريخ يساوي أو يسبق هذا التاريخ",
    )

    class Meta:
        verbose_name = "الشركة"

    def __str__(self):
        return self.name

    @classmethod
    def get(cls):
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create()
        return obj


class Account(models.Model):
    TYPE_CHOICES = [
        ("asset", "أصول"),
        ("liability", "خصوم"),
        ("equity", "حقوق ملكية"),
        ("income", "إيرادات"),
        ("expense", "مصروفات وتكاليف"),
    ]
    KIND_CHOICES = [
        ("other", "عادي"),
        ("cash", "خزينة / نقدية"),
        ("bank", "بنك"),
        ("receivable", "عملاء / مدينون"),
        ("payable", "موردون / دائنون"),
    ]
    code = models.CharField("الكود", max_length=20, unique=True)
    name = models.CharField("اسم الحساب", max_length=200)
    parent = models.ForeignKey(
        "self", verbose_name="الحساب الرئيسي", null=True, blank=True,
        on_delete=models.PROTECT, related_name="children",
    )
    type = models.CharField("نوع الحساب", max_length=10, choices=TYPE_CHOICES)
    kind = models.CharField("طبيعة خاصة", max_length=12, choices=KIND_CHOICES, default="other")
    is_group = models.BooleanField("حساب تجميعي (لا يقبل قيود)", default=False)
    active = models.BooleanField("نشط", default=True)
    notes = models.CharField("ملاحظات", max_length=300, blank=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "حساب"
        verbose_name_plural = "شجرة الحسابات"

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def debit_nature(self):
        return self.type in ("asset", "expense")

    @property
    def level(self):
        lvl, p = 0, self.parent
        while p is not None:
            lvl += 1
            p = p.parent
        return lvl

    def descendants_ids(self):
        ids, frontier = [self.id], [self.id]
        while frontier:
            frontier = list(Account.objects.filter(parent_id__in=frontier).values_list("id", flat=True))
            ids += frontier
        return ids

    def balance(self, date_to=None, date_from=None, **filters):
        """الرصيد (مدين - دائن) شاملاً الحسابات الفرعية."""
        qs = JournalLine.objects.filter(entry__state="posted", account_id__in=self.descendants_ids(), **filters)
        if date_to:
            qs = qs.filter(entry__date__lte=date_to)
        if date_from:
            qs = qs.filter(entry__date__gte=date_from)
        agg = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        return (agg["d"] or ZERO) - (agg["c"] or ZERO)

    def clean(self):
        if self.parent and self.parent_id == self.id:
            raise ValidationError("لا يمكن أن يكون الحساب أباً لنفسه")
        if self.parent and not self.parent.is_group:
            raise ValidationError({"parent": "الحساب الرئيسي يجب أن يكون حساباً تجميعياً"})

    def get_absolute_url(self):
        return reverse("account_ledger") + f"?account={self.id}"


class AccountMapping(models.Model):
    """ربط الأدوار المحاسبية بالحسابات - يُستخدم لتوليد القيود الآلية."""

    ROLES = [
        ("receivable", "حساب العملاء الافتراضي"),
        ("payable", "حساب الموردين الافتراضي"),
        ("subcontractor_payable", "حساب مقاولي الباطن"),
        ("sales", "إيرادات المبيعات"),
        ("sales_return", "مردودات المبيعات"),
        ("purchase", "المشتريات / المصروفات الافتراضية"),
        ("inventory", "المخزون"),
        ("cogs", "تكلفة البضاعة المباعة"),
        ("project_materials", "تكلفة مواد المشروعات (صرف مخزني)"),
        ("stock_adjustment", "فروق جرد وتسويات المخزون"),
        ("vat_out", "ضريبة القيمة المضافة - مخرجات (مبيعات)"),
        ("vat_in", "ضريبة القيمة المضافة - مدخلات (مشتريات)"),
        ("wht_receivable", "ضرائب خصم من المنبع مخصومة منا (مدينة)"),
        ("wht_payable", "ضريبة الخصم والإضافة المستحقة علينا (دائنة)"),
        ("customer_advance", "دفعات مقدمة من العملاء"),
        ("supplier_advance", "دفعات مقدمة للموردين ومقاولي الباطن"),
        ("retention_receivable", "محتجزات ضمان أعمال لدى العملاء"),
        ("retention_payable", "محتجزات ضمان أعمال مقاولي الباطن"),
        ("contract_revenue", "إيرادات مستخلصات المشروعات"),
        ("subcontract_cost", "تكلفة أعمال مقاولي الباطن"),
        ("social_ins_expense", "تأمينات اجتماعية مخصومة من مستخلصاتنا (مصروف)"),
        ("social_ins_payable", "تأمينات اجتماعية مخصومة من مقاولي الباطن (مستحقة)"),
        ("retained_earnings", "الأرباح المرحلة"),
        ("opening_equity", "أرصدة افتتاحية"),
        ("discount_allowed", "خصم مسموح به"),
        ("discount_received", "خصم مكتسب"),
    ]
    role = models.CharField("الدور", max_length=40, choices=ROLES, unique=True)
    account = models.ForeignKey(Account, verbose_name="الحساب", on_delete=models.PROTECT)

    class Meta:
        verbose_name = "توجيه محاسبي"
        verbose_name_plural = "التوجيه المحاسبي"

    def __str__(self):
        return f"{self.get_role_display()} ← {self.account}"

    @classmethod
    def get(cls, role):
        m = cls.objects.select_related("account").filter(role=role).first()
        if m is None:
            label = dict(cls.ROLES).get(role, role)
            raise ValidationError(f"لم يتم تحديد حساب لـ «{label}» في إعدادات التوجيه المحاسبي")
        return m.account


class CostCenter(models.Model):
    code = models.CharField("الكود", max_length=20, unique=True)
    name = models.CharField("الاسم", max_length=150)
    parent = models.ForeignKey("self", verbose_name="المركز الرئيسي", null=True, blank=True,
                               on_delete=models.PROTECT, related_name="children")
    active = models.BooleanField("نشط", default=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "مركز تكلفة"
        verbose_name_plural = "مراكز التكلفة"

    def __str__(self):
        return f"{self.code} - {self.name}"


class Tax(models.Model):
    KIND = [("vat", "ضريبة قيمة مضافة"), ("wht", "خصم من المنبع (خصم وإضافة)")]
    SCOPE = [("sale", "مبيعات"), ("purchase", "مشتريات"), ("both", "الكل")]
    name = models.CharField("الاسم", max_length=100)
    kind = models.CharField("النوع", max_length=5, choices=KIND)
    rate = models.DecimalField("النسبة %", max_digits=6, decimal_places=3)
    scope = models.CharField("النطاق", max_length=10, choices=SCOPE, default="both")
    sale_account = models.ForeignKey(Account, verbose_name="حساب المبيعات (اختياري)", null=True, blank=True,
                                     on_delete=models.PROTECT, related_name="+")
    purchase_account = models.ForeignKey(Account, verbose_name="حساب المشتريات (اختياري)", null=True, blank=True,
                                         on_delete=models.PROTECT, related_name="+")
    active = models.BooleanField("نشط", default=True)

    class Meta:
        ordering = ["kind", "rate"]
        verbose_name = "ضريبة"
        verbose_name_plural = "الضرائب"

    def __str__(self):
        return self.name

    def amount(self, base):
        return r2(Decimal(base or 0) * self.rate / 100)

    def account_for(self, side):
        """side: sale أو purchase"""
        if side == "sale":
            if self.sale_account_id:
                return self.sale_account
            return AccountMapping.get("vat_out" if self.kind == "vat" else "wht_receivable")
        if self.purchase_account_id:
            return self.purchase_account
        return AccountMapping.get("vat_in" if self.kind == "vat" else "wht_payable")


class Partner(models.Model):
    TYPES = [
        ("customer", "عميل"),
        ("supplier", "مورد"),
        ("subcontractor", "مقاول باطن"),
        ("both", "عميل ومورد"),
        ("employee", "موظف"),
        ("other", "أخرى"),
    ]
    code = models.CharField("الكود", max_length=20, blank=True)
    name = models.CharField("الاسم", max_length=200)
    type = models.CharField("النوع", max_length=15, choices=TYPES, default="customer")
    tax_id = models.CharField("رقم التسجيل الضريبي", max_length=50, blank=True)
    national_id = models.CharField("الرقم القومي / السجل", max_length=50, blank=True)
    phone = models.CharField("التليفون", max_length=50, blank=True)
    email = models.EmailField("البريد", blank=True)
    address = models.CharField("العنوان", max_length=300, blank=True)
    credit_limit = models.DecimalField("حد الائتمان", max_digits=16, decimal_places=2, default=0)
    payment_days = models.PositiveIntegerField("مدة السداد (يوم)", default=0)
    receivable_account = models.ForeignKey(Account, verbose_name="حساب مدين خاص (اختياري)", null=True,
                                           blank=True, on_delete=models.PROTECT, related_name="+")
    payable_account = models.ForeignKey(Account, verbose_name="حساب دائن خاص (اختياري)", null=True,
                                        blank=True, on_delete=models.PROTECT, related_name="+")
    active = models.BooleanField("نشط", default=True)
    notes = models.TextField("ملاحظات", blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "جهة تعامل"
        verbose_name_plural = "العملاء والموردون"

    def __str__(self):
        return self.name

    @property
    def is_vendor(self):
        return self.type in ("supplier", "subcontractor")

    def ar_account(self):
        return self.receivable_account or AccountMapping.get("receivable")

    def ap_account(self):
        if self.payable_account_id:
            return self.payable_account
        if self.type == "subcontractor":
            m = AccountMapping.objects.filter(role="subcontractor_payable").first()
            if m:
                return m.account
        return AccountMapping.get("payable")

    def main_account(self):
        return self.ap_account() if self.is_vendor else self.ar_account()

    def balance(self, date_to=None):
        """رصيد الجهة على كل الحسابات (مدين موجب / دائن سالب)."""
        qs = JournalLine.objects.filter(entry__state="posted", partner=self)
        if date_to:
            qs = qs.filter(entry__date__lte=date_to)
        agg = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        return (agg["d"] or ZERO) - (agg["c"] or ZERO)


class Sequence(models.Model):
    key = models.CharField(max_length=40, unique=True)
    prefix = models.CharField(max_length=20)
    next_number = models.PositiveIntegerField(default=1)
    padding = models.PositiveSmallIntegerField(default=5)

    DEFAULTS = {
        "JE": "JV-", "SINV": "INV-", "SRET": "SRN-", "PINV": "BILL-", "PRET": "PRN-",
        "RCPT": "RV-", "PAY": "PV-", "TRF": "TR-", "STK": "ST-", "DEP": "DEP-",
        "CCON": "CC-", "SCON": "SC-", "CCERT": "CIP-", "SCERT": "SIP-", "RET": "RR-",
    }

    @classmethod
    def next(cls, key):
        from django.db import transaction
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(
                key=key, defaults={"prefix": cls.DEFAULTS.get(key, key + "-")})
            num = f"{seq.prefix}{str(seq.next_number).zfill(seq.padding)}"
            seq.next_number += 1
            seq.save(update_fields=["next_number"])
            return num


class JournalEntry(models.Model):
    STATES = [("draft", "مسودة"), ("posted", "مرحّل")]
    SOURCES = [
        ("manual", "قيد يومية يدوي"),
        ("opening", "قيد افتتاحي"),
        ("closing", "قيد إقفال"),
        ("sale", "فاتورة مبيعات"),
        ("sale_return", "مردود مبيعات"),
        ("purchase", "فاتورة مشتريات"),
        ("purchase_return", "مردود مشتريات"),
        ("receipt", "سند قبض"),
        ("payment", "سند صرف"),
        ("transfer", "تحويل نقدية"),
        ("stock", "حركة مخزنية"),
        ("depreciation", "إهلاك"),
        ("client_cert", "مستخلص عميل"),
        ("sub_cert", "مستخلص مقاول باطن"),
        ("retention", "رد محتجزات"),
    ]
    number = models.CharField("رقم القيد", max_length=30, unique=True, blank=True)
    date = models.DateField("التاريخ")
    reference = models.CharField("المرجع", max_length=100, blank=True)
    memo = models.CharField("البيان", max_length=300)
    state = models.CharField("الحالة", max_length=10, choices=STATES, default="draft")
    source = models.CharField("المصدر", max_length=20, choices=SOURCES, default="manual")
    source_url = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "قيد يومية"
        verbose_name_plural = "قيود اليومية"

    def __str__(self):
        return f"{self.number} - {self.memo}"

    def get_absolute_url(self):
        return reverse("journal_detail", args=[self.pk])

    @property
    def is_auto(self):
        return self.source not in ("manual", "opening", "closing")

    def totals(self):
        agg = self.lines.aggregate(d=Sum("debit"), c=Sum("credit"))
        return agg["d"] or ZERO, agg["c"] or ZERO

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("JE")
        super().save(*args, **kwargs)


class JournalLine(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, verbose_name="الحساب", on_delete=models.PROTECT,
                                related_name="lines", limit_choices_to={"is_group": False})
    label = models.CharField("البيان", max_length=300, blank=True)
    partner = models.ForeignKey(Partner, verbose_name="جهة التعامل", null=True, blank=True,
                                on_delete=models.PROTECT, related_name="lines")
    project = models.ForeignKey("contracting.Project", verbose_name="المشروع", null=True, blank=True,
                                on_delete=models.PROTECT, related_name="lines")
    cost_center = models.ForeignKey(CostCenter, verbose_name="مركز التكلفة", null=True, blank=True,
                                    on_delete=models.PROTECT, related_name="lines")
    debit = models.DecimalField("مدين", max_digits=16, decimal_places=2, default=0)
    credit = models.DecimalField("دائن", max_digits=16, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["account", "entry"])]

    def __str__(self):
        return f"{self.account} {self.debit}/{self.credit}"


class JournalTemplate(models.Model):
    """قيود جاهزة: يختار المستخدم النموذج ويدخل المبلغ فقط."""

    name = models.CharField("اسم النموذج", max_length=150)
    memo = models.CharField("البيان الافتراضي", max_length=300, blank=True)
    ask_partner = models.BooleanField("يتطلب جهة تعامل", default=False)
    ask_project = models.BooleanField("يتطلب مشروع", default=False)
    active = models.BooleanField("نشط", default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "قيد جاهز"
        verbose_name_plural = "القيود الجاهزة"

    def __str__(self):
        return self.name


class JournalTemplateLine(models.Model):
    template = models.ForeignKey(JournalTemplate, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, verbose_name="الحساب", on_delete=models.PROTECT,
                                limit_choices_to={"is_group": False})
    side = models.CharField("الجانب", max_length=6, choices=[("debit", "مدين"), ("credit", "دائن")])
    percent = models.DecimalField("نسبة من المبلغ %", max_digits=7, decimal_places=3, default=100)
    label = models.CharField("البيان", max_length=200, blank=True)
    use_partner = models.BooleanField("يحمل جهة التعامل", default=False)
    use_project = models.BooleanField("يحمل المشروع", default=False)

    class Meta:
        ordering = ["id"]


class PostableDocument(models.Model):
    """أساس كل المستندات التي تولّد قيوداً آلية (مسودة ← مرحّل)."""

    STATES = [("draft", "مسودة"), ("posted", "مرحّل"), ("cancelled", "ملغي")]
    state = models.CharField("الحالة", max_length=10, choices=STATES, default="draft")
    move = models.ForeignKey(JournalEntry, verbose_name="القيد", null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="+", editable=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, editable=False,
                                   on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    entry_source = "manual"

    class Meta:
        abstract = True

    @property
    def is_draft(self):
        return self.state == "draft"

    @property
    def is_posted(self):
        return self.state == "posted"

    def entry_memo(self):
        return str(self)

    def check_can_post(self):
        """تحقق إضافي قبل الترحيل - يُعاد تعريفه في المستندات."""

    def build_entry(self, builder):
        raise NotImplementedError

    def after_post(self):
        pass

    def after_unpost(self):
        pass

    def check_can_unpost(self):
        pass

    def post(self, user=None):
        from django.db import transaction
        from .posting import EntryBuilder
        if self.state != "draft":
            raise ValidationError("المستند ليس في حالة مسودة")
        with transaction.atomic():
            self.check_can_post()
            builder = EntryBuilder(self.date, self.entry_memo(), source=self.entry_source,
                                   reference=getattr(self, "number", "") or "",
                                   source_url=self.get_absolute_url(), user=user)
            self.build_entry(builder)
            self.move = builder.post()
            self.state = "posted"
            self.save()
            self.after_post()
        return self.move

    def unpost(self):
        from django.db import transaction
        from .posting import remove_entry
        if self.state != "posted":
            raise ValidationError("المستند غير مرحّل")
        with transaction.atomic():
            self.check_can_unpost()
            remove_entry(self.move)
            self.move = None
            self.state = "draft"
            self.save()
            self.after_unpost()
