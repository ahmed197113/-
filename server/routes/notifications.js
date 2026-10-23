'use strict';
const { h, HttpError } = require('../util');
const push = require('../push');

module.exports = (api, { db }) => {
  api.get('/notifications', h((req, res) => {
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
    const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c;
    res.json({ unread, rows });
  }));

  api.post('/notifications/read', h((req, res) => {
    if (req.body.id) db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(Number(req.body.id), req.user.id);
    else db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  }));

  api.get('/push/key', h((req, res) => res.json({ key: push.publicKey(db) })));

  api.post('/push/subscribe', h((req, res) => {
    const sub = req.body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) throw new HttpError(400, 'اشتراك غير صالح');
    db.prepare(`INSERT INTO push_subscriptions(endpoint, user_id, data) VALUES (?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, data = excluded.data`).run(sub.endpoint, req.user.id, JSON.stringify(sub));
    res.json({ ok: true });
  }));
};
