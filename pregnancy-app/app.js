/* نبضٌ صغير — منطق التطبيق */
'use strict';

const KEY = 'rihlati_v1';
const DAY = 86400000;

const defaults = () => ({
  profile: null, // {name, babyName, method, lmp, cycle, conception, ivf, ivfDay, due, height, preWeight}
  weights: [], kicks: [], contractions: [], appts: [], journal: [],
  bag: {}, water: {}, vitamins: {}, favNames: [], done: {}, theme: 'dark',
  labs: [], checks: [], med: {}, letters: [], baby: null, feeds: [], diapers: [], sleeps: [], growth: [],
  vax: {}, miles: {}, recovery: {}, moodChecks: [], chat: [], voted: {}
});

let S = load();
let route = { view: 'home', sub: null, week: null };
let timers = [];

function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return defaults(); }
}
function save() {
  S._mt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  if (typeof Account !== 'undefined') Account.dirty();
  if (typeof Widget !== 'undefined') Widget.sync();
}

/* ---------- أدوات التاريخ ---------- */
// كل التواريخ المعروضة تتبع إعداد التقويم (ميلادي / هجري أم القرى)
const fmt = Cal.fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = Cal.fmt({ day: 'numeric', month: 'short' });

const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((a - b) / DAY);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* حساب موعد الولادة حسب الطريقة */
function calcDue(p) {
  switch (p.method) {
    case 'lmp': return addDays(parse(p.lmp), 280 + ((+p.cycle || 28) - 28));
    case 'conception': return addDays(parse(p.conception), 266);
    case 'ivf': return addDays(parse(p.ivf), 266 - (+p.ivfDay || 5));
    case 'due': return parse(p.due);
  }
  return null;
}

function status() {
  const due = calcDue(S.profile);
  const start = addDays(due, -280);
  const days = Math.max(0, diffDays(today(), start));
  const weeksDone = Math.floor(days / 7), extra = days % 7;
  const week = Math.min(40, Math.max(1, weeksDone + 1));
  const left = diffDays(due, today());
  const tri = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  const month = Math.min(9, Math.floor(days / 30.4) + 1);
  return { due, start, days, weeksDone, extra, week, left, tri, month, pct: Math.min(1, days / 280) };
}
const weekDate = (st, w) => addDays(st.start, (w - 1) * 7);

/* ---------- واجهة عامة ---------- */
const $ = s => document.querySelector(s);
const app = $('#app');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

// المظهر: السمة، حجم الخط، تقليل الحركة، ولون شريط الحالة في تطبيق الموبايل
function applyTheme() {
  const root = document.documentElement;
  if (S.font && S.font !== 'md') root.dataset.font = S.font; else delete root.dataset.font;
  if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (S.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  REDUCED = REDUCED_OS || S.motion === 'reduce';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#070a1a' : '#f6f3fa');
  Native.statusBar(dark);
}
$('#setBtn').innerHTML = icon('settings');
$('#setBtn').onclick = () => { if (route.sub !== 'settings') go(route.view, 'settings'); };

/* ---------- أدوات أندرويد (Capacitor) — كلها اختيارية وتعمل بدونها في المتصفح ---------- */
const Native = {
  p: n => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.[n],
  tap() { try { Native.p('Haptics')?.impact({ style: 'LIGHT' }); } catch {} },
  statusBar(dark) {
    const sb = Native.p('StatusBar'); if (!sb) return;
    try { sb.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); sb.setBackgroundColor?.({ color: dark ? '#070a1a' : '#f6f3fa' }).catch?.(() => {}); } catch {}
  },
  // حفظ ملف ومشاركته (Drive، واتساب، البريد…) عبر نافذة المشاركة في الجهاز
  async shareFile(name, text, title) {
    const fs = Native.p('Filesystem'), sh = Native.p('Share');
    if (!fs || !sh) return false;
    const r = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await sh.share({ title, files: [r.uri], dialogTitle: title });
    return true;
  },
  async shareText(title, text, url) {
    const sh = Native.p('Share');
    if (sh) { await sh.share({ title, text, url, dialogTitle: title }); return true; }
    if (navigator.share) { await navigator.share({ title, text, url }); return true; }
    return false;
  }
};

// الأرقام العربية الهندية (١٢٣) عند اختيارها من الإعدادات — تُطبَّق على النصوص المعروضة فقط
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function localizeDigits(root) {
  if (S.digits !== 'ar' || !I18N.rtl || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /[0-9]/.test(n.nodeValue) && !n.parentElement.closest('input,textarea,script,style,select,.err-box') ? 1 : 2 });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  list.forEach(n => { n.nodeValue = n.nodeValue.replace(/[0-9]/g, d => AR_DIGITS[d]); });
}

document.querySelectorAll('#tabbar button').forEach(b => b.onclick = () => { Native.tap(); go(b.dataset.view); });
$('#backBtn').onclick = () => history.back();
window.addEventListener('popstate', e => { route = e.state || { view: 'home' }; render(false); });

function go(view, sub = null, week = null) {
  route = { view, sub, week, slide: route.slide };
  history.pushState(route, '');
  render();
}

const TOOLS = [
  ['kicks', '👣', L('عدّاد الركلات')], ['contractions', '⏱️', L('مؤقت الطلق')], ['weight', '⚖️', L('متابعة الوزن')],
  ['appts', '📆', L('مواعيدي')], ['journal', '📝', L('يومياتي')], ['bag', '🎒', L('حقيبة الولادة')],
  ['water', '💧', L('شرب الماء')], ['food', '🥗', L('التغذية')], ['exercise', '🧘‍♀️', L('التمارين')],
  ['warnings', '🚨', L('علامات الخطر')], ['names', '👶', L('أسماء المواليد')], ['calc', '🧮', L('حاسبة الولادة')],
  ['postpartum', '🤱', L('بعد الولادة')], ['faq', '❓', L('أسئلة شائعة')], ['tests', '🔬', L('الفحوصات والتحاليل')],
  ['checkin', '🩺', L('فحص اليوم')], ['labs', '🧪', L('افهمي تحاليلك')], ['file', '📄', L('ملفي الطبي')], ['medinfo', '🩺', L('بياناتي الطبية')],
  ['partner', '💑', L('شاركي زوجك')], ['ramadan', '🌙', L('الصيام في الحمل')], ['localfood', '🍲', L('آمن أم لا؟')], ['album', '📸', L('ألبوم رحلتي')],
  ['born', '🎉', L('وُلد طفلي')], ['feeds', '🍼', L('الرضاعة')], ['diapers', '💧', L('الحفاضات')], ['sleep', '😴', L('نوم الطفل')], ['growth', '📈', L('نمو الطفل')],
  ['vaccines', '💉', L('التطعيمات')], ['miles', '⭐', L('مراحل النمو')], ['momcare', '🤱', L('صحتي بعد الولادة')], ['babywarn', '🚨', L('طوارئ الطفل')],
  ['cnew', '✍️', L('سؤال جديد')], ['cq', '👩‍👩‍👧', L('مجتمع الأمهات')], ['bguide', '📖', L('طفلي شهراً بشهر')], ['momguide', '🌷', L('صحتك بعد الولادة')],
  ['settings', '⚙️', L('الإعدادات')], ['about', 'ℹ️', L('عن التطبيق')]
];
const APP_NAME = L('نبضٌ صغير');
const APP_VERSION = '__APP_VERSION__'.startsWith('__') ? '1.3' : '__APP_VERSION__';
const STORE_URL = 'https://play.google.com/store/apps/details?id=app.nabd.pregnancy';
const EXTRA_TITLES = { profile: L('بيانات الحمل'), favs: L('المفضلة'), account: L('حسابي') };

let booted = false; // لا رسم قبل تحميل كل الملفات
function render(scroll = true) {
  if (!booted) return;
  timers.forEach(clearInterval); timers = [];
  applyTheme();
  const tab = $('#tabbar');
  if (!S.profile || S.onb) { tab.hidden = true; Onb.render(); return; }
  document.body.classList.remove('onb-mode');
  tab.hidden = false;
  tab.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === route.view));
  $('#backBtn').hidden = !route.sub;
  $('#setBtn').hidden = route.sub === 'settings' || route.sub === 'about';
  const titles = { home: fmtDayMonth.format(today()), weeks: S.baby ? L('طفلي') : route.mode === 'map' ? L('خارطة الرحلة') : L('أسبوعاً بأسبوع'), assist: route.as === 'cm' ? L('مجتمع الأمهات') : L('اسألي نبض ✨'), track: L('صحتي'), more: L('المزيد') };
  const wkBtn = tab.querySelector('[data-view=weeks] .lbl'); if (wkBtn) wkBtn.textContent = S.baby ? L('طفلي') : L('رحلتي');
  let html;
  if (route.sub) {
    const t = TOOLS.find(x => x[0] === route.sub);
    $('#title').textContent = t ? t[2] : (EXTRA_TITLES[route.sub] || APP_NAME);
    html = route.sub === 'profile' ? viewSetup(false) : (SUBVIEWS[route.sub] || (() => ''))();
  } else {
    $('#title').textContent = titles[route.view];
    html = ({ home: viewHome, weeks: S.baby ? viewBabyHub : viewWeeks, assist: viewAssist, track: viewTrack, guide: viewMore, more: viewMore }[route.view] || viewHome)();
  }
  // انتقال ناعم عند تغيير الصفحة، وتبديل هادئ لصورة الأسبوع
  const key = [route.view, route.sub, route.mode || 'week', route.as || 'ai', route.qid].join('|');
  const pageChanged = lastKey && key !== lastKey, weekChanged = !pageChanged && !!lastKey && route.week !== lastWeek;
  const inner = [route.sec, route.tab, route.ft, route.labels].join('|'), innerChanged = !pageChanged && !weekChanged && lastInner !== undefined && inner !== lastInner;
  // اتجاه الحركة: للأمام عند الدخول لصفحة فرعية أو تبويب تالٍ، وللخلف عند الرجوع
  if (pageChanged) {
    const order = ['home', 'weeks', 'assist', 'track', 'more'], depth = (route.sub ? 1 : 0) + (route.qid ? 1 : 0);
    const dir = depth !== lastDepth ? (depth > lastDepth ? 'fwd' : 'back') : order.indexOf(route.view) >= order.indexOf(lastView) ? 'fwd' : 'back';
    document.documentElement.dataset.nav = dir;
    lastDepth = depth; lastView = route.view;
  }
  const prevStrip = $('#strip') ? $('#strip').scrollLeft : null, prevY = window.scrollY;
  // رسم أحدث يلغي أي انتقال متأخر يحمل محتوى قديماً
  const seq = ++renderSeq;
  const swap = () => {
    if (seq !== renderSeq) return;
    app.innerHTML = html; bind(); localizeDigits(app); localizeDigits($('#title'));
    if (weekChanged && !REDUCED) {
      app.querySelector('.hero-stage')?.classList.add('swap');
      const strip = $('#strip'), s = strip && strip.querySelector('.sel');
      if (s && prevStrip !== null) { strip.scrollLeft = prevStrip; requestAnimationFrame(() => s.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })); }
      // تبقى القارئة في مكانها وتتغير المعلومات بهدوء
      window.scrollTo({ top: prevY, behavior: 'instant' });
      app.querySelectorAll('.week-meta, #secTabs + .card, .baby-card').forEach(c => c.classList.add('soft'));
    } else if (innerChanged && !REDUCED) {
      const c = app.querySelector('#secTabs + .card') || app; c.classList.remove('soft'); void c.offsetWidth; c.classList.add('soft');
    } else if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (pageChanged && !REDUCED && document.startViewTransition) document.startViewTransition(swap);
  else {
    swap();
    if (pageChanged && !REDUCED) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); }
  }
  lastKey = key; lastWeek = route.week; lastInner = inner;
}
let lastKey = '', lastWeek, lastInner, lastDepth = 0, lastView = 'home', renderSeq = 0;
const REDUCED_OS = matchMedia('(prefers-reduced-motion: reduce)').matches;
let REDUCED = REDUCED_OS;

