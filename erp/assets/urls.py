from django.urls import path

from . import views

urlpatterns = [
    path("assets/", views.asset_list),
    path("assets/new/", views.asset_form),
    path("assets/<int:pk>/", views.asset_detail, name="asset_detail"),
    path("assets/<int:pk>/edit/", views.asset_form),
    path("assets/categories/", views.category_list),
    path("assets/categories/new/", views.category_form),
    path("assets/categories/<int:pk>/", views.category_form),
    path("assets/depreciation/", views.depreciation_list, name="depreciation_list"),
    path("assets/depreciation/<int:pk>/<str:action>/", views.depreciation_action),
]
