// REST API for every section of موقعي. Mounted under /api after requireAuth.
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db, ensureFactory, ensureOffice, factoryId, officeId, getSetting, memberIds, memberNames, setMembers, setSetting, tx } from './db.js';
import { checkPassword, hashPassword, isTop, PERMISSIONS, projectScope, ROLE_LABELS } from './auth.js';
import { addDays, isFriday, round, todayStr, nowTime } from './util.js';
import { filesFor, projectGallery, removeFilesOf, UPLOAD_DIR, workerPhotos } from './media.js';
import { rmSync } from 'node:fs';
import { FEE_KINDS, FIXED_KINDS, feesByProject, fixedByProject, monthBounds, overheadFor, overheadMonth, projectCost } from './costs.js';
import { custodyExpenses, pushProject } from './link.js';
import { join } from 'node:path';

const withFiles = (entity, rows) => { const f = filesFor(entity, rows.map((r) => r.id)); return rows.map((r) => ({ ...r, media: f[r.id] || [] })); };

export const api = Router();

// ---------- helpers ----------
const RATE = `(CASE w.wage_type WHEN 'daily' THEN w.wage ELSE w.wage / 30.0 END)`;
const COST = `(CASE WHEN a.status IN ('present','late','overtime') THEN ${RATE} + a.overtime_hours * ${RATE} / 8.0 * 1.5 ELSE 0 END)`;
const inList = (col, ids) => (ids === null ? '1=1' : ids.length ? `${col} IN (${ids.map(Number).join(',')})` : '0=1');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const scopeOf = (req) => projectScope(req.user);
// Head-office staff («الإدارة») are visible only to the general manager, the system manager and the accountant —
// never to site engineers or supervisors.
const hidesOffice = (req) => scopeOf(req) !== null;
const isOfficeWorker = (w) => !!w && w.project_id != null && w.project_id === officeId();
const ensureProject = (req, projectId) => {
  const id = Number(projectId);
  if (!id || !db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) fail(400, 'اختر المشروع');
  const s = scopeOf(req);
  if (s !== null && !s.includes(id)) fail(403, 'هذا المشروع خارج صلاحياتك');
  return id;
};
const need = (perm) => (req, _res, next) => (PERMISSIONS[perm].includes(req.user.role) ? next() : next(new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء')));
const changed = (req, entity, projectId) => req.app.locals.broadcast('data:changed', { entity, projectId });
const str = (v) => (v === undefined || v === null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const required = (v, label) => { const s = str(v); if (!s) fail(400, `الحقل «${label}» مطلوب`); return s; };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const nowStamp = () => `${todayStr()}T${nowTime()}`;
const monthRange = (m) => {
  const month = /^\d{4}-\d{2}$/.test(String(m || '')) ? m : todayStr().slice(0, 7);
  const from = `${month}-01`;
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  const last = d.toISOString().slice(0, 10);
  const today = todayStr();
  return { month, from, to: last, toCapped: last > today ? today : last, days: Number(last.slice(8)) };
};

// ---------- meta / settings / users ----------
api.get('/meta', (req, res) => {
  const scope = scopeOf(req);
  res.json({
    roles: ROLE_LABELS,
    users: db.prepare('SELECT id, name, role, active FROM users ORDER BY name').all(),
    projects: db.prepare(`SELECT id, name, status, kind FROM projects WHERE ${inList('id', scope)} ORDER BY kind = 'project', kind = 'factory' DESC, name`).all(),
    // Every active site a worker can be sent to — engineers move workers freely between all projects.
    places: db.prepare(`SELECT id, name, kind FROM projects WHERE status = 'active' ${scope === null ? '' : `AND kind <> 'office'`} ORDER BY kind = 'project', kind = 'factory' DESC, name`).all(),
    subcontractors: db.prepare('SELECT id, name FROM subcontractors ORDER BY name').all(),
    // Every profession already used, so new ones typed once become suggestions for everyone.
    professions: professionList().map((p) => p.name),
    settings: { companyName: getSetting('company_name', 'شركة الخطوط المعدنية للمقاولات العامة'), absenceCutoff: getSetting('absence_cutoff', '09:00') },
  });
});

api.put('/me/password', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!checkPassword(String(req.body?.current || ''), u.password_hash)) fail(400, 'كلمة المرور الحالية غير صحيحة');
  const next = String(req.body?.next || '');
  if (next.length < 6) fail(400, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), u.id);
  res.json({ ok: true });
});

