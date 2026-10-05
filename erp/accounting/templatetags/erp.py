from decimal import Decimal, InvalidOperation

from django import template
from django.utils.safestring import mark_safe

from accounting.tafqeet import amount_to_words

register = template.Library()


def _dec(v):
    try:
        return Decimal(v or 0)
    except (InvalidOperation, TypeError, ValueError):
        return None


@register.filter
def money(v, places=2):
    """تنسيق المبالغ: فواصل آلاف ورقمين عشريين، والسالب بين أقواس."""
    d = _dec(v)
    if d is None:
        return v
    places = int(places)
    if d == 0:
        return "-"
    s = f"{abs(d):,.{places}f}"
    return f"({s})" if d < 0 else s


@register.filter
def money0(v):
    """نفس money لكن يعرض الصفر 0.00 بدلاً من الشرطة."""
    d = _dec(v)
    if d is None:
        return v
    s = f"{abs(d):,.2f}"
    return f"({s})" if d < 0 else s


@register.filter
def qty(v):
    d = _dec(v)
    if d is None:
        return v
    s = f"{d:,.3f}".rstrip("0").rstrip(".")
    return s or "0"


@register.filter
def pct(v):
    d = _dec(v)
    if d is None:
        return v
    return f"{d:,.1f}%"


@register.filter
def tafqeet(v, company=None):
    if company is not None:
        return amount_to_words(v, company.currency_name, company.currency_sub)
    return amount_to_words(v)


@register.filter
def neg(v):
    d = _dec(v)
    return -d if d is not None else v


@register.filter
def get_item(d, key):
    return d.get(key) if hasattr(d, "get") else None


@register.simple_tag(takes_context=True)
def active(context, *prefixes):
    path = context["request"].path
    return "active" if any(path.startswith(p) for p in prefixes) else ""


@register.filter
def state_badge(state):
    colors = {"draft": ("secondary", "مسودة"), "posted": ("success", "مرحّل"), "cancelled": ("danger", "ملغي")}
    c, t = colors.get(state, ("light", state))
    return mark_safe(f'<span class="badge text-bg-{c}">{t}</span>')