/* ---------- الإعداد ---------- */
// تخمين البلد من المنطقة الزمنية للجهاز ثم لغته (بدون صلاحية موقع)
function guessCountry() {
  return I18N.country(c => COUNTRIES.some(x => x.c === c)) || (I18N.lang === 'ar' ? 'SA' : 'XX');
}
function viewSetup(first) {
  const p = S.profile || { method: 'lmp', cycle: 28, ivfDay: 5 };
  const m = p.method;
  return `
  ${first ? `<div class="welcome">${Photos.figure(24, { cls: 'round' })}
    <img class="app-logo" src="icons/icon.svg" alt="${APP_NAME}">
    <h2>${L`أهلاً بكِ في ${APP_NAME} 💗`}</h2>
    <p class="muted">${L`خارطة طريقك من بداية الحمل حتى لحظة الولادة — أسبوعاً بأسبوع.`}</p></div>` : ''}
  <div class="card">
    <h2>${L`احسبي موعد ولادتك`}</h2>
    <label class="f">${L`اسمك (اختياري)`}<input id="s_name" value="${esc(p.name)}" placeholder="${L`مثال: سارة`}"></label>
    <label class="f">${L`بلدك`}<select id="s_country">${COUNTRIES.map(c => `<option value="${c.c}" ${(S.country || guessCountry()) === c.c ? 'selected' : ''}>${c.f} ${c.n}</option>`).join('')}</select></label>
    <label class="f">${L`اسم الجنين أو لقبه (اختياري)`}<input id="s_baby" value="${esc(p.babyName)}" placeholder="${L`مثال: نونو`}"></label>
    <div class="muted">${L`طريقة الحساب`}</div>
    <div class="seg" id="s_method">
      ${[['lmp', L('آخر دورة')], ['conception', L('تاريخ الإخصاب')], ['ivf', L('أطفال الأنابيب')], ['due', L('أعرف موعد الولادة')]]
        .map(([k, v]) => `<button data-m="${k}" class="${m === k ? 'on' : ''}">${v}</button>`).join('')}
    </div>
    <div id="s_fields">${setupFields(p)}</div>
    <div class="grid2">
      <label class="f">${L`الطول (سم)`}<input id="s_height" type="number" inputmode="decimal" value="${esc(p.height)}" placeholder="160"></label>
      <label class="f">${L`الوزن قبل الحمل (كغ)`}<input id="s_pre" type="number" inputmode="decimal" value="${esc(p.preWeight)}" placeholder="60"></label>
    </div>
    <div id="s_preview" class="card hero" style="display:none"></div>
    <button class="btn block" id="s_save">${first ? L('ابدئي الرحلة 🚀') : L('حفظ')}</button>
  </div>
  <p class="disclaimer">${L`المعلومات للتثقيف فقط ولا تغني عن استشارة الطبيب.`}</p>`;
}
// حدود التواريخ المنطقية لكل طريقة حساب
const dateBounds = method => method === 'due' ? [iso(addDays(today(), -21)), iso(addDays(today(), 300))] : [iso(addDays(today(), -300)), iso(today())];
// حقل تاريخ: عجلة هجرية عند اختيار التقويم الهجري، وإلا حقل التاريخ المعتاد
function dateField(id, label, value, method) {
  const [min, max] = dateBounds(method);
  if (Cal.mode() !== 'hijri') return `<label class="f">${label}<input id="${id}" type="date" min="${min}" max="${max}" value="${esc(value)}"></label>`;
  const v = value || (method === 'due' ? iso(addDays(today(), 200)) : iso(addDays(today(), -60)));
  return `<div class="f">${label}<div class="wheel" data-wheel="${id}" data-min="${min}" data-max="${max}"></div><input type="hidden" id="${id}" value="${esc(v)}"></div>`;
}
function setupFields(p) {
  switch (p.method) {
    case 'lmp': return `${dateField('s_lmp', L('أول يوم في آخر دورة شهرية'), p.lmp, 'lmp')}
      <label class="f">${L`متوسط طول الدورة (أيام)`}<input id="s_cycle" type="number" min="20" max="45" value="${esc(p.cycle || 28)}"></label>`;
    case 'conception': return dateField('s_conc', L('تاريخ الإخصاب / الإباضة'), p.conception, 'conception');
    case 'ivf': return `${dateField('s_ivf', L('تاريخ إرجاع الأجنة'), p.ivf, 'ivf')}
      <label class="f">${L`عمر الجنين عند الإرجاع`}<select id="s_ivfday">${[3, 5, 6].map(d => `<option value="${d}" ${+p.ivfDay === d ? 'selected' : ''}>${L`اليوم ${d}`}</option>`).join('')}</select></label>`;
    case 'due': return dateField('s_due', L('موعد الولادة المتوقع'), p.due, 'due');
  }
}
function mountWheels(root, onChange) {
  root.querySelectorAll('[data-wheel]').forEach(el => {
    const inp = document.getElementById(el.dataset.wheel);
    datePicker(el, { cal: 'hijri', value: inp.value, min: el.dataset.min, max: el.dataset.max, onChange: v => { inp.value = v; onChange(); } });
  });
}
function readSetup() {
  const p = { ...(S.profile || {}) };
  p.method = document.querySelector('#s_method .on').dataset.m;
  p.name = $('#s_name').value.trim(); p.babyName = $('#s_baby').value.trim();
  S.country = $('#s_country').value;
  p.height = $('#s_height').value; p.preWeight = $('#s_pre').value;
  const v = id => $(id) && $(id).value;
  if (p.method === 'lmp') { p.lmp = v('#s_lmp'); p.cycle = v('#s_cycle') || 28; }
  if (p.method === 'conception') p.conception = v('#s_conc');
  if (p.method === 'ivf') { p.ivf = v('#s_ivf'); p.ivfDay = v('#s_ivfday'); }
  if (p.method === 'due') p.due = v('#s_due');
  const need = { lmp: 'lmp', conception: 'conception', ivf: 'ivf', due: 'due' }[p.method];
  return p[need] ? p : null;
}
function bindSetup() {
  const preview = () => {
    const p = readSetup(), box = $('#s_preview');
    if (!p) { box.style.display = 'none'; return; }
    const old = S.profile; S.profile = p; const st = status(); S.profile = old;
    const bad = st.left < -21 || st.left > 300;
    box.style.display = 'block';
    box.innerHTML = bad ? `<b style="color:var(--warn)">${L`⚠️ التاريخ غير منطقي، تأكدي منه.`}</b>` :
      `<div class="muted">${L`موعد الولادة المتوقع`}</div><h3 style="margin:4px 0">${Cal.both(st.due)}</h3>
       <div class="badge" style="margin-top:6px">${L`أنتِ في الأسبوع ${st.week}`}</div>`;
  };
  document.querySelectorAll('#s_method button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#s_method button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#s_fields').innerHTML = setupFields({ ...(S.profile || {}), method: b.dataset.m });
    $('#s_fields').querySelectorAll('input,select').forEach(i => i.oninput = preview);
    mountWheels($('#s_fields'), preview);
    preview();
  });
  app.querySelectorAll('input,select').forEach(i => i.oninput = preview);
  mountWheels(app, preview);
  preview();
  $('#s_save').onclick = () => {
    const p = readSetup();
    if (!p) return toast(L('أدخلي التاريخ أولاً'));
    const old = S.profile; S.profile = p; const st = status();
    if (st.left < -21 || st.left > 300) { S.profile = old; return toast(L('التاريخ غير صحيح')); }
    save(); toast(L('تم الحفظ ✅')); Notify.sync(false);
    if (!old) { route = { view: 'home' }; history.replaceState(route, ''); render(); } else history.back();
  };
}

/* ---------- الرئيسية ---------- */
const ICON = {
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 10a5 5 0 0 1 8 0M12 10l2-2"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m3 16 13-13 5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2"/></svg>',
  seed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6M10 9.5a2 2 0 0 1 2-2"/></svg>',
  baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 11h.01M15 11h.01M9.5 15a3.5 3.5 0 0 0 5 0M12 3c-1.2 1.8-.4 3.2 1.4 3.2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
};
// الترتيب بالكلمات في العربية («اليوم الثالث»)، وبالأرقام في باقي اللغات («Day 3»)
const ordinals = n => I18N.lang === 'ar' ? ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'].slice(0, n) : Array.from({ length: n }, (_, i) => String(i + 1));
const ORD = ordinals(7);
const fmtDayMonth = Cal.fmt({ day: 'numeric', month: 'long' });
const fmtDate = Cal.fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const wd = (n) => L`${Math.floor(n / 7)} أسبوعاً و ${n % 7} ${n % 7 === 1 ? L('يوم') : L('أيام')}`;
const MONTHS_ORD = ordinals(9);
// العدد مع المعدود بعربية صحيحة: 1 أسبوع، أسبوعان، 3 أسابيع، 11 أسبوعاً
const arCount = (n, one, two, few, many) => n <= 0 ? '' : n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
const arWeeks = n => arCount(n, L('أسبوع واحد'), L('أسبوعان'), L('أسابيع'), L('أسبوعاً'));
const arDays = n => arCount(n, L('يوم واحد'), L('يومان'), L('أيام'), L('يوماً'));
// مدة بالأسابيع والأيام: «32 أسبوعاً و3 أيام»
const weeksDays = n => { const w = Math.floor(n / 7), d = n % 7; return w && d ? L`${arWeeks(w)} و${arDays(d)}` : w ? arWeeks(w) : d ? arDays(d) : L('اليوم', 'today'); };
// الوزن بالغرام حتى 999 غ ثم بالكيلو بمنزلة عشرية واحدة
const wtLabel = t => { const m = /^([\d.]+)\s*(كغ|غ|kg|g)$/.exec(t || ''); if (!m) return t; const g = m[2] === 'كغ' || m[2] === 'kg' ? +m[1] * 1000 : +m[1]; return g < 1000 ? L`${Math.round(g)} غ` : L`${(Math.round(g / 100) / 10).toFixed(1)} كغ`; };