api.get('/users', need('users'), (_req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.username, u.role, u.phone, u.active,
    (SELECT COUNT(DISTINCT pm.project_id) FROM project_members pm WHERE pm.user_id = u.id) AS projects
    FROM users u ORDER BY u.active DESC, u.role, u.name`).all());
});

const userInput = (b, creating) => {
  const role = String(b.role || '');
  if (!ROLE_LABELS[role]) fail(400, 'اختر الدور');
  const out = { name: required(b.name, 'الاسم'), username: required(b.username, 'اسم المستخدم').toLowerCase(), role, phone: str(b.phone), active: b.active === false || b.active === 0 ? 0 : 1 };
  if (creating || b.password) {
    if (String(b.password || '').length < 6) fail(400, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    out.password_hash = hashPassword(String(b.password));
  }
  return out;
};
const uniqueUser = (fn) => {
  try { return fn(); } catch (e) {
    if (String(e.message).includes('UNIQUE')) fail(400, 'اسم المستخدم مستخدم من قبل');
    throw e;
  }
};
api.post('/users', need('users'), (req, res) => {
  const u = userInput(req.body || {}, true);
  if (u.role === 'admin' && req.user.role !== 'admin') fail(403, 'تعيين مدير عام متاح للمدير العام فقط');
  const r = uniqueUser(() => db.prepare('INSERT INTO users (name, username, role, phone, active, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .run(u.name, u.username, u.role, u.phone, u.active, u.password_hash));
  changed(req, 'users');
  res.json({ id: Number(r.lastInsertRowid) });
});
api.put('/users/:id', need('users'), (req, res) => {
  const id = Number(req.params.id);
  const u = userInput(req.body || {}, false);
  if (id === req.user.id && (!['admin', 'sysadmin'].includes(u.role) || !u.active)) fail(400, 'لا يمكنك إلغاء صلاحياتك عن حسابك');
  if (u.role === 'admin' && req.user.role !== 'admin' && db.prepare('SELECT role FROM users WHERE id = ?').get(id)?.role !== 'admin') fail(403, 'تعيين مدير عام متاح للمدير العام فقط');
  uniqueUser(() => db.prepare('UPDATE users SET name = ?, username = ?, role = ?, phone = ?, active = ? WHERE id = ?')
    .run(u.name, u.username, u.role, u.phone, u.active, id));
  if (u.password_hash) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(u.password_hash, id);
  changed(req, 'users');
  res.json({ ok: true });
});

api.put('/settings', need('users'), (req, res) => {
  const b = req.body || {};
  if (str(b.companyName)) setSetting('company_name', str(b.companyName));
  if (/^\d{2}:\d{2}$/.test(String(b.absenceCutoff || ''))) setSetting('absence_cutoff', b.absenceCutoff);
  changed(req, 'settings');
  res.json({ ok: true });
});

/** Start real use: remove all demo data, keep only the admin who asks. */
api.post('/admin/reset', need('users'), (req, res) => {
  if (String(req.body?.confirm || '') !== 'ابدأ') fail(400, 'اكتب كلمة «ابدأ» للتأكيد');
  for (const f of db.prepare('SELECT path FROM attachments').all()) rmSync(join(UPLOAD_DIR, f.path), { force: true });
  tx(() => {
    for (const t of ['iqama_renewals', 'attachments', 'project_members', 'direct_order_items', 'direct_orders', 'invoices', 'daily_reports', 'attendance', 'worker_assignments', 'issues', 'workers', 'subcontractors', 'projects']) db.exec(`DELETE FROM ${t}`);
    db.prepare('DELETE FROM users WHERE id <> ?').run(req.user.id);
    ensureFactory();
    ensureOffice();
  });
  changed(req, 'all');
  res.json({ ok: true });
});

// ---------- professions (the company's list of jobs) ----------
const savedProfessions = () => { try { return JSON.parse(getSetting('professions', '[]')) } catch { return [] } };
/** The saved list plus any profession already used by a worker, with how many workers have each. */
function professionList() {
  const used = new Map(db.prepare(`SELECT TRIM(profession) AS name, COUNT(*) AS n FROM workers WHERE active = 1 AND TRIM(profession) <> '' GROUP BY TRIM(profession)`).all().map((r) => [r.name, r.n]));
  const names = [...new Set([...savedProfessions(), ...used.keys()])];
  return names.map((name) => ({ name, workers: used.get(name) ?? 0 })).sort((a, b) => b.workers - a.workers || a.name.localeCompare(b.name, 'ar'));
}
api.get('/professions', (_req, res) => res.json(professionList()));
api.post('/professions', need('workers'), (req, res) => {
  // Accepts one name or many (one per line) so a whole list can be pasted at once.
  const names = String(req.body?.names ?? req.body?.name ?? '').split(/[\n،,]+/).map((n) => n.trim()).filter(Boolean);
  if (!names.length) fail(400, 'اكتب اسم المهنة');
  setSetting('professions', JSON.stringify([...new Set([...savedProfessions(), ...names])]));
  changed(req, 'professions');
  res.json({ ok: true, added: names.length });
});
api.put('/professions', need('workers'), (req, res) => {
  const from = required(req.body?.from, 'المهنة الحالية');
  const to = required(req.body?.to, 'الاسم الجديد');
  // Renaming also updates every worker who has this profession.
  const r = db.prepare('UPDATE workers SET profession = ? WHERE TRIM(profession) = ?').run(to, from);
  setSetting('professions', JSON.stringify([...new Set(savedProfessions().map((n) => (n === from ? to : n)).concat(to))]));
  changed(req, 'professions');
  res.json({ ok: true, workers: r.changes });
});
api.delete('/professions', need('workers'), (req, res) => {
  const name = required(req.query.name, 'المهنة');
  const n = db.prepare('SELECT COUNT(*) AS n FROM workers WHERE active = 1 AND TRIM(profession) = ?').get(name).n;
  if (n) fail(400, `لا يمكن حذف «${name}» — مسجلة لـ ${n} عامل. غيّر اسمها أو مهنة العمال أولاً`);
  setSetting('professions', JSON.stringify(savedProfessions().filter((x) => x !== name)));
  changed(req, 'professions');
  res.json({ ok: true });
});

// ---------- subcontractors ----------
api.get('/subcontractors', (_req, res) => {
  res.json(db.prepare(`SELECT s.id, s.name,
    (SELECT COUNT(*) FROM workers w WHERE w.subcontractor_id = s.id AND w.active = 1) AS workers
    FROM subcontractors s ORDER BY s.name`).all());
});
api.post('/subcontractors', need('workers'), (req, res) => {
  const r = db.prepare('INSERT INTO subcontractors (name) VALUES (?)').run(required(req.body?.name, 'اسم المقاول'));
  changed(req, 'subcontractors');
  res.json({ id: Number(r.lastInsertRowid) });
});
api.put('/subcontractors/:id', need('workers'), (req, res) => {
  db.prepare('UPDATE subcontractors SET name = ? WHERE id = ?').run(required(req.body?.name, 'اسم المقاول'), Number(req.params.id));
  changed(req, 'subcontractors');
  res.json({ ok: true });
});

// ---------- projects ----------
const projectSelect = (where) => `
  SELECT p.*, ${memberNames('supervisor')} AS supervisor, ${memberNames('manager')} AS manager,
    ${memberIds('manager')} AS manager_ids_csv, ${memberIds('supervisor')} AS supervisor_ids_csv,
    (SELECT COUNT(*) FROM workers w WHERE w.project_id = p.id AND w.active = 1) AS assigned,
    (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = $today AND a.status IN ('present','late','overtime')) AS present,
    (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status <> 'closed') AS open_issues,
    (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN $monthStart AND $today) AS cost_month,
    (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id) AS cost_total,
    (SELECT MAX(date) FROM daily_reports d WHERE d.project_id = p.id) AS last_report
  FROM projects p
  WHERE ${where}`;
const projectParams = () => { const today = todayStr(); return { $today: today, $monthStart: today.slice(0, 8) + '01' }; };
const ids = (csv) => (csv ? String(csv).split(',').map(Number) : []);
const roundProject = ({ manager_ids_csv, supervisor_ids_csv, ...p }) => ({
  ...p, manager_ids: ids(manager_ids_csv), supervisor_ids: ids(supervisor_ids_csv), cost_month: round(p.cost_month), cost_total: round(p.cost_total),
});
const idList = (v, single) => {
  const arr = Array.isArray(v) ? v : single ? [single] : [];
  return [...new Set(arr.map(Number).filter((n) => n > 0))];
};

api.get('/projects', (req, res) => {
  const rows = db.prepare(projectSelect(`${inList('p.id', scopeOf(req))} AND p.kind = 'project'`) + ' ORDER BY p.status, p.name').all(projectParams());
  // Latest photo of each project, used as its cover.
  const covers = Object.fromEntries(db.prepare(`SELECT project_id, MAX(id) AS id FROM attachments WHERE kind = 'image' AND entity IN ('project','daily_report','issue') GROUP BY project_id`).all().map((r) => [r.project_id, r.id]));
  res.json(rows.map((r) => ({ ...roundProject(r), cover: covers[r.id] ? `/api/files/${covers[r.id]}` : null })));
});

api.get('/projects/:id', async (req, res) => {
  const id = ensureProject(req, req.params.id);
  const p = roundProject(db.prepare(projectSelect('p.id = $id')).get({ ...projectParams(), $id: id }));
  const today = todayStr();
  p.workers = db.prepare(`SELECT w.id, w.name, w.profession, w.nationality, a.status AS today
    FROM workers w LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ?
    WHERE w.project_id = ? AND w.active = 1 ORDER BY w.name`).all(today, id);
  p.issues = db.prepare(`SELECT i.id, i.title, i.severity, i.status, i.due_at FROM issues i WHERE i.project_id = ? AND i.status <> 'closed' ORDER BY i.due_at`).all(id);
  p.series = db.prepare(`SELECT date, SUM(status IN ('present','late','overtime')) AS present, SUM(status = 'absent') AS absent
    FROM attendance WHERE project_id = ? AND date >= ? GROUP BY date ORDER BY date`).all(id, addDays(today, -13));
  p.reports = db.prepare(`SELECT d.id, d.date, d.work_done, u.name AS author FROM daily_reports d LEFT JOIN users u ON u.id = d.created_by
    WHERE d.project_id = ? ORDER BY d.date DESC LIMIT 5`).all(id);
  const inv = db.prepare(`SELECT kind, COALESCE(SUM(gross), 0) AS gross FROM invoices WHERE project_id = ? AND status IN ('approved','paid') GROUP BY kind`).all(id);
  p.invoiced = round(inv.find((r) => r.kind === 'client')?.gross ?? 0);
  p.subcontracted = round(inv.find((r) => r.kind === 'subcontractor')?.gross ?? 0);
  {
    const month = today.slice(0, 7);
    const start = p.start_date < today ? p.start_date : today;
    const [cm, ct] = await Promise.all([custodyExpenses(`${month}-01`, today), custodyExpenses(start, today)]);
    const m = projectCost(id, `${month}-01`, today, cm.byProject.get(id) || 0);
    const all = projectCost(id, start, today, ct.byProject.get(id) || 0);
    p.costs = { month: m, total: all, custodyLinked: cm.ok, custodyError: cm.off ? null : cm.error || null };
  }
  p.renewals = db.prepare(`SELECT r.id, r.date, r.amount, r.kind, r.months, w.name FROM iqama_renewals r JOIN workers w ON w.id = r.worker_id WHERE r.project_id = ? ORDER BY r.date DESC LIMIT 50`).all(id);
  p.gallery = projectGallery(id);
  p.documents = filesFor('project', [id])[id]?.filter((f) => f.tag === 'doc') ?? [];
  res.json(p);
});

const projectInput = (b) => {
  const start = String(b.start_date || ''), end = String(b.end_date || '');
  if (!isDate(start) || !isDate(end)) fail(400, 'حدد تاريخ البداية والنهاية');
  if (end < start) fail(400, 'تاريخ النهاية قبل تاريخ البداية');
  const planned = num(b.planned_workers);
  if (planned < 1) fail(400, 'حدد عدد العمالة المخطط');
  return {
    name: required(b.name, 'اسم المشروع'), city: str(b.city), client: str(b.client),
    contract_value: num(b.contract_value), lat: num(b.lat), lng: num(b.lng), radius_m: num(b.radius_m, 300),
    start_date: start, end_date: end, planned_workers: planned,
    progress: Math.min(100, Math.max(0, num(b.progress))),
    status: ['active', 'paused', 'done'].includes(b.status) ? b.status : 'active',
  };
};
api.post('/projects', need('projectsCreate'), (req, res) => {
  const b = req.body || {};
  const p = projectInput(b);
  const id = tx(() => {
    const r = db.prepare(`INSERT INTO projects (name, city, client, contract_value, lat, lng, radius_m, start_date, end_date, planned_workers, progress, status)
      VALUES ($name, $city, $client, $contract_value, $lat, $lng, $radius_m, $start_date, $end_date, $planned_workers, $progress, $status)`)
      .run(Object.fromEntries(Object.entries(p).map(([k, v]) => [`$${k}`, v])));
    const pid = Number(r.lastInsertRowid);
    setMembers(pid, idList(b.manager_ids, b.manager_id), idList(b.supervisor_ids, b.supervisor_id));
    return pid;
  });
  changed(req, 'projects', id);
  pushProject(id);
  res.json({ id });
});
api.put('/projects/:id', need('projects'), (req, res) => {
  const id = ensureProject(req, req.params.id);
  const b = req.body || {};
  const p = projectInput(b);
  let managers = idList(b.manager_ids, b.manager_id);
  if (!isTop(req.user)) {
    // A project manager cannot change who manages the project; supervisors can be assigned.
    managers = db.prepare(`SELECT user_id FROM project_members WHERE project_id = ? AND kind = 'manager'`).all(id).map((r) => r.user_id);
  }
  tx(() => {
    db.prepare(`UPDATE projects SET name=$name, city=$city, client=$client, contract_value=$contract_value, lat=$lat, lng=$lng, radius_m=$radius_m,
      start_date=$start_date, end_date=$end_date, planned_workers=$planned_workers, progress=$progress, status=$status
      WHERE id=$id`).run({ ...Object.fromEntries(Object.entries(p).map(([k, v]) => [`$${k}`, v])), $id: id });
    setMembers(id, managers, idList(b.supervisor_ids, b.supervisor_id));
  });
  changed(req, 'projects', id);
  pushProject(id);
  res.json({ ok: true });
});

// ---------- workers ----------
api.get('/workers', (req, res) => {
  const { from, toCapped } = monthRange();
  // All engineers and supervisors see every worker so they can pull them into their project or the factory.
  const where = ['1=1'];
  const params = { $from: from, $to: toCapped, $soon: addDays(todayStr(), 30), $today: todayStr() };
  if (req.query.project === 'none') where.push('w.project_id IS NULL');
  else if (req.query.project) { where.push('w.project_id = $project'); params.$project = Number(req.query.project); }
  if (req.query.active !== 'all') where.push(`w.active = ${req.query.active === '0' ? 0 : 1}`);
  if (hidesOffice(req)) where.push(`(p.kind IS NULL OR p.kind <> 'office')`);
  const rows = db.prepare(`
    SELECT w.*, p.name AS project, p.kind AS location_kind, s.name AS subcontractor,
      (SELECT COUNT(*) FROM attendance a WHERE a.worker_id = w.id AND a.date BETWEEN $from AND $to AND a.status IN ('present','late','overtime')) AS days_present,
      (SELECT COUNT(*) FROM attendance a WHERE a.worker_id = w.id AND a.date BETWEEN $from AND $to AND a.status = 'absent') AS days_absent,
      (w.iqama_expiry <= $soon) AS iqama_soon,
      (SELECT a.status FROM attendance a WHERE a.worker_id = w.id AND a.date = $today) AS today
    FROM workers w LEFT JOIN projects p ON p.id = w.project_id LEFT JOIN subcontractors s ON s.id = w.subcontractor_id
    WHERE ${where.join(' AND ')} ORDER BY w.name`).all(params);
  const photos = workerPhotos();
  res.json(rows.map((w) => ({ ...w, photo: photos[w.id] ? `/api/files/${photos[w.id]}` : null })));
});

api.get('/workers/:id', (req, res) => {
  const w = db.prepare(`SELECT w.*, p.name AS project, p.kind AS location_kind, s.name AS subcontractor FROM workers w
    LEFT JOIN projects p ON p.id = w.project_id LEFT JOIN subcontractors s ON s.id = w.subcontractor_id WHERE w.id = ?`).get(Number(req.params.id));
  if (!w || (hidesOffice(req) && isOfficeWorker(w))) fail(404, 'العامل غير موجود');
  w.history = db.prepare(`SELECT wa.from_date, wa.to_date, p.name AS project FROM worker_assignments wa JOIN projects p ON p.id = wa.project_id
    WHERE wa.worker_id = ? ORDER BY wa.from_date DESC`).all(w.id);
  w.attendance = db.prepare(`SELECT a.date, a.status, a.check_in, a.check_out, a.overtime_hours, p.name AS project FROM attendance a LEFT JOIN projects p ON p.id = a.project_id
    WHERE a.worker_id = ? ORDER BY a.date DESC LIMIT 62`).all(w.id);
  w.renewals = db.prepare(`SELECT r.id, r.date, r.amount, r.kind, r.months, r.new_expiry, r.note, p.name AS project FROM iqama_renewals r LEFT JOIN projects p ON p.id = r.project_id WHERE r.worker_id = ? ORDER BY r.date DESC`).all(w.id);
  w.media = filesFor('worker', [w.id])[w.id] || [];
  const ph = [...w.media].reverse().find((m) => m.tag === 'photo');
  w.photo = ph ? ph.url : null;
  res.json(w);
});

const workerInput = (req, b) => {
  const wageType = b.wage_type === 'monthly' ? 'monthly' : 'daily';
  if (!isDate(b.iqama_expiry)) fail(400, 'حدد تاريخ انتهاء الإقامة');
  const wage = num(b.wage);
  if (wage <= 0) fail(400, 'حدد الأجر');
  return {
    name: required(b.name, 'اسم العامل'), iqama_no: required(b.iqama_no, 'رقم الإقامة'), iqama_expiry: b.iqama_expiry,
    nationality: required(b.nationality, 'الجنسية'), profession: required(b.profession, 'المهنة'), phone: str(b.phone),
    wage_type: wageType, wage, subcontractor_id: num(b.subcontractor_id) || null,
    project_id: b.project_id ? ensureProject(req, b.project_id) : null,
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
};
const uniqueIqama = (fn) => {
  try { return fn(); } catch (e) {
    if (String(e.message).includes('iqama_no')) fail(400, 'رقم الإقامة مسجل لعامل آخر');
    throw e;
  }
};
api.post('/workers', need('workers'), (req, res) => {
  const w = workerInput(req, req.body || {});
  const id = tx(() => {
    const r = uniqueIqama(() => db.prepare(`INSERT INTO workers (name, iqama_no, iqama_expiry, nationality, profession, phone, wage_type, wage, subcontractor_id, project_id, active, qr_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(w.name, w.iqama_no, w.iqama_expiry, w.nationality, w.profession, w.phone, w.wage_type, w.wage, w.subcontractor_id, w.project_id, w.active, randomUUID()));
    const wid = Number(r.lastInsertRowid);
    if (w.project_id) db.prepare('INSERT INTO worker_assignments (worker_id, project_id, from_date) VALUES (?, ?, ?)').run(wid, w.project_id, todayStr());
    return wid;
  });
  changed(req, 'workers', w.project_id);
  res.json({ id });
});
api.put('/workers/:id', need('workers'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
  if (!cur || (hidesOffice(req) && isOfficeWorker(cur))) fail(404, 'العامل غير موجود');
  const w = workerInput(req, { ...(req.body || {}), ...(PERMISSIONS.costs.includes(req.user.role) ? {} : { wage: cur.wage, wage_type: cur.wage_type }) });
  if (hidesOffice(req) && w.project_id === officeId()) fail(403, 'النقل إلى الإدارة للمدير العام والمحاسب فقط');
  tx(() => {
    uniqueIqama(() => db.prepare(`UPDATE workers SET name=?, iqama_no=?, iqama_expiry=?, nationality=?, profession=?, phone=?, wage_type=?, wage=?, subcontractor_id=?, project_id=?, active=? WHERE id=?`)
      .run(w.name, w.iqama_no, w.iqama_expiry, w.nationality, w.profession, w.phone, w.wage_type, w.wage, w.subcontractor_id, w.project_id, w.active, id));
    if (cur.project_id !== w.project_id) {
      // A transfer closes the open assignment and starts a new one today.
      db.prepare('UPDATE worker_assignments SET to_date = ? WHERE worker_id = ? AND to_date IS NULL').run(addDays(todayStr(), -1), id);
      if (w.project_id) db.prepare('INSERT INTO worker_assignments (worker_id, project_id, from_date) VALUES (?, ?, ?)').run(id, w.project_id, todayStr());
    }
  });
  changed(req, 'workers', w.project_id ?? cur.project_id);
  res.json({ ok: true });
});

