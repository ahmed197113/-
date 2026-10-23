'use strict';
// حسابات التكلفة والرواتب والإشعارات
const { round2, addDays, nowIso, today } = require('./util');
const { getSetting } = require('./db');

const OT_MULTIPLIER = 1.5;
const WORK_HOURS = 8;
const WORKED = "('present','late')";

function dailyRate(w) {
  return w.wage_type === 'monthly' ? w.wage / 30 : w.wage;
}
function hourlyRate(w) {
  return dailyRate(w) / WORK_HOURS;
}

// تكلفة العمالة لمشروع (أو لكل المشاريع) خلال فترة
function laborCost(db, { projectId = null, from, to }) {
  const rows = db.prepare(`
    SELECT a.project_id, a.status, a.overtime_hours, w.wage, w.wage_type
    FROM attendance a JOIN workers w ON w.id = a.worker_id
    WHERE a.date BETWEEN ? AND ? AND a.status IN ${WORKED}
      ${projectId ? 'AND a.project_id = ?' : ''}`).all(...[from, to, ...(projectId ? [projectId] : [])]);
  const byProject = {};
  let total = 0;
  for (const r of rows) {
    const c = dailyRate(r) + r.overtime_hours * hourlyRate(r) * OT_MULTIPLIER;
    byProject[r.project_id] = (byProject[r.project_id] || 0) + c;
    total += c;
  }
  for (const k of Object.keys(byProject)) byProject[k] = round2(byProject[k]);
  return { total: round2(total), byProject };
}

// ملخص حضور عامل لفترة
function attendanceSummary(db, workerId, from, to) {
  const rows = db.prepare(`SELECT status, COUNT(*) c, SUM(overtime_hours) ot FROM attendance
    WHERE worker_id = ? AND date BETWEEN ? AND ? GROUP BY status`).all(workerId, from, to);
  const s = { present: 0, late: 0, absent: 0, leave: 0, overtime_hours: 0 };
  for (const r of rows) {
    s[r.status] = r.c;
    s.overtime_hours += r.ot || 0;
  }
  s.worked_days = s.present + s.late;
  s.overtime_hours = round2(s.overtime_hours);
  return s;
}

// مسير الرواتب: أيام العمل × الأجر + الإضافي − الغياب
function payrollLine(worker, s) {
  const dr = dailyRate(worker);
  const otPay = round2(s.overtime_hours * hourlyRate(worker) * OT_MULTIPLIER);
  let base;
  let absenceDeduction;
  if (worker.wage_type === 'monthly') {
    base = worker.wage;
    absenceDeduction = round2(s.absent * dr);
  } else {
    base = round2(s.worked_days * dr);
    absenceDeduction = 0; // العامل باليومية لا يُدفع له عن أيام الغياب أصلاً
  }
  return {
    base: round2(base),
    overtime_pay: otPay,
    absence_deduction: absenceDeduction,
    net: round2(base + otPay - absenceDeduction),
    daily_rate: round2(dr),
  };
}

function invoiceTotals(inv, items, payments = []) {
  const gross = round2(items.reduce((s, i) => s + i.qty * i.unit_price, 0));
  const retention = round2((gross * inv.retention_pct) / 100);
  const vat = round2((gross * inv.vat_pct) / 100);
  const net = round2(gross + vat - retention - inv.deductions);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  return { gross, retention, vat, deductions: inv.deductions, net, paid, remaining: round2(net - paid) };
}

// ---------------------------------------------------------------- الإشعارات
let pushSender = null; // يُضبط من push.js

