/* «موقعي» — واجهة المستخدم (عربي RTL، موبايل وويب) */
'use strict';

const LOGO = 'https://metal-lines.com/wp-content/uploads/2026/09/metal-lines-logo.png';
const COMPANY = 'شركة الخطوط المعدنية للمقاولات العامة';

const T = {
  att: { present: 'حاضر', late: 'متأخر', absent: 'غائب', leave: 'إجازة' },
  attColor: { present: 'green', late: 'amber', absent: 'red', leave: 'blue' },
  cat: { safety: 'سلامة', materials: 'نقص مواد', equipment: 'عطل معدات', subcontractor: 'تأخير مقاول باطن', other: 'أخرى' },
  sev: { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' },
  sevColor: { low: 'blue', medium: 'teal', high: 'amber', critical: 'red' },
  ist: { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' },
  istColor: { open: 'red', in_progress: 'amber', closed: 'green' },
  pst: { active: 'نشط', paused: 'متوقف', done: 'منتهي' },
  aff: { company: 'الشركة', sub: 'مقاول باطن' },
  wage: { daily: 'يومي', monthly: 'شهري' },
  party: { client: 'المالك/العميل', subcontractor: 'مقاول باطن', supplier: 'مورد' },
  inv: { draft: 'مسودة', submitted: 'بانتظار الاعتماد', approved: 'معتمد — جاهز للصرف', rejected: 'مرفوض', partially_paid: 'مصروف جزئياً', paid: 'مصروف بالكامل' },
  invColor: { draft: '', submitted: 'amber', approved: 'blue', rejected: 'red', partially_paid: 'teal', paid: 'green' },
  pay: { transfer: 'تحويل بنكي', cheque: 'شيك', cash: 'نقدي' },
  weather: ['مشمس', 'غائم', 'ممطر', 'رياح/غبار', 'حار جداً'],
};

const S = {
  token: localStorage.getItem('mw_token'),
  user: null, perms: [], roles: {},
  get can() { return (a) => S.perms.includes(a); },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('ar-SA-u-nu-latn', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n) => `${fmt(n, 2)} ر.س`;
const pill = (text, color = '') => `<span class="pill ${color}">${esc(text)}</span>`;
const progress = (v) => `<div class="row" style="gap:.4rem;flex-wrap:nowrap"><div class="progress" style="flex:1"><i style="width:${Math.min(100, Math.max(0, v || 0))}%"></i></div><span class="small">${fmt(v)}%</span></div>`;
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const dt = (iso) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const initials = (n) => esc(String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(''));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
const withToken = (url) => url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(S.token);
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), type === 'err' ? 5000 : 3000);
}

class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

// استدعاء الخادم؛ مع queue تُحفظ العملية للمزامنة لاحقاً إذا لم يتوفر اتصال
async function api(path, { method = 'GET', body, form, queue } = {}) {
  const opts = { method, headers: {} };
  if (S.token) opts.headers.Authorization = 'Bearer ' + S.token;
  if (form) opts.body = form;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try {
    if (queue && !navigator.onLine) throw new TypeError('offline');
    res = await fetch('/api' + path, opts);
  } catch (e) {
    if (queue) {
      await Offline.enqueue({ url: '/api' + path, method, body, form, label: queue });
      return { queued: true };
    }
    throw new ApiError(0, 'لا يوجد اتصال بالإنترنت');
  }
  if (res.status === 503 && queue) {
    await Offline.enqueue({ url: '/api' + path, method, body, form, label: queue });
    return { queued: true };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { logout(true); throw new ApiError(401, data.error); }
  if (!res.ok) throw new ApiError(res.status, data.error || 'حدث خطأ');
  return data;
}

async function download(path, filename) {
  try {
    const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + S.token } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'تعذر التصدير');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { toast(e.message, 'err'); }
}

const openPrint = (path) => window.open(withToken('/api' + path), '_blank');

function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('الجهاز لا يدعم تحديد الموقع'));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => rej(new Error('تعذر تحديد الموقع — فعّل GPS واسمح للتطبيق باستخدامه')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

function modal(html, onMount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  if (onMount) onMount(bg, close);
  return close;
}

function confirmBox(text) {
  return new Promise((res) => {
    modal(`<h3>${esc(text)}</h3><div class="row" style="margin-top:1rem"><button class="btn" id="cy">تأكيد</button><button class="btn light" data-close>إلغاء</button></div>`,
      (m, close) => {
        $('#cy', m).onclick = () => { close(); res(true); };
        m.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === m) res(false); });
      });
  });
}

// يحوّل عناصر النموذج إلى كائن
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'file') continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value;
  }
  return o;
}

function opts(list, sel, empty) {
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

let cache = {};
async function cached(key, fn) {
  if (!cache[key]) cache[key] = fn().catch((e) => { delete cache[key]; throw e; });
  return cache[key];
}
const projectsList = () => cached('projects', () => api('/projects'));
const usersList = () => cached('users', () => api('/users'));
const subsList = () => cached('subs', () => api('/subcontractors'));

// ---------------------------------------------------------------- الهيكل والتنقل
const NAV = [
  { href: '#/', ico: '📊', t: 'لوحة التحكم', show: () => true, mobile: true },
  { href: '#/projects', ico: '🏗️', t: 'المشاريع', show: () => true, mobile: true },
  { href: '#/attendance', ico: '✅', t: 'الحضور', show: () => true, mobile: true },
  { href: '#/workers', ico: '👷', t: 'العمال', show: () => true },
  { href: '#/reports', ico: '📝', t: 'التقارير اليومية', show: () => true, mobile: true },
  { href: '#/issues', ico: '⚠️', t: 'المشاكل والبلاغات', show: () => true, mobile: true },
  { href: '#/invoices', ico: '🧾', t: 'المستخلصات', show: () => S.can('invoices.view') },
  { href: '#/exports', ico: '📤', t: 'التقارير والتصدير', show: () => true },
  { href: '#/users', ico: '👥', t: 'المستخدمون', show: () => S.can('users.manage') },
  { href: '#/settings', ico: '⚙️', t: 'الإعدادات', show: () => S.can('settings.manage') },
];

function shell() {
  const nav = NAV.filter((n) => n.show());
  $('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><img class="logo" src="${LOGO}" alt="" onerror="this.style.display='none'">
      <div style="min-width:0"><b>موقعي</b><small>${esc(COMPANY)}</small></div></div>
    <button class="sync hide" id="syncBtn"></button>
    <button class="iconbtn" id="bell" title="الإشعارات">🔔<span class="badge hide" id="bellN"></span></button>
    <button class="iconbtn" id="userBtn" title="الحساب">👤</button>
  </header>
  <div class="layout">
    <nav class="sidenav">${nav.map((n) => `<a href="${n.href}"><span class="ico">${n.ico}</span>${n.t}</a>`).join('')}
      <div class="muted small" style="padding:1rem .8rem">${esc(S.user.name)}<br>${esc(S.roles[S.user.role])}</div></nav>
    <main id="main"></main>
  </div>
  <nav class="bottomnav">${nav.filter((n) => n.mobile).map((n) => `<a href="${n.href}"><span class="ico">${n.ico}</span>${n.t.split(' ')[0]}</a>`).join('')}
    <a href="#/more"><span class="ico">☰</span>المزيد</a></nav>`;
  $('#bell').onclick = () => (location.hash = '#/notifications');
  $('#userBtn').onclick = () => modal(`<h3>${esc(S.user.name)}</h3><p class="muted">${esc(S.roles[S.user.role])} — ${esc(S.user.username)}</p>
    <button class="btn block light" id="pushBtn">🔔 تفعيل الإشعارات على هذا الجهاز</button>
    <button class="btn block red" style="margin-top:.6rem" id="logoutBtn">تسجيل الخروج</button>`, (m) => {
    $('#logoutBtn', m).onclick = () => logout();
    $('#pushBtn', m).onclick = () => enablePush();
  });
  $('#syncBtn').onclick = () => syncNow(true);
  Offline.changed = updateSync;
  updateSync();
  pollNotifications();
}

async function updateSync() {
  const b = $('#syncBtn');
  if (!b) return;
  const n = await Offline.count().catch(() => 0);
  const off = !navigator.onLine;
  b.classList.toggle('hide', !n && !off);
  b.classList.toggle('offline', off);
  b.textContent = off ? `بدون اتصال${n ? ` • ${n} بانتظار المزامنة` : ''}` : `${n} بانتظار المزامنة ⟳`;
}

async function syncNow(manual) {
  const r = await Offline.sync(S.token);
  if (r.sent) toast(`تمت مزامنة ${r.sent} عملية`, 'ok');
  while (Offline.failures.length) {
    const f = Offline.failures.shift();
    toast(`تعذر حفظ «${f.label}»: ${f.error}`, 'err');
  }
  if (manual && !r.sent && !navigator.onLine) toast('لا يوجد اتصال حالياً', 'err');
  if (r.sent) { cache = {}; route(); }
}
window.addEventListener('online', () => { updateSync(); syncNow(); });
window.addEventListener('offline', updateSync);
setInterval(() => S.token && syncNow(), 30000);

let lastUnread = -1;
async function pollNotifications() {
  if (!S.token) return;
  try {
    const n = await api('/notifications');
    const b = $('#bellN');
    if (b) { b.textContent = n.unread; b.classList.toggle('hide', !n.unread); }
    if (lastUnread >= 0 && n.unread > lastUnread && n.rows[0] && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(n.rows[0].title, { body: n.rows[0].body, icon: '/icon.svg', dir: 'rtl' });
    }
    lastUnread = n.unread;
  } catch { /* بدون اتصال */ }
}
setInterval(pollNotifications, 60000);

async function enablePush() {
  try {
    if (!('Notification' in window)) throw new Error('المتصفح لا يدعم الإشعارات');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('لم يتم السماح بالإشعارات');
    const reg = await navigator.serviceWorker.ready;
    if (reg.pushManager) {
      const { key } = await api('/push/key');
      const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
      await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    }
    toast('تم تفعيل الإشعارات', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

function logout(silent) {
  if (!silent && S.token) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token } }).catch(() => {});
  S.token = null;
  S.user = null;
  localStorage.removeItem('mw_token');
  localStorage.removeItem('mw_me');
  document.querySelectorAll('.modal-bg').forEach((m) => m.remove());
  loginView();
}

function loginView() {
  $('#app').innerHTML = `<div class="login"><form class="card" id="loginForm">
    <img class="logo" src="${LOGO}" alt="${esc(COMPANY)}" onerror="this.style.display='none'">
    <h1 class="center" style="margin-bottom:.2rem">موقعي</h1>
    <p class="center muted" style="margin-top:0">${esc(COMPANY)}</p>
    <label>اسم المستخدم</label><input name="username" autocomplete="username" required autocapitalize="off">
    <label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required>
    <button class="btn block teal" style="margin-top:1.2rem">دخول</button>
    <p class="muted small center" id="loginErr"></p></form></div>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: formData(e.target) });
      S.token = r.token;
      localStorage.setItem('mw_token', r.token);
      await boot();
    } catch (err) { $('#loginErr').textContent = err.message; }
  };
}

const ROUTES = [];
const on = (re, fn) => ROUTES.push([re, fn]);

async function route() {
  if (!S.user) return;
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  const q = Object.fromEntries(new URLSearchParams(query));
  $$('.sidenav a, .bottomnav a').forEach((a) => {
    const h = a.getAttribute('href').slice(1);
    a.classList.toggle('active', h === '/' ? path === '/' : path.startsWith(h));
  });
  const main = $('#main');
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      main.innerHTML = '<div class="empty">جارٍ التحميل…</div>';
      try {
        await fn(main, m.slice(1), q);
      } catch (e) {
        main.innerHTML = `<div class="alert danger">${esc(e.message)}</div>`;
      }
      window.scrollTo(0, 0);
      return;
    }
  }
  main.innerHTML = '<div class="empty">الصفحة غير موجودة</div>';
}
window.addEventListener('hashchange', route);

