'use strict';
const { hashPassword, publicUser } = require('../auth');
const { ROLES, require: need } = require('../permissions');
const { h, HttpError } = require('../util');
const { getSetting } = require('../db');

const SETTING_KEYS = ['absence_cutoff', 'late_after', 'company_name'];

module.exports = (api, { db }) => {
  // قائمة مختصرة لكل المستخدمين (لاختيار المسؤول عن بلاغ أو المشرف)
  api.get('/users', h((req, res) => {
    const full = ['gm', 'owner'].includes(req.user.role);
    const rows = db.prepare('SELECT * FROM users ORDER BY role, name').all();
    res.json(rows.filter((u) => full || u.active).map((u) => (full ? publicUser(u) : { id: u.id, name: u.name, role: u.role })));
  }));

  api.post('/users', need('users.manage'), h((req, res) => {
    const { name, username, password, role, phone } = req.body;
    if (!name || !username || !password) throw new HttpError(400, 'الاسم واسم المستخدم وكلمة المرور مطلوبة');
    if (!ROLES[role]) throw new HttpError(400, 'دور غير صالح');
    if (String(password).length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
    if (role === 'owner' && req.user.role !== 'owner') throw new HttpError(403, 'إضافة مالك متاحة للمالك فقط');
    const r = db.prepare('INSERT INTO users(name, username, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(String(name).trim(), String(username).trim().toLowerCase(), hashPassword(password), role, phone || null);
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)));
  }));

  api.put('/users/:id', need('users.manage'), h((req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!u) throw new HttpError(404, 'المستخدم غير موجود');
    if (u.role === 'owner' && req.user.role !== 'owner') throw new HttpError(403, 'لا يمكن تعديل حساب المالك');
    const role = req.body.role ?? u.role;
    if (!ROLES[role]) throw new HttpError(400, 'دور غير صالح');
    if (role === 'owner' && req.user.role !== 'owner') throw new HttpError(403, 'تعيين مالك متاح للمالك فقط');
    if (u.id === req.user.id && (role !== u.role || req.body.active === false)) {
      throw new HttpError(400, 'لا يمكنك تغيير دورك أو تعطيل حسابك');
    }
    db.prepare('UPDATE users SET name = ?, role = ?, phone = ?, active = ? WHERE id = ?').run(
      req.body.name ?? u.name, role, req.body.phone ?? u.phone,
      req.body.active === undefined ? u.active : req.body.active ? 1 : 0, u.id);
    if (req.body.password) {
      if (String(req.body.password).length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.password), u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    }
    if (req.body.active === false) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
  }));

  api.get('/settings', h((req, res) => {
    const o = {};
    for (const k of SETTING_KEYS) o[k] = getSetting(db, k);
    res.json(o);
  }));

  api.put('/settings', need('settings.manage'), h((req, res) => {
    const up = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const k of SETTING_KEYS) {
      if (req.body[k] === undefined) continue;
      const v = String(req.body[k]);
      if (k !== 'company_name' && !/^\d{2}:\d{2}$/.test(v)) throw new HttpError(400, 'صيغة الوقت HH:MM');
      up.run(k, v);
    }
    const o = {};
    for (const k of SETTING_KEYS) o[k] = getSetting(db, k);
    res.json(o);
  }));

  api.get('/subcontractors', h((req, res) => {
    res.json(db.prepare('SELECT * FROM subcontractors ORDER BY name').all());
  }));

  api.post('/subcontractors', need('workers.manage'), h((req, res) => {
    if (!req.body.name) throw new HttpError(400, 'اسم المقاول مطلوب');
    const r = db.prepare('INSERT INTO subcontractors(name, phone) VALUES (?, ?)').run(String(req.body.name).trim(), req.body.phone || null);
    res.status(201).json(db.prepare('SELECT * FROM subcontractors WHERE id = ?').get(r.lastInsertRowid));
  }));
};
