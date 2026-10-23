'use strict';
// بيانات تجريبية: 5 مشاريع و60 عاملاً وسجل حضور لآخر 30 يوماً
const { hashPassword } = require('./auth');
const { tx } = require('./db');
const { today, addDays, token, clock } = require('./util');
const { isFriday } = require('./services');

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const FIRST = ['محمد', 'أحمد', 'علي', 'حسن', 'عبدالله', 'راجو', 'سليم', 'كريم', 'رحيم', 'جمال', 'عمر', 'يوسف', 'إبراهيم', 'سانجاي', 'أنيل', 'رفيق', 'شفيق', 'نديم', 'طارق', 'بلال', 'خالد', 'منير', 'سعيد', 'رامش', 'جوزيف'];
const LAST = ['خان', 'حسين', 'الدين', 'كومار', 'شيخ', 'أحمد', 'ميا', 'الرحمن', 'سينغ', 'عثمان', 'محمود', 'إسلام', 'شودري', 'عبدالقادر', 'الأمين'];
const NATIONALITIES = ['الهند', 'باكستان', 'بنغلاديش', 'مصر', 'اليمن', 'السودان', 'نيبال', 'الفلبين'];
const PROFESSIONS = ['حداد مسلح', 'نجار مسلح', 'لحام', 'كهربائي', 'سباك', 'عامل عادي', 'بنّاء', 'مشغل رافعة', 'دهان', 'فني تكييف', 'سائق معدات'];

