from decimal import Decimal

from django import forms
from django.forms import BaseInlineFormSet, inlineformset_factory

from .models import (Account, AccountMapping, Company, CostCenter, JournalEntry, JournalLine, JournalTemplate,
                     JournalTemplateLine, Partner, Tax)
from .ui import BSForm, BSPlainForm, BootstrapMixin


def posting_accounts():
    return Account.objects.filter(is_group=False, active=True)


class CompanyForm(BSForm):
    class Meta:
        model = Company
        fields = ["name", "legal_name", "tax_id", "commercial_reg", "address", "phone", "email", "currency",
                  "currency_name", "currency_sub", "fiscal_year_start", "lock_date"]


class AccountForm(BSForm):
    class Meta:
        model = Account
        fields = ["code", "name", "parent", "type", "kind", "is_group", "active", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["parent"].queryset = Account.objects.filter(is_group=True)

    def clean(self):
        data = super().clean()
        parent = data.get("parent")
        if parent and data.get("type") and parent.type != data["type"]:
            self.add_error("type", "نوع الحساب يجب أن يطابق نوع الحساب الرئيسي")
        if self.instance.pk and not data.get("is_group") and self.instance.children.exists():
            self.add_error("is_group", "الحساب له حسابات فرعية ولا يمكن تحويله لحساب تحليلي")
        if self.instance.pk and data.get("is_group") and self.instance.lines.exists():
            self.add_error("is_group", "الحساب عليه حركات ولا يمكن تحويله لحساب تجميعي")
        return data


class CostCenterForm(BSForm):
    class Meta:
        model = CostCenter
        fields = ["code", "name", "parent", "active"]


class TaxForm(BSForm):
    class Meta:
        model = Tax
        fields = ["name", "kind", "rate", "scope", "sale_account", "purchase_account", "active"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in ("sale_account", "purchase_account"):
            self.fields[f].queryset = posting_accounts()


class PartnerForm(BSForm):
    class Meta:
        model = Partner
        fields = ["code", "name", "type", "tax_id", "national_id", "phone", "email", "address", "credit_limit",
                  "payment_days", "receivable_account", "payable_account", "active", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["receivable_account"].queryset = Account.objects.filter(is_group=False, type="asset")
        self.fields["payable_account"].queryset = Account.objects.filter(is_group=False, type="liability")


class JournalEntryForm(BSForm):
    source = forms.ChoiceField(label="نوع القيد", choices=[("manual", "قيد يومية"), ("opening", "قيد افتتاحي")])

    class Meta:
        model = JournalEntry
        fields = ["date", "source", "reference", "memo"]


class JournalLineForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = JournalLine
        fields = ["account", "label", "debit", "credit", "partner", "project", "cost_center"]
        widgets = {"label": forms.Textarea(attrs={"rows": 2, "maxlength": 300,
                                                  "placeholder": "اكتب شرح العملية بالتفصيل…"})}

    HELP = {
        "account": "الحساب التحليلي الذي يتأثر بهذا السطر. ابحث بالكود أو الاسم. الحسابات التجميعية لا تقبل قيوداً.",
        "debit": "المبلغ المدين: زيادة في أصل أو مصروف، أو نقص في التزام أو إيراد. اتركه صفراً إن كان السطر دائناً.",
        "credit": "المبلغ الدائن: زيادة في التزام أو إيراد أو حقوق ملكية، أو نقص في أصل. اتركه صفراً إن كان السطر مديناً.",
        "label": "شرح تفصيلي للسطر يظهر في دفتر الأستاذ وكشف الحساب (حتى 300 حرف). لو تُرك فارغاً يظهر بيان القيد.",
        "partner": "العميل أو المورد أو مقاول الباطن الذي يخصه السطر — حدده حتى يظهر المبلغ في كشف حسابه ورصيده.",
        "project": "المشروع الذي يُحمّل عليه الإيراد أو التكلفة حتى يظهر في تقرير ربحيته.",
        "cost_center": "مركز التكلفة (الإدارة أو القطاع) للتحليل الإداري للمصروفات والإيرادات.",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["account"].queryset = posting_accounts()


class BalancedFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        d = c = Decimal(0)
        n = 0
        for f in self.forms:
            if not hasattr(f, "cleaned_data") or not f.cleaned_data or f.cleaned_data.get("DELETE"):
                continue
            dd, cc = f.cleaned_data.get("debit") or 0, f.cleaned_data.get("credit") or 0
            if dd and cc:
                raise forms.ValidationError("السطر الواحد لا يجمع مدين ودائن")
            if dd < 0 or cc < 0:
                raise forms.ValidationError("لا تُقبل قيم سالبة")
            d += dd
            c += cc
            n += 1
        if n < 2:
            raise forms.ValidationError("القيد يحتاج سطرين على الأقل")
        if d != c:
            raise forms.ValidationError(f"القيد غير متزن: مدين {d:,.2f} - دائن {c:,.2f} = فرق {d - c:,.2f}")


JournalLineFormSet = inlineformset_factory(JournalEntry, JournalLine, form=JournalLineForm,
                                           formset=BalancedFormSet, extra=2, can_delete=True)


class JournalTemplateForm(BSForm):
    class Meta:
        model = JournalTemplate
        fields = ["name", "memo", "ask_partner", "ask_project", "active"]


class TemplateLineForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = JournalTemplateLine
        fields = ["account", "side", "percent", "label", "use_partner", "use_project"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["account"].queryset = posting_accounts()


TemplateLineFormSet = inlineformset_factory(JournalTemplate, JournalTemplateLine, form=TemplateLineForm,
                                            extra=2, can_delete=True)


class UseTemplateForm(BSPlainForm):
    date = forms.DateField(label="التاريخ")
    amount = forms.DecimalField(label="المبلغ", max_digits=16, decimal_places=2, min_value=Decimal("0.01"))
    memo = forms.CharField(label="البيان", max_length=300, required=False)
    reference = forms.CharField(label="المرجع", max_length=100, required=False)
    partner = forms.ModelChoiceField(label="جهة التعامل", queryset=Partner.objects.filter(active=True),
                                     required=False)
    project = forms.ModelChoiceField(label="المشروع", queryset=None, required=False)
    cost_center = forms.ModelChoiceField(label="مركز التكلفة", queryset=CostCenter.objects.filter(active=True),
                                         required=False)
    post_now = forms.BooleanField(label="ترحيل فوري", required=False, initial=True)

    def __init__(self, *args, template=None, **kwargs):
        super().__init__(*args, **kwargs)
        from contracting.models import Project
        self.fields["project"].queryset = Project.objects.exclude(status="closed")
        self.template = template
        if template is not None:
            self.fields["partner"].required = template.ask_partner
            self.fields["project"].required = template.ask_project


class MappingForm(BSPlainForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current = {m.role: m.account_id for m in AccountMapping.objects.all()}
        for role, label in AccountMapping.ROLES:
            self.fields[role] = forms.ModelChoiceField(label=label, queryset=posting_accounts(),
                                                       required=False, initial=current.get(role))
            self.fields[role].widget.attrs["class"] = "form-select form-select-sm searchable"


class YearCloseForm(BSPlainForm):
    date_from = forms.DateField(label="من تاريخ")
    date_to = forms.DateField(label="إلى تاريخ (تاريخ قيد الإقفال)")
    lock = forms.BooleanField(label="إقفال الفترة بعد إنشاء القيد", required=False, initial=True)