async function boot() {
  try {
    const me = await api('/me');
    localStorage.setItem('mw_me', JSON.stringify(me));
    Object.assign(S, { user: me.user, perms: me.permissions, roles: me.roles });
  } catch (e) {
    const saved = localStorage.getItem('mw_me');
    if (e.status === 0 && saved) Object.assign(S, (({ user, permissions, roles }) => ({ user, perms: permissions, roles }))(JSON.parse(saved)));
    else return loginView();
  }
  cache = {};
  shell();
  route();
}

on(/^\/more$/, async (main) => {
  main.innerHTML = `<h1>المزيد</h1><div class="list">${NAV.filter((n) => n.show()).map((n) => `<a class="item" href="${n.href}"><span style="font-size:1.4rem">${n.ico}</span><div class="main t">${n.t}</div><span>‹</span></a>`).join('')}</div>`;
});

on(/^\/notifications$/, async (main) => {
  const n = await api('/notifications');
  main.innerHTML = `<div class="row"><h1>الإشعارات</h1><span class="spacer"></span>${n.unread ? '<button class="btn sm light" id="readAll">تحديد الكل كمقروء</button>' : ''}</div>
    <div class="list">${n.rows.map((r) => `<a class="item" href="${esc(r.link || '#/')}" data-id="${r.id}" style="${r.read ? 'opacity:.65' : 'border-right:4px solid var(--teal)'}">
      <div class="main"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.body)}</div><div class="s">${dt(r.created_at)}</div></div></a>`).join('') || '<div class="empty">لا توجد إشعارات</div>'}</div>`;
  $$('.item[data-id]', main).forEach((a) => a.addEventListener('click', () => api('/notifications/read', { method: 'POST', body: { id: a.dataset.id } }).then(pollNotifications)));
  const ra = $('#readAll');
  if (ra) ra.onclick = async () => { await api('/notifications/read', { method: 'POST', body: {} }); pollNotifications(); route(); };
});

// ---------------------------------------------------------------- لوحة التحكم
const charts = [];
function chart(canvas, cfg) {
  if (!window.Chart) return;
  while (charts.length) charts.pop().destroy();
  Chart.defaults.font.family = "'Tajawal','Segoe UI',Tahoma,sans-serif";
  charts.push(new Chart(canvas, cfg));
}
function addChart(canvas, cfg) {
  if (!window.Chart) return;
  charts.push(new Chart(canvas, cfg));
}

on(/^\/$/, async (main) => {
  const d = await api('/dashboard');
  while (charts.length) charts.pop().destroy();
  const c = d.cards;
  const showCost = c.cost_today !== undefined;
  main.innerHTML = `
    <div class="row"><h1>لوحة التحكم</h1><span class="spacer"></span><span class="muted">${esc(d.date)}</span></div>
    <div class="cards">
      <div class="stat"><div class="v">${fmt(c.total_workers)}</div><div class="l">إجمالي العمال</div></div>
      <div class="stat green"><div class="v">${fmt(c.present_today)}</div><div class="l">الحاضرون اليوم${c.late_today ? ` (${fmt(c.late_today)} متأخر)` : ''}</div></div>
      <div class="stat red"><div class="v">${fmt(c.absent_today)}</div><div class="l">الغائبون${c.not_recorded ? ` • ${fmt(c.not_recorded)} لم يُحضَّروا` : ''}</div></div>
      <div class="stat amber"><a href="#/issues?open=1"><div class="v">${fmt(c.open_issues)}</div><div class="l">المشاكل المفتوحة</div></a></div>
      ${showCost ? `<div class="stat teal"><div class="v" style="font-size:1.5rem">${money(c.cost_today)}</div><div class="l">تكلفة العمالة اليوم</div></div>` : ''}
      ${d.invoices_pending !== undefined ? `<div class="stat"><a href="#/invoices"><div class="v">${fmt(d.invoices_pending)}</div><div class="l">مستخلصات قيد الاعتماد/الصرف</div></a></div>` : ''}
    </div>
    ${d.alerts.length ? `<div class="card"><h3>🔔 التنبيهات (${d.alerts.length})</h3>${d.alerts.slice(0, 12).map((a) => `<a class="alert ${a.level}" href="${esc(a.link)}">${a.level === 'danger' ? '⛔' : '⚠️'} ${esc(a.text)}</a>`).join('')}
      ${d.alerts.length > 12 ? `<p class="muted small">و${d.alerts.length - 12} تنبيهات أخرى</p>` : ''}</div>` : '<div class="alert ok">✓ لا توجد تنبيهات</div>'}
    <h2>المشاريع</h2>
    <div class="tablewrap"><table><thead><tr><th>المشروع</th><th>الحضور / المخطط</th><th>الإنجاز</th><th>مشاكل</th>${showCost ? '<th>تكلفة اليوم</th>' : ''}</tr></thead><tbody>
      ${d.projects.map((p) => {
        const low = p.planned_workers && p.present_today < p.planned_workers * 0.8;
        return `<tr class="click" data-href="#/projects/${p.id}"><td><b>${esc(p.name)}</b><div class="muted small">${esc(p.location_name || '')}</div></td>
        <td>${pill(`${p.present_today} / ${p.planned_workers}`, low ? 'red' : 'green')}</td><td style="min-width:120px">${progress(p.progress)}</td>
        <td>${p.open_issues ? pill(p.open_issues, 'amber') : '—'}</td>${showCost ? `<td>${money(p.cost_today)}</td>` : ''}</tr>`;
      }).join('') || '<tr><td colspan="5" class="empty">لا توجد مشاريع</td></tr>'}</tbody></table></div>
    <div class="grid2">
      <div class="card"><h3>الحضور خلال 30 يوماً</h3><div class="chartbox"><canvas id="chAtt"></canvas></div></div>
      ${showCost ? '<div class="card"><h3>تكلفة العمالة لكل مشروع (هذا الشهر)</h3><div class="chartbox"><canvas id="chCost"></canvas></div></div>' : ''}
    </div>`;
  $$('tr[data-href]', main).forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.href)));
  addChart($('#chAtt'), {
    type: 'line',
    data: {
      labels: d.attendance_series.map((r) => r.date.slice(5)),
      datasets: [
        { label: 'حاضر', data: d.attendance_series.map((r) => r.present), borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,.12)', fill: true, tension: .3 },
        { label: 'غائب', data: d.attendance_series.map((r) => r.absent), borderColor: '#C62828', backgroundColor: 'rgba(198,40,40,.08)', fill: true, tension: .3 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { rtl: true, position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  });
  if (showCost) {
    addChart($('#chCost'), {
      type: 'bar',
      data: { labels: d.cost_by_project.map((p) => p.name), datasets: [{ label: 'التكلفة (ر.س)', data: d.cost_by_project.map((p) => p.cost_month), backgroundColor: '#2E7D7A', borderRadius: 6 }] },
      options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } },
    });
  }
});

// ---------------------------------------------------------------- المشاريع
on(/^\/projects$/, async (main, _, q) => {
  const rows = await api('/projects?' + qs({ q: q.q, status: q.status }));
  cache.projects = Promise.resolve(rows);
  const showCost = rows[0] && rows[0].cost_today !== undefined;
  main.innerHTML = `<div class="row"><h1>المشاريع</h1><span class="spacer"></span>${S.can('projects.create') ? '<a class="btn teal" href="#/projects/new">+ مشروع جديد</a>' : ''}</div>
    <form class="filters" id="f"><input name="q" placeholder="بحث بالاسم أو الموقع" value="${esc(q.q || '')}">
      <select name="status">${opts(Object.entries(T.pst), q.status, 'كل الحالات')}</select></form>
    <div class="list">${rows.map((p) => `<a class="item" href="#/projects/${p.id}">
      <div class="avatar">🏗️</div><div class="main"><div class="t">${esc(p.name)} ${p.status !== 'active' ? pill(T.pst[p.status]) : ''}</div>
      <div class="s">${esc(p.location_name || '')} • المشرف: ${esc(p.supervisor_name || '—')}</div>
      <div class="row small" style="margin-top:.3rem">${pill(`حضور ${p.present_today}/${p.planned_workers}`, p.planned_workers && p.present_today < p.planned_workers * 0.8 ? 'red' : 'green')}
      ${p.open_issues ? pill(`${p.open_issues} مشاكل`, 'amber') : ''}${showCost ? pill(`اليوم ${money(p.cost_today)}`, 'teal') : ''}</div></div>
      <div style="width:110px">${progress(p.progress)}</div></a>`).join('') || '<div class="empty">لا توجد مشاريع</div>'}</div>`;
  const f = $('#f');
  let t;
  f.oninput = () => { clearTimeout(t); t = setTimeout(() => (location.hash = '#/projects?' + qs(formData(f))), 400); };
});

