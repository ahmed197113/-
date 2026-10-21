// نظام إدارة العهد — خادم Node.js بدون مكتبات خارجية (المنطق في public/core.js)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCore, normalize, seedDemo, ApiError } = require('./public/core.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = 30;
const MAX_BODY = 25 * 1024 * 1024;

fs.mkdirSync(FILES_DIR, { recursive: true });

// ---------- التخزين ----------
let saveTimer = null;
const env = {
  db: normalize(fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : null),
  save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(env.db));
      fs.renameSync(tmp, DB_FILE);
    }, 50);
  },
  uid: () => crypto.randomBytes(8).toString('hex'),
  now: () => new Date().toISOString(),
  today: () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); },
  async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
  },
  async verifyPassword(user, password) {
    if (!user.salt) return false;
    const hash = crypto.scryptSync(String(password), user.salt, 64);
    return crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'));
  },
  async putFile(dataUrl) {
    const m = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(dataUrl);
    if (!m) throw new ApiError(400, 'صيغة المرفق غير مدعومة (صور أو PDF فقط)');
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2] || 'pdf';
    const id = `${env.uid()}.${ext}`;
    fs.writeFileSync(path.join(FILES_DIR, id), Buffer.from(m[3], 'base64'));
    return id;
  },
};
const core = createCore(env);

async function init() {
  if (process.env.DEMO === '1' && core.needsSetup()) {
    await seedDemo(env);
    console.log('تم تحميل بيانات تجريبية — المدير: admin / admin ، الموظف: mohamed / 1234');
  }
  env.save();
}

// ---------- HTTP ----------
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new ApiError(413, 'حجم الطلب كبير جداً')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new ApiError(400, 'بيانات غير صالحة')); }
    });
    req.on('error', reject);
  });
}
function sessionUser(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  const s = token && env.db.sessions[token];
  if (!s || s.exp < Date.now()) throw new ApiError(401, 'يجب تسجيل الدخول');
  const user = env.db.users.find(u => u.id === s.userId && u.active !== false);
  if (!user) throw new ApiError(401, 'الحساب غير مفعل');
  return { user, token };
}
function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  for (const [t, s] of Object.entries(env.db.sessions)) if (s.exp < Date.now()) delete env.db.sessions[t];
  env.db.sessions[token] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  env.save();
  return { token, user: core.publicUser(user) };
}

async function api(req, res, url) {
  const p = url.pathname;
  if (p === '/api/status' && req.method === 'GET') return send(res, 200, { needsSetup: core.needsSetup(), mode: 'server', companyName: env.db.settings.companyName });
  if (p === '/api/setup' && req.method === 'POST') return send(res, 200, newSession(await core.setup(await readBody(req))));
  if (p === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    return send(res, 200, newSession(await core.login(b.username, b.password)));
  }
  const { user, token } = sessionUser(req, url);
  if (p === '/api/logout') { delete env.db.sessions[token]; env.save(); return send(res, 200, { ok: true }); }
  const fm = /^\/api\/files\/([\w.]+)$/.exec(p);
  if (fm) {
    const name = path.basename(fm[1]);
    const owned = env.db.expenses.some(e => e.attachments.includes(name) && (user.role !== 'employee' || e.employeeId === user.id))
      || env.db.assets.some(a => (a.photos || []).includes(name) && (user.role !== 'employee' || a.holderId === user.id));
    if (!owned || !fs.existsSync(path.join(FILES_DIR, name))) throw new ApiError(404, 'الملف غير موجود');
    const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }[name.split('.').pop()] || 'image/jpeg';
    return send(res, 200, fs.readFileSync(path.join(FILES_DIR, name)), { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
  }
  if (p === '/api/restore' && req.method === 'POST') {
    if (user.role !== 'admin') throw new ApiError(403, 'لمدير النظام فقط');
    const b = await readBody(req);
    if (!b || !Array.isArray(b.users) || !b.users.length) throw new ApiError(400, 'ملف النسخة الاحتياطية غير صالح');
    // نسخة احتياطية من التشغيل على الجوال تحمل المرفقات داخلها
    for (const [id, data] of Object.entries(b.__files || {})) {
      const m = /^data:[^;]+;base64,(.+)$/.exec(data || '');
      if (m && /^[\w.]+$/.test(id)) fs.writeFileSync(path.join(FILES_DIR, id), Buffer.from(m[1], 'base64'));
    }
    delete b.__files;
    const sessions = env.db.sessions;
    env.db = normalize(b);
    env.db.sessions = sessions;
    env.save();
    return send(res, 200, { ok: true });
  }
  const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
  const result = await core.handle(req.method, p, Object.fromEntries(url.searchParams), body, user);
  send(res, 200, result);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
function serveStatic(res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(res, decodeURIComponent(url.pathname));
  } catch (err) {
    if (!(err instanceof ApiError)) console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err instanceof ApiError ? err.message : 'خطأ في الخادم' });
  }
});

init().then(() => server.listen(PORT, () => console.log(`نظام إدارة العهد يعمل على http://localhost:${PORT}`)));
