"""Rebuilds the Madinah Mushaf (QCF v2) page layout from quran.com, chapter by chapter, so that every word is placed
by its own page and line in the v2 Mushaf (mushaf=1). The previous layout was fetched page by page from the default
(v1) pagination and mixed lines at page boundaries.

Output: mushaf_layout_v2.dat (gzip JSON, {page: {line: [[glyphs, "s:a", isEnd], ...]}}) and a report.
Usage: pack_mushaf_layout.py OUT_DIR
"""
import gzip, json, os, sys, time, urllib.request
from collections import defaultdict

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "layout-report.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 rafiq"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))

pages = defaultdict(lambda: defaultdict(list))
mismatch = 0
words_total = 0
for ch in range(1, 115):
    page_no = 1
    while True:
        d = get(f"https://api.quran.com/api/v4/verses/by_chapter/{ch}?mushaf=1&words=true&per_page=50&page={page_no}"
                f"&word_fields=code_v2,line_number,page_number,v2_page,char_type_name&fields=verse_key")
        for v in d["verses"]:
            for w in sorted(v["words"], key=lambda w: w["position"]):
                pg = w["page_number"]
                if w.get("v2_page") is not None and w["v2_page"] != pg:
                    mismatch += 1
                pages[pg][w["line_number"]].append([w["code_v2"], v["verse_key"], 1 if w["char_type_name"] == "end" else 0])
                words_total += 1
        nxt = d.get("pagination", {}).get("next_page")
        if not nxt: break
        page_no = nxt
    p("chapter", ch, "done; pages so far", len(pages))

p("words", words_total, "v2_page mismatches", mismatch, "pages", len(pages))
assert sorted(pages) == list(range(1, 605)), "missing pages"
out = {}
for pg in range(1, 605):
    lines = pages[pg]
    assert all(1 <= ln <= 15 for ln in lines), (pg, sorted(lines))
    out[str(pg)] = {str(ln): lines[ln] for ln in sorted(lines)}
# Report every surah start: page, line, and the empty lines above it (on this page / at the end of the previous one).
for s in range(1, 115):
    for pg in range(1, 605):
        hit = next((int(ln) for ln, ws in out[str(pg)].items() if any(w[1] == f"{s}:1" for w in ws)), None)
        if hit:
            above = [ln for ln in range(1, hit) if str(ln) not in out[str(pg)]]
            prev_tail = [ln for ln in range(1, 16) if pg > 1 and str(ln) not in out[str(pg - 1)]]
            p(f"surah {s}: page {pg} line {hit}; empty above {above}; empty on previous page {prev_tail}")
            break
data = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode()
with gzip.open(os.path.join(OUT, "mushaf_layout_v2.dat"), "wb", compresslevel=9) as f:
    f.write(data)
p("bytes", len(data))
