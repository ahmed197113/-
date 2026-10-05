"""التقارير المالية: ميزان المراجعة، الأستاذ، كشوف الحساب، قائمة الدخل، المركز المالي، الضرائب، الأعمار."""
import datetime as dt
from collections import defaultdict
from django.db.models import Sum
from django.shortcuts import get_object_or_404, render

from .models import Account, AccountMapping, CostCenter, JournalLine, Partner, Tax, ZERO
from .ui import parse_date, period_from_request, today


def _lines(date_from=None, date_to=None, **filters):
    qs = JournalLine.objects.filter(entry__state="posted", **filters)
    if date_from:
        qs = qs.filter(entry__date__gte=date_from)
    if date_to:
        qs = qs.filter(entry__date__lte=date_to)
    return qs


def sums_by_account(date_from=None, date_to=None, **filters):
    out = {}
    for r in _lines(date_from, date_to, **filters).values("account_id").annotate(d=Sum("debit"), c=Sum("credit")):
        out[r["account_id"]] = (r["d"] or ZERO, r["c"] or ZERO)
    return out


def _common_filters(request):
    f = {}
    if request.GET.get("project"):
        f["project_id"] = request.GET["project"]
    if request.GET.get("cost_center"):
        f["cost_center_id"] = request.GET["cost_center"]
    return f


def _filter_ctx():
    from contracting.models import Project
    return dict(projects=Project.objects.all(), cost_centers=CostCenter.objects.all())


def build_tree(accounts, values, show_zero=False, max_level=None):
    """
    values: dict account_id -> tuple of numbers. يجمع القيم صعوداً للحسابات الرئيسية
    ويرجع صفوفاً مرتبة بالكود مع المستوى.
    """
    width = len(next(iter(values.values()))) if values else 1
    agg = defaultdict(lambda: [ZERO] * width)
    by_id = {a.id: a for a in accounts}
    for aid, vals in values.items():
        a = by_id.get(aid)
        while a is not None:
            row = agg[a.id]
            for i, v in enumerate(vals):
                row[i] += v
            a = by_id.get(a.parent_id)
    level_cache = {}

    def level(a):
        if a.id not in level_cache:
            level_cache[a.id] = 0 if a.parent_id is None or a.parent_id not in by_id else level(by_id[a.parent_id]) + 1
        return level_cache[a.id]

    rows = []
    for a in sorted(accounts, key=lambda x: x.code):
        vals = agg.get(a.id, [ZERO] * width)
        lv = level(a)
        if max_level is not None and lv > max_level:
            continue
        if not show_zero and not any(vals):
            continue
        rows.append(dict(account=a, level=lv, vals=vals, is_group=a.is_group))
    return rows


# ---------------------------------------------------------------------------- ميزان المراجعة
def trial_balance(request):
    date_from, date_to = period_from_request(request)
    show_zero = request.GET.get("zero") == "1"
    level = request.GET.get("level")
    max_level = int(level) if level not in (None, "", "all") else None
    filters = _common_filters(request)
    opening = sums_by_account(None, date_from - dt.timedelta(days=1), **filters)
    period = sums_by_account(date_from, date_to, **filters)
    accounts = list(Account.objects.all())
    values = {}
    for aid in set(opening) | set(period):
        od, oc = opening.get(aid, (ZERO, ZERO))
        pd, pc = period.get(aid, (ZERO, ZERO))
        ob = od - oc
        cb = ob + pd - pc
        values[aid] = (max(ob, ZERO), max(-ob, ZERO), pd, pc, max(cb, ZERO), max(-cb, ZERO))
    rows = build_tree(accounts, values, show_zero, max_level)
    # إعادة احتساب الأرصدة بالصافي لكل صف (رصيد مدين أو دائن فقط)
    for r in rows:
        ob = r["vals"][0] - r["vals"][1]
        cb = r["vals"][4] - r["vals"][5]
        r["vals"] = [max(ob, ZERO), max(-ob, ZERO), r["vals"][2], r["vals"][3], max(cb, ZERO), max(-cb, ZERO)]
    totals = [ZERO] * 6
    for vals in values.values():
        ob = vals[0] - vals[1]
        cb = vals[4] - vals[5]
        t = [max(ob, ZERO), max(-ob, ZERO), vals[2], vals[3], max(cb, ZERO), max(-cb, ZERO)]
        totals = [x + y for x, y in zip(totals, t)]
    ctx = dict(title="ميزان المراجعة", rows=rows, totals=totals, date_from=date_from, date_to=date_to,
               show_zero=show_zero, level=level or "all", balanced=totals[4] == totals[5], **_filter_ctx())
    return render(request, "reports/trial_balance.html", ctx)


