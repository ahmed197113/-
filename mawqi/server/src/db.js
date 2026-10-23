import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.MAWQI_DB || resolve(here, '../data/mawqi.db');
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
`);

export function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
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
