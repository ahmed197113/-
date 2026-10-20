"""يبني نسختين:
- dist/nabd.html: ملف واحد يعمل بدون إنترنت (الصور والخطوط مدمجة) للمشاركة والفتح المباشر.
- dist/www/: نسخة تطبيق أندرويد — الكود مدمج في index.html والصور والخطوط ملفات منفصلة
  تُحمَّل عند الحاجة (lazy) فيفتح التطبيق أسرع."""
import base64, json, os, re, shutil
d = os.path.dirname(os.path.abspath(__file__)) + '/'
SCRIPTS = ['i18n.js', 'data.js', 'data2.js', 'data3.js', 'data_more.js', 'config.js', 'cal.js', 'icons.js', 'app.js', 'features.js', 'community_seed.js', 'community.js', 'notify.js', 'account.js', 'extras.js', 'tools.js', 'onboarding.js']
b64 = lambda p: base64.b64encode(open(d + p, 'rb').read()).decode()
# رقم النسخة الظاهر في «عن التطبيق» = نفس منطق patch-android.py
run = int(os.environ.get('GITHUB_RUN_NUMBER', '0'))
vj = json.load(open(d + 'android-app/version.json', encoding='utf-8'))
APP_VERSION = vj['name'] if vj['code'] >= run + 100 else f'1.2.{run}'
LANGS = sorted(f[:-3] for f in os.listdir(d + 'i18n') if f.endswith('.js'))
womb_files = [g for g in range(1, 5) if os.path.exists(d + f'images/womb-{g}.webp')]


def build(single):
    h = open(d + 'index.html', encoding='utf-8').read()
    ph = open(d + 'photos.js', encoding='utf-8').read()
    assert 'const WOMB = null;' in ph
    if single:
        old = "const src = w => `images/week-${String(Math.min(LAST, Math.max(1, w))).padStart(2, '0')}.webp`;"
        assert old in ph
        imgs = '{' + ','.join(f'{i}:"data:image/webp;base64,{b64(f"images/week-{i:02d}.webp")}"' for i in range(1, 40)) + '}'
        ph = ph.replace(old, "const IMG = " + imgs + ";\n  const src = w => IMG[Math.min(LAST, Math.max(1, w))];")
    # صور «داخل الرحم»: المتوفرة فقط، والشريحة تختفي لغير المتوفر
    womb = {g: (f'data:image/webp;base64,{b64(f"images/womb-{g}.webp")}' if single else f'images/womb-{g}.webp') for g in womb_files}
    ph = ph.replace('const WOMB = null;', 'const WOMB = ' + json.dumps(womb) + ';')
    # الترجمات: مدمجة في الملف الواحد، وفي نسخة التطبيق ملف منفصل يُحمَّل فقط عند اختيار لغة غير العربية
    if single:
        for lang in LANGS:
            h = h.replace('<script src="i18n.js"></script>', '<script>\n' + open(d + f'i18n/{lang}.js', encoding='utf-8').read() + '\n</script>\n<script src="i18n.js"></script>')
    for f in SCRIPTS:
        h = h.replace(f'<script src="{f}"></script>', '<script>\n' + open(d + f, encoding='utf-8').read() + '\n</script>')
    h = h.replace('<script src="photos.js"></script>', '<script>\n' + ph + '\n</script>')
    if single:
        fc = open(d + 'fonts.css', encoding='utf-8').read()
        fc = re.sub(r'url\(fonts/([^)]+)\)', lambda m: f'url(data:font/woff2;base64,{b64("fonts/" + m.group(1))})', fc)
        h = h.replace('<link rel="stylesheet" href="fonts.css">', '<style>\n' + fc + '</style>')
    h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + open(d + 'styles.css', encoding='utf-8').read() + '\n</style>')
    h = h.replace('icons/icon.svg', 'data:image/svg+xml;base64,' + b64('icons/icon.svg'))
    h = re.sub(r'\s*<link rel="manifest"[^>]*>', '', h)
    return h.replace('__APP_VERSION__', APP_VERSION)


# نسخة السيرفر من أسئلة البداية (نفس المحتوى)
seed_js = open(d + 'community_seed.js', encoding='utf-8').read()
seed = json.loads(seed_js[seed_js.index('['):seed_js.rindex(']') + 1])
open(d + 'server/api/seed.json', 'w', encoding='utf-8').write(json.dumps(seed, ensure_ascii=False, indent=1) + '\n')

os.makedirs(d + 'dist', exist_ok=True)
open(d + 'dist/nabd.html', 'w', encoding='utf-8').write(build(True))
print('dist/nabd.html', os.path.getsize(d + 'dist/nabd.html') // 1024, 'KB')

www = d + 'dist/www/'
shutil.rmtree(www, ignore_errors=True)
os.makedirs(www + 'images')
open(www + 'index.html', 'w', encoding='utf-8').write(build(False))
for f in os.listdir(d + 'images'):
    if f.endswith('.webp'): shutil.copy(d + 'images/' + f, www + 'images/')
shutil.copytree(d + 'fonts', www + 'fonts')
shutil.copytree(d + 'i18n', www + 'i18n')
shutil.copy(d + 'fonts.css', www)
print('dist/www/index.html', os.path.getsize(www + 'index.html') // 1024, 'KB + images/ + fonts/')
