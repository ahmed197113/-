import datetime as dt
from decimal import Decimal as D

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db.models import Sum
from django.test import TestCase

from accounting import smart
from accounting.models import Account, Company, JournalEntry, JournalLine, Partner, Tax
from accounting.posting import create_entry
from commerce.models import Invoice, InvoiceLine, Payment, Product, StockDocument, StockDocumentLine, Warehouse
from contracting.models import BOQItem, Certificate, Contract, Project, RetentionRelease

TODAY = dt.date.today()


def acc(code):
    return Account.objects.get(code=code)


def balance(code, **f):
    a = JournalLine.objects.filter(entry__state="posted", account__code=code, **f).aggregate(
        d=Sum("debit"), c=Sum("credit"))
    return (a["d"] or 0) - (a["c"] or 0)


class BaseCase(TestCase):
    def setUp(self):
        call_command("setup_company", stdout=open("/dev/null", "w"))
        self.user = User.objects.get(username="admin")
        self.vat = Tax.objects.get(kind="vat", rate=14)
        self.wht = Tax.objects.get(kind="wht", rate=1)
        self.customer = Partner.objects.create(name="عميل", type="customer")
        self.sub = Partner.objects.create(name="مقاول باطن", type="subcontractor")
        self.supplier = Partner.objects.create(name="مورد", type="supplier")
        self.project = Project.objects.create(code="P1", name="مشروع تجريبي", customer=self.customer)

    def assert_ledger_balanced(self):
        a = JournalLine.objects.filter(entry__state="posted").aggregate(d=Sum("debit"), c=Sum("credit"))
        self.assertEqual(a["d"], a["c"])


class PostingTests(BaseCase):
    def test_unbalanced_entry_rejected(self):
        with self.assertRaises(ValidationError):
            create_entry(TODAY, "x", [dict(account=acc("1211"), debit=100, credit=0),
                                      dict(account=acc("3101"), debit=0, credit=90)])

    def test_group_account_rejected(self):
        with self.assertRaises(ValidationError):
            create_entry(TODAY, "x", [dict(account=acc("121"), debit=100, credit=0),
                                      dict(account=acc("3101"), debit=0, credit=100)])

    def test_lock_date(self):
        c = Company.get()
        c.lock_date = TODAY
        c.save()
        with self.assertRaises(ValidationError):
            create_entry(TODAY, "x", [dict(account=acc("1211"), debit=100, credit=0),
                                      dict(account=acc("3101"), debit=0, credit=100)])


