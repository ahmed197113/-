"""يبني ملفاً واحداً nabd.html يعمل بدون إنترنت (الصور والخطوط الاحتياطية مدمجة)."""
import base64, json, os, re
d = os.path.dirname(os.path.abspath(__file__)) + '/'
h = open(d + 'index.html', encoding='utf-8').read()
imgs = '{' + ','.join(f'{i}:"data:image/webp;base64,' + base64.b64encode(open(d + f'images/week-{i:02d}.webp', 'rb').read()).decode() + '"' for i in range(1, 40)) + '}'
ph = open(d + 'photos.js', encoding='utf-8').read()
old = "const src = w => `images/week-${String(Math.min(LAST, Math.max(1, w))).padStart(2, '0')}.webp`;"
assert old in ph
ph = ph.replace(old, "const IMG = " + imgs + ";\n  const src = w => IMG[Math.min(LAST, Math.max(1, w))];")
# صور «داخل الرحم»: تُدمج المتوفرة فقط، والشريحة تختفي لغير المتوفر
womb = {g: 'data:image/webp;base64,' + base64.b64encode(open(d + f'images/womb-{g}.webp', 'rb').read()).decode() for g in range(1, 5) if os.path.exists(d + f'images/womb-{g}.webp')}
assert 'const WOMB = null;' in ph
ph = ph.replace('const WOMB = null;', 'const WOMB = ' + json.dumps(womb) + ';')
for f in ['data.js', 'data2.js', 'data3.js', 'data_more.js', 'config.js', 'cal.js', 'app.js', 'features.js', 'community_seed.js', 'community.js', 'notify.js', 'account.js', 'extras.js', 'onboarding.js']:
    h = h.replace(f'<script src="{f}"></script>', '<script>\n' + open(d + f, encoding='utf-8').read() + '\n</script>')
h = h.replace('<script src="photos.js"></script>', '<script>\n' + ph + '\n</script>')
fc = open(d + 'fonts.css', encoding='utf-8').read()
fc = re.sub(r'url\(fonts/([^)]+)\)', lambda m: 'url(data:font/woff2;base64,' + base64.b64encode(open(d + 'fonts/' + m.group(1), 'rb').read()).decode() + ')', fc)
h = h.replace('<link rel="stylesheet" href="fonts.css">', '<style>\n' + fc + '</style>')
h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + open(d + 'styles.css', encoding='utf-8').read() + '\n</style>')
icon = 'data:image/svg+xml;base64,' + base64.b64encode(open(d + 'icons/icon.svg', 'rb').read()).decode()
h = h.replace('icons/icon.svg', icon)
h = re.sub(r'\s*<link rel="manifest"[^>]*>', '', h)
# نسخة السيرفر من أسئلة البداية (نفس المحتوى)
import json
seed_js = open(d + 'community_seed.js', encoding='utf-8').read()
seed = json.loads(seed_js[seed_js.index('['):seed_js.rindex(']') + 1])
open(d + 'server/api/seed.json', 'w', encoding='utf-8').write(json.dumps(seed, ensure_ascii=False, indent=1) + '\n')
os.makedirs(d + 'dist', exist_ok=True)
open(d + 'dist/nabd.html', 'w', encoding='utf-8').write(h)
print('dist/nabd.html', os.path.getsize(d + 'dist/nabd.html') // 1024, 'KB')
