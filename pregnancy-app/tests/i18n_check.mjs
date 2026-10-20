/* فحص الترجمات: يستخرج كل نصوص L('...') وL`...` من الكود ويقارنها بملف الترجمة.
   التشغيل: npm i --no-save acorn acorn-walk && node tests/i18n_check.mjs [en] [--dump keys.json]
   يفشل (exit 1) لو في نص بلا ترجمة، أو ترجمة لا تحتوي نفس المتغيرات {0} {1}… */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const acorn = require('acorn'), walk = require('acorn-walk');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FILES = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'i18n.js');
const args = process.argv.slice(2);
const lang = args.find(a => /^[a-z]{2}$/.test(a)) || 'en';
const dumpAt = args.indexOf('--dump');

export function extract() {
  const keys = new Map();
  const add = (k, where) => { k = k.trim(); if (k && !keys.has(k)) keys.set(k, where); };
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
    walk.full(ast, n => {
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'L' && n.arguments[0]?.type === 'Literal')
        add(n.arguments[0].value.trim() + (n.arguments[1]?.type === 'Literal' ? '|' + n.arguments[1].value : ''), `${f}:${n.loc.start.line}`);
      if (n.type === 'TaggedTemplateExpression' && n.tag.type === 'Identifier' && n.tag.name === 'L')
        add(n.quasi.quasis.map((q, i) => (i ? `{${i - 1}}` : '') + q.value.cooked).join(''), `${f}:${n.loc.start.line}`);
    });
  }
  // أسئلة «فريق نبض» (JSON يُترجم وقت العرض بـ L.t)
  const seedSrc = fs.readFileSync(path.join(ROOT, 'community_seed.js'), 'utf8');
  for (const s of JSON.parse(seedSrc.slice(seedSrc.indexOf('['), seedSrc.lastIndexOf(']') + 1)))
    for (const f of ['stage', 'title', 'body', 'answer']) add(s[f], 'community_seed.js');
  // نصوص الصفحة الثابتة في index.html
  const body = html.slice(html.indexOf('<body>'), html.indexOf('<script'));
  for (const m of body.matchAll(/>([^<>]*[؀-ۿ][^<>]*)</g)) add(m[1], 'index.html');
  for (const m of body.matchAll(/(?:aria-label|title|placeholder)="([^"]*[؀-ۿ][^"]*)"/g)) add(m[1], 'index.html');
  return keys;
}

const keys = extract();
if (dumpAt >= 0) { fs.writeFileSync(args[dumpAt + 1], JSON.stringify([...keys].map(([k, w]) => ({ k, w })), null, 1)); console.log('dumped', keys.size); process.exit(0); }

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n', `${lang}.js`), 'utf8'), ctx);
const dict = ctx.window[`I18N_${lang.toUpperCase()}`];
const vars = s => (s.match(/\{\d+(?::a)?\}/g) || []).map(x => x.replace(":a", "")).sort().join();
let missing = 0, bad = 0;
for (const [k, w] of keys) {
  if (!(k in dict)) { missing++; if (missing <= 30) console.log('missing', w, JSON.stringify(k.slice(0, 80))); continue; }
  if (vars(k) !== vars(dict[k])) { bad++; console.log('placeholders differ', w, JSON.stringify(k.slice(0, 60)), '→', JSON.stringify(dict[k].slice(0, 60))); }
}
const unused = Object.keys(dict).filter(k => !keys.has(k));
console.log(`${lang}: ${keys.size} texts, ${missing} missing, ${bad} with wrong placeholders, ${unused.length} unused`);
process.exit(missing || bad ? 1 : 0);
