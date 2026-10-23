'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { require: need, assertProject, projectScope, canAccessProject } = require('../permissions');
const { h, HttpError, today, addDays, num, isDate } = require('../util');
const { tx } = require('../db');
const { notify, managementIds } = require('../services');
const { uploader, kindOf } = require('../uploads');
const { page, esc } = require('../print');

const WEATHER = ['مشمس', 'غائم', 'ممطر', 'رياح/غبار', 'حار جداً'];

// يحفظ المرفقات مع ختم التاريخ والوقت والموقع
function saveMedia(db, ownerType, ownerId, files, metaRaw) {
  let meta = [];
  try {
    meta = JSON.parse(metaRaw || '[]');
  } catch {
    meta = [];
  }
  const ins = db.prepare('INSERT INTO media(owner_type, owner_id, kind, path, taken_at, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)');
  (files || []).forEach((f, i) => {
    const m = meta[i] || {};
    ins.run(ownerType, ownerId, kindOf(f.mimetype), f.filename, m.taken_at || new Date().toISOString(), num(m.lat), num(m.lng));
  });
}

function mediaOf(db, ownerType, id) {
  return db.prepare('SELECT id, kind, taken_at, lat, lng FROM media WHERE owner_type = ? AND owner_id = ? ORDER BY id').all(ownerType, id);
}

function cleanup(files) {
  for (const f of files || []) fs.rm(f.path, () => {});
}

