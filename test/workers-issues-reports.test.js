'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, setClock } = require('./helpers');
const { escalateIssues, iqamaAlerts, payrollLine, consecutiveAbsentees } = require('../server/services');

let t;
before(async () => { t = await start(); });
after(async () => t.stop());

// صورة PNG صغيرة (1×1)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('إضافة عامل مع صورة ومقاول باطن', async () => {
  const [p] = (await t.get('pm1', '/projects')).body;
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: 'عامل اختبار', iqama_no: '2999999999', iqama_expiry: '2026-11-05', nationality: 'مصر',
    profession: 'لحام', wage_type: 'daily', wage: '150', affiliation: 'sub', subcontractor_id: '1', project_id: String(p.id) })) fd.append(k, v);
  fd.append('photo', new Blob([PNG], { type: 'image/png' }), 'p.png');
  const r = await t.post('pm1', '/workers', fd);
  assert.equal(r.status, 201);
  assert.equal(r.body.has_photo, true);
  assert.equal(r.body.iqama_days_left, 15);
  const photo = await t.call('pm1', 'GET', `/workers/${r.body.id}/photo`, undefined, { raw: true });
  assert.equal(photo.status, 200);
  // مقاول باطن مطلوب
  const bad = await t.post('pm1', '/workers', { name: 'x', affiliation: 'sub', project_id: p.id });
  assert.equal(bad.status, 400);
  // مدير مشروع لا يضيف عاملاً لمشروع غيره
  const p2 = (await t.get('pm2', '/projects')).body[0];
  assert.equal((await t.post('pm1', '/workers', { name: 'x', project_id: p2.id })).status, 403);
});

test('نقل العامل يحفظ السجل تلقائياً', async () => {
  const [a, b] = (await t.get('pm1', '/projects')).body;
  const w = (await t.get('gm', `/workers?project_id=${a.id}`)).body[0];
  const before_ = (await t.get('gm', `/workers/${w.id}`)).body.assignments.length;
  const r = await t.post('pm1', `/workers/${w.id}/transfer`, { project_id: b.id, date: '2026-10-21' });
  assert.equal(r.status, 200);
  assert.equal(r.body.project_id, b.id);
  const d = (await t.get('gm', `/workers/${w.id}`)).body;
  assert.equal(d.assignments.length, before_ + 1);
  assert.equal(d.assignments[0].project_id, b.id);
  assert.equal(d.assignments[0].to_date, null);
  assert.equal(d.assignments[1].to_date, '2026-10-20');
  // لا نقل لمشروع لا يديره
  const other = (await t.get('pm2', '/projects')).body[0];
  assert.equal((await t.post('pm1', `/workers/${w.id}/transfer`, { project_id: other.id })).status, 403);
  // المشرف لا ينقل
  assert.equal((await t.post('sup2', `/workers/${w.id}/transfer`, { project_id: a.id })).status, 403);
});

test('البحث والفلترة في العمال', async () => {
  const all = (await t.get('gm', '/workers')).body;
  const sub = (await t.get('gm', '/workers?affiliation=sub')).body;
  assert.ok(sub.length > 0 && sub.length < all.length);
  assert.ok(sub.every((w) => w.affiliation === 'sub'));
  const exp = (await t.get('gm', '/workers?iqama_expiring=1')).body;
  assert.ok(exp.length > 0 && exp.every((w) => w.iqama_days_left <= 30));
  const q = (await t.get('gm', `/workers?q=${encodeURIComponent(all[0].iqama_no)}`)).body;
  assert.equal(q.length, 1);
});

