# -*- coding: utf-8 -*-
"""
يبني ملفات المحتوى JSON داخل app/src/main/assets/content ويتحقق من سلامتها:
- كل درس في المسارات موجود ومعرّف مرة واحدة
- إجابات الأسئلة ضمن الخيارات
- القيود المحاسبية متوازنة
- المصادر المشار إليها موجودة

التشغيل:  python3 content-src/build.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import archiving
import basics
import contracting
import extras_archiving
import extras_basics
import extras_contracting
import general
import other
from glossary import TERMS
from sources import SOURCES

OUT = os.path.join(HERE, "..", "app", "src", "main", "assets", "content")

TRACKS = [
    dict(id="basics", title="أساسيات المحاسبة", icon="school", color="#2E7D32",
         subtitle="من الصفر: المعادلة المحاسبية، القيود، الدفاتر، القوائم المالية — لحديث التخرج والمبتدئ.",
         units=[
             dict(title="المدخل", lessons=["b01", "b02", "b03", "b04"]),
             dict(title="التسجيل والتسويات", lessons=["b05", "b06", "b07", "b08"]),
             dict(title="القوائم والتحليل", lessons=["b09", "b10", "b11", "b12"]),
         ]),
    dict(id="contracting", title="محاسبة المقاولات", icon="construction", color="#1F3A5F",
         subtitle="IFRS 15 ونسبة الإنجاز، المستخلصات، المحتجزات، أوامر التغيير، الباطن، المعدات، الزكاة والضريبة.",
         units=[
             dict(title="طبيعة نشاط المقاولات", lessons=["c01", "c02", "c03", "c04"]),
             dict(title="الإيراد والعقود (IFRS 15)", lessons=["c05", "c06", "c07", "c08", "c09", "c10", "c11"]),
             dict(title="التكاليف والموارد", lessons=["c12", "c13", "c14", "c15"]),
             dict(title="الضمانات والضرائب والعقود الحكومية", lessons=["c16", "c17", "c18", "c19"]),
             dict(title="التقارير والرقابة والإقفال", lessons=["c20", "c21", "c22", "c23"]),
         ]),
    dict(id="skills", title="مهارات المحاسب العملية", icon="calc", color="#6A4C93",
         subtitle="لكل محاسب في أي شركة: الإقفال الشهري، الذمم والمخصصات، العهد والموردون، الموازنات، وExcel.",
         units=[
             dict(title="العمليات الشهرية", lessons=["g01", "g02", "g03"]),
             dict(title="التخطيط والأدوات", lessons=["g04", "g05"]),
         ]),
    dict(id="archiving", title="الأرشفة وتنظيم المستندات", icon="archive", color="#9A6B00",
         subtitle="الأرشفة الورقية والإلكترونية في شركات المقاولات: الهيكل، الترميز، مدد الحفظ، الأنظمة والأمن.",
         units=[
             dict(title="المبادئ", lessons=["a01", "a02"]),
             dict(title="الأرشفة الورقية", lessons=["a03", "a04"]),
             dict(title="الأرشفة الإلكترونية", lessons=["a05", "a06", "a07", "a08"]),
         ]),
    dict(id="sectors", title="محاسبة القطاعات الأخرى", icon="business", color="#2E7D7A", comingSoon=True,
         subtitle="مدخل للشركات التجارية والصناعية والخدمية — يتوسع في الإصدارات القادمة.",
         units=[dict(title="مدخل", lessons=["o01", "o02", "o03"])]),
]

FILES = {
    "lessons_1_basics.json": basics.LESSONS,
    "lessons_2_contracting.json": contracting.LESSONS,
    "lessons_3_archiving.json": archiving.LESSONS,
    "lessons_4_sectors.json": other.LESSONS,
    "lessons_5_skills.json": general.LESSONS,
}

EXTRAS = {**extras_basics.EXTRAS, **extras_contracting.EXTRAS, **extras_archiving.EXTRAS, **general.EXTRAS}


def enrich(lesson):
    """يدمج طرق الفهم الإضافية في الدرس بترتيب تعليمي ثابت:
    الخريطة الذهنية ← ببساطة ← التشبيه ← القاعدة/المخطط/المقارنة/حساب T ← الشرح ← الأخطاء الشائعة ← الخلاصة"""
    x = EXTRAS[lesson["id"]]
    blocks = list(lesson["blocks"])
    head, rest = [], blocks
    if blocks and blocks[0]["type"] == "simple":
        head, rest = [blocks[0]], blocks[1:]
    visual = []
    if x["formula"]:
        t, f, items = x["formula"]
        visual.append(dict(type="formula", title=t, text=f, items=items))
    if x["flow"]:
        t, items = x["flow"]
        visual.append(dict(type="flow", title=t, text="", items=items))
    if x["compare"]:
        t, (h1, h2), rows = x["compare"]
        visual.append(dict(type="compare", title=t, text="", headers=[h1, h2], rows=[list(r) for r in rows]))
    if x["taccount"]:
        t, rows, note = x["taccount"]
        visual.append(dict(type="taccount", title=t, text="", rows=rows, note=note))
    lesson["blocks"] = (
        [dict(type="mindmap", title="الخريطة الذهنية للدرس", text="", map=x["map"])]
        + head
        + [dict(type="analogy", title="", text=x["analogy"])]
        + visual
        + rest
        + [dict(type="mistakes", title="", text="", rows=[list(r) for r in x["mistakes"]])]
        + [dict(type="summary", title="", text="", items=x["summary"])]
    )
    lesson["practice"] = x["practice"]
    return lesson


def validate():
    errors = []
    for ls in FILES.values():
        for l in ls:
            if l["id"] not in EXTRAS:
                errors.append(f"{l['id']}: لا توجد خريطة ذهنية وطرق فهم إضافية")
            else:
                x = EXTRAS[l["id"]]
                if len(x["map"]["c"]) < 3 or not x["analogy"] or len(x["mistakes"]) < 2 or len(x["summary"]) < 3:
                    errors.append(f"{l['id']}: طرق الفهم ناقصة (خريطة ≥3 فروع، تشبيه، خطآن، 3 نقاط خلاصة)")
                for p in x["practice"]:
                    n = len(p["accounts"])
                    if not p["debit"] or not p["credit"] or set(p["debit"]) & set(p["credit"]) or \
                            any(not 0 <= i < n for i in p["debit"] + p["credit"]):
                        errors.append(f"{l['id']}: تمرين غير صالح «{p['scenario'][:30]}»")
    if errors:
        return errors, []
    for ls in FILES.values():
        for l in ls:
            enrich(l)
    src_ids = {s["id"] for s in SOURCES}
    all_lessons = [l for ls in FILES.values() for l in ls]
    ids = [l["id"] for l in all_lessons]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        errors.append(f"معرفات مكررة: {dup}")
    in_tracks = [i for t in TRACKS for u in t["units"] for i in u["lessons"]]
    for i in set(in_tracks) - set(ids):
        errors.append(f"درس في المسارات غير موجود: {i}")
    for i in set(ids) - set(in_tracks):
        errors.append(f"درس غير مضاف لأي مسار: {i}")
    for l in all_lessons:
        if l["track"] not in {t["id"] for t in TRACKS}:
            errors.append(f"{l['id']}: مسار غير معروف {l['track']}")
        for s in l["sources"]:
            if s not in src_ids:
                errors.append(f"{l['id']}: مصدر غير معرف {s}")
        for qq in l["quiz"]:
            if not 0 <= qq["answer"] < len(qq["options"]):
                errors.append(f"{l['id']}: إجابة خارج النطاق في «{qq['q']}»")
            if len(set(qq["options"])) != len(qq["options"]):
                errors.append(f"{l['id']}: خيارات مكررة في «{qq['q']}»")
        for b in l["blocks"]:
            if b["type"] == "entry":
                d = sum(x[1] for x in b["lines"])
                c = sum(x[2] for x in b["lines"])
                if abs(d - c) > 0.01:
                    errors.append(f"{l['id']}: قيد غير متوازن «{b['title']}» ({d} ≠ {c})")
            if b["type"] in ("table", "compare", "taccount"):
                widths = {len(r) for r in b["rows"]}
                if b.get("headers"):
                    widths.add(len(b.get("headers")))
                if len(widths) > 1:
                    errors.append(f"{l['id']}: أعمدة غير متساوية في جدول «{b['title']}»")
    return errors, all_lessons


def main():
    errors, all_lessons = validate()
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name.endswith(".json"):
            os.remove(os.path.join(OUT, name))

    def dump(name, data):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)

    dump("tracks.json", TRACKS)
    for name, ls in FILES.items():
        dump(name, ls)
    dump("glossary.json", [{"ar": a, "en": e, "def": d, "cat": c} for a, e, d, c in TERMS])
    dump("sources.json", SOURCES)
    q = sum(len(l["quiz"]) for l in all_lessons)
    print(f"✔ {len(all_lessons)} درساً، {q} سؤالاً، {len(TERMS)} مصطلحاً، {len(SOURCES)} مصدراً")


if __name__ == "__main__":
    main()
