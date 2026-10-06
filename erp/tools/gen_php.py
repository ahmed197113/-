"""
مولّد ملفات PHP للإضافة من كود Django نفسه (المرجع):
- schema.php : تعريف الجداول (أعمدة، مفاتيح، فهارس، مفاتيح أجنبية بنفس سلوك on_delete)
- meta.php   : المسميات العربية والاختيارات (choices) لكل حقل
- seed.php   : شجرة الحسابات، التوجيه المحاسبي، الضرائب، القيود الجاهزة، بادئات الترقيم
الاستخدام:  python tools/gen_php.py ../wp-plugin/erp-metal-lines/includes/generated
"""
import json
import os
import re
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.apps import apps  # noqa: E402
from django.db import models  # noqa: E402
from django.db.models import NOT_PROVIDED  # noqa: E402

APPS = ["accounting", "commerce", "contracting", "assets"]
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def snake(name):
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "_", name).lower()


def table(model):
    return snake(model.__name__)


def php(v, indent=0):
    """تحويل قيمة Python إلى صيغة PHP."""
    pad = "    " * indent
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, str):
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'"
    if isinstance(v, (list, tuple)):
        if not v:
            return "[]"
        inner = ",\n".join(pad + "    " + php(x, indent + 1) for x in v)
        return "[\n" + inner + ",\n" + pad + "]"
    if isinstance(v, dict):
        if not v:
            return "[]"
        inner = ",\n".join(pad + "    " + php(k) + " => " + php(x, indent + 1) for k, x in v.items())
        return "[\n" + inner + ",\n" + pad + "]"
    return php(str(v))


models_list = [m for a in APPS for m in apps.get_app_config(a).get_models()]
MODEL_TABLE = {m: table(m) for m in models_list}
ON_DELETE = {"PROTECT": "RESTRICT", "CASCADE": "CASCADE", "SET_NULL": "SET NULL"}


def default_sql(f):
    if f.default is NOT_PROVIDED or callable(f.default):
        return None
    d = f.default
    if isinstance(f, models.BooleanField):
        return "1" if d else "0"
    if isinstance(f, models.DecimalField):
        return "'" + format(django.utils.numberformat.format(d, ".", f.decimal_places)) + "'"
    if isinstance(f, (models.IntegerField,)):
        return str(int(d))
    return "'" + str(d).replace("'", "''") + "'"


import django.utils.numberformat  # noqa: E402

schema, meta = {}, {}
for M in models_list:
    t = MODEL_TABLE[M]
    cols, keys, fks, uniques = [], [], [], []
    fmeta = {}
    for f in M._meta.concrete_fields:
        col = f.column
        null = "NULL" if f.null else "NOT NULL"
        info = dict(label=str(f.verbose_name), column=col)
        if isinstance(f, models.BigAutoField):
            cols.append(f"{col} bigint(20) NOT NULL AUTO_INCREMENT")
            info["type"] = "id"
        elif isinstance(f, models.ForeignKey):
            target = f.remote_field.model
            info.update(type="fk", null=f.null, on_delete=f.remote_field.on_delete.__name__)
            if target._meta.app_label == "auth":
                cols.append(f"{col} bigint(20) unsigned {null}")
                info["target"] = "wp_users"
                keys.append(f"KEY {col} ({col})")
            else:
                cols.append(f"{col} bigint(20) {null}")
                info["target"] = MODEL_TABLE[target]
                keys.append(f"KEY {col} ({col})")
                fks.append(dict(column=col, table=MODEL_TABLE[target],
                                on_delete=ON_DELETE[f.remote_field.on_delete.__name__]))
        elif isinstance(f, models.DecimalField):
            d = default_sql(f)
            cols.append(f"{col} decimal({f.max_digits},{f.decimal_places}) {null}" + (f" DEFAULT {d}" if d else ""))
            info.update(type="decimal", digits=f.max_digits, places=f.decimal_places)
        elif isinstance(f, models.BooleanField):
            cols.append(f"{col} tinyint(1) NOT NULL DEFAULT {default_sql(f) or '0'}")
            info["type"] = "bool"
        elif isinstance(f, models.DateTimeField):
            cols.append(f"{col} datetime(6) {null}")
            info["type"] = "datetime"
        elif isinstance(f, models.DateField):
            cols.append(f"{col} date {null}")
            info["type"] = "date"
        elif isinstance(f, models.PositiveSmallIntegerField):
            d = default_sql(f)
            cols.append(f"{col} smallint(5) unsigned {null}" + (f" DEFAULT {d}" if d else ""))
            info["type"] = "int"
        elif isinstance(f, models.PositiveIntegerField):
            d = default_sql(f)
            cols.append(f"{col} int(10) unsigned {null}" + (f" DEFAULT {d}" if d else ""))
            info["type"] = "int"
        elif isinstance(f, models.TextField):
            cols.append(f"{col} longtext {null}")
            info["type"] = "text"
        elif isinstance(f, models.CharField):  # يشمل EmailField
            d = default_sql(f)
            cols.append(f"{col} varchar({f.max_length}) {null}" + (f" DEFAULT {d}" if d else " DEFAULT ''"))
            info.update(type="char", max_length=f.max_length)
        else:
            raise SystemExit(f"نوع حقل غير مدعوم: {M.__name__}.{f.name} {type(f).__name__}")
        if f.choices:
            info["choices"] = {str(k): str(v) for k, v in f.choices}
        if f.unique and not f.primary_key:
            uniques.append(f"UNIQUE KEY {col} ({col})")
        fmeta[f.name] = info
    for ut in M._meta.unique_together:
        c = [M._meta.get_field(n).column for n in ut]
        uniques.append(f"UNIQUE KEY {'_'.join(c)} ({','.join(c)})")
    for idx in M._meta.indexes:
        c = [M._meta.get_field(n).column for n in idx.fields]
        keys.append(f"KEY {'_'.join(c)} ({','.join(c)})")
    # فهارس أداء إضافية على التاريخ والحالة
    for extra in ("date", "state", "kind", "type", "status"):
        if extra in fmeta and fmeta[extra]["type"] in ("date", "char"):
            keys.append(f"KEY {extra} ({extra})")
    # إزالة فهرس عادي لعمود له فهرس فريد بنفس الاسم
    uniq_cols = {u.split("(")[1].rstrip(")") for u in uniques}
    keys = [k for k in dict.fromkeys(keys) if k.split("(")[1].rstrip(")") not in uniq_cols]
    schema[t] = dict(columns=cols, primary="id", uniques=uniques, keys=keys, fks=fks,
                     django_table=M._meta.db_table, model=M.__name__, app=M._meta.app_label)
    meta[t] = dict(model=M.__name__, app=M._meta.app_label, verbose=str(M._meta.verbose_name),
                   verbose_plural=str(M._meta.verbose_name_plural), ordering=list(M._meta.ordering),
                   fields=fmeta)

