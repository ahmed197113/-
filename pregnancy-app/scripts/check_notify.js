/* اختبار الإشعارات (Notify.plan) بتواريخ وهمية + اتساق أحجام الأسابيع: node scripts/check_notify.js */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
const app = rd('app.js').split('\n');
const helpers = [app.filter(l => /^const (parse|iso|today|addDays|diffDays) = /.test(l)).join('\n'), rd('app.js').match(/function calcDue[\s\S]*?\n}\n/)[0],
  rd('app.js').match(/function status\(\)[\s\S]*?\n}\n/)[0], 'const weekDate = (st, w) => addDays(st.start, (w - 1) * 7);'].join('\n');
const src = ['const DAY = 86400000;', helpers, rd('data.js'), rd('data2.js'), rd('data3.js'), rd('data_more.js'), rd('daily.js'), rd('notify.js'),
  'this.out = { WEEKS, WEEK_MORE, Notify, setS: v => { S = v; } };'].join('\n');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
function run(fakeNow) {
  const RealDate = Date;
  class FD extends RealDate { constructor(...a) { super(...(a.length ? a : [fakeNow])); } static now() { return fakeNow; } }
  const ctx = { console, window: {}, Date: FD, Math, JSON, Set, Array, String, Number, isFinite, Object, S: null };
  ctx.S = null; vm.createContext(ctx); vm.runInContext('let S = null;\n' + src, ctx);
  return ctx.out;
}
// 1) البيانات
const { WEEKS, WEEK_MORE } = run(Date.now());
const names = WEEKS.map(w => w.size);
ok(new Set(names).size === names.length, 'duplicate size names: ' + names.filter((n, i) => names.indexOf(n) !== i));
WEEKS.forEach(w => (WEEK_MORE[w.w]?.baby || []).forEach(t => { const m = t.match(/\(بحجم ([^)]+)\)/); if (m) ok(m[1] === w.size, `week ${w.w}: "${m[1]}" != "${w.size}"`); }));
// تكرار الإيموجي مسموح فقط لنفس الثمرة (الكلمة الأولى من الاسم واحدة)
const byEm = {}; WEEKS.forEach(w => (byEm[w.emoji] = byEm[w.emoji] || []).push(w));
Object.entries(byEm).forEach(([e, l]) => { const roots = new Set(l.map(w => w.size.split(' ')[0])); ok(roots.size === 1, `emoji ${e} on different items: ${l.map(w => w.w + ':' + w.size)}`); });
// 2) الجدولة
const NOW = new Date(2026, 9, 8, 8, 0).getTime(); // 8 أكتوبر 2026، 8 صباحاً
const lmp = '2026-05-01';
const base = () => ({ profile: { method: 'lmp', lmp }, water: { '2026-10-08': 4 }, vitamins: {}, notify: false, dailyTip: { on: false } });
function plan(s) { const o = run(NOW); o.setS(s); return o.Notify.plan(NOW); }
let l = plan(base());
ok(l.length === 0, 'defaults: med on without times, others off → 0, got ' + l.length);
let s = base(); s.reminders = { med: { on: true, times: ['09:00', '21:00'], name: 'حديد' } };
l = plan(s); ok(l.length === 28, 'med 2 times × 14 days = 28, got ' + l.length);
ok(l[0].title === '💊 وقت حديد' && l[0].at.getHours() === 9 && l[0].id === 4000, 'med first');
ok(l.every(n => n.id >= 4000 && n.id < 4280), 'ids range');
s.reminders.med.on = false; ok(plan(s).length === 0, 'med off');
s = base(); s.reminders = { water: { on: true } }; l = plan(s);
ok(l.length === 7 * 14, 'water 9→21 every 2h = 7/day ×14, got ' + l.length);
ok(l[0].body === 'شربتِ 4 من 10 اليوم' && l[0].title === '💧 كوب ماء الآن؟', 'water today body: ' + l[0].body);
ok(l.filter(n => n.at.getDate() === 9).every(n => !/شربتِ/.test(n.body)), 'water generic on later days');
s.reminders.water = { on: true, from: '10:00', to: '19:00', every: 3 }; l = plan(s);
ok(l.length === 4 * 14 && l[0].at.getHours() === 10 && l[3].at.getHours() === 19, 'water 3h custom');
s = base(); s.baby = { date: '2026-09-01' }; s.reminders = { water: { on: true } }; l = plan(s);
ok(l.some(n => n.title === '💧 الرضاعة تحتاج سوائل — كوب ماء؟'), 'baby water text');
// إشعارات الأسبوع مع التذكيرات: لا تداخل في الأرقام، وأسبوع 1–2 بدون «بحجم»
s = base(); s.notify = true; s.reminders = { water: { on: true } }; l = plan(s);
ok(new Set(l.map(n => n.id)).size === l.length, 'unique ids');
ok(l.some(n => n.id > 1000 && n.id <= 1040) && l.some(n => n.id >= 4000), 'weekly + reminders together');
s = { profile: { method: 'lmp', lmp: '2026-10-07' }, notify: true, dailyTip: { on: false } }; l = plan(s);
const w2 = l.find(n => n.id === 1002); ok(w2 && !/بحجم/.test(w2.body), 'week 2 has no size: ' + (w2 && w2.body));
const w3 = l.find(n => n.id === 1003); ok(w3 && /بحجم/.test(w3.body), 'week 3 has size');
// قبل الوقت الحالي لا يُجدول
s = base(); s.reminders = { med: { on: true, times: ['07:00'] } }; l = plan(s);
ok(l.length === 13 && l[0].at.getDate() === 9, 'past time today skipped');

