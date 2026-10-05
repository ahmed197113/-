from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.urls import reverse

from accounting.models import (Account, AccountMapping, CostCenter, Partner, PostableDocument, Sequence,
                               Tax, ZERO, r2)

D4 = Decimal("0.0001")


class Warehouse(models.Model):
    code = models.CharField("الكود", max_length=20, unique=True)
    name = models.CharField("اسم المخزن", max_length=150)
    project = models.ForeignKey("contracting.Project", verbose_name="مخزن موقع لمشروع", null=True, blank=True,
                                on_delete=models.SET_NULL)
    active = models.BooleanField("نشط", default=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "مخزن"
        verbose_name_plural = "المخازن"

    def __str__(self):
        return self.name


class Product(models.Model):
    TYPES = [("stock", "صنف مخزني"), ("service", "خدمة"), ("consumable", "مستهلك (غير مخزني)")]
    code = models.CharField("الكود", max_length=30, unique=True)
    name = models.CharField("اسم الصنف", max_length=200)
    type = models.CharField("النوع", max_length=12, choices=TYPES, default="stock")
    unit = models.CharField("الوحدة", max_length=30, default="عدد")
    barcode = models.CharField("الباركود", max_length=50, blank=True)
    sale_price = models.DecimalField("سعر البيع", max_digits=16, decimal_places=2, default=0)
    purchase_price = models.DecimalField("سعر الشراء", max_digits=16, decimal_places=2, default=0)
    sale_tax = models.ForeignKey(Tax, verbose_name="ضريبة البيع", null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="+", limit_choices_to={"kind": "vat"})
    purchase_tax = models.ForeignKey(Tax, verbose_name="ضريبة الشراء", null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="+", limit_choices_to={"kind": "vat"})
    income_account = models.ForeignKey(Account, verbose_name="حساب الإيراد (اختياري)", null=True, blank=True,
                                       on_delete=models.PROTECT, related_name="+")
    expense_account = models.ForeignKey(Account, verbose_name="حساب المصروف/التكلفة (اختياري)", null=True,
                                        blank=True, on_delete=models.PROTECT, related_name="+")
    min_qty = models.DecimalField("حد الطلب", max_digits=14, decimal_places=3, default=0)
    avg_cost = models.DecimalField("متوسط التكلفة", max_digits=16, decimal_places=4, default=0, editable=False)
    active = models.BooleanField("نشط", default=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "صنف"
        verbose_name_plural = "الأصناف"

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def is_stock(self):
        return self.type == "stock"

    def qty_on_hand(self, warehouse=None, date_to=None):
        qs = self.moves.all()
        if warehouse:
            qs = qs.filter(warehouse=warehouse)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs.aggregate(q=Sum("qty"))["q"] or ZERO

    def income_acc(self, kind="sale"):
        if kind == "sale_return":
            return AccountMapping.get("sales_return")
        return self.income_account or AccountMapping.get("sales")

    def cost_acc(self):
        if self.is_stock:
            return AccountMapping.get("inventory")
        return self.expense_account or AccountMapping.get("purchase")

    def recompute_cost(self):
        """إعادة احتساب متوسط التكلفة المرجح من واقع كل الحركات بترتيبها الزمني."""
        qty, value = ZERO, ZERO
        for mv in self.moves.order_by("date", "id"):
            if mv.qty > 0:
                qty += mv.qty
                value += mv.qty * mv.unit_cost
            else:
                avg = (value / qty) if qty else mv.unit_cost
                qty += mv.qty
                value += mv.qty * avg
        self.avg_cost = (value / qty).quantize(D4) if qty > 0 else self.avg_cost
        self.save(update_fields=["avg_cost"])


class StockMove(models.Model):
    date = models.DateField("التاريخ")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="moves")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="moves")
    qty = models.DecimalField("الكمية", max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField("تكلفة الوحدة", max_digits=16, decimal_places=4, default=0)
    project = models.ForeignKey("contracting.Project", null=True, blank=True, on_delete=models.SET_NULL)
    doc_key = models.CharField(max_length=40, db_index=True)
    label = models.CharField(max_length=200, blank=True)
    url = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["date", "id"]

    @property
    def value(self):
        return r2(self.qty * self.unit_cost)


def add_stock_move(doc, product, warehouse, qty, unit_cost, project=None, label=""):
    StockMove.objects.create(date=doc.date, product=product, warehouse=warehouse, qty=qty, unit_cost=unit_cost,
                             project=project, doc_key=doc.doc_key, label=label or str(doc),
                             url=doc.get_absolute_url())
    if qty > 0:
        product.recompute_cost()


def remove_stock_moves(doc):
    products = {m.product for m in StockMove.objects.filter(doc_key=doc.doc_key).select_related("product")}
    StockMove.objects.filter(doc_key=doc.doc_key).delete()
    for p in products:
        p.recompute_cost()


def check_stock(product, warehouse, qty_needed, exclude_doc=None):
    available = product.qty_on_hand(warehouse)
    if qty_needed > available:
        raise ValidationError(
            f"الرصيد غير كافٍ للصنف «{product.name}» في مخزن «{warehouse}»: المتاح {available:,.3f} والمطلوب {qty_needed:,.3f}")


class Invoice(PostableDocument):
    KINDS = [("sale", "فاتورة مبيعات"), ("sale_return", "مردود مبيعات"),
             ("purchase", "فاتورة مشتريات"), ("purchase_return", "مردود مشتريات")]
    SEQ = {"sale": "SINV", "sale_return": "SRET", "purchase": "PINV", "purchase_return": "PRET"}

    kind = models.CharField("النوع", max_length=16, choices=KINDS)
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    partner = models.ForeignKey(Partner, verbose_name="العميل / المورد", on_delete=models.PROTECT,
                                related_name="invoices")
    date = models.DateField("التاريخ")
    due_date = models.DateField("تاريخ الاستحقاق", null=True, blank=True)
    reference = models.CharField("مرجع / رقم فاتورة المورد", max_length=60, blank=True)
    origin = models.ForeignKey("self", verbose_name="الفاتورة الأصلية (للمرتجع)", null=True, blank=True,
                               on_delete=models.PROTECT, related_name="returns")
    project = models.ForeignKey("contracting.Project", verbose_name="المشروع", null=True, blank=True,
                                on_delete=models.PROTECT)
    cost_center = models.ForeignKey(CostCenter, verbose_name="مركز التكلفة", null=True, blank=True,
                                    on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, verbose_name="المخزن", null=True, blank=True, on_delete=models.PROTECT)
    wht = models.ForeignKey(Tax, verbose_name="خصم من المنبع", null=True, blank=True, on_delete=models.PROTECT,
                            related_name="+", limit_choices_to={"kind": "wht"})
    notes = models.TextField("ملاحظات", blank=True)
    subtotal = models.DecimalField("الإجمالي قبل الضريبة", max_digits=16, decimal_places=2, default=0)
    discount_total = models.DecimalField("إجمالي الخصم", max_digits=16, decimal_places=2, default=0)
    vat_total = models.DecimalField("ضريبة القيمة المضافة", max_digits=16, decimal_places=2, default=0)
    wht_total = models.DecimalField("الخصم من المنبع", max_digits=16, decimal_places=2, default=0)
    total = models.DecimalField("الصافي المستحق", max_digits=16, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "فاتورة"
        verbose_name_plural = "الفواتير"

    def __str__(self):
        return f"{self.get_kind_display()} {self.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next(self.SEQ[self.kind])
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("invoice_detail", args=[self.pk])

    @property
    def doc_key(self):
        return f"INV:{self.pk}"

    @property
    def side(self):
        return "sale" if self.kind in ("sale", "sale_return") else "purchase"

    @property
    def is_return(self):
        return self.kind.endswith("return")

    @property
    def entry_source(self):
        return self.kind

    def compute_totals(self):
        sub = disc = vat = ZERO
        for ln in self.lines.all():
            gross = r2(ln.qty * ln.unit_price)
            net = ln.net_amount
            sub += net
            disc += gross - net
            vat += ln.vat_amount
        self.subtotal, self.discount_total, self.vat_total = sub, disc, vat
        self.wht_total = self.wht.amount(sub) if self.wht_id else ZERO
        self.total = sub + vat - self.wht_total
        self.save(update_fields=["subtotal", "discount_total", "vat_total", "wht_total", "total"])

    @property
    def paid_amount(self):
        paid = self.payments.filter(state="posted").aggregate(s=Sum("amount"))["s"] or ZERO
        returned = self.returns.filter(state="posted").aggregate(s=Sum("total"))["s"] or ZERO
        return paid + returned

    @property
    def residual(self):
        return self.total - self.paid_amount if self.is_posted else ZERO

    @property
    def payment_status(self):
        if not self.is_posted:
            return ""
        if self.is_return:
            return "—"
        res = self.residual
        if res <= 0:
            return "مسددة"
        if res < self.total:
            return "مسددة جزئياً"
        return "غير مسددة"

    def check_can_post(self):
        self.compute_totals()
        if not self.lines.exists():
            raise ValidationError("لا يمكن ترحيل فاتورة بدون أصناف")
        if any(ln.product and ln.product.is_stock for ln in self.lines.all()) and not self.warehouse_id:
            raise ValidationError("يجب اختيار المخزن لأن الفاتورة تحتوي على أصناف مخزنية")
        if self.kind in ("sale", "purchase_return"):
            need = {}
            for ln in self.lines.select_related("product"):
                if ln.product and ln.product.is_stock:
                    need[ln.product] = need.get(ln.product, ZERO) + ln.qty
            for p, q in need.items():
                check_stock(p, self.warehouse, q)

    def build_entry(self, b):
        partner_acc = self.partner.ar_account() if self.side == "sale" else self.partner.ap_account()
        sign = -1 if self.is_return else 1          # المردود يعكس القيد
        common = dict(cost_center=self.cost_center)
        label = f"{self.get_kind_display()} {self.number}"
        if self.side == "sale":
            b.add(partner_acc, debit=sign * self.total, label=label, partner=self.partner, project=self.project)
            if self.wht_total:
                b.add(self.wht.account_for("sale"), debit=sign * self.wht_total, label=f"خصم من المنبع {self.number}",
                      partner=self.partner)
            for ln in self.lines.select_related("product", "vat", "account"):
                prj = ln.project or self.project
                acc = ln.account or (ln.product.income_acc(self.kind) if ln.product else
                                     AccountMapping.get("sales_return" if self.is_return else "sales"))
                if self.is_return:
                    b.add(acc, debit=ln.net_amount, label=ln.description or label, project=prj, **common)
                else:
                    b.add(acc, credit=ln.net_amount, label=ln.description or label, project=prj, **common)
                if ln.vat_amount:
                    b.add(ln.vat.account_for("sale"), credit=sign * ln.vat_amount, label=f"ض.ق.م {self.number}")
                if ln.product and ln.product.is_stock:
                    cost = r2(ln.qty * ln.product.avg_cost)
                    b.add(AccountMapping.get("cogs"), debit=sign * cost, label=f"تكلفة {ln.product.name}",
                          project=prj, **common)
                    b.add(AccountMapping.get("inventory"), credit=sign * cost, label=f"تكلفة {ln.product.name}")
        else:
            b.add(partner_acc, credit=sign * self.total, label=label, partner=self.partner, project=self.project)
            if self.wht_total:
                b.add(self.wht.account_for("purchase"), credit=sign * self.wht_total,
                      label=f"خصم وإضافة {self.number}", partner=self.partner)
            for ln in self.lines.select_related("product", "vat", "account"):
                prj = ln.project or self.project
                acc = ln.account or (ln.product.cost_acc() if ln.product else AccountMapping.get("purchase"))
                b.add(acc, debit=sign * ln.net_amount, label=ln.description or label, project=prj, **common)
                if ln.vat_amount:
                    b.add(ln.vat.account_for("purchase"), debit=sign * ln.vat_amount, label=f"ض.ق.م {self.number}")

    def after_post(self):
        if not self.warehouse_id:
            return
        for ln in self.lines.select_related("product"):
            p = ln.product
            if not (p and p.is_stock) or not ln.qty:
                continue
            prj = ln.project or self.project
            if self.kind == "purchase":
                unit = (ln.net_amount / ln.qty).quantize(D4)
                add_stock_move(self, p, self.warehouse, ln.qty, unit, prj)
            elif self.kind == "purchase_return":
                unit = (ln.net_amount / ln.qty).quantize(D4)
                add_stock_move(self, p, self.warehouse, -ln.qty, unit, prj)
            elif self.kind == "sale":
                add_stock_move(self, p, self.warehouse, -ln.qty, p.avg_cost, prj)
            elif self.kind == "sale_return":
                add_stock_move(self, p, self.warehouse, ln.qty, p.avg_cost, prj)

    def check_can_unpost(self):
        if self.payments.filter(state="posted").exists():
            raise ValidationError("لا يمكن إلغاء ترحيل فاتورة عليها سندات سداد مرحّلة")

    def after_unpost(self):
        remove_stock_moves(self)


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, verbose_name="الصنف", null=True, blank=True, on_delete=models.PROTECT)
    description = models.CharField("البيان", max_length=300, blank=True)
    account = models.ForeignKey(Account, verbose_name="الحساب", null=True, blank=True, on_delete=models.PROTECT,
                                limit_choices_to={"is_group": False})
    qty = models.DecimalField("الكمية", max_digits=14, decimal_places=3, default=1)
    unit_price = models.DecimalField("السعر", max_digits=16, decimal_places=4, default=0)
    discount_pct = models.DecimalField("خصم %", max_digits=6, decimal_places=2, default=0)
    vat = models.ForeignKey(Tax, verbose_name="ض.ق.م", null=True, blank=True, on_delete=models.PROTECT,
                            limit_choices_to={"kind": "vat"})
    project = models.ForeignKey("contracting.Project", verbose_name="المشروع", null=True, blank=True,
                                on_delete=models.PROTECT)

    class Meta:
        ordering = ["id"]

    @property
    def net_amount(self):
        return r2(self.qty * self.unit_price * (100 - self.discount_pct) / 100)

    @property
    def vat_amount(self):
        return self.vat.amount(self.net_amount) if self.vat_id else ZERO

    @property
    def line_total(self):
        return self.net_amount + self.vat_amount

    def clean(self):
        if not self.product_id and not self.account_id and not self.description:
            raise ValidationError("اختر صنفاً أو حساباً أو اكتب بياناً")


class Payment(PostableDocument):
    KINDS = [("receipt", "سند قبض"), ("payment", "سند صرف")]
    PURPOSES = [("partner", "على حساب جهة التعامل"), ("advance", "دفعة مقدمة (عقد / مقاول)"),
                ("account", "مباشر على حساب (مصروف / إيراد / أخرى)")]
    METHODS = [("cash", "نقداً"), ("transfer", "تحويل بنكي"), ("cheque", "شيك"), ("card", "بطاقة / محفظة")]

    kind = models.CharField("النوع", max_length=10, choices=KINDS)
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("التاريخ")
    purpose = models.CharField("نوع الحركة", max_length=10, choices=PURPOSES, default="partner")
    partner = models.ForeignKey(Partner, verbose_name="جهة التعامل", null=True, blank=True,
                                on_delete=models.PROTECT, related_name="payments")
    treasury = models.ForeignKey(Account, verbose_name="الخزينة / البنك", on_delete=models.PROTECT,
                                 related_name="+", limit_choices_to={"kind__in": ["cash", "bank"], "is_group": False})
    counter_account = models.ForeignKey(Account, verbose_name="الحساب المقابل", null=True, blank=True,
                                        on_delete=models.PROTECT, related_name="+",
                                        limit_choices_to={"is_group": False})
    amount = models.DecimalField("المبلغ", max_digits=16, decimal_places=2)
    invoice = models.ForeignKey(Invoice, verbose_name="سداد فاتورة", null=True, blank=True,
                                on_delete=models.PROTECT, related_name="payments")
    contract = models.ForeignKey("contracting.Contract", verbose_name="العقد", null=True, blank=True,
                                 on_delete=models.PROTECT, related_name="payments")
    certificate = models.ForeignKey("contracting.Certificate", verbose_name="سداد مستخلص", null=True, blank=True,
                                    on_delete=models.PROTECT, related_name="payments")
    project = models.ForeignKey("contracting.Project", verbose_name="المشروع", null=True, blank=True,
                                on_delete=models.PROTECT)
    cost_center = models.ForeignKey(CostCenter, verbose_name="مركز التكلفة", null=True, blank=True,
                                    on_delete=models.PROTECT)
    method = models.CharField("طريقة السداد", max_length=10, choices=METHODS, default="cash")
    cheque_no = models.CharField("رقم الشيك / المرجع", max_length=50, blank=True)
    cheque_date = models.DateField("تاريخ استحقاق الشيك", null=True, blank=True)
    memo = models.CharField("البيان", max_length=300, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "سند"
        verbose_name_plural = "سندات القبض والصرف"

    def __str__(self):
        return f"{self.get_kind_display()} {self.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("RCPT" if self.kind == "receipt" else "PAY")
        if self.certificate_id and not self.contract_id:
            self.contract = self.certificate.contract
        if self.contract_id and not self.project_id:
            self.project = self.contract.project
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("payment_detail", args=[self.pk])

    @property
    def entry_source(self):
        return self.kind

    def entry_memo(self):
        return f"{self.get_kind_display()} {self.number} - {self.memo or self.partner or ''}"

    def clean(self):
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({"amount": "المبلغ يجب أن يكون أكبر من صفر"})
        if self.purpose in ("partner", "advance") and not self.partner_id:
            raise ValidationError({"partner": "اختر جهة التعامل"})
        if self.purpose == "account" and not self.counter_account_id:
            raise ValidationError({"counter_account": "اختر الحساب المقابل"})
        if self.invoice_id and self.partner_id and self.invoice.partner_id != self.partner_id:
            raise ValidationError({"invoice": "الفاتورة لا تخص جهة التعامل المختارة"})
        if self.certificate_id and self.partner_id and self.certificate.contract.partner_id != self.partner_id:
            raise ValidationError({"certificate": "المستخلص لا يخص جهة التعامل المختارة"})

    def counter(self):
        if self.purpose == "account":
            return self.counter_account
        if self.purpose == "advance":
            return AccountMapping.get("customer_advance" if self.kind == "receipt" else "supplier_advance")
        p = self.partner
        if self.kind == "receipt":
            return p.ap_account() if p.is_vendor else p.ar_account()
        return p.ar_account() if p.type == "customer" else p.ap_account()

    def build_entry(self, b):
        label = self.memo or self.entry_memo()
        kw = dict(partner=self.partner, project=self.project)
        cc = dict(cost_center=self.cost_center)
        if self.kind == "receipt":
            b.debit(self.treasury, self.amount, label=label, **kw)
            b.credit(self.counter(), self.amount, label=label, **kw, **(cc if self.purpose == "account" else {}))
        else:
            b.debit(self.counter(), self.amount, label=label, **kw, **(cc if self.purpose == "account" else {}))
            b.credit(self.treasury, self.amount, label=label, **kw)


class Transfer(PostableDocument):
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("التاريخ")
    from_account = models.ForeignKey(Account, verbose_name="من خزينة/بنك", on_delete=models.PROTECT,
                                     related_name="+", limit_choices_to={"kind__in": ["cash", "bank"]})
    to_account = models.ForeignKey(Account, verbose_name="إلى خزينة/بنك", on_delete=models.PROTECT,
                                   related_name="+", limit_choices_to={"kind__in": ["cash", "bank"]})
    amount = models.DecimalField("المبلغ", max_digits=16, decimal_places=2)
    memo = models.CharField("البيان", max_length=300, blank=True)

    entry_source = "transfer"

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "تحويل نقدية"
        verbose_name_plural = "التحويلات بين الخزائن والبنوك"

    def __str__(self):
        return f"تحويل {self.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("TRF")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("transfer_list")

    def clean(self):
        if self.from_account_id and self.from_account_id == self.to_account_id:
            raise ValidationError("لا يمكن التحويل لنفس الحساب")
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({"amount": "المبلغ يجب أن يكون أكبر من صفر"})

    def build_entry(self, b):
        label = self.memo or f"تحويل من {self.from_account.name} إلى {self.to_account.name}"
        b.debit(self.to_account, self.amount, label=label)
        b.credit(self.from_account, self.amount, label=label)


class StockDocument(PostableDocument):
    KINDS = [("issue", "صرف مواد لمشروع"), ("adj_in", "تسوية بالزيادة / رصيد أول المدة"),
             ("adj_out", "تسوية بالعجز / هالك")]
    kind = models.CharField("النوع", max_length=10, choices=KINDS, default="issue")
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("التاريخ")
    warehouse = models.ForeignKey(Warehouse, verbose_name="المخزن", on_delete=models.PROTECT)
    project = models.ForeignKey("contracting.Project", verbose_name="المشروع", null=True, blank=True,
                                on_delete=models.PROTECT)
    counter_account = models.ForeignKey(Account, verbose_name="الحساب المقابل (اختياري)", null=True, blank=True,
                                        on_delete=models.PROTECT, related_name="+",
                                        limit_choices_to={"is_group": False},
                                        help_text="يُترك فارغاً لاستخدام الحساب الافتراضي من التوجيه المحاسبي")
    notes = models.CharField("البيان", max_length=300, blank=True)

    entry_source = "stock"

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "إذن مخزني"
        verbose_name_plural = "الأذونات المخزنية"

    def __str__(self):
        return f"{self.get_kind_display()} {self.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("STK")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("stockdoc_detail", args=[self.pk])

    @property
    def doc_key(self):
        return f"STK:{self.pk}"

    def counter(self):
        if self.counter_account_id:
            return self.counter_account
        if self.kind == "issue":
            return AccountMapping.get("project_materials")
        return AccountMapping.get("stock_adjustment")

    def line_cost(self, ln):
        return ln.unit_cost if self.kind == "adj_in" else ln.product.avg_cost

    def check_can_post(self):
        if not self.lines.exists():
            raise ValidationError("أضف أصنافاً للإذن")
        if self.kind == "issue" and not self.project_id:
            raise ValidationError("اختر المشروع المصروف له المواد")
        if self.kind != "adj_in":
            need = {}
            for ln in self.lines.select_related("product"):
                need[ln.product] = need.get(ln.product, ZERO) + ln.qty
            for p, q in need.items():
                check_stock(p, self.warehouse, q)

    def build_entry(self, b):
        inv = AccountMapping.get("inventory")
        for ln in self.lines.select_related("product"):
            value = r2(ln.qty * self.line_cost(ln))
            label = f"{ln.product.name} × {ln.qty:g}"
            if self.kind == "adj_in":
                b.debit(inv, value, label=label)
                b.credit(self.counter(), value, label=label, project=self.project)
            else:
                b.debit(self.counter(), value, label=label, project=self.project)
                b.credit(inv, value, label=label)

    def after_post(self):
        for ln in self.lines.select_related("product"):
            qty = ln.qty if self.kind == "adj_in" else -ln.qty
            add_stock_move(self, ln.product, self.warehouse, qty, self.line_cost(ln), self.project)

    def after_unpost(self):
        remove_stock_moves(self)


class StockDocumentLine(models.Model):
    document = models.ForeignKey(StockDocument, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, verbose_name="الصنف", on_delete=models.PROTECT,
                                limit_choices_to={"type": "stock"})
    qty = models.DecimalField("الكمية", max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField("تكلفة الوحدة (للإضافة فقط)", max_digits=16, decimal_places=4, default=0)

    class Meta:
        ordering = ["id"]
