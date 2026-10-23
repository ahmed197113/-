'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let t;
before(async () => { t = await start(); });
after(async () => t.stop());

test('تسجيل الدخول: كلمة مرور خاطئة ترفض، والصحيحة تعيد الصلاحيات', async () => {
  const bad = await t.call(null, 'POST', '/auth/login', { username: 'gm', password: 'x' });
  assert.equal(bad.status, 401);
  const me = await t.get('gm', '/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'gm');
  assert.ok(me.body.permissions.includes('projects.create'));
  assert.ok(!me.body.permissions.includes('invoices.pay'), 'المدير العام لا يصرف');
});

test('بدون جلسة: 401', async () => {
  const r = await t.get(null, '/projects');
  assert.equal(r.status, 401);
});

test('المدير العام والمحاسب يرون كل المشاريع', async () => {
  assert.equal((await t.get('gm', '/projects')).body.length, 5);
  assert.equal((await t.get('finance', '/projects')).body.length, 5);
  assert.equal((await t.get('owner', '/projects')).body.length, 5);
});

test('مدير المشروع يرى مشاريعه فقط', async () => {
  const pm1 = await t.get('pm1', '/projects');
  const pm2 = await t.get('pm2', '/projects');
  assert.equal(pm1.body.length, 3);
  assert.equal(pm2.body.length, 2);
  const other = pm2.body[0].id;
  assert.equal((await t.get('pm1', `/projects/${other}`)).status, 403);
});

test('المشرف يرى مشروعه فقط ولا يرى الأجور ولا التكاليف', async () => {
  const r = await t.get('sup1', '/projects');
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].cost_today, undefined);
  assert.equal(r.body[0].contract_value, undefined);
  const w = await t.get('sup1', '/workers');
  assert.ok(w.body.length > 0);
  assert.ok(w.body.every((x) => x.wage === undefined && x.qr_token === undefined));
  const all = await t.get('gm', '/workers');
  const foreign = all.body.find((x) => x.project_id !== r.body[0].id);
  assert.equal((await t.get('sup1', `/workers/${foreign.id}`)).status, 403);
});

test('المشرف لا ينشئ مشروعاً ولا يرى المستخلصات ولا الرواتب', async () => {
  const p = await t.post('sup1', '/projects', { name: 'x', lat: 24, lng: 46 });
  assert.equal(p.status, 403);
  assert.equal((await t.get('sup1', '/invoices')).status, 403);
  assert.equal((await t.get('sup1', '/exports/payroll')).status, 403);
  assert.equal((await t.get('pm1', '/exports/payroll')).status, 403);
});

test('المدير العام ينشئ مشروعاً ويتحقق من الأدوار', async () => {
  const bad = await t.post('gm', '/projects', { name: 'مشروع', lat: 24.7, lng: 46.7, manager_id: 6 });
  assert.equal(bad.status, 400);
  const ok = await t.post('gm', '/projects', { name: 'مشروع جديد', lat: 24.7, lng: 46.7, radius_m: 250, planned_workers: 5, manager_id: 4 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.manager_name, 'م. فهد القحطاني');
});

test('مدير المشروع لا يغير مدير المشروع أو قيمة العقد', async () => {
  const [p] = (await t.get('pm1', '/projects')).body;
  const r = await t.put('pm1', `/projects/${p.id}`, { manager_id: 5, contract_value: 1, progress: 50 });
  assert.equal(r.status, 200);
  assert.equal(r.body.manager_id, 4);
  assert.notEqual(r.body.contract_value, 1);
  assert.equal(r.body.progress, 50);
});

test('إدارة المستخدمين للمدير العام فقط، ولا يضيف مالكاً', async () => {
  assert.equal((await t.post('pm1', '/users', { name: 'a', username: 'a', password: '123456', role: 'supervisor' })).status, 403);
  assert.equal((await t.post('gm', '/users', { name: 'a', username: 'own2', password: '123456', role: 'owner' })).status, 403);
  const r = await t.post('gm', '/users', { name: 'مشرف جديد', username: 'sup9', password: '123456', role: 'supervisor' });
  assert.equal(r.status, 201);
});
