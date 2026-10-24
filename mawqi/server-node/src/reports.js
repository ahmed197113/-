// Report library: every report the company needs, with the same filters on the web and the phone.
// GET /api/r            → catalog (what reports exist and which filters each takes)
// GET /api/r/:kind      → { title, columns, rows, totals, cards }   (?format=csv for Excel)
import { Router } from 'express';
import { db, officeId } from './db.js';
import { PERMISSIONS, projectScope } from './auth.js';
import { addDays, round, todayStr } from './util.js';
import { COST, monthsBetween, overheadMonth, RATE } from './costs.js';
import { custodyExpenses } from './link.js';

export const reports = Router();

const ATT = { present: 'حاضر', late: 'متأخر', overtime: 'إضافي', absent: 'غائب', leave: 'إجازة' };
const ISSUE = { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' };
const SEV = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
const CAT = { safety: 'سلامة', materials: 'مواد', equipment: 'معدات', subcontractor: 'مقاول باطن', other: 'أخرى' };
const INV = { draft: 'مسودة', submitted: 'مقدم', approved: 'معتمد', paid: 'مدفوع', rejected: 'مرفوض' };
const ORD = { open: 'مفتوح', in_progress: 'قيد التنفيذ', done: 'منجز', cancelled: 'ملغي' };
const PST = { active: 'جاري', paused: 'متوقف', done: 'منتهي' };
const opts = (o) => Object.entries(o).map(([value, label]) => ({ value, label }));

/**
 * Catalog. filters: range = from/to dates, project, q = search, plus named option lists.
 * fin = financial report (hidden from site supervisors).
 */
const CATALOG = [
  { group: 'التكاليف والمالية', kind: 'project_costs', title: 'التكلفة الفعلية للمشاريع', text: 'عمالة + تجديد إقامات + حصة الإدارة + مقاولو الباطن، مقابل المستخلصات', filters: ['range', 'project'], fin: true },
  { group: 'التكاليف والمالية', kind: 'overhead', title: 'مصاريف الإدارة وتوزيعها', text: 'رواتب وإقامات موظفي الإدارة شهرياً وحصة كل مشروع', filters: ['range'], fin: true },
  { group: 'التكاليف والمالية', kind: 'office_staff', title: 'موظفو الإدارة وتكلفتهم', text: 'كل موظف إداري: الأيام والراتب المحمّل على المشاريع', filters: ['range', 'q'], fin: true },
  { group: 'التكاليف والمالية', kind: 'iqama_renewals', title: 'مصاريف تجديد الإقامات', text: 'كل تجديد: العامل والمبلغ والموقع المحمّل عليه', filters: ['range', 'project', 'q'], fin: true },
  { group: 'التكاليف والمالية', kind: 'payroll', title: 'مسير الرواتب', text: 'مستحق كل عامل حسب أيام العمل والإضافي', filters: ['range', 'project', 'profession', 'q'], fin: true },
  { group: 'التكاليف والمالية', kind: 'labour_daily', title: 'تكلفة العمالة يوماً بيوم', text: 'لكل مشروع: عدد العمال والتكلفة في كل يوم', filters: ['range', 'project'], fin: true },
  { group: 'التكاليف والمالية', kind: 'invoices', title: 'المستخلصات', text: 'المالك ومقاولو الباطن مع الصافي والضريبة', filters: ['range', 'project', 'kind', 'status', 'q'], fin: true,
    options: { kind: opts({ client: 'المالك', subcontractor: 'مقاول باطن' }), status: opts(INV) } },
  { group: 'التكاليف والمالية', kind: 'subcontractors', title: 'مقاولو الباطن', text: 'العمال والمستخلصات والأوامر لكل مقاول', filters: ['range', 'project', 'q'], fin: true },

  { group: 'العمال والحضور', kind: 'attendance_summary', title: 'ملخص الحضور لكل عامل', text: 'حضور وتأخير وإضافي وغياب وإجازة ونسبة الغياب', filters: ['range', 'project', 'profession', 'q'] },
  { group: 'العمال والحضور', kind: 'absences', title: 'سجل الغياب والتأخير', text: 'كل يوم غياب أو تأخير أو إجازة بالتفصيل', filters: ['range', 'project', 'status', 'q'],
    options: { status: opts({ absent: 'غائب', late: 'متأخر', leave: 'إجازة' }) } },
  { group: 'العمال والحضور', kind: 'attendance_daily', title: 'الحضور اليومي لكل موقع', text: 'لكل يوم وموقع: حاضر، غائب، إجازة، لم يُسجَّل', filters: ['range', 'project'] },
  { group: 'العمال والحضور', kind: 'worker_sites', title: 'أين عمل كل عامل', text: 'عدد أيام كل عامل في كل مشروع والمصنع والإدارة', filters: ['range', 'project', 'q'] },
  { group: 'العمال والحضور', kind: 'movements', title: 'تنقلات العمال', text: 'كل نقل بين المشاريع والمصنع والإدارة بتاريخه', filters: ['range', 'project', 'q'] },
  { group: 'العمال والحضور', kind: 'workers', title: 'سجل العمال', text: 'البيانات والمهن والأجور والموقع الحالي', filters: ['project', 'profession', 'status', 'q'],
    options: { status: opts({ active: 'نشط', inactive: 'موقوف' }) } },
  { group: 'العمال والحضور', kind: 'iqama_expiry', title: 'الإقامات المنتهية والقريبة', text: 'من انتهت إقامته أو تنتهي قريباً', filters: ['project', 'status', 'q'],
    options: { status: opts({ expired: 'منتهية', d30: 'خلال 30 يوماً', d60: 'خلال 60 يوماً', d90: 'خلال 90 يوماً' }) } },
  { group: 'العمال والحضور', kind: 'professions', title: 'توزيع المهن', text: 'عدد العمال في كل مهنة وحسب الموقع', filters: ['project'] },

  { group: 'المشاريع والموقع', kind: 'projects', title: 'حالة المشاريع', text: 'الإنجاز مقابل المدة، العمال، البلاغات، العقد', filters: ['status', 'q'], options: { status: opts(PST) } },
  { group: 'المشاريع والموقع', kind: 'daily_reports', title: 'التقارير اليومية', text: 'ما أُنجز يومياً والعوائق في كل مشروع', filters: ['range', 'project', 'q'] },
  { group: 'المشاريع والموقع', kind: 'issues', title: 'البلاغات', text: 'المشاكل وخطورتها وحالتها والمسؤول', filters: ['range', 'project', 'status', 'severity', 'q'],
    options: { status: opts(ISSUE), severity: opts(SEV) } },
  { group: 'المشاريع والموقع', kind: 'direct_orders', title: 'الأوامر المباشرة', text: 'أوامر العمل وحالتها وقيمتها', filters: ['range', 'project', 'status', 'q'], options: { status: opts(ORD) } },
];

const canFin = (user) => PERMISSIONS.costs.includes(user.role);
const monthStart = () => `${todayStr().slice(0, 7)}-01`;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
class ReportError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

reports.get('/r', (req, res) => {
  const fin = canFin(req.user);
  const scope = projectScope(req.user);
  const professions = db.prepare(`SELECT DISTINCT profession FROM workers WHERE active = 1 ORDER BY profession`).all().map((r) => r.profession);
  res.json({ reports: CATALOG.filter((r) => fin || !r.fin), professions, top: scope === null });
});

const C = (key, label, type = 't', extra = {}) => ({ key, label, type, ...extra });

reports.get('/r/:kind', async (req, res, next) => {
  try {
    const def = CATALOG.find((r) => r.kind === req.params.kind);
    if (!def) throw new ReportError(404, 'التقرير غير موجود');
    if (def.fin && !canFin(req.user)) throw new ReportError(403, 'هذا التقرير للإدارة والمحاسبة فقط');
    const q = req.query;
    const from = isDate(q.from) ? q.from : monthStart();
    let to = isDate(q.to) ? q.to : todayStr();
    if (to > todayStr()) to = todayStr();
    const scope = projectScope(req.user);
    let project = q.project ? Number(q.project) : null;
    if (project && scope !== null && !scope.includes(project)) throw new ReportError(403, 'هذا المشروع خارج صلاحياتك');
    const inScope = (col) => (project ? `${col} = ${project}` : scope === null ? '1=1' : scope.length ? `${col} IN (${scope.join(',')})` : '0=1');
    const out = await build(def.kind, { from, to, project, inScope, q, scope });
    let rows = out.rows;
    const search = String(q.q || '').trim();
    if (search) rows = rows.filter((r) => out.columns.some((c) => String(r[c.key] ?? '').includes(search)));
    const totals = {};
    for (const c of out.columns) if (c.sum) totals[c.key] = round(rows.reduce((t, r) => t + (Number(r[c.key]) || 0), 0));
    const body = { kind: def.kind, title: def.title, from, to, period: def.filters.includes('range'), columns: out.columns, rows, totals, cards: out.cards?.(rows, totals) ?? [], note: out.note ?? null };
    if (q.format === 'csv') return sendCsv(res, `${def.title} ${def.filters.includes('range') ? `${from} - ${to}` : todayStr()}`, body);
    res.json(body);
  } catch (e) {
    if (e instanceof ReportError) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function sendCsv(res, name, b) {
  const lines = [b.columns.map((c) => c.label), ...b.rows.map((r) => b.columns.map((c) => r[c.key]))];
  if (Object.keys(b.totals).length) lines.push(b.columns.map((c, i) => (i === 0 ? 'الإجمالي' : b.totals[c.key] ?? '')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}.csv`);
  res.send('﻿' + lines.map((r) => r.map(csvCell).join(',')).join('\r\n'));
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5) + 1;
const placeName = (name, kind) => (kind === 'factory' ? `🏭 ${name}` : kind === 'office' ? `🏢 ${name}` : name);
const card = (label, value, type = 'm', tone) => ({ label, value, type, tone });

async function build(kind, { from, to, project, inScope, q, scope }) {
  const P = { $from: from, $to: to };
  switch (kind) {
    case 'project_costs': {
      const months = monthsBetween(from, to);
      const rows = db.prepare(`
        SELECT p.id, p.name, p.kind, p.contract_value,
          (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to) AS labour,
          (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date BETWEEN $from AND $to AND a.status IN ('present','late','overtime')) AS man_days,
          (SELECT COALESCE(SUM(amount), 0) FROM iqama_renewals r WHERE r.project_id = p.id AND r.date BETWEEN $from AND $to) AS iqama,
          (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'subcontractor' AND v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to) AS subs,
          (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'client' AND v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to) AS billed
        FROM projects p WHERE p.kind <> 'office' AND ${inScope('p.id')} ORDER BY p.kind <> 'project', p.name`).all(P);
      const share = new Map();
      for (const m of months) { const o = overheadMonth(m); for (const p of o.projects) share.set(p.id, (share.get(p.id) ?? 0) + o.share); }
      const cx = await custodyExpenses(from, to);
      return {
        columns: [C('name', 'المشروع'), C('man_days', 'أيام عمل', 'n', { sum: true }), C('labour', 'العمالة', 'm', { sum: true }), C('iqama', 'تجديد الإقامات', 'm', { sum: true }),
          C('overhead', 'حصة الإدارة', 'm', { sum: true }), C('custody', 'مصروفات العهد', 'm', { sum: true }), C('subs', 'مقاولو الباطن', 'm', { sum: true }), C('total', 'التكلفة الفعلية', 'm', { sum: true, strong: true }),
          C('billed', 'المستخلص المعتمد', 'm', { sum: true }), C('margin', 'الفرق', 'm', { sum: true, tone: true })],
        rows: rows.map((p) => {
          const overhead = round(share.get(p.id) ?? 0);
          const custody = round(cx.byProject.get(p.id) || 0);
          const total = round(p.labour + p.iqama + overhead + custody + p.subs);
          return { name: placeName(p.name, p.kind), man_days: p.man_days, labour: round(p.labour), iqama: round(p.iqama), overhead, custody, subs: round(p.subs), total, billed: round(p.billed), margin: round(p.billed - total) };
        }),
        cards: (_r, t) => [card('التكلفة الفعلية', t.total), card('منها حصة الإدارة', t.overhead), card('منها مصروفات العهد', t.custody), card('المستخلص المعتمد', t.billed, 'm', 'good'), card('الفرق', t.margin, 'm', t.margin < 0 ? 'bad' : 'good')],
        note: 'حصة الإدارة = (رواتب موظفي الإدارة + تجديد إقاماتهم) ÷ عدد المشاريع الجارية في كل شهر. مصروفات العهد = المصروفات المعتمدة في تطبيق العهدة على مراكز التكلفة المربوطة بالمشروع.'
          + (cx.off ? ' (تطبيق العهدة غير مربوط بعد)' : !cx.ok ? ` (${cx.error})` : cx.unlinked ? ` يوجد ${round(cx.unlinked)} ر.س مصروفات عهد على مراكز غير مربوطة بمشروع.` : ''),
      };
    }
    case 'overhead': {
      const rows = monthsBetween(from, to).map((m) => {
        const o = overheadMonth(m);
        return { month: m, salaries: o.salaries, iqama: o.iqama, total: o.total, count: o.projects.length, share: o.share, projects: o.projects.map((p) => p.name).join('، ') };
      });
      return {
        columns: [C('month', 'الشهر'), C('salaries', 'رواتب الإدارة', 'm', { sum: true }), C('iqama', 'إقامات الإدارة', 'm', { sum: true }), C('total', 'الإجمالي', 'm', { sum: true, strong: true }),
          C('count', 'عدد المشاريع', 'n'), C('share', 'حصة كل مشروع', 'm', { sum: true }), C('projects', 'المشاريع')],
        rows,
        cards: (_r, t) => [card('مصاريف الإدارة', t.total), card('الرواتب', t.salaries), card('الإقامات', t.iqama)],
        note: 'تتغير الحصة تلقائياً مع عدد المشاريع الجارية كل شهر.',
      };
    }
    case 'office_staff': {
      const map = new Map();
      for (const m of monthsBetween(from, to)) for (const s of overheadMonth(m, true).staff) {
        const x = map.get(s.id) ?? { name: s.name, profession: s.profession, wage: s.wage, wage_type: s.wage_type === 'daily' ? 'يومي' : 'شهري', days: 0, cost: 0 };
        x.days += s.days; x.cost += s.cost; map.set(s.id, x);
      }
      const office = officeId();
      const iq = db.prepare(`SELECT worker_id, SUM(amount) AS v FROM iqama_renewals WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY worker_id`).all(office, from, to);
      const names = new Map(db.prepare(`SELECT id, name, profession FROM workers`).all().map((w) => [w.id, w]));
      const byName = new Map([...map.entries()]);
      for (const r of iq) { const x = byName.get(r.worker_id) ?? { name: names.get(r.worker_id)?.name, profession: names.get(r.worker_id)?.profession, wage: 0, wage_type: '', days: 0, cost: 0 }; x.iqama = r.v; byName.set(r.worker_id, x); }
      const rows = [...byName.values()].map((x) => ({ ...x, cost: round(x.cost), iqama: round(x.iqama ?? 0), total: round(x.cost + (x.iqama ?? 0)) }));
      return {
        columns: [C('name', 'الموظف'), C('profession', 'الوظيفة'), C('wage_type', 'نوع الأجر'), C('wage', 'الأجر', 'm'), C('days', 'أيام', 'n', { sum: true }),
          C('cost', 'الرواتب', 'm', { sum: true }), C('iqama', 'تجديد الإقامة', 'm', { sum: true }), C('total', 'الإجمالي', 'm', { sum: true, strong: true })],
        rows,
        cards: (r, t) => [card('عدد الموظفين', r.length, 'n'), card('إجمالي التكلفة', t.total)],
        note: 'موظفو الإدارة هم العمال الموجودون في موقع «الإدارة».',
      };
    }
    case 'iqama_renewals': {
      const rows = db.prepare(`SELECT r.date, w.name, w.iqama_no, w.profession, p.name AS project, p.kind, r.amount, r.new_expiry, r.note, u.name AS author
        FROM iqama_renewals r JOIN workers w ON w.id = r.worker_id LEFT JOIN projects p ON p.id = r.project_id LEFT JOIN users u ON u.id = r.created_by
        WHERE r.date BETWEEN $from AND $to AND ${project ? `r.project_id = ${project}` : scope === null ? '1=1' : inScope('r.project_id')} ORDER BY r.date DESC`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('name', 'العامل'), C('iqama_no', 'رقم الإقامة'), C('project', 'حُمّل على'), C('amount', 'المبلغ', 'm', { sum: true, strong: true }),
          C('new_expiry', 'الانتهاء الجديد', 'd'), C('note', 'ملاحظة'), C('author', 'سجّله')],
        rows: rows.map((r) => ({ ...r, project: r.project ? placeName(r.project, r.kind) : '—' })),
        cards: (r, t) => [card('عدد التجديدات', r.length, 'n'), card('إجمالي المصروف', t.amount)],
      };
    }
    case 'payroll': {
      const prof = q.profession ? ` AND w.profession = ${JSON.stringify(String(q.profession)).replace(/"/g, "'")}` : '';
      const rows = db.prepare(`SELECT w.name, w.iqama_no, w.profession, w.wage_type, w.wage, ${RATE} AS rate, p.name AS project, p.kind,
          SUM(a.status IN ('present','late','overtime')) AS worked, SUM(a.status = 'absent') AS absent, SUM(a.status = 'leave') AS leave,
          SUM(a.overtime_hours) AS ot, SUM(${COST}) AS pay
        FROM attendance a JOIN workers w ON w.id = a.worker_id LEFT JOIN projects p ON p.id = w.project_id
        WHERE a.date BETWEEN $from AND $to AND ${inScope('a.project_id')}${prof} GROUP BY w.id ORDER BY p.name, w.name`).all(P);
      return {
        columns: [C('name', 'العامل'), C('iqama_no', 'الإقامة'), C('profession', 'المهنة'), C('project', 'الموقع الحالي'), C('wage', 'الأجر', 'm'), C('rate', 'أجر اليوم', 'm'),
          C('worked', 'أيام العمل', 'n', { sum: true }), C('absent', 'غياب', 'n', { sum: true }), C('ot', 'ساعات إضافية', 'n', { sum: true }), C('pay', 'المستحق', 'm', { sum: true, strong: true })],
        rows: rows.map((r) => ({ ...r, project: r.project ? placeName(r.project, r.kind) : '—', wage: round(r.wage), rate: round(r.rate), ot: round(r.ot || 0), pay: round(r.pay) })),
        cards: (r, t) => [card('عدد العمال', r.length, 'n'), card('إجمالي المستحق', t.pay), card('أيام العمل', t.worked, 'n')],
      };
    }
    case 'labour_daily': {
      const rows = db.prepare(`SELECT a.date, p.name AS project, p.kind, SUM(a.status IN ('present','late','overtime')) AS present, SUM(a.status = 'absent') AS absent, SUM(${COST}) AS cost
        FROM attendance a JOIN workers w ON w.id = a.worker_id JOIN projects p ON p.id = a.project_id
        WHERE a.date BETWEEN $from AND $to AND ${inScope('a.project_id')} GROUP BY a.date, p.id ORDER BY a.date DESC, p.name`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('project', 'الموقع'), C('present', 'حاضر', 'n', { sum: true }), C('absent', 'غائب', 'n', { sum: true }), C('cost', 'التكلفة', 'm', { sum: true, strong: true })],
        rows: rows.map((r) => ({ ...r, project: placeName(r.project, r.kind), cost: round(r.cost) })),
        cards: (_r, t) => [card('تكلفة العمالة', t.cost), card('أيام عمل', t.present, 'n')],
      };
    }
    case 'invoices': {
      const w = [`COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to`, inScope('v.project_id')];
      if (q.kind) w.push(`v.kind = '${q.kind === 'client' ? 'client' : 'subcontractor'}'`);
      if (INV[q.status]) w.push(`v.status = '${q.status}'`);
      const rows = db.prepare(`SELECT v.*, p.name AS project, s.name AS sub FROM invoices v JOIN projects p ON p.id = v.project_id LEFT JOIN subcontractors s ON s.id = v.subcontractor_id
        WHERE ${w.join(' AND ')} ORDER BY v.created_at DESC`).all(P).map((v) => {
        const retention = round((v.gross * v.retention_pct) / 100); const net = round(v.gross - retention - v.deductions); const vat = round((net * v.vat_pct) / 100);
        return { number: v.number, kind: v.kind === 'client' ? 'المالك' : 'مقاول باطن', project: v.project, party: v.kind === 'client' ? 'المالك' : v.sub ?? '—', period: `${v.period_from ?? ''} ← ${v.period_to ?? ''}`,
          gross: round(v.gross), retention, deductions: round(v.deductions), net, vat, total: round(net + vat), status: INV[v.status] };
      });
      return {
        columns: [C('number', 'الرقم'), C('kind', 'النوع'), C('project', 'المشروع'), C('party', 'الجهة'), C('period', 'الفترة'), C('gross', 'قيمة الأعمال', 'm', { sum: true }),
          C('retention', 'محتجز', 'm', { sum: true }), C('deductions', 'خصومات', 'm', { sum: true }), C('net', 'الصافي', 'm', { sum: true }), C('vat', 'الضريبة', 'm', { sum: true }),
          C('total', 'الإجمالي', 'm', { sum: true, strong: true }), C('status', 'الحالة', 'tag')],
        rows,
        cards: (r, t) => [card('عدد المستخلصات', r.length, 'n'), card('قيمة الأعمال', t.gross), card('الإجمالي بالضريبة', t.total)],
      };
    }
    case 'subcontractors': {
      const rows = db.prepare(`SELECT s.name,
          (SELECT COUNT(*) FROM workers w WHERE w.subcontractor_id = s.id AND w.active = 1 AND ${inScope('w.project_id')}) AS workers,
          (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.subcontractor_id = s.id AND v.status IN ('approved','paid') AND COALESCE(v.period_to, substr(v.created_at,1,10)) BETWEEN $from AND $to AND ${inScope('v.project_id')}) AS approved,
          (SELECT COUNT(*) FROM invoices v WHERE v.subcontractor_id = s.id AND v.status IN ('draft','submitted') AND ${inScope('v.project_id')}) AS pending,
          (SELECT COUNT(*) FROM direct_orders o WHERE o.subcontractor_id = s.id AND o.status IN ('open','in_progress') AND ${inScope('o.project_id')}) AS orders
        FROM subcontractors s ORDER BY s.name`).all(P);
      return {
        columns: [C('name', 'المقاول'), C('workers', 'عماله', 'n', { sum: true }), C('approved', 'مستخلصات معتمدة', 'm', { sum: true, strong: true }), C('pending', 'مستخلصات قيد الاعتماد', 'n', { sum: true }), C('orders', 'أوامر مفتوحة', 'n', { sum: true })],
        rows,
        cards: (r, t) => [card('عدد المقاولين', r.length, 'n'), card('المعتمد في الفترة', t.approved)],
      };
    }
    case 'attendance_summary': {
      const prof = q.profession ? ` AND w.profession = '${String(q.profession).replace(/'/g, "''")}'` : '';
      const rows = db.prepare(`SELECT w.name, w.profession, p.name AS project, p.kind,
          SUM(a.status = 'present') AS present, SUM(a.status = 'late') AS late, SUM(a.status = 'overtime') AS overtime, SUM(a.status = 'absent') AS absent, SUM(a.status = 'leave') AS leave,
          SUM(a.overtime_hours) AS ot
        FROM attendance a JOIN workers w ON w.id = a.worker_id LEFT JOIN projects p ON p.id = w.project_id
        WHERE a.date BETWEEN $from AND $to AND ${inScope('a.project_id')}${prof} GROUP BY w.id ORDER BY absent DESC, w.name`).all(P);
      return {
        columns: [C('name', 'العامل'), C('profession', 'المهنة'), C('project', 'الموقع الحالي'), C('present', 'حاضر', 'n', { sum: true }), C('late', 'متأخر', 'n', { sum: true }),
          C('overtime', 'إضافي', 'n', { sum: true }), C('absent', 'غائب', 'n', { sum: true }), C('leave', 'إجازة', 'n', { sum: true }), C('ot', 'ساعات إضافية', 'n', { sum: true }), C('rate', 'نسبة الغياب', 'p')],
        rows: rows.map((r) => { const tot = r.present + r.late + r.overtime + r.absent; return { ...r, project: r.project ? placeName(r.project, r.kind) : '—', ot: round(r.ot || 0), rate: tot ? round((r.absent / tot) * 100) : 0 }; }),
        cards: (_r, t) => { const tot = t.present + t.late + t.overtime + t.absent; return [card('أيام حضور', t.present + t.late + t.overtime, 'n', 'good'), card('أيام غياب', t.absent, 'n', 'bad'), card('نسبة الغياب', tot ? round((t.absent / tot) * 100) : 0, 'p')]; },
      };
    }
    case 'absences': {
      const st = ['absent', 'late', 'leave'].includes(q.status) ? `a.status = '${q.status}'` : `a.status IN ('absent','late','leave')`;
      const rows = db.prepare(`SELECT a.date, w.name, w.profession, p.name AS project, p.kind, a.status, a.check_in
        FROM attendance a JOIN workers w ON w.id = a.worker_id LEFT JOIN projects p ON p.id = a.project_id
        WHERE a.date BETWEEN $from AND $to AND ${st} AND ${inScope('a.project_id')} ORDER BY a.date DESC, w.name`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('name', 'العامل'), C('profession', 'المهنة'), C('project', 'الموقع'), C('status', 'الحالة', 'tag'), C('check_in', 'وقت الدخول')],
        rows: rows.map((r) => ({ ...r, project: r.project ? placeName(r.project, r.kind) : '—', status: ATT[r.status] })),
        cards: (r) => [card('غياب', r.filter((x) => x.status === 'غائب').length, 'n', 'bad'), card('تأخير', r.filter((x) => x.status === 'متأخر').length, 'n'), card('إجازة', r.filter((x) => x.status === 'إجازة').length, 'n')],
      };
    }
    case 'attendance_daily': {
      const rows = db.prepare(`SELECT a.date, p.name AS project, p.kind, SUM(a.status IN ('present','late','overtime')) AS present, SUM(a.status = 'late') AS late,
          SUM(a.status = 'absent') AS absent, SUM(a.status = 'leave') AS leave
        FROM attendance a JOIN projects p ON p.id = a.project_id WHERE a.date BETWEEN $from AND $to AND ${inScope('a.project_id')}
        GROUP BY a.date, p.id ORDER BY a.date DESC, p.name`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('project', 'الموقع'), C('present', 'حاضر', 'n', { sum: true }), C('late', 'منهم متأخر', 'n', { sum: true }), C('absent', 'غائب', 'n', { sum: true }), C('leave', 'إجازة', 'n', { sum: true })],
        rows: rows.map((r) => ({ ...r, project: placeName(r.project, r.kind) })),
        cards: (_r, t) => [card('حضور', t.present, 'n', 'good'), card('غياب', t.absent, 'n', 'bad')],
      };
    }
    case 'worker_sites': {
      const rows = db.prepare(`SELECT w.name, w.profession, p.name AS project, p.kind, COUNT(*) AS days, MIN(a.date) AS first, MAX(a.date) AS last
        FROM attendance a JOIN workers w ON w.id = a.worker_id JOIN projects p ON p.id = a.project_id
        WHERE a.date BETWEEN $from AND $to AND a.status IN ('present','late','overtime') AND ${inScope('a.project_id')}
        GROUP BY w.id, p.id ORDER BY w.name, days DESC`).all(P);
      return {
        columns: [C('name', 'العامل'), C('profession', 'المهنة'), C('project', 'الموقع'), C('days', 'أيام العمل', 'n', { sum: true }), C('first', 'أول يوم', 'd'), C('last', 'آخر يوم', 'd')],
        rows: rows.map((r) => ({ ...r, project: placeName(r.project, r.kind) })),
        cards: (r, t) => [card('عمال', new Set(r.map((x) => x.name)).size, 'n'), card('أيام عمل', t.days, 'n')],
      };
    }
    case 'movements': {
      const rows = db.prepare(`SELECT wa.from_date, wa.to_date, w.name, w.profession, p.name AS project, p.kind,
          (SELECT p2.name FROM worker_assignments x JOIN projects p2 ON p2.id = x.project_id WHERE x.worker_id = wa.worker_id AND x.from_date < wa.from_date ORDER BY x.from_date DESC, x.id DESC LIMIT 1) AS prev
        FROM worker_assignments wa JOIN workers w ON w.id = wa.worker_id JOIN projects p ON p.id = wa.project_id
        WHERE wa.from_date BETWEEN $from AND $to AND ${inScope('wa.project_id')} ORDER BY wa.from_date DESC, w.name`).all(P);
      return {
        columns: [C('from_date', 'التاريخ', 'd'), C('name', 'العامل'), C('profession', 'المهنة'), C('prev', 'من'), C('project', 'إلى'), C('days', 'المدة (يوم)', 'n')],
        rows: rows.map((r) => ({ ...r, prev: r.prev ?? 'أول تعيين', project: placeName(r.project, r.kind), days: daysBetween(r.from_date, r.to_date ?? todayStr()) })),
        cards: (r) => [card('عدد التنقلات', r.length, 'n')],
      };
    }
    case 'workers': {
      const w = [inScope('w.project_id').replace('w.project_id IN', 'w.project_id IN')];
      if (scope === null && !project) w[0] = '1=1';
      if (q.status === 'inactive') w.push('w.active = 0'); else if (q.status === 'active') w.push('w.active = 1');
      if (q.profession) w.push(`w.profession = '${String(q.profession).replace(/'/g, "''")}'`);
      const rows = db.prepare(`SELECT w.*, p.name AS project, p.kind, s.name AS sub FROM workers w LEFT JOIN projects p ON p.id = w.project_id
        LEFT JOIN subcontractors s ON s.id = w.subcontractor_id WHERE ${w.join(' AND ')} ORDER BY p.name, w.name`).all();
      return {
        columns: [C('name', 'الاسم'), C('iqama_no', 'رقم الإقامة'), C('iqama_expiry', 'انتهاء الإقامة', 'd'), C('nationality', 'الجنسية'), C('profession', 'المهنة'), C('phone', 'الجوال'),
          C('wage_type', 'نوع الأجر'), C('wage', 'الأجر', 'm'), C('project', 'الموقع'), C('sub', 'مقاول الباطن'), C('status', 'الحالة', 'tag')],
        rows: rows.map((r) => ({ name: r.name, iqama_no: r.iqama_no, iqama_expiry: r.iqama_expiry.startsWith('9999') ? '' : r.iqama_expiry, nationality: r.nationality, profession: r.profession, phone: r.phone ?? '',
          wage_type: r.wage_type === 'daily' ? 'يومي' : 'شهري', wage: r.wage, project: r.project ? placeName(r.project, r.kind) : 'غير موزّع', sub: r.sub ?? '', status: r.active ? 'نشط' : 'موقوف' })),
        cards: (r) => [card('عدد العمال', r.length, 'n')],
      };
    }
    case 'iqama_expiry': {
      const t = todayStr();
      const lim = { expired: t, d30: addDays(t, 30), d60: addDays(t, 60), d90: addDays(t, 90) }[q.status] ?? addDays(t, 60);
      const w = [`w.active = 1`, `w.iqama_expiry <= '${lim}'`, `w.iqama_expiry NOT LIKE '9999%'`];
      if (q.status === 'expired') w[1] = `w.iqama_expiry < '${t}'`;
      if (project || scope !== null) w.push(inScope('w.project_id'));
      const rows = db.prepare(`SELECT w.name, w.iqama_no, w.iqama_expiry, w.profession, w.nationality, p.name AS project, p.kind,
          (SELECT MAX(date) FROM iqama_renewals r WHERE r.worker_id = w.id) AS last_renewal
        FROM workers w LEFT JOIN projects p ON p.id = w.project_id WHERE ${w.join(' AND ')} ORDER BY w.iqama_expiry`).all();
      return {
        columns: [C('name', 'العامل'), C('iqama_no', 'رقم الإقامة'), C('iqama_expiry', 'تنتهي في', 'd'), C('left', 'المتبقي (يوم)', 'n', { tone: true }), C('profession', 'المهنة'), C('project', 'الموقع'), C('last_renewal', 'آخر تجديد', 'd')],
        rows: rows.map((r) => ({ ...r, left: daysBetween(t, r.iqama_expiry) - 1, project: r.project ? placeName(r.project, r.kind) : '—' })),
        cards: (r) => [card('منتهية', r.filter((x) => x.left < 0).length, 'n', 'bad'), card('تنتهي قريباً', r.filter((x) => x.left >= 0).length, 'n')],
      };
    }
    case 'professions': {
      const w = project || scope !== null ? inScope('w.project_id') : '1=1';
      const rows = db.prepare(`SELECT w.profession, COUNT(*) AS total,
          SUM(p.kind = 'project') AS projects, SUM(p.kind = 'factory') AS factory, SUM(p.kind = 'office') AS office, SUM(w.project_id IS NULL) AS none,
          SUM((SELECT a.status FROM attendance a WHERE a.worker_id = w.id AND a.date = '${todayStr()}') IN ('present','late','overtime')) AS today
        FROM workers w LEFT JOIN projects p ON p.id = w.project_id WHERE w.active = 1 AND ${w} GROUP BY w.profession ORDER BY total DESC`).all();
      return {
        columns: [C('profession', 'المهنة'), C('total', 'العدد', 'n', { sum: true, strong: true }), C('projects', 'في المشاريع', 'n', { sum: true }), C('factory', 'في المصنع', 'n', { sum: true }),
          C('office', 'في الإدارة', 'n', { sum: true }), C('none', 'غير موزّع', 'n', { sum: true }), C('today', 'حاضر اليوم', 'n', { sum: true })],
        rows: rows.map((r) => ({ ...r, projects: r.projects ?? 0, factory: r.factory ?? 0, office: r.office ?? 0, none: r.none ?? 0, today: r.today ?? 0 })),
        cards: (r, t) => [card('عدد المهن', r.length, 'n'), card('إجمالي العمال', t.total, 'n')],
      };
    }
    case 'projects': {
      const w = [`p.kind = 'project'`, inScope('p.id')];
      if (PST[q.status]) w.push(`p.status = '${q.status}'`);
      const t = todayStr();
      const rows = db.prepare(`SELECT p.*,
          (SELECT COUNT(*) FROM workers w WHERE w.project_id = p.id AND w.active = 1) AS workers,
          (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = '${t}' AND a.status IN ('present','late','overtime')) AS today,
          (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status <> 'closed') AS issues,
          (SELECT COALESCE(SUM(gross), 0) FROM invoices v WHERE v.project_id = p.id AND v.kind = 'client' AND v.status IN ('approved','paid')) AS billed,
          (SELECT MAX(date) FROM daily_reports d WHERE d.project_id = p.id) AS last_report
        FROM projects p WHERE ${w.join(' AND ')} ORDER BY p.status, p.name`).all();
      return {
        columns: [C('name', 'المشروع'), C('status', 'الحالة', 'tag'), C('progress', 'الإنجاز', 'p'), C('time', 'المدة المنقضية', 'p'), C('gap', 'الفرق عن الجدول', 'n', { tone: true }),
          C('end_date', 'التسليم', 'd'), C('workers', 'العمال', 'n', { sum: true }), C('today', 'حاضر اليوم', 'n', { sum: true }), C('issues', 'بلاغات مفتوحة', 'n', { sum: true }),
          C('contract_value', 'قيمة العقد', 'm', { sum: true }), C('billed', 'المستخلص', 'm', { sum: true }), C('last_report', 'آخر تقرير', 'd')],
        rows: rows.map((p) => {
          const time = Math.max(0, Math.min(100, round(((daysBetween(p.start_date, t) - 1) / Math.max(1, daysBetween(p.start_date, p.end_date) - 1)) * 100)));
          return { name: p.name, status: PST[p.status] ?? p.status, progress: p.progress, time, gap: round(p.progress - time), end_date: p.end_date, workers: p.workers, today: p.today, issues: p.issues, contract_value: p.contract_value, billed: round(p.billed), last_report: p.last_report };
        }),
        cards: (r) => [card('المشاريع', r.length, 'n'), card('متأخرة عن الجدول', r.filter((x) => x.gap < -15).length, 'n', 'bad')],
        note: 'الفرق عن الجدول = نسبة الإنجاز − نسبة المدة المنقضية (السالب يعني تأخر).',
      };
    }
    case 'daily_reports': {
      const rows = db.prepare(`SELECT d.date, p.name AS project, d.weather, d.work_done, d.next_plan, d.obstacles, d.progress, u.name AS author
        FROM daily_reports d JOIN projects p ON p.id = d.project_id LEFT JOIN users u ON u.id = d.created_by
        WHERE d.date BETWEEN $from AND $to AND ${inScope('d.project_id')} ORDER BY d.date DESC, p.name`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('project', 'المشروع'), C('work_done', 'الأعمال المنجزة', 'long'), C('obstacles', 'العوائق', 'long'), C('next_plan', 'خطة الغد', 'long'), C('progress', 'الإنجاز', 'p'), C('author', 'كتبه')],
        rows,
        cards: (r) => [card('عدد التقارير', r.length, 'n'), card('فيها عوائق', r.filter((x) => x.obstacles).length, 'n', 'bad')],
      };
    }
    case 'issues': {
      const w = [`substr(i.created_at,1,10) BETWEEN $from AND $to`, inScope('i.project_id')];
      if (ISSUE[q.status]) w.push(`i.status = '${q.status}'`);
      if (SEV[q.severity]) w.push(`i.severity = '${q.severity}'`);
      const now = `${todayStr()}T23:59`;
      const rows = db.prepare(`SELECT i.*, p.name AS project, a.name AS assignee, r.name AS reporter FROM issues i JOIN projects p ON p.id = i.project_id
        LEFT JOIN users a ON a.id = i.assignee_id LEFT JOIN users r ON r.id = i.reported_by WHERE ${w.join(' AND ')} ORDER BY i.created_at DESC`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('project', 'المشروع'), C('title', 'البلاغ'), C('category', 'النوع'), C('severity', 'الخطورة', 'tag'), C('status', 'الحالة', 'tag'),
          C('assignee', 'المسؤول'), C('due', 'المهلة', 'd'), C('late', 'متأخر؟'), C('resolution', 'الحل', 'long')],
        rows: rows.map((i) => ({ date: i.created_at.slice(0, 10), project: i.project, title: i.title, category: CAT[i.category], severity: SEV[i.severity], status: ISSUE[i.status], assignee: i.assignee ?? '—',
          due: (i.due_at || '').slice(0, 10), late: i.status !== 'closed' && i.due_at && i.due_at < now ? 'نعم' : '', resolution: i.resolution ?? '' })),
        cards: (r) => [card('البلاغات', r.length, 'n'), card('مفتوحة', r.filter((x) => x.status !== 'مغلق').length, 'n', 'bad'), card('متأخرة', r.filter((x) => x.late).length, 'n', 'bad')],
      };
    }
    case 'direct_orders': {
      const w = [`o.date BETWEEN $from AND $to`, inScope('o.project_id')];
      if (ORD[q.status]) w.push(`o.status = '${q.status}'`);
      const rows = db.prepare(`SELECT o.*, p.name AS project, s.name AS sub,
          (SELECT COALESCE(SUM(qty * unit_price), 0) FROM direct_order_items x WHERE x.order_id = o.id) AS value,
          (SELECT COALESCE(SUM(done_qty * unit_price), 0) FROM direct_order_items x WHERE x.order_id = o.id) AS done
        FROM direct_orders o JOIN projects p ON p.id = o.project_id LEFT JOIN subcontractors s ON s.id = o.subcontractor_id WHERE ${w.join(' AND ')} ORDER BY o.date DESC`).all(P);
      return {
        columns: [C('date', 'التاريخ', 'd'), C('number', 'الرقم'), C('title', 'العنوان'), C('project', 'المشروع'), C('sub', 'المقاول'), C('due_date', 'موعد التنفيذ', 'd'),
          C('status', 'الحالة', 'tag'), C('value', 'القيمة', 'm', { sum: true }), C('done', 'المنفذ', 'm', { sum: true })],
        rows: rows.map((o) => ({ date: o.date, number: o.number, title: o.title, project: o.project, sub: o.sub ?? '—', due_date: o.due_date, status: ORD[o.status], value: round(o.value), done: round(o.done) })),
        cards: (r, t) => [card('عدد الأوامر', r.length, 'n'), card('القيمة', t.value), card('المنفذ', t.done, 'm', 'good')],
      };
    }
  }
  throw new ReportError(404, 'التقرير غير موجود');
}
