'use strict';
// التقارير والتصدير: Excel وPDF (صفحة طباعة) والرواتب الشهرية
const ExcelJS = require('exceljs');
const { require: need, can, visibleProjectIds, assertProject } = require('../permissions');
const { h, HttpError, today, addDays, isDate, round2 } = require('../util');
const { payrollLine, dailyRate, hourlyRate, OT_MULTIPLIER } = require('../services');
const { getSetting } = require('../db');
const { page, esc, money } = require('../print');

const AFF = { company: 'الشركة', sub: 'مقاول باطن' };
const WAGE = { daily: 'يومي', monthly: 'شهري' };

function scopeIds(db, user, projectId) {
  if (projectId) {
    assertProject(db, user, projectId);
    return [Number(projectId)];
  }
  return visibleProjectIds(db, user);
}

// ملخص حضور لكل عامل في الفترة، مقيّد بمشاريع المستخدم
function attendanceRows(db, user, q) {
  const to = isDate(q.to) ? q.to : today();
  const from = isDate(q.from) ? q.from : addDays(to, -29);
  if (from > to) throw new HttpError(400, 'بداية الفترة بعد نهايتها');
  const ids = scopeIds(db, user, q.project_id);
  const where = [`a.date BETWEEN ? AND ?`, `a.project_id IN (${ids.map(() => '?').join(',') || 'NULL'})`];
  const params = [from, to, ...ids];
  if (q.worker_id) {
    where.push('a.worker_id = ?');
    params.push(Number(q.worker_id));
  }
  if (q.subcontractor_id) {
    where.push('w.subcontractor_id = ?');
    params.push(Number(q.subcontractor_id));
  }
  if (q.affiliation) {
    where.push('w.affiliation = ?');
    params.push(String(q.affiliation));
  }
  const rows = db.prepare(`SELECT w.id, w.name, w.iqama_no, w.nationality, w.profession, w.wage, w.wage_type, w.affiliation,
      s.name subcontractor_name, p.name project_name,
      SUM(a.status = 'present') present, SUM(a.status = 'late') late, SUM(a.status = 'absent') absent,
      SUM(a.status = 'leave') leave, SUM(a.overtime_hours) overtime_hours,
      SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) worked_days
    FROM attendance a JOIN workers w ON w.id = a.worker_id
    LEFT JOIN subcontractors s ON s.id = w.subcontractor_id LEFT JOIN projects p ON p.id = w.project_id
    WHERE ${where.join(' AND ')} GROUP BY w.id ORDER BY p.name, w.name`).all(...params);
  const showCost = can(user, 'costs.view');
  return {
    from, to,
    rows: rows.map((r) => {
      const o = { ...r, overtime_hours: round2(r.overtime_hours || 0) };
      if (showCost) o.cost = round2(r.worked_days * dailyRate(r) + o.overtime_hours * hourlyRate(r) * OT_MULTIPLIER);
      delete o.wage;
      delete o.wage_type;
      return o;
    }),
  };
}

function payrollRows(db, user, q) {
  const month = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : today().slice(0, 7);
  const from = `${month}-01`;
  const end = addDays(addDays(from, 32).slice(0, 8) + '01', -1);
  const to = end < today() ? end : today();
  const ids = scopeIds(db, user, q.project_id);
  const where = [`a.project_id IN (${ids.map(() => '?').join(',') || 'NULL'})`];
  const params = [from, to, ...ids];
  if (q.subcontractor_id) {
    where.push('w.subcontractor_id = ?');
    params.push(Number(q.subcontractor_id));
  }
  if (q.affiliation) {
    where.push('w.affiliation = ?');
    params.push(String(q.affiliation));
  }
  const rows = db.prepare(`SELECT w.*, s.name subcontractor_name, p.name project_name,
      SUM(a.status = 'present') present, SUM(a.status = 'late') late, SUM(a.status = 'absent') absent,
      SUM(a.status = 'leave') leave, SUM(a.overtime_hours) overtime_hours
    FROM workers w JOIN attendance a ON a.worker_id = w.id AND a.date BETWEEN ? AND ?
    LEFT JOIN subcontractors s ON s.id = w.subcontractor_id LEFT JOIN projects p ON p.id = w.project_id
    WHERE ${where.join(' AND ')} GROUP BY w.id ORDER BY w.affiliation, s.name, w.name`).all(...params);
  const lines = rows.map((r) => {
    const s = { present: r.present, late: r.late, absent: r.absent, leave: r.leave, overtime_hours: round2(r.overtime_hours || 0) };
    s.worked_days = s.present + s.late;
    return {
      id: r.id, name: r.name, iqama_no: r.iqama_no, profession: r.profession, nationality: r.nationality,
      affiliation: r.affiliation, subcontractor_name: r.subcontractor_name, project_name: r.project_name,
      wage_type: r.wage_type, wage: r.wage, ...s, ...payrollLine(r, s),
    };
  });
  const totals = lines.reduce((t, l) => {
    for (const k of ['base', 'overtime_pay', 'absence_deduction', 'net']) t[k] = round2((t[k] || 0) + l[k]);
    return t;
  }, {});
  return { month, from, to, rows: lines, totals };
}

