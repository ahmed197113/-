<?php
/* نبضٌ صغير — الحساب: دخول برمز يصل على الإيميل، وحفظ بيانات المستخدمة وصورها لاسترجاعها على أي جوال */
declare(strict_types=1);
require __DIR__ . '/lib.php';

const CODE_TTL = 15 * 60;          // صلاحية رمز الدخول بالثواني
const CODE_TRIES = 5;              // محاولات إدخال الرمز
const DATA_MAX = 3_000_000;        // أقصى حجم لبيانات المستخدمة (بايت)
const PHOTO_MAX = 1_500_000;       // أقصى حجم للصورة الواحدة
const PHOTOS_MAX = 60;             // أقصى عدد صور لكل حساب
const PHOTO_KEY = '/^(bump-\d{1,2}|baby-photo)$/';

$in = input();
$act = (string)($in['action'] ?? '');
$pdo = db();

function now_ms(): int { return (int)round(microtime(true) * 1000); }

/* المستخدمة صاحبة الرمز (token) أو خطأ 401 */
function me(array $in): array {
  $t = (string)($in['token'] ?? '');
  if (!preg_match('/^[a-f0-9]{64}$/', $t)) out(['error' => 'signed_out'], 401);
  $s = db()->prepare('SELECT u.id, u.email, u.updated FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ?');
  $s->execute([hash('sha256', $t)]);
  $u = $s->fetch();
  if (!$u) out(['error' => 'signed_out'], 401);
  return $u;
}