test('بلاغ بصورة: إسناد تلقائي لمدير المشروع، والتصعيد بعد المهلة', async () => {
  const p = (await t.get('sup1', '/projects')).body[0];
  const fd = new FormData();
  fd.append('project_id', p.id);
  fd.append('title', 'تسرب زيت من الرافعة');
  fd.append('category', 'equipment');
  fd.append('severity', 'critical');
  fd.append('client_id', 'abc-1');
  fd.append('media', new Blob([PNG], { type: 'image/png' }), 'a.png');
  fd.append('media_meta', JSON.stringify([{ taken_at: '2026-10-21T05:00:00Z', lat: p.lat, lng: p.lng }]));
  const r = await t.post('sup1', '/issues', fd);
  assert.equal(r.status, 201);
  // نفس client_id لا يكرر البلاغ (مزامنة بعد انقطاع)
  const dup = new FormData();
  for (const [k, v] of [['project_id', p.id], ['title', 'x'], ['category', 'other'], ['severity', 'low'], ['client_id', 'abc-1']]) dup.append(k, v);
  const d = await t.post('sup1', '/issues', dup);
  assert.equal(d.body.duplicate, true);
  assert.equal(d.body.id, r.body.id);

  const i = (await t.get('sup1', `/issues/${r.body.id}`)).body;
  assert.equal(i.assignee_id, p.manager_id);
  assert.equal(i.media.length, 1);
  assert.equal(i.media[0].lat, p.lat);
  // حرجة => مهلة 4 ساعات
  assert.equal(new Date(i.due_at).getTime() - new Date('2026-10-21T05:00:00Z').getTime(), 4 * 3600000);
  // المرفق محمي بصلاحية المشروع
  assert.equal((await t.call('sup1', 'GET', `/media/${i.media[0].id}`, undefined, { raw: true })).status, 200);
  assert.equal((await t.call('sup2', 'GET', `/media/${i.media[0].id}`, undefined, { raw: true })).status, 403);
  // إشعار لمدير المشروع والإدارة
  const n = (await t.get('pm1', '/notifications')).body;
  assert.ok(n.rows.some((x) => x.link === `#/issues/${i.id}`));

  setClock('2026-10-21T10:00:00Z');
  assert.ok(escalateIssues(t.db) >= 1);
  const e = (await t.get('gm', `/issues/${i.id}`)).body;
  assert.equal(e.escalated, 1);
  assert.equal(e.overdue, true);
  const gmN = (await t.get('gm', '/notifications')).body.rows;
  assert.ok(gmN.some((x) => x.title.includes('تصعيد') && x.link === `#/issues/${i.id}`));
  assert.equal(escalateIssues(t.db), 0, 'لا يُصعَّد مرتين');
  setClock('2026-10-21T05:00:00Z');
});