async function sendXlsx(res, db, filename, sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = getSetting(db, 'company_name');
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }] });
    ws.mergeCells(1, 1, 1, sh.columns.length);
    ws.getCell(1, 1).value = sh.title;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF1F3A5F' } };
    ws.getRow(2).values = sh.columns.map((c) => c.header);
    ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    sh.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width || 14;
      if (c.money) ws.getColumn(i + 1).numFmt = '#,##0.00';
    });
    for (const r of sh.rows) ws.addRow(sh.columns.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.key])));
    if (sh.totals) {
      const tr = ws.addRow(sh.columns.map((c, i) => (i === 0 ? 'الإجمالي' : sh.totals[c.key] ?? '')));
      tr.font = { bold: true };
    }
  }
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  await wb.xlsx.write(res);
  res.end();
}

const ATT_COLS = (showCost) => [
  { header: 'العامل', key: 'name', width: 24 }, { header: 'رقم الإقامة', key: 'iqama_no' },
  { header: 'المهنة', key: 'profession' }, { header: 'المشروع', key: 'project_name', width: 22 },
  { header: 'الجهة', value: (r) => (r.affiliation === 'sub' ? r.subcontractor_name : 'الشركة'), width: 20 },
  { header: 'حاضر', key: 'present', width: 8 }, { header: 'متأخر', key: 'late', width: 8 },
  { header: 'غائب', key: 'absent', width: 8 }, { header: 'إجازة', key: 'leave', width: 8 },
  { header: 'ساعات إضافية', key: 'overtime_hours', width: 12 },
  ...(showCost ? [{ header: 'التكلفة', key: 'cost', money: true }] : []),
];

const PAY_COLS = [
  { header: 'العامل', key: 'name', width: 24 }, { header: 'رقم الإقامة', key: 'iqama_no' },
  { header: 'المهنة', key: 'profession' }, { header: 'الجهة', value: (r) => (r.affiliation === 'sub' ? r.subcontractor_name : 'الشركة'), width: 20 },
  { header: 'المشروع', key: 'project_name', width: 22 }, { header: 'نوع الأجر', value: (r) => WAGE[r.wage_type], width: 9 },
  { header: 'الأجر', key: 'wage', money: true }, { header: 'أيام العمل', key: 'worked_days', width: 9 },
  { header: 'غياب', key: 'absent', width: 7 }, { header: 'إضافي (ساعة)', key: 'overtime_hours', width: 10 },
  { header: 'الأساسي', key: 'base', money: true }, { header: 'قيمة الإضافي', key: 'overtime_pay', money: true },
  { header: 'خصم الغياب', key: 'absence_deduction', money: true }, { header: 'الصافي', key: 'net', money: true },
];

function htmlTable(cols, rows, totals) {
  return `<table><tr>${cols.map((c) => `<th>${esc(c.header)}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${cols.map((c) => {
      const v = typeof c.value === 'function' ? c.value(r) : r[c.key];
      return `<td>${c.money ? money(v) : esc(v)}</td>`;
    }).join('')}</tr>`).join('')}
    ${totals ? `<tr class="tot">${cols.map((c, i) => `<td>${i === 0 ? 'الإجمالي' : totals[c.key] !== undefined ? money(totals[c.key]) : ''}</td>`).join('')}</tr>` : ''}</table>`;
}

