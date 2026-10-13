<?php
/* نبضٌ صغير — النسخة الاحتياطية على السحابة (لصاحبة الحساب فقط)
   GET: آخر نسخة · PUT: حفظ نسخة (JSON لحالة التطبيق بدون الصور، حد أقصى 512KB) */
declare(strict_types=1);
require __DIR__ . '/lib.php';

const MAX_BACKUP = 512 * 1024;
$u = require_user();
$uid = (int)$u['id'];
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
  $s = $pdo->prepare('SELECT data, updated FROM backups WHERE user_id = ?');
  $s->execute([$uid]);
  $r = $s->fetch();
  out(['data' => $r ? $r['data'] : null, 'updated' => $r ? (int)$r['updated'] : 0]);
}

if ($method === 'PUT') {
  $in = input();
  $data = $in['data'] ?? null;
  if (!is_string($data) || $data === '') out(['error' => 'bad_data'], 400);
  if (strlen($data) > MAX_BACKUP) out(['error' => 'too_large'], 413);
  if (!is_array(json_decode($data, true))) out(['error' => 'bad_json'], 400);
  if (!bump("bk:$uid", (int)($CFG['backup_daily'] ?? 400))) out(['error' => 'rate_limited'], 429);
  link_device($uid);
  $now = now_ms();
  $s = $pdo->prepare('SELECT 1 FROM backups WHERE user_id = ?');
  $s->execute([$uid]);
  if ($s->fetchColumn()) $pdo->prepare('UPDATE backups SET data = ?, updated = ? WHERE user_id = ?')->execute([$data, $now, $uid]);
  else $pdo->prepare('INSERT INTO backups (user_id, data, updated) VALUES (?,?,?)')->execute([$uid, $data, $now]);
  out(['ok' => true, 'updated' => $now]);
}

out(['error' => 'method'], 405);
