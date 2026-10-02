"""Collects what tanzil.net uses to display the Quran: its page, stylesheets, scripts, fonts and the font
documentation, so the app can match the site exactly. Run in CI (tanzil.net is unreachable from the dev box)."""
import os, re, sys, urllib.request, urllib.parse, hashlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "tanzil-probe.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) rafiq-probe"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(), r.headers.get("content-type", "")

seen, fonts, queue = set(), set(), ["https://tanzil.net/", "https://tanzil.net/docs/fonts",
                                     "https://tanzil.net/docs/quran_fonts", "https://tanzil.net/docs/download"]
while queue and len(seen) < 60:
    url = queue.pop(0)
    if url in seen: continue
    seen.add(url)
    try:
        body, ctype = get(url)
    except Exception as e:
        p("FAIL", url, e); continue
    p("GET", url, ctype, len(body))
    text = body.decode("utf-8", "replace")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", url.split("://", 1)[1])[:120]
    if any(k in ctype for k in ("html", "css", "javascript", "text")):
        open(os.path.join(OUT, "src_" + name + ".txt"), "w", encoding="utf-8").write(text)
    for m in re.findall(r"""(?:href|src)=["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)""", text):
        link = urllib.parse.urljoin(url, m[0] or m[1])
        if "tanzil.net" not in link: continue
        if re.search(r"\.(ttf|otf|woff2?|eot)(\?|$)", link): fonts.add(link.split("#")[0])
        elif re.search(r"\.(css|js)(\?|$)", link) or "/docs/" in link and "font" in link.lower(): queue.append(link)
    for m in re.findall(r"""["']([^"']*\.(?:ttf|otf|woff2?))["']""", text):
        fonts.add(urllib.parse.urljoin(url, m))
    for m in re.findall(r"font-family\s*:\s*([^;}{]+)", text):
        p("   font-family:", m.strip()[:120])

p("\nFONTS:", sorted(fonts))
for f in sorted(fonts):
    try:
        body, ctype = get(f)
        fn = os.path.basename(urllib.parse.urlparse(f).path)
        open(os.path.join(OUT, fn), "wb").write(body)
        p("FONT", f, len(body), hashlib.sha256(body).hexdigest())
    except Exception as e:
        p("FONT FAIL", f, e)
