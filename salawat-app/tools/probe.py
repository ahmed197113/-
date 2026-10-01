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

# 1. Full Uthmani text with page/juz info
try:
    q = json.loads(get("https://api.alquran.cloud/v1/quran/quran-uthmani", 180))
    rows = []
    for s in q["data"]["surahs"]:
        for a in s["ayahs"]:
            rows.append([a["number"], s["number"], a["numberInSurah"], a["page"], a["juz"], a["text"]])
    json.dump(rows, open(os.path.join(OUT, "quran_uthmani.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    p("quran ayahs", len(rows), "pages", max(r[3] for r in rows))
    p("sample", rows[0], rows[7])
except Exception as e:
    p("quran FAILED", e)

# 2. Audio editions + bitrates on the islamic.network CDN
try:
    eds = json.loads(get("https://api.alquran.cloud/v1/edition?format=audio&language=ar"))["data"]
    for e in eds:
        ok = [br for br in (192, 128, 64, 48, 40, 32) if head(f"https://cdn.islamic.network/quran/audio/{br}/{e['identifier']}/1.mp3")[0] == 200]
        p("AUDIO", e["identifier"], e["name"], e.get("englishName"), ok)
except Exception as e:
    p("audio FAILED", e)

# 3. Tafsir editions
try:
    for e in json.loads(get("https://api.alquran.cloud/v1/edition?type=tafsir"))["data"]:
        p("TAFSIR", e["identifier"], e["language"], e["name"], e.get("englishName"))
except Exception as e:
    p("tafsir FAILED", e)

# 4. Adhan candidates on archive.org
queries = ["adhan makkah", "adhan madinah", "azan makkah", "azan madina", "adhan minshawi", "أذان المنشاوي",
           "adhan abdul basit", "adhan mishary", "adhan ali mulla", "adhan nasser qatami", "adhan egypt", "athan",
           "أذان مكة", "أذان المدينة", "اذان"]
seen = set()
for qtext in queries:
    try:
        url = "https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
            {"q": f"({qtext}) AND mediatype:audio", "fl[]": "identifier", "rows": 15, "output": "json"})
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
                p("ARCHIVE", qtext, "|", ident, "|", title, "|", files[:40])
            except Exception as e:
                p("ARCHIVE meta fail", ident, e)
    except Exception as e:
        p("archive search FAILED", qtext, e)

# 5. islamcan numbered adhans
for i in range(1, 26):
    p("ISLAMCAN", i, head(f"https://www.islamcan.com/audio/adhan/azan{i}.mp3"))

# 6. everyayah reciters list
try:
    p("EVERYAYAH", get("https://everyayah.com/data/recitations.js")[:6000].decode("utf-8", "replace"))
except Exception as e:
    p("everyayah FAILED", e)
