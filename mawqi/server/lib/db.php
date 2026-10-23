<?php
// موقعي — التخزين: قاعدة SQLite واحدة داخل مجلد mawqi-data المجاور لجذر الموقع (خارج public_html)
// SiteGround تقدّم الملفات الثابتة عبر NGINX دون المرور على .htaccess، لذلك لا تُحفظ البيانات داخل جذر الموقع
namespace Mawqi;

use PDO;

class ApiError extends \Exception {
  public $status;
  public function __construct($status, $message) { parent::__construct($message); $this->status = $status; }
}
function fail($status, $msg) { throw new ApiError($status, $msg); }

function resolveDataDir(): string {
  $env = getenv('MAWQI_DATA_DIR');
  if ($env) return rtrim($env, '/');
  $root = dirname(__DIR__);
  $outside = dirname($root) . '/mawqi-data';
  if (is_dir($outside) && is_writable($outside)) return $outside;
  if (@is_writable(dirname($root)) && @mkdir($outside, 0750, true)) return $outside;
  // آخر حل: داخل الجذر، ومحمي بـ data/.htaccess
  return $root . '/data';
}

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) throw new \RuntimeException('امتداد pdo_sqlite غير مفعل في PHP');
  $dir = resolveDataDir();
  if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) throw new \RuntimeException('تعذر إنشاء مجلد البيانات');
  $pdo = new PDO('sqlite:' . $dir . '/mawqi.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate($pdo);
  return $pdo;
}

function migrate(PDO $pdo): void {
  $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','project_manager','supervisor','accountant')),
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 300,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  planned_workers INTEGER NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  manager_id INTEGER REFERENCES users(id),
  supervisor_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS subcontractors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  photo TEXT,
  iqama_no TEXT NOT NULL UNIQUE,
  iqama_expiry TEXT NOT NULL,
  nationality TEXT NOT NULL,
  profession TEXT NOT NULL,
  wage_type TEXT NOT NULL CHECK (wage_type IN ('daily','monthly')),
  wage REAL NOT NULL,
  subcontractor_id INTEGER REFERENCES subcontractors(id),
  project_id INTEGER REFERENCES projects(id),
  qr_token TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS worker_assignments (
  id INTEGER PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES workers(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  from_date TEXT NOT NULL,
  to_date TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES workers(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','leave','overtime')),
  check_in TEXT,
  check_out TEXT,
  lat REAL,
  lng REAL,
  overtime_hours REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'manual',
  recorded_by INTEGER REFERENCES users(id),
  UNIQUE (worker_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date, project_id);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('safety','materials','equipment','subcontractor','other')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  assignee_id INTEGER REFERENCES users(id),
  reported_by INTEGER REFERENCES users(id),
  due_at TEXT,
  escalated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
SQL);
}

function q(string $sql, array $params = []): \PDOStatement {
  $st = db()->prepare($sql);
  $st->execute($params);
  return $st;
}
function all(string $sql, array $params = []): array { return q($sql, $params)->fetchAll(); }
function one(string $sql, array $params = []) { $r = q($sql, $params)->fetch(); return $r === false ? null : $r; }
function scalar(string $sql, array $params = []) { return q($sql, $params)->fetchColumn(); }

function tx(callable $fn) {
  $pdo = db();
  $pdo->beginTransaction();
  try {
    $out = $fn();
    $pdo->commit();
    return $out;
  } catch (\Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
}

function setting(string $key, $fallback = null) {
  $v = scalar('SELECT value FROM settings WHERE key = ?', [$key]);
  return $v === false ? $fallback : $v;
}
function setSetting(string $key, $value): void {
  q('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [$key, (string)$value]);
}

/** Every write bumps this counter; phones and dashboards poll it to know when to reload. */
function touchVersion(): void {
  q("INSERT INTO settings (key, value) VALUES ('data_version', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1");
}
function dataVersion(): int { return (int)setting('data_version', 0); }

// ---------- dates (company time zone, set in api.php) ----------
function today(): string { return date('Y-m-d'); }
function nowTime(): string { return date('H:i'); }
function addDays(string $date, int $n): string { return date('Y-m-d', strtotime("$date 12:00 $n days")); }
function isWeekend(string $date): bool { return (int)date('w', strtotime("$date 12:00")) === (int)setting('weekend_day', 5); }