/** Move a worker to one of my projects, the factory, or leave them unassigned. */
api.post('/workers/:id/move', need('moveWorkers'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT id, name, project_id FROM workers WHERE id = ? AND active = 1').get(id);
  if (!cur || (hidesOffice(req) && isOfficeWorker(cur))) fail(404, 'العامل غير موجود');
  if (hidesOffice(req) && req.body?.project_id && Number(req.body.project_id) === officeId()) fail(403, 'النقل إلى الإدارة للمدير العام والمحاسب فقط');
  // Engineers and supervisors may send a worker to any active project or the factory, so workers can be followed day by day.
  let target = null;
  if (req.body?.project_id) {
    const p = db.prepare(`SELECT id, status FROM projects WHERE id = ?`).get(Number(req.body.project_id));
    if (!p) fail(400, 'المشروع غير موجود');
    if (p.status !== 'active') fail(400, 'هذا المشروع غير نشط');
    target = p.id;
  }
  if (target === cur.project_id) return res.json({ ok: true });
  tx(() => relocate(id, cur.project_id, target));
  changed(req, 'workers', target ?? cur.project_id);
  if (cur.project_id && cur.project_id !== target) changed(req, 'workers', cur.project_id);
  res.json({ ok: true });
});

/**
 * Add many workers at once (from Excel). Rows are matched by iqama number: new ones are added,
 * existing ones updated. Projects and subcontractors are matched by name (new subcontractors are created).
 */