function hero(sel) {
  const w = WEEKS[sel - 1];
  const chips = w.wt === '—'
    ? `<div class="float-chip chip-bl"><span class="ic pink">${ICON.seed}</span><div><small>${L`المرحلة`}</small><b>${w.size}</b></div></div>`
    : `<div class="float-chip chip-tr"><span class="ic">${ICON.scale}</span><div><small>${L`الوزن`}</small><b>${wtLabel(w.wt)}</b></div></div>
       <div class="float-chip chip-bl"><span class="ic pink">${ICON.ruler}</span><div><small>${L`الطول`}</small><b>${w.len}</b></div></div>`;
  // الشريحة الثالثة: داخل الرحم (تظهر فقط عند توفر صورة القطاع لهذا الأسبوع)
  const womb = Photos.womb(sel), n = womb ? 3 : 2, cur = Math.min(route.slide || 0, n - 1);
  return `<div class="hero-stage">
    <div class="carousel" id="car">
      <div class="slide"><div class="halo">${ORBIT}${Photos.figure(sel, { cls: 'round' })}</div>${chips}<span class="size-tag">${L`${w.emoji} بحجم ${w.size}`}</span></div>
      <div class="slide">${Photos.figure(sel, { labels: true, cls: 'square' })}<span class="slide-cap">${L`الأسبوع ${sel} · أسماء الأجزاء`}</span></div>
      ${womb ? `<div class="slide">${womb}<span class="slide-cap">${L`داخل الرحم · الأسبوع ${sel}`}</span></div>` : ''}
    </div>
    <button class="share-btn" data-share="${sel}" aria-label="${L`شاركي الأسبوع ${sel}`}">${ICON.share}<span>${L`شاركي`}</span></button>
    <div class="dots" id="dots">${Array.from({ length: n }, (_, i) => `<i class="${i === cur ? 'on' : ''}"></i>`).join('')}</div>
  </div>`;
}
// مداران رفيعان يدوران ببطء حول صورة الجنين، مع نقطتين مضيئتين
const ORBIT = `<svg class="orbit" viewBox="0 0 100 100" aria-hidden="true">
  <g class="o1"><circle cx="50" cy="50" r="48.5" fill="none" stroke="var(--primary)" stroke-opacity=".35" stroke-width=".35" stroke-dasharray="1 2.2"/><circle cx="50" cy="1.5" r="1.1" fill="var(--primary)"/></g>
  <g class="o2"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--cyan)" stroke-opacity=".25" stroke-width=".3" stroke-dasharray="14 6 2 6"/><circle cx="96" cy="50" r=".9" fill="var(--cyan)"/></g></svg>`;
// بطاقات الأسابيع: رقم الأسبوع ورمز حجم الجنين
function tiles(items, sel, cur, attr, unit, icon) {
  return `<div class="week-strip tiles" id="strip">${items.map(n => `<button ${attr}="${n}" class="${n === sel ? 'sel' : ''} ${n === cur ? 'cur' : ''}" aria-label="${unit} ${n}">
    <span class="em">${icon(n)}</span><b>${n}</b><small>${n === cur ? L('الآن') : unit}</small></button>`).join('')}</div>`;
}
function weekStrip(sel, st) {
  return `${tiles(WEEKS.map(x => x.w), sel, st.week, 'data-wk', L('أسبوع'), n => WEEKS[n - 1].emoji)}
  ${sel !== st.week ? `<button class="back-now" data-wk="${st.week}">${L`↩ العودة لأسبوعي الحالي (${st.week})`}</button>` : ''}`;
}
// قمر بنسبة إضاءة f (يمتلئ من اليمين)
function moon(f, label, now) {
  const c = 18, r = 14, rx = (r * Math.abs(1 - 2 * f)).toFixed(2);
  const lit = f <= 0 ? '' : f >= 1 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="var(--gold)"/>`
    : `<path d="M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${rx} ${r} 0 0 ${f < .5 ? 0 : 1} ${c} ${c - r}Z" fill="var(--gold)"/>`;
  return `<div class="moon ${now ? 'now' : ''}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="var(--moon-dark)"/>${lit}<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--gold)" stroke-opacity=".5"/></svg><span>${label}</span></div>`;
}
// حلقة اللقاء: تمتلئ مع تقدم الحمل، وفي وسطها الأيام الباقية
function progressCard(st) {
  const r = 52, C = 2 * Math.PI * r, off = C * (1 - Math.min(1, st.pct));
  const months = MONTHS_ORD;
  return `<div class="card meet-card">
    <svg class="meet-ring" viewBox="0 0 128 128" role="img" aria-label="${L`أتممتِ ${Math.round(st.pct * 100)}% من الحمل`}">
      <defs><linearGradient id="mr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2d8d"/><stop offset=".6" stop-color="#c45cff"/><stop offset="1" stop-color="#4fd8f0"/></linearGradient></defs>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="url(#mr)" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 64 64)" style="--c:${C.toFixed(1)}" class="meet-arc"/>
      <text x="64" y="62" text-anchor="middle" class="meet-num">${Math.max(0, st.left)}</text>
      <text x="64" y="82" text-anchor="middle" class="meet-sub">${L`يوماً على اللقاء`}</text>
    </svg>
    <div class="meet-info">
      <span class="kicker">${L`الأسبوع ${st.week} · اليوم ${ORD[st.extra]}`}</span>
      <b class="meet-big">${TRIMESTERS[st.tri - 1].name}</b>
      <span class="meet-month">${L`الشهر ${MONTHS_ORD[st.month - 1]}`}</span>
      <span class="muted">${L`اللقاء ${fmtShort.format(st.due)}`}</span>
    </div>
  </div>
  <div class="grid2 span-cards">
    <div class="card mini"><small>${L`مضى من الحمل`}</small><b>${weeksDays(Math.min(st.days, 280))}</b></div>
    <div class="card mini"><small>${st.left >= 0 ? L('تبقّى للولادة') : L('تجاوزتِ الموعد بـ')}</small><b>${weeksDays(Math.abs(st.left))}</b></div>
  </div>
  <div class="card journey">
    <div class="progress"><i style="width:${(st.pct * 100).toFixed(1)}%"></i></div>
    <div class="journey-ends"><span><small>${L`بداية الحمل`}</small><b>${fmtShort.format(st.start)}</b></span><span><small>${L`الولادة`}</small><b>${fmtShort.format(st.due)}</b></span></div>
  </div>
  ${st.left >= 0 && st.left <= 28 ? `<div class="card countdown" id="countdown" data-due="${st.due.getTime()}"><small>${L`العدّ التنازلي للقاء 💗`}</small>
    <div class="cd-row">${[['d', L('يوم')], ['h', L('ساعة')], ['m', L('دقيقة')], ['s', L('ثانية')]].map(([k, l]) => `<div><b data-cd="${k}">--</b><small>${l}</small></div>`).join('')}</div></div>` : ''}`;
}

function viewHome() {
  if (S.baby) return viewBabyHome();
  const st = status(), p = S.profile;
  const sel = route.week || st.week, w = WEEKS[sel - 1];
  const tKey = iso(today());
  const water = S.water[tKey] || 0, vit = !!S.vitamins[tKey];
  const c = S.checks.find(x => x.date === tKey), tr = c && triage(c, st.week);
  const badLabs = Object.values(latestLabs()).filter(l => labEval(l, st.tri).s !== 'ok').length;
  const nextAppt = S.appts.filter(a => a.date >= tKey && !a.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const nextTest = APPOINTMENTS.find(a => a.to >= st.week);
  const next = nextAppt ? { ic: '🩺', t: nextAppt.title, d: fmtShort.format(parse(nextAppt.date)), sub: 'appts' }
    : nextTest ? { ic: '🔬', t: nextTest.title, d: L`الأسبوع ${nextTest.from}${nextTest.to !== nextTest.from ? '–' + nextTest.to : ''}`, sub: 'tests' } : null;
  return `
  ${S.news12 ? '' : `<div class="card news-card"><span class="big-ic">✨</span><div class="grow"><b>${L`جديد في نبض`}</b><div class="muted">${L`التقويم الهجري، وحفظ بياناتك على السحابة، والمفضلة 💗`}</div>
    <button class="btn sm" id="newsGo" style="margin-top:8px">${L`اكتشفي`}</button></div><button class="icon-btn sm" id="newsX" aria-label="${L`إغلاق`}">✕</button></div>`}
  ${hero(sel)}
  ${weekStrip(sel, st)}
  ${progressCard(st)}
  <div class="card nav-row" data-week="${sel}"><span class="ic">${w.emoji}</span><div class="grow"><b>${L`${p.babyName ? esc(p.babyName) : L('طفلك')} هذا الأسبوع`}</b><div class="muted">${w.baby[0]}</div></div><span class="chev">‹</span></div>
  ${badLabs || (tr && tr.lvl >= 2) ? `<button class="alert-line" data-sub="${badLabs ? 'labs' : 'checkin'}">${badLabs ? L`🧪 ${badLabs} تحليل يحتاج انتباهك` : `${tr.ic} ${tr.title}`} ‹</button>` : ''}
  ${st.week >= 28 ? (() => { const all = Object.values(HOSPITAL_BAG).flat(), n = all.filter(i => S.bag[L.src(i)]).length; return `<div class="grid2 home-tools">
    <div class="card mini tap" data-sub="kicks" role="button" tabindex="0"><span class="big-ic">👣</span><b>${L`عدّ الركلات`}</b><small>${S._kick ? L`جلسة جارية · ${arKicks(S._kick.count)}` : L('هدف 10 خلال ساعتين')}</small></div>
    ${st.week >= 32 ? `<div class="card mini tap" data-sub="bag" role="button" tabindex="0"><span class="big-ic">🎒</span><b>${L`شنطة المستشفى`}</b><small>${L`${n} من ${all.length} جاهزة`}</small></div>`
      : `<div class="card mini tap" data-sub="contractions" role="button" tabindex="0"><span class="big-ic">⏱️</span><b>${L`مؤقّت الطلق`}</b><small>${L`قاعدة 5-1-1`}</small></div>`}</div>`; })() : ''}
  ${st.week >= 36 ? `<button class="link" data-sub="born" style="display:block;margin:6px auto;color:var(--ink-2)">${L`🎉 وُلد طفلي؟`}</button>` : ''}
  <p class="disclaimer">${L`المعلومات للتثقيف فقط ولا تغني عن استشارة الطبيب.`}</p>`;
}
const toolBtn = ([k, ic, name]) => `<div class="tool" data-sub="${k}"><span>${ic}</span>${name}</div>`;

/* ---------- الأسابيع ---------- */
const SECS = [['baby', '👶', L('الجنين')], ['mom', '🤰', L('الأم')], ['symptoms', '🌡️', L('الأعراض')], ['tips', '💡', L('نصائح')], ['todo', '📋', L('مهام')]];

function viewWeeks() {
  const st = status();
  const modeSeg = `<div class="seg big" id="modeSeg">
    <button data-mode="week" class="${route.mode !== 'map' ? 'on' : ''}">${L`📅 تفاصيل الأسبوع`}</button>
    <button data-mode="map" class="${route.mode === 'map' ? 'on' : ''}">${L`🗺️ خارطة الرحلة`}</button></div>`;
  if (route.mode === 'map') return modeSeg + viewRoadmap();

  const sel = route.week || st.week;
  const w = WEEKS[sel - 1];
  const tri = TRIMESTERS[sel <= 13 ? 0 : sel <= 27 ? 1 : 2];
  const date = weekDate(st, sel);
  const labels = true;
  const sec = SECS.some(x => x[0] === route.sec) ? route.sec : 'baby';
  const items = sec === 'todo' ? w.todo : w[sec].filter(x => x !== '—');
  const away = sel !== st.week;
  return `${modeSeg}
  ${hero(sel)}
  ${weekStrip(sel, st)}
  <div class="week-meta"><span class="badge">${L`الأسبوع ${sel}`}</span><span class="badge alt">${tri.name}</span><span class="muted">${L`يبدأ ${fmtShort.format(date)}${!away ? L(' · أنتِ هنا 📍') : ''}`}</span></div>
  <div class="sec-tabs" id="secTabs">
    ${SECS.map(([k, ic, name]) => `<button data-sec="${k}" class="${sec === k ? 'on' : ''}"><span>${ic}</span>${name}${k === 'todo' && w.todo.length ? `<i>${w.todo.length}</i>` : ''}</button>`).join('')}
  </div>
  <div class="card">
    ${!items.length ? `<p class="muted">${L`لا توجد مهام خاصة لهذا الأسبوع.`}</p>` : sec === 'todo'
      ? items.map((t, i) => { const k = `w${sel}_${i}`; return `<label class="check ${S.done[k] ? 'done' : ''}"><input type="checkbox" data-done="${k}" ${S.done[k] ? 'checked' : ''}><span>${t}</span></label>`; }).join('')
      : `<ul class="list fav-list">${items.map((i, k) => `<li><span>${i}</span>${favBtn({ id: `w${sel}.${sec}.${k}`, type: sec === 'tips' ? 'tip' : 'week', text: i, week: sel, sec })}</li>`).join('')}</ul>`}
  </div>
  <div class="row">
    <button class="btn ghost grow" data-wk="${Math.max(1, sel - 1)}" ${sel === 1 ? 'disabled' : ''}>${L`→ الأسبوع ${Math.max(1, sel - 1)}`}</button>
    <button class="btn grow" data-wk="${Math.min(40, sel + 1)}" ${sel === 40 ? 'disabled' : ''}>${L`الأسبوع ${Math.min(40, sel + 1)} ←`}</button>
  </div>