test('المشرف لا يغير مسؤول البلاغ، ومدير المشروع يغلقه', async () => {
  const i = (await t.get('sup1', '/issues?open=1')).body[0];
  assert.equal((await t.put('sup1', `/issues/${i.id}`, { status: 'closed' })).status, 403);
  const r = await t.put('pm1', `/issues/${i.id}`, { status: 'closed' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'closed');
  assert.ok(r.body.closed_at);
});

test('التقرير اليومي بصور وتحديث نسبة الإنجاز وإرساله للإدارة', async () => {
  const p = (await t.get('sup2', '/projects')).body[0];
  const fd = new FormData();
  fd.append('project_id', p.id);
  fd.append('description', 'صب سقف الدور الثاني');
  fd.append('progress', '70');
  fd.append('weather', 'مشمس');
  fd.append('client_id', 'rep-1');
  fd.append('media', new Blob([PNG], { type: 'image/png' }), 'a.png');
  fd.append('media', new Blob([Buffer.from('fake')], { type: 'audio/webm' }), 'v.webm');
  const r = await t.post('sup2', '/reports', fd);
  assert.equal(r.status, 201);
  const rep = (await t.get('sup2', `/reports/${r.body.id}`)).body;
  assert.deepEqual(rep.media.map((m) => m.kind), ['image', 'audio']);
  assert.equal((await t.get('gm', `/projects/${p.id}`)).body.progress, 70);
  assert.equal((await t.get('sup1', `/reports/${r.body.id}`)).status, 403);
  const n = (await t.get('owner', '/notifications')).body.rows;
  assert.ok(n.some((x) => x.link === `#/reports/${r.body.id}`));
  const pr = await t.call('gm', 'GET', `/projects/${p.id}/daily-print?date=2026-10-21`);
  assert.match(pr.body, /صب سقف الدور الثاني/);
  // ملف غير مدعوم
  const bad = new FormData();
  bad.append('project_id', p.id);
  bad.append('description', 'x');
  bad.append('media', new Blob(['x'], { type: 'application/x-msdownload' }), 'a.exe');
  assert.equal((await t.post('sup2', '/reports', bad)).status, 400);
});

test('تنبيهات الإقامة قبل 30 يوماً بدون تكرار', async () => {
  const n = iqamaAlerts(t.db, '2026-10-21');
  assert.ok(n > 0);
  const c1 = t.db.prepare("SELECT COUNT(*) c FROM notifications WHERE dedupe_key LIKE 'iqama:%'").get().c;
  iqamaAlerts(t.db, '2026-10-21');
  const c2 = t.db.prepare("SELECT COUNT(*) c FROM notifications WHERE dedupe_key LIKE 'iqama:%'").get().c;
  assert.equal(c1, c2);
});

test('معادلة الرواتب', () => {
  const s = { present: 20, late: 2, absent: 3, leave: 1, overtime_hours: 10, worked_days: 22 };
  // يومي 160: 22 × 160 + 10 × 20 × 1.5
  assert.deepEqual(payrollLine({ wage_type: 'daily', wage: 160 }, s), { base: 3520, overtime_pay: 300, absence_deduction: 0, net: 3820, daily_rate: 160 });
  // شهري 3000: 3000 + 10 × 12.5 × 1.5 − 3 × 100
  assert.deepEqual(payrollLine({ wage_type: 'monthly', wage: 3000 }, s), { base: 3000, overtime_pay: 187.5, absence_deduction: 300, net: 2887.5, daily_rate: 100 });
});

test('لوحة التحكم: البطاقات والتنبيهات والتقييد حسب الدور', async () => {
  const d = (await t.get('gm', '/dashboard')).body;
  assert.ok(d.cards.total_workers >= 60);
  assert.ok(d.cards.cost_today > 0);
  assert.ok(d.alerts.some((a) => a.type === 'understaffed'), 'مشروع عماله أقل من المخطط بأكثر من 20%');
  assert.ok(d.alerts.some((a) => a.type === 'absent3'), 'غياب 3 أيام متتالية');
  assert.ok(d.alerts.some((a) => a.type === 'overdue_issue'));
  assert.ok(d.attendance_series.length >= 20);
  const s = (await t.get('sup1', '/dashboard')).body;
  assert.equal(s.projects.length, 1);
  assert.equal(s.cards.cost_today, undefined);
  assert.equal(s.cost_by_project, undefined);
  assert.ok(consecutiveAbsentees(t.db).length > 0);
});

test('التصدير: Excel للرواتب والحضور، وملخص المقاولين', async () => {
  const x = await t.call('finance', 'GET', '/exports/payroll?month=2026-10&format=xlsx', undefined, { raw: true });
  assert.equal(x.status, 200);
  assert.match(x.headers.get('content-type'), /spreadsheetml/);
  const buf = Buffer.from(await x.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const pay = (await t.get('finance', '/exports/payroll?month=2026-10')).body;
  assert.ok(pay.rows.length >= 60);
  assert.equal(Math.round(pay.totals.net * 100), Math.round(pay.rows.reduce((s, r) => s + r.net, 0) * 100));
  const sum = (await t.get('gm', '/exports/summary?group=subcontractor&from=2026-10-01&to=2026-10-21')).body;
  assert.ok(sum.rows.some((r) => r.name === 'الشركة'));
  assert.ok(sum.rows.length >= 2);
  const sup = (await t.get('sup1', '/exports/attendance?from=2026-10-01&to=2026-10-21')).body;
  const sp = (await t.get('sup1', '/projects')).body[0];
  assert.ok(sup.rows.every((r) => r.cost === undefined));
  assert.ok(sup.rows.length > 0 && sup.rows.length <= sp.assigned_workers + 2);
  const html = await t.call('gm', 'GET', '/exports/attendance?format=html');
  assert.match(html.body, /تقرير الحضور/);
});
