"""أدوات مشتركة للواجهات: نماذج بتنسيق Bootstrap، قوائم عامة، نماذج بسطور، وإجراءات المستندات."""
import datetime as dt
from decimal import Decimal

from django import forms
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import ProtectedError, Q
from django.shortcuts import redirect, render
from django.utils.html import format_html

from .templatetags.erp import money, qty


class BootstrapMixin:
    """يضيف تنسيقات Bootstrap ويحوّل التواريخ إلى منتقي تاريخ."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, f in self.fields.items():
            w = f.widget
            if isinstance(w, forms.DateInput) or isinstance(f, forms.DateField):
                f.widget = forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d")
                w = f.widget
            if isinstance(w, forms.CheckboxInput):
                w.attrs.setdefault("class", "form-check-input")
            elif isinstance(w, (forms.Select, forms.SelectMultiple)):
                w.attrs.setdefault("class", "form-select form-select-sm")
                if isinstance(f, forms.ModelChoiceField):
                    w.attrs["class"] += " searchable"
            else:
                w.attrs.setdefault("class", "form-control form-control-sm")
            if isinstance(w, forms.Textarea):
                w.attrs.setdefault("rows", 2)
            if isinstance(f, forms.DecimalField):
                w.attrs.setdefault("step", "any")
                w.attrs["class"] += " num"


class BSForm(BootstrapMixin, forms.ModelForm):
    pass


class BSPlainForm(BootstrapMixin, forms.Form):
    pass


def today():
    return dt.date.today()


# ---------------------------------------------------------------------------- القوائم العامة
class Col:
    def __init__(self, title, get, kind="text", link=False, cls=""):
        self.title, self.get, self.kind, self.link, self.cls = title, get, kind, link, cls

    def render(self, obj):
        v = self.get(obj) if callable(self.get) else _attr(obj, self.get)
        if self.kind == "money":
            return money(v)
        if self.kind == "qty":
            return qty(v)
        if self.kind == "date":
            return v.strftime("%Y/%m/%d") if v else ""
        if self.kind == "bool":
            return format_html('<i class="bi {}"></i>', "bi-check-circle-fill text-success" if v else "bi-dash")
        if self.kind == "state":
            from .templatetags.erp import state_badge
            return state_badge(v)
        if v is None:
            return ""
        return v

    @property
    def is_num(self):
        return self.kind in ("money", "qty")


def _attr(obj, path):
    for part in path.split("."):
        obj = getattr(obj, part, None)
        if obj is None:
            return None
        if callable(obj) and not hasattr(obj, "all"):
            obj = obj()
    return obj


def render_list(request, title, qs, columns, row_url=None, new_url=None, search=(), filters=(),
                buttons=(), totals=(), icon="bi-list", per_page=50, template="generic/list.html", extra=None):
    """
    filters: قائمة (اسم_البارامتر، العنوان، [(قيمة، نص)...], دالة(qs, قيمة)->qs)
    totals: أسماء الأعمدة (عناوين) التي يُحسب لها إجمالي على كامل النتائج
    """
    q = request.GET.get("q", "").strip()
    if q and search:
        cond = Q()
        for f in search:
            cond |= Q(**{f + "__icontains": q})
        qs = qs.filter(cond)
    active_filters = []
    for fname, ftitle, choices, apply in filters:
        val = request.GET.get(fname, "")
        if val:
            qs = apply(qs, val)
        active_filters.append(dict(name=fname, title=ftitle, choices=choices, value=val))
    total_values = {}
    if totals:
        objs = list(qs)
        for c in columns:
            if c.title in totals:
                total_values[c.title] = sum(
                    ((c.get(o) if callable(c.get) else _attr(o, c.get)) or Decimal(0) for o in objs), Decimal(0))
    page = Paginator(qs, per_page).get_page(request.GET.get("page"))
    rows = [dict(url=row_url(o) if row_url else None, cells=[(c, c.render(o)) for c in columns]) for o in page]
    ctx = dict(title=title, columns=columns, rows=rows, page=page, new_url=new_url, q=q, has_search=bool(search),
               filters=active_filters, buttons=buttons, icon=icon,
               totals=[money(total_values[c.title]) if c.title in total_values else "" for c in columns]
               if totals else None)
    ctx.update(extra or {})
    return render(request, template, ctx)


# ---------------------------------------------------------------------------- النماذج العامة
def save_form(request, form_class, instance=None, title="", formsets=(), success=None, template="generic/form.html",
              initial=None, after_save=None, extra=None, form_kwargs=None, icon="bi-pencil-square"):
    """
    formsets: قائمة (فئة_الـformset، البادئة، العنوان)
    success: دالة(obj) ترجع الرابط بعد الحفظ
    """
    form_kwargs = form_kwargs or {}
    if instance is not None and getattr(instance, "pk", None) and hasattr(instance, "state") \
            and instance.state != "draft":
        messages.warning(request, "لا يمكن تعديل مستند مرحّل. ألغِ الترحيل أولاً.")
        return redirect(instance.get_absolute_url())
    if request.method == "POST":
        form = form_class(request.POST, request.FILES, instance=instance, **form_kwargs)
        fsets = [(fs(request.POST, instance=form.instance, prefix=p), p, t) for fs, p, t in formsets]
        if form.is_valid() and all(f.is_valid() for f, _, _ in fsets):
            try:
                with transaction.atomic():
                    obj = form.save(commit=False)
                    if hasattr(obj, "created_by_id") and not obj.created_by_id:
                        obj.created_by = request.user
                    obj.save()
                    form.save_m2m()
                    for f, _, _ in fsets:
                        f.instance = obj
                        f.save()
                    if after_save:
                        after_save(obj)
                messages.success(request, "تم الحفظ بنجاح")
                return redirect(success(obj) if success else obj.get_absolute_url())
            except ValidationError as e:
                form.add_error(None, e)
    else:
        form = form_class(instance=instance, initial=initial, **form_kwargs)
        fsets = [(fs(instance=form.instance, prefix=p), p, t) for fs, p, t in formsets]
    ctx = dict(form=form, formsets=[dict(fs=f, prefix=p, title=t) for f, p, t in fsets], title=title, icon=icon,
               obj=instance)
    ctx.update(extra or {})
    return render(request, template, ctx)


def run_action(request, obj, action, success_url=None):
    """تنفيذ إجراءات المستندات: ترحيل / إلغاء ترحيل / حذف المسودة."""
    try:
        if action == "post":
            obj.post(user=request.user)
            messages.success(request, "تم الترحيل وإنشاء القيد المحاسبي آلياً ✔")
        elif action == "unpost":
            obj.unpost()
            messages.info(request, "تم إلغاء الترحيل وحذف القيد. المستند الآن مسودة قابلة للتعديل")
        elif action == "delete":
            if getattr(obj, "state", "draft") != "draft":
                raise ValidationError("لا يمكن حذف مستند مرحّل")
            obj.delete()
            messages.success(request, "تم الحذف")
            return redirect(success_url or "dashboard")
    except ValidationError as e:
        for m in e.messages:
            messages.error(request, m)
    except ProtectedError:
        messages.error(request, "لا يمكن الحذف لارتباطه بسجلات أخرى")
    return redirect(obj.get_absolute_url())


def delete_object(request, obj, success_url):
    if request.method != "POST":
        return redirect(success_url)
    try:
        obj.delete()
        messages.success(request, "تم الحذف")
    except ProtectedError:
        messages.error(request, "لا يمكن الحذف لوجود حركات أو سجلات مرتبطة. يمكنك إيقافه (غير نشط) بدلاً من ذلك")
    return redirect(success_url)


def parse_date(s, default=None):
    try:
        return dt.date.fromisoformat(s) if s else default
    except ValueError:
        return default


def period_from_request(request):
    t = today()
    from .models import Company
    fy = Company.get().fiscal_year_start
    start_default = dt.date(t.year, fy.month, fy.day) if fy else dt.date(t.year, 1, 1)
    if start_default > t:
        start_default = dt.date(t.year - 1, start_default.month, start_default.day)
    return (parse_date(request.GET.get("date_from"), start_default),
            parse_date(request.GET.get("date_to"), t))
