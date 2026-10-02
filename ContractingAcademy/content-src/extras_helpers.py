# -*- coding: utf-8 -*-
"""أدوات كتابة «طرق الفهم» الإضافية لكل درس: خريطة ذهنية، تشبيه، مخطط، مقارنة، أخطاء شائعة، خلاصة، تمارين."""


def mm(root, *branches):
    """خريطة ذهنية: mm("الجذر", ("فرع", ["ورقة", "ورقة"]), ...)"""
    return {"t": root, "c": [{"t": b, "c": [{"t": l} for l in leaves]} for b, leaves in branches]}


def P(scenario, accounts, debit, credit, explain):
    """تمرين قيد: debit/credit قوائم بأرقام الحسابات (من صفر)."""
    return dict(scenario=scenario, accounts=accounts, debit=list(debit), credit=list(credit), explain=explain)


def E(map, analogy, mistakes, summary, flow=None, compare=None, formula=None, taccount=None, practice=None):
    return dict(map=map, analogy=analogy, mistakes=mistakes, summary=summary, flow=flow,
                compare=compare, formula=formula, taccount=taccount, practice=practice or [])
