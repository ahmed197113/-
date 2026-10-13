<?php
/* نبضٌ صغير — إدارة الحساب
   logout: إنهاء هذه الجلسة · delete: حذف الحساب ونسخته وإخفاء منشوراته (إلزامي لسياسة Google Play)
   request_delete: طلب حذف من صفحة الويب delete-account.html (بدون تسجيل دخول) */
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['error' => 'method'], 405);
$in = input();
$act = (string)($in['action'] ?? ($_GET['action'] ?? ''));
$pdo = db();

switch ($act) {
  case 'me':
    $u = require_user();
    out(['user' => ['name' => $u['name'], 'email' => $u['email']]]);

  case 'logout':
    $t = bearer();
    if ($t !== '') $pdo->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $t)]);
    out(['ok' => true]);

  case 'delete':
    $u = require_user();
    delete_user((int)$u['id']);
    out(['ok' => true]);

  case 'request_delete':
    if (!bump('delreq:' . client_ip(), 5)) out(['error' => 'rate_limited'], 429);
    $email = mb_strtolower(trim((string)($in['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) out(['error' => 'bad_email'], 400);
    $pdo->prepare('INSERT INTO delete_requests (email, t, done) VALUES (?,?,0)')->execute([$email, time()]);
    out(['ok' => true]);
}
out(['error' => 'bad_action'], 400);

function delete_user(int $uid): void {
  $pdo = db();
  $pdo->beginTransaction();
  $pdo->prepare('UPDATE questions SET hidden = 1 WHERE dev IN (SELECT dev FROM user_devices WHERE user_id = ?)')->execute([$uid]);
  $pdo->prepare('UPDATE answers SET hidden = 1 WHERE dev IN (SELECT dev FROM user_devices WHERE user_id = ?)')->execute([$uid]);
  foreach (['backups', 'sessions', 'user_devices'] as $t) $pdo->prepare("DELETE FROM $t WHERE user_id = ?")->execute([$uid]);
  $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
  $pdo->commit();
}