on(/^\/projects\/(\d+)$/, async (main, [id], q) => {
  const p = await api(`/projects/${id}`);
  const tab = q.tab || 'overview';
  const showCost = p.cost_today !== undefined;
  const canEdit = S.can('projects.edit');
  main.innerHTML = `
    <div class="row"><h1>${esc(p.name)}</h1><span class="spacer"></span>
      ${canEdit ? `<a class="btn light sm" href="#/projects/${p.id}/edit">✏️ تعديل</a>` : ''}
      <button class="btn light sm" id="printDay">🖨️ تقرير اليوم PDF</button></div>
    <div class="cards">
      <div class="stat ${p.planned_workers && p.present_today < p.planned_workers * 0.8 ? 'red' : 'green'}"><div class="v">${p.present_today} / ${p.planned_workers}</div><div class="l">الحاضرون اليوم / المخطط</div></div>
      <div class="stat teal"><div class="v">${fmt(p.progress)}%</div><div class="l">نسبة الإنجاز</div>${progress(p.progress)}</div>
      <div class="stat amber"><div class="v">${p.open_issues}</div><div class="l">مشاكل مفتوحة</div></div>
      ${showCost ? `<div class="stat"><div class="v" style="font-size:1.3rem">${money(p.cost_today)}</div><div class="l">تكلفة العمالة اليوم</div></div>
      <div class="stat"><div class="v" style="font-size:1.3rem">${money(p.cost_month)}</div><div class="l">تكلفة العمالة هذا الشهر</div></div>` : ''}
    </div>
    <div class="tabs">${[['overview', 'نظرة عامة'], ['workers', `العمال (${p.workers.length})`], ['issues', 'المشاكل'], ['reports', 'التقارير'], ...(S.can('invoices.view') ? [['invoices', 'المستخلصات']] : [])]
      .map(([k, t]) => `<a href="#/projects/${p.id}?tab=${k}" class="${tab === k ? 'active' : ''}">${t}</a>`).join('')}</div>
    <div id="tabBody"></div>`;
  $('#printDay').onclick = () => openPrint(`/projects/${p.id}/daily-print?date=${todayStr()}`);
  const body = $('#tabBody');
  if (tab === 'overview') {
    body.innerHTML = `<div class="grid2"><div class="card"><div class="kv">
      <b>الموقع</b><span>${esc(p.location_name || '—')}</span><b>مدير المشروع</b><span>${esc(p.manager_name || '—')}</span>
      <b>المشرف</b><span>${esc(p.supervisor_name || '—')}</span><b>البداية</b><span>${esc(p.start_date || '—')}</span>
      <b>النهاية</b><span>${esc(p.end_date || '—')}</span><b>النطاق الجغرافي</b><span>${p.radius_m} متر</span>
      ${p.contract_value !== undefined ? `<b>قيمة العقد</b><span>${money(p.contract_value)}</span>` : ''}
      <b>الحالة</b><span>${T.pst[p.status]}</span></div></div>
      <div class="card"><div id="pmap" class="map"></div></div></div>
      <div class="card"><h3>الحضور خلال 30 يوماً</h3><div class="chartbox"><canvas id="pch"></canvas></div></div>`;
    showMap($('#pmap'), p);
    const a = await api(`/attendance/daily?project_id=${p.id}`);
    while (charts.length) charts.pop().destroy();
    addChart($('#pch'), { type: 'bar', data: { labels: a.rows.map((r) => r.date.slice(5)), datasets: [
      { label: 'حاضر', data: a.rows.map((r) => r.present), backgroundColor: '#2E7D32' },
      { label: 'غائب', data: a.rows.map((r) => r.absent), backgroundColor: '#C62828' }] },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { rtl: true, position: 'bottom' } } } });
  } else if (tab === 'workers') {
    body.innerHTML = `<div class="row" style="margin-bottom:.8rem"><a class="btn teal" href="#/attendance?project_id=${p.id}">✅ تحضير العمال</a>
      ${S.can('workers.manage') ? `<a class="btn light" href="#/workers/new?project_id=${p.id}">+ عامل</a>` : ''}</div>
      <div class="list">${p.workers.map((w) => `<a class="item" href="#/workers/${w.id}"><div class="avatar">${initials(w.name)}</div>
      <div class="main"><div class="t">${esc(w.name)}</div><div class="s">${esc(w.profession || '')} • ${esc(w.nationality || '')}</div></div>
      ${w.today_status ? pill(T.att[w.today_status], T.attColor[w.today_status]) : pill('لم يُحضَّر')}</a>`).join('') || '<div class="empty">لا يوجد عمال</div>'}</div>`;
  } else if (tab === 'issues') {
    body.innerHTML = `<a class="btn teal" href="#/issues/new?project_id=${p.id}">+ بلاغ جديد</a><div id="il" style="margin-top:.8rem"></div>`;
    renderIssueList($('#il'), await api(`/issues?project_id=${p.id}`));
  } else if (tab === 'reports') {
    body.innerHTML = `${S.can('reports.create') ? `<a class="btn teal" href="#/reports/new?project_id=${p.id}">+ تقرير يومي</a>` : ''}<div id="rl" style="margin-top:.8rem"></div>`;
    renderReportList($('#rl'), await api(`/reports?project_id=${p.id}`));
  } else if (tab === 'invoices') {
    body.innerHTML = `${S.can('invoices.edit') ? `<a class="btn teal" href="#/invoices/new?project_id=${p.id}">+ مستخلص جديد</a>` : ''}<div id="vl" style="margin-top:.8rem"></div>`;
    renderInvoiceList($('#vl'), await api(`/invoices?project_id=${p.id}`));
  }
});

