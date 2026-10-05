from django import forms
from django.forms import inlineformset_factory

from accounting.models import Account, Partner, Tax
from accounting.ui import BSForm, BootstrapMixin

from .models import (Invoice, InvoiceLine, Payment, Product, StockDocument, StockDocumentLine, Transfer,
                     Warehouse)


class WarehouseForm(BSForm):
    class Meta:
        model = Warehouse
        fields = ["code", "name", "project", "active"]


class ProductForm(BSForm):
    class Meta:
        model = Product
        fields = ["code", "name", "type", "unit", "barcode", "sale_price", "purchase_price", "sale_tax",
                  "purchase_tax", "income_account", "expense_account", "min_qty", "active"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["income_account"].queryset = Account.objects.filter(is_group=False, type="income")
        self.fields["expense_account"].queryset = Account.objects.filter(is_group=False,
                                                                         type__in=("expense", "asset"))


class InvoiceForm(BSForm):
    class Meta:
        model = Invoice
        fields = ["kind", "partner", "date", "due_date", "reference", "origin", "project", "cost_center",
                  "warehouse", "wht", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        kind = self.initial.get("kind") or self.instance.kind or self.data.get("kind") or "sale"
        self.fields["kind"].widget = forms.HiddenInput()
        side = "sale" if kind.startswith("sale") else "purchase"
        if side == "sale":
            self.fields["partner"].queryset = Partner.objects.filter(active=True).exclude(type__in=("supplier",
                                                                                                  "subcontractor"))
            self.fields["partner"].label = "العميل"
        else:
            self.fields["partner"].queryset = Partner.objects.filter(active=True).exclude(type="customer")
            self.fields["partner"].label = "المورد"
        self.fields["wht"].queryset = Tax.objects.filter(kind="wht", active=True)
        if kind.endswith("return"):
            base = "sale" if side == "sale" else "purchase"
            self.fields["origin"].queryset = Invoice.objects.filter(kind=base, state="posted")
        else:
            del self.fields["origin"]


class InvoiceLineForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = InvoiceLine
        fields = ["product", "description", "account", "qty", "unit_price", "discount_pct", "vat", "project"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["account"].queryset = Account.objects.filter(is_group=False, active=True)
        self.fields["vat"].queryset = Tax.objects.filter(kind="vat", active=True)
        self.fields["product"].queryset = Product.objects.filter(active=True)
        self.fields["description"].widget.attrs["class"] += " smart-text"
        self.fields["description"].widget.attrs["autocomplete"] = "off"


InvoiceLineFormSet = inlineformset_factory(Invoice, InvoiceLine, form=InvoiceLineForm, extra=1, can_delete=True)


class PaymentForm(BSForm):
    class Meta:
        model = Payment
        fields = ["kind", "date", "purpose", "partner", "treasury", "amount", "counter_account", "invoice",
                  "contract", "certificate", "project", "cost_center", "method", "cheque_no", "cheque_date", "memo"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["kind"].widget = forms.HiddenInput()
        kind = self.initial.get("kind") or self.instance.kind or self.data.get("kind") or "receipt"
        self.fields["treasury"].queryset = Account.objects.filter(kind__in=("cash", "bank"), is_group=False,
                                                                  active=True)
        self.fields["counter_account"].queryset = Account.objects.filter(is_group=False, active=True)
        self.fields["partner"].queryset = Partner.objects.filter(active=True)
        inv_kind = "sale" if kind == "receipt" else "purchase"
        self.fields["invoice"].queryset = Invoice.objects.filter(state="posted", kind=inv_kind)
        from contracting.models import Certificate, Contract
        ckind = "client" if kind == "receipt" else "sub"
        self.fields["contract"].queryset = Contract.objects.filter(kind=ckind)
        self.fields["certificate"].queryset = Certificate.objects.filter(state="posted", contract__kind=ckind)
        self.fields["memo"].widget.attrs["class"] += " smart-text"


class TransferForm(BSForm):
    class Meta:
        model = Transfer
        fields = ["date", "from_account", "to_account", "amount", "memo"]


class StockDocumentForm(BSForm):
    class Meta:
        model = StockDocument
        fields = ["kind", "date", "warehouse", "project", "counter_account", "notes"]


class StockLineForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = StockDocumentLine
        fields = ["product", "qty", "unit_cost"]


StockLineFormSet = inlineformset_factory(StockDocument, StockDocumentLine, form=StockLineForm, extra=2,
                                         can_delete=True)
