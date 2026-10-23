'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const db_ = require('./db');
const { authenticate } = require('./auth');
const { HttpError } = require('./util');

function createApp({ dbFile = ':memory:', dataDir = path.join(__dirname, '..', 'data') } = {}) {
  const db = db_.open(dbFile);
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ctx = { db, uploadsDir };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });

  // واجهة المستخدم والمكتبات (تُخدَّم محلياً لتعمل بدون إنترنت)
  const nm = path.join(__dirname, '..', 'node_modules');
  app.use('/vendor/chart', express.static(path.join(nm, 'chart.js', 'dist')));
  app.use('/vendor/leaflet', express.static(path.join(nm, 'leaflet', 'dist')));
  app.use('/vendor/jsqr', express.static(path.join(nm, 'jsqr', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const api = express.Router();
  require('./routes/auth')(api, ctx);
  api.use(authenticate(db));
  require('./routes/users')(api, ctx);
  require('./routes/projects')(api, ctx);
  require('./routes/workers')(api, ctx);
  require('./routes/attendance')(api, ctx);
  require('./routes/reports')(api, ctx);
  require('./routes/issues')(api, ctx);
  require('./routes/invoices')(api, ctx);
  require('./routes/dashboard')(api, ctx);
  require('./routes/exports')(api, ctx);
  require('./routes/notifications')(api, ctx);
  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'بيانات غير صالحة' });
    if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'حجم الملف كبير جداً' });
    if (err && /UNIQUE constraint failed/.test(err.message)) return res.status(409).json({ error: 'السجل موجود مسبقاً' });
    if (err && /CHECK constraint failed/.test(err.message)) return res.status(400).json({ error: 'قيمة غير مسموحة' });
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  });

  return { app, db, ctx };
}

module.exports = { createApp };