function showMap(el, p) {
  if (!window.L || !navigator.onLine) { el.innerHTML = `<div class="empty">📍 ${p.lat}, ${p.lng}</div>`; return; }
  const m = L.map(el).setView([p.lat, p.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  L.marker([p.lat, p.lng]).addTo(m);
  L.circle([p.lat, p.lng], { radius: p.radius_m, color: '#2E7D7A' }).addTo(m);
}

on(/^\/projects\/(new|\d+\/edit)$/, async (main, [mode]) => {
  const isNew = mode === 'new';
  const id = isNew ? null : mode.split('/')[0];
  const [p, users] = await Promise.all([isNew ? {} : api(`/projects/${id}`), usersList()]);
  const pms = users.filter((u) => u.role === 'pm' && u.active !== false).map((u) => [u.id, u.name]);
  const sups = users.filter((u) => u.role === 'supervisor' && u.active !== false).map((u) => [u.id, u.name]);
  const gmLike = S.can('projects.create');
  main.innerHTML = `<h1>${isNew ? 'مشروع جديد' : 'تعديل المشروع'}</h1><form class="card" id="pf">
    <div class="form-grid">
      <div><label>اسم المشروع *</label><input name="name" required value="${esc(p.name || '')}"></div>
      <div><label>وصف الموقع</label><input name="location_name" value="${esc(p.location_name || '')}" placeholder="المدينة — الحي"></div>
      <div><label>تاريخ البداية</label><input type="date" name="start_date" value="${esc(p.start_date || '')}"></div>
      <div><label>تاريخ النهاية</label><input type="date" name="end_date" value="${esc(p.end_date || '')}"></div>
      <div><label>عدد العمال المخطط</label><input type="number" min="0" name="planned_workers" value="${p.planned_workers ?? 10}"></div>
      <div><label>نسبة الإنجاز %</label><input type="number" min="0" max="100" step="0.5" name="progress" value="${p.progress ?? 0}"></div>
      ${gmLike ? `<div><label>مدير المشروع</label><select name="manager_id">${opts(pms, p.manager_id, '— بدون —')}</select></div>
      <div><label>قيمة العقد (ر.س)</label><input type="number" min="0" step="0.01" name="contract_value" value="${p.contract_value ?? 0}"></div>` : ''}
      <div><label>المشرف المسؤول</label><select name="supervisor_id">${opts(sups, p.supervisor_id, '— بدون —')}</select></div>
      <div><label>الحالة</label><select name="status">${opts(Object.entries(T.pst), p.status || 'active')}</select></div>
      <div><label>نطاق المشروع (Geofence) بالمتر</label><input type="number" min="20" max="20000" name="radius_m" value="${p.radius_m ?? 300}"></div>
      <div><label>الإحداثيات</label><div class="row" style="flex-wrap:nowrap"><input name="lat" placeholder="خط العرض" value="${p.lat ?? ''}" required><input name="lng" placeholder="خط الطول" value="${p.lng ?? ''}" required></div></div>
    </div>
    <div class="row" style="margin:.6rem 0"><button type="button" class="btn light sm" id="myLoc">📍 موقعي الحالي</button><span class="muted small">أو اضغط على الخريطة لتحديد موقع المشروع</span></div>
    <div id="emap" class="map"></div>
    <div class="row" style="margin-top:1rem"><button class="btn teal">حفظ</button><a class="btn light" href="${isNew ? '#/projects' : `#/projects/${id}`}">إلغاء</a></div></form>`;
  const f = $('#pf');
  let m, marker, circle;
  const place = () => {
    const lat = Number(f.lat.value), lng = Number(f.lng.value), r = Number(f.radius_m.value) || 300;
    if (!m || !lat || !lng) return;
    if (marker) { marker.setLatLng([lat, lng]); circle.setLatLng([lat, lng]).setRadius(r); } else {
      marker = L.marker([lat, lng]).addTo(m);
      circle = L.circle([lat, lng], { radius: r, color: '#2E7D7A' }).addTo(m);
    }
  };
  if (window.L && navigator.onLine) {
    m = L.map($('#emap')).setView([p.lat || 24.7136, p.lng || 46.6753], p.lat ? 15 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    m.on('click', (e) => { f.lat.value = e.latlng.lat.toFixed(6); f.lng.value = e.latlng.lng.toFixed(6); place(); });
    place();
  } else $('#emap').innerHTML = '<div class="empty">الخريطة غير متاحة بدون اتصال — أدخل الإحداثيات يدوياً</div>';
  f.radius_m.oninput = f.lat.oninput = f.lng.oninput = place;
  $('#myLoc').onclick = async () => {
    try {
      const pos = await getPosition();
      f.lat.value = pos.lat.toFixed(6); f.lng.value = pos.lng.toFixed(6);
      place(); if (m) m.setView([pos.lat, pos.lng], 16);
    } catch (e) { toast(e.message, 'err'); }
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api(isNew ? '/projects' : `/projects/${id}`, { method: isNew ? 'POST' : 'PUT', body: formData(f) });
      delete cache.projects;
      toast('تم الحفظ', 'ok');
      location.hash = `#/projects/${r.id}`;
    } catch (err) { toast(err.message, 'err'); }
  };
});

// ---------------------------------------------------------------- العمال
const workerAvatar = (w) => `<div class="avatar">${w.has_photo ? `<img src="${withToken(`/api/workers/${w.id}/photo`)}" alt="" loading="lazy">` : initials(w.name)}</div>`;

on(/^\/workers$/, async (main, _, q) => {
  const [rows, projects, subs] = await Promise.all([api('/workers?' + qs(q)), projectsList(), subsList()]);
  const nats = [...new Set(rows.map((w) => w.nationality).filter(Boolean))].sort();
  const profs = [...new Set(rows.map((w) => w.profession).filter(Boolean))].sort();
  main.innerHTML = `<div class="row"><h1>العمال <span class="muted small">(${rows.length})</span></h1><span class="spacer"></span>
    ${S.can('workers.manage') ? '<a class="btn teal" href="#/workers/new">+ عامل جديد</a>' : ''}</div>
    <form class="filters" id="f"><input name="q" placeholder="بحث بالاسم أو الإقامة أو المهنة" value="${esc(q.q || '')}">
      <select name="project_id">${opts(projects.map((p) => [p.id, p.name]), q.project_id, 'كل المشاريع')}</select>
      <select name="affiliation">${opts(Object.entries(T.aff), q.affiliation, 'كل الجهات')}</select>
      <select name="subcontractor_id">${opts(subs.map((s) => [s.id, s.name]), q.subcontractor_id, 'كل المقاولين')}</select>
      <select name="nationality">${opts(nats.map((n) => [n, n]), q.nationality, 'كل الجنسيات')}</select>
      <select name="profession">${opts(profs.map((n) => [n, n]), q.profession, 'كل المهن')}</select>
      <select name="iqama_expiring">${opts([['1', 'إقامات تنتهي خلال 30 يوماً']], q.iqama_expiring, 'كل الإقامات')}</select></form>
    <div class="list">${rows.map((w) => `<a class="item" href="#/workers/${w.id}">${workerAvatar(w)}
      <div class="main"><div class="t">${esc(w.name)}</div><div class="s">${esc(w.profession || '')} • ${esc(w.nationality || '')} • ${esc(w.project_name || 'غير معيّن')}</div>
      <div class="s">${w.affiliation === 'sub' ? esc(w.subcontractor_name) : 'الشركة'}${w.wage !== undefined ? ` • ${money(w.wage)} ${T.wage[w.wage_type]}` : ''}</div></div>
      ${w.iqama_days_left !== undefined && w.iqama_days_left <= 30 ? pill(w.iqama_days_left < 0 ? 'إقامة منتهية' : `الإقامة: ${w.iqama_days_left} يوم`, w.iqama_days_left < 0 ? 'red' : 'amber') : ''}</a>`).join('') || '<div class="empty">لا يوجد عمال</div>'}</div>`;
  const f = $('#f');
  let t;
  f.oninput = () => { clearTimeout(t); t = setTimeout(() => (location.hash = '#/workers?' + qs(formData(f))), 400); };
});

on(/^\/workers\/(\d+)$/, async (main, [id], q) => {
  const w = await api(`/workers/${id}`);
  const from = q.from || new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const to = q.to || todayStr();
  const att = await api(`/workers/${id}/attendance?from=${from}&to=${to}`);
  const s = att.summary;
  const canManage = S.can('workers.manage');
  main.innerHTML = `
    <div class="card"><div class="row" style="align-items:flex-start">
      <div class="avatar" style="width:90px;height:90px;font-size:1.6rem">${w.has_photo ? `<img src="${withToken(`/api/workers/${w.id}/photo`)}" alt="">` : initials(w.name)}</div>
      <div class="main" style="flex:1;min-width:200px"><h1 style="margin:0">${esc(w.name)}</h1>
        <div class="muted">${esc(w.profession || '')} • ${esc(w.nationality || '')}</div>
        <div class="row" style="margin-top:.4rem">${pill(w.project_name || 'غير معيّن', 'teal')} ${pill(w.affiliation === 'sub' ? w.subcontractor_name : 'الشركة', 'blue')}
        ${w.active ? '' : pill('غير نشط', 'red')}</div></div>
      ${canManage ? `<div class="qrbox" id="qr"></div>` : ''}</div>
      <div class="row" style="margin-top:.8rem">
        ${S.can('workers.transfer') ? '<button class="btn teal" id="transfer">🔁 نقل لمشروع آخر</button>' : ''}
        ${canManage ? `<a class="btn light" href="#/workers/${w.id}/edit">✏️ تعديل</a><button class="btn light" id="printQr">🖨️ طباعة بطاقة QR</button>` : ''}</div></div>
    <div class="grid2">
      <div class="card"><h3>البيانات</h3><div class="kv">
        <b>رقم الإقامة</b><span>${esc(w.iqama_no || '—')}</span>
        <b>انتهاء الإقامة</b><span>${esc(w.iqama_expiry || '—')} ${w.iqama_days_left !== undefined && w.iqama_days_left <= 30 ? pill(w.iqama_days_left < 0 ? 'منتهية' : `باقي ${w.iqama_days_left} يوم`, w.iqama_days_left < 0 ? 'red' : 'amber') : ''}</span>
        ${w.wage !== undefined ? `<b>الأجر</b><span>${money(w.wage)} (${T.wage[w.wage_type]})</span>` : ''}
        <b>الجهة</b><span>${w.affiliation === 'sub' ? `مقاول باطن: ${esc(w.subcontractor_name)}` : 'الشركة'}</span></div></div>
      <div class="card"><h3>سجل التنقل بين المشاريع</h3>
        <table><tr><th>المشروع</th><th>من</th><th>إلى</th></tr>${w.assignments.map((a) => `<tr><td>${esc(a.project_name)}</td><td>${esc(a.from_date)}</td><td>${a.to_date ? esc(a.to_date) : pill('حالياً', 'green')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">لا يوجد</td></tr>'}</table></div>
    </div>
    <div class="card"><div class="row"><h3>تقرير الحضور</h3><span class="spacer"></span>
      <form id="rf" class="row"><input type="date" name="from" value="${from}" style="width:auto"><input type="date" name="to" value="${to}" style="width:auto"><button class="btn sm">عرض</button></form></div>
      <div class="cards" style="margin-top:.6rem">
        <div class="stat green"><div class="v">${s.present}</div><div class="l">حاضر</div></div>
        <div class="stat amber"><div class="v">${s.late}</div><div class="l">متأخر</div></div>
        <div class="stat red"><div class="v">${s.absent}</div><div class="l">غائب</div></div>
        <div class="stat"><div class="v">${s.leave}</div><div class="l">إجازة</div></div>
        <div class="stat teal"><div class="v">${fmt(s.overtime_hours, 1)}</div><div class="l">ساعات إضافية</div></div>
        ${att.pay ? `<div class="stat"><div class="v" style="font-size:1.2rem">${money(att.pay.net)}</div><div class="l">المستحق للفترة</div></div>` : ''}
      </div>
      <div class="tablewrap"><table><tr><th>التاريخ</th><th>الحالة</th><th>دخول</th><th>خروج</th><th>إضافي</th><th>المشروع</th></tr>
      ${att.rows.map((r) => `<tr><td>${esc(r.date)}</td><td>${pill(T.att[r.status], T.attColor[r.status])}</td><td>${esc(r.check_in || '')}</td><td>${esc(r.check_out || '')}</td><td>${r.overtime_hours || ''}</td><td class="small">${esc(r.project_name)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">لا توجد سجلات</td></tr>'}</table></div></div>`;
  $('#rf').onsubmit = (e) => { e.preventDefault(); location.hash = `#/workers/${id}?` + qs(formData(e.target)); };
  if (canManage) {
    fetch(`/api/workers/${id}/qr`, { headers: { Authorization: 'Bearer ' + S.token } }).then((r) => r.text()).then((svg) => { if (svg.startsWith('<svg') || svg.startsWith('<?xml')) $('#qr').innerHTML = svg; });
    $('#printQr').onclick = () => {
      const win = window.open('', '_blank');
      win.document.write(`<html dir="rtl"><body style="font-family:Tahoma;text-align:center;padding:30px"><div style="border:2px solid #1F3A5F;border-radius:14px;display:inline-block;padding:20px">
        <img src="${LOGO}" style="height:50px" onerror="this.remove()"><h2>${esc(w.name)}</h2><p>${esc(w.profession || '')} — ${esc(w.iqama_no || '')}</p>${$('#qr').innerHTML}
        <p style="color:#666">${esc(COMPANY)}</p></div><script>setTimeout(()=>print(),300)<\/script></body></html>`);
      win.document.close();
    };
  }
  const tb = $('#transfer');
  if (tb) tb.onclick = async () => {
    const projects = (await projectsList()).filter((p) => p.id !== w.project_id && p.status === 'active');
    modal(`<h3>نقل ${esc(w.name)}</h3><form id="tf"><label>المشروع الجديد</label><select name="project_id" required>${opts(projects.map((p) => [p.id, p.name]), '', '— اختر —')}</select>
      <label>تاريخ النقل</label><input type="date" name="date" value="${todayStr()}">
      <div class="row" style="margin-top:1rem"><button class="btn teal">نقل</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`, (m, close) => {
      $('#tf', m).onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api(`/workers/${w.id}/transfer`, { method: 'POST', body: formData(e.target) });
          close(); toast('تم النقل وحُفظ في السجل', 'ok'); route();
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  };
});

on(/^\/workers\/(new|\d+\/edit)$/, async (main, [mode], q) => {
  const isNew = mode === 'new';
  const id = isNew ? null : mode.split('/')[0];
  const [w, projects, subs] = await Promise.all([isNew ? {} : api(`/workers/${id}`), projectsList(), subsList()]);
  main.innerHTML = `<h1>${isNew ? 'عامل جديد' : 'تعديل بيانات العامل'}</h1><form class="card" id="wf"><div class="form-grid">
    <div><label>الاسم *</label><input name="name" required value="${esc(w.name || '')}"></div>
    <div><label>الصورة</label><input type="file" name="photo" accept="image/*" capture="user"></div>
    <div><label>رقم الإقامة</label><input name="iqama_no" inputmode="numeric" value="${esc(w.iqama_no || '')}"></div>
    <div><label>تاريخ انتهاء الإقامة</label><input type="date" name="iqama_expiry" value="${esc(w.iqama_expiry || '')}"></div>
    <div><label>الجنسية</label><input name="nationality" value="${esc(w.nationality || '')}"></div>
    <div><label>المهنة</label><input name="profession" value="${esc(w.profession || '')}"></div>
    <div><label>نوع الأجر</label><select name="wage_type">${opts(Object.entries(T.wage), w.wage_type || 'daily')}</select></div>
    <div><label>الأجر (ر.س)</label><input type="number" min="0" step="0.01" name="wage" value="${w.wage ?? ''}"></div>
    <div><label>الجهة التابع لها</label><select name="affiliation">${opts(Object.entries(T.aff), w.affiliation || 'company')}</select></div>
    <div id="subBox"><label>مقاول الباطن</label><div class="row" style="flex-wrap:nowrap"><select name="subcontractor_id">${opts(subs.map((s) => [s.id, s.name]), w.subcontractor_id, '— اختر —')}</select><button type="button" class="btn light sm" id="addSub">+</button></div></div>
    ${isNew ? `<div><label>المشروع</label><select name="project_id">${opts(projects.filter((p) => p.status === 'active').map((p) => [p.id, p.name]), q.project_id, '— بدون —')}</select></div>` : `<div><label>الحالة</label><select name="active">${opts([['1', 'نشط'], ['0', 'غير نشط']], w.active === false || w.active === 0 ? '0' : '1')}</select></div>`}
    </div><div class="row" style="margin-top:1rem"><button class="btn teal">حفظ</button><a class="btn light" href="${isNew ? '#/workers' : `#/workers/${id}`}">إلغاء</a></div></form>`;
  const f = $('#wf');
  const toggle = () => $('#subBox').classList.toggle('hide', f.affiliation.value !== 'sub');
  f.affiliation.onchange = toggle; toggle();
  $('#addSub').onclick = () => modal(`<h3>مقاول باطن جديد</h3><form id="sf"><label>الاسم</label><input name="name" required><label>الجوال</label><input name="phone">
    <div class="row" style="margin-top:1rem"><button class="btn teal">إضافة</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`, (m, close) => {
    $('#sf', m).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const s = await api('/subcontractors', { method: 'POST', body: formData(e.target) });
        delete cache.subs;
        f.subcontractor_id.insertAdjacentHTML('beforeend', `<option value="${s.id}" selected>${esc(s.name)}</option>`);
        close();
      } catch (err) { toast(err.message, 'err'); }
    };
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      let r;
      if (isNew) {
        r = await api('/workers', { method: 'POST', form: new FormData(f) });
      } else {
        const body = formData(f);
        body.active = body.active === '1';
        r = await api(`/workers/${id}`, { method: 'PUT', body });
        if (f.photo.files[0]) {
          const fd = new FormData(); fd.append('photo', f.photo.files[0]);
          await api(`/workers/${id}/photo`, { method: 'POST', form: fd });
        }
      }
      toast('تم الحفظ', 'ok');
      location.hash = `#/workers/${r.id}`;
    } catch (err) { toast(err.message, 'err'); }
  };
});

// ---------------------------------------------------------------- الحضور
async function pickProject(main, q, base) {
  const projects = (await projectsList()).filter((p) => p.status === 'active');
  if (q.project_id) return projects.find((p) => String(p.id) === String(q.project_id)) || { id: q.project_id };
  if (projects.length === 1) return projects[0];
  main.innerHTML = `<h1>اختر المشروع</h1><div class="list">${projects.map((p) => `<a class="item" href="${base}?project_id=${p.id}"><div class="avatar">🏗️</div>
    <div class="main"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.location_name || '')}</div></div>${pill(`${p.present_today}/${p.planned_workers}`, 'green')}</a>`).join('') || '<div class="empty">لا توجد مشاريع نشطة</div>'}</div>`;
  return null;
}

on(/^\/attendance$/, async (main, _, q) => {
  const p = await pickProject(main, q, '#/attendance');
  if (!p) return;
  const date = q.date || todayStr();
  let data;
  try { data = await api(`/attendance?project_id=${p.id}&date=${date}`); } catch (e) { throw e; }
  const canRecord = S.can('attendance.record');
  const state = {};
  for (const r of data.rows) state[r.worker_id] = { status: r.status || '', ot: r.overtime_hours || 0 };
  const counts = () => {
    const c = { present: 0, late: 0, absent: 0, leave: 0, none: 0 };
    for (const v of Object.values(state)) c[v.status || 'none']++;
    return c;
  };
  main.innerHTML = `<div class="row"><h1>التحضير — ${esc(data.project.name)}</h1></div>
    <div class="row" style="margin-bottom:.8rem">
      <input type="date" id="d" value="${date}" style="width:auto" ${S.user.role === 'supervisor' ? `max="${todayStr()}"` : ''}>
      ${canRecord ? `<a class="btn teal" href="#/attendance/scan?project_id=${p.id}">📷 مسح QR</a>` : ''}
      <a class="btn light sm" href="#/attendance">تغيير المشروع</a></div>
    <div class="row small" id="cnt" style="margin-bottom:.6rem"></div>
    <input id="srch" placeholder="بحث عن عامل" style="margin-bottom:.6rem">
    ${canRecord ? `<div class="row" style="margin-bottom:.6rem"><button class="btn sm green" id="allP">الكل حاضر</button><button class="btn sm light" id="restA">الباقي غائب</button></div>` : ''}
    <div id="rows">${data.rows.map((r) => `<div class="att-row" data-w="${r.worker_id}" data-n="${esc(r.name)}">
      <div class="name">${esc(r.name)}<div class="muted small">${esc(r.profession || '')}${r.check_in ? ` • دخول ${esc(r.check_in)}` : ''}${r.check_out ? ` • خروج ${esc(r.check_out)}` : ''}${r.method === 'auto' ? ' • غياب تلقائي' : ''}</div></div>
      <div class="seg">${Object.entries(T.att).map(([k, t]) => `<button type="button" data-s="${k}" ${canRecord ? '' : 'disabled'}>${t}</button>`).join('')}</div>
      <input class="ot" type="number" min="0" max="12" step="0.5" placeholder="إضافي س" value="${r.overtime_hours || ''}" ${canRecord ? '' : 'disabled'}></div>`).join('') || '<div class="empty">لا يوجد عمال على المشروع</div>'}</div>
    ${canRecord ? '<div style="position:sticky;bottom:4.6rem;margin-top:1rem"><button class="btn block teal" id="save" style="min-height:56px;font-size:1.1rem">💾 حفظ التحضير</button></div>' : ''}`;
  const paint = () => {
    for (const row of $$('.att-row', main)) {
      const s = state[row.dataset.w];
      $$('.seg button', row).forEach((b) => b.classList.toggle('on', b.dataset.s === s.status));
    }
    const c = counts();
    $('#cnt').innerHTML = `${pill(`حاضر ${c.present}`, 'green')} ${pill(`متأخر ${c.late}`, 'amber')} ${pill(`غائب ${c.absent}`, 'red')} ${pill(`إجازة ${c.leave}`, 'blue')} ${c.none ? pill(`لم يُحدد ${c.none}`) : ''}`;
  };
  paint();
  $('#d').onchange = (e) => (location.hash = `#/attendance?project_id=${p.id}&date=${e.target.value}`);
  $('#srch').oninput = (e) => $$('.att-row', main).forEach((r) => r.classList.toggle('hide', !r.dataset.n.includes(e.target.value.trim())));
  if (!canRecord) return;
  $('#rows').onclick = (e) => {
    const b = e.target.closest('.seg button');
    if (!b) return;
    state[b.closest('.att-row').dataset.w].status = b.dataset.s;
    paint();
  };
  $('#rows').oninput = (e) => { if (e.target.classList.contains('ot')) state[e.target.closest('.att-row').dataset.w].ot = Number(e.target.value) || 0; };
  $('#allP').onclick = () => { for (const k in state) state[k].status = 'present'; paint(); };
  $('#restA').onclick = () => { for (const k in state) if (!state[k].status) state[k].status = 'absent'; paint(); };
  $('#save').onclick = async () => {
    const entries = Object.entries(state).filter(([, v]) => v.status).map(([k, v]) => ({ worker_id: Number(k), status: v.status, overtime_hours: v.ot }));
    if (!entries.length) return toast('حدد حالة عامل واحد على الأقل', 'err');
    const btn = $('#save');
    btn.disabled = true; btn.textContent = '📍 جارٍ تحديد الموقع…';
    try {
      let pos = { lat: null, lng: null };
      try { pos = await getPosition(); } catch (e) { if (S.user.role === 'supervisor') throw e; }
      const r = await api('/attendance/bulk', { method: 'POST', body: { project_id: p.id, date, lat: pos.lat, lng: pos.lng, entries }, queue: `تحضير ${data.project.name} ${date}` });
      toast(r.queued ? 'لا يوجد اتصال — حُفظ التحضير وسيُرسل تلقائياً' : `تم حفظ ${r.saved} سجل`, 'ok');
      delete cache.projects;
      if (!r.queued) route();
    } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; btn.textContent = '💾 حفظ التحضير'; }
  };
});

let scanStream = null;
function stopScan() { if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; } }
window.addEventListener('hashchange', stopScan);

on(/^\/attendance\/scan$/, async (main, _, q) => {
  const p = await pickProject(main, q, '#/attendance/scan');
  if (!p) return;
  let type = 'in';
  let busy = false;
  let lastCode = '', lastAt = 0;
  main.innerHTML = `<h1>مسح QR — ${esc(p.name || '')}</h1>
    <div class="row" style="margin-bottom:.8rem"><div class="seg" id="typ"><button data-t="in" class="on">تسجيل دخول</button><button data-t="out">تسجيل خروج</button></div>
      <a class="btn light sm" href="#/attendance?project_id=${p.id}">القائمة</a></div>
    <div class="scanner"><video id="v" playsinline muted></video><div class="frame"></div></div>
    <form class="row" id="manual" style="margin-top:.8rem;flex-wrap:nowrap"><input name="qr" placeholder="أو أدخل رمز البطاقة يدوياً"><button class="btn">تسجيل</button></form>
    <div id="log" class="list" style="margin-top:1rem"></div>`;
  $('#typ').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    type = b.dataset.t; $$('#typ button').forEach((x) => x.classList.toggle('on', x === b));
  };
  const log = (html, cls = '') => $('#log').insertAdjacentHTML('afterbegin', `<div class="alert ${cls}">${html}</div>`);
  async function submit(code) {
    if (busy) return;
    busy = true;
    try {
      const pos = await getPosition();
      const r = await api('/attendance/scan', { method: 'POST', body: { project_id: p.id, qr: code, type, lat: pos.lat, lng: pos.lng, at: new Date().toISOString() }, queue: `مسح QR (${type === 'in' ? 'دخول' : 'خروج'})` });
      if (r.queued) log('📥 بدون اتصال — حُفظ المسح وسيُرسل تلقائياً', 'info');
      else if (type === 'in') log(`✓ ${esc(r.worker.name)} — ${T.att[r.status]} ${r.already ? '(مسجل مسبقاً)' : ''} الساعة ${esc(r.check_in)}`, r.status === 'late' ? '' : 'ok');
      else log(`✓ خروج ${esc(r.worker.name)} الساعة ${esc(r.check_out)}${r.overtime_hours ? ` • إضافي ${r.overtime_hours} س` : ''}`, 'ok');
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (e) { log(`✗ ${esc(e.message)}`, 'danger'); } finally { busy = false; }
  }
  $('#manual').onsubmit = (e) => { e.preventDefault(); const v = e.target.qr.value.trim(); if (v) submit(v); e.target.reset(); };
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('#v');
    v.srcObject = scanStream; await v.play();
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (!scanStream || !document.body.contains(v)) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && window.jsQR) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data && (code.data !== lastCode || Date.now() - lastAt > 5000)) {
          lastCode = code.data; lastAt = Date.now(); submit(code.data);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  } catch {
    $('.scanner').innerHTML = '<div class="empty" style="color:#fff">تعذر فتح الكاميرا — استخدم الإدخال اليدوي</div>';
  }
});

