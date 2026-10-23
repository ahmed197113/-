'use strict';
const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');
const { require: need, assertProject, canAccessProject, visibleProjectIds, can } = require('../permissions');
const { h, HttpError, today, addDays, token, num, isDate, daysBetween } = require('../util');
const { tx } = require('../db');
const { attendanceSummary, payrollLine } = require('../services');
const { uploader } = require('../uploads');

const SELECT = `SELECT w.*, p.name project_name, s.name subcontractor_name FROM workers w
  LEFT JOIN projects p ON p.id = w.project_id LEFT JOIN subcontractors s ON s.id = w.subcontractor_id`;

// مشرف الموقع لا يرى الأجور
function shape(user, w) {
  const o = { ...w, has_photo: !!w.photo };
  delete o.photo;
  if (!can(user, 'costs.view')) {
    delete o.wage;
    delete o.wage_type;
  }
  if (user.role === 'supervisor') delete o.qr_token;
  if (o.iqama_expiry) o.iqama_days_left = daysBetween(today(), o.iqama_expiry);
  return o;
}

function loadWorker(db, user, id) {
  const w = db.prepare(`${SELECT} WHERE w.id = ?`).get(Number(id));
  if (!w) throw new HttpError(404, 'العامل غير موجود');
  const all = ['gm', 'owner', 'accountant'].includes(user.role);
  if (!all && !(w.project_id && canAccessProject(db, user, w.project_id))) {
    throw new HttpError(403, 'لا تملك صلاحية على هذا العامل');
  }
  return w;
}

function validate(db, b, ex = {}) {
  const v = {
    name: (b.name ?? ex.name ?? '').toString().trim(),
    iqama_no: (b.iqama_no ?? ex.iqama_no ?? '').toString().trim() || null,
    iqama_expiry: b.iqama_expiry ?? ex.iqama_expiry ?? null,
    nationality: b.nationality ?? ex.nationality ?? null,
    profession: b.profession ?? ex.profession ?? null,
    wage_type: b.wage_type ?? ex.wage_type ?? 'daily',
    wage: num(b.wage, ex.wage ?? 0),
    affiliation: b.affiliation ?? ex.affiliation ?? 'company',
    subcontractor_id: b.subcontractor_id !== undefined ? num(b.subcontractor_id) : ex.subcontractor_id ?? null,
  };
  if (!v.name) throw new HttpError(400, 'اسم العامل مطلوب');
  if (v.iqama_expiry === '') v.iqama_expiry = null;
  if (v.iqama_expiry && !isDate(v.iqama_expiry)) throw new HttpError(400, 'تاريخ انتهاء الإقامة غير صالح');
  if (!['daily', 'monthly'].includes(v.wage_type)) throw new HttpError(400, 'نوع الأجر غير صالح');
  if (v.wage < 0) throw new HttpError(400, 'الأجر غير صالح');
  if (!['company', 'sub'].includes(v.affiliation)) throw new HttpError(400, 'الجهة غير صالحة');
  if (v.affiliation === 'sub') {
    if (!v.subcontractor_id || !db.prepare('SELECT 1 FROM subcontractors WHERE id = ?').get(v.subcontractor_id)) {
      throw new HttpError(400, 'اختر مقاول الباطن');
    }
  } else v.subcontractor_id = null;
  return v;
}

