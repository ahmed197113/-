# -*- coding: utf-8 -*-
"""دوال مساعدة لكتابة الدروس بشكل مختصر. الناتج يُحوَّل إلى JSON داخل assets/content."""


def lesson(id, track, title, level, minutes, summary, blocks, sources, quiz):
    return dict(id=id, track=track, title=title, level=level, minutes=minutes,
                summary=summary, blocks=blocks, sources=sources, quiz=quiz)


def simple(text, items=None, title=""):
    return dict(type="simple", title=title, text=text, items=items or [])


def text(title, body, items=None):
    return dict(type="text", title=title, text=body, items=items or [])


def points(title, items, body=""):
    return dict(type="points", title=title, text=body, items=items)


def steps(title, items, body=""):
    return dict(type="steps", title=title, text=body, items=items)


def example(body, title="", items=None):
    return dict(type="example", title=title, text=body, items=items or [])


def entry(title, lines, note=""):
    """lines: [(الحساب، مدين، دائن)]"""
    return dict(type="entry", title=title, lines=[list(l) for l in lines], note=note)


def table(title, headers, rows, body=""):
    return dict(type="table", title=title, text=body, headers=headers, rows=rows)


def tip(body, items=None, title=""):
    return dict(type="tip", title=title, text=body, items=items or [])


def warn(body, items=None, title=""):
    return dict(type="warning", title=title, text=body, items=items or [])


def expert(body, items=None, title=""):
    return dict(type="expert", title=title, text=body, items=items or [])


def tree(title, items, body=""):
    return dict(type="tree", title=title, text=body, items=items)


def q(question, options, answer, explain):
    return dict(q=question, options=options, answer=answer, explain=explain)


B, I, X = "مبتدئ", "متوسط", "خبير"