function send_code_mail(string $email, string $code): bool {
  global $CFG;
  $host = preg_replace('/^www\./', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
  $from = (string)($CFG['mail_from'] ?? ('no-reply@' . $host));
  $name = 'نبضٌ صغير';
  $subject = "رمز الدخول: $code";
  $body = "مرحباً 💗\n\nرمز الدخول إلى تطبيق نبضٌ صغير هو:\n\n    $code\n\nالرمز صالح لمدة 15 دقيقة. إن لم تطلبيه فتجاهلي هذه الرسالة.\n";
  $headers = implode("\r\n", [
    'From: =?UTF-8?B?' . base64_encode($name) . "?= <$from>",
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]);
  return mail($email, '=?UTF-8?B?' . base64_encode($subject) . '?=', chunk_split(base64_encode($body)), $headers, '-f' . $from);
}

switch ($act) {
  case 'send_code':
    $email = strtolower(trim((string)($in['email'] ?? '')));
    if (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) out(['error' => 'bad_email', 'text' => 'اكتبي إيميلاً صحيحاً'], 400);
    if (!bump('mail:' . $email, 6) || !bump('mailip:' . client_ip(), 20)) out(['error' => 'rate_limited', 'text' => 'طلبتِ رموزاً كثيرة اليوم، جرّبي غداً.'], 429);
    $code = (string)random_int(100000, 999999);
    $pdo->prepare('REPLACE INTO auth_codes (email, code, exp, tries) VALUES (?, ?, ?, 0)')
      ->execute([$email, password_hash($code, PASSWORD_DEFAULT), time() + CODE_TTL]);
    if (!send_code_mail($email, $code)) out(['error' => 'mail_failed', 'text' => 'تعذّر إرسال الإيميل، جرّبي بعد قليل.'], 502);
    out(['ok' => true]);

  case 'verify':
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $code = preg_replace('/\D/', '', (string)($in['code'] ?? ''));
    $s = $pdo->prepare('SELECT * FROM auth_codes WHERE email = ?');
    $s->execute([$email]);
    $row = $s->fetch();
    if (!$row || (int)$row['exp'] < time()) out(['error' => 'expired', 'text' => 'انتهت صلاحية الرمز، اطلبي رمزاً جديداً.'], 400);
    if ((int)$row['tries'] >= CODE_TRIES) out(['error' => 'too_many', 'text' => 'محاولات كثيرة، اطلبي رمزاً جديداً.'], 400);
    if (!password_verify($code, $row['code'])) {
      $pdo->prepare('UPDATE auth_codes SET tries = tries + 1 WHERE email = ?')->execute([$email]);
      out(['error' => 'wrong_code', 'text' => 'الرمز غير صحيح'], 400);
    }
    $pdo->prepare('DELETE FROM auth_codes WHERE email = ?')->execute([$email]);
    $pdo->prepare('INSERT IGNORE INTO users (email, created) VALUES (?, ?)')->execute([$email, now_ms()]);
    $s = $pdo->prepare('SELECT id, updated FROM users WHERE email = ?');
    $s->execute([$email]);
    $u = $s->fetch();
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO sessions (token, uid, t) VALUES (?, ?, ?)')->execute([hash('sha256', $token), $u['id'], now_ms()]);
    out(['token' => $token, 'email' => $email, 'updated' => (int)$u['updated']]);

  case 'pull':
    $u = me($in);
    // since: آخر نسخة عند الجوال — لا نرسل البيانات إن لم تتغير
    if ((int)$u['updated'] <= (int)($in['since'] ?? -1)) out(['updated' => (int)$u['updated']]);
    $s = $pdo->prepare('SELECT data FROM users WHERE id = ?');
    $s->execute([$u['id']]);
    $data = $s->fetchColumn();
    out(['updated' => (int)$u['updated'], 'data' => $data ? json_decode($data, true) : null]);

  case 'push':
    $u = me($in);
    if (!is_array($in['data'] ?? null)) out(['error' => 'bad_data'], 400);
    $json = json_encode($in['data'], JSON_UNESCAPED_UNICODE);
    if (strlen($json) > DATA_MAX) out(['error' => 'too_large', 'text' => 'البيانات أكبر من المسموح'], 413);
    // base: النسخة التي بنى عليها الجوال تعديله؛ إن تغيّرت على السيرفر بعدها يرفض الحفظ ليدمج الجوال أولاً
    $t = max(now_ms(), (int)$u['updated'] + 1);
    $s = $pdo->prepare('UPDATE users SET data = ?, updated = ? WHERE id = ? AND updated = ?');
    $s->execute([$json, $t, $u['id'], (int)($in['base'] ?? $u['updated'])]);
    if ($s->rowCount() === 0) out(['error' => 'conflict'], 409);
    out(['updated' => $t]);

  case 'photos':
    $u = me($in);
    $s = $pdo->prepare('SELECT k, sig FROM user_photos WHERE uid = ?');
    $s->execute([$u['id']]);
    out(['items' => $s->fetchAll(PDO::FETCH_KEY_PAIR)]);

  case 'photo_put':
    $u = me($in);
    $k = (string)($in['k'] ?? ''); $data = (string)($in['data'] ?? ''); $sig = substr((string)($in['sig'] ?? ''), 0, 40);
    if (!preg_match(PHOTO_KEY, $k) || !str_starts_with($data, 'data:image/') || strlen($data) > PHOTO_MAX) out(['error' => 'bad_photo'], 400);
    $s = $pdo->prepare('SELECT COUNT(*) FROM user_photos WHERE uid = ? AND k <> ?');
    $s->execute([$u['id'], $k]);
    if ((int)$s->fetchColumn() >= PHOTOS_MAX) out(['error' => 'too_many_photos'], 413);
    $pdo->prepare('REPLACE INTO user_photos (uid, k, sig, data) VALUES (?, ?, ?, ?)')->execute([$u['id'], $k, $sig, $data]);
    out(['ok' => true]);

  case 'photo_get':
    $u = me($in);
    $s = $pdo->prepare('SELECT data FROM user_photos WHERE uid = ? AND k = ?');
    $s->execute([$u['id'], (string)($in['k'] ?? '')]);
    $data = $s->fetchColumn();
    if ($data === false) out(['error' => 'not_found'], 404);
    out(['data' => $data]);

  case 'logout':
    $pdo->prepare('DELETE FROM sessions WHERE token = ?')->execute([hash('sha256', (string)($in['token'] ?? ''))]);
    out(['ok' => true]);

  case 'delete_account':
    $u = me($in);
    foreach (['DELETE FROM user_photos WHERE uid = ?', 'DELETE FROM sessions WHERE uid = ?', 'DELETE FROM users WHERE id = ?'] as $q) $pdo->prepare($q)->execute([$u['id']]);
    out(['ok' => true]);
}
out(['error' => 'bad_action'], 400);
