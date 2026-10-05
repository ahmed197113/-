import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST

from accounting import smart
from accounting.models import Partner, Tax, ZERO
from accounting.ui import Col, delete_object, parse_date, render_list, run_action, save_form, today

from .forms import (InvoiceForm, InvoiceLineFormSet, PaymentForm, ProductForm, StockDocumentForm, StockLineFormSet,
                    TransferForm, WarehouseForm)
from .models import Invoice, Payment, Product, StockDocument, StockMove, Transfer, Warehouse

INVOICE_TITLES = dict(Invoice.KINDS)
INVOICE_TITLES_PLURAL = {"sale": "فواتير المبيعات", "purchase": "فواتير المشتريات", "sale_return": "مردودات المبيعات",
                         "purchase_return": "مردودات المشتريات"}


# ---------------------------------------------------------------------------- الفواتير
def invoice_list(request):
    kind = request.GET.get("kind", "sale")
    qs = Invoice.objects.filter(kind=kind).select_related("partner", "project")
    other = {"sale_return": ("purchase_return", "مردودات المشتريات"),
             "purchase_return": ("sale_return", "مردودات المبيعات")}.get(kind)
    return render_list(
        request, INVOICE_TITLES_PLURAL[kind], qs,
        [Col("الرقم", "number"), Col("التاريخ", "date", "date"), Col("الطرف", "partner"),
         Col("المرجع", "reference"), Col("المشروع", lambda o: o.project.name if o.project else ""),
         Col("قبل الضريبة", "subtotal", "money"), Col("ض.ق.م", "vat_total", "money"),
         Col("الإجمالي", "total", "money"), Col("المتبقي", "residual", "money"),
         Col("السداد", "payment_status"), Col("الحالة", "state", "state")],
        row_url=lambda o: f"/invoices/{o.pk}/", new_url=f"/invoices/new/?kind={kind}",
        search=("number", "reference", "partner__name", "notes"),
        filters=[("state", "الحالة", Invoice.STATES, lambda qs, v: qs.filter(state=v))],
        buttons=[(f"/invoices/?kind={other[0]}", other[1], "bi-arrow-left-right", "light")] if other else [],
        totals=("قبل الضريبة", "ض.ق.م", "الإجمالي", "المتبقي"), icon="bi-receipt")


def invoice_form(request, pk=None):
    obj = get_object_or_404(Invoice, pk=pk) if pk else None
    kind = obj.kind if obj else request.GET.get("kind", "sale")
    initial = {"kind": kind, "date": today(), "warehouse": Warehouse.objects.first(),
               "partner": request.GET.get("partner"), "project": request.GET.get("project")}
    if request.GET.get("origin"):
        initial["origin"] = request.GET["origin"]
    return save_form(request, InvoiceForm, obj, INVOICE_TITLES[kind], initial=initial,
                     formsets=[(InvoiceLineFormSet, "lines", "الأصناف / البنود")],
                     after_save=lambda o: (o.compute_totals(), smart.invalidate_cache()),
                     template="commerce/invoice_form.html", icon="bi-receipt",
                     extra=dict(kind=kind, side="sale" if kind.startswith("sale") else "purchase",
                                tax_rates={str(t.id): float(t.rate) for t in Tax.objects.all()}))


def invoice_detail(request, pk):
    inv = get_object_or_404(Invoice.objects.select_related("partner", "project", "warehouse", "wht"), pk=pk)
    return render(request, "commerce/invoice_detail.html", dict(
        title=str(inv), inv=inv, lines=inv.lines.select_related("product", "account", "vat", "project"),
        payments=inv.payments.all(), returns=inv.returns.all()))


@require_POST
def invoice_action(request, pk, action):
    inv = get_object_or_404(Invoice, pk=pk)
    resp = run_action(request, inv, action, success_url=f"/invoices/?kind={inv.kind}")
    smart.invalidate_cache()
    return resp


