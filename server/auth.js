'use strict';
const crypto = require('node:crypto');
const { token, HttpError } = require('./util');

const SESSION_DAYS = 30;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function createSession(db, userId) {
  const t = token(32);
  const exp = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)').run(t, userId, exp);
  return t;
}

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, role: u.role, phone: u.phone, active: !!u.active };
}

// وسيط Express: يتحقق من الجلسة ويضع req.user
function authenticate(db) {
  const q = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`);
  return (req, res, next) => {
    const h = req.get('authorization') || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    if (!t) return next(new HttpError(401, 'يجب تسجيل الدخول'));
    const u = q.get(String(t), new Date().toISOString());
    if (!u) return next(new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد'));
    req.user = u;
    req.token = String(t);
    next();
  };
}

module.exports = { hashPassword, verifyPassword, createSession, authenticate, publicUser };
