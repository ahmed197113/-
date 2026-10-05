import json

from django.contrib import messages
from django.db.models import Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounting.models import JournalLine, ZERO
from accounting.ui import Col, render_list, run_action, save_form, today

from .forms import (BOQFormSet, CertificateForm, CertLineFormSet, ContractForm, DeductionFormSet,
                    NewCertificateForm, ProjectForm, RetentionReleaseForm)
from .models import Certificate, Contract, Project, RetentionRelease

KIND_TITLES = {"client": "عقود العملاء", "sub": "عقود مقاولي الباطن"}
CERT_TITLES = {"client": "مستخلصات العملاء (الجارية والختامية)", "sub": "مستخلصات مقاولي الباطن"}


# ---------------------------------------------------------------------------- المشروعات
def project_list(request):
    return render_list(
        request, "المشروعات", Project.objects.select_related("customer"),
        [Col("الكود", "code"), Col("اسم المشروع", "name"), Col("العميل", "customer"),
         Col("الحالة", lambda o: o.get_status_display()), Col("قيمة التعاقد", "contract_value", "money"),
         Col("الإيرادات", lambda o: o.revenue(), "money"), Col("التكاليف", lambda o: o.cost(), "money"),
         Col("الربح", lambda o: o.profit(), "money")],
        row_url=lambda o: f"/projects/{o.pk}/", new_url="/projects/new/", search=("code", "name", "location"),
        filters=[("status", "الحالة", Project.STATUS, lambda qs, v: qs.filter(status=v))],
        totals=("قيمة التعاقد", "الإيرادات", "التكاليف", "الربح"), icon="bi-building-gear")


def project_form(request, pk=None):
    obj = get_object_or_404(Project, pk=pk) if pk else None
    nxt = f"P{Project.objects.count() + 1:03d}"
    return save_form(request, ProjectForm, obj, "بيانات المشروع", initial={"code": nxt, "start_date": today()},
                     icon="bi-building-gear")


def project_detail(request, pk):
    p = get_object_or_404(Project, pk=pk)
    lines = JournalLine.objects.filter(entry__state="posted", project=p)
    by_account = (lines.filter(account__type__in=("income", "expense"))
                  .values("account__code", "account__name", "account__type")
                  .annotate(d=Sum("debit"), c=Sum("credit")).order_by("account__code"))
    breakdown = []
    for r in by_account:
        amt = (r["c"] or ZERO) - (r["d"] or ZERO) if r["account__type"] == "income" else (r["d"] or ZERO) - (r["c"] or ZERO)
        breakdown.append(dict(code=r["account__code"], name=r["account__name"], type=r["account__type"], amount=amt))
    revenue, cost = p.revenue(), p.cost()
    contracts = p.contracts.select_related("partner")
    client_value = sum((c.boq_total for c in contracts if c.is_client), ZERO)
    sub_value = sum((c.boq_total for c in contracts if not c.is_client), ZERO)
    certified = sum((c.certified_gross for c in contracts if c.is_client), ZERO)
    ctx = dict(title=p.name, p=p, revenue=revenue, cost=cost, profit=revenue - cost,
               margin=((revenue - cost) / revenue * 100) if revenue else ZERO, breakdown=breakdown,
               contracts=contracts, client_value=client_value, sub_value=sub_value, certified=certified,
               progress=(certified / client_value * 100) if client_value else ZERO,
               budget_used=(cost / p.budget * 100) if p.budget else None,
               recent=lines.select_related("entry", "account", "partner").order_by("-entry__date", "-id")[:25],
               chart=json.dumps(dict(labels=[b["name"] for b in breakdown if b["type"] == "expense"],
                                     values=[float(b["amount"]) for b in breakdown if b["type"] == "expense"])))
    return render(request, "contracting/project_detail.html", ctx)


