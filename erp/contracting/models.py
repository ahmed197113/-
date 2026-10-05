"""
موديول المقاولات: المشروعات، العقود (عملاء / مقاولي باطن)، المقايسات (BOQ)،
المستخلصات الجارية والختامية، الاستقطاعات، ورد المحتجزات.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.urls import reverse

from accounting.models import (Account, AccountMapping, CostCenter, JournalLine, Partner, PostableDocument,
                               Sequence, Tax, ZERO, r2)


class Project(models.Model):
    STATUS = [("planning", "تحت الدراسة"), ("active", "جاري التنفيذ"), ("on_hold", "متوقف"),
              ("completed", "منتهي - فترة ضمان"), ("closed", "مغلق")]
    code = models.CharField("كود المشروع", max_length=20, unique=True)
    name = models.CharField("اسم المشروع", max_length=200)
    customer = models.ForeignKey(Partner, verbose_name="المالك / العميل", null=True, blank=True,
                                 on_delete=models.PROTECT, related_name="projects")
    location = models.CharField("الموقع", max_length=200, blank=True)
    manager = models.CharField("مدير المشروع", max_length=100, blank=True)
    budget = models.DecimalField("الموازنة التقديرية للتكاليف", max_digits=16, decimal_places=2, default=0)
    start_date = models.DateField("تاريخ البدء", null=True, blank=True)
    end_date = models.DateField("تاريخ الانتهاء المتوقع", null=True, blank=True)
    status = models.CharField("الحالة", max_length=10, choices=STATUS, default="active")
    cost_center = models.ForeignKey(CostCenter, verbose_name="مركز التكلفة", null=True, blank=True,
                                    on_delete=models.SET_NULL)
    notes = models.TextField("ملاحظات", blank=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "مشروع"
        verbose_name_plural = "المشروعات"

    def __str__(self):
        return f"{self.code} - {self.name}"

    def get_absolute_url(self):
        return reverse("project_detail", args=[self.pk])

    def _sum(self, account_type, date_from=None, date_to=None):
        qs = JournalLine.objects.filter(entry__state="posted", project=self, account__type=account_type)
        if date_from:
            qs = qs.filter(entry__date__gte=date_from)
        if date_to:
            qs = qs.filter(entry__date__lte=date_to)
        agg = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        return (agg["d"] or ZERO) - (agg["c"] or ZERO)

    def revenue(self, **kw):
        return -self._sum("income", **kw)

    def cost(self, **kw):
        return self._sum("expense", **kw)

    def profit(self, **kw):
        return self.revenue(**kw) - self.cost(**kw)

    @property
    def contract_value(self):
        total = ZERO
        for c in self.contracts.filter(kind="client").exclude(status="cancelled"):
            total += c.boq_total
        return total


class Contract(models.Model):
    KINDS = [("client", "عقد مع العميل (المالك)"), ("sub", "عقد مقاول باطن")]
    STATUS = [("active", "ساري"), ("closed", "منتهي (ختامي)"), ("cancelled", "ملغي")]
    kind = models.CharField("نوع العقد", max_length=6, choices=KINDS)
    number = models.CharField("رقم العقد", max_length=30, blank=True, unique=True)
    title = models.CharField("موضوع العقد", max_length=250)
    project = models.ForeignKey(Project, verbose_name="المشروع", on_delete=models.PROTECT, related_name="contracts")
    partner = models.ForeignKey(Partner, verbose_name="العميل / مقاول الباطن", on_delete=models.PROTECT,
                                related_name="contracts")
    date = models.DateField("تاريخ العقد")
    start_date = models.DateField("تاريخ البدء", null=True, blank=True)
    end_date = models.DateField("تاريخ الانتهاء", null=True, blank=True)
    retention_pct = models.DecimalField("نسبة ضمان الأعمال (محتجزات) %", max_digits=6, decimal_places=3,
                                        default=Decimal("5"))
    advance_amount = models.DecimalField("قيمة الدفعة المقدمة المتعاقد عليها", max_digits=16, decimal_places=2,
                                         default=0)
    advance_recovery_pct = models.DecimalField("نسبة استرداد الدفعة المقدمة من كل مستخلص %", max_digits=6,
                                               decimal_places=3, default=0)
    vat = models.ForeignKey(Tax, verbose_name="ضريبة القيمة المضافة", null=True, blank=True,
                            on_delete=models.PROTECT, related_name="+", limit_choices_to={"kind": "vat"})
    wht = models.ForeignKey(Tax, verbose_name="ضريبة الخصم من المنبع", null=True, blank=True,
                            on_delete=models.PROTECT, related_name="+", limit_choices_to={"kind": "wht"})
    social_ins_pct = models.DecimalField("نسبة التأمينات الاجتماعية %", max_digits=6, decimal_places=3, default=0)
    vat_on_net = models.BooleanField("احتساب ض.ق.م بعد خصم المحتجزات", default=False,
                                     help_text="الافتراضي: الضريبة على إجمالي الأعمال الحالية")
    status = models.CharField("الحالة", max_length=10, choices=STATUS, default="active")
    payment_terms = models.CharField("شروط الدفع", max_length=300, blank=True)
    notes = models.TextField("ملاحظات", blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "عقد"
        verbose_name_plural = "العقود"

    def __str__(self):
        return f"{self.number} - {self.title}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("CCON" if self.kind == "client" else "SCON")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("contract_detail", args=[self.pk])

    @property
    def is_client(self):
        return self.kind == "client"

    @property
    def boq_total(self):
        return sum((i.total for i in self.items.all()), ZERO)

    def posted_certs(self):
        return self.certificates.filter(state="posted")

    def _cert_sum(self, field):
        return self.posted_certs().aggregate(s=Sum(field))["s"] or ZERO

    @property
    def certified_gross(self):
        return self._cert_sum("gross")

    @property
    def certified_net(self):
        return self._cert_sum("net_amount")

    @property
    def retention_held(self):
        released = self.retention_releases.filter(state="posted").aggregate(s=Sum("amount"))["s"] or ZERO
        return self._cert_sum("retention_amount") - released

    @property
    def advance_paid(self):
        kind = "receipt" if self.is_client else "payment"
        return self.payments.filter(state="posted", purpose="advance", kind=kind).aggregate(
            s=Sum("amount"))["s"] or ZERO

    def advance_recovered(self, before_seq=None):
        qs = self.posted_certs()
        if before_seq is not None:
            qs = qs.filter(seq__lt=before_seq)
        return qs.aggregate(s=Sum("advance_recovery"))["s"] or ZERO

    @property
    def advance_remaining(self):
        return self.advance_paid - self.advance_recovered()

    @property
    def paid_on_certs(self):
        kind = "receipt" if self.is_client else "payment"
        return self.payments.filter(state="posted", kind=kind).exclude(purpose="advance").aggregate(
            s=Sum("amount"))["s"] or ZERO

    @property
    def released_total(self):
        return self.retention_releases.filter(state="posted").aggregate(s=Sum("amount"))["s"] or ZERO

    @property
    def balance_due(self):
        """صافي المستحق على/لـ الطرف الآخر من المستخلصات ورد المحتجزات بعد السداد."""
        return self.certified_net + self.released_total - self.paid_on_certs

    @property
    def progress_pct(self):
        total = self.boq_total
        return (self.certified_gross / total * 100) if total else ZERO

    def next_seq(self):
        return (self.certificates.aggregate(m=models.Max("seq"))["m"] or 0) + 1


class BOQItem(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="items")
    code = models.CharField("البند", max_length=30, blank=True)
    description = models.CharField("وصف البند", max_length=500)
    unit = models.CharField("الوحدة", max_length=30, default="م3")
    quantity = models.DecimalField("الكمية التعاقدية", max_digits=14, decimal_places=3, default=0)
    unit_price = models.DecimalField("الفئة (سعر الوحدة)", max_digits=16, decimal_places=4, default=0)
    is_variation = models.BooleanField("أعمال إضافية / أمر تغيير", default=False)

    class Meta:
        ordering = ["id"]
        verbose_name = "بند مقايسة"

    def __str__(self):
        return f"{self.code} {self.description}"

    @property
    def total(self):
        return r2(self.quantity * self.unit_price)

    def last_posted_line(self, before_seq=None):
        qs = CertificateLine.objects.filter(item=self, certificate__state="posted")
        if before_seq is not None:
            qs = qs.filter(certificate__seq__lt=before_seq)
        return qs.order_by("-certificate__seq").first()

    def certified(self, before_seq=None):
        """(الكمية التراكمية، القيمة التراكمية) حتى آخر مستخلص معتمد."""
        ln = self.last_posted_line(before_seq)
        return (ln.cumulative_qty, ln.cumulative_amount) if ln else (ZERO, ZERO)


class Certificate(PostableDocument):
    """المستخلص: جاري أو ختامي - للعميل أو لمقاول الباطن."""

    contract = models.ForeignKey(Contract, verbose_name="العقد", on_delete=models.PROTECT,
                                 related_name="certificates")
    seq = models.PositiveIntegerField("رقم المستخلص بالعقد", editable=False)
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("تاريخ المستخلص")
    period_from = models.DateField("الفترة من", null=True, blank=True)
    period_to = models.DateField("الفترة إلى", null=True, blank=True)
    is_final = models.BooleanField("مستخلص ختامي", default=False)
    auto_deductions = models.BooleanField("احتساب الاستقطاعات تلقائياً", default=True)
    notes = models.TextField("ملاحظات", blank=True)

    gross = models.DecimalField("قيمة الأعمال الحالية", max_digits=16, decimal_places=2, default=0)
    vat_amount = models.DecimalField("ضريبة القيمة المضافة", max_digits=16, decimal_places=2, default=0)
    retention_amount = models.DecimalField("ضمان أعمال (محتجزات)", max_digits=16, decimal_places=2, default=0)
    advance_recovery = models.DecimalField("استرداد دفعة مقدمة", max_digits=16, decimal_places=2, default=0)
    wht_amount = models.DecimalField("ضريبة الخصم من المنبع", max_digits=16, decimal_places=2, default=0)
    social_ins_amount = models.DecimalField("تأمينات اجتماعية", max_digits=16, decimal_places=2, default=0)
    other_deductions = models.DecimalField("استقطاعات أخرى", max_digits=16, decimal_places=2, default=0)
    net_amount = models.DecimalField("صافي المستخلص المستحق", max_digits=16, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date", "-id"]
        unique_together = [("contract", "seq")]
        verbose_name = "مستخلص"
        verbose_name_plural = "المستخلصات"

    def __str__(self):
        kind = "مستخلص عميل" if self.contract.is_client else "مستخلص مقاول باطن"
        final = " (ختامي)" if self.is_final else ""
        return f"{kind} رقم {self.seq}{final} - {self.contract.number}"

    @property
    def entry_source(self):
        return "client_cert" if self.contract.is_client else "sub_cert"

    def save(self, *args, **kwargs):
        if not self.seq:
            self.seq = self.contract.next_seq()
        if not self.number:
            self.number = Sequence.next("CCERT" if self.contract.is_client else "SCERT")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("certificate_detail", args=[self.pk])

    # ---------------------------------------------------------------- الحسابات
    def sync_lines(self):
        """يضمن وجود سطر لكل بند بالمقايسة ويحدّث الكميات السابقة (للمسودات فقط)."""
        if not self.is_draft:
            return
        existing = {ln.item_id: ln for ln in self.lines.all()}
        for item in self.contract.items.all():
            prev_qty, prev_amount = item.certified(before_seq=self.seq)
            ln = existing.get(item.id)
            if ln is None:
                last = item.last_posted_line(before_seq=self.seq)
                CertificateLine.objects.create(certificate=self, item=item, prev_qty=prev_qty,
                                               prev_amount=prev_amount, unit_price=item.unit_price,
                                               completion_pct=last.completion_pct if last else 100)
            elif (ln.prev_qty, ln.prev_amount, ln.unit_price) != (prev_qty, prev_amount, item.unit_price):
                ln.prev_qty, ln.prev_amount, ln.unit_price = prev_qty, prev_amount, item.unit_price
                ln.save(update_fields=["prev_qty", "prev_amount", "unit_price"])

    @property
    def prev_gross(self):
        return sum((ln.prev_amount for ln in self.lines.all()), ZERO)

    @property
    def cumulative_gross(self):
        return sum((ln.cumulative_amount for ln in self.lines.all()), ZERO)

    @property
    def total_deductions(self):
        return (self.retention_amount + self.advance_recovery + self.wht_amount + self.social_ins_amount
                + self.other_deductions)

    def compute(self):
        c = self.contract
        self.gross = sum((ln.current_amount for ln in self.lines.all()), ZERO)
        if self.auto_deductions:
            self.retention_amount = r2(self.gross * c.retention_pct / 100)
            self.wht_amount = c.wht.amount(self.gross) if c.wht_id else ZERO
            self.social_ins_amount = r2(self.gross * c.social_ins_pct / 100)
            remaining_adv = c.advance_paid - c.advance_recovered(before_seq=self.seq)
            if self.is_final:
                planned = remaining_adv
            else:
                planned = r2(self.gross * c.advance_recovery_pct / 100)
            self.advance_recovery = max(ZERO, min(planned, remaining_adv))
        vat_base = self.gross - self.retention_amount if c.vat_on_net else self.gross
        self.vat_amount = c.vat.amount(vat_base) if c.vat_id else ZERO
        self.other_deductions = self.deductions.aggregate(s=Sum("amount"))["s"] or ZERO
        self.net_amount = self.gross + self.vat_amount - self.total_deductions
        self.save()

    @property
    def paid_amount(self):
        return self.payments.filter(state="posted").aggregate(s=Sum("amount"))["s"] or ZERO

    @property
    def residual(self):
        return self.net_amount - self.paid_amount if self.is_posted else ZERO

    # ---------------------------------------------------------------- الترحيل
    def check_can_post(self):
        self.compute()
        if self.contract.status == "cancelled":
            raise ValidationError("العقد ملغي")
        if self.contract.certificates.filter(seq__lt=self.seq).exclude(state="posted").exists():
            raise ValidationError("يجب اعتماد المستخلصات السابقة لهذا العقد أولاً (الاعتماد بالترتيب)")
        if self.gross <= 0 and not self.is_final:
            raise ValidationError("لا توجد أعمال حالية في المستخلص")
        for ln in self.lines.select_related("item"):
            if ln.cumulative_qty < 0:
                raise ValidationError(f"الكمية التراكمية للبند «{ln.item}» بالسالب")

    def check_can_unpost(self):
        if self.contract.certificates.filter(seq__gt=self.seq, state="posted").exists():
            raise ValidationError("لا يمكن إلغاء اعتماد مستخلص يليه مستخلصات معتمدة. ألغِ الأحدث أولاً")
        if self.payments.filter(state="posted").exists():
            raise ValidationError("لا يمكن إلغاء اعتماد مستخلص عليه سندات سداد مرحّلة")

    def entry_memo(self):
        return f"{self} - {self.contract.partner}"

    def build_entry(self, b):
        c, partner, project = self.contract, self.contract.partner, self.contract.project
        cc = project.cost_center
        lbl = f"مستخلص {self.seq} عقد {c.number}"
        kw = dict(partner=partner, project=project)
        if c.is_client:
            b.debit(partner.ar_account(), self.net_amount, label=f"صافي {lbl}", **kw)
            b.debit(AccountMapping.get("retention_receivable"), self.retention_amount, label=f"ضمان أعمال {lbl}", **kw)
            b.debit(AccountMapping.get("customer_advance"), self.advance_recovery, label=f"استرداد دفعة مقدمة {lbl}",
                    **kw)
            if self.wht_amount:
                b.debit(c.wht.account_for("sale"), self.wht_amount, label=f"خصم من المنبع {lbl}", **kw)
            b.debit(AccountMapping.get("social_ins_expense"), self.social_ins_amount, label=f"تأمينات {lbl}",
                    project=project, cost_center=cc)
            for d in self.deductions.select_related("account"):
                b.debit(d.account, d.amount, label=f"{d.description} - {lbl}", project=project, cost_center=cc)
            b.credit(AccountMapping.get("contract_revenue"), self.gross, label=f"إيراد {lbl}", project=project,
                     cost_center=cc)
            if self.vat_amount:
                b.credit(c.vat.account_for("sale"), self.vat_amount, label=f"ض.ق.م {lbl}", partner=partner)
        else:
            b.debit(AccountMapping.get("subcontract_cost"), self.gross, label=f"تكلفة {lbl} - {partner}",
                    project=project, cost_center=cc)
            if self.vat_amount:
                b.debit(c.vat.account_for("purchase"), self.vat_amount, label=f"ض.ق.م {lbl}", partner=partner)
            b.credit(partner.ap_account(), self.net_amount, label=f"صافي {lbl}", **kw)
            b.credit(AccountMapping.get("retention_payable"), self.retention_amount, label=f"ضمان أعمال {lbl}", **kw)
            b.credit(AccountMapping.get("supplier_advance"), self.advance_recovery,
                     label=f"استرداد دفعة مقدمة {lbl}", **kw)
            if self.wht_amount:
                b.credit(c.wht.account_for("purchase"), self.wht_amount, label=f"خصم وإضافة {lbl}", **kw)
            b.credit(AccountMapping.get("social_ins_payable"), self.social_ins_amount, label=f"تأمينات {lbl}", **kw)
            for d in self.deductions.select_related("account"):
                b.credit(d.account, d.amount, label=f"{d.description} - {lbl}", project=project, cost_center=cc)

    def after_post(self):
        if self.is_final and self.contract.status == "active":
            self.contract.status = "closed"
            self.contract.save(update_fields=["status"])

    def after_unpost(self):
        if self.is_final and self.contract.status == "closed":
            self.contract.status = "active"
            self.contract.save(update_fields=["status"])


class CertificateLine(models.Model):
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(BOQItem, verbose_name="البند", on_delete=models.PROTECT, related_name="cert_lines")
    prev_qty = models.DecimalField("الكمية السابقة", max_digits=14, decimal_places=3, default=0)
    prev_amount = models.DecimalField("القيمة السابقة", max_digits=16, decimal_places=2, default=0)
    current_qty = models.DecimalField("الكمية الحالية", max_digits=14, decimal_places=3, default=0)
    unit_price = models.DecimalField("الفئة", max_digits=16, decimal_places=4, default=0)
    completion_pct = models.DecimalField(
        "نسبة الصرف %", max_digits=6, decimal_places=2, default=100,
        help_text="تُطبق على الكمية التراكمية (مثلاً 70% لأعمال لم تكتمل) ويُستكمل الفرق تلقائياً في المستخلص التالي")

    class Meta:
        ordering = ["item_id"]

    @property
    def cumulative_qty(self):
        return self.prev_qty + self.current_qty

    @property
    def cumulative_amount(self):
        """القيمة التراكمية = الكمية التراكمية × الفئة × نسبة الصرف."""
        return r2(self.cumulative_qty * self.unit_price * self.completion_pct / 100)

    @property
    def current_amount(self):
        """الأعمال الحالية = التراكمي - ما سبق صرفه."""
        return self.cumulative_amount - self.prev_amount

    @property
    def progress_pct(self):
        q = self.item.quantity
        return (self.cumulative_qty / q * 100) if q else ZERO


class CertificateDeduction(models.Model):
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name="deductions")
    description = models.CharField("بيان الاستقطاع", max_length=200)
    account = models.ForeignKey(Account, verbose_name="الحساب", on_delete=models.PROTECT,
                                limit_choices_to={"is_group": False})
    amount = models.DecimalField("المبلغ", max_digits=16, decimal_places=2)

    class Meta:
        ordering = ["id"]


class RetentionRelease(PostableDocument):
    """رد (صرف) محتجزات ضمان الأعمال بعد انتهاء فترة الضمان."""

    contract = models.ForeignKey(Contract, verbose_name="العقد", on_delete=models.PROTECT,
                                 related_name="retention_releases")
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("التاريخ")
    amount = models.DecimalField("المبلغ", max_digits=16, decimal_places=2)
    notes = models.CharField("البيان", max_length=300, blank=True)

    entry_source = "retention"

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "رد محتجزات"
        verbose_name_plural = "رد المحتجزات"

    def __str__(self):
        return f"رد محتجزات {self.number} - {self.contract.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("RET")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("contract_detail", args=[self.contract_id])

    def check_can_post(self):
        if self.amount <= 0:
            raise ValidationError("المبلغ يجب أن يكون أكبر من صفر")
        if self.amount > self.contract.retention_held:
            raise ValidationError(f"المبلغ أكبر من رصيد المحتجزات ({self.contract.retention_held:,.2f})")

    def build_entry(self, b):
        c = self.contract
        kw = dict(partner=c.partner, project=c.project, label=self.notes or str(self))
        if c.is_client:
            b.debit(c.partner.ar_account(), self.amount, **kw)
            b.credit(AccountMapping.get("retention_receivable"), self.amount, **kw)
        else:
            b.debit(AccountMapping.get("retention_payable"), self.amount, **kw)
            b.credit(c.partner.ap_account(), self.amount, **kw)
