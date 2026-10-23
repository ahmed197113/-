'use strict';
const { require: need, assertProject, can } = require('../permissions');
const { h, HttpError, today, addDays, num, isDate, distanceM, clock, localDateTime } = require('../util');
const { tx, getSetting } = require('../db');
const { WORK_HOURS } = require('../services');

const STATUSES = ['present', 'absent', 'late', 'leave'];

// يتحقق أن الموقع داخل نطاق المشروع (Geofence)
function checkGeofence(project, lat, lng) {
  if (lat === null || lng === null) throw new HttpError(400, 'يجب تفعيل الموقع (GPS) للتحضير');
  const d = distanceM(lat, lng, project.lat, project.lng);
  if (d > project.radius_m) {
    throw new HttpError(403, `أنت خارج نطاق المشروع (${Math.round(d)} م من الموقع، المسموح ${project.radius_m} م)`);
  }
  return Math.round(d);
}

// وقت العملية: الآن، أو وقت التسجيل الأصلي عند المزامنة بعد انقطاع الإنترنت (حتى 3 أيام)
function eventTime(at) {
  const now = clock.now();
  if (!at) return now;
  const d = new Date(at);
  if (Number.isNaN(d.getTime()) || d > new Date(now.getTime() + 5 * 60000) || now - d > 3 * 86400000) {
    throw new HttpError(400, 'وقت التسجيل غير صالح');
  }
  return d;
}

