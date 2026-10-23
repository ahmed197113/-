'use strict';
const { require: need, projectScope, assertProject, can } = require('../permissions');
const { h, HttpError, today, num, isDate } = require('../util');
const { laborCost } = require('../services');

// إحصائيات اليوم لمجموعة مشاريع
function projectStats(db, projects, user) {
  const d = today();
  const monthStart = d.slice(0, 8) + '01';
  const present = Object.fromEntries(db.prepare(`SELECT project_id, COUNT(*) c FROM attendance
    WHERE date = ? AND status IN ('present','late') GROUP BY project_id`).all(d).map((r) => [r.project_id, r.c]));
  const assigned = Object.fromEntries(db.prepare(`SELECT project_id, COUNT(*) c FROM workers
    WHERE active = 1 AND project_id IS NOT NULL GROUP BY project_id`).all().map((r) => [r.project_id, r.c]));
  const issues = Object.fromEntries(db.prepare(`SELECT project_id, COUNT(*) c FROM issues
    WHERE status != 'closed' GROUP BY project_id`).all().map((r) => [r.project_id, r.c]));
  const showCost = can(user, 'costs.view');
  const dayCost = showCost ? laborCost(db, { from: d, to: d }).byProject : {};
  const monthCost = showCost ? laborCost(db, { from: monthStart, to: d }).byProject : {};
  return projects.map((p) => ({
    ...p,
    contract_value: showCost ? p.contract_value : undefined,
    present_today: present[p.id] || 0,
    assigned_workers: assigned[p.id] || 0,
    open_issues: issues[p.id] || 0,
    cost_today: showCost ? dayCost[p.id] || 0 : undefined,
    cost_month: showCost ? monthCost[p.id] || 0 : undefined,
  }));
}

const BASE_SELECT = `SELECT p.*, m.name manager_name, s.name supervisor_name FROM projects p
  LEFT JOIN users m ON m.id = p.manager_id LEFT JOIN users s ON s.id = p.supervisor_id`;

function validate(db, b, existing = {}) {
  const v = {
    name: b.name ?? existing.name,
    location_name: b.location_name ?? existing.location_name ?? null,
    lat: num(b.lat, existing.lat ?? null),
    lng: num(b.lng, existing.lng ?? null),
    radius_m: num(b.radius_m, existing.radius_m ?? 300),
    start_date: b.start_date ?? existing.start_date ?? null,
    end_date: b.end_date ?? existing.end_date ?? null,
    planned_workers: num(b.planned_workers, existing.planned_workers ?? 0),
    progress: num(b.progress, existing.progress ?? 0),
    contract_value: num(b.contract_value, existing.contract_value ?? 0),
    manager_id: b.manager_id !== undefined ? num(b.manager_id) : existing.manager_id ?? null,
    supervisor_id: b.supervisor_id !== undefined ? num(b.supervisor_id) : existing.supervisor_id ?? null,
    status: b.status ?? existing.status ?? 'active',
  };
  if (!v.name || !String(v.name).trim()) throw new HttpError(400, 'اسم المشروع مطلوب');
  if (v.lat === null || v.lng === null) throw new HttpError(400, 'حدد موقع المشروع على الخريطة');
  if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) throw new HttpError(400, 'إحداثيات غير صالحة');
  if (v.radius_m < 20 || v.radius_m > 20000) throw new HttpError(400, 'نطاق المشروع بين 20 و20000 متر');
  if (v.start_date && !isDate(v.start_date)) throw new HttpError(400, 'تاريخ البداية غير صالح');
  if (v.end_date && !isDate(v.end_date)) throw new HttpError(400, 'تاريخ النهاية غير صالح');
  if (v.start_date && v.end_date && v.end_date < v.start_date) throw new HttpError(400, 'تاريخ النهاية قبل البداية');
  if (v.progress < 0 || v.progress > 100) throw new HttpError(400, 'نسبة الإنجاز بين 0 و100');
  if (v.planned_workers < 0) throw new HttpError(400, 'عدد العمال غير صالح');
  const roleOf = (id) => id && db.prepare('SELECT role FROM users WHERE id = ? AND active = 1').get(id)?.role;
  if (v.manager_id && roleOf(v.manager_id) !== 'pm') throw new HttpError(400, 'مدير المشروع يجب أن يكون بدور مدير مشروع');
  if (v.supervisor_id && roleOf(v.supervisor_id) !== 'supervisor') throw new HttpError(400, 'المشرف يجب أن يكون بدور مشرف موقع');
  v.name = String(v.name).trim();
  return v;
}

module.exports = (api, { db }) => {
  api.get('/projects', h((req, res) => {
    const s = projectScope(req.user);
    const where = [s.sql];
    const params = [...s.params];
    if (req.query.q) {
      where.push('(p.name LIKE ? OR p.location_name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.status) {
      where.push('p.status = ?');
      params.push(req.query.status);
    }
    const rows = db.prepare(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.status, p.name`).all(...params);
    res.json(projectStats(db, rows, req.user));
  }));

  api.post('/projects', need('projects.create'), h((req, res) => {
    const v = validate(db, req.body);
    const r = db.prepare(`INSERT INTO projects(name, location_name, lat, lng, radius_m, start_date, end_date,
      planned_workers, progress, contract_value, manager_id, supervisor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(v.name, v.location_name, v.lat, v.lng, v.radius_m,
      v.start_date, v.end_date, v.planned_workers, v.progress, v.contract_value, v.manager_id, v.supervisor_id, v.status);
    res.status(201).json(db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(r.lastInsertRowid));
  }));

  api.get('/projects/:id', h((req, res) => {
    const p = assertProject(db, req.user, req.params.id);
    const row = db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(p.id);
    const [stats] = projectStats(db, [row], req.user);
    const d = today();
    stats.workers = db.prepare(`SELECT w.id, w.name, w.profession, w.nationality, a.status today_status
      FROM workers w LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ?
      WHERE w.project_id = ? AND w.active = 1 ORDER BY w.name`).all(d, p.id);
    stats.recent_issues = db.prepare(`SELECT id, title, severity, status, due_at, escalated FROM issues
      WHERE project_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 10`).all(p.id);
    stats.recent_reports = db.prepare(`SELECT id, date, progress, description FROM daily_reports
      WHERE project_id = ? ORDER BY date DESC, id DESC LIMIT 7`).all(p.id);
    res.json(stats);
  }));

  api.put('/projects/:id', need('projects.edit'), h((req, res) => {
    const p = assertProject(db, req.user, req.params.id);
    const body = { ...req.body };
    if (req.user.role === 'pm') {
      // مدير المشروع لا يغيّر الإسناد ولا قيمة العقد
      delete body.manager_id;
      delete body.contract_value;
    }
    const v = validate(db, body, p);
    db.prepare(`UPDATE projects SET name=?, location_name=?, lat=?, lng=?, radius_m=?, start_date=?, end_date=?,
      planned_workers=?, progress=?, contract_value=?, manager_id=?, supervisor_id=?, status=? WHERE id=?`)
      .run(v.name, v.location_name, v.lat, v.lng, v.radius_m, v.start_date, v.end_date, v.planned_workers,
        v.progress, v.contract_value, v.manager_id, v.supervisor_id, v.status, p.id);
    res.json(db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(p.id));
  }));
};

module.exports.projectStats = projectStats;
