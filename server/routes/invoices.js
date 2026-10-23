'use strict';
// المستخلصات لكل مشروع — الاعتماد للإدارة، والصرف للإدارة المالية والمالك فقط
const { require: need, assertProject, projectScope, can } = require('../permissions');
const { h, HttpError, num, isDate, today, nowIso, round2 } = require('../util');
const { tx } = require('../db');
const { invoiceTotals, notify } = require('../services');
const { page, esc, money } = require('../print');

const PARTY_TYPES = { client: 'المالك/العميل', subcontractor: 'مقاول باطن', supplier: 'مورد' };
const STATUS = {
  draft: 'مسودة', submitted: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض',
  partially_paid: 'مصروف جزئياً', paid: 'مصروف بالكامل',
};
const METHODS = { transfer: 'تحويل بنكي', cheque: 'شيك', cash: 'نقدي' };

function validItems(items) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'أضف بنداً واحداً على الأقل');
  return items.map((i) => {
    const qty = num(i.qty);
    const price = num(i.unit_price);
    if (!i.description || !String(i.description).trim()) throw new HttpError(400, 'وصف البند مطلوب');
    if (qty === null || qty < 0 || price === null || price < 0) throw new HttpError(400, 'الكمية والسعر يجب أن تكون أرقاماً موجبة');
    return { description: String(i.description).trim(), unit: i.unit || null, qty, unit_price: price };
  });
}

function validHeader(db, b, ex = {}) {
  const v = {
    party_type: b.party_type ?? ex.party_type,
    party_name: (b.party_name ?? ex.party_name ?? '').toString().trim(),
    subcontractor_id: b.subcontractor_id !== undefined ? num(b.subcontractor_id) : ex.subcontractor_id ?? null,
    period_from: b.period_from ?? ex.period_from ?? null,
    period_to: b.period_to ?? ex.period_to ?? null,
    retention_pct: num(b.retention_pct, ex.retention_pct ?? 0),
    deductions: num(b.deductions, ex.deductions ?? 0),
    vat_pct: num(b.vat_pct, ex.vat_pct ?? 15),
    notes: b.notes ?? ex.notes ?? null,
  };
  if (!PARTY_TYPES[v.party_type]) throw new HttpError(400, 'نوع الطرف غير صالح');
  if (v.party_type === 'subcontractor') {
    const s = v.subcontractor_id && db.prepare('SELECT name FROM subcontractors WHERE id = ?').get(v.subcontractor_id);
    if (!s) throw new HttpError(400, 'اختر مقاول الباطن');
    if (!v.party_name) v.party_name = s.name;
  } else v.subcontractor_id = null;
  if (!v.party_name) throw new HttpError(400, 'اسم الطرف مطلوب');
  for (const k of ['period_from', 'period_to']) if (v[k] && !isDate(v[k])) throw new HttpError(400, 'تاريخ الفترة غير صالح');
  if (v.period_from && v.period_to && v.period_to < v.period_from) throw new HttpError(400, 'نهاية الفترة قبل بدايتها');
  if (v.retention_pct < 0 || v.retention_pct > 100) throw new HttpError(400, 'نسبة الضمان بين 0 و100');
  if (v.vat_pct < 0 || v.vat_pct > 100) throw new HttpError(400, 'نسبة الضريبة بين 0 و100');
  if (v.deductions < 0) throw new HttpError(400, 'الخصومات غير صالحة');
  return v;
}

