// الوضع التجريبي: يشغّل التطبيق كاملاً بدون خادم، والبيانات محفوظة على هذا الجهاز فقط.
// يعمل داخل تطبيق أندرويد عند اختيار "تجربة التطبيق"، أو في المتصفح بإضافة ?demo للرابط.
'use strict';
(function () {
  if (location.hostname !== 'app.local' && !new URLSearchParams(location.search).has('demo')) return;

  const KEY = 'custody_demo_db';
  const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
  const now = () => new Date().toISOString();
  const day = (offset = 0) => { const d = new Date(Date.now() - offset * 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const num = v => Math.round((Number(v) || 0) * 100) / 100;
  const fail = msg => { throw new Error(msg); };

  function seed() {
    const u = (name, username, role, jobTitle) => ({ id: uid(), name, username, password: role === 'manager' ? 'admin' : '1234', role, jobTitle, phone: '', active: true });
    const users = [u('المدير', 'admin', 'manager', ''), u('محمد أحمد', 'mohamed', 'employee', 'مشرف موقع'), u('خالد سعيد', 'khaled', 'employee', 'مندوب مشتريات'), u('عمر حسن', 'omar', 'employee', 'سائق')];
    const projects = [['برج الريان', 15000], ['فيلا النخيل', 8000], ['مستودع الصناعية', 6000]].map(([name, budget]) => ({ id: uid(), name, code: '', budget, active: true, createdAt: now() }));
    const [, m, k, o] = users;
    const custodies = [[m, 5000], [k, 3000], [o, 1500]].map(([e, amount]) => ({ id: uid(), employeeId: e.id, amount, date: day(2), method: 'نقداً', note: 'عهدة الأسبوع', status: 'approved', createdAt: new Date(Date.now() - 2 * 864e5).toISOString() }));
    const x = (e, p, amount, category, description, vendor, status, ago) => ({ id: uid(), employeeId: e.id, projectId: projects[p].id, amount, category, description, vendor, date: day(ago), time: '10:30', receipt: null, status, managerNote: status === 'rejected' ? 'بدون إيصال' : '', viaReminder: true, createdAt: new Date(Date.now() - ago * 864e5).toISOString() });
    const expenses = [
      x(m, 0, 1250, 'مواد', 'أسمنت 25 كيس', 'مؤسسة الإعمار', 'approved', 1), x(m, 1, 380, 'نقل ومواصلات', 'نقل حديد للموقع', '', 'pending', 0),
      x(m, 0, 600, 'عمالة يومية', 'عمال تحميل 4 أشخاص', '', 'pending', 0), x(k, 2, 940, 'أدوات ومعدات', 'مثقاب وعدد يدوية', 'محل الأدوات', 'approved', 1),
      x(k, 1, 210, 'إعاشة', 'وجبات العمال', '', 'rejected', 1), x(o, 0, 300, 'وقود', 'تعبئة ديزل للشاحنة', 'محطة الوقود', 'pending', 0),
    ];
    return {
      users, projects, custodies, expenses, checkins: [], sessions: {},
      settings: { companyName: 'شركتي (تجريبي)', currency: 'ر.س', workStart: '08:00', workEnd: '17:00', workDays: [0, 1, 2, 3, 4], reminderMinutes: 30, lowBalanceThreshold: 200,
        categories: ['مواد', 'نقل ومواصلات', 'وقود', 'إعاشة', 'عمالة يومية', 'أدوات ومعدات', 'صيانة', 'رسوم حكومية', 'أخرى'] },
    };
  }
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { } };
  save();

  const publicUser = u => u && ({ id: u.id, name: u.name, username: u.username, role: u.role, phone: u.phone, jobTitle: u.jobTitle, active: u.active });
  const nameOf = id => (db.users.find(u => u.id === id) || {}).name || '—';
  const projOf = id => (db.projects.find(p => p.id === id) || {}).name || '—';
  const decExp = e => ({ ...e, employeeName: nameOf(e.employeeId), projectName: projOf(e.projectId) });
  const decCus = c => ({ ...c, employeeName: nameOf(c.employeeId) });
  const byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt);

  function balanceOf(id) {
    const received = db.custodies.filter(c => c.employeeId === id && c.status !== 'rejected').reduce((s, c) => s + c.amount, 0);
    const exps = db.expenses.filter(e => e.employeeId === id && e.status !== 'rejected');
    const spent = exps.reduce((s, e) => s + e.amount, 0);
    const pending = exps.filter(e => e.status === 'pending');
    return { received: num(received), spent: num(spent), remaining: num(received - spent), pendingCount: pending.length, pendingAmount: num(pending.reduce((s, e) => s + e.amount, 0)) };
  }
  function summary() {
    const last = (list, key) => list.sort((a, b) => b[key].localeCompare(a[key]))[0];
    const employees = db.users.filter(u => u.role === 'employee').map(u => ({
      ...publicUser(u), ...balanceOf(u.id),
      lastExpenseAt: (last(db.expenses.filter(e => e.employeeId === u.id), 'createdAt') || {}).createdAt || null,
      lastCheckinAt: (last(db.checkins.filter(c => c.employeeId === u.id), 'at') || {}).at || null,
    }));
    const projects = db.projects.map(p => { const ex = db.expenses.filter(e => e.projectId === p.id && e.status !== 'rejected'); return { ...p, spent: num(ex.reduce((s, e) => s + e.amount, 0)), count: ex.length }; });
    const totals = { received: 0, spent: 0, remaining: 0, pendingCount: 0 };
    for (const e of employees) for (const k in totals) totals[k] = num(totals[k] + e[k]);
    return { employees, projects, totals };
  }
  function filterExpenses(q, user) {
    let list = db.expenses;
    const emp = user.role === 'manager' ? q.get('employeeId') : user.id;
    if (emp) list = list.filter(e => e.employeeId === emp);
    for (const k of ['projectId', 'status', 'category']) if (q.get(k)) list = list.filter(e => e[k] === q.get(k));
    if (q.get('from')) list = list.filter(e => e.date >= q.get('from'));
    if (q.get('to')) list = list.filter(e => e.date <= q.get('to'));
    return list.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).map(decExp);
  }
  const mgr = u => { if (u.role !== 'manager') fail('هذه العملية للمدير فقط'); };
  const amount = v => { const n = num(v); if (!(n > 0)) fail('المبلغ يجب أن يكون أكبر من صفر'); return n; };
  const text = (v, label) => { const s = String(v ?? '').trim(); if (!s) fail(`الحقل "${label}" مطلوب`); return s; };
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : day();

  async function handle(method, path, q, body, user) {
    const r = (m, re) => method === m && (path.match(re) || null);
    let m;
    if (r('GET', /^\/api\/bootstrap$/)) return { user: publicUser(user), settings: db.settings, projects: db.projects.filter(p => user.role === 'manager' || p.active), employees: user.role === 'manager' ? db.users.filter(u => u.role === 'employee').map(publicUser) : [] };
    if (r('POST', /^\/api\/logout$/)) return { ok: true };
    if (r('POST', /^\/api\/password$/)) { if (user.password !== body.oldPassword) fail('كلمة المرور الحالية غير صحيحة'); user.password = body.newPassword; return { ok: true }; }
    if (r('GET', /^\/api\/my$/)) return { balance: balanceOf(user.id), custodies: db.custodies.filter(c => c.employeeId === user.id).sort(byNewest), expenses: filterExpenses(new URLSearchParams(), user) };
    if (r('GET', /^\/api\/expenses$/)) return filterExpenses(q, user);
    if (r('POST', /^\/api\/expenses$/)) {
      const p = db.projects.find(x => x.id === body.projectId && x.active) || fail('اختر المشروع التابع له المصروف');
      const e = { id: uid(), employeeId: user.id, projectId: p.id, amount: amount(body.amount), category: text(body.category, 'نوع المصروف'), description: text(body.description, 'البيان'), vendor: String(body.vendor || ''), date: date(body.date), time: body.time || new Date().toTimeString().slice(0, 5), receipt: body.receipt || null, status: user.role === 'manager' ? 'approved' : 'pending', managerNote: '', viaReminder: !!body.viaReminder, createdAt: now() };
      db.expenses.push(e);
      if (body.viaReminder) db.checkins.push({ id: uid(), employeeId: user.id, at: now(), answer: 'yes' });
      return decExp(e);
    }
    if ((m = r('PUT', /^\/api\/expenses\/(\w+)$/))) {
      const e = db.expenses.find(x => x.id === m[1]) || fail('المصروف غير موجود');
      if (user.role === 'manager') { if (body.status) e.status = body.status; if (body.managerNote !== undefined) e.managerNote = body.managerNote; }
      else {
        if (e.employeeId !== user.id || e.status !== 'pending') fail('لا يمكن تعديل مصروف تمت مراجعته');
        if (body.projectId) e.projectId = body.projectId;
        if (body.amount !== undefined) e.amount = amount(body.amount);
        for (const k of ['category', 'description', 'vendor']) if (body[k] !== undefined) e[k] = String(body[k]);
        if (body.date) e.date = date(body.date);
      }
      return decExp(e);
    }
    if ((m = r('DELETE', /^\/api\/expenses\/(\w+)$/))) { db.expenses = db.expenses.filter(x => x.id !== m[1]); return { ok: true }; }
    if (r('GET', /^\/api\/custodies$/)) { mgr(user); return db.custodies.filter(c => !q.get('employeeId') || c.employeeId === q.get('employeeId')).sort(byNewest).map(decCus); }
    if (r('POST', /^\/api\/custodies$/)) {
      const isMgr = user.role === 'manager';
      const employeeId = isMgr ? body.employeeId : user.id;
      if (!db.users.some(u => u.id === employeeId && u.role === 'employee')) fail('اختر الموظف');
      const c = { id: uid(), employeeId, amount: amount(body.amount), date: date(body.date), method: body.method || 'نقداً', note: String(body.note || ''), status: isMgr ? 'approved' : 'pending', createdAt: now() };
      db.custodies.push(c);
      return decCus(c);
    }
    if ((m = r('PUT', /^\/api\/custodies\/(\w+)$/))) { mgr(user); const c = db.custodies.find(x => x.id === m[1]) || fail('غير موجود'); if (body.status) c.status = body.status; return decCus(c); }
    if ((m = r('DELETE', /^\/api\/custodies\/(\w+)$/))) { db.custodies = db.custodies.filter(x => x.id !== m[1]); return { ok: true }; }
    if (r('POST', /^\/api\/checkins$/)) { db.checkins.push({ id: uid(), employeeId: user.id, at: now(), answer: body.answer === 'yes' ? 'yes' : 'no' }); return { ok: true }; }
    if (r('GET', /^\/api\/checkins$/)) { mgr(user); const d = date(q.get('date')); return db.checkins.filter(c => c.at.slice(0, 10) === d).map(c => ({ ...c, employeeName: nameOf(c.employeeId) })); }
    if (r('GET', /^\/api\/summary$/)) { mgr(user); return summary(); }
    if (r('POST', /^\/api\/users$/)) {
      mgr(user);
      const username = text(body.username, 'اسم المستخدم').toLowerCase();
      if (db.users.some(u => u.username === username)) fail('اسم المستخدم مستخدم مسبقاً');
      const u = { id: uid(), name: text(body.name, 'الاسم'), username, password: text(body.password, 'كلمة المرور'), role: 'employee', phone: body.phone || '', jobTitle: body.jobTitle || '', active: true };
      db.users.push(u);
      return publicUser(u);
    }
    if ((m = r('PUT', /^\/api\/users\/(\w+)$/))) {
      mgr(user);
      const u = db.users.find(x => x.id === m[1]) || fail('غير موجود');
      for (const k of ['name', 'phone', 'jobTitle']) if (body[k] !== undefined) u[k] = String(body[k]);
      if (body.active !== undefined) u.active = !!body.active;
      if (body.password) u.password = body.password;
      return publicUser(u);
    }
    if (r('POST', /^\/api\/projects$/)) { mgr(user); const p = { id: uid(), name: text(body.name, 'اسم المشروع'), code: String(body.code || ''), budget: num(body.budget), active: true, createdAt: now() }; db.projects.push(p); return p; }
    if ((m = r('PUT', /^\/api\/projects\/(\w+)$/))) {
      mgr(user);
      const p = db.projects.find(x => x.id === m[1]) || fail('غير موجود');
      if (body.name !== undefined) p.name = text(body.name, 'اسم المشروع');
      if (body.code !== undefined) p.code = String(body.code);
      if (body.budget !== undefined) p.budget = num(body.budget);
      if (body.active !== undefined) p.active = !!body.active;
      return p;
    }
    if (r('PUT', /^\/api\/settings$/)) {
      mgr(user);
      const s = db.settings;
      for (const k of ['companyName', 'currency', 'workStart', 'workEnd']) if (body[k]) s[k] = String(body[k]);
      if (Array.isArray(body.workDays)) s.workDays = body.workDays.map(Number);
      if (body.reminderMinutes) s.reminderMinutes = Math.max(5, Number(body.reminderMinutes) || 30);
      if (body.lowBalanceThreshold !== undefined) s.lowBalanceThreshold = num(body.lowBalanceThreshold);
      if (Array.isArray(body.categories)) s.categories = body.categories.map(x => String(x).trim()).filter(Boolean);
      return s;
    }
    fail('غير متاح في الوضع التجريبي');
  }

  window.DEMO = {
    accounts: [['admin', 'admin', 'دخول كمدير'], ['mohamed', '1234', 'دخول كموظف (محمد)'], ['khaled', '1234', 'دخول كموظف (خالد)']],
    async api(method, url, body = {}, token) {
      const [path, qs] = url.split('?');
      if (method === 'POST' && path === '/api/login') {
        const u = db.users.find(x => x.username === String(body.username || '').trim().toLowerCase() && x.password === body.password) || fail('اسم المستخدم أو كلمة المرور غير صحيحة');
        if (!u.active) fail('الحساب موقوف، راجع المدير');
        const t = uid();
        db.sessions[t] = u.id;
        save();
        return { token: t, user: publicUser(u) };
      }
      const user = db.users.find(u => u.id === db.sessions[token]);
      if (!user) { const e = new Error('يجب تسجيل الدخول'); e.status = 401; throw e; }
      const result = await handle(method, path, new URLSearchParams(qs || ''), body || {}, user);
      save();
      return JSON.parse(JSON.stringify(result));
    },
    reset() { localStorage.removeItem(KEY); localStorage.removeItem('custody_token'); location.reload(); },
  };
})();
