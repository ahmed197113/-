# -*- coding: utf-8 -*-
"""
تجهيز الملف للفتح المباشر على Excel (2016/2019/365):
  1) ترتيب عناصر الخطوط في styles.xml حسب مخطط OOXML الرسمي.
  2) حساب جميع المعادلات مسبقاً (مكتبة formulas) وتخزين القيم داخل الملف،
     حتى تظهر الأرقام فوراً حتى في "طريقة العرض المحمية" قبل تمكين التحرير.
الاستخدام: python finalize_workbook.py file1.xlsx [file2.xlsx ...]
"""
import os
import re
import sys
import shutil
import zipfile
import tempfile
from xml.sax.saxutils import escape

FONT_ORDER = ["b", "i", "strike", "condense", "extend", "outline", "shadow", "u", "vertAlign", "sz", "color",
              "name", "family", "charset", "scheme"]


def fix_fonts(xml):
    def reorder(m):
        body = m.group(1)
        parts = re.findall(r"(<(\w+)\b[^>]*/>|<(\w+)\b[^>]*>.*?</\3>)", body, re.S)
        parts.sort(key=lambda p: FONT_ORDER.index(p[1] or p[2]) if (p[1] or p[2]) in FONT_ORDER else 99)
        return "<font>" + "".join(p[0] for p in parts) + "</font>"
    return re.sub(r"<font>(.*?)</font>", reorder, xml, flags=re.S)


def compute(path):
    import formulas
    from formulas.functions import XlError
    sol = formulas.ExcelModel().loads(path).finish().calculate()
    out = {}
    for k, v in sol.items():
        m = re.match(r"^'\[[^\]]+\](.+)'!([A-Z]+\d+)$", k)
        if not m:
            continue
        try:
            val = v.value[0, 0]
        except Exception:
            continue
        out[(m.group(1), m.group(2))] = val
    return out, XlError


def cell_xml(attrs, formula, val, XlError):
    attrs = re.sub(r'\s+t="[^"]*"', "", attrs)
    s = str(val)
    if isinstance(val, XlError) or (isinstance(val, str) and s.startswith("#") and s != "#EMPTY"):
        return f'<c{attrs} t="e"><f>{formula}</f><v>{escape(s)}</v></c>'
    if isinstance(val, bool):
        return f'<c{attrs} t="b"><f>{formula}</f><v>{int(val)}</v></c>'
    if isinstance(val, str):
        if s == "empty":
            return f"<c{attrs}><f>{formula}</f><v>0</v></c>"
        return f'<c{attrs} t="str"><f>{formula}</f><v>{escape(s)}</v></c>'
    try:
        num = float(val)
        txt = repr(int(num)) if num.is_integer() and abs(num) < 1e15 else repr(num)
        return f"<c{attrs}><f>{formula}</f><v>{txt}</v></c>"
    except Exception:
        if s == "empty":
            return f"<c{attrs}><f>{formula}</f><v>0</v></c>"
        return f'<c{attrs} t="str"><f>{formula}</f><v>{escape(s)}</v></c>'


def finalize(path):
    values, XlError = compute(path)
    upper = {(sh.upper(), c): v for (sh, c), v in values.items()}
    z = zipfile.ZipFile(path)
    wb = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    rid2file = {m.group(1): m.group(2) for m in re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels)}
    rid2file.update({m.group(2): m.group(1) for m in re.finditer(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    file2sheet = {}
    for m in re.finditer(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
        name = m.group(1).replace("&amp;", "&")
        target = rid2file[m.group(2)].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        file2sheet[target] = name
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx").name
    missing = 0
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for item in z.infolist():
            data = z.read(item.filename)
            if item.filename == "xl/styles.xml":
                data = fix_fonts(data.decode("utf-8")).encode("utf-8")
            elif item.filename in file2sheet:
                sheet = file2sheet[item.filename].upper()
                xml = data.decode("utf-8")

                def sub(m):
                    nonlocal missing
                    attrs, formula = m.group(1), m.group(3)
                    ref = re.search(r'r="([A-Z]+\d+)"', attrs).group(1)
                    key = (sheet, ref)
                    if key not in upper:
                        missing += 1
                        return m.group(0)
                    return cell_xml(attrs, formula, upper[key], XlError)
                xml = re.sub(r"<c(\s[^>]*?)>(<f>(.*?)</f>)(?:<v\s*/>|<v></v>)</c>", sub, xml, flags=re.S)
                data = xml.encode("utf-8")
            if item.filename.endswith(".xml"):
                # الألوان بصيغة ARGB: البادئة 00 تعني شفافاً تماماً في بعض إصدارات Excel -> نجعلها معتمة FF
                data = re.sub(rb'rgb="00([0-9A-Fa-f]{6})"', rb'rgb="FF\1"', data)
            out.writestr(item, data)
    z.close()
    shutil.move(tmp, path)
    os.chmod(path, 0o644)
    print(f"finalized {path}: {len(values)} values, {missing} formulas without value")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        finalize(p)
