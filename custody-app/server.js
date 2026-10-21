// نظام إدارة العهد — خادم Node.js بدون أي مكتبات خارجية
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = 30;
const MAX_BODY = 8 * 1024 * 1024;

fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

// ---------- قاعدة البيانات (ملف JSON) ----------
const DEFAULT_SETTINGS = {
  companyName: 'شركتي',
  currency: 'ر.س',
  workStart: '08:00',
  workEnd: '17:00',
  workDays: [0, 1, 2, 3, 4], // الأحد..الخميس
  reminderMinutes: 30,
  lowBalanceThreshold: 200,
  categories: ['مواد', 'نقل ومواصلات', 'وقود', 'إعاشة', 'عمالة يومية', 'أدوات ومعدات', 'صيانة', 'رسوم حكومية', 'أخرى'],
};

let db;
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = { users: [], projects: [], custodies: [], expenses: [], checkins: [], sessions: {}, settings: {} };
  }
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
  for (const k of ['users', 'projects', 'custodies', 'expenses', 'checkins']) db[k] = db[k] || [];
  db.sessions = db.sessions || {};
  if (!db.users.some(u => u.role === 'manager')) {
    db.users.push(makeUser({ name: 'المدير', username: 'admin', password: 'admin123', role: 'manager' }));
    console.log('تم إنشاء حساب المدير الافتراضي: admin / admin123 — غيّر كلمة المرور فوراً');
  }
  saveDb();
}
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

const uid = () => crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
function makeUser({ name, username, password, role = 'employee', phone = '', jobTitle = '' }) {
  return { id: uid(), name, username: String(username).trim().toLowerCase(), role, phone, jobTitle, active: true, createdAt: now(), ...hashPassword(password) };
}
const publicUser = u => u && ({ id: u.id, name: u.name, username: u.username, role: u.role, phone: u.phone, jobTitle: u.jobTitle, active: u.active });

// ---------- الحسابات ----------
const num = v => Math.round((Number(v) || 0) * 100) / 100;
function balanceOf(employeeId) {
  const received = db.custodies.filter(c => c.employeeId === employeeId && c.status !== 'rejected').reduce((s, c) => s + c.amount, 0);
  const exps = db.expenses.filter(e => e.employeeId === employeeId && e.status !== 'rejected');
  const spent = exps.reduce((s, e) => s + e.amount, 0);
  const approved = exps.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);
  const pending = exps.filter(e => e.status === 'pending');
  return {
    received: num(received), spent: num(spent), remaining: num(received - spent),
    approvedSpent: num(approved), pendingCount: pending.length, pendingAmount: num(pending.reduce((s, e) => s + e.amount, 0)),
  };
}
function summary() {
  const employees = db.users.filter(u => u.role === 'employee').map(u => {
    const lastExp = db.expenses.filter(e => e.employeeId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastCheck = db.checkins.filter(c => c.employeeId === u.id).sort((a, b) => b.at.localeCompare(a.at))[0];
    return { ...publicUser(u), ...balanceOf(u.id), lastExpenseAt: lastExp ? lastExp.createdAt : null, lastCheckinAt: lastCheck ? lastCheck.at : null };
  });
  const projects = db.projects.map(p => {
    const exps = db.expenses.filter(e => e.projectId === p.id && e.status !== 'rejected');
    return { ...p, spent: num(exps.reduce((s, e) => s + e.amount, 0)), count: exps.length };
  });
  const totals = employees.reduce((t, e) => ({ received: t.received + e.received, spent: t.spent + e.spent, remaining: t.remaining + e.remaining, pendingCount: t.pendingCount + e.pendingCount }), { received: 0, spent: 0, remaining: 0, pendingCount: 0 });
  for (const k of ['received', 'spent', 'remaining']) totals[k] = num(totals[k]);
  return { employees, projects, totals };
}

// ---------- أدوات HTTP ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'حجم الطلب كبير جداً')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'بيانات غير صالحة')); }
    });
    req.on('error', reject);
  });
}
function auth(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  const s = token && db.sessions[token];
  if (!s || s.exp < Date.now()) fail(401, 'يجب تسجيل الدخول');
  const user = db.users.find(u => u.id === s.userId && u.active);
  if (!user) fail(401, 'الحساب غير مفعل');
  return user;
}
const requireManager = u => { if (u.role !== 'manager') fail(403, 'هذه العملية للمدير فقط'); };
const requireText = (v, label) => { const s = String(v ?? '').trim(); if (!s) fail(400, `الحقل "${label}" مطلوب`); return s; };
const requireAmount = v => { const n = num(v); if (!(n > 0)) fail(400, 'المبلغ يجب أن يكون أكبر من صفر'); return n; };
const validDate = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : new Date().toISOString().slice(0, 10));