api.post('/workers/import', need('workers'), (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 3000) : [];
  if (!rows.length) fail(400, 'لا توجد صفوف للاستيراد');
  const places = db.prepare('SELECT id, name FROM projects').all();
  const findPlace = (name) => {
    const n = String(name || '').trim();
    if (!n) return null;
    if (/^(المصنع|مصنع|الورشة|factory)$/i.test(n)) return factoryId();
    if (/^(الإدارة|الادارة|إدارة|ادارة|المكتب|office)$/i.test(n)) return officeId();
    return places.find((p) => p.name.trim() === n)?.id ?? fail(400, `المشروع «${n}» غير موجود`);
  };
  const subs = new Map(db.prepare('SELECT id, name FROM subcontractors').all().map((s) => [s.name.trim(), s.id]));
  const findSub = (name) => {
    const n = String(name || '').trim();
    if (!n || /^(الشركة|عمالة الشركة)$/.test(n)) return null;
    if (!subs.has(n)) subs.set(n, Number(db.prepare('INSERT INTO subcontractors (name) VALUES (?)').run(n).lastInsertRowid));
    return subs.get(n);
  };
  const normDate = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return '9999-12-31';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    fail(400, `تاريخ غير مفهوم «${s}» — استخدم 2027-05-30 أو 30/05/2027`);
  };
  const scope = scopeOf(req);
  const out = { added: 0, updated: 0, errors: [] };
  const getByIqama = db.prepare('SELECT id, project_id FROM workers WHERE iqama_no = ?');
  const ins = db.prepare(`INSERT INTO workers (name, iqama_no, iqama_expiry, nationality, profession, phone, wage_type, wage, subcontractor_id, project_id, active, qr_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  // Blank cells keep what is already saved for an existing worker.
  const upd = db.prepare(`UPDATE workers SET name=?, iqama_expiry=COALESCE(?, iqama_expiry), nationality=COALESCE(?, nationality), profession=COALESCE(?, profession),
    phone=COALESCE(?, phone), wage_type=COALESCE(?, wage_type), wage=COALESCE(?, wage), subcontractor_id=COALESCE(?, subcontractor_id), project_id=COALESCE(?, project_id), active=1 WHERE id=?`);
  const assign = db.prepare('INSERT INTO worker_assignments (worker_id, project_id, from_date) VALUES (?, ?, ?)');
  tx(() => {
    rows.forEach((r, i) => {
      try {
        const name = required(r.name, 'الاسم');
        const iqama = String(r.iqama_no ?? '').replace(/\s/g, '') || fail(400, 'رقم الإقامة مطلوب');
        const project = findPlace(r.project);
        if (project && scope !== null && !scope.includes(project)) fail(403, 'المشروع خارج صلاحياتك');
        const wageTxt = String(r.wage_type ?? '').trim();
        const wageType = /شهر|month/i.test(wageTxt) ? 'monthly' : 'daily';
        const wageNum = String(r.wage ?? '').replace(/[^\d.]/g, '');
        const sub = findSub(r.subcontractor);
        const cur = getByIqama.get(iqama);
        if (cur) {
          upd.run(name, String(r.iqama_expiry ?? '').trim() ? normDate(r.iqama_expiry) : null, str(r.nationality), str(r.profession), str(r.phone),
            wageTxt ? wageType : null, wageNum ? Number(wageNum) : null, sub, project, cur.id);
          if (project && project !== cur.project_id) {
            db.prepare('UPDATE worker_assignments SET to_date = ? WHERE worker_id = ? AND to_date IS NULL').run(addDays(todayStr(), -1), cur.id);
            assign.run(cur.id, project, todayStr());
          }
          out.updated++;
        } else {
          const id = Number(ins.run(name, iqama, normDate(r.iqama_expiry), str(r.nationality) ?? 'غير محدد', str(r.profession) ?? 'عامل', str(r.phone),
            wageType, wageNum ? Number(wageNum) : 0, sub, project, randomUUID()).lastInsertRowid);
          if (project) assign.run(id, project, todayStr());
          out.added++;
        }
      } catch (e) {
        out.errors.push({ row: i + 1, error: e.message });
      }
    });
  });
  changed(req, 'workers');
  res.json(out);
});

// ---------- attendance ----------
api.get('/attendance', (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : todayStr();
  const scope = scopeOf(req);
  // A worker belongs, on a given day, to the site where his attendance was recorded; otherwise to where he is now.
  const site = 'COALESCE(a.project_id, w.project_id)';
  const where = ['w.active = 1', `${site} IS NOT NULL`, inList(site, scope)];
  const params = [date];
  if (req.query.project) { where.push(`${site} = ?`); params.push(Number(req.query.project)); }
  const photos = workerPhotos();
  const rows = db.prepare(`
    SELECT w.id AS worker_id, w.name, w.profession, ${site} AS project_id, p.name AS project, p.kind AS project_kind, w.project_id AS current_project_id,
      a.status, a.check_in, a.check_out, a.overtime_hours, a.method
    FROM workers w
    LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ?
    JOIN projects p ON p.id = ${site}
    WHERE ${where.join(' AND ')} ORDER BY p.kind = 'factory', p.name, w.name`).all(...params)
    .map((r) => ({ ...r, photo: photos[r.worker_id] ? `/api/files/${photos[r.worker_id]}` : null }));
  res.json({ date, rows });
});

/**
 * Attendance of every site the user looks after on a day: workers there, how many are recorded,
 * so the supervisor picks a site from big cards and sees at a glance which sites still need attendance.
 * Head office («الإدارة») has no daily attendance.
 */
function attendanceSites(req, date) {
  const scope = scopeOf(req);
  const site = 'COALESCE(a.project_id, w.project_id)';
  const rows = db.prepare(`
    SELECT ${site} AS id, COUNT(*) AS workers,
      SUM(a.status IS NOT NULL AND COALESCE(a.method, '') <> 'auto') AS recorded,
      SUM(a.status IN ('present','late','overtime')) AS present, SUM(a.status = 'absent') AS absent, SUM(a.status = 'leave') AS leave
    FROM workers w LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ?
    WHERE w.active = 1 AND ${site} IS NOT NULL AND ${inList(site, scope)} GROUP BY ${site}`).all(date);
  const by = new Map(rows.map((r) => [r.id, r]));
  return db.prepare(`SELECT id, name, kind, status FROM projects WHERE kind <> 'office' AND status = 'active' AND ${inList('id', scope)}
      ORDER BY kind = 'factory', name`).all()
    .map((p) => {
      const r = by.get(p.id) ?? { workers: 0, recorded: 0, present: 0, absent: 0, leave: 0 };
      const state = !r.workers ? 'empty' : r.recorded >= r.workers ? 'done' : r.recorded > 0 ? 'partial' : 'none';
      return { id: p.id, name: p.name, kind: p.kind, workers: r.workers, recorded: r.recorded ?? 0, present: r.present ?? 0, absent: r.absent ?? 0, leave: r.leave ?? 0, missing: Math.max(0, r.workers - (r.recorded ?? 0)), state };
    });
}
api.get('/attendance/sites', (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : todayStr();
  res.json({ date, sites: attendanceSites(req, date) });
});
/**
 * Daily reminder: sites (of this user) whose attendance for today is not taken yet.
 * Shown inside the app and polled by the phone app to raise a notification, from the reminder time until it is recorded.
 */
api.get('/attendance/reminders', (req, res) => {
  const today = todayStr();
  const from = getSetting('attendance_remind_from', '08:00');
  // Reminders go to the people responsible for each site (its engineers and supervisors).
  const active = !isFriday(today) && nowTime() >= from && PERMISSIONS.attendance.includes(req.user.role) && scopeOf(req) !== null;
  const due = active ? attendanceSites(req, today).filter((s) => s.state === 'none' || s.state === 'partial') : [];
  res.json({ date: today, from, due: due.map((s) => ({ id: s.id, name: s.name, missing: s.missing, workers: s.workers })) });
});

/** Put a worker on another site from today (keeps the history of where he worked). */
function relocate(workerId, from, to) {
  if (from === to) return;
  db.prepare('UPDATE workers SET project_id = ? WHERE id = ?').run(to, workerId);
  db.prepare('UPDATE worker_assignments SET to_date = ? WHERE worker_id = ? AND to_date IS NULL').run(addDays(todayStr(), -1), workerId);
  if (to) db.prepare('INSERT INTO worker_assignments (worker_id, project_id, from_date) VALUES (?, ?, ?)').run(workerId, to, todayStr());
  // Today's attendance follows the worker to his new site.
  if (to) db.prepare('UPDATE attendance SET project_id = ? WHERE worker_id = ? AND date = ?').run(to, workerId, todayStr());
}

api.post('/attendance', need('attendance'), (req, res) => {
  const b = req.body || {};
  const date = isDate(b.date) ? b.date : fail(400, 'حدد التاريخ');
  if (date > todayStr()) fail(400, 'لا يمكن تسجيل حضور ليوم قادم');
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const statuses = ['present', 'absent', 'late', 'leave', 'overtime'];
  const touched = new Set();
  const scope = scopeOf(req);
  const inScope = (pid) => scope === null || scope.includes(pid);
  const canMove = PERMISSIONS.moveWorkers.includes(req.user.role);
  tx(() => {
    const getW = db.prepare('SELECT id, name, project_id FROM workers WHERE id = ?');
    const getA = db.prepare('SELECT project_id FROM attendance WHERE worker_id = ? AND date = ?');
    const getP = db.prepare('SELECT id, status FROM projects WHERE id = ?');
    const del = db.prepare('DELETE FROM attendance WHERE worker_id = ? AND date = ?');
    const up = db.prepare(`INSERT INTO attendance (worker_id, project_id, date, status, check_in, check_out, overtime_hours, method, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)
      ON CONFLICT(worker_id, date) DO UPDATE SET project_id = excluded.project_id, status = excluded.status, check_in = excluded.check_in,
        check_out = excluded.check_out, overtime_hours = excluded.overtime_hours, recorded_by = excluded.recorded_by`);
    for (const e of entries) {
      const w = getW.get(Number(e.worker_id));
      if (!w || (hidesOffice(req) && isOfficeWorker(w))) continue;
      if (hidesOffice(req) && e.project_id && Number(e.project_id) === officeId()) fail(403, 'النقل إلى الإدارة للمدير العام والمحاسب فقط');
      const before = getA.get(w.id, date)?.project_id ?? w.project_id;
      let site = before;
      if (e.project_id && Number(e.project_id) !== before) {
        // The supervisor says where the worker worked that day — any active site, so workers can be followed day by day.
        if (!canMove) fail(403, 'ليست لديك صلاحية نقل العمال');
        const p = getP.get(Number(e.project_id));
        if (!p || p.status !== 'active') fail(400, 'الموقع المختار غير نشط');
        if (!inScope(p.id) && !(before && inScope(before))) fail(403, 'هذا العامل خارج مواقعك');
        site = p.id;
      } else if (site) {
        ensureProject(req, site);
      }
      if (!site) continue;
      touched.add(site);
      if (before) touched.add(before);
      if (date === todayStr() && site !== w.project_id) relocate(w.id, w.project_id, site);
      if (!e.status) { del.run(w.id, date); continue; }
      if (!statuses.includes(e.status)) fail(400, 'حالة حضور غير معروفة');
      const works = ['present', 'late', 'overtime'].includes(e.status);
      up.run(w.id, site, date, e.status, works ? str(e.check_in) : null, works ? str(e.check_out) : null,
        e.status === 'overtime' ? Math.max(0, num(e.overtime_hours, 2)) : 0, req.user.id);
    }
  });
  for (const pid of touched) changed(req, 'attendance', pid);
  res.json({ ok: true, saved: entries.length });
});

/** Monthly sheet: one row per worker, one status letter per day. */
function monthSheet(req, month, project) {
  const r = monthRange(month);
  const scope = scopeOf(req);
  const params = { $from: r.from, $to: r.to };
  if (project) params.$project = Number(project);
  // Days are counted on the site where they were worked, so a worker who moved between sites is split correctly.
  const site = (col) => (project ? `${col} = $project` : inList(col, scope));
  const workers = db.prepare(`SELECT w.id, w.name, w.profession, w.wage_type, w.wage, w.iqama_no, COALESCE(p.name, 'غير موزّع') AS project, s.name AS subcontractor
    FROM workers w LEFT JOIN projects p ON p.id = w.project_id LEFT JOIN subcontractors s ON s.id = w.subcontractor_id
    WHERE (w.active = 1 AND ${site('w.project_id')})
      OR EXISTS (SELECT 1 FROM attendance a WHERE a.worker_id = w.id AND a.date BETWEEN $from AND $to AND ${site('a.project_id')})
    ORDER BY p.kind = 'factory', p.name, w.name`).all(params);
  const att = db.prepare(`SELECT a.worker_id, a.date, a.status, a.overtime_hours, p.name AS site FROM attendance a JOIN projects p ON p.id = a.project_id
    WHERE a.date BETWEEN $from AND $to AND ${site('a.project_id')}`).all(params);
  const byWorker = new Map();
  for (const a of att) {
    if (!byWorker.has(a.worker_id)) byWorker.set(a.worker_id, {});
    byWorker.get(a.worker_id)[a.date] = a;
  }
  const rows = workers.map((w) => {
    const days = byWorker.get(w.id) || {};
    let worked = 0, absent = 0, leave = 0, late = 0, ot = 0;
    const cells = [];
    const cellSites = [];
    const sites = [...new Set(Object.values(days).map((a) => a.site))];
    for (let d = 1; d <= r.days; d++) {
      const date = `${r.month}-${String(d).padStart(2, '0')}`;
      const a = days[date];
      cells.push(a ? a.status : null);
      cellSites.push(a ? a.site : null);
      if (!a) continue;
      if (['present', 'late', 'overtime'].includes(a.status)) worked++;
      if (a.status === 'late') late++;
      if (a.status === 'absent') absent++;
      if (a.status === 'leave') leave++;
      ot += a.overtime_hours || 0;
    }
    const rate = w.wage_type === 'daily' ? w.wage : w.wage / 30;
    const pay = round(worked * rate + ot * (rate / 8) * 1.5);
    return { ...w, sites, cells, cellSites, worked, absent, leave, late, overtime: ot, rate: round(rate), pay };
  });
  return { ...r, rows };
}
api.get('/attendance/month', (req, res) => res.json(monthSheet(req, req.query.month, req.query.project)));

// ---------- daily reports ----------
api.get('/daily-reports', (req, res) => {
  const where = [inList('d.project_id', scopeOf(req))];
  const params = {};
  if (req.query.project) { where.push('d.project_id = $project'); params.$project = Number(req.query.project); }
  if (isDate(req.query.from)) { where.push('d.date >= $from'); params.$from = req.query.from; }
  if (isDate(req.query.to)) { where.push('d.date <= $to'); params.$to = req.query.to; }
  res.json(withFiles('daily_report', db.prepare(`
    SELECT d.*, p.name AS project, u.name AS author,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = d.project_id AND a.date = d.date AND a.status IN ('present','late','overtime')) AS present,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = d.project_id AND a.date = d.date AND a.status = 'absent') AS absent,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = d.project_id AND substr(i.created_at, 1, 10) = d.date) AS new_issues
    FROM daily_reports d JOIN projects p ON p.id = d.project_id LEFT JOIN users u ON u.id = d.created_by
    WHERE ${where.join(' AND ')} ORDER BY d.date DESC, p.name LIMIT 300`).all(params)));
});
const reportInput = (req, b) => ({
  project_id: ensureProject(req, b.project_id),
  date: isDate(b.date) ? b.date : fail(400, 'حدد التاريخ'),
  weather: str(b.weather), work_done: required(b.work_done, 'الأعمال المنفذة'), next_plan: str(b.next_plan),
  equipment: str(b.equipment), materials: str(b.materials), obstacles: str(b.obstacles),
  progress: b.progress === '' || b.progress === null || b.progress === undefined ? null : Math.min(100, Math.max(0, num(b.progress))),
});
const saveReport = (req, d, id) => {
  return tx(() => {
    if (id) {
      db.prepare(`UPDATE daily_reports SET project_id=?, date=?, weather=?, work_done=?, next_plan=?, equipment=?, materials=?, obstacles=?, progress=? WHERE id=?`)
        .run(d.project_id, d.date, d.weather, d.work_done, d.next_plan, d.equipment, d.materials, d.obstacles, d.progress, id);
    } else {
      try {
        id = Number(db.prepare(`INSERT INTO daily_reports (project_id, date, weather, work_done, next_plan, equipment, materials, obstacles, progress, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(d.project_id, d.date, d.weather, d.work_done, d.next_plan, d.equipment, d.materials, d.obstacles, d.progress, req.user.id, nowStamp()).lastInsertRowid);
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) fail(400, 'يوجد تقرير لهذا المشروع في نفس اليوم — افتحه وعدّله');
        throw e;
      }
    }
    if (d.progress !== null) db.prepare('UPDATE projects SET progress = ? WHERE id = ?').run(d.progress, d.project_id);
    changed(req, 'daily_reports', d.project_id);
    return id;
  });
};
api.post('/daily-reports', need('dailyReports'), (req, res) => { const id = saveReport(req, reportInput(req, req.body || {})); res.json({ ok: true, id }); });
api.put('/daily-reports/:id', need('dailyReports'), (req, res) => {
  const cur = db.prepare('SELECT project_id FROM daily_reports WHERE id = ?').get(Number(req.params.id));
  if (!cur) fail(404, 'التقرير غير موجود');
  ensureProject(req, cur.project_id);
  saveReport(req, reportInput(req, req.body || {}), Number(req.params.id));
  res.json({ ok: true });
});

