from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounting.seed import seed_basics


class Command(BaseCommand):
    help = "تهيئة النظام: دليل الحسابات والضرائب والتوجيه المحاسبي والقيود الجاهزة + مستخدم مدير"

    def add_arguments(self, parser):
        parser.add_argument("--name", default=None, help="اسم الشركة")
        parser.add_argument("--admin-user", default="admin")
        parser.add_argument("--admin-password", default="admin123")

    def handle(self, *args, **opts):
        seed_basics(opts["name"])
        User = get_user_model()
        if not User.objects.filter(username=opts["admin_user"]).exists():
            User.objects.create_superuser(opts["admin_user"], "", opts["admin_password"])
            self.stdout.write(f"تم إنشاء المستخدم {opts['admin_user']} / {opts['admin_password']}")
        self.stdout.write(self.style.SUCCESS("تمت تهيئة النظام بنجاح"))
