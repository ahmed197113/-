"""تفقيط المبالغ بالعربية (تحويل الرقم إلى كلمات)."""
from decimal import Decimal, ROUND_HALF_UP

ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
        "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر",
        "ثمانية عشر", "تسعة عشر"]
TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]
HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة",
            "تسعمائة"]
# (مفرد، مثنى، جمع)
SCALES = [None, ("ألف", "ألفان", "آلاف"), ("مليون", "مليونان", "ملايين"), ("مليار", "ملياران", "مليارات")]


def _below_thousand(n):
    parts = []
    h, rest = divmod(n, 100)
    if h:
        parts.append(HUNDREDS[h])
    if rest:
        if rest < 20:
            parts.append(ONES[rest])
        else:
            t, o = divmod(rest, 10)
            parts.append(f"{ONES[o]} و{TENS[t]}" if o else TENS[t])
    return " و".join(parts)


def number_to_words(n):
    n = int(n)
    if n == 0:
        return "صفر"
    groups = []
    i = 0
    while n > 0:
        n, g = divmod(n, 1000)
        if g:
            if i == 0:
                groups.append(_below_thousand(g))
            else:
                one, two, many = SCALES[i]
                if g == 1:
                    groups.append(one)
                elif g == 2:
                    groups.append(two)
                elif 3 <= g <= 10:
                    groups.append(f"{_below_thousand(g)} {many}")
                elif 11 <= g % 100 <= 99:
                    groups.append(f"{_below_thousand(g)} {one}ًا")
                elif 3 <= g % 100 <= 10:
                    groups.append(f"{_below_thousand(g)} {many}")
                else:
                    groups.append(f"{_below_thousand(g)} {one}")
        i += 1
    return " و".join(reversed(groups))


def amount_to_words(amount, currency="جنيه", sub="قرش"):
    amount = Decimal(amount or 0).quantize(Decimal("0.01"), ROUND_HALF_UP)
    neg = amount < 0
    amount = abs(amount)
    whole = int(amount)
    frac = int((amount - whole) * 100)
    text = f"{number_to_words(whole)} {currency}"
    if frac:
        text += f" و{number_to_words(frac)} {sub}"
    text = "فقط " + text + " لا غير"
    return ("سالب " + text) if neg else text
