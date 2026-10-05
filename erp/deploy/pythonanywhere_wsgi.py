# ملف WSGI للتشغيل على PythonAnywhere
# انسخ محتواه بالكامل مكان محتوى ملف الـ WSGI بتاع التطبيق في تبويب Web
# (المسار شكله: /var/www/erp_metal-lines_com_wsgi.py)
# واستبدل: YOUR_USERNAME و PUT_SECRET_KEY_HERE
import os
import sys

APP_DIR = "/home/YOUR_USERNAME/erp_app"
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["ERP_DEBUG"] = "0"
os.environ["ERP_SECRET_KEY"] = "PUT_SECRET_KEY_HERE"
os.environ["ERP_ALLOWED_HOSTS"] = "erp.metal-lines.com,YOUR_USERNAME.pythonanywhere.com"
os.environ["ERP_CSRF_TRUSTED_ORIGINS"] = "https://erp.metal-lines.com,https://YOUR_USERNAME.pythonanywhere.com"
os.environ["ERP_HTTPS"] = "1"

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
