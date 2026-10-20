/* اختبارات الواجهة (Playwright) لنسخة 1.2 — التشغيل: node tests/e2e.mjs
   - الإعداد الكامل بالتقويمين ومقارنة النتيجة بحساب status()
   - تطابق جدول التحويل الهجري مع Intl لكل يوم في 1440–1460 هـ
   - عرض كل الأسابيع 4–40 بلا أخطاء في الوضعين الفاتح والداكن
   - المفضلة، والمشاركة، والترحيل، والحساب والنسخ مع سيرفر محلي (php -S + SQLite)
   اللقطات تُحفظ في store/screens-1.2 */
import { createRequire } from 'module';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(ROOT, 'store', 'screens-1.2');
fs.mkdirSync(SHOTS, { recursive: true });

/* ---------- خادم الملفات للتطبيق ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const web = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(8091);
const URL0 = 'http://127.0.0.1:8091/';

/* ---------- سيرفر PHP محلي للحساب ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nabd-e2e-'));
fs.cpSync(path.join(ROOT, 'server', 'api'), path.join(tmp, 'api'), { recursive: true });
const dbFile = path.join(tmp, 'nabd.sqlite');
let sql = fs.readFileSync(path.join(ROOT, 'server', 'api', 'schema.sql'), 'utf8').replace(/--.*$/gm, '')
  .replaceAll('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT').replaceAll(' DEFAULT CHARSET=utf8mb4', '')
  .replace(/,\s*INDEX \([^)]*\)/g, '').replace(/UNIQUE KEY \w+ \(/g, 'UNIQUE (');
execFileSync('python3', ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(sys.stdin.read())', dbFile], { input: sql });
const CLIENT = 'web-client.apps.googleusercontent.com';
// مفتاح وهمي لتوقيع توكنات Firebase (السيرفر يتحقق بـ openssl_verify فعلياً)
const fbKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(path.join(tmp, 'certs.json'), JSON.stringify({ kid1: fbKeys.publicKey.export({ type: 'spki', format: 'pem' }) }));
const b64u = b => Buffer.from(b).toString('base64url');
const fbToken = (sub, extra = {}) => { const now = Math.floor(Date.now() / 1000);
  const c = { iss: 'https://securetoken.google.com/nabd-saghir', aud: 'nabd-saghir', sub, iat: now - 5, auth_time: now - 5, exp: now + 3600, name: 'ريم', email: 'reem@example.com', firebase: { sign_in_provider: 'facebook.com', identities: { 'facebook.com': ['42'] } }, ...extra };
  const msg = b64u(JSON.stringify({ alg: 'RS256', kid: 'kid1' })) + '.' + b64u(JSON.stringify(c));
  return msg + '.' + b64u(crypto.sign('sha256', Buffer.from(msg), fbKeys.privateKey)); };
fs.writeFileSync(path.join(tmp, 'api', 'config.php'), `<?php return ['firebase_project_id' => 'nabd-saghir', 'firebase_certs_url' => 'file://${path.join(tmp, 'certs.json')}', 'db_dsn' => 'sqlite:${dbFile}', 'gemini_key' => 'x', 'ai_daily_chat' => 30, 'ai_daily_labs' => 5, 'ai_daily_ip' => 200, 'admin_token' => 'test', 'google_client_ids' => ['${CLIENT}'], 'test_mode' => true];`);
const php = spawn('php', ['-S', '127.0.0.1:8092', '-t', path.join(tmp, 'api')], { stdio: 'ignore' });
const API = 'http://127.0.0.1:8092';

/* ---------- أدوات ---------- */
const browser = await pw.chromium.launch();
let failed = 0;
const ok = (name, cond, info = '') => { if (!cond) failed++; console.log(cond ? '✅' : '❌', name, cond ? '' : JSON.stringify(info)); };
const DAY = 864e5;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// الحساب المتوقع بشكل مستقل: آخر دورة + 280 يوماً (+ فرق طول الدورة)
const expectLmp = (lmp, cycle = 28) => { const due = plus(new Date(lmp + 'T00:00'), 280 + cycle - 28), start = plus(due, -280), days = Math.round((today() - start) / DAY); return { due, week: Math.min(40, Math.max(1, Math.floor(days / 7) + 1)) }; };
const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
const gregFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });

async function page({ theme = 'dark', state = null, api = false, native = null } = {}) {
  if (!state && theme === 'light') state = { theme: 'light' };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, colorScheme: theme, serviceWorkers: 'block', locale: 'ar-SA' });
  // الاختبارات لا تلمس السيرفر الحقيقي: إما سيرفر PHP المحلي أو بدون سيرفر
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.NABD_CONFIG = { apiBase: '${api ? API : ''}', supabaseUrl: '', supabaseKey: '', googleWebClientId: '${CLIENT}', facebook: true };` }));
  await ctx.route('https://accounts.google.com/**', r => r.abort());
  // محاكاة تطبيق أندرويد: إضافة FirebaseAuthentication وهمية
  if (native) await ctx.addInitScript(n => {
    window.__calls = [];
    const FA = { async signInWithFacebook(o) { __calls.push(['facebook', o]); return { user: { uid: 'fb1' } }; },
      async signInWithGoogle(o) { __calls.push(['google', o]); const e = new Error(o && o.useCredentialManager === false ? 'ApiException statusCode=10 DEVELOPER_ERROR: 10: ' : 'GetCredentialCustomException type=com.google.android.libraries.identity.googleid.GetGoogleIdTokenCredentialException: [28444] Developer console is not set up correctly.');
        e.code = o && o.useCredentialManager === false ? 'status-10' : 'GetCredentialCustomException'; throw e; },
      async getIdToken() { return { token: n.token }; }, async signOut() { __calls.push(['signOut']); }, async deleteUser() { __calls.push(['deleteUser']); } };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { FirebaseAuthentication: FA } };
  }, native);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/accounts\.google|ERR_FAILED|womb-|Failed to load resource|\[nabd\] sign-in failed/.test(m.text())) p.errors.push(m.text()); });
  await p.goto(URL0);
  if (state) { await p.evaluate(s => localStorage.setItem('rihlati_v1', JSON.stringify({ theme: 'dark', ...s })), state); await p.reload(); }
  await p.waitForTimeout(400);
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const wait = (p, ms = 450) => p.waitForTimeout(ms);
const profileState = (lmpDaysAgo, extra = {}) => ({ profile: { method: 'lmp', lmp: iso(plus(today(), -lmpDaysAgo)), cycle: 28, name: 'سارة', babyName: 'نونو' }, country: 'SA', news12: 1, theme: 'dark', ...extra });

try {
  /* 1) جدول التحويل الهجري يطابق Intl لكل يوم */
  {
    const p = await page();
    const r = await p.evaluate(() => {
      const t = Cal.table(), first = t[0], last = t[t.length - 1];
      let n = 0, bad = [];
      for (let d = new Date(first); d < last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const h = Cal.parts(d), g = Cal.toGreg(h.y, h.m, h.d);
        n++; if (!g || +g !== +d) bad.push(Cal.iso(d));
      }
      const e = Cal.toGreg(1448, 6, 25);
      return { n, bad: bad.slice(0, 5), first: Cal.iso(first), example: Cal.iso(e), invalid: Cal.toGreg(1448, 1, 31), months: t.length - 1 };
    });
    ok(`تحويل الهجري يطابق Intl في ${r.n} يوماً (${r.months} شهراً، 1440–1460 هـ)`, r.bad.length === 0 && r.months === 252, r);
    ok('25 جمادى الآخرة 1448 هـ = 2026-12-05', r.example === '2026-12-05', r);
    ok('تاريخ هجري غير موجود يُرفض', r.invalid === null, r);
    await p.close();
  }

  /* 2) الإعداد بالميلادي (آخر دورة) + تمرير العجلة فعلياً + حفظ التقدّم */
  for (const theme of ['dark', 'light']) {
    const p = await page({ theme });
    const tag = theme === 'dark' ? 'dark' : 'light';
    await shot(p, `01-welcome-${tag}`);
    await p.click('#onbStart'); await wait(p);
    await shot(p, `02-calendar-${tag}`);
    await p.click('[data-ocal="gregorian"]'); await wait(p, 600);
    await shot(p, `03-method-${tag}`);
    await p.click('[data-om="lmp"]'); await wait(p, 700);
    const before = await p.evaluate(() => document.querySelector('#onbWheel')._picker.value());
    await p.evaluate(() => { const c = document.querySelector('#onbWheel .wheel-col'); c.scrollTop += 80; });
    await wait(p, 500);
    const after = await p.evaluate(() => document.querySelector('#onbWheel')._picker.value());
    ok(`[${tag}] تمرير عجلة اليوم يغيّر التاريخ`, Math.round((new Date(after) - new Date(before)) / DAY) === 2, { before, after });
    const lmp = iso(plus(today(), -226)); // الأسبوع 33
    await p.evaluate(v => document.querySelector('#onbWheel')._picker.set(v), lmp); await wait(p, 300);
    const exp = expectLmp(lmp);
    const live = await p.textContent('#onbLive');
    ok(`[${tag}] بطاقة موعد الولادة تتحدّث فوراً`, live.includes(gregFmt.format(exp.due)) && live.includes('للأسبوع 40'), live);
    await shot(p, `04-date-gregorian-${tag}`);
    // إغلاق التطبيق في المنتصف ثم فتحه: نفس الخطوة
    await p.reload(); await wait(p);
    ok(`[${tag}] حفظ التقدّم عند إغلاق التطبيق`, await p.isVisible('#onbWheel') && (await p.evaluate(() => S.onb.date)) === lmp);
    await p.click('#onbNext'); await wait(p);
    await p.fill('#onbName', 'سارة'); await p.fill('#onbBaby', 'نونو'); await p.selectOption('#onbCountry', 'EG');
    await shot(p, `05-info-${tag}`);
    await p.click('#onbNext'); await wait(p);
    const h = await p.textContent('.onb-result h2');
    ok(`[${tag}] النتيجة: الأسبوع ${exp.week}`, h.includes(`الأسبوع ${exp.week}`) && h.includes('الشهر الثامن'), h);
    await shot(p, `06-result-${tag}`);
    await p.click('#onbNext'); await wait(p);
    const st = await p.evaluate(() => ({ week: status().week, due: Cal.iso(status().due), country: S.country, cal: Cal.mode() }));
    ok(`[${tag}] status() يطابق النتيجة المعروضة`, st.week === exp.week && st.due === iso(exp.due) && st.country === 'EG' && st.cal === 'gregorian', st);
    await shot(p, `07-notifications-${tag}`);
    await p.click('#onbLater'); await wait(p, 700);
    ok(`[${tag}] انتهى الإعداد وظهرت الرئيسية`, await p.isVisible('.meet-card') && !(await p.evaluate(() => !!S.onb)));
    ok(`[${tag}] لا أخطاء أثناء الإعداد`, p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 3) الإعداد بالهجري (أعرف موعد الولادة) + تمرير عجلة الشهر الهجري */
  {
    const p = await page({ theme: 'light' });
    await p.click('#onbStart'); await wait(p);
    await p.click('[data-ocal="hijri"]'); await wait(p, 600);
    await p.click('[data-om="due"]'); await wait(p, 700);
    const due = plus(today(), 60);
    await p.evaluate(v => document.querySelector('#onbWheel')._picker.set(v), iso(due)); await wait(p, 300);
    const live = await p.textContent('#onbLive');
    ok('[هجري] موعد الولادة بالتقويمين والهجري أولاً', live.indexOf(hijriFmt.format(due)) >= 0 && live.indexOf(hijriFmt.format(due)) < live.indexOf(gregFmt.format(due)), live);
    const months = await p.$$eval('#onbWheel .wheel-col:nth-child(2) .wheel-item', e => e.map(x => x.textContent));
    ok('[هجري] أسماء الأشهر الهجرية في العجلة', months[0] === 'محرم' && months[11] === 'ذو الحجة', months);
    await shot(p, '04-date-hijri-light');
    const b = await p.evaluate(() => document.querySelector('#onbWheel')._picker.value());
    await p.evaluate(() => { document.querySelector('#onbWheel .wheel-col:nth-child(2)').scrollTop += 40; }); await wait(p, 500);
    const a = await p.evaluate(() => document.querySelector('#onbWheel')._picker.value());
    const pb = await p.evaluate(v => Cal.parts(new Date(v + 'T00:00')), b), pa = await p.evaluate(v => Cal.parts(new Date(v + 'T00:00')), a);
    ok('[هجري] تمرير عجلة الشهر ينقل شهراً هجرياً كاملاً', (pa.m - pb.m + 12) % 12 === 1 && pa.d === Math.min(pb.d, pa.d), { pb, pa });
    await p.evaluate(v => document.querySelector('#onbWheel')._picker.set(v), iso(due)); await wait(p, 300);
    await p.click('#onbNext'); await wait(p);
    await p.click('#onbSkip'); await wait(p);
    const res = await p.textContent('.onb-result');
    const exp = 40 - Math.floor((due - today()) / DAY / 7);
    ok('[هجري] النتيجة بالتقويمين', res.includes(hijriFmt.format(due)) && res.includes(gregFmt.format(due)), res);
    await shot(p, '06-result-hijri-light');
    await p.click('#onbNext'); await wait(p); await p.click('#onbLater'); await wait(p, 700);
    const st = await p.evaluate(() => ({ week: status().week, cal: Cal.mode(), title: document.querySelector('#title').textContent }));
    ok('[هجري] الرئيسية بالهجري وstatus() صحيح', st.cal === 'hijri' && Math.abs(st.week - exp) <= 1 && /محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو/.test(st.title), st);
    // التواريخ منع غير المنطقي
    const bounds = await p.evaluate(() => { const el = document.createElement('div'); document.body.appendChild(el); const pk = datePicker(el, { cal: 'hijri', value: '2030-01-01', min: '2026-01-01', max: '2026-12-31' }); const v = pk.value(); el.remove(); return v; });
    ok('العجلة تمنع التواريخ خارج الحدود', bounds === '2026-12-31', bounds);
    ok('[هجري] لا أخطاء', p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 4) «وُلد طفلي» من الإعداد */
  {
    const p = await page();
    await p.click('#onbStart'); await wait(p); await p.click('[data-ocal="gregorian"]'); await wait(p, 600);
    await p.click('[data-om="born"]'); await wait(p, 700);
    await p.fill('#onbBabyName', 'يوسف');
    await p.evaluate(v => document.querySelector('#onbWheel')._picker.set(v), iso(plus(today(), -40))); await wait(p, 300);
    await p.click('#onbNext'); await wait(p); await p.click('#onbNext'); await wait(p); await p.click('#onbNext'); await wait(p); await p.click('#onbLater'); await wait(p, 700);
    const b = await p.evaluate(() => S.baby);
    ok('«وُلد طفلي» يفتح متابعة الطفل', b && b.name === 'يوسف' && b.date === iso(plus(today(), -40)) && await p.isVisible('.baby-hero'), b);
    ok('[طفل] لا أخطاء', p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 5) المستخدمات الحاليات: لا إعداد، وبطاقة «جديد» مرة واحدة */
  {
    const st = profileState(100); delete st.news12;
    const p = await page({ state: st });
    ok('الترحيل: لا يظهر الإعداد للمستخدمة الحالية', await p.isVisible('.meet-card') && !(await p.isVisible('.onb')));
    ok('الترحيل: بطاقة «جديد» ظاهرة', await p.isVisible('.news-card'));
    await shot(p, '08-home-whatsnew-dark');
    await p.click('#newsX'); await wait(p);
    await p.reload(); await wait(p);
    ok('الترحيل: البطاقة لا تعود بعد إغلاقها', !(await p.isVisible('.news-card')));
    await p.close();
  }

  /* 13) الإنجليزية: الاكتشاف التلقائي، والاتجاه، ولا نص عربي ظاهر، والرجوع للعربية */
  {
    const arabicLeft = p => p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) if (/[\u0600-\u06FF]/.test(n.nodeValue) && n.parentElement.offsetParent !== null && !n.parentElement.closest('[lang="ar"]')) out.push(n.nodeValue.trim()); return out; });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Chicago' });
    await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.NABD_CONFIG = { apiBase: '', supabaseUrl: '', supabaseKey: '', googleWebClientId: '', facebook: false };` }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await wait(p, 600);
    const d = await p.evaluate(() => ({ lang: I18N.lang, dir: document.documentElement.dir, country: guessCountry(), start: document.querySelector('#onbStart').textContent }));
    ok('[EN] جهاز إنجليزي في أمريكا: الإنجليزية من اليسار لليمين والبلد US', d.lang === 'en' && d.dir === 'ltr' && d.country === 'US' && /start/i.test(d.start), d);
    ok('[EN] شاشة الترحيب بلا نص عربي', !(await arabicLeft(p)).length, await arabicLeft(p));
    await p.evaluate(s => { localStorage.setItem('rihlati_v1', s); localStorage.setItem('nabd_lang', 'en'); }, JSON.stringify({ theme: 'dark', ...profileState(200, { country: 'US' }), profile: { ...profileState(200).profile, name: 'Sarah', babyName: 'Bean' } }));
    await p.reload(); await wait(p, 600);
    const left = [];
    for (const view of ['home', 'weeks', 'assist', 'track', 'more']) { await p.evaluate(v => { route = { view: v }; render(false); }, view); await wait(p, 250); left.push(...await arabicLeft(p)); }
    for (let w = 4; w <= 40; w++) { await p.evaluate(w => { route = { view: 'weeks', week: w, mode: 'week' }; render(false); }, w); left.push(...await arabicLeft(p)); }
    ok('[EN] الشاشات الرئيسية وكل الأسابيع بلا نص عربي', !left.length, [...new Set(left)].slice(0, 10));
    await p.evaluate(() => { route = { view: 'home' }; render(false); }); await wait(p, 400);
    const home = await p.evaluate(() => document.querySelector('#app').innerText);
    ok('[EN] الرئيسية: الأسبوع والشهر بالإنجليزية', /Week 29/.test(home) && /Month 7/.test(home) && /Pregnancy so far/.test(home), home.slice(0, 300));
    await p.evaluate(() => { route = { view: 'more', sub: 'settings' }; render(false); }); await wait(p, 250);
    await p.selectOption('#setLang', 'ar'); await p.waitForLoadState('load'); await wait(p, 600);
    ok('[EN] الرجوع للعربية من الإعدادات يحفظ البيانات', await p.evaluate(() => I18N.lang === 'ar' && document.documentElement.dir === 'rtl' && S.profile && S.profile.name === 'Sarah' && document.title === 'نبضٌ صغير'));
    ok('[EN] لا أخطاء', errs.length === 0, errs);
    await ctx.close();
  }

  /* 6) كل الأسابيع 4–40 + الرئيسية لكل أسبوع، في الوضعين */
  for (const theme of ['light', 'dark']) {
    const p = await page({ theme, state: profileState(150, { theme }) });
    const bad = [];
    for (let w = 4; w <= 40; w++) {
      const r = await p.evaluate(async w => { route = { view: 'weeks', week: w, mode: 'week' }; render(false); await new Promise(r => setTimeout(r, 120)); return { hero: !!document.querySelector('.hero-stage img'), meta: document.querySelector('.week-meta').textContent, items: document.querySelectorAll('.fav-list li, .check').length }; }, w);
      if (!r.hero || !r.meta.includes(`الأسبوع ${w}`) || !r.items) bad.push(w);
      const h = await p.evaluate(async days => { S.profile.lmp = Cal.iso(addDays(today(), -days)); route = { view: 'home' }; render(false); await new Promise(r => setTimeout(r, 120)); return { ring: !!document.querySelector('.meet-ring'), cards: document.querySelectorAll('.span-cards .mini').length, cd: !!document.querySelector('#countdown'), week: status().week }; }, (w - 1) * 7 + 3);
      if (!h.ring || h.cards !== 2 || h.week !== w || h.cd !== (w >= 37)) bad.push('home' + w);
    }
    ok(`[${theme}] كل الأسابيع 4–40 تُعرض بلا أخطاء (الأسبوع + الرئيسية)`, bad.length === 0 && p.errors.length === 0, { bad, errors: p.errors });
    await p.close();
  }

  /* 7) الرئيسية والأرقام والعدّاد، والمفضلة، والإعدادات، والمشاركة — لقطات */
  for (const theme of ['dark', 'light']) {
    const tag = theme;
    const p = await page({ theme, state: profileState(226, { theme }) });
    const txt = await p.textContent('#app');
    ok(`[${tag}] الرئيسية: الشهر وما مضى وما تبقّى وشريط الرحلة`, /الشهر الثامن/.test(txt) && /مضى من الحمل/.test(txt) && /32 أسبوعاً و2 يومان|32 أسبوعاً ويومان/.test(txt) && /تبقّى للولادة/.test(txt) && /بداية الحمل/.test(txt), txt.slice(0, 400));
    ok(`[${tag}] الوزن بالكيلو بمنزلة عشرية واحدة`, /1\.9 كغ/.test(await p.textContent('.hero-stage')));
    await shot(p, `09-home-week33-${tag}`);
    await p.evaluate(() => window.scrollTo(0, 420)); await wait(p, 300);
    await shot(p, `10-home-numbers-${tag}`);
    await p.evaluate(days => { S.profile.lmp = Cal.iso(addDays(today(), -days)); render(false); }, 266); await wait(p, 1200);
    const cd = await p.textContent('#countdown');
    ok(`[${tag}] عدّاد تنازلي في آخر 4 أسابيع`, /يوم/.test(cd) && /ثانية/.test(cd) && !/--/.test(cd), cd);
    await p.evaluate(() => document.querySelector('#countdown').scrollIntoView({ block: 'center' })); await wait(p, 200);
    await shot(p, `11-home-countdown-${tag}`);
    // المفضلة من صفحة الأسبوع
    await p.evaluate(() => { route = { view: 'weeks', week: 24, mode: 'week', sec: 'tips' }; render(false); }); await wait(p);
    await p.click('.fav-list li:first-child .fav-btn'); await wait(p);
    await p.evaluate(() => document.querySelector('#secTabs').scrollIntoView({ block: 'start' })); await wait(p, 200);
    await shot(p, `12-week-favorite-${tag}`);
    const f = await p.evaluate(() => S.favorites);
    ok(`[${tag}] حفظ نصيحة في المفضلة`, f.length === 1 && f[0].type === 'tip' && f[0].week === 24, f);
    await p.evaluate(() => { route = { view: 'more', sub: 'favs' }; render(false); }); await wait(p);
    ok(`[${tag}] صفحة المفضلة تعرضها`, (await p.$$('.fav-card')).length === 1);
    await shot(p, `13-favorites-${tag}`);
    await p.click('.fav-open'); await wait(p);
    ok(`[${tag}] فتح العنصر من المفضلة يعود للأسبوع`, await p.evaluate(() => route.view === 'weeks' && route.week === 24));
    // الإعدادات: التقويم وموعد الولادة بالتقويمين
    await p.evaluate(() => { route = { view: 'more', setOpen: true }; render(false); }); await wait(p);
    await p.click('[data-cal="hijri"]'); await wait(p);
    const set = await p.textContent('#setDetails');
    ok(`[${tag}] الإعدادات: موعد الولادة بالتقويمين`, set.includes(' هـ – ') && set.includes(' م'), set.slice(0, 300));
    await p.evaluate(() => document.querySelector('#calSeg').scrollIntoView({ block: 'center' })); await wait(p, 200);
    await shot(p, `14-settings-calendar-${tag}`);
    // المشاركة: صورة الأسبوع
    const png = await p.evaluate(async () => (await weekCard(24)).toDataURL('image/png'));
    fs.writeFileSync(path.join(SHOTS, `15-share-week24.png`), Buffer.from(png.split(',')[1], 'base64'));
    ok(`[${tag}] صورة المشاركة تُنشأ (1080×1350)`, png.length > 100000);
    ok(`[${tag}] لا أخطاء`, p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 8) شريحة «داخل الرحم»: تختفي بدون صورة، وتظهر بالأسماء عند توفرها */
  {
    const p = await page({ state: profileState(150) });
    await p.evaluate(() => { route = { view: 'weeks', week: 22, mode: 'week' }; render(false); }); await wait(p, 600);
    ok('داخل الرحم: الشريحة تختفي إن لم توجد الصورة', (await p.$$('#car .slide')).length === 2 && (await p.$$('#dots i')).length === 2);
    await p.route('**/images/womb-3.webp', r => r.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(ROOT, 'images', 'week-22.webp')) }));
    await p.evaluate(() => { route.week = 23; render(false); }); await wait(p, 600);
    const labels = await p.$$eval('#car .slide:nth-child(3) text', t => t.map(x => x.textContent));
    ok('داخل الرحم: الشريحة الثالثة بالأسماء المرسومة بالكود', ['المشيمة', 'الحبل السري', 'عنق الرحم', 'الرحم', 'السائل الأمنيوسي'].every(n => labels.includes(n)), labels);
    await p.close();
  }

  /* 9) الحساب: نسخ تلقائي، استرجاع على جهاز جديد، اختيار النسخة، الحذف */
  {
    const A = await page({ api: true, theme: 'light' });
    ok('الحساب: رابط «لديّ حساب» يظهر عند تفعيل الحساب', await A.isVisible('#onbLogin'));
    await A.click('#onbStart'); await wait(A); await A.click('[data-ocal="gregorian"]'); await wait(A, 600); await A.click('[data-om="lmp"]'); await wait(A, 700);
    await A.evaluate(v => document.querySelector('#onbWheel')._picker.set(v), iso(plus(today(), -120))); await wait(A, 300);
    await A.click('#onbNext'); await wait(A); await A.click('#onbNext'); await wait(A); await A.click('#onbNext'); await wait(A); await A.click('#onbLater'); await wait(A);
    ok('الحساب: خطوة تسجيل الدخول الاختيارية', await A.isVisible('#onbGuest') && (await A.textContent('.onb')).includes('احفظي بياناتك على السحابة'));
    await shot(A, '16-login-optional-light');
    await A.evaluate(() => Account._finish('test:g-100:mona@example.com:منى علي', { from: 'onboarding' })); await wait(A, 1200);
    const u = await A.evaluate(() => ({ user: Account.user(), home: !!document.querySelector('.meet-card'), inS: JSON.stringify(S).includes('token') }));
    ok('الحساب: تسجيل الدخول ثم الرئيسية، والتوكن ليس داخل بيانات التطبيق', u.user && u.user.email === 'mona@example.com' && u.home && !u.inS, u);
    const cloud = await A.evaluate(async api => { const a = Account.user(); const r = await fetch(api + '/backup.php', { headers: { Authorization: 'Bearer ' + a.token } }); return r.json(); }, API);
    ok('الحساب: النسخة وصلت للسحابة', cloud.data && JSON.parse(cloud.data).profile.lmp === iso(plus(today(), -120)), cloud);
    // نسخ تلقائي عند الخروج من التطبيق
    await A.evaluate(() => { S.nick = 'أم يوسف'; save(); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(A, 800);
    const c2 = await A.evaluate(async api => (await (await fetch(api + '/backup.php', { headers: { Authorization: 'Bearer ' + Account.user().token } })).json()), API);
    ok('الحساب: نسخ تلقائي عند الخروج من التطبيق', JSON.parse(c2.data).nick === 'أم يوسف', c2.data && c2.data.slice(0, 80));
    await A.evaluate(() => { route = { view: 'more', sub: 'account' }; render(false); }); await wait(A);
    await shot(A, '17-account-light');

    // جهاز جديد فارغ: تسجيل الدخول من شاشة الترحيب يسترجع كل شيء
    const B = await page({ api: true });
    await B.evaluate(() => Account._finish('test:g-100:mona@example.com:منى علي', { from: 'welcome' })); await wait(B, 1200);
    const rb = await B.evaluate(() => ({ lmp: S.profile && S.profile.lmp, nick: S.nick, onb: !!S.onb, home: !!document.querySelector('.meet-card') }));
    ok('الحساب: الاسترجاع على جهاز جديد', rb.lmp === iso(plus(today(), -120)) && rb.nick === 'أم يوسف' && !rb.onb && rb.home, rb);

    // جهاز عليه بيانات أخرى: سؤال «أي نسخة؟» ولا مسح صامت
    const C = await page({ api: true, theme: 'light', state: profileState(50, { theme: 'light' }) });
    await C.evaluate(() => Account._finish('test:g-100:mona@example.com:منى علي', { from: 'account' })); await wait(C, 1200);
    ok('الحساب: يسأل أي نسخة عند وجود بيانات في الجهازين', await C.isVisible('#verOk'));
    const def = await C.evaluate(() => document.querySelector('input[name=ver]:checked').value);
    ok('الحساب: الأحدث مختار افتراضياً', def === 'local', def);
    await shot(C, '18-choose-version-light');
    await C.check('input[value=cloud]'); await C.click('#verOk'); await wait(C, 800);
    const rc = await C.evaluate(() => ({ lmp: S.profile.lmp, saved: !!localStorage.getItem('rihlati_v1_before_restore') }));
    ok('الحساب: اختيار السحابة يسترجعها ويحفظ نسخة الجهاز احتياطياً', rc.lmp === iso(plus(today(), -120)) && rc.saved, rc);

    // حذف الحساب: تأكيد مرتين
    await C.evaluate(() => { route = { view: 'more', sub: 'account' }; render(false); }); await wait(C);
    ok('الحساب: الإزالة مخفية تحت «إعدادات متقدمة»', !(await C.isVisible('#accDel')));
    await C.click('#accAdv summary'); await wait(C, 200);
    await C.click('#accDel'); await wait(C);
    await C.click('#accDelFinal'); await wait(C, 200); await C.click('#accDelFinal'); await wait(C, 900);
    const after = await C.evaluate(() => ({ user: Account.user(), data: !!S.profile }));
    ok('الحساب: الحذف النهائي يسجّل الخروج ويُبقي بيانات الجهاز', !after.user && after.data, after);
    const gone = await B.evaluate(async api => (await fetch(api + '/backup.php', { headers: { Authorization: 'Bearer ' + Account.user().token } })).status, API);
    ok('الحساب: كل الجلسات انتهت بعد الحذف', gone === 401, gone);
    ok('الحساب: لا أخطاء', [...A.errors, ...B.errors, ...C.errors].length === 0, [...A.errors, ...B.errors, ...C.errors]);
    await Promise.all([A.close(), B.close(), C.close()]);
  }


  /* 9b) تسجيل الدخول في تطبيق أندرويد (إضافة Firebase وهمية + توكن موقّع حقيقي): Facebook ثم خطأ Google بالتفاصيل */
  {
    const p = await page({ api: true, theme: 'light', state: profileState(120, { theme: 'light' }), native: { token: fbToken('fb-uid-9') } });
    await p.evaluate(() => { route = { view: 'more', sub: 'account' }; render(false); }); await wait(p);
    ok('أندرويد: زرّا Google وFacebook ظاهران', await p.isVisible('[data-prov="google"]') && await p.isVisible('[data-prov="facebook"]'));
    await shot(p, '19-login-buttons-light');
    await p.click('[data-prov="facebook"]'); await wait(p, 1200);
    const u = await p.evaluate(() => ({ user: Account.user(), calls: __calls }));
    ok('Facebook: Firebase ← auth.php ← حفظ الجلسة', u.user && u.user.name === 'ريم' && u.user.token.length === 64 && u.calls[0][0] === 'facebook', u);
    const b = await p.evaluate(async api => (await fetch(api + '/backup.php', { headers: { Authorization: 'Bearer ' + Account.user().token } })).json(), API);
    ok('Facebook: الجلسة تعمل والنسخة وصلت للسحابة', b.data && JSON.parse(b.data).profile, b);
    await p.evaluate(() => Account.signOut()); await wait(p, 300);
    await p.evaluate(() => { render(false); }); await wait(p);
    await p.click('[data-prov="google"]'); await wait(p, 800);
    const err = await p.textContent('.err-box').catch(() => '');
    ok('Google: الخطأ يظهر كاملاً (النوع والكود وstatusCode) ولا تُغلق بصمت', /GetCredentialCustomException/.test(err) && /statusCode=10/.test(err) && /status-10/.test(err) && /google:legacy/.test(err), err);
    const calls = await p.evaluate(() => __calls.filter(c => c[0] === 'google').map(c => c[1]));
    ok('Google: بدون scopes إضافية، ثم إعادة المحاولة بالنافذة التقليدية', calls.length === 2 && !calls[0] && calls[1].useCredentialManager === false, calls);
    await shot(p, '20-login-error-light');
    ok('أندرويد: لا أخطاء', p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 11) أدوات الثلث الأخير */
  for (const theme of ['dark', 'light']) {
    const p = await page({ theme, state: profileState(240, { theme }) }); // الأسبوع 35
    // الرئيسية: اختصارات من الأسبوع 28 (والشنطة من 32)
    ok(`[${theme}] الرئيسية: اختصار الركلات والشنطة`, await p.isVisible('.home-tools [data-sub="kicks"]') && await p.isVisible('.home-tools [data-sub="bag"]'));
    // عدّاد الركلات: هدف 10 ثم حفظ تلقائي
    await p.evaluate(() => { route = { view: 'track', sub: 'kicks' }; render(false); }); await wait(p);
    await p.click('#kickStart'); await wait(p, 400);
    const kl = await p.evaluate(() => ({ t: document.querySelector('.kick-left')?.textContent, s: S._kick, html: app.innerHTML.slice(0, 200) }));
    ok(`[${theme}] الركلات: جلسة بعدّاد ساعتين`, /متبقٍ\s*(2:00:00|1:59)/.test(kl.t || ''), kl);
    await shot(p, `21-kicks-session-${theme}`);
    for (let i = 0; i < 10; i++) { await p.click('#kickBtn'); await wait(p, 60); }
    const k = await p.evaluate(() => ({ s: S._kick, last: S.kicks[S.kicks.length - 1], txt: document.querySelector('.result').textContent }));
    ok(`[${theme}] الركلات: الوصول لـ10 يحفظ الجلسة تلقائياً`, !k.s && k.last.count === 10 && k.last.goal && /10 ركلات/.test(k.txt), k);
    // جلسة انتهت ساعتاها والتطبيق مغلق
    await p.evaluate(() => { S._kick = { start: Date.now() - 2.1 * 3600e3, count: 4 }; route.kickDone = null; render(false); }); await wait(p);
    const k2 = await p.evaluate(() => ({ s: S._kick, txt: document.querySelector('.result').textContent, rows: document.querySelectorAll('.t tr').length }));
    ok(`[${theme}] الركلات: انتهاء الساعتين بأقل من 10 = تنبيه للطبيب`, !k2.s && /4 ركلات فقط/.test(k2.txt) && k2.rows >= 2, k2);
    await shot(p, `22-kicks-log-${theme}`);
    // مؤقّت الطلق: نمط منتظم لساعة = «توجّهي للمستشفى»
    await p.evaluate(() => { const now = Date.now(); S.contractions = Array.from({ length: 14 }, (_, i) => { const st = now - (13 - i) * 4.6 * 60e3 - 70e3; return { start: st, end: st + 62e3 }; }); route = { view: 'track', sub: 'contractions' }; render(false); }); await wait(p);
    const c = await p.textContent('#app');
    ok(`[${theme}] الطلق: قاعدة 5-1-1 تُظهر «توجّهي للمستشفى» مع التنبيه الطبي`, /توجّهي للمستشفى الآن/.test(c) && /تنبيه طبي/.test(c) && /4\.6 دقيقة/.test(c), c.slice(0, 300));
    await shot(p, `23-contractions-511-${theme}`);
    await p.evaluate(() => { const now = Date.now(); S.contractions = Array.from({ length: 6 }, (_, i) => { const st = now - (5 - i) * 4.5 * 60e3 - 70e3; return { start: st, end: st + 60e3 }; }); render(false); }); await wait(p);
    ok(`[${theme}] الطلق: انتظام أقل من ساعة = «بدأت تنتظم» فقط`, /بدأت تنتظم/.test(await p.textContent('#app')) && !(await p.isVisible('.go-hospital')));
    // الوزن: النطاق المتوقع حسب BMI
    await p.evaluate(() => { S.profile.height = 160; S.profile.preWeight = 60; S.weights = [{ date: Cal.iso(addDays(today(), -2)), kg: 70 }]; route = { view: 'track', sub: 'weight' }; render(false); }); await wait(p);
    const w = await p.textContent('#app');
    ok(`[${theme}] الوزن: BMI والنطاق الموصى به والمتوقع لهذا الأسبوع`, /23\.4/.test(w) && /11\.5–16/.test(w) && /المتوقع حتى الأسبوع 35/.test(w) && /ضمن النطاق/.test(w), w.slice(0, 300));
    await shot(p, `24-weight-${theme}`);
    // الشنطة: الأوراق
    await p.evaluate(() => { route = { view: 'track', sub: 'bag' }; render(false); }); await wait(p);
    ok(`[${theme}] الشنطة: للأم والمولود والأوراق`, /📄 الأوراق/.test(await p.textContent('#app')));
    await p.click('[data-bag="عقد الزواج (يُطلب في بعض الدول لتسجيل المولود)"]'); await wait(p, 200);
    ok(`[${theme}] الشنطة: checkbox يُحفظ`, await p.evaluate(() => !!S.bag['عقد الزواج (يُطلب في بعض الدول لتسجيل المولود)']));
    // المزاج السريع + تصدير PDF
    await p.evaluate(() => { route = { view: 'track' }; render(false); }); await wait(p);
    await p.click('[data-qmood="🥰"]'); await wait(p, 200);
    ok(`[${theme}] المزاج: إدخال سريع بالإيموجي`, await p.evaluate(() => S.journal.find(j => j.date === Cal.iso(today())).mood === '🥰'));
    await shot(p, `25-track-quickmood-${theme}`);
    if (theme === 'light') {
      const pdf = await p.evaluate(async () => {
        for (let i = 1; i < 40; i++) S.journal.push({ date: Cal.iso(addDays(today(), -i)), mood: MOODS[i % 8], symptoms: SYMPTOMS_LIST.slice(i % 5, i % 5 + 3), note: i % 3 ? '' : 'ملاحظة للطبيب عن النوم والتعب في هذا اليوم' });
        const b = await journalPdf(); const a = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s);
      });
      const buf = Buffer.from(pdf, 'base64'), pdfPath = path.join(SHOTS, 'report-sample.pdf');
      fs.writeFileSync(pdfPath, buf);
      let info = ''; try { info = execFileSync('pdfinfo', [pdfPath]).toString(); } catch (e) { info = String(e); }
      ok('المفكرة: تصدير PDF صالح بعدة صفحات A4', buf.slice(0, 8).toString() === '%PDF-1.4' && /Pages:\s+[2-9]/.test(info) && /595 x 842/.test(info), info);
      try { execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '1', pdfPath, path.join(SHOTS, '26-report-page')]); } catch {}
    }
    // تذكير الماء بوقت تحدده المستخدمة
    await p.evaluate(() => { route = { view: 'more', setOpen: true }; render(false); }); await wait(p);
    await p.selectOption('[data-remw="waterFrom"]', '8'); await wait(p, 200);
    await p.selectOption('[data-remw="waterEvery"]', '3'); await wait(p, 200);
    const hrs = await p.evaluate(() => Notify.waterHours(Notify.rem()));
    ok(`[${theme}] تذكير الماء: من/إلى/كل حسب الاختيار`, JSON.stringify(hrs) === '[8,11,14,17]', hrs);
    // حجم الخط
    await p.click('#fontSeg [data-font="xl"]'); await wait(p, 200);
    const fs1 = await p.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    ok(`[${theme}] حجم الخط «أكبر» يكبّر النصوص`, fs1 === '20px', fs1);
    await p.evaluate(() => document.querySelector('#fontSeg').scrollIntoView({ block: 'center' })); await wait(p, 200);
    await shot(p, `27-settings-font-water-${theme}`);
    await p.click('#fontSeg [data-font="md"]'); await wait(p, 200);
    // التباين AA
    const v = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim(); return Object.fromEntries(['--bg', '--card', '--card-2', '--soft', '--text', '--muted', '--ink', '--ink-2', '--btn-a', '--btn-b', '--warn', '--ok'].map(k => [k, g(k)])); });
    const lum = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); };
    const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const pairs = [['--text', '--card'], ['--muted', '--card'], ['--muted', '--bg'], ['--muted', '--card-2'], ['--ink', '--card'], ['--ink', '--soft'], ['--ink-2', '--card'], ['--warn', '--card'], ['--ok', '--card']].map(([a, b]) => [a + '/' + b, cr(v[a], v[b])]);
    pairs.push(['#fff/--btn-a', cr('#ffffff', v['--btn-a'])], ['#fff/--btn-b', cr('#ffffff', v['--btn-b'])]);
    const bad = pairs.filter(x => x[1] < 4.5);
    ok(`[${theme}] تباين الألوان AA (4.5:1) للنصوص والأزرار`, !bad.length, bad.map(x => `${x[0]}=${x[1].toFixed(2)}`));
    ok(`[${theme}] الأدوات: لا أخطاء`, p.errors.length === 0, p.errors);
    await p.close();
  }

  /* 12) الأداء: زمن الإقلاع للملف الواحد ونسخة التطبيق (الصور منفصلة) */
  {
    const st = JSON.stringify(profileState(200));
    const boot = async url => { const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
      await p.goto(url); await p.evaluate(s => localStorage.setItem('rihlati_v1', s), st); const t = [];
      for (let i = 0; i < 3; i++) { await p.reload(); await p.waitForFunction(() => window.NABD_BOOT); t.push(await p.evaluate(() => window.NABD_BOOT)); }
      await ctx.close(); return Math.min(...t); };
    const wwwSrv = http.createServer((q, r) => { const f = path.join(ROOT, 'dist', 'www', decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8093);
    const single = await boot('file://' + path.join(ROOT, 'dist', 'nabd.html')), appv = await boot('http://127.0.0.1:8093/');
    wwwSrv.close();
    const kb = f => Math.round(fs.statSync(f).size / 1024);
    console.log(`   ⏱️ زمن الإقلاع: الملف الواحد ${single} مللي ثانية (${kb(path.join(ROOT, 'dist', 'nabd.html'))} KB) · نسخة التطبيق ${appv} مللي ثانية (${kb(path.join(ROOT, 'dist', 'www', 'index.html'))} KB)`);
    ok('الأداء: نسخة التطبيق أخف وأسرع إقلاعاً من الملف الواحد', appv <= single && kb(path.join(ROOT, 'dist', 'www', 'index.html')) < 1000, { single, appv });
  }

  /* 10) الملف الواحد المبني (dist/nabd.html) يعمل */
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(ROOT, 'dist', 'nabd.html')); await wait(p, 600);
    ok('dist/nabd.html: شاشة الترحيب بلا أخطاء', await p.isVisible('#onbStart') && errs.length === 0, errs);
    await ctx.close();
  }

} finally {
  await browser.close(); php.kill(); web.close(); fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\n❌ فشل ${failed} اختبار` : '\n✅ كل اختبارات الواجهة نجحت');
process.exit(failed ? 1 : 0);