// ---------- issues ----------
const CATEGORIES = ['safety', 'materials', 'equipment', 'subcontractor', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
api.get('/issues', (req, res) => {
  const where = [inList('i.project_id', scopeOf(req))];
  const params = {};
  if (req.query.project) { where.push('i.project_id = $project'); params.$project = Number(req.query.project); }
  if (req.query.status === 'active') where.push(`i.status <> 'closed'`);
  else if (['open', 'in_progress', 'closed'].includes(req.query.status)) { where.push('i.status = $status'); params.$status = req.query.status; }
  res.json(withFiles('issue', db.prepare(`
    SELECT i.*, p.name AS project, a.name AS assignee, r.name AS reporter, (i.status <> 'closed' AND i.due_at < $now) AS overdue
    FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users a ON a.id = i.assignee_id LEFT JOIN users r ON r.id = i.reported_by
    WHERE ${where.join(' AND ')}
    ORDER BY (i.status = 'closed'), CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, i.due_at
    LIMIT 500`).all({ ...params, $now: nowStamp() })));
});
const issueInput = (req, b) => ({
  project_id: ensureProject(req, b.project_id), title: required(b.title, 'عنوان البلاغ'), description: str(b.description),
  category: CATEGORIES.includes(b.category) ? b.category : 'other', severity: SEVERITIES.includes(b.severity) ? b.severity : 'medium',
  assignee_id: num(b.assignee_id) || null, due_at: str(b.due_at), status: ['open', 'in_progress', 'closed'].includes(b.status) ? b.status : 'open',
  resolution: str(b.resolution),
});
api.post('/issues', need('issues'), (req, res) => {
  const i = issueInput(req, req.body || {});
  const r = db.prepare(`INSERT INTO issues (project_id, title, description, category, severity, status, assignee_id, reported_by, due_at, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`).run(i.project_id, i.title, i.description, i.category, i.severity, i.assignee_id, req.user.id, i.due_at, nowStamp());
  changed(req, 'issues', i.project_id);
  res.json({ id: Number(r.lastInsertRowid) });
});
api.put('/issues/:id', need('issues'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
  if (!cur) fail(404, 'البلاغ غير موجود');
  ensureProject(req, cur.project_id);
  const i = issueInput(req, { ...cur, ...req.body });
  const closedAt = i.status === 'closed' ? (cur.closed_at || nowStamp()) : null;
  // A new deadline clears the escalation so it can escalate again if missed.
  const escalated = i.due_at !== cur.due_at ? 0 : cur.escalated;
  db.prepare(`UPDATE issues SET project_id=?, title=?, description=?, category=?, severity=?, status=?, assignee_id=?, due_at=?, resolution=?, closed_at=?, escalated=? WHERE id=?`)
    .run(i.project_id, i.title, i.description, i.category, i.severity, i.status, i.assignee_id, i.due_at, i.resolution, closedAt, escalated, id);
  changed(req, 'issues', i.project_id);
  res.json({ ok: true });
});

// ---------- invoices (المستخلصات) ----------
const invoiceMath = (v) => {
  const retention = round((v.gross * v.retention_pct) / 100);
  const net = round(v.gross - retention - v.deductions);
  const vat = round((net * v.vat_pct) / 100);
  return { ...v, retention, net, vat, total: round(net + vat) };
};
api.get('/invoices', (req, res) => {
  const where = [inList('v.project_id', scopeOf(req))];
  const params = {};
  if (req.query.project) { where.push('v.project_id = $project'); params.$project = Number(req.query.project); }
  if (['client', 'subcontractor'].includes(req.query.kind)) { where.push('v.kind = $kind'); params.$kind = req.query.kind; }
  const rows = db.prepare(`SELECT v.*, p.name AS project, s.name AS subcontractor, p.client
    FROM invoices v JOIN projects p ON p.id = v.project_id LEFT JOIN subcontractors s ON s.id = v.subcontractor_id
    WHERE ${where.join(' AND ')} ORDER BY v.created_at DESC`).all(params).map(invoiceMath);
  res.json(withFiles('invoice', rows));
});
const invoiceInput = (req, b) => {
  const kind = b.kind === 'subcontractor' ? 'subcontractor' : 'client';
  const v = {
    project_id: ensureProject(req, b.project_id), kind, subcontractor_id: kind === 'subcontractor' ? (num(b.subcontractor_id) || fail(400, 'اختر مقاول الباطن')) : null,
    number: required(b.number, 'رقم المستخلص'), period_from: isDate(b.period_from) ? b.period_from : null, period_to: isDate(b.period_to) ? b.period_to : null,
    gross: num(b.gross), retention_pct: num(b.retention_pct, 10), deductions: num(b.deductions), vat_pct: num(b.vat_pct, 15),
    status: ['draft', 'submitted', 'approved', 'paid', 'rejected'].includes(b.status) ? b.status : 'draft', notes: str(b.notes),
  };
  if (v.gross <= 0) fail(400, 'أدخل قيمة الأعمال المنفذة');
  return v;
};
api.post('/invoices', need('invoices'), (req, res) => {
  const v = invoiceInput(req, req.body || {});
  const r = db.prepare(`INSERT INTO invoices (project_id, kind, subcontractor_id, number, period_from, period_to, gross, retention_pct, deductions, vat_pct, status, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(v.project_id, v.kind, v.subcontractor_id, v.number, v.period_from, v.period_to, v.gross, v.retention_pct, v.deductions, v.vat_pct, v.status, v.notes, req.user.id, nowStamp());
  changed(req, 'invoices', v.project_id);
  res.json({ id: Number(r.lastInsertRowid) });
});
api.put('/invoices/:id', need('invoices'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT project_id FROM invoices WHERE id = ?').get(id);
  if (!cur) fail(404, 'المستخلص غير موجود');
  ensureProject(req, cur.project_id);
  const v = invoiceInput(req, req.body || {});
  db.prepare(`UPDATE invoices SET project_id=?, kind=?, subcontractor_id=?, number=?, period_from=?, period_to=?, gross=?, retention_pct=?, deductions=?, vat_pct=?, status=?, notes=? WHERE id=?`)
    .run(v.project_id, v.kind, v.subcontractor_id, v.number, v.period_from, v.period_to, v.gross, v.retention_pct, v.deductions, v.vat_pct, v.status, v.notes, id);
  changed(req, 'invoices', v.project_id);
  res.json({ ok: true });
});
api.delete('/invoices/:id', need('delete'), (req, res) => {
  const cur = db.prepare('SELECT project_id, status FROM invoices WHERE id = ?').get(Number(req.params.id));
  if (!cur) fail(404, 'المستخلص غير موجود');
  ensureProject(req, cur.project_id);
  removeFilesOf('invoice', [Number(req.params.id)]);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(Number(req.params.id));
  changed(req, 'invoices', cur.project_id);
  res.json({ ok: true });
});

// ---------- direct orders (الإسناد المباشر) ----------
const orderTotals = `
  (SELECT COALESCE(SUM(qty * unit_price), 0) FROM direct_order_items it WHERE it.order_id = o.id) AS value,
  (SELECT COALESCE(SUM(MIN(done_qty, qty) * unit_price), 0) FROM direct_order_items it WHERE it.order_id = o.id) AS done_value,
  (SELECT COUNT(*) FROM direct_order_items it WHERE it.order_id = o.id) AS items_count`;
api.get('/direct-orders', (req, res) => {
  const where = [inList('o.project_id', scopeOf(req))];
  const params = {};
  if (req.query.project) { where.push('o.project_id = $project'); params.$project = Number(req.query.project); }
  res.json(db.prepare(`SELECT o.*, p.name AS project, s.name AS subcontractor, ${orderTotals}
    FROM direct_orders o JOIN projects p ON p.id = o.project_id LEFT JOIN subcontractors s ON s.id = o.subcontractor_id
    WHERE ${where.join(' AND ')} ORDER BY (o.status IN ('done','cancelled')), o.date DESC`).all(params)
    .map((o) => ({ ...o, value: round(o.value), done_value: round(o.done_value) })));
});
api.get('/direct-orders/:id', (req, res) => {
  const o = db.prepare(`SELECT o.*, p.name AS project, s.name AS subcontractor FROM direct_orders o JOIN projects p ON p.id = o.project_id
    LEFT JOIN subcontractors s ON s.id = o.subcontractor_id WHERE o.id = ?`).get(Number(req.params.id));
  if (!o) fail(404, 'أمر الإسناد غير موجود');
  ensureProject(req, o.project_id);
  o.items = db.prepare('SELECT * FROM direct_order_items WHERE order_id = ? ORDER BY id').all(o.id);
  o.media = filesFor('direct_order', [o.id])[o.id] || [];
  res.json(o);
});
const orderInput = (req, b) => {
  const items = (Array.isArray(b.items) ? b.items : []).filter((it) => str(it.description)).map((it) => ({
    description: str(it.description), unit: str(it.unit) || 'مقطوعية', qty: Math.max(0, num(it.qty, 1)),
    unit_price: Math.max(0, num(it.unit_price)), done_qty: Math.max(0, num(it.done_qty)),
  }));
  if (!items.length) fail(400, 'أضف بنداً واحداً على الأقل');
  return {
    project_id: ensureProject(req, b.project_id), subcontractor_id: num(b.subcontractor_id) || null, number: required(b.number, 'رقم الأمر'),
    title: required(b.title, 'وصف الأعمال'), date: isDate(b.date) ? b.date : todayStr(), due_date: isDate(b.due_date) ? b.due_date : null,
    status: ['open', 'in_progress', 'done', 'cancelled'].includes(b.status) ? b.status : 'open', notes: str(b.notes), items,
  };
};
const saveItems = (orderId, items) => {
  db.prepare('DELETE FROM direct_order_items WHERE order_id = ?').run(orderId);
  const ins = db.prepare('INSERT INTO direct_order_items (order_id, description, unit, qty, unit_price, done_qty) VALUES (?, ?, ?, ?, ?, ?)');
  for (const it of items) ins.run(orderId, it.description, it.unit, it.qty, it.unit_price, it.done_qty);
};
api.post('/direct-orders', need('directOrders'), (req, res) => {
  const o = orderInput(req, req.body || {});
  const id = tx(() => {
    const r = db.prepare(`INSERT INTO direct_orders (project_id, subcontractor_id, number, title, date, due_date, status, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(o.project_id, o.subcontractor_id, o.number, o.title, o.date, o.due_date, o.status, o.notes, req.user.id, nowStamp());
    const oid = Number(r.lastInsertRowid);
    saveItems(oid, o.items);
    return oid;
  });
  changed(req, 'direct_orders', o.project_id);
  res.json({ id });
});
api.put('/direct-orders/:id', need('directOrders'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT project_id FROM direct_orders WHERE id = ?').get(id);
  if (!cur) fail(404, 'أمر الإسناد غير موجود');
  ensureProject(req, cur.project_id);
  const o = orderInput(req, req.body || {});
  tx(() => {
    db.prepare(`UPDATE direct_orders SET project_id=?, subcontractor_id=?, number=?, title=?, date=?, due_date=?, status=?, notes=? WHERE id=?`)
      .run(o.project_id, o.subcontractor_id, o.number, o.title, o.date, o.due_date, o.status, o.notes, id);
    saveItems(id, o.items);
  });
  changed(req, 'direct_orders', o.project_id);
  res.json({ ok: true });
});
api.delete('/direct-orders/:id', need('delete'), (req, res) => {
  const cur = db.prepare('SELECT project_id FROM direct_orders WHERE id = ?').get(Number(req.params.id));
  if (!cur) fail(404, 'أمر الإسناد غير موجود');
  ensureProject(req, cur.project_id);
  tx(() => {
    removeFilesOf('direct_order', [Number(req.params.id)]);
    db.prepare('DELETE FROM direct_order_items WHERE order_id = ?').run(Number(req.params.id));
    db.prepare('DELETE FROM direct_orders WHERE id = ?').run(Number(req.params.id));
  });
  changed(req, 'direct_orders', cur.project_id);
  res.json({ ok: true });
});

// ---------- iqama renewals (a real cost charged to the worker's site) ----------
api.get('/iqama-renewals', need('costs'), (req, res) => {
  const where = ['1=1']; const params = [];
  if (req.query.worker) { where.push('r.worker_id = ?'); params.push(Number(req.query.worker)); }
  if (/^\d{4}-\d{2}$/.test(String(req.query.month || ''))) { const b = monthBounds(req.query.month); where.push('r.date BETWEEN ? AND ?'); params.push(b.from, b.to); }
  const scope = scopeOf(req);
  if (scope !== null) where.push(inList('r.project_id', scope));
  res.json(db.prepare(`SELECT r.*, w.name, w.iqama_no, p.name AS project, p.kind AS project_kind, u.name AS author FROM iqama_renewals r
    JOIN workers w ON w.id = r.worker_id LEFT JOIN projects p ON p.id = r.project_id LEFT JOIN users u ON u.id = r.created_by
    WHERE ${where.join(' AND ')} ORDER BY r.date DESC, r.id DESC LIMIT 500`).all(...params));
});
api.post(['/workers/:id/iqama-renewal', '/workers/:id/fees'], need('costs'), (req, res) => {
  const id = Number(req.params.id);
  const w = db.prepare('SELECT id, project_id FROM workers WHERE id = ?').get(id);
  if (!w) fail(404, 'العامل غير موجود');
  const b = req.body || {};
  const date = isDate(b.date) ? b.date : todayStr();
  const amount = num(b.amount, NaN);
  if (!(amount > 0)) fail(400, 'اكتب المبلغ');
  const kind = FEE_KINDS[b.kind] ? b.kind : 'iqama';
  const months = Math.round(num(b.months, 3));
  if (!(months >= 1 && months <= 60)) fail(400, 'عدد الأشهر من 1 إلى 60');
  const expiry = kind === 'iqama' ? str(b.new_expiry) : null;
  if (expiry && !isDate(expiry)) fail(400, 'تاريخ الانتهاء الجديد غير صحيح');
  // Charged to the site the worker belonged to on that day (or the chosen one).
  const at = db.prepare(`SELECT project_id FROM worker_assignments WHERE worker_id = ? AND from_date <= ? AND (to_date IS NULL OR to_date >= ?) ORDER BY from_date DESC LIMIT 1`).get(id, date, date)?.project_id;
  const project = b.project_id ? Number(b.project_id) : at ?? w.project_id ?? null;
  const rid = tx(() => {
    const r = db.prepare(`INSERT INTO iqama_renewals (worker_id, project_id, date, amount, kind, months, new_expiry, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, project, date, amount, kind, months, expiry, str(b.note), req.user.id, nowStamp());
    if (expiry) db.prepare('UPDATE workers SET iqama_expiry = ? WHERE id = ?').run(expiry, id);
    return Number(r.lastInsertRowid);
  });
  changed(req, 'workers', project);
  res.json({ ok: true, id: rid });
});
api.delete(['/iqama-renewals/:id', '/fees/:id'], need('delete'), (req, res) => {
  const r = db.prepare('SELECT project_id FROM iqama_renewals WHERE id = ?').get(Number(req.params.id));
  if (!r) fail(404, 'السجل غير موجود');
  db.prepare('DELETE FROM iqama_renewals WHERE id = ?').run(Number(req.params.id));
  changed(req, 'workers', r.project_id);
  res.json({ ok: true });
});
// ---------- fixed expenses: rent of the office, the factory, cars… (money: managers & accountant only) ----------
const fixedInput = (b) => {
  const name = str(b.name) ?? fail(400, 'اكتب اسم المصروف');
  const amount = num(b.amount, NaN);
  if (!(amount > 0)) fail(400, 'اكتب المبلغ');
  const months = Math.round(num(b.months, 1));
  if (![1, 2, 3, 4, 6, 12].includes(months)) fail(400, 'المدة: شهر أو 3 أو 6 أو 12 شهراً');
  const start = isDate(b.start_date) ? b.start_date : `${todayStr().slice(0, 7)}-01`;
  const end = isDate(b.end_date) ? b.end_date : null;
  if (end && end < start) fail(400, 'تاريخ الإيقاف قبل تاريخ البداية');
  const project = b.project_id ? Number(b.project_id) : officeId();
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(project)) fail(400, 'الموقع غير موجود');
  return { name, kind: FIXED_KINDS[b.kind] ? b.kind : 'other', amount, months, project_id: project, start_date: start, end_date: end, note: str(b.note) };
};
api.get('/fixed-costs', need('costs'), (_req, res) => {
  res.json({ kinds: FIXED_KINDS, list: db.prepare(`SELECT f.*, p.name AS project, p.kind AS project_kind, ROUND(f.amount * 1.0 / f.months, 2) AS monthly
    FROM fixed_costs f LEFT JOIN projects p ON p.id = f.project_id ORDER BY (f.end_date IS NOT NULL AND f.end_date < date('now')), f.name`).all() });
});
api.post('/fixed-costs', need('costs'), (req, res) => {
  const f = fixedInput(req.body || {});
  const r = db.prepare(`INSERT INTO fixed_costs (name, kind, amount, months, project_id, start_date, end_date, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(f.name, f.kind, f.amount, f.months, f.project_id, f.start_date, f.end_date, f.note, req.user.id, nowStamp());
  changed(req, 'costs');
  res.json({ id: Number(r.lastInsertRowid) });
});
api.put('/fixed-costs/:id', need('costs'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM fixed_costs WHERE id = ?').get(id)) fail(404, 'المصروف غير موجود');
  const f = fixedInput(req.body || {});
  db.prepare(`UPDATE fixed_costs SET name = ?, kind = ?, amount = ?, months = ?, project_id = ?, start_date = ?, end_date = ?, note = ? WHERE id = ?`)
    .run(f.name, f.kind, f.amount, f.months, f.project_id, f.start_date, f.end_date, f.note, id);
  changed(req, 'costs');
  res.json({ ok: true });
});
api.delete('/fixed-costs/:id', need('delete'), (req, res) => {
  db.prepare('DELETE FROM fixed_costs WHERE id = ?').run(Number(req.params.id));
  changed(req, 'costs');
  res.json({ ok: true });
});

api.get('/overhead', need('costs'), (req, res) => {
  const { month } = monthRange(req.query.month);
  res.json(overheadMonth(month, scopeOf(req) === null));
});

// ---------- deletes (general manager & system manager only) ----------
const del = (sql, ...a) => db.prepare(sql).run(...a);
api.delete('/projects/:id', need('delete'), (req, res) => {
  const id = ensureProject(req, req.params.id);
  if (id === factoryId()) fail(400, 'لا يمكن حذف المصنع');
  if (id === officeId()) fail(400, 'لا يمكن حذف الإدارة');
  tx(() => {
    del('DELETE FROM direct_order_items WHERE order_id IN (SELECT id FROM direct_orders WHERE project_id = ?)', id);
    for (const f of db.prepare('SELECT path FROM attachments WHERE project_id = ?').all(id)) rmSync(join(UPLOAD_DIR, f.path), { force: true });
    del(`DELETE FROM attachments WHERE project_id = ? AND entity <> 'worker'`, id);
    for (const t of ['direct_orders', 'invoices', 'daily_reports', 'issues', 'attendance', 'worker_assignments', 'project_members']) del(`DELETE FROM ${t} WHERE project_id = ?`, id);
    del('UPDATE iqama_renewals SET project_id = NULL WHERE project_id = ?', id);
    del('UPDATE workers SET project_id = NULL WHERE project_id = ?', id);
    del('DELETE FROM projects WHERE id = ?', id);
  });
  changed(req, 'projects');
  res.json({ ok: true });
});
api.delete('/workers/:id', need('delete'), (req, res) => {
  const id = Number(req.params.id);
  const w = db.prepare('SELECT project_id FROM workers WHERE id = ?').get(id);
  if (!w) fail(404, 'العامل غير موجود');
  tx(() => {
    removeFilesOf('worker', [id]);
    del('DELETE FROM attendance WHERE worker_id = ?', id);
    del('DELETE FROM worker_assignments WHERE worker_id = ?', id);
    del('DELETE FROM iqama_renewals WHERE worker_id = ?', id);
    del('DELETE FROM workers WHERE id = ?', id);
  });
  changed(req, 'workers', w.project_id);
  res.json({ ok: true });
});
api.delete('/daily-reports/:id', need('delete'), (req, res) => {
  const r = db.prepare('SELECT project_id FROM daily_reports WHERE id = ?').get(Number(req.params.id));
  if (!r) fail(404, 'التقرير غير موجود');
  removeFilesOf('daily_report', [Number(req.params.id)]);
  del('DELETE FROM daily_reports WHERE id = ?', Number(req.params.id));
  changed(req, 'daily_reports', r.project_id);
  res.json({ ok: true });
});
api.delete('/issues/:id', need('delete'), (req, res) => {
  const r = db.prepare('SELECT project_id FROM issues WHERE id = ?').get(Number(req.params.id));
  if (!r) fail(404, 'البلاغ غير موجود');
  removeFilesOf('issue', [Number(req.params.id)]);
  del('DELETE FROM issues WHERE id = ?', Number(req.params.id));
  changed(req, 'issues', r.project_id);
  res.json({ ok: true });
});
api.delete('/subcontractors/:id', need('delete'), (req, res) => {
  const id = Number(req.params.id);
  tx(() => {
    for (const t of ['workers', 'invoices', 'direct_orders']) del(`UPDATE ${t} SET subcontractor_id = NULL WHERE subcontractor_id = ?`, id);
    del('DELETE FROM subcontractors WHERE id = ?', id);
  });
  changed(req, 'subcontractors');
  res.json({ ok: true });
});
api.delete('/users/:id', need('delete'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) fail(400, 'لا يمكنك حذف حسابك');
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (!u) fail(404, 'المستخدم غير موجود');
  if (u.role === 'admin' && req.user.role !== 'admin') fail(403, 'حذف المدير العام متاح للمدير العام فقط');
  tx(() => {
    del('DELETE FROM project_members WHERE user_id = ?', id);
    del('UPDATE projects SET manager_id = NULL WHERE manager_id = ?', id);
    del('UPDATE projects SET supervisor_id = NULL WHERE supervisor_id = ?', id);
    del('UPDATE issues SET assignee_id = NULL WHERE assignee_id = ?', id);
    del('UPDATE issues SET reported_by = NULL WHERE reported_by = ?', id);
    del('UPDATE attendance SET recorded_by = NULL WHERE recorded_by = ?', id);
    for (const t of ['daily_reports', 'invoices', 'direct_orders']) del(`UPDATE ${t} SET created_by = NULL WHERE created_by = ?`, id);
    del('DELETE FROM users WHERE id = ?', id);
  });
  changed(req, 'users');
  res.json({ ok: true });
});

// ---------- reports & exports ----------
const STATUS_AR = { present: 'حاضر', late: 'متأخر', overtime: 'إضافي', absent: 'غائب', leave: 'إجازة' };
const STATUS_CODE = { present: 'ح', late: 'م', overtime: 'إ+', absent: 'غ', leave: 'ج' };
const ISSUE_STATUS = { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' };
const SEVERITY_AR = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
const INV_STATUS = { draft: 'مسودة', submitted: 'مقدم', approved: 'معتمد', paid: 'مدفوع', rejected: 'مرفوض' };

api.get('/reports/summary', async (req, res) => {
  const { month, from, toCapped } = monthRange(req.query.month);
  const scope = scopeOf(req);
  const projects = db.prepare(`
    SELECT p.id, p.name, p.kind, p.contract_value, p.progress,
      (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to) AS labour,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to AND a.status IN ('present','late','overtime')) AS man_days,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to AND a.status = 'absent') AS absences,
      (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'client' AND v.status IN ('approved','paid')) AS billed,
      (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'subcontractor' AND v.status IN ('approved','paid')) AS sub_cost,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status <> 'closed') AS open_issues
    FROM projects p WHERE ${inList('p.id', scope)} AND p.kind <> 'office' ORDER BY p.kind <> 'project', p.name`).all({ $from: from, $to: toCapped })
    .map((p) => {
      p.iqama = feesByProject(from, toCapped).get(p.id) ?? 0;
      p.fixed = round(fixedByProject(from, toCapped).get(p.id) ?? 0);
      const overhead = p.kind === 'project' ? overheadFor(p.id, [month]) : 0;
      return { ...p, labour: round(p.labour), billed: round(p.billed), sub_cost: round(p.sub_cost), iqama: round(p.iqama), overhead, total_cost: round(p.labour + p.iqama + p.fixed + overhead) };
    });
  const cx = await custodyExpenses(from, toCapped);
  for (const p of projects) { p.custody = round(cx.byProject.get(p.id) || 0); p.total_cost = round(p.total_cost + p.custody); }
  const o = overheadMonth(month, true);
  const top = scope === null;
  res.json({ month, projects, overhead: { ...o, staff: top ? o.staff : [], renewals: top ? o.renewals : [] }, custody: { linked: cx.ok, error: cx.off ? null : cx.error || null, unlinked: round(cx.unlinked || 0) } });
});

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sendCsv = (res, name, header, rows) => {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}.csv`);
  res.send('﻿' + body); // BOM so Excel shows Arabic correctly
};

api.get('/export/:kind', (req, res) => {
  const kind = req.params.kind;
  const fin = PERMISSIONS.costs.includes(req.user.role);
  if (!fin && ['payroll', 'costs', 'invoices'].includes(kind)) fail(403, 'هذا الملف للمدير العام والمحاسب فقط');
  const project = req.query.project ? Number(req.query.project) : null;
  if (project) ensureProject(req, project);
  if (kind === 'attendance' || kind === 'payroll') {
    const m = monthSheet(req, req.query.month, project);
    if (kind === 'attendance') {
      const days = Array.from({ length: m.days }, (_, i) => String(i + 1));
      return sendCsv(res, `الحضور-${m.month}`, ['العامل', 'المهنة', 'المشروع', ...days, 'أيام العمل', 'غياب', 'إجازة', 'ساعات إضافية'],
        m.rows.map((r) => [r.name, r.profession, r.project, ...r.cells.map((c) => (c ? STATUS_CODE[c] : '')), r.worked, r.absent, r.leave, r.overtime]));
    }
    return sendCsv(res, `الرواتب-${m.month}`, ['العامل', 'رقم الإقامة', 'المهنة', 'المشروع', 'مقاول الباطن', 'نوع الأجر', 'الأجر', 'أجر اليوم', 'أيام العمل', 'ساعات إضافية', 'المستحق (ر.س)'],
      m.rows.map((r) => [r.name, r.iqama_no, r.profession, r.project, r.subcontractor ?? '', r.wage_type === 'daily' ? 'يومي' : 'شهري', r.wage, r.rate, r.worked, r.overtime, r.pay]));
  }
  const scope = scopeOf(req);
  const pf = (col) => (project ? `${col} = ${project}` : inList(col, scope));
  if (kind === 'workers') {
    const rows = db.prepare(`SELECT w.*, p.name AS project, s.name AS subcontractor FROM workers w LEFT JOIN projects p ON p.id = w.project_id
      LEFT JOIN subcontractors s ON s.id = w.subcontractor_id WHERE ${pf('w.project_id')} ORDER BY w.name`).all();
    return sendCsv(res, 'العمال', ['الاسم', 'رقم الإقامة', 'انتهاء الإقامة', 'الجنسية', 'المهنة', 'الجوال', 'نوع الأجر', 'الأجر', 'المشروع', 'مقاول الباطن', 'الحالة'],
      rows.map((w) => [w.name, w.iqama_no, w.iqama_expiry, w.nationality, w.profession, w.phone ?? '', w.wage_type === 'daily' ? 'يومي' : 'شهري', fin ? w.wage : '', w.project ?? '', w.subcontractor ?? '', w.active ? 'نشط' : 'موقوف']));
  }
  if (kind === 'issues') {
    const rows = db.prepare(`SELECT i.*, p.name AS project, a.name AS assignee FROM issues i JOIN projects p ON p.id = i.project_id
      LEFT JOIN users a ON a.id = i.assignee_id WHERE ${pf('i.project_id')} ORDER BY i.created_at DESC`).all();
    return sendCsv(res, 'البلاغات', ['التاريخ', 'المشروع', 'العنوان', 'الخطورة', 'الحالة', 'المسؤول', 'المهلة', 'الحل'],
      rows.map((i) => [i.created_at.slice(0, 10), i.project, i.title, SEVERITY_AR[i.severity], ISSUE_STATUS[i.status], i.assignee ?? '', (i.due_at || '').slice(0, 10), i.resolution ?? '']));
  }
  if (kind === 'invoices') {
    const rows = db.prepare(`SELECT v.*, p.name AS project, s.name AS subcontractor FROM invoices v JOIN projects p ON p.id = v.project_id
      LEFT JOIN subcontractors s ON s.id = v.subcontractor_id WHERE ${pf('v.project_id')} ORDER BY v.created_at DESC`).all().map(invoiceMath);
    return sendCsv(res, 'المستخلصات', ['الرقم', 'النوع', 'المشروع', 'الجهة', 'من', 'إلى', 'قيمة الأعمال', 'محتجز', 'خصومات', 'الصافي', 'الضريبة', 'الإجمالي', 'الحالة'],
      rows.map((v) => [v.number, v.kind === 'client' ? 'مالك' : 'مقاول باطن', v.project, v.kind === 'client' ? 'المالك' : v.subcontractor, v.period_from ?? '', v.period_to ?? '', v.gross, v.retention, v.deductions, v.net, v.vat, v.total, INV_STATUS[v.status]]));
  }
  if (kind === 'costs') {
    const { month, from, toCapped } = monthRange(req.query.month);
    const rows = db.prepare(`SELECT p.name, a.date, COUNT(*) AS man_days, SUM(${COST}) AS cost FROM attendance a JOIN workers w ON w.id = a.worker_id
      JOIN projects p ON p.id = a.project_id WHERE a.date BETWEEN ? AND ? AND a.status IN ('present','late','overtime') AND ${pf('a.project_id')}
      GROUP BY p.id, a.date ORDER BY p.name, a.date`).all(from, toCapped);
    return sendCsv(res, `تكاليف-العمالة-${month}`, ['المشروع', 'التاريخ', 'أيام عمل', 'التكلفة (ر.س)'], rows.map((r) => [r.name, r.date, r.man_days, round(r.cost)]));
  }
  fail(404, 'نوع التصدير غير معروف');
});

export const STATUS_LABELS = STATUS_AR;

// Errors thrown with fail() become clean JSON responses.
// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
});
