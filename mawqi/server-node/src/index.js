import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { db, ensureFactory, getSetting, setSetting, tx } from './db.js';
import { hashPassword } from './auth.js';
import { login, projectScope, requireAuth, verifyToken } from './auth.js';
import { buildDashboard } from './dashboard.js';
import { startJobs } from './jobs.js';
import { seed } from './seed.js';
import { api } from './routes.js';

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
const PROD = process.env.NODE_ENV === 'production';

if (PROD) {
  // One-time cleanup of the demo data shipped with the first release: keep only the general manager account.
  if (!getSetting('demo_cleared', null)) {
    tx(() => {
      for (const t of ['project_members', 'direct_order_items', 'direct_orders', 'invoices', 'daily_reports', 'attendance', 'worker_assignments', 'issues', 'workers', 'subcontractors', 'projects']) db.exec(`DELETE FROM ${t}`);
      const admin = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get() || db.prepare(`SELECT id FROM users WHERE role IN ('admin','sysadmin') ORDER BY id`).get();
      if (admin) {
        db.prepare('DELETE FROM users WHERE id <> ?').run(admin.id);
        db.prepare(`UPDATE users SET name = 'المدير العام', active = 1 WHERE id = ?`).run(admin.id);
      } else db.exec('DELETE FROM users');
      setSetting('demo_cleared', new Date().toISOString());
    });
    console.log('Demo data cleared.');
  }
  // A brand-new production database starts with a single general-manager account (change its password after first login).
  if (count('users') === 0) {
    db.prepare(`INSERT INTO users (name, username, password_hash, role) VALUES ('المدير العام', 'admin', ?, 'admin')`).run(hashPassword('123456'));
    setSetting('demo_cleared', new Date().toISOString());
  }
} else if (count('projects') === 0) seed();
ensureFactory();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
// Live data must never be cached by the host (SiteGround caches GET responses otherwise).
app.use('/api', (_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache', Expires: '0', 'X-Cache-Enabled': 'False' });
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'المشاريع' }));

// The web dashboard and app talk to the PHP server's API shape; these routes keep the Node server compatible.
// The change counter lives in the database so every server process (and restarts) agree on it.
const readVersion = () => Number(getSetting('data_version', '1'));
const bumpVersion = () => db.exec(`INSERT INTO settings (key, value) VALUES ('data_version', '2')
  ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`);
const loginRoute = (req, res) => {
  const out = login(String(req.body?.username || '').trim(), String(req.body?.password || ''));
  if (!out) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  res.json(out);
};
app.post('/api/auth/login', loginRoute);
app.post('/api/login', loginRoute);
app.get('/api/status', (_req, res) => res.json({ needsSetup: false, companyName: getSetting('company_name', 'شركة الخطوط المعدنية للمقاولات العامة'), version: readVersion() }));
app.get('/api/version', requireAuth, (_req, res) => res.json({ version: readVersion() }));
app.post('/api/logout', (_req, res) => res.json({ ok: true }));

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

app.get('/api/dashboard', requireAuth, (req, res) => res.json(buildDashboard(projectScope(req.user))));
app.use('/api', requireAuth, api);

const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });

// Every client joins a room per visible project (or "all"), so a change is pushed
// only to the phones and dashboards that are allowed to see it.
io.use((socket, next) => {
  try {
    socket.data.user = verifyToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
io.on('connection', (socket) => {
  const scope = projectScope(socket.data.user);
  if (scope === null) socket.join('all');
  else scope.forEach((id) => socket.join(`project:${id}`));
});

/** Tell every connected client that can see `projectId` that data changed. */
export function broadcast(event, payload = {}) {
  bumpVersion();
  const rooms = ['all'];
  if (payload.projectId) rooms.push(`project:${payload.projectId}`);
  io.to(rooms).emit(event, payload);
}
app.locals.broadcast = broadcast;

if (process.env.NODE_ENV !== 'production') {
  // Used by scripts/simulate.js to push a live update after editing the database directly.
  app.post('/api/dev/ping', (req, res) => {
    broadcast('data:changed', { entity: 'attendance', projectId: req.body?.projectId });
    res.json({ ok: true });
  });
}

// In production the server also hosts the built web dashboard (web/dist).
const webDist = process.env.MAWQI_WEB_DIST || resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  const noStore = (res) => res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Cache-Enabled': 'False' });
  // index.html must always be fresh so a new release reaches everyone at once; hashed assets can be cached.
  app.use(express.static(webDist, { setHeaders: (res, file) => { if (file.endsWith('.html') || file.endsWith('.webmanifest')) noStore(res); } }));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => { noStore(res); res.sendFile(resolve(webDist, 'index.html')); });
}

startJobs(broadcast);

const PORT = Number(process.env.PORT || 4000);
http.listen(PORT, '0.0.0.0', () => console.log(`المشاريع server on http://0.0.0.0:${PORT}`));