module.exports = (api, { db }) => {
  const SELECT = `SELECT v.*, p.name project_name, c.name created_by_name, a.name approved_by_name FROM invoices v
    JOIN projects p ON p.id = v.project_id LEFT JOIN users c ON c.id = v.created_by LEFT JOIN users a ON a.id = v.approved_by`;

  function full(id) {
    const inv = db.prepare(`${SELECT} WHERE v.id = ?`).get(id);
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
    inv.payments = db.prepare(`SELECT pm.*, u.name paid_by_name FROM payments pm JOIN users u ON u.id = pm.paid_by
      WHERE invoice_id = ? ORDER BY paid_at, pm.id`).all(id);
    inv.totals = invoiceTotals(inv, inv.items, inv.payments);
    return inv;
  }

  function load(req) {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(req.params.id));
    if (!inv) throw new HttpError(404, 'المستخلص غير موجود');
    assertProject(db, req.user, inv.project_id);
    return full(inv.id);
  }

  function actions(user, inv) {
    return {
      can_edit: can(user, 'invoices.edit') && ['draft', 'rejected'].includes(inv.status),
      can_submit: can(user, 'invoices.edit') && ['draft', 'rejected'].includes(inv.status),
      can_approve: can(user, 'invoices.approve') && inv.status === 'submitted',
      can_pay: can(user, 'invoices.pay') && ['approved', 'partially_paid'].includes(inv.status),
    };
  }

  api.get('/invoices', need('invoices.view'), h((req, res) => {
    const s = projectScope(req.user);
    const where = [s.sql];
    const params = [...s.params];
    for (const k of ['project_id', 'subcontractor_id']) {
      if (req.query[k]) {
        where.push(`v.${k} = ?`);
        params.push(Number(req.query[k]));
      }
    }
    for (const k of ['status', 'party_type']) {
      if (req.query[k]) {
        where.push(`v.${k} = ?`);
        params.push(String(req.query[k]));
      }
    }
    if (req.query.q) {
      where.push('(v.party_name LIKE ? OR p.name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    const rows = db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY v.created_at DESC, v.id DESC`).all(...params);
    res.json(rows.map((r) => {
      const inv = full(r.id);
      delete inv.items;
      delete inv.payments;
      return inv;
    }));
  }));

  api.post('/invoices', need('invoices.edit'), h((req, res) => {
    const p = assertProject(db, req.user, req.body.project_id);
    const v = validHeader(db, req.body);
    const items = validItems(req.body.items);
    const id = tx(db, () => {
      const n = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 n FROM invoices WHERE project_id = ?').get(p.id).n;
      const r = db.prepare(`INSERT INTO invoices(project_id, number, party_type, party_name, subcontractor_id, period_from,
        period_to, retention_pct, deductions, vat_pct, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(p.id, n, v.party_type, v.party_name, v.subcontractor_id, v.period_from, v.period_to, v.retention_pct,
          v.deductions, v.vat_pct, v.notes, req.user.id, nowIso());
      const ins = db.prepare('INSERT INTO invoice_items(invoice_id, description, unit, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
      for (const i of items) ins.run(r.lastInsertRowid, i.description, i.unit, i.qty, i.unit_price);
      return r.lastInsertRowid;
    });
    const inv = full(id);
    res.status(201).json({ ...inv, ...actions(req.user, inv) });
  }));

  api.get('/invoices/:id', need('invoices.view'), h((req, res) => {
    const inv = load(req);
    res.json({ ...inv, ...actions(req.user, inv) });
  }));

  api.put('/invoices/:id', need('invoices.edit'), h((req, res) => {
    const inv = load(req);
    if (!['draft', 'rejected'].includes(inv.status)) throw new HttpError(409, 'لا يمكن تعديل مستخلص بعد رفعه للاعتماد');
    const v = validHeader(db, req.body, inv);
    const items = req.body.items ? validItems(req.body.items) : null;
    tx(db, () => {
      db.prepare(`UPDATE invoices SET party_type=?, party_name=?, subcontractor_id=?, period_from=?, period_to=?,
        retention_pct=?, deductions=?, vat_pct=?, notes=?, status='draft' WHERE id=?`).run(v.party_type, v.party_name,
        v.subcontractor_id, v.period_from, v.period_to, v.retention_pct, v.deductions, v.vat_pct, v.notes, inv.id);
      if (items) {
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(inv.id);
        const ins = db.prepare('INSERT INTO invoice_items(invoice_id, description, unit, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
        for (const i of items) ins.run(inv.id, i.description, i.unit, i.qty, i.unit_price);
      }
    });
    const out = full(inv.id);
    res.json({ ...out, ...actions(req.user, out) });
  }));

  api.post('/invoices/:id/submit', need('invoices.edit'), h((req, res) => {
    const inv = load(req);
    if (!['draft', 'rejected'].includes(inv.status)) throw new HttpError(409, 'المستخلص مرفوع مسبقاً');
    if (inv.totals.net <= 0) throw new HttpError(400, 'صافي المستخلص يجب أن يكون أكبر من صفر');
    db.prepare("UPDATE invoices SET status = 'submitted' WHERE id = ?").run(inv.id);
    const approvers = db.prepare("SELECT id FROM users WHERE role IN ('gm','owner') AND active = 1").all().map((r) => r.id);
    notify(db, approvers, { title: 'مستخلص بانتظار الاعتماد', body: `${inv.project_name} — مستخلص ${inv.number} — ${inv.party_name}`, link: `#/invoices/${inv.id}` });
    const out = full(inv.id);
    res.json({ ...out, ...actions(req.user, out) });
  }));

  api.post('/invoices/:id/approve', need('invoices.approve'), h((req, res) => {
    const inv = load(req);
    if (inv.status !== 'submitted') throw new HttpError(409, 'المستخلص ليس بانتظار الاعتماد');
    db.prepare("UPDATE invoices SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?").run(req.user.id, nowIso(), inv.id);
    const finance = db.prepare("SELECT id FROM users WHERE role IN ('accountant','owner') AND active = 1").all().map((r) => r.id);
    notify(db, [...finance, inv.created_by], { title: 'مستخلص معتمد جاهز للصرف', body: `${inv.project_name} — مستخلص ${inv.number}`, link: `#/invoices/${inv.id}` });
    const out = full(inv.id);
    res.json({ ...out, ...actions(req.user, out) });
  }));

  api.post('/invoices/:id/reject', need('invoices.approve'), h((req, res) => {
    const inv = load(req);
    if (inv.status !== 'submitted') throw new HttpError(409, 'المستخلص ليس بانتظار الاعتماد');
    const reason = String(req.body.reason || '').trim();
    db.prepare("UPDATE invoices SET status = 'rejected', notes = ? WHERE id = ?")
      .run([inv.notes, reason && `سبب الرفض: ${reason}`].filter(Boolean).join('\n'), inv.id);
    notify(db, [inv.created_by], { title: 'رُفض المستخلص', body: `${inv.project_name} — مستخلص ${inv.number}${reason ? `: ${reason}` : ''}`, link: `#/invoices/${inv.id}` });
    const out = full(inv.id);
    res.json({ ...out, ...actions(req.user, out) });
  }));

  // الصرف — للإدارة المالية والمالك فقط
  api.post('/invoices/:id/payments', need('invoices.pay'), h((req, res) => {
    const inv = load(req);
    if (!['approved', 'partially_paid'].includes(inv.status)) throw new HttpError(409, 'لا يمكن الصرف إلا لمستخلص معتمد');
    const amount = round2(num(req.body.amount, 0));
    if (amount <= 0) throw new HttpError(400, 'مبلغ الصرف غير صالح');
    if (amount > inv.totals.remaining + 0.001) throw new HttpError(400, `المبلغ أكبر من المتبقي (${inv.totals.remaining})`);
    const method = req.body.method || 'transfer';
    if (!METHODS[method]) throw new HttpError(400, 'طريقة الصرف غير صالحة');
    const paidAt = req.body.paid_at || today();
    if (!isDate(paidAt)) throw new HttpError(400, 'تاريخ الصرف غير صالح');
    tx(db, () => {
      db.prepare('INSERT INTO payments(invoice_id, amount, method, reference, paid_at, paid_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(inv.id, amount, method, req.body.reference || null, paidAt, req.user.id, nowIso());
      const status = amount >= inv.totals.remaining - 0.001 ? 'paid' : 'partially_paid';
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, inv.id);
    });
    notify(db, [inv.created_by], { title: 'تم صرف دفعة من المستخلص', body: `${inv.project_name} — مستخلص ${inv.number}: ${amount}`, link: `#/invoices/${inv.id}` });
    const out = full(inv.id);
    res.status(201).json({ ...out, ...actions(req.user, out) });
  }));

  api.get('/invoices/:id/print', need('invoices.view'), h((req, res) => {
    const inv = load(req);
    const t = inv.totals;
    const body = `<div class="kv"><b>المشروع</b><span>${esc(inv.project_name)}</span><b>رقم المستخلص</b><span>${inv.number}</span>
      <b>الطرف</b><span>${esc(inv.party_name)} (${PARTY_TYPES[inv.party_type]})</span>
      <b>الفترة</b><span>${esc(inv.period_from || '')} — ${esc(inv.period_to || '')}</span><b>الحالة</b><span>${STATUS[inv.status]}</span></div>
      <h2>البنود</h2><table><tr><th>#</th><th>الوصف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
      ${inv.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td>${esc(i.unit)}</td><td>${i.qty}</td><td>${money(i.unit_price)}</td><td>${money(i.qty * i.unit_price)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="5">إجمالي الأعمال</td><td>${money(t.gross)}</td></tr>
      <tr><td colspan="5">ضريبة القيمة المضافة ${inv.vat_pct}%</td><td>${money(t.vat)}</td></tr>
      <tr><td colspan="5">محتجز ضمان ${inv.retention_pct}%</td><td>(${money(t.retention)})</td></tr>
      <tr><td colspan="5">خصومات</td><td>(${money(t.deductions)})</td></tr>
      <tr class="tot"><td colspan="5">صافي المستحق</td><td>${money(t.net)}</td></tr>
      <tr><td colspan="5">المصروف</td><td>${money(t.paid)}</td></tr>
      <tr class="tot"><td colspan="5">المتبقي</td><td>${money(t.remaining)}</td></tr></table>
      ${inv.payments.length ? `<h2>دفعات الصرف</h2><table><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>بواسطة</th></tr>
      ${inv.payments.map((p) => `<tr><td>${esc(p.paid_at)}</td><td>${money(p.amount)}</td><td>${METHODS[p.method] || esc(p.method)}</td><td>${esc(p.reference)}</td><td>${esc(p.paid_by_name)}</td></tr>`).join('')}</table>` : ''}
      ${inv.notes ? `<p>ملاحظات: ${esc(inv.notes)}</p>` : ''}
      <div class="sig"><div>مدير المشروع</div><div>الاعتماد: ${esc(inv.approved_by_name || '')}</div><div>الإدارة المالية</div></div>`;
    res.type('html').send(page(db, `مستخلص رقم ${inv.number} — ${inv.project_name}`, body));
  }));
};

module.exports.PARTY_TYPES = PARTY_TYPES;
module.exports.STATUS = STATUS;