module.exports = (api, { db, uploadsDir }) => {
  const upload = uploader(uploadsDir).array('media', 20);

  api.get('/reports', h((req, res) => {
    const s = projectScope(req.user);
    const where = [s.sql];
    const params = [...s.params];
    if (req.query.project_id) {
      where.push('r.project_id = ?');
      params.push(Number(req.query.project_id));
    }
    if (isDate(req.query.from)) {
      where.push('r.date >= ?');
      params.push(req.query.from);
    }
    if (isDate(req.query.to)) {
      where.push('r.date <= ?');
      params.push(req.query.to);
    }
    if (req.query.q) {
      where.push('r.description LIKE ?');
      params.push(`%${req.query.q}%`);
    }
    const rows = db.prepare(`SELECT r.*, p.name project_name, u.name author_name,
      (SELECT COUNT(*) FROM media m WHERE m.owner_type = 'report' AND m.owner_id = r.id) media_count
      FROM daily_reports r JOIN projects p ON p.id = r.project_id LEFT JOIN users u ON u.id = r.author_id
      WHERE ${where.join(' AND ')} ORDER BY r.date DESC, r.id DESC LIMIT 200`).all(...params);
    res.json(rows);
  }));

  api.post('/reports', need('reports.create'), upload, h((req, res) => {
    try {
      const b = req.body;
      const p = assertProject(db, req.user, b.project_id);
      if (b.client_id) {
        const ex = db.prepare('SELECT id FROM daily_reports WHERE client_id = ?').get(String(b.client_id));
        if (ex) {
          cleanup(req.files);
          return res.json({ id: ex.id, duplicate: true });
        }
      }
      const date = b.date || today();
      if (!isDate(date) || date > today() || date < addDays(today(), -3)) throw new HttpError(400, 'تاريخ التقرير غير صالح');
      if (!b.description || !String(b.description).trim()) throw new HttpError(400, 'اكتب وصف الأعمال المنجزة');
      const progress = num(b.progress);
      if (progress !== null && (progress < 0 || progress > 100)) throw new HttpError(400, 'نسبة الإنجاز بين 0 و100');
      const id = tx(db, () => {
        const r = db.prepare(`INSERT INTO daily_reports(project_id, date, author_id, description, progress, weather, equipment,
          materials, lat, lng, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, date, req.user.id,
          String(b.description).trim(), progress, b.weather || null, b.equipment || null, b.materials || null,
          num(b.lat), num(b.lng), b.client_id || null);
        if (progress !== null) db.prepare('UPDATE projects SET progress = ? WHERE id = ?').run(progress, p.id);
        saveMedia(db, 'report', r.lastInsertRowid, req.files, b.media_meta);
        return r.lastInsertRowid;
      });
      // إرسال التقرير للإدارة
      notify(db, managementIds(db, p.id), {
        title: `تقرير يومي — ${p.name}`,
        body: `${date}: ${String(b.description).slice(0, 80)}`,
        link: `#/reports/${id}`,
      });
      res.status(201).json({ id });
    } catch (e) {
      cleanup(req.files);
      throw e;
    }
  }));

  function loadReport(req) {
    const r = db.prepare(`SELECT r.*, p.name project_name, u.name author_name FROM daily_reports r
      JOIN projects p ON p.id = r.project_id LEFT JOIN users u ON u.id = r.author_id WHERE r.id = ?`).get(Number(req.params.id));
    if (!r) throw new HttpError(404, 'التقرير غير موجود');
    if (!canAccessProject(db, req.user, r.project_id)) throw new HttpError(403, 'لا تملك صلاحية على هذا التقرير');
    r.media = mediaOf(db, 'report', r.id);
    return r;
  }

  api.get('/reports/:id', h((req, res) => res.json(loadReport(req))));

  // تقرير PDF يومي لكل مشروع (صفحة طباعة)
  api.get('/projects/:id/daily-print', h((req, res) => {
    const p = assertProject(db, req.user, req.params.id);
    const date = isDate(req.query.date) ? req.query.date : today();
    const t = encodeURIComponent(req.token);
    const att = db.prepare(`SELECT status, COUNT(*) c, SUM(overtime_hours) ot FROM attendance
      WHERE project_id = ? AND date = ? GROUP BY status`).all(p.id, date);
    const a = Object.fromEntries(att.map((r) => [r.status, r.c]));
    const ot = att.reduce((s, r) => s + (r.ot || 0), 0);
    const reports = db.prepare(`SELECT r.*, u.name author_name FROM daily_reports r LEFT JOIN users u ON u.id = r.author_id
      WHERE r.project_id = ? AND r.date = ? ORDER BY r.id`).all(p.id, date);
    const issues = db.prepare(`SELECT * FROM issues WHERE project_id = ? AND (status != 'closed' OR date(created_at) = ?)
      ORDER BY created_at DESC`).all(p.id, date);
    const absent = db.prepare(`SELECT w.name FROM attendance a JOIN workers w ON w.id = a.worker_id
      WHERE a.project_id = ? AND a.date = ? AND a.status = 'absent' ORDER BY w.name`).all(p.id, date);
    let body = `<div class="kv"><b>المشروع</b><span>${esc(p.name)}</span><b>الموقع</b><span>${esc(p.location_name)}</span>
      <b>التاريخ</b><span>${esc(date)}</span><b>نسبة الإنجاز</b><span>${esc(p.progress)}%</span></div>
      <h2>الحضور</h2><table><tr><th>المخطط</th><th>حاضر</th><th>متأخر</th><th>غائب</th><th>إجازة</th><th>ساعات إضافية</th></tr>
      <tr><td>${p.planned_workers}</td><td>${a.present || 0}</td><td>${a.late || 0}</td><td>${a.absent || 0}</td><td>${a.leave || 0}</td><td>${ot}</td></tr></table>
      ${absent.length ? `<p class="muted">الغائبون: ${absent.map((x) => esc(x.name)).join('، ')}</p>` : ''}
      <h2>التقارير اليومية</h2>`;
    if (!reports.length) body += '<p class="muted">لا توجد تقارير لهذا اليوم.</p>';
    for (const r of reports) {
      const media = mediaOf(db, 'report', r.id).filter((m) => m.kind === 'image');
      body += `<div class="kv"><b>المشرف</b><span>${esc(r.author_name)}</span><b>الطقس</b><span>${esc(r.weather)}</span>
        <b>الإنجاز</b><span>${r.progress ?? '-'}%</span><b>المعدات</b><span>${esc(r.equipment)}</span>
        <b>المواد</b><span>${esc(r.materials)}</span></div><p>${esc(r.description).replace(/\n/g, '<br>')}</p>
        <div class="grid">${media.map((m) => `<figure style="margin:0"><img src="/api/media/${m.id}?token=${t}">
        <figcaption class="muted">${esc(new Date(m.taken_at).toLocaleString('ar-SA'))}${m.lat ? ` — ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : ''}</figcaption></figure>`).join('')}</div><hr>`;
    }
    body += `<h2>المشاكل والبلاغات</h2><table><tr><th>البلاغ</th><th>التصنيف</th><th>الأهمية</th><th>الحالة</th><th>المهلة</th></tr>
      ${issues.map((i) => `<tr><td>${esc(i.title)}</td><td>${esc(i.category)}</td><td>${esc(i.severity)}</td><td>${esc(i.status)}</td><td>${esc(i.due_at ? i.due_at.slice(0, 16).replace('T', ' ') : '')}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد</td></tr>'}</table>
      <div class="sig"><div>مشرف الموقع</div><div>مدير المشروع</div><div>المدير العام</div></div>`;
    res.type('html').send(page(db, `التقرير اليومي — ${p.name} — ${date}`, body));
  }));

  // عرض المرفقات بعد التحقق من صلاحية المشروع
  api.get('/media/:id', h((req, res) => {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
    if (!m) throw new HttpError(404, 'غير موجود');
    const table = m.owner_type === 'report' ? 'daily_reports' : 'issues';
    const o = db.prepare(`SELECT project_id FROM ${table} WHERE id = ?`).get(m.owner_id);
    if (!o || !canAccessProject(db, req.user, o.project_id)) throw new HttpError(403, 'لا تملك صلاحية');
    res.sendFile(path.join(uploadsDir, path.basename(m.path)));
  }));
};

module.exports.saveMedia = saveMedia;
module.exports.mediaOf = mediaOf;
module.exports.cleanup = cleanup;
module.exports.WEATHER = WEATHER;