# ---------------------------------------------------------------------------- العقود
def contract_list(request):
    kind = request.GET.get("kind", "client")
    return render_list(
        request, KIND_TITLES.get(kind, "العقود"), Contract.objects.filter(kind=kind).select_related("partner", "project"),
        [Col("رقم العقد", "number"), Col("التاريخ", "date", "date"), Col("الموضوع", "title"),
         Col("العميل" if kind == "client" else "مقاول الباطن", "partner"), Col("المشروع", "project.name"),
         Col("قيمة المقايسة", "boq_total", "money"), Col("المنفذ حتى تاريخه", "certified_gross", "money"),
         Col("نسبة الإنجاز", lambda o: f"{o.progress_pct:,.1f}%"), Col("الرصيد المستحق", "balance_due", "money"),
         Col("الحالة", lambda o: o.get_status_display())],
        row_url=lambda o: f"/contracts/{o.pk}/", new_url=f"/contracts/new/?kind={kind}",
        search=("number", "title", "partner__name", "project__name"),
        filters=[("project", "المشروع", [(p.id, p.name) for p in Project.objects.all()],
                  lambda qs, v: qs.filter(project_id=v))],
        totals=("قيمة المقايسة", "المنفذ حتى تاريخه", "الرصيد المستحق"), icon="bi-file-earmark-text")


def contract_form(request, pk=None):
    obj = get_object_or_404(Contract, pk=pk) if pk else None
    kind = obj.kind if obj else request.GET.get("kind", "client")
    initial = {"kind": kind, "date": today(), "project": request.GET.get("project")}
    title = ("عقد عميل ومقايسة الأعمال (BOQ)" if kind == "client" else "عقد مقاول باطن ومقايسة الأعمال")
    return save_form(request, ContractForm, obj, title, initial=initial,
                     formsets=[(BOQFormSet, "items", "بنود المقايسة (الكميات والفئات)")],
                     template="contracting/contract_form.html", icon="bi-file-earmark-text")


def contract_detail(request, pk):
    c = get_object_or_404(Contract.objects.select_related("partner", "project"), pk=pk)
    items = []
    for it in c.items.all():
        qty, amount = it.certified()
        items.append(dict(it=it, qty=qty, amount=amount, pct=(qty / it.quantity * 100) if it.quantity else ZERO))
    certs = c.certificates.all().order_by("seq")
    return render(request, "contracting/contract_detail.html", dict(
        title=f"عقد {c.number}", c=c, items=items, certs=certs,
        payments=c.payments.select_related("treasury").order_by("date"),
        releases=c.retention_releases.all()))


# ---------------------------------------------------------------------------- المستخلصات
def certificate_list(request):
    kind = request.GET.get("kind", "client")
    qs = Certificate.objects.filter(contract__kind=kind).select_related("contract__partner", "contract__project")
    return render_list(
        request, CERT_TITLES.get(kind), qs,
        [Col("الرقم", "number"), Col("م", "seq"), Col("التاريخ", "date", "date"),
         Col("العقد", "contract.number"), Col("الطرف", "contract.partner"), Col("المشروع", "contract.project.name"),
         Col("ختامي", "is_final", "bool"), Col("الأعمال الحالية", "gross", "money"),
         Col("الاستقطاعات", "total_deductions", "money"), Col("ض.ق.م", "vat_amount", "money"),
         Col("الصافي", "net_amount", "money"), Col("المتبقي", "residual", "money"), Col("الحالة", "state", "state")],
        row_url=lambda o: f"/certificates/{o.pk}/", new_url=f"/certificates/new/?kind={kind}",
        search=("number", "contract__number", "contract__partner__name", "contract__project__name"),
        filters=[("state", "الحالة", Certificate.STATES, lambda qs, v: qs.filter(state=v)),
                 ("project", "المشروع", [(p.id, p.name) for p in Project.objects.all()],
                  lambda qs, v: qs.filter(contract__project_id=v))],
        totals=("الأعمال الحالية", "الاستقطاعات", "ض.ق.م", "الصافي", "المتبقي"), icon="bi-receipt-cutoff")


