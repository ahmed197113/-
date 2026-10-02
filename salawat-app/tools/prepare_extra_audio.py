"""Prepares the iqama and al-Sha'rawi's du'a after the adhan from the recordings chosen by transcript
(see find_extra_audio.py). The du'a recording continues into a longer supplication, so it is cut right after
"الذي وعدته", located with word timestamps. Writes iqama.mp3, dua_after_adhan.mp3 and a report."""
import os, subprocess, sys, urllib.request, numpy as np

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "extra-audio-report.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

SOURCES = {
    "iqama_src.mp3": "https://archive.org/download/IqamaMakkahIsha3111434SheikhMajedAbbas/Iqama%20-%20Makkah%20Isha%20%5B3-11-1434%5D%20Sheikh%20Majed%20Abbas.mp3",
    "dua_src.mp3": "https://archive.org/download/alshaarawi/alshaarawi-doaa-24.mp3",
    "dua_src2.mp3": "https://archive.org/download/U-2024-01-28/Doaa-1.mp3",
}
for fn, url in SOURCES.items():
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 rafiq"})
    open(os.path.join(OUT, fn), "wb").write(urllib.request.urlopen(req, timeout=300).read())

from faster_whisper import WhisperModel
model = WhisperModel("medium", device="cpu", compute_type="int8")
def pcm(path):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "quiet", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def words(path):
    segs, _ = model.transcribe(pcm(path), language="ar", beam_size=5, word_timestamps=True)
    out = []
    for s in segs:
        for w in s.words: out.append((w.start, w.end, w.word.strip()))
    return out

def norm(t):
    import re
    t = re.sub(r"[ً-ْٰـ]", "", t)
    return t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")

for src, dst in [("dua_src.mp3", "dua_after_adhan.mp3"), ("dua_src2.mp3", "dua_after_adhan_alt.mp3")]:
    ws = words(os.path.join(OUT, src))
    p(f"\n== {src} words:")
    p(" ".join(f"[{a:.1f}]{w}" for a, b, w in ws))
    end = None
    for a, b, w in ws:
        if "وعدته" in norm(w) or "وعده" in norm(w) or "يوعده" in norm(w):
            end = b; break
    if end is None:
        p("!! end of du'a not found"); continue
    # include "إنك لا تخلف الميعاد" if it directly follows
    following = [x for x in ws if x[0] >= end][:5]
    tail = " ".join(norm(x[2]) for x in following)
    p("after 'وعدته':", tail)
    if "تخلف" in tail and "الميعاد" in tail.replace("ميعاد", "الميعاد"):
        for a, b, w in following:
            if "ميعاد" in norm(w): end = b; break
    cut = end + 0.6
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "quiet", "-i", os.path.join(OUT, src), "-t", f"{cut:.2f}",
                    "-af", f"afade=t=out:st={max(cut - 0.5, 0):.2f}:d=0.5", "-ac", "1", "-b:a", "64k",
                    os.path.join(OUT, dst)], check=True)
    p(f"cut at {cut:.2f}s ->", dst, os.path.getsize(os.path.join(OUT, dst)))
    p("check transcript of the cut:", " ".join(w for a, b, w in words(os.path.join(OUT, dst))))

subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "quiet", "-i", os.path.join(OUT, "iqama_src.mp3"), "-ac", "1", "-b:a", "64k",
                os.path.join(OUT, "iqama.mp3")], check=True)
p("\niqama.mp3", os.path.getsize(os.path.join(OUT, "iqama.mp3")))
p("iqama transcript:", " ".join(w for a, b, w in words(os.path.join(OUT, "iqama.mp3"))))
for fn in SOURCES: os.remove(os.path.join(OUT, fn))