// ---------------------------------------------------------------- المرفقات مع ختم التاريخ والوقت والموقع
async function stampImage(file, stamp) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const fs = Math.max(16, Math.round(c.width / 38));
  const lines = stamp.filter(Boolean);
  const h = fs * 1.5 * lines.length + fs;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, c.height - h, c.width, h);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${fs}px Tahoma, Arial`; ctx.textAlign = 'right'; ctx.direction = 'rtl';
  lines.forEach((t, i) => ctx.fillText(t, c.width - fs / 2, c.height - h + fs * 1.5 * (i + 1)));
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// مكوّن التقاط الصور والفيديو والملاحظة الصوتية
function mediaPicker(container, getLabel) {
  const items = [];
  container.innerHTML = `<div class="row"><label class="btn light sm" style="margin:0">📷 صورة/فيديو<input type="file" accept="image/*,video/*" multiple capture="environment" class="hide" id="mpFile"></label>
    <button type="button" class="btn light sm" id="mpRec">🎙️ ملاحظة صوتية</button><span class="muted small" id="mpGps"></span></div>
    <div class="media-grid" id="mpList" style="margin-top:.6rem"></div>`;
  let pos = null;
  getPosition().then((p) => { pos = p; $('#mpGps', container).textContent = `📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; }).catch(() => { $('#mpGps', container).textContent = '📍 الموقع غير متاح'; });
  const draw = () => {
    $('#mpList', container).innerHTML = items.map((it, i) => `<figure>${it.file.type.startsWith('image') ? `<img src="${it.url}">` : it.file.type.startsWith('video') ? `<video src="${it.url}" controls></video>` : `<audio src="${it.url}" controls style="width:100%"></audio>`}
      <figcaption>${dt(it.meta.taken_at)} <button type="button" data-rm="${i}" class="btn sm red" style="min-height:28px;padding:0 .5rem">✕</button></figcaption></figure>`).join('');
  };
  $('#mpList', container).onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(Number(b.dataset.rm), 1); draw(); } };
  const add = async (file) => {
    const now = new Date();
    const meta = { taken_at: now.toISOString(), lat: pos?.lat ?? null, lng: pos?.lng ?? null };
    let f = file;
    if (file.type.startsWith('image/')) {
      f = await stampImage(file, [now.toLocaleString('ar-SA-u-nu-latn'), pos ? `📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '', getLabel()]).catch(() => file);
    }
    items.push({ file: f, meta, url: URL.createObjectURL(f) });
    draw();
  };
  $('#mpFile', container).onchange = async (e) => { for (const f of e.target.files) await add(f); e.target.value = ''; };
  let rec = null;
  $('#mpRec', container).onclick = async (e) => {
    const b = e.currentTarget;
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || 'audio/webm';
        add(new File([new Blob(chunks, { type })], `voice-${Date.now()}.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
        rec = null; b.textContent = '🎙️ ملاحظة صوتية'; b.classList.remove('recording', 'red');
      };
      rec.start();
      b.textContent = '⏹️ إيقاف التسجيل'; b.classList.add('recording', 'red');
    } catch { toast('تعذر الوصول للميكروفون', 'err'); }
  };
  return {
    append(fd) {
      for (const it of items) fd.append('media', it.file, it.file.name);
      fd.append('media_meta', JSON.stringify(items.map((it) => it.meta)));
    },
    get pos() { return pos; },
  };
}

