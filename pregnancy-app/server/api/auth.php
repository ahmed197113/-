<?php
/* نبضٌ صغير — تسجيل الدخول الاختياري بحساب Google
   يستقبل Google ID token، ويتحقق منه هنا على السيرفر فقط، ثم يرجع جلسة صالحة 90 يوماً.
   الجلسة: 32 بايت عشوائية تُرسل للتطبيق مرة واحدة، ونخزّن بصمتها (SHA-256) فقط. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['error' => 'method'], 405);
// حد للمحاولات لكل IP يومياً
if (!bump('auth:' . client_ip(), (int)($CFG['auth_daily_ip'] ?? 40))) out(['error' => 'rate_limited'], 429);

$in = input();
$claims = google_claims((string)($in['id_token'] ?? ''));
if (!$claims) out(['error' => 'bad_token'], 401);

$pdo = db();
$sub = (string)$claims['sub'];
$email = mb_substr((string)($claims['email'] ?? ''), 0, 190);
$name = clean((string)($claims['name'] ?? ''), 120);
$now = time();

$s = $pdo->prepare('SELECT id FROM users WHERE google_sub = ?');
$s->execute([$sub]);
$uid = $s->fetchColumn();
if ($uid === false) {
  $pdo->prepare('INSERT INTO users (google_sub, email, name, created, last_seen) VALUES (?,?,?,?,?)')->execute([$sub, $email, $name, $now, $now]);
  $uid = (int)$pdo->lastInsertId();
} else {
  $uid = (int)$uid;
  $pdo->prepare('UPDATE users SET email = ?, name = ?, last_seen = ? WHERE id = ?')->execute([$email, $name, $now, $uid]);
}
link_device($uid);

// تنظيف الجلسات المنتهية ثم جلسة جديدة
$pdo->prepare('DELETE FROM sessions WHERE expires < ?')->execute([$now]);
$token = bin2hex(random_bytes(32));
$exp = $now + SESSION_DAYS * 86400;
$pdo->prepare('INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?,?,?,?)')->execute([hash('sha256', $token), $uid, $now, $exp]);

out(['token' => $token, 'exp' => $exp * 1000, 'user' => ['name' => $name, 'email' => $email]]);

/* التحقق من توكن Google: التوقيع والصلاحية عبر نقطة tokeninfo الرسمية، ثم aud وiss وexp هنا */
function google_claims(string $idt): ?array {
  global $CFG;
  $ids = (array)($CFG['google_client_ids'] ?? []);
  // وضع الاختبار المحلي فقط (php -S): توكن وهمي بالشكل test:sub:email:name — لا يعمل أبداً على الاستضافة
  if (!empty($CFG['test_mode']) && PHP_SAPI === 'cli-server' && str_starts_with($idt, 'test:')) {
    $p = array_pad(explode(':', $idt, 4), 4, '');
    return $p[1] !== '' ? ['sub' => $p[1], 'email' => $p[2], 'name' => $p[3]] : null;
  }
  if (!$ids || strlen($idt) > 4096 || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $idt)) return null;
  $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idt));
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
  $raw = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $c = is_string($raw) ? json_decode($raw, true) : null;
  if ($code !== 200 || !is_array($c)) return null;
  if (!in_array($c['aud'] ?? '', $ids, true)) return null;
  if (!in_array($c['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) return null;
  if ((int)($c['exp'] ?? 0) < time()) return null;
  if (empty($c['sub']) || ($c['email_verified'] ?? '') !== 'true') return null;
  return $c;
}
