# -*- coding: utf-8 -*-
"""بناء درس كامل مع طرق الفهم في استدعاء واحد (للمسارات الجديدة)."""
from helpers import lesson, simple, example, entry, tip, warn, expert, points, table, steps, text, q, B, I, X
from extras_helpers import E, P, mm


def scene(left, right, moves, caption="", title=""):
    """صورة العملية: moves = [("→", "💵", "نقدية 100,000"), ("←", "📦", "بضاعة")]"""
    return dict(type="scene", title=title, text=caption, headers=[left, right], rows=[list(m) for m in moves])


def bars(title, rows, caption=""):
    """rows = [("الأصول", 3500000), ("الخصوم", 500000, 3)] — الرقم الثالث اختياري للون"""
    return dict(type="bars", title=title, text=caption, rows=[[str(x) for x in r] for r in rows])


def full(id, track, title, level, minutes, one, *, simple_t, analogy, blocks, map, mistakes, takeaways, quiz,
         sources, code="", pic=None, practice=None, flow=None, compare=None, formula=None, taccount=None):
    """one = التعريف في جملة واحدة (يظهر في رأس الدرس)"""
    body = [simple(simple_t)] + ([pic] if pic else []) + blocks
    les = lesson(id, track, title, level, minutes, one, body, sources, quiz)
    les["code"] = code
    ex = E(map, analogy, mistakes, takeaways, flow=flow, compare=compare, formula=formula, taccount=taccount, practice=practice)
    return les, ex


def collect(items):
    """[(lesson, extras)] ← (LESSONS, EXTRAS)"""
    return [l for l, _ in items], {l["id"]: x for l, x in items}
