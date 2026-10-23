'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, setClock } = require('./helpers');
const { autoAbsence } = require('../server/services');

let t;
let p; // مشروع المشرف sup1
before(async () => {
  t = await start({ at: '2026-10-21T04:00:00Z' }); // 07:00 بتوقيت الرياض
  p = (await t.get('sup1', '/projects')).body[0];
});
after(async () => t.stop());

const inside = () => ({ lat: p.lat + 0.0005, lng: p.lng }); // ~55 م
const outside = () => ({ lat: p.lat + 0.01, lng: p.lng }); // ~1.1 كم

test('التحضير الجماعي يُرفض خارج نطاق المشروع', async () => {
  const list = (await t.get('sup1', `/attendance?project_id=${p.id}`)).body.rows;
  const r = await t.post('sup1', '/attendance/bulk', { project_id: p.id, ...outside(), entries: [{ worker_id: list[0].worker_id, status: 'present' }] });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /خارج نطاق/);
});

test('التحضير الجماعي يتطلب GPS للمشرف', async () => {
  const list = (await t.get('sup1', `/attendance?project_id=${p.id}`)).body.rows;
  const r = await t.post('sup1', '/attendance/bulk', { project_id: p.id, entries: [{ worker_id: list[0].worker_id, status: 'present' }] });
  assert.equal(r.status, 400);
});

test('التحضير الجماعي داخل النطاق مع إضافي', async () => {
  const list = (await t.get('sup1', `/attendance?project_id=${p.id}`)).body.rows;
  const entries = list.slice(0, 3).map((w, i) => ({ worker_id: w.worker_id, status: ['present', 'absent', 'leave'][i], overtime_hours: 2 }));
  const r = await t.post('sup1', '/attendance/bulk', { project_id: p.id, ...inside(), entries });
  assert.equal(r.status, 200);
  assert.equal(r.body.saved, 3);
  const after_ = (await t.get('sup1', `/attendance?project_id=${p.id}`)).body.rows;
  const byId = Object.fromEntries(after_.map((x) => [x.worker_id, x]));
  assert.equal(byId[entries[0].worker_id].status, 'present');
  assert.equal(byId[entries[0].worker_id].overtime_hours, 2);
  assert.equal(byId[entries[1].worker_id].overtime_hours, 0, 'لا إضافي للغائب');
});

test('لا يحضّر المشرف عاملاً من مشروع آخر ولا مشروعاً ليس له', async () => {
  const other = (await t.get('gm', '/workers')).body.find((w) => w.project_id !== p.id);
  const r = await t.post('sup1', '/attendance/bulk', { project_id: p.id, ...inside(), entries: [{ worker_id: other.id, status: 'present' }] });
  assert.equal(r.status, 400);
  const r2 = await t.post('sup1', '/attendance/bulk', { project_id: other.project_id, ...inside(), entries: [{ worker_id: other.id, status: 'present' }] });
  assert.equal(r2.status, 403);
  // المحاسب لا يحضّر
  assert.equal((await t.post('finance', '/attendance/bulk', { project_id: p.id, entries: [] })).status, 403);
});

test('مسح QR: دخول ثم خروج مع حساب الإضافي', async () => {
  const w = (await t.get('gm', `/workers?project_id=${p.id}`)).body.at(-1);
  t.db.prepare('DELETE FROM attendance WHERE worker_id = ? AND date = ?').run(w.id, '2026-10-21');
  const bad = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: `MW:${w.qr_token}`, ...outside() });
  assert.equal(bad.status, 403);
  const inn = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: `MW:${w.qr_token}`, type: 'in', ...inside() });
  assert.equal(inn.status, 200);
  assert.equal(inn.body.status, 'present');
  assert.equal(inn.body.check_in, '07:00');
  const again = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: `MW:${w.qr_token}`, type: 'in', ...inside() });
  assert.equal(again.body.already, true);
  setClock('2026-10-21T14:40:00Z'); // 17:40 => 10.67 ساعة => 2.5 إضافي
  const out = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: `MW:${w.qr_token}`, type: 'out', ...inside() });
  assert.equal(out.status, 200);
  assert.equal(out.body.check_out, '17:40');
  assert.equal(out.body.overtime_hours, 2.5);
  setClock('2026-10-21T04:00:00Z');
});

