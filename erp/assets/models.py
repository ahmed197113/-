import calendar
from datetime import date as Date

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.urls import reverse

from accounting.models import Account, CostCenter, PostableDocument, Sequence, ZERO, r2


class AssetCategory(models.Model):
    name = models.CharField("الفئة", max_length=120)
    asset_account = models.ForeignKey(Account, verbose_name="حساب الأصل", on_delete=models.PROTECT,
                                      related_name="+", limit_choices_to={"is_group": False})
    accum_account = models.ForeignKey(Account, verbose_name="حساب مجمع الإهلاك", on_delete=models.PROTECT,
                                      related_name="+", limit_choices_to={"is_group": False})
    expense_account = models.ForeignKey(Account, verbose_name="حساب مصروف الإهلاك", on_delete=models.PROTECT,
                                        related_name="+", limit_choices_to={"is_group": False})
    life_months = models.PositiveIntegerField("العمر الافتراضي (شهر)", default=60)

    class Meta:
        ordering = ["name"]
        verbose_name = "فئة أصول"
        verbose_name_plural = "فئات الأصول"

    def __str__(self):
        return self.name


class Asset(models.Model):
    STATUS = [("running", "قيد الاستخدام"), ("depreciated", "مُهلك بالكامل"), ("disposed", "مُستبعد")]
    code = models.CharField("الكود", max_length=30, unique=True)
    name = models.CharField("اسم الأصل", max_length=200)
    category = models.ForeignKey(AssetCategory, verbose_name="الفئة", on_delete=models.PROTECT,
                                 related_name="assets")
    purchase_date = models.DateField("تاريخ الشراء")
    start_date = models.DateField("بداية الإهلاك")
    cost = models.DecimalField("تكلفة الشراء", max_digits=16, decimal_places=2)
    salvage = models.DecimalField("القيمة التخريدية", max_digits=16, decimal_places=2, default=0)
    life_months = models.PositiveIntegerField("العمر الافتراضي (شهر)")
    opening_depreciation = models.DecimalField("إهلاك سابق (رصيد افتتاحي)", max_digits=16, decimal_places=2,
                                               default=0)
    project = models.ForeignKey("contracting.Project", verbose_name="يُحمل على مشروع", null=True, blank=True,
                                on_delete=models.SET_NULL)
    cost_center = models.ForeignKey(CostCenter, verbose_name="مركز التكلفة", null=True, blank=True,
                                    on_delete=models.SET_NULL)
    serial = models.CharField("الرقم المسلسل / اللوحة", max_length=60, blank=True)
    location = models.CharField("المكان", max_length=120, blank=True)
    status = models.CharField("الحالة", max_length=12, choices=STATUS, default="running")

    class Meta:
        ordering = ["code"]
        verbose_name = "أصل ثابت"
        verbose_name_plural = "الأصول الثابتة"

    def __str__(self):
        return f"{self.code} - {self.name}"

    def get_absolute_url(self):
        return reverse("asset_detail", args=[self.pk])

    @property
    def depreciable(self):
        return self.cost - self.salvage

    @property
    def monthly(self):
        return r2(self.depreciable / self.life_months) if self.life_months else ZERO

    @property
    def accumulated(self):
        posted = self.dep_lines.filter(run__state="posted").aggregate(s=Sum("amount"))["s"] or ZERO
        return self.opening_depreciation + posted

    @property
    def book_value(self):
        return self.cost - self.accumulated

    def amount_for(self, run_date):
        """إهلاك شهر واحد بطريقة القسط الثابت مع عدم تجاوز القيمة القابلة للإهلاك."""
        if self.status != "running" or run_date < self.start_date:
            return ZERO
        if self.dep_lines.filter(run__state="posted", run__date__year=run_date.year,
                                 run__date__month=run_date.month).exists():
            return ZERO
        remaining = self.depreciable - self.accumulated
        return max(ZERO, min(self.monthly, remaining))


class DepreciationRun(PostableDocument):
    number = models.CharField("الرقم", max_length=30, blank=True, unique=True)
    date = models.DateField("تاريخ الإهلاك (نهاية الشهر)")
    notes = models.CharField("البيان", max_length=200, blank=True)

    entry_source = "depreciation"

    class Meta:
        ordering = ["-date"]
        verbose_name = "قيد إهلاك"
        verbose_name_plural = "قيود الإهلاك"

    def __str__(self):
        return f"إهلاك شهر {self.date:%Y/%m}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = Sequence.next("DEP")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("depreciation_list")

    @staticmethod
    def month_end(d):
        return Date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])

    @property
    def total(self):
        return self.lines.aggregate(s=Sum("amount"))["s"] or ZERO

    def generate_lines(self):
        self.lines.all().delete()
        for a in Asset.objects.filter(status="running").select_related("category"):
            amt = a.amount_for(self.date)
            if amt > 0:
                DepreciationLine.objects.create(run=self, asset=a, amount=amt)

    def check_can_post(self):
        if not self.lines.exists():
            raise ValidationError("لا توجد أصول مستحق عليها إهلاك لهذا الشهر")

    def build_entry(self, b):
        for ln in self.lines.select_related("asset__category"):
            a, cat = ln.asset, ln.asset.category
            b.debit(cat.expense_account, ln.amount, label=f"إهلاك {a.name}", project=a.project,
                    cost_center=a.cost_center)
            b.credit(cat.accum_account, ln.amount, label=f"مجمع إهلاك {cat.name}")

    def after_post(self):
        for ln in self.lines.select_related("asset"):
            if ln.asset.book_value <= ln.asset.salvage:
                ln.asset.status = "depreciated"
                ln.asset.save(update_fields=["status"])

    def after_unpost(self):
        for ln in self.lines.select_related("asset"):
            if ln.asset.status == "depreciated":
                ln.asset.status = "running"
                ln.asset.save(update_fields=["status"])


class DepreciationLine(models.Model):
    run = models.ForeignKey(DepreciationRun, on_delete=models.CASCADE, related_name="lines")
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="dep_lines")
    amount = models.DecimalField("المبلغ", max_digits=16, decimal_places=2)