function notify(db, userIds, { title, body = '', link = '', dedupe = null }) {
  const ins = db.prepare(`INSERT OR IGNORE INTO notifications(user_id, title, body, link, dedupe_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const sent = [];
  for (const uid of new Set(userIds.filter(Boolean))) {
    const r = ins.run(uid, title, body, link, dedupe, nowIso());
    if (r.changes) sent.push(uid);
  }
  if (pushSender && sent.length) pushSender(sent, { title, body, link }).catch(() => {});
  return sent.length;
}

function setPushSender(fn) {
  pushSender = fn;
}

function managementIds(db, projectId = null) {
  const ids = db.prepare("SELECT id FROM users WHERE role IN ('gm','owner') AND active = 1").all().map((r) => r.id);
  if (projectId) {
    const p = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(projectId);
    if (p && p.manager_id) ids.push(p.manager_id);
  }
  return ids;
}

// ---------------------------------------------------------------- مهام دورية
const isFriday = (date) => new Date(date + 'T00:00:00Z').getUTCDay() === 5;

// تسجيل الغياب تلقائياً لمن لم يُحضَّر حتى الساعة المحددة
function autoAbsence(db, date, time) {
  if (isFriday(date)) return 0;
  const cutoff = getSetting(db, 'absence_cutoff');
  if (time < cutoff) return 0;
  const r = db.prepare(`INSERT INTO attendance(worker_id, project_id, date, status, method)
    SELECT w.id, w.project_id, ?, 'absent', 'auto' FROM workers w
    JOIN projects p ON p.id = w.project_id AND p.status = 'active'
    WHERE w.active = 1 AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.worker_id = w.id AND a.date = ?)`).run(date, date);
  return Number(r.changes);
}

// تصعيد البلاغات المتجاوزة للمهلة إلى الإدارة
function escalateIssues(db) {
  const now = nowIso();
  const due = db.prepare(`SELECT i.*, p.name project_name FROM issues i JOIN projects p ON p.id = i.project_id
    WHERE i.status != 'closed' AND i.escalated = 0 AND i.due_at IS NOT NULL AND i.due_at < ?`).all(now);
  const upd = db.prepare('UPDATE issues SET escalated = 1 WHERE id = ?');
  for (const i of due) {
    upd.run(i.id);
    notify(db, managementIds(db, i.project_id), {
      title: 'تصعيد: بلاغ تجاوز المهلة',
      body: `${i.title} — ${i.project_name}`,
      link: `#/issues/${i.id}`,
      dedupe: `escalate:${i.id}`,
    });
  }
  return due.length;
}

// تنبيه قبل انتهاء الإقامة بـ 30 يوماً
function iqamaAlerts(db, date) {
  const rows = db.prepare(`SELECT id, name, iqama_expiry, project_id FROM workers
    WHERE active = 1 AND iqama_expiry IS NOT NULL AND iqama_expiry <= ?`).all(addDays(date, 30));
  for (const w of rows) {
    notify(db, managementIds(db, w.project_id), {
      title: w.iqama_expiry < date ? 'إقامة منتهية' : 'إقامة تقترب من الانتهاء',
      body: `${w.name} — تنتهي في ${w.iqama_expiry}`,
      link: `#/workers/${w.id}`,
      dedupe: `iqama:${w.id}:${w.iqama_expiry}`,
    });
  }
  return rows.length;
}

// عمال غابوا آخر 3 أيام عمل مسجلة متتالية
function consecutiveAbsentees(db, workerIds = null, days = 3) {
  const rows = db.prepare(`SELECT a.worker_id, a.status, a.date FROM attendance a
    WHERE a.date >= ? ORDER BY a.worker_id, a.date DESC`).all(addDays(today(), -30));
  const out = [];
  let cur = null;
  let streak = [];
  const flush = () => {
    if (cur !== null && streak.length === days && streak.every((s) => s === 'absent')) out.push(cur);
  };
  for (const r of rows) {
    if (r.worker_id !== cur) {
      flush();
      cur = r.worker_id;
      streak = [];
    }
    if (streak.length < days) streak.push(r.status);
  }
  flush();
  return workerIds ? out.filter((id) => workerIds.has(id)) : out;
}

module.exports = {
  dailyRate, hourlyRate, laborCost, attendanceSummary, payrollLine, invoiceTotals,
  notify, setPushSender, managementIds, autoAbsence, escalateIssues, iqamaAlerts, consecutiveAbsentees,
  isFriday, OT_MULTIPLIER, WORK_HOURS,
};
