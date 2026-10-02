"""Fetches the Quran text from several independent, authoritative publishers and cross-checks them
letter by letter. Run in CI (the dev sandbox cannot reach these hosts). Writes a report + raw texts."""
import json, os, re, sys, urllib.request, unicodedata, hashlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "quran-verification.txt"), "w", encoding="utf-8")

def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (rafiq-verify)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

sources = {}

# 1) Tanzil (official download endpoint) — Uthmani script, verbatim.
for url in [
    "https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&tatweel=true&quranType=uthmani&outType=txt-2&agree=true",
    "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true",
]:
    try:
        raw = get(url).decode("utf-8")
        rows = {}
        for line in raw.splitlines():
            parts = line.split("|")
            if len(parts) == 3 and parts[0].isdigit():
                rows[(int(parts[0]), int(parts[1]))] = parts[2]
        p("TANZIL", url, "ayahs:", len(rows), "sha256:", hashlib.sha256(raw.encode()).hexdigest())
        if len(rows) == 6236:
            sources["tanzil"] = rows
            open(os.path.join(OUT, "tanzil-quran-uthmani.txt"), "w", encoding="utf-8").write(raw)
            p("TANZIL header/footer lines:", [l for l in raw.splitlines() if not re.match(r"^\d+\|", l)][:30])
            break
    except Exception as e:
        p("TANZIL FAILED", url, e)

# 2) Quran Foundation (quran.com) API — several scripts, incl. the King Fahd Complex (QPC) Hafs text.
for field in ["uthmani", "qpc_hafs", "uthmani_simple", "imlaei"]:
    try:
        d = json.loads(get(f"https://api.quran.com/api/v4/quran/verses/{field}"))
        key = [k for k in d["verses"][0].keys() if k.startswith("text_")][0]
        rows = {}
        for v in d["verses"]:
            s, a = v["verse_key"].split(":")
            rows[(int(s), int(a))] = v[key]
        p("QURAN.COM", field, key, "ayahs:", len(rows))
        if len(rows) == 6236:
            sources["qurancom_" + field] = rows
    except Exception as e:
        p("QURAN.COM FAILED", field, e)

# 3) alquran.cloud (what the app currently ships)
try:
    d = json.loads(get("https://api.alquran.cloud/v1/quran/quran-uthmani"))
    rows = {}
    for s in d["data"]["surahs"]:
        for a in s["ayahs"]:
            rows[(s["number"], a["numberInSurah"])] = a["text"]
    p("ALQURAN.CLOUD ayahs:", len(rows))
    sources["alqurancloud"] = rows
except Exception as e:
    p("ALQURAN.CLOUD FAILED", e)

# 4) The app's bundled files: assets/quran/tanzil-uthmani.txt (verbatim Tanzil) + meta.tsv (page/juz)
APP_DIR = sys.argv[2]
FAIL = []
try:
    app_raw = open(os.path.join(APP_DIR, "tanzil-uthmani.txt"), "rb").read()
    rows = {}
    for line in app_raw.decode("utf-8").splitlines():
        parts = line.split("|")
        if len(parts) == 3 and parts[0].isdigit():
            rows[(int(parts[0]), int(parts[1]))] = parts[2]
    sources["app"] = rows
    app_sha = hashlib.sha256(app_raw).hexdigest()
    p("APP ayahs:", len(rows), "sha256:", app_sha)
    if "tanzil" in sources:
        same = rows == sources["tanzil"]
        p("APP TEXT IDENTICAL TO FRESH TANZIL DOWNLOAD:", same)
        if not same: FAIL.append("app text != tanzil")
    meta = {}
    for line in open(os.path.join(APP_DIR, "meta.tsv"), encoding="utf-8"):
        g, s_, a, page, juz = line.rstrip("\n").split("\t")
        meta[(int(s_), int(a))] = (int(page), int(juz))
except Exception as e:
    p("APP FAILED", e); FAIL.append("app load")
    meta = {}

