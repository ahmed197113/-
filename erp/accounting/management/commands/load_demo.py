"""بيانات تجريبية واقعية لشركة مقاولات: مشروعات، عقود، مستخلصات، فواتير، سندات، مخزون، أصول."""
import datetime as dt
from decimal import Decimal as D

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import Account, CostCenter, JournalTemplate, Partner, Tax
from accounting.posting import create_entry
from accounting.models import r2


class Command(BaseCommand):
    help = "تحميل بيانات تجريبية كاملة (للتجربة والتدريب)"

    @transaction.atomic
    def handle(self, *args, **opts):
        from assets.models import Asset, AssetCategory, DepreciationRun
        from commerce.models import Invoice, InvoiceLine, Payment, Product, StockDocument, StockDocumentLine, Warehouse
        from contracting.models import BOQItem, Certificate, Contract, Project, RetentionRelease

        if Project.objects.exists():
            self.stdout.write("البيانات التجريبية محمّلة بالفعل")
            return
        call_command("setup_company")
        user = get_user_model().objects.filter(is_superuser=True).first()
        acc = lambda code: Account.objects.get(code=code)
        vat14 = Tax.objects.get(kind="vat", rate=14)
        wht1 = Tax.objects.get(kind="wht", rate=1)
        today = dt.date.today()
        d = lambda days: today - dt.timedelta(days=days)

        # جهات التعامل
        P = lambda **k: Partner.objects.create(**k)
        cust1 = P(code="C001", name="شركة الأمل للتطوير العقاري", type="customer", tax_id="512-345-678",
                  phone="01001234567", address="القاهرة الجديدة", payment_days=30)
        cust2 = P(code="C002", name="مؤسسة النور للاستثمار", type="customer", tax_id="498-111-222", payment_days=45)
        sup1 = P(code="S001", name="شركة الصفا لتوريد مواد البناء", type="supplier", tax_id="301-555-777")
        sup2 = P(code="S002", name="محطة وقود الرحاب", type="supplier", tax_id="220-333-444")
        sup3 = P(code="S003", name="الشركة الحديثة لتأجير المعدات", type="supplier", tax_id="611-909-808")
        sub1 = P(code="SC01", name="مؤسسة البنا للنجارة والحدادة المسلحة", type="subcontractor", tax_id="733-121-454")
        sub2 = P(code="SC02", name="شركة الإتقان للأعمال الكهربائية", type="subcontractor", tax_id="744-656-232")
        P(code="E001", name="م. أحمد سامي - مهندس الموقع", type="employee")

        cc1 = CostCenter.objects.create(code="CC1", name="الإدارة العامة")
        cc2 = CostCenter.objects.create(code="CC2", name="قطاع المباني")
        cc3 = CostCenter.objects.create(code="CC3", name="قطاع الطرق")

        p1 = Project.objects.create(code="P001", name="مبنى إداري - التجمع الخامس", customer=cust1,
                                    location="التجمع الخامس - القاهرة الجديدة", manager="م. أحمد سامي",
                                    budget=D("7500000"), start_date=d(150), status="active", cost_center=cc2)
        p2 = Project.objects.create(code="P002", name="رصف طرق داخلية - العاشر من رمضان", customer=cust2,
                                    location="العاشر من رمضان", manager="م. محمود فتحي", budget=D("2600000"),
                                    start_date=d(90), status="active", cost_center=cc3)
        wh = Warehouse.objects.get(code="WH1")
        Warehouse.objects.create(code="WH2", name="مخزن موقع التجمع", project=p1)

        # رأس المال وأرصدة البنك
        create_entry(d(160), "رأس المال المدفوع", [
            dict(account=acc("1213"), debit=D("4400000"), credit=0, label="إيداع رأس المال"),
            dict(account=acc("1211"), debit=D("1600000"), credit=0, label="نقدية بالخزينة"),
            dict(account=acc("3101"), debit=0, credit=D("6000000"), label="رأس المال")], source="opening", user=user)

        # ---------------- عقد العميل الأول ومقايسته
        c1 = Contract.objects.create(kind="client", title="تنفيذ الأعمال الإنشائية للمبنى الإداري", project=p1,
                                     partner=cust1, date=d(150), start_date=d(150), retention_pct=5,
                                     advance_amount=D("600000"), advance_recovery_pct=10, vat=vat14, wht=wht1,
                                     payment_terms="مستخلصات شهرية - السداد خلال 30 يوماً من الاعتماد")
        boq = [("1/1", "أعمال حفر وردم للأساسات", "م3", 4200, 85),
               ("1/2", "خرسانة عادية للأساسات", "م3", 380, 2100),
               ("1/3", "خرسانة مسلحة للأساسات والأعمدة والأسقف", "م3", 1650, 3900),
               ("1/4", "مباني طوب طفلي 25 سم", "م3", 1100, 1450),
               ("1/5", "أعمال عزل الأساسات", "م2", 2400, 160),
               ("1/6", "لياسة داخلية وخارجية", "م2", 9800, 120)]
        items = [BOQItem.objects.create(contract=c1, code=a, description=b, unit=u, quantity=q, unit_price=pr)
                 for a, b, u, q, pr in boq]
        Payment.objects.create(kind="receipt", date=d(145), purpose="advance", partner=cust1, contract=c1,
                               treasury=acc("1213"), amount=D("600000"), method="transfer",
                               memo="دفعة مقدمة 600,000 - عقد المبنى الإداري").post(user)

        def cert(contract, date, qtys, pct=None, final=False, deductions=()):
            c = Certificate.objects.create(contract=contract, date=date, created_by=user, is_final=final)
            c.sync_lines()
            for ln in c.lines.select_related("item"):
                key = ln.item.code
                if key in qtys:
                    ln.current_qty = D(str(qtys[key]))
                    if pct and key in pct:
                        ln.completion_pct = D(str(pct[key]))
                    ln.save()
            for desc, code, amt in deductions:
                c.deductions.create(description=desc, account=acc(code), amount=D(str(amt)))
            c.compute()
            c.post(user)
            return c

        cert1 = cert(c1, d(110), {"1/1": 4200, "1/2": 380, "1/3": 300}, pct={"1/3": 80})
        cert2 = cert(c1, d(75), {"1/3": 520, "1/4": 250, "1/5": 2400}, pct={"1/3": 100})
        cert(c1, d(40), {"1/3": 450, "1/4": 400, "1/6": 2500},
                     deductions=[("غرامة تأخير توريد", "5211", 15000)])
        Payment.objects.create(kind="receipt", date=d(95), purpose="partner", partner=cust1, certificate=cert1,
                               treasury=acc("1213"), amount=cert1.net_amount, method="transfer",
                               memo="تحصيل المستخلص الأول").post(user)
        Payment.objects.create(kind="receipt", date=d(50), purpose="partner", partner=cust1, certificate=cert2,
                               treasury=acc("1213"), amount=r2(cert2.net_amount * D("0.6")), method="cheque",
                               cheque_no="458812", memo="دفعة من المستخلص الثاني").post(user)
        cert4 = Certificate.objects.create(contract=c1, date=d(5), created_by=user)
        cert4.sync_lines()
        cert4.lines.filter(item=items[5]).update(current_qty=3100)
        cert4.lines.filter(item=items[3]).update(current_qty=180)
        cert4.compute()  # مسودة جاهزة للمراجعة والاعتماد

        # ---------------- عقد العميل الثاني (طرق)
        c2 = Contract.objects.create(kind="client", title="رصف وتطوير الطرق الداخلية", project=p2, partner=cust2,
                                     date=d(90), retention_pct=10, vat=vat14, wht=wht1)
        for a, b, u, q, pr in [("1", "أعمال تسوية وتجهيز الطبقات", "م2", 18000, 35), ("2", "طبقة أساس مدكوك", "م3", 5400, 260),
                               ("3", "طبقة رابطة أسفلتية 6 سم", "م2", 18000, 115), ("4", "بردورات خرسانية", "م.ط", 3600, 180)]:
            BOQItem.objects.create(contract=c2, code=a, description=b, unit=u, quantity=q, unit_price=pr)
        r1 = cert(c2, d(45), {"1": 18000, "2": 3000})
        Payment.objects.create(kind="receipt", date=d(20), purpose="partner", partner=cust2, certificate=r1,
                               treasury=acc("1214"), amount=r2(r1.net_amount / 2), method="transfer",
                               memo="دفعة تحت الحساب").post(user)

        # ---------------- مقاولو الباطن
        s1 = Contract.objects.create(kind="sub", title="أعمال النجارة والحدادة المسلحة (مصنعية)", project=p1,
                                     partner=sub1, date=d(140), retention_pct=5, advance_amount=D("100000"),
                                     advance_recovery_pct=20, wht=wht1, social_ins_pct=D("2"))
        for a, b, u, q, pr in [("N1", "نجارة وحدادة مسلحة للأساسات", "م3", 600, 650), ("N2", "نجارة وحدادة أعمدة وأسقف", "م3", 1050, 820)]:
            BOQItem.objects.create(contract=s1, code=a, description=b, unit=u, quantity=q, unit_price=pr)
        Payment.objects.create(kind="payment", date=d(135), purpose="advance", partner=sub1, contract=s1,
                               treasury=acc("1211"), amount=D("100000"), memo="دفعة مقدمة لمقاول النجارة").post(user)
        sc1 = cert(s1, d(100), {"N1": 600, "N2": 150})
        cert(s1, d(60), {"N2": 500})
        Payment.objects.create(kind="payment", date=d(90), purpose="partner", partner=sub1, certificate=sc1,
                               treasury=acc("1213"), amount=sc1.net_amount, method="cheque", cheque_no="100231",
                               memo="سداد المستخلص الأول").post(user)
        s2 = Contract.objects.create(kind="sub", title="التمديدات الكهربائية للمبنى", project=p1, partner=sub2,
                                     date=d(60), retention_pct=5, vat=vat14, wht=wht1)
        for a, b, u, q, pr in [("E1", "تمديد مواسير ومخارج إنارة", "نقطة", 1800, 220), ("E2", "لوحات توزيع فرعية", "عدد", 24, 6500)]:
            BOQItem.objects.create(contract=s2, code=a, description=b, unit=u, quantity=q, unit_price=pr)
        cert(s2, d(25), {"E1": 900})

        # ---------------- الأصناف والمشتريات والمخزون
        steel = Product.objects.create(code="M001", name="حديد تسليح 16 مم", type="stock", unit="طن",
                                       purchase_price=D("38500"), purchase_tax=vat14, min_qty=10)
        cement = Product.objects.create(code="M002", name="أسمنت بورتلاندي", type="stock", unit="طن",
                                        purchase_price=D("3100"), purchase_tax=vat14, min_qty=40)
        Product.objects.create(code="SRV1", name="تأجير لودر بالسائق", type="service", unit="يوم", sale_price=D("4500"),
                               sale_tax=vat14, income_account=acc("4104"))

        def invoice(kind, partner, date, lines, project=None, wht=None, warehouse=None, ref=""):
            inv = Invoice.objects.create(kind=kind, partner=partner, date=date, project=project, wht=wht,
                                         warehouse=warehouse, reference=ref, created_by=user,
                                         due_date=date + dt.timedelta(days=30))
            for ln in lines:
                InvoiceLine.objects.create(invoice=inv, **ln)
            inv.compute_totals()
            inv.post(user)
            return inv

        pi1 = invoice("purchase", sup1, d(120), [dict(product=steel, description="حديد تسليح 16 مم", qty=60,
                                                      unit_price=D("38500"), vat=vat14),
                                                 dict(product=cement, description="أسمنت بورتلاندي", qty=200,
                                                      unit_price=D("3100"), vat=vat14)],
                      project=p1, wht=wht1, warehouse=wh, ref="SF-2291")
        sd = StockDocument.objects.create(kind="issue", date=d(115), warehouse=wh, project=p1, notes="صرف للموقع")
        StockDocumentLine.objects.create(document=sd, product=steel, qty=45)
        StockDocumentLine.objects.create(document=sd, product=cement, qty=150)
        sd.post(user)
        sd2 = StockDocument.objects.create(kind="issue", date=d(30), warehouse=wh, project=p1, notes="صرف دفعة ثانية")
        StockDocumentLine.objects.create(document=sd2, product=steel, qty=12)
        StockDocumentLine.objects.create(document=sd2, product=cement, qty=40)
        sd2.post(user)
        invoice("purchase", sup1, d(70), [dict(description="رمل وزلط مورد للموقع", account=acc("5101"), qty=1,
                                               unit_price=D("185000"), vat=vat14)], project=p1, wht=wht1, ref="SF-2350")
        invoice("purchase", sup1, d(35), [dict(description="سن وزلط وأسفلت لطبقة الأساس", account=acc("5101"), qty=1,
                                               unit_price=D("420000"), vat=vat14)], project=p2, wht=wht1, ref="SF-2410")
        invoice("purchase", sup3, d(80), [dict(description="إيجار لودر وحفار شهر كامل", account=acc("5104"), qty=1,
                                               unit_price=D("96000"), vat=vat14)], project=p1, wht=wht1, ref="R-77")
        invoice("purchase", sup3, d(28), [dict(description="إيجار هراس وجريدر", account=acc("5104"), qty=1,
                                               unit_price=D("138000"), vat=vat14)], project=p2, wht=wht1, ref="R-91")
        fuel = invoice("purchase", sup2, d(55), [dict(description="سولار للمعدات - موقع التجمع", account=acc("5105"),
                                                      qty=6000, unit_price=D("13.75"))], project=p1, ref="F-5521")
        Payment.objects.create(kind="payment", date=d(50), purpose="partner", partner=sup2, invoice=fuel,
                               treasury=acc("1211"), amount=fuel.total, memo="سداد فاتورة السولار").post(user)
        Payment.objects.create(kind="payment", date=d(100), purpose="partner", partner=sup1, invoice=pi1,
                               treasury=acc("1213"), amount=pi1.total, method="transfer",
                               memo="سداد فاتورة الحديد والأسمنت").post(user)
        invoice("sale", cust2, d(15), [dict(product=Product.objects.get(code="SRV1"), description="تأجير لودر بالسائق",
                                            qty=12, unit_price=D("4500"), vat=vat14)], project=p2)

        # ---------------- مصروفات بالقيود الجاهزة والسندات
        def use(name, date, amount, project=None, partner=None):
            t = JournalTemplate.objects.get(name=name)
            lines = []
            for tl in t.lines.all():
                a = r2(amount * tl.percent / 100)
                lines.append(dict(account=tl.account, debit=a if tl.side == "debit" else 0,
                                  credit=a if tl.side == "credit" else 0, label=tl.label,
                                  project=project if tl.use_project else None,
                                  partner=partner if tl.use_partner else None))
            create_entry(date, t.memo, lines, user=user)

        for i, m in enumerate((120, 90, 60, 30)):
            use("صرف مرتبات الإدارة نقداً", d(m), D("145000"))
            use("صرف عهدة لموقع", d(m + 2), D("120000"))
            use("صرف أجور عمالة موقع", d(m - 3), D("78000"), project=p1)
            use("سداد إيجار مكتب", d(m), D("35000"))
            use("مصروفات بنكية", d(m), D("1850"))
        use("صرف أجور عمالة موقع", d(20), D("64000"), project=p2)
        use("شراء وقود لمعدات المشروع", d(18), D("38000"), project=p2)
        Payment.objects.create(kind="payment", date=d(12), purpose="account", counter_account=acc("5203"),
                               treasury=acc("1211"), amount=D("6800"), memo="فاتورة كهرباء المكتب").post(user)
        Payment.objects.create(kind="payment", date=d(8), purpose="account", counter_account=acc("5106"),
                               project=p1, treasury=acc("1212"), amount=D("14500"),
                               memo="نقل ومشال مخلفات من موقع التجمع").post(user)

        # ---------------- الأصول الثابتة والإهلاك
        cat_eq = AssetCategory.objects.create(name="معدات ثقيلة", asset_account=acc("1113"), accum_account=acc("1122"),
                                              expense_account=acc("5301"), life_months=96)
        cat_car = AssetCategory.objects.create(name="سيارات", asset_account=acc("1114"), accum_account=acc("1123"),
                                               expense_account=acc("5301"), life_months=60)
        create_entry(d(158), "شراء لودر وسيارة نقل", [
            dict(account=acc("1113"), debit=D("2400000"), credit=0, label="لودر كاتربيلر"),
            dict(account=acc("1114"), debit=D("650000"), credit=0, label="سيارة نصف نقل"),
            dict(account=acc("1213"), debit=0, credit=D("3050000"), label="سداد بشيك")], user=user)
        Asset.objects.create(code="FA0001", name="لودر 950", category=cat_eq, purchase_date=d(158), start_date=d(158),
                             cost=D("2400000"), salvage=D("240000"), life_months=96, project=p1)
        Asset.objects.create(code="FA0002", name="سيارة نصف نقل", category=cat_car, purchase_date=d(158),
                             start_date=d(158), cost=D("650000"), salvage=D("50000"), life_months=60, cost_center=cc1)
        for m in (4, 3, 2, 1):
            month = (today.replace(day=1) - dt.timedelta(days=28 * m))
            run = DepreciationRun.objects.create(date=DepreciationRun.month_end(month), created_by=user)
            run.generate_lines()
            if run.lines.exists():
                run.post(user)
            else:
                run.delete()

        # رد جزء من محتجزات مقاول الباطن (كمثال) كمسودة
        RetentionRelease.objects.create(contract=s1, date=d(3), amount=D("5000"), notes="رد جزئي محتجزات (تجربة)")
        self.stdout.write(self.style.SUCCESS("تم تحميل البيانات التجريبية بنجاح"))
