<?php
// بيانات تجريبية: 5 مشاريع و60 عاملاً وحضور آخر 30 يوماً وبلاغات.
// حسابات التجربة تأخذ نفس كلمة مرور مدير النظام حتى لا تبقى كلمة مرور معروفة على الخادم.
namespace Mawqi;

function seedDemo(string $passwordHash): void {
  mt_srand(20261023);
  $rand = fn() => mt_rand() / mt_getrandmax();
  $pick = fn(array $a) => $a[mt_rand(0, count($a) - 1)];
  $between = fn(int $a, int $b) => mt_rand($a, $b);
  $pad = fn($n) => str_pad((string)$n, 2, '0', STR_PAD_LEFT);
  $today = today();

  tx(function () use ($passwordHash, $rand, $pick, $between, $pad, $today) {
    $uid = [];
    foreach ([
      ['pm1', 'م. سامي الغامدي', 'project_manager'], ['pm2', 'م. ريم القحطاني', 'project_manager'],
      ['sup1', 'أحمد منصور', 'supervisor'], ['sup2', 'محمود عبدالعزيز', 'supervisor'], ['sup3', 'ياسر الشهري', 'supervisor'],
      ['sup4', 'عمر حسين', 'supervisor'], ['sup5', 'فهد الدوسري', 'supervisor'], ['acc1', 'نورة السبيعي', 'accountant'],
    ] as [$username, $name, $role]) {
      q('INSERT OR IGNORE INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)', [$name, $username, $passwordHash, $role]);
      $uid[$username] = (int)scalar('SELECT id FROM users WHERE username = ?', [$username]);
    }

    // id, name, city, lat, lng, planned, assigned, progress, manager, supervisor, start offset, end offset
    $projects = [
      [1, 'برج الريان السكني', 'الرياض', 24.7136, 46.6753, 18, 14, 62, 'pm1', 'sup1', -220, 320],
      [2, 'مجمع فلل النخيل', 'الرياض', 24.8090, 46.7270, 12, 12, 41, 'pm1', 'sup2', -150, 400],
      [3, 'مستودعات الميناء', 'جدة', 21.4858, 39.1925, 16, 12, 78, 'pm2', 'sup3', -300, 90],
      [4, 'مدرسة الأمل النموذجية', 'الدمام', 26.4207, 50.0888, 12, 12, 23, 'pm2', 'sup4', -60, 480],
      [5, 'توسعة مستشفى الشفاء', 'مكة المكرمة', 21.3891, 39.8579, 10, 10, 55, 'pm2', 'sup5', -200, 260],
    ];
    $byId = [];
    foreach ($projects as [$id, $name, $city, $lat, $lng, $planned, , $progress, $pm, $sup, $s, $e]) {
      q('INSERT INTO projects (id, name, city, lat, lng, start_date, end_date, planned_workers, progress, manager_id, supervisor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [$id, $name, $city, $lat, $lng, addDays($today, $s), addDays($today, $e), $planned, $progress, $uid[$pm], $uid[$sup]]);
      $byId[$id] = ['lat' => $lat, 'lng' => $lng, 'sup' => $uid[$sup]];
    }

    foreach ([[1, 'مؤسسة البناء المتقدم'], [2, 'شركة الإتقان للكهرباء'], [3, 'مؤسسة الخليج للتشطيبات']] as $s) q('INSERT INTO subcontractors (id, name) VALUES (?, ?)', $s);

    $first = ['محمد', 'أحمد', 'علي', 'حسن', 'إبراهيم', 'عبدالله', 'راجيش', 'سانجاي', 'عمران', 'طارق', 'كريم', 'رحيم', 'جمال', 'سليم', 'أنور', 'بلال', 'يوسف', 'فيصل', 'رام', 'ديباك', 'خالد', 'نبيل', 'مصطفى', 'شريف'];
    $last = ['السيد', 'كومار', 'خان', 'حسين', 'عبدالرحمن', 'شاه', 'أحمد', 'الدين', 'رضا', 'إقبال', 'سينغ', 'محمود', 'عثمان', 'بابو', 'نور', 'صالح'];
    $nationalities = ['مصري', 'هندي', 'باكستاني', 'بنجلاديشي', 'نيبالي', 'يمني', 'سوداني', 'فلبيني'];
    $professions = [
      ['نجار مسلح', 'daily', 150, 190], ['حداد مسلح', 'daily', 150, 190], ['بنّاء', 'daily', 140, 180],
      ['كهربائي', 'monthly', 3200, 4200], ['سباك', 'monthly', 3000, 4000], ['دهان', 'daily', 130, 160],
      ['مبلط', 'daily', 140, 175], ['لحام', 'monthly', 3500, 4500], ['مشغل معدات', 'monthly', 4500, 6000],
      ['عامل عادي', 'daily', 90, 120],
    ];

    $workers = [];
    $id = 1;
    foreach ($projects as [$pid, , , , , , $assigned, , , , $startOff]) {
      for ($i = 0; $i < $assigned; $i++, $id++) {
        [$prof, $wageType, $lo, $hi] = $pick($professions);
        $wage = $wageType === 'daily' ? $between($lo, $hi) : (int)round($between($lo, $hi) / 50) * 50;
        // A handful of iqamas expire within the next month to exercise the alert.
        $expiry = $id % 11 === 0 ? addDays($today, $between(3, 28)) : addDays($today, $between(60, 700));
        $sub = $rand() < 0.35 ? $between(1, 3) : null;
        q('INSERT INTO workers (id, name, iqama_no, iqama_expiry, nationality, profession, wage_type, wage, subcontractor_id, project_id, qr_token) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [$id, $pick($first) . ' ' . $pick($last), (string)(2400000000 + $between(1000000, 9999999) * 10 + $id % 10), $expiry, $pick($nationalities), $prof, $wageType, $wage, $sub, $pid, bin2hex(random_bytes(12))]);
        $workers[] = ['id' => $id, 'project' => $pid, 'joined' => addDays($today, max($startOff, -45))];
      }
    }

    // Three workers moved from project 2 to project 1 ten days ago.
    $moveDate = addDays($today, -10);
    $moved = 0;
    foreach ($workers as &$w) {
      if ($w['project'] === 1 && $moved < 3) {
        q('INSERT INTO worker_assignments (worker_id, project_id, from_date, to_date) VALUES (?, 2, ?, ?)', [$w['id'], $w['joined'], addDays($moveDate, -1)]);
        q('INSERT INTO worker_assignments (worker_id, project_id, from_date, to_date) VALUES (?, 1, ?, NULL)', [$w['id'], $moveDate]);
        $w['prev'] = 2;
        $w['moved'] = $moveDate;
        $moved++;
      } else {
        q('INSERT INTO worker_assignments (worker_id, project_id, from_date, to_date) VALUES (?, ?, ?, NULL)', [$w['id'], $w['project'], $w['joined']]);
      }
    }
    unset($w);

    // Fridays are the weekly day off; today is always included so the demo has a live day.
    $days = [];
    for ($d = addDays($today, -29); $d <= $today; $d = addDays($d, 1)) if (!isWeekend($d) || $d === $today) $days[] = $d;
    $lastThree = array_slice($days, -3);
    $chronic = [7, 33];

    $ins = db()->prepare('INSERT INTO attendance (worker_id, project_id, date, status, check_in, check_out, lat, lng, overtime_hours, method, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($days as $d) {
      foreach ($workers as $w) {
        if ($d < $w['joined']) continue;
        // Today, a few workers on project 3 are not recorded yet.
        if ($d === $today && $w['project'] === 3 && $w['id'] % 3 === 0) continue;
        $pid = isset($w['moved']) && $d < $w['moved'] ? $w['prev'] : $w['project'];
        $p = $byId[$pid];
        $r = $rand();
        if (in_array($w['id'], $chronic, true) && in_array($d, $lastThree, true)) $status = 'absent';
        elseif ($r < 0.07) $status = 'absent';
        elseif ($r < 0.13) $status = 'late';
        elseif ($r < 0.16) $status = 'leave';
        elseif ($r < 0.28) $status = 'overtime';
        else $status = 'present';
        // Project 3 is understaffed: more absences there recently.
        if ($pid === 3 && $d >= addDays($today, -6) && $rand() < 0.25 && $status !== 'leave') $status = 'absent';

        $works = in_array($status, ['present', 'late', 'overtime'], true);
        $ot = $status === 'overtime' ? $between(1, 4) : 0;
        $in = $status === 'late' ? '07:' . $pad($between(20, 59)) : '06:' . $pad($between(30, 59));
        $out = (16 + $ot) . ':' . $pad($between(0, 15));
        $ins->execute([$w['id'], $pid, $d, $status,
          $works ? $in : null, $works && $d !== $today ? $out : null,
          $works ? $p['lat'] + ($rand() - 0.5) * 0.002 : null, $works ? $p['lng'] + ($rand() - 0.5) * 0.002 : null,
          $ot, $works && $rand() < 0.6 ? 'qr' : 'manual', $p['sup']]);
      }
    }

    foreach ([
      [1, 'عدم وجود حواجز حماية في الدور السابع', 'safety', 'critical', 'open', 'sup1', -2],
      [1, 'تأخر توريد حديد التسليح 16 مم', 'materials', 'high', 'in_progress', 'pm1', 1],
      [1, 'عطل في الرافعة البرجية', 'equipment', 'high', 'open', 'pm1', -1],
      [2, 'تأخر مقاول الكهرباء عن الجدول', 'subcontractor', 'medium', 'open', 'pm1', 3],
      [2, 'نقص في البلوك الأسمنتي', 'materials', 'medium', 'closed', 'sup2', -5],
      [3, 'تسرب مياه في خزان المستودع B', 'other', 'medium', 'open', 'sup3', -3],
      [3, 'غياب متكرر لعمالة مقاول الباطن', 'subcontractor', 'high', 'in_progress', 'pm2', 2],
      [3, 'عامل بدون خوذة وحزام أمان', 'safety', 'high', 'closed', 'sup3', -8],
      [4, 'عطل في الخلاطة المركزية', 'equipment', 'medium', 'open', 'sup4', 2],
      [4, 'تأخر وصول الخرسانة الجاهزة', 'materials', 'low', 'open', 'pm2', -1],
      [5, 'كابلات مكشوفة قرب منطقة العمل', 'safety', 'critical', 'in_progress', 'sup5', 1],
      [5, 'نقص في مواد العزل', 'materials', 'low', 'closed', 'pm2', -4],
    ] as [$pid, $title, $cat, $sev, $status, $assignee, $due]) {
      q('INSERT INTO issues (project_id, title, category, severity, status, assignee_id, reported_by, due_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [$pid, $title, $cat, $sev, $status, $uid[$assignee], $byId[$pid]['sup'], addDays($today, $due) . 'T17:00', addDays($today, $due - 3) . 'T09:30']);
    }
  });
  touchVersion();
}
