'use strict';
// قوالب HTML قابلة للطباعة وحفظها PDF من المتصفح
const { getSetting } = require('./db');

const LOGO = 'https://metal-lines.com/wp-content/uploads/2026/09/metal-lines-logo.png';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => Number(n || 0).toLocaleString('ar-SA-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function page(db, title, body, { autoPrint = true } = {}) {
  const company = getSetting(db, 'company_name');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  body{font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#1d2733;margin:24px;font-size:14px}
  header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1F3A5F;padding-bottom:12px;margin-bottom:16px}
  header img{height:56px} header h1{font-size:18px;margin:0;color:#1F3A5F} header p{margin:2px 0;color:#5a6772}
  h2{font-size:16px;color:#1F3A5F;border-right:4px solid #2E7D7A;padding-right:8px;margin-top:22px}
  table{width:100%;border-collapse:collapse;margin:8px 0} th,td{border:1px solid #c9d3dd;padding:6px 8px;text-align:right}
  th{background:#EEF4F8} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
  .grid img{width:100%;border:1px solid #c9d3dd;border-radius:6px} .muted{color:#5a6772;font-size:12px}
  .kv{display:grid;grid-template-columns:160px 1fr;gap:4px 12px} .kv b{color:#5a6772;font-weight:normal}
  .tot td{font-weight:bold;background:#f2f4f7} .sig{display:flex;justify-content:space-between;margin-top:48px}
  .sig div{width:30%;border-top:1px solid #333;text-align:center;padding-top:6px}
  @media print{body{margin:10mm} .noprint{display:none}}
</style></head><body>
<header><img src="${LOGO}" alt="" onerror="this.remove()"><div><h1>${esc(company)}</h1><p>${esc(title)}</p>
<p class="muted">نظام «موقعي» — طُبع في ${esc(new Date().toLocaleString('ar-SA-u-nu-latn'))}</p></div></header>
<button class="noprint" onclick="print()" style="font-size:16px;padding:8px 16px">طباعة / حفظ PDF</button>
${body}
${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>print(),400))</script>' : ''}
</body></html>`;
}

module.exports = { page, esc, money, LOGO };