module.exports = (api, { db, uploadsDir }) => {
  const photoDir = path.join(uploadsDir, 'photos');
  fs.mkdirSync(photoDir, { recursive: true });
  const photoUpload = uploader(photoDir, { maxMb: 8, imagesOnly: true });

  api.get('/workers', h((req, res) => {
    const where = ['1=1'];
    const params = [];
    if (!['gm', 'owner', 'accountant'].includes(req.user.role)) {
      const ids = visibleProjectIds(db, req.user);
      where.push(`w.project_id IN (${ids.map(() => '?').join(',') || 'NULL'})`);
      params.push(...ids);
    }
    const q = req.query;
    if (q.q) {
      where.push('(w.name LIKE ? OR w.iqama_no LIKE ? OR w.profession LIKE ?)');
      params.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
    }
    for (const k of ['project_id', 'subcontractor_id']) {
      if (q[k]) {
        where.push(`w.${k} = ?`);
        params.push(Number(q[k]));
      }
    }
    for (const k of ['affiliation', 'nationality', 'profession']) {
      if (q[k]) {
        where.push(`w.${k} = ?`);
        params.push(String(q[k]));
      }
    }
    if (q.unassigned === '1') where.push('w.project_id IS NULL');
    if (q.iqama_expiring === '1') {
      where.push('w.iqama_expiry IS NOT NULL AND w.iqama_expiry <= ?');
      params.push(addDays(today(), 30));
    }
    where.push(q.inactive === '1' ? 'w.active = 0' : 'w.active = 1');
    const rows = db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY w.name`).all(...params);
    res.json(rows.map((w) => shape(req.user, w)));
  }));

  api.post('/workers', need('workers.manage'), photoUpload.single('photo'), h((req, res) => {
    const v = validate(db, req.body);
    const projectId = num(req.body.project_id);
    if (projectId) assertProject(db, req.user, projectId);
    else if (req.user.role === 'pm') throw new HttpError(400, 'اختر أحد مشاريعك');
    const id = tx(db, () => {
      const r = db.prepare(`INSERT INTO workers(name, photo, iqama_no, iqama_expiry, nationality, profession, wage_type,
        wage, affiliation, subcontractor_id, project_id, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(v.name, req.file ? req.file.filename : null, v.iqama_no, v.iqama_expiry, v.nationality, v.profession,
          v.wage_type, v.wage, v.affiliation, v.subcontractor_id, projectId, token(16));
      if (projectId) {
        db.prepare('INSERT INTO worker_assignments(worker_id, project_id, from_date, moved_by) VALUES (?, ?, ?, ?)')
          .run(r.lastInsertRowid, projectId, today(), req.user.id);
      }
      return r.lastInsertRowid;
    });
    res.status(201).json(shape(req.user, db.prepare(`${SELECT} WHERE w.id = ?`).get(id)));
  }));

  api.get('/workers/:id', h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    const out = shape(req.user, w);
    out.assignments = db.prepare(`SELECT a.*, p.name project_name, u.name moved_by_name FROM worker_assignments a
      JOIN projects p ON p.id = a.project_id LEFT JOIN users u ON u.id = a.moved_by
      WHERE a.worker_id = ? ORDER BY a.from_date DESC, a.id DESC`).all(w.id);
    const to = today();
    const from = to.slice(0, 8) + '01';
    out.month_summary = attendanceSummary(db, w.id, from, to);
    res.json(out);
  }));

  api.put('/workers/:id', need('workers.manage'), h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    const v = validate(db, req.body, w);
    const active = req.body.active === undefined ? w.active : req.body.active ? 1 : 0;
    db.prepare(`UPDATE workers SET name=?, iqama_no=?, iqama_expiry=?, nationality=?, profession=?, wage_type=?, wage=?,
      affiliation=?, subcontractor_id=?, active=? WHERE id=?`).run(v.name, v.iqama_no, v.iqama_expiry, v.nationality,
      v.profession, v.wage_type, v.wage, v.affiliation, v.subcontractor_id, active, w.id);
    res.json(shape(req.user, db.prepare(`${SELECT} WHERE w.id = ?`).get(w.id)));
  }));

  api.post('/workers/:id/photo', need('workers.manage'), photoUpload.single('photo'), h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    if (!req.file) throw new HttpError(400, 'أرفق صورة');
    db.prepare('UPDATE workers SET photo = ? WHERE id = ?').run(req.file.filename, w.id);
    if (w.photo) fs.rm(path.join(photoDir, path.basename(w.photo)), () => {});
    res.json({ ok: true });
  }));

  api.get('/workers/:id/photo', h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    if (!w.photo) throw new HttpError(404, 'لا توجد صورة');
    res.sendFile(path.join(photoDir, path.basename(w.photo)));
  }));

  // نقل العامل لمشروع آخر مع حفظ السجل تلقائياً
  api.post('/workers/:id/transfer', need('workers.transfer'), h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    const target = assertProject(db, req.user, req.body.project_id);
    if (target.id === w.project_id) throw new HttpError(400, 'العامل في هذا المشروع بالفعل');
    if (target.status !== 'active') throw new HttpError(400, 'المشروع المستهدف غير نشط');
    const date = req.body.date || today();
    if (!isDate(date)) throw new HttpError(400, 'تاريخ غير صالح');
    tx(db, () => {
      const cur = db.prepare('SELECT * FROM worker_assignments WHERE worker_id = ? AND to_date IS NULL ORDER BY id DESC LIMIT 1').get(w.id);
      if (cur) {
        if (date < cur.from_date) throw new HttpError(400, 'تاريخ النقل قبل بداية التعيين الحالي');
        const end = date > cur.from_date ? addDays(date, -1) : date;
        db.prepare('UPDATE worker_assignments SET to_date = ? WHERE id = ?').run(end, cur.id);
      }
      db.prepare('INSERT INTO worker_assignments(worker_id, project_id, from_date, moved_by) VALUES (?, ?, ?, ?)')
        .run(w.id, target.id, date, req.user.id);
      db.prepare('UPDATE workers SET project_id = ? WHERE id = ?').run(target.id, w.id);
    });
    res.json(shape(req.user, db.prepare(`${SELECT} WHERE w.id = ?`).get(w.id)));
  }));

  api.get('/workers/:id/qr', h(async (req, res) => {
    if (!can(req.user, 'workers.manage')) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');
    const w = loadWorker(db, req.user, req.params.id);
    const svg = await QRCode.toString(`MW:${w.qr_token}`, { type: 'svg', margin: 1, width: 240 });
    res.type('image/svg+xml').send(svg);
  }));

  // تقرير حضور العامل لأي فترة
  api.get('/workers/:id/attendance', h((req, res) => {
    const w = loadWorker(db, req.user, req.params.id);
    const to = isDate(req.query.to) ? req.query.to : today();
    const from = isDate(req.query.from) ? req.query.from : addDays(to, -29);
    const rows = db.prepare(`SELECT a.*, p.name project_name FROM attendance a JOIN projects p ON p.id = a.project_id
      WHERE a.worker_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date DESC`).all(w.id, from, to);
    const summary = attendanceSummary(db, w.id, from, to);
    const out = { from, to, summary, rows };
    if (can(req.user, 'payroll.view')) out.pay = payrollLine(w, summary);
    res.json(out);
  }));
};

module.exports.loadWorker = loadWorker;