# ---------------------------------------------------------------------------- السندات
def payment_list(request):
    kind = request.GET.get("kind", "receipt")
    return render_list(
        request, "سندات القبض" if kind == "receipt" else "سندات الصرف",
        Payment.objects.filter(kind=kind).select_related("partner", "treasury", "counter_account"),
        [Col("الرقم", "number"), Col("التاريخ", "date", "date"), Col("النوع", lambda o: o.get_purpose_display()),
         Col("الجهة / الحساب", lambda o: o.partner or o.counter_account), Col("الخزينة / البنك", "treasury.name"),
         Col("طريقة السداد", lambda o: o.get_method_display()), Col("البيان", "memo"),
         Col("المبلغ", "amount", "money"), Col("الحالة", "state", "state")],
        row_url=lambda o: f"/payments/{o.pk}/", new_url=f"/payments/new/?kind={kind}",
        search=("number", "memo", "partner__name", "cheque_no"),
        filters=[("purpose", "النوع", Payment.PURPOSES, lambda qs, v: qs.filter(purpose=v)),
                 ("state", "الحالة", Payment.STATES, lambda qs, v: qs.filter(state=v))],
        totals=("المبلغ",), icon="bi-cash-stack")


def payment_form(request, pk=None):
    obj = get_object_or_404(Payment, pk=pk) if pk else None
    kind = obj.kind if obj else request.GET.get("kind", "receipt")
    from accounting.models import Account
    initial = {"kind": kind, "date": today(), "purpose": request.GET.get("purpose", "partner"),
               "treasury": Account.objects.filter(kind="cash", is_group=False).first()}
    for key in ("partner", "invoice", "contract", "certificate"):
        if request.GET.get(key):
            initial[key] = request.GET[key]
    if request.GET.get("invoice"):
        inv = get_object_or_404(Invoice, pk=request.GET["invoice"])
        initial.update(partner=inv.partner_id, amount=inv.residual, memo=f"سداد {inv}", project=inv.project_id)
    if request.GET.get("certificate"):
        from contracting.models import Certificate
        cert = get_object_or_404(Certificate, pk=request.GET["certificate"])
        initial.update(partner=cert.contract.partner_id, amount=cert.residual, contract=cert.contract_id,
                       memo=f"{'تحصيل' if kind == 'receipt' else 'سداد'} {cert}", project=cert.contract.project_id)
    if request.GET.get("contract") and not request.GET.get("certificate"):
        from contracting.models import Contract
        c = get_object_or_404(Contract, pk=request.GET["contract"])
        initial.update(partner=c.partner_id, project=c.project_id)
        if initial["purpose"] == "advance":
            initial.update(amount=max(c.advance_amount - c.advance_paid, ZERO),
                           memo=f"دفعة مقدمة عقد {c.number}")

    def after(o):
        smart.invalidate_cache()
        if request.POST.get("post_now"):
            o.post(user=request.user)

    return save_form(request, PaymentForm, obj, "سند قبض" if kind == "receipt" else "سند صرف", initial=initial,
                     after_save=after, template="commerce/payment_form.html", icon="bi-cash-stack",
                     extra=dict(kind=kind))


def payment_detail(request, pk):
    p = get_object_or_404(Payment.objects.select_related("partner", "treasury", "counter_account", "invoice",
                                                         "certificate", "contract"), pk=pk)
    return render(request, "commerce/payment_detail.html", dict(title=str(p), p=p))


@require_POST
def payment_action(request, pk, action):
    p = get_object_or_404(Payment, pk=pk)
    return run_action(request, p, action, success_url=f"/payments/?kind={p.kind}")


# ---------------------------------------------------------------------------- التحويلات
def transfer_list(request):
    return render_list(
        request, "التحويلات بين الخزائن والبنوك", Transfer.objects.select_related("from_account", "to_account"),
        [Col("الرقم", "number"), Col("التاريخ", "date", "date"), Col("من", "from_account.name"),
         Col("إلى", "to_account.name"), Col("البيان", "memo"), Col("المبلغ", "amount", "money"),
         Col("الحالة", "state", "state")],
        row_url=lambda o: f"/transfers/{o.pk}/", new_url="/transfers/new/", icon="bi-arrow-left-right",
        totals=("المبلغ",))


