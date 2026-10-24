// Link with the custody app (custody.metal-lines.com): single sign-on into «المشاريع» from inside the custody app,
// the project list for its cost centres, and custody expenses counted in each project's real cost.
import { Router } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';
import { hashPassword, isTop, issueToken } from './auth.js';
import { todayStr } from './util.js';

const ROLES = ['admin', 'sysadmin', 'project_manager', 'supervisor', 'accountant'];
export const linkInfo = () => ({ url: getSetting('custody_url', ''), key: getSetting('custody_key', '') });
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sameKey = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length > 0 && x.length === y.length && timingSafeEqual(x, y); };

function verifySso(token) {
  const { key } = linkInfo();
  if (!key) throw new Error('الربط مع تطبيق العهدة غير مفعّل');
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) throw new Error('رابط الدخول غير صالح');
  const want = b64url(createHmac('sha256', key).update(payload).digest());
  if (!sameKey(sig, want)) throw new Error('رابط الدخول غير صالح');
  const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (!data.exp || data.exp < Date.now() / 1000) throw new Error('انتهت صلاحية رابط الدخول، افتح المشاريع مرة أخرى');
  if (!data.u) throw new Error('رابط الدخول غير صالح');
  return data;
}

/** Same username = same person. Accounts created here by the custody app follow the role chosen there. */
function ssoUser(data) {
  const username = String(data.u).trim().toLowerCase();
  const role = ROLES.includes(data.r) ? data.r : 'supervisor';
  let u = db.prepare('SELECT * FROM users WHERE lower(username) = ?').get(username);
  if (!u) {
    const r = db.prepare(`INSERT INTO users (name, username, password_hash, role, phone, active, sso_source) VALUES (?, ?, ?, ?, ?, 1, 'custody')`)
      .run(String(data.n || username), username, hashPassword(randomBytes(18).toString('hex')), role, data.p || null);
    u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid));
  } else if (u.sso_source === 'custody') {
    db.prepare('UPDATE users SET name = ?, role = ?, active = 1 WHERE id = ?').run(String(data.n || u.name), role, u.id);
    u = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  }
  if (u.active === 0) throw new Error('حسابك في نظام المشاريع موقوف');
  return u;
}

/** Routes that work without a session (they carry their own proof). */
export const linkPublic = Router();
linkPublic.post('/auth/sso', (req, res) => {
  try {
    res.json(issueToken(ssoUser(verifySso(req.body?.token))));
  } catch (e) {
    res.status(401).json({ error: e.message || 'تعذر الدخول' });
  }
});
linkPublic.get('/integration/projects', (req, res) => {
  if (!sameKey(req.get('x-link-key'), linkInfo().key)) return res.status(401).json({ error: 'مفتاح الربط غير صحيح' });
  res.json(db.prepare(`SELECT id, name, kind, status FROM projects ORDER BY kind = 'project' DESC, name`).all());
});

/** Settings screen (general manager / system manager). */
export const linkAdmin = Router();
const topOnly = (req, res, next) => (isTop(req.user) ? next() : res.status(403).json({ error: 'للمدير العام ومدير النظام فقط' }));
linkAdmin.get('/link', topOnly, (_req, res) => res.json(linkInfo()));
linkAdmin.put('/link', topOnly, (req, res) => {
  const url = String(req.body?.url || '').trim().replace(/\/+$/, '');
  const key = String(req.body?.key || '').trim();
  if (url && !/^https?:\/\/[^\s/]+(\/\S*)?$/.test(url)) return res.status(400).json({ error: 'رابط تطبيق العهدة غير صحيح' });
  if (key && key.length < 24) return res.status(400).json({ error: 'مفتاح الربط قصير جداً' });
  setSetting('custody_url', url);
  setSetting('custody_key', key);
  cache.clear();
  res.json(linkInfo());
});
linkAdmin.post('/link/test', topOnly, async (_req, res) => {
  const t = todayStr();
  const out = await custodyExpenses(`${t.slice(0, 4)}-01-01`, t, true);
  if (!out.ok) return res.status(400).json({ error: out.error });
  res.json({ ok: true, total: out.total, linked: out.byProject.size, company: out.company });
});

const cache = new Map();
/**
 * Approved custody expenses per project for a period: { ok, byProject: Map(projectId → amount), unlinked, total }.
 * Cached for a minute; never throws (reports still open if the custody app is unreachable).
 */
export async function custodyExpenses(from, to, fresh = false) {
  const { url, key } = linkInfo();
  if (!url || !key) return { ok: false, off: true, byProject: new Map(), unlinked: 0, total: 0 };
  const ck = `${from}|${to}`;
  const hit = cache.get(ck);
  if (!fresh && hit && hit.at > Date.now() - 60_000) return hit.v;
  let v;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${url}/api/integration/expenses?from=${from}&to=${to}`, { headers: { 'X-Link-Key': key, Accept: 'application/json' }, signal: ctl.signal });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    const byProject = new Map();
    let unlinked = 0, total = 0;
    for (const row of data.rows || []) {
      total += Number(row.amount) || 0;
      if (row.projectId) byProject.set(Number(row.projectId), (byProject.get(Number(row.projectId)) || 0) + (Number(row.amount) || 0));
      else unlinked += Number(row.amount) || 0;
    }
    v = { ok: true, byProject, unlinked, total, company: data.company, rows: data.rows || [], loansOutstanding: data.loansOutstanding || 0 };
  } catch (e) {
    v = { ok: false, error: `تعذر جلب مصروفات العهد: ${e.name === 'AbortError' ? 'انتهت المهلة' : e.message}`, byProject: new Map(), unlinked: 0, total: 0 };
  }
  if (cache.size > 100) cache.clear();
  cache.set(ck, { at: Date.now(), v });
  return v;
}
