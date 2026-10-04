/* نبضٌ صغير — منطق التطبيق */
'use strict';

const KEY = 'rihlati_v1';
const DAY = 86400000;

const defaults = () => ({
  profile: null, // {name, babyName, method, lmp, cycle, conception, ivf, ivfDay, due, height, preWeight}
  weights: [], kicks: [], contractions: [], appts: [], journal: [],
  bag: {}, water: {}, vitamins: {}, favNames: [], done: {}, theme: 'auto'
});

let S = load();
let route = { view: 'home', sub: null, week: null };
let timers = [];

function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return defaults(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

/* ---------- أدوات التاريخ ---------- */
const fmt = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short' });
let fmtHijri;
try { fmtHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { fmtHijri = null; }

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
  const week = Math.min(42, Math.max(1, weeksDone + 1));
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

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
}
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  S.theme = dark ? 'light' : 'dark'; save(); applyTheme();
};

document.querySelectorAll('#tabbar button').forEach(b => b.onclick = () => go(b.dataset.view));
$('#backBtn').onclick = () => history.back();
window.addEventListener('popstate', e => { route = e.state || { view: 'home' }; render(false); });

function go(view, sub = null, week = null) {
  route = { view, sub, week, labels: route.labels, art: route.art };
  history.pushState(route, '');
  render();
}

const TOOLS = [
  ['kicks', '👣', 'عدّاد الركلات'], ['contractions', '⏱️', 'مؤقت الطلق'], ['weight', '⚖️', 'متابعة الوزن'],
  ['appts', '📆', 'مواعيدي'], ['journal', '📝', 'يومياتي'], ['bag', '🎒', 'حقيبة الولادة'],
  ['water', '💧', 'شرب الماء'], ['food', '🥗', 'التغذية'], ['exercise', '🧘‍♀️', 'التمارين'],
  ['warnings', '🚨', 'علامات الخطر'], ['names', '👶', 'أسماء المواليد'], ['calc', '🧮', 'حاسبة الولادة'],
  ['postpartum', '🤱', 'بعد الولادة'], ['faq', '❓', 'أسئلة شائعة'], ['tests', '🔬', 'الفحوصات والتحاليل']
];
const APP_NAME = 'نبضٌ صغير';

function render(scroll = true) {
  timers.forEach(clearInterval); timers = [];
  applyTheme();
  const tab = $('#tabbar');
  if (!S.profile) {
    tab.hidden = true; $('#backBtn').hidden = true; $('#title').textContent = `${APP_NAME} 💗`;
    app.innerHTML = viewSetup(true); bindSetup(); return;
  }
  tab.hidden = false;
  tab.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === route.view));
  $('#backBtn').hidden = !route.sub;
  const titles = { home: `${APP_NAME} 💗`, weeks: route.mode === 'map' ? 'خارطة الرحلة' : 'أسبوعاً بأسبوع', track: 'متابعتي', guide: 'دليل الحامل', more: 'حسابي' };
  let html;
  if (route.sub) {
    const t = TOOLS.find(x => x[0] === route.sub);
    $('#title').textContent = t ? `${t[1]} ${t[2]}` : (route.sub === 'profile' ? 'بيانات الحمل' : APP_NAME);
    html = route.sub === 'profile' ? viewSetup(false) : (SUBVIEWS[route.sub] || (() => ''))();
  } else {
    $('#title').textContent = titles[route.view];
    html = { home: viewHome, weeks: viewWeeks, track: viewTrack, guide: viewGuide, more: viewMore }[route.view]();
  }
  app.innerHTML = html;
  bind();
  if (scroll) window.scrollTo(0, 0);
}

/* ---------- الإعداد ---------- */
function viewSetup(first) {
  const p = S.profile || { method: 'lmp', cycle: 28, ivfDay: 5 };
  const m = p.method;
  return `
  ${first ? `<div class="welcome">${Art.baby(22, 170)}
    <h2>أهلاً بكِ في ${APP_NAME} 💗</h2>
    <p class="muted">خارطة طريقك من بداية الحمل حتى لحظة الولادة — أسبوعاً بأسبوع.</p></div>` : ''}
  <div class="card">
    <h2>احسبي موعد ولادتك</h2>
    <label class="f">اسمك (اختياري)<input id="s_name" value="${esc(p.name)}" placeholder="مثال: سارة"></label>
    <label class="f">اسم الجنين أو لقبه (اختياري)<input id="s_baby" value="${esc(p.babyName)}" placeholder="مثال: نونو"></label>
    <div class="muted">طريقة الحساب</div>
    <div class="seg" id="s_method">
      ${[['lmp', 'آخر دورة'], ['conception', 'تاريخ الإخصاب'], ['ivf', 'أطفال الأنابيب'], ['due', 'أعرف موعد الولادة']]
        .map(([k, v]) => `<button data-m="${k}" class="${m === k ? 'on' : ''}">${v}</button>`).join('')}
    </div>
    <div id="s_fields">${setupFields(p)}</div>
    <div class="grid2">
      <label class="f">الطول (سم)<input id="s_height" type="number" inputmode="decimal" value="${esc(p.height)}" placeholder="160"></label>
      <label class="f">الوزن قبل الحمل (كغ)<input id="s_pre" type="number" inputmode="decimal" value="${esc(p.preWeight)}" placeholder="60"></label>
    </div>
    <div id="s_preview" class="card hero" style="display:none"></div>
    <button class="btn block" id="s_save">${first ? 'ابدئي الرحلة 🚀' : 'حفظ'}</button>
  </div>
  <p class="disclaimer">المعلومات للتثقيف فقط ولا تغني عن استشارة الطبيب.</p>`;
}
function setupFields(p) {
  const t = iso(today());
  switch (p.method) {
    case 'lmp': return `<label class="f">أول يوم في آخر دورة شهرية<input id="s_lmp" type="date" max="${t}" value="${esc(p.lmp)}"></label>
      <label class="f">متوسط طول الدورة (أيام)<input id="s_cycle" type="number" min="20" max="45" value="${esc(p.cycle || 28)}"></label>`;
    case 'conception': return `<label class="f">تاريخ الإخصاب / الإباضة<input id="s_conc" type="date" max="${t}" value="${esc(p.conception)}"></label>`;
    case 'ivf': return `<label class="f">تاريخ إرجاع الأجنة<input id="s_ivf" type="date" max="${t}" value="${esc(p.ivf)}"></label>
      <label class="f">عمر الجنين عند الإرجاع<select id="s_ivfday">${[3, 5, 6].map(d => `<option value="${d}" ${+p.ivfDay === d ? 'selected' : ''}>اليوم ${d}</option>`).join('')}</select></label>`;
    case 'due': return `<label class="f">موعد الولادة المتوقع<input id="s_due" type="date" value="${esc(p.due)}"></label>`;
  }
}
function readSetup() {
  const p = { ...(S.profile || {}) };
  p.method = document.querySelector('#s_method .on').dataset.m;
  p.name = $('#s_name').value.trim(); p.babyName = $('#s_baby').value.trim();
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
    box.innerHTML = bad ? `<b style="color:var(--warn)">⚠️ التاريخ غير منطقي، تأكدي منه.</b>` :
      `<div class="muted">موعد الولادة المتوقع</div><h2 style="margin:4px 0">${fmt.format(st.due)}</h2>
       ${fmtHijri ? `<div class="muted">${fmtHijri.format(st.due)}</div>` : ''}
       <div class="badge" style="margin-top:6px">أنتِ في الأسبوع ${st.week}</div>`;
  };
  document.querySelectorAll('#s_method button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#s_method button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#s_fields').innerHTML = setupFields({ ...(S.profile || {}), method: b.dataset.m });
    $('#s_fields').querySelectorAll('input,select').forEach(i => i.oninput = preview);
    preview();
  });
  app.querySelectorAll('input,select').forEach(i => i.oninput = preview);
  preview();
  $('#s_save').onclick = () => {
    const p = readSetup();
    if (!p) return toast('أدخلي التاريخ أولاً');
    const old = S.profile; S.profile = p; const st = status();
    if (st.left < -21 || st.left > 300) { S.profile = old; return toast('التاريخ غير صحيح'); }
    save(); toast('تم الحفظ ✅');
    if (!old) { route = { view: 'home' }; history.replaceState(route, ''); render(); } else history.back();
  };
}