# ---------------------------------------------------------------------------- دفتر الأستاذ / كشف حساب
def ledger_rows(qs, opening):
    rows, bal = [], opening
    for ln in qs.select_related("entry", "partner", "project", "account").order_by("entry__date", "entry_id", "id"):
        bal += ln.debit - ln.credit
        rows.append(dict(line=ln, balance=bal))
    return rows, bal


def account_ledger(request):
    date_from, date_to = period_from_request(request)
    accounts = Account.objects.all()
    account = None
    ctx = dict(title="دفتر الأستاذ / كشف حساب", accounts=accounts, date_from=date_from, date_to=date_to,
               partners=Partner.objects.all(), **_filter_ctx())
    if request.GET.get("account"):
        account = get_object_or_404(Account, pk=request.GET["account"])
        f = {"account_id__in": account.descendants_ids(), **_common_filters(request)}
        if request.GET.get("partner"):
            f["partner_id"] = request.GET["partner"]
        before = _lines(None, date_from - dt.timedelta(days=1), **f).aggregate(d=Sum("debit"), c=Sum("credit"))
        opening = (before["d"] or ZERO) - (before["c"] or ZERO)
        qs = _lines(date_from, date_to, **f)
        rows, closing = ledger_rows(qs, opening)
        agg = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        ctx.update(account=account, rows=rows, opening=opening, closing=closing, total_debit=agg["d"] or ZERO,
                   total_credit=agg["c"] or ZERO)
    return render(request, "reports/ledger.html", ctx)


def partner_statement(request, pk=None):
    date_from, date_to = period_from_request(request)
    pk = pk or request.GET.get("partner")
    ctx = dict(title="كشف حساب عميل / مورد", partners=Partner.objects.all(), date_from=date_from, date_to=date_to)
    if pk:
        partner = get_object_or_404(Partner, pk=pk)
        f = {"partner": partner}
        acc_ids = set()
        for getter in (partner.ar_account, partner.ap_account):
            try:
                acc_ids.add(getter().id)
            except Exception:
                pass
        for role in ("customer_advance", "supplier_advance", "retention_receivable", "retention_payable"):
            m = AccountMapping.objects.filter(role=role).first()
            if m:
                acc_ids.add(m.account_id)
        if request.GET.get("all_accounts") != "1":
            f["account_id__in"] = acc_ids
        before = _lines(None, date_from - dt.timedelta(days=1), **f).aggregate(d=Sum("debit"), c=Sum("credit"))
        opening = (before["d"] or ZERO) - (before["c"] or ZERO)
        qs = _lines(date_from, date_to, **f)
        rows, closing = ledger_rows(qs, opening)
        agg = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        by_account = (_lines(None, date_to, **f).values("account__code", "account__name")
                      .annotate(d=Sum("debit"), c=Sum("credit")).order_by("account__code"))
        ctx.update(partner=partner, rows=rows, opening=opening, closing=closing, total_debit=agg["d"] or ZERO,
                   total_credit=agg["c"] or ZERO, by_account=by_account,
                   all_accounts=request.GET.get("all_accounts") == "1")
    return render(request, "reports/partner_statement.html", ctx)


# ---------------------------------------------------------------------------- قائمة الدخل
def income_statement_data(date_from, date_to, **filters):
    period = sums_by_account(date_from, date_to, **filters)
    accounts = list(Account.objects.filter(type__in=("income", "expense")))
    vals = {}
    for a in accounts:
        if a.id in period:
            d, c = period[a.id]
            vals[a.id] = ((c - d) if a.type == "income" else (d - c),)
    rows = build_tree(accounts, vals)
    income = sum((v[0] for aid, v in vals.items() if _type(accounts, aid) == "income"), ZERO)
    expense = sum((v[0] for aid, v in vals.items() if _type(accounts, aid) == "expense"), ZERO)
    return dict(income_rows=[r for r in rows if r["account"].type == "income"],
                expense_rows=[r for r in rows if r["account"].type == "expense"],
                total_income=income, total_expense=expense, net=income - expense)


