"""One-off data preparation run in CI (the dev sandbox has no access to these hosts)."""
import json, os, urllib.request, urllib.parse, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "probe.txt"), "w", encoding="utf-8")

def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 salawat-build"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def head(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.headers.get("Content-Length"), r.headers.get("Content-Type")
    except Exception as e:
        return str(e)[:60], None, None

# 4. Adhan candidates on archive.org
import re
ADHAN_RE = re.compile(r"adhan|adhaan|azan|athan|adan|اذان|أذان|آذان", re.I)
queries = ["minshawi", "minshawy", "menshawy", "المنشاوي اذان", "اذان المنشاوى", "adhan abdul basit", "abdulbasit azan",
           "اذان عبد الباسط", "اذان محمد رفعت", "mohamed refaat adhan", "refaat azan", "النقشبندي اذان", "naqshbandi",
           "اذان الحصري", "اذان مصري", "egyptian adhan", "اذان نصر الدين طوبار", "اذان الشعشاعي", "روائع الاذان", "adhan collection"]
_unused = ["adhan makkah", "adhan madinah", "azan makkah", "azan madina", "adhan minshawi", "أذان المنشاوي",
           "adhan abdul basit", "adhan mishary", "adhan ali mulla", "adhan nasser qatami", "adhan egypt", "athan",
           "أذان مكة", "أذان المدينة", "اذان"]
seen = set()
for qtext in queries:
    try:
        url = "https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
            {"q": f"({qtext}) AND mediatype:audio", "fl[]": "identifier", "rows": 30, "output": "json"})
        docs = json.loads(get(url))["response"]["docs"]
        for d in docs:
            ident = d["identifier"]
            if ident in seen:
                continue
            seen.add(ident)
            try:
                meta = json.loads(get(f"https://archive.org/metadata/{ident}"))
                title = meta.get("metadata", {}).get("title")
                files = [(f["name"], f.get("size"), f.get("length")) for f in meta.get("files", []) if f["name"].lower().endswith(".mp3")]
                hits = [f for f in files if ADHAN_RE.search(f[0]) or ADHAN_RE.search(str(title))]
                if hits:
                    p("ARCHIVE", qtext, "|", ident, "|", title, "|", hits[:60])
            except Exception as e:
                p("ARCHIVE meta fail", ident, e)
    except Exception as e:
        p("archive search FAILED", qtext, e)

# 5. Verify chosen downloads
for u in [
    "https://archive.org/download/adan-madeenah-nu3man/adan-mullah-al7aram-1414.mp3",
    "https://archive.org/download/adan-madeenah-nu3man/adan-madeenah-nu3man.mp3",
    "https://archive.org/download/adan-madeenah-nu3man/adan-al7usary.mp3",
    "https://archive.org/download/adan-madeenah-nu3man/makkah-farooq.mp3",
    "https://archive.org/download/MedinaAthan_478/AbdulMalikAlNomanAthan-Medina.mp3",
    "https://archive.org/download/AdhanMisharyRashid/Adhan%20Mishary%20Rashid.mp3",
]:
    p("VERIFY", u, head(u))
