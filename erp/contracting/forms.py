from django import forms
from django.forms import inlineformset_factory

from accounting.models import Account, Partner, Tax
from accounting.ui import BSForm, BootstrapMixin

from .models import BOQItem, Certificate, CertificateDeduction, CertificateLine, Contract, Project, RetentionRelease


class ProjectForm(BSForm):
    class Meta:
        model = Project
        fields = ["code", "name", "customer", "location", "manager", "budget", "start_date", "end_date", "status",
                  "cost_center", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["customer"].queryset = Partner.objects.filter(type__in=("customer", "both"))


class ContractForm(BSForm):
    class Meta:
        model = Contract
        fields = ["kind", "title", "project", "partner", "date", "start_date", "end_date", "retention_pct",
                  "advance_amount", "advance_recovery_pct", "vat", "wht", "social_ins_pct", "vat_on_net", "status",
                  "payment_terms", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        kind = self.initial.get("kind") or self.instance.kind or self.data.get("kind")
        self.fields["kind"].widget = forms.HiddenInput()
        if kind == "sub":
            self.fields["partner"].queryset = Partner.objects.filter(type__in=("subcontractor", "supplier"))
            self.fields["partner"].label = "مقاول الباطن"
        else:
            self.fields["partner"].queryset = Partner.objects.filter(type__in=("customer", "both"))
            self.fields["partner"].label = "العميل (المالك)"
        self.fields["vat"].queryset = Tax.objects.filter(kind="vat", active=True)
        self.fields["wht"].queryset = Tax.objects.filter(kind="wht", active=True)


class BOQItemForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = BOQItem
        fields = ["code", "description", "unit", "quantity", "unit_price", "is_variation"]
        widgets = {"description": forms.TextInput()}


BOQFormSet = inlineformset_factory(Contract, BOQItem, form=BOQItemForm, extra=3, can_delete=True)


class NewCertificateForm(BootstrapMixin, forms.Form):
    contract = forms.ModelChoiceField(label="العقد", queryset=Contract.objects.none())
    date = forms.DateField(label="تاريخ المستخلص")

    def __init__(self, *args, kind="client", **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["contract"].queryset = Contract.objects.filter(kind=kind, status="active").select_related(
            "partner", "project")
        self.fields["contract"].label_from_instance = lambda c: f"{c.number} - {c.partner} - {c.project.name}"


class CertificateForm(BSForm):
    class Meta:
        model = Certificate
        fields = ["date", "period_from", "period_to", "is_final", "auto_deductions", "retention_amount",
                  "advance_recovery", "wht_amount", "social_ins_amount", "notes"]


class CertificateLineForm(BootstrapMixin, forms.ModelForm):
    cumulative_qty = forms.DecimalField(label="الكمية التراكمية", required=False, max_digits=14, decimal_places=3)

    class Meta:
        model = CertificateLine
        fields = ["current_qty", "completion_pct"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["cumulative_qty"].initial = self.instance.cumulative_qty

    def clean(self):
        data = super().clean()
        cum = data.get("cumulative_qty")
        # إذا عدّل المستخدم الكمية التراكمية تُحسب الحالية منها
        if cum is not None and cum != self.instance.cumulative_qty:
            data["current_qty"] = cum - self.instance.prev_qty
            self.instance.current_qty = data["current_qty"]
        return data


CertLineFormSet = inlineformset_factory(Certificate, CertificateLine, form=CertificateLineForm, extra=0,
                                        can_delete=False)


class DeductionForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = CertificateDeduction
        fields = ["description", "account", "amount"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["account"].queryset = Account.objects.filter(is_group=False, active=True)


DeductionFormSet = inlineformset_factory(Certificate, CertificateDeduction, form=DeductionForm, extra=1,
                                         can_delete=True)


class RetentionReleaseForm(BSForm):
    class Meta:
        model = RetentionRelease
        fields = ["date", "amount", "notes"]
