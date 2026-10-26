// Link with the custody app (custody.metal-lines.com): single sign-on into «المشاريع» from inside the custody app,
// the project list for its cost centres, and custody expenses counted in each project's real cost.
import { Router } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';
import { hashPassword, isTop, issueToken } from './auth.js';
import { round, todayStr } from './util.js';
import { COST, feePortions, fixedByProject, fixedPortions, monthsBetween, overheadMonth } from './costs.js';

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
const keyOk = (req, res) => {
  if (sameKey(req.get('x-link-key'), linkInfo().key)) return true;
  res.status(401).json({ error: 'مفتاح الربط غير صحيح' });
  return false;
};
linkPublic.get('/integration/projects', (req, res) => {
  if (!keyOk(req, res)) return;
  res.json(db.prepare(`SELECT id, name, kind, status FROM projects ORDER BY kind = 'project' DESC, name`).all());
});
/**
 * A project cost centre was created or edited in the custody app: create / rename the project here.
 * Never calls the custody app back (the custody request that sent this is still holding its data lock).
 */
linkPublic.post('/integration/projects', (req, res) => {
  if (!keyOk(req, res)) return;
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'اسم المشروع مطلوب' });
  let p = b.projectId ? db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(b.projectId)) : null;
  if (!p) p = db.prepare('SELECT * FROM projects').all().find((x) => norm(x.name) === norm(name)) ?? null;
  if (!p) {
    p = { id: createProject(name, b.active !== false) };
  } else if (b.projectId && p.kind === 'project') {
    // Renamed or stopped in the custody app.
    const status = b.active === false ? (p.status === 'active' ? 'paused' : p.status) : p.status === 'paused' ? 'active' : p.status;
    db.prepare('UPDATE projects SET name = ?, status = ? WHERE id = ?').run(name, status, p.id);
  }
  bump();
  res.json({ id: p.id });
});
/** Workers of the projects system, for custody loans paid to workers. */
linkPublic.get('/integration/workers', (req, res) => {
  if (!keyOk(req, res)) return;
  res.json(db.prepare(`SELECT w.id, w.name, w.iqama_no, w.profession, w.phone, w.wage, w.wage_type, w.project_id, p.name AS project, p.kind AS project_kind
    FROM workers w LEFT JOIN projects p ON p.id = w.project_id WHERE w.active = 1 ORDER BY w.name`).all()
    .map((w) => ({ ...w, iqama_no: String(w.iqama_no).startsWith('بدون-') ? '' : w.iqama_no })));
});

/**
 * Real project costs for the custody app's comprehensive reports (custody expenses are added there,
 * so this never calls the custody app back).
 */