def certificate_new(request):
    kind = request.GET.get("kind", "client")
    initial = {"date": today(), "contract": request.GET.get("contract")}
    form = NewCertificateForm(request.POST or None, kind=kind, initial=initial)
    if request.method == "POST" and form.is_valid():
        c = form.cleaned_data["contract"]
        if not c.items.exists():
            messages.error(request, "العقد لا يحتوي على بنود مقايسة. أضف البنود أولاً")
            return redirect(c.get_absolute_url())
        last = c.certificates.order_by("-seq").first()
        cert = Certificate.objects.create(contract=c, date=form.cleaned_data["date"], created_by=request.user,
                                          period_from=(last.period_to if last else c.start_date),
                                          period_to=form.cleaned_data["date"])
        cert.sync_lines()
        cert.compute()
        messages.info(request, f"تم إنشاء {cert}. أدخل الكميات المنفذة الحالية أو التراكمية لكل بند")
        return redirect(f"/certificates/{cert.pk}/edit/")
    return render(request, "generic/form.html", dict(
        title="مستخلص جديد - " + ("عميل" if kind == "client" else "مقاول باطن"), form=form, formsets=[],
        icon="bi-receipt-cutoff",
        help="اختر العقد، وسيقوم البرنامج تلقائياً بإحضار كل بنود المقايسة والكميات السابقة من المستخلصات المعتمدة."))


def certificate_edit(request, pk):
    cert = get_object_or_404(Certificate.objects.select_related("contract__project", "contract__partner",
                                                               "contract__vat", "contract__wht"), pk=pk)
    if not cert.is_draft:
        messages.warning(request, "المستخلص معتمد. ألغِ الاعتماد أولاً للتعديل")
        return redirect(cert.get_absolute_url())
    cert.sync_lines()
    c = cert.contract
    if request.method == "POST":
        form = CertificateForm(request.POST, instance=cert)
        lines = CertLineFormSet(request.POST, instance=cert, prefix="lines")
        deds = DeductionFormSet(request.POST, instance=cert, prefix="deds")
        if form.is_valid() and lines.is_valid() and deds.is_valid():
            form.save()
            lines.save()
            deds.save()
            cert.refresh_from_db()
            cert.compute()
            messages.success(request, "تم حفظ المستخلص")
            if request.POST.get("then") == "post":
                return run_action(request, cert, "post")
            return redirect(cert.get_absolute_url())
    else:
        form = CertificateForm(instance=cert)
        lines = CertLineFormSet(instance=cert, prefix="lines",
                                queryset=cert.lines.select_related("item").order_by("item_id"))
        deds = DeductionFormSet(instance=cert, prefix="deds")
    remaining_adv = c.advance_paid - c.advance_recovered(before_seq=cert.seq)
    params = dict(retention=float(c.retention_pct), wht=float(c.wht.rate if c.wht_id else 0),
                  social=float(c.social_ins_pct), vat=float(c.vat.rate if c.vat_id else 0),
                  adv_pct=float(c.advance_recovery_pct), adv_remaining=float(remaining_adv),
                  vat_on_net=c.vat_on_net)
    return render(request, "contracting/certificate_form.html", dict(
        title=f"تحرير {cert}", cert=cert, c=c, form=form, lines=lines, params=json.dumps(params),
        deds_f=dict(fs=deds, prefix="deds", title="استقطاعات أخرى (غرامات تأخير، مواد مخصومة، مياه وكهرباء...)"),
        remaining_adv=remaining_adv))


def certificate_detail(request, pk):
    cert = get_object_or_404(Certificate.objects.select_related("contract__project", "contract__partner"), pk=pk)
    cert.sync_lines()
    lines = cert.lines.select_related("item").order_by("item_id")
    show_all = request.GET.get("all") == "1"
    if not show_all:
        lines = [ln for ln in lines if ln.cumulative_qty or ln.current_qty]
    return render(request, "contracting/certificate_detail.html", dict(
        title=str(cert), cert=cert, c=cert.contract, lines=lines, show_all=show_all,
        deductions=cert.deductions.select_related("account"), payments=cert.payments.all()))


