"""Checks which hosts serve per-ayah recordings of a reciter (sample ayahs across the Quran)."""
import sys, urllib.request
CANDIDATES = {
    "everyayah": "https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/{s:03d}{a:03d}.mp3",
    "everyayah_www": "https://www.everyayah.com/data/Yasser_Ad-Dussary_128kbps/{s:03d}{a:03d}.mp3",
    "quranicaudio_mirror": "https://mirrors.quranicaudio.com/everyayah/Yasser_Ad-Dussary_128kbps/{s:03d}{a:03d}.mp3",
    "qurancdn_verses": "https://verses.quran.com/Yasser_Ad-Dussary/mp3/{s:03d}{a:03d}.mp3",
    "islamic_network": "https://cdn.islamic.network/quran/audio/128/ar.yasseraddussary/{g}.mp3",
}
SAMPLES = [(1, 1, 1), (2, 255, 262), (18, 10, 2150), (36, 1, 3706), (114, 6, 6236)]
out = open(sys.argv[1], "w")
for name, pat in CANDIDATES.items():
    for s, a, g in SAMPLES:
        url = pat.format(s=s, a=a, g=g)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 rafiq"})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                line = f"{name} {s}:{a} {r.status} {r.headers.get('content-type')} {len(body)} id3={body[:3]!r}"
        except Exception as e:
            line = f"{name} {s}:{a} FAIL {e}"
        print(line); print(line, file=out)
