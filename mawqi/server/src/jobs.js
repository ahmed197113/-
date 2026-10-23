import { db, getSetting } from './db.js';
import { nowTime, todayStr, isFriday } from './util.js';

/** Mark as absent every active worker not recorded today once the cutoff time has passed. */
export function autoMarkAbsent() {
  const today = todayStr();
  if (isFriday(today) || nowTime() < getSetting('absence_cutoff', '09:00')) return [];
  const missing = db.prepare(`
    SELECT w.id, w.project_id FROM workers w
    WHERE w.active = 1 AND w.project_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.worker_id = w.id AND a.date = ?)`).all(today);
  const ins = db.prepare(`INSERT INTO attendance (worker_id, project_id, date, status, method) VALUES (?, ?, ?, 'absent', 'auto')`);
  for (const w of missing) ins.run(w.id, w.project_id, today);
  return [...new Set(missing.map((w) => w.project_id))];
}

/** Flag issues past their deadline as escalated to the general manager. */
export function escalateOverdue() {
  const now = `${todayStr()}T${nowTime()}`;
  const rows = db.prepare(`SELECT id, project_id, title FROM issues WHERE status <> 'closed' AND escalated = 0 AND due_at < ?`).all(now);
  const upd = db.prepare('UPDATE issues SET escalated = 1 WHERE id = ?');
  for (const r of rows) upd.run(r.id);
  return rows;
}

export function startJobs(broadcast) {
  const tick = () => {
    for (const projectId of autoMarkAbsent()) broadcast('data:changed', { entity: 'attendance', projectId });
    for (const i of escalateOverdue()) {
      broadcast('notify', { projectId: i.project_id, title: 'تصعيد بلاغ متأخر', body: i.title });
      broadcast('data:changed', { entity: 'issues', projectId: i.project_id });
    }
  };
  tick();
  setInterval(tick, 60_000);
}
