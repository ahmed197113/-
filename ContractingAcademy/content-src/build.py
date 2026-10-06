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
import fields
import general
import standards1
import standards2
import other
import pictures
from glossary import TERMS
from sources import SOURCES

OUT = os.path.join(HERE, "..", "app", "src", "main", "assets", "content")

C1, C2, C3, C4, C5 = "① ابدأ هنا: الأساسيات", "② المعايير الدولية IFRS / IAS", "③ مجالات المحاسبة", "④ القطاعات والتخصصات", "⑤ مهارات عملية لكل محاسب"


TRACKS = [
    dict(id="basics", category=C1, title="أساسيات المحاسبة", icon="school", color="#2E7D32",
         subtitle="من الصفر: المعادلة المحاسبية، القيود، الدفاتر، القوائم المالية — لحديث التخرج والمبتدئ.",
         units=[
             dict(title="المدخل", lessons=["b01", "b02", "b03", "b04"]),
             dict(title="التسجيل والتسويات", lessons=["b05", "b06", "b07", "b08"]),
             dict(title="القوائم والتحليل", lessons=["b09", "b10", "b11", "b12"]),
         ]),
    dict(id="standards", category=C2, title="المعايير الدولية بشرح مبسط", icon="verified", color="#2C6FB7",
         subtitle="كل معيار IFRS و IAS في جملة واحدة، مع تشبيه وصورة للعملية ومثال بالأرقام والقيد وأسئلة.",
         units=[
             dict(title="المدخل والعرض والإفصاح", lessons=["s00", "s_ias1", "s_ias8", "s_ias7", "s_ias10", "s_ias34", "s_ifrs1", "s_ias24", "s_ias33", "s_ifrs8"]),
             dict(title="معايير الأصول", lessons=["s_ias2", "s_ias16", "s_ias38", "s_ias40", "s_ias36", "s_ias23", "s_ifrs5", "s_ias41", "s_ifrs6", "s_ias20"]),
             dict(title="الإيرادات والالتزامات", lessons=["s_ifrs15", "s_ifrs16", "s_ias37", "s_ias19", "s_ias12", "s_ifrs2", "s_ias26"]),
             dict(title="الأدوات المالية والقيمة العادلة", lessons=["s_ifrs9", "s_ias32", "s_ifrs7", "s_ifrs13"]),
             dict(title="المجموعات والاستثمارات والعملات", lessons=["s_ifrs3", "s_ifrs10", "s_ifrs11", "s_ias28", "s_ias27", "s_ifrs12", "s_ias21", "s_ias29"]),
             dict(title="معايير خاصة والاستدامة", lessons=["s_ifrs17", "s_ifrs19", "s_sme", "s_issb"]),
         ]),
    dict(id="cost", category=C3, title="محاسبة التكاليف", icon="factory", color="#C0504D",
         subtitle="تصنيف التكاليف، الأوامر، المراحل، ABC، التكاليف المعيارية والانحرافات.",
         units=[dict(title="أساسيات وأنظمة التكاليف", lessons=["k01", "k02", "k03"]), dict(title="أدوات متقدمة", lessons=["k04", "k05"])]),
    dict(id="managerial", category=C3, title="المحاسبة الإدارية", icon="calc", color="#D9772B",
         subtitle="التعادل، القرارات قصيرة الأجل، التسعير، ومؤشرات الأداء — أرقام لاتخاذ القرار.",
         units=[dict(title="التحليل واتخاذ القرار", lessons=["m01", "m02", "m04", "m03"])]),
    dict(id="audit", category=C3, title="المراجعة والتدقيق", icon="verified", color="#3D8B37",
         subtitle="مفهوم المراجعة ومعاييرها، مراحلها، الأدلة والعينات، وتقرير المراجع.",
         units=[dict(title="المراجعة الخارجية", lessons=["r01", "r02", "r03", "r04"])]),
    dict(id="tax", category=C3, title="الضرائب والزكاة", icon="bank", color="#8E5A3C",
         subtitle="ضريبة القيمة المضافة، الزكاة، ضريبة الاستقطاع وضريبة الدخل — لكل المنشآت.",
         units=[dict(title="الالتزامات الضريبية والزكوية", lessons=["t01", "t02", "t03"])]),
    dict(id="corporate", category=C3, title="محاسبة الشركات", icon="business", color="#2C6FB7",
         subtitle="تأسيس الشركات ورأس المال، توزيع الأرباح والاحتياطيات، وشركات الأشخاص.",
         units=[dict(title="حقوق الملكية والشركاء", lessons=["p01", "p02", "p03"])]),
    dict(id="public", category=C3, title="الحكومية وغير الهادفة للربح", icon="gavel", color="#6A4C93",
         subtitle="المحاسبة الحكومية ومعايير IPSAS، والجمعيات والأوقاف.",
         units=[dict(title="القطاع العام والخيري", lessons=["v01", "v02"])]),
    dict(id="contracting", category=C4, title="محاسبة المقاولات", icon="construction", color="#1F3A5F",
         subtitle="IFRS 15 ونسبة الإنجاز، المستخلصات، المحتجزات، أوامر التغيير، الباطن، المعدات، الزكاة والضريبة.",
         units=[
             dict(title="طبيعة نشاط المقاولات", lessons=["c01", "c02", "c03", "c04"]),
             dict(title="الإيراد والعقود (IFRS 15)", lessons=["c05", "c06", "c07", "c08", "c09", "c10", "c11"]),
             dict(title="التكاليف والموارد", lessons=["c12", "c13", "c14", "c15"]),
             dict(title="الضمانات والضرائب والعقود الحكومية", lessons=["c16", "c17", "c18", "c19"]),
             dict(title="التقارير والرقابة والإقفال", lessons=["c20", "c21", "c22", "c23"]),
         ]),
    dict(id="sectors", category=C4, title="قطاعات أخرى", icon="store", color="#2E7D7A",
         subtitle="التجارية، الصناعية، الخدمية، العقارية، الفنادق والمطاعم، المستشفيات.",
         units=[dict(title="القطاعات الأساسية", lessons=["o01", "o02", "o03"]), dict(title="قطاعات متخصصة", lessons=["o04", "o05", "o06"])]),
    dict(id="skills", category=C5, title="مهارات المحاسب العملية", icon="calc", color="#6A4C93",
         subtitle="الإقفال الشهري، الذمم والمخصصات، العهد والموردون، الموازنات، وExcel.",
         units=[
             dict(title="العمليات الشهرية", lessons=["g01", "g02", "g03"]),
             dict(title="التخطيط والأدوات", lessons=["g04", "g05"]),
         ]),
    dict(id="archiving", category=C5, title="الأرشفة وتنظيم المستندات", icon="archive", color="#9A6B00",
         subtitle="الأرشفة الورقية والإلكترونية: الهيكل، الترميز، مدد الحفظ، الأنظمة والأمن.",
         units=[
             dict(title="المبادئ", lessons=["a01", "a02"]),
             dict(title="الأرشفة الورقية", lessons=["a03", "a04"]),
             dict(title="الأرشفة الإلكترونية", lessons=["a05", "a06", "a07", "a08"]),
         ]),
]

