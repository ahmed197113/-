<?php
/* نبضٌ صغير — تسجيل الدخول الاختياري
   يستقبل Firebase ID token (تطبيق أندرويد: Google أو Facebook) أو Google ID token (نسخة المتصفح)،
   ويتحقق منه هنا على السيرفر فقط، ثم يرجع جلسة صالحة 90 يوماً.
   الجلسة: 32 بايت عشوائية تُرسل للتطبيق مرة واحدة، ونخزّن بصمتها (SHA-256) فقط. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['error' => 'method'], 405);
// حد للمحاولات لكل IP يومياً
if (!bump('auth:' . client_ip(), (int)($CFG['auth_daily_ip'] ?? 40))) out(['error' => 'rate_limited'], 429);

$in = input();
$claims = isset($in['firebase_token']) ? firebase_claims((string)$in['firebase_token']) : google_claims((string)($in['id_token'] ?? ''));
if (!$claims) out(['error' => 'bad_token'], 401);

$pdo = db();
$sub = (string)$claims['key'];
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
    return $p[1] !== '' ? ['key' => $p[1], 'sub' => $p[1], 'email' => $p[2], 'name' => $p[3]] : null;
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
  return $c + ['key' => (string)$c['sub']];
}

/* التحقق من توكن Firebase: توقيع RS256 بشهادات Google العامة، ثم aud وiss وexp وsub
   https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library */
function firebase_claims(string $jwt): ?array {
  global $CFG;
  $project = (string)($CFG['firebase_project_id'] ?? '');
  if ($project === '' || strlen($jwt) > 4096) return null;
  $parts = explode('.', $jwt);
  if (count($parts) !== 3) return null;
  $b64 = fn(string $x) => base64_decode(strtr($x, '-_', '+/') . str_repeat('=', (4 - strlen($x) % 4) % 4), true);
  $h = json_decode((string)$b64($parts[0]), true);
  $c = json_decode((string)$b64($parts[1]), true);
  $sig = $b64($parts[2]);
  if (!is_array($h) || !is_array($c) || $sig === false || ($h['alg'] ?? '') !== 'RS256' || empty($h['kid'])) return null;
  $certs = firebase_certs();
  $cert = $certs[$h['kid']] ?? null;
  if (!$cert || openssl_verify($parts[0] . '.' . $parts[1], $sig, $cert, OPENSSL_ALGO_SHA256) !== 1) return null;
  $now = time();
  if (($c['aud'] ?? '') !== $project || ($c['iss'] ?? '') !== 'https://securetoken.google.com/' . $project) return null;
  if ((int)($c['exp'] ?? 0) < $now || (int)($c['iat'] ?? PHP_INT_MAX) > $now + 300 || (int)($c['auth_time'] ?? PHP_INT_MAX) > $now + 300) return null;
  if (empty($c['sub']) || !is_string($c['sub']) || strlen($c['sub']) > 128) return null;
  // نفس الحساب لو دخلت بـ Google من التطبيق أو من المتصفح: نستخدم معرّف Google إن وُجد
  $g = $c['firebase']['identities']['google.com'][0] ?? null;
  $key = is_string($g) && $g !== '' ? $g : 'firebase:' . $c['sub'];
  // بريد Facebook غير موثّق أحياناً: نحفظه للعرض فقط ولا نربط به الحسابات
  return ['key' => $key, 'sub' => $c['sub'], 'email' => (string)($c['email'] ?? ''), 'name' => (string)($c['name'] ?? ''),
    'provider' => (string)($c['firebase']['sign_in_provider'] ?? '')];
}

// شهادات Google العامة لتوقيع توكنات Firebase (تُخزَّن مؤقتاً حسب Cache-Control)
function firebase_certs(): array {
  global $CFG;
  $url = (string)($CFG['firebase_certs_url'] ?? 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  $file = sys_get_temp_dir() . '/nabd-fb-certs-' . md5($url) . '.json';
  $c = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
  if (is_array($c) && ($c['until'] ?? 0) > time()) return $c['certs'];
  $ch = curl_init($url);
  $max = 3600;
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$max) {
    if (preg_match('/max-age=(\d+)/i', $line, $m)) $max = (int)$m[1];
    return strlen($line);
  }]);
  $raw = curl_exec($ch);
  curl_close($ch);
  $certs = is_string($raw) ? json_decode($raw, true) : null;
  if (!is_array($certs) || !$certs) return is_array($c) ? $c['certs'] : [];
  @file_put_contents($file, json_encode(['until' => time() + min($max, 21600), 'certs' => $certs]));
  return $certs;
}