function saveReceipt(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) fail(400, 'صيغة صورة الإيصال غير مدعومة');
  const name = `${uid()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(RECEIPTS_DIR, name), Buffer.from(m[2], 'base64'));
  return name;
}
const decorateExpense = e => ({
  ...e,
  employeeName: (db.users.find(u => u.id === e.employeeId) || {}).name || '—',
  projectName: (db.projects.find(p => p.id === e.projectId) || {}).name || '—',
});
const decorateCustody = c => ({ ...c, employeeName: (db.users.find(u => u.id === c.employeeId) || {}).name || '—' });

function filterExpenses(q, user) {
  let list = db.expenses;
  const employeeId = user.role === 'manager' ? q.get('employeeId') : user.id;
  if (employeeId) list = list.filter(e => e.employeeId === employeeId);
  if (q.get('projectId')) list = list.filter(e => e.projectId === q.get('projectId'));
  if (q.get('status')) list = list.filter(e => e.status === q.get('status'));
  if (q.get('category')) list = list.filter(e => e.category === q.get('category'));
  if (q.get('from')) list = list.filter(e => e.date >= q.get('from'));
  if (q.get('to')) list = list.filter(e => e.date <= q.get('to'));
  return list.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).map(decorateExpense);
}

function csv(rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
}
const STATUS_AR = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' };

// ---------- المسارات ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

route('POST', '/api/login', async ({ body }) => {
  const user = db.users.find(u => u.username === String(body.username || '').trim().toLowerCase());
  if (!user || !checkPassword(user, body.password || '')) fail(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  if (!user.active) fail(403, 'الحساب موقوف، راجع المدير');
  const token = crypto.randomBytes(24).toString('hex');
  for (const [t, s] of Object.entries(db.sessions)) if (s.exp < Date.now()) delete db.sessions[t];
  db.sessions[token] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  saveDb();
  return { token, user: publicUser(user) };
});
route('POST', '/api/logout', ({ req, url }) => {
  const h = req.headers.authorization || '';
  delete db.sessions[h.slice(7) || url.searchParams.get('token')];
  saveDb();
  return { ok: true };
});
route('POST', '/api/password', ({ user, body }) => {
  if (!checkPassword(user, body.oldPassword || '')) fail(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(body.newPassword || '').length < 4) fail(400, 'كلمة المرور الجديدة قصيرة جداً');
  Object.assign(user, hashPassword(body.newPassword));
  saveDb();
  return { ok: true };
});

route('GET', '/api/bootstrap', ({ user }) => ({
  user: publicUser(user),
  settings: db.settings,
  projects: db.projects.filter(p => user.role === 'manager' || p.active),
  employees: user.role === 'manager' ? db.users.filter(u => u.role === 'employee').map(publicUser) : [],
}));

// الموظف: ملخص حسابه
route('GET', '/api/my', ({ user }) => ({
  balance: balanceOf(user.id),
  custodies: db.custodies.filter(c => c.employeeId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  expenses: filterExpenses(new URLSearchParams(), user).slice(0, 200),
  lastCheckinAt: (db.checkins.filter(c => c.employeeId === user.id).sort((a, b) => b.at.localeCompare(a.at))[0] || {}).at || null,
}));

// المصروفات
route('GET', '/api/expenses', ({ user, url }) => filterExpenses(url.searchParams, user));
route('POST', '/api/expenses', ({ user, body }) => {
  const employeeId = user.role === 'manager' && body.employeeId ? body.employeeId : user.id;
  const project = db.projects.find(p => p.id === body.projectId && p.active);
  if (!project) fail(400, 'اختر المشروع التابع له المصروف');
  const e = {
    id: uid(), employeeId, projectId: project.id,
    amount: requireAmount(body.amount),
    category: requireText(body.category, 'نوع المصروف'),
    description: requireText(body.description, 'البيان'),
    vendor: String(body.vendor || '').trim(),
    date: validDate(body.date),
    time: /^\d{2}:\d{2}$/.test(body.time || '') ? body.time : new Date().toTimeString().slice(0, 5),
    receipt: saveReceipt(body.receipt),
    status: user.role === 'manager' ? 'approved' : 'pending',
    managerNote: '', viaReminder: !!body.viaReminder,
    createdAt: now(), createdBy: user.id,
  };
  db.expenses.push(e);
  if (body.viaReminder) db.checkins.push({ id: uid(), employeeId, at: now(), answer: 'yes', expenseId: e.id });
  saveDb();
  return decorateExpense(e);
});
route('PUT', '/api/expenses/:id', ({ user, params, body }) => {
  const e = db.expenses.find(x => x.id === params.id) || fail(404, 'المصروف غير موجود');
  if (user.role === 'manager') {
    if (body.status && !STATUS_AR[body.status]) fail(400, 'حالة غير صالحة');
    if (body.status) { e.status = body.status; e.reviewedAt = now(); }
    if (body.managerNote !== undefined) e.managerNote = String(body.managerNote);
  } else {
    if (e.employeeId !== user.id || e.status !== 'pending') fail(403, 'لا يمكن تعديل مصروف تمت مراجعته');
    if (body.projectId) e.projectId = (db.projects.find(p => p.id === body.projectId) || fail(400, 'مشروع غير صالح')).id;
    if (body.amount !== undefined) e.amount = requireAmount(body.amount);
    if (body.category) e.category = String(body.category);
    if (body.description) e.description = String(body.description);
    if (body.vendor !== undefined) e.vendor = String(body.vendor);
    if (body.date) e.date = validDate(body.date);
  }
  saveDb();
  return decorateExpense(e);
});
route('DELETE', '/api/expenses/:id', ({ user, params }) => {
  const i = db.expenses.findIndex(x => x.id === params.id);
  if (i < 0) fail(404, 'المصروف غير موجود');
  const e = db.expenses[i];
  if (user.role !== 'manager' && (e.employeeId !== user.id || e.status !== 'pending')) fail(403, 'لا يمكن حذف هذا المصروف');
  if (e.receipt) fs.rm(path.join(RECEIPTS_DIR, e.receipt), () => {});
  db.expenses.splice(i, 1);
  saveDb();
  return { ok: true };
});
route('GET', '/api/receipts/:name', ({ user, params, res }) => {
  const name = path.basename(params.name);
  const e = db.expenses.find(x => x.receipt === name) || fail(404, 'غير موجود');
  if (user.role !== 'manager' && e.employeeId !== user.id) fail(403, 'غير مسموح');
  const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[name.split('.').pop()];
  send(res, 200, fs.readFileSync(path.join(RECEIPTS_DIR, name)), { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
});

// العهد
route('GET', '/api/custodies', ({ user, url }) => {
  requireManager(user);
  const emp = url.searchParams.get('employeeId');
  return db.custodies.filter(c => !emp || c.employeeId === emp).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(decorateCustody);
});
route('POST', '/api/custodies', ({ user, body }) => {
  const isMgr = user.role === 'manager';
  const employeeId = isMgr ? body.employeeId : user.id;
  if (!db.users.some(u => u.id === employeeId && u.role === 'employee')) fail(400, 'اختر الموظف');
  const c = {
    id: uid(), employeeId, amount: requireAmount(body.amount), date: validDate(body.date),
    method: String(body.method || 'نقداً'), note: String(body.note || '').trim(),
    // العهدة التي يسجلها المدير معتمدة مباشرة، والتي يسجلها الموظف تنتظر تأكيد المدير
    status: isMgr ? 'approved' : 'pending', createdBy: user.id, createdAt: now(),
  };
  db.custodies.push(c);
  saveDb();
  return decorateCustody(c);
});
route('PUT', '/api/custodies/:id', ({ user, params, body }) => {
  requireManager(user);
  const c = db.custodies.find(x => x.id === params.id) || fail(404, 'غير موجود');
  if (body.status && STATUS_AR[body.status]) c.status = body.status;
  if (body.amount !== undefined) c.amount = requireAmount(body.amount);
  if (body.note !== undefined) c.note = String(body.note);
  saveDb();
  return decorateCustody(c);
});
route('DELETE', '/api/custodies/:id', ({ user, params }) => {
  const i = db.custodies.findIndex(x => x.id === params.id);
  if (i < 0) fail(404, 'غير موجود');
  if (user.role !== 'manager' && (db.custodies[i].employeeId !== user.id || db.custodies[i].status !== 'pending')) fail(403, 'غير مسموح');
  db.custodies.splice(i, 1);
  saveDb();
  return { ok: true };
});

// تنبيهات المتابعة (كل نصف ساعة)
route('POST', '/api/checkins', ({ user, body }) => {
  db.checkins.push({ id: uid(), employeeId: user.id, at: now(), answer: body.answer === 'yes' ? 'yes' : 'no' });
  if (db.checkins.length > 20000) db.checkins.splice(0, db.checkins.length - 20000);
  saveDb();
  return { ok: true };
});
route('GET', '/api/checkins', ({ user, url }) => {
  requireManager(user);
  const day = validDate(url.searchParams.get('date'));
  return db.checkins.filter(c => c.at.slice(0, 10) === day).map(c => ({ ...c, employeeName: (db.users.find(u => u.id === c.employeeId) || {}).name }));
});

// لوحة المدير
route('GET', '/api/summary', ({ user }) => { requireManager(user); return summary(); });

// الموظفون
route('POST', '/api/users', ({ user, body }) => {
  requireManager(user);
  const username = requireText(body.username, 'اسم المستخدم').toLowerCase();
  if (db.users.some(u => u.username === username)) fail(400, 'اسم المستخدم مستخدم مسبقاً');
  if (String(body.password || '').length < 4) fail(400, 'كلمة المرور يجب ألا تقل عن 4 أحرف');
  const u = makeUser({ name: requireText(body.name, 'الاسم'), username, password: body.password, role: body.role === 'manager' ? 'manager' : 'employee', phone: body.phone || '', jobTitle: body.jobTitle || '' });
  db.users.push(u);
  saveDb();
  return publicUser(u);
});
route('PUT', '/api/users/:id', ({ user, params, body }) => {
  requireManager(user);
  const u = db.users.find(x => x.id === params.id) || fail(404, 'غير موجود');
  for (const k of ['name', 'phone', 'jobTitle']) if (body[k] !== undefined) u[k] = String(body[k]);
  if (body.active !== undefined) {
    if (u.id === user.id && !body.active) fail(400, 'لا يمكنك إيقاف حسابك');
    u.active = !!body.active;
  }
  if (body.password) Object.assign(u, hashPassword(body.password));
  saveDb();
  return publicUser(u);
});

// المشاريع
route('POST', '/api/projects', ({ user, body }) => {
  requireManager(user);
  const p = { id: uid(), name: requireText(body.name, 'اسم المشروع'), code: String(body.code || '').trim(), budget: num(body.budget), active: true, createdAt: now() };
  db.projects.push(p);
  saveDb();
  return p;
});
route('PUT', '/api/projects/:id', ({ user, params, body }) => {
  requireManager(user);
  const p = db.projects.find(x => x.id === params.id) || fail(404, 'غير موجود');
  if (body.name !== undefined) p.name = requireText(body.name, 'اسم المشروع');
  if (body.code !== undefined) p.code = String(body.code);
  if (body.budget !== undefined) p.budget = num(body.budget);
  if (body.active !== undefined) p.active = !!body.active;
  saveDb();
  return p;
});

// الإعدادات
route('PUT', '/api/settings', ({ user, body }) => {
  requireManager(user);
  const s = db.settings;
  if (body.companyName !== undefined) s.companyName = String(body.companyName);
  if (body.currency !== undefined) s.currency = String(body.currency);
  if (/^\d{2}:\d{2}$/.test(body.workStart || '')) s.workStart = body.workStart;
  if (/^\d{2}:\d{2}$/.test(body.workEnd || '')) s.workEnd = body.workEnd;
  if (Array.isArray(body.workDays)) s.workDays = body.workDays.map(Number).filter(d => d >= 0 && d <= 6);
  if (body.reminderMinutes) s.reminderMinutes = Math.max(5, Math.min(240, Number(body.reminderMinutes) || 30));
  if (body.lowBalanceThreshold !== undefined) s.lowBalanceThreshold = num(body.lowBalanceThreshold);
  if (Array.isArray(body.categories)) s.categories = body.categories.map(String).map(x => x.trim()).filter(Boolean);
  saveDb();
  return s;
});

// تصدير Excel (CSV)
route('GET', '/api/export/expenses.csv', ({ user, url, res }) => {
  const rows = [['التاريخ', 'الوقت', 'الموظف', 'المشروع', 'النوع', 'البيان', 'المورد', 'المبلغ', 'الحالة', 'ملاحظة المدير']];
  for (const e of filterExpenses(url.searchParams, user)) rows.push([e.date, e.time, e.employeeName, e.projectName, e.category, e.description, e.vendor, e.amount, STATUS_AR[e.status], e.managerNote]);
  send(res, 200, Buffer.from(csv(rows)), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="expenses.csv"' });
});
route('GET', '/api/export/summary.csv', ({ user, res }) => {
  requireManager(user);
  const rows = [['الموظف', 'إجمالي العهد المستلمة', 'إجمالي المصروف', 'المتبقي', 'مصروفات بانتظار المراجعة']];
  for (const e of summary().employees) rows.push([e.name, e.received, e.spent, e.remaining, e.pendingCount]);
  send(res, 200, Buffer.from(csv(rows)), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="custody-summary.csv"' });
});

// ---------- الملفات الثابتة ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return serveStatic(res, '/'); // تطبيق صفحة واحدة
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (!url.pathname.startsWith('/api/')) return serveStatic(res, decodeURIComponent(url.pathname));
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(url.pathname);
      if (!m) continue;
      const user = url.pathname === '/api/login' ? null : auth(req, url);
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const result = await r.handler({ req, res, url, user, body, params: m.groups || {} });
      if (!res.headersSent) send(res, 200, result);
      return;
    }
    fail(404, 'المسار غير موجود');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err instanceof HttpError ? err.message : 'خطأ في الخادم' });
  }
});

loadDb();
server.listen(PORT, () => console.log(`نظام إدارة العهد يعمل على http://localhost:${PORT}`));