function seed(db, { reset = false } = {}) {
  const r = rng(20261023);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const d0 = today();
  const pw = hashPassword('123456');

  tx(db, () => {
    if (reset) {
      for (const t of ['payments', 'invoice_items', 'invoices', 'media', 'issues', 'daily_reports', 'attendance',
        'worker_assignments', 'workers', 'projects', 'subcontractors', 'notifications', 'push_subscriptions', 'sessions', 'users']) {
        db.exec(`DELETE FROM ${t}`);
      }
    }
    const user = db.prepare('INSERT INTO users(name, username, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)');
    const uid = (name, username, role, phone) => Number(user.run(name, username, pw, role, phone).lastInsertRowid);
    const gm = uid('م. خالد العتيبي', 'gm', 'gm', '0500000001');
    uid('مالك الشركة', 'owner', 'owner', '0500000002');
    const acc = uid('سامي الحربي', 'finance', 'accountant', '0500000003');
    const pm1 = uid('م. فهد القحطاني', 'pm1', 'pm', '0500000004');
    const pm2 = uid('م. ياسر الغامدي', 'pm2', 'pm', '0500000005');
    const sups = ['ماجد الشهري', 'عادل الزهراني', 'نايف الدوسري', 'تركي المطيري', 'بندر السبيعي']
      .map((n, i) => uid(`المشرف ${n}`, `sup${i + 1}`, 'supervisor', `05000001${i}0`));

    const sub = db.prepare('INSERT INTO subcontractors(name, phone) VALUES (?, ?)');
    const subs = ['مؤسسة البناء المتقن', 'شركة الإنشاءات السريعة', 'مؤسسة الحديد الصلب'].map((n, i) => Number(sub.run(n, `01100000${i}`).lastInsertRowid));

    const projects = [
      ['برج الأعمال التجاري', 'الرياض — طريق الملك فهد', 24.7136, 46.6753, 14, 15, 42, 18500000, pm1],
      ['مجمع فلل النرجس', 'الرياض — حي النرجس', 24.8302, 46.6460, 12, 12, 65, 9200000, pm1],
      ['مستودعات السلي', 'الرياض — حي السلي', 24.6050, 46.8350, 7, 10, 28, 6400000, pm1],
      ['المبنى الإداري — جدة', 'جدة — حي الروضة', 21.5433, 39.1728, 13, 12, 77, 12700000, pm2],
      ['هنجر معدني — الدمام', 'الدمام — المدينة الصناعية الثانية', 26.4207, 50.0888, 14, 14, 15, 4800000, pm2],
    ];
    const pIns = db.prepare(`INSERT INTO projects(name, location_name, lat, lng, radius_m, start_date, end_date, planned_workers,
      progress, contract_value, manager_id, supervisor_id) VALUES (?, ?, ?, ?, 300, ?, ?, ?, ?, ?, ?, ?)`);
    const pids = projects.map((p, i) => Number(pIns.run(p[0], p[1], p[2], p[3], addDays(d0, -200 + i * 20), addDays(d0, 180 + i * 30), p[5], p[6], p[7], p[8], sups[i]).lastInsertRowid));

    const wIns = db.prepare(`INSERT INTO workers(name, iqama_no, iqama_expiry, nationality, profession, wage_type, wage, affiliation,
      subcontractor_id, project_id, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const aIns = db.prepare('INSERT INTO worker_assignments(worker_id, project_id, from_date, to_date, moved_by) VALUES (?, ?, ?, ?, ?)');
    const workers = [];
    let n = 0;
    projects.forEach((p, pi) => {
      for (let k = 0; k < p[4]; k++) {
        n++;
        const isSub = r() < 0.35;
        const expiry = n % 17 === 0 ? addDays(d0, -5) : n % 13 === 0 ? addDays(d0, 10 + (n % 15)) : addDays(d0, 60 + Math.floor(r() * 600));
        const wage = isSub ? 120 + Math.floor(r() * 9) * 10 : 1800 + Math.floor(r() * 12) * 200;
        const id = Number(wIns.run(`${pick(FIRST)} ${pick(LAST)}`, String(2400000000 + n * 7919), expiry, pick(NATIONALITIES),
          pick(PROFESSIONS), isSub ? 'daily' : 'monthly', wage, isSub ? 'sub' : 'company', isSub ? pick(subs) : null, pids[pi], token(16)).lastInsertRowid);
        // بعض العمال انتقلوا من مشروع آخر
        if (n % 9 === 0 && pi > 0) {
          aIns.run(id, pids[pi - 1], addDays(d0, -120), addDays(d0, -46), gm);
          aIns.run(id, pids[pi], addDays(d0, -45), null, gm);
        } else aIns.run(id, pids[pi], addDays(d0, -120), null, gm);
        workers.push({ id, project: pids[pi], n });
      }
    });

    // سجل الحضور لآخر 30 يوماً
    const att = db.prepare(`INSERT INTO attendance(worker_id, project_id, date, status, check_in, check_out, overtime_hours, method, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 29; i >= 1; i--) {
      const date = addDays(d0, -i);
      if (isFriday(date)) continue;
      for (const w of workers) {
        let status;
        const x = r();
        if (w.n % 23 === 0 && i <= 3) status = 'absent'; // غياب متتالٍ لإظهار التنبيه
        else if (x < 0.07) status = 'absent';
        else if (x < 0.1) status = 'leave';
        else if (x < 0.18) status = 'late';
        else status = 'present';
        const worked = status === 'present' || status === 'late';
        const ot = worked && r() < 0.15 ? 1 + Math.floor(r() * 3) : 0;
        const cin = status === 'late' ? `07:${40 + Math.floor(r() * 15)}` : worked ? `06:${45 + Math.floor(r() * 14)}` : null;
        const cout = worked ? `${15 + ot}:${10 + Math.floor(r() * 40)}` : null;
        const sup = sups[pids.indexOf(w.project)];
        att.run(w.id, w.project, date, status, cin, cout, ot, worked ? (r() < 0.6 ? 'qr' : 'bulk') : status === 'absent' ? 'auto' : 'bulk', sup);
      }
    }
    // حضور اليوم حتى الآن (يُضاف حتى لو كان اليوم عطلة ليظهر العرض التجريبي كاملاً)
    {
      for (const w of workers) {
        if (w.n % 23 === 0) continue;
        const pi = pids.indexOf(w.project);
        if (r() < (pi === 2 ? 0.7 : 0.88)) att.run(w.id, w.project, d0, r() < 0.1 ? 'late' : 'present', '06:55', null, 0, 'qr', sups[pi]);
      }
    }

    // تقارير يومية
    const rep = db.prepare(`INSERT INTO daily_reports(project_id, date, author_id, description, progress, weather, equipment, materials, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const works = ['صب خرسانة سقف الدور الثالث', 'تركيب حديد تسليح الأعمدة', 'أعمال اللياسة الداخلية', 'تركيب الهيكل المعدني', 'تمديدات كهربائية', 'أعمال العزل المائي للسطح'];
    pids.forEach((pid, pi) => {
      for (let i = 3; i >= 1; i--) {
        const date = addDays(d0, -i);
        if (isFriday(date)) continue;
        rep.run(pid, date, sups[pi], `${pick(works)}، وتنظيف الموقع ونقل المخلفات.`, projects[pi][6] - i, pick(['مشمس', 'حار جداً', 'رياح/غبار']),
          'رافعة برجية، خلاطة، مولد', 'خرسانة جاهزة 40م³، حديد 6 طن', `${date} 16:00:00`);
      }
    });

    // بلاغات
    const iss = db.prepare(`INSERT INTO issues(project_id, title, description, category, severity, status, assignee_id, due_at, reported_by, escalated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const iso = (days) => new Date(clock.now().getTime() + days * 86400000).toISOString();
    iss.run(pids[0], 'سقالة غير مثبتة في الواجهة الشمالية', 'تحتاج تثبيت فوري قبل استئناف العمل', 'safety', 'critical', 'in_progress', pm1, iso(-0.5), sups[0], 1, iso(-1));
    iss.run(pids[1], 'نقص بلوك 20 سم', 'المتبقي يكفي يومين فقط', 'materials', 'high', 'open', pm1, iso(1), sups[1], 0, iso(-0.3));
    iss.run(pids[2], 'عطل في الخلاطة', 'توقف المحرك', 'equipment', 'medium', 'open', pm1, iso(2), sups[2], 0, iso(-0.2));
    iss.run(pids[3], 'تأخر مقاول الكهرباء', 'لم يحضر فريق التمديدات منذ يومين', 'subcontractor', 'high', 'open', pm2, iso(-0.2), sups[3], 0, iso(-2));
    iss.run(pids[4], 'تسرب مياه من خزان الموقع', '', 'other', 'low', 'closed', pm2, iso(-3), sups[4], 0, iso(-6));

    // مستخلصات
    const inv = db.prepare(`INSERT INTO invoices(project_id, number, party_type, party_name, subcontractor_id, period_from, period_to,
      retention_pct, deductions, vat_pct, status, created_by, approved_by, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 15, ?, ?, ?, ?, ?)`);
    const item = db.prepare('INSERT INTO invoice_items(invoice_id, description, unit, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
    const pay = db.prepare('INSERT INTO payments(invoice_id, amount, method, reference, paid_at, paid_by) VALUES (?, ?, ?, ?, ?, ?)');
    const mk = (pi, no, type, name, subId, status, items, paid) => {
      const id = Number(inv.run(pids[pi], no, type, name, subId, addDays(d0, -60), addDays(d0, -31), 10, 0, status, projects[pi][8],
        ['approved', 'partially_paid', 'paid'].includes(status) ? gm : null, ['approved', 'partially_paid', 'paid'].includes(status) ? `${addDays(d0, -25)}T09:00:00Z` : null, `${addDays(d0, -28)}T08:00:00Z`).lastInsertRowid);
      for (const it of items) item.run(id, ...it);
      if (paid) pay.run(id, paid, 'transfer', `TRX-${id}00`, addDays(d0, -20), acc);
    };
    mk(0, 1, 'client', 'شركة التطوير العقاري', null, 'paid', [['أعمال الخرسانة المسلحة', 'م³', 850, 950], ['أعمال الحفر والردم', 'م³', 4000, 35]], 1081875);
    mk(0, 2, 'subcontractor', 'مؤسسة البناء المتقن', subs[0], 'submitted', [['توريد وتركيب بلوك', 'م²', 1200, 65]], 0);
    mk(1, 1, 'subcontractor', 'شركة الإنشاءات السريعة', subs[1], 'approved', [['أعمال اللياسة', 'م²', 3000, 28], ['أعمال الدهانات', 'م²', 2000, 22]], 0);
    mk(3, 1, 'client', 'وزارة البلديات', null, 'partially_paid', [['الهيكل الخرساني — المرحلة الأولى', 'مقطوعية', 1, 2400000]], 1000000);
    mk(4, 1, 'subcontractor', 'مؤسسة الحديد الصلب', subs[2], 'draft', [['تصنيع وتركيب هيكل معدني', 'طن', 45, 7800]], 0);
  });
}

module.exports = { seed };

if (require.main === module) {
  const path = require('node:path');
  const { open } = require('./db');
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const db = open(path.join(dataDir, 'mawqii.db'));
  seed(db, { reset: process.argv.includes('--reset') });
  console.log('تمت إضافة البيانات التجريبية. كلمة المرور لكل الحسابات: 123456');
}
