// Photos, videos and documents attached to reports, issues, workers, projects and invoices.
// Files live next to the database (outside the deploy folder) so redeploys never remove them.
import { Router } from 'express';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';
import { db, DB_PATH } from './db.js';
import { PERMISSIONS, projectScope } from './auth.js';
import { nowTime, todayStr } from './util.js';

export const UPLOAD_DIR = process.env.MAWQI_UPLOADS || join(dirname(DB_PATH), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('daily_report','issue','worker','project','invoice','direct_order')),
  entity_id INTEGER NOT NULL,
  project_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','file')),
  tag TEXT,
  caption TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  name TEXT,
  path TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_entity ON attachments(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_att_project ON attachments(project_id);`);

const MAX_BYTES = 250 * 1024 * 1024; // a 3-minute phone video at medium quality fits comfortably
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif|gif)|video\/(mp4|quicktime|3gpp|webm|x-matroska)|application\/pdf)$/;
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/3gpp': '.3gp', 'video/webm': '.webm', 'video/x-matroska': '.mkv', 'application/pdf': '.pdf' };

/** Which permission may add files to each kind of record, and how to find that record's project. */
const ENTITIES = {
  daily_report: { perms: ['dailyReports'], project: 'SELECT project_id FROM daily_reports WHERE id = ?' },
  issue: { perms: ['issues'], project: 'SELECT project_id FROM issues WHERE id = ?' },
  worker: { perms: ['workers', 'moveWorkers'], project: 'SELECT project_id FROM workers WHERE id = ?', anyProject: true },
  project: { perms: ['projects', 'dailyReports'], project: 'SELECT id AS project_id FROM projects WHERE id = ?' },
  invoice: { perms: ['invoices'], project: 'SELECT project_id FROM invoices WHERE id = ?' },
  direct_order: { perms: ['directOrders'], project: 'SELECT project_id FROM direct_orders WHERE id = ?' },
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function checkAccess(user, entity, id, write) {
  const def = ENTITIES[entity] || fail(400, 'نوع غير معروف');
  const row = db.prepare(def.project).get(id);
  if (!row) fail(404, 'السجل غير موجود');
  if (write && !def.perms.some((p) => PERMISSIONS[p].includes(user.role))) fail(403, 'ليست لديك صلاحية لإضافة ملفات هنا');
  const scope = projectScope(user);
  if (!def.anyProject && scope !== null && row.project_id && !scope.includes(row.project_id)) fail(403, 'هذا المشروع خارج صلاحياتك');
  return row.project_id ?? null;
}

const publicFile = (a) => ({
  id: a.id, kind: a.kind, tag: a.tag, caption: a.caption, mime: a.mime, size: a.size, name: a.name,
  url: `/api/files/${a.id}`, created_at: a.created_at, by: a.by ?? null, created_by: a.created_by, entity: a.entity, entity_id: a.entity_id,
});

/** Files for many records at once: { [entity_id]: [file, …] }. */
export function filesFor(entity, ids) {
  const out = {};
  const list = [...new Set(ids.map(Number))].filter(Boolean);
  if (!list.length) return out;
  const rows = db.prepare(`SELECT a.*, u.name AS by FROM attachments a LEFT JOIN users u ON u.id = a.created_by
    WHERE a.entity = ? AND a.entity_id IN (${list.join(',')}) ORDER BY a.id`).all(entity);
  for (const r of rows) (out[r.entity_id] ||= []).push(publicFile(r));
  return out;
}

/** Every photo and video of a project: its gallery plus those of its reports and issues. */
export function projectGallery(projectId, limit = 300) {
  return db.prepare(`SELECT a.*, u.name AS by FROM attachments a LEFT JOIN users u ON u.id = a.created_by
    WHERE a.project_id = ? AND a.kind IN ('image','video') AND a.entity IN ('project','daily_report','issue') AND (a.tag IS NULL OR a.tag <> 'doc')
    ORDER BY a.id DESC LIMIT ?`).all(projectId, limit).map(publicFile);
}

/** Latest worker photo ids: { [worker_id]: fileId }. */
export function workerPhotos() {
  const out = {};
  for (const r of db.prepare(`SELECT entity_id, MAX(id) AS id FROM attachments WHERE entity = 'worker' AND tag = 'photo' GROUP BY entity_id`).all()) out[r.entity_id] = r.id;
  return out;
}

/** Remove the files of records that are being deleted. */
export function removeFilesOf(entity, ids) {
  const list = ids.map(Number).filter(Boolean);
  if (!list.length) return;
  const rows = db.prepare(`SELECT id, path FROM attachments WHERE entity = ? AND entity_id IN (${list.join(',')})`).all(entity);
  for (const r of rows) rmSync(join(UPLOAD_DIR, r.path), { force: true });
  db.prepare(`DELETE FROM attachments WHERE entity = ? AND entity_id IN (${list.join(',')})`).run(entity);
}

export const media = Router();

/**
 * Upload one file as the raw request body.
 * POST /api/attachments?entity=issue&id=12&tag=after   (Content-Type: image/jpeg, X-File-Name: optional)
 */
media.post('/attachments', (req, res, next) => {
  try {
    const entity = String(req.query.entity || '');
    const id = Number(req.query.id);
    const projectId = checkAccess(req.user, entity, id, true);
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.test(mime)) fail(400, 'نوع الملف غير مدعوم — الصور والفيديو وملفات PDF فقط');
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BYTES) fail(413, 'الملف أكبر من المسموح (250 ميجا) — قلّل مدة الفيديو أو جودته');
    const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file';
    const month = todayStr().slice(0, 7);
    const rel = join(month, `${randomUUID()}${EXT[mime] || extname(String(req.headers['x-file-name'] || '')) || ''}`);
    const abs = join(UPLOAD_DIR, rel);
    mkdirSync(dirname(abs), { recursive: true });
    let size = 0;
    let aborted = false;
    const out = createWriteStream(abs);
    const cleanup = () => { out.destroy(); rmSync(abs, { force: true }); };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES && !aborted) {
        aborted = true;
        cleanup();
        res.status(413).json({ error: 'الملف أكبر من المسموح (250 ميجا)' });
        req.destroy();
      }
    });
    req.on('aborted', () => { if (!aborted) { aborted = true; cleanup(); } });
    req.pipe(out);
    out.on('error', (e) => { if (!aborted) { aborted = true; cleanup(); next(e); } });
    out.on('finish', () => {
      if (aborted) return;
      if (!size) { rmSync(abs, { force: true }); return res.status(400).json({ error: 'الملف فارغ' }); }
      let name = null;
      try { name = decodeURIComponent(String(req.headers['x-file-name'] || '')) || null; } catch { name = null; }
      const r = db.prepare(`INSERT INTO attachments (entity, entity_id, project_id, kind, tag, caption, mime, size, name, path, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(entity, id, projectId, kind, req.query.tag ? String(req.query.tag) : null,
        req.query.caption ? String(req.query.caption).slice(0, 300) : null, mime, size, name, rel, req.user.id, `${todayStr()}T${nowTime()}`);
      req.app.locals.broadcast('data:changed', { entity: 'attachments', projectId });
      const a = db.prepare('SELECT a.*, u.name AS by FROM attachments a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(Number(r.lastInsertRowid));
      res.json(publicFile(a));
    });
  } catch (e) { next(e); }
});

