'use strict';
const { projectScope, can } = require('../permissions');
const { h, today, addDays, nowIso } = require('../util');
const { laborCost, consecutiveAbsentees } = require('../services');
const { projectStats } = require('./projects');

module.exports = (api, { db }) => {
  api.get('/dashboard', h((req, res) => {
    const u = req.user;
    const d = today();
    const s = projectScope(u);
    const projects = projectStats(db, db.prepare(`SELECT p.*, m.name manager_name, sv.name supervisor_name FROM projects p
      LEFT JOIN users m ON m.id = p.manager_id LEFT JOIN users sv ON sv.id = p.supervisor_id
      WHERE ${s.sql} AND p.status = 'active' ORDER BY p.name`).all(...s.params), u);
    const ids = projects.map((p) => p.id);
    const inList = `(${ids.map(() => '?').join(',') || 'NULL'})`;

    const totalWorkers = db.prepare(`SELECT COUNT(*) c FROM workers WHERE active = 1 AND project_id IN ${inList}`).get(...ids).c;
    const todayRows = db.prepare(`SELECT status, COUNT(*) c FROM attendance WHERE date = ? AND project_id IN ${inList} GROUP BY status`).all(d, ...ids);
    const t = Object.fromEntries(todayRows.map((r) => [r.status, r.c]));
    const openIssues = db.prepare(`SELECT COUNT(*) c FROM issues WHERE status != 'closed' AND project_id IN ${inList}`).get(...ids).c;

    const from = addDays(d, -29);
    const series = db.prepare(`SELECT date, SUM(status IN ('present','late')) present, SUM(status = 'absent') absent
      FROM attendance WHERE date BETWEEN ? AND ? AND project_id IN ${inList} GROUP BY date ORDER BY date`).all(from, d, ...ids);

    // التنبيهات
    const alerts = [];
    for (const p of projects) {
      if (p.planned_workers > 0 && p.present_today < p.planned_workers * 0.8) {
        const pct = Math.round((1 - p.present_today / p.planned_workers) * 100);
        alerts.push({ type: 'understaffed', level: 'warning', text: `${p.name}: الحاضرون ${p.present_today} من ${p.planned_workers} (أقل بـ ${pct}%)`, link: `#/projects/${p.id}` });
      }
    }
    const visibleWorkers = new Set(db.prepare(`SELECT id FROM workers WHERE active = 1 AND project_id IN ${inList}`).all(...ids).map((r) => r.id));
    const absentees = consecutiveAbsentees(db, visibleWorkers);
    if (absentees.length) {
      const names = db.prepare(`SELECT id, name FROM workers WHERE id IN (${absentees.map(() => '?').join(',')})`).all(...absentees);
      for (const w of names) alerts.push({ type: 'absent3', level: 'danger', text: `${w.name}: غائب 3 أيام متتالية`, link: `#/workers/${w.id}` });
    }
    const overdue = db.prepare(`SELECT i.id, i.title, p.name project_name FROM issues i JOIN projects p ON p.id = i.project_id
      WHERE i.status != 'closed' AND i.due_at < ? AND i.project_id IN ${inList} ORDER BY i.due_at`).all(nowIso(), ...ids);
    for (const i of overdue) alerts.push({ type: 'overdue_issue', level: 'danger', text: `بلاغ متأخر: ${i.title} — ${i.project_name}`, link: `#/issues/${i.id}` });
    const iqama = db.prepare(`SELECT id, name, iqama_expiry FROM workers WHERE active = 1 AND iqama_expiry <= ?
      AND project_id IN ${inList} ORDER BY iqama_expiry`).all(addDays(d, 30), ...ids);
    for (const w of iqama) alerts.push({ type: 'iqama', level: w.iqama_expiry < d ? 'danger' : 'warning', text: `إقامة ${w.name} ${w.iqama_expiry < d ? 'منتهية' : 'تنتهي'} في ${w.iqama_expiry}`, link: `#/workers/${w.id}` });

    const out = {
      date: d,
      cards: {
        total_workers: totalWorkers,
        present_today: (t.present || 0) + (t.late || 0),
        absent_today: t.absent || 0,
        late_today: t.late || 0,
        leave_today: t.leave || 0,
        not_recorded: Math.max(0, totalWorkers - Object.values(t).reduce((a, b) => a + b, 0)),
        open_issues: openIssues,
      },
      projects,
      attendance_series: series,
      alerts,
    };
    if (can(u, 'costs.view')) {
      const month = laborCost(db, { from: d.slice(0, 8) + '01', to: d });
      out.cards.cost_today = projects.reduce((a, p) => a + (p.cost_today || 0), 0);
      out.cost_by_project = projects.map((p) => ({ id: p.id, name: p.name, cost_month: month.byProject[p.id] || 0 }));
    }
    if (can(u, 'invoices.view')) {
      out.invoices_pending = db.prepare(`SELECT COUNT(*) c FROM invoices WHERE status IN ('submitted','approved','partially_paid') AND project_id IN ${inList}`).get(...ids).c;
    }
    res.json(out);
  }));
};
