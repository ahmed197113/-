"""Searches archive.org for iqama recordings and Sheikh al-Sha'rawi's du'a after the adhan, downloads the
candidates and transcribes them (faster-whisper) so the right recording can be chosen by what is actually said."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "audio-candidates.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 rafiq"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

QUERIES = {
    "iqama": ['iqama', 'iqamah', 'إقامة الصلاة', 'اقامة الصلاة', 'الاقامة', 'قد قامت الصلاة'],
    "dua_shaarawy": ['الشعراوي دعاء الأذان', 'الشعراوي دعاء بعد الاذان', 'shaarawy dua adhan', 'shaarawi doaa azan',
                     'دعاء بعد الأذان الشعراوي', 'الشيخ الشعراوي الدعاء بعد الآذان', 'shaarawy'],
}
candidates = []
for kind, qs in QUERIES.items():
    seen = set()
    for q in qs:
        url = "https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
            {"q": q, "fl[]": ["identifier", "title"], "rows": 30, "output": "json"}, doseq=True)
        try:
            docs = json.loads(get(url))["response"]["docs"]
        except Exception as e:
            p("SEARCH FAIL", q, e); continue
        for d in docs:
            ident = d["identifier"]
            if ident in seen: continue
            seen.add(ident)
            try:
                meta = json.loads(get(f"https://archive.org/metadata/{ident}"))
            except Exception as e:
                continue
            for f in meta.get("files", []):
                name = f.get("name", "")
                if not name.lower().endswith(".mp3"): continue
                size = int(f.get("size", 0) or 0)
                length = f.get("length")
                try: length = float(length) if length and ":" not in str(length) else None
                except: length = None
                text = (d.get("title", "") + " " + name).lower()
                relevant = {
                    "iqama": any(k in text for k in ["iqam", "إقام", "اقام", "قامت", "eqama", "ikama"]),
                    "dua_shaarawy": any(k in text for k in ["شعراو", "sharaw", "shaarawy", "shaarawi", "sha3rawy", "shaarawi"])
                        and any(k in text for k in ["دعاء", "adhan", "azan", "athan", "اذان", "أذان", "آذان", "doaa", "dua", "doa"]),
                }[kind]
                if not relevant: continue
                if size and size > 8_000_000: continue
                if length and length > 240: continue
                candidates.append((kind, ident, name, size, length, d.get("title", "")))
p("CANDIDATES", len(candidates))
for c in candidates: p("  ", c)

# Transcribe up to 12 per kind
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
done = {"iqama": 0, "dua_shaarawy": 0}
for kind, ident, name, size, length, title in candidates:
    if done[kind] >= 14: continue
    done[kind] += 1
    url = f"https://archive.org/download/{ident}/" + urllib.parse.quote(name)
    fn = f"{kind}__{re.sub(r'[^A-Za-z0-9._-]+', '_', ident)}__{re.sub(r'[^A-Za-z0-9._-]+', '_', name)}"[:150]
    path = os.path.join(OUT, fn if fn.endswith(".mp3") else fn + ".mp3")
    try:
        open(path, "wb").write(get(url, 300))
        dur = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                             capture_output=True, text=True).stdout.strip()
        segs, _ = model.transcribe(path, language="ar", beam_size=5)
        text = " ".join(s.text.strip() for s in segs)
        p(f"\n[{kind}] {os.path.basename(path)}\n  url: {url}\n  title: {title}\n  duration: {dur}s size: {os.path.getsize(path)}\n  TRANSCRIPT: {text}")
    except Exception as e:
        p("FAIL", url, e)
        if os.path.exists(path): os.remove(path)
