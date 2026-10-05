import datetime as dt
import json
from decimal import Decimal

from django.contrib import messages
from django.core import management
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import (AccountForm, CompanyForm, CostCenterForm, JournalEntryForm, JournalLineFormSet,
                    JournalTemplateForm, MappingForm, PartnerForm, TaxForm, TemplateLineFormSet, UseTemplateForm,
                    YearCloseForm)
from .models import (Account, AccountMapping, Company, CostCenter, JournalEntry, JournalLine, JournalTemplate,
                     Partner, Tax, ZERO, r2)
from .posting import create_entry, post_manual, remove_entry
from .reports import treasury_balances
from .ui import Col, delete_object, render_list, save_form, today


# ---------------------------------------------------------------------------- لوحة التحكم
def dashboard(request):
    from commerce.models import Invoice, Payment, Product
    from contracting.models import Certificate, Project
    t = today()
    year_start = dt.date(t.year, 1, 1)

    def type_sum(types, date_from=None):
        qs = JournalLine.objects.filter(entry__state="posted", account__type__in=types)
        if date_from:
            qs = qs.filter(entry__date__gte=date_from)
        a = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        return (a["d"] or ZERO) - (a["c"] or ZERO)

    def kind_sum(kind):
        a = JournalLine.objects.filter(entry__state="posted", account__kind=kind).aggregate(
            d=Sum("debit"), c=Sum("credit"))
        return (a["d"] or ZERO) - (a["c"] or ZERO)

    revenue = -type_sum(["income"], year_start)
    expense = type_sum(["expense"], year_start)
    treasury = treasury_balances()

    # الإيرادات والمصروفات آخر 12 شهراً
    months, rev_series, exp_series = [], [], []
    y, m = t.year, t.month
    for _ in range(12):
        months.insert(0, (y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    for (yy, mm) in months:
        qs = JournalLine.objects.filter(entry__state="posted", entry__date__year=yy, entry__date__month=mm)
        inc = qs.filter(account__type="income").aggregate(d=Sum("debit"), c=Sum("credit"))
        exp = qs.filter(account__type="expense").aggregate(d=Sum("debit"), c=Sum("credit"))
        rev_series.append(float((inc["c"] or 0) - (inc["d"] or 0)))
        exp_series.append(float((exp["d"] or 0) - (exp["c"] or 0)))

    projects = []
    for p in Project.objects.filter(status__in=("active", "completed"))[:8]:
        rev, cost = p.revenue(), p.cost()
        projects.append(dict(p=p, revenue=rev, cost=cost, profit=rev - cost, value=p.contract_value))

    overdue = [i for i in Invoice.objects.filter(state="posted", kind="sale", due_date__lt=t).select_related("partner")
               if i.residual > 0][:6]
    low_stock = [p for p in Product.objects.filter(type="stock", active=True, min_qty__gt=0)
                 if p.qty_on_hand() < p.min_qty][:6]
    drafts = (Invoice.objects.filter(state="draft").count() + Payment.objects.filter(state="draft").count()
              + Certificate.objects.filter(state="draft").count()
              + JournalEntry.objects.filter(state="draft").count())
    ctx = dict(
        title="لوحة التحكم",
        cash=sum((x["balance"] for x in treasury), ZERO), treasury=treasury,
        receivable=kind_sum("receivable"), payable=-kind_sum("payable"),
        revenue=revenue, expense=expense, profit=revenue - expense,
        chart=json.dumps(dict(labels=[f"{yy}/{mm:02d}" for yy, mm in months], revenue=rev_series,
                              expense=exp_series)),
        projects=projects, overdue=overdue, low_stock=low_stock, drafts=drafts,
        recent=JournalEntry.objects.filter(state="posted")[:8],
        pending_certs=[c for c in Certificate.objects.filter(state="posted").select_related("contract__partner")
                       if c.residual > 0][:6],
    )
    return render(request, "dashboard.html", ctx)


# ---------------------------------------------------------------------------- شجرة الحسابات
def account_tree(request):
    accounts = list(Account.objects.all())
    sums = {r["account_id"]: (r["d"] or ZERO) - (r["c"] or ZERO) for r in
            JournalLine.objects.filter(entry__state="posted").values("account_id").annotate(
                d=Sum("debit"), c=Sum("credit"))}
    by_id = {a.id: a for a in accounts}
    totals = {}
    for aid, v in sums.items():
        a = by_id.get(aid)
        while a:
            totals[a.id] = totals.get(a.id, ZERO) + v
            a = by_id.get(a.parent_id)
    rows = [dict(a=a, balance=totals.get(a.id, ZERO)) for a in accounts]
    lv = {}
    for a in sorted(accounts, key=lambda x: x.code):
        lv[a.id] = 0 if not a.parent_id else lv.get(a.parent_id, 0) + 1
    for r in rows:
        r["level"] = lv[r["a"].id]
    return render(request, "accounting/account_tree.html", dict(title="شجرة الحسابات", rows=rows))


def account_form(request, pk=None):
    obj = get_object_or_404(Account, pk=pk) if pk else None
    initial = {}
    if not obj and request.GET.get("parent"):
        parent = get_object_or_404(Account, pk=request.GET["parent"])
        last = parent.children.order_by("-code").first()
        code = str(int(last.code) + 1) if last and last.code.isdigit() else parent.code + "01"
        initial = dict(parent=parent, type=parent.type, code=code)
    return save_form(request, AccountForm, obj, "حساب" if not obj else f"تعديل حساب {obj}", initial=initial,
                     success=lambda o: "/accounts/", icon="bi-diagram-3")


def account_delete(request, pk):
    return delete_object(request, get_object_or_404(Account, pk=pk), "/accounts/")


# ---------------------------------------------------------------------------- مراكز التكلفة والضرائب
def cost_center_list(request):
    return render_list(request, "مراكز التكلفة", CostCenter.objects.all(),
                       [Col("الكود", "code"), Col("الاسم", "name"), Col("الرئيسي", "parent"),
                        Col("نشط", "active", "bool")],
                       row_url=lambda o: f"/cost-centers/{o.pk}/", new_url="/cost-centers/new/",
                       search=("code", "name"), icon="bi-bullseye")


def cost_center_form(request, pk=None):
    obj = get_object_or_404(CostCenter, pk=pk) if pk else None
    return save_form(request, CostCenterForm, obj, "مركز تكلفة", success=lambda o: "/cost-centers/")


def tax_list(request):
    return render_list(request, "الضرائب", Tax.objects.all(),
                       [Col("الاسم", "name"), Col("النوع", lambda o: o.get_kind_display()),
                        Col("النسبة %", "rate", "qty"), Col("النطاق", lambda o: o.get_scope_display()),
                        Col("نشط", "active", "bool")],
                       row_url=lambda o: f"/taxes/{o.pk}/", new_url="/taxes/new/", icon="bi-percent")


def tax_form(request, pk=None):
    obj = get_object_or_404(Tax, pk=pk) if pk else None
    return save_form(request, TaxForm, obj, "ضريبة", success=lambda o: "/taxes/")


# ---------------------------------------------------------------------------- العملاء والموردون
PARTNER_TYPES = dict(Partner.TYPES)


def partner_list(request):
    ptype = request.GET.get("type", "")
    title = {"customer": "العملاء", "supplier": "الموردون", "subcontractor": "مقاولو الباطن"}.get(
        ptype, "العملاء والموردون ومقاولو الباطن")
    qs = Partner.objects.all()
    if ptype:
        qs = qs.filter(type__in=[ptype, "both"] if ptype in ("customer", "supplier") else [ptype])
    return render_list(request, title, qs,
                       [Col("الكود", "code"), Col("الاسم", "name"), Col("النوع", lambda o: o.get_type_display()),
                        Col("التليفون", "phone"), Col("الرقم الضريبي", "tax_id"),
                        Col("الرصيد", lambda o: o.balance(), "money")],
                       row_url=lambda o: f"/partners/{o.pk}/", new_url=f"/partners/new/?type={ptype}",
                       search=("name", "code", "phone", "tax_id"), icon="bi-people", totals=("الرصيد",))


def partner_form(request, pk=None):
    obj = get_object_or_404(Partner, pk=pk) if pk else None
    initial = {"type": request.GET.get("type") or "customer"}
    return save_form(request, PartnerForm, obj, "بيانات جهة التعامل", initial=initial,
                     success=lambda o: f"/partners/{o.pk}/", icon="bi-person-vcard")


def partner_detail(request, pk):
    p = get_object_or_404(Partner, pk=pk)
    from commerce.models import Invoice, Payment
    invoices = Invoice.objects.filter(partner=p)[:20]
    payments = Payment.objects.filter(partner=p)[:20]
    contracts = p.contracts.select_related("project")
    return render(request, "accounting/partner_detail.html", dict(
        title=p.name, p=p, balance=p.balance(), invoices=invoices, payments=payments, contracts=contracts))


# ---------------------------------------------------------------------------- قيود اليومية
def journal_list(request):
    qs = JournalEntry.objects.annotate(total=Sum("lines__debit")).select_related("created_by")
    return render_list(
        request, "قيود اليومية", qs,
        [Col("رقم القيد", "number"), Col("التاريخ", "date", "date"), Col("البيان", "memo"),
         Col("المصدر", lambda o: o.get_source_display()), Col("المبلغ", "total", "money"),
         Col("الحالة", "state", "state")],
        row_url=lambda o: f"/journal/{o.pk}/", new_url="/journal/new/", search=("number", "memo", "reference"),
        icon="bi-journal-text",
        filters=[("source", "المصدر", JournalEntry.SOURCES, lambda qs, v: qs.filter(source=v)),
                 ("state", "الحالة", JournalEntry.STATES, lambda qs, v: qs.filter(state=v))],
        buttons=[("/journal/templates/", "قيود جاهزة", "bi-lightning-charge", "warning")])


def journal_detail(request, pk):
    e = get_object_or_404(JournalEntry, pk=pk)
    d, c = e.totals()
    lines = e.lines.select_related("account", "partner", "project", "cost_center")
    return render(request, "accounting/journal_detail.html",
                  dict(title=f"قيد رقم {e.number}", e=e, lines=lines, total_debit=d, total_credit=c))


def journal_form(request, pk=None):
    obj = get_object_or_404(JournalEntry, pk=pk) if pk else None
    if obj and obj.is_auto:
        messages.warning(request, "هذا قيد آلي ناتج عن مستند؛ عدّل المستند الأصلي بدلاً منه")
        return redirect(obj.get_absolute_url())
    return save_form(request, JournalEntryForm, obj, "قيد يومية", initial={"date": today()},
                     formsets=[(JournalLineFormSet, "lines", "سطور القيد")], template="accounting/journal_form.html",
                     icon="bi-journal-plus")


@require_POST
def journal_action(request, pk, action):
    e = get_object_or_404(JournalEntry, pk=pk)
    try:
        if e.is_auto:
            raise ValidationError("القيود الآلية تُدار من المستند الأصلي")
        if action == "post":
            post_manual(e)
            messages.success(request, "تم ترحيل القيد")
        elif action == "unpost":
            from .posting import check_lock_date
            check_lock_date(e.date)
            e.state = "draft"
            e.save(update_fields=["state"])
            messages.info(request, "أُعيد القيد لمسودة")
        elif action == "delete":
            if e.state != "draft":
                raise ValidationError("ألغِ ترحيل القيد أولاً")
            e.delete()
            messages.success(request, "تم حذف القيد")
            return redirect("/journal/")
        elif action == "reverse":
            lines = [dict(account=ln.account, debit=ln.credit, credit=ln.debit, label=ln.label, partner=ln.partner,
                          project=ln.project, cost_center=ln.cost_center) for ln in e.lines.all()]
            new = create_entry(today(), f"عكس القيد {e.number}: {e.memo}", lines, reference=e.number,
                               user=request.user)
            messages.success(request, f"تم إنشاء قيد عكسي رقم {new.number}")
            return redirect(new.get_absolute_url())
    except ValidationError as ex:
        for m in ex.messages:
            messages.error(request, m)
    return redirect(e.get_absolute_url())


# ---------------------------------------------------------------------------- القيود الجاهزة
def template_list(request):
    templates = JournalTemplate.objects.filter(active=True).prefetch_related("lines__account")
    return render(request, "accounting/template_list.html", dict(title="القيود الجاهزة", templates=templates))


def template_form(request, pk=None):
    obj = get_object_or_404(JournalTemplate, pk=pk) if pk else None
    return save_form(request, JournalTemplateForm, obj, "نموذج قيد جاهز",
                     formsets=[(TemplateLineFormSet, "lines", "أطراف القيد")], success=lambda o: "/journal/templates/")


def template_use(request, pk):
    t = get_object_or_404(JournalTemplate, pk=pk)
    form = UseTemplateForm(request.POST or None, template=t, initial={"date": today(), "memo": t.memo})
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        lines = []
        for tl in t.lines.select_related("account"):
            amt = r2(cd["amount"] * tl.percent / 100)
            lines.append(dict(account=tl.account, debit=amt if tl.side == "debit" else ZERO,
                              credit=amt if tl.side == "credit" else ZERO, label=tl.label or cd["memo"],
                              partner=cd["partner"] if tl.use_partner else None,
                              project=cd["project"] if tl.use_project else None,
                              cost_center=cd["cost_center"] if tl.side == "debit" else None))
        try:
            e = create_entry(cd["date"], cd["memo"] or t.name, lines, reference=cd["reference"], user=request.user,
                             post=cd["post_now"])
            messages.success(request, f"تم إنشاء القيد {e.number} من النموذج «{t.name}»")
            return redirect(e.get_absolute_url())
        except ValidationError as ex:
            form.add_error(None, ex)
    return render(request, "accounting/template_use.html", dict(title=f"قيد جاهز: {t.name}", form=form, t=t))


# ---------------------------------------------------------------------------- الإعدادات
def settings_view(request):
    form = CompanyForm(request.POST or None, instance=Company.get())
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "تم حفظ الإعدادات")
        return redirect("/settings/")
    return render(request, "accounting/settings.html", dict(title="الإعدادات", form=form))


def mapping_view(request):
    form = MappingForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        for role, _ in AccountMapping.ROLES:
            acc = form.cleaned_data.get(role)
            if acc:
                AccountMapping.objects.update_or_create(role=role, defaults={"account": acc})
            else:
                AccountMapping.objects.filter(role=role).delete()
        messages.success(request, "تم حفظ التوجيه المحاسبي")
        return redirect("/settings/mapping/")
    return render(request, "generic/form.html", dict(
        title="التوجيه المحاسبي للقيود الآلية", form=form, formsets=[], icon="bi-signpost-split",
        help="هنا تحدد الحساب الذي يستخدمه البرنامج تلقائياً لكل نوع من الحركات عند ترحيل الفواتير والسندات والمستخلصات."))


def year_close(request):
    form = YearCloseForm(request.POST or None, initial={"date_from": dt.date(today().year - 1, 1, 1),
                                                        "date_to": dt.date(today().year - 1, 12, 31)})
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        try:
            with transaction.atomic():
                re = AccountMapping.get("retained_earnings")
                lines, net = [], ZERO
                for r in (JournalLine.objects.filter(entry__state="posted", entry__date__gte=cd["date_from"],
                                                     entry__date__lte=cd["date_to"],
                                                     account__type__in=("income", "expense"))
                          .values("account_id").annotate(d=Sum("debit"), c=Sum("credit"))):
                    bal = (r["d"] or ZERO) - (r["c"] or ZERO)
                    if bal:
                        acc = Account.objects.get(pk=r["account_id"])
                        lines.append(dict(account=acc, debit=max(-bal, ZERO), credit=max(bal, ZERO),
                                          label="إقفال الحساب"))
                        net += bal
                lines.append(dict(account=re, debit=max(net, ZERO), credit=max(-net, ZERO),
                                  label="صافي نتيجة الفترة"))
                e = create_entry(cd["date_to"], f"قيد إقفال الحسابات الختامية {cd['date_from']} - {cd['date_to']}",
                                 lines, source="closing", user=request.user)
                if cd["lock"]:
                    c = Company.get()
                    c.lock_date = cd["date_to"]
                    c.save()
            messages.success(request, f"تم إنشاء قيد الإقفال {e.number}")
            return redirect(e.get_absolute_url())
        except ValidationError as ex:
            form.add_error(None, ex)
    return render(request, "generic/form.html", dict(
        title="إقفال السنة المالية", form=form, formsets=[], icon="bi-lock",
        help="ينشئ قيداً يُقفل أرصدة الإيرادات والمصروفات للفترة في حساب الأرباح المرحلة، ثم يقفل الفترة ضد التعديل."))


def backup(request):
    from io import StringIO
    out = StringIO()
    management.call_command("dumpdata", "--natural-foreign", "--indent", "1", "--exclude", "contenttypes",
                            "--exclude", "auth.permission", "--exclude", "sessions", "--exclude", "admin.logentry",
                            stdout=out)
    resp = HttpResponse(out.getvalue(), content_type="application/json; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="erp-backup-{dt.datetime.now():%Y%m%d-%H%M}.json"'
    return resp