def transfer_form(request, pk=None):
    obj = get_object_or_404(Transfer, pk=pk) if pk else None
    if obj and not obj.is_draft:
        return render(request, "commerce/transfer_detail.html", dict(title=str(obj), t=obj))

    def after(o):
        if request.POST.get("post_now"):
            o.post(user=request.user)

    return save_form(request, TransferForm, obj, "تحويل نقدية", initial={"date": today()}, after_save=after,
                     success=lambda o: "/transfers/", template="commerce/transfer_form.html", icon="bi-arrow-left-right",
                     extra=dict(t=obj))


@require_POST
def transfer_action(request, pk, action):
    t = get_object_or_404(Transfer, pk=pk)
    return run_action(request, t, action, success_url="/transfers/")


# ---------------------------------------------------------------------------- المخزون
def product_list(request):
    return render_list(
        request, "الأصناف والخدمات", Product.objects.all(),
        [Col("الكود", "code"), Col("الاسم", "name"), Col("النوع", lambda o: o.get_type_display()),
         Col("الوحدة", "unit"), Col("سعر البيع", "sale_price", "money"), Col("سعر الشراء", "purchase_price", "money"),
         Col("الرصيد", lambda o: o.qty_on_hand() if o.is_stock else None, "qty"),
         Col("متوسط التكلفة", "avg_cost", "money")],
        row_url=lambda o: f"/products/{o.pk}/", new_url="/products/new/", search=("code", "name", "barcode"),
        filters=[("type", "النوع", Product.TYPES, lambda qs, v: qs.filter(type=v))], icon="bi-box-seam")


def product_form(request, pk=None):
    obj = get_object_or_404(Product, pk=pk) if pk else None
    return save_form(request, ProductForm, obj, "بيانات الصنف",
                     initial={"code": f"I{Product.objects.count() + 1:04d}"}, success=lambda o: f"/products/{o.pk}/card/",
                     icon="bi-box-seam")


def product_card(request, pk):
    p = get_object_or_404(Product, pk=pk)
    wh = request.GET.get("warehouse")
    moves = p.moves.select_related("warehouse", "project").order_by("date", "id")
    if wh:
        moves = moves.filter(warehouse_id=wh)
    rows, bal = [], ZERO
    for m in moves:
        bal += m.qty
        rows.append(dict(m=m, balance=bal))
    return render(request, "commerce/product_card.html", dict(
        title=f"كارت صنف: {p.name}", p=p, rows=rows, warehouses=Warehouse.objects.all(), wh=wh,
        by_wh=[dict(w=w, qty=p.qty_on_hand(w)) for w in Warehouse.objects.all()]))


def warehouse_list(request):
    return render_list(request, "المخازن", Warehouse.objects.select_related("project"),
                       [Col("الكود", "code"), Col("الاسم", "name"), Col("مخزن موقع لمشروع", "project"),
                        Col("نشط", "active", "bool")],
                       row_url=lambda o: f"/warehouses/{o.pk}/", new_url="/warehouses/new/", icon="bi-house-door")


def warehouse_form(request, pk=None):
    obj = get_object_or_404(Warehouse, pk=pk) if pk else None
    return save_form(request, WarehouseForm, obj, "مخزن", success=lambda o: "/warehouses/")


def stock_balance(request):
    as_of = parse_date(request.GET.get("date_to"), today())
    wh = request.GET.get("warehouse")
    rows = []
    for p in Product.objects.filter(type="stock"):
        qs = StockMove.objects.filter(product=p, date__lte=as_of)
        if wh:
            qs = qs.filter(warehouse_id=wh)
        qty = sum((m.qty for m in qs), ZERO)
        if qty or request.GET.get("zero"):
            rows.append(dict(p=p, qty=qty, value=(qty * p.avg_cost).quantize(Decimal("0.01")),
                             low=p.min_qty and qty < p.min_qty))
    return render(request, "commerce/stock_balance.html", dict(
        title="أرصدة المخزون وتقييمه", rows=rows, date_to=as_of, warehouses=Warehouse.objects.all(), wh=wh,
        total=sum((r["value"] for r in rows), ZERO)))


def stockdoc_list(request):
    return render_list(
        request, "الأذونات المخزنية", StockDocument.objects.select_related("warehouse", "project"),
        [Col("الرقم", "number"), Col("النوع", lambda o: o.get_kind_display()), Col("التاريخ", "date", "date"),
         Col("المخزن", "warehouse"), Col("المشروع", "project"), Col("البيان", "notes"), Col("الحالة", "state", "state")],
        row_url=lambda o: f"/stock/docs/{o.pk}/", new_url="/stock/docs/new/", icon="bi-clipboard-check",
        filters=[("kind", "النوع", StockDocument.KINDS, lambda qs, v: qs.filter(kind=v))])


