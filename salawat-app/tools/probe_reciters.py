"""Looks for per-ayah (or per-surah + ayah timing) recordings of given reciters on the known Quran audio CDNs.
Writes a report; used to pick a source before adding a reciter to the app."""
import json, sys, urllib.request

out = open(sys.argv[1], "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=out); out.flush()

def head(url):
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1023"})
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.headers.get("Content-Type"), r.headers.get("Content-Range") or r.headers.get("Content-Length")
    except Exception as e:
        return str(e)[:80], None, None

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

# 1) everyayah folders
for folder in ["Fares_Abbad_64kbps", "Fares_Abbad_128kbps", "Islam_Sobhi_128kbps", "Islam_Sobhi_64kbps", "Islam_Sobhy_128kbps"]:
    for f in ["001001.mp3", "002255.mp3", "114006.mp3"]:
        p("everyayah", folder, f, head(f"https://everyayah.com/data/{folder}/{f}"))
try:
    import re
    html = urllib.request.urlopen(urllib.request.Request("https://everyayah.com/recitations_ayat.html", headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read().decode("utf-8", "ignore")
    p("everyayah list matches:", sorted(set(re.findall(r'data/([A-Za-z_]*(?:Fares|Abbad|Sobhi|Sobhy|Islam)[A-Za-z_0-9]*)', html))))
except Exception as e:
    p("everyayah list error", e)

# 2) islamic.network editions
try:
    eds = get_json("https://api.alquran.cloud/v1/edition?format=audio")["data"]
    p("alquran.cloud audio editions matching:", [(e["identifier"], e["englishName"]) for e in eds if any(k in e["englishName"].lower() for k in ("fares", "abbad", "sobhi", "sobhy", "islam"))])
except Exception as e:
    p("alquran.cloud error", e)

# 3) quran.com recitations
try:
    r = get_json("https://api.quran.com/api/v4/resources/recitations?language=en")["recitations"]
    p("quran.com recitations matching:", [(x["id"], x["reciter_name"], x.get("style")) for x in r if any(k in x["reciter_name"].lower() for k in ("fares", "abbad", "sobhi", "sobhy", "islam"))])
except Exception as e:
    p("quran.com error", e)

# 4) mp3quran.net (surah files) + ayah timings
try:
    rs = get_json("https://mp3quran.net/api/v3/reciters?language=ar")["reciters"]
    for x in rs:
        if any(k in x["name"] for k in ("فارس عباد", "إسلام صبحي", "اسلام صبحي")):
            p("mp3quran reciter:", x["id"], x["name"], [(m["id"], m["name"], m["server"], m["surah_total"]) for m in x["moshaf"]])
    reads = get_json("https://mp3quran.net/api/v3/ayat_timing/reads")
    p("mp3quran timing reads matching:", [r for r in reads if any(k in json.dumps(r, ensure_ascii=False) for k in ("فارس", "صبحي", "Fares", "Sobhi", "Sobhy"))])
except Exception as e:
    p("mp3quran error", e)
