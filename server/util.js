'use strict';
const crypto = require('node:crypto');

const TZ = process.env.TZ_APP || 'Asia/Riyadh';

// ساعة قابلة للاستبدال في الاختبارات
const clock = { now: () => new Date() };

function parts(d) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}

function today() {
  const p = parts(clock.now());
  return `${p.year}-${p.month}-${p.day}`;
}

function nowTime() {
  const p = parts(clock.now());
  return `${p.hour}:${p.minute}`;
}

// التاريخ والوقت المحليان لأي لحظة
function localDateTime(d) {
  const p = parts(d);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function nowIso() {
  return clock.now().toISOString();
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

// المسافة بالأمتار بين نقطتين (Haversine)
function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function token(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

function num(v, def = null) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// غلاف للمعالجات حتى تُمرَّر الأخطاء لمعالج الأخطاء
const h = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  h,
  TZ, clock, today, nowTime, nowIso, localDateTime, addDays, daysBetween, distanceM, token,
  HttpError, isDate, isTime, num, round2,
};