FILES = {
    "lessons_1_basics.json": basics.LESSONS,
    "lessons_2_contracting.json": contracting.LESSONS,
    "lessons_3_archiving.json": archiving.LESSONS,
    "lessons_4_sectors.json": other.LESSONS,
    "lessons_5_skills.json": general.LESSONS,
    "lessons_6_standards.json": standards1.LESSONS + standards2.LESSONS,
    "lessons_7_fields.json": [l for l in fields.LESSONS if not l["id"].startswith("o")],
}
FILES["lessons_4_sectors.json"] = other.LESSONS + [l for l in fields.LESSONS if l["id"].startswith("o")]

EXTRAS = {**standards1.EXTRAS, **standards2.EXTRAS, **fields.EXTRAS, **extras_basics.EXTRAS, **extras_contracting.EXTRAS, **extras_archiving.EXTRAS, **general.EXTRAS}


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
    # صور توضيحية إضافية بعد «ببساطة» والتشبيه
    pics = pictures.PICS.get(lesson["id"], [])
    if pics:
        i = next((k for k, b in enumerate(lesson["blocks"]) if b["type"] == "analogy"), 0) + 1
        lesson["blocks"][i:i] = pics
    lesson["quiz"] = lesson["quiz"] + pictures.EXTRA_Q.get(lesson["id"], [])
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
