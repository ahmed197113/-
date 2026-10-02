"""Builds the app's hadith library — authentic (sahih) hadith only.

Text, official numbering and gradings come from one record per hadith in github.com/fawazahmed0/hadith-api
(Unlicense; sourced from sunnah.com). Arabic chapter titles come from github.com/AhmedBaset/hadith-json.

Selection rules:
  * Sahih al-Bukhari and Sahih Muslim: every hadith (Muslim's Introduction, which is mostly scholars' sayings,
    is left out).
  * Sunan Abi Dawud, Jami' at-Tirmidhi, Sunan an-Nasa'i, Sunan Ibn Majah: only hadith graded exactly "Sahih"
    (or "Sahih Mutawatir") by Sheikh al-Albani. Hasan, da'if, mawquf, maqtu', "sahih isnad only", and ungraded
    entries are all excluded.
  * Books without a complete grading (Malik, Ahmad, ad-Darimi, the forties, Riyad as-Salihin, ...) are not shipped.

Output per book (gzipped JSON): {"t", "a", "g": grading note, "c": [[chapterId, title]], "h": [[number, chapterId, text]]}
Also writes daily.json: a selection of short hadith from the two Sahihs for the "hadith of the day" (bundled).

Usage: prepare_hadith.py OUT_DIR [LOCAL_CACHE_DIR]
"""
import gzip, json, os, sys, urllib.request

FAWAZ = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/ara-{}.min.json"
AB = "https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/the_9_books/{}.json"
ALL_SAHIH = "جميع أحاديث الكتاب صحيحة"
ALBANI = "الأحاديث التي صححها الشيخ الألباني فقط"
BOOKS = [  # id, fawaz edition, AhmedBaset file, title, author, grading note, filter
    ("bukhari", "bukhari", "bukhari", "صحيح البخاري", "الإمام محمد بن إسماعيل البخاري", ALL_SAHIH, None),
    ("muslim", "muslim", "muslim", "صحيح مسلم", "الإمام مسلم بن الحجاج النيسابوري", ALL_SAHIH, None),
    ("abudawud", "abudawud", "abudawud", "سنن أبي داود", "الإمام أبو داود السجستاني", ALBANI, "albani"),
    ("tirmidhi", "tirmidhi", "tirmidhi", "جامع الترمذي", "الإمام محمد بن عيسى الترمذي", ALBANI, "albani"),
    ("nasai", "nasai", "nasai", "سنن النسائي", "الإمام أحمد بن شعيب النسائي", ALBANI, "albani"),
    ("ibnmajah", "ibnmajah", "ibnmajah", "سنن ابن ماجه", "الإمام محمد بن يزيد ابن ماجه", ALBANI, "albani"),
]
ALBANI_SAHIH = {"Sahih", "Sahih Mutawatir"}

out = sys.argv[1]
cache = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(out, exist_ok=True)


def fetch(url, local):
    if cache and os.path.exists(os.path.join(cache, local)):
        return json.load(open(os.path.join(cache, local), encoding="utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": "rafiq-hadith"})
    return json.loads(urllib.request.urlopen(req, timeout=300).read())


def number(h):
    # The commonly cited number (for Muslim: Fu'ad Abdul-Baqi's; "8.01"/"8.02" are narrations of hadith 8).
    n = float(h.get("arabicnumber") or h["hadithnumber"])
    return int(n)


index, daily = [], []
for bid, fz, ab, title, author, note, rule in BOOKS:
    d = fetch(FAWAZ.format(fz), f"ara-{fz}.min.json")
    abd = fetch(AB.format(ab), f"ab-{ab}.json")
    by_english = {}
    for c in abd["chapters"]:
        by_english.setdefault(c["english"].strip().lower(), c["arabic"].strip())
    names = {}
    ranges = []
    for sid, r in d["metadata"]["section_details"].items():
        sid = int(sid)
        if r["hadithnumber_last"] <= 0 or (bid == "muslim" and sid == 0):
            continue
        # Match the Arabic chapter title through the shared sunnah.com English title; refuse to guess.
        en = d["metadata"]["sections"][str(sid)].strip().lower()
        assert en in by_english, (bid, sid, en)
        names[sid] = by_english[en]
        ranges.append((r["hadithnumber_first"], r["hadithnumber_last"], sid))
    hadiths, skipped = [], {}
    for h in d["hadiths"]:
        text = " ".join(h["text"].split())
        if not text:
            continue
        n = h["hadithnumber"]
        sec = next((s for a, b, s in ranges if a <= n <= b), None)
        if sec is None:  # a few numbers fall in gaps between ranges: they belong to the preceding chapter
            before = [(a, s) for a, b, s in ranges if a <= n]
            sec = max(before)[1] if before else None
        if sec is None:
            skipped["no chapter"] = skipped.get("no chapter", 0) + 1
            continue
        if rule == "albani":
            g = [x["grade"].strip() for x in h["grades"] if x["name"] == "Al-Albani"]
            if not g or g[0] not in ALBANI_SAHIH:
                skipped[g[0] if g else "ungraded"] = skipped.get(g[0] if g else "ungraded", 0) + 1
                continue
        hadiths.append([number(h), sec, text])
        if bid in ("bukhari", "muslim") and 90 <= len(text) <= 330 and "صلى الله عليه وسلم" in text:
            daily.append([number(h), 1 if bid == "bukhari" else 2, text])
    used = sorted({x[1] for x in hadiths})
    book = {"t": title, "a": author, "g": note, "c": [[c, names[c]] for c in used], "h": hadiths}
    path = os.path.join(out, f"{bid}.json.gz")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(json.dumps(book, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    index.append({"id": bid, "title": title, "count": len(hadiths), "size": os.path.getsize(path)})
    print(bid, len(d["hadiths"]), "->", len(hadiths), "kept;", os.path.getsize(path), "bytes; skipped:",
          sorted(skipped.items(), key=lambda x: -x[1])[:12])

# Every 7th qualifying hadith keeps the bundled file small while spreading across all chapters.
daily = daily[::7]
json.dump({"t": "من الصحيحين", "a": "", "g": ALL_SAHIH, "c": [[1, "صحيح البخاري"], [2, "صحيح مسلم"]], "h": daily},
          open(os.path.join(out, "daily.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(index, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("daily:", len(daily))
