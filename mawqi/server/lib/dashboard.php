<?php
namespace Mawqi;

const RATE = "(CASE w.wage_type WHEN 'daily' THEN w.wage ELSE w.wage / 30.0 END)";
// Labour cost of one attendance row: a day's wage when working, plus overtime at 1.5x hourly.
const COST = "(CASE WHEN a.status IN ('present','late','overtime') THEN " . RATE . " + a.overtime_hours * " . RATE . " / 8.0 * 1.5 ELSE 0 END)";

function buildDashboard(?array $scope): array {
  $today = today();
  $monthStart = substr($today, 0, 8) . '01';
  $from30 = addDays($today, -29);
  $now = $today . 'T' . nowTime();

  $projects = array_map(fn($p) => [
    'id' => (int)$p['id'], 'name' => $p['name'], 'city' => $p['city'],
    'planned_workers' => (int)$p['planned_workers'], 'progress' => (float)$p['progress'],
    'start_date' => $p['start_date'], 'end_date' => $p['end_date'],
    'supervisor' => $p['supervisor'], 'manager' => $p['manager'],
    'assigned' => (int)$p['assigned'], 'present' => (int)$p['present'], 'absent' => (int)$p['absent'],
    'open_issues' => (int)$p['open_issues'],
    'cost_today' => round((float)$p['cost_today'], 2), 'cost_month' => round((float)$p['cost_month'], 2),
  ], all("
    SELECT p.id, p.name, p.city, p.planned_workers, p.progress, p.start_date, p.end_date,
      s.name AS supervisor, m.name AS manager,
      (SELECT COUNT(*) FROM workers w WHERE w.project_id = p.id AND w.active = 1) AS assigned,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = :today AND a.status IN ('present','late','overtime')) AS present,
      (SELECT COUNT(*) FROM attendance a WHERE a.project_id = p.id AND a.date = :today AND a.status = 'absent') AS absent,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status <> 'closed') AS open_issues,
      (SELECT COALESCE(SUM(" . COST . "), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date = :today) AS cost_today,
      (SELECT COALESCE(SUM(" . COST . "), 0) FROM attendance a JOIN workers w ON w.id = a.worker_id WHERE a.project_id = p.id AND a.date BETWEEN :monthStart AND :today) AS cost_month
    FROM projects p
    LEFT JOIN users s ON s.id = p.supervisor_id
    LEFT JOIN users m ON m.id = p.manager_id
    WHERE " . inList('p.id', $scope) . "
    ORDER BY p.id", [':today' => $today, ':monthStart' => $monthStart]));

  $pScope = inList('project_id', $scope);
  $totalWorkers = (int)scalar("SELECT COUNT(*) FROM workers WHERE active = 1 AND $pScope");
  $counts = [];
  foreach (all("SELECT status, COUNT(*) AS n FROM attendance WHERE date = ? AND $pScope GROUP BY status", [$today]) as $r) $counts[$r['status']] = (int)$r['n'];
  $count = fn(...$st) => array_sum(array_map(fn($s) => $counts[$s] ?? 0, $st));
  $openIssues = (int)scalar("SELECT COUNT(*) FROM issues WHERE status <> 'closed' AND $pScope");

  $series = array_map(fn($r) => [
    'date' => $r['date'], 'present' => (int)$r['present'], 'late' => (int)$r['late'], 'absent' => (int)$r['absent'], 'leave' => (int)$r['leave'],
  ], all("
    SELECT date,
      SUM(status IN ('present','overtime')) AS present,
      SUM(status = 'late') AS late,
      SUM(status = 'absent') AS absent,
      SUM(status = 'leave') AS leave
    FROM attendance WHERE date BETWEEN ? AND ? AND $pScope
    GROUP BY date ORDER BY date", [$from30, $today]));

  // ---- alerts ----
  $alerts = [];
  foreach ($projects as $p) {
    if ($p['present'] < $p['planned_workers'] * 0.8) {
      $gap = (int)round((1 - $p['present'] / max(1, $p['planned_workers'])) * 100);
      $alerts[] = ['type' => 'understaffed', 'level' => 'high', 'projectId' => $p['id'],
        'title' => "نقص عمالة في {$p['name']}", 'detail' => "الحاضرون {$p['present']} من {$p['planned_workers']} مخطط (أقل بـ {$gap}%)"];
    }
  }

  foreach (all("
    SELECT w.id, w.name, p.name AS project FROM (
      SELECT worker_id, status, ROW_NUMBER() OVER (PARTITION BY worker_id ORDER BY date DESC) AS rn
      FROM attendance WHERE date <= ?
    ) r
    JOIN workers w ON w.id = r.worker_id
    JOIN projects p ON p.id = w.project_id
    WHERE r.rn <= 3 AND w.active = 1 AND " . inList('w.project_id', $scope) . "
    GROUP BY w.id HAVING COUNT(*) = 3 AND SUM(r.status = 'absent') = 3", [$today]) as $w) {
    $alerts[] = ['type' => 'absence_streak', 'level' => 'medium', 'workerId' => (int)$w['id'],
      'title' => "{$w['name']} غائب 3 أيام متتالية", 'detail' => $w['project']];
  }

  foreach (all("
    SELECT i.id, i.title, i.due_at, i.severity, p.name AS project, u.name AS assignee
    FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.assignee_id
    WHERE i.status <> 'closed' AND i.due_at < ? AND " . inList('i.project_id', $scope) . "
    ORDER BY i.due_at", [$now]) as $i) {
    $alerts[] = ['type' => 'overdue_issue', 'level' => in_array($i['severity'], ['critical', 'high'], true) ? 'high' : 'medium', 'issueId' => (int)$i['id'],
      'title' => "بلاغ متأخر: {$i['title']}", 'detail' => "{$i['project']} — المسؤول: " . ($i['assignee'] ?? 'غير محدد') . ' — المهلة ' . substr($i['due_at'], 0, 10)];
  }

  foreach (all("SELECT id, name, iqama_expiry FROM workers WHERE active = 1 AND iqama_expiry BETWEEN ? AND ? AND $pScope ORDER BY iqama_expiry",
    [$today, addDays($today, 30)]) as $w) {
    $alerts[] = ['type' => 'iqama_expiry', 'level' => 'low', 'workerId' => (int)$w['id'],
      'title' => "إقامة {$w['name']} تنتهي قريباً", 'detail' => "تاريخ الانتهاء {$w['iqama_expiry']}"];
  }

  $order = ['high' => 0, 'medium' => 1, 'low' => 2];
  usort($alerts, fn($a, $b) => $order[$a['level']] <=> $order[$b['level']]);

  $recorded = array_sum($counts);
  return [
    'date' => $today,
    'generatedAt' => gmdate('c'),
    'version' => dataVersion(),
    'cards' => [
      'totalWorkers' => $totalWorkers,
      'presentToday' => $count('present', 'late', 'overtime'),
      'absentToday' => $count('absent'),
      'onLeaveToday' => $count('leave'),
      'notRecorded' => max(0, $totalWorkers - $recorded),
      'openIssues' => $openIssues,
      'costToday' => round(array_sum(array_column($projects, 'cost_today')), 2),
      'costMonth' => round(array_sum(array_column($projects, 'cost_month')), 2),
    ],
    'projects' => $projects,
    'attendanceSeries' => $series,
    'alerts' => $alerts,
  ];
}
