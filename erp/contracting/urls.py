from django.urls import path

from . import views

urlpatterns = [
    path("projects/", views.project_list, name="project_list"),
    path("projects/new/", views.project_form),
    path("projects/<int:pk>/", views.project_detail, name="project_detail"),
    path("projects/<int:pk>/edit/", views.project_form),
    path("contracts/", views.contract_list, name="contract_list"),
    path("contracts/new/", views.contract_form),
    path("contracts/<int:pk>/", views.contract_detail, name="contract_detail"),
    path("contracts/<int:pk>/edit/", views.contract_form),
    path("contracts/<int:contract_pk>/retention/", views.retention_new),
    path("retention/<int:pk>/<str:action>/", views.retention_action),
    path("certificates/", views.certificate_list, name="certificate_list"),
    path("certificates/new/", views.certificate_new),
    path("certificates/<int:pk>/", views.certificate_detail, name="certificate_detail"),
    path("certificates/<int:pk>/edit/", views.certificate_edit),
    path("certificates/<int:pk>/<str:action>/", views.certificate_action),
    path("contracting/reports/", views.reports_index),
    path("contracting/reports/projects/", views.projects_report),
    path("contracting/reports/retention/", views.retention_report),
    path("contracting/reports/advances/", views.advances_report),
]