# ترتيب الجداول حسب الاعتماد (الجداول المرجعية أولاً) - مطلوب للاستيراد وإنشاء المفاتيح الأجنبية
order, seen = [], set()


def visit(t, stack=()):
    if t in seen:
        return
    for fk in schema[t]["fks"]:
        if fk["table"] != t and fk["table"] not in stack:
            visit(fk["table"], stack + (t,))
    seen.add(t)
    order.append(t)


for t in schema:
    visit(t)

header = "<?php\n// ملف مُولّد آلياً من كود Django المرجعي بواسطة erp/tools/gen_php.py — لا تعدّله يدوياً.\ndefined('ABSPATH') || exit;\n\n"
with open(os.path.join(OUT, "schema.php"), "w", encoding="utf-8") as fh:
    fh.write(header + "return " + php(dict(order=order, tables=schema)) + ";\n")
with open(os.path.join(OUT, "meta.php"), "w", encoding="utf-8") as fh:
    fh.write(header + "return " + php(meta) + ";\n")

# ---------------------------------------------------------------- بيانات التهيئة
from accounting import seed  # noqa: E402
from accounting.models import AccountMapping, Sequence  # noqa: E402

seed_data = dict(
    coa=[list(x) for x in seed.COA],
    mappings=seed.MAPPINGS,
    taxes=[list(x) for x in seed.TAXES],
    templates=[dict(name=n, memo=m, lines=[list(ln) for ln in lines], ask_partner=ap, ask_project=apr)
               for n, m, lines, ap, apr in seed.TEMPLATES],
    roles=[list(r) for r in AccountMapping.ROLES],
    sequence_defaults=Sequence.DEFAULTS,
    company_defaults=dict(name="الخطوط المعدنية للمقاولات العامة", currency="ج.م", currency_name="جنيه",
                          currency_sub="قرش"),
    default_warehouse=dict(code="WH1", name="المخزن الرئيسي"),
)
# النسب في القيود الجاهزة أرقام صحيحة/عشرية - تُكتب كنص للحفاظ على الدقة
for tpl in seed_data["templates"]:
    for ln in tpl["lines"]:
        ln[2] = str(ln[2])
with open(os.path.join(OUT, "seed.php"), "w", encoding="utf-8") as fh:
    fh.write(header + "return " + php(seed_data) + ";\n")

print(json.dumps(dict(tables=len(schema), order=order), ensure_ascii=False))
