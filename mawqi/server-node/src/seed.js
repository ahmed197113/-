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
    for (const t of ['direct_order_items', 'direct_orders', 'invoices', 'daily_reports', 'attendance', 'worker_assignments', 'issues', 'workers', 'subcontractors', 'projects', 'users', 'settings']) {
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


    // Owners and contract values, a week of daily reports, invoices and direct orders.
    const owners = [[1, 'شركة الريان العقارية', 48000000], [2, 'مؤسسة النخيل للاستثمار', 22500000], [3, 'هيئة الموانئ', 31000000], [4, 'وزارة التعليم', 14800000], [5, 'وزارة الصحة', 19600000]];
    for (const [pid, client, value] of owners) db.prepare('UPDATE projects SET client = ?, contract_value = ? WHERE id = ?').run(client, value, pid);

    const works = ['صب خرسانة سقف الدور', 'تركيب حديد تسليح أعمدة', 'أعمال البلوك للجدران الداخلية', 'تمديدات كهربائية', 'أعمال اللياسة', 'تمديدات صحية', 'شدات خشبية للسقف', 'أعمال العزل المائي'];
    const weathers = ['مشمس', 'حار', 'غائم جزئياً', 'رياح مثيرة للأتربة'];
    const insRep = db.prepare(`INSERT INTO daily_reports (project_id, date, weather, work_done, next_plan, equipment, materials, obstacles, progress, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of projects) {
      for (let k = 6; k >= 1; k--) {
        const d = addDays(today, -k);
        if (isFriday(d)) continue;
        insRep.run(p[0], d, pick(weathers), `${pick(works)} — ${pick(works)}`, pick(works), 'رافعة برجية، خلاطة، هزاز خرسانة', 'حديد 16مم: 4 طن، خرسانة: 60م³',
          rand() < 0.3 ? 'تأخر توريد بعض المواد' : null, null, p[9], `${d}T17:30`);
      }
    }

    const insInv = db.prepare(`INSERT INTO invoices (project_id, kind, subcontractor_id, number, period_from, period_to, gross, retention_pct, deductions, vat_pct, status, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, 15, ?, NULL, 9, ?)`);
    const m1 = addDays(today, -60), m2 = addDays(today, -30);
    insInv.run(1, 'client', null, 'م-1', m1, addDays(m2, -1), 2850000, 0, 'paid', `${m2}T10:00`);
    insInv.run(1, 'client', null, 'م-2', m2, addDays(today, -1), 3120000, 15000, 'submitted', `${today}T09:00`);
    insInv.run(2, 'client', null, 'م-1', m2, addDays(today, -1), 1460000, 0, 'approved', `${addDays(today, -2)}T11:00`);
    insInv.run(3, 'client', null, 'م-3', m2, addDays(today, -1), 2240000, 0, 'paid', `${addDays(today, -5)}T12:00`);
    insInv.run(1, 'subcontractor', 1, 'ب-1', m2, addDays(today, -1), 185000, 2500, 'approved', `${addDays(today, -1)}T13:00`);
    insInv.run(2, 'subcontractor', 2, 'ب-1', m2, addDays(today, -1), 96000, 0, 'draft', `${today}T08:00`);

    const insOrd = db.prepare(`INSERT INTO direct_orders (project_id, subcontractor_id, number, title, date, due_date, status, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 2, ?)`);
    const insItem = db.prepare('INSERT INTO direct_order_items (order_id, description, unit, qty, unit_price, done_qty) VALUES (?, ?, ?, ?, ?, ?)');
    const o1 = Number(insOrd.run(1, 3, 'إس-001', 'أعمال تشطيبات الدور الأرضي', addDays(today, -20), addDays(today, 25), 'in_progress', `${addDays(today, -20)}T10:00`).lastInsertRowid);
    insItem.run(o1, 'لياسة داخلية', 'م²', 1800, 28, 1100);
    insItem.run(o1, 'دهان بلاستيك 3 أوجه', 'م²', 1800, 22, 400);
    insItem.run(o1, 'تركيب بلاط أرضيات', 'م²', 650, 45, 0);
    const o2 = Number(insOrd.run(2, 2, 'إس-002', 'تمديدات كهرباء الفلل 1-6', addDays(today, -35), addDays(today, 10), 'open', `${addDays(today, -35)}T09:00`).lastInsertRowid);
    insItem.run(o2, 'تمديد مواسير ونقاط إنارة', 'نقطة', 420, 85, 260);
    insItem.run(o2, 'تركيب لوحات توزيع', 'عدد', 6, 2400, 2);

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('absence_cutoff', '09:00');
  });

  const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  console.log(`Seeded: ${n('projects')} projects, ${n('workers')} workers, ${n('attendance')} attendance rows, ${n('issues')} issues.`);
}

if (import.meta.url === `file://${process.argv[1]}`) seed();