linkPublic.get('/integration/costs', (req, res) => {
  if (!keyOk(req, res)) return;
  const isD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const today = todayStr();
  const from = isD(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
  let to = isD(req.query.to) ? req.query.to : today;
  if (to > today) to = today;
  const only = req.query.project ? Number(req.query.project) : null;
  const P = { $from: from, $to: to };
  const months = monthsBetween(from, to);
  const projects = db.prepare(`SELECT p.id, p.name, p.kind, p.status, p.contract_value, p.progress,
      (SELECT COUNT(*) FROM workers w WHERE w.project_id = p.id AND w.active = 1) AS workers_now,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to AND a.status IN ('present','late','overtime')) AS man_days,
      (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to) AS labour,
      (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'subcontractor' AND v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to) AS subs,
      (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'client' AND v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to) AS billed
    FROM projects p ORDER BY p.kind = 'project' DESC, p.kind, p.name`).all(P);
  const byId = new Map(projects.map((p) => [p.id, Object.assign(p, { fees: 0, overhead: 0, labour: round(p.labour), subs: round(p.subs), billed: round(p.billed) })]));
  const fees = [];
  for (const m of months) for (const f of feePortions(m)) {
    const p = byId.get(f.project_id);
    if (p) p.fees += f.amount;
    if (!only || f.project_id === only) fees.push({ month: m, worker: f.name, kind: f.kind_label, paid: f.date, total: round(f.total), part: `${f.index}/${f.months}`, project_id: f.project_id, project: p?.name ?? '—', amount: round(f.amount) });
  }
  const overhead = months.map((m) => {
    const o = overheadMonth(m, true);
    for (const x of o.projects) { const p = byId.get(x.id); if (p) p.overhead += x.share; }
    return { month: m, salaries: o.salaries, fees: o.fees, fixed: o.fixed, fixedItems: o.fixedItems, total: o.total, basis: o.basis, projects: o.projects, staff: o.staff };
  });
  const fixed = fixedByProject(from, to);
  for (const p of projects) { p.fees = round(p.fees); p.overhead = round(p.overhead); p.fixed = round(fixed.get(p.id) ?? 0); }
  const invoices = db.prepare(`SELECT v.id, v.kind, v.number, v.status, v.gross, COALESCE(v.period_to, substr(v.created_at,1,10)) AS date, v.project_id, s.name AS sub
    FROM invoices v LEFT JOIN subcontractors s ON s.id = v.subcontractor_id
    WHERE v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to ${only ? `AND v.project_id = ${only}` : ''} ORDER BY date`).all(P);
  const labourMonths = only ? db.prepare(`SELECT substr(a.date,1,7) AS month, COUNT(DISTINCT a.worker_id) AS workers, SUM(a.status IN ('present','late','overtime')) AS man_days, COALESCE(SUM(${COST}), 0) AS cost
    FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = ? AND a.date BETWEEN ? AND ? GROUP BY month ORDER BY month`).all(only, from, to).map((r) => ({ ...r, cost: round(r.cost) })) : [];
  const fixedLines = only ? months.flatMap((m) => fixedPortions(m).filter((f) => f.project_id === only)
    .map((f) => ({ month: m, name: f.name, kind: f.kind_label, total: round(f.total), months: f.months, amount: round(f.amount) }))) : [];
  const workers = db.prepare(`SELECT COUNT(*) AS n, SUM(wage_type = 'monthly') AS monthly FROM workers WHERE active = 1`).get();
  res.json({ from, to, projects, overhead, fees, fixedLines, invoices, labourMonths, workers: workers.n });
});

const norm = (t) => String(t || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const bump = () => db.exec(`INSERT INTO settings (key, value) VALUES ('data_version', '2') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`);
function createProject(name, active) {
  const t = todayStr();
  const end = `${Number(t.slice(0, 4)) + 1}${t.slice(4)}`;
  return Number(db.prepare(`INSERT INTO projects (name, city, lat, lng, radius_m, start_date, end_date, planned_workers, progress, status, kind)
    VALUES (?, NULL, 0, 0, 300, ?, ?, 1, 0, ?, 'project')`).run(name, t, end, active ? 'active' : 'paused').lastInsertRowid);
}

/** Server-to-server call to the custody app with the shared key. */
async function custodyCall(path, body) {
  const { url, key } = linkInfo();
  if (!url || !key) throw new Error('الربط مع تطبيق العهدة غير مفعّل');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${url}${path}`, {
      method: body ? 'POST' : 'GET', signal: ctl.signal,
      headers: { 'X-Link-Key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  } finally { clearTimeout(timer); }
}

/** A project was created or edited here: make sure the custody app has a cost centre linked to it. */
export function pushProject(id, rename = true) {
  const p = db.prepare('SELECT id, name, kind, status FROM projects WHERE id = ?').get(id);
  if (!p || p.kind === 'office' || !linkInfo().url || !linkInfo().key) return Promise.resolve(null);
  return custodyCall('/api/integration/cost-centers', { projectId: p.id, name: p.name, active: p.status !== 'done', rename })
    .catch((e) => { console.warn('custody sync:', e.message); return null; });
}

/**
 * Two-way sync of projects and custody cost centres:
 *  - every project / factory here gets a linked cost centre there (an unlinked one with the same name is reused);
 *  - every top-level «مشروع» cost centre there without a project gets a project here.
 */
export async function syncCustody() {
  const { url, key } = linkInfo();
  if (!url || !key) return { ok: false, error: 'الربط مع تطبيق العهدة غير مفعّل' };
  try {
    let ccs = await custodyCall('/api/integration/cost-centers');
    const out = { ok: true, createdHere: [], linkedThere: [] };
    for (const c of ccs) {
      if (c.projectId || c.parentId || c.type !== 'project' || c.active === false) continue;
      const found = db.prepare('SELECT id, name FROM projects').all().find((x) => norm(x.name) === norm(c.name));
      const id = found?.id ?? createProject(c.name, true);
      if (!found) out.createdHere.push(c.name);
      await custodyCall('/api/integration/cost-centers', { projectId: id, name: c.name, rename: false });
    }
    ccs = await custodyCall('/api/integration/cost-centers');
    const linked = new Set(ccs.filter((c) => c.projectId).map((c) => c.projectId));
    for (const p of db.prepare(`SELECT id, name FROM projects WHERE kind IN ('project','factory')`).all()) {
      if (linked.has(p.id)) continue;
      await pushProject(p.id, false);
      out.linkedThere.push(p.name);
    }
    if (out.createdHere.length) bump();
    return out;
  } catch (e) {
    return { ok: false, error: `تعذرت المزامنة مع العهدة: ${e.name === 'AbortError' ? 'انتهت المهلة' : e.message}` };
  }
}

/** Approved custody expenses one by one, for detailed project reports. */
export async function custodyExpenseLines(from, to, projectId) {
  try {
    const q = new URLSearchParams({ from, to, ...(projectId ? { projectId: String(projectId) } : {}) });
    const d = await custodyCall(`/api/integration/expense-lines?${q}`);
    return { ok: true, rows: d.rows || [] };
  } catch (e) {
    return { ok: false, rows: [], error: `تعذر جلب مصروفات العهد: ${e.name === 'AbortError' ? 'انتهت المهلة' : e.message}` };
  }
}

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
  const sync = await syncCustody();
  res.json({ ok: true, total: out.total, linked: out.byProject.size, company: out.company, sync });
});
linkAdmin.post('/link/sync', topOnly, async (_req, res) => {
  const out = await syncCustody();
  if (!out.ok) return res.status(400).json({ error: out.error });
  res.json(out);
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
