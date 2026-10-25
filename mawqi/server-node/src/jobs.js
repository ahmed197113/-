import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { db, getSetting, DB_PATH } from './db.js';
import { nowTime, todayStr, isFriday } from './util.js';

/** Mark as absent every active worker not recorded today once the cutoff time has passed. */
export function autoMarkAbsent() {
  const today = todayStr();
  // Off unless switched on: the site engineers and supervisors are reminded until they record attendance,
  // instead of everyone being marked absent automatically.
  if (getSetting('absence_auto', '0') !== '1') return [];
  if (isFriday(today) || nowTime() < getSetting('absence_cutoff', '09:00')) return [];
  const missing = db.prepare(`
    SELECT w.id, w.project_id FROM workers w JOIN projects p ON p.id = w.project_id
    WHERE w.active = 1 AND p.kind <> 'office'
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

/** Daily backup: copy the database into <db folder>/backups/mawqi-YYYY-MM-DD.db, keep the last 14. */
export function dailyBackup() {
  const dir = join(dirname(DB_PATH), 'backups');
  const file = join(dir, `mawqi-${todayStr()}.db`);
  if (existsSync(file)) return;
  try {
    mkdirSync(dir, { recursive: true });
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const old = readdirSync(dir).filter((f) => /^mawqi-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -14);
    for (const f of old) rmSync(join(dir, f), { force: true });
  } catch (e) {
    console.error('backup failed:', e.message);
  }
}

export function startJobs(broadcast) {
  const tick = () => {
    dailyBackup();
    for (const projectId of autoMarkAbsent()) broadcast('data:changed', { entity: 'attendance', projectId });
    for (const i of escalateOverdue()) {
      broadcast('notify', { projectId: i.project_id, title: 'تصعيد بلاغ متأخر', body: i.title });
      broadcast('data:changed', { entity: 'issues', projectId: i.project_id });
    }
  };
  tick();
  setInterval(tick, 60_000);
}
