import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// MAWQI_DB may start with "~/" to keep the database in the user's home folder,
// outside the deploy directory, so redeploys never replace it.
const envDb = process.env.MAWQI_DB;
export const DB_PATH = envDb
  ? (envDb.startsWith('~/') ? resolve(homedir(), envDb.slice(2)) : resolve(envDb))
  : resolve(here, '../data/mawqi.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','project_manager','supervisor','accountant')),
  phone TEXT
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
  photo_url TEXT,
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

CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  date TEXT NOT NULL,
  weather TEXT,
  work_done TEXT NOT NULL,
  next_plan TEXT,
  equipment TEXT,
  materials TEXT,
  obstacles TEXT,
  progress REAL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (project_id, date)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('client','subcontractor')),
  subcontractor_id INTEGER REFERENCES subcontractors(id),
  number TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  gross REAL NOT NULL DEFAULT 0,
  retention_pct REAL NOT NULL DEFAULT 10,
  deductions REAL NOT NULL DEFAULT 0,
  vat_pct REAL NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid','rejected')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS direct_orders (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  subcontractor_id INTEGER REFERENCES subcontractors(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS direct_order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES direct_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'مقطوعية',
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  done_qty REAL NOT NULL DEFAULT 0
);
`);

// Columns added after the first release; ignore "duplicate column" on databases that already have them.
for (const sql of [
  'ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE projects ADD COLUMN client TEXT',
  'ALTER TABLE projects ADD COLUMN contract_value REAL NOT NULL DEFAULT 0',
  'ALTER TABLE workers ADD COLUMN phone TEXT',
  'ALTER TABLE issues ADD COLUMN resolution TEXT',
  'ALTER TABLE issues ADD COLUMN closed_at TEXT',
]) {
  try { db.exec(sql); } catch { /* already applied */ }
}

export function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
