// منطق نظام إدارة العهد — مشترك بين الخادم (Node.js) والتشغيل على الجهاز (المتصفح / تطبيق أندرويد)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CustodyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROLES = { admin: 'مدير النظام', owner: 'المالك', accountant: 'محاسب', employee: 'موظف' };
  const KINDS = { permanent: 'عهدة مستديمة', temporary: 'عهدة مؤقتة' };
  const CUSTODY_STATUS = { open: 'مفتوحة', closed: 'مغلقة' };
  const EXPENSE_STATUS = { pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض' };
  const TX_TYPES = {
    issue: { label: 'صرف عهدة', sign: 1 }, topup: { label: 'تعزيز العهدة', sign: 1 }, transfer_in: { label: 'تحويل وارد', sign: 1 },
    reimburse: { label: 'صرف فرق للموظف', sign: 1 }, return: { label: 'رد نقدي من الموظف', sign: -1 }, transfer_out: { label: 'تحويل صادر', sign: -1 },
  };
  const ASSET_STATUS = { available: 'متاح بالمستودع', assigned: 'مسلَّم لموظف', maintenance: 'في الصيانة', lost: 'مفقود / تالف', retired: 'مستبعد' };
  const ASSET_MOVES = { assign: 'تسليم لموظف', return: 'استلام من الموظف', transfer: 'نقل لموظف آخر', maintenance: 'إرسال للصيانة', available: 'إرجاع للمستودع', lost: 'تسجيل فقد / تلف', retire: 'استبعاد' };
  const CC_TYPES = { project: 'مشروع', department: 'إدارة / قسم', branch: 'فرع', vehicle: 'مركبة / معدة', other: 'أخرى' };
  // مصادر الأموال: من أين تُصرف العهدة وإلى أين تُرد
  const SOURCE_TYPES = { cash: 'صندوق نقدي', bank: 'حساب بنكي', owner: 'المالك', partner: 'شريك', client: 'عميل / مالك مشروع', other: 'أخرى' };
  const DEFAULT_SOURCES = [['الصندوق الرئيسي', 'cash'], ['البنك', 'bank'], ['المالك', 'owner']];
  const ASSET_CATEGORIES = ['أجهزة حاسب', 'جوالات وأجهزة اتصال', 'معدات وعدد', 'مركبات', 'أثاث', 'أخرى'];
  const DEFAULT_CATEGORIES = [
    ['5101', 'مواد وخامات'], ['5102', 'نقل ومواصلات'], ['5103', 'وقود ومحروقات'], ['5104', 'إعاشة وضيافة'], ['5105', 'عمالة يومية'],
    ['5106', 'أدوات ومعدات صغيرة'], ['5107', 'صيانة وإصلاح'], ['5108', 'رسوم حكومية'], ['5109', 'قرطاسية ومطبوعات'],
    ['5110', 'اتصالات وإنترنت'], ['5111', 'سكن وإقامة'], ['5112', 'سفر وانتقالات'], ['5199', 'مصروفات متنوعة'],
  ];
  const DEFAULT_SETTINGS = {
    companyName: 'شركة الخطوط المعدنية للمقاولات العامة', vatNumber: '', address: '', currency: 'ر.س', vatRate: 15,
    workStart: '08:00', workEnd: '17:00', workDays: [0, 1, 2, 3, 4], reminderMinutes: 30, remindersEnabled: true,
    agingDays: 30, lowBalance: 200, receiptRequiredAbove: 0, counters: {},
  };
  const COLLECTIONS = ['users', 'fundSources', 'costCenters', 'categories', 'custodies', 'tx', 'expenses', 'settlements', 'assets', 'assetMoves', 'requests', 'checkins', 'notifications', 'audit'];

  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  const fail = (status, msg) => { throw new ApiError(status, msg); };
  const num = v => Math.round((Number(v) || 0) * 100) / 100;
  const pad = n => String(n).padStart(5, '0');

  function normalize(db) {
    db = db && typeof db === 'object' ? db : {};
    for (const k of COLLECTIONS) if (!Array.isArray(db[k])) db[k] = [];
    db.sessions = db.sessions || {};
    db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
    db.settings.counters = db.settings.counters || {};
    if (!db.fundSources.length) db.fundSources = DEFAULT_SOURCES.map(([name, type], i) => ({ id: 'src' + (i + 1), name, type, accountNo: '', active: true, notes: '' }));
    if (!db.categories.length) db.categories = DEFAULT_CATEGORIES.map(([code, name], i) => ({ id: 'cat' + (i + 1), code, name, active: true, vatApplicable: true }));
    // ترقية بيانات النسخة الأولى
    for (const u of db.users) if (u.role === 'manager') u.role = 'admin';
    for (const e of db.expenses) if (!Array.isArray(e.attachments)) e.attachments = [];
    db.version = 2;
    return db;
  }

  /**
   * env: { db, save(), uid(), now(), hashPassword(pw) -> {salt,hash}, verifyPassword(user,pw) -> bool,
   *        putFile(dataUrl) -> id, today() -> 'YYYY-MM-DD' }
   */
  function createCore(env) {
    const D = () => env.db;
    const S = () => env.db.settings;
    const today = () => env.today ? env.today() : new Date().toISOString().slice(0, 10);
    const isStaff = u => u.role === 'admin' || u.role === 'accountant' || u.role === 'owner';
    const staffOnly = u => { if (!isStaff(u)) fail(403, 'هذه العملية للإدارة فقط'); };
    const adminOnly = u => { if (u.role !== 'admin') fail(403, 'هذه العملية لمدير النظام فقط'); };
    const text = (v, label) => { const s = String(v ?? '').trim(); if (!s) fail(400, `حقل «${label}» مطلوب`); return s; };
    const opt = v => String(v ?? '').trim();
    const money = (v, label = 'المبلغ') => { const n = num(v); if (!(n > 0)) fail(400, `${label} يجب أن يكون أكبر من صفر`); return n; };
    const dateOr = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : today();
    const nextNo = prefix => { const c = S().counters; c[prefix] = (c[prefix] || 0) + 1; return `${prefix}-${pad(c[prefix])}`; };
    const find = (coll, id, label = 'السجل') => D()[coll].find(x => x.id === id) || fail(404, `${label} غير موجود`);
    const userName = id => (D().users.find(u => u.id === id) || {}).name || '—';
    const ccName = id => { const c = D().costCenters.find(x => x.id === id); return c ? (c.code ? c.code + ' · ' : '') + c.name : '—'; };
    const catName = id => (D().categories.find(x => x.id === id) || {}).name || '—';
    const srcName = id => (D().fundSources.find(x => x.id === id) || {}).name || '';
    // يتحقق من مصدر المبلغ؛ مطلوب ما دام هناك مصادر معرفة
    const sourceOf = (id, required = true) => {
      if (!id) { if (required && D().fundSources.some(x => x.active !== false)) fail(400, 'اختر مصدر المبلغ (من أين / إلى أين)'); return null; }
      return find('fundSources', id, 'مصدر المبلغ').id;
    };
    const publicUser = u => u && ({ id: u.id, name: u.name, username: u.username, role: u.role, roleName: ROLES[u.role], jobTitle: u.jobTitle || '', phone: u.phone || '', department: u.department || '', custodyLimit: u.custodyLimit || 0, directCustody: !!u.directCustody, active: u.active !== false });

    function log(user, action, summary, entity, entityId) {
      D().audit.push({ id: env.uid(), at: env.now(), userId: user ? user.id : null, userName: user ? user.name : 'النظام', action, summary, entity, entityId });
      if (D().audit.length > 5000) D().audit.splice(0, D().audit.length - 5000);
    }
    function notify(userIds, text, link) {
      for (const userId of [].concat(userIds)) if (userId) D().notifications.push({ id: env.uid(), userId, at: env.now(), text, link: link || '', read: false });
      if (D().notifications.length > 5000) D().notifications.splice(0, D().notifications.length - 5000);
    }
    const staffIds = () => D().users.filter(u => isStaff(u) && u.active !== false).map(u => u.id);

    // ---------- مراكز التكلفة (شجرة) ----------
    function ccDescendants(id) {
      const out = new Set([id]);
      let grew = true;
      while (grew) { grew = false; for (const c of D().costCenters) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; } }
      return out;
    }
    function ccTree() {
      const list = D().costCenters;
      const out = [];
      const walk = (parentId, depth) => list.filter(c => (c.parentId || null) === parentId).sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'ar'))
        .forEach(c => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
      walk(null, 0);
      // مراكز يتيمة (أب محذوف)
      for (const c of list) if (!out.some(o => o.id === c.id)) out.push({ ...c, depth: 0 });
      return out;
    }

    // ---------- أرصدة العهد ----------
    function custodyBalance(c) {
      const txs = D().tx.filter(t => t.custodyId === c.id);
      const confirmed = txs.filter(t => t.status === 'confirmed');
      const sum = types => num(confirmed.filter(t => types.includes(t.type)).reduce((s, t) => s + t.amount, 0));
      const exps = D().expenses.filter(e => e.custodyId === c.id && e.status !== 'rejected');
      const spent = num(exps.reduce((s, e) => s + e.amount, 0));
      const pending = exps.filter(e => e.status === 'pending');
      const received = sum(['issue', 'topup', 'transfer_in', 'reimburse']);
      const returned = sum(['return', 'transfer_out']);
      const unsettled = exps.filter(e => e.status === 'approved' && !e.settlementId);
      const overdue = c.status === 'open' && ((c.dueDate && c.dueDate < today()) || (c.kind === 'temporary' && !c.dueDate && daysBetween(c.issueDate, today()) > S().agingDays));
      return {
        received, spent, returned, balance: num(received - returned - spent),
        pendingCount: pending.length, pendingAmount: num(pending.reduce((s, e) => s + e.amount, 0)),
        unsettledCount: unsettled.length, unsettledAmount: num(unsettled.reduce((s, e) => s + e.amount, 0)),
        pendingTx: txs.filter(t => t.status === 'pending').length, overdue,
      };
    }
    const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    const custodyView = c => ({ ...c, kindName: KINDS[c.kind], employeeName: userName(c.employeeId), costCenterName: ccName(c.costCenterId), ...custodyBalance(c) });
    function employeeTotals(userId) {
      const cs = D().custodies.filter(c => c.employeeId === userId).map(custodyView);
      const open = cs.filter(c => c.status === 'open');
      const t = k => num(cs.reduce((s, c) => s + c[k], 0));
      return {
        openCount: open.length, received: t('received'), spent: t('spent'), returned: t('returned'), balance: t('balance'),
        pendingCount: cs.reduce((s, c) => s + c.pendingCount, 0), pendingAmount: t('pendingAmount'),
        overdueCount: open.filter(c => c.overdue).length,
        assetsCount: D().assets.filter(a => a.holderId === userId && a.status === 'assigned').length,
      };
    }
    function canAccessCustody(user, c) { if (!isStaff(user) && c.employeeId !== user.id) fail(403, 'غير مسموح'); }

    const expenseView = e => ({
      ...e, employeeName: userName(e.employeeId), costCenterName: ccName(e.costCenterId), categoryName: catName(e.categoryId),
      custodyNo: (D().custodies.find(c => c.id === e.custodyId) || {}).no || '—', statusName: EXPENSE_STATUS[e.status],
      settlementNo: e.settlementId ? (D().settlements.find(s => s.id === e.settlementId) || {}).no : null,
    });
    function filterExpenses(q, user) {
      let list = D().expenses;
      const emp = isStaff(user) ? q.employeeId : user.id;
      if (emp) list = list.filter(e => e.employeeId === emp);
      if (q.custodyId) list = list.filter(e => e.custodyId === q.custodyId);
      if (q.costCenterId) { const ids = ccDescendants(q.costCenterId); list = list.filter(e => ids.has(e.costCenterId)); }
      if (q.categoryId) list = list.filter(e => e.categoryId === q.categoryId);
      if (q.status) list = list.filter(e => e.status === q.status);
      if (q.from) list = list.filter(e => e.date >= q.from);
      if (q.to) list = list.filter(e => e.date <= q.to);
      if (q.settled === 'no') list = list.filter(e => !e.settlementId);
      if (q.q) { const s = String(q.q).toLowerCase(); list = list.filter(e => [e.no, e.description, e.vendor, e.invoiceNo].some(v => String(v || '').toLowerCase().includes(s))); }
      return list.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).map(expenseView);
    }
    function computeVat(amount, vatIncluded) {
      if (!vatIncluded) return 0;
      const r = Number(S().vatRate) || 0;
      return num(amount * r / (100 + r));
    }
    async function saveAttachments(list) {
      const out = [];
      for (const a of (Array.isArray(list) ? list : []).slice(0, 6)) {
        if (typeof a === 'string' && a.startsWith('data:')) out.push(await env.putFile(a));
        else if (typeof a === 'string' && a) out.push(a);
      }
      return out;
    }
    function addTx(user, custody, type, amount, extra = {}) {
      const t = {
        id: env.uid(), custodyId: custody.id, employeeId: custody.employeeId, type, amount: num(amount), date: dateOr(extra.date),
        method: extra.method || 'نقداً', ref: opt(extra.ref), note: opt(extra.note), status: extra.status || 'confirmed', sourceId: extra.sourceId || null,
        createdBy: user ? user.id : null, createdAt: env.now(), relatedId: extra.relatedId || null,
      };
      D().tx.push(t);
      return t;
    }
    function createCustody(user, b) {
      const emp = D().users.find(u => u.id === b.employeeId && u.active !== false) || fail(400, 'اختر الموظف');
      const kind = KINDS[b.kind] ? b.kind : 'temporary';
      const amount = money(b.amount, 'مبلغ العهدة');
      const sourceId = sourceOf(b.sourceId);
      if (b.costCenterId) find('costCenters', b.costCenterId, 'مركز التكلفة');
      if (emp.custodyLimit) {
        const bal = employeeTotals(emp.id).balance;
        if (bal + amount > emp.custodyLimit && !b.force) fail(400, `يتجاوز الحد الأعلى لعهدة الموظف (${emp.custodyLimit}). الرصيد الحالي ${bal}`);
      }
      const c = {
        id: env.uid(), no: nextNo('CU'), employeeId: emp.id, kind, purpose: text(b.purpose, 'الغرض من العهدة'), costCenterId: b.costCenterId || null,
        issueDate: dateOr(b.issueDate), dueDate: kind === 'temporary' && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '') ? b.dueDate : null,
        status: 'open', createdBy: user.id, createdAt: env.now(), closedAt: null, notes: opt(b.notes), ...(b.direct ? { direct: true } : {}),
      };
      D().custodies.push(c);
      addTx(user, c, 'issue', amount, { date: c.issueDate, method: b.method, ref: b.ref, note: b.direct ? 'تعميد مباشر' : 'صرف العهدة', sourceId });
      if (!b.direct) notify(emp.id, `تم صرف ${KINDS[kind]} رقم ${c.no} بمبلغ ${amount} — ${c.purpose}`, '#/custody/' + c.id);
      log(user, 'إنشاء عهدة', `${c.no} لـ ${emp.name} بمبلغ ${amount}${sourceId ? ' من ' + srcName(sourceId) : ''}`, 'custody', c.id);
      return c;
    }

    // ---------- التقارير ----------
    const col = (key, label, type = 'text') => ({ key, label, type });
    function reportData(name, q, user) {
      const inRange = d => (!q.from || d >= q.from) && (!q.to || d <= q.to);
      const period = q.from || q.to ? `الفترة: ${q.from || 'البداية'} — ${q.to || 'اليوم'}` : 'كل الفترات';
      if (name === 'statement') {
        const empId = isStaff(user) ? q.employeeId : user.id;
        const emp = D().users.find(u => u.id === empId) || fail(400, 'اختر الموظف');
        const custIds = new Set(D().custodies.filter(c => c.employeeId === emp.id && (!q.custodyId || c.id === q.custodyId)).map(c => c.id));
        const noOf = id => (D().custodies.find(c => c.id === id) || {}).no;
        const items = [
          ...D().tx.filter(t => custIds.has(t.custodyId) && t.status === 'confirmed').map(t => ({ date: t.date, at: t.createdAt, no: noOf(t.custodyId), desc: TX_TYPES[t.type].label + (t.sourceId ? (TX_TYPES[t.type].sign > 0 ? ' — من: ' : ' — إلى: ') + srcName(t.sourceId) : '') + (t.note && t.note !== 'صرف العهدة' ? ' — ' + t.note : ''), in: TX_TYPES[t.type].sign > 0 ? t.amount : 0, out: TX_TYPES[t.type].sign < 0 ? t.amount : 0 })),
          ...D().expenses.filter(e => custIds.has(e.custodyId) && e.status !== 'rejected').map(e => ({ date: e.date, at: e.createdAt, no: e.no, desc: `${catName(e.categoryId)}: ${e.description} (${ccName(e.costCenterId)})${e.status === 'pending' ? ' — بانتظار الاعتماد' : ''}`, in: 0, out: e.amount })),
        ].sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at));
        let run = 0;
        const opening = items.filter(i => q.from && i.date < q.from).reduce((s, i) => s + i.in - i.out, 0);
        run = opening;
        const rows = items.filter(i => inRange(i.date)).map(i => { run = num(run + i.in - i.out); return { ...i, balance: run }; });
        if (opening) rows.unshift({ date: q.from, no: '', desc: 'رصيد افتتاحي', in: 0, out: 0, balance: num(opening) });
        return { title: `كشف حساب عهدة — ${emp.name}`, subtitle: period, columns: [col('date', 'التاريخ', 'date'), col('no', 'المرجع'), col('desc', 'البيان'), col('in', 'وارد', 'money'), col('out', 'صادر', 'money'), col('balance', 'الرصيد', 'money')], rows, totals: { in: num(rows.reduce((s, r) => s + r.in, 0)), out: num(rows.reduce((s, r) => s + r.out, 0)), balance: run } };
      }
      staffOnly(user);
      if (name === 'balances') {
        const rows = D().users.filter(u => u.role !== 'admin' || D().custodies.some(c => c.employeeId === u.id)).map(u => ({ name: u.name, job: u.jobTitle || '', ...employeeTotals(u.id) })).filter(r => r.received || r.openCount);
        return { title: 'أرصدة العهد حسب الموظف', subtitle: 'حتى تاريخه', columns: [col('name', 'الموظف'), col('job', 'الوظيفة'), col('openCount', 'عهد مفتوحة', 'num'), col('received', 'المستلم', 'money'), col('spent', 'المصروف', 'money'), col('returned', 'المردود', 'money'), col('balance', 'الرصيد المتبقي', 'money'), col('pendingAmount', 'بانتظار الاعتماد', 'money')], rows, totals: sumCols(rows, ['openCount', 'received', 'spent', 'returned', 'balance', 'pendingAmount']) };
      }
      if (name === 'cost-centers') {
        const exps = D().expenses.filter(e => e.status !== 'rejected' && inRange(e.date) && (!q.status || e.status === q.status));
        const own = {};
        for (const e of exps) own[e.costCenterId || '_'] = num((own[e.costCenterId || '_'] || 0) + e.amount);
        const rows = ccTree().map(c => {
          const ids = ccDescendants(c.id);
          const spent = num([...ids].reduce((s, id) => s + (own[id] || 0), 0));
          return { code: c.code || '', name: ' '.repeat(c.depth) + c.name, type: CC_TYPES[c.type] || '', budget: c.budget || 0, spent, remaining: c.budget ? num(c.budget - spent) : '', used: c.budget ? Math.round(spent / c.budget * 100) + '%' : '', _depth: c.depth };
        });
        if (own._) rows.push({ code: '', name: 'بدون مركز تكلفة', type: '', budget: 0, spent: own._, remaining: '', used: '', _depth: 0 });
        const top = rows.filter(r => r._depth === 0);
        return { title: 'المصروفات حسب مراكز التكلفة', subtitle: period + ' — يشمل المراكز الفرعية', columns: [col('code', 'الرمز'), col('name', 'مركز التكلفة'), col('type', 'النوع'), col('budget', 'الميزانية', 'money'), col('spent', 'المصروف', 'money'), col('remaining', 'المتبقي', 'money'), col('used', 'نسبة الصرف')], rows, totals: { spent: num(top.reduce((s, r) => s + r.spent, 0)), budget: num(top.reduce((s, r) => s + r.budget, 0)) } };
      }
      if (name === 'categories') {
        const exps = D().expenses.filter(e => e.status !== 'rejected' && inRange(e.date) && (!q.costCenterId || ccDescendants(q.costCenterId).has(e.costCenterId)));
        const rows = D().categories.map(c => {
          const xs = exps.filter(e => e.categoryId === c.id);
          const total = num(xs.reduce((s, e) => s + e.amount, 0)), vat = num(xs.reduce((s, e) => s + (e.vat || 0), 0));
          return { code: c.code, name: c.name, count: xs.length, net: num(total - vat), vat, total };
        }).filter(r => r.count);
        return { title: 'المصروفات حسب البنود (الحسابات)', subtitle: period + (q.costCenterId ? ' — ' + ccName(q.costCenterId) : ''), columns: [col('code', 'رقم الحساب'), col('name', 'البند'), col('count', 'العدد', 'num'), col('net', 'الصافي', 'money'), col('vat', 'الضريبة', 'money'), col('total', 'الإجمالي', 'money')], rows, totals: sumCols(rows, ['count', 'net', 'vat', 'total']) };
      }
      if (name === 'expenses') {
        const rows = filterExpenses(q, user).map(e => ({ date: e.date, no: e.no, employee: e.employeeName, cc: e.costCenterName, category: e.categoryName, description: e.description, vendor: e.vendor || '', invoice: e.invoiceNo || '', net: num(e.amount - (e.vat || 0)), vat: e.vat || 0, total: e.amount, status: e.statusName }));
        return { title: 'سجل المصروفات التفصيلي', subtitle: period, columns: [col('date', 'التاريخ', 'date'), col('no', 'الرقم'), col('employee', 'الموظف'), col('cc', 'مركز التكلفة'), col('category', 'البند'), col('description', 'البيان'), col('vendor', 'المورد'), col('invoice', 'رقم الفاتورة'), col('net', 'الصافي', 'money'), col('vat', 'الضريبة', 'money'), col('total', 'الإجمالي', 'money'), col('status', 'الحالة')], rows, totals: sumCols(rows, ['net', 'vat', 'total']) };
      }
      if (name === 'vat') {
        const rows = D().expenses.filter(e => e.status === 'approved' && e.vat > 0 && inRange(e.date)).sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ date: e.date, no: e.no, vendor: e.vendor || '', vendorVat: e.vendorVat || '', invoice: e.invoiceNo || '', net: num(e.amount - e.vat), vat: e.vat, total: e.amount }));
        return { title: 'تقرير ضريبة المدخلات', subtitle: period + ' — المصروفات المعتمدة فقط', columns: [col('date', 'التاريخ', 'date'), col('no', 'الرقم'), col('vendor', 'المورد'), col('vendorVat', 'الرقم الضريبي للمورد'), col('invoice', 'رقم الفاتورة'), col('net', 'الصافي', 'money'), col('vat', 'الضريبة', 'money'), col('total', 'الإجمالي', 'money')], rows, totals: sumCols(rows, ['net', 'vat', 'total']) };
      }
      if (name === 'aging') {
        const rows = D().custodies.filter(c => c.status === 'open').map(custodyView).map(c => ({ no: c.no, employee: c.employeeName, kind: c.kindName, purpose: c.purpose, issueDate: c.issueDate, dueDate: c.dueDate || '', days: daysBetween(c.issueDate, today()), balance: c.balance, state: c.overdue ? 'متأخرة' : 'ضمن المدة' })).sort((a, b) => b.days - a.days);
        return { title: 'أعمار العهد المفتوحة', subtitle: `العهد المؤقتة تعتبر متأخرة بعد تاريخ التسوية أو بعد ${S().agingDays} يوماً`, columns: [col('no', 'رقم العهدة'), col('employee', 'الموظف'), col('kind', 'النوع'), col('purpose', 'الغرض'), col('issueDate', 'تاريخ الصرف', 'date'), col('dueDate', 'موعد التسوية', 'date'), col('days', 'عمر العهدة (يوم)', 'num'), col('balance', 'الرصيد', 'money'), col('state', 'الحالة')], rows, totals: sumCols(rows, ['balance']) };
      }
      if (name === 'assets') {
        const rows = D().assets.filter(a => !q.holderId || a.holderId === q.holderId).map(a => ({ no: a.no, name: a.name, category: a.category, serial: a.serial || '', holder: a.holderId ? userName(a.holderId) : '—', cc: ccName(a.costCenterId), status: ASSET_STATUS[a.status], ack: a.status === 'assigned' ? (a.acknowledged ? 'نعم' : 'لا') : '', value: a.value || 0 }));
        return { title: 'سجل العهد العينية', subtitle: 'حتى تاريخه', columns: [col('no', 'الرقم'), col('name', 'الأصل'), col('category', 'الفئة'), col('serial', 'الرقم التسلسلي'), col('holder', 'بعهدة'), col('cc', 'مركز التكلفة'), col('status', 'الحالة'), col('ack', 'أقر بالاستلام'), col('value', 'القيمة', 'money')], rows, totals: sumCols(rows, ['value']) };
      }
      if (name === 'settlements') {
        const rows = D().settlements.filter(s => inRange(s.date)).sort((a, b) => b.date.localeCompare(a.date)).map(s => ({ date: s.date, no: s.no, custody: (D().custodies.find(c => c.id === s.custodyId) || {}).no, employee: userName(s.employeeId), count: s.expenseIds.length, total: s.total, returned: s.returned || 0, reimbursed: s.reimbursed || 0, replenished: s.replenished || 0, closed: s.closed ? 'نعم' : 'لا' }));
        return { title: 'سجل تسويات العهد', subtitle: period, columns: [col('date', 'التاريخ', 'date'), col('no', 'رقم التسوية'), col('custody', 'العهدة'), col('employee', 'الموظف'), col('count', 'عدد المصروفات', 'num'), col('total', 'إجمالي المصروفات', 'money'), col('returned', 'رد نقدي', 'money'), col('reimbursed', 'صرف فرق', 'money'), col('replenished', 'تعويض', 'money'), col('closed', 'أغلقت العهدة')], rows, totals: sumCols(rows, ['total', 'returned', 'reimbursed', 'replenished']) };
      }
      if (name === 'sources') {
        const txs = D().tx.filter(t => t.status === 'confirmed' && inRange(t.date) && !['transfer_in', 'transfer_out'].includes(t.type));
        const rows = D().fundSources.map(src => {
          const mine = txs.filter(t => t.sourceId === src.id);
          const out = num(mine.filter(t => TX_TYPES[t.type].sign > 0).reduce((a, t) => a + t.amount, 0));
          const back = num(mine.filter(t => TX_TYPES[t.type].sign < 0).reduce((a, t) => a + t.amount, 0));
          return { name: src.name, type: SOURCE_TYPES[src.type] || '', count: mine.length, out, back, net: num(out - back) };
        });
        const unk = txs.filter(t => !t.sourceId);
        if (unk.length) { const out = num(unk.filter(t => TX_TYPES[t.type].sign > 0).reduce((a, t) => a + t.amount, 0)), back = num(unk.filter(t => TX_TYPES[t.type].sign < 0).reduce((a, t) => a + t.amount, 0)); rows.push({ name: 'غير محدد', type: '', count: unk.length, out, back, net: num(out - back) }); }
        return { title: 'مصادر أموال العهد', subtitle: period + ' — من أين صُرفت العهد وإلى أين رُدّت', columns: [col('name', 'المصدر'), col('type', 'النوع'), col('count', 'عدد الحركات', 'num'), col('out', 'صُرف للموظفين', 'money'), col('back', 'رُدّ إليه', 'money'), col('net', 'الصافي لدى الموظفين', 'money')], rows, totals: sumCols(rows, ['count', 'out', 'back', 'net']) };
      }
      if (name === 'source-ledger') {
        const rows = D().tx.filter(t => t.status === 'confirmed' && inRange(t.date) && (!q.sourceId || t.sourceId === q.sourceId) && (!q.employeeId || t.employeeId === q.employeeId) && !['transfer_in', 'transfer_out'].includes(t.type))
          .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))
          .map(t => ({ date: t.date, source: srcName(t.sourceId) || 'غير محدد', employee: userName(t.employeeId), custody: (D().custodies.find(c => c.id === t.custodyId) || {}).no, type: TX_TYPES[t.type].label, method: t.method, ref: t.ref, out: TX_TYPES[t.type].sign > 0 ? t.amount : 0, back: TX_TYPES[t.type].sign < 0 ? t.amount : 0 }));
        return { title: 'حركة أموال العهد بالتفصيل', subtitle: period + (q.sourceId ? ' — ' + srcName(q.sourceId) : ''), columns: [col('date', 'التاريخ', 'date'), col('source', 'المصدر'), col('employee', 'الموظف'), col('custody', 'العهدة'), col('type', 'الحركة'), col('method', 'الطريقة'), col('ref', 'المرجع'), col('out', 'صُرف', 'money'), col('back', 'رُدّ', 'money')], rows, totals: sumCols(rows, ['out', 'back']) };
      }
      if (name === 'checkins') {
        const from = q.from || today(), to = q.to || today();
        const list = D().checkins.filter(c => c.at.slice(0, 10) >= from && c.at.slice(0, 10) <= to);
        const rows = D().users.filter(u => u.role === 'employee' && u.active !== false).map(u => {
          const mine = list.filter(c => c.employeeId === u.id);
          const last = mine.map(c => c.at).sort().pop();
          return { name: u.name, yes: mine.filter(c => c.answer === 'yes').length, no: mine.filter(c => c.answer === 'no').length, total: mine.length, last: last ? last.slice(0, 16).replace('T', ' ') : 'لم يرد' };
        });
        return { title: 'تفاعل الموظفين مع تنبيهات المصروفات', subtitle: `من ${from} إلى ${to}`, columns: [col('name', 'الموظف'), col('yes', 'أجاب: صرفت', 'num'), col('no', 'أجاب: لم أصرف', 'num'), col('total', 'إجمالي الردود', 'num'), col('last', 'آخر رد')], rows, totals: sumCols(rows, ['yes', 'no', 'total']) };
      }
      if (name === 'monthly') {
        const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
        const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || '') ? q.to : today();
        let [y, m] = to.slice(0, 7).split('-').map(Number);
        m -= 5; while (m < 1) { m += 12; y--; }
        const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : ym(y, m) + '-01';
        const months = [];
        [y, m] = from.slice(0, 7).split('-').map(Number);
        for (;;) { const mo = ym(y, m); months.push(mo); if (mo >= to.slice(0, 7) || months.length >= 24) break; if (++m > 12) { m = 1; y++; } }
        const exps = D().expenses.filter(e => e.status !== 'rejected' && e.date >= from && e.date <= to);
        const rows = D().categories.map(c => {
          const r = { code: c.code, name: c.name };
          let t = 0;
          for (const mo of months) { const v = num(exps.filter(e => e.categoryId === c.id && e.date.slice(0, 7) === mo).reduce((s, e) => s + e.amount, 0)); r['m' + mo] = v; t += v; }
          r.total = num(t);
          return r;
        }).filter(r => r.total);
        return { title: 'المصروفات الشهرية حسب البنود', subtitle: `من ${from} إلى ${to}`, columns: [col('code', 'رقم الحساب'), col('name', 'البند'), ...months.map(mo => col('m' + mo, mo, 'money')), col('total', 'الإجمالي', 'money')], rows, totals: sumCols(rows, [...months.map(mo => 'm' + mo), 'total']) };
      }
      if (name === 'employee-activity') {
        const exps = D().expenses.filter(e => inRange(e.date));
        const rows = D().users.filter(u => exps.some(e => e.employeeId === u.id)).map(u => {
          const xs = exps.filter(e => e.employeeId === u.id);
          const by = st => num(xs.filter(e => e.status === st).reduce((a, e) => a + e.amount, 0));
          const valid = xs.filter(e => e.status !== 'rejected');
          const spent = num(valid.reduce((a, e) => a + e.amount, 0));
          return { name: u.name, count: xs.length, spent, approved: by('approved'), pending: by('pending'), rejected: by('rejected'), avg: valid.length ? num(spent / valid.length) : 0, receipts: Math.round(xs.filter(e => e.attachments.length).length / xs.length * 100) + '%', last: xs.map(e => e.date).sort().pop() };
        }).sort((a, b) => b.spent - a.spent);
        return { title: 'نشاط الموظفين في المصروفات', subtitle: period, columns: [col('name', 'الموظف'), col('count', 'عدد المصروفات', 'num'), col('spent', 'المصروف', 'money'), col('approved', 'المعتمد', 'money'), col('pending', 'بانتظار الاعتماد', 'money'), col('rejected', 'المرفوض', 'money'), col('avg', 'متوسط المصروف', 'money'), col('receipts', 'نسبة الفواتير المرفقة'), col('last', 'آخر مصروف', 'date')], rows, totals: sumCols(rows, ['count', 'spent', 'approved', 'pending', 'rejected']) };
      }
      fail(404, 'التقرير غير موجود');
    }
    const sumCols = (rows, keys) => Object.fromEntries(keys.map(k => [k, num(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0))]));

    // ---------- المسارات ----------
    const routes = [];
    const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

    on('GET', '/api/bootstrap', ({ user }) => ({
      user: publicUser(user), settings: S(), roles: ROLES, kinds: KINDS, txTypes: TX_TYPES, assetStatus: ASSET_STATUS, assetMoves: ASSET_MOVES, ccTypes: CC_TYPES, assetCategories: ASSET_CATEGORIES, expenseStatus: EXPENSE_STATUS,
      costCenters: ccTree(), categories: D().categories, fundSources: D().fundSources, sourceTypes: SOURCE_TYPES,
      users: isStaff(user) ? D().users.map(publicUser) : [publicUser(user)],
      unread: D().notifications.filter(n => n.userId === user.id && !n.read).length,
    }));

    on('GET', '/api/dashboard', ({ user }) => {
      staffOnly(user);
      const open = D().custodies.filter(c => c.status === 'open').map(custodyView);
      const exps = D().expenses.filter(e => e.status !== 'rejected');
      const month = today().slice(0, 7);
      const monthSpent = num(exps.filter(e => e.date.slice(0, 7) === month).reduce((s, e) => s + e.amount, 0));
      const employees = D().users.filter(u => u.active !== false && (u.role === 'employee' || D().custodies.some(c => c.employeeId === u.id))).map(u => ({ ...publicUser(u), ...employeeTotals(u.id), lastCheckin: (D().checkins.filter(c => c.employeeId === u.id).map(c => c.at).sort().pop()) || null }));
      const ccRows = reportData('cost-centers', {}, user).rows.filter(r => r._depth === 0);
      const overBudget = ccTree().filter(c => c.budget).map(c => ({ name: c.name, budget: c.budget, spent: num([...ccDescendants(c.id)].reduce((s, id) => s + exps.filter(e => e.costCenterId === id).reduce((a, e) => a + e.amount, 0), 0)) })).filter(c => c.spent >= c.budget * 0.9);
      const pendingExpenses = D().expenses.filter(e => e.status === 'pending');
      return {
        kpis: {
          openCount: open.length, outstanding: num(open.reduce((s, c) => s + c.balance, 0)), issued: num(open.reduce((s, c) => s + c.received, 0)),
          monthSpent, pendingCount: pendingExpenses.length, pendingAmount: num(pendingExpenses.reduce((s, e) => s + e.amount, 0)),
          assetsAssigned: D().assets.filter(a => a.status === 'assigned').length, assetsValue: num(D().assets.filter(a => a.status === 'assigned').reduce((s, a) => s + (a.value || 0), 0)),
        },
        alerts: {
          overdue: open.filter(c => c.overdue).map(c => ({ id: c.id, no: c.no, employeeName: c.employeeName, balance: c.balance, dueDate: c.dueDate })),
          negative: open.filter(c => c.balance < 0).map(c => ({ id: c.id, no: c.no, employeeName: c.employeeName, balance: c.balance })),
          low: open.filter(c => c.balance >= 0 && c.balance <= S().lowBalance).map(c => ({ id: c.id, no: c.no, employeeName: c.employeeName, balance: c.balance })),
          overBudget,
          requests: D().requests.filter(r => r.status === 'pending').length,
          pendingTx: D().tx.filter(t => t.status === 'pending').length,
          unacknowledged: D().assets.filter(a => a.status === 'assigned' && !a.acknowledged).length,
        },
        employees, costCenters: ccRows,
        recent: D().expenses.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map(expenseView),
        setup: { costCenters: D().costCenters.length, employees: D().users.filter(u => u.role === 'employee').length, custodies: D().custodies.length },
      };
    });

    on('GET', '/api/analytics', ({ user, q }) => {
      staffOnly(user);
      const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
      const from = isDate(q.from) ? q.from : '', to = isDate(q.to) ? q.to : '';
      const inRange = d => (!from || d >= from) && (!to || d <= to);
      const all = D().expenses.filter(e => e.status !== 'rejected');
      const end = to || today();
      let [y, m] = end.slice(0, 7).split('-').map(Number);
      const months = [];
      for (let i = 0; i < 12; i++) { months.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m < 1) { m = 12; y--; } }
      const monthly = months.map(mo => { const xs = all.filter(e => e.date.slice(0, 7) === mo); return { month: mo, spent: num(xs.reduce((s, e) => s + e.amount, 0)), count: xs.length }; });
      const exps = all.filter(e => inRange(e.date));
      const group = (keyOf, nameOf) => {
        const out = [];
        for (const e of exps) { const k = keyOf(e) || ''; let r = out.find(x => x.key === k); if (!r) out.push(r = { key: k, total: 0, count: 0 }); r.total = num(r.total + e.amount); r.count++; }
        return out.sort((a, b) => b.total - a.total).map(r => ({ name: nameOf(r.key), total: r.total, count: r.count }));
      };
      const range = { from, to };
      const status = {};
      for (const st of ['approved', 'pending', 'rejected']) status[st] = num(D().expenses.filter(e => e.status === st && inRange(e.date)).reduce((s, e) => s + e.amount, 0));
      const spent = num(exps.reduce((s, e) => s + e.amount, 0));
      const issued = num(D().tx.filter(t => t.status === 'confirmed' && inRange(t.date) && ['issue', 'topup', 'reimburse'].includes(t.type)).reduce((s, t) => s + t.amount, 0));
      return {
        from, to, monthly,
        totals: { spent, count: exps.length, avg: exps.length ? num(spent / exps.length) : 0, vat: num(exps.reduce((s, e) => s + (e.vat || 0), 0)), issued, outstanding: num(D().custodies.filter(c => c.status === 'open').reduce((s, c) => s + custodyBalance(c).balance, 0)) },
        status,
        byCategory: group(e => e.categoryId, catName),
        byEmployee: group(e => e.employeeId, userName),
        byCostCenter: reportData('cost-centers', range, user).rows.filter(r => r._depth === 0 && r.spent).map(r => ({ name: r.name.trim(), total: r.spent, budget: r.budget })).sort((a, b) => b.total - a.total),
        bySource: reportData('sources', range, user).rows.filter(r => r.count).map(r => ({ name: r.name, out: r.out, back: r.back, net: r.net })),
      };
    });

    on('GET', '/api/home', ({ user }) => ({
      totals: employeeTotals(user.id),
      custodies: D().custodies.filter(c => c.employeeId === user.id && c.status === 'open').map(custodyView),
      recent: filterExpenses({}, user).slice(0, 10),
      assets: D().assets.filter(a => a.holderId === user.id && a.status === 'assigned'),
      requests: D().requests.filter(r => r.employeeId === user.id).slice(-5).reverse(),
    }));

    // ----- العهد النقدية -----
    on('GET', '/api/custodies', ({ user, q }) => {
      let list = D().custodies;
      if (!isStaff(user)) list = list.filter(c => c.employeeId === user.id);
      else if (q.employeeId) list = list.filter(c => c.employeeId === q.employeeId);
      if (q.status) list = list.filter(c => c.status === q.status);
      if (q.kind) list = list.filter(c => c.kind === q.kind);
      let out = list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(custodyView);
      if (q.q) { const s = q.q.toLowerCase(); out = out.filter(c => [c.no, c.purpose, c.employeeName].some(v => String(v).toLowerCase().includes(s))); }
      if (q.flag === 'overdue') out = out.filter(c => c.overdue);
      return out;
    });
    on('GET', '/api/custodies/:id', ({ user, p }) => {
      const c = find('custodies', p.id, 'العهدة');
      canAccessCustody(user, c);
      return {
        custody: custodyView(c),
        tx: D().tx.filter(t => t.custodyId === c.id).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)).map(t => ({ ...t, typeName: TX_TYPES[t.type].label, sign: TX_TYPES[t.type].sign, createdByName: userName(t.createdBy), sourceName: srcName(t.sourceId) })),
        expenses: filterExpenses({ custodyId: c.id }, isStaff(user) ? user : { ...user, role: 'employee' }),
        settlements: D().settlements.filter(s => s.custodyId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    });
    on('POST', '/api/custodies', ({ user, b }) => { staffOnly(user); return custodyView(createCustody(user, b)); });
    on('PUT', '/api/custodies/:id', ({ user, p, b }) => {
      staffOnly(user);
      const c = find('custodies', p.id, 'العهدة');
      if (b.purpose !== undefined) c.purpose = text(b.purpose, 'الغرض');
      if (b.costCenterId !== undefined) c.costCenterId = b.costCenterId || null;
      if (b.dueDate !== undefined) c.dueDate = b.dueDate || null;
      if (b.notes !== undefined) c.notes = opt(b.notes);
      log(user, 'تعديل عهدة', c.no, 'custody', c.id);
      return custodyView(c);
    });
    on('POST', '/api/custodies/:id/tx', ({ user, p, b }) => {
      const c = find('custodies', p.id, 'العهدة');
      canAccessCustody(user, c);
      if (c.status !== 'open') fail(400, 'العهدة مغلقة');
      const amount = money(b.amount);
      const staff = isStaff(user);
      if (!staff && b.type !== 'return') fail(403, 'يمكنك فقط تسجيل رد مبلغ نقدي');
      if (b.type === 'topup') {
        addTx(user, c, 'topup', amount, { ...b, sourceId: sourceOf(b.sourceId) });
        notify(c.employeeId, `تم تعزيز عهدتك ${c.no} بمبلغ ${amount}`, '#/custody/' + c.id);
        log(user, 'تعزيز عهدة', `${c.no} بمبلغ ${amount}`, 'custody', c.id);
      } else if (b.type === 'return') {
        const t = addTx(user, c, 'return', amount, { ...b, status: staff ? 'confirmed' : 'pending', sourceId: staff ? sourceOf(b.sourceId) : null });
        if (!staff) notify(staffIds(), `${user.name} سجل رد مبلغ ${amount} من العهدة ${c.no} — بانتظار تأكيد الاستلام`, '#/custody/' + c.id);
        log(user, 'رد نقدي', `${c.no} بمبلغ ${amount}${staff ? '' : ' (بانتظار التأكيد)'}`, 'tx', t.id);
      } else if (b.type === 'reimburse') {
        addTx(user, c, 'reimburse', amount, { ...b, sourceId: sourceOf(b.sourceId) });
        notify(c.employeeId, `تم صرف فرق بمبلغ ${amount} على العهدة ${c.no}`, '#/custody/' + c.id);
        log(user, 'صرف فرق', `${c.no} بمبلغ ${amount}`, 'custody', c.id);
      } else if (b.type === 'transfer') {
        const to = D().users.find(u => u.id === b.toEmployeeId && u.active !== false) || fail(400, 'اختر الموظف المحوَّل إليه');
        if (to.id === c.employeeId) fail(400, 'لا يمكن التحويل لنفس الموظف');
        if (amount > custodyBalance(c).balance) fail(400, 'المبلغ أكبر من رصيد العهدة');
        let target = b.toCustodyId ? find('custodies', b.toCustodyId, 'العهدة المستلمة') : null;
        if (!target) target = createCustodyShell(user, to, c, amount, b);
        else if (target.employeeId !== to.id || target.status !== 'open') fail(400, 'العهدة المستلمة غير صالحة');
        const out = addTx(user, c, 'transfer_out', amount, { ...b, note: `تحويل إلى ${to.name} (${target.no})${b.note ? ' — ' + b.note : ''}` });
        const inn = addTx(user, target, 'transfer_in', amount, { ...b, note: `تحويل من ${userName(c.employeeId)} (${c.no})`, relatedId: out.id });
        out.relatedId = inn.id;
        notify([c.employeeId, to.id], `تحويل ${amount} من العهدة ${c.no} إلى ${to.name} (${target.no})`, '#/custody/' + target.id);
        log(user, 'تحويل عهدة', `${amount} من ${c.no} إلى ${target.no}`, 'custody', c.id);
      } else fail(400, 'نوع حركة غير صالح');
      return custodyView(c);
    });
    function createCustodyShell(user, to, from, amount, b) {
      const t = { id: env.uid(), no: nextNo('CU'), employeeId: to.id, kind: from.kind, purpose: `محولة من عهدة ${from.no} — ${from.purpose}`, costCenterId: from.costCenterId, issueDate: dateOr(b.date), dueDate: from.dueDate, status: 'open', createdBy: user.id, createdAt: env.now(), closedAt: null, notes: '' };
      D().custodies.push(t);
      return t;
    }
    on('POST', '/api/tx/:id/decide', ({ user, p, b }) => {
      staffOnly(user);
      const t = find('tx', p.id, 'الحركة');
      if (t.status !== 'pending') fail(400, 'تمت معالجة الحركة مسبقاً');
      if (b.approve) t.sourceId = sourceOf(b.sourceId);
      t.status = b.approve ? 'confirmed' : 'rejected';
      const c = find('custodies', t.custodyId);
      notify(t.employeeId, `${b.approve ? 'تم تأكيد' : 'تم رفض'} استلام المبلغ المردود ${t.amount} من العهدة ${c.no}`, '#/custody/' + c.id);
      log(user, b.approve ? 'تأكيد رد نقدي' : 'رفض رد نقدي', `${c.no} بمبلغ ${t.amount}`, 'tx', t.id);
      return { ok: true };
    });

    // التسوية: اعتماد المصروفات المعلقة وإقفالها في سند تسوية، مع إغلاق العهدة أو تعويضها
    on('POST', '/api/custodies/:id/settle', ({ user, p, b }) => {
      staffOnly(user);
      const c = find('custodies', p.id, 'العهدة');
      if (c.status !== 'open') fail(400, 'العهدة مغلقة');
      const bal0 = custodyBalance(c);
      if (bal0.pendingCount && b.close) fail(400, `يوجد ${bal0.pendingCount} مصروف بانتظار الاعتماد — اعتمدها أو ارفضها قبل إغلاق العهدة`);
      if (bal0.pendingTx && b.close) fail(400, 'يوجد رد نقدي بانتظار التأكيد');
      const exps = D().expenses.filter(e => e.custodyId === c.id && e.status === 'approved' && !e.settlementId);
      const settleSource = b.sourceId ? sourceOf(b.sourceId) : null;
      const total = num(exps.reduce((s, e) => s + e.amount, 0));
      if (!exps.length && !b.close) fail(400, 'لا توجد مصروفات معتمدة غير مسواة');
      // التحقق من المصدر قبل أي تعديل على البيانات
      if (b.close && !settleSource && custodyBalance(c).balance !== 0) sourceOf(null);
      if (!b.close && b.replenish && !settleSource) sourceOf(null);
      const s = { id: env.uid(), no: nextNo('ST'), custodyId: c.id, employeeId: c.employeeId, date: dateOr(b.date), expenseIds: exps.map(e => e.id), total, returned: 0, reimbursed: 0, replenished: 0, closed: !!b.close, note: opt(b.note), createdBy: user.id, createdAt: env.now() };
      exps.forEach(e => { e.settlementId = s.id; });
      if (b.close) {
        const bal = custodyBalance(c).balance;
        if (bal > 0) { addTx(user, c, 'return', bal, { date: s.date, method: b.method, note: `رد المتبقي عند التسوية ${s.no}`, sourceId: settleSource }); s.returned = bal; }
        if (bal < 0) { addTx(user, c, 'reimburse', -bal, { date: s.date, method: b.method, note: `صرف الفرق للموظف عند التسوية ${s.no}`, sourceId: settleSource }); s.reimbursed = num(-bal); }
        c.status = 'closed'; c.closedAt = env.now();
      } else if (b.replenish && total > 0) {
        addTx(user, c, 'topup', total, { date: s.date, method: b.method, note: `تعويض العهدة المستديمة — تسوية ${s.no}`, sourceId: settleSource });
        s.replenished = total;
      }
      D().settlements.push(s);
      notify(c.employeeId, `تمت تسوية العهدة ${c.no} (${s.no}) بإجمالي مصروفات ${total}${s.closed ? ' وإغلاقها' : ''}${s.replenished ? ' وتعويضها' : ''}`, '#/custody/' + c.id);
      log(user, 'تسوية عهدة', `${s.no} على ${c.no} بإجمالي ${total}${s.closed ? ' — إغلاق' : ''}`, 'settlement', s.id);
      return { settlement: s, custody: custodyView(c) };
    });
    on('GET', '/api/settlements/:id', ({ user, p }) => {
      const s = find('settlements', p.id, 'التسوية');
      const c = find('custodies', s.custodyId);
      canAccessCustody(user, c);
      return { settlement: s, custody: custodyView(c), expenses: D().expenses.filter(e => s.expenseIds.includes(e.id)).map(expenseView) };
    });
    on('POST', '/api/custodies/:id/reopen', ({ user, p }) => {
      adminOnly(user);
      const c = find('custodies', p.id, 'العهدة');
      c.status = 'open'; c.closedAt = null;
      log(user, 'إعادة فتح عهدة', c.no, 'custody', c.id);
      return custodyView(c);
    });

    // ----- المصروفات -----
    on('GET', '/api/expenses', ({ user, q }) => filterExpenses(q, user));
    on('GET', '/api/expenses/:id', ({ user, p }) => {
      const e = find('expenses', p.id, 'المصروف');
      if (!isStaff(user) && e.employeeId !== user.id) fail(403, 'غير مسموح');
      return expenseView(e);
    });
    on('POST', '/api/expenses', async ({ user, b }) => {
      const staff = isStaff(user);
      const c = find('custodies', b.custodyId, 'العهدة');
      if (!staff && c.employeeId !== user.id) fail(403, 'هذه العهدة ليست باسمك');
      if (c.status !== 'open') fail(400, 'العهدة مغلقة — لا يمكن إضافة مصروفات عليها');
      const cat = D().categories.find(x => x.id === b.categoryId && x.active !== false) || fail(400, 'اختر بند المصروف');
      const ccId = b.costCenterId || c.costCenterId;
      if (!ccId) fail(400, 'اختر مركز التكلفة الذي يتبعه المصروف');
      const cc = find('costCenters', ccId, 'مركز التكلفة');
      if (cc.active === false) fail(400, 'مركز التكلفة مغلق');
      const amount = money(b.amount);
      const attachments = await saveAttachments(b.attachments);
      if (S().receiptRequiredAbove && amount > S().receiptRequiredAbove && !attachments.length) fail(400, `يجب إرفاق صورة الفاتورة للمصروفات التي تزيد عن ${S().receiptRequiredAbove}`);
      const vatIncluded = !!b.vatIncluded && cat.vatApplicable !== false;
      const e = {
        id: env.uid(), no: nextNo('EX'), custodyId: c.id, employeeId: c.employeeId, costCenterId: cc.id, categoryId: cat.id,
        date: dateOr(b.date), time: /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : env.now().slice(11, 16),
        description: text(b.description, 'البيان'), vendor: opt(b.vendor), vendorVat: opt(b.vendorVat), invoiceNo: opt(b.invoiceNo),
        amount, vatIncluded, vat: computeVat(amount, vatIncluded), attachments, paymentMethod: opt(b.paymentMethod) || 'نقداً',
        status: staff && b.autoApprove !== false ? 'approved' : 'pending', reviewNote: '', reviewedBy: staff ? user.id : null,
        viaReminder: !!b.viaReminder, settlementId: null, createdBy: user.id, createdAt: env.now(),
      };
      D().expenses.push(e);
      if (b.viaReminder) D().checkins.push({ id: env.uid(), employeeId: user.id, at: env.now(), answer: 'yes', expenseId: e.id });
      if (!staff) notify(staffIds(), `${user.name} سجل مصروف ${e.no} بمبلغ ${amount} — ${e.description}`, '#/expense/' + e.id);
      log(user, 'تسجيل مصروف', `${e.no} بمبلغ ${amount} على ${c.no}`, 'expense', e.id);
      return expenseView(e);
    });
    on('PUT', '/api/expenses/:id', async ({ user, p, b }) => {
      const e = find('expenses', p.id, 'المصروف');
      const staff = isStaff(user);
      if (e.settlementId) fail(400, 'المصروف داخل تسوية — لا يمكن تعديله');
      if (!staff && (e.employeeId !== user.id || e.status === 'approved')) fail(403, 'لا يمكن تعديل مصروف معتمد');
      if (b.categoryId) e.categoryId = (D().categories.find(x => x.id === b.categoryId) || fail(400, 'بند غير صالح')).id;
      if (b.costCenterId) e.costCenterId = find('costCenters', b.costCenterId, 'مركز التكلفة').id;
      if (b.amount !== undefined) e.amount = money(b.amount);
      for (const k of ['description', 'vendor', 'vendorVat', 'invoiceNo', 'paymentMethod']) if (b[k] !== undefined) e[k] = opt(b[k]);
      if (!e.description) fail(400, 'حقل «البيان» مطلوب');
      if (b.date) e.date = dateOr(b.date);
      if (b.vatIncluded !== undefined) e.vatIncluded = !!b.vatIncluded;
      e.vat = computeVat(e.amount, e.vatIncluded);
      if (Array.isArray(b.attachments)) e.attachments = await saveAttachments(b.attachments);
      if (!staff && e.status === 'rejected') { e.status = 'pending'; notify(staffIds(), `${user.name} عدّل المصروف المرفوض ${e.no} وأعاد إرساله`, '#/expense/' + e.id); }
      log(user, 'تعديل مصروف', e.no, 'expense', e.id);
      return expenseView(e);
    });
    on('POST', '/api/expenses/review', ({ user, b }) => {
      staffOnly(user);
      const status = b.status === 'approved' ? 'approved' : b.status === 'rejected' ? 'rejected' : b.status === 'pending' ? 'pending' : fail(400, 'حالة غير صالحة');
      const ids = [].concat(b.ids || []);
      let n = 0;
      for (const id of ids) {
        const e = D().expenses.find(x => x.id === id);
        if (!e || e.settlementId) continue;
        e.status = status; e.reviewedBy = user.id; e.reviewedAt = env.now();
        if (b.note !== undefined) e.reviewNote = opt(b.note);
        notify(e.employeeId, `${status === 'approved' ? '✅ تم اعتماد' : status === 'rejected' ? '❌ تم رفض' : 'أعيد للمراجعة'} المصروف ${e.no} (${e.amount})${e.reviewNote ? ' — ' + e.reviewNote : ''}`, '#/expense/' + e.id);
        n++;
      }
      log(user, status === 'approved' ? 'اعتماد مصروفات' : 'رفض مصروفات', `${n} مصروف`, 'expense', ids[0]);
      return { updated: n };
    });
    on('DELETE', '/api/expenses/:id', ({ user, p }) => {
      const e = find('expenses', p.id, 'المصروف');
      if (e.settlementId) fail(400, 'المصروف داخل تسوية — لا يمكن حذفه');
      if (!isStaff(user) && (e.employeeId !== user.id || e.status === 'approved')) fail(403, 'لا يمكن حذف هذا المصروف');
      D().expenses = D().expenses.filter(x => x.id !== e.id);
      log(user, 'حذف مصروف', `${e.no} بمبلغ ${e.amount}`, 'expense', e.id);
      return { ok: true };
    });

    // ----- طلبات العهد -----
    on('GET', '/api/requests', ({ user, q }) => {
      let list = D().requests;
      if (!isStaff(user)) list = list.filter(r => r.employeeId === user.id);
      if (q.status) list = list.filter(r => r.status === q.status);
      return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({ ...r, employeeName: userName(r.employeeId), costCenterName: ccName(r.costCenterId) }));
    });
    on('POST', '/api/requests', ({ user, b }) => {
      const type = b.type === 'asset' ? 'asset' : 'cash';
      // تعميد مباشر: الموظف استلم العهدة فعلاً (من المالك غالباً) ويسجلها بنفسه بدل أن يطلبها
      const direct = !!b.alreadyPaid && type === 'cash';
      if (direct && !isStaff(user) && !user.directCustody) fail(403, 'غير مسموح لك بتسجيل عهدة مصروفة مباشرة — اطلبها من الإدارة');
      const src = direct ? sourceOf(b.sourceId) : null;
      if (direct && b.costCenterId) find('costCenters', b.costCenterId, 'مركز التكلفة');
      const r = {
        id: env.uid(), no: nextNo('RQ'), type, employeeId: user.id, amount: type === 'cash' ? money(b.amount) : 0, kind: KINDS[b.kind] ? b.kind : 'temporary',
        purpose: text(b.purpose, 'الغرض'), costCenterId: b.costCenterId || null, neededBy: b.neededBy || null, status: 'pending', decisionNote: '', createdAt: env.now(),
      };
      if (direct) {
        const c = createCustody(user, { employeeId: user.id, kind: r.kind, amount: r.amount, purpose: r.purpose, costCenterId: r.costCenterId, issueDate: b.issueDate, dueDate: r.neededBy, sourceId: b.sourceId, method: b.method, ref: b.ref, notes: b.notes, direct: true, force: true });
        Object.assign(r, { status: 'approved', direct: true, custodyId: c.id, decisionNote: 'تعميد مباشر', decidedAt: env.now() });
        D().requests.push(r);
        notify(staffIds(), `${user.name} سجل استلام عهدة بتعميد مباشر ${c.no} بمبلغ ${r.amount} من ${srcName(src) || 'غير محدد'} — ${r.purpose}`, '#/custody/' + c.id);
        log(user, 'عهدة بتعميد مباشر', `${r.no} / ${c.no} بمبلغ ${r.amount}`, 'request', r.id);
        return r;
      }
      D().requests.push(r);
      notify(staffIds(), `${user.name} طلب ${type === 'cash' ? 'عهدة نقدية بمبلغ ' + r.amount : 'عهدة عينية'} — ${r.purpose}`, '#/requests');
      log(user, 'طلب عهدة', `${r.no} ${r.purpose}`, 'request', r.id);
      return r;
    });
    on('POST', '/api/requests/:id/decide', ({ user, p, b }) => {
      staffOnly(user);
      const r = find('requests', p.id, 'الطلب');
      if (r.status !== 'pending') fail(400, 'تمت معالجة الطلب مسبقاً');
      r.decisionNote = opt(b.note); r.decidedBy = user.id; r.decidedAt = env.now();
      if (!b.approve) {
        r.status = 'rejected';
        notify(r.employeeId, `تم رفض طلبك ${r.no}${r.decisionNote ? ' — ' + r.decisionNote : ''}`, '#/requests');
      } else {
        r.status = 'approved';
        if (r.type === 'cash') {
          const c = createCustody(user, { employeeId: r.employeeId, kind: r.kind, amount: b.amount || r.amount, purpose: r.purpose, costCenterId: b.costCenterId || r.costCenterId, method: b.method, dueDate: b.dueDate || r.neededBy, sourceId: b.sourceId, force: true });
          r.custodyId = c.id;
        } else notify(r.employeeId, `تمت الموافقة على طلبك ${r.no} — سيتم تسليمك العهدة العينية`, '#/requests');
      }
      log(user, r.status === 'approved' ? 'موافقة على طلب' : 'رفض طلب', r.no, 'request', r.id);
      return r;
    });

    // ----- العهد العينية -----
    const assetView = a => ({ ...a, statusName: ASSET_STATUS[a.status], holderName: a.holderId ? userName(a.holderId) : '', costCenterName: ccName(a.costCenterId) });
    on('GET', '/api/assets', ({ user, q }) => {
      let list = D().assets;
      if (!isStaff(user)) list = list.filter(a => a.holderId === user.id);
      else if (q.holderId) list = list.filter(a => a.holderId === q.holderId);
      if (q.status) list = list.filter(a => a.status === q.status);
      let out = list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(assetView);
      if (q.q) { const s = q.q.toLowerCase(); out = out.filter(a => [a.no, a.name, a.serial, a.holderName, a.category].some(v => String(v || '').toLowerCase().includes(s))); }
      return out;
    });
    on('GET', '/api/assets/:id', ({ user, p }) => {
      const a = find('assets', p.id, 'الأصل');
      if (!isStaff(user) && a.holderId !== user.id) fail(403, 'غير مسموح');
      return { asset: assetView(a), moves: D().assetMoves.filter(m => m.assetId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map(m => ({ ...m, typeName: ASSET_MOVES[m.type], fromName: m.fromId ? userName(m.fromId) : '', toName: m.toId ? userName(m.toId) : '', byName: userName(m.createdBy) })) };
    });
    on('POST', '/api/assets', async ({ user, b }) => {
      staffOnly(user);
      const a = {
        id: env.uid(), no: nextNo('AS'), name: text(b.name, 'اسم الأصل'), category: opt(b.category) || 'أخرى', serial: opt(b.serial), model: opt(b.model),
        value: num(b.value), purchaseDate: b.purchaseDate || null, costCenterId: b.costCenterId || null, condition: opt(b.condition) || 'جديد',
        status: 'available', holderId: null, acknowledged: false, photos: await saveAttachments(b.photos), notes: opt(b.notes), createdAt: env.now(),
      };
      D().assets.push(a);
      log(user, 'إضافة أصل', `${a.no} ${a.name}`, 'asset', a.id);
      if (b.assignTo) moveAsset(user, a, { type: 'assign', toId: b.assignTo, condition: a.condition });
      return assetView(a);
    });
    on('PUT', '/api/assets/:id', async ({ user, p, b }) => {
      staffOnly(user);
      const a = find('assets', p.id, 'الأصل');
      for (const k of ['name', 'category', 'serial', 'model', 'condition', 'notes']) if (b[k] !== undefined) a[k] = opt(b[k]);
      if (!a.name) fail(400, 'اسم الأصل مطلوب');
      if (b.value !== undefined) a.value = num(b.value);
      if (b.purchaseDate !== undefined) a.purchaseDate = b.purchaseDate || null;
      if (b.costCenterId !== undefined) a.costCenterId = b.costCenterId || null;
      if (Array.isArray(b.photos)) a.photos = await saveAttachments(b.photos);
      log(user, 'تعديل أصل', a.no, 'asset', a.id);
      return assetView(a);
    });
    function moveAsset(user, a, b) {
      const type = ASSET_MOVES[b.type] ? b.type : fail(400, 'نوع حركة غير صالح');
      const fromId = a.holderId;
      let toId = null;
      if (type === 'assign' || type === 'transfer') {
        const to = D().users.find(u => u.id === b.toId && u.active !== false) || fail(400, 'اختر الموظف المستلم');
        if (type === 'assign' && a.status === 'assigned') fail(400, 'الأصل مسلَّم بالفعل — استخدم النقل');
        if (type === 'transfer' && a.status !== 'assigned') fail(400, 'الأصل غير مسلَّم لأحد');
        toId = to.id; a.holderId = to.id; a.status = 'assigned'; a.acknowledged = false;
        notify(to.id, `تم تسليمك عهدة عينية: ${a.name} (${a.no}) — يرجى الإقرار بالاستلام`, '#/asset/' + a.id);
      } else {
        a.holderId = null;
        a.status = { return: 'available', available: 'available', maintenance: 'maintenance', lost: 'lost', retire: 'retired' }[type];
        a.acknowledged = false;
        if (fromId) notify(fromId, `${ASSET_MOVES[type]}: ${a.name} (${a.no}) — أُخلي طرفك منها`, '#/asset/' + a.id);
      }
      if (b.condition) a.condition = opt(b.condition);
      const m = { id: env.uid(), assetId: a.id, type, fromId, toId, date: dateOr(b.date), condition: opt(b.condition) || a.condition, note: opt(b.note), createdBy: user.id, createdAt: env.now() };
      D().assetMoves.push(m);
      log(user, ASSET_MOVES[type], `${a.no} ${a.name}${toId ? ' ← ' + userName(toId) : ''}`, 'asset', a.id);
      return m;
    }
    on('POST', '/api/assets/:id/move', ({ user, p, b }) => { staffOnly(user); const a = find('assets', p.id, 'الأصل'); moveAsset(user, a, b); return assetView(a); });
    on('POST', '/api/assets/:id/ack', ({ user, p }) => {
      const a = find('assets', p.id, 'الأصل');
      if (a.holderId !== user.id) fail(403, 'هذا الأصل ليس بعهدتك');
      a.acknowledged = true; a.acknowledgedAt = env.now();
      notify(staffIds(), `${user.name} أقر باستلام ${a.name} (${a.no})`, '#/asset/' + a.id);
      log(user, 'إقرار استلام أصل', a.no, 'asset', a.id);
      return assetView(a);
    });

    // ----- مراكز التكلفة والبنود -----
    on('POST', '/api/cost-centers', ({ user, b }) => {
      staffOnly(user);
      if (b.parentId) find('costCenters', b.parentId, 'المركز الرئيسي');
      const c = { id: env.uid(), code: opt(b.code), name: text(b.name, 'اسم مركز التكلفة'), type: CC_TYPES[b.type] ? b.type : 'project', parentId: b.parentId || null, budget: num(b.budget), managerId: b.managerId || null, active: true, notes: opt(b.notes), createdAt: env.now() };
      if (c.code && D().costCenters.some(x => x.code === c.code)) fail(400, 'رمز مركز التكلفة مستخدم مسبقاً');
      D().costCenters.push(c);
      log(user, 'إضافة مركز تكلفة', `${c.code} ${c.name}`, 'costCenter', c.id);
      return c;
    });
    on('PUT', '/api/cost-centers/:id', ({ user, p, b }) => {
      staffOnly(user);
      const c = find('costCenters', p.id, 'مركز التكلفة');
      if (b.name !== undefined) c.name = text(b.name, 'الاسم');
      if (b.code !== undefined) { if (b.code && D().costCenters.some(x => x.code === b.code && x.id !== c.id)) fail(400, 'الرمز مستخدم'); c.code = opt(b.code); }
      if (b.type && CC_TYPES[b.type]) c.type = b.type;
      if (b.parentId !== undefined) { if (b.parentId && ccDescendants(c.id).has(b.parentId)) fail(400, 'لا يمكن جعل المركز تابعاً لأحد فروعه'); c.parentId = b.parentId || null; }
      if (b.budget !== undefined) c.budget = num(b.budget);
      if (b.managerId !== undefined) c.managerId = b.managerId || null;
      if (b.active !== undefined) c.active = !!b.active;
      if (b.notes !== undefined) c.notes = opt(b.notes);
      log(user, 'تعديل مركز تكلفة', c.name, 'costCenter', c.id);
      return c;
    });
    on('GET', '/api/cost-centers/:id', ({ user, p, q }) => {
      staffOnly(user);
      const c = find('costCenters', p.id, 'مركز التكلفة');
      const ids = ccDescendants(c.id);
      const exps = filterExpenses({ costCenterId: c.id, from: q.from, to: q.to }, user);
      const valid = exps.filter(e => e.status !== 'rejected');
      const byCat = {};
      for (const e of valid) byCat[e.categoryName] = num((byCat[e.categoryName] || 0) + e.amount);
      const byEmp = {};
      for (const e of valid) byEmp[e.employeeName] = num((byEmp[e.employeeName] || 0) + e.amount);
      return {
        costCenter: { ...c, parentName: c.parentId ? ccName(c.parentId) : '', managerName: c.managerId ? userName(c.managerId) : '' },
        children: ccTree().filter(x => x.parentId === c.id), spent: num(valid.reduce((s, e) => s + e.amount, 0)),
        byCategory: Object.entries(byCat).sort((a, b) => b[1] - a[1]), byEmployee: Object.entries(byEmp).sort((a, b) => b[1] - a[1]),
        expenses: exps.slice(0, 100), custodies: D().custodies.filter(x => ids.has(x.costCenterId) && x.status === 'open').map(custodyView),
        assets: D().assets.filter(a => ids.has(a.costCenterId)).map(assetView),
      };
    });
    on('POST', '/api/sources', ({ user, b }) => {
      staffOnly(user);
      const x = { id: env.uid(), name: text(b.name, 'اسم المصدر'), type: SOURCE_TYPES[b.type] ? b.type : 'other', accountNo: opt(b.accountNo), active: true, notes: opt(b.notes) };
      D().fundSources.push(x);
      log(user, 'إضافة مصدر أموال', x.name, 'source', x.id);
      return x;
    });
    on('PUT', '/api/sources/:id', ({ user, p, b }) => {
      staffOnly(user);
      const x = find('fundSources', p.id, 'المصدر');
      if (b.name !== undefined) x.name = text(b.name, 'اسم المصدر');
      if (b.type && SOURCE_TYPES[b.type]) x.type = b.type;
      for (const k of ['accountNo', 'notes']) if (b[k] !== undefined) x[k] = opt(b[k]);
      if (b.active !== undefined) x.active = !!b.active;
      log(user, 'تعديل مصدر أموال', x.name, 'source', x.id);
      return x;
    });
    // الموظف في الموقع يضيف نوع مصروف جديد بنفسه، والإدارة تُبلَّغ لتعطيه رقم حساب
    on('POST', '/api/categories', ({ user, b }) => {
      const staff = isStaff(user);
      const name = text(b.name, 'اسم البند');
      const same = D().categories.find(x => String(x.name).trim().toLowerCase() === name.toLowerCase());
      if (same) { if (!staff && same.active === false) fail(400, 'هذا البند موقوف من الإدارة'); return same; }
      const c = { id: env.uid(), code: staff ? opt(b.code) : '', name, vatApplicable: b.vatApplicable !== false, active: true, ...(staff ? {} : { addedBy: user.id }) };
      D().categories.push(c);
      if (!staff) notify(staffIds(), `${user.name} أضاف نوع مصروف جديد: ${c.name}`, '#/categories');
      log(user, 'إضافة بند', c.name, 'category', c.id);
      return c;
    });
    on('PUT', '/api/categories/:id', ({ user, p, b }) => {
      staffOnly(user);
      const c = find('categories', p.id, 'البند');
      if (b.name !== undefined) c.name = text(b.name, 'اسم البند');
      if (b.code !== undefined) c.code = opt(b.code);
      if (b.vatApplicable !== undefined) c.vatApplicable = !!b.vatApplicable;
      if (b.active !== undefined) c.active = !!b.active;
      return c;
    });

    // ----- المستخدمون والإعدادات -----
    on('POST', '/api/users', async ({ user, b }) => {
      adminOnly(user);
      const username = text(b.username, 'اسم المستخدم').toLowerCase();
      if (D().users.some(u => u.username === username)) fail(400, 'اسم المستخدم مستخدم مسبقاً');
      if (String(b.password || '').length < 4) fail(400, 'كلمة المرور يجب ألا تقل عن 4 أحرف');
      const u = { id: env.uid(), name: text(b.name, 'الاسم'), username, role: ROLES[b.role] ? b.role : 'employee', jobTitle: opt(b.jobTitle), phone: opt(b.phone), department: opt(b.department), custodyLimit: num(b.custodyLimit), directCustody: !!b.directCustody, active: true, createdAt: env.now(), ...(await env.hashPassword(b.password)) };
      D().users.push(u);
      log(user, 'إضافة مستخدم', `${u.name} (${ROLES[u.role]})`, 'user', u.id);
      return publicUser(u);
    });
    on('PUT', '/api/users/:id', async ({ user, p, b }) => {
      adminOnly(user);
      const u = find('users', p.id, 'المستخدم');
      for (const k of ['name', 'jobTitle', 'phone', 'department']) if (b[k] !== undefined) u[k] = opt(b[k]);
      if (!u.name) fail(400, 'الاسم مطلوب');
      if (b.custodyLimit !== undefined) u.custodyLimit = num(b.custodyLimit);
      if (b.directCustody !== undefined) u.directCustody = !!b.directCustody;
      if (b.role && ROLES[b.role]) { if (u.id === user.id && b.role !== 'admin') fail(400, 'لا يمكنك تغيير صلاحيتك'); u.role = b.role; }
      if (b.active !== undefined) { if (u.id === user.id && !b.active) fail(400, 'لا يمكنك إيقاف حسابك'); u.active = !!b.active; }
      if (b.password) { if (String(b.password).length < 4) fail(400, 'كلمة المرور قصيرة'); Object.assign(u, await env.hashPassword(b.password)); }
      log(user, 'تعديل مستخدم', u.name, 'user', u.id);
      return publicUser(u);
    });
    on('POST', '/api/password', async ({ user, b }) => {
      if (!(await env.verifyPassword(user, b.oldPassword || ''))) fail(400, 'كلمة المرور الحالية غير صحيحة');
      if (String(b.newPassword || '').length < 4) fail(400, 'كلمة المرور الجديدة قصيرة جداً');
      Object.assign(user, await env.hashPassword(b.newPassword));
      log(user, 'تغيير كلمة المرور', user.name, 'user', user.id);
      return { ok: true };
    });
    on('PUT', '/api/settings', ({ user, b }) => {
      adminOnly(user);
      const s = S();
      for (const k of ['companyName', 'vatNumber', 'address', 'currency']) if (b[k] !== undefined) s[k] = opt(b[k]);
      for (const k of ['workStart', 'workEnd']) if (/^\d{2}:\d{2}$/.test(b[k] || '')) s[k] = b[k];
      if (Array.isArray(b.workDays)) s.workDays = b.workDays.map(Number).filter(d => d >= 0 && d <= 6);
      for (const [k, min, max] of [['reminderMinutes', 5, 240], ['agingDays', 1, 365], ['vatRate', 0, 100]]) if (b[k] !== undefined && b[k] !== '') s[k] = Math.max(min, Math.min(max, Number(b[k]) || 0));
      for (const k of ['lowBalance', 'receiptRequiredAbove']) if (b[k] !== undefined) s[k] = num(b[k]);
      if (b.remindersEnabled !== undefined) s.remindersEnabled = !!b.remindersEnabled;
      log(user, 'تعديل الإعدادات', '', 'settings', null);
      return s;
    });

    // ----- التنبيهات والإشعارات -----
    on('POST', '/api/checkins', ({ user, b }) => {
      D().checkins.push({ id: env.uid(), employeeId: user.id, at: env.now(), answer: b.answer === 'yes' ? 'yes' : 'no' });
      if (D().checkins.length > 30000) D().checkins.splice(0, D().checkins.length - 30000);
      return { ok: true };
    });
    on('GET', '/api/notifications', ({ user }) => D().notifications.filter(n => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100));
    on('POST', '/api/notifications/read', ({ user }) => { D().notifications.forEach(n => { if (n.userId === user.id) n.read = true; }); return { ok: true }; });

    on('GET', '/api/reports/:name', ({ user, p, q }) => reportData(p.name, q, user));
    on('GET', '/api/audit', ({ user, q }) => {
      staffOnly(user);
      let list = D().audit.slice().reverse();
      if (q.q) { const s = q.q.toLowerCase(); list = list.filter(a => [a.action, a.summary, a.userName].some(v => String(v || '').toLowerCase().includes(s))); }
      return list.slice(0, 300);
    });
    on('GET', '/api/backup', ({ user }) => { adminOnly(user); const { sessions, ...rest } = D(); return rest; });

    async function handle(method, path, query, body, user) {
      for (const r of routes) {
        const m = r.method === method && r.re.exec(path);
        if (!m) continue;
        const result = await r.fn({ user, p: m.groups || {}, q: query || {}, b: body || {} });
        if (method !== 'GET') env.save();
        return result;
      }
      fail(404, 'المسار غير موجود');
    }

    async function login(username, password) {
      const u = D().users.find(x => x.username === String(username || '').trim().toLowerCase());
      if (!u || !(await env.verifyPassword(u, password || ''))) fail(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
      if (u.active === false) fail(403, 'الحساب موقوف، راجع الإدارة');
      return u;
    }
    const needsSetup = () => !D().users.length;
    async function setup(b) {
      if (!needsSetup()) fail(400, 'تم إعداد النظام مسبقاً');
      if (String(b.password || '').length < 4) fail(400, 'كلمة المرور يجب ألا تقل عن 4 أحرف');
      const u = { id: env.uid(), name: text(b.name, 'اسمك'), username: text(b.username, 'اسم المستخدم').toLowerCase(), role: 'admin', jobTitle: 'مدير', phone: '', department: '', custodyLimit: 0, active: true, createdAt: env.now(), ...(await env.hashPassword(b.password)) };
      D().users.push(u);
      S().companyName = opt(b.companyName);
      log(u, 'إعداد النظام', S().companyName, 'settings', null);
      env.save();
      return u;
    }
    return { handle, login, setup, needsSetup, publicUser };
  }

  // ---------- بيانات تجريبية ----------
  async function seedDemo(env) {
    const db = env.db;
    const core = createCore(env);
    const admin = await core.setup({ name: 'أحمد المدير', username: 'admin', password: 'admin', companyName: 'شركة الخطوط المعدنية للمقاولات العامة' });
    const call = (u, m, p, b) => core.handle(m, p, {}, b, u);
    db.settings.vatNumber = '300000000000003';
    db.settings.address = 'المملكة العربية السعودية';
    const mk = (name, username, role, jobTitle, custodyLimit) => call(admin, 'POST', '/api/users', { name, username, password: '1234', role, jobTitle, custodyLimit });
    await mk('سارة المحاسبة', 'sara', 'accountant', 'محاسبة');
    const [m, k, o] = [await mk('محمد أحمد', 'mohamed', 'employee', 'مهندس موقع', 15000), await mk('خالد سعيد', 'khaled', 'employee', 'مندوب مشتريات', 10000), await mk('عمر حسن', 'omar', 'employee', 'سائق', 4000)];
    const U = id => db.users.find(u => u.id === id);
    const [cashBox, bank, owner] = db.fundSources;
    bank.name = 'مصرف الراجحي — الحساب الجاري'; bank.accountNo = 'SA00 8000 0000 0000 0000 0000';
    const bank2 = await call(admin, 'POST', '/api/sources', { name: 'البنك الأهلي', type: 'bank' });
    const client = await call(admin, 'POST', '/api/sources', { name: 'دفعة مقدمة من عميل مشروع الفيلا', type: 'client' });
    const cc = (code, name, type, budget, parentId) => call(admin, 'POST', '/api/cost-centers', { code, name, type, budget, parentId });
    const p1 = await cc('P-101', 'مشروع مجمع الورود السكني', 'project', 80000);
    const p1a = await cc('P-101-1', 'الهيكل الخرساني', 'project', 45000, p1.id);
    const p1b = await cc('P-101-2', 'الأعمال المعدنية والتشطيبات', 'project', 30000, p1.id);
    const p2 = await cc('P-102', 'مشروع فيلا حي الملقا', 'project', 30000);
    const p3 = await cc('P-103', 'مستودعات المدينة الصناعية', 'project', 50000);
    const adm = await cc('G-900', 'الإدارة العامة', 'department', 15000);
    const veh = await cc('G-910', 'المعدات والنقل', 'vehicle', 12000, adm.id);
    const cat = code => db.categories.find(c => c.code === code).id;
    const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const c1 = await call(admin, 'POST', '/api/custodies', { employeeId: m.id, kind: 'permanent', amount: 5000, purpose: 'عهدة مستديمة لمصروفات موقع مجمع الورود', costCenterId: p1a.id, issueDate: day(12), sourceId: bank.id, method: 'تحويل بنكي', ref: 'TRX-55120' });
    const c2 = await call(admin, 'POST', '/api/custodies', { employeeId: k.id, kind: 'temporary', amount: 3000, purpose: 'شراء مواد تشطيب ودهانات', costCenterId: p1b.id, issueDate: day(20), dueDate: day(5), sourceId: cashBox.id });
    const c3 = await call(admin, 'POST', '/api/custodies', { employeeId: o.id, kind: 'permanent', amount: 1500, purpose: 'وقود وصيانة المعدات', costCenterId: veh.id, issueDate: day(8), sourceId: owner.id });
    await call(admin, 'POST', '/api/custodies', { employeeId: m.id, kind: 'temporary', amount: 2000, purpose: 'مشتريات عاجلة لفيلا الملقا', costCenterId: p2.id, issueDate: day(3), dueDate: day(-10), sourceId: client.id });
    await call(admin, 'POST', '/api/custodies/' + c2.id + '/tx', { type: 'topup', amount: 500, sourceId: bank2.id, method: 'تحويل بنكي', date: day(9), note: 'زيادة لشراء دهانات إضافية' });
    const ex = async (u, c, ccId, code, amount, description, vendor, ago, vatIncluded) => call(U(u.id), 'POST', '/api/expenses', { custodyId: c.id, costCenterId: ccId, categoryId: cat(code), amount, description, vendor, date: day(ago), vatIncluded, invoiceNo: vatIncluded ? 'INV-' + (1000 + ago) : '' });
    const e1 = await ex(m, c1, p1a.id, '5101', 1250, 'أسمنت 25 كيس', 'مؤسسة الإعمار', 10, true);
    const e2 = await ex(m, c1, p1a.id, '5105', 600, 'عمال تحميل 4 أشخاص', '', 7, false);
    await ex(m, c1, p1a.id, '5102', 380, 'نقل حديد للموقع', 'نقليات السريع', 1, false);
    await ex(m, c1, p3.id, '5104', 245, 'وجبات فريق العمل', 'مطعم البيت', 0, true);
    const e5 = await ex(k, c2, p1b.id, '5101', 1740, 'دهانات ومعجون', 'مركز الألوان', 15, true);
    const e6 = await ex(k, c2, p1b.id, '5106', 940, 'مثقاب وعدد يدوية', 'محل الأدوات', 9, true);
    await ex(k, c2, p1b.id, '5104', 210, 'ضيافة', '', 3, false);
    const e8 = await ex(o, c3, veh.id, '5103', 450, 'تعبئة ديزل', 'محطة الوقود', 6, true);
    await ex(o, c3, veh.id, '5107', 1450, 'صيانة فرامل الشاحنة', 'ورشة الأمل', 2, true);
    await call(admin, 'POST', '/api/expenses/review', { ids: [e1.id, e2.id, e5.id, e6.id, e8.id], status: 'approved' });
    await call(admin, 'POST', '/api/custodies/' + c1.id + '/settle', { replenish: true, date: day(4), sourceId: bank.id, method: 'تحويل بنكي' });
    await call(U(k.id), 'POST', '/api/requests', { type: 'cash', amount: 2000, purpose: 'شراء أدوات سباكة لفيلا الملقا', costCenterId: p2.id, kind: 'temporary' });
    const a1 = await call(admin, 'POST', '/api/assets', { name: 'لابتوب Dell Latitude', category: 'أجهزة حاسب', serial: 'DL-77821', value: 4200, costCenterId: adm.id, assignTo: m.id });
    await call(admin, 'POST', '/api/assets', { name: 'شاحنة إيسوزو 2022', category: 'مركبات', serial: 'أ ب ج 4521', value: 145000, costCenterId: veh.id, assignTo: o.id });
    await call(admin, 'POST', '/api/assets', { name: 'جهاز مساحة ليزر', category: 'معدات وعدد', serial: 'LS-3390', value: 2800, costCenterId: p1.id });
    await call(U(m.id), 'POST', '/api/assets/' + a1.id + '/ack', {});
    for (const [u, ans] of [[m, 'yes'], [m, 'no'], [k, 'no'], [o, 'yes']]) await call(U(u.id), 'POST', '/api/checkins', { answer: ans });
  }

  return { createCore, normalize, seedDemo, ApiError, ROLES, KINDS, TX_TYPES, SOURCE_TYPES };
});
