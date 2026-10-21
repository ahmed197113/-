<?php
// نظام إدارة العهد — نقطة دخول واجهة /api/* بلغة PHP (مكافئ server.js) لاستضافة مشتركة بدون Node.js
// التخزين: ملف JSON واحد data/db.json بقفل flock، والمرفقات في data/files/
namespace Custody;

use stdClass;

ini_set('display_errors', '0');
date_default_timezone_set('Asia/Riyadh');
require __DIR__ . '/core.php';

const SESSION_DAYS = 30;
const MAX_BODY = 25 * 1024 * 1024;
// النسخ الاحتياطية من الجوال تحمل المرفقات داخلها فتسمح الاستعادة بحجم أكبر
const MAX_RESTORE = 100 * 1024 * 1024;
const FILE_TYPES = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];

$DATA_DIR = rtrim(getenv('DATA_DIR') ?: __DIR__ . '/data', '/');
$DB_FILE = $DATA_DIR . '/db.json';
$FILES_DIR = $DATA_DIR . '/files';

// ---------- التخزين ----------
class FileEnv {
  public $db;
  public $dirty = false;
  public $filesDir;
  public function __construct($db, $filesDir) { $this->db = $db; $this->filesDir = $filesDir; }
  public function save() { $this->dirty = true; }
  public function uid() { return bin2hex(random_bytes(8)); }
  public function now() { $t = microtime(true); return gmdate('Y-m-d\TH:i:s', (int)$t) . sprintf('.%03dZ', (int)(($t - floor($t)) * 1000)); }
  public function today() { return date('Y-m-d'); }
  public function hashPassword($password) { return ['salt' => '', 'hash' => password_hash(jsstr($password), PASSWORD_DEFAULT)]; }
  public function verifyPassword($user, $password) {
    $pw = jsstr($password);
    $hash = is_string($user->hash ?? null) ? $user->hash : '';
    $salt = is_string($user->salt ?? null) ? $user->salt : '';
    if ($hash === '') return false;
    // الحسابات المنشأة على هذا الخادم
    if ($hash[0] === '$') return password_verify($pw, $hash);
    // التشغيل على جهاز بدون crypto.subtle
    if (str_starts_with($hash, 'plain:')) return hash_equals($hash, 'plain:' . $pw);
    if ($salt === '') return false;
    // نسخة احتياطية من التشغيل على الجوال: PBKDF2-SHA256 بـ 60000 تكرار
    if (strlen($hash) === 64) return hash_equals($hash, hash_pbkdf2('sha256', $pw, $salt, 60000, 64));
    // نسخة احتياطية من خادم Node.js: scrypt (N=16384, r=8, p=1)
    if (strlen($hash) === 128 && strlen($salt) === 32 && function_exists('sodium_crypto_pwhash_scryptsalsa208sha256'))
      return hash_equals($hash, bin2hex(sodium_crypto_pwhash_scryptsalsa208sha256(64, $pw, $salt, 524288, 33554433)));
    return false;
  }
  public function putFile($dataUrl) {
    if (!preg_match('#^data:(image/(jpeg|png|webp)|application/pdf);base64,#', substr($dataUrl, 0, 64), $m)) throw new ApiError(400, 'صيغة المرفق غير مدعومة (صور أو PDF فقط)');
    $ext = ($m[2] ?? '') === 'jpeg' ? 'jpg' : (($m[2] ?? '') ?: 'pdf');
    $data = substr($dataUrl, strlen($m[0]));
    if ($data === '') throw new ApiError(400, 'صيغة المرفق غير مدعومة (صور أو PDF فقط)');
    $id = $this->uid() . '.' . $ext;
    file_put_contents($this->filesDir . '/' . $id, base64_decode($data));
    return $id;
  }
}

