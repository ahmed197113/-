// Live demo: logs in as a supervisor and changes today's attendance every few seconds,
// so you can watch the web dashboard and the phone app update at the same time.
// Usage: npm run simulate  (server must be running)
const BASE = process.env.MAWQI_URL || 'http://localhost:4000';

const { DatabaseSync } = await import('node:sqlite');
const { DB_PATH } = await import('../src/db.js');
const { todayStr } = await import('../src/util.js');
const db = new DatabaseSync(DB_PATH);

const statuses = ['present', 'late', 'absent', 'overtime'];
const today = todayStr();
const rows = db.prepare('SELECT id, project_id FROM attendance WHERE date = ?').all(today);

for (let i = 0; i < 20; i++) {
  const r = rows[Math.floor(Math.random() * rows.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  db.prepare('UPDATE attendance SET status = ?, overtime_hours = ? WHERE id = ?').run(status, status === 'overtime' ? 2 : 0, r.id);
  await fetch(`${BASE}/api/dev/ping`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: r.project_id }) });
  console.log(`attendance #${r.id} -> ${status}`);
  await new Promise((res) => setTimeout(res, 3000));
}
