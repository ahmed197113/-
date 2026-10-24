import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, factoryId } from './db.js';

const SECRET = process.env.MAWQI_JWT_SECRET || 'mawqi-dev-secret-change-me';

export const ROLE_LABELS = {
  admin: 'مدير عام',
  sysadmin: 'مدير النظام',
  project_manager: 'مدير مشروع',
  supervisor: 'مشرف موقع',
  accountant: 'محاسب',
};

/** What each role may change. Everyone signed in may read what their project scope allows. */
export const PERMISSIONS = {
  projects: ['admin', 'sysadmin', 'project_manager'],
  projectsCreate: ['admin', 'sysadmin'],
  workers: ['admin', 'sysadmin', 'project_manager'],
  /** Choose where a worker is today: a project or the factory. */
  moveWorkers: ['admin', 'sysadmin', 'project_manager', 'supervisor'],
  attendance: ['admin', 'sysadmin', 'project_manager', 'supervisor'],
  dailyReports: ['admin', 'sysadmin', 'project_manager', 'supervisor'],
  issues: ['admin', 'sysadmin', 'project_manager', 'supervisor'],
  invoices: ['admin', 'sysadmin', 'accountant', 'project_manager'],
  directOrders: ['admin', 'sysadmin', 'project_manager'],
  /** Record iqama renewal fees and see the full cost of each project. */
  costs: ['admin', 'sysadmin', 'accountant', 'project_manager'],
  users: ['admin', 'sysadmin'],
  /** Delete anything and edit records others created — the general manager and the system manager only. */
  delete: ['admin', 'sysadmin'],
};

export const permissionsOf = (role) =>
  Object.fromEntries(Object.entries(PERMISSIONS).map(([k, roles]) => [k, roles.includes(role)]));

const publicUser = (u) => ({
  id: u.id, name: u.name, username: u.username, role: u.role, roleLabel: ROLE_LABELS[u.role],
  permissions: permissionsOf(u.role),
});

export const hashPassword = (p) => bcrypt.hashSync(p, 10);
export const checkPassword = (p, hash) => bcrypt.compareSync(p, hash);

export function login(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || u.active === 0 || !checkPassword(password, u.password_hash)) return null;
  const token = jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: '30d' });
  return { token, user: publicUser(u) };
}

/** A signed session for a user row (used by single sign-on from the custody app). */
export function issueToken(u) {
  return { token: jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: '30d' }), user: publicUser(u) };
}

export function verifyToken(token) {
  const { sub } = jwt.verify(token, SECRET);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(sub);
  if (!u || u.active === 0) throw new Error('unknown user');
  return publicUser(u);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  // File downloads open in a new tab and cannot send headers, so they pass ?token=.
  const token = header.replace(/^Bearer /, '') || String(req.query.token || '');
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'يجب تسجيل الدخول' });
  }
}

/** IDs of the projects a user may see; null means all projects. */
export const isTop = (user) => user.role === 'admin' || user.role === 'sysadmin';

export function projectScope(user) {
  if (['admin', 'sysadmin', 'accountant'].includes(user.role)) return null;
  const kind = user.role === 'project_manager' ? 'manager' : 'supervisor';
  const own = db.prepare('SELECT project_id FROM project_members WHERE user_id = ? AND kind = ?').all(user.id, kind).map((r) => r.project_id);
  // Every engineer and supervisor can work with the factory.
  const f = factoryId();
  return f && !own.includes(f) ? [...own, f] : own;
}
