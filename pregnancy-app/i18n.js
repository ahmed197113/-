/* نبضٌ صغير — اللغات وتحديد البلد
   - كل نص عربي في الكود ملفوف بـ L('...') أو L`...${x}...`، والنص العربي نفسه هو مفتاح الترجمة.
   - الترجمات في i18n/<lang>.js على شكل { "النص العربي": "the translation" } والمتغيرات {0} {1} بالترتيب.
   - النص بلا ترجمة يظهر بالعربية كما هو (لا يتعطل شيء)، و`python3 i18n/check.py` يعدّ الناقص.
   - اللغة تُحدَّد قبل تحميل أي بيانات، وتغييرها يعيد تحميل التطبيق.
   - البلد يُخمَّن من المنطقة الزمنية للجهاز ثم من لغته (بدون أي صلاحية موقع). */
'use strict';

const I18N = (() => {
  const LS = 'nabd_lang';
  const LANGS = [
    { c: 'ar', n: 'العربية', dir: 'rtl', loc: 'ar' },
    { c: 'en', n: 'English', dir: 'ltr', loc: 'en-GB' }
  ];
  const DICTS = { en: () => window.I18N_EN };

  // المنطقة الزمنية ← البلد (الأدق لمعرفة مكان المستخدمة فعلياً)
  const TZ = {
    'Asia/Riyadh': 'SA', 'Africa/Cairo': 'EG', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH',
    'Asia/Muscat': 'OM', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Baghdad': 'IQ', 'Asia/Gaza': 'PS',
    'Asia/Hebron': 'PS', 'Asia/Aden': 'YE', 'Africa/Khartoum': 'SD', 'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ',
    'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'MA', 'Africa/Nouakchott': 'MR', 'Africa/Mogadishu': 'SO', 'Africa/Djibouti': 'DJ', 'Indian/Comoro': 'KM',
    'Europe/London': 'GB', 'Europe/Belfast': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
    'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Istanbul': 'TR', 'Asia/Istanbul': 'TR', 'Asia/Tehran': 'IR', 'Asia/Karachi': 'PK',
    'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH',
    'Asia/Singapore': 'SG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Pacific/Auckland': 'NZ',
    'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
    'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Montreal': 'CA'
  };
  const tzCountry = tz => TZ[tz] || (/^Australia\//.test(tz) ? 'AU' : /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Juneau|Adak)|^Pacific\/Honolulu/.test(tz) ? 'US' : '');
  const ARAB = ['SA', 'EG', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'SY', 'IQ', 'PS', 'YE', 'SD', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SO', 'DJ', 'KM'];

  const langs = () => { try { return navigator.languages && navigator.languages.length ? [...navigator.languages] : [navigator.language || '']; } catch { return []; } };
  // البلد المكتشف: '' إن لم يُعرف (التطبيق يكمل بقائمة البلدان المعروفة لديه)
  function country(known) {
    const ok = c => c && (!known || known(c));
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    const byTz = tzCountry(tz);
    if (ok(byTz)) return byTz;
    for (const l of langs()) { const r = (l.split('-')[1] || '').toUpperCase(); if (ok(r)) return r; }
    return '';
  }

  // اللغة: المختارة سابقاً ← المستخدمة الحالية تبقى بالعربية ← لغة الجهاز ← بلد عربي = عربي ← إنجليزي
  function detect() {
    try { const v = localStorage.getItem(LS); if (LANGS.some(x => x.c === v)) return v; } catch {}
    try { if (localStorage.getItem('rihlati_v1')) return 'ar'; } catch {}
    for (const l of langs()) { const c = l.slice(0, 2).toLowerCase(); if (LANGS.some(x => x.c === c)) return c; }
    return ARAB.includes(country()) ? 'ar' : 'en';
  }

  const lang = detect();
  const info = LANGS.find(x => x.c === lang);
  const el = document.documentElement;
  el.lang = lang; el.dir = info.dir;
  // ملف الترجمة يُحمَّل فقط عند الحاجة (نسخة التطبيق)؛ في الملف الواحد يكون مدمجاً أصلاً
  if (lang !== 'ar' && !DICTS[lang]() && document.readyState === 'loading') document.write(`<script src="i18n/${lang}.js"><\/script>`);

  // نصوص الهيكل الثابت في index.html (الشريط العلوي والسفلي والعنوان) قبل أول عرض
  if (lang !== 'ar') document.addEventListener('DOMContentLoaded', () => {
    const tr = s => L(s);
    document.title = tr(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = tr(desc.content);
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) if (/[؀-ۿ]/.test(n.nodeValue)) n.nodeValue = tr(n.nodeValue);
    document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el => ['aria-label', 'title', 'placeholder'].forEach(a => {
      const v = el.getAttribute(a); if (v && /[؀-ۿ]/.test(v)) el.setAttribute(a, tr(v));
    }));
  }, { once: true });

  return {
    LANGS, lang, dir: info.dir, loc: info.loc, num: info.loc + '-u-nu-latn', rtl: info.dir === 'rtl', ARAB, country,
    get dict() { return (lang !== 'ar' && DICTS[lang] && DICTS[lang]()) || null; },
    set(c) { try { localStorage.setItem(LS, c); } catch {} location.reload(); }
  };
})();

// النص مترجماً: L('نص') أو L`نص ${x}` — بدون ترجمة يرجع النص كما هو
// لكلمة لها أكثر من معنى: L('اليوم', 'today') ← مفتاحها في ملف الترجمة «اليوم|today»
function L(s, ...v) {
  const d = I18N.dict;
  if (typeof s === 'string') {
    if (!d) return s;
    const k = s.trim(), t = (typeof v[0] === 'string' && d[k + '|' + v[0]]) || d[k];
    return t == null || !k ? s : s.slice(0, s.indexOf(k)) + t + s.slice(s.indexOf(k) + k.length);
  }
  if (!d) { let r = s[0]; for (let i = 1; i < s.length; i++) r += v[i - 1] + s[i]; return r; }
  let key = s[0];
  for (let i = 1; i < s.length; i++) key += '{' + (i - 1) + '}' + s[i];
  const k = key.trim(), t = d[k];
  const lead = key.slice(0, key.indexOf(k)), trail = key.slice(key.indexOf(k) + k.length);
  return lead + (t == null ? k : t).replace(/\{(\d+)(:a)?\}/g, (_, n, a) => a ? article(v[n]) : v[n]) + trail;
}
// {0:a} في الترجمة الإنجليزية: «Lemon» ← «a lemon»، «Avocado» ← «an avocado»
const article = x => { const s = String(x ?? ''); return (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s.charAt(0).toLowerCase() + s.slice(1); };
// ترجمة نص محفوظ وقت التشغيل (مثل عرَض اختارته المستخدمة سابقاً بلغة أخرى)
L.t = s => (typeof s === 'string' && I18N.dict && I18N.dict[s.trim()]) || s;
// العكس: النص العربي الأصلي لنص مترجم، لحفظ القيم المختارة بلغة ثابتة (مثل الأعراض في اليوميات)
L.src = s => {
  const d = I18N.dict;
  if (!d || typeof s !== 'string') return s;
  if (!L._rev) { L._rev = {}; for (const k in d) if (!(d[k] in L._rev)) L._rev[d[k]] = k; }
  return L._rev[s] || s;
};