def stockdoc_form(request, pk=None):
    obj = get_object_or_404(StockDocument, pk=pk) if pk else None
    initial = {"date": today(), "kind": request.GET.get("kind", "issue"), "project": request.GET.get("project"),
               "warehouse": Warehouse.objects.first()}
    return save_form(request, StockDocumentForm, obj, "إذن مخزني", initial=initial,
                     formsets=[(StockLineFormSet, "lines", "الأصناف")], icon="bi-clipboard-check")


def stockdoc_detail(request, pk):
    d = get_object_or_404(StockDocument, pk=pk)
    lines = [dict(ln=ln, cost=d.line_cost(ln), value=(ln.qty * d.line_cost(ln)).quantize(Decimal("0.01")))
             for ln in d.lines.select_related("product")]
    return render(request, "commerce/stockdoc_detail.html", dict(title=str(d), d=d, lines=lines))


@require_POST
def stockdoc_action(request, pk, action):
    d = get_object_or_404(StockDocument, pk=pk)
    return run_action(request, d, action, success_url="/stock/docs/")


def generic_delete(request, model, pk, back):
    return delete_object(request, get_object_or_404(model, pk=pk), back)


# ---------------------------------------------------------------------------- واجهات البيانات (API) والمساعد الذكي
def api_product(request, pk):
    p = get_object_or_404(Product, pk=pk)
    return JsonResponse(dict(name=p.name, unit=p.unit, sale_price=str(p.sale_price),
                             purchase_price=str(p.purchase_price), sale_tax=p.sale_tax_id,
                             purchase_tax=p.purchase_tax_id, is_stock=p.is_stock, qty=str(p.qty_on_hand()),
                             avg_cost=str(p.avg_cost)))


def api_partner_docs(request, pk):
    """المستندات المفتوحة لجهة التعامل (لاختيارها في سندات القبض والصرف)."""
    partner = get_object_or_404(Partner, pk=pk)
    kind = request.GET.get("kind", "receipt")
    inv_kind = "sale" if kind == "receipt" else "purchase"
    from contracting.models import Certificate
    ckind = "client" if kind == "receipt" else "sub"
    invoices = [dict(id=i.id, label=f"{i.number} - {i.date:%Y/%m/%d}", residual=str(i.residual))
                for i in Invoice.objects.filter(partner=partner, state="posted", kind=inv_kind) if i.residual > 0]
    certs = [dict(id=c.id, contract=c.contract_id, label=str(c), residual=str(c.residual))
             for c in Certificate.objects.filter(contract__partner=partner, state="posted", contract__kind=ckind)
             if c.residual > 0]
    return JsonResponse(dict(balance=str(partner.balance()), invoices=invoices, certificates=certs))


def _partner_or_none(pid):
    try:
        return Partner.objects.filter(pk=int(pid)).first() if pid else None
    except (TypeError, ValueError):
        return None


def api_suggest_line(request):
    text = request.GET.get("text", "")
    side = request.GET.get("side", "purchase")
    partner = _partner_or_none(request.GET.get("partner"))
    product = Product.objects.filter(pk=request.GET.get("product") or 0).first()
    return JsonResponse(dict(accounts=smart.suggest_line(text, partner, side),
                             project=smart.suggest_project(text, partner, side),
                             taxes=smart.suggest_taxes(partner, side, product)))


@require_POST
def api_review_invoice(request):
    try:
        data = json.loads(request.body or "{}")
    except ValueError:
        data = {}
    try:
        total = Decimal(str(data.get("total") or 0))
    except InvalidOperation:
        total = ZERO
    notes = smart.review_invoice(
        data.get("kind", "purchase"), partner=_partner_or_none(data.get("partner")),
        date=parse_date(data.get("date")), reference=data.get("reference", ""), total=total,
        lines=data.get("lines", []), invoice_id=data.get("id"), project_id=data.get("project"))
    return JsonResponse(dict(notes=notes))