/** Stream a file (supports range requests so videos can be scrubbed). */
media.get('/files/:id', (req, res, next) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(req.params.id));
    if (!a) fail(404, 'الملف غير موجود');
    checkAccess(req.user, a.entity, a.entity_id, false);
    const abs = resolve(UPLOAD_DIR, a.path);
    if (!abs.startsWith(resolve(UPLOAD_DIR)) || !existsSync(abs)) fail(404, 'الملف غير موجود على الخادم');
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.type(a.mime);
    if (req.query.download) res.attachment(a.name || `mawqi-${a.id}${EXT[a.mime] || ''}`);
    res.sendFile(abs, { acceptRanges: true, cacheControl: false });
  } catch (e) { next(e); }
});

media.put('/attachments/:id', (req, res, next) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(req.params.id));
    if (!a) fail(404, 'الملف غير موجود');
    checkAccess(req.user, a.entity, a.entity_id, true);
    db.prepare('UPDATE attachments SET caption = ? WHERE id = ?').run(String(req.body?.caption || '').trim().slice(0, 300) || null, a.id);
    req.app.locals.broadcast('data:changed', { entity: 'attachments', projectId: a.project_id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

media.delete('/attachments/:id', (req, res, next) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(req.params.id));
    if (!a) fail(404, 'الملف غير موجود');
    checkAccess(req.user, a.entity, a.entity_id, false);
    // The uploader can remove their own file; the general manager and the system manager can remove any.
    if (a.created_by !== req.user.id && !PERMISSIONS.delete.includes(req.user.role)) fail(403, 'الحذف متاح لمن رفع الملف أو للمدير العام');
    rmSync(join(UPLOAD_DIR, a.path), { force: true });
    db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id);
    req.app.locals.broadcast('data:changed', { entity: 'attachments', projectId: a.project_id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Storage used, for the settings page. */
media.get('/storage', (_req, res) => {
  const r = db.prepare(`SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes,
    SUM(kind = 'image') AS images, SUM(kind = 'video') AS videos FROM attachments`).get();
  let dbBytes = 0;
  try { dbBytes = statSync(DB_PATH).size; } catch { /* ignore */ }
  res.json({ ...r, dbBytes });
});

// eslint-disable-next-line no-unused-vars
media.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'تعذر حفظ الملف على الخادم' });
});
