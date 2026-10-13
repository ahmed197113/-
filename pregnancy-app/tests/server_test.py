"""اختبار السيرفر محلياً: php -S + SQLite، بتوكن Google وهمي (وضع الاختبار لا يعمل إلا مع php -S).
التشغيل: python3 tests/server_test.py"""
import json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, 'server', 'api')
tmp = tempfile.mkdtemp(prefix='nabd-srv-')
shutil.copytree(API, os.path.join(tmp, 'api'))
db = os.path.join(tmp, 'nabd.sqlite')

# نفس schema.sql بعد تحويله لصيغة SQLite
sql = open(os.path.join(API, 'schema.sql'), encoding='utf-8').read()
sql = re.sub(r'--.*', '', sql).replace('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(' DEFAULT CHARSET=utf8mb4', '')
sql = re.sub(r',\s*INDEX \([^)]*\)', '', sql)
sql = re.sub(r'UNIQUE KEY \w+ \(', 'UNIQUE (', sql)
import sqlite3
con = sqlite3.connect(db); con.executescript(sql); con.close()

# مفتاح وشهادة وهميان لتوقيع توكنات Firebase في الاختبار (التحقق الحقيقي بـ openssl_verify)
import base64
key = os.path.join(tmp, 'fb.key'); crt = os.path.join(tmp, 'fb.crt')
subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=test'], check=True, capture_output=True)
certs = os.path.join(tmp, 'certs.json')
json.dump({'kid1': open(crt).read()}, open(certs, 'w'))
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def fb_token(sub, aud='nabd-saghir', exp=3600, google=None, kid='kid1', name='منى', email='m@example.com', provider='google.com', sign_key=key):
    now = int(time.time())
    c = {'iss': f'https://securetoken.google.com/{aud}', 'aud': aud, 'sub': sub, 'iat': now - 10, 'auth_time': now - 10, 'exp': now + exp, 'name': name, 'email': email,
         'firebase': {'sign_in_provider': provider, 'identities': ({'google.com': [google]} if google else {'facebook.com': ['123']})}}
    msg = b64u(json.dumps({'alg': 'RS256', 'kid': kid}).encode()) + '.' + b64u(json.dumps(c, ensure_ascii=False).encode())
    sig = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', sign_key], input=msg.encode(), capture_output=True, check=True).stdout
    return msg + '.' + b64u(sig)

open(os.path.join(tmp, 'api', 'config.php'), 'w').write(f"""<?php return [
  'firebase_project_id' => 'nabd-saghir', 'firebase_certs_url' => 'file://{certs}',
  'db_dsn' => 'sqlite:{db}', 'gemini_key' => 'x', 'ai_daily_chat' => 30, 'ai_daily_labs' => 5, 'ai_daily_ip' => 200,
  'admin_token' => 'test', 'google_client_ids' => ['web-client.apps.googleusercontent.com'], 'auth_daily_ip' => 14, 'test_mode' => true ];""")
port = 8765
srv = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', os.path.join(tmp, 'api')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
DEV = 'devtest12345678'

def call(method, file, body=None, token=None, dev=DEV):
    h = {'Content-Type': 'application/json'}
    if dev: h['X-Device'] = dev
    if token: h['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(f'http://127.0.0.1:{port}/{file}', data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

ok = True
def check(name, cond, info=''):
    global ok
    ok &= bool(cond)
    print(('✅' if cond else '❌'), name, '' if cond else info)

try:
    s, r = call('POST', 'auth.php', {'id_token': 'test:sub-1:mama@example.com:سارة أحمد'})
    check('auth: توكن وهمي في وضع الاختبار يُنشئ جلسة', s == 200 and len(r.get('token', '')) == 64 and r['user']['email'] == 'mama@example.com', r)
    tok = r.get('token')
    s, r = call('POST', 'auth.php', {'id_token': 'eyJhbGciOi.bad.token'})
    check('auth: توكن غير صالح يُرفض', s == 401, r)
    s, r = call('GET', 'backup.php', token=tok)
    check('backup: لا توجد نسخة في البداية', s == 200 and r['data'] is None, r)
    data = json.dumps({'profile': {'method': 'lmp', 'lmp': '2026-05-01'}, 'nick': 'أم يوسف', '_mt': 1}, ensure_ascii=False)
    s, r = call('PUT', 'backup.php', {'data': data}, token=tok)
    check('backup: حفظ النسخة', s == 200 and r.get('ok'), r)
    s, r = call('GET', 'backup.php', token=tok)
    check('backup: الاسترجاع يطابق المحفوظ', s == 200 and r['data'] == data and r['updated'] > 0, r)
    # البيانات الجديدة في 1.2.48 تدخل في النسخة كما هي
    full = {'profile': {'method': 'lmp', 'lmp': '2026-03-01'}, 'kicks': [{'at': 1, 'count': 10, 'sec': 900, 'goal': True}], '_kick': {'start': 5, 'count': 3},
            'contractions': [{'start': 1, 'end': 61000}], 'journal': [{'date': '2026-10-01', 'mood': '🥰', 'symptoms': ['تعب'], 'note': ''}],
            'bag': {'عقد الزواج (يُطلب في بعض الدول لتسجيل المولود)': True}, 'weights': [{'date': '2026-10-01', 'kg': 70}],
            'reminders': {'water': True, 'waterFrom': 8, 'waterTo': 20, 'waterEvery': 3, 'vit': True, 'vitTime': '09:30'}, 'font': 'xl', 'crash': False, 'favorites': [{'id': 'w24.tips.0'}]}
    s, r = call('PUT', 'backup.php', {'data': json.dumps(full, ensure_ascii=False)}, token=tok)
    s, r = call('GET', 'backup.php', token=tok)
    check('backup: الركلات والطلق والمفكرة والشنطة والتذكيرات تُحفظ وتُسترجع', s == 200 and json.loads(r['data']) == full, r)
    s, r = call('PUT', 'backup.php', {'data': json.dumps({'x': 'a' * (520 * 1024)})}, token=tok)
    check('backup: رفض نسخة أكبر من 512KB', s == 413, r)
    s, r = call('PUT', 'backup.php', {'data': 'not json'}, token=tok)
    check('backup: رفض JSON غير صالح', s == 400, r)
    s, r = call('GET', 'backup.php', token='0' * 64)
    check('backup: جلسة غير معروفة = 401', s == 401, r)
    s, r = call('GET', 'backup.php')
    check('backup: بدون توكن = 401', s == 401, r)
    # جهاز ثانٍ لنفس الحساب يسترجع النسخة
    s, r2 = call('POST', 'auth.php', {'id_token': 'test:sub-1:mama@example.com:سارة أحمد'}, dev='devsecond12345')
    s, r = call('GET', 'backup.php', token=r2['token'], dev='devsecond12345')
    check('backup: الاسترجاع على جهاز جديد', r.get('data') and json.loads(r['data']) == full, r)
    # منشور في المجتمع ثم حذف الحساب
    s, r = call('POST', 'community.php', {'action': 'add', 'title': 'سؤال تجربة للحذف', 'body': 'تفاصيل السؤال هنا', 'nick': 'سارة'})
    qid = r.get('id')
    check('community: نشر سؤال', s == 200 and qid, r)
    s, r = call('POST', 'account.php', {'action': 'delete'}, token=tok)
    check('account: حذف الحساب', s == 200 and r.get('ok'), r)
    s, r = call('POST', 'community.php', {'action': 'list'}, dev='devother1234567')
    check('account: منشورات الحساب المحذوف مخفية', all(q['id'] != str(qid) for q in r['items']), r)
    s, r = call('GET', 'backup.php', token=r2['token'], dev='devsecond12345')
    check('account: كل الجلسات انتهت بعد الحذف', s == 401, r)
    con = sqlite3.connect(db)
    left = [con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ('users', 'backups', 'sessions', 'user_devices')]
    con.close()
    check('account: لا يبقى أي أثر للحساب في القاعدة', left == [0, 0, 0, 0], left)
    s, r = call('POST', 'account.php', {'action': 'request_delete', 'email': 'someone@example.com'}, dev=None)
    check('account: طلب حذف من صفحة الويب', s == 200, r)
    s, r = call('POST', 'account.php', {'action': 'request_delete', 'email': 'bad'}, dev=None)
    check('account: رفض بريد غير صالح', s == 400, r)
    # Firebase: Google من التطبيق = نفس حساب Google من المتصفح
    s, r = call('POST', 'auth.php', {'id_token': 'test:google-77:g@example.com:هند'})
    s, _ = call('PUT', 'backup.php', {'data': json.dumps({'profile': {'method': 'due', 'due': '2027-01-01'}})}, token=r['token'])
    s, r = call('POST', 'auth.php', {'firebase_token': fb_token('fbuid-1', google='google-77')})
    check('firebase: توكن Google من التطبيق موقّع وصحيح', s == 200 and len(r.get('token', '')) == 64, r)
    s, r = call('GET', 'backup.php', token=r.get('token'))
    check('firebase: نفس حساب Google في المتصفح والتطبيق', s == 200 and r.get('data') and '2027-01-01' in r['data'], r)
    s, r = call('POST', 'auth.php', {'firebase_token': fb_token('fbuid-2', provider='facebook.com', email='')})
    check('firebase: الدخول بـ Facebook حساب مستقل', s == 200 and r['user']['name'] == 'منى', r)
    s, r = call('GET', 'backup.php', token=r.get('token'))
    check('firebase: حساب Facebook الجديد بدون نسخة', r.get('data') is None, r)
    other = os.path.join(tmp, 'other.key'); subprocess.run(['openssl', 'genrsa', '-out', other, '2048'], check=True, capture_output=True)
    for name, tk in [('توقيع مزوّر', fb_token('x', sign_key=other)), ('مشروع آخر', fb_token('x', aud='other-proj')), ('منتهي', fb_token('x', exp=-60)), ('kid غير معروف', fb_token('x', kid='nope'))]:
        s, r = call('POST', 'auth.php', {'firebase_token': tk})
        check(f'firebase: رفض توكن ({name})', s == 401, r)
    codes = [call('POST', 'auth.php', {'id_token': 'test:sub-2:b@example.com:ب'})[0] for _ in range(6)]
    check('auth: حد المحاولات لكل IP', codes[-1] == 429, codes)
finally:
    srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\nكل اختبارات السيرفر نجحت ✅' if ok else '\nفشل بعض الاختبارات ❌')
sys.exit(0 if ok else 1)
