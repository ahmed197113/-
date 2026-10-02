"""Builds compact, Arabic-only hadith books (gzipped JSON) for the app to download on demand.

Source: github.com/AhmedBaset/hadith-json (data originally from sunnah.com).
Output per book: {"t": title, "a": author, "c": [[chapterId, title], ...], "h": [[number, chapterId, text], ...]}
"""
import gzip, json, os, sys, urllib.request

BASE = "https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/"
BOOKS = {
    "bukhari": "the_9_books/bukhari.json", "muslim": "the_9_books/muslim.json",
    "abudawud": "the_9_books/abudawud.json", "tirmidhi": "the_9_books/tirmidhi.json",
    "nasai": "the_9_books/nasai.json", "ibnmajah": "the_9_books/ibnmajah.json",
    "malik": "the_9_books/malik.json", "ahmed": "the_9_books/ahmed.json", "darimi": "the_9_books/darimi.json",
    "riyad_assalihin": "other_books/riyad_assalihin.json", "bulugh_almaram": "other_books/bulugh_almaram.json",
    "aladab_almufrad": "other_books/aladab_almufrad.json", "shamail_muhammadiyah": "other_books/shamail_muhammadiyah.json",
    "mishkat_almasabih": "other_books/mishkat_almasabih.json",
    "nawawi40": "forties/nawawi40.json", "qudsi40": "forties/qudsi40.json",
}

def compact(raw):
    d = json.loads(raw)
    chapters = [[c["id"], (c.get("arabic") or c.get("english") or "").strip()] for c in d.get("chapters", [])]
    hadiths = []
    for h in d["hadiths"]:
        text = (h.get("arabic") or "").strip()
        if not text:
            continue
        hadiths.append([h.get("idInBook") or h.get("id"), h.get("chapterId") or 0, " ".join(text.split())])
    meta = d.get("metadata", {}).get("arabic", {})
    return {"t": meta.get("title", ""), "a": meta.get("author", ""), "c": chapters, "h": hadiths}

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
index = []
for key, path in BOOKS.items():
    raw = urllib.request.urlopen(BASE + path, timeout=300).read()
    book = compact(raw)
    data = json.dumps(book, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(os.path.join(out, f"{key}.json.gz"), "wb", compresslevel=9) as f:
        f.write(data)
    size = os.path.getsize(os.path.join(out, f"{key}.json.gz"))
    index.append({"id": key, "title": book["t"], "author": book["a"], "count": len(book["h"]), "size": size})
    print(key, book["t"], len(book["h"]), "hadiths", size, "bytes")
json.dump(index, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
