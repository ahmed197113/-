'use strict';
const { require: need, assertProject, projectScope, canAccessProject, can } = require('../permissions');
const { h, HttpError, num, nowIso, clock } = require('../util');
const { tx } = require('../db');
const { notify, managementIds } = require('../services');
const { uploader } = require('../uploads');
const { saveMedia, mediaOf, cleanup } = require('./reports');

const CATEGORIES = ['safety', 'materials', 'equipment', 'subcontractor', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'closed'];
// المهلة الافتراضية بالساعات حسب الأهمية
const DEFAULT_SLA = { critical: 4, high: 24, medium: 72, low: 168 };

function parseDue(v, severity) {
  if (v === undefined || v === null || v === '') {
    return new Date(clock.now().getTime() + DEFAULT_SLA[severity] * 3600000).toISOString();
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'مهلة غير صالحة');
  return d.toISOString();
}

function assignable(db, userId, projectId) {
  if (!userId) return null;
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(Number(userId));
  if (!u) throw new HttpError(400, 'المسؤول غير موجود');
  if (!canAccessProject(db, u, projectId)) throw new HttpError(400, 'المسؤول لا يملك صلاحية على هذا المشروع');
  return u.id;
}

module.exports = (api, { db, uploadsDir }) => {
  const upload = uploader(uploadsDir).array('media', 10);
  const SELECT = `SELECT i.*, p.name project_name, a.name assignee_name, r.name reporter_name FROM issues i
    JOIN projects p ON p.id = i.project_id LEFT JOIN users a ON a.id = i.assignee_id LEFT JOIN users r ON r.id = i.reported_by`;

  api.get('/issues', h((req, res) => {
    const s = projectScope(req.user);
    const where = [s.sql];
    const params = [...s.params];
    const q = req.query;
    for (const k of ['project_id', 'assignee_id']) {
      if (q[k]) {
        where.push(`i.${k} = ?`);
        params.push(Number(q[k]));
      }
    }
    for (const k of ['status', 'category', 'severity']) {
      if (q[k]) {
        where.push(`i.${k} = ?`);
        params.push(String(q[k]));
      }
    }
    if (q.open === '1') where.push("i.status != 'closed'");
    if (q.overdue === '1') {
      where.push("i.status != 'closed' AND i.due_at < ?");
      params.push(nowIso());
    }
    if (q.q) {
      where.push('(i.title LIKE ? OR i.description LIKE ?)');
      params.push(`%${q.q}%`, `%${q.q}%`);
    }
    const rows = db.prepare(`${SELECT} WHERE ${where.join(' AND ')}
      ORDER BY i.status = 'closed', CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      i.created_at DESC LIMIT 300`).all(...params);
    const now = nowIso();
    res.json(rows.map((i) => ({ ...i, overdue: i.status !== 'closed' && !!i.due_at && i.due_at < now })));
  }));

  api.post('/issues', need('issues.create'), upload, h((req, res) => {
    try {
      const b = req.body;
      const p = assertProject(db, req.user, b.project_id);
      if (b.client_id) {
        const ex = db.prepare('SELECT id FROM issues WHERE client_id = ?').get(String(b.client_id));
        if (ex) {
          cleanup(req.files);
          return res.json({ id: ex.id, duplicate: true });
        }
      }
      if (!b.title || !String(b.title).trim()) throw new HttpError(400, 'عنوان البلاغ مطلوب');
      if (!CATEGORIES.includes(b.category)) throw new HttpError(400, 'تصنيف غير صالح');
      if (!SEVERITIES.includes(b.severity)) throw new HttpError(400, 'درجة أهمية غير صالحة');
      const assignee = assignable(db, b.assignee_id || p.manager_id, p.id);
      const due = parseDue(b.due_at, b.severity);
      const id = tx(db, () => {
        const r = db.prepare(`INSERT INTO issues(project_id, title, description, category, severity, assignee_id, due_at,
          reported_by, lat, lng, client_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id,
          String(b.title).trim(), b.description || null, b.category, b.severity, assignee, due, req.user.id,
          num(b.lat), num(b.lng), b.client_id || null, nowIso());
        saveMedia(db, 'issue', r.lastInsertRowid, req.files, b.media_meta);
        return r.lastInsertRowid;
      });
      const targets = [assignee];
      if (['high', 'critical'].includes(b.severity) || b.category === 'safety') targets.push(...managementIds(db, p.id));
      notify(db, targets.filter((u) => u !== req.user.id), {
        title: `بلاغ جديد (${b.severity === 'critical' ? 'حرج' : b.severity === 'high' ? 'عالي' : 'عادي'}) — ${p.name}`,
        body: String(b.title).trim(),
        link: `#/issues/${id}`,
      });
      res.status(201).json({ id });
    } catch (e) {
      cleanup(req.files);
      throw e;
    }
  }));

  function load(req) {
    const i = db.prepare(`${SELECT} WHERE i.id = ?`).get(Number(req.params.id));
    if (!i) throw new HttpError(404, 'البلاغ غير موجود');
    if (!canAccessProject(db, req.user, i.project_id)) throw new HttpError(403, 'لا تملك صلاحية على هذا البلاغ');
    return i;
  }

  api.get('/issues/:id', h((req, res) => {
    const i = load(req);
    i.media = mediaOf(db, 'issue', i.id);
    i.overdue = i.status !== 'closed' && !!i.due_at && i.due_at < nowIso();
    res.json(i);
  }));

  // تحديث البلاغ: الإدارة/مدير المشروع يعدّلون كل شيء، والمسؤول يغيّر الحالة فقط
  api.put('/issues/:id', h((req, res) => {
    const i = load(req);
    const manager = can(req.user, 'issues.manage');
    if (!manager && i.assignee_id !== req.user.id) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');
    const b = req.body;
    const status = b.status ?? i.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة غير صالحة');
    let { assignee_id: assignee, due_at: due, severity } = i;
    if (manager) {
      if (b.assignee_id !== undefined) assignee = assignable(db, b.assignee_id, i.project_id);
      if (b.severity !== undefined) {
        if (!SEVERITIES.includes(b.severity)) throw new HttpError(400, 'درجة أهمية غير صالحة');
        severity = b.severity;
      }
      if (b.due_at !== undefined) due = parseDue(b.due_at, severity);
    } else if (b.assignee_id !== undefined || b.due_at !== undefined || b.severity !== undefined) {
      throw new HttpError(403, 'المسؤول يغيّر حالة البلاغ فقط');
    }
    const escalated = due !== i.due_at && due > nowIso() ? 0 : i.escalated;
    db.prepare(`UPDATE issues SET status = ?, assignee_id = ?, due_at = ?, severity = ?, escalated = ?,
      closed_at = CASE WHEN ? = 'closed' THEN COALESCE(closed_at, ?) ELSE NULL END WHERE id = ?`)
      .run(status, assignee, due, severity, escalated, status, nowIso(), i.id);
    if (assignee && assignee !== i.assignee_id) {
      notify(db, [assignee], { title: 'أُسند إليك بلاغ', body: `${i.title} — ${i.project_name}`, link: `#/issues/${i.id}` });
    }
    if (status === 'closed' && i.status !== 'closed') {
      notify(db, [i.reported_by].filter((u) => u !== req.user.id), { title: 'تم إغلاق البلاغ', body: i.title, link: `#/issues/${i.id}` });
    }
    res.json(db.prepare(`${SELECT} WHERE i.id = ?`).get(i.id));
  }));
};