def _type(accounts, aid):
    for a in accounts:
        if a.id == aid:
            return a.type


def income_statement(request):
    date_from, date_to = period_from_request(request)
    data = income_statement_data(date_from, date_to, **_common_filters(request))
    # مجمل الربح = إيرادات النشاط (41) - التكاليف المباشرة (51) إن وُجدت
    gross = None
    rev = next((r for r in data["income_rows"] if r["account"].code == "41"), None)
    cost = next((r for r in data["expense_rows"] if r["account"].code == "51"), None)
    if rev or cost:
        gross = (rev["vals"][0] if rev else ZERO) - (cost["vals"][0] if cost else ZERO)
    ctx = dict(title="قائمة الدخل (الأرباح والخسائر)", date_from=date_from, date_to=date_to, gross=gross,
               **data, **_filter_ctx())
    return render(request, "reports/income_statement.html", ctx)


# ---------------------------------------------------------------------------- المركز المالي
def balance_sheet(request):
    as_of = parse_date(request.GET.get("date_to"), today())
    sums = sums_by_account(None, as_of)
    accounts = list(Account.objects.filter(type__in=("asset", "liability", "equity")))
    vals = {}
    for a in accounts:
        if a.id in sums:
            d, c = sums[a.id]
            vals[a.id] = ((d - c) if a.type == "asset" else (c - d),)
    rows = build_tree(accounts, vals)
    pl = sums_by_account(None, as_of, account__type__in=("income", "expense"))
    profit = sum((c - d for d, c in pl.values()), ZERO)
    total = lambda t: sum((v[0] for aid, v in vals.items() if next(a.type for a in accounts if a.id == aid) == t),
                          ZERO)
    assets, liabilities, equity = total("asset"), total("liability"), total("equity")
    ctx = dict(title="قائمة المركز المالي (الميزانية)", date_to=as_of,
               asset_rows=[r for r in rows if r["account"].type == "asset"],
               liability_rows=[r for r in rows if r["account"].type == "liability"],
               equity_rows=[r for r in rows if r["account"].type == "equity"],
               total_assets=assets, total_liabilities=liabilities, total_equity=equity + profit, profit=profit,
               total_le=liabilities + equity + profit, balanced=assets == liabilities + equity + profit)
    return render(request, "reports/balance_sheet.html", ctx)


# ---------------------------------------------------------------------------- الضرائب
def tax_report(request):
    date_from, date_to = period_from_request(request)
    sections = []
    for title, roles in (("ضريبة القيمة المضافة", ("vat_out", "vat_in")),
                         ("ضرائب الخصم من المنبع (خصم وإضافة)", ("wht_receivable", "wht_payable"))):
        accs = []
        for role in roles:
            m = AccountMapping.objects.filter(role=role).select_related("account").first()
            if m:
                accs.append(m.account)
        for t in Tax.objects.all():
            for a in (t.sale_account, t.purchase_account):
                if a and a not in accs and ((t.kind == "vat") == (roles[0] == "vat_out")):
                    accs.append(a)
        items = []
        for a in accs:
            agg = _lines(date_from, date_to, account=a).aggregate(d=Sum("debit"), c=Sum("credit"))
            by_partner = (_lines(date_from, date_to, account=a).values("partner__name", "partner__tax_id")
                          .annotate(d=Sum("debit"), c=Sum("credit")).order_by("partner__name"))
            items.append(dict(account=a, debit=agg["d"] or ZERO, credit=agg["c"] or ZERO,
                              balance=(agg["c"] or ZERO) - (agg["d"] or ZERO), by_partner=by_partner))
        sections.append(dict(title=title, items=items))
    vat_out = AccountMapping.objects.filter(role="vat_out").first()
    vat_in = AccountMapping.objects.filter(role="vat_in").first()
    net_vat = ZERO
    if vat_out and vat_in:
        o = _lines(date_from, date_to, account=vat_out.account).aggregate(d=Sum("debit"), c=Sum("credit"))
        i = _lines(date_from, date_to, account=vat_in.account).aggregate(d=Sum("debit"), c=Sum("credit"))
        net_vat = ((o["c"] or ZERO) - (o["d"] or ZERO)) - ((i["d"] or ZERO) - (i["c"] or ZERO))
    return render(request, "reports/tax_report.html",
                  dict(title="تقرير الضرائب", sections=sections, date_from=date_from, date_to=date_to,
                       net_vat=net_vat))


