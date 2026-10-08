"""يبني ملفاً واحداً nabd.html يعمل بدون إنترنت (الصور والخطوط الاحتياطية مدمجة)."""
import base64, os, re
d = os.path.dirname(os.path.abspath(__file__)) + '/'
h = open(d + 'index.html', encoding='utf-8').read()
imgs = '{' + ','.join(f'{i}:"data:image/webp;base64,' + base64.b64encode(open(d + f'images/week-{i:02d}.webp', 'rb').read()).decode() + '"' for i in range(1, 40)) + '}'
ph = open(d + 'photos.js', encoding='utf-8').read()
old = "const src = w => `images/week-${String(Math.min(LAST, Math.max(1, w))).padStart(2, '0')}.webp`;"
assert old in ph
ph = ph.replace(old, "const IMG = " + imgs + ";\n  const src = w => IMG[Math.min(LAST, Math.max(1, w))];")
for f in ['data.js', 'data2.js', 'data3.js', 'data_more.js', 'daily.js', 'config.js', 'app.js', 'features.js', 'community.js', 'account.js', 'notify.js']:
    h = h.replace(f'<script src="{f}"></script>', '<script>\n' + open(d + f, encoding='utf-8').read() + '\n</script>')
h = h.replace('<script src="photos.js"></script>', '<script>\n' + ph + '\n</script>')
fc = open(d + 'fonts.css', encoding='utf-8').read()
fc = re.sub(r'url\(fonts/([^)]+)\)', lambda m: 'url(data:font/woff2;base64,' + base64.b64encode(open(d + 'fonts/' + m.group(1), 'rb').read()).decode() + ')', fc)
h = h.replace('<link rel="stylesheet" href="fonts.css">', '<style>\n' + fc + '</style>')
h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + open(d + 'styles.css', encoding='utf-8').read() + '\n</style>')
icon = 'data:image/svg+xml;base64,' + base64.b64encode(open(d + 'icons/icon.svg', 'rb').read()).decode()
h = h.replace('icons/icon.svg', icon)
h = re.sub(r'\s*<link rel="manifest"[^>]*>', '', h)
os.makedirs(d + 'dist', exist_ok=True)
open(d + 'dist/nabd.html', 'w', encoding='utf-8').write(h)
print('dist/nabd.html', os.path.getsize(d + 'dist/nabd.html') // 1024, 'KB')
