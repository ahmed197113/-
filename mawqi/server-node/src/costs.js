// Real cost of each project: labour (attendance) + iqama renewals of its workers + an equal share of head-office costs.
import { db, officeId } from './db.js';
import { round, todayStr } from './util.js';

export const RATE = `(CASE w.wage_type WHEN 'daily' THEN w.wage ELSE w.wage / 30.0 END)`;
export const COST = `(CASE WHEN a.status IN ('present','late','overtime') THEN ${RATE} + a.overtime_hours * ${RATE} / 8.0 * 1.5 ELSE 0 END)`;

const dayMs = 864e5;
const days = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / dayMs) + 1;

export function monthBounds(month) {
  const from = `${month}-01`;
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  const to = d.toISOString().slice(0, 10);
  const today = todayStr();
  return { from, to, toCapped: to > today ? today : to };
}

/** Months (YYYY-MM) from one date to another, inclusive. */
export function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; i < 600; i++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (k > end) break;
    out.push(k);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const cache = new Map();
/**
 * Head-office cost of one month and how it is shared:
 * salaries of the admin staff for the days they belonged to «الإدارة» + their iqama renewals,
 * divided equally between the projects running that month.
 */
export function overheadMonth(month, detail = false) {
  const key = `${month}|${detail}|${todayStr()}|${db.prepare(`SELECT value FROM settings WHERE key = 'data_version'`).get()?.value ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const { from, to, toCapped } = monthBounds(month);
  const office = officeId();
  const empty = { month, from, to: toCapped, salaries: 0, iqama: 0, total: 0, projects: [], share: 0, staff: [], renewals: [] };
  if (!office || toCapped < from) return empty;
  const staffRows = db.prepare(`
    SELECT w.id, w.name, w.profession, w.wage, w.wage_type, ${RATE} AS rate, wa.from_date, COALESCE(wa.to_date, $to) AS to_date,
      (SELECT MIN(x.from_date) FROM worker_assignments x WHERE x.worker_id = w.id) AS first_from
    FROM worker_assignments wa JOIN workers w ON w.id = wa.worker_id
    WHERE wa.project_id = $office AND wa.from_date <= $to AND COALESCE(wa.to_date, $to) >= $from AND (w.active = 1 OR wa.to_date IS NOT NULL)`)
    .all({ $office: office, $from: from, $to: to });
  const staff = new Map();
  for (const r of staffRows) {
    // Salaries are a monthly commitment: a staff member counts for the whole month,
    // except the days before he moved into the office or after he left it.
    const start = r.from_date === r.first_from ? from : r.from_date;
    const a = start > from ? start : from;
    const b = r.to_date < to ? r.to_date : to;
    const n = Math.max(0, days(a, b));
    const s = staff.get(r.id) ?? { id: r.id, name: r.name, profession: r.profession, wage: r.wage, wage_type: r.wage_type, days: 0, cost: 0 };
    const monthDays = days(from, to);
    s.days += n; s.cost += r.wage_type === 'monthly' ? (r.wage * n) / monthDays : n * r.rate;
    staff.set(r.id, s);
  }
  const renewals = db.prepare(`SELECT r.id, r.date, r.amount, w.name FROM iqama_renewals r JOIN workers w ON w.id = r.worker_id
    WHERE r.project_id = ? AND r.date BETWEEN ? AND ? ORDER BY r.date`).all(office, from, toCapped);
  const salaries = [...staff.values()].reduce((t, s) => t + s.cost, 0);
  const iqama = renewals.reduce((t, r) => t + r.amount, 0);
  const projects = db.prepare(`SELECT id, name FROM projects WHERE kind = 'project' AND start_date <= ?
    AND (status = 'active' OR (status = 'done' AND end_date >= ?)) ORDER BY name`).all(toCapped, from);
  const total = salaries + iqama;
  const out = {
    month, from, to: toCapped, salaries: round(salaries), iqama: round(iqama), total: round(total), projects,
    share: projects.length ? round(total / projects.length) : 0,
    staff: detail ? [...staff.values()].map((s) => ({ ...s, cost: round(s.cost) })) : [], renewals: detail ? renewals : [],
  };
  if (cache.size > 300) cache.clear();
  cache.set(key, out);
  return out;
}

/** Office share for one project over a list of months. */
export function overheadFor(projectId, months) {
  let t = 0;
  for (const m of months) {
    const o = overheadMonth(m);
    if (o.projects.some((p) => p.id === projectId)) t += o.share;
  }
  return round(t);
}

/** Full cost of a project for a date range. */
export function projectCost(projectId, from, to, custody = 0) {
  const labour = db.prepare(`SELECT COALESCE(SUM(${COST}), 0) AS v FROM attendance a JOIN workers w ON w.id = a.worker_id
    WHERE a.project_id = ? AND a.date BETWEEN ? AND ?`).get(projectId, from, to).v;
  const iqama = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM iqama_renewals WHERE project_id = ? AND date BETWEEN ? AND ?`).get(projectId, from, to).v;
  const overhead = overheadFor(projectId, monthsBetween(from, to));
  return { labour: round(labour), iqama: round(iqama), overhead, custody: round(custody), total: round(labour + iqama + overhead + custody) };
}
