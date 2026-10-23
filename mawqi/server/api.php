<?php
// موقعي — نقطة دخول واجهة /api/* بلغة PHP لاستضافة SiteGround المشتركة (بدون Node.js)
namespace Mawqi;

ini_set('display_errors', '0');
date_default_timezone_set(getenv('MAWQI_TZ') ?: 'Asia/Riyadh');
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/jobs.php';
require __DIR__ . '/lib/dashboard.php';
require __DIR__ . '/lib/seed.php';

const MAX_BODY = 5 * 1024 * 1024;
const DEFAULT_COMPANY = 'شركة الخطوط المعدنية للمقاولات العامة';

function send(int $status, $body): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function body(): array {
  if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY) fail(413, 'حجم الطلب كبير جداً');
  $raw = file_get_contents('php://input');
  if ($raw === '' || $raw === false) return [];
  $b = json_decode($raw, true);
  if (!is_array($b)) fail(400, 'بيانات غير صالحة');
  return $b;
}

function status(): array {
  return ['needsSetup' => needsSetup(), 'companyName' => setting('company_name', DEFAULT_COMPANY), 'version' => dataVersion()];
}

function setup(array $b): array {
  if (!needsSetup()) fail(409, 'تم إعداد النظام مسبقاً');
  $name = trim((string)($b['name'] ?? ''));
  $username = trim((string)($b['username'] ?? ''));
  $password = (string)($b['password'] ?? '');
  if ($name === '' || $username === '') fail(400, 'الاسم واسم المستخدم مطلوبان');
  if (mb_strlen($password) < 8) fail(400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
  $hash = password_hash($password, PASSWORD_DEFAULT);
  tx(function () use ($b, $name, $username, $hash) {
    setSetting('company_name', trim((string)($b['companyName'] ?? '')) ?: DEFAULT_COMPANY);
    setSetting('absence_cutoff', '09:00');
    setSetting('weekend_day', 5);
    q("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')", [$name, $username, $hash]);
  });
  if (!empty($b['demo'])) seedDemo($hash);
  touchVersion();
  return newSession(one('SELECT * FROM users WHERE username = ?', [$username]));
}

// المسار بعد /api/ حتى لو كان التطبيق في مجلد فرعي
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pos = strpos($uri, '/api/');
$path = $pos === false ? $uri : substr($uri, $pos);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Sign-in uses a bearer token, not cookies, so any origin (the phone app's web preview) may call the API.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($method === 'OPTIONS') { http_response_code(204); exit; }

try {
  if ($path === '/api/status' && $method === 'GET') { send(200, status()); exit; }
  if ($path === '/api/setup' && $method === 'POST') { send(200, setup(body())); exit; }
  if ($path === '/api/login' && $method === 'POST') { $b = body(); send(200, login((string)($b['username'] ?? ''), (string)($b['password'] ?? ''))); exit; }

  $user = currentUser();
  runJobsIfDue();

  if ($path === '/api/logout' && $method === 'POST') {
    q('DELETE FROM sessions WHERE token = ?', [bearerToken()]);
    send(200, ['ok' => true]);
  }
  // Cheap check the apps poll every few seconds; they reload only when the number changes.
  elseif ($path === '/api/version' && $method === 'GET') send(200, ['version' => dataVersion()]);
  elseif ($path === '/api/me' && $method === 'GET') send(200, publicUser($user));
  elseif ($path === '/api/dashboard' && $method === 'GET') send(200, buildDashboard(projectScope($user)));
  else fail(404, 'المسار غير موجود');
} catch (\Throwable $err) {
  if (!($err instanceof ApiError)) error_log('mawqi: ' . $err);
  if (!headers_sent()) send($err instanceof ApiError ? $err->status : 500, ['error' => $err instanceof ApiError ? $err->getMessage() : 'خطأ في الخادم']);
}
