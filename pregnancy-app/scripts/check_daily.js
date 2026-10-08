/* فحص محتوى «نصيحة كل يوم» (daily.js): node scripts/check_daily.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'daily.js'), 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + '\nthis.DAILY = DAILY; this.DAILY_CATS = DAILY_CATS;', ctx);
const { DAILY, DAILY_CATS } = ctx;

const errs = [];
const bad = (d, m) => errs.push(`اليوم ${d}: ${m}`);
const CATS = ['baby', 'body', 'food', 'mind', 'prep', 'partner', 'wow'];
const BANNED = ['ملغ', 'مجم', 'حبة يومياً', 'جرعة', 'يضمن', 'يمنع تماماً', 'خطر!', 'ادخلي فوراً'];
const sentences = t => t.split(/(?<=[.؟!])\s+/).filter(s => s.trim()).length;
const all = x => [x.hook, x.title, x.text, x.act].join(' ');

if (DAILY.length !== 280) errs.push(`العدد ${DAILY.length} بدل 280`);
DAILY.forEach((x, i) => {
  const d = x.d;
  if (d !== i + 1) bad(d, `الترتيب: المتوقع ${i + 1}`);
  if (!CATS.includes(x.cat) || !DAILY_CATS[x.cat]) bad(d, `تصنيف غير مسموح: ${x.cat}`);
  if (x.cat !== CATS[(d - 1) % 7]) bad(d, `التصنيف لا يتبع دورة أيام الأسبوع: ${x.cat}`);
  const h = [...x.hook].length;
  if (h < 40 || h > 90) bad(d, `طول hook ${h}`);
  if (!/^\p{Extended_Pictographic}/u.test(x.hook)) bad(d, 'hook لا يبدأ بإيموجي');
  if (!x.title || [...x.title].length > 40) bad(d, `طول title ${[...x.title].length}`);
  const t = [...x.text].length, n = sentences(x.text);
  if (t > 350) bad(d, `طول text ${t}`);
  if (n < 2 || n > 4) bad(d, `عدد جمل text ${n}`);
  if (typeof x.act !== 'string') bad(d, 'act ليس نصاً');
  BANNED.forEach(w => all(x).includes(w) && bad(d, `كلمة ممنوعة: ${w}`));
  if (d <= 14 && /طفلك|الجنين/.test(all(x))) bad(d, 'ذكر طفلك/الجنين قبل اليوم 15');
  if (d < 106 && /حركة|حركات|ركلة|ركل/.test(all(x))) bad(d, 'ذكر الحركة/الركل قبل اليوم 106');
  if (d < 246 && /GBS|العقدية/.test(all(x))) bad(d, 'مسحة GBS قبل الأسبوع 36');
  if (d < 204 && /حقيبة الولادة/.test(all(x))) bad(d, 'حقيبة الولادة قبل الأسبوع 30');
});
['hook', 'title'].forEach(k => {
  const seen = {};
  DAILY.forEach(x => { if (seen[x[k]]) bad(x.d, `${k} مكرر مع اليوم ${seen[x[k]]}`); else seen[x[k]] = x.d; });
});

if (errs.length) { console.log(errs.join('\n')); console.log(`\n${errs.length} مشكلة`); process.exit(1); }
console.log(`✓ ${DAILY.length} نصيحة سليمة`);