// نصيحة كل يوم: 14 إشعاراً، ids 3000–3013، الساعة 9 افتراضياً، والجسم = hook اليوم الصحيح
s = base(); s.dailyTip = { on: true, time: '09:00' }; l = plan(s);
ok(l.length === 14, 'daily tips = 14, got ' + l.length);
ok(l.every((n, i) => n.id === 3000 + i && n.title === 'نصيحة اليوم 💡' && n.at.getHours() === 9 && n.at.getMinutes() === 0), 'daily ids/time/title');
const D = run(NOW); D.setS(s);
const day1 = Math.round((new Date(2026, 9, 8) - new Date(2026, 4, 1)) / 864e5) + 1; // يوم 8 أكتوبر من الحمل
ok(l[0].extra.view === 'more' && l[0].extra.sub === 'daily' && l[0].extra.d === day1 && l[13].extra.d === day1 + 13, 'daily extra d');
s.dailyTip.on = false; ok(plan(s).length === 0, 'daily off → 0');
s.dailyTip = { on: true, time: '21:30' }; l = plan(s); ok(l.length === 14 && l[0].at.getHours() === 21 && l[0].at.getMinutes() === 30, 'daily custom time');
s.dailyTip = { on: true, time: '07:00' }; l = plan(s); ok(l.length === 13, 'past time today skipped');
s.baby = { date: '2026-10-01' }; s.dailyTip = { on: true }; ok(plan(s).every(n => n.id < 3000 || n.id >= 4000), 'no daily tips after birth');
// مع الإشعار الأسبوعي في نفس اليوم والوقت: النصيحة بعده بنصف ساعة
s = base(); s.notify = true; s.dailyTip = { on: true, time: '10:00' }; l = plan(s);
const wk = l.filter(n => n.id > 1000 && n.id <= 1040), tp = l.filter(n => n.id >= 3000 && n.id < 3014);
wk.forEach(w => { const t = tp.find(x => x.at.toDateString() === w.at.toDateString()); if (t) ok(t.at.getTime() !== w.at.getTime() && t.at.getMinutes() === 30, 'collision shifted'); });
ok(new Set(l.map(n => n.id)).size === l.length, 'unique ids with all kinds');
// قرب نهاية الحمل: لا إشعارات بعد اليوم 280
s = { profile: { method: 'lmp', lmp: '2026-01-07' }, notify: false, dailyTip: { on: true } }; l = plan(s);
ok(l.length === 6 && l[0].extra.d === 275 && l[l.length - 1].extra.d === 280, 'stop at day 280, got ' + l.length);
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