# ---------------------------------------------------------------------------- أعمار الديون
def aging(request):
    from commerce.models import Invoice
    from contracting.models import Certificate
    side = request.GET.get("side", "receivable")
    as_of = parse_date(request.GET.get("date_to"), today())
    buckets = ["غير مستحق", "1-30", "31-60", "61-90", "91-180", "أكثر من 180"]
    data = defaultdict(lambda: [ZERO] * (len(buckets) + 1))
    details = []
    if side == "receivable":
        invs = Invoice.objects.filter(state="posted", kind="sale", date__lte=as_of)
        certs = Certificate.objects.filter(state="posted", contract__kind="client", date__lte=as_of)
    else:
        invs = Invoice.objects.filter(state="posted", kind="purchase", date__lte=as_of)
        certs = Certificate.objects.filter(state="posted", contract__kind="sub", date__lte=as_of)
    docs = [(i, i.partner, i.due_date or i.date, i.residual, str(i)) for i in invs.select_related("partner")]
    docs += [(c, c.contract.partner, c.date, c.residual, str(c)) for c in certs.select_related("contract__partner")]
    for doc, partner, due, residual, label in docs:
        if residual <= 0:
            continue
        days = (as_of - due).days
        idx = 0 if days <= 0 else 1 if days <= 30 else 2 if days <= 60 else 3 if days <= 90 else 4 if days <= 180 else 5
        data[partner][idx] += residual
        data[partner][-1] += residual
        details.append(dict(doc=doc, partner=partner, due=due, days=max(days, 0), residual=residual, label=label))
    rows = sorted(data.items(), key=lambda kv: -kv[1][-1])
    totals = [sum((r[1][i] for r in rows), ZERO) for i in range(len(buckets) + 1)]
    return render(request, "reports/aging.html", dict(
        title="أعمار الديون - " + ("العملاء (مستحق لنا)" if side == "receivable" else "الموردون ومقاولو الباطن (مستحق علينا)"),
        rows=rows, buckets=buckets, totals=totals, side=side, date_to=as_of,
        details=sorted(details, key=lambda d: -d["days"])))


# ---------------------------------------------------------------------------- مراكز التكلفة
def cost_center_report(request):
    date_from, date_to = period_from_request(request)
    rows = (_lines(date_from, date_to, account__type__in=("income", "expense"))
            .values("cost_center__code", "cost_center__name", "account__type")
            .annotate(d=Sum("debit"), c=Sum("credit")).order_by("cost_center__code"))
    data = defaultdict(lambda: dict(income=ZERO, expense=ZERO))
    for r in rows:
        key = (r["cost_center__code"] or "", r["cost_center__name"] or "بدون مركز تكلفة")
        if r["account__type"] == "income":
            data[key]["income"] += (r["c"] or ZERO) - (r["d"] or ZERO)
        else:
            data[key]["expense"] += (r["d"] or ZERO) - (r["c"] or ZERO)
    items = [dict(code=k[0], name=k[1], net=v["income"] - v["expense"], **v) for k, v in sorted(data.items())]
    return render(request, "reports/cost_centers.html", dict(
        title="تحليل مراكز التكلفة", items=items, date_from=date_from, date_to=date_to,
        total_income=sum((i["income"] for i in items), ZERO), total_expense=sum((i["expense"] for i in items), ZERO)))


def treasury_balances(as_of=None):
    out = []
    for a in Account.objects.filter(kind__in=("cash", "bank"), is_group=False, active=True):
        out.append(dict(account=a, balance=a.balance(date_to=as_of)))
    return out


def reports_index(request):
    return render(request, "reports/index.html", dict(title="التقارير"))