test('مسح QR بعد ساعة التأخير يسجل متأخراً، والمزامنة بوقت المسح الأصلي', async () => {
  const w = (await t.get('gm', `/workers?project_id=${p.id}`)).body.at(-2);
  t.db.prepare('DELETE FROM attendance WHERE worker_id = ? AND date = ?').run(w.id, '2026-10-21');
  setClock('2026-10-21T06:00:00Z'); // 09:00
  const late = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: w.qr_token, ...inside(), at: '2026-10-21T04:50:00Z' });
  assert.equal(late.body.status, 'late', '07:50 بعد 07:30');
  assert.equal(late.body.check_in, '07:50');
  const future = await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: w.qr_token, ...inside(), at: '2026-10-25T04:50:00Z' });
  assert.equal(future.status, 400);
  setClock('2026-10-21T04:00:00Z');
});

test('رمز QR غير معروف أو لعامل في مشروع آخر', async () => {
  assert.equal((await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: 'MW:nope', ...inside() })).status, 404);
  const other = (await t.get('gm', '/workers')).body.find((w) => w.project_id !== p.id);
  assert.equal((await t.post('sup1', '/attendance/scan', { project_id: p.id, qr: other.qr_token, ...inside() })).status, 400);
});

test('الغياب التلقائي بعد الساعة المحددة فقط، ولا يكرر ولا يعمل يوم الجمعة', async () => {
  const before_ = t.db.prepare("SELECT COUNT(*) c FROM attendance WHERE date = '2026-10-21'").get().c;
  assert.equal(autoAbsence(t.db, '2026-10-21', '09:59'), 0);
  const n = autoAbsence(t.db, '2026-10-21', '10:00');
  const total = t.db.prepare("SELECT COUNT(*) c FROM workers w JOIN projects p ON p.id = w.project_id WHERE w.active = 1 AND p.status = 'active'").get().c;
  assert.equal(n, total - before_);
  assert.equal(autoAbsence(t.db, '2026-10-21', '11:00'), 0);
  assert.equal(autoAbsence(t.db, '2026-10-23', '11:00'), 0, 'الجمعة');
  const auto = t.db.prepare("SELECT COUNT(*) c FROM attendance WHERE date = '2026-10-21' AND method = 'auto' AND status = 'absent'").get().c;
  assert.equal(auto, n);
});

test('المشرف لا يعدّل أياماً قديمة، والمدير العام يصحح يدوياً بدون GPS', async () => {
  const list = (await t.get('sup1', `/attendance?project_id=${p.id}`)).body.rows;
  const old = await t.post('sup1', '/attendance/bulk', { project_id: p.id, date: '2026-10-10', ...inside(), entries: [{ worker_id: list[0].worker_id, status: 'present' }] });
  assert.equal(old.status, 403);
  const gm = await t.post('gm', '/attendance/bulk', { project_id: p.id, date: '2026-10-10', entries: [{ worker_id: list[0].worker_id, status: 'leave' }] });
  assert.equal(gm.status, 200);
  const row = t.db.prepare("SELECT * FROM attendance WHERE worker_id = ? AND date = '2026-10-10'").get(list[0].worker_id);
  assert.equal(row.status, 'leave');
  assert.equal(row.method, 'manual');
});

test('تقرير حضور العامل لفترة مع المستحق للمحاسب', async () => {
  const w = (await t.get('gm', `/workers?project_id=${p.id}`)).body[0];
  const r = await t.get('finance', `/workers/${w.id}/attendance?from=2026-10-01&to=2026-10-21`);
  assert.equal(r.status, 200);
  const s = r.body.summary;
  assert.equal(s.present + s.late + s.absent + s.leave, r.body.rows.length);
  assert.ok(r.body.pay.net >= 0);
  const sup = await t.get('sup1', `/workers/${w.id}/attendance`);
  assert.equal(sup.body.pay, undefined, 'المشرف لا يرى المستحقات');
});
