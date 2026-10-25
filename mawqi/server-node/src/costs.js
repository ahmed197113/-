// Real cost of each project: labour (attendance) + worker fees (iqama, work card, insurance) spread over their months
// + a share of head-office costs in proportion to the project's worker-days.
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
const version = () => db.prepare(`SELECT value FROM settings WHERE key = 'data_version'`).get()?.value ?? '';
const cached = (key, fn) => {
  const k = `${key}|${todayStr()}|${version()}`;
  if (cache.has(k)) return cache.get(k);
  const v = fn();
  if (cache.size > 500) cache.clear();
  cache.set(k, v);
  return v;
};

/** Kinds of yearly worker fees. */
export const FEE_KINDS = { iqama: 'تجديد إقامة', work_card: 'كرت عمل', insurance: 'تأمين طبي', other: 'رسوم أخرى' };

/** Month key `n` months after `ym` (YYYY-MM). */
export function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Monthly portions of worker fees (iqama, work card, insurance…) for one month.
 * A fee paid for N months is spread equally over the N months from the month it was paid.
 * Each month's portion is charged to the site the worker belonged to in that month
 * (mid-month), or to the site recorded on the payment when that is unknown.
 */
export function feePortions(month) {
  return cached(`fees|${month}`, () => {
    const siteAt = db.prepare(`SELECT project_id FROM worker_assignments WHERE worker_id = ? AND from_date <= ? AND (to_date IS NULL OR to_date >= ?) ORDER BY from_date DESC LIMIT 1`);
    const rows = db.prepare(`SELECT r.id, r.worker_id, r.project_id, r.date, r.amount, COALESCE(r.kind, 'iqama') AS kind, COALESCE(r.months, 1) AS months, w.name, w.profession
      FROM iqama_renewals r JOIN workers w ON w.id = r.worker_id WHERE r.date <= ?`).all(`${month}-31`);
    const out = [];
    for (const r of rows) {
      const n = Math.max(1, Math.round(r.months));
      const start = r.date.slice(0, 7);
      if (month < start || month > addMonths(start, n - 1)) continue;
      const i = monthsBetween(`${start}-01`, `${month}-01`).length - 1;
      const project = i === 0 ? r.project_id : siteAt.get(r.worker_id, `${month}-15`, `${month}-15`)?.project_id ?? r.project_id;
      out.push({ id: r.id, worker_id: r.worker_id, name: r.name, profession: r.profession, kind: r.kind, kind_label: FEE_KINDS[r.kind] ?? r.kind,
        date: r.date, total: r.amount, months: n, index: i + 1, month, project_id: project, amount: r.amount / n });
    }
    return out;
  });
}

/** Worker fees charged to each site over a date range: Map(project_id → amount). */
export function feesByProject(from, to) {
  const m = new Map();
  for (const month of monthsBetween(from, to)) for (const f of feePortions(month)) if (f.project_id) m.set(f.project_id, (m.get(f.project_id) ?? 0) + f.amount);
  return m;
}

/**
 * Head-office cost of one month and how it is shared:
 * salaries of the admin staff for the days they belonged to «الإدارة» + their fees (iqama, work card, insurance),
 * divided between the projects running that month in proportion to their worker-days
 * (each worker counts for the days he was assigned to the project that month).
 */
export function overheadMonth(month, detail = false) {
  return cached(`oh|${month}|${detail}`, () => {
  const { from, to, toCapped } = monthBounds(month);
  const office = officeId();
  const empty = { month, from, to: toCapped, salaries: 0, iqama: 0, fees: 0, total: 0, projects: [], share: 0, staff: [], renewals: [], basis: 'workers' };
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
    const s = staff.get(r.id) ?? { id: r.id, name: r.name, profession: r.profession, wage: r.wage, wage_type: r.wage_type, days: 0, cost: 0, fees: 0 };
    const monthDays = days(from, to);
    s.days += n; s.cost += r.wage_type === 'monthly' ? (r.wage * n) / monthDays : n * r.rate;
    staff.set(r.id, s);
  }
  const renewals = feePortions(month).filter((f) => f.project_id === office);
  for (const f of renewals) {
    const s = staff.get(f.worker_id) ?? { id: f.worker_id, name: f.name, profession: f.profession, wage: 0, wage_type: 'monthly', days: 0, cost: 0, fees: 0 };
    s.fees += f.amount; staff.set(f.worker_id, s);
  }
  const salaries = [...staff.values()].reduce((t, s) => t + s.cost, 0);
  const fees = renewals.reduce((t, r) => t + r.amount, 0);
  const projects = db.prepare(`SELECT p.id, p.name,
      (SELECT COALESCE(SUM(MAX(0, julianday(MIN(COALESCE(wa.to_date, $to), $to)) - julianday(MAX(wa.from_date, $from)) + 1)), 0)
        FROM worker_assignments wa JOIN workers w ON w.id = wa.worker_id
        WHERE wa.project_id = p.id AND wa.from_date <= $to AND COALESCE(wa.to_date, $to) >= $from AND (w.active = 1 OR wa.to_date IS NOT NULL)) AS worker_days
    FROM projects p WHERE p.kind = 'project' AND p.start_date <= $to
    AND (p.status = 'active' OR (p.status = 'done' AND p.end_date >= $from)) ORDER BY p.name`).all({ $from: from, $to: toCapped });
  const total = salaries + fees;
  const allDays = projects.reduce((t, p) => t + p.worker_days, 0);
  // No workers on any project this month → fall back to an equal split.
  const basis = allDays > 0 ? 'workers' : 'equal';
  for (const p of projects) {
    p.worker_days = Math.round(p.worker_days);
    p.workers = Math.round((p.worker_days / days(from, toCapped)) * 10) / 10;
    p.pct = projects.length ? Math.round((basis === 'workers' ? p.worker_days / allDays : 1 / projects.length) * 1000) / 10 : 0;
    p.share = round(basis === 'workers' ? (total * p.worker_days) / allDays : total / projects.length);
  }
  return {
    month, from, to: toCapped, salaries: round(salaries), iqama: round(fees), fees: round(fees), total: round(total), projects, basis,
    share: projects.length ? round(total / projects.length) : 0,
    staff: detail ? [...staff.values()].map((s) => ({ ...s, cost: round(s.cost), fees: round(s.fees), total: round(s.cost + s.fees) })) : [],
    renewals: detail ? renewals.map((r) => ({ ...r, amount: round(r.amount) })) : [],
  };
  });
}

/** Office share for one project over a list of months. */
export function overheadFor(projectId, months) {
  let t = 0;
  for (const m of months) t += overheadMonth(m).projects.find((p) => p.id === projectId)?.share ?? 0;
  return round(t);
}

/** Full cost of a project for a date range. */
export function projectCost(projectId, from, to, custody = 0) {
  const labour = db.prepare(`SELECT COALESCE(SUM(${COST}), 0) AS v FROM attendance a JOIN workers w ON w.id = a.worker_id
    WHERE a.project_id = ? AND a.date BETWEEN ? AND ?`).get(projectId, from, to).v;
  const iqama = feesByProject(from, to).get(projectId) ?? 0;
  const overhead = overheadFor(projectId, monthsBetween(from, to));
  return { labour: round(labour), iqama: round(iqama), overhead, custody: round(custody), total: round(labour + iqama + overhead + custody) };
}