function mediaView(media) {
  if (!media.length) return '';
  return `<div class="media-grid">${media.map((m) => {
    const src = withToken(`/api/media/${m.id}`);
    const tag = m.kind === 'image' ? `<a href="${src}" target="_blank"><img src="${src}" loading="lazy"></a>` : m.kind === 'video' ? `<video src="${src}" controls preload="metadata"></video>` : `<audio src="${src}" controls style="width:100%"></audio>`;
    return `<figure>${tag}<figcaption>🕒 ${dt(m.taken_at)}${m.lat ? `<br>📍 ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : ''}</figcaption></figure>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- التقارير اليومية
function renderReportList(el, rows) {
  el.innerHTML = `<div class="list">${rows.map((r) => `<a class="item" href="#/reports/${r.id}"><div class="avatar">📝</div>
    <div class="main"><div class="t">${esc(r.project_name || '')} — ${esc(r.date)}</div><div class="s">${esc(r.description).slice(0, 120)}</div>
    <div class="s">${esc(r.author_name || '')}${r.weather ? ` • ${esc(r.weather)}` : ''}${r.media_count ? ` • 📎 ${r.media_count}` : ''}</div></div>
    ${r.progress != null ? `<div style="width:100px">${progress(r.progress)}</div>` : ''}</a>`).join('') || '<div class="empty">لا توجد تقارير</div>'}</div>`;
}

on(/^\/reports$/, async (main, _, q) => {
  const [rows, projects] = await Promise.all([api('/reports?' + qs(q)), projectsList()]);
  main.innerHTML = `<div class="row"><h1>التقارير اليومية</h1><span class="spacer"></span>${S.can('reports.create') ? '<a class="btn teal" href="#/reports/new">+ تقرير اليوم</a>' : ''}</div>
    <form class="filters" id="f"><select name="project_id">${opts(projects.map((p) => [p.id, p.name]), q.project_id, 'كل المشاريع')}</select>
      <input type="date" name="from" value="${esc(q.from || '')}"><input type="date" name="to" value="${esc(q.to || '')}"><input name="q" placeholder="بحث في الوصف" value="${esc(q.q || '')}"></form>
    <div class="row" style="margin-bottom:.8rem"><button class="btn light sm" id="pdf">🖨️ تقرير PDF يومي للمشروع</button></div><div id="rl"></div>`;
  renderReportList($('#rl'), rows);
  const f = $('#f');
  let t;
  f.oninput = () => { clearTimeout(t); t = setTimeout(() => (location.hash = '#/reports?' + qs(formData(f))), 400); };
  $('#pdf').onclick = () => {
    modal(`<h3>تقرير PDF يومي</h3><form id="pf"><label>المشروع</label><select name="project_id" required>${opts(projects.map((p) => [p.id, p.name]), q.project_id)}</select>
      <label>التاريخ</label><input type="date" name="date" value="${todayStr()}"><div class="row" style="margin-top:1rem"><button class="btn teal">فتح</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`, (m, close) => {
      $('#pf', m).onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); openPrint(`/projects/${d.project_id}/daily-print?date=${d.date}`); close(); };
    });
  };
});

on(/^\/reports\/new$/, async (main, _, q) => {
  const p = await pickProject(main, q, '#/reports/new');
  if (!p) return;
  main.innerHTML = `<h1>التقرير اليومي — ${esc(p.name || '')}</h1><form class="card" id="rf">
    <div class="form-grid"><div><label>التاريخ</label><input type="date" name="date" value="${todayStr()}" max="${todayStr()}"></div>
    <div><label>نسبة الإنجاز الحالية %</label><input type="number" min="0" max="100" step="0.5" name="progress" value="${p.progress ?? ''}"></div>
    <div><label>الطقس</label><select name="weather">${opts(T.weather.map((w) => [w, w]), '', '— اختر —')}</select></div></div>
    <label>وصف الأعمال المنجزة *</label><textarea name="description" required placeholder="ما الذي أُنجز اليوم؟"></textarea>
    <div class="form-grid"><div><label>المعدات المستخدمة</label><textarea name="equipment" style="min-height:70px"></textarea></div>
    <div><label>المواد المستخدمة</label><textarea name="materials" style="min-height:70px"></textarea></div></div>
    <label>الصور والفيديو والملاحظات الصوتية</label><div id="mp"></div>
    <button class="btn block teal" style="margin-top:1.2rem;min-height:56px">📤 رفع التقرير</button></form>`;
  const mp = mediaPicker($('#mp'), () => p.name || '');
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.append('project_id', p.id);
    fd.append('client_id', uuid());
    if (mp.pos) { fd.append('lat', mp.pos.lat); fd.append('lng', mp.pos.lng); }
    mp.append(fd);
    const btn = e.target.querySelector('button.block'); btn.disabled = true;
    try {
      const r = await api('/reports', { method: 'POST', form: fd, queue: `تقرير ${p.name || ''}` });
      toast(r.queued ? 'لا يوجد اتصال — حُفظ التقرير وسيُرفع تلقائياً' : 'تم رفع التقرير وإرساله للإدارة', 'ok');
      location.hash = r.queued ? '#/reports' : `#/reports/${r.id}`;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
});

on(/^\/reports\/(\d+)$/, async (main, [id]) => {
  const r = await api(`/reports/${id}`);
  main.innerHTML = `<div class="row"><h1>تقرير ${esc(r.project_name)} — ${esc(r.date)}</h1><span class="spacer"></span>
    <button class="btn light sm" id="pdf">🖨️ PDF اليوم</button></div>
    <div class="card"><div class="kv"><b>المشرف</b><span>${esc(r.author_name)}</span><b>نسبة الإنجاز</b><span>${r.progress ?? '—'}%</span>
    <b>الطقس</b><span>${esc(r.weather || '—')}</span><b>المعدات</b><span>${esc(r.equipment || '—')}</span><b>المواد</b><span>${esc(r.materials || '—')}</span>
    <b>وقت الرفع</b><span>${dt(r.created_at + (r.created_at.includes('T') ? '' : 'Z'))}</span></div>
    <h3>الأعمال المنجزة</h3><p style="white-space:pre-wrap">${esc(r.description)}</p>${mediaView(r.media)}</div>`;
  $('#pdf').onclick = () => openPrint(`/projects/${r.project_id}/daily-print?date=${r.date}`);
});

// ---------------------------------------------------------------- المشاكل والبلاغات
function renderIssueList(el, rows) {
  el.innerHTML = `<div class="list">${rows.map((i) => `<a class="item" href="#/issues/${i.id}" style="border-right:4px solid var(--${i.severity === 'critical' ? 'red' : i.severity === 'high' ? 'amber' : 'line'})">
    <div class="main"><div class="t">${esc(i.title)}</div><div class="s">${esc(i.project_name)} • ${T.cat[i.category]} • ${esc(i.assignee_name || 'غير مسند')}</div>
    <div class="row small" style="margin-top:.3rem">${pill(T.ist[i.status], T.istColor[i.status])} ${pill(T.sev[i.severity], T.sevColor[i.severity])}
    ${i.overdue ? pill('متأخر عن المهلة', 'red') : ''}${i.escalated ? pill('مُصعَّد', 'red') : ''}</div></div>
    <div class="small muted">${i.due_at ? `المهلة<br>${dt(i.due_at)}` : ''}</div></a>`).join('') || '<div class="empty">لا توجد بلاغات</div>'}</div>`;
}

on(/^\/issues$/, async (main, _, q) => {
  const [rows, projects] = await Promise.all([api('/issues?' + qs(q)), projectsList()]);
  main.innerHTML = `<div class="row"><h1>المشاكل والبلاغات</h1><span class="spacer"></span>${S.can('issues.create') ? '<a class="btn red" href="#/issues/new">+ بلاغ جديد</a>' : ''}</div>
    <form class="filters" id="f"><input name="q" placeholder="بحث" value="${esc(q.q || '')}">
      <select name="project_id">${opts(projects.map((p) => [p.id, p.name]), q.project_id, 'كل المشاريع')}</select>
      <select name="status">${opts(Object.entries(T.ist), q.status, 'كل الحالات')}</select>
      <select name="category">${opts(Object.entries(T.cat), q.category, 'كل التصنيفات')}</select>
      <select name="severity">${opts(Object.entries(T.sev), q.severity, 'كل الدرجات')}</select>
      <select name="overdue">${opts([['1', 'المتأخرة فقط']], q.overdue, 'كل المهل')}</select></form><div id="il"></div>`;
  renderIssueList($('#il'), rows);
  const f = $('#f');
  let t;
  f.oninput = () => { clearTimeout(t); t = setTimeout(() => (location.hash = '#/issues?' + qs(formData(f))), 400); };
});