module.exports = (api, { db }) => {
  // قائمة عمال المشروع مع حالة الحضور ليوم معين
  api.get('/attendance', h((req, res) => {
    const p = assertProject(db, req.user, req.query.project_id);
    const date = isDate(req.query.date) ? req.query.date : today();
    const rows = db.prepare(`SELECT w.id worker_id, w.name, w.profession, w.photo IS NOT NULL has_photo,
        a.id, a.status, a.check_in, a.check_out, a.overtime_hours, a.method
      FROM workers w LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ?
      WHERE (w.project_id = ? AND w.active = 1) OR a.project_id = ?
      ORDER BY w.name`).all(date, p.id, p.id);
    res.json({ project: { id: p.id, name: p.name, lat: p.lat, lng: p.lng, radius_m: p.radius_m }, date, rows });
  }));

  // تحضير جماعي من المشرف بقائمة اختيار
  api.post('/attendance/bulk', need('attendance.record'), h((req, res) => {
    const p = assertProject(db, req.user, req.body.project_id);
    const date = req.body.date || today();
    if (!isDate(date) || date > today()) throw new HttpError(400, 'تاريخ غير صالح');
    const lat = num(req.body.lat);
    const lng = num(req.body.lng);
    const onSite = req.user.role === 'supervisor';
    if (onSite) {
      // المشرف يحضّر من الموقع فقط ولليوم (أو آخر يومين عند المزامنة)
      if (date < addDays(today(), -2)) throw new HttpError(403, 'لا يمكن للمشرف تعديل حضور أيام سابقة');
      checkGeofence(p, lat, lng);
    } else if (lat !== null && lng !== null) {
      checkGeofence(p, lat, lng);
    }
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!entries.length) throw new HttpError(400, 'لا توجد بيانات تحضير');
    const workerOk = db.prepare('SELECT 1 FROM workers WHERE id = ? AND project_id = ? AND active = 1');
    const up = db.prepare(`INSERT INTO attendance(worker_id, project_id, date, status, overtime_hours, method, recorded_by, in_lat, in_lng, check_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(worker_id, date) DO UPDATE SET status = excluded.status, overtime_hours = excluded.overtime_hours,
        project_id = excluded.project_id, method = excluded.method, recorded_by = excluded.recorded_by,
        check_in = COALESCE(attendance.check_in, excluded.check_in)`);
    const method = onSite || lat !== null ? 'bulk' : 'manual';
    const time = localDateTime(clock.now()).time;
    const saved = tx(db, () => {
      let n = 0;
      for (const e of entries) {
        const status = String(e.status);
        if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة حضور غير صالحة');
        const ot = num(e.overtime_hours, 0);
        if (ot < 0 || ot > 12) throw new HttpError(400, 'ساعات الإضافي بين 0 و12');
        if (!workerOk.get(Number(e.worker_id), p.id)) throw new HttpError(400, `العامل ${e.worker_id} ليس ضمن هذا المشروع`);
        const worked = status === 'present' || status === 'late';
        up.run(Number(e.worker_id), p.id, date, status, worked ? ot : 0, method, req.user.id, lat, lng,
          worked && date === today() ? time : null);
        n++;
      }
      return n;
    });
    res.json({ saved, date });
  }));

  // تحضير فردي بمسح رمز QR الخاص بالعامل (دخول/خروج)
  api.post('/attendance/scan', need('attendance.record'), h((req, res) => {
    const p = assertProject(db, req.user, req.body.project_id);
    const raw = String(req.body.qr || '').trim();
    const qr = raw.startsWith('MW:') ? raw.slice(3) : raw;
    const w = db.prepare('SELECT * FROM workers WHERE qr_token = ? AND active = 1').get(qr);
    if (!w) throw new HttpError(404, 'رمز QR غير معروف');
    if (w.project_id !== p.id) throw new HttpError(400, `${w.name} غير مسجل على هذا المشروع`);
    const lat = num(req.body.lat);
    const lng = num(req.body.lng);
    const distance = checkGeofence(p, lat, lng);
    const at = eventTime(req.body.at);
    const { date, time } = localDateTime(at);
    const type = req.body.type === 'out' ? 'out' : 'in';
    const row = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(w.id, date);

    if (type === 'in') {
      if (row && row.check_in && ['present', 'late'].includes(row.status)) {
        return res.json({ worker: { id: w.id, name: w.name }, status: row.status, check_in: row.check_in, already: true, distance });
      }
      const status = time > getSetting(db, 'late_after') ? 'late' : 'present';
      db.prepare(`INSERT INTO attendance(worker_id, project_id, date, status, check_in, in_lat, in_lng, method, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'qr', ?)
        ON CONFLICT(worker_id, date) DO UPDATE SET status = excluded.status, check_in = excluded.check_in,
          in_lat = excluded.in_lat, in_lng = excluded.in_lng, method = 'qr', recorded_by = excluded.recorded_by,
          project_id = excluded.project_id`).run(w.id, p.id, date, status, time, lat, lng, req.user.id);
      return res.json({ worker: { id: w.id, name: w.name }, status, check_in: time, distance });
    }

    if (!row || !row.check_in) throw new HttpError(400, `لم يُسجَّل دخول ${w.name} اليوم`);
    const [ih, im] = row.check_in.split(':').map(Number);
    const [oh, om] = time.split(':').map(Number);
    const hours = (oh * 60 + om - (ih * 60 + im)) / 60;
    const overtime = Math.max(0, Math.floor((hours - WORK_HOURS) * 2) / 2);
    db.prepare('UPDATE attendance SET check_out = ?, out_lat = ?, out_lng = ?, overtime_hours = ? WHERE id = ?')
      .run(time, lat, lng, overtime, row.id);
    res.json({ worker: { id: w.id, name: w.name }, status: row.status, check_in: row.check_in, check_out: time, overtime_hours: overtime, distance });
  }));

  // تعديل سجل حضور (للمدير ومدير المشروع)
  api.put('/attendance/:id', need('attendance.record'), h((req, res) => {
    if (!['gm', 'pm'].includes(req.user.role)) throw new HttpError(403, 'التعديل لمدير المشروع أو المدير العام');
    const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'السجل غير موجود');
    assertProject(db, req.user, row.project_id);
    const status = req.body.status ?? row.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة حضور غير صالحة');
    const ot = num(req.body.overtime_hours, row.overtime_hours);
    if (ot < 0 || ot > 12) throw new HttpError(400, 'ساعات الإضافي بين 0 و12');
    db.prepare("UPDATE attendance SET status = ?, overtime_hours = ?, method = 'manual', recorded_by = ? WHERE id = ?")
      .run(status, ['present', 'late'].includes(status) ? ot : 0, req.user.id, row.id);
    res.json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(row.id));
  }));

  // إحصائية الحضور اليومية للمشروع خلال فترة
  api.get('/attendance/daily', h((req, res) => {
    const p = assertProject(db, req.user, req.query.project_id);
    const to = isDate(req.query.to) ? req.query.to : today();
    const from = isDate(req.query.from) ? req.query.from : addDays(to, -29);
    const rows = db.prepare(`SELECT date, SUM(status IN ('present','late')) present, SUM(status = 'absent') absent,
      SUM(status = 'late') late, SUM(status = 'leave') leave, SUM(overtime_hours) overtime_hours
      FROM attendance WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(p.id, from, to);
    res.json({ from, to, rows, can_cost: can(req.user, 'costs.view') });
  }));
};

module.exports.checkGeofence = checkGeofence;