module.exports = (api, { db }) => {
  api.get('/exports/attendance', h(async (req, res) => {
    const data = attendanceRows(db, req.user, req.query);
    const showCost = can(req.user, 'costs.view');
    const cols = ATT_COLS(showCost);
    const title = `تقرير الحضور من ${data.from} إلى ${data.to}`;
    const totals = showCost ? { cost: round2(data.rows.reduce((s, r) => s + r.cost, 0)) } : null;
    if (req.query.format === 'xlsx') {
      return sendXlsx(res, db, `attendance-${data.from}-${data.to}.xlsx`, [{ name: 'الحضور', title, columns: cols, rows: data.rows, totals }]);
    }
    if (req.query.format === 'html') return res.type('html').send(page(db, title, htmlTable(cols, data.rows, totals)));
    res.json({ ...data, totals });
  }));

  api.get('/exports/payroll', need('payroll.view'), h(async (req, res) => {
    const data = payrollRows(db, req.user, req.query);
    const title = `مسير رواتب شهر ${data.month}`;
    if (req.query.format === 'xlsx') {
      return sendXlsx(res, db, `payroll-${data.month}.xlsx`, [{ name: 'الرواتب', title, columns: PAY_COLS, rows: data.rows, totals: data.totals }]);
    }
    if (req.query.format === 'html') {
      return res.type('html').send(page(db, title, `${htmlTable(PAY_COLS, data.rows, data.totals)}
        <p class="muted">الصافي = أيام العمل × الأجر اليومي + الإضافي (×${OT_MULTIPLIER}) − خصم الغياب (للأجر الشهري: الأجر ÷ 30 لكل يوم غياب)</p>
        <div class="sig"><div>المحاسب</div><div>المدير المالي</div><div>المدير العام</div></div>`));
    }
    res.json(data);
  }));

  // تقرير مجمّع حسب المشروع أو المقاول الباطن
  api.get('/exports/summary', h(async (req, res) => {
    const data = attendanceRows(db, req.user, req.query);
    const by = req.query.group === 'subcontractor' ? 'subcontractor' : 'project';
    const groups = {};
    for (const r of data.rows) {
      const k = by === 'project' ? r.project_name || '—' : r.affiliation === 'sub' ? r.subcontractor_name : AFF.company;
      const g = (groups[k] ||= { name: k, workers: 0, worked_days: 0, absent: 0, late: 0, overtime_hours: 0, cost: 0 });
      g.workers++;
      g.worked_days += r.worked_days;
      g.absent += r.absent;
      g.late += r.late;
      g.overtime_hours = round2(g.overtime_hours + r.overtime_hours);
      if (r.cost !== undefined) g.cost = round2(g.cost + r.cost);
    }
    const rows = Object.values(groups);
    const showCost = can(req.user, 'costs.view');
    const cols = [
      { header: by === 'project' ? 'المشروع' : 'الجهة', key: 'name', width: 26 }, { header: 'عدد العمال', key: 'workers' },
      { header: 'أيام العمل', key: 'worked_days' }, { header: 'غياب', key: 'absent' }, { header: 'تأخير', key: 'late' },
      { header: 'ساعات إضافية', key: 'overtime_hours' }, ...(showCost ? [{ header: 'التكلفة', key: 'cost', money: true }] : []),
    ];
    const title = `ملخص ${by === 'project' ? 'المشاريع' : 'المقاولين'} من ${data.from} إلى ${data.to}`;
    if (req.query.format === 'xlsx') return sendXlsx(res, db, `summary-${by}.xlsx`, [{ name: 'ملخص', title, columns: cols, rows }]);
    if (req.query.format === 'html') return res.type('html').send(page(db, title, htmlTable(cols, rows)));
    res.json({ from: data.from, to: data.to, group: by, rows });
  }));
};

module.exports.payrollRows = payrollRows;
module.exports.attendanceRows = attendanceRows;