on(/^\/issues\/new$/, async (main, _, q) => {
  const p = await pickProject(main, q, '#/issues/new');
  if (!p) return;
  const users = await usersList();
  main.innerHTML = `<h1>بلاغ جديد — ${esc(p.name || '')}</h1><form class="card" id="isf">
    <label>عنوان البلاغ *</label><input name="title" required>
    <div class="form-grid"><div><label>التصنيف</label><select name="category">${opts(Object.entries(T.cat), 'safety')}</select></div>
    <div><label>درجة الأهمية</label><select name="severity">${opts(Object.entries(T.sev), 'medium')}</select></div>
    ${S.can('issues.manage') ? `<div><label>إسناد إلى</label><select name="assignee_id">${opts(users.filter((u) => u.role !== 'accountant').map((u) => [u.id, `${u.name} (${S.roles[u.role]})`]), '', 'مدير المشروع (تلقائي)')}</select></div>
    <div><label>المهلة</label><input type="datetime-local" name="due_local"></div>` : ''}</div>
    <p class="muted small">إذا لم تُحدد المهلة: حرجة 4 ساعات، عالية 24 ساعة، متوسطة 3 أيام، منخفضة 7 أيام. يُصعَّد البلاغ للإدارة تلقائياً عند تجاوزها.</p>
    <label>التفاصيل</label><textarea name="description"></textarea>
    <label>صور / فيديو</label><div id="mp"></div>
    <button class="btn block red" style="margin-top:1.2rem;min-height:56px">⚠️ إرسال البلاغ</button></form>`;
  const mp = mediaPicker($('#mp'), () => p.name || '');
  $('#isf').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const local = fd.get('due_local'); fd.delete('due_local');
    if (local) fd.append('due_at', new Date(local).toISOString());
    fd.append('project_id', p.id); fd.append('client_id', uuid());
    if (mp.pos) { fd.append('lat', mp.pos.lat); fd.append('lng', mp.pos.lng); }
    mp.append(fd);
    const btn = e.target.querySelector('button.block'); btn.disabled = true;
    try {
      const r = await api('/issues', { method: 'POST', form: fd, queue: `بلاغ: ${fd.get('title')}` });
      toast(r.queued ? 'لا يوجد اتصال — حُفظ البلاغ وسيُرسل تلقائياً' : 'تم إرسال البلاغ', 'ok');
      location.hash = r.queued ? '#/issues' : `#/issues/${r.id}`;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
});

on(/^\/issues\/(\d+)$/, async (main, [id]) => {
  const [i, users] = await Promise.all([api(`/issues/${id}`), usersList()]);
  const manager = S.can('issues.manage');
  const canStatus = manager || i.assignee_id === S.user.id;
  const local = i.due_at ? new Date(new Date(i.due_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  main.innerHTML = `<h1>${esc(i.title)}</h1>
    <div class="row" style="margin-bottom:.8rem">${pill(T.ist[i.status], T.istColor[i.status])} ${pill(T.sev[i.severity], T.sevColor[i.severity])} ${pill(T.cat[i.category], 'blue')}
      ${i.overdue ? pill('متأخر عن المهلة', 'red') : ''} ${i.escalated ? pill('مُصعَّد للإدارة', 'red') : ''}</div>
    <div class="card"><div class="kv"><b>المشروع</b><a href="#/projects/${i.project_id}">${esc(i.project_name)}</a><b>المُبلِّغ</b><span>${esc(i.reporter_name || '')}</span>
      <b>المسؤول</b><span>${esc(i.assignee_name || 'غير مسند')}</span><b>المهلة</b><span>${dt(i.due_at)}</span><b>تاريخ البلاغ</b><span>${dt(i.created_at)}</span>
      ${i.closed_at ? `<b>تاريخ الإغلاق</b><span>${dt(i.closed_at)}</span>` : ''}</div>
      ${i.description ? `<p style="white-space:pre-wrap">${esc(i.description)}</p>` : ''}${mediaView(i.media)}</div>
    ${canStatus ? `<form class="card" id="uf"><h3>تحديث البلاغ</h3><div class="form-grid">
      <div><label>الحالة</label><select name="status">${opts(Object.entries(T.ist), i.status)}</select></div>
      ${manager ? `<div><label>المسؤول</label><select name="assignee_id">${opts(users.filter((u) => u.role !== 'accountant').map((u) => [u.id, `${u.name} (${S.roles[u.role]})`]), i.assignee_id, '— غير مسند —')}</select></div>
      <div><label>الأهمية</label><select name="severity">${opts(Object.entries(T.sev), i.severity)}</select></div>
      <div><label>المهلة</label><input type="datetime-local" name="due_local" value="${local}"></div>` : ''}</div>
      <button class="btn teal" style="margin-top:1rem">حفظ</button></form>` : ''}`;
  const uf = $('#uf');
  if (uf) uf.onsubmit = async (e) => {
    e.preventDefault();
    const b = formData(uf);
    if (b.due_local !== undefined) { b.due_at = b.due_local ? new Date(b.due_local).toISOString() : i.due_at; delete b.due_local; }
    if (b.assignee_id === '') b.assignee_id = null;
    try { await api(`/issues/${id}`, { method: 'PUT', body: b }); toast('تم التحديث', 'ok'); route(); } catch (err) { toast(err.message, 'err'); }
  };
});

// ---------------------------------------------------------------- المستخلصات
function renderInvoiceList(el, rows) {
  el.innerHTML = `<div class="tablewrap"><table><thead><tr><th>المستخلص</th><th>الطرف</th><th>الحالة</th><th>الصافي</th><th>المصروف</th><th>المتبقي</th></tr></thead><tbody>
    ${rows.map((v) => `<tr class="click" data-href="#/invoices/${v.id}"><td><b>${esc(v.project_name)}</b><div class="muted small">مستخلص رقم ${v.number}</div></td>
    <td>${esc(v.party_name)}<div class="muted small">${T.party[v.party_type]}</div></td><td>${pill(T.inv[v.status], T.invColor[v.status])}</td>
    <td>${money(v.totals.net)}</td><td>${money(v.totals.paid)}</td><td><b>${money(v.totals.remaining)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد مستخلصات</td></tr>'}</tbody></table></div>`;
  $$('tr[data-href]', el).forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.href)));
}

on(/^\/invoices$/, async (main, _, q) => {
  const [rows, projects] = await Promise.all([api('/invoices?' + qs(q)), projectsList()]);
  const sum = (k) => rows.reduce((s, v) => s + v.totals[k], 0);
  main.innerHTML = `<div class="row"><h1>المستخلصات</h1><span class="spacer"></span>${S.can('invoices.edit') ? '<a class="btn teal" href="#/invoices/new">+ مستخلص جديد</a>' : ''}</div>
    <div class="alert info">🔒 الاعتماد للمدير العام والمالك • الصرف للإدارة المالية والمالك فقط</div>
    <div class="cards"><div class="stat"><div class="v" style="font-size:1.25rem">${money(sum('net'))}</div><div class="l">إجمالي الصافي</div></div>
      <div class="stat green"><div class="v" style="font-size:1.25rem">${money(sum('paid'))}</div><div class="l">المصروف</div></div>
      <div class="stat amber"><div class="v" style="font-size:1.25rem">${money(sum('remaining'))}</div><div class="l">المتبقي</div></div></div>
    <form class="filters" id="f"><input name="q" placeholder="بحث بالطرف أو المشروع" value="${esc(q.q || '')}">
      <select name="project_id">${opts(projects.map((p) => [p.id, p.name]), q.project_id, 'كل المشاريع')}</select>
      <select name="status">${opts(Object.entries(T.inv), q.status, 'كل الحالات')}</select>
      <select name="party_type">${opts(Object.entries(T.party), q.party_type, 'كل الأطراف')}</select></form><div id="vl"></div>`;
  renderInvoiceList($('#vl'), rows);
  const f = $('#f');
  let t;
  f.oninput = () => { clearTimeout(t); t = setTimeout(() => (location.hash = '#/invoices?' + qs(formData(f))), 400); };
});

on(/^\/invoices\/(new|\d+\/edit)$/, async (main, [mode], q) => {
  const isNew = mode === 'new';
  const id = isNew ? null : mode.split('/')[0];
  const [v, projects, subs] = await Promise.all([isNew ? { items: [{}], vat_pct: 15, retention_pct: 10, deductions: 0, party_type: 'subcontractor' } : api(`/invoices/${id}`), projectsList(), subsList()]);
  main.innerHTML = `<h1>${isNew ? 'مستخلص جديد' : `تعديل مستخلص رقم ${v.number}`}</h1><form class="card" id="vf"><div class="form-grid">
    ${isNew ? `<div><label>المشروع *</label><select name="project_id" required>${opts(projects.map((p) => [p.id, p.name]), q.project_id, '— اختر —')}</select></div>` : ''}
    <div><label>نوع الطرف</label><select name="party_type">${opts(Object.entries(T.party), v.party_type)}</select></div>
    <div id="subB"><label>مقاول الباطن</label><select name="subcontractor_id">${opts(subs.map((s) => [s.id, s.name]), v.subcontractor_id, '— اختر —')}</select></div>
    <div><label>اسم الطرف</label><input name="party_name" value="${esc(v.party_name || '')}"></div>
    <div><label>الفترة من</label><input type="date" name="period_from" value="${esc(v.period_from || '')}"></div>
    <div><label>الفترة إلى</label><input type="date" name="period_to" value="${esc(v.period_to || '')}"></div>
    <div><label>محتجز الضمان %</label><input type="number" min="0" max="100" step="0.5" name="retention_pct" value="${v.retention_pct}"></div>
    <div><label>ضريبة القيمة المضافة %</label><input type="number" min="0" max="100" step="0.5" name="vat_pct" value="${v.vat_pct}"></div>
    <div><label>خصومات (ر.س)</label><input type="number" min="0" step="0.01" name="deductions" value="${v.deductions}"></div></div>
    <h3>البنود</h3><div class="tablewrap"><table><thead><tr><th>الوصف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th></th></tr></thead><tbody id="items"></tbody></table></div>
    <button type="button" class="btn light sm" id="addItem">+ بند</button>
    <div class="card" style="margin-top:1rem;background:#f7f9fb" id="tot"></div>
    <label>ملاحظات</label><textarea name="notes" style="min-height:70px">${esc(v.notes || '')}</textarea>
    <div class="row" style="margin-top:1rem"><button class="btn teal">حفظ كمسودة</button><a class="btn light" href="${isNew ? '#/invoices' : `#/invoices/${id}`}">إلغاء</a></div></form>`;
  const f = $('#vf');
  const items = v.items.map((i) => ({ description: i.description || '', unit: i.unit || '', qty: i.qty ?? '', unit_price: i.unit_price ?? '' }));
  const calc = () => {
    const gross = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
    const ret = gross * (Number(f.retention_pct.value) || 0) / 100, vat = gross * (Number(f.vat_pct.value) || 0) / 100, ded = Number(f.deductions.value) || 0;
    $('#tot').innerHTML = `<div class="kv"><b>إجمالي الأعمال</b><span>${money(gross)}</span><b>+ الضريبة</b><span>${money(vat)}</span><b>− محتجز الضمان</b><span>${money(ret)}</span>
      <b>− الخصومات</b><span>${money(ded)}</span><b class="bold">صافي المستحق</b><span class="bold">${money(gross + vat - ret - ded)}</span></div>`;
  };
  const draw = () => {
    $('#items').innerHTML = items.map((i, n) => `<tr data-i="${n}"><td><input data-k="description" value="${esc(i.description)}" required style="min-width:180px"></td>
      <td><input data-k="unit" value="${esc(i.unit)}" style="width:90px"></td><td><input data-k="qty" type="number" step="any" min="0" value="${i.qty}" style="width:100px" required></td>
      <td><input data-k="unit_price" type="number" step="any" min="0" value="${i.unit_price}" style="width:120px" required></td>
      <td class="lt">${money((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</td><td><button type="button" class="btn sm red" data-rm="${n}">✕</button></td></tr>`).join('');
    calc();
  };
  $('#items').oninput = (e) => {
    const tr = e.target.closest('tr');
    const it = items[tr.dataset.i];
    it[e.target.dataset.k] = e.target.value;
    $('.lt', tr).textContent = money((Number(it.qty) || 0) * (Number(it.unit_price) || 0));
    calc();
  };
  $('#items').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b && items.length > 1) { items.splice(Number(b.dataset.rm), 1); draw(); } };
  $('#addItem').onclick = () => { items.push({ description: '', unit: '', qty: '', unit_price: '' }); draw(); };
  f.retention_pct.oninput = f.vat_pct.oninput = f.deductions.oninput = calc;
  const tg = () => $('#subB').classList.toggle('hide', f.party_type.value !== 'subcontractor');
  f.party_type.onchange = tg; tg();
  draw();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = formData(f);
    for (const k of Object.keys(b)) if (k.startsWith('description') || ['unit', 'qty', 'unit_price'].includes(k)) delete b[k];
    b.items = items;
    try {
      const r = await api(isNew ? '/invoices' : `/invoices/${id}`, { method: isNew ? 'POST' : 'PUT', body: b });
      toast('تم الحفظ', 'ok');
      location.hash = `#/invoices/${r.id}`;
    } catch (err) { toast(err.message, 'err'); }
  };
});