class CertificateTests(BaseCase):
    def make_contract(self, kind="client", **kw):
        defaults = dict(kind=kind, title="عقد", project=self.project,
                        partner=self.customer if kind == "client" else self.sub, date=TODAY, retention_pct=5,
                        vat=self.vat, wht=self.wht)
        defaults.update(kw)
        c = Contract.objects.create(**defaults)
        self.i1 = BOQItem.objects.create(contract=c, code="1", description="خرسانة", unit="م3", quantity=100,
                                         unit_price=1000)
        self.i2 = BOQItem.objects.create(contract=c, code="2", description="مباني", unit="م3", quantity=50,
                                         unit_price=400)
        return c

    def cert(self, contract, qtys, pcts=None, post=True, **kw):
        cert = Certificate.objects.create(contract=contract, date=TODAY, **kw)
        cert.sync_lines()
        for ln in cert.lines.all():
            if ln.item_id in qtys:
                ln.current_qty = D(str(qtys[ln.item_id]))
            if pcts and ln.item_id in pcts:
                ln.completion_pct = D(str(pcts[ln.item_id]))
            ln.save()
        cert.compute()
        if post:
            cert.post(self.user)
        return cert

    def test_client_certificate_amounts_and_entry(self):
        c = self.make_contract()
        cert = self.cert(c, {self.i1.id: 30, self.i2.id: 10})
        self.assertEqual(cert.gross, D("34000.00"))
        self.assertEqual(cert.retention_amount, D("1700.00"))
        self.assertEqual(cert.wht_amount, D("340.00"))
        self.assertEqual(cert.vat_amount, D("4760.00"))
        self.assertEqual(cert.net_amount, D("34000") + D("4760") - D("1700") - D("340"))
        self.assertEqual(balance("4101"), D("-34000"))
        self.assertEqual(balance("1223"), D("1700"))
        self.assertEqual(balance("1221"), cert.net_amount)
        self.assert_ledger_balanced()

    def test_cumulative_with_partial_completion_pct(self):
        c = self.make_contract()
        c1 = self.cert(c, {self.i1.id: 40}, pcts={self.i1.id: 70})       # 40 × 1000 × 70%
        self.assertEqual(c1.gross, D("28000.00"))
        c2 = self.cert(c, {self.i1.id: 10}, pcts={self.i1.id: 100})      # تراكمي 50 × 1000 - 28000
        line = c2.lines.get(item=self.i1)
        self.assertEqual(line.prev_qty, D("40"))
        self.assertEqual(line.prev_amount, D("28000.00"))
        self.assertEqual(c2.gross, D("22000.00"))
        self.assertEqual(c.certified_gross, D("50000.00"))

    def test_advance_recovery_is_capped(self):
        c = self.make_contract(advance_amount=10000, advance_recovery_pct=20)
        Payment.objects.create(kind="receipt", date=TODAY, purpose="advance", partner=self.customer, contract=c,
                               treasury=acc("1213"), amount=10000).post(self.user)
        self.assertEqual(balance("2215"), D("-10000"))
        c1 = self.cert(c, {self.i1.id: 40})             # 20% من 40000 = 8000
        self.assertEqual(c1.advance_recovery, D("8000.00"))
        c2 = self.cert(c, {self.i1.id: 40})             # المتبقي 2000 فقط
        self.assertEqual(c2.advance_recovery, D("2000.00"))
        self.assertEqual(c.advance_remaining, 0)
        self.assertEqual(balance("2215"), 0)
        self.assert_ledger_balanced()

    def test_subcontractor_certificate_and_retention_release(self):
        c = self.make_contract("sub", social_ins_pct=2, vat=None)
        cert = self.cert(c, {self.i1.id: 10})
        self.assertEqual(balance("5102", project=self.project), D("10000"))
        self.assertEqual(balance("2214"), D("-500"))
        self.assertEqual(balance("2223"), D("-200"))
        self.assertEqual(balance("2222"), D("-100"))
        self.assertEqual(cert.net_amount, D("9200.00"))
        rel = RetentionRelease.objects.create(contract=c, date=TODAY, amount=500)
        rel.post(self.user)
        self.assertEqual(balance("2214"), 0)
        self.assertEqual(c.balance_due, D("9700.00"))
        with self.assertRaises(ValidationError):
            RetentionRelease.objects.create(contract=c, date=TODAY, amount=1).post(self.user)

    def test_sequential_approval_and_unpost_rules(self):
        c = self.make_contract()
        c1 = self.cert(c, {self.i1.id: 10}, post=False)
        c2 = self.cert(c, {self.i1.id: 10}, post=False)
        with self.assertRaises(ValidationError):
            c2.post(self.user)                      # يجب اعتماد الأول أولاً
        c1.post(self.user)
        c2.refresh_from_db()
        c2.sync_lines()
        c2.compute()
        c2.post(self.user)
        with self.assertRaises(ValidationError):
            c1.unpost()                             # لا يُلغى قبل الأحدث
        c2.unpost()
        self.assertTrue(c2.is_draft)
        self.assertIsNone(c2.move)
        self.assertEqual(JournalEntry.objects.filter(source="client_cert").count(), 1)

    def test_payment_against_certificate_residual(self):
        c = self.make_contract()
        cert = self.cert(c, {self.i1.id: 10})
        Payment.objects.create(kind="receipt", date=TODAY, partner=self.customer, certificate=cert,
                               treasury=acc("1211"), amount=D("5000")).post(self.user)
        self.assertEqual(cert.residual, cert.net_amount - 5000)
        with self.assertRaises(ValidationError):
            cert.unpost()


