import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const SECRET = process.env.MAWQI_JWT_SECRET || 'mawqi-dev-secret-change-me';

export const ROLE_LABELS = {
  admin: 'مدير عام',
  project_manager: 'مدير مشروع',
  supervisor: 'مشرف موقع',
  accountant: 'محاسب',
};

/** What each role may change. Everyone signed in may read what their project scope allows. */
export const PERMISSIONS = {
  projects: ['admin', 'project_manager'],
  projectsCreate: ['admin'],
  workers: ['admin', 'project_manager'],
  attendance: ['admin', 'project_manager', 'supervisor'],
  dailyReports: ['admin', 'project_manager', 'supervisor'],
  issues: ['admin', 'project_manager', 'supervisor'],
  invoices: ['admin', 'accountant', 'project_manager'],
  directOrders: ['admin', 'project_manager'],
  users: ['admin'],
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
export function projectScope(user) {
  if (user.role === 'admin' || user.role === 'accountant') return null;
  const col = user.role === 'project_manager' ? 'manager_id' : 'supervisor_id';
  return db.prepare(`SELECT id FROM projects WHERE ${col} = ?`).all(user.id).map((r) => r.id);
}
