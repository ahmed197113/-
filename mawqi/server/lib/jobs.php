<?php
// الاستضافة المشتركة لا تشغّل مهام خلفية دائمة، فتُنفَّذ هذه المهام مع الطلبات مرة كل دقيقة على الأكثر
namespace Mawqi;

function runJobsIfDue(): void {
  $last = (int)setting('jobs_at', 0);
  if (time() - $last < 60) return;
  setSetting('jobs_at', time());
  dailyBackup();
  $changed = autoMarkAbsent() + escalateOverdue();
  if ($changed) touchVersion();
}

/** Mark as absent every active worker not recorded today once the cutoff time has passed. */
function autoMarkAbsent(): int {
  $today = today();
  if (isWeekend($today) || nowTime() < setting('absence_cutoff', '09:00')) return 0;
  return q("INSERT INTO attendance (worker_id, project_id, date, status, method)
    SELECT w.id, w.project_id, ?, 'absent', 'auto' FROM workers w
    WHERE w.active = 1 AND w.project_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.worker_id = w.id AND a.date = ?)", [$today, $today])->rowCount();
}

/** Flag issues past their deadline as escalated to the general manager. */
function escalateOverdue(): int {
  return q("UPDATE issues SET escalated = 1 WHERE status <> 'closed' AND escalated = 0 AND due_at < ?", [today() . 'T' . nowTime()])->rowCount();
}

/** Daily backup: mawqi-data/backups/mawqi-YYYY-MM-DD.sqlite, keeping the last 14. */
function dailyBackup(): void {
  $dir = resolveDataDir() . '/backups';
  $file = $dir . '/mawqi-' . today() . '.sqlite';
  if (is_file($file)) return;
  try {
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    db()->exec("VACUUM INTO " . db()->quote($file));
    $old = array_slice(glob($dir . '/mawqi-????-??-??.sqlite') ?: [], 0, -14);
    foreach ($old as $f) @unlink($f);
  } catch (\Throwable $e) {
    error_log('mawqi backup failed: ' . $e->getMessage());
  }
}
