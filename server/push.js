'use strict';
// إشعارات فورية على الجوال عبر Web Push
const webpush = require('web-push');
const { setPushSender } = require('./services');

function keys(db) {
  const get = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  let pub = get('vapid_public');
  let priv = get('vapid_private');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    pub = k.publicKey;
    priv = k.privateKey;
    const ins = db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)');
    ins.run('vapid_public', pub);
    ins.run('vapid_private', priv);
  }
  return { pub, priv };
}

function publicKey(db) {
  return keys(db).pub;
}

function enable(db) {
  const { pub, priv } = keys(db);
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:admin@metal-lines.com', pub, priv);
  setPushSender(async (userIds, payload) => {
    const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds);
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(JSON.parse(s.data), JSON.stringify(payload));
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
      }
    }));
  });
}

module.exports = { publicKey, enable };
