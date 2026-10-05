"""
محرك الترحيل: كل المستندات (فواتير، سندات، مستخلصات، إهلاك...) تولّد قيودها من هنا.
"""
from collections import OrderedDict
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Company, JournalEntry, JournalLine, r2


class EntryBuilder:
    """يجمع سطور القيد ويدمج المتشابه منها ثم ينشئ القيد المرحّل."""

    def __init__(self, date, memo, source="manual", reference="", source_url="", user=None):
        self.date, self.memo, self.source = date, memo, source
        self.reference, self.source_url, self.user = reference, source_url, user
        self._lines = OrderedDict()

    def add(self, account, debit=0, credit=0, label="", partner=None, project=None, cost_center=None):
        debit, credit = r2(debit), r2(credit)
        if debit < 0:
            debit, credit = Decimal(0), credit - debit
        if credit < 0:
            debit, credit = debit - credit, Decimal(0)
        if not debit and not credit:
            return self
        side = "d" if debit else "c"
        key = (account.id, side, getattr(partner, "id", None), getattr(project, "id", None),
               getattr(cost_center, "id", None), label)
        if key in self._lines:
            ln = self._lines[key]
            ln["debit"] += debit
            ln["credit"] += credit
        else:
            self._lines[key] = dict(account=account, debit=debit, credit=credit, label=label,
                                    partner=partner, project=project, cost_center=cost_center)
        return self

    def debit(self, account, amount, **kw):
        return self.add(account, debit=amount, **kw)

    def credit(self, account, amount, **kw):
        return self.add(account, credit=amount, **kw)

    @property
    def lines(self):
        return list(self._lines.values())

    def post(self):
        return create_entry(self.date, self.memo, self.lines, source=self.source, reference=self.reference,
                            source_url=self.source_url, user=self.user, post=True)


def check_lock_date(date):
    company = Company.get()
    if company.lock_date and date <= company.lock_date:
        raise ValidationError(
            f"الفترة مقفلة حتى {company.lock_date:%Y/%m/%d}. لا يمكن تسجيل أو تعديل حركات بتاريخ {date:%Y/%m/%d}")


def validate_lines(lines):
    if len([ln for ln in lines if ln["debit"] or ln["credit"]]) < 2:
        raise ValidationError("القيد يجب أن يحتوي على سطرين على الأقل")
    total_d = sum(r2(ln["debit"]) for ln in lines)
    total_c = sum(r2(ln["credit"]) for ln in lines)
    if total_d != total_c:
        raise ValidationError(f"القيد غير متزن: إجمالي المدين {total_d:,.2f} ≠ إجمالي الدائن {total_c:,.2f}")
    for ln in lines:
        if ln["account"].is_group:
            raise ValidationError(f"الحساب {ln['account']} حساب تجميعي ولا يقبل قيوداً")
        if ln["debit"] and ln["credit"]:
            raise ValidationError("لا يجوز أن يحتوي السطر الواحد على مدين ودائن معاً")
    return total_d


@transaction.atomic
def create_entry(date, memo, lines, source="manual", reference="", source_url="", user=None, post=True):
    check_lock_date(date)
    validate_lines(lines)
    entry = JournalEntry.objects.create(
        date=date, memo=memo[:300], source=source, reference=reference[:100], source_url=source_url,
        state="posted" if post else "draft", created_by=user)
    JournalLine.objects.bulk_create([
        JournalLine(entry=entry, account=ln["account"], debit=r2(ln["debit"]), credit=r2(ln["credit"]),
                    label=(ln.get("label") or "")[:300], partner=ln.get("partner"),
                    project=ln.get("project"), cost_center=ln.get("cost_center"))
        for ln in lines if ln["debit"] or ln["credit"]
    ])
    return entry


def remove_entry(entry):
    """حذف القيد الآلي عند إرجاع المستند لمسودة (مع احترام تاريخ الإقفال)."""
    if entry is None:
        return
    check_lock_date(entry.date)
    entry.delete()


def post_manual(entry):
    check_lock_date(entry.date)
    lines = [dict(account=ln.account, debit=ln.debit, credit=ln.credit) for ln in entry.lines.all()]
    validate_lines(lines)
    entry.state = "posted"
    entry.save(update_fields=["state"])