/* ---------- الرئيسية ---------- */
function viewHome() {
  const st = status(), w = WEEKS[st.week - 1], p = S.profile;
  const tKey = iso(today());
  const water = S.water[tKey] || 0, vit = !!S.vitamins[tKey];
  const nextAppt = S.appts.filter(a => a.date >= tKey && !a.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const upcoming = APPOINTMENTS.filter(a => a.to >= st.week).slice(0, 2);
  const tri = TRIMESTERS[st.tri - 1];
  const born = st.left <= -1 && st.week >= 40;
  return `
  <div class="card hero">
    <div class="muted">${p.name ? `مرحباً ${esc(p.name)} 💕` : 'مرحباً بكِ 💕'}</div>
    ${Art.ring(st.pct, 180, `${st.weeksDone}+${st.extra}`, 'أسبوع + يوم')}
    <div class="row" style="justify-content:center;margin-top:6px">
      <span class="badge">الأسبوع ${st.week}</span>
      <span class="badge alt">${tri.name}</span>
      <span class="badge soft">الشهر ${st.month}</span>
    </div>
    <div class="grid3" style="margin-top:14px">
      <div class="stat"><b>${Math.max(0, st.left)}</b><small>يوم متبقٍ</small></div>
      <div class="stat"><b>${Math.round(st.pct * 100)}%</b><small>من الرحلة</small></div>
      <div class="stat"><b>${Math.max(0, 40 - st.weeksDone)}</b><small>أسبوع متبقٍ</small></div>
    </div>
    <p style="margin:12px 0 0"><span class="muted">موعد الولادة:</span> <b>${fmt.format(st.due)}</b>
      ${fmtHijri ? `<br><span class="muted">${fmtHijri.format(st.due)}</span>` : ''}</p>
    ${born ? `<p><b>تجاوزتِ موعد الولادة — تابعي مع طبيبك 🩺</b></p>` : ''}
  </div>

  <div class="card">
    <h2>${p.babyName ? esc(p.babyName) : 'طفلك'} هذا الأسبوع</h2>
    <div class="baby-card">
      ${Art.baby(st.week, 140)}
      <div class="grow">
        <div class="row"><span class="fruit">${w.emoji}</span><div><div class="muted">بحجم</div><b>${w.size}</b></div></div>
        <div class="grid2" style="margin-top:8px">
          <div class="stat"><b style="font-size:1rem">${w.len}</b><small>الطول</small></div>
          <div class="stat"><b style="font-size:1rem">${w.wt}</b><small>الوزن</small></div>
        </div>
      </div>
    </div>
    <p style="margin:12px 0 4px">👶 ${w.baby[0]}</p>
    <p style="margin:4px 0">🤰 ${w.mom[0]}</p>
    <p style="margin:4px 0">💡 ${w.tips[0]}</p>
    <button class="btn block" data-week="${st.week}" style="margin-top:8px">كل تفاصيل الأسبوع ${st.week} ←</button>
  </div>

  <div class="card">
    <h3>✅ مهام اليوم</h3>
    <label class="check ${vit ? 'done' : ''}"><input type="checkbox" id="vitToday" ${vit ? 'checked' : ''}><span>💊 تناولت الفيتامينات (حمض الفوليك / الحديد)</span></label>
    <div class="row" style="margin-top:8px"><span>💧 الماء: <b>${water}</b> / 10 أكواب</span><span class="grow"></span>
      <button class="btn sm ghost" id="waterMinus">−</button><button class="btn sm" id="waterPlus">+ كوب</button></div>
    <div class="progress" style="margin-top:8px"><i style="width:${Math.min(100, water * 10)}%"></i></div>
    ${st.week >= 28 ? `<button class="btn ghost block" style="margin-top:10px" data-sub="kicks">👣 عدّ حركات الجنين اليوم</button>` : ''}
  </div>

  <div class="card">
    <h3>📆 القادم</h3>
    ${nextAppt ? `<div class="item-row"><div class="em">🩺</div><div><b>${esc(nextAppt.title)}</b><div class="muted">${fmt.format(parse(nextAppt.date))} ${esc(nextAppt.time || '')}</div></div></div>` : ''}
    ${upcoming.map(a => `<div class="item-row"><div class="em">🔬</div><div><b>${a.title}</b>
      <div class="muted">الأسبوع ${a.from}${a.to !== a.from ? '–' + a.to : ''} · ${fmtShort.format(weekDate(st, a.from))}</div>
      <div style="font-size:.9rem">${a.desc}</div></div></div>`).join('')}
    <button class="btn ghost block" data-sub="appts" style="margin-top:8px">إدارة مواعيدي</button>
  </div>

  <div class="card">
    <h3>⚡ وصول سريع</h3>
    <div class="tools-grid">${(st.week >= 28 ? ['kicks', 'contractions', 'bag', 'weight', 'appts', 'journal'] : ['weight', 'appts', 'journal', 'tests', 'food', 'water']).map(k => toolBtn(TOOLS.find(t => t[0] === k))).join('')}</div>
  </div>
  <div class="card warn-card" data-sub="warnings" style="cursor:pointer">
    <b>🚨 علامات تستدعي الطبيب فوراً</b><div class="muted">اضغطي لعرض القائمة</div>
  </div>
  <p class="disclaimer">المعلومات للتثقيف فقط ولا تغني عن استشارة الطبيب.</p>`;
}
const toolBtn = ([k, ic, name]) => `<div class="tool" data-sub="${k}"><span>${ic}</span>${name}</div>`;

/* ---------- الأسابيع ---------- */
const SECS = [['baby', '👶', 'الجنين'], ['mom', '🤰', 'الأم'], ['symptoms', '🌡️', 'الأعراض'], ['tips', '💡', 'نصائح'], ['todo', '📋', 'مهام']];

function viewWeeks() {
  const st = status();
  const modeSeg = `<div class="seg big" id="modeSeg">
    <button data-mode="week" class="${route.mode !== 'map' ? 'on' : ''}">📅 تفاصيل الأسبوع</button>
    <button data-mode="map" class="${route.mode === 'map' ? 'on' : ''}">🗺️ خارطة الرحلة</button></div>`;
  if (route.mode === 'map') return modeSeg + viewRoadmap();

  const sel = route.week || st.week;
  const w = WEEKS[sel - 1];
  const tri = TRIMESTERS[sel <= 13 ? 0 : sel <= 27 ? 1 : 2];
  const date = weekDate(st, sel);
  const labels = route.labels !== false;
  const sono = route.art === 'sono';
  const sec = SECS.some(x => x[0] === route.sec) ? route.sec : 'baby';
  const items = sec === 'todo' ? w.todo : w[sec].filter(x => x !== '—');
  const away = sel !== st.week;
  return `${modeSeg}
  <div class="week-strip" id="strip">
    ${WEEKS.map(x => `<button data-wk="${x.w}" class="${x.w === sel ? 'sel' : ''} ${x.w === st.week ? 'cur' : ''}">
      <small>${x.w === st.week ? '📍 أنتِ' : 'أسبوع'}</small><b>${x.w}</b></button>`).join('')}
  </div>
  ${away ? `<button class="back-now" data-wk="${st.week}">📍 العودة لأسبوعي الحالي (${st.week})</button>` : ''}
  <div class="card hero">
    <div class="row" style="justify-content:center">
      <span class="badge">الأسبوع ${sel}</span><span class="badge alt">${tri.name}</span>
      ${!away ? '<span class="badge soft">أنتِ هنا 📍</span>' : `<span class="badge soft">${sel < st.week ? 'أسبوع مضى' : 'أسبوع قادم'}</span>`}
    </div>
    <div class="row art-tools">
      <div class="seg" id="artSeg">
        <button data-art="draw" class="${!sono ? 'on' : ''}">🎨 رسم</button>
        <button data-art="sono" class="${sono ? 'on' : ''}">🩻 سونار</button></div>
      <button class="chip ${labels ? 'on' : ''}" id="lblToggle">🏷️ ${labels ? 'إخفاء الأسماء' : 'إظهار الأسماء'}</button>
    </div>
    <div class="art-frame">${sono ? Art.sono(sel, 250, { labels }) : Art.baby(sel, 250, { labels })}</div>
    <p class="muted" style="margin:4px 0 10px;font-size:.8rem">${sel <= 3 ? 'منظر مجهري تقريبي لما يحدث داخل الجسم في هذا الأسبوع' : 'رسم تقريبي يوضح شكل الجنين ونسبة حجمه داخل الرحم'}</p>
    <div class="size-row">
      <span class="fruit">${w.emoji}</span>
      <div><div class="muted">حجم الجنين يعادل</div><b style="font-size:1.15rem">${w.size}</b></div>
      ${Art.mom(sel, 90)}
    </div>
    <div class="grid3" style="margin-top:12px">
      <div class="stat"><b style="font-size:.95rem">${w.len}</b><small>الطول</small></div>
      <div class="stat"><b style="font-size:.95rem">${w.wt}</b><small>الوزن</small></div>
      <div class="stat"><b style="font-size:.95rem">${fmtShort.format(date)}</b><small>يبدأ في</small></div>
    </div>
  </div>
  ${labels ? `<details class="card legend" ${route.legend ? 'open' : ''} id="legend"><summary><b>🔎 ماذا تعني الأسماء في الرسم؟</b></summary>
    ${Art.parts(sel).map(l => `<div class="item-row"><span class="pill-name">${l.n}</span><div class="muted grow">${l.d}</div></div>`).join('')}</details>` : ''}
  <div class="sec-tabs" id="secTabs">
    ${SECS.map(([k, ic, name]) => `<button data-sec="${k}" class="${sec === k ? 'on' : ''}"><span>${ic}</span>${name}${k === 'todo' && w.todo.length ? `<i>${w.todo.length}</i>` : ''}</button>`).join('')}
  </div>
  <div class="card">
    ${!items.length ? '<p class="muted">لا توجد مهام خاصة لهذا الأسبوع.</p>' : sec === 'todo'
      ? items.map((t, i) => { const k = `w${sel}_${i}`; return `<label class="check ${S.done[k] ? 'done' : ''}"><input type="checkbox" data-done="${k}" ${S.done[k] ? 'checked' : ''}><span>${t}</span></label>`; }).join('')
      : `<ul class="list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`}
  </div>
  <div class="row">
    <button class="btn ghost grow" data-wk="${Math.max(1, sel - 1)}" ${sel === 1 ? 'disabled' : ''}>→ الأسبوع ${Math.max(1, sel - 1)}</button>
    <button class="btn grow" data-wk="${Math.min(42, sel + 1)}" ${sel === 42 ? 'disabled' : ''}>الأسبوع ${Math.min(42, sel + 1)} ←</button>
  </div>
  ${away ? `<button class="btn ghost block" data-wk="${st.week}" style="margin-top:10px">📍 العودة لأسبوعي الحالي (${st.week})</button>` : ''}`;
}

/* ---------- خارطة الطريق ---------- */
function viewRoadmap() {
  const st = status();
  const fillPct = Math.min(100, (st.week - 1) / 41 * 100);
  let html = `<div class="card hero"><h2 style="margin:0">رحلتك في 40 أسبوعاً 🗺️</h2>
    <p class="muted" style="margin:4px 0">من ${fmtShort.format(st.start)} حتى ${fmtShort.format(st.due)}</p>
    <div class="progress"><i style="width:${st.pct * 100}%"></i></div>
    <div class="row" style="justify-content:space-between;margin-top:6px"><small>🌱 البداية</small><small>📍 الأسبوع ${st.week}</small><small>👶 الولادة</small></div></div>
    <div class="timeline"><div class="fill" style="height:${fillPct}%"></div>`;
  TRIMESTERS.forEach(t => {
    html += `<div class="tl-tri" style="background:${t.color}"><h3>${t.name} · ${t.range}</h3>
      <div style="font-size:.9rem;opacity:.95">${t.summary}</div>
      <div class="chips" style="margin-top:8px">${t.focus.map(f => `<span class="chip" style="background:rgba(255,255,255,.25);border:0;color:#fff">${f}</span>`).join('')}</div></div>`;
    const range = t.n === 1 ? [1, 13] : t.n === 2 ? [14, 27] : [28, 42];
    for (let i = range[0]; i <= range[1]; i++) {
      const w = WEEKS[i - 1];
      const ap = APPOINTMENTS.filter(a => a.from === i);
      const cls = i < st.week ? 'done' : i === st.week ? 'now' : '';
      html += `<div class="tl-item ${cls}"><span class="dot"></span>
        <div class="card" data-week="${i}"><div class="row">
          <span class="fruit" style="font-size:1.8rem">${w.emoji}</span>
          <div class="grow"><b>الأسبوع ${i}</b> ${i === st.week ? '<span class="badge soft">أنتِ هنا</span>' : ''}
            <div class="muted">${fmtShort.format(weekDate(st, i))} · ${w.size}</div></div>
        </div>
        <div style="font-size:.9rem;margin-top:4px">${w.baby[0]}</div>
        ${ap.map(a => `<div style="margin-top:6px"><span class="badge alt">🔬 ${a.title}</span></div>`).join('')}
        ${i === 13 ? '<div style="margin-top:6px"><span class="badge">🎉 نهاية الثلث الأول</span></div>' : ''}
        ${i === 20 ? '<div style="margin-top:6px"><span class="badge">🎉 منتصف الرحلة</span></div>' : ''}
        ${i === 37 ? '<div style="margin-top:6px"><span class="badge">✅ مكتمل المدة المبكر</span></div>' : ''}
        ${i === 40 ? '<div style="margin-top:6px"><span class="badge">👶 موعد الولادة</span></div>' : ''}
        </div></div>`;
    }
  });
  return html + '</div>';
}

/* ---------- متابعتي ودليلي وحسابي ---------- */
const navRow = (k, sub) => { const [, ic, name] = TOOLS.find(t => t[0] === k); return `<div class="nav-row" data-sub="${k}"><span class="ic">${ic}</span><div class="grow"><b>${name}</b>${sub ? `<div class="muted">${sub}</div>` : ''}</div><span class="chev">‹</span></div>`; };
const group = (title, rows) => `<div class="card group"><h3>${title}</h3>${rows.join('')}</div>`;

function viewTrack() {
  const st = status(), t = iso(today());
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date)), lw = ws[ws.length - 1];
  const bagAll = Object.values(HOSPITAL_BAG).flat(), bagN = bagAll.filter(i => S.bag[i]).length;
  const nextA = S.appts.filter(a => a.date >= t && !a.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const lastK = S.kicks[S.kicks.length - 1];
  const late = [navRow('kicks', S._kick ? '⏳ جلسة عدّ جارية الآن' : lastK ? `آخر جلسة: ${lastK.count} حركات` : st.week >= 28 ? 'ابدئي العدّ اليومي' : 'يبدأ من الأسبوع 28'),
    navRow('contractions', 'لحساب مدة الطلق والفاصل بينه'),
    navRow('bag', `جاهز ${bagN} من ${bagAll.length}`)];
  return `
  ${group('📅 يومياً', [navRow('water', `اليوم: ${S.water[t] || 0} من 10 أكواب`), navRow('journal', S.journal.some(j => j.date === t) ? '✅ سجلتِ يوميات اليوم' : 'كيف حالك اليوم؟')])}
  ${group('🩺 صحتي ومواعيدي', [navRow('weight', lw ? `آخر قياس: ${lw.kg} كغ` : 'أضيفي أول قياس'), navRow('appts', nextA ? `القادم: ${esc(nextA.title)} · ${fmtShort.format(parse(nextA.date))}` : 'لا توجد مواعيد قادمة')])}
  ${group(st.week >= 28 ? '🏥 الاستعداد للولادة (مرحلتك الآن)' : '🏥 الاستعداد للولادة', late)}`;
}

function viewGuide() {
  const st = status();
  const nextT = APPOINTMENTS.find(a => a.to >= st.week);
  return `
  <div class="card warn-card nav-row" data-sub="warnings"><span class="ic">🚨</span><div class="grow"><b>علامات تستدعي الطبيب فوراً</b><div class="muted">اقرئيها مرة واحدة على الأقل</div></div><span class="chev">‹</span></div>
  ${group('🔬 الفحوصات', [navRow('tests', nextT ? `القادم لك: ${nextT.title}` : 'جدول الفحوصات من البداية للنهاية')])}
  ${group('🍎 الصحة والعافية', [navRow('food', 'المفيد والممنوع والعناصر المهمة'), navRow('exercise', 'تمارين آمنة لكل مرحلة')])}
  ${group('👶 المولود وما بعد الولادة', [navRow('names', 'اختاري واحفظي الأسماء المفضلة'), navRow('postpartum', 'النفاس والرضاعة والصحة النفسية')])}
  ${group('🧮 أدوات وأسئلة', [navRow('calc', 'احسبي موعد ولادة لأي تاريخ'), navRow('faq', 'إجابات لأكثر الأسئلة شيوعاً')])}`;
}

function viewMore() {
  const st = status();
  return `
  <div class="card"><h3>👤 بيانات الحمل</h3>
    <p class="muted" style="margin:0">موعد الولادة: <b>${fmt.format(st.due)}</b></p>
    <button class="btn ghost block" data-sub="profile" style="margin-top:10px">تعديل البيانات وطريقة الحساب</button></div>
  <div class="card"><h3>💾 النسخ الاحتياطي</h3>
    <p class="muted">بياناتك محفوظة على جهازك فقط. صدّريها للاحتفاظ بنسخة أو لنقلها لجهاز آخر.</p>
    <div class="row"><button class="btn grow" id="exportBtn">⬇️ تصدير</button>
      <label class="btn ghost grow center" style="cursor:pointer">⬆️ استيراد ملف<input type="file" id="importFile" accept=".json" hidden></label></div>
    <textarea id="backupBox" class="input" rows="4" placeholder="أو الصقي هنا نص النسخة الاحتياطية" dir="ltr" style="margin-top:10px"></textarea>
    <button class="btn ghost sm" id="pasteImport" style="margin-top:6px">استيراد من النص الملصق</button>
  </div>
  <div class="card"><h3>🎨 المظهر</h3><div class="seg" id="themeSeg">
    ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([k, v]) => `<button data-t="${k}" class="${S.theme === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
  <div class="card"><button class="btn danger block" id="resetBtn">🗑️ حذف جميع البيانات</button></div>
  <p class="disclaimer">${APP_NAME} · المعلومات الواردة للتثقيف العام ولا تغني عن استشارة طبيبك المختص.<br>في حالات الطوارئ اتصلي بالإسعاف فوراً.</p>`;
}

/* ---------- الشاشات الفرعية ---------- */
const SUBVIEWS = {
  kicks() {
    const s = S._kick;
    const hist = S.kicks.slice(-10).reverse();
    return `<div class="card center">
      <p class="muted">ابدئي العدّ في وقت يكون فيه الجنين نشطاً (بعد الأكل عادة)، واستلقي على جانبك الأيسر. الهدف: 10 حركات خلال ساعتين.</p>
      ${s ? `<div id="kickTime" class="muted">00:00</div>` : ''}
      <button class="counter-big" id="kickBtn">${s ? s.count : '▶'}<small>${s ? 'اضغطي عند كل حركة' : 'ابدئي العدّ'}</small></button>
      ${s ? `<div class="row" style="justify-content:center"><button class="btn ghost" id="kickUndo">تراجع</button><button class="btn" id="kickStop">إنهاء وحفظ</button></div>` : ''}
    </div>
    <div class="card"><h3>السجل</h3>${hist.length ? `<table class="t"><tr><th>التاريخ</th><th>الحركات</th><th>المدة</th></tr>
      ${hist.map(k => `<tr><td>${fmtShort.format(new Date(k.at))} ${new Date(k.at).toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</td><td>${k.count}</td><td>${Math.round(k.sec / 60)} د</td></tr>`).join('')}</table>`
      : '<p class="muted">لا توجد جلسات بعد.</p>'}</div>
    <div class="card warn-card"><b>⚠️ راجعي الطبيب</b> إذا لم تشعري بـ10 حركات خلال ساعتين، أو لاحظتِ انخفاضاً واضحاً في نشاط الجنين المعتاد.</div>`;
  },

  contractions() {
    const list = S.contractions.slice(-12);
    const active = list.length && !list[list.length - 1].end;
    const rows = list.map((c, i) => {
      const dur = c.end ? Math.round((c.end - c.start) / 1000) : null;
      const gap = i > 0 ? Math.round((c.start - list[i - 1].start) / 60000 * 10) / 10 : null;
      return { c, dur, gap };
    }).reverse();
    const done = rows.filter(r => r.dur && r.gap);
    const recent = done.slice(0, 6);
    const avgGap = recent.length ? recent.reduce((a, r) => a + r.gap, 0) / recent.length : 0;
    const avgDur = recent.length ? recent.reduce((a, r) => a + r.dur, 0) / recent.length : 0;
    const go511 = recent.length >= 6 && avgGap <= 5 && avgDur >= 45;
    return `<div class="card center">
      <p class="muted">اضغطي عند بداية الانقباض، واضغطي مرة أخرى عند انتهائه.</p>
      <button class="counter-big" id="ctrBtn" style="${active ? 'background:radial-gradient(circle,#ff8a80,#e53935)' : ''}">
        ${active ? '<span id="ctrTime">0</span>' : '▶'}<small>${active ? 'انتهى الانقباض' : 'بدأ الانقباض'}</small></button>
      ${recent.length ? `<div class="grid2"><div class="stat"><b>${avgGap.toFixed(1)} د</b><small>متوسط الفاصل</small></div>
        <div class="stat"><b>${Math.round(avgDur)} ث</b><small>متوسط المدة</small></div></div>` : ''}
      ${go511 ? `<div class="card warn-card" style="margin-top:12px"><b>🏥 الانقباضات منتظمة وقريبة — حان وقت التوجه للمستشفى!</b></div>` : ''}
    </div>
    <div class="card"><h3>السجل</h3>${rows.length ? `<table class="t"><tr><th>الوقت</th><th>المدة</th><th>الفاصل</th></tr>
      ${rows.map(r => `<tr><td>${new Date(r.c.start).toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</td><td>${r.dur != null ? r.dur + ' ث' : '…'}</td><td>${r.gap != null ? r.gap + ' د' : '—'}</td></tr>`).join('')}</table>
      <button class="btn ghost sm" id="ctrClear" style="margin-top:10px">مسح السجل</button>` : '<p class="muted">لا يوجد سجل.</p>'}</div>
    <div class="card"><b>قاعدة 5-1-1:</b> انقباض كل 5 دقائق، يستمر دقيقة، لمدة ساعة ← توجهي للمستشفى. (في الحمل الثاني فأكثر قد تحتاجين التوجه أبكر.)</div>`;
  },

  weight() {
    const p = S.profile, h = +p.height / 100, pre = +p.preWeight;
    const bmi = h && pre ? pre / (h * h) : null;
    const rng = !bmi ? [11.5, 16] : bmi < 18.5 ? [12.5, 18] : bmi < 25 ? [11.5, 16] : bmi < 30 ? [7, 11.5] : [5, 9];
    const cat = !bmi ? '' : bmi < 18.5 ? 'نحافة' : bmi < 25 ? 'طبيعي' : bmi < 30 ? 'زيادة وزن' : 'سمنة';
    const st = status();
    const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
    const last = ws[ws.length - 1];
    const gain = last && pre ? (last.kg - pre) : null;
    return `<div class="card">
      ${bmi ? `<div class="grid3"><div class="stat"><b>${bmi.toFixed(1)}</b><small>BMI قبل الحمل</small></div>
        <div class="stat"><b style="font-size:1rem">${cat}</b><small>التصنيف</small></div>
        <div class="stat"><b style="font-size:1rem">${rng[0]}–${rng[1]}</b><small>الزيادة الموصى بها (كغ)</small></div></div>`
        : `<p class="muted">أضيفي طولك ووزنك قبل الحمل من <a href="#" data-sub="profile">بيانات الحمل</a> لحساب الزيادة الموصى بها.</p>`}
      ${gain != null ? `<p class="center" style="margin:12px 0 0">زيادتك حتى الآن: <b>${gain.toFixed(1)} كغ</b></p>` : ''}
    </div>
    <div class="card"><h3>إضافة قياس</h3><div class="row">
      <input class="input grow" type="date" id="wDate" value="${iso(today())}" style="margin:0">
      <input class="input" type="number" step="0.1" inputmode="decimal" id="wKg" placeholder="كغ" style="width:90px;margin:0">
      <button class="btn" id="wAdd">إضافة</button></div></div>
    ${ws.length ? `<div class="card"><h3>المنحنى</h3>${weightChart(ws, pre, rng, st)}
      <table class="t">${ws.slice().reverse().map(x => `<tr><td>${fmtShort.format(parse(x.date))}</td><td>الأسبوع ${Math.floor(diffDays(parse(x.date), st.start) / 7) + 1}</td><td><b>${x.kg}</b> كغ</td><td><button class="btn sm ghost" data-delw="${x.date}">✕</button></td></tr>`).join('')}</table></div>` : ''}`;
  },

  appts() {
    const list = [...S.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const t = iso(today());
    return `<div class="card"><h3>موعد جديد</h3>
      <label class="f">العنوان<input id="aTitle" placeholder="مثال: متابعة د. منى / سونار"></label>
      <div class="grid2"><label class="f">التاريخ<input type="date" id="aDate" value="${t}"></label><label class="f">الوقت<input type="time" id="aTime"></label></div>
      <label class="f">ملاحظات / أسئلة للطبيب<textarea id="aNotes" rows="2"></textarea></label>
      <button class="btn block" id="aAdd">إضافة الموعد</button></div>
    <div class="card"><h3>مواعيدي</h3>${list.length ? list.map(a => `<div class="item-row">
      <input type="checkbox" data-apdone="${a.id}" ${a.done ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
      <div class="grow" style="${a.done ? 'opacity:.55;text-decoration:line-through' : ''}"><b>${esc(a.title)}</b>
        <div class="muted">${fmt.format(parse(a.date))} ${esc(a.time || '')} ${a.date < t && !a.done ? '· <span style="color:var(--warn)">فات</span>' : ''}</div>
        ${a.notes ? `<div style="font-size:.9rem">${esc(a.notes)}</div>` : ''}</div>
      <button class="btn sm ghost" data-apdel="${a.id}">✕</button></div>`).join('') : '<p class="muted">لا توجد مواعيد.</p>'}</div>
    <button class="btn ghost block" data-sub="tests">🔬 عرض جدول الفحوصات الموصى بها</button>`;
  },

  tests() {
    const st = status();
    return `<div class="card">${APPOINTMENTS.map(a => {
      const state = st.week > a.to ? 'past' : st.week >= a.from ? 'now' : 'next';
      return `<div class="item-row ${state === 'past' ? 'faded' : ''}"><div class="em">${state === 'past' ? '✅' : state === 'now' ? '⏰' : '🔬'}</div><div class="grow"><b>${a.title}</b>
        ${state === 'now' ? '<span class="badge">وقته الآن</span>' : ''}
        <div class="muted">الأسبوع ${a.from}${a.to !== a.from ? '–' + a.to : ''} · ${fmtShort.format(weekDate(st, a.from))}</div><div style="font-size:.9rem">${a.desc}</div></div></div>`;
    }).join('')}</div>`;
  },

  journal() {
    const t = iso(today());
    const e = S.journal.find(j => j.date === t) || { mood: '', symptoms: [], note: '' };
    const past = S.journal.filter(j => j.date !== t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    const st = status();
    return `<div class="card"><h3>كيف حالك اليوم؟</h3>
      <div class="chips" id="moods">${MOODS.map(m => `<button class="chip ${e.mood === m ? 'on' : ''}" data-mood="${m}" style="font-size:1.5rem">${m}</button>`).join('')}</div>
      <h3 style="margin-top:14px">الأعراض</h3>
      <div class="chips" id="syms">${SYMPTOMS_LIST.map(s => `<button class="chip ${e.symptoms.includes(s) ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</div>
      <label class="f" style="margin-top:14px">ملاحظات / رسالة لطفلك<textarea id="jNote" rows="3">${esc(e.note)}</textarea></label>
      <button class="btn block" id="jSave">حفظ يوميات اليوم</button></div>
    ${past.length ? `<div class="card"><h3>اليوميات السابقة</h3>${past.map(j => `<div class="item-row"><div class="em">${j.mood || '📝'}</div>
      <div><b>${fmt.format(parse(j.date))}</b> <span class="muted">· الأسبوع ${Math.floor(diffDays(parse(j.date), st.start) / 7) + 1}</span>
      ${j.symptoms.length ? `<div class="chips" style="margin:4px 0">${j.symptoms.map(s => `<span class="chip">${s}</span>`).join('')}</div>` : ''}
      ${j.note ? `<div style="font-size:.92rem">${esc(j.note)}</div>` : ''}</div></div>`).join('')}</div>` : ''}`;
  },

  bag() {
    const all = Object.values(HOSPITAL_BAG).flat();
    const n = all.filter(i => S.bag[i]).length;
    return `<div class="card"><p class="muted" style="margin-top:0">جهّزي الحقيبة بحلول الأسبوع 34–36.</p>
      <div class="row"><b>${n} / ${all.length}</b><div class="progress grow"><i style="width:${n / all.length * 100}%"></i></div></div></div>
      ${Object.entries(HOSPITAL_BAG).map(([g, items]) => `<div class="card"><h3>${g === 'للأم' ? '👩' : g === 'للمولود' ? '👶' : '🧑'} ${g}</h3>
        ${items.map(i => `<label class="check ${S.bag[i] ? 'done' : ''}"><input type="checkbox" data-bag="${esc(i)}" ${S.bag[i] ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>`).join('')}`;
  },

  water() {
    const t = iso(today()), n = S.water[t] || 0;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    return `<div class="card center"><h2>💧 ${n} / 10 أكواب</h2>
      <p class="muted">اشربي 8–12 كوباً يومياً (نحو 2.5–3 لترات). الماء يقلل الإمساك والتهاب المسالك والتورم.</p>
      <div class="water">${Array.from({ length: 12 }, (_, i) => `<button data-cup="${i + 1}" class="${i < n ? 'on' : ''}">🥛</button>`).join('')}</div></div>
      <div class="card"><h3>آخر 7 أيام</h3><div class="row" style="align-items:flex-end;height:120px;gap:6px">
      ${days.map(d => { const v = S.water[iso(d)] || 0; return `<div class="grow center"><div style="height:${Math.min(100, v * 9)}px;background:linear-gradient(var(--primary-2),var(--primary));border-radius:8px 8px 2px 2px"></div><small>${v}</small><br><small class="muted">${fmtShort.format(d).split(' ')[0]}</small></div>`; }).join('')}
      </div></div>`;
  },

  food() {
    const tab = route.tab || 'good';
    const rows = l => l.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('');
    return `<div class="seg" id="foodSeg">${[['good', '✅ مفيدة'], ['avoid', '⛔ تجنبيها'], ['nutrients', '💊 العناصر']].map(([k, v]) => `<button data-ft="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="card">${tab === 'nutrients'
        ? `<table class="t"><tr><th>العنصر</th><th>يومياً</th><th>الفائدة</th></tr>${FOODS.nutrients.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>`
        : rows(FOODS[tab])}</div>
      <div class="card"><h3>🍽️ نموذج يوم غذائي</h3><ul class="list">
        <li><b>الفطور:</b> بيض مسلوق + خبز أسمر + خضار + كوب حليب.</li>
        <li><b>سناك:</b> زبادي مع فاكهة أو 3 تمرات وحفنة مكسرات.</li>
        <li><b>الغداء:</b> أرز/برغل + دجاج أو سمك مطبوخ جيداً + سلطة خضراء.</li>
        <li><b>سناك:</b> فاكهة + جبن مبستر.</li>
        <li><b>العشاء:</b> عدس أو فول + خضار + لبن.</li></ul></div>`;
  },

  exercise() {
    return `<div class="card">${EXERCISES.map(([e, t, when, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b> <span class="badge soft">${when}</span><div class="muted">${d}</div></div></div>`).join('')}</div>
      <div class="card warn-card"><h3>⛔ توقفي فوراً عند:</h3><div class="chips">${EXERCISE_STOP.map(s => `<span class="chip">${s}</span>`).join('')}</div>
      <p class="muted">تجنبي الرياضات العنيفة أو التي فيها خطر السقوط أو الضرب على البطن. استشيري طبيبك قبل البدء.</p></div>`;
  },

  warnings() {
    return `<div class="card warn-card"><h2>🚨 اتصلي بطبيبك أو توجهي للطوارئ فوراً إذا لاحظتِ:</h2>
      ${WARNING_SIGNS.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</div>`;
  },

  names() {
    const g = route.tab || 'girl';
    return `<div class="seg" id="nameSeg"><button data-g="girl" class="${g === 'girl' ? 'on' : ''}">👧 بنات</button><button data-g="boy" class="${g === 'boy' ? 'on' : ''}">👦 أولاد</button><button data-g="fav" class="${g === 'fav' ? 'on' : ''}">❤️ المفضلة (${S.favNames.length})</button></div>
      <div class="card"><div class="chips">${(g === 'fav' ? S.favNames : BABY_NAMES[g]).map(n => `<button class="chip ${S.favNames.includes(n) ? 'on' : ''}" data-name="${esc(n)}">${S.favNames.includes(n) ? '❤️' : '🤍'} ${esc(n)}</button>`).join('') || '<p class="muted">اضغطي على القلب لإضافة أسماء.</p>'}</div></div>
      <div class="card"><div class="row"><input class="input grow" id="nmNew" placeholder="أضيفي اسماً خاصاً" style="margin:0"><button class="btn" id="nmAdd">إضافة</button></div></div>`;
  },

  calc() {
    return `<div class="card"><p class="muted" style="margin-top:0">احسبي موعد ولادة لأي تاريخ (لا يغير بياناتك).</p>
      <label class="f">أول يوم في آخر دورة<input type="date" id="cLmp"></label>
      <label class="f">طول الدورة<input type="number" id="cCycle" value="28"></label>
      <div id="cOut"></div></div>
      <div class="card"><h3>كيف يُحسب؟</h3><p>قاعدة نيجل: أول يوم من آخر دورة + سنة − 3 أشهر + 7 أيام (= 280 يوماً). يُضاف الفرق إذا كانت دورتك أطول أو أقصر من 28 يوماً.</p></div>`;
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
  </svg><p class="muted center" style="margin:0">المحور الأفقي: الأسبوع · المنطقة البنفسجية: النطاق الموصى به</p>`;
}

/* زر يتطلب ضغطتين للتأكيد (بديل confirm) */
function confirmTap(sel, fn) {
  let armed = false;
  return () => {
    const b = $(sel);
    if (armed) return fn();
    armed = true; const old = b.textContent; b.textContent = 'اضغطي مرة أخرى للتأكيد';
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
  if (strip) { const s = strip.querySelector('.sel'); if (s) s.scrollIntoView({ inline: 'center', block: 'nearest' }); }

  const on = (id, fn, ev = 'onclick') => { const el = $(id); if (el) el[ev] = fn; };
  const t = iso(today());

  // الرئيسية
  on('#vitToday', e => { S.vitamins[t] = e.target.checked; save(); render(false); }, 'onchange');
  on('#waterPlus', () => { S.water[t] = (S.water[t] || 0) + 1; save(); render(false); });
  on('#waterMinus', () => { S.water[t] = Math.max(0, (S.water[t] || 0) - 1); save(); render(false); });

  // المزيد
  on('#exportBtn', () => {
    const json = JSON.stringify(S, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rihlati-backup-${t}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {}
    const box = $('#backupBox'); box.hidden = false; box.value = json; box.select();
    navigator.clipboard?.writeText(json).then(() => toast('تم نسخ النسخة الاحتياطية 📋'), () => {});
  });
  on('#pasteImport', () => {
    try { const d = JSON.parse($('#backupBox').value); if (!d.profile) throw 0; S = Object.assign(defaults(), d); save(); toast('تم الاستيراد ✅'); render(); }
    catch { toast('النص غير صالح'); }
  });
  on('#importFile', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { const d = JSON.parse(txt); if (!d.profile) throw 0; S = Object.assign(defaults(), d); save(); toast('تم الاستيراد ✅'); render(); })
      .catch(() => toast('ملف غير صالح'));
  }, 'onchange');
  on('#resetBtn', confirmTap('#resetBtn', () => { S = defaults(); save(); route = { view: 'home' }; render(); }));
  app.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => { S.theme = b.dataset.t; save(); render(false); });

  if (route.sub === 'profile') bindSetup();

  // الركلات
  on('#kickBtn', () => {
    if (!S._kick) S._kick = { start: Date.now(), count: 0 }; else S._kick.count++;
    if (navigator.vibrate) navigator.vibrate(30);
    save(); render(false);
    if (S._kick.count === 10) toast('🎉 وصلتِ لـ10 حركات!');
  });
  on('#kickUndo', () => { S._kick.count = Math.max(0, S._kick.count - 1); save(); render(false); });
  on('#kickStop', () => { const k = S._kick; S.kicks.push({ at: k.start, count: k.count, sec: (Date.now() - k.start) / 1000 }); delete S._kick; save(); toast('تم الحفظ'); render(false); });
  if ($('#kickTime')) {
    const tick = () => { const s = Math.floor((Date.now() - S._kick.start) / 1000); $('#kickTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    tick(); timers.push(setInterval(tick, 1000));
  }

  // الانقباضات
  on('#ctrBtn', () => {
    const l = S.contractions, last = l[l.length - 1];
    if (last && !last.end) last.end = Date.now(); else l.push({ start: Date.now() });
    if (l.length > 100) l.splice(0, l.length - 100);
    save(); render(false);
  });
  on('#ctrClear', confirmTap('#ctrClear', () => { S.contractions = []; save(); render(false); }));
  if ($('#ctrTime')) {
    const last = S.contractions[S.contractions.length - 1];
    const tick = () => { $('#ctrTime').textContent = Math.floor((Date.now() - last.start) / 1000); };
    tick(); timers.push(setInterval(tick, 500));
  }

  // الوزن
  on('#wAdd', () => {
    const d = $('#wDate').value, kg = parseFloat($('#wKg').value);
    if (!d || !(kg > 25 && kg < 250)) return toast('أدخلي وزناً صحيحاً');
    S.weights = S.weights.filter(x => x.date !== d).concat({ date: d, kg }); save(); render(false);
  });
  app.querySelectorAll('[data-delw]').forEach(b => b.onclick = () => { S.weights = S.weights.filter(x => x.date !== b.dataset.delw); save(); render(false); });

  // المواعيد
  on('#aAdd', () => {
    const title = $('#aTitle').value.trim(), date = $('#aDate').value;
    if (!title || !date) return toast('أدخلي العنوان والتاريخ');
    S.appts.push({ id: Date.now().toString(36), title, date, time: $('#aTime').value, notes: $('#aNotes').value.trim(), done: false });
    save(); toast('تمت الإضافة'); render(false);
  });
  app.querySelectorAll('[data-apdone]').forEach(b => b.onchange = () => { const a = S.appts.find(x => x.id === b.dataset.apdone); a.done = b.checked; save(); render(false); });
  app.querySelectorAll('[data-apdel]').forEach(b => b.onclick = () => { S.appts = S.appts.filter(x => x.id !== b.dataset.apdel); save(); render(false); });

  // اليوميات
  app.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { app.querySelectorAll('[data-mood]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  app.querySelectorAll('[data-sym]').forEach(b => b.onclick = () => b.classList.toggle('on'));
  on('#jSave', () => {
    const mood = app.querySelector('[data-mood].on')?.dataset.mood || '';
    const symptoms = [...app.querySelectorAll('[data-sym].on')].map(b => b.dataset.sym);
    S.journal = S.journal.filter(j => j.date !== t).concat({ date: t, mood, symptoms, note: $('#jNote').value.trim() });
    save(); toast('تم الحفظ 💕'); render(false);
  });

  // الحقيبة
  app.querySelectorAll('[data-bag]').forEach(b => b.onchange = () => { S.bag[b.dataset.bag] = b.checked; save(); render(false); });

  // الماء
  app.querySelectorAll('[data-cup]').forEach(b => b.onclick = () => { const n = +b.dataset.cup; S.water[t] = S.water[t] === n ? n - 1 : n; save(); render(false); });

  // التغذية والأسماء
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { route.mode = b.dataset.mode; history.replaceState(route, ''); render(); });
  app.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { route.sec = b.dataset.sec; history.replaceState(route, ''); render(false); });
  on('#lblToggle', () => { route.labels = route.labels === false; history.replaceState(route, ''); render(false); });
  const lg = $('#legend'); if (lg) lg.ontoggle = () => { route.legend = lg.open; history.replaceState(route, ''); };
  app.querySelectorAll('#artSeg button').forEach(b => b.onclick = () => { route.art = b.dataset.art; history.replaceState(route, ''); render(false); });
  app.querySelectorAll('#foodSeg button').forEach(b => b.onclick = () => { route.tab = b.dataset.ft; render(false); });
  app.querySelectorAll('#nameSeg button').forEach(b => b.onclick = () => { route.tab = b.dataset.g; render(false); });
  app.querySelectorAll('[data-name]').forEach(b => b.onclick = () => {
    const n = b.dataset.name; S.favNames = S.favNames.includes(n) ? S.favNames.filter(x => x !== n) : S.favNames.concat(n); save(); render(false);
  });
  on('#nmAdd', () => { const n = $('#nmNew').value.trim(); if (n && !S.favNames.includes(n)) { S.favNames.push(n); save(); route.tab = 'fav'; render(false); } });

  // الحاسبة
  const calc = () => {
    const l = $('#cLmp').value; if (!l) return;
    const d = addDays(parse(l), 280 + ((+$('#cCycle').value || 28) - 28));
    const days = diffDays(today(), addDays(d, -280));
    $('#cOut').innerHTML = `<div class="card hero"><div class="muted">موعد الولادة المتوقع</div><h2 style="margin:4px 0">${fmt.format(d)}</h2>
      ${days >= 0 && days <= 300 ? `<span class="badge">عمر الحمل اليوم: ${Math.floor(days / 7)} أسبوع و${days % 7} يوم</span>` : ''}</div>`;
  };
  on('#cLmp', calc, 'oninput'); on('#cCycle', calc, 'oninput');
}

/* ---------- تشغيل ---------- */
history.replaceState(route, '');
render();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
