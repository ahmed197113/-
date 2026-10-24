import { db, memberNames } from './db.js';
import { addDays, nowTime, round, todayStr } from './util.js';

const RATE = `(CASE w.wage_type WHEN 'daily' THEN w.wage ELSE w.wage / 30.0 END)`;
// Labour cost of one attendance row: a day's wage when working, plus overtime at 1.5x hourly.
const COST = `(CASE WHEN a.status IN ('present','late','overtime') THEN ${RATE} + a.overtime_hours * ${RATE} / 8.0 * 1.5 ELSE 0 END)`;

const inList = (col, ids) => (ids === null ? '1=1' : ids.length ? `${col} IN (${ids.map(Number).join(',')})` : '0=1');

export function buildDashboard(scope) {
  const today = todayStr();
  const monthStart = today.slice(0, 8) + '01';
  const from30 = addDays(today, -29);
  const now = `${today}T${nowTime()}`;

  const projects = db.prepare(`
    SELECT p.id, p.name, p.city, p.planned_workers, p.progress, p.start_date, p.end_date,
      ${memberNames('supervisor')} AS supervisor, ${memberNames('manager')} AS manager,
      (SELECT COUNT(*) FROM workers w WHERE w.project_id = p.id AND w.active = 1) AS assigned,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = $today AND a.status IN ('present','late','overtime')) AS present,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = $today AND a.status = 'absent') AS absent,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status <> 'closed') AS open_issues,
      (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date = $today) AS cost_today,
      (SELECT COALESCE(SUM(${COST}), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN $monthStart AND $today) AS cost_month
    FROM projects p
    WHERE ${inList('p.id', scope)}
    ORDER BY p.id`).all({ $today: today, $monthStart: monthStart })
    .map((p) => ({ ...p, cost_today: round(p.cost_today), cost_month: round(p.cost_month) }));

  const pScope = inList('project_id', scope);
  const totalWorkers = db.prepare(`SELECT COUNT(*) AS n FROM workers WHERE active = 1 AND ${pScope}`).get().n;
  const todayCounts = db.prepare(`SELECT status, COUNT(*) AS n FROM attendance WHERE date = ? AND ${pScope} GROUP BY status`).all(today);
  const count = (...st) => todayCounts.filter((r) => st.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const openIssues = db.prepare(`SELECT COUNT(*) AS n FROM issues WHERE status <> 'closed' AND ${pScope}`).get().n;

  const series = db.prepare(`
    SELECT date,
      SUM(status IN ('present','overtime')) AS present,
      SUM(status = 'late') AS late,
      SUM(status = 'absent') AS absent,
      SUM(status = 'leave') AS leave
    FROM attendance WHERE date BETWEEN ? AND ? AND ${pScope}
    GROUP BY date ORDER BY date`).all(from30, today);

  // ---- alerts ----
  const alerts = [];
  for (const p of projects) {
    if (p.present < p.planned_workers * 0.8) {
      const gap = Math.round((1 - p.present / p.planned_workers) * 100);
      alerts.push({ type: 'understaffed', level: 'high', projectId: p.id,
        title: `نقص عمالة في ${p.name}`, detail: `الحاضرون ${p.present} من ${p.planned_workers} مخطط (أقل بـ ${gap}%)` });
    }
  }

  const absentStreaks = db.prepare(`
    SELECT w.id, w.name, p.name AS project FROM (
      SELECT worker_id, status, ROW_NUMBER() OVER (PARTITION BY worker_id ORDER BY date DESC) AS rn
      FROM attendance WHERE date <= ?
    ) r
    JOIN workers w ON w.id = r.worker_id
    JOIN projects p ON p.id = w.project_id
    WHERE r.rn <= 3 AND w.active = 1 AND ${inList('w.project_id', scope)}
    GROUP BY w.id HAVING COUNT(*) = 3 AND SUM(r.status = 'absent') = 3`).all(today);
  for (const w of absentStreaks) {
    alerts.push({ type: 'absence_streak', level: 'medium', workerId: w.id,
      title: `${w.name} غائب 3 أيام متتالية`, detail: w.project });
  }

  const overdue = db.prepare(`
    SELECT i.id, i.title, i.due_at, i.severity, p.name AS project, u.name AS assignee
    FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.assignee_id
    WHERE i.status <> 'closed' AND i.due_at < ? AND ${inList('i.project_id', scope)}
    ORDER BY i.due_at`).all(now);
  for (const i of overdue) {
    alerts.push({ type: 'overdue_issue', level: i.severity === 'critical' || i.severity === 'high' ? 'high' : 'medium', issueId: i.id,
      title: `بلاغ متأخر: ${i.title}`, detail: `${i.project} — المسؤول: ${i.assignee ?? 'غير محدد'} — المهلة ${i.due_at.slice(0, 10)}` });
  }

  const iqama = db.prepare(`
    SELECT id, name, iqama_expiry FROM workers
    WHERE active = 1 AND iqama_expiry BETWEEN ? AND ? AND ${pScope} ORDER BY iqama_expiry`).all(today, addDays(today, 30));
  for (const w of iqama) {
    alerts.push({ type: 'iqama_expiry', level: 'low', workerId: w.id,
      title: `إقامة ${w.name} تنتهي قريباً`, detail: `تاريخ الانتهاء ${w.iqama_expiry}` });
  }

  const order = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  return {
    date: today,
    generatedAt: new Date().toISOString(),
    cards: {
      totalWorkers,
      presentToday: count('present', 'late', 'overtime'),
      absentToday: count('absent'),
      onLeaveToday: count('leave'),
      notRecorded: Math.max(0, totalWorkers - todayCounts.reduce((a, r) => a + r.n, 0)),
      openIssues,
      costToday: round(projects.reduce((a, p) => a + p.cost_today, 0)),
      costMonth: round(projects.reduce((a, p) => a + p.cost_month, 0)),
    },
    projects,
    attendanceSeries: series,
    alerts,
  };
}