on(/^\/invoices\/(\d+)$/, async (main, [id]) => {
  const v = await api(`/invoices/${id}`);
  const t = v.totals;
  main.innerHTML = `<div class="row"><h1>مستخلص رقم ${v.number} — ${esc(v.project_name)}</h1><span class="spacer"></span>
    <button class="btn light sm" id="pr">🖨️ طباعة / PDF</button></div>
    <div class="row" style="margin-bottom:.8rem">${pill(T.inv[v.status], T.invColor[v.status])}</div>
    <div class="grid2"><div class="card"><div class="kv"><b>الطرف</b><span>${esc(v.party_name)} (${T.party[v.party_type]})</span>
      <b>الفترة</b><span>${esc(v.period_from || '')} ← ${esc(v.period_to || '')}</span><b>أعدّه</b><span>${esc(v.created_by_name || '')}</span>
      ${v.approved_by_name ? `<b>اعتمده</b><span>${esc(v.approved_by_name)} — ${dt(v.approved_at)}</span>` : ''}</div>
      ${v.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(v.notes)}</p>` : ''}</div>
      <div class="card"><div class="kv"><b>إجمالي الأعمال</b><span>${money(t.gross)}</span><b>+ الضريبة ${v.vat_pct}%</b><span>${money(t.vat)}</span>
      <b>− ضمان ${v.retention_pct}%</b><span>${money(t.retention)}</span><b>− خصومات</b><span>${money(t.deductions)}</span>
      <b class="bold">الصافي</b><span class="bold">${money(t.net)}</span><b>المصروف</b><span style="color:var(--green)">${money(t.paid)}</span>
      <b class="bold">المتبقي</b><span class="bold" style="color:var(--red)">${money(t.remaining)}</span></div></div></div>
    <div class="row" style="margin-bottom:1rem">
      ${v.can_edit ? `<a class="btn light" href="#/invoices/${v.id}/edit">✏️ تعديل</a>` : ''}
      ${v.can_submit ? '<button class="btn" id="sub">📨 رفع للاعتماد</button>' : ''}
      ${v.can_approve ? '<button class="btn green" id="apr">✓ اعتماد</button><button class="btn red" id="rej">✕ رفض</button>' : ''}
      ${v.can_pay ? '<button class="btn teal" id="pay">💰 صرف دفعة</button>' : ''}</div>
    <h2>البنود</h2><div class="tablewrap"><table><tr><th>#</th><th>الوصف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
      ${v.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td>${esc(i.unit || '')}</td><td>${fmt(i.qty, 2)}</td><td>${money(i.unit_price)}</td><td>${money(i.qty * i.unit_price)}</td></tr>`).join('')}</table></div>
    <h2>دفعات الصرف</h2><div class="tablewrap"><table><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>بواسطة</th></tr>
      ${v.payments.map((p) => `<tr><td>${esc(p.paid_at)}</td><td>${money(p.amount)}</td><td>${T.pay[p.method] || esc(p.method)}</td><td>${esc(p.reference || '')}</td><td>${esc(p.paid_by_name)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">لا توجد دفعات</td></tr>'}</table></div>`;
  $('#pr').onclick = () => openPrint(`/invoices/${v.id}/print`);
  const act = async (path, body, msg) => { try { await api(`/invoices/${v.id}/${path}`, { method: 'POST', body: body || {} }); toast(msg, 'ok'); route(); } catch (e) { toast(e.message, 'err'); } };
  if ($('#sub')) $('#sub').onclick = async () => { if (await confirmBox('رفع المستخلص للاعتماد؟ لن يمكن تعديله بعدها.')) act('submit', null, 'تم الرفع للاعتماد'); };
  if ($('#apr')) $('#apr').onclick = async () => { if (await confirmBox(`اعتماد المستخلص بصافي ${money(t.net)}؟`)) act('approve', null, 'تم الاعتماد'); };
  if ($('#rej')) $('#rej').onclick = () => modal(`<h3>رفض المستخلص</h3><form id="rf"><label>السبب</label><textarea name="reason"></textarea>
    <div class="row" style="margin-top:1rem"><button class="btn red">رفض</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`, (m, close) => {
    $('#rf', m).onsubmit = (e) => { e.preventDefault(); close(); act('reject', formData(e.target), 'تم الرفض'); };
  });
  if ($('#pay')) $('#pay').onclick = () => modal(`<h3>صرف دفعة — المتبقي ${money(t.remaining)}</h3><form id="pf">
    <label>المبلغ</label><input type="number" name="amount" min="0.01" step="0.01" max="${t.remaining}" value="${t.remaining}" required>
    <label>الطريقة</label><select name="method">${opts(Object.entries(T.pay), 'transfer')}</select>
    <label>المرجع (رقم الحوالة/الشيك)</label><input name="reference"><label>تاريخ الصرف</label><input type="date" name="paid_at" value="${todayStr()}">
    <div class="row" style="margin-top:1rem"><button class="btn teal">تأكيد الصرف</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`, (m, close) => {
    $('#pf', m).onsubmit = (e) => { e.preventDefault(); close(); act('payments', formData(e.target), 'تم تسجيل الصرف'); };
  });
});

// ---------------------------------------------------------------- التقارير والتصدير
on(/^\/exports$/, async (main, _, q) => {
  const [projects, subs] = await Promise.all([projectsList(), subsList()]);
  const to = q.to || todayStr();
  const from = q.from || to.slice(0, 8) + '01';
  const kind = q.kind || 'attendance';
  const showPay = S.can('payroll.view');
  main.innerHTML = `<h1>التقارير والتصدير</h1>
    <div class="tabs">${[['attendance', 'حسب العامل'], ['project', 'حسب المشروع'], ['subcontractor', 'حسب المقاول الباطن'], ...(showPay ? [['payroll', 'الرواتب الشهرية']] : [])]
      .map(([k, t]) => `<a href="#/exports?kind=${k}" class="${kind === k ? 'active' : ''}">${t}</a>`).join('')}</div>
    <form class="filters" id="f">
      ${kind === 'payroll' ? `<input type="month" name="month" value="${esc(q.month || to.slice(0, 7))}">` : `<input type="date" name="from" value="${from}"><input type="date" name="to" value="${to}">`}
      <select name="project_id">${opts(projects.map((p) => [p.id, p.name]), q.project_id, 'كل المشاريع')}</select>
      <select name="affiliation">${opts(Object.entries(T.aff), q.affiliation, 'كل الجهات')}</select>
      <select name="subcontractor_id">${opts(subs.map((s) => [s.id, s.name]), q.subcontractor_id, 'كل المقاولين')}</select>
      <input type="hidden" name="kind" value="${kind}"></form>
    <div class="row" style="margin-bottom:1rem"><button class="btn green" id="xl">📗 تصدير Excel</button><button class="btn red" id="pdf">📕 تصدير PDF</button></div>
    <div id="out"><div class="empty">جارٍ التحميل…</div></div>`;
  const f = $('#f');
  f.onchange = () => (location.hash = '#/exports?' + qs(formData(f)));
  const params = formData(f);
  delete params.kind;
  let path;
  if (kind === 'payroll') path = '/exports/payroll';
  else if (kind === 'attendance') path = '/exports/attendance';
  else { path = '/exports/summary'; params.group = kind; }
  const query = qs(params);
  $('#xl').onclick = () => download(`${path}?${query}&format=xlsx`, `${kind}-${params.month || params.from}.xlsx`);
  $('#pdf').onclick = () => openPrint(`${path}?${query}&format=html`);
  const d = await api(`${path}?${query}`);
  const out = $('#out');
  if (kind === 'payroll') {
    out.innerHTML = `<div class="cards"><div class="stat"><div class="v">${d.rows.length}</div><div class="l">عامل</div></div>
      <div class="stat teal"><div class="v" style="font-size:1.2rem">${money(d.totals.net)}</div><div class="l">صافي الرواتب</div></div>
      <div class="stat"><div class="v" style="font-size:1.2rem">${money(d.totals.overtime_pay)}</div><div class="l">الإضافي</div></div>
      <div class="stat red"><div class="v" style="font-size:1.2rem">${money(d.totals.absence_deduction)}</div><div class="l">خصم الغياب</div></div></div>
      <p class="muted small">الصافي = أيام العمل × الأجر + الإضافي (×1.5) − الغياب • الفترة ${esc(d.from)} ← ${esc(d.to)}</p>
      <div class="tablewrap"><table><tr><th>العامل</th><th>الجهة</th><th>الأجر</th><th>أيام العمل</th><th>غياب</th><th>إضافي س</th><th>الأساسي</th><th>الإضافي</th><th>الخصم</th><th>الصافي</th></tr>
      ${d.rows.map((r) => `<tr><td><a href="#/workers/${r.id}">${esc(r.name)}</a><div class="muted small">${esc(r.profession || '')}</div></td><td class="small">${r.affiliation === 'sub' ? esc(r.subcontractor_name) : 'الشركة'}</td>
      <td class="small">${money(r.wage)} ${T.wage[r.wage_type]}</td><td>${r.worked_days}</td><td>${r.absent}</td><td>${r.overtime_hours}</td><td>${money(r.base)}</td><td>${money(r.overtime_pay)}</td><td>${money(r.absence_deduction)}</td><td><b>${money(r.net)}</b></td></tr>`).join('') || '<tr><td colspan="10" class="empty">لا توجد بيانات</td></tr>'}</table></div>`;
  } else if (kind === 'attendance') {
    const cost = d.rows[0] && d.rows[0].cost !== undefined;
    out.innerHTML = `<div class="tablewrap"><table><tr><th>العامل</th><th>المشروع</th><th>الجهة</th><th>حاضر</th><th>متأخر</th><th>غائب</th><th>إجازة</th><th>إضافي س</th>${cost ? '<th>التكلفة</th>' : ''}</tr>
      ${d.rows.map((r) => `<tr><td><a href="#/workers/${r.id}">${esc(r.name)}</a></td><td class="small">${esc(r.project_name || '')}</td><td class="small">${r.affiliation === 'sub' ? esc(r.subcontractor_name) : 'الشركة'}</td>
      <td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.leave}</td><td>${r.overtime_hours}</td>${cost ? `<td>${money(r.cost)}</td>` : ''}</tr>`).join('') || '<tr><td colspan="9" class="empty">لا توجد بيانات</td></tr>'}</table></div>`;
  } else {
    const cost = d.rows[0] && d.rows[0].cost !== undefined && S.can('costs.view');
    out.innerHTML = `<div class="tablewrap"><table><tr><th>${kind === 'project' ? 'المشروع' : 'الجهة'}</th><th>العمال</th><th>أيام العمل</th><th>غياب</th><th>تأخير</th><th>إضافي س</th>${cost ? '<th>التكلفة</th>' : ''}</tr>
      ${d.rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${r.workers}</td><td>${r.worked_days}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.overtime_hours}</td>${cost ? `<td>${money(r.cost)}</td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد بيانات</td></tr>'}</table></div>`;
  }
});

// ---------------------------------------------------------------- المستخدمون والإعدادات
on(/^\/users$/, async (main) => {
  const users = await api('/users');
  main.innerHTML = `<div class="row"><h1>المستخدمون</h1><span class="spacer"></span><button class="btn teal" id="add">+ مستخدم</button></div>
    <div class="tablewrap"><table><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>الجوال</th><th>الحالة</th><th></th></tr>
    ${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(S.roles[u.role])}</td><td>${esc(u.phone || '')}</td>
    <td>${u.active ? pill('نشط', 'green') : pill('معطّل', 'red')}</td><td><button class="btn sm light" data-u="${u.id}">تعديل</button></td></tr>`).join('')}</table></div>`;
  const roleOpts = Object.entries(S.roles).filter(([k]) => k !== 'owner' || S.user.role === 'owner');
  const form = (u = {}) => `<h3>${u.id ? 'تعديل مستخدم' : 'مستخدم جديد'}</h3><form id="uf">
    <label>الاسم</label><input name="name" required value="${esc(u.name || '')}">
    ${u.id ? '' : '<label>اسم المستخدم</label><input name="username" required autocapitalize="off">'}
    <label>الدور</label><select name="role">${opts(roleOpts, u.role || 'supervisor')}</select>
    <label>الجوال</label><input name="phone" value="${esc(u.phone || '')}">
    <label>${u.id ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label><input name="password" type="password" ${u.id ? '' : 'required'} minlength="6">
    ${u.id ? `<label>الحالة</label><select name="active">${opts([['1', 'نشط'], ['0', 'معطّل']], u.active ? '1' : '0')}</select>` : ''}
    <div class="row" style="margin-top:1rem"><button class="btn teal">حفظ</button><button type="button" class="btn light" data-close>إلغاء</button></div></form>`;
  const open = (u) => modal(form(u), (m, close) => {
    $('#uf', m).onsubmit = async (e) => {
      e.preventDefault();
      const b = formData(e.target);
      if (!b.password) delete b.password;
      if (b.active !== undefined) b.active = b.active === '1';
      try {
        await api(u ? `/users/${u.id}` : '/users', { method: u ? 'PUT' : 'POST', body: b });
        delete cache.users; close(); toast('تم الحفظ', 'ok'); route();
      } catch (err) { toast(err.message, 'err'); }
    };
  });
  $('#add').onclick = () => open();
  $$('[data-u]', main).forEach((b) => (b.onclick = () => open(users.find((u) => String(u.id) === b.dataset.u))));
});

on(/^\/settings$/, async (main) => {
  const s = await api('/settings');
  main.innerHTML = `<h1>الإعدادات</h1><form class="card" id="sf"><div class="form-grid">
    <div><label>ساعة تسجيل الغياب التلقائي</label><input type="time" name="absence_cutoff" value="${esc(s.absence_cutoff)}">
      <p class="muted small">من لم يُحضَّر حتى هذه الساعة يُسجَّل غائباً تلقائياً (عدا الجمعة).</p></div>
    <div><label>يُعتبر متأخراً بعد الساعة</label><input type="time" name="late_after" value="${esc(s.late_after)}"></div>
    <div><label>اسم الشركة</label><input name="company_name" value="${esc(s.company_name)}"></div></div>
    <button class="btn teal" style="margin-top:1rem">حفظ</button></form>`;
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/settings', { method: 'PUT', body: formData(e.target) }); toast('تم الحفظ', 'ok'); } catch (err) { toast(err.message, 'err'); }
  };
});

// ---------------------------------------------------------------- التشغيل
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
if (S.token) boot(); else loginView();
