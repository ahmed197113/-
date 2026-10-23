'use strict';
const { verifyPassword, createSession, publicUser, authenticate } = require('../auth');
const { ROLES, POLICY, can } = require('../permissions');
const { h, HttpError } = require('../util');

module.exports = (api, { db }) => {
  // محاولات الدخول الفاشلة لكل اسم مستخدم
  const failures = new Map();

  api.post('/auth/login', h((req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const f = failures.get(username);
    if (f && f.count >= 5 && Date.now() - f.at < 5 * 60000) {
      throw new HttpError(429, 'محاولات كثيرة، حاول بعد 5 دقائق');
    }
    const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!u || !verifyPassword(password, u.password_hash)) {
      failures.set(username, { count: (f ? f.count : 0) + 1, at: Date.now() });
      throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    failures.delete(username);
    res.json({ token: createSession(db, u.id), user: publicUser(u) });
  }));

  api.post('/auth/logout', authenticate(db), h((req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.json({ ok: true });
  }));

  api.get('/me', authenticate(db), h((req, res) => {
    const permissions = Object.keys(POLICY).filter((a) => can(req.user, a));
    res.json({ user: publicUser(req.user), permissions, roles: ROLES });
  }));
};
