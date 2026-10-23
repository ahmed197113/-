// Demo data: 5 projects, 60 workers, 30 days of attendance, sample issues.
// Run with `npm run seed` — wipes and rebuilds the database.
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db, tx } from './db.js';
import { addDays, isFriday, todayStr } from './util.js';

let s = 20261023;
const rand = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pad = (n) => String(n).padStart(2, '0');

export function seed() {
  const today = todayStr();
  const hash = bcrypt.hashSync('123456', 8);

  tx(() => {
    for (const t of ['attendance', 'worker_assignments', 'issues', 'workers', 'subcontractors', 'projects', 'users', 'settings']) {
      db.exec(`DELETE FROM ${t}`);
    }

    const users = [
      [1, 'م. خالد العتيبي', 'admin', 'admin'],
      [2, 'م. سامي الغامدي', 'pm1', 'project_manager'],
      [3, 'م. ريم القحطاني', 'pm2', 'project_manager'],
      [4, 'أحمد منصور', 'sup1', 'supervisor'],
      [5, 'محمود عبدالعزيز', 'sup2', 'supervisor'],
      [6, 'ياسر الشهري', 'sup3', 'supervisor'],
      [7, 'عمر حسين', 'sup4', 'supervisor'],
      [8, 'فهد الدوسري', 'sup5', 'supervisor'],
      [9, 'نورة السبيعي', 'acc1', 'accountant'],
    ];
    const insUser = db.prepare('INSERT INTO users (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)');
    for (const [id, name, username, role] of users) insUser.run(id, name, username, hash, role);

    // planned, assigned worker count, progress
    const projects = [
      [1, 'برج الريان السكني', 'الرياض', 24.7136, 46.6753, 18, 14, 62, 2, 4, -220, 320],
      [2, 'مجمع فلل النخيل', 'الرياض', 24.8090, 46.7270, 12, 12, 41, 2, 5, -150, 400],
      [3, 'مستودعات الميناء', 'جدة', 21.4858, 39.1925, 16, 12, 78, 3, 6, -300, 90],
      [4, 'مدرسة الأمل النموذجية', 'الدمام', 26.4207, 50.0888, 12, 12, 23, 3, 7, -60, 480],
      [5, 'توسعة مستشفى الشفاء', 'مكة المكرمة', 21.3891, 39.8579, 10, 10, 55, 3, 8, -200, 260],
    ];
    const insProj = db.prepare(`INSERT INTO projects (id, name, city, lat, lng, radius_m, start_date, end_date, planned_workers, progress, manager_id, supervisor_id)
      VALUES (?, ?, ?, ?, ?, 300, ?, ?, ?, ?, ?, ?)`);
    for (const [id, name, city, lat, lng, planned, , progress, pm, sup, startOff, endOff] of projects) {
      insProj.run(id, name, city, lat, lng, addDays(today, startOff), addDays(today, endOff), planned, progress, pm, sup);
    }

    const subs = [[1, 'مؤسسة البناء المتقدم'], [2, 'شركة الإتقان للكهرباء'], [3, 'مؤسسة الخليج للتشطيبات']];
    const insSub = db.prepare('INSERT INTO subcontractors (id, name) VALUES (?, ?)');
    for (const [id, name] of subs) insSub.run(id, name);

    const first = ['محمد', 'أحمد', 'علي', 'حسن', 'إبراهيم', 'عبدالله', 'راجيش', 'سانجاي', 'عمران', 'طارق', 'كريم', 'رحيم', 'جمال', 'سليم', 'أنور', 'بلال', 'يوسف', 'فيصل', 'رام', 'ديباك', 'خالد', 'نبيل', 'مصطفى', 'شريف'];
    const last = ['السيد', 'كومار', 'خان', 'حسين', 'عبدالرحمن', 'شاه', 'أحمد', 'الدين', 'رضا', 'إقبال', 'سينغ', 'محمود', 'عثمان', 'بابو', 'نور', 'صالح'];
    const nationalities = ['مصري', 'هندي', 'باكستاني', 'بنجلاديشي', 'نيبالي', 'يمني', 'سوداني', 'فلبيني'];
    const professions = [
      ['نجار مسلح', 'daily', 150, 190], ['حداد مسلح', 'daily', 150, 190], ['بنّاء', 'daily', 140, 180],
      ['كهربائي', 'monthly', 3200, 4200], ['سباك', 'monthly', 3000, 4000], ['دهان', 'daily', 130, 160],
      ['مبلط', 'daily', 140, 175], ['لحام', 'monthly', 3500, 4500], ['مشغل معدات', 'monthly', 4500, 6000],
      ['عامل عادي', 'daily', 90, 120],
    ];

    const insWorker = db.prepare(`INSERT INTO workers (id, name, iqama_no, iqama_expiry, nationality, profession, wage_type, wage, subcontractor_id, project_id, qr_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insAssign = db.prepare('INSERT INTO worker_assignments (worker_id, project_id, from_date, to_date) VALUES (?, ?, ?, ?)');

    const workers = [];
    let id = 1;
    for (const p of projects) {
      const [pid, , , , , , assigned, , , , startOff] = p;
      for (let i = 0; i < assigned; i++, id++) {
        const [prof, wageType, lo, hi] = pick(professions);
        const wage = wageType === 'daily' ? between(lo, hi) : Math.round(between(lo, hi) / 50) * 50;
        // A handful of iqamas expire within the next month to exercise the alert.
        const expiry = id % 11 === 0 ? addDays(today, between(3, 28)) : addDays(today, between(60, 700));
        const sub = rand() < 0.35 ? between(1, 3) : null;
        insWorker.run(id, `${pick(first)} ${pick(last)}`, String(2400000000 + between(1000000, 9999999) * 10 + (id % 10)),
          expiry, pick(nationalities), prof, wageType, wage, sub, pid, randomUUID());
        workers.push({ id, project_id: pid, joined: addDays(today, Math.max(startOff, -45)) });
      }
    }

    // Three workers moved from project 2 to project 1 ten days ago.
    const moveDate = addDays(today, -10);
    const moved = new Set();
    for (const w of workers) {
      if (w.project_id === 1 && moved.size < 3) {
        insAssign.run(w.id, 2, w.joined, addDays(moveDate, -1));
        insAssign.run(w.id, 1, moveDate, null);
        w.prevProject = 2; w.moveDate = moveDate;
        moved.add(w.id);
      } else {
        insAssign.run(w.id, w.project_id, w.joined, null);
      }
    }

    // Workers 7 and 33 have been absent for the last 3 working days.
    const chronicAbsent = new Set([7, 33]);
    const workingDays = [];
    // Fridays are the weekly day off; today is always included so the demo has a live day.
    for (let d = addDays(today, -29); d <= today; d = addDays(d, 1)) if (!isFriday(d) || d === today) workingDays.push(d);
    const lastThree = new Set(workingDays.slice(-3));

    const insAtt = db.prepare(`INSERT INTO attendance (worker_id, project_id, date, status, check_in, check_out, lat, lng, overtime_hours, method, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const projById = Object.fromEntries(projects.map((p) => [p[0], p]));
    for (const d of workingDays) {
      for (const w of workers) {
        if (d < w.joined) continue;
        // Today, a few workers on project 3 are not recorded yet (auto-absence will catch them).
        if (d === today && w.project_id === 3 && w.id % 3 === 0) continue;
        const pid = w.moveDate && d < w.moveDate ? w.prevProject : w.project_id;
        const p = projById[pid];
        let status;
        const r = rand();
        if (chronicAbsent.has(w.id) && lastThree.has(d)) status = 'absent';
        else if (r < 0.07) status = 'absent';
        else if (r < 0.13) status = 'late';
        else if (r < 0.16) status = 'leave';
        else if (r < 0.28) status = 'overtime';
        else status = 'present';
        // Project 3 is understaffed: more absences there recently.
        if (pid === 3 && d >= addDays(today, -6) && rand() < 0.25 && status !== 'leave') status = 'absent';

        const works = status === 'present' || status === 'late' || status === 'overtime';
        const inTime = status === 'late' ? `07:${pad(between(20, 59))}` : `06:${pad(between(30, 59))}`;
        const ot = status === 'overtime' ? between(1, 4) : 0;
        const outTime = `${16 + ot}:${pad(between(0, 15))}`;
        const jitter = () => (rand() - 0.5) * 0.002;
        insAtt.run(w.id, pid, d, status,
          works ? inTime : null, works && d !== today ? outTime : null,
          works ? p[3] + jitter() : null, works ? p[4] + jitter() : null,
          ot, works && rand() < 0.6 ? 'qr' : 'manual', p[9]);
      }
    }

    const issues = [
      [1, 'عدم وجود حواجز حماية في الدور السابع', 'safety', 'critical', 'open', 4, -2],
      [1, 'تأخر توريد حديد التسليح 16 مم', 'materials', 'high', 'in_progress', 2, 1],
      [1, 'عطل في الرافعة البرجية', 'equipment', 'high', 'open', 2, -1],
      [2, 'تأخر مقاول الكهرباء عن الجدول', 'subcontractor', 'medium', 'open', 2, 3],
      [2, 'نقص في البلوك الأسمنتي', 'materials', 'medium', 'closed', 5, -5],
      [3, 'تسرب مياه في خزان المستودع B', 'other', 'medium', 'open', 6, -3],
      [3, 'غياب متكرر لعمالة مقاول الباطن', 'subcontractor', 'high', 'in_progress', 3, 2],
      [3, 'عامل بدون خوذة وحزام أمان', 'safety', 'high', 'closed', 6, -8],
      [4, 'عطل في الخلاطة المركزية', 'equipment', 'medium', 'open', 7, 2],
      [4, 'تأخر وصول الخرسانة الجاهزة', 'materials', 'low', 'open', 3, -1],
      [5, 'كابلات مكشوفة قرب منطقة العمل', 'safety', 'critical', 'in_progress', 8, 1],
      [5, 'نقص في مواد العزل', 'materials', 'low', 'closed', 3, -4],
    ];
    const insIssue = db.prepare(`INSERT INTO issues (project_id, title, category, severity, status, assignee_id, reported_by, due_at, escalated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`);
    for (const [pid, title, cat, sev, status, assignee, dueOff] of issues) {
      insIssue.run(pid, title, cat, sev, status, assignee, projById[pid][9], `${addDays(today, dueOff)}T17:00`, `${addDays(today, dueOff - 3)}T09:30`);
    }

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('absence_cutoff', '09:00');
  });

  const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  console.log(`Seeded: ${n('projects')} projects, ${n('workers')} workers, ${n('attendance')} attendance rows, ${n('issues')} issues.`);
}

if (import.meta.url === `file://${process.argv[1]}`) seed();