`;
}

/* ---------- خارطة الطريق ---------- */
function viewRoadmap() {
  const st = status();
  const fillPct = Math.min(100, (st.week - 1) / 41 * 100);
  let html = `<div class="card hero"><h2 style="margin:0">${L`رحلتك في 40 أسبوعاً 🗺️`}</h2>
    <p class="muted" style="margin:4px 0">${L`من ${fmtShort.format(st.start)} حتى ${fmtShort.format(st.due)}`}</p>
    <div class="progress"><i style="width:${st.pct * 100}%"></i></div>
    <div class="row" style="justify-content:space-between;margin-top:6px"><small>${L`🌱 البداية`}</small><small>${L`📍 الأسبوع ${st.week}`}</small><small>${L`👶 الولادة`}</small></div></div>
    <div class="timeline"><div class="fill" style="height:${fillPct}%"></div>`;
  TRIMESTERS.forEach(t => {
    html += `<div class="tl-tri" style="background:${t.color}"><h3>${t.name} · ${t.range}</h3>
      <div style="font-size:.9rem;opacity:.95">${t.summary}</div>
      <div class="chips" style="margin-top:8px">${t.focus.map(f => `<span class="chip" style="background:rgba(255,255,255,.25);border:0;color:#fff">${f}</span>`).join('')}</div></div>`;
    const range = t.n === 1 ? [1, 13] : t.n === 2 ? [14, 27] : [28, 40];
    for (let i = range[0]; i <= range[1]; i++) {
      const w = WEEKS[i - 1];
      const ap = APPOINTMENTS.filter(a => a.from === i);
      const cls = i < st.week ? 'done' : i === st.week ? 'now' : '';
      html += `<div class="tl-item ${cls}"><span class="dot"></span>
        <div class="card" data-week="${i}"><div class="row">
          <img class="tl-thumb" src="${Photos.src(i)}" alt="" loading="lazy">
          <div class="grow"><b>${L`الأسبوع ${i}`}</b> ${i === st.week ? `<span class="badge soft">${L`أنتِ هنا`}</span>` : ''}
            <div class="muted">${fmtShort.format(weekDate(st, i))} · ${w.size}</div></div>
        </div>
        <div style="font-size:.9rem;margin-top:4px">${w.baby[0]}</div>
        ${ap.map(a => `<div style="margin-top:6px"><span class="badge alt">🔬 ${a.title}</span></div>`).join('')}
        ${i === 13 ? `<div style="margin-top:6px"><span class="badge">${L`🎉 نهاية الثلث الأول`}</span></div>` : ''}
        ${i === 20 ? `<div style="margin-top:6px"><span class="badge">${L`🎉 منتصف الرحلة`}</span></div>` : ''}
        ${i === 37 ? `<div style="margin-top:6px"><span class="badge">${L`✅ مكتمل المدة المبكر`}</span></div>` : ''}
        ${i === 40 ? `<div style="margin-top:6px"><span class="badge">${L`👶 موعد الولادة`}</span></div>` : ''}
        </div></div>`;
    }
  });
  return html + '</div>';
}

/* ---------- متابعتي ودليلي وحسابي ---------- */
// أيقونة الأداة: خطية ملوّنة إن وُجدت، وإلا الرمز التعبيري
const toolIc = (k, em) => ICONS[k] ? `<span class="ic t-${ICON_TONE[k] || 'rose'}">${icon(k)}</span>` : `<span class="ic">${em}</span>`;
const CHEV = `<span class="chev">${icon('chevron')}</span>`;
const navRow = (k, sub) => { const [, ic, name] = TOOLS.find(t => t[0] === k); return `<div class="nav-row" data-sub="${k}">${toolIc(k, ic)}<div class="grow"><b>${name}</b>${sub ? `<div class="muted">${sub}</div>` : ''}</div>${CHEV}</div>`; };
const group = (title, rows) => `<div class="card group"><h3>${title}</h3>${rows.join('')}</div>`;

function viewTrack() {
  const st = status(), t = iso(today());
  const water = S.water[t] || 0, vit = !!S.vitamins[t];
  const tc = S.checks.find(x => x.date === t), tr = tc && !S.baby ? triage(tc, st.week) : null;
  const lat = Object.values(latestLabs()), bad = lat.filter(l => labEval(l, S.baby ? 3 : st.tri).s !== 'ok').length;
  const nextA = S.appts.filter(a => a.date >= t && !a.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date)), lw = ws[ws.length - 1];
  const todayCard = S.baby ? '' : `<div class="card today">
    <div class="today-grid three">
      <button class="t-act ${tr ? 'lv-' + tr.cls : ''}" data-sub="checkin"><span>${tr ? tr.ic : '🩺'}</span><b>${L`فحص اليوم`}</b><small>${tr ? tr.title : L('دقيقة واحدة')}</small></button>
      <button class="t-act ${vit ? 'done' : ''}" id="vitToday"><span>💊</span><b>${L`الفيتامين`}</b><small>${vit ? L('تم ✓') : L('اضغطي عند أخذه')}</small></button>
      <button class="t-act" id="waterPlus"><span>💧</span><b>${L`الماء`}</b><small>${L`${water} من 10`}</small></button>
    </div></div>`;
  const main = S.baby ? [navRow('momcare', L('التعافي والمزاج والرضاعة'))] : [];
  main.push(navRow('labs', lat.length ? L`${lat.length} تحاليل${bad ? L` · ${bad} تحتاج انتباه` : L(' · كلها طبيعية')}` : L('أضيفي نتيجة واعرفي معناها')));
  main.push(navRow('appts', nextA ? L`القادم: ${esc(nextA.title)} · ${fmtShort.format(parse(nextA.date))}` : L('لا توجد مواعيد قادمة')));
  const bagAll = Object.values(HOSPITAL_BAG).flat(), bagN = bagAll.filter(i => S.bag[L.src(i)]).length;
  if (!S.baby && st.week >= 28) main.push(navRow('kicks', S._kick ? L`جلسة جارية · ${arKicks(S._kick.count)}` : L('هدف 10 حركات خلال ساعتين')), navRow('contractions', L('المدة والفاصل وقاعدة 5-1-1')));
  if (!S.baby && st.week >= 32) main.push(navRow('bag', L`${bagN} من ${bagAll.length} جاهزة`));
  const extra = ['weight', 'journal', 'file', 'medinfo', ...(S.baby ? [] : ['partner', ...(st.week < 32 ? ['bag'] : []), ...(st.week < 28 ? ['kicks', 'contractions'] : [])]), 'album', 'water']
    .map(k => navRow(k, k === 'weight' && lw ? L`آخر قياس: ${lw.kg} كغ` : ''));
  return `${todayCard}
  ${quickMood()}
  <div class="card group">${main.join('')}</div>
  <details class="card group more-tools"><summary><b>${L`أدوات أخرى`}</b><span class="muted">${extra.length}</span></summary>${extra.join('')}</details>`;
}

// شبكة أدوات بأيقونات ملوّنة
const hub = keys => `<div class="hub">${keys.map(k => { const [, ic, name] = TOOLS.find(t => t[0] === k); return `<button data-sub="${k}">${toolIc(k, ic)}<span>${name}</span></button>`; }).join('')}</div>`;

function viewMore() {
  const st = status(), p = S.profile, acc = Account.user(), nf = (S.favorites || []).length;
  const who = p.name ? L`أهلاً ${esc(p.name)}` : L('أهلاً بكِ');
  const line = S.baby ? L`${esc(S.baby.name || L('طفلك'))} · عمره ${babyAge()}` : L`الأسبوع ${st.week} · ${TRIMESTERS[st.tri - 1].name}`;
  const guide = S.baby ? ['bguide', 'vaccines', 'growth', 'miles', 'babywarn', 'momguide', 'faq', 'names', 'localfood']
    : ['warnings', 'tests', 'food', 'localfood', 'ramadan', 'exercise', 'names', 'postpartum', 'faq'];
  return `
  <div class="card me-card"><div class="me-av">${p.name ? esc(p.name.trim()[0]) : icon('heart')}</div>
    <div class="grow"><h2>${who}</h2><div class="muted">${line}</div></div>
    <button class="icon-btn" data-sub="profile" aria-label="${L`تعديل البيانات`}">${icon('cnew')}</button></div>
  <div class="set-group">
    <button class="set-row" data-sub="favs"><span class="ic t-rose">${icon('heart')}</span><span class="txt"><b>${L`المفضلة`}</b><small>${nf ? L`${nf} محفوظة` : L('احفظي المعلومات والنصائح والردود بلمسة قلب')}</small></span>${CHEV}</button>
    ${Account.available() || acc ? `<button class="set-row" data-sub="account"><span class="ic t-cyan">${icon('backup')}</span><span class="txt"><b>${L`حسابي`}</b><small>${acc ? esc(acc.email || acc.name || '') : L('اختياري: نسخة احتياطية تلقائية على السحابة')}</small></span>${CHEV}</button>` : ''}
  </div>
  <div class="sec-title">${L`الدليل`}</div>
  ${hub(guide)}
  <div class="sec-title">${L`أدوات`}</div>
  ${hub(S.baby ? ['feeds', 'sleep', 'album'] : ['calc', 'album', 'born'])}
  <div class="set-group">
    <button class="set-row" data-sub="settings"><span class="ic t-violet">${icon('settings')}</span><span class="txt"><b>${L`الإعدادات`}</b><small>${L`الإشعارات، المظهر، التقويم، الخصوصية، النسخ الاحتياطي`}</small></span>${CHEV}</button>
    <button class="set-row" data-sub="about"><span class="ic t-cyan">${icon('info')}</span><span class="txt"><b>${L`عن ${APP_NAME}`}</b><small>${L`الخصوصية، قيّمي التطبيق، شاركيه مع صديقة`}</small></span>${CHEV}</button>
  </div>
  <div class="card warn-card" style="margin-top:14px"><a class="sos" href="tel:${emergencyNo()}"><span class="ic">${icon('babywarn')}</span>
    <span class="grow"><b>${L`طوارئ؟ اتصلي بالإسعاف`}</b><div class="muted">${countryOf(S.country).n}</div></span><b class="num">${emergencyNo()}</b></a></div>
  <p class="disclaimer">${L`المعلومات للتثقيف العام ولا تغني عن استشارة طبيبك المختص.`}</p>`;
}

/* ---------- الإعدادات ---------- */
const sw = (id, on, attr = '') => `<label class="switch"><input type="checkbox" ${id ? `id="${id}"` : ''} ${attr} ${on ? 'checked' : ''}><i></i></label>`;
const setRow = (ic, tone, title, small, ctrl, extra = '') => `<div class="set-row ${extra}"><span class="ic t-${tone}">${icon(ic)}</span><span class="txt"><b>${title}</b>${small ? `<small>${small}</small>` : ''}</span>${ctrl}</div>`;
const pills = (id, opts, cur) => `<div class="pills" id="${id}">${opts.map(([k, v]) => `<button data-v="${k}" class="${cur === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
const hr12 = h => `${h % 12 || 12} ${h < 12 ? L('صباحاً') : h < 17 ? L('ظهراً') : L('مساءً')}`;

function viewSettings() {
  const st = status(), r = Notify.rem(), nOn = S.notify !== false, c = countryOf(S.country), acc = Account.user();
  const waterRows = r.water ? `
    ${setRow('contractions', 'gray', L('من'), '', `<select data-remw="waterFrom">${Array.from({ length: 12 }, (_, i) => i + 6).map(h => `<option value="${h}" ${+r.waterFrom === h ? 'selected' : ''}>${hr12(h)}</option>`).join('')}</select>`, 'sub')}
    ${setRow('contractions', 'gray', L('إلى'), '', `<select data-remw="waterTo">${Array.from({ length: 12 }, (_, i) => i + 11).map(h => `<option value="${h}" ${+r.waterTo === h ? 'selected' : ''}>${hr12(h)}</option>`).join('')}</select>`, 'sub')}
    ${setRow('contractions', 'gray', L('كل'), arCount(Notify.waterHours(r).length, L('تذكير واحد يومياً'), L('تذكيران يومياً'), L('تذكيرات يومياً'), L('تذكيراً يومياً')), `<select data-remw="waterEvery">${[1, 2, 3].map(h => `<option value="${h}" ${+r.waterEvery === h ? 'selected' : ''}>${arCount(h, L('ساعة'), L('ساعتين'), L('ساعات'), L('ساعة'))}</option>`).join('')}</select>`, 'sub')}` : '';
  return `
  <div class="sec-title">${L`الحساب`}</div>
  <div class="set-group">
    <button class="set-row" data-sub="profile"><span class="ic t-rose">${icon('profile')}</span><span class="txt"><b>${S.baby ? L('بيانات الحمل والولادة') : L('بيانات الحمل')}</b><small>${L`موعد الولادة ${Cal.both(st.due)}`}</small></span>${CHEV}</button>
    ${Account.available() || acc ? `<button class="set-row" data-sub="account"><span class="ic t-cyan">${icon('backup')}</span><span class="txt"><b>${L`حسابي والنسخ السحابي`}</b><small>${acc ? esc(acc.email || acc.name || '') : L('سجّلي الدخول بـ Google أو Facebook (اختياري)')}</small></span>${CHEV}</button>` : ''}
    ${setRow('globe', 'violet', L('اللغة'), I18N.lang === 'en' ? '' : 'Language', `<select id="setLang">${I18N.LANGS.map(l => `<option value="${l.c}" ${l.c === I18N.lang ? 'selected' : ''}>${l.n}</option>`).join('')}</select>`)}
    ${setRow('globe', 'cyan', L('البلد'), L('لرقم الإسعاف ووحدات التحاليل'), `<select id="setCountry">${COUNTRIES.map(x => `<option value="${x.c}" ${x.c === c.c ? 'selected' : ''}>${x.f} ${x.n}</option>`).join('')}</select>`)}
    ${Cal.ok ? setRow('calendar', 'amber', L('التقويم'), L('كل التواريخ تظهر بالتقويم الذي تختارينه'), pills('calSeg', [['gregorian', L('ميلادي')], ['hijri', L('هجري')]], Cal.mode())) : ''}
  </div>

  <div class="sec-title">${L`الإشعارات`}</div>
  <div class="set-group">
    ${setRow('bell', 'rose', L('إشعارات نبض'), S.baby ? L('كل شهر جديد من عمر طفلك') : L('مع بداية كل أسبوع حمل جديد'), sw('notifyOn', nOn))}
    ${nOn ? `
    ${setRow('bulb', 'amber', L('معلومة اليوم'), L('كل صباح الساعة 9'), sw('', r.tip, 'data-rem="tip"'), 'sub')}
    ${setRow('drop', 'cyan', L('تذكير شرب الماء'), '', sw('', r.water, 'data-rem="water"'), 'sub')}
    ${waterRows}
    ${setRow('pill', 'violet', L('تذكير الفيتامين أو الدواء'), L('يومياً في الموعد الذي تختارينه'), sw('', r.vit, 'data-rem="vit"'), 'sub')}
    ${r.vit ? setRow('contractions', 'gray', L('موعد التذكير'), '', `<input type="time" id="remVitTime" value="${esc(r.vitTime)}">`, 'sub') : ''}
    <details class="help-box"><summary>${L`لا تصلك الإشعارات؟`}</summary><div class="set-inline">
      <p>${L`اسمحي لـ«${APP_NAME}» بالإشعارات من إعدادات الجهاز، وأوقفي «تحسين البطارية» له حتى تصلك التذكيرات في موعدها.`}</p>
      <button class="btn ghost block" id="notifyTest">${L`أرسلي إشعاراً تجريبياً`}</button></div></details>` : ''}
  </div>

  <div class="sec-title">${L`المظهر`}</div>
  <div class="set-group">
    ${setRow('palette', 'violet', L('السمة'), '', pills('themeSeg', [['auto', icon('auto')], ['light', icon('sun')], ['dark', icon('moon')]], S.theme || 'dark'))}
    ${setRow('text', 'cyan', L('حجم الخط'), '', pills('fontSeg', [['md', L('عادي')], ['lg', L('كبير')], ['xl', L('أكبر')]], S.font || 'md'))}
    ${I18N.rtl ? setRow('hash', 'amber', L('شكل الأرقام'), '', pills('digSeg', [['en', '123'], ['ar', '١٢٣']], S.digits || 'en')) : ''}
    ${setRow('motion', 'mint', L('تقليل الحركة'), L('إيقاف المؤثرات المتحركة'), sw('motionOn', S.motion === 'reduce'))}
  </div>

  <div class="sec-title">${L`الوحدات`}</div>
  <div class="set-group">
    ${setRow('tests', 'violet', L('وحدة سكر الدم'), '', pills('gluSeg', [['mg', 'mg/dL'], ['mmol', 'mmol/L']], gluUnit()))}
  </div>

  <div class="sec-title">${L`الخصوصية والأمان`}</div>
  <div class="set-group">
    ${setRow('lock', 'rose', L('قفل التطبيق'), L('رمز من 4 أرقام عند فتح التطبيق'), sw('lockOn', !!S.lock?.h))}
    ${S.lock?.h ? `<button class="set-row indent" id="lockChange"><span class="txt"><b>${L`تغيير الرمز`}</b></span>${CHEV}</button>` : ''}
    ${Crash.available() ? setRow('shield', 'cyan', L('تقارير الأعطال'), L('تساعدنا على إصلاح المشاكل، بدون بياناتك الصحية'), sw('crashOn', S.crash !== false)) : ''}
    ${setRow('shield', 'mint', L('بياناتك على جهازك'), L('بدون إعلانات. الحساب والنسخ السحابي اختياريان.'), '')}
  </div>

  <div class="sec-title">${L`النسخ الاحتياطي`}</div>
  <div class="set-group">
    <button class="set-row" id="exportBtn"><span class="ic t-cyan">${icon('backup')}</span><span class="txt"><b>${L`حفظ نسخة احتياطية`}</b><small>${L`احفظيها في Drive أو أرسليها لنفسك${S.lastBackup ? L` · آخر نسخة ${fmtShort.format(new Date(S.lastBackup))}` : ''}`}</small></span>${CHEV}</button>
    <label class="set-row tap"><span class="ic t-violet">${icon('restore')}</span><span class="txt"><b>${L`استعادة نسخة`}</b><small>${L`من ملف نسخة احتياطية سابقة`}</small></span>${CHEV}<input type="file" id="importFile" accept=".json,application/json" hidden></label>
  </div>

  <div class="sec-title">${L`منطقة الخطر`}</div>
  <div class="set-group">
    <button class="set-row danger" id="resetBtn"><span class="ic t-red">${icon('trash')}</span><span class="txt"><b>${L`حذف جميع البيانات`}</b><small>${L`من هذا الجهاز. لا يمكن التراجع عن هذا`}</small></span></button>
  </div>
  <p class="disclaimer">${L`${APP_NAME} · الإصدار ${APP_VERSION}`}</p>`;
}

function viewAbout() {
  const cfg = window.NABD_CONFIG || {};
  return `<div class="card center hero-soft"><img class="about-logo" src="icons/icon.svg" alt="">
    <h2 style="margin:0">${APP_NAME}</h2><p class="muted" style="margin:4px 0 0">${L`رفيقتك من أول أسبوع حمل حتى عامَي طفلك الأوّلين`}</p>
    <span class="badge soft" style="margin-top:10px">${L`الإصدار ${APP_VERSION}`}</span></div>
  <div class="set-group">
    <button class="set-row" id="rateApp"><span class="ic t-amber">${icon('star')}</span><span class="txt"><b>${L`قيّمي التطبيق`}</b><small>${L`رأيك يساعدنا ويساعد أمهات أخريات`}</small></span>${CHEV}</button>
    <button class="set-row" id="shareApp"><span class="ic t-rose">${icon('share')}</span><span class="txt"><b>${L`شاركي التطبيق مع صديقة`}</b></span>${CHEV}</button>
    ${cfg.supportEmail ? `<a class="set-row" href="mailto:${esc(cfg.supportEmail)}" style="text-decoration:none"><span class="ic t-cyan">${icon('mail')}</span><span class="txt"><b>${L`تواصلي معنا`}</b></span>${CHEV}</a>` : ''}
  </div>
  <div class="sec-title">${L`الخصوصية`}</div>
  <div class="card"><ul class="list">
    <li>${L`بياناتك (الحمل، التحاليل، الصور، اليوميات) محفوظة على جهازك.`}</li>
    <li>${L`تسجيل الدخول اختياري، ويُستخدم فقط لحفظ نسخة من بياناتك على السحابة.`}</li>
    <li>${L`لا إعلانات ولا تتبّع إعلاني.`}</li>
    <li>${L`عند سؤال «نبض» يُرسل سؤالك مع ملخص حملك (الأسبوع والتحاليل) بدون اسمك، لتكون الإجابة مناسبة لكِ.`}</li>
    <li>${L`في مجتمع الأمهات يُنشر ما تكتبينه باللقب الذي تختارينه، أو بدون اسم.`}</li></ul>
    ${cfg.privacyUrl ? `<a class="btn ghost block center" target="_blank" rel="noopener" href="${esc(cfg.privacyUrl)}" style="margin-top:10px">${L`سياسة الخصوصية كاملة`}</a>` : ''}</div>
  <div class="card"><h3>${L`تنبيه طبي`}</h3><p class="muted" style="margin:0">${L`المعلومات في ${APP_NAME} للتثقيف العام ومراجَعة من مصادر طبية موثوقة، لكنها لا تغني عن طبيبك. في الطوارئ اتصلي بالإسعاف (${emergencyNo()}).`}</p></div>
  <p class="disclaimer">${L`صُنع بحب للأمهات العربيات 💗`}</p>`;
}

/* ---------- الشاشات الفرعية ---------- */
const SUBVIEWS = {
  settings: () => viewSettings(),
  about: () => viewAbout(),
  // kicks / contractions: tools.js

  weight() {
    const p = S.profile, h = +p.height / 100, pre = +p.preWeight;
    const bmi = h && pre ? pre / (h * h) : null;
    const rng = !bmi ? [11.5, 16] : bmi < 18.5 ? [12.5, 18] : bmi < 25 ? [11.5, 16] : bmi < 30 ? [7, 11.5] : [5, 9];
    const cat = !bmi ? '' : bmi < 18.5 ? L('نحافة') : bmi < 25 ? L('طبيعي') : bmi < 30 ? L('زيادة وزن') : L('سمنة');
    const st = status();
    const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
    const last = ws[ws.length - 1];
    const gain = last && pre ? (last.kg - pre) : null;
    // النطاق المتوقع للزيادة في هذا الأسبوع (IOM 2009): 0.5–2 كغ حتى الأسبوع 13 ثم زيادة أسبوعية ثابتة
    const exp = w => [0, 1].map(g => { const t13 = g ? 2 : 0.5, tot = rng[g]; return w <= 13 ? (w / 13) * t13 : t13 + (Math.min(40, w) - 13) / 27 * (tot - t13); });
    const [eLo, eHi] = exp(st.week).map(x => Math.round(x * 10) / 10);
    const lastWk = last ? Math.floor(diffDays(parse(last.date), st.start) / 7) + 1 : 0;
    const where = gain == null || !pre ? '' : (() => { const [lo, hi] = exp(lastWk); return gain < lo - 0.3 ? [L('أقل من النطاق'), 'var(--warn)'] : gain > hi + 0.3 ? [L('أعلى من النطاق'), 'var(--warn)'] : [L('ضمن النطاق ✓'), 'var(--ok)']; })();
    return `<div class="card">
      ${bmi ? `<div class="grid3"><div class="stat"><b>${bmi.toFixed(1)}</b><small>${L`BMI قبل الحمل`}</small></div>
        <div class="stat"><b style="font-size:1rem">${cat}</b><small>${L`التصنيف`}</small></div>
        <div class="stat"><b style="font-size:1rem">${rng[0]}–${rng[1]}</b><small>${L`الزيادة الموصى بها (كغ)`}</small></div></div>`
        : `<p class="muted">${L`أضيفي طولك ووزنك قبل الحمل من`} <a href="#" data-sub="profile">${L`بيانات الحمل`}</a> ${L`لحساب الزيادة الموصى بها.`}</p>`}
      ${bmi ? `<p class="center" style="margin:12px 0 0">${L`المتوقع حتى الأسبوع ${st.week}: زيادة`} <b>${L`${eLo}–${eHi} كغ`}</b></p>` : ''}
      ${gain != null ? `<p class="center" style="margin:6px 0 0">${L`زيادتك حتى الآن:`} <b>${L`${gain.toFixed(1)} كغ`}</b>${where ? ` <span class="st-chip" style="--c:${where[1]}">${where[0]}</span>` : ''}</p>` : ''}
      ${last && lastWk >= st.week ? '' : `<p class="muted center" style="margin:8px 0 0">${L`⚖️ سجّلي وزن هذا الأسبوع (مرة أسبوعياً، نفس اليوم والوقت).`}</p>`}
      <p class="muted center" style="margin:6px 0 0;font-size:.8rem">${L`حسب توصيات IOM للحمل بجنين واحد. طبيبك قد يحدد نطاقاً مختلفاً لكِ.`}</p>
    </div>
    <div class="card"><h3>${L`إضافة قياس`}</h3><div class="row">
      <input class="input grow" type="date" id="wDate" value="${iso(today())}" style="margin:0">
      <input class="input" type="number" step="0.1" inputmode="decimal" id="wKg" placeholder="${L`كغ`}" style="width:90px;margin:0">
      <button class="btn" id="wAdd">${L`إضافة`}</button></div></div>
    ${ws.length ? `<div class="card"><h3>${L`المنحنى`}</h3>${weightChart(ws, pre, rng, st)}
      <table class="t">${ws.slice().reverse().map(x => `<tr><td>${fmtShort.format(parse(x.date))}</td><td>${L`الأسبوع ${Math.floor(diffDays(parse(x.date), st.start) / 7) + 1}`}</td><td><b>${x.kg}</b> ${L`كغ`}</td><td><button class="btn sm ghost" data-delw="${x.date}">✕</button></td></tr>`).join('')}</table></div>` : ''}`;
  },

  appts() {
    const list = [...S.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const t = iso(today());
    return `<div class="card"><h3>${L`موعد جديد`}</h3>
      <label class="f">${L`العنوان`}<input id="aTitle" placeholder="${L`مثال: متابعة د. منى / سونار`}"></label>
      <div class="grid2"><label class="f">${L`التاريخ`}<input type="date" id="aDate" value="${t}"></label><label class="f">${L`الوقت`}<input type="time" id="aTime"></label></div>
      <label class="f">${L`ملاحظات / أسئلة للطبيب`}<textarea id="aNotes" rows="2"></textarea></label>
      <button class="btn block" id="aAdd">${L`إضافة الموعد`}</button></div>
    <div class="card"><h3>${L`مواعيدي`}</h3>${list.length ? list.map(a => `<div class="item-row">
      <input type="checkbox" data-apdone="${a.id}" ${a.done ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
      <div class="grow" style="${a.done ? 'opacity:.55;text-decoration:line-through' : ''}"><b>${esc(a.title)}</b>
        <div class="muted">${fmt.format(parse(a.date))} ${esc(a.time || '')} ${a.date < t && !a.done ? `· <span style="color:var(--warn)">${L`فات`}</span>` : ''}</div>
        ${a.notes ? `<div style="font-size:.9rem">${esc(a.notes)}</div>` : ''}</div>
      <button class="btn sm ghost" data-apdel="${a.id}">✕</button></div>`).join('') : `<p class="muted">${L`لا توجد مواعيد.`}</p>`}</div>
    <button class="btn ghost block" data-sub="tests">${L`🔬 عرض جدول الفحوصات الموصى بها`}</button>`;
  },

  tests() {
    const st = status();
    return `<div class="card">${APPOINTMENTS.map(a => {
      const state = st.week > a.to ? 'past' : st.week >= a.from ? 'now' : 'next';
      return `<div class="item-row ${state === 'past' ? 'faded' : ''}"><div class="em">${state === 'past' ? '✅' : state === 'now' ? '⏰' : '🔬'}</div><div class="grow"><b>${a.title}</b>
        ${state === 'now' ? `<span class="badge">${L`وقته الآن`}</span>` : ''}
        <div class="muted">${L`الأسبوع ${a.from}${a.to !== a.from ? '–' + a.to : ''} · ${fmtShort.format(weekDate(st, a.from))}`}</div><div style="font-size:.9rem">${a.desc}</div></div></div>`;
    }).join('')}</div>`;
  },

  journal() {
    const t = iso(today());
    const e = S.journal.find(j => j.date === t) || { mood: '', symptoms: [], note: '' };
    const past = S.journal.filter(j => j.date !== t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    const st = status();
    return `<div class="card"><h3>${L`كيف حالك اليوم؟`}</h3>
      <div class="chips" id="moods">${MOODS.map(m => `<button class="chip ${e.mood === m ? 'on' : ''}" data-mood="${m}" style="font-size:1.5rem">${m}</button>`).join('')}</div>
      <h3 style="margin-top:14px">${L`الأعراض`}</h3>
      <div class="chips" id="syms">${SYMPTOMS_LIST.map(s => `<button class="chip ${e.symptoms.map(L.t).includes(s) ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</div>
      <label class="f" style="margin-top:14px">${L`ملاحظات / رسالة لطفلك`}<textarea id="jNote" rows="3">${esc(e.note)}</textarea></label>
      <button class="btn block" id="jSave">${L`حفظ يوميات اليوم`}</button></div>
    ${past.length ? `<div class="card"><h3>${L`اليوميات السابقة`}</h3>${past.map(j => `<div class="item-row"><div class="em">${j.mood || '📝'}</div>
      <div><b>${fmt.format(parse(j.date))}</b> <span class="muted">${L`· الأسبوع ${Math.floor(diffDays(parse(j.date), st.start) / 7) + 1}`}</span>
      ${j.symptoms.length ? `<div class="chips" style="margin:4px 0">${j.symptoms.map(s => `<span class="chip">${L.t(s)}</span>`).join('')}</div>` : ''}
      ${j.note ? `<div style="font-size:.92rem">${esc(j.note)}</div>` : ''}</div></div>`).join('')}</div>` : ''}`;
  },

  bag() {
    const all = Object.values(HOSPITAL_BAG).flat();
    const n = all.filter(i => S.bag[L.src(i)]).length;
    return `<div class="card"><p class="muted" style="margin-top:0">${L`جهّزي الحقيبة بحلول الأسبوع 34–36، وضعيها قرب الباب.`}</p>
      <div class="row"><b>${n} / ${all.length}</b><div class="progress grow"><i style="width:${n / all.length * 100}%"></i></div></div></div>
      ${Object.entries(HOSPITAL_BAG).map(([g, items]) => `<div class="card"><h3>${{ 'للأم': '👩', 'للمولود': '👶', 'الأوراق': '📄' }[g] || '🧑'} ${g}</h3>
        ${items.map(i => `<label class="check ${S.bag[L.src(i)] ? 'done' : ''}"><input type="checkbox" data-bag="${esc(i)}" ${S.bag[L.src(i)] ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>`).join('')}`;
  },

  water() {
    const t = iso(today()), n = S.water[t] || 0;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    return `<div class="card center"><h2>${L`💧 ${n} / 10 أكواب`}</h2>
      <p class="muted">${L`اشربي 8–12 كوباً يومياً (نحو 2.5–3 لترات). الماء يقلل الإمساك والتهاب المسالك والتورم.`}</p>
      <div class="water">${Array.from({ length: 12 }, (_, i) => `<button data-cup="${i + 1}" class="${i < n ? 'on' : ''}">🥛</button>`).join('')}</div></div>
      <div class="card"><h3>${L`آخر 7 أيام`}</h3><div class="row" style="align-items:flex-end;height:120px;gap:6px">
      ${days.map(d => { const v = S.water[iso(d)] || 0; return `<div class="grow center"><div style="height:${Math.min(100, v * 9)}px;background:linear-gradient(var(--primary-2),var(--primary));border-radius:8px 8px 2px 2px"></div><small>${v}</small><br><small class="muted">${fmtShort.format(d).split(' ')[0]}</small></div>`; }).join('')}
      </div></div>`;
  },

  food() {
    const tab = route.tab || 'good';
    const rows = l => l.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('');
    return `<div class="seg" id="foodSeg">${[['good', L('✅ مفيدة')], ['avoid', L('⛔ تجنبيها')], ['nutrients', L('💊 العناصر')]].map(([k, v]) => `<button data-ft="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="card">${tab === 'nutrients'
        ? `<table class="t"><tr><th>${L`العنصر`}</th><th>${L`يومياً`}</th><th>${L`الفائدة`}</th></tr>${FOODS.nutrients.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>`
        : rows(FOODS[tab])}</div>
      <div class="card"><h3>${L`🍽️ نموذج يوم غذائي`}</h3><ul class="list">
        <li><b>${L`الفطور:`}</b> ${L`بيض مسلوق + خبز أسمر + خضار + كوب حليب.`}</li>
        <li><b>${L`سناك:`}</b> ${L`زبادي مع فاكهة أو 3 تمرات وحفنة مكسرات.`}</li>
        <li><b>${L`الغداء:`}</b> ${L`أرز/برغل + دجاج أو سمك مطبوخ جيداً + سلطة خضراء.`}</li>
        <li><b>${L`سناك:`}</b> ${L`فاكهة + جبن مبستر.`}</li>
        <li><b>${L`العشاء:`}</b> ${L`عدس أو فول + خضار + لبن.`}</li></ul></div>`;
  },

  exercise() {
    return `<div class="card">${EXERCISES.map(([e, t, when, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b> <span class="badge soft">${when}</span><div class="muted">${d}</div></div></div>`).join('')}</div>
      <div class="card warn-card"><h3>${L`⛔ توقفي فوراً عند:`}</h3><div class="chips">${EXERCISE_STOP.map(s => `<span class="chip">${s}</span>`).join('')}</div>
      <p class="muted">${L`تجنبي الرياضات العنيفة أو التي فيها خطر السقوط أو الضرب على البطن. استشيري طبيبك قبل البدء.`}</p></div>`;
  },

  warnings() {
    return `<div class="card warn-card"><h2>${L`🚨 اتصلي بطبيبك أو توجهي للطوارئ فوراً إذا لاحظتِ:`}</h2>
      ${WARNING_SIGNS.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</div>`;
  },

  names() {
    const g = route.tab || 'girl';
    return `<div class="seg" id="nameSeg"><button data-g="girl" class="${g === 'girl' ? 'on' : ''}">${L`👧 بنات`}</button><button data-g="boy" class="${g === 'boy' ? 'on' : ''}">${L`👦 أولاد`}</button><button data-g="fav" class="${g === 'fav' ? 'on' : ''}">${L`❤️ المفضلة (${S.favNames.length})`}</button></div>
      <div class="card"><div class="chips">${(g === 'fav' ? S.favNames.map(L.t) : BABY_NAMES[g]).map(n => `<button class="chip ${S.favNames.includes(L.src(n)) ? 'on' : ''}" data-name="${esc(n)}">${S.favNames.includes(L.src(n)) ? '❤️' : '🤍'} ${esc(n)}</button>`).join('') || `<p class="muted">${L`اضغطي على القلب لإضافة أسماء.`}</p>`}</div></div>
      <div class="card"><div class="row"><input class="input grow" id="nmNew" placeholder="${L`أضيفي اسماً خاصاً`}" style="margin:0"><button class="btn" id="nmAdd">${L`إضافة`}</button></div></div>`;
  },

  calc() {
    return `<div class="card"><p class="muted" style="margin-top:0">${L`احسبي موعد ولادة لأي تاريخ (لا يغير بياناتك).`}</p>
      <label class="f">${L`أول يوم في آخر دورة`}<input type="date" id="cLmp"></label>
      <label class="f">${L`طول الدورة`}<input type="number" id="cCycle" value="28"></label>
      <div id="cOut"></div></div>
      <div class="card"><h3>${L`كيف يُحسب؟`}</h3><p>${L`قاعدة نيجل: أول يوم من آخر دورة + سنة − 3 أشهر + 7 أيام (= 280 يوماً). يُضاف الفرق إذا كانت دورتك أطول أو أقصر من 28 يوماً.`}</p></div>`;
  },

  postpartum() {
    return `<div class="card">${POSTPARTUM.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</div>`;
  },

  faq() {
    return `<div class="card">${FAQ.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
  }
};

function weightChart(ws, pre, rng, st) {
  const W = 320, H = 170, pl = 30, pr = 10, pt = 10, pb = 22;
  const pts = ws.map(x => ({ wk: diffDays(parse(x.date), st.start) / 7, kg: +x.kg }));
  const base = pre || pts[0].kg;
  const kgs = pts.map(p => p.kg).concat([base, base + rng[1]]);
  const min = Math.floor(Math.min(...kgs) - 1), max = Math.ceil(Math.max(...kgs) + 1);
  const X = w => pl + (Math.max(0, Math.min(40, w)) / 40) * (W - pl - pr);
  const Y = k => pt + (1 - (k - min) / (max - min)) * (H - pt - pb);
  // نطاق الزيادة الموصى بها: ~1–2 كغ في الثلث الأول ثم خطي
  const band = (g) => [0, 13, 40].map(w => [w, base + (w <= 13 ? (w / 13) * (g === 0 ? 0.5 : 2) : (g === 0 ? 0.5 : 2) + (w - 13) / 27 * ((g === 0 ? rng[0] : rng[1]) - (g === 0 ? 0.5 : 2)))]);
  const lo = band(0), hi = band(1);
  const poly = hi.map(([w, k]) => `${X(w)},${Y(k)}`).concat(lo.reverse().map(([w, k]) => `${X(w)},${Y(k)}`)).join(' ');
  return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}">
    ${pre ? `<polygon points="${poly}" fill="var(--primary-2)" opacity=".15"/>` : ''}
    ${[0, 10, 20, 30, 40].map(w => `<text x="${X(w)}" y="${H - 6}" text-anchor="middle">${w}</text><line x1="${X(w)}" x2="${X(w)}" y1="${pt}" y2="${H - pb}" stroke="var(--border)"/>`).join('')}
    ${[min, Math.round((min + max) / 2), max].map(k => `<text x="${pl - 4}" y="${Y(k) + 3}" text-anchor="end">${k}</text>`).join('')}
    <polyline points="${pts.map(p => `${X(p.wk)},${Y(p.kg)}`).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>
    ${pts.map(p => `<circle cx="${X(p.wk)}" cy="${Y(p.kg)}" r="3.5" fill="var(--primary)"/>`).join('')}
  </svg><p class="muted center" style="margin:0">${L`المحور الأفقي: الأسبوع · المنطقة البنفسجية: النطاق الموصى به`}</p>`;
}

/* زر يتطلب ضغطتين للتأكيد (بديل confirm) */
function confirmTap(sel, fn) {
  let armed = false;
  return () => {
    const b = typeof sel === 'string' ? $(sel) : sel;
    if (armed) return fn();
    armed = true; const old = b.textContent; b.textContent = L('اضغطي مرة أخرى للتأكيد');
    setTimeout(() => { armed = false; if (b.isConnected) b.textContent = old; }, 3000);
  };
}

/* ---------- ربط الأحداث ---------- */
function bind() {
  app.querySelectorAll('[data-week]').forEach(el => el.onclick = () => { go('weeks', null, +el.dataset.week); });
  app.querySelectorAll('[data-sub]').forEach(el => el.onclick = e => { e.preventDefault(); go(route.view, el.dataset.sub); });
  app.querySelectorAll('[data-wk]').forEach(el => el.onclick = () => { route.week = +el.dataset.wk; route.mode = 'week'; history.replaceState(route, ''); render(); });
  app.querySelectorAll('[data-done]').forEach(el => el.onchange = () => { S.done[el.dataset.done] = el.checked; save(); render(false); });

  const strip = $('#strip');
  if (strip) { const s = strip.querySelector('.sel'); if (s) s.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }); }

  const on = (id, fn, ev = 'onclick') => { const el = $(id); if (el) el[ev] = fn; };
  const t = iso(today());

  // الرئيسية
  on('#vitToday', () => { S.vitamins[t] = !S.vitamins[t]; save(); render(false); });
  on('#waterPlus', () => { S.water[t] = (S.water[t] || 0) + 1; save(); render(false); });
  on('#waterMinus', () => { S.water[t] = Math.max(0, (S.water[t] || 0) - 1); save(); render(false); });

  // الإعدادات
  on('#exportBtn', async () => {
    const json = JSON.stringify(S, null, 2), name = `nabd-backup-${t}.json`;
    const done = () => { S.lastBackup = Date.now(); save(); render(false); };
    try { if (await Native.shareFile(name, json, L('نسخة نبض الاحتياطية'))) return done(); } catch (e) { if (/cancel/i.test(e?.message || '')) return; }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast(L('تم حفظ النسخة الاحتياطية ✅')); done();
    } catch { toast(L('تعذّر حفظ النسخة، حاولي مرة أخرى')); }
  });
  on('#importFile', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { const d = JSON.parse(txt); if (!d.profile) throw 0; S = Object.assign(defaults(), d); save(); toast(L('تمت استعادة بياناتك ✅')); route = { view: 'home' }; history.replaceState(route, ''); render(); Notify.sync(false); })
      .catch(() => toast(L('هذا الملف ليس نسخة احتياطية من نبض')));
  }, 'onchange');
  on('#resetBtn', confirmTap('#resetBtn .txt b', () => { S = defaults(); save(); route = { view: 'home' }; history.replaceState(route, ''); render(); Notify.sync(false); }));
  const notifyMsg = ok => ok ? L('تم حفظ التذكيرات 🔔') : L('اسمحي لنبض بالإشعارات من إعدادات الجهاز');
  app.querySelectorAll('[data-rem]').forEach(c => c.onchange = async () => { S.reminders = { ...Notify.rem(), [c.dataset.rem]: c.checked }; save(); render(false); if (Notify.native()) toast(notifyMsg(await Notify.sync(true))); });
  app.querySelectorAll('[data-remw]').forEach(sel => sel.onchange = async () => {
    const r = { ...Notify.rem(), [sel.dataset.remw]: +sel.value };
    if (+r.waterTo < +r.waterFrom) r.waterTo = r.waterFrom;
    S.reminders = r; save(); render(false); await Notify.sync(false); toast(L('تم ضبط تذكير الماء 💧'));
  });
  on('#remVitTime', async e => { S.reminders = { ...Notify.rem(), vitTime: e.target.value || '10:00' }; save(); await Notify.sync(false); toast(L('تم ضبط موعد التذكير ⏰')); }, 'onchange');
  on('#notifyTest', async () => { const r = await Notify.test(); toast(r === 'ok' ? L('سيصلك إشعار تجريبي خلال ثوانٍ') : r === 'denied' ? L('اسمحي لنبض بالإشعارات من إعدادات الجهاز') : L('الإشعارات تعمل في تطبيق الموبايل')); });
  on('#notifyOn', async e => { S.notify = e.target.checked; save(); render(false); const ok = await Notify.sync(true); if (!S.notify) toast(L('تم إيقاف الإشعارات')); else if (Notify.native()) toast(notifyMsg(ok)); }, 'onchange');
  on('#setLang', e => I18N.set(e.target.value), 'onchange');
  on('#setCountry', e => { S.country = e.target.value; save(); toast(L`رقم الإسعاف: ${emergencyNo()}`); render(false); }, 'onchange');
  const pick = (id, fn) => app.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { Native.tap(); fn(b.dataset.v); save(); render(false); });
  pick('themeSeg', v => { S.theme = v; });
  pick('fontSeg', v => { S.font = v; });
  pick('digSeg', v => { S.digits = v; });
  pick('gluSeg', v => { S.gluUnit = v; });
  pick('calSeg', v => { S.calendar = v; toast(v === 'hijri' ? L('التواريخ الآن بالهجري 🌙') : L('التواريخ الآن بالميلادي')); });
  on('#motionOn', e => { S.motion = e.target.checked ? 'reduce' : ''; save(); render(false); }, 'onchange');
  on('#crashOn', e => { S.crash = e.target.checked; save(); Crash.apply(); toast(S.crash ? L('تم تفعيل تقارير الأعطال') : L('تم إيقاف تقارير الأعطال')); }, 'onchange');
  on('#lockOn', e => {
    if (e.target.checked) { e.target.checked = false; Lock.setup(ok => { if (ok) toast(L('تم تفعيل قفل التطبيق 🔒')); render(false); }); }
    else Lock.verify(ok => { if (ok) { delete S.lock; save(); toast(L('تم إيقاف القفل')); } render(false); });
  }, 'onchange');
  on('#lockChange', () => Lock.verify(ok => ok && Lock.setup(ok2 => { if (ok2) toast(L('تم تغيير الرمز')); render(false); })));
  on('#rateApp', () => { window.open(STORE_URL, '_blank'); });
  on('#shareApp', async () => {
    const text = L`أستخدم تطبيق «${APP_NAME}» لمتابعة الحمل أسبوعاً بأسبوع وصحة طفلي، بالعربي وبدون إعلانات 💗`;
    try { if (await Native.shareText(APP_NAME, text, STORE_URL)) return; } catch { return; }
    navigator.clipboard?.writeText(`${text}\n${STORE_URL}`).then(() => toast(L('تم نسخ رابط التطبيق 📋')), () => {});
  });
  on('#newsX', () => { S.news12 = 1; save(); render(false); });
  on('#newsGo', () => { S.news12 = 1; save(); go('more', 'settings'); });
  const cd = $('#countdown');
  if (cd) {
    const due = +cd.dataset.due, el = k => cd.querySelector(`[data-cd="${k}"]`);
    const tick = () => { let s = Math.max(0, Math.floor((due - Date.now()) / 1000)); const v = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
      Object.entries(v).forEach(([k, n]) => { el(k).textContent = String(n).padStart(2, '0'); }); };
    tick(); timers.push(setInterval(tick, 1000));
  }

  if (route.sub === 'profile') bindSetup();

  // الوزن
  on('#wAdd', () => {
    const d = $('#wDate').value, kg = parseFloat($('#wKg').value);
    if (!d || !(kg > 25 && kg < 250)) return toast(L('أدخلي وزناً صحيحاً'));
    S.weights = S.weights.filter(x => x.date !== d).concat({ date: d, kg }); save(); render(false);
  });
  app.querySelectorAll('[data-delw]').forEach(b => b.onclick = () => { S.weights = S.weights.filter(x => x.date !== b.dataset.delw); save(); render(false); });

  // المواعيد
  on('#aAdd', () => {
    const title = $('#aTitle').value.trim(), date = $('#aDate').value;
    if (!title || !date) return toast(L('أدخلي العنوان والتاريخ'));
    S.appts.push({ id: Date.now().toString(36), title, date, time: $('#aTime').value, notes: $('#aNotes').value.trim(), done: false });
    save(); toast(L('تمت الإضافة')); render(false);
  });
  app.querySelectorAll('[data-apdone]').forEach(b => b.onchange = () => { const a = S.appts.find(x => x.id === b.dataset.apdone); a.done = b.checked; save(); render(false); });
  app.querySelectorAll('[data-apdel]').forEach(b => b.onclick = () => { S.appts = S.appts.filter(x => x.id !== b.dataset.apdel); save(); render(false); });

  // اليوميات
  app.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { app.querySelectorAll('[data-mood]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  app.querySelectorAll('[data-sym]').forEach(b => b.onclick = () => b.classList.toggle('on'));
  on('#jSave', () => {
    const mood = app.querySelector('[data-mood].on')?.dataset.mood || '';
    // تُحفظ بالعربية الأصلية حتى تظهر صحيحة بعد تغيير اللغة
    const symptoms = [...app.querySelectorAll('[data-sym].on')].map(b => L.src(b.dataset.sym));
    S.journal = S.journal.filter(j => j.date !== t).concat({ date: t, mood, symptoms, note: $('#jNote').value.trim() });
    save(); toast(L('تم الحفظ 💕')); render(false);
  });

  // الحقيبة
  app.querySelectorAll('[data-bag]').forEach(b => b.onchange = () => { S.bag[L.src(b.dataset.bag)] = b.checked; save(); render(false); });

  // الماء
  app.querySelectorAll('[data-cup]').forEach(b => b.onclick = () => { const n = +b.dataset.cup; S.water[t] = S.water[t] === n ? n - 1 : n; save(); render(false); });

  // التغذية والأسماء
  const car = $('#car');
  if (car) {
    const dots = [...document.querySelectorAll('#dots i')];
    if (route.slide) car.children[route.slide]?.scrollIntoView({ inline: 'center', block: 'nearest' });
    car.onscroll = () => {
      const i = Math.round(Math.abs(car.scrollLeft) / car.clientWidth);
      if (i !== (route.slide || 0)) { route.slide = i; history.replaceState(route, ''); dots.forEach((d, k) => d.classList.toggle('on', k === i)); }
    };
  }
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { route.mode = b.dataset.mode; history.replaceState(route, ''); render(); });
  app.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { route.sec = b.dataset.sec; history.replaceState(route, ''); render(false); });
  const lg = $('#legend'); if (lg) lg.ontoggle = () => { route.legend = lg.open; history.replaceState(route, ''); };
  app.querySelectorAll('#foodSeg button').forEach(b => b.onclick = () => { route.tab = b.dataset.ft; render(false); });
  app.querySelectorAll('#nameSeg button').forEach(b => b.onclick = () => { route.tab = b.dataset.g; render(false); });
  app.querySelectorAll('[data-name]').forEach(b => b.onclick = () => {
    const n = L.src(b.dataset.name); S.favNames = S.favNames.includes(n) ? S.favNames.filter(x => x !== n) : S.favNames.concat(n); save(); render(false);
  });
  on('#nmAdd', () => { const n = $('#nmNew').value.trim(); if (n && !S.favNames.includes(n)) { S.favNames.push(n); save(); route.tab = 'fav'; render(false); } });

  // الحاسبة
  const calc = () => {
    const l = $('#cLmp').value; if (!l) return;
    const d = addDays(parse(l), 280 + ((+$('#cCycle').value || 28) - 28));
    const days = diffDays(today(), addDays(d, -280));
    $('#cOut').innerHTML = `<div class="card hero"><div class="muted">${L`موعد الولادة المتوقع`}</div><h2 style="margin:4px 0">${fmt.format(d)}</h2>
      ${days >= 0 && days <= 300 ? `<span class="badge">${L`عمر الحمل اليوم: ${Math.floor(days / 7)} أسبوع و${days % 7} يوم`}</span>` : ''}</div>`;
  };
  on('#cLmp', calc, 'oninput'); on('#cCycle', calc, 'oninput');
  const lt = $('#lblToggle'); if (lt) lt.onclick = () => { route.labels = !route.labels; history.replaceState(route, ''); render(false); };
  extrasBind();
  toolsBind();
  featBind();
}

/* ---------- تشغيل (بعد تحميل كل الملفات) ---------- */
/* ---------- قفل التطبيق برمز من 4 أرقام ----------
   قفل خصوصية على الجهاز نفسه (يُحفظ بصمة الرمز فقط، وليس الرمز). */
const Lock = (() => {
  const el = () => $('#lock');
  // بصمة ثابتة للرمز (cyrb53) مع ملح خاص بالجهاز
  const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (const ch of s) { const c = ch.charCodeAt(0); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  const salt = () => S.lock?.s || (S.lock = { ...(S.lock || {}), s: Math.random().toString(36).slice(2) }).s;
  let mode = null, buf = '', first = null, cb = null, forgot = false;
  const TITLES = { unlock: L('أدخلي رمز الدخول'), verify: L('أدخلي الرمز الحالي'), setup: L('اختاري رمزاً من 4 أرقام') };
  function draw(msg = '', shake = false) {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'];
    el().innerHTML = `<div class="lock-box"><img src="icons/icon.svg" alt="">
      <h2>${forgot ? L('نسيتِ الرمز؟') : first && mode === 'setup' ? L('أعيدي إدخال الرمز للتأكيد') : TITLES[mode]}</h2>
      ${forgot ? `<p>${L`لحماية خصوصيتك لا يمكن فتح التطبيق بدون الرمز. يمكنك حذف كل البيانات والبدء من جديد، أو استعادة نسخة احتياطية بعدها.`}</p>
        <button class="btn danger block" id="lkWipe" style="margin-top:22px">${L`حذف البيانات والبدء من جديد`}</button><button class="link" id="lkBack">${L`رجوع`}</button>` : `
      <p>${msg}</p>
      <div class="pin-dots ${shake ? 'shake' : ''}">${[0, 1, 2, 3].map(i => `<i class="${i < buf.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="keypad">${keys.map(k => k === '' ? '<button class="blank" tabindex="-1"></button>' : k === 'del' ? `<button class="del" data-k="del" aria-label="${L`مسح`}">⌫</button>` : `<button data-k="${k}">${S.digits === 'ar' && I18N.rtl ? AR_DIGITS[k] : k}</button>`).join('')}</div>
      <button class="link" id="${mode === 'unlock' ? 'lkForgot' : 'lkCancel'}">${mode === 'unlock' ? L('نسيتِ الرمز؟') : L('إلغاء')}</button>`}</div>`;
    el().querySelectorAll('[data-k]').forEach(b => b.onclick = () => key(b.dataset.k));
    const on = (id, fn) => { const b = el().querySelector(id); if (b) b.onclick = fn; };
    on('#lkForgot', () => { forgot = true; draw(); });
    on('#lkBack', () => { forgot = false; draw(); });
    on('#lkCancel', () => close(false));
    on('#lkWipe', confirmTap(el().querySelector('#lkWipe'), () => { S = defaults(); save(); route = { view: 'home' }; history.replaceState(route, ''); close(true); render(); }));
  }
  function key(k) {
    Native.tap();
    if (k === 'del') { buf = buf.slice(0, -1); return draw(); }
    if (buf.length >= 4) return;
    buf += k; draw();
    if (buf.length < 4) return;
    setTimeout(() => {
      if (mode === 'setup') {
        if (!first) { first = buf; buf = ''; return draw(); }
        if (first === buf) { const s = salt(); S.lock = { s, h: hash(s + buf) }; save(); return close(true); }
        first = null; buf = ''; return draw(L('الرمزان غير متطابقين، حاولي من جديد'), true);
      }
      if (hash(S.lock.s + buf) === S.lock.h) return close(true);
      buf = ''; draw(L('الرمز غير صحيح'), true);
      if (navigator.vibrate) navigator.vibrate(120);
    }, 140);
  }
  function open(m, done) { mode = m; buf = ''; first = null; forgot = false; cb = done; el().hidden = false; draw(); }
  function close(ok) { el().hidden = true; el().innerHTML = ''; mode = null; const f = cb; cb = null; f && f(ok); }
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (S.lock?.h && !mode && hiddenAt && Date.now() - hiddenAt > 60000) open('unlock');
  });
  return {
    setup: done => open('setup', done),
    verify: done => open('verify', done),
    start() { if (S.lock?.h) open('unlock'); }
  };
})();

window.addEventListener('DOMContentLoaded', () => { booted = true; if (!S.country) { S.country = guessCountry(); save(); } history.replaceState(route, ''); render(); Lock.start();
  // زمن الإقلاع حتى أول رسم كامل
  requestAnimationFrame(() => { window.NABD_BOOT = Math.round(performance.now()); Crash.apply(); });
  Notify.start(); Widget.sync(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
