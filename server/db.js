'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gm','pm','supervisor','accountant','owner')),
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subcontractors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location_name TEXT,
  lat REAL, lng REAL,
  radius_m INTEGER NOT NULL DEFAULT 300,
  start_date TEXT, end_date TEXT,
  planned_workers INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  contract_value REAL NOT NULL DEFAULT 0,
  manager_id INTEGER REFERENCES users(id),
  supervisor_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  photo TEXT,
  iqama_no TEXT UNIQUE,
  iqama_expiry TEXT,
  nationality TEXT,
  profession TEXT,
  wage_type TEXT NOT NULL DEFAULT 'daily' CHECK (wage_type IN ('daily','monthly')),
  wage REAL NOT NULL DEFAULT 0,
  affiliation TEXT NOT NULL DEFAULT 'company' CHECK (affiliation IN ('company','sub')),
  subcontractor_id INTEGER REFERENCES subcontractors(id),
  project_id INTEGER REFERENCES projects(id),
  qr_token TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS worker_assignments (
  id INTEGER PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  from_date TEXT NOT NULL,
  to_date TEXT,
  moved_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','leave')),
  check_in TEXT, check_out TEXT,
  in_lat REAL, in_lng REAL, out_lat REAL, out_lng REAL,
  overtime_hours REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'bulk' CHECK (method IN ('qr','bulk','auto','manual')),
  recorded_by INTEGER REFERENCES users(id),
  client_id TEXT UNIQUE,
  UNIQUE (worker_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_proj_date ON attendance(project_id, date);
CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  date TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  description TEXT NOT NULL,
  progress REAL,
  weather TEXT, equipment TEXT, materials TEXT,
  lat REAL, lng REAL,
  client_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('safety','materials','equipment','subcontractor','other')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  assignee_id INTEGER REFERENCES users(id),
  due_at TEXT,
  reported_by INTEGER REFERENCES users(id),
  escalated INTEGER NOT NULL DEFAULT 0,
  lat REAL, lng REAL,
  client_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('report','issue')),
  owner_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  path TEXT NOT NULL,
  taken_at TEXT, lat REAL, lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  number INTEGER NOT NULL,
  party_type TEXT NOT NULL CHECK (party_type IN ('client','subcontractor','supplier')),
  party_name TEXT NOT NULL,
  subcontractor_id INTEGER REFERENCES subcontractors(id),
  period_from TEXT, period_to TEXT,
  retention_pct REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  vat_pct REAL NOT NULL DEFAULT 15,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','partially_paid','paid')),
  created_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, number)
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT,
  qty REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'transfer',
  reference TEXT,
  paid_at TEXT NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  dedupe_key TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, dedupe_key)
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DEFAULT_SETTINGS = {
  absence_cutoff: '10:00',
  late_after: '07:30',
  company_name: 'شركة الخطوط المعدنية للمقاولات العامة',
};

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const ins = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  return db;
}

// ينفذ الدالة داخل معاملة واحدة
function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

module.exports = { open, tx, getSetting };