class CommerceTests(BaseCase):
    def test_stock_purchase_issue_and_sale_cogs(self):
        wh = Warehouse.objects.first()
        steel = Product.objects.create(code="ST", name="حديد", type="stock", unit="طن")
        inv = Invoice.objects.create(kind="purchase", partner=self.supplier, date=TODAY, warehouse=wh, wht=self.wht)
        InvoiceLine.objects.create(invoice=inv, product=steel, qty=10, unit_price=1000, vat=self.vat)
        inv.compute_totals()
        self.assertEqual(inv.total, D("11400.00") - D("100.00"))
        inv.post(self.user)
        steel.refresh_from_db()
        self.assertEqual(steel.avg_cost, D("1000"))
        self.assertEqual(balance("1231"), D("10000"))
        self.assertEqual(balance("1241"), D("1400"))
        doc = StockDocument.objects.create(kind="issue", date=TODAY, warehouse=wh, project=self.project)
        StockDocumentLine.objects.create(document=doc, product=steel, qty=4)
        doc.post(self.user)
        self.assertEqual(balance("5101", project=self.project), D("4000"))
        self.assertEqual(steel.qty_on_hand(), D("6"))
        sale = Invoice.objects.create(kind="sale", partner=self.customer, date=TODAY, warehouse=wh)
        InvoiceLine.objects.create(invoice=sale, product=steel, qty=10, unit_price=1500)
        with self.assertRaises(ValidationError):    # الرصيد غير كافٍ
            sale.post(self.user)
        doc.unpost()
        self.assertEqual(steel.qty_on_hand(), D("10"))
        self.assert_ledger_balanced()

    def test_invoice_payment_status(self):
        inv = Invoice.objects.create(kind="sale", partner=self.customer, date=TODAY)
        InvoiceLine.objects.create(invoice=inv, description="خدمة", qty=1, unit_price=1000, vat=self.vat)
        inv.post(self.user)
        self.assertEqual(inv.payment_status, "غير مسددة")
        Payment.objects.create(kind="receipt", date=TODAY, partner=self.customer, invoice=inv, treasury=acc("1211"),
                               amount=1140).post(self.user)
        self.assertEqual(inv.payment_status, "مسددة")
        self.assertEqual(balance("1221"), 0)


class SmartTests(BaseCase):
    def test_keyword_routing(self):
        self.assertEqual(smart.suggest_line("سولار للودر")[0]["account"][:4], "5105")
        self.assertEqual(smart.suggest_line("حديد تسليح 16 مم")[0]["account"][:4], "5101")
        self.assertEqual(smart.suggest_line("شراء لابتوب جديد")[0]["account"][:4], "1116")
        self.assertEqual(smart.suggest_line("كارت شحن موبايل")[0]["account"][:4], "5204")

    def test_learns_from_history(self):
        inv = Invoice.objects.create(kind="purchase", partner=self.supplier, date=TODAY)
        InvoiceLine.objects.create(invoice=inv, description="بنود زفلطة خاصة", account=acc("5108"), qty=1,
                                   unit_price=100)
        inv.post(self.user)
        smart.invalidate_cache()
        self.assertEqual(smart.suggest_line("زفلطة")[0]["account"][:4], "5108")

    def test_duplicate_invoice_detected(self):
        inv = Invoice.objects.create(kind="purchase", partner=self.supplier, date=TODAY, reference="A-1")
        notes = smart.review_invoice("purchase", partner=self.supplier, reference="A-1", total=0)
        self.assertTrue(any(n["level"] == "danger" for n in notes))
        notes = smart.review_invoice("purchase", partner=self.supplier, reference="A-1", total=0, invoice_id=inv.id)
        self.assertFalse(any(n["level"] == "danger" for n in notes))


class DemoAndPagesTests(TestCase):
    def test_demo_loads_and_all_pages_render(self):
        call_command("load_demo", stdout=open("/dev/null", "w"))
        a = JournalLine.objects.aggregate(d=Sum("debit"), c=Sum("credit"))
        self.assertEqual(a["d"], a["c"])
        self.client.force_login(User.objects.get(username="admin"))
        for url in ["/", "/accounts/", "/journal/", "/journal/new/", "/journal/templates/", "/partners/",
                    "/invoices/?kind=sale", "/invoices/new/?kind=purchase", "/payments/new/?kind=payment",
                    "/projects/", "/projects/1/", "/contracts/?kind=client", "/contracts/1/", "/certificates/1/",
                    "/certificates/?kind=sub", "/certificates/new/?kind=client", "/contracting/reports/projects/",
                    "/contracting/reports/retention/", "/contracting/reports/advances/", "/reports/trial-balance/",
                    "/reports/income-statement/", "/reports/balance-sheet/", "/reports/taxes/", "/reports/aging/",
                    "/reports/ledger/?account=1", "/reports/partner-statement/1/", "/stock/balance/", "/assets/",
                    "/assets/depreciation/", "/settings/", "/settings/mapping/", "/api/suggest/line/?text=سولار"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        draft = Certificate.objects.filter(state="draft").first()
        self.assertEqual(self.client.get(f"/certificates/{draft.id}/edit/").status_code, 200)

    def test_login_required(self):
        self.assertEqual(self.client.get("/").status_code, 302)
