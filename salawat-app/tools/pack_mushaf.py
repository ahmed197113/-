"""Builds the Madinah Mushaf page layout (King Fahd Complex QCF glyphs, as quran.com renders its Mushaf view):
for every page, its 15 lines with the glyph codes of each word and the ayah they belong to, plus the page
fonts. Output: mushaf_layout.json.gz (bundled) and qcf/p{N}.ttf fonts (downloaded on demand by the app)."""
import gzip, json, os, sys, urllib.request, time, hashlib

OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, "fonts"), exist_ok=True)
log = open(os.path.join(OUT, "mushaf-pack.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 rafiq"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))

VERSION = os.environ.get("QCF", "v2")
code_field = "code_v2" if VERSION == "v2" else "code_v1"
pages = {}
for page in range(1, 605):
    d = json.loads(get(f"https://api.quran.com/api/v4/verses/by_page/{page}?words=true&per_page=300"
                       f"&word_fields={code_field},line_number,page_number,char_type_name,text_uthmani&fields=verse_key"))
    lines = {}
    for v in d["verses"]:
        for w in v["words"]:
            if VERSION == "v2" and w.get("v2_page") and w["v2_page"] != page: pass
            ln = w["line_number"]
            lines.setdefault(ln, []).append([w[code_field], v["verse_key"], 1 if w["char_type_name"] == "end" else 0])
    pages[page] = {str(k): lines[k] for k in sorted(lines)}
    if page % 50 == 0 or page < 4:
        p("page", page, "lines", sorted(lines), "words", sum(len(x) for x in lines.values()))
json_bytes = json.dumps(pages, ensure_ascii=False, separators=(",", ":")).encode()
with gzip.open(os.path.join(OUT, f"mushaf_layout_{VERSION}.json.gz"), "wb", compresslevel=9) as f:
    f.write(json_bytes)
p("layout bytes", len(json_bytes), "gz", os.path.getsize(os.path.join(OUT, f"mushaf_layout_{VERSION}.json.gz")))

# fonts: try known quran.com CDN paths
bases = [f"https://static.qurancdn.com/fonts/quran/hafs/{VERSION}/ttf/p{{}}.ttf",
         f"https://static.qurancdn.com/fonts/quran/hafs/{VERSION}/woff2/p{{}}.woff2",
         f"https://verses.quran.com/fonts/quran/hafs/{VERSION}/ttf/p{{}}.ttf"]
base = None
for b in bases:
    try:
        data = get(b.format(1), tries=1); p("FONT BASE OK", b, len(data)); base = b; break
    except Exception as e:
        p("FONT BASE FAIL", b, e)
total = 0
if base:
    for page in range(1, 605):
        data = get(base.format(page))
        ext = base.rsplit(".", 1)[1]
        open(os.path.join(OUT, "fonts", f"p{page}.{ext}"), "wb").write(data)
        total += len(data)
    p("fonts total bytes", total)
    # Surah-name and basmala fonts used in headers
for extra in ["https://static.qurancdn.com/fonts/quran/surah-names/v1/sura_names.ttf",
              "https://static.qurancdn.com/fonts/quran/surah-names/v2/sura_names.ttf",
              "https://static.qurancdn.com/fonts/quran/hafs/v1/ttf/QCF_BSML.TTF",
              "https://static.qurancdn.com/fonts/quran/QCF_BSML.TTF"]:
    try:
        data = get(extra, tries=1); fn = extra.rsplit("/", 1)[1]
        open(os.path.join(OUT, "fonts", "extra_" + fn), "wb").write(data); p("EXTRA OK", extra, len(data))
    except Exception as e:
        p("EXTRA FAIL", extra, e)