# 5) Page and juz boundaries of the Madinah Mushaf, from quran.com
try:
    qc_page, qc_juz = {}, {}
    for pg in range(1, 605):
        d = json.loads(get(f"https://api.quran.com/api/v4/quran/verses/uthmani?page_number={pg}"))
        for v in d["verses"]:
            s_, a = v["verse_key"].split(":"); qc_page[(int(s_), int(a))] = pg
    for j in range(1, 31):
        d = json.loads(get(f"https://api.quran.com/api/v4/quran/verses/uthmani?juz_number={j}"))
        for v in d["verses"]:
            s_, a = v["verse_key"].split(":"); qc_juz[(int(s_), int(a))] = j
    bad_p = [k for k in meta if qc_page.get(k) != meta[k][0]]
    bad_j = [k for k in meta if qc_juz.get(k) != meta[k][1]]
    p("META pages checked:", len(qc_page), "page mismatches:", len(bad_p), bad_p[:20])
    p("META juz checked:", len(qc_juz), "juz mismatches:", len(bad_j), bad_j[:20])
    if bad_p or bad_j or len(qc_page) != 6236: FAIL.append("meta")
except Exception as e:
    p("META CHECK FAILED", e); FAIL.append("meta fetch")

BASMALA_SKELETON = "بسم الله الرحمن الرحيم"

def skeleton(t):
    """Letters only: drop all marks/diacritics/Quranic annotation signs, unify letter variants of the
    same consonant skeleton, so texts in different orthographic conventions can be compared word by word."""
    t = unicodedata.normalize("NFC", t.replace("﻿", ""))
    out = []
    for ch in t:
        cat = unicodedata.category(ch)
        if cat.startswith("M"):  # combining marks: harakat, small letters, stop signs
            continue
        if ch in "ـ۞۩۝٠١٢٣٤٥٦٧٨٩":
            continue
        if "ۖ" <= ch <= "ۭ":
            continue
        if ch.isdigit():
            continue
        out.append(ch)
    t = "".join(out)
    t = re.sub("[ٱأإآٲٳاٰ]", "ا", t)   # alef forms (incl. wasla)
    t = re.sub("[ىیي]", "ي", t)
    t = re.sub("[ۥۦ]", "", t)
    t = t.replace("ک", "ك").replace("ة", "ه")
    t = re.sub("[ءؤئ]", "ء", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def no_alef(t):
    # Uthmani rasm writes some long vowels differently (e.g. ٱلصَّلَوٰةَ); compare without alef/waw/yaa variance too.
    return re.sub("[اويء ]", "", t)

def strip_basmala(t):
    sk = skeleton(t)
    return sk[len(BASMALA_SKELETON):].strip() if sk.startswith(BASMALA_SKELETON) else sk

names = list(sources)
p("\nSOURCES:", names)
for a in names:
    for b in names:
        if a >= b:
            continue
        exact = skel = rasm = 0
        diffs = []
        for key in sources[a]:
            ta, tb = sources[a].get(key), sources[b].get(key)
            if ta is None or tb is None:
                diffs.append((key, "missing")); continue
            if ta.replace("﻿", "").strip() == tb.replace("﻿", "").strip():
                exact += 1
            sa, sb = skeleton(ta), skeleton(tb)
            if key[1] == 1 and key[0] not in (1, 9):
                sa, sb = strip_basmala(ta), strip_basmala(tb)
            if sa == sb:
                skel += 1
            elif no_alef(sa) == no_alef(sb):
                rasm += 1
            else:
                diffs.append((key, sa, sb))
        p(f"\n== {a} vs {b}: exact={exact} letters-equal={skel} equal-except-vowel-letters={rasm} DIFFERENT={len(diffs)}")
        for d in diffs[:15]:
            p("   ", d)

# Final verdict: app text must equal quran.com's Uthmani text exactly, apart from the basmala that
# quran.com keeps out of ayah 1.
if "app" in sources and "qurancom_uthmani" in sources:
    mism = []
    for k, t in sources["app"].items():
        q = sources["qurancom_uthmani"][k]
        if t != q and not (k[1] == 1 and t.endswith(" " + q)):
            mism.append(k)
    p("APP vs QURAN.COM UTHMANI exact mismatches (excluding basmala prefix):", len(mism), mism[:20])
    if mism: FAIL.append("app != quran.com")
p("\nVERDICT:", "PASS" if not FAIL else "FAIL " + ", ".join(FAIL))
log.close()
sys.exit(1 if FAIL else 0)
