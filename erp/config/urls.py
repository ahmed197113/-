from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_not_required
from django.urls import include, path

admin.site.site_header = "إدارة النظام المحاسبي"
admin.site.site_title = "إدارة النظام"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("login/", login_not_required(auth_views.LoginView.as_view()), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("", include("accounting.urls")),
    path("", include("commerce.urls")),
    path("", include("contracting.urls")),
    path("", include("assets.urls")),
]
