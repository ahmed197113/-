"""
تصدير "المجموعة المرجعية" (Golden dataset) من البرنامج الأصلي لاختبارات المطابقة في نسخة WordPress:
- backup.json : نسخة كاملة بنفس صيغة زر «تنزيل نسخة احتياطية»
- reports.json: مخرجات التقارير بقيم نصية دقيقة (بدون float)
الاستخدام: python manage.py export_golden <مجلد>
"""
import datetime as dt
import json
import os
from io import StringIO

from django.core import management
from django.core.management.base import BaseCommand
from django.test import RequestFactory

from accounting import reports
from accounting.models import Account, Partner, JournalEntry


def s(v):
    """نص دقيق برقمين عشريين (كما يُخزّن DECIMAL(16,2))."""
    return format(v, ".2f")


class Command(BaseCommand):
    help = "تصدير المجموعة المرجعية لاختبارات المطابقة"

    def add_arguments(self, parser):
        parser.add_argument("out")

    def handle(self, *args, **opts):
        out = opts["out"]
        os.makedirs(out, exist_ok=True)
        buf = StringIO()
        management.call_command("dumpdata", "--natural-foreign", "--indent", "1", "--exclude", "contenttypes",
                                "--exclude", "auth.permission", "--exclude", "sessions", "--exclude",
                                "admin.logentry", stdout=buf)
        with open(os.path.join(out, "backup.json"), "w", encoding="utf-8") as fh:
            fh.write(buf.getvalue())

        rf = RequestFactory()
        captured = {}

        def capture(template, ctx):
            captured.clear()
            captured.update(ctx)

        reports.render = lambda request, template, ctx: capture(template, ctx)

        dates = sorted(JournalEntry.objects.values_list("date", flat=True).distinct())
        first, last = dates[0], dates[-1]
        mid = first + (last - first) / 2
        ranges = [(first, last), (mid, last), (first, mid), (dt.date(first.year, 1, 1), last)]

        tb = []
        variants = [dict(level=lv, zero=z) for lv in ("all", "0", "1", "2") for z in ("", "1")]
        for date_from, date_to in ranges:
            for v in variants:
                for project in ("", "1"):
                    q = dict(date_from=date_from.isoformat(), date_to=date_to.isoformat(), level=v["level"])
                    if v["zero"]:
                        q["zero"] = "1"
                    if project:
                        q["project"] = project
                    reports.trial_balance(rf.get("/reports/trial-balance/", q))
                    tb.append(dict(params=q, balanced=captured["balanced"],
                                   totals=[s(x) for x in captured["totals"]],
                                   rows=[dict(code=r["account"].code, level=r["level"], is_group=r["is_group"],
                                              vals=[s(x) for x in r["vals"]]) for r in captured["rows"]]))

        ledgers = []
        accounts = list(Account.objects.filter(lines__isnull=False).distinct()) + \
            list(Account.objects.filter(code__in=["1", "12", "121", "2", "4", "5", "51"]))
        for acc in accounts:
            for date_from, date_to in ranges[:2]:
                for extra in ({}, {"project": "1"}):
                    q = dict(account=str(acc.id), date_from=date_from.isoformat(), date_to=date_to.isoformat(), **extra)
                    reports.account_ledger(rf.get("/reports/ledger/", q))
                    ledgers.append(dict(
                        params=q, account_code=acc.code, opening=s(captured["opening"]), closing=s(captured["closing"]),
                        total_debit=s(captured["total_debit"]), total_credit=s(captured["total_credit"]),
                        rows=[dict(entry=r["line"].entry.number, date=r["line"].entry.date.isoformat(),
                                   debit=s(r["line"].debit), credit=s(r["line"].credit), balance=s(r["balance"]))
                              for r in captured["rows"]]))
        # كشف الحساب بالجهة لنفس الحساب
        partner_ledgers = []
        for p in Partner.objects.all():
            acc = p.main_account()
            q = dict(account=str(acc.id), partner=str(p.id), date_from=ranges[0][0].isoformat(),
                     date_to=ranges[0][1].isoformat())
            reports.account_ledger(rf.get("/reports/ledger/", q))
            partner_ledgers.append(dict(params=q, account_code=acc.code, partner_code=p.code,
                                        opening=s(captured["opening"]), closing=s(captured["closing"]),
                                        rows=[dict(entry=r["line"].entry.number, balance=s(r["balance"]))
                                              for r in captured["rows"]]))

        with open(os.path.join(out, "reports.json"), "w", encoding="utf-8") as fh:
            json.dump(dict(trial_balance=tb, ledger=ledgers, partner_ledger=partner_ledgers), fh,
                      ensure_ascii=False, indent=1)
        self.stdout.write(f"backup + {len(tb)} trial balances + {len(ledgers) + len(partner_ledgers)} ledgers")
