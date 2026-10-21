// نظام إدارة العهد — واجهة المستخدم (صفحة واحدة بدون مكتبات)
'use strict';

// داخل تطبيق أندرويد (APK) يتوفر جسر للتنبيهات الأصلية التي تعمل حتى والتطبيق مغلق
const NATIVE = window.AndroidBridge || null;
if (NATIVE) window.print = () => NATIVE.print();

const S = { token: null, user: null, settings: {}, projects: [], employees: [], pendingBadge: 0 };
try { S.token = localStorage.getItem('custody_token'); } catch {}

// ---------- أدوات ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = n => `<span class="num">${fmt(n)}</span> ${esc(S.settings.currency || '')}`;
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const nowTime = () => new Date().toTimeString().slice(0, 5);
const STATUS = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' };
const statusTag = s => `<span class="tag ${s}">${STATUS[s] || s}</span>`;
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function ago(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn');
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(method, url, body) {
  if (window.DEMO) {
    try { return await DEMO.api(method, url, body, S.token); } catch (e) { if (e.status === 401) logout(true); throw e; }
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { logout(true); throw new Error(data.error); }
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}
const fileUrl = url => window.DEMO ? (url.startsWith('/api/receipts/') ? url.slice(14) : '#demo-export') : url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(S.token);

// ---------- النوافذ ----------
function modal(html, { onMount, wide } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" style="${wide ? 'max-width:820px' : ''}">${html}</div>`;
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  $('#modal-root').appendChild(back);
  onMount && onMount(back, close);
  return close;
}
function confirmBox(msg) {
  return new Promise(resolve => {
    modal(`<h3>${esc(msg)}</h3><div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn primary" id="cf-ok">تأكيد</button></div>`, {
      onMount: (el, close) => $('#cf-ok', el).onclick = () => { close(); resolve(true); },
    });
  });
}
const formData = form => Object.fromEntries(new FormData(form).entries());
async function submitWith(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
}

// ضغط صورة الإيصال قبل الرفع
function compressImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- الدخول ----------
function renderLogin() {
  $('#app').innerHTML = `
    <div class="login"><div class="card">
      <div class="logo"><img src="/icon.svg" alt=""></div>
      <h1>نظام إدارة العهد</h1>
      <p class="muted" style="text-align:center;margin:0 0 18px">متابعة العهد والمصروفات لحظة بلحظة</p>
      <form id="login-form" class="form" style="grid-template-columns:1fr">
        <div class="field"><label>اسم المستخدم</label><input name="username" autocomplete="username" required></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary lg">دخول</button>
      </form>
      ${window.DEMO ? `<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
        <p class="muted" style="text-align:center;margin:0 0 10px">🧪 وضع تجريبي ببيانات وهمية — اختر حساباً للتجربة</p>
        <div style="display:grid;gap:8px">${DEMO.accounts.map(([u, p, label]) => `<button class="btn" data-demo="${u}|${p}">${label}</button>`).join('')}</div>
        ${NATIVE ? '<button class="btn sm" style="margin-top:12px;width:100%" onclick="AndroidBridge.changeServer()">الربط بخادم الشركة</button>' : ''}
      </div>` : ''}
    </div></div>`;
  $$('[data-demo]').forEach(b => b.onclick = () => {
    const [u, p] = b.dataset.demo.split('|');
    $('[name=username]').value = u; $('[name=password]').value = p;
    $('#login-form').requestSubmit();
  });
  $('#login-form').onsubmit = e => {
    e.preventDefault();
    submitWith(e.submitter || $('button', e.target), async () => {
      const r = await api('POST', '/api/login', formData(e.target));
      S.token = r.token; store.set('custody_token', r.token);
      history.replaceState(null, '', location.pathname + location.search);
      await boot();
    });
  };
}
async function logout(silent) {
  if (!silent) { try { await api('POST', '/api/logout'); } catch {} }
  S.token = null; S.user = null; store.del('custody_token');
  stopTimers();
  renderLogin();
}

// ---------- الهيكل والتنقل ----------
const NAV = {
  manager: [
    ['dashboard', '📊', 'لوحة التحكم'], ['expenses', '🧾', 'المصروفات'], ['custodies', '💰', 'العهد'],
    ['checkins', '🔔', 'متابعة التنبيهات'], ['employees', '👥', 'الموظفون'], ['projects', '🏗️', 'المشاريع'], ['settings', '⚙️', 'الإعدادات'],
  ],
  employee: [
    ['home', '🏠', 'عهدتي'], ['add', '➕', 'مصروف جديد'], ['history', '🧾', 'مصروفاتي'], ['received', '💰', 'العهد المستلمة'], ['settings', '⚙️', 'الإعدادات'],
  ],
};
function shell(title, content, actions = '') {
  const page = (location.hash.split('?')[0].split('/')[1]) || '';
  const items = NAV[S.user.role];
  const link = ([k, ico, label]) => `<a href="#/${k}" class="${page === k ? 'active' : ''}"><span class="ico">${ico}</span><span>${label}</span>${k === 'expenses' && S.pendingBadge ? `<span class="badge">${S.pendingBadge}</span>` : ''}</a>`;
  $('#app').innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><img src="/icon.svg" alt="">${esc(S.settings.companyName || 'إدارة العهد')}</div>
        ${window.DEMO ? '<div class="tag pending" style="margin:0 10px 10px;text-align:center">🧪 وضع تجريبي</div>' : ''}
        <nav class="nav">${items.map(link).join('')}</nav>
        <div class="me">${esc(S.user.name)}<br><span style="opacity:.75">${S.user.role === 'manager' ? 'مدير' : 'موظف'}</span><br><button id="logout">تسجيل الخروج</button></div>
      </aside>
      <main class="main">
        <div class="topbar"><h1>${title}</h1><div class="actions">${actions}</div></div>
        ${content}
      </main>
      <nav class="mobile-nav">${items.map(link).join('')}</nav>
    </div>`;
  $('#logout').onclick = () => logout();
}

async function router() {
  if (!S.user) return;
  const [, page = '', arg] = location.hash.split('?')[0].split('/');
  const views = S.user.role === 'manager' ? managerViews : employeeViews;
  const fallback = S.user.role === 'manager' ? 'dashboard' : 'home';
  if (page === 'reminder') { location.hash = '#/' + fallback; return handleReminderAction(arg); }
  const view = views[page] || views[fallback];
  try { await view(arg); } catch (e) { toast(e.message, true); }
}
window.addEventListener('hashchange', router);
document.addEventListener('click', e => {
  if (e.target.closest('a[href="#demo-export"]')) { e.preventDefault(); toast('التصدير إلى Excel يعمل بعد ربط التطبيق بخادم الشركة'); }
});

async function boot() {
  try {
    const b = await api('GET', '/api/bootstrap');
    Object.assign(S, b);
  } catch { return renderLogin(); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  startTimers();
  router();
}

// ================= واجهة المدير =================
const managerViews = {
  async dashboard() {
    const sm = await api('GET', '/api/summary');
    S.pendingBadge = sm.totals.pendingCount;
    const th = S.settings.lowBalanceThreshold || 0;
    const balClass = v => v < 0 ? 'neg' : v <= th ? 'low' : 'pos';
    const maxSpent = Math.max(1, ...sm.projects.map(p => Math.max(p.spent, p.budget || 0)));
    const content = `
      <div class="kpis">
        <div class="kpi"><div class="label">إجمالي العهد المصروفة للموظفين</div><div class="value">${money(sm.totals.received)}</div></div>
        <div class="kpi"><div class="label">إجمالي ما تم صرفه</div><div class="value">${money(sm.totals.spent)}</div></div>
        <div class="kpi hero"><div class="label">المتبقي لدى الموظفين</div><div class="value">${money(sm.totals.remaining)}</div></div>
        <div class="kpi"><div class="label">مصروفات بانتظار المراجعة</div><div class="value"><span class="num">${sm.totals.pendingCount}</span></div><div class="sub"><a href="#/expenses?status=pending">مراجعة الآن ←</a></div></div>
      </div>
      <div class="card">
        <h2>أرصدة الموظفين <span class="muted">يتحدث تلقائياً كل دقيقة</span></h2>
        ${sm.employees.length ? `<div class="table-wrap"><table>
          <thead><tr><th>الموظف</th><th>استلم عهدة</th><th>صرف</th><th>المتبقي معه</th><th>بانتظار المراجعة</th><th class="hide-mobile">آخر مصروف</th><th class="hide-mobile">آخر رد على التنبيه</th><th></th></tr></thead>
          <tbody>${sm.employees.map(e => `<tr style="${e.active ? '' : 'opacity:.5'}">
            <td><b>${esc(e.name)}</b><div class="muted">${esc(e.jobTitle || '')}</div></td>
            <td class="amt">${money(e.received)}</td>
            <td class="amt">${money(e.spent)}</td>
            <td class="amt ${balClass(e.remaining)}">${money(e.remaining)}</td>
            <td>${e.pendingCount ? `<span class="tag pending">${e.pendingCount} — ${fmt(e.pendingAmount)}</span>` : '—'}</td>
            <td class="hide-mobile muted">${ago(e.lastExpenseAt)}</td>
            <td class="hide-mobile muted">${ago(e.lastCheckinAt)}</td>
            <td><div class="actions"><button class="btn sm primary" data-give="${e.id}">+ عهدة</button><a class="btn sm" href="#/statement/${e.id}">كشف حساب</a></div></td>
          </tr>`).join('')}</tbody></table></div>` : `<div class="empty">لا يوجد موظفون بعد. <a href="#/employees">أضف موظفاً</a></div>`}
      </div>
      <div class="card">
        <h2>المصروف حسب المشروع</h2>
        ${sm.projects.length ? `<div class="bars">${sm.projects.map(p => `
          <div class="bar-row"><div>${esc(p.name)}</div>
          <div class="bar ${p.budget && p.spent > p.budget ? 'over' : ''}" title="${p.budget ? 'الميزانية ' + fmt(p.budget) : ''}"><span style="width:${(p.spent / maxSpent * 100).toFixed(1)}%"></span></div>
          <div class="amt">${money(p.spent)}${p.budget ? `<div class="muted">من ${fmt(p.budget)}</div>` : ''}</div></div>`).join('')}</div>` : `<div class="empty">لا توجد مشاريع. <a href="#/projects">أضف مشروعاً</a></div>`}
      </div>`;
    shell('لوحة التحكم', content, `<a class="btn" href="${fileUrl('/api/export/summary.csv')}">⬇ تصدير الأرصدة</a><button class="btn primary" data-give="">+ صرف عهدة</button>`);
    $$('[data-give]').forEach(b => b.onclick = () => giveCustodyModal(b.dataset.give));
  },

  async expenses() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const list = await api('GET', '/api/expenses?' + q);
    const total = list.filter(e => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0);
    const opt = (arr, sel, all) => `<option value="">${all}</option>` + arr.map(x => `<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const content = `
      <div class="card no-print">
        <form id="flt" class="form">
          <div class="field"><label>الموظف</label><select name="employeeId">${opt(S.employees, q.get('employeeId'), 'الكل')}</select></div>
          <div class="field"><label>المشروع</label><select name="projectId">${opt(S.projects, q.get('projectId'), 'الكل')}</select></div>
          <div class="field"><label>الحالة</label><select name="status"><option value="">الكل</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${q.get('status') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>النوع</label><select name="category"><option value="">الكل</option>${S.settings.categories.map(c => `<option ${q.get('category') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>من تاريخ</label><input type="date" name="from" value="${esc(q.get('from') || '')}"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" name="to" value="${esc(q.get('to') || '')}"></div>
        </form>
      </div>
      <div class="card">
        <h2><span>${list.length} مصروف — الإجمالي ${money(total)}</span>${list.some(e => e.status === 'pending') ? '<button class="btn sm ok" id="approve-all">✓ اعتماد كل المعروض قيد المراجعة</button>' : ''}</h2>
        ${expenseTable(list, true)}
      </div>`;
    shell('المصروفات', content, `<a class="btn" href="${fileUrl('/api/export/expenses.csv?' + q)}">⬇ تصدير Excel</a><button class="btn" onclick="print()">🖨 طباعة</button>`);
    $('#flt').onchange = e => {
      const p = new URLSearchParams(Object.entries(formData(e.currentTarget)).filter(([, v]) => v));
      location.hash = '#/expenses' + (p.toString() ? '?' + p : '');
    };
    bindExpenseActions(list);
    const all = $('#approve-all');
    if (all) all.onclick = async () => {
      const pend = list.filter(e => e.status === 'pending');
      if (!await confirmBox(`اعتماد ${pend.length} مصروف؟`)) return;
      for (const e of pend) await api('PUT', '/api/expenses/' + e.id, { status: 'approved' });
      toast('تم الاعتماد'); router();
    };
  },

  async custodies() {
    const list = await api('GET', '/api/custodies');
    const pend = list.filter(c => c.status === 'pending');
    const content = `
      ${pend.length ? `<div class="card"><h2>عهد سجلها الموظفون بانتظار تأكيدك</h2>${custodyTable(pend, true)}</div>` : ''}
      <div class="card"><h2>سجل العهد</h2>${custodyTable(list, true)}</div>`;
    shell('العهد', content, `<button class="btn primary" id="give">+ صرف عهدة لموظف</button>`);
    $('#give').onclick = () => giveCustodyModal();
    bindCustodyActions();
  },

  async statement(id) {
    const emp = S.employees.find(e => e.id === id);
    if (!emp) { location.hash = '#/dashboard'; return; }
    const [cust, exps, sm] = await Promise.all([api('GET', '/api/custodies?employeeId=' + id), api('GET', '/api/expenses?employeeId=' + id), api('GET', '/api/summary')]);
    const bal = sm.employees.find(e => e.id === id);
    // كشف حساب بترتيب زمني مع الرصيد الجاري
    const rows = [
      ...cust.filter(c => c.status !== 'rejected').map(c => ({ date: c.date, at: c.createdAt, desc: `استلام عهدة (${c.method})${c.note ? ' — ' + c.note : ''}`, in: c.amount, out: 0, status: c.status })),
      ...exps.filter(e => e.status !== 'rejected').map(e => ({ date: e.date, at: e.createdAt, desc: `${e.category}: ${e.description}`, project: e.projectName, in: 0, out: e.amount, status: e.status })),
    ].sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at));
    let run = 0;
    const content = `
      <div class="kpis">
        <div class="kpi"><div class="label">إجمالي العهد</div><div class="value">${money(bal.received)}</div></div>
        <div class="kpi"><div class="label">إجمالي المصروف</div><div class="value">${money(bal.spent)}</div></div>
        <div class="kpi hero"><div class="label">المتبقي مع ${esc(emp.name)}</div><div class="value">${money(bal.remaining)}</div></div>
      </div>
      <div class="card"><h2>كشف حساب العهدة — ${esc(emp.name)}</h2>
        ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المشروع</th><th>وارد (عهدة)</th><th>صادر (مصروف)</th><th>الرصيد</th><th>الحالة</th></tr></thead><tbody>
        ${rows.map(r => { run += r.in - r.out; return `<tr><td class="num">${r.date}</td><td>${esc(r.desc)}</td><td>${esc(r.project || '—')}</td><td class="amt pos">${r.in ? fmt(r.in) : ''}</td><td class="amt neg">${r.out ? fmt(r.out) : ''}</td><td class="amt">${fmt(run)}</td><td>${statusTag(r.status)}</td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="empty">لا توجد حركات</div>'}
      </div>`;
    shell('كشف حساب', content, `<button class="btn" onclick="print()">🖨 طباعة</button><a class="btn" href="#/expenses?employeeId=${id}">المصروفات</a><button class="btn primary" id="give">+ عهدة</button>`);
    $('#give').onclick = () => giveCustodyModal(id);
  },

  async checkins() {
    const day = (location.hash.split('?d=')[1] || today());
    const list = await api('GET', '/api/checkins?date=' + day);
    const by = {};
    for (const c of list) (by[c.employeeId] = by[c.employeeId] || { name: c.employeeName, yes: 0, no: 0, last: null })[c.answer]++;
    for (const c of list) { const b = by[c.employeeId]; if (!b.last || c.at > b.last) b.last = c.at; }
    const emps = S.employees.filter(e => e.active);
    const content = `
      <div class="card no-print"><div class="form"><div class="field"><label>اليوم</label><input type="date" id="day" value="${day}"></div></div>
        <p class="muted">يصل الموظف تنبيه كل ${S.settings.reminderMinutes} دقيقة خلال ساعات العمل (${S.settings.workStart} – ${S.settings.workEnd}) يسأله: هل صرفت شيئاً؟ ولأي مشروع؟ هنا ترى تفاعل كل موظف مع التنبيهات.</p></div>
      <div class="card"><h2>تفاعل الموظفين مع التنبيهات</h2>
        ${emps.length ? `<div class="table-wrap"><table><thead><tr><th>الموظف</th><th>أجاب "نعم صرفت"</th><th>أجاب "لم أصرف"</th><th>آخر رد</th></tr></thead><tbody>
        ${emps.map(e => { const b = by[e.id] || { yes: 0, no: 0 }; return `<tr><td><b>${esc(e.name)}</b></td><td class="num">${b.yes}</td><td class="num">${b.no}</td><td>${b.last ? new Date(b.last).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }) : '<span class="tag rejected">لم يرد</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="empty">لا يوجد موظفون</div>'}
      </div>`;
    shell('متابعة التنبيهات', content);
    $('#day').onchange = e => location.hash = '#/checkins?d=' + e.target.value;
  },

  async employees() {
    const sm = await api('GET', '/api/summary');
    S.employees = sm.employees;
    const content = `<div class="card"><h2>الموظفون</h2>
      ${sm.employees.length ? `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الجوال</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${sm.employees.map(e => `<tr><td><b>${esc(e.name)}</b><div class="muted">${esc(e.jobTitle || '')}</div></td><td class="num">${esc(e.username)}</td><td class="num">${esc(e.phone || '')}</td><td class="amt">${money(e.remaining)}</td>
        <td>${e.active ? '<span class="tag approved">نشط</span>' : '<span class="tag rejected">موقوف</span>'}</td>
        <td><div class="actions"><button class="btn sm" data-edit="${e.id}">تعديل</button><a class="btn sm" href="#/statement/${e.id}">كشف حساب</a></div></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لم تضف أي موظف بعد</div>'}</div>`;
    shell('الموظفون', content, `<button class="btn primary" id="add">+ موظف جديد</button>`);
    $('#add').onclick = () => employeeModal();
    $$('[data-edit]').forEach(b => b.onclick = () => employeeModal(sm.employees.find(e => e.id === b.dataset.edit)));
  },

  async projects() {
    const sm = await api('GET', '/api/summary');
    S.projects = sm.projects;
    const content = `<div class="card"><h2>المشاريع</h2>
      ${sm.projects.length ? `<div class="table-wrap"><table><thead><tr><th>المشروع</th><th>الرمز</th><th>الميزانية</th><th>المصروف من العهد</th><th>عدد المصروفات</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${sm.projects.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.code || '—')}</td><td class="amt">${p.budget ? money(p.budget) : '—'}</td><td class="amt ${p.budget && p.spent > p.budget ? 'neg' : ''}">${money(p.spent)}</td><td class="num">${p.count}</td>
        <td>${p.active ? '<span class="tag approved">جارٍ</span>' : '<span class="tag rejected">مغلق</span>'}</td>
        <td><div class="actions"><button class="btn sm" data-edit="${p.id}">تعديل</button><a class="btn sm" href="#/expenses?projectId=${p.id}">المصروفات</a></div></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">أضف المشاريع ليختار الموظف المشروع التابع له كل مصروف</div>'}</div>`;
    shell('المشاريع', content, `<button class="btn primary" id="add">+ مشروع جديد</button>`);
    $('#add').onclick = () => projectModal();
    $$('[data-edit]').forEach(b => b.onclick = () => projectModal(sm.projects.find(p => p.id === b.dataset.edit)));
  },

  async settings() {
    const s = S.settings;
    const content = `
      <div class="card"><h2>إعدادات العمل والتنبيهات</h2>
        <form id="set-form" class="form">
          <div class="field"><label>اسم الشركة</label><input name="companyName" value="${esc(s.companyName)}"></div>
          <div class="field"><label>العملة</label><input name="currency" value="${esc(s.currency)}"></div>
          <div class="field"><label>بداية الدوام</label><input type="time" name="workStart" value="${s.workStart}"></div>
          <div class="field"><label>نهاية الدوام</label><input type="time" name="workEnd" value="${s.workEnd}"></div>
          <div class="field"><label>التنبيه كل (دقيقة)</label><input type="number" min="5" max="240" name="reminderMinutes" value="${s.reminderMinutes}"></div>
          <div class="field"><label>تنبيه انخفاض الرصيد عند أقل من</label><input type="number" min="0" name="lowBalanceThreshold" value="${s.lowBalanceThreshold}"></div>
          <div class="field full"><label>أيام العمل</label><div class="chips" id="days">${DAYS.map((d, i) => `<button type="button" class="chip ${s.workDays.includes(i) ? 'on' : ''}" data-d="${i}">${d}</button>`).join('')}</div></div>
          <div class="field full"><label>أنواع المصروفات (نوع في كل سطر)</label><textarea name="categories" rows="6">${esc(s.categories.join('\n'))}</textarea></div>
          <div class="full"><button class="btn primary">حفظ الإعدادات</button></div>
        </form>
      </div>
      ${passwordCard()}`;
    shell('الإعدادات', content);
    $$('#days .chip').forEach(c => c.onclick = () => c.classList.toggle('on'));
    $('#set-form').onsubmit = e => {
      e.preventDefault();
      submitWith(e.submitter, async () => {
        const d = formData(e.target);
        d.categories = d.categories.split('\n');
        d.workDays = $$('#days .chip.on').map(c => +c.dataset.d);
        S.settings = await api('PUT', '/api/settings', d);
        toast('تم حفظ الإعدادات');
      });
    };
    bindPasswordForm();
  },
};

function expenseTable(list, manager) {
  if (!list.length) return '<div class="empty">لا توجد مصروفات</div>';
  return `<div class="table-wrap"><table><thead><tr><th>التاريخ</th>${manager ? '<th>الموظف</th>' : ''}<th>المشروع</th><th>النوع / البيان</th><th>المبلغ</th><th>الحالة</th><th class="no-print"></th></tr></thead><tbody>
  ${list.map(e => `<tr>
    <td><span class="num">${e.date}</span><div class="muted num">${esc(e.time || '')}</div></td>
    ${manager ? `<td>${esc(e.employeeName)}</td>` : ''}
    <td>${esc(e.projectName)}</td>
    <td><b>${esc(e.category)}</b> — ${esc(e.description)}${e.vendor ? `<div class="muted">المورد: ${esc(e.vendor)}</div>` : ''}${e.managerNote ? `<div class="muted">ملاحظة المدير: ${esc(e.managerNote)}</div>` : ''}${e.viaReminder ? '<div class="muted">🔔 سُجل من التنبيه</div>' : ''}</td>
    <td class="amt">${money(e.amount)}</td>
    <td>${statusTag(e.status)}</td>
    <td class="no-print"><div class="actions">
      ${e.receipt ? `<button class="btn sm" data-receipt="${esc(e.receipt)}">📎 الإيصال</button>` : ''}
      ${manager && e.status !== 'approved' ? `<button class="btn sm ok" data-st="approved" data-id="${e.id}">اعتماد</button>` : ''}
      ${manager && e.status !== 'rejected' ? `<button class="btn sm bad" data-st="rejected" data-id="${e.id}">رفض</button>` : ''}
      ${!manager && e.status === 'pending' ? `<button class="btn sm" data-edit="${e.id}">تعديل</button><button class="btn sm bad" data-del="${e.id}">حذف</button>` : ''}
    </div></td></tr>`).join('')}</tbody></table></div>`;
}
function bindExpenseActions(list) {
  $$('[data-receipt]').forEach(b => b.onclick = () => modal(`<h3>صورة الإيصال</h3><img class="receipt-img" src="${fileUrl('/api/receipts/' + b.dataset.receipt)}" alt="إيصال"><div class="foot"><button class="btn" data-close>إغلاق</button></div>`));
  $$('[data-st]').forEach(b => b.onclick = async () => {
    let note;
    if (b.dataset.st === 'rejected') {
      note = await new Promise(res => modal(`<h3>سبب الرفض</h3><div class="field"><textarea id="rn" placeholder="اختياري"></textarea></div><div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn bad" id="rok">رفض المصروف</button></div>`,
        { onMount: (el, close) => $('#rok', el).onclick = () => { res($('#rn', el).value); close(); } }));
      if (note === undefined) return;
    }
    submitWith(b, async () => {
      await api('PUT', '/api/expenses/' + b.dataset.id, { status: b.dataset.st, ...(note !== undefined ? { managerNote: note } : {}) });
      toast(b.dataset.st === 'approved' ? 'تم اعتماد المصروف' : 'تم رفض المصروف');
      router();
    });
  });
  $$('[data-del]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('حذف هذا المصروف؟')) return;
    submitWith(b, async () => { await api('DELETE', '/api/expenses/' + b.dataset.del); toast('تم الحذف'); router(); });
  });
  $$('[data-edit]').forEach(b => b.onclick = () => expenseModal({ expense: list.find(e => e.id === b.dataset.edit) }));
}

function custodyTable(list, manager) {
  if (!list.length) return '<div class="empty">لا توجد عهد مسجلة</div>';
  return `<div class="table-wrap"><table><thead><tr><th>التاريخ</th>${manager ? '<th>الموظف</th>' : ''}<th>المبلغ</th><th>طريقة الاستلام</th><th>ملاحظات</th><th>الحالة</th><th class="no-print"></th></tr></thead><tbody>
  ${list.map(c => `<tr><td class="num">${c.date}</td>${manager ? `<td>${esc(c.employeeName)}</td>` : ''}<td class="amt pos">${money(c.amount)}</td><td>${esc(c.method)}</td><td>${esc(c.note || '—')}</td>
    <td>${c.status === 'pending' ? '<span class="tag pending">بانتظار تأكيد المدير</span>' : statusTag(c.status)}</td>
    <td class="no-print"><div class="actions">
      ${manager && c.status !== 'approved' ? `<button class="btn sm ok" data-cst="approved" data-id="${c.id}">تأكيد</button>` : ''}
      ${manager && c.status !== 'rejected' ? `<button class="btn sm bad" data-cst="rejected" data-id="${c.id}">إلغاء</button>` : ''}
      ${!manager && c.status === 'pending' ? `<button class="btn sm bad" data-cdel="${c.id}">حذف</button>` : ''}
    </div></td></tr>`).join('')}</tbody></table></div>`;
}
function bindCustodyActions() {
  $$('[data-cst]').forEach(b => b.onclick = () => submitWith(b, async () => {
    await api('PUT', '/api/custodies/' + b.dataset.id, { status: b.dataset.cst });
    toast('تم التحديث'); router();
  }));
  $$('[data-cdel]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('حذف هذا السجل؟')) return;
    submitWith(b, async () => { await api('DELETE', '/api/custodies/' + b.dataset.cdel); toast('تم الحذف'); router(); });
  });
}

function giveCustodyModal(employeeId = '') {
  const emps = S.employees.filter(e => e.active);
  if (!emps.length) return toast('أضف موظفاً أولاً', true);
  modal(`<h3>صرف عهدة لموظف</h3>
    <form class="form" id="gc">
      <div class="field full"><label>الموظف</label><select name="employeeId" required><option value="">اختر الموظف</option>${emps.map(e => `<option value="${e.id}" ${e.id === employeeId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
      <div class="field full"><label>مبلغ العهدة (${esc(S.settings.currency)})</label><input class="amount-input" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required></div>
      <div class="field"><label>التاريخ</label><input type="date" name="date" value="${today()}"></div>
      <div class="field"><label>طريقة التسليم</label><select name="method"><option>نقداً</option><option>تحويل بنكي</option><option>شيك</option></select></div>
      <div class="field full"><label>ملاحظات</label><input name="note" placeholder="مثال: عهدة مشتريات الأسبوع"></div>
    </form>
    <div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn primary" id="gc-ok">صرف العهدة</button></div>`, {
    onMount: (el, close) => $('#gc-ok', el).onclick = e => {
      const f = $('#gc', el); if (!f.reportValidity()) return;
      submitWith(e.target, async () => { await api('POST', '/api/custodies', formData(f)); close(); toast('تم تسجيل العهدة'); router(); });
    },
  });
}

function employeeModal(emp) {
  modal(`<h3>${emp ? 'تعديل موظف' : 'إضافة موظف'}</h3>
    <form class="form" id="ef">
      <div class="field"><label>الاسم الكامل</label><input name="name" required value="${esc(emp?.name || '')}"></div>
      <div class="field"><label>المسمى الوظيفي</label><input name="jobTitle" value="${esc(emp?.jobTitle || '')}"></div>
      <div class="field"><label>الجوال</label><input name="phone" inputmode="tel" value="${esc(emp?.phone || '')}"></div>
      <div class="field"><label>اسم المستخدم للدخول</label><input name="username" ${emp ? 'disabled' : 'required'} value="${esc(emp?.username || '')}" dir="ltr"></div>
      <div class="field"><label>${emp ? 'كلمة مرور جديدة (اتركها فارغة)' : 'كلمة المرور'}</label><input name="password" ${emp ? '' : 'required minlength="4"'} dir="ltr"></div>
      ${emp ? `<div class="field"><label>الحالة</label><select name="active"><option value="1" ${emp.active ? 'selected' : ''}>نشط</option><option value="0" ${emp.active ? '' : 'selected'}>موقوف</option></select></div>` : ''}
    </form>
    <div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn primary" id="ef-ok">حفظ</button></div>`, {
    onMount: (el, close) => $('#ef-ok', el).onclick = e => {
      const f = $('#ef', el); if (!f.reportValidity()) return;
      submitWith(e.target, async () => {
        const d = formData(f);
        if (emp) { d.active = d.active === '1'; await api('PUT', '/api/users/' + emp.id, d); } else await api('POST', '/api/users', d);
        S.employees = (await api('GET', '/api/bootstrap')).employees;
        close(); toast('تم الحفظ'); router();
      });
    },
  });
}

function projectModal(p) {
  modal(`<h3>${p ? 'تعديل مشروع' : 'مشروع جديد'}</h3>
    <form class="form" id="pf">
      <div class="field full"><label>اسم المشروع</label><input name="name" required value="${esc(p?.name || '')}"></div>
      <div class="field"><label>رمز المشروع</label><input name="code" value="${esc(p?.code || '')}"></div>
      <div class="field"><label>ميزانية المصروفات النثرية (اختياري)</label><input name="budget" type="number" min="0" value="${p?.budget || ''}"></div>
      ${p ? `<div class="field"><label>الحالة</label><select name="active"><option value="1" ${p.active ? 'selected' : ''}>جارٍ</option><option value="0" ${p.active ? '' : 'selected'}>مغلق</option></select></div>` : ''}
    </form>
    <div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn primary" id="pf-ok">حفظ</button></div>`, {
    onMount: (el, close) => $('#pf-ok', el).onclick = e => {
      const f = $('#pf', el); if (!f.reportValidity()) return;
      submitWith(e.target, async () => {
        const d = formData(f);
        if (p) { d.active = d.active === '1'; await api('PUT', '/api/projects/' + p.id, d); } else await api('POST', '/api/projects', d);
        S.projects = (await api('GET', '/api/bootstrap')).projects;
        close(); toast('تم الحفظ'); router();
      });
    },
  });
}

function passwordCard() {
  const demo = window.DEMO ? `<div class="card"><h2>الوضع التجريبي <button class="btn sm bad" onclick="DEMO.reset()">مسح وإعادة البيانات التجريبية</button></h2><p class="muted">البيانات الحالية وهمية ومحفوظة على هذا الجهاز فقط. للاستخدام الفعلي اربط التطبيق بخادم الشركة.</p></div>` : '';
  const server = NATIVE ? `<div class="card"><h2>عنوان الخادم <button class="btn sm" onclick="AndroidBridge.changeServer()">${window.DEMO ? 'الربط بخادم الشركة' : 'تغيير'}</button></h2><div class="num muted">${window.DEMO ? 'وضع تجريبي (بدون خادم)' : esc(NATIVE.getServer())}</div></div>` : '';
  const account = `<div class="card"><h2><span>${esc(S.user.name)} <span class="muted">(${S.user.role === 'manager' ? 'مدير' : 'موظف'})</span></span><button class="btn sm bad" onclick="logout()">تسجيل الخروج</button></h2></div>`;
  return account + demo + server + `<div class="card"><h2>تغيير كلمة المرور</h2><form id="pw" class="form">
    <div class="field"><label>كلمة المرور الحالية</label><input type="password" name="oldPassword" required></div>
    <div class="field"><label>كلمة المرور الجديدة</label><input type="password" name="newPassword" required minlength="4"></div>
    <div class="full"><button class="btn primary">تغيير</button></div></form></div>`;
}
function bindPasswordForm() {
  $('#pw').onsubmit = e => {
    e.preventDefault();
    submitWith(e.submitter, async () => { await api('POST', '/api/password', formData(e.target)); e.target.reset(); toast('تم تغيير كلمة المرور'); });
  };
}

// ================= واجهة الموظف =================
const employeeViews = {
  async home() {
    const my = await api('GET', '/api/my');
    const b = my.balance;
    const low = b.remaining <= (S.settings.lowBalanceThreshold || 0);
    const next = nextReminderAt();
    const content = `
      ${notifNotice()}
      ${low ? `<div class="notice">⚠ رصيد عهدتك ${b.remaining < 0 ? 'بالسالب — صرفت أكثر من العهدة المستلمة' : 'منخفض'}، تواصل مع المدير.</div>` : ''}
      <div class="kpis">
        <div class="kpi hero"><div class="label">المتبقي معك من العهدة</div><div class="value">${money(b.remaining)}</div><div class="sub">${next ? `التنبيه القادم: ${next}` : 'خارج أوقات الدوام — لا توجد تنبيهات'}</div></div>
        <div class="kpi"><div class="label">إجمالي العهد المستلمة</div><div class="value">${money(b.received)}</div></div>
        <div class="kpi"><div class="label">إجمالي ما صرفته</div><div class="value">${money(b.spent)}</div><div class="sub">${b.pendingCount ? `${b.pendingCount} بانتظار مراجعة المدير` : 'كل المصروفات تمت مراجعتها'}</div></div>
      </div>
      <div class="actions" style="margin-bottom:16px"><a class="btn primary lg" href="#/add">➕ تسجيل مصروف جديد</a></div>
      <div class="card"><h2>آخر المصروفات <a class="btn sm" href="#/history">عرض الكل</a></h2>
        ${my.expenses.length ? my.expenses.slice(0, 6).map(e => `<div class="list-item"><div><div class="title">${esc(e.category)} — ${esc(e.description)}</div><div class="muted">${esc(e.projectName)} · <span class="num">${e.date} ${esc(e.time || '')}</span></div></div><div style="text-align:end"><div class="amt">${money(e.amount)}</div>${statusTag(e.status)}</div></div>`).join('') : '<div class="empty">لم تسجل أي مصروف بعد</div>'}
      </div>`;
    shell(`أهلاً ${esc(S.user.name.split(' ')[0])}`, content, `<button class="btn" id="test-rem">🔔 تجربة التنبيه</button>`);
    bindNotifNotice();
    $('#test-rem').onclick = () => NATIVE ? NATIVE.testReminder() : showReminder(true);
  },

  async add() {
    shell('تسجيل مصروف جديد', `<div class="card">${expenseFormHtml()}</div>`);
    bindExpenseForm($('.card'), null, () => { location.hash = '#/home'; });
  },

  async history() {
    const list = await api('GET', '/api/expenses');
    const total = list.filter(e => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0);
    shell('مصروفاتي', `<div class="card"><h2>${list.length} مصروف — الإجمالي ${money(total)}</h2>${expenseTable(list, false)}</div>`, `<a class="btn" href="${fileUrl('/api/export/expenses.csv')}">⬇ تصدير</a>`);
    bindExpenseActions(list);
  },

  async received() {
    const my = await api('GET', '/api/my');
    shell('العهد المستلمة', `
      <div class="card"><h2>العهد التي استلمتها <span class="muted">الإجمالي ${money(my.balance.received)}</span></h2>${custodyTable(my.custodies, false)}</div>
      <p class="muted">العهد التي يصرفها المدير تظهر هنا تلقائياً. إذا استلمت مبلغاً لم يُسجل، سجّله وسيظهر للمدير لتأكيده.</p>`,
      `<button class="btn primary" id="add-c">+ تسجيل عهدة استلمتها</button>`);
    bindCustodyActions();
    $('#add-c').onclick = () => modal(`<h3>تسجيل عهدة مستلمة</h3><form class="form" id="rc">
        <div class="field full"><label>المبلغ المستلم (${esc(S.settings.currency)})</label><input class="amount-input" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required></div>
        <div class="field"><label>التاريخ</label><input type="date" name="date" value="${today()}"></div>
        <div class="field"><label>طريقة الاستلام</label><select name="method"><option>نقداً</option><option>تحويل بنكي</option><option>شيك</option></select></div>
        <div class="field full"><label>ملاحظات</label><input name="note"></div></form>
        <div class="foot"><button class="btn" data-close>إلغاء</button><button class="btn primary" id="rc-ok">حفظ</button></div>`, {
      onMount: (el, close) => $('#rc-ok', el).onclick = e => {
        const f = $('#rc', el); if (!f.reportValidity()) return;
        submitWith(e.target, async () => { await api('POST', '/api/custodies', formData(f)); close(); toast('تم التسجيل وبانتظار تأكيد المدير'); router(); });
      },
    });
  },

  async settings() {
    shell('الإعدادات', `${notifNotice(true)}
      <div class="card"><h2>التنبيهات</h2><p>يصلك تنبيه كل <b>${S.settings.reminderMinutes}</b> دقيقة خلال الدوام (<span class="num">${S.settings.workStart} – ${S.settings.workEnd}</span>) أيام: ${S.settings.workDays.map(d => DAYS[d]).join('، ')}.</p>
      <p class="muted">${NATIVE ? 'التنبيهات تصلك كإشعار على الجوال حتى لو كان التطبيق مغلقاً، ويمكنك الرد بـ «لا، لم أصرف» من الإشعار مباشرة.' : 'لضمان وصول التنبيهات: اسمح بالإشعارات، وأضف التطبيق إلى الشاشة الرئيسية، واتركه مفتوحاً في الخلفية أثناء الدوام.'}</p></div>
      ${passwordCard()}`);
    bindNotifNotice();
    bindPasswordForm();
  },
};

function expenseFormHtml(e = {}) {
  const projects = S.projects.filter(p => p.active);
  const lastProject = e.projectId || store.get('last_project_' + S.user.id) || '';
  return `<form class="form" id="xf">
    <div class="field full"><label>المبلغ المصروف (${esc(S.settings.currency)})</label><input class="amount-input" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required value="${e.amount || ''}" placeholder="0"></div>
    <div class="field full"><label>هذا المصروف تابع لأي مشروع؟</label>
      ${projects.length ? `<div class="chips" id="proj">${projects.map(p => `<button type="button" class="chip ${p.id === lastProject ? 'on' : ''}" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>` : '<div class="notice">لا توجد مشاريع — اطلب من المدير إضافتها</div>'}
    </div>
    <div class="field full"><label>نوع المصروف</label><div class="chips" id="cat">${S.settings.categories.map(c => `<button type="button" class="chip ${c === e.category ? 'on' : ''}">${esc(c)}</button>`).join('')}</div></div>
    <div class="field full"><label>البيان (ماذا اشتريت / لماذا)</label><input name="description" required value="${esc(e.description || '')}" placeholder="مثال: أسمنت 10 أكياس"></div>
    <div class="field"><label>المورد / المحل (اختياري)</label><input name="vendor" value="${esc(e.vendor || '')}"></div>
    <div class="field"><label>التاريخ</label><input type="date" name="date" value="${e.date || today()}"></div>
    ${e.id ? '' : `<div class="field"><label>الوقت</label><input type="time" name="time" value="${nowTime()}"></div>
    <div class="field full"><label>صورة الإيصال / الفاتورة (اختياري)</label><input type="file" name="receiptFile" accept="image/*" capture="environment"></div>`}
    <div class="full"><button class="btn primary lg">${e.id ? 'حفظ التعديل' : 'حفظ المصروف'}</button></div>
  </form>`;
}
function bindExpenseForm(root, expense, done, viaReminder = false) {
  const f = $('#xf', root);
  $$('#proj .chip, #cat .chip', root).forEach(c => c.onclick = () => { $$('.chip', c.parentNode).forEach(x => x.classList.remove('on')); c.classList.add('on'); });
  f.onsubmit = ev => {
    ev.preventDefault();
    const projectId = $('#proj .chip.on', root)?.dataset.id;
    const category = $('#cat .chip.on', root)?.textContent;
    if (!projectId) return toast('اختر المشروع التابع له المصروف', true);
    if (!category) return toast('اختر نوع المصروف', true);
    submitWith(ev.submitter || $('button.primary', f), async () => {
      const d = formData(f);
      delete d.receiptFile;
      const file = f.receiptFile?.files[0];
      if (file) d.receipt = await compressImage(file);
      Object.assign(d, { projectId, category, viaReminder });
      if (expense) await api('PUT', '/api/expenses/' + expense.id, d); else await api('POST', '/api/expenses', d);
      store.set('last_project_' + S.user.id, projectId);
      resetReminderClock();
      toast('تم حفظ المصروف ✓');
      done();
    });
  };
}
function expenseModal({ expense, viaReminder } = {}) {
  modal(`<h3>${expense ? 'تعديل مصروف' : 'تسجيل مصروف'}</h3>${expenseFormHtml(expense)}<div class="foot"><button class="btn" data-close>إلغاء</button></div>`, {
    onMount: (el, close) => bindExpenseForm(el, expense, () => { close(); router(); }, viaReminder),
  });
}

// ================= التنبيهات كل نصف ساعة =================
let timers = [];
function stopTimers() { timers.forEach(clearInterval); timers = []; NATIVE?.stopReminders(); }
function startTimers() {
  stopTimers();
  if (S.user.role === 'employee' && NATIVE) {
    const s = S.settings;
    NATIVE.startReminders(JSON.stringify({ token: S.token, workStart: s.workStart, workEnd: s.workEnd, workDays: s.workDays, minutes: s.reminderMinutes }));
  } else if (S.user.role === 'employee') {
    if (!store.get(remKey())) resetReminderClock();
    timers.push(setInterval(reminderTick, 20000));
    reminderTick();
    navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'reminder-action') handleReminderAction(e.data.answer); });
  } else {
    // تحديث لوحة المدير تلقائياً
    timers.push(setInterval(() => {
      const page = location.hash.split('?')[0].split('/')[1] || 'dashboard';
      if (page === 'dashboard' && !$('.modal-back')) router();
    }, 60000));
  }
}
const remKey = () => 'last_reminder_' + S.user.id;
const resetReminderClock = () => { store.set(remKey(), String(Date.now())); NATIVE?.snooze(); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function inWorkHours(d = new Date()) {
  const s = S.settings, m = d.getHours() * 60 + d.getMinutes();
  return s.workDays.includes(d.getDay()) && m >= toMin(s.workStart) && m <= toMin(s.workEnd);
}
function nextReminderAt() {
  if (NATIVE) return inWorkHours() ? `كل ${S.settings.reminderMinutes} دقيقة` : null;
  const last = Number(store.get(remKey())) || Date.now();
  const t = new Date(Math.max(Date.now(), last + S.settings.reminderMinutes * 6e4));
  return inWorkHours(t) ? t.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }) : null;
}
function reminderTick() {
  if (!S.user || !inWorkHours()) return;
  const last = Number(store.get(remKey())) || 0;
  if (Date.now() - last >= S.settings.reminderMinutes * 6e4) showReminder();
}
async function showReminder(test = false) {
  resetReminderClock();
  if ($('#reminder')) return;
  beep();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  // إشعار النظام (يظهر حتى لو كان التطبيق في الخلفية)
  if (!NATIVE && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const opts = { body: 'هل صرفت شيئاً خلال آخر نصف ساعة؟ ولأي مشروع؟', icon: '/icon.svg', badge: '/icon.svg', tag: 'custody-reminder', renotify: true, requireInteraction: true, dir: 'rtl', lang: 'ar',
        actions: [{ action: 'yes', title: 'نعم، سأسجل' }, { action: 'no', title: 'لا، لم أصرف' }] };
      if (reg) reg.showNotification('🔔 تذكير العهدة', opts); else new Notification('🔔 تذكير العهدة', opts);
    } catch {}
  }
  modal(`<div class="reminder-box" id="reminder">
      <div class="bell">🔔</div>
      <div class="q">هل صرفت شيئاً من العهدة؟</div>
      <div class="muted">خلال آخر ${S.settings.reminderMinutes} دقيقة${test ? ' (تنبيه تجريبي)' : ''}</div>
      <div class="yesno"><button class="btn primary lg" id="r-yes">نعم، صرفت</button><button class="btn lg" id="r-no">لا، لم أصرف</button></div>
    </div>`, {
    onMount: (el, close) => {
      $('#r-yes', el).onclick = () => { close(); expenseModal({ viaReminder: true }); };
      $('#r-no', el).onclick = async () => { close(); await api('POST', '/api/checkins', { answer: 'no' }).catch(() => {}); toast('شكراً، سنذكرك لاحقاً'); };
    },
  });
}
function handleReminderAction(answer) {
  $('#reminder')?.closest('.modal-back')?.remove();
  if (answer === 'no') { api('POST', '/api/checkins', { answer: 'no' }).catch(() => {}); toast('شكراً، سنذكرك لاحقاً'); }
  else if (answer === 'yes') expenseModal({ viaReminder: true });
  else showReminder();
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}
function notifNotice(always) {
  if (NATIVE) {
    if (NATIVE.notificationsEnabled()) return always ? '<div class="notice" style="background:var(--ok-bg);color:var(--ok)">✓ الإشعارات مفعّلة وتصلك حتى والتطبيق مغلق</div>' : '';
    return `<div class="notice">🔔 اسمح بالإشعارات ليصلك تذكير كل نصف ساعة <button class="btn sm primary" id="enable-notif">السماح بالإشعارات</button></div>`;
  }
  if (!('Notification' in window)) return always ? '<div class="notice">متصفحك لا يدعم الإشعارات — ستظهر التنبيهات داخل التطبيق فقط</div>' : '';
  if (Notification.permission === 'granted') return always ? '<div class="notice" style="background:var(--ok-bg);color:var(--ok)">✓ الإشعارات مفعّلة</div>' : '';
  return `<div class="notice">🔔 فعّل الإشعارات ليصلك تذكير كل نصف ساعة حتى لو كان التطبيق في الخلفية <button class="btn sm primary" id="enable-notif">تفعيل الإشعارات</button></div>`;
}
function bindNotifNotice() {
  const b = $('#enable-notif');
  if (b && NATIVE) b.onclick = () => { NATIVE.requestNotifications(); setTimeout(router, 4000); };
  else if (b) b.onclick = async () => {
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'تم تفعيل الإشعارات' : 'لم يتم السماح بالإشعارات', p !== 'granted');
    router();
  };
}

// ---------- البدء ----------
if (S.token) boot(); else renderLogin();