// ---------- HTTP ----------
function send($status, $body, $headers = []) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  foreach ($headers as $k => $v) header("$k: $v");
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
}
function readBody($limit = MAX_BODY) {
  if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) throw new ApiError(413, 'حجم الطلب كبير جداً');
  $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
  if ($raw === false || $raw === '') return new stdClass();
  if (strlen($raw) > $limit) throw new ApiError(413, 'حجم الطلب كبير جداً');
  $b = json_decode($raw, false, 512, JSON_BIGINT_AS_STRING);
  if (json_last_error() !== JSON_ERROR_NONE) throw new ApiError(400, 'بيانات غير صالحة');
  return $b;
}
function bearerToken($query) {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if ($h === '' && function_exists('getallheaders')) foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
  return str_starts_with($h, 'Bearer ') ? substr($h, 7) : ($query->token ?? null);
}
function nowMs() { return (int)floor(microtime(true) * 1000); }

// المسار بعد /api/ حتى لو كان التطبيق في مجلد فرعي، والاستعلام بنفس منطق URLSearchParams
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$qpos = strpos($uri, '?');
$rawPath = $qpos === false ? $uri : substr($uri, 0, $qpos);
$apiPos = strpos($rawPath, '/api/');
$path = $apiPos === false ? $rawPath : substr($rawPath, $apiPos);
$query = new stdClass();
if ($qpos !== false) foreach (explode('&', substr($uri, $qpos + 1)) as $pair) {
  if ($pair === '') continue;
  [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
  if (($k = urldecode($k)) !== '') $query->$k = urldecode($v);
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$lock = null;
$env = null;
$fileToSend = null;
try {
  if (!is_dir($FILES_DIR) && !@mkdir($FILES_DIR, 0775, true) && !is_dir($FILES_DIR)) throw new \RuntimeException('تعذر إنشاء مجلد البيانات');
  // قفل مشترك للقراءة وحصري للكتابة طوال معالجة الطلب
  $lock = fopen($DATA_DIR . '/db.lock', 'c');
  $fresh = !is_file($DB_FILE);
  flock($lock, $method === 'GET' && !$fresh ? LOCK_SH : LOCK_EX);
  $raw = is_file($DB_FILE) ? file_get_contents($DB_FILE) : null;
  $db = $raw === null || $raw === '' ? null : json_decode($raw, false, 512, JSON_BIGINT_AS_STRING);
  if ($raw !== null && $raw !== '' && !is_object($db)) throw new \RuntimeException('ملف البيانات تالف');
  $env = new FileEnv(normalize($db), $FILES_DIR);
  $core = new Core($env);
  if (!is_file($DB_FILE)) {
    if (getenv('DEMO') === '1' && $core->needsSetup()) seedDemo($env);
    $env->save();
  }

  $newSession = function ($user) use ($env, $core) {
    $token = bin2hex(random_bytes(24));
    foreach (get_object_vars($env->db->sessions) as $t => $s) if (($s->exp ?? 0) < nowMs()) unset($env->db->sessions->$t);
    $env->db->sessions->$token = (object)['userId' => $user->id, 'exp' => nowMs() + SESSION_DAYS * 86400000];
    $env->save();
    return ['token' => $token, 'user' => $core->publicUser($user)];
  };

  $out = null;
  if ($path === '/api/status' && $method === 'GET') $out = [200, ['needsSetup' => $core->needsSetup(), 'mode' => 'server', 'companyName' => $env->db->settings->companyName]];
  else if ($path === '/api/setup' && $method === 'POST') $out = [200, $newSession($core->setup(readBody()))];
  else if ($path === '/api/login' && $method === 'POST') { $b = readBody(); $out = [200, $newSession($core->login(g($b, 'username'), g($b, 'password')))]; }
  else {
    $token = bearerToken($query);
    $s = is_string($token) && $token !== '' ? ($env->db->sessions->$token ?? null) : null;
    if (!$s || ($s->exp ?? 0) < nowMs()) throw new ApiError(401, 'يجب تسجيل الدخول');
    $user = first($env->db->users, fn($u) => $u->id === ($s->userId ?? null) && ($u->active ?? null) !== false);
    if (!$user) throw new ApiError(401, 'الحساب غير مفعل');

    if ($path === '/api/logout') { unset($env->db->sessions->$token); $env->save(); $out = [200, ['ok' => true]]; }
    else if (preg_match('#^/api/files/([\w.]+)$#D', $path, $fm)) {
      $name = basename($fm[1]);
      $emp = $user->role === 'employee';
      $owned = some($env->db->expenses, fn($e) => in_array($name, (array)($e->attachments ?? []), true) && (!$emp || $e->employeeId === $user->id))
        || some($env->db->assets, fn($a) => in_array($name, (array)($a->photos ?? []), true) && (!$emp || ($a->holderId ?? null) === $user->id));
      if (!$owned || !is_file($FILES_DIR . '/' . $name)) throw new ApiError(404, 'الملف غير موجود');
      $fileToSend = $FILES_DIR . '/' . $name;
    }
    else if ($path === '/api/restore' && $method === 'POST') {
      if ($user->role !== 'admin') throw new ApiError(403, 'لمدير النظام فقط');
      $b = readBody(MAX_RESTORE);
      if (!is_object($b) || !is_array($b->users ?? null) || !$b->users) throw new ApiError(400, 'ملف النسخة الاحتياطية غير صالح');
      // نسخة احتياطية من التشغيل على الجوال تحمل المرفقات داخلها
      foreach ((array)($b->__files ?? []) as $id => $data) {
        $id = (string)$id;
        if (!is_string($data) || !preg_match('/^[\w.]+$/D', $id) || $id === '.' || $id === '..') continue;
        $comma = strpos($data, ',');
        if ($comma === false || !preg_match('#^data:[^;,]+;base64$#', substr($data, 0, $comma)) || $comma + 1 >= strlen($data)) continue;
        file_put_contents($FILES_DIR . '/' . $id, base64_decode(substr($data, $comma + 1)));
      }
      unset($b->__files);
      $sessions = $env->db->sessions;
      $env->db = normalize($b);
      $env->db->sessions = $sessions;
      $env->save();
      $out = [200, ['ok' => true]];
    }
    else {
      $body = in_array($method, ['POST', 'PUT'], true) ? readBody() : new stdClass();
      $out = [200, $core->handle($method, $path, $query, $body, $user)];
    }
  }

  if ($env->dirty) {
    $tmp = $DB_FILE . '.tmp';
    $json = json_encode($env->db, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    if ($json === false || file_put_contents($tmp, $json) !== strlen($json) || !rename($tmp, $DB_FILE)) throw new \RuntimeException('تعذر حفظ البيانات');
  }
  flock($lock, LOCK_UN);

  if ($fileToSend) {
    $ext = strtolower(pathinfo($fileToSend, PATHINFO_EXTENSION));
    $type = FILE_TYPES[$ext] ?? null;
    // مرفقات الجوال بلا امتداد: تحديد النوع من المحتوى
    if (!$type && function_exists('finfo_open')) { $fi = finfo_open(FILEINFO_MIME_TYPE); $t = finfo_file($fi, $fileToSend); if (in_array($t, FILE_TYPES, true)) $type = $t; }
    http_response_code(200);
    header('Content-Type: ' . ($type ?: 'image/jpeg'));
    header('Cache-Control: private, max-age=86400');
    header('Content-Length: ' . filesize($fileToSend));
    readfile($fileToSend);
  } else send($out[0], $out[1]);
} catch (\Throwable $err) {
  if ($lock) flock($lock, LOCK_UN);
  if (!($err instanceof ApiError)) error_log('custody: ' . $err);
  if (!headers_sent()) send($err instanceof ApiError ? $err->status : 500, ['error' => $err instanceof ApiError ? $err->getMessage() : 'خطأ في الخادم']);
}
