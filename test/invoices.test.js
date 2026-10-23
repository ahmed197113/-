'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let t;
let projectId;
before(async () => {
  t = await start();
  projectId = (await t.get('pm1', '/projects')).body[0].id;
});
after(async () => t.stop());

const body = (pid) => ({
  project_id: pid, party_type: 'subcontractor', subcontractor_id: 1, retention_pct: 10, vat_pct: 15, deductions: 500,
  items: [{ description: 'أعمال بلوك', unit: 'م²', qty: 100, unit_price: 50 }, { description: 'لياسة', unit: 'م²', qty: 100, unit_price: 30 }],
});

test('حساب المستخلص: الإجمالي + الضريبة − الضمان − الخصومات', async () => {
  const r = await t.post('pm1', '/invoices', body(projectId));
  assert.equal(r.status, 201);
  assert.deepEqual(
    { gross: r.body.totals.gross, vat: r.body.totals.vat, retention: r.body.totals.retention, net: r.body.totals.net },
    { gross: 8000, vat: 1200, retention: 800, net: 7900 },
  );
  assert.equal(r.body.number, 3, 'الترقيم متسلسل لكل مشروع');
  assert.equal(r.body.party_name, 'مؤسسة البناء المتقن');
});

test('مدير مشروع آخر لا يرى ولا ينشئ مستخلصاً على مشروع ليس له', async () => {
  assert.equal((await t.post('pm2', '/invoices', body(projectId))).status, 403);
  const inv = (await t.get('pm1', `/invoices?project_id=${projectId}`)).body[0];
  assert.equal((await t.get('pm2', `/invoices/${inv.id}`)).status, 403);
});

test('دورة المستخلص: الصرف للإدارة المالية والمالك فقط', async () => {
  const inv = (await t.post('pm1', '/invoices', body(projectId))).body;
  // لا صرف قبل الاعتماد
  assert.equal((await t.post('finance', `/invoices/${inv.id}/payments`, { amount: 100 })).status, 409);
  assert.equal((await t.post('pm1', `/invoices/${inv.id}/submit`)).status, 200);
  // بعد الرفع لا يمكن التعديل
  assert.equal((await t.put('pm1', `/invoices/${inv.id}`, { deductions: 0 })).status, 409);
  // الاعتماد للمدير العام/المالك فقط
  assert.equal((await t.post('finance', `/invoices/${inv.id}/approve`)).status, 403);
  assert.equal((await t.post('pm1', `/invoices/${inv.id}/approve`)).status, 403);
  const ap = await t.post('gm', `/invoices/${inv.id}/approve`);
  assert.equal(ap.status, 200);
  assert.equal(ap.body.status, 'approved');
  assert.equal(ap.body.can_pay, false, 'المدير العام لا يرى زر الصرف');
  // الصرف: المدير العام ومدير المشروع والمشرف ممنوعون
  for (const u of ['gm', 'pm1', 'sup1']) {
    assert.equal((await t.post(u, `/invoices/${inv.id}/payments`, { amount: 100 })).status, 403, u);
  }
  // مبلغ أكبر من المتبقي
  assert.equal((await t.post('finance', `/invoices/${inv.id}/payments`, { amount: 99999 })).status, 400);
  const p1 = await t.post('finance', `/invoices/${inv.id}/payments`, { amount: 4000, method: 'transfer', reference: 'TRX1' });
  assert.equal(p1.status, 201);
  assert.equal(p1.body.status, 'partially_paid');
  assert.equal(p1.body.totals.remaining, 3900);
  const p2 = await t.post('owner', `/invoices/${inv.id}/payments`, { amount: 3900, method: 'cheque' });
  assert.equal(p2.status, 201);
  assert.equal(p2.body.status, 'paid');
  assert.equal(p2.body.payments.length, 2);
  assert.equal((await t.post('owner', `/invoices/${inv.id}/payments`, { amount: 1 })).status, 409);
});

test('الرفض يعيد المستخلص للتعديل', async () => {
  const inv = (await t.post('pm1', '/invoices', body(projectId))).body;
  await t.post('pm1', `/invoices/${inv.id}/submit`);
  const r = await t.post('owner', `/invoices/${inv.id}/reject`, { reason: 'الكميات غير مطابقة' });
  assert.equal(r.body.status, 'rejected');
  assert.match(r.body.notes, /الكميات/);
  const e = await t.put('pm1', `/invoices/${inv.id}`, { deductions: 0 });
  assert.equal(e.status, 200);
  assert.equal(e.body.status, 'draft');
});

test('صفحة طباعة المستخلص', async () => {
  const inv = (await t.get('finance', '/invoices')).body[0];
  const r = await t.call('finance', 'GET', `/invoices/${inv.id}/print`);
  assert.equal(r.status, 200);
  assert.match(r.body, /صافي المستحق/);
});
