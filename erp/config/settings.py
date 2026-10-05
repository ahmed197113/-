"""
إعدادات نظام "مِحاسب" للمحاسبة والمقاولات.
يمكن تعديل أي إعداد عبر متغيرات البيئة دون تعديل الكود.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "ERP_SECRET_KEY", "dev-only-change-me-3b1c9f0a7d2e4b8c9a6f5e1d0c3b2a19"
)
DEBUG = os.environ.get("ERP_DEBUG", "1") == "1"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get(
    "ERP_ALLOWED_HOSTS", "localhost,127.0.0.1,*" if DEBUG else "localhost,127.0.0.1").split(",") if h.strip()]

# مطلوب عند التشغيل على دومين بـ HTTPS (مثال: https://metal-lines.com,https://www.metal-lines.com)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("ERP_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
# خلف nginx/Apache/cPanel الذي ينهي الـ SSL
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if os.environ.get("ERP_HTTPS") == "1":
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "accounting",
    "commerce",
    "contracting",
    "assets",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # كل الصفحات تتطلب تسجيل الدخول ما عدا صفحة الدخول نفسها
    "django.contrib.auth.middleware.LoginRequiredMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "accounting.context_processors.company",
            ],
            "builtins": ["accounting.templatetags.erp"],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

if os.environ.get("ERP_DB_ENGINE") == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("ERP_DB_NAME", "erp"),
            "USER": os.environ.get("ERP_DB_USER", "erp"),
            "PASSWORD": os.environ.get("ERP_DB_PASSWORD", ""),
            "HOST": os.environ.get("ERP_DB_HOST", "localhost"),
            "PORT": os.environ.get("ERP_DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("ERP_DB_PATH", BASE_DIR / "db.sqlite3"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "ar"
TIME_ZONE = os.environ.get("ERP_TIME_ZONE", "Africa/Cairo")
USE_I18N = True
USE_TZ = True
USE_THOUSAND_SEPARATOR = False
FORMAT_MODULE_PATH = ["config.formats"]

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = os.environ.get("ERP_STATIC_ROOT", BASE_DIR / "staticfiles")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "login"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