@require_POST
def certificate_action(request, pk, action):
    cert = get_object_or_404(Certificate, pk=pk)
    kind = cert.contract.kind
    return run_action(request, cert, action, success_url=f"/certificates/?kind={kind}")


# ---------------------------------------------------------------------------- رد المحتجزات
def retention_new(request, contract_pk):
    c = get_object_or_404(Contract, pk=contract_pk)
    obj = RetentionRelease(contract=c)

    def after(o):
        if request.POST.get("post_now"):
            o.post(user=request.user)

    return save_form(request, RetentionReleaseForm, obj, f"رد محتجزات ضمان الأعمال - عقد {c.number}",
                     initial={"date": today(), "amount": c.retention_held, "notes": f"رد محتجزات عقد {c.number}"},
                     after_save=after, success=lambda o: c.get_absolute_url(), icon="bi-unlock",
                     extra=dict(help=f"رصيد المحتجزات الحالي لهذا العقد: {c.retention_held:,.2f}. "
                                     "عند الترحيل يتحول المبلغ من حساب المحتجزات إلى حساب الطرف ليصبح مستحق السداد/التحصيل."),
                     template="contracting/retention_form.html")


@require_POST
def retention_action(request, pk, action):
    r = get_object_or_404(RetentionRelease, pk=pk)
    return run_action(request, r, action, success_url=r.contract.get_absolute_url())


# ---------------------------------------------------------------------------- تقارير المقاولات
def reports_index(request):
    return render(request, "contracting/reports_index.html", dict(title="تقارير المقاولات"))


def projects_report(request):
    rows = []
    for p in Project.objects.select_related("customer"):
        rev, cost = p.revenue(), p.cost()
        cv = p.contract_value
        certified = sum((c.certified_gross for c in p.contracts.filter(kind="client")), ZERO)
        sub_cost = sum((c.certified_gross for c in p.contracts.filter(kind="sub")), ZERO)
        rows.append(dict(p=p, value=cv, certified=certified, progress=(certified / cv * 100) if cv else ZERO,
                         revenue=rev, cost=cost, sub_cost=sub_cost, profit=rev - cost,
                         margin=((rev - cost) / rev * 100) if rev else ZERO, budget=p.budget))
    totals = {k: sum((r[k] for r in rows), ZERO) for k in ("value", "certified", "revenue", "cost", "profit", "sub_cost")}
    return render(request, "contracting/projects_report.html", dict(title="تقرير ربحية المشروعات", rows=rows,
                                                                    totals=totals))


def retention_report(request):
    rows = []
    for c in Contract.objects.select_related("partner", "project").order_by("kind", "project__code"):
        held = c.retention_held
        retained = c._cert_sum("retention_amount")
        if retained or held:
            rows.append(dict(c=c, retained=retained, released=c.released_total, held=held))
    client = [r for r in rows if r["c"].is_client]
    sub = [r for r in rows if not r["c"].is_client]
    return render(request, "contracting/retention_report.html", dict(
        title="تقرير المحتجزات (ضمان الأعمال)", client=client, sub=sub,
        client_total=sum((r["held"] for r in client), ZERO), sub_total=sum((r["held"] for r in sub), ZERO)))


def advances_report(request):
    rows = []
    for c in Contract.objects.select_related("partner", "project"):
        paid = c.advance_paid
        if paid or c.advance_amount:
            rows.append(dict(c=c, agreed=c.advance_amount, paid=paid, recovered=c.advance_recovered(),
                             remaining=c.advance_remaining))
    return render(request, "contracting/advances_report.html", dict(title="تقرير الدفعات المقدمة واستردادها",
                                                                    rows=rows))
