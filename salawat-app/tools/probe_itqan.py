"""Explores itqan-quran.com (the user's chosen Quran source): pages, scripts, API endpoints, fonts, images and
any downloadable text, so the app can take the Quran from it as-is."""
import os, re, sys, urllib.parse, urllib.request, json, hashlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, "itqan-probe.txt"), "w", encoding="utf-8")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) rafiq-probe",
                                               "Accept-Language": "ar,en"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("content-type", ""), r.geturl()

ROOT = "https://itqan-quran.com"
queue = [ROOT + "/", ROOT + "/robots.txt", ROOT + "/sitemap.xml", ROOT + "/api", ROOT + "/api/", ROOT + "/quran",
         ROOT + "/mushaf", ROOT + "/about", ROOT + "/download", ROOT + "/developers", ROOT + "/docs"]
seen, assets = set(), set()
while queue and len(seen) < 120:
    url = queue.pop(0)
    if url in seen: continue
    seen.add(url)
    try:
        body, ctype, final = get(url)
    except Exception as e:
        p("FAIL", url, e); continue
    p("GET", url, "->", final, ctype, len(body))
    if not any(k in ctype for k in ("html", "javascript", "json", "text", "xml", "css")):
        continue
    text = body.decode("utf-8", "replace")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", url.split("://", 1)[1])[:110]
    open(os.path.join(OUT, "src_" + name + ".txt"), "w", encoding="utf-8").write(text)
    links = set(re.findall(r"""(?:href|src|action)=["']([^"'#]+)["']""", text))
    links |= set(re.findall(r"""["'](/[A-Za-z0-9_./?=&%-]+)["']""", text))
    links |= set(re.findall(r"""(https?://[A-Za-z0-9_.:/?=&%-]+)""", text))
    for l in links:
        u = urllib.parse.urljoin(url, l)
        host = urllib.parse.urlparse(u).netloc
        if re.search(r"\.(ttf|otf|woff2?|png|jpe?g|webp|svg|mp3|json|txt|xml|zip)(\?|$)", u, re.I):
            assets.add(u)
        if "itqan" in host and u not in seen and not re.search(r"\.(png|jpe?g|webp|svg|ico|mp3|woff2?|ttf|otf|zip)(\?|$)", u, re.I):
            queue.append(u)
    for m in re.findall(r"""(?:fetch|axios\.get|axios\.post|url\s*:)\s*\(?\s*[`"']([^`"']+)""", text):
        p("   API-LIKE:", m)
    for m in set(re.findall(r"""[`"'](https?://[^`"']*api[^`"']*)[`"']""", text)):
        p("   API URL:", m)
p("\nASSETS:")
for a in sorted(assets): p("  ", a)
