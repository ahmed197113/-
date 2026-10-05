"""مسح كل البيانات والحركات والبدء من الصفر مع الإبقاء على الإعدادات."""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = ("يمسح كل الحركات والمشروعات والعقود والعملاء والموردين والأصناف والأصول، "
            "ويبقي على: بيانات الشركة، شجرة الحسابات، التوجيه المحاسبي، الضرائب، القيود الجاهزة، المخازن، المستخدمين")

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="تأكيد المسح بدون سؤال")

    @transaction.atomic
    def handle(self, *args, **opts):
        if not opts["yes"]:
            if input("سيتم مسح كل الحركات والبيانات نهائياً. اكتب نعم للتأكيد: ").strip() not in ("نعم", "yes"):
                raise CommandError("تم الإلغاء")
        from accounting.models import CostCenter, JournalEntry, Partner, Sequence
        from assets.models import Asset, AssetCategory, DepreciationRun
        from commerce.models import Invoice, Payment, Product, StockDocument, StockMove, Transfer, Warehouse
        from contracting.models import Certificate, Contract, Project, RetentionRelease

        for model in (Payment, RetentionRelease, Certificate, Contract, Invoice, Transfer, StockDocument, StockMove,
                      DepreciationRun, Asset, AssetCategory, JournalEntry, Product):
            model.objects.all().delete()
        Warehouse.objects.exclude(code="WH1").delete()
        Warehouse.objects.update(project=None)
        Project.objects.all().delete()
        Partner.objects.all().delete()
        CostCenter.objects.all().delete()
        Sequence.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("تم مسح البيانات — البرنامج جاهز للبدء من الصفر"))
