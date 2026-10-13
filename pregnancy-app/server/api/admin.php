<?php
/* نبضٌ صغير — صفحة إشراف بسيطة: المحتوى المُبلَّغ عنه، إخفاء/إظهار، حظر جهاز */
declare(strict_types=1);
session_start();
const CFG_FILE = __DIR__ . '/config.php';
$CFG = require CFG_FILE;
header('Content-Type: text/html; charset=utf-8');
header('X-Frame-Options: DENY');

if (isset($_POST['token'])) {
  if (hash_equals((string)$CFG['admin_token'], (string)$_POST['token']) && $CFG['admin_token'] !== 'CHANGE-ME-LONG-RANDOM') { session_regenerate_id(true); $_SESSION['nabd_admin'] = 1; $_SESSION['csrf'] = bin2hex(random_bytes(16)); }
  else { sleep(2); }
}
if (isset($_GET['logout'])) { session_destroy(); header('Location: admin.php'); exit; }
$ok = !empty($_SESSION['nabd_admin']);
$pdo = $ok ? new PDO($CFG['db_dsn'], $CFG['db_user'] ?? null, $CFG['db_pass'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]) : null;

// طلبات حذف الحساب من صفحة الويب: حذف الحساب المطابق للبريد أو إغلاق الطلب
if ($ok && isset($_POST['delreq']) && hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) {
  $rid = (int)$_POST['delreq'];
  $s = $pdo->prepare('SELECT email FROM delete_requests WHERE id = ?'); $s->execute([$rid]); $email = $s->fetchColumn();
  if ($email !== false && ($_POST['go'] ?? '') === 'delete') {
    $s = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ?'); $s->execute([mb_strtolower((string)$email)]);
    foreach ($s->fetchAll(PDO::FETCH_COLUMN) as $uid) {
      $pdo->prepare('UPDATE questions SET hidden = 1 WHERE dev IN (SELECT dev FROM user_devices WHERE user_id = ?)')->execute([$uid]);
      $pdo->prepare('UPDATE answers SET hidden = 1 WHERE dev IN (SELECT dev FROM user_devices WHERE user_id = ?)')->execute([$uid]);
      foreach (['backups', 'sessions', 'user_devices'] as $t) $pdo->prepare("DELETE FROM $t WHERE user_id = ?")->execute([$uid]);
      $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
    }
  }
  $pdo->prepare('UPDATE delete_requests SET done = 1 WHERE id = ?')->execute([$rid]);
  header('Location: admin.php'); exit;
}
if ($ok && isset($_POST['do']) && hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) {
  $t = $_POST['t'] === 'q' ? 'questions' : 'answers'; $id = (int)$_POST['id'];
  if ($_POST['do'] === 'hide') $pdo->prepare("UPDATE $t SET hidden = 1 WHERE id = ?")->execute([$id]);
  if ($_POST['do'] === 'show') $pdo->prepare("UPDATE $t SET hidden = 0, reports = 0 WHERE id = ?")->execute([$id]);
  if ($_POST['do'] === 'ban') {
    $s = $pdo->prepare("SELECT dev FROM $t WHERE id = ?"); $s->execute([$id]); $dev = $s->fetchColumn();
    if ($dev && $dev !== 'ai') {
      try { $pdo->prepare('INSERT INTO bans (dev, t) VALUES (?, ?)')->execute([$dev, time()]); } catch (PDOException $e) {}
      $pdo->prepare('UPDATE questions SET hidden = 1 WHERE dev = ?')->execute([$dev]);
      $pdo->prepare('UPDATE answers SET hidden = 1 WHERE dev = ?')->execute([$dev]);
    }
  }
  header('Location: admin.php'); exit;
}
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>إشراف نبضٌ صغير</title>
<style>body{font-family:system-ui,Tahoma,sans-serif;background:#fbf7f9;color:#2c3048;margin:0;padding:16px}h1{color:#fa1a7f;font-size:1.3rem}
.c{background:#fff;border:1px solid #efe3ea;border-radius:14px;padding:12px;margin:10px 0}.m{color:#7c8098;font-size:.85rem}
button{border:0;border-radius:10px;padding:6px 12px;margin:4px 2px;cursor:pointer;background:#fff0f6;color:#c40f63;font-weight:700}
button.d{background:#fa1a7f;color:#fff}input{padding:10px;border-radius:10px;border:1px solid #ddd;width:100%;max-width:320px}</style></head><body>
<?php if (!$ok): ?>
<h1>إشراف نبضٌ صغير</h1><form method="post"><input type="password" name="token" placeholder="كلمة سر الإشراف" autofocus> <button class="d">دخول</button></form>
<?php else:
$rows = [];
foreach (['q' => 'questions', 'a' => 'answers'] as $k => $t) {
  $sql = "SELECT id, dev, reports, hidden, " . ($k === 'q' ? 'title, body' : "'' AS title, body") . ", t FROM $t WHERE reports > 0 OR hidden = 1 ORDER BY reports DESC, t DESC LIMIT 100";
  foreach ($pdo->query($sql) as $r) $rows[] = $r + ['k' => $k];
}
$aiReports = $pdo->query('SELECT id, text, t FROM ai_reports ORDER BY t DESC LIMIT 50')->fetchAll();
$stats = $pdo->query('SELECT (SELECT COUNT(*) FROM questions) q, (SELECT COUNT(*) FROM answers) a, (SELECT COUNT(*) FROM bans) b, (SELECT COUNT(*) FROM users) u')->fetch();
$delReqs = $pdo->query('SELECT r.id, r.email, r.t, (SELECT COUNT(*) FROM users u WHERE LOWER(u.email) = LOWER(r.email)) n FROM delete_requests r WHERE r.done = 0 ORDER BY r.t')->fetchAll();
?>
<h1>إشراف نبضٌ صغير</h1>
<p class="m">الأسئلة: <?= $stats['q'] ?> · الردود: <?= $stats['a'] ?> · محظورون: <?= $stats['b'] ?> · الحسابات: <?= $stats['u'] ?> · <a href="?logout=1">خروج</a></p>
<?php if ($delReqs): ?><h2>طلبات حذف الحساب</h2>
<?php foreach ($delReqs as $r): ?>
<div class="c"><b dir="ltr"><?= $h($r['email']) ?></b> <span class="m">· <?= $h(date('Y-m-d H:i', (int)$r['t'])) ?> · <?= $r['n'] ? 'يوجد حساب بهذا البريد' : 'لا يوجد حساب بهذا البريد' ?></span>
<form method="post"><input type="hidden" name="csrf" value="<?= $h($_SESSION['csrf']) ?>"><input type="hidden" name="delreq" value="<?= (int)$r['id'] ?>">
<?php if ($r['n']): ?><button class="d" name="go" value="delete" onclick="return confirm('حذف الحساب ونسخته نهائياً؟')">حذف الحساب</button><?php endif; ?><button name="go" value="close">إغلاق الطلب</button></form></div>
<?php endforeach; endif; ?>
<h2>المحتوى المُبلَّغ عنه أو المخفي</h2>
<?php if (!$rows) echo '<p class="m">لا يوجد شيء يحتاج مراجعة 🎉</p>'; ?>
<?php foreach ($rows as $r): ?>
<div class="c"><b><?= $r['k'] === 'q' ? 'سؤال' : 'رد' ?> #<?= (int)$r['id'] ?></b> <span class="m">· بلاغات: <?= (int)$r['reports'] ?><?= $r['hidden'] ? ' · مخفي' : '' ?></span>
<?php if ($r['title']): ?><div><b><?= $h($r['title']) ?></b></div><?php endif; ?>
<div><?= nl2br($h($r['body'])) ?></div>
<form method="post"><input type="hidden" name="csrf" value="<?= $h($_SESSION['csrf']) ?>"><input type="hidden" name="t" value="<?= $r['k'] ?>"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
<?php if ($r['hidden']): ?><button name="do" value="show">إظهار (سليم)</button><?php else: ?><button name="do" value="hide">إخفاء</button><?php endif; ?>
<button class="d" name="do" value="ban" onclick="return confirm('حظر صاحب هذا المحتوى وإخفاء كل ما كتبه؟')">حظر الكاتب</button></form></div>
<?php endforeach; ?>
<h2>بلاغات عن ردود المساعد الذكي</h2>
<?php if (!$aiReports) echo '<p class="m">لا توجد بلاغات.</p>'; ?>
<?php foreach ($aiReports as $r): ?>
<div class="c"><span class="m">#<?= (int)$r['id'] ?> · <?= $h(date('Y-m-d H:i', intdiv((int)$r['t'], 1000))) ?></span><div><?= nl2br($h($r['text'])) ?></div></div>
<?php endforeach; endif; ?>
</body></html>
