from django import forms
from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounting.models import Account
from accounting.ui import BSForm, BSPlainForm, Col, render_list, run_action, save_form, today

from .models import Asset, AssetCategory, DepreciationRun


class CategoryForm(BSForm):
    class Meta:
        model = AssetCategory
        fields = ["name", "asset_account", "accum_account", "expense_account", "life_months"]

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        for f in ("asset_account", "accum_account", "expense_account"):
            self.fields[f].queryset = Account.objects.filter(is_group=False)


class AssetForm(BSForm):
    class Meta:
        model = Asset
        fields = ["code", "name", "category", "purchase_date", "start_date", "cost", "salvage", "life_months",
                  "opening_depreciation", "project", "cost_center", "serial", "location", "status"]


class RunForm(BSPlainForm):
    date = forms.DateField(label="شهر الإهلاك (أي يوم في الشهر)")


def asset_list(request):
    return render_list(
        request, "الأصول الثابتة", Asset.objects.select_related("category", "project"),
        [Col("الكود", "code"), Col("الأصل", "name"), Col("الفئة", "category"), Col("تاريخ الشراء", "purchase_date", "date"),
         Col("التكلفة", "cost", "money"), Col("قسط شهري", "monthly", "money"), Col("مجمع الإهلاك", "accumulated", "money"),
         Col("القيمة الدفترية", "book_value", "money"), Col("المشروع", "project"),
         Col("الحالة", lambda o: o.get_status_display())],
        row_url=lambda o: f"/assets/{o.pk}/", new_url="/assets/new/", search=("code", "name", "serial"),
        buttons=[("/assets/depreciation/", "قيود الإهلاك", "bi-calendar-check", "warning"),
                 ("/assets/categories/", "فئات الأصول", "bi-tags", "light")],
        totals=("التكلفة", "مجمع الإهلاك", "القيمة الدفترية"), icon="bi-truck-front")


def asset_form(request, pk=None):
    obj = get_object_or_404(Asset, pk=pk) if pk else None
    init = {"purchase_date": today(), "start_date": today(), "code": f"FA{Asset.objects.count() + 1:04d}"}
    return save_form(request, AssetForm, obj, "أصل ثابت", initial=init, success=lambda o: "/assets/", icon="bi-truck-front")


def asset_detail(request, pk):
    a = get_object_or_404(Asset, pk=pk)
    return render(request, "assets/asset_detail.html", dict(title=str(a), a=a,
                  lines=a.dep_lines.select_related("run").order_by("run__date")))


def category_list(request):
    return render_list(request, "فئات الأصول", AssetCategory.objects.all(),
                       [Col("الفئة", "name"), Col("حساب الأصل", "asset_account"), Col("مجمع الإهلاك", "accum_account"),
                        Col("مصروف الإهلاك", "expense_account"), Col("العمر (شهر)", "life_months")],
                       row_url=lambda o: f"/assets/categories/{o.pk}/", new_url="/assets/categories/new/", icon="bi-tags")


def category_form(request, pk=None):
    obj = get_object_or_404(AssetCategory, pk=pk) if pk else None
    return save_form(request, CategoryForm, obj, "فئة أصول", success=lambda o: "/assets/categories/")


def depreciation_list(request):
    form = RunForm(request.POST or None, initial={"date": today()})
    if request.method == "POST" and form.is_valid():
        d = DepreciationRun.month_end(form.cleaned_data["date"])
        run = DepreciationRun.objects.filter(date=d, state="draft").first() or DepreciationRun.objects.create(
            date=d, created_by=request.user)
        run.generate_lines()
        if not run.lines.exists():
            run.delete()
            messages.warning(request, "لا توجد أصول مستحق عليها إهلاك لهذا الشهر (أو تم إهلاكها بالفعل)")
        else:
            return run_action(request, run, "post")
        return redirect("/assets/depreciation/")
    runs = DepreciationRun.objects.prefetch_related("lines")
    return render(request, "assets/depreciation.html", dict(title="قيود الإهلاك الشهرية", form=form, runs=runs))


@require_POST
def depreciation_action(request, pk, action):
    run = get_object_or_404(DepreciationRun, pk=pk)
    resp = run_action(request, run, action, success_url="/assets/depreciation/")
    if action == "unpost":
        run.delete()
        messages.info(request, "تم إلغاء قيد الإهلاك")
    return redirect("/assets/depreciation/") if action != "post" else resp
