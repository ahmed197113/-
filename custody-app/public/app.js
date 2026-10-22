// نظام إدارة العهد — واجهة المستخدم
'use strict';

// ================= البيئة والاتصال =================
const NATIVE = window.AndroidBridge || null;
if (NATIVE) window.print = () => NATIVE.print();
const URLQ = new URLSearchParams(location.search);
const MODE = URLQ.get('mode') || (URLQ.has('demo') ? 'demo' : location.hostname === 'app.local' ? 'local' : 'server');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
const TOKEN_KEY = 'custody_token_' + MODE;
const BRAND = { name: 'الخطوط المعدنية', full: 'شركة الخطوط المعدنية للمقاولات العامة', logo: '/logo.png' };
const S = { token: store.get(TOKEN_KEY), user: null, b: null, backend: null, unread: 0 };

async function serverApi(method, url, body, token) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'تعذر الاتصال بالخادم'), { status: res.status });
  return data;
}
async function initBackend() {
  if (MODE === 'server') return { mode: 'server', api: serverApi, fileSrc: async id => `/api/files/${id}?token=${encodeURIComponent(S.token)}` };
  return window.createLocalBackend(MODE === 'demo' ? 'custody-demo' : 'custody-local', { demo: MODE === 'demo' });
}
async function api(method, url, body) {
  try { return await S.backend.api(method, url, body, S.token); } catch (e) {
    if (e.status === 401 && !/\/api\/(login|setup)/.test(url) && S.user) logout(true);
    throw e;
  }
}

// ================= أدوات =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const cur = () => esc(S.b?.settings.currency || '');
const money = (n, cls = '') => `<span class="money ${cls}"><span class="num">${fmt(n)}</span> <small>${cur()}</small></span>`;
const signed = n => money(n, n < 0 ? 'neg' : '');
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const isStaff = () => S.user && S.user.role !== 'employee';
const isAdmin = () => S.user && S.user.role === 'admin';
const isOwner = () => S.user && S.user.role === 'owner';
// الموظف والمالك: واجهة مبسطة بلا قوائم جانبية
const isSimple = () => S.user && (S.user.role === 'employee' || S.user.role === 'owner');
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const fmtDate = d => d ? `<span class="num">${esc(String(d).slice(0, 10))}</span>` : '—';
function ago(iso) {
  if (!iso) return 'لا يوجد';
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.round(h / 24);
  return d < 30 ? `منذ ${d} يوم` : iso.slice(0, 10);
}
function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
const go = hash => { location.hash = hash; };
const qsOf = obj => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

const ICONS = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4|M3 5v14a2 2 0 0 0 2 2h16v-5|M18 12a2 2 0 0 0 0 4h4v-4z',
  receipt: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8',
  check: 'M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z|M3.27 6.96L12 12.01l8.73-5.05|M12 22.08V12',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  layers: 'M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z|M7 7h.01',
  chart: 'M18 20V10|M12 20V4|M6 20v-6',
  settings: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  list: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14|M5 12h14',
  back: 'M5 12h14|M12 5l7 7-7 7',
  chev: 'M15 18l-6-6 6-6',
  grid: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2|M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  print: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35',
  x: 'M18 6L6 18|M6 6l12 12',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z|M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z|M12 9v4|M12 17h.01',
  swap: 'M17 1l4 4-4 4|M3 11V9a4 4 0 0 1 4-4h14|M7 23l-4-4 4-4|M21 13v2a4 4 0 0 1-4 4H3',
  undo: 'M9 14L4 9l5-5|M20 20v-7a4 4 0 0 0-4-4H4',
  lock: 'M5 11h14v10H5z|M7 11V7a5 5 0 0 1 10 0v4',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6|M9 6V4h6v2',
  ok: 'M20 6L9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2',
  clip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  file: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z|M13 2v7h7',
  bank: 'M3 21h18|M3 10h18|M5 6l7-3 7 3|M4 10v11|M20 10v11|M8 14v3|M12 14v3|M16 14v3',
};
const ic = (name, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name].split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;

// ================= النوافذ والنماذج =================
function modal(html, { onMount, wide, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog"><button class="modal-x" data-close aria-label="إغلاق">${ic('x')}</button>${html}</div>`;
  const close = () => { back.remove(); onClose && onClose(); };
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  $('#modal-root').appendChild(back);
  onMount && onMount(back, close);
  hydrateFiles(back);
  return close;
}
const closeAllModals = () => $$('.modal-back').forEach(m => m.remove());
function confirmBox(msg, { ok = 'تأكيد', danger } = {}) {
  return new Promise(resolve => modal(`<h3>${esc(msg)}</h3><div class="sheet-foot"><button class="btn ghost" data-close>إلغاء</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${ok}</button></div>`, {
    onMount: (el, close) => { $('#cf-ok', el).onclick = () => { resolve(true); close(); }; },
    onClose: () => resolve(false),
  }));
}

const opts = (list, selected, empty) => (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') + list.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(selected ?? '') ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('');
const ccOptions = ({ activeOnly = true } = {}) => S.b.costCenters.filter(c => !activeOnly || c.active !== false).map(c => ({ value: c.id, label: (c.depth ? '   '.repeat(c.depth) + '└ ' : '') + (c.code ? c.code + ' · ' : '') + c.name }));
const userOptions = (filter = () => true) => S.b.users.filter(u => u.active && filter(u)).map(u => ({ value: u.id, label: `${u.name}${u.jobTitle ? ' — ' + u.jobTitle : ''}` }));
const ccName = id => { const c = S.b.costCenters.find(x => x.id === id); return c ? (c.code ? c.code + ' · ' : '') + c.name : '—'; };
const srcOptions = () => S.b.fundSources.filter(x => x.active !== false).map(x => ({ value: x.id, label: x.name }));
const srcField = (label = 'مصدر المبلغ — صُرف من؟', value) => ({ type: 'chips', name: 'sourceId', label, options: srcOptions(), value: value ?? srcOptions()[0]?.value ?? '', hint: S.b.fundSources.length ? '' : 'أضف مصادر الأموال من «مصادر الأموال»' });

function fieldHtml(f) {
  const full = f.full ? 'full' : '';
  const req = f.required ? 'required' : '';
  const label = f.label ? `<label for="f-${f.name}">${esc(f.label)}${f.required ? ' <b class="req">*</b>' : ''}</label>` : '';
  const hint = f.hint ? `<div class="hint">${f.hint}</div>` : '';
  const val = f.value ?? '';
  switch (f.type) {
    case 'section': return `<div class="full form-section">${esc(f.label)}</div>`;
    case 'html': return `<div class="${f.half ? '' : 'full'}">${f.html}</div>`;
    case 'select': return `<div class="field ${full}">${label}<select id="f-${f.name}" name="${f.name}" ${req}>${f.optionsHtml || opts(f.options || [], val, f.empty)}</select>${hint}</div>`;
    case 'textarea': return `<div class="field full">${label}<textarea id="f-${f.name}" name="${f.name}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>${hint}</div>`;
    case 'money': return `<div class="field full">${label}<div class="money-input"><input id="f-${f.name}" class="amount-input" name="${f.name}" type="number" step="0.01" min="0" inputmode="decimal" ${req} value="${esc(val)}" placeholder="0.00"><span>${cur()}</span></div>${hint}</div>`;
    case 'toggle': return `<label class="toggle ${f.half ? '' : 'full'}"><input type="checkbox" name="${f.name}" data-bool ${val ? 'checked' : ''}><span class="switch"></span><span>${esc(f.label)}</span></label>`;
    case 'chips': return `<div class="field full">${label}<input type="hidden" name="${f.name}" value="${esc(val)}"><div class="chips" data-chips="${f.name}">${(f.options || []).map(o => `<button type="button" class="chip ${String(o.value) === String(val) ? 'on' : ''}" data-v="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div>${hint}</div>`;
    case 'days': return `<div class="field full">${label}<div class="chips" data-days="${f.name}">${DAYS.map((d, i) => `<button type="button" class="chip ${(val || []).includes(i) ? 'on' : ''}" data-v="${i}">${d}</button>`).join('')}</div></div>`;
    case 'files': return `<div class="field full" data-files="${f.name}">${label}<div class="thumbs"></div><label class="btn ghost file-btn">${ic('camera')} <span>${esc(f.button || 'إرفاق صورة الفاتورة')}</span><input type="file" accept="image/*,application/pdf" multiple hidden></label>${hint}</div>`;
    default: return `<div class="field ${full}">${label}<input id="f-${f.name}" name="${f.name}" type="${f.type || 'text'}" ${req} value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.attrs || ''}>${hint}</div>`;
  }
}
function readForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'file') continue;
    d[el.name] = el.dataset.bool !== undefined ? el.checked : el.value;
  }
  $$('[data-days]', form).forEach(w => { d[w.dataset.days] = $$('.chip.on', w).map(c => +c.dataset.v); });
  $$('[data-files]', form).forEach(w => { d[w.dataset.files] = (w._files || []).slice(); });
  return d;
}
function bindWidgets(root) {
  $$('[data-chips]', root).forEach(w => w.addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    $$('.chip', w).forEach(x => x.classList.toggle('on', x === c));
    const input = $(`input[name="${w.dataset.chips}"]`, w.parentNode);
    input.value = c.dataset.v;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  $$('[data-days]', root).forEach(w => w.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); }));
  $$('[data-files]', root).forEach(w => {
    w._files = w._files || [];
    const render = () => {
      $('.thumbs', w).innerHTML = w._files.map((f, i) => `<div class="thumb">${String(f).startsWith('data:application/pdf') ? `<div class="pdf">${ic('file', 28)}PDF</div>` : String(f).startsWith('data:') ? `<img src="${f}" alt="">` : `<img data-file="${esc(f)}" alt="">`}<button type="button" data-rm="${i}" aria-label="حذف">${ic('x', 14)}</button></div>`).join('');
      hydrateFiles(w);
    };
    w._render = render;
    render();
    w.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { w._files.splice(+b.dataset.rm, 1); render(); } });
    $('input[type=file]', w).addEventListener('change', async e => {
      for (const file of [...e.target.files].slice(0, 6 - w._files.length)) {
        try {
          if (file.type === 'application/pdf') {
            if (file.size > 5e6) { toast('ملف PDF أكبر من 5 ميجا', true); continue; }
            w._files.push(await readAsDataUrl(file));
          } else w._files.push(await compressImage(file));
        } catch (err) { toast(err.message, true); }
      }
      e.target.value = '';
      render();
    });
  });
}
function formSheet({ title, intro = '', fields, submit = 'حفظ', onSubmit, onMount, wide, files }) {
  return modal(`<h3>${title}</h3>${intro}<form class="form" novalidate>${fields.map(fieldHtml).join('')}<div class="sheet-foot full"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary" type="submit">${submit}</button></div></form>`, {
    wide,
    onMount: (el, close) => {
      const form = $('form', el);
      if (files) for (const [name, list] of Object.entries(files)) { const w = $(`[data-files="${name}"]`, form); if (w) w._files = list.slice(); }
      bindWidgets(form);
      form.onsubmit = async ev => {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        const btn = $('[type=submit]', form);
        btn.disabled = true;
        try { await onSubmit(readForm(form), close, el); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
      };
      onMount && onMount(el, close, form);
    },
  });
}
const readAsDataUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('تعذر قراءة الملف')); r.readAsDataURL(file); });
function compressImage(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    img.src = URL.createObjectURL(file);
  });
}
async function hydrateFiles(root) {
  for (const img of $$('img[data-file]', root)) {
    const id = img.dataset.file;
    img.removeAttribute('data-file');
    try { img.src = await S.backend.fileSrc(id); } catch { }
  }
}
function openFile(id) {
  S.backend.fileSrc(id).then(src => {
    if (String(src).startsWith('data:application/pdf') || /\.pdf/.test(src)) {
      if (String(src).startsWith('data:')) downloadFile('مرفق.pdf', src.split(',')[1], 'application/pdf', true); else window.open(src);
    } else modal(`<h3>المرفق</h3><img class="receipt-img" src="${esc(src)}" alt="مرفق">`, { wide: true });
  });
}

// تنزيل ملف (Excel / نسخة احتياطية) — في تطبيق أندرويد عبر الجسر الأصلي
function downloadFile(name, content, mime, isBase64 = false) {
  if (NATIVE && NATIVE.saveFile) {
    const b64 = isBase64 ? content : btoa(unescape(encodeURIComponent(content)));
    NATIVE.saveFile(name, mime, b64);
    return;
  }
  const blob = isBase64 ? new Blob([Uint8Array.from(atob(content), c => c.charCodeAt(0))], { type: mime }) : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCsv(name, columns, rows, totals) {
  const e = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map(c => e(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map(c => e(typeof r[c.key] === 'string' ? r[c.key].replace(/ /g, '  ') : r[c.key])).join(','));
  if (totals) lines.push(columns.map((c, i) => e(i === 0 ? 'الإجمالي' : totals[c.key] ?? '')).join(','));
  downloadFile(name + '.csv', '﻿' + lines.join('\r\n'), 'text/csv');
  toast('تم تصدير الملف (يفتح في Excel)');
}

// الطباعة: مستند مستقل يُطبع وحده
function printDoc(html) {
  $('#print-root').innerHTML = `<div class="print-doc">${printHeader()}${html}</div>`;
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing'), 800); }, 150);
}
function printHeader() {
  const s = S.b.settings;
  return `<div class="ph"><img class="ph-logo" src="${BRAND.logo}" alt=""><div class="ph-info"><div class="ph-co">${esc(s.companyName || BRAND.full)}</div>${s.address ? `<div>${esc(s.address)}</div>` : ''}${s.vatNumber ? `<div>الرقم الضريبي: <span class="num">${esc(s.vatNumber)}</span></div>` : ''}</div><div class="ph-date">تاريخ الطباعة: <span class="num">${today()}</span></div></div>`;
}
const signatures = names => `<div class="sigs">${names.map(n => `<div><div class="sig-line"></div>${esc(n)}</div>`).join('')}</div>`;

// ================= البدء والدخول =================
(async function start() {
  try { S.backend = await initBackend(); } catch (e) { $('#app').innerHTML = `<div class="center-msg">تعذر تشغيل التطبيق: ${esc(e.message)}</div>`; return; }
  let st;
  try { st = await api('GET', '/api/status'); } catch (e) { return renderOffline(e); }
  if (st.needsSetup) return renderSetup();
  if (S.token) { try { await boot(); return; } catch { } }
  renderLogin(st);
})();

function renderOffline(e) {
  $('#app').innerHTML = `<div class="auth"><div class="card auth-card"><div class="auth-logo"><img src="${BRAND.logo}" alt=""></div><h1>تعذر الاتصال بالخادم</h1><p class="muted center">${esc(e.message)}</p><button class="btn primary lg" onclick="location.reload()">إعادة المحاولة</button>${NATIVE ? '<button class="btn ghost lg" onclick="AndroidBridge.changeServer()">تغيير طريقة التشغيل</button>' : ''}</div></div>`;
}
const MODE_NOTE = { local: 'البيانات محفوظة على هذا الجهاز — يعمل بدون إنترنت', demo: 'وضع تجريبي ببيانات وهمية', server: '' };
function authShell(inner) {
  $('#app').innerHTML = `<div class="auth"><div class="card auth-card">
    <div class="auth-logo"><img src="${BRAND.logo}" alt="${BRAND.name}"></div>
    <h1>${BRAND.full}</h1>
    <p class="muted center">نظام إدارة العهد النقدية والعينية</p>
    ${MODE_NOTE[MODE] ? `<div class="mode-pill">${MODE === 'demo' ? '🧪' : '📱'} ${MODE_NOTE[MODE]}</div>` : ''}
    ${inner}
    ${NATIVE ? `<button class="btn link" onclick="AndroidBridge.changeServer()">تغيير طريقة التشغيل</button>` : ''}
  </div></div>`;
}
function renderSetup() {
  authShell(`<h2 class="center">إعداد النظام لأول مرة</h2>
    <form id="setup" class="form one">
      ${fieldHtml({ name: 'companyName', label: 'اسم الشركة', required: true, full: true, value: BRAND.full })}
      ${fieldHtml({ name: 'name', label: 'اسمك (مدير النظام)', required: true, full: true })}
      ${fieldHtml({ name: 'username', label: 'اسم المستخدم للدخول', required: true, full: true, attrs: 'dir="ltr" autocapitalize="off"' })}
      ${fieldHtml({ name: 'password', label: 'كلمة المرور', type: 'password', required: true, full: true, attrs: 'minlength="4"' })}
      <button class="btn primary lg full">إنشاء النظام والبدء</button>
    </form>`);
  $('#setup').onsubmit = async e => {
    e.preventDefault();
    try { const r = await api('POST', '/api/setup', readForm(e.target)); setToken(r.token); await boot(); } catch (err) { toast(err.message, true); }
  };
}
function renderLogin(st = {}) {
  const demo = MODE === 'demo' ? `<div class="demo-box"><p class="muted center">اختر حساباً تجريبياً:</p><div class="demo-grid">
    ${[['admin', 'admin', 'مدير النظام'], ['sara', '1234', 'محاسبة'], ['mohamed', '1234', 'موظف: محمد'], ['khaled', '1234', 'موظف: خالد']].map(([u, p, l]) => `<button class="btn ghost" data-demo="${u}|${p}">${l}</button>`).join('')}</div></div>` : '';
  authShell(`<form id="login" class="form one">
      ${fieldHtml({ name: 'username', label: 'اسم المستخدم', required: true, full: true, attrs: 'dir="ltr" autocapitalize="off" autocomplete="username"' })}
      ${fieldHtml({ name: 'password', label: 'كلمة المرور', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' })}
      <button class="btn primary lg full">دخول</button>
    </form>${demo}`);
  const doLogin = async d => { const r = await api('POST', '/api/login', d); setToken(r.token); history.replaceState(null, '', location.pathname + location.search); await boot(); };
  $('#login').onsubmit = e => { e.preventDefault(); doLogin(readForm(e.target)).catch(err => toast(err.message, true)); };
  $$('[data-demo]').forEach(b => b.onclick = () => { const [username, password] = b.dataset.demo.split('|'); doLogin({ username, password }).catch(err => toast(err.message, true)); });
}
const setToken = t => { S.token = t; store.set(TOKEN_KEY, t); };
async function logout(silent) {
  if (!silent) { try { await api('POST', '/api/logout'); } catch { } }
  stopTimers();
  S.token = null; S.user = null; store.del(TOKEN_KEY);
  closeAllModals();
  history.replaceState(null, '', location.pathname + location.search);
  renderLogin(await api('GET', '/api/status').catch(() => ({})));
}
async function refreshBootstrap() {
  S.b = await api('GET', '/api/bootstrap');
  S.user = S.b.user;
  S.unread = S.b.unread;
  updateBadges();
}
async function boot() {
  await refreshBootstrap();
  renderShell();
  startTimers();
  if ('serviceWorker' in navigator && MODE === 'server') navigator.serviceWorker.register('/sw.js').catch(() => { });
  router();
}

// ================= الهيكل والتنقل =================
const NAV_STAFF = [
  ['', [['dashboard', 'home', 'الرئيسية']]],
  ['العمليات', [['custodies', 'wallet', 'العهد النقدية'], ['expenses', 'check', 'المصروفات والاعتماد', 'pending'], ['requests', 'inbox', 'طلبات العهد', 'requests'], ['assets', 'box', 'العهد العينية']]],
  ['البيانات الأساسية', [['cost-centers', 'layers', 'المشاريع ومراكز التكلفة'], ['users', 'users', 'الموظفون'], ['sources', 'bank', 'مصادر الأموال'], ['categories', 'tag', 'بنود المصروفات']]],
  ['التحليل', [['reports', 'chart', 'التقارير'], ['audit', 'list', 'سجل العمليات']]],
  ['', [['settings', 'settings', 'الإعدادات']]],
];
const NAV_EMP = [['', [['home', 'home', 'الرئيسية'], ['custodies', 'wallet', 'عهدي النقدية'], ['expenses', 'receipt', 'مصروفاتي'], ['assets', 'box', 'عهدي العينية'], ['requests', 'inbox', 'طلباتي'], ['report/statement', 'chart', 'كشف حسابي'], ['settings', 'settings', 'الإعدادات']]]];
const BOTTOM_STAFF = [['dashboard', 'home', 'الرئيسية'], ['custodies', 'wallet', 'العهد'], ['expenses', 'check', 'الاعتماد', 'pending'], ['reports', 'chart', 'التقارير'], ['more', 'grid', 'المزيد']];
const BOTTOM_EMP = [['home', 'home', 'الرئيسية'], ['expenses', 'receipt', 'مصروفاتي'], ['custodies', 'wallet', 'عهدي'], ['notifications', 'bell', 'الإشعارات', 'unread'], ['more', 'grid', 'المزيد']];

function renderShell() {
  const nav = isStaff() ? NAV_STAFF : NAV_EMP;
  const bottom = isStaff() ? BOTTOM_STAFF : BOTTOM_EMP;
  const link = ([k, icon, label, badge]) => `<a href="#/${k}" data-nav="${k}">${ic(icon)}<span>${label}</span>${badge ? `<b class="badge" data-badge="${badge}" hidden></b>` : ''}</a>`;
  $('#app').innerHTML = `
  <div class="layout ${isSimple() ? 'simple' : ''}">
    <aside class="sidebar">
      <div class="brand"><img src="${BRAND.logo}" alt=""><div><div class="brand-name">${BRAND.name}</div><div class="brand-sub">للمقاولات العامة · نظام العهد</div></div></div>
      ${MODE !== 'server' ? `<div class="side-mode">${MODE === 'demo' ? '🧪 وضع تجريبي' : '📱 على هذا الجهاز'}</div>` : ''}
      <nav class="nav">${nav.map(([g, items]) => `${g ? `<div class="nav-group">${g}</div>` : ''}${items.map(link).join('')}`).join('')}</nav>
      <div class="me"><div class="avatar">${esc(S.user.name.trim()[0] || '؟')}</div><div><div class="me-name">${esc(S.user.name)}</div><div class="me-role">${esc(S.user.roleName)}</div></div><button class="icon-btn" data-act="logout" title="تسجيل الخروج">${ic('logout')}</button></div>
    </aside>
    <div class="main-col">
      <header class="appbar">
        <button class="icon-btn back-btn" data-act="back" hidden aria-label="رجوع">${ic('back')}</button>
        <img class="appbar-logo" src="${BRAND.logo}" alt="">
        <h1 id="page-title"></h1>
        <a class="icon-btn bell" href="#/notifications" aria-label="الإشعارات">${ic('bell')}<b class="badge" data-badge="unread" hidden></b></a>
      </header>
      <main id="view"></main>
    </div>
    <nav class="bottom-nav">${bottom.map(link).join('')}</nav>
    <button class="fab" data-act="fab" aria-label="إضافة">${ic('plus', 26)}</button>
  </div>`;
  updateBadges();
}
function updateBadges() {
  const vals = { unread: S.unread, pending: S.pendingCount || 0, requests: S.requestsCount || 0 };
  $$('[data-badge]').forEach(b => { const v = vals[b.dataset.badge]; b.hidden = !v; b.textContent = v > 99 ? '99+' : v; });
}
function view(title, html, { back, toolbar } = {}) {
  // واجهة الموظف المبسطة: بلا قوائم، وكل صفحة غير الرئيسية ترجع للرئيسية
  if (isSimple() && !back && !['home', 'dashboard', ''].includes(parseHash().page)) back = isStaff() ? '#/dashboard' : '#/home';
  $('#page-title').textContent = title;
  document.title = title + ' — ' + BRAND.name;
  const bb = $('.back-btn');
  bb.hidden = !back;
  $('.appbar-logo').hidden = !!back;
  bb.dataset.to = back === true ? '' : back || '';
  $('#view').innerHTML = (toolbar ? `<div class="toolbar">${toolbar}</div>` : '') + html;
  const page = (location.hash.split('?')[0].split('/')[1]) || '';
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page || a.dataset.nav === page + '/' + (location.hash.split('?')[0].split('/')[2] || '')));
  hydrateFiles($('#view'));
  bindWidgets($('#view'));
}
function parseHash() {
  const [path, qs] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  return { page: parts[0] || '', arg: parts[1], q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
async function router() {
  if (!S.user) return;
  const { page, arg, q } = parseHash();
  if (page === 'reminder') { history.replaceState(null, '', location.pathname + location.search + '#/' + (isStaff() ? 'dashboard' : 'home')); router(); return handleReminderAction(arg); }
  const views = isOwner() ? OWNER_VIEWS : isStaff() ? STAFF_VIEWS : EMP_VIEWS;
  const fn = views[page] || views[isStaff() ? 'dashboard' : 'home'];
  $('#view') && ($('#view').innerHTML = '<div class="loading"><span></span></div>');
  try { await fn(arg, q); } catch (e) { toast(e.message, true); }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);

// النقرات العامة
const ACT = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el, e); }
  const f = e.target.closest('[data-open-file]');
  if (f) { e.preventDefault(); openFile(f.dataset.openFile); }
});
// أي خطأ في زر لم يُعالَج يظهر للمستخدم بدل أن يفشل بصمت
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.message) toast(e.reason.message, true); });
// حذف لمدير النظام بعد التأكيد
async function adminDelete(msg, url, done) {
  if (!(await confirmBox(msg, { ok: 'حذف نهائي', danger: true }))) return;
  try { await api('DELETE', url); toast('تم الحذف'); await refreshBootstrap(); done ? done() : router(); } catch (e) { toast(e.message, true); }
}
ACT.logout = async () => { if (await confirmBox('تسجيل الخروج من النظام؟', { ok: 'خروج' })) logout(); };
ACT.back = el => { if (el.dataset.to) go(el.dataset.to); else history.back(); };
ACT.fab = () => {
  const items = isStaff()
    ? [['wallet', 'صرف عهدة نقدية', () => custodyForm()], ['receipt', 'تسجيل مصروف', () => expenseForm()], ['box', 'إضافة / تسليم أصل', () => assetForm()], ['users', 'إضافة موظف', () => userForm()], ['layers', 'إضافة مركز تكلفة', () => ccForm()]]
    : [['receipt', 'تسجيل مصروف', () => expenseForm()], ['undo', 'رد مبلغ نقدي', () => returnForm()], ['inbox', 'طلب عهدة', () => requestForm()]];
  modal(`<h3>إجراء سريع</h3><div class="action-list">${items.map(([i, l], n) => `<button class="action-item" data-i="${n}">${ic(i)}<span>${l}</span>${ic('chev', 16)}</button>`).join('')}</div>`, {
    onMount: (el, close) => $$('[data-i]', el).forEach(b => b.onclick = () => { close(); items[+b.dataset.i][2](); }),
  });
};

// مكونات عرض
const kpi = (label, value, { sub = '', tone = '', go: href } = {}) => `<${href ? `a href="${href}"` : 'div'} class="kpi ${tone}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</${href ? 'a' : 'div'}>`;
const empty = (text, action = '') => `<div class="empty"><div class="empty-ic">${ic('inbox', 34)}</div><div>${text}</div>${action}</div>`;
const tag = (text, tone = '') => `<span class="tag ${tone}">${esc(text)}</span>`;
const STATUS_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad', open: 'ok', closed: '', confirmed: 'ok' };
const expTag = e => tag(e.statusName || S.b.expenseStatus[e.status], STATUS_TONE[e.status]) + (e.settlementNo ? ' ' + tag('مسوّى', '') : '');
const tabs = (items, active, base) => `<div class="tabs" role="tablist">${items.map(([v, l, n]) => `<a href="${base}${v ? (base.includes('?') ? '&' : '?') + v : ''}" class="${active === v ? 'on' : ''}">${l}${n ? ` <b>${n}</b>` : ''}</a>`).join('')}</div>`;
const progress = (used, total, cls = '') => { const p = total ? Math.min(100, Math.round(used / total * 100)) : 0; return `<div class="progress ${p >= 100 ? 'over' : p >= 85 ? 'warn' : ''} ${cls}"><span style="width:${p}%"></span></div>`; };
const card = (title, body, actions = '') => `<section class="card">${title ? `<div class="card-head"><h2>${title}</h2><div class="card-actions">${actions}</div></div>` : ''}${body}</section>`;
const rows = pairs => `<dl class="dl">${pairs.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const btn = (label, { act, href, icon, cls = '', data = '' } = {}) => href ? `<a class="btn ${cls}" href="${href}">${icon ? ic(icon, 18) : ''}<span>${label}</span></a>` : `<button class="btn ${cls}" ${act ? `data-act="${act}"` : ''} ${data}>${icon ? ic(icon, 18) : ''}<span>${label}</span></button>`;

function custodyItem(c) {
  return `<a class="item" href="#/custody/${c.id}">
    <div class="item-ic ${c.status === 'closed' ? 'muted-ic' : c.overdue ? 'bad-ic' : ''}">${ic('wallet')}</div>
    <div class="item-main"><div class="item-title">${esc(c.no)} · ${esc(isStaff() ? c.employeeName : c.purpose)} ${c.direct ? tag('تعميد مباشر', 'info') : ''} ${c.overdue ? tag('متأخرة', 'bad') : ''} ${c.status === 'closed' ? tag('مغلقة') : ''}</div>
      <div class="item-sub">${esc(c.kindName)}${isStaff() ? ' — ' + esc(c.purpose) : ''}</div>
      <div class="item-sub">${esc(c.costCenterName)}</div>
      ${progress(c.spent, c.received)}</div>
    <div class="item-end">${signed(c.balance)}<div class="item-endsub">من ${fmt(c.received)}</div>${c.pendingCount ? `<div class="item-endsub warn-t">${c.pendingCount} بانتظار الاعتماد</div>` : ''}</div></a>`;
}
function expenseItem(e, { select } = {}) {
  return `<div class="item ${select ? 'selectable' : ''}">
    ${select && e.status === 'pending' && !e.settlementId ? `<label class="chk"><input type="checkbox" data-sel="${e.id}"></label>` : ''}
    <a class="item-link" href="#/expense/${e.id}">
      <div class="item-main"><div class="item-title">${esc(e.description)} ${e.attachments?.length ? `<span class="clip">${ic('clip', 14)}</span>` : ''}</div>
        <div class="item-sub">${esc(e.categoryName)} · ${esc(e.costCenterName)}</div>
        <div class="item-meta">${esc(e.no)} · ${fmtDate(e.date)}${isStaff() ? ' · ' + esc(e.employeeName) : ''}${e.viaReminder ? ' · 🔔' : ''}</div></div>
      <div class="item-end">${money(e.amount)}<div>${expTag(e)}</div></div>
    </a></div>`;
}

// ================= واجهة الإدارة =================
const STAFF_VIEWS = {
  async dashboard() {
    const d = await api('GET', '/api/dashboard');
    S.pendingCount = d.kpis.pendingCount; S.requestsCount = d.alerts.requests; updateBadges();
    const al = d.alerts;
    const alerts = [
      d.kpis.pendingCount && ['check', 'warn', `${d.kpis.pendingCount} مصروف بانتظار الاعتماد بقيمة ${fmt(d.kpis.pendingAmount)}`, '#/expenses'],
      al.requests && ['inbox', 'warn', `${al.requests} طلب عهدة جديد`, '#/requests'],
      al.pendingTx && ['undo', 'warn', `${al.pendingTx} رد نقدي بانتظار تأكيد الاستلام`, '#/custodies?status=open'],
      ...al.overdue.map(c => ['clock', 'bad', `العهدة ${c.no} (${c.employeeName}) متأخرة عن التسوية`, '#/custody/' + c.id]),
      ...al.negative.map(c => ['alert', 'bad', `العهدة ${c.no} (${c.employeeName}) بالسالب ${fmt(c.balance)} — يستحق للموظف`, '#/custody/' + c.id]),
      ...al.low.map(c => ['wallet', 'warn', `رصيد العهدة ${c.no} (${c.employeeName}) منخفض: ${fmt(c.balance)}`, '#/custody/' + c.id]),
      ...al.overBudget.map(c => ['layers', c.spent > c.budget ? 'bad' : 'warn', `مركز ${c.name}: صرف ${fmt(c.spent)} من ميزانية ${fmt(c.budget)}`, '#/cost-centers']),
      al.unacknowledged && ['box', 'warn', `${al.unacknowledged} عهدة عينية لم يقر الموظف باستلامها`, '#/assets?status=assigned'],
    ].filter(Boolean);
    const st = d.setup;
    const setupSteps = [[st.costCenters, 'أضف مراكز التكلفة (المشاريع / الأقسام)', '#/cost-centers'], [st.employees, 'أضف الموظفين وحساباتهم', '#/users'], [st.custodies, 'اصرف أول عهدة لموظف', '#/custodies']];
    const showSetup = setupSteps.some(s => !s[0]);
    const [src, an] = await Promise.all([api('GET', '/api/reports/sources'), api('GET', '/api/analytics')]);
    view('الرئيسية', `
      <div class="home-head">
        <div class="hh-top"><div><div class="hh-hi">مرحباً ${esc(S.user.name.split(' ')[0])} 👋</div><div class="hh-date">${new Date().toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><img src="${BRAND.logo}" alt=""></div>
        <div class="hh-label">المبالغ لدى الموظفين الآن</div>
        <div class="hh-value">${money(d.kpis.outstanding)}</div>
        <div class="hh-sub">${d.kpis.openCount} عهدة مفتوحة · صُرف هذا الشهر ${fmt(d.kpis.monthSpent)}</div>
      </div>
      <div class="qa">
        ${[['wallet', 'صرف عهدة', 'custodyForm'], ['receipt', 'تسجيل مصروف', 'expenseForm'], ['check', 'الاعتماد', '#/expenses'], ['chart', 'التقارير', '#/reports']].map(([i, l, a]) => a.startsWith('#') ? `<a class="qa-i" href="${a}"><span>${ic(i, 22)}</span>${l}</a>` : `<button class="qa-i" data-act="q-${a}"><span>${ic(i, 22)}</span>${l}</button>`).join('')}
      </div>
      ${showSetup ? card('ابدأ في ٣ خطوات', `<div class="steps">${setupSteps.map(([done, t, h], i) => `<a class="step ${done ? 'done' : ''}" href="${h}"><span class="step-n">${done ? ic('ok', 14) : i + 1}</span><span>${t}</span>${ic('chev', 16)}</a>`).join('')}</div>`) : ''}
      <div class="mini-kpis">
        ${kpi('بانتظار الاعتماد', `<span class="num">${d.kpis.pendingCount}</span>`, { sub: money(d.kpis.pendingAmount), tone: d.kpis.pendingCount ? 'warn' : '', go: '#/expenses' })}
        ${kpi('طلبات عهد', `<span class="num">${al.requests}</span>`, { sub: 'بانتظار القرار', tone: al.requests ? 'warn' : '', go: '#/requests' })}
        ${kpi('عهد متأخرة', `<span class="num">${al.overdue.length}</span>`, { sub: 'عن موعد التسوية', tone: al.overdue.length ? 'bad' : '', go: '#/custodies?status=overdue' })}
        ${kpi('العهد العينية', `<span class="num">${d.kpis.assetsAssigned}</span>`, { sub: money(d.kpis.assetsValue), go: '#/assets' })}
      </div>
      ${card('الصرف آخر 12 شهراً', monthChart(an.monthly), btn('التحليلات', { href: '#/analytics', cls: 'sm ghost' }))}
      ${alerts.length ? card('تحتاج متابعة', `<div class="alerts">${alerts.slice(0, 8).map(([i, t, text, h]) => `<a class="alert ${t}" href="${h}">${ic(i, 16)}<span>${esc(text)}</span>${ic('chev', 14)}</a>`).join('')}</div>`) : ''}
      <div class="grid2">
        ${card('أرصدة الموظفين', d.employees.length ? `<div class="list">${d.employees.map(u => `<a class="item" href="#/user/${u.id}">
            <div class="avatar sm">${esc(u.name.trim()[0])}</div>
            <div class="item-main"><div class="item-title">${esc(u.name)}${u.overdueCount ? ' ' + tag('متأخرة', 'bad') : ''}</div><div class="item-sub">${u.openCount} عهدة · ${u.assetsCount} أصل · آخر رد ${ago(u.lastCheckin)}</div></div>
            <div class="item-end">${signed(u.balance)}${u.pendingCount ? `<div class="item-endsub warn-t">${u.pendingCount} معلّق</div>` : ''}</div></a>`).join('')}</div>` : empty('لا يوجد موظفون بعد', btn('إضافة موظف', { act: 'q-userForm', cls: 'primary sm' })), btn('الكل', { href: '#/users', cls: 'sm ghost' }))}
        ${card('الصرف حسب المشاريع', d.costCenters.length ? `<div class="bars">${d.costCenters.map(c => `<div class="bar-row"><div class="bar-name">${esc(c.name.trim())}</div>${progress(c.spent, c.budget || Math.max(...d.costCenters.map(x => x.spent), 1))}<div class="bar-val">${money(c.spent)}</div></div>`).join('')}</div>` : empty('أضف مشاريعك ومراكز التكلفة', btn('إضافة مشروع', { act: 'q-ccForm', cls: 'primary sm' })), btn('التقرير', { href: '#/report/cost-centers', cls: 'sm ghost' }))}
      </div>
      ${card('مصادر أموال العهد', src.rows.length ? `<div class="list">${src.rows.filter(r => r.count).map(r => `<div class="item"><div class="item-ic">${ic('bank', 18)}</div><div class="item-main"><div class="item-title">${esc(r.name)}</div><div class="item-sub">${esc(r.type)} · صُرف ${fmt(r.out)} · رُدّ ${fmt(r.back)}</div></div><div class="item-end">${money(r.net)}<div class="item-endsub">لدى الموظفين</div></div></div>`).join('') || empty('لا توجد حركات')}</div>` : '', btn('التفاصيل', { href: '#/report/sources', cls: 'sm ghost' }))}
      ${card('آخر المصروفات', d.recent.length ? `<div class="list">${d.recent.slice(0, 6).map(e => expenseItem(e)).join('')}</div>` : empty('لا توجد مصروفات بعد'), btn('الكل', { href: '#/expenses?status=', cls: 'sm ghost' }))}
    `);
  },

  async custodies(_, q) {
    const status = q.status ?? 'open';
    const list = await api('GET', '/api/custodies?' + qsOf({ status: status === 'overdue' ? 'open' : status, flag: status === 'overdue' ? 'overdue' : '', q: q.q, employeeId: q.employeeId }));
    const total = list.reduce((s, c) => s + c.balance, 0);
    view('العهد النقدية', `
      ${tabs([['status=open', 'المفتوحة'], ['status=overdue', 'المتأخرة'], ['status=closed', 'المغلقة'], ['status=', 'الكل']], 'status=' + status, '#/custodies')}
      ${searchBox(q.q, 'ابحث برقم العهدة أو الموظف أو الغرض')}
      <div class="summary-line"><span>${list.length} عهدة</span><span>الرصيد: ${signed(total)}</span></div>
      ${list.length ? `<div class="list cards">${list.map(custodyItem).join('')}</div>` : empty('لا توجد عهد هنا', btn('صرف عهدة جديدة', { act: 'q-custodyForm', cls: 'primary' }))}
    `, { toolbar: btn('صرف عهدة', { act: 'q-custodyForm', icon: 'plus', cls: 'primary' }) });
  },

  custody: custodyDetail,

  async expenses(_, q) {
    const status = q.status ?? 'pending';
    const filters = { ...q, status };
    const list = await api('GET', '/api/expenses?' + qsOf(filters));
    const total = list.filter(e => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0);
    const hasFilter = q.employeeId || q.costCenterId || q.categoryId || q.from || q.to;
    view('المصروفات والاعتماد', `
      ${tabs([['status=pending', 'بانتظار الاعتماد'], ['status=approved', 'المعتمدة'], ['status=rejected', 'المرفوضة'], ['status=', 'الكل']], 'status=' + status, '#/expenses')}
      <details class="filters" ${hasFilter ? 'open' : ''}><summary>${ic('search', 16)} بحث وتصفية ${hasFilter ? tag('مفعّل', 'warn') : ''}</summary>
        <form class="form" id="flt">
          ${fieldHtml({ name: 'q', label: 'بحث', value: q.q, placeholder: 'رقم، بيان، مورد، فاتورة' })}
          ${fieldHtml({ type: 'select', name: 'employeeId', label: 'الموظف', options: userOptions(), value: q.employeeId, empty: 'الكل' })}
          ${fieldHtml({ type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions({ activeOnly: false }), value: q.costCenterId, empty: 'الكل' })}
          ${fieldHtml({ type: 'select', name: 'categoryId', label: 'البند', options: S.b.categories.map(c => ({ value: c.id, label: c.name })), value: q.categoryId, empty: 'الكل' })}
          ${fieldHtml({ type: 'date', name: 'from', label: 'من تاريخ', value: q.from })}
          ${fieldHtml({ type: 'date', name: 'to', label: 'إلى تاريخ', value: q.to })}
          <div class="full actions"><button class="btn primary">تطبيق</button><a class="btn ghost" href="#/expenses?status=${status}">مسح التصفية</a></div>
        </form></details>
      <div class="summary-line"><span>${list.length} مصروف</span><span>الإجمالي: ${money(total)}</span></div>
      ${status === 'pending' && list.length ? `<div class="bulk"><label class="chk"><input type="checkbox" id="sel-all"> تحديد الكل</label><span class="muted" id="sel-n"></span><div class="actions"><button class="btn sm ok-btn" data-act="bulk" data-s="approved">${ic('ok', 16)} اعتماد المحدد</button><button class="btn sm danger-o" data-act="bulk" data-s="rejected">${ic('x', 16)} رفض المحدد</button></div></div>` : ''}
      ${list.length ? `<div class="list cards">${list.map(e => expenseItem(e, { select: status === 'pending' })).join('')}</div>` : empty(status === 'pending' ? 'لا توجد مصروفات بانتظار الاعتماد 👍' : 'لا توجد مصروفات')}
    `, { toolbar: btn('تسجيل مصروف', { act: 'q-expenseForm', icon: 'plus', cls: 'primary' }) + btn('تصدير Excel', { act: 'export-exp', icon: 'download', cls: 'ghost' }) });
    $('#flt').onsubmit = e => { e.preventDefault(); go('#/expenses?' + qsOf({ ...readForm(e.target), status })); };
    const upd = () => { const n = $$('[data-sel]:checked').length; const el = $('#sel-n'); if (el) el.textContent = n ? `${n} محدد` : ''; };
    $('#sel-all') && ($('#sel-all').onchange = e => { $$('[data-sel]').forEach(c => { c.checked = e.target.checked; }); upd(); });
    $$('[data-sel]').forEach(c => c.onchange = upd);
    ACT['export-exp'] = () => exportCsv('المصروفات', [{ key: 'date', label: 'التاريخ' }, { key: 'no', label: 'الرقم' }, { key: 'employeeName', label: 'الموظف' }, { key: 'custodyNo', label: 'العهدة' }, { key: 'costCenterName', label: 'مركز التكلفة' }, { key: 'categoryName', label: 'البند' }, { key: 'description', label: 'البيان' }, { key: 'vendor', label: 'المورد' }, { key: 'invoiceNo', label: 'رقم الفاتورة' }, { key: 'vat', label: 'الضريبة' }, { key: 'amount', label: 'الإجمالي' }, { key: 'statusName', label: 'الحالة' }], list);
  },

  expense: expenseDetail,

  async requests(_, q) {
    const status = q.status ?? 'pending';
    const list = await api('GET', '/api/requests?' + qsOf({ status }));
    view('طلبات العهد', `
      ${tabs([['status=pending', 'الجديدة'], ['status=approved', 'الموافق عليها'], ['status=rejected', 'المرفوضة'], ['status=', 'الكل']], 'status=' + status, '#/requests')}
      ${list.length ? `<div class="list cards">${list.map(r => `<div class="item">
        <div class="item-ic">${ic(r.type === 'cash' ? 'wallet' : 'box')}</div>
        <div class="item-main"><div class="item-title">${esc(r.employeeName)} — ${r.type === 'cash' ? 'عهدة نقدية' : 'عهدة عينية'} ${tag({ pending: 'جديد', approved: 'موافق عليه', rejected: 'مرفوض' }[r.status], STATUS_TONE[r.status])}${r.direct ? ' ' + tag('تعميد مباشر', 'info') : ''}</div>
          <div class="item-sub">${esc(r.purpose)}</div><div class="item-meta">${esc(r.no)} · ${ago(r.createdAt)}${r.costCenterId ? ' · ' + esc(r.costCenterName) : ''}${r.neededBy ? ' · مطلوب قبل ' + fmtDate(r.neededBy) : ''}${r.decisionNote ? ' · ' + esc(r.decisionNote) : ''}</div>
          ${r.status === 'pending' ? `<div class="actions mt"><button class="btn sm primary" data-act="req-ok" data-id="${r.id}">موافقة${r.type === 'cash' ? ' وصرف العهدة' : ''}</button><button class="btn sm danger-o" data-act="req-no" data-id="${r.id}">رفض</button></div>` : ''}
          ${r.custodyId ? `<a class="link-sm" href="#/custody/${r.custodyId}">عرض العهدة المصروفة ←</a>` : ''}
          ${isAdmin() ? `<div class="actions mt"><button class="btn sm danger-o" data-act="req-del" data-id="${r.id}">${ic('trash', 14)} حذف الطلب</button></div>` : ''}</div>
        <div class="item-end">${r.type === 'cash' ? money(r.amount) : ''}</div></div>`).join('')}</div>` : empty('لا توجد طلبات')}`);
    ACT['req-ok'] = el => {
      const r = list.find(x => x.id === el.dataset.id);
      if (r.type !== 'cash') return api('POST', `/api/requests/${r.id}/decide`, { approve: true }).then(() => { toast('تمت الموافقة'); router(); }).catch(e => toast(e.message, true));
      formSheet({
        title: 'الموافقة وصرف العهدة', intro: `<p class="muted">${esc(r.employeeName)} — ${esc(r.purpose)}</p>`, submit: 'صرف العهدة',
        fields: [{ type: 'money', name: 'amount', label: 'المبلغ المعتمد', value: r.amount, required: true }, srcField('صُرف من'), { type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions(), value: r.costCenterId, empty: '— اختر —' }, { type: 'date', name: 'dueDate', label: 'موعد التسوية', value: r.neededBy || '' }, { type: 'select', name: 'method', label: 'طريقة الصرف', options: PAY_METHODS }, { name: 'note', label: 'ملاحظة', full: true }],
        onSubmit: async (d, close) => { await api('POST', `/api/requests/${r.id}/decide`, { ...d, approve: true }); close(); toast('تم صرف العهدة'); router(); },
      });
    };
    ACT['req-del'] = el => { const r = list.find(x => x.id === el.dataset.id); adminDelete(`حذف الطلب ${r.no}؟${r.custodyId ? ' العهدة المصروفة له تبقى كما هي (احذفها من صفحتها إن كانت خطأ).' : ''}`, '/api/requests/' + r.id); };
    ACT['req-no'] = el => formSheet({ title: 'رفض الطلب', submit: 'رفض', fields: [{ type: 'textarea', name: 'note', label: 'سبب الرفض' }], onSubmit: async (d, close) => { await api('POST', `/api/requests/${el.dataset.id}/decide`, { approve: false, note: d.note }); close(); toast('تم رفض الطلب'); router(); } });
  },

  async assets(_, q) {
    const status = q.status ?? '';
    const list = await api('GET', '/api/assets?' + qsOf({ status, q: q.q }));
    view('العهد العينية', `
      ${tabs([['status=', 'الكل'], ['status=assigned', 'مسلّمة'], ['status=available', 'بالمستودع'], ['status=maintenance', 'صيانة'], ['status=lost', 'مفقودة']], 'status=' + status, '#/assets')}
      ${searchBox(q.q, 'ابحث بالاسم أو الرقم التسلسلي أو الموظف')}
      ${list.length ? `<div class="list cards">${list.map(assetItem).join('')}</div>` : empty('لا توجد أصول مسجلة', btn('إضافة أصل', { act: 'q-assetForm', cls: 'primary' }))}
    `, { toolbar: btn('إضافة أصل', { act: 'q-assetForm', icon: 'plus', cls: 'primary' }) + btn('سجل الأصول', { href: '#/report/assets', icon: 'chart', cls: 'ghost' }) });
  },
  asset: assetDetail,

  async users() {
    const d = await api('GET', '/api/dashboard');
    await refreshBootstrap();
    const bal = Object.fromEntries(d.employees.map(e => [e.id, e]));
    view('الموظفون والمستخدمون', `
      <div class="list cards">${S.b.users.map(u => `<a class="item" href="#/user/${u.id}" style="${u.active ? '' : 'opacity:.55'}">
        <div class="avatar sm">${esc(u.name.trim()[0])}</div>
        <div class="item-main"><div class="item-title">${esc(u.name)} ${tag(u.roleName, u.role === 'admin' ? 'info' : u.role === 'accountant' ? 'info' : '')} ${u.active ? '' : tag('موقوف', 'bad')}</div><div class="item-sub">${esc(u.jobTitle || '')}${u.department ? ' · ' + esc(u.department) : ''}</div><div class="item-meta" dir="ltr">${esc(u.username)}</div></div>
        <div class="item-end">${bal[u.id] ? signed(bal[u.id].balance) + `<div class="item-endsub">${bal[u.id].openCount} عهدة</div>` : ''}</div></a>`).join('')}</div>
    `, { toolbar: isAdmin() ? btn('إضافة موظف / مستخدم', { act: 'q-userForm', icon: 'plus', cls: 'primary' }) : '' });
  },
  user: userDetail,

  async 'cost-centers'() {
    await refreshBootstrap();
    const rep = await api('GET', '/api/reports/cost-centers');
    const spent = Object.fromEntries(rep.rows.map((r, i) => [i, r]));
    const tree = S.b.costCenters;
    view('المشاريع ومراكز التكلفة', `
      <p class="muted">كل مصروف يُحمَّل على مشروع أو مركز تكلفة. يمكنك تقسيم المشروع لمراحل أو بنود فرعية، ويُجمع صرفها تلقائياً في المشروع الرئيسي.</p>
      ${tree.length ? `<div class="list cards tree">${tree.map((c, i) => `<a class="item depth-${Math.min(c.depth, 3)}" href="#/cost-center/${c.id}" style="${c.active === false ? 'opacity:.55' : ''}">
        <div class="item-ic">${ic('layers')}</div>
        <div class="item-main"><div class="item-title">${c.code ? `<span class="code">${esc(c.code)}</span> ` : ''}${esc(c.name)} ${c.active === false ? tag('مغلق') : ''}</div><div class="item-sub">${esc(S.b.ccTypes[c.type] || '')}${c.budget ? ' · الميزانية ' + fmt(c.budget) : ''}</div>${c.budget ? progress(spent[i]?.spent || 0, c.budget) : ''}</div>
        <div class="item-end">${money(spent[i]?.spent || 0)}<div class="item-endsub">${c.budget ? spent[i]?.used : 'مصروف'}</div></div></a>`).join('')}</div>` : empty('لم تضف أي مركز تكلفة بعد — أضف مشاريعك وأقسامك', btn('إضافة مركز تكلفة', { act: 'q-ccForm', cls: 'primary' }))}
    `, { toolbar: btn('مشروع / مركز جديد', { act: 'q-ccForm', icon: 'plus', cls: 'primary' }) + btn('تقرير المشاريع', { href: '#/report/cost-centers', icon: 'chart', cls: 'ghost' }) });
  },
  'cost-center': ccDetail,

  async categories() {
    await refreshBootstrap();
    view('بنود المصروفات', `
      <p class="muted">البنود هي أنواع المصروفات مربوطة برقم الحساب في دليل الحسابات، وتظهر للموظف عند تسجيل المصروف.</p>
      <div class="list cards">${S.b.categories.map(c => `<div class="item" style="${c.active === false ? 'opacity:.55' : ''}">
        <div class="item-ic">${ic('tag')}</div>
        <div class="item-main"><div class="item-title">${c.code ? `<span class="code">${esc(c.code)}</span> ` : ''}${esc(c.name)}${c.addedBy && !c.code ? ' ' + tag('أضافه موظف — أعطه رقم حساب', 'warn') : ''}</div><div class="item-sub">${c.vatApplicable !== false ? 'خاضع لضريبة القيمة المضافة' : 'غير خاضع للضريبة'}${c.active === false ? ' · موقوف' : ''}</div></div>
        <div class="item-end"><button class="btn sm ghost" data-act="cat-edit" data-id="${c.id}">${ic('edit', 16)} تعديل</button>${isAdmin() ? `<button class="btn sm danger-o" data-act="cat-del" data-id="${c.id}" aria-label="حذف">${ic('trash', 16)}</button>` : ''}</div></div>`).join('')}</div>
    `, { toolbar: btn('بند جديد', { act: 'cat-edit', icon: 'plus', cls: 'primary' }) });
    ACT['cat-del'] = el => { const c = S.b.categories.find(x => x.id === el.dataset.id); adminDelete(`حذف البند «${c.name}»؟ (يُرفض إن كان مستخدماً في مصروفات)`, '/api/categories/' + c.id); };
    ACT['cat-edit'] = el => {
      const c = S.b.categories.find(x => x.id === el.dataset.id);
      formSheet({
        title: c ? 'تعديل بند' : 'بند مصروف جديد',
        fields: [{ name: 'code', label: 'رقم الحساب', value: c?.code }, { name: 'name', label: 'اسم البند', value: c?.name, required: true }, { type: 'toggle', name: 'vatApplicable', label: 'خاضع لضريبة القيمة المضافة', value: c ? c.vatApplicable !== false : true }, ...(c ? [{ type: 'toggle', name: 'active', label: 'نشط (يظهر للموظفين)', value: c.active !== false }] : [])],
        onSubmit: async (d, close) => { await api(c ? 'PUT' : 'POST', '/api/categories' + (c ? '/' + c.id : ''), d); close(); toast('تم الحفظ'); router(); },
      });
    };
  },

  async sources() {
    await refreshBootstrap();
    const rep = await api('GET', '/api/reports/sources');
    const byName = Object.fromEntries(rep.rows.map(r => [r.name, r]));
    view('مصادر الأموال', `
      <p class="muted">من أين تُصرف العهد للموظفين وإلى أين تُرد: الصندوق، الحسابات البنكية، المالك، الشركاء، دفعات العملاء… يُطلب المصدر في كل عملية صرف أو تعزيز أو رد، ويظهر في كشوف الحساب والتقارير.</p>
      <div class="list cards">${S.b.fundSources.map(x => { const r = byName[x.name] || { out: 0, back: 0, net: 0 }; return `<div class="item" style="${x.active === false ? 'opacity:.55' : ''}">
        <div class="item-ic">${ic('bank')}</div>
        <div class="item-main"><div class="item-title">${esc(x.name)} ${tag(S.b.sourceTypes[x.type] || '', 'info')}</div><div class="item-sub">صُرف ${fmt(r.out)} · رُدّ ${fmt(r.back)}${x.accountNo ? ' · <span class="num">' + esc(x.accountNo) + '</span>' : ''}</div>
          <div class="actions mt"><a class="btn sm ghost" href="#/report/source-ledger?sourceId=${x.id}">${ic('list', 14)} الحركات</a><button class="btn sm ghost" data-act="src-edit" data-id="${x.id}">${ic('edit', 14)} تعديل</button>${isAdmin() ? `<button class="btn sm danger-o" data-act="src-del" data-id="${x.id}">${ic('trash', 14)} حذف</button>` : ''}</div></div>
        <div class="item-end">${money(r.net)}<div class="item-endsub">لدى الموظفين</div></div></div>`; }).join('')}</div>
    `, { toolbar: btn('مصدر جديد', { act: 'src-edit', icon: 'plus', cls: 'primary' }) + btn('تقرير المصادر', { href: '#/report/sources', icon: 'chart', cls: 'ghost' }) });
    ACT['src-del'] = el => { const x = S.b.fundSources.find(v => v.id === el.dataset.id); adminDelete(`حذف المصدر «${x.name}»؟ (يُرفض إن كانت عليه حركات)`, '/api/sources/' + x.id); };
    ACT['src-edit'] = el => {
      const x = S.b.fundSources.find(v => v.id === el.dataset.id);
      formSheet({
        title: x ? 'تعديل مصدر' : 'مصدر أموال جديد',
        fields: [{ name: 'name', label: 'الاسم', value: x?.name, required: true, full: true, placeholder: 'مثال: مصرف الراجحي / صندوق الموقع / المالك' }, { type: 'select', name: 'type', label: 'النوع', value: x?.type || 'bank', options: Object.entries(S.b.sourceTypes).map(([value, label]) => ({ value, label })) }, { name: 'accountNo', label: 'رقم الحساب / الآيبان (اختياري)', value: x?.accountNo, attrs: 'dir="ltr"' }, ...(x ? [{ type: 'toggle', name: 'active', label: 'نشط', value: x.active !== false }] : []), { name: 'notes', label: 'ملاحظات', value: x?.notes, full: true }],
        onSubmit: async (d, close) => { await api(x ? 'PUT' : 'POST', '/api/sources' + (x ? '/' + x.id : ''), d); await refreshBootstrap(); close(); toast('تم الحفظ'); router(); },
      });
    };
  },
  reports: reportsHub,
  report: reportView,
  settlement: settlementView,
  notifications: notificationsView,
  settings: settingsView,

  async audit(_, q) {
    const list = await api('GET', '/api/audit?' + qsOf({ q: q.q }));
    view('سجل العمليات', `${searchBox(q.q, 'ابحث في العمليات')}
      <div class="timeline">${list.map(a => `<div class="tl"><div class="tl-dot"></div><div><div class="tl-title">${esc(a.action)} <span class="muted">— ${esc(a.userName)}</span></div><div class="tl-sub">${esc(a.summary)}</div><div class="tl-meta num">${esc(a.at.slice(0, 16).replace('T', ' '))}</div></div></div>`).join('') || empty('لا توجد عمليات')}</div>`);
  },

  more: moreView,
};

function searchBox(value, placeholder) {
  setTimeout(() => {
    const f = $('#search');
    if (f) f.onsubmit = e => { e.preventDefault(); const { page, q } = parseHash(); go(`#/${page}?` + qsOf({ ...q, q: $('input', f).value })); };
  });
  return `<form id="search" class="search">${ic('search', 18)}<input type="search" value="${esc(value || '')}" placeholder="${esc(placeholder)}"></form>`;
}
function moreView() {
  const groups = isStaff() ? NAV_STAFF : NAV_EMP;
  view('المزيد', `${groups.map(([g, items]) => `${g ? `<div class="nav-group dark">${g}</div>` : ''}<div class="tiles">${items.map(([k, i, l]) => `<a class="tile" href="#/${k}">${ic(i, 26)}<span>${l}</span></a>`).join('')}</div>`).join('')}
    <div class="tiles"><a class="tile" href="#/notifications">${ic('bell', 26)}<span>الإشعارات</span></a><button class="tile" data-act="logout">${ic('logout', 26)}<span>تسجيل الخروج</span></button></div>
    <p class="muted center mt">${esc(S.user.name)} — ${esc(S.user.roleName)}${MODE !== 'server' ? ' · ' + MODE_NOTE[MODE] : ''}</p>`);
}

// ----- تفاصيل العهدة -----
async function custodyDetail(id) {
  const d = await api('GET', '/api/custodies/' + id);
  const c = d.custody;
  const open = c.status === 'open';
  const staff = isStaff();
  const actions = [
    open && btn('تسجيل مصروف', { act: 'c-exp', icon: 'receipt', cls: 'primary' }),
    open && staff && btn('تعزيز', { act: 'c-topup', icon: 'plus' }),
    open && btn(staff ? 'استرداد نقدي' : 'رد مبلغ', { act: 'c-return', icon: 'undo' }),
    open && staff && btn('تحويل لموظف', { act: 'c-transfer', icon: 'swap' }),
    open && staff && btn('تسوية', { act: 'c-settle', icon: 'check' }),
    open && staff && btn('تسوية وإغلاق', { act: 'c-close', icon: 'lock', cls: 'danger-o' }),
    !open && isAdmin() && btn('إعادة فتح', { act: 'c-reopen', icon: 'undo' }),
    staff && (open || isAdmin()) && btn(isAdmin() ? 'تعديل / تصحيح' : 'تعديل', { act: 'c-edit', icon: 'edit', cls: 'ghost' }),
    isAdmin() && btn('حذف العهدة', { act: 'c-del', icon: 'trash', cls: 'danger-o' }),
    btn('طباعة سند الصرف', { act: 'c-print', icon: 'print', cls: 'ghost' }),
    btn('كشف الحساب', { href: `#/report/statement?employeeId=${c.employeeId}&custodyId=${c.id}`, icon: 'chart', cls: 'ghost' }),
  ].filter(Boolean).join('');
  const pendingTx = d.tx.filter(t => t.status === 'pending');
  view(`العهدة ${c.no}`, `
    <div class="hero-card ${c.balance < 0 ? 'neg' : ''}">
      <div class="hero-top"><div><div class="hero-label">الرصيد المتبقي</div><div class="hero-value">${money(c.balance)}</div></div><div class="hero-tags">${tag(c.kindName, 'light')} ${c.direct ? tag('تعميد مباشر', 'light') : ''} ${tag(open ? 'مفتوحة' : 'مغلقة', 'light')} ${c.overdue ? tag('متأخرة', 'bad') : ''}</div></div>
      ${progress(c.spent, c.received, 'light')}
      <div class="hero-stats"><div><small>المستلم</small>${money(c.received)}</div><div><small>المصروف</small>${money(c.spent)}</div><div><small>المردود</small>${money(c.returned)}</div></div>
    </div>
    <div class="astrip mb">${actions}</div>
    ${pendingTx.length ? card('بانتظار التأكيد', pendingTx.map(t => `<div class="item"><div class="item-main"><div class="item-title">${esc(t.typeName)} ${money(t.amount)}</div><div class="item-sub">${fmtDate(t.date)} · ${esc(t.method)} ${esc(t.note)}</div></div><div class="item-end">${staff ? `<div class="actions"><button class="btn sm ok-btn" data-act="tx-ok" data-id="${t.id}">تأكيد الاستلام</button><button class="btn sm danger-o" data-act="tx-no" data-id="${t.id}">رفض</button></div>` : tag('بانتظار تأكيد الإدارة', 'warn')}</div></div>`).join('')) : ''}
    ${c.unsettledCount && staff && open ? `<div class="notice">${ic('check', 18)} يوجد ${c.unsettledCount} مصروف معتمد غير مسوّى بقيمة ${fmt(c.unsettledAmount)} — يمكنك عمل تسوية لها.</div>` : ''}
    ${card('بيانات العهدة', rows([['الموظف', staff ? `<a href="#/user/${c.employeeId}">${esc(c.employeeName)}</a>` : esc(c.employeeName)], ['الغرض', esc(c.purpose)], ['مركز التكلفة الافتراضي', esc(c.costCenterName)], ['تاريخ الصرف', fmtDate(c.issueDate)], c.dueDate && ['موعد التسوية', fmtDate(c.dueDate)], c.closedAt && ['تاريخ الإغلاق', fmtDate(c.closedAt)], c.notes && ['ملاحظات', esc(c.notes)]]))}
    ${card(`المصروفات (${d.expenses.length})`, d.expenses.length ? `<div class="list">${d.expenses.map(e => expenseItem(e)).join('')}</div>` : empty('لا توجد مصروفات على هذه العهدة'), staff && c.pendingCount ? btn('اعتماد الكل', { act: 'c-approve-all', cls: 'sm ok-btn' }) : '')}
    ${card('حركة العهدة', `<div class="timeline">${d.tx.map(t => `<div class="tl ${t.status !== 'confirmed' ? 'dim' : ''}"><div class="tl-dot ${t.sign > 0 ? 'in' : 'out'}"></div><div class="tl-body"><div class="tl-title">${esc(t.typeName)} <b class="${t.sign > 0 ? 'pos' : 'neg'}">${t.sign > 0 ? '+' : '−'}${fmt(t.amount)}</b> ${t.status !== 'confirmed' ? tag(t.status === 'pending' ? 'بانتظار التأكيد' : 'مرفوض', STATUS_TONE[t.status]) : ''}</div><div class="tl-sub">${t.sourceName ? `<b class="src">${t.sign > 0 ? 'من' : 'إلى'}: ${esc(t.sourceName)}</b> · ` : ''}${esc(t.note || '')}${t.ref ? ' · مرجع ' + esc(t.ref) : ''} · ${esc(t.method)}</div><div class="tl-meta">${fmtDate(t.date)} · ${esc(t.createdByName)}</div>${isAdmin() && t.status === 'confirmed' ? `<div class="actions mt"><button class="btn sm ghost" data-act="tx-edit" data-id="${t.id}">${ic('edit', 14)} تصحيح</button>${t.type !== 'issue' ? `<button class="btn sm danger-o" data-act="tx-del" data-id="${t.id}">${ic('trash', 14)} حذف</button>` : ''}</div>` : ''}</div></div>`).join('')}</div>`)}
    ${d.settlements.length ? card('التسويات', `<div class="list">${d.settlements.map(s => `<a class="item" href="#/settlement/${s.id}"><div class="item-ic">${ic('check')}</div><div class="item-main"><div class="item-title">${esc(s.no)} ${s.closed ? tag('إغلاق', '') : ''}</div><div class="item-sub">${s.expenseIds.length} مصروف${s.replenished ? ' · تعويض ' + fmt(s.replenished) : ''}${s.returned ? ' · رد ' + fmt(s.returned) : ''}${s.reimbursed ? ' · صرف فرق ' + fmt(s.reimbursed) : ''}</div><div class="item-meta">${fmtDate(s.date)}</div></div><div class="item-end">${money(s.total)}</div></a>`).join('')}</div>`) : ''}
  `, { back: '#/custodies' });

  const txForm = (type, title, extra = []) => formSheet({
    title, submit: 'حفظ',
    fields: [{ type: 'money', name: 'amount', label: 'المبلغ', required: true, value: type === 'return' && c.balance > 0 ? c.balance : '' }, ...extra,
      ...(type === 'topup' ? [srcField('مصدر مبلغ التعزيز — من أين؟')] : type === 'return' && staff ? [srcField('رُدّ المبلغ إلى')] : []), { type: 'date', name: 'date', label: 'التاريخ', value: today() }, { type: 'select', name: 'method', label: 'الطريقة', options: PAY_METHODS }, { name: 'ref', label: 'رقم المرجع / الإيصال' }, { name: 'note', label: 'ملاحظة', full: true }],
    onSubmit: async (b, close) => { await api('POST', `/api/custodies/${c.id}/tx`, { ...b, type }); close(); toast('تم التسجيل'); router(); },
  });
  ACT['c-exp'] = () => expenseForm({ custodyId: c.id });
  ACT['c-topup'] = () => txForm('topup', 'تعزيز العهدة (إضافة مبلغ)');
  ACT['c-return'] = () => txForm('return', staff ? 'استرداد مبلغ نقدي من الموظف' : 'رد مبلغ نقدي للإدارة');
  ACT['c-transfer'] = () => txForm('transfer', 'تحويل جزء من العهدة لموظف آخر', [{ type: 'select', name: 'toEmployeeId', label: 'الموظف المستلم', options: userOptions(u => u.id !== c.employeeId), empty: '— اختر —', required: true }]);
  ACT['c-settle'] = () => settleForm(c, false);
  ACT['c-close'] = () => settleForm(c, true);
  const issueTx = d.tx.find(t => t.type === 'issue');
  ACT['c-edit'] = () => formSheet({
    title: isAdmin() ? 'تعديل وتصحيح العهدة' : 'تعديل بيانات العهدة',
    intro: isAdmin() ? '<p class="muted">مدير النظام يستطيع تصحيح مبلغ الصرف والموظف والتاريخ والمصدر إذا سُجلت بالخطأ. يُعاد حساب الرصيد تلقائياً، ويُسجل التعديل في «سجل العمليات».</p>' : '',
    fields: [
      ...(isAdmin() ? [
        { type: 'money', name: 'amount', label: 'مبلغ صرف العهدة', value: issueTx ? issueTx.amount : '', required: true },
        { type: 'select', name: 'employeeId', label: 'الموظف', options: S.b.users.map(u => ({ value: u.id, label: u.name + (u.active ? '' : ' (موقوف)') })), value: c.employeeId },
        { type: 'date', name: 'issueDate', label: 'تاريخ الصرف', value: c.issueDate },
        { type: 'select', name: 'kind', label: 'نوع العهدة', options: Object.entries(S.b.kinds).map(([value, label]) => ({ value, label })), value: c.kind },
        { type: 'select', name: 'sourceId', label: 'صُرفت من', options: S.b.fundSources.map(x => ({ value: x.id, label: x.name })), value: issueTx?.sourceId || '', empty: '— غير محدد —' },
      ] : []),
      { name: 'purpose', label: 'الغرض', value: c.purpose, required: true, full: true }, { type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions(), value: c.costCenterId, empty: '— بدون —' }, { type: 'date', name: 'dueDate', label: 'موعد التسوية', value: c.dueDate || '' }, { type: 'textarea', name: 'notes', label: 'ملاحظات', value: c.notes }],
    onSubmit: async (b, close) => { await api('PUT', '/api/custodies/' + c.id, b); close(); toast('تم الحفظ'); router(); },
  });
  ACT['c-del'] = () => adminDelete(`حذف العهدة ${c.no} نهائياً مع كل حركاتها (${d.tx.length} حركة) ومصروفاتها (${d.expenses.length}) وتسوياتها؟ لا يمكن التراجع.`, '/api/custodies/' + c.id, () => go('#/custodies'));
  ACT['tx-edit'] = el => {
    const t = d.tx.find(x => x.id === el.dataset.id);
    formSheet({
      title: 'تصحيح حركة: ' + t.typeName,
      intro: t.relatedId ? '<p class="muted">هذه حركة تحويل؛ يُصحَّح المبلغ والتاريخ في العهدة الأخرى أيضاً.</p>' : '',
      fields: [{ type: 'money', name: 'amount', label: 'المبلغ', value: t.amount, required: true }, { type: 'date', name: 'date', label: 'التاريخ', value: t.date },
        ...(t.type !== 'transfer_in' && t.type !== 'transfer_out' ? [{ type: 'select', name: 'sourceId', label: t.sign > 0 ? 'من' : 'إلى', options: S.b.fundSources.map(x => ({ value: x.id, label: x.name })), value: t.sourceId || '', empty: '— غير محدد —' }] : []),
        { type: 'select', name: 'method', label: 'الطريقة', options: PAY_METHODS, value: t.method }, { name: 'ref', label: 'المرجع', value: t.ref }, { name: 'note', label: 'ملاحظة', value: t.note, full: true }],
      onSubmit: async (b, close) => { await api('PUT', '/api/tx/' + t.id, b); close(); toast('تم التصحيح'); router(); },
    });
  };
  ACT['tx-del'] = el => { const t = d.tx.find(x => x.id === el.dataset.id); adminDelete(`حذف حركة «${t.typeName}» بمبلغ ${fmt(t.amount)}${t.relatedId ? ' مع الحركة المقابلة في العهدة الأخرى' : ''}؟`, '/api/tx/' + t.id); };
  ACT['c-reopen'] = async () => { if (await confirmBox('إعادة فتح العهدة؟')) { await api('POST', `/api/custodies/${c.id}/reopen`); router(); } };
  ACT['c-approve-all'] = async () => { await api('POST', '/api/expenses/review', { ids: d.expenses.filter(e => e.status === 'pending').map(e => e.id), status: 'approved' }); toast('تم الاعتماد'); router(); };
  ACT['tx-ok'] = el => formSheet({ title: 'تأكيد استلام المبلغ المردود', submit: 'تأكيد الاستلام', fields: [srcField('أين أُودع المبلغ؟')], onSubmit: async (b, close) => { await api('POST', `/api/tx/${el.dataset.id}/decide`, { ...b, approve: true }); close(); toast('تم تأكيد الاستلام'); router(); } });
  ACT['tx-no'] = async el => { await api('POST', `/api/tx/${el.dataset.id}/decide`, { approve: false }); router(); };
  ACT['c-print'] = () => {
    const issue = d.tx.find(t => t.type === 'issue') || { amount: c.received, date: c.issueDate, method: '' };
    printDoc(`<h2 class="doc-title">سند صرف عهدة ${esc(c.kindName)}</h2>
      ${rows([['رقم العهدة', esc(c.no)], ['التاريخ', fmtDate(issue.date)], ['اسم المستلم', esc(c.employeeName)], ['المبلغ', `<b>${money(issue.amount)}</b>`], ['صُرف من', esc(issue.sourceName || '—')], ['طريقة الصرف', esc(issue.method)], issue.ref && ['المرجع', esc(issue.ref)], ['الغرض', esc(c.purpose)], ['مركز التكلفة', esc(c.costCenterName)], c.dueDate && ['موعد التسوية', fmtDate(c.dueDate)]])}
      <p class="doc-text">أقر أنا الموقع أدناه باستلامي المبلغ المذكور أعلاه كعهدة، وأتعهد بصرفه في الغرض المحدد وتقديم المستندات المؤيدة للصرف وتسوية العهدة في موعدها، ورد المتبقي منها.</p>
      ${signatures(['المستلم', 'المحاسب', 'المدير المعتمد'])}`);
  };
}
const PAY_METHODS = [{ value: 'نقداً', label: 'نقداً' }, { value: 'تحويل بنكي', label: 'تحويل بنكي' }, { value: 'شيك', label: 'شيك' }, { value: 'بطاقة', label: 'بطاقة' }];

function settleForm(c, close) {
  const after = close ? c.balance : null;
  formSheet({
    title: close ? 'تسوية وإغلاق العهدة' : 'تسوية المصروفات المعتمدة',
    intro: `<div class="settle-box">
      <div><span>مصروفات معتمدة غير مسواة</span>${money(c.unsettledAmount)} <small>(${c.unsettledCount})</small></div>
      ${c.pendingCount ? `<div class="warn-t"><span>بانتظار الاعتماد</span>${c.pendingCount} مصروف — ${close ? 'يجب اعتمادها أو رفضها قبل الإغلاق' : 'لن تدخل في التسوية'}</div>` : ''}
      ${close ? `<div><span>${after >= 0 ? 'يُرد من الموظف عند الإغلاق' : 'يُصرف للموظف (فرق)'}</span><b class="${after >= 0 ? 'pos' : 'neg'}">${money(Math.abs(after))}</b></div>` : ''}
    </div>`,
    submit: close ? 'تسوية وإغلاق' : 'تنفيذ التسوية',
    fields: [
      { type: 'date', name: 'date', label: 'تاريخ التسوية', value: today() },
      ...(close ? (after !== 0 ? [srcField(after > 0 ? 'يُرد المتبقي إلى' : 'يُصرف الفرق من')] : []) : c.kind === 'permanent' ? [srcField('التعويض من')] : []),
      { type: 'select', name: 'method', label: close ? 'طريقة الرد / الصرف' : 'طريقة التعويض', options: PAY_METHODS },
      ...(!close && c.kind === 'permanent' ? [{ type: 'toggle', name: 'replenish', label: `تعويض العهدة المستديمة بمبلغ المصروفات (${fmt(c.unsettledAmount)}) لإعادتها لرصيدها`, value: true }] : []),
      { name: 'note', label: 'ملاحظة', full: true },
    ],
    onSubmit: async (b, closeM) => {
      const r = await api('POST', `/api/custodies/${c.id}/settle`, { ...b, close });
      closeM(); toast(`تمت التسوية ${r.settlement.no}`); go('#/settlement/' + r.settlement.id);
    },
  });
}
async function settlementView(id) {
  const d = await api('GET', '/api/settlements/' + id);
  const s = d.settlement, c = d.custody;
  const body = `${rows([['رقم التسوية', esc(s.no)], ['التاريخ', fmtDate(s.date)], ['العهدة', `<a href="#/custody/${c.id}">${esc(c.no)}</a> — ${esc(c.kindName)}`], ['الموظف', esc(c.employeeName)], ['الغرض', esc(c.purpose)], ['إجمالي المصروفات', money(s.total)], s.replenished && ['تعويض العهدة', money(s.replenished)], s.returned && ['رد نقدي من الموظف', money(s.returned)], s.reimbursed && ['صرف فرق للموظف', money(s.reimbursed)], ['إغلاق العهدة', s.closed ? 'نعم' : 'لا'], s.note && ['ملاحظة', esc(s.note)]])}`;
  const table = `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>البند</th><th>مركز التكلفة</th><th>البيان</th><th>الضريبة</th><th>المبلغ</th></tr></thead><tbody>${d.expenses.map((e, i) => `<tr><td>${i + 1}</td><td>${fmtDate(e.date)}</td><td>${esc(e.categoryName)}</td><td>${esc(e.costCenterName)}</td><td>${esc(e.description)}</td><td class="num">${fmt(e.vat)}</td><td class="num"><b>${fmt(e.amount)}</b></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5">الإجمالي</td><td class="num">${fmt(d.expenses.reduce((a, e) => a + (e.vat || 0), 0))}</td><td class="num">${fmt(s.total)}</td></tr></tfoot></table></div>`;
  view(`سند التسوية ${s.no}`, card('', body) + card('المصروفات المسواة', table), { back: '#/custody/' + c.id, toolbar: btn('طباعة سند التسوية', { act: 'st-print', icon: 'print', cls: 'primary' }) + (isAdmin() ? btn('التراجع عن التسوية', { act: 'st-undo', icon: 'undo', cls: 'danger-o' }) : '') });
  ACT['st-undo'] = () => adminDelete(`التراجع عن التسوية ${s.no}؟ تعود مصروفاتها غير مسواة، وتُحذف حركات الرد/الفرق/التعويض الناتجة عنها${s.closed ? '، وتُفتح العهدة من جديد' : ''}.`, '/api/settlements/' + s.id, () => go('#/custody/' + c.id));
  ACT['st-print'] = () => printDoc(`<h2 class="doc-title">سند تسوية عهدة</h2>${body}${table}${signatures(['الموظف', 'المحاسب', 'المدير المعتمد'])}`);
}

// ----- تفاصيل المصروف -----
async function expenseDetail(id) {
  const e = await api('GET', '/api/expenses/' + id);
  const staff = isStaff();
  const editable = (!e.settlementId || isAdmin()) && (staff || e.status !== 'approved');
  view(`مصروف ${e.no}`, `
    <div class="hero-card slim"><div class="hero-top"><div><div class="hero-label">${esc(e.categoryName)}</div><div class="hero-value">${money(e.amount)}</div><div class="hero-sub">${esc(e.description)}</div></div><div>${expTag(e)}</div></div></div>
    ${e.status === 'rejected' && e.reviewNote ? `<div class="notice bad">${ic('alert', 18)} سبب الرفض: ${esc(e.reviewNote)}</div>` : ''}
    <div class="astrip mb">
      ${staff && !e.settlementId && e.status !== 'approved' ? btn('اعتماد', { act: 'e-ok', icon: 'ok', cls: 'ok-btn' }) : ''}
      ${staff && !e.settlementId && e.status !== 'rejected' ? btn('رفض', { act: 'e-no', icon: 'x', cls: 'danger-o' }) : ''}
      ${editable ? btn(e.status === 'rejected' && !staff ? 'تعديل وإعادة الإرسال' : 'تعديل', { act: 'e-edit', icon: 'edit' }) : ''}
      ${editable ? btn('حذف', { act: 'e-del', icon: 'trash', cls: 'ghost' }) : ''}
    </div>
    ${card('التفاصيل', rows([['رقم المصروف', esc(e.no)], ['التاريخ والوقت', `${fmtDate(e.date)} <span class="num">${esc(e.time || '')}</span>`], ['الموظف', esc(e.employeeName)], ['العهدة', `<a href="#/custody/${e.custodyId}">${esc(e.custodyNo)}</a>`], ['مركز التكلفة', esc(e.costCenterName)], ['البند', esc(e.categoryName)], ['المورد', esc(e.vendor || '—')], e.vendorVat && ['الرقم الضريبي للمورد', `<span class="num">${esc(e.vendorVat)}</span>`], ['رقم الفاتورة', esc(e.invoiceNo || '—')], ['طريقة الدفع', esc(e.paymentMethod || '')], ['المبلغ قبل الضريبة', money(e.amount - (e.vat || 0))], ['ضريبة القيمة المضافة', money(e.vat || 0)], e.settlementNo && ['التسوية', `<a href="#/settlement/${e.settlementId}">${esc(e.settlementNo)}</a>`], e.viaReminder && ['المصدر', '🔔 سُجل من تنبيه المتابعة']]))}
    ${card(`المرفقات (${e.attachments.length})`, e.attachments.length ? `<div class="gallery">${e.attachments.map(f => `<a href="#" data-open-file="${esc(f)}" class="g-item"><img data-file="${esc(f)}" alt="مرفق"></a>`).join('')}</div>` : empty('لا توجد مرفقات'))}
  `, { back: true });
  ACT['e-ok'] = async () => { await api('POST', '/api/expenses/review', { ids: [e.id], status: 'approved' }); toast('تم الاعتماد'); router(); };
  ACT['e-no'] = () => formSheet({ title: 'رفض المصروف', submit: 'رفض', fields: [{ type: 'textarea', name: 'note', label: 'سبب الرفض (يظهر للموظف)' }], onSubmit: async (b, close) => { await api('POST', '/api/expenses/review', { ids: [e.id], status: 'rejected', note: b.note }); close(); toast('تم الرفض'); router(); } });
  ACT['e-edit'] = () => expenseForm({ expense: e });
  ACT['e-del'] = async () => { if (await confirmBox(e.settlementId ? `حذف هذا المصروف نهائياً؟ هو داخل التسوية ${e.settlementNo}، وسيُعاد حساب إجماليها.` : 'حذف هذا المصروف نهائياً؟', { ok: 'حذف', danger: true })) { await api('DELETE', '/api/expenses/' + e.id); toast('تم الحذف'); history.back(); } };
}
ACT.bulk = async el => {
  const ids = $$('[data-sel]:checked').map(c => c.dataset.sel);
  if (!ids.length) return toast('حدد مصروفاً واحداً على الأقل', true);
  if (el.dataset.s === 'rejected') {
    return formSheet({ title: `رفض ${ids.length} مصروف`, submit: 'رفض', fields: [{ type: 'textarea', name: 'note', label: 'سبب الرفض' }], onSubmit: async (b, close) => { await api('POST', '/api/expenses/review', { ids, status: 'rejected', note: b.note }); close(); toast('تم الرفض'); router(); } });
  }
  await api('POST', '/api/expenses/review', { ids, status: 'approved' });
  toast(`تم اعتماد ${ids.length} مصروف`);
  router();
};

// ----- نموذج المصروف (الأهم: بسيط وسريع) -----
async function expenseForm({ custodyId, expense, viaReminder } = {}) {
  let custodies = [];
  if (!expense) {
    custodies = await api('GET', '/api/custodies?status=open');
    if (!custodies.length) {
      return modal(`<h3>لا توجد عهدة مفتوحة</h3><p class="muted">${isStaff() ? 'اصرف عهدة للموظف أولاً ثم سجل المصروفات عليها.' : 'لا توجد عهدة مفتوحة باسمك. اطلب عهدة من الإدارة.'}</p><div class="sheet-foot"><button class="btn ghost" data-close>إغلاق</button><button class="btn primary" id="nx">${isStaff() ? 'صرف عهدة' : 'طلب عهدة'}</button></div>`, { onMount: (el, close) => { $('#nx', el).onclick = () => { close(); isStaff() ? custodyForm() : requestForm(); }; } });
    }
  }
  const selCustody = expense ? null : (custodies.find(c => c.id === custodyId) || custodies[0]);
  const cats = S.b.categories.filter(c => c.active !== false || c.id === expense?.categoryId);
  const e = expense || {};
  // الموظف: نموذج قصير (صورة، مبلغ، بند، بيان) — باقي البيانات تكملها الإدارة عند الاعتماد
  const simple = !expense && !isStaff();
  const simpleFields = simple && [
    custodies.length === 1 ? { type: 'html', html: `<input type="hidden" name="custodyId" value="${selCustody.id}">` }
      : { type: 'select', name: 'custodyId', label: 'من أي عهدة؟', full: true, required: true, value: selCustody.id, options: custodies.map(c => ({ value: c.id, label: `${c.no} — ${c.purpose} (الباقي ${fmt(c.balance)})` })) },
    { type: 'files', name: 'attachments', label: 'صورة الفاتورة', button: 'صوّر الفاتورة' },
    { type: 'money', name: 'amount', label: 'المبلغ', required: true },
    { type: 'chips', name: 'categoryId', label: 'نوع المصروف', required: true, value: '', options: cats.map(c => ({ value: c.id, label: c.name })) },
    { type: 'html', html: '<div class="add-cat"><input id="new-cat" placeholder="نوع غير موجود؟ اكتبه هنا" maxlength="60"><button type="button" class="btn sm" id="add-cat">＋ إضافة</button></div>' },
    { name: 'description', label: 'ماذا اشتريت؟', required: true, full: true, placeholder: 'مثال: أسمنت 10 أكياس' },
    { type: 'select', name: 'costCenterId', label: 'المشروع', full: true, options: ccOptions(), value: selCustody?.costCenterId || '', empty: '— اختر المشروع —' },
    { type: 'date', name: 'date', label: 'التاريخ', value: today() },
  ];
  formSheet({
    title: expense ? `تعديل المصروف ${e.no}` : viaReminder ? '🔔 سجّل ما صرفته' : 'تسجيل مصروف',
    submit: expense ? 'حفظ التعديل' : 'حفظ المصروف',
    files: { attachments: e.attachments || [] },
    fields: simple ? simpleFields : [
      expense ? { type: 'html', html: `<div class="fixed-field">العهدة: <b>${esc(e.custodyNo)}</b> — ${esc(e.employeeName)}</div>` }
        : custodies.length === 1 && !isStaff() ? { type: 'html', html: `<input type="hidden" name="custodyId" value="${selCustody.id}"><div class="fixed-field">من عهدة: <b>${esc(selCustody.no)}</b> — ${esc(selCustody.purpose)} <span class="muted">(الرصيد ${fmt(selCustody.balance)})</span></div>` }
          : { type: 'select', name: 'custodyId', label: 'من أي عهدة؟', full: true, required: true, value: selCustody.id, options: custodies.map(c => ({ value: c.id, label: `${c.no} — ${isStaff() ? c.employeeName + ' — ' : ''}${c.purpose} (رصيد ${fmt(c.balance)})` })) },
      { type: 'money', name: 'amount', label: 'المبلغ المصروف', required: true, value: e.amount },
      { type: 'select', name: 'costCenterId', label: 'مركز التكلفة (المشروع / القسم)', full: true, required: true, options: ccOptions(), value: e.costCenterId || selCustody?.costCenterId || '', empty: '— اختر مركز التكلفة —' },
      { type: 'chips', name: 'categoryId', label: 'بند المصروف', required: true, value: e.categoryId || '', options: cats.map(c => ({ value: c.id, label: c.name })) },
      { type: 'html', html: '<div class="add-cat"><input id="new-cat" placeholder="نوع غير موجود؟ اكتبه هنا" maxlength="60"><button type="button" class="btn sm" id="add-cat">＋ إضافة</button></div>' },
      { name: 'description', label: 'البيان (ماذا اشتريت / لماذا)', required: true, full: true, value: e.description, placeholder: 'مثال: أسمنت 10 أكياس' },
      { type: 'date', name: 'date', label: 'التاريخ', value: e.date || today() },
      ...(expense ? [] : [{ type: 'time', name: 'time', label: 'الوقت', value: new Date().toTimeString().slice(0, 5) }]),
      { type: 'files', name: 'attachments', label: 'صور الفاتورة / الإيصال', hint: 'من الكاميرا أو المعرض أو ملف PDF — حتى 6 مرفقات' },
      { type: 'section', label: 'بيانات الفاتورة (اختياري)' },
      { name: 'vendor', label: 'المورد / المحل', value: e.vendor },
      { name: 'invoiceNo', label: 'رقم الفاتورة', value: e.invoiceNo },
      { name: 'vendorVat', label: 'الرقم الضريبي للمورد', value: e.vendorVat, attrs: 'inputmode="numeric" dir="ltr"' },
      { type: 'select', name: 'paymentMethod', label: 'طريقة الدفع', options: PAY_METHODS, value: e.paymentMethod },
      { type: 'toggle', name: 'vatIncluded', label: `المبلغ شامل ضريبة القيمة المضافة ${S.b.settings.vatRate}%`, value: e.vatIncluded },
      { type: 'html', html: '<div class="vat-calc muted" id="vat-calc"></div>' },
      ...(isStaff() && !expense ? [{ type: 'toggle', name: 'autoApprove', label: 'اعتماد المصروف مباشرة', value: true }] : []),
    ],
    onMount: (el, _close, form) => {
      const addBtn = $('#add-cat', el);
      if (addBtn) addBtn.onclick = async () => {
        const input = $('#new-cat', el), name = input.value.trim();
        if (!name) return input.focus();
        try {
          const c = await api('POST', '/api/categories', { name });
          if (!S.b.categories.some(x => x.id === c.id)) S.b.categories.push(c);
          const chips = $('[data-chips="categoryId"]', el);
          let chip = $(`.chip[data-v="${c.id}"]`, chips);
          if (!chip) { chips.insertAdjacentHTML('beforeend', `<button type="button" class="chip" data-v="${esc(c.id)}">${esc(c.name)}</button>`); chip = chips.lastElementChild; }
          chip.click(); input.value = ''; toast('تمت إضافة النوع');
        } catch (err) { toast(err.message, true); }
      };
      const ccBox = form.costCenterId.closest('.field');
      const syncCc = () => { if (simple) ccBox.hidden = !!form.costCenterId.value && !!(custodies.find(x => x.id === form.custodyId.value) || {}).costCenterId; };
      syncCc();
      const calc = () => {
        if (!form.vatIncluded) return;
        const a = Number(form.amount.value) || 0, r = Number(S.b.settings.vatRate) || 0;
        $('#vat-calc', el).innerHTML = form.vatIncluded.checked && a ? `الضريبة: <b class="num">${fmt(a * r / (100 + r))}</b> · الصافي: <b class="num">${fmt(a - a * r / (100 + r))}</b>` : '';
      };
      form.addEventListener('input', calc); form.addEventListener('change', calc); calc();
      const cSel = form.querySelector('select[name=custodyId]');
      if (cSel) cSel.addEventListener('change', () => { const c = custodies.find(x => x.id === cSel.value); if (c?.costCenterId) form.costCenterId.value = c.costCenterId; syncCc(); });
      if (!expense) setTimeout(() => form.amount.focus(), 250);
    },
    onSubmit: async (d, close, modalEl) => {
      if (!d.categoryId) throw new Error(simple ? 'اختر نوع المصروف' : 'اختر بند المصروف');
      if (!d.costCenterId) { modalEl.querySelector('[name=costCenterId]').closest('.field').hidden = false; throw new Error('اختر المشروع'); }
      if (expense) await api('PUT', '/api/expenses/' + e.id, d);
      else await api('POST', '/api/expenses', { ...d, viaReminder: !!viaReminder });
      resetReminderClock();
      close();
      toast(expense ? 'تم حفظ التعديل' : 'تم حفظ المصروف ✓');
      router();
    },
  });
}

function custodyForm(employeeId) {
  const emps = userOptions();
  if (!emps.length) return toast('أضف موظفاً أولاً', true);
  formSheet({
    title: 'صرف عهدة نقدية', submit: 'صرف العهدة',
    fields: [
      { type: 'select', name: 'employeeId', label: 'الموظف المستلم', options: emps, value: employeeId, empty: '— اختر الموظف —', required: true, full: true },
      { type: 'chips', name: 'kind', label: 'نوع العهدة', value: 'temporary', options: [{ value: 'temporary', label: 'مؤقتة (لمهمة وتُسوّى وتُغلق)' }, { value: 'permanent', label: 'مستديمة (نثرية تُعوَّض دورياً)' }] },
      { type: 'money', name: 'amount', label: 'مبلغ العهدة', required: true },
      srcField('مصدر المبلغ — صُرف من أين؟', isOwner() ? S.b.fundSources.find(x => x.active !== false && x.type === 'owner')?.id : undefined),
      { name: 'purpose', label: 'الغرض من العهدة', required: true, full: true, placeholder: 'مثال: مشتريات موقع برج الريان' },
      { type: 'select', name: 'costCenterId', label: 'مركز التكلفة الافتراضي', options: ccOptions(), empty: '— اختر —', full: true, hint: 'يُقترح تلقائياً عند تسجيل المصروفات ويمكن تغييره لكل مصروف' },
      { type: 'date', name: 'issueDate', label: 'تاريخ الصرف', value: today() },
      { type: 'date', name: 'dueDate', label: 'موعد التسوية (للمؤقتة)' },
      { type: 'select', name: 'method', label: 'طريقة الصرف', options: PAY_METHODS },
      { name: 'ref', label: 'رقم المرجع / الشيك / التحويل' },
      { type: 'textarea', name: 'notes', label: 'ملاحظات' },
    ],
    onSubmit: async (d, close) => {
      let r;
      try { r = await api('POST', '/api/custodies', d); } catch (e) {
        if (!/يتجاوز الحد/.test(e.message) || !(await confirmBox(e.message + ' — صرفها على أي حال؟'))) throw e;
        r = await api('POST', '/api/custodies', { ...d, force: true });
      }
      close(); toast(r.coveredDeficit ? `تم صرف العهدة ${r.no} — خُصم منها ${fmt(r.coveredDeficit)} عجزاً سابقاً دفعه الموظف من جيبه` : `تم صرف العهدة ${r.no}`); go('#/custody/' + r.id);
    },
    onMount: (el, _c, form) => {
      const box = document.createElement('div'); box.className = 'notice full'; box.hidden = true;
      form.querySelector('[name=amount]').closest('.field').after(box);
      const sync = async () => {
        box.hidden = true;
        if (!form.employeeId.value) return;
        const cs = await api('GET', '/api/custodies?' + qsOf({ employeeId: form.employeeId.value, status: 'open' })).catch(() => []);
        const debt = cs.filter(c => c.balance < 0).reduce((a, c) => a - c.balance, 0);
        if (debt > 0) { box.hidden = false; box.innerHTML = `${ic('alert', 18)} هذا الموظف دفع <b class="num">${fmt(debt)}</b> من جيبه على عهدة سابقة — سيُخصم تلقائياً من هذه العهدة ليعوَّض، ويبقى معه الباقي.`; }
      };
      form.employeeId.addEventListener('change', sync); sync();
    },
  });
}

// ----- العهد العينية -----
function assetItem(a) {
  return `<a class="item" href="#/asset/${a.id}"><div class="item-ic">${ic('box')}</div>
    <div class="item-main"><div class="item-title">${esc(a.name)} ${tag(a.statusName, { assigned: 'info', available: 'ok', maintenance: 'warn', lost: 'bad', retired: '' }[a.status])} ${a.status === 'assigned' && !a.acknowledged ? tag('لم يُقر بالاستلام', 'warn') : ''}</div>
    <div class="item-sub">${esc(a.category)}${a.serial ? ' · <span class="num">' + esc(a.serial) + '</span>' : ''}</div><div class="item-meta">${esc(a.no)}${a.holderName ? ' · بعهدة ' + esc(a.holderName) : ''}</div></div>
    <div class="item-end">${a.value ? money(a.value) : ''}</div></a>`;
}
async function assetDetail(id) {
  const { asset: a, moves } = await api('GET', '/api/assets/' + id);
  const staff = isStaff();
  const mine = a.holderId === S.user.id;
  const acts = staff ? [
    a.status !== 'assigned' && btn('تسليم لموظف', { act: 'a-move', data: 'data-t="assign"', icon: 'user', cls: 'primary' }),
    a.status === 'assigned' && btn('نقل لموظف آخر', { act: 'a-move', data: 'data-t="transfer"', icon: 'swap' }),
    a.status === 'assigned' && btn('استلام من الموظف', { act: 'a-move', data: 'data-t="return"', icon: 'undo' }),
    a.status !== 'maintenance' && btn('إرسال للصيانة', { act: 'a-move', data: 'data-t="maintenance"', icon: 'settings', cls: 'ghost' }),
    a.status === 'maintenance' && btn('إرجاع للمستودع', { act: 'a-move', data: 'data-t="available"', icon: 'box', cls: 'ghost' }),
    a.status !== 'lost' && btn('فقد / تلف', { act: 'a-move', data: 'data-t="lost"', icon: 'alert', cls: 'ghost' }),
    btn('تعديل', { act: 'a-edit', icon: 'edit', cls: 'ghost' }),
    isAdmin() && btn('حذف', { act: 'a-del', icon: 'trash', cls: 'danger-o' }),
  ] : [mine && !a.acknowledged && btn('أقر باستلام هذه العهدة', { act: 'a-ack', icon: 'ok', cls: 'primary' })];
  view(a.name, `
    <div class="hero-card slim"><div class="hero-top"><div><div class="hero-label">${esc(a.no)} · ${esc(a.category)}</div><div class="hero-value sm">${esc(a.name)}</div><div class="hero-sub">${a.holderName ? 'بعهدة: ' + esc(a.holderName) : esc(a.statusName)}</div></div><div>${a.status === 'assigned' ? tag(a.acknowledged ? 'أقر بالاستلام ✓' : 'لم يُقر بعد', a.acknowledged ? 'light' : 'warn') : ''}</div></div></div>
    <div class="astrip mb">${acts.filter(Boolean).join('')}${a.status === 'assigned' ? btn('طباعة نموذج التسليم', { act: 'a-print', icon: 'print', cls: 'ghost' }) : ''}</div>
    ${card('بيانات الأصل', rows([['الرقم التسلسلي / اللوحة', `<span class="num">${esc(a.serial || '—')}</span>`], a.model && ['الموديل', esc(a.model)], ['القيمة', money(a.value)], a.purchaseDate && ['تاريخ الشراء', fmtDate(a.purchaseDate)], ['مركز التكلفة', esc(a.costCenterName)], ['الحالة الفنية', esc(a.condition || '—')], a.notes && ['ملاحظات', esc(a.notes)]]))}
    ${a.photos?.length ? card('الصور', `<div class="gallery">${a.photos.map(f => `<a href="#" data-open-file="${esc(f)}" class="g-item"><img data-file="${esc(f)}" alt=""></a>`).join('')}</div>`) : ''}
    ${card('سجل الحركة', moves.length ? `<div class="timeline">${moves.map(m => `<div class="tl"><div class="tl-dot"></div><div class="tl-body"><div class="tl-title">${esc(m.typeName)}${m.toName ? ' ← ' + esc(m.toName) : ''}${m.fromName && !m.toName ? ' (من ' + esc(m.fromName) + ')' : ''}</div><div class="tl-sub">الحالة: ${esc(m.condition || '—')}${m.note ? ' · ' + esc(m.note) : ''}</div><div class="tl-meta">${fmtDate(m.date)} · ${esc(m.byName)}</div></div></div>`).join('')}</div>` : empty('لا توجد حركات'))}
  `, { back: staff ? '#/assets' : '#/assets' });
  ACT['a-move'] = el => {
    const t = el.dataset.t;
    const needsTo = t === 'assign' || t === 'transfer';
    formSheet({
      title: S.b.assetMoves[t], submit: 'حفظ',
      fields: [...(needsTo ? [{ type: 'select', name: 'toId', label: 'الموظف المستلم', options: userOptions(u => u.id !== a.holderId), empty: '— اختر —', required: true, full: true }] : []), { type: 'date', name: 'date', label: 'التاريخ', value: today() }, { name: 'condition', label: 'الحالة الفنية', value: a.condition, placeholder: 'جديد / جيد / يحتاج صيانة' }, { type: 'textarea', name: 'note', label: 'ملاحظة' }],
      onSubmit: async (b, close) => { await api('POST', `/api/assets/${a.id}/move`, { ...b, type: t }); close(); toast('تم'); router(); },
    });
  };
  ACT['a-edit'] = () => assetForm(a);
  ACT['a-del'] = () => adminDelete(`حذف الأصل ${a.no} «${a.name}» وسجل حركته نهائياً؟`, '/api/assets/' + a.id, () => go('#/assets'));
  ACT['a-ack'] = async () => { await api('POST', `/api/assets/${a.id}/ack`); toast('تم تسجيل إقرارك بالاستلام'); router(); };
  ACT['a-print'] = () => printDoc(`<h2 class="doc-title">نموذج تسليم عهدة عينية</h2>${rows([['رقم الأصل', esc(a.no)], ['الأصل', esc(a.name)], ['الفئة', esc(a.category)], ['الرقم التسلسلي', esc(a.serial || '—')], ['القيمة', money(a.value)], ['الحالة عند التسليم', esc(a.condition || '')], ['اسم المستلم', esc(a.holderName)], ['تاريخ التسليم', fmtDate((moves.find(m => m.toId === a.holderId) || {}).date)]])}
    <p class="doc-text">أقر أنا الموقع أدناه باستلامي الأصل المذكور أعلاه بحالة سليمة كعهدة شخصية، وأتعهد بالمحافظة عليه واستخدامه في أغراض العمل فقط، وإعادته عند الطلب أو عند انتهاء علاقتي بالعمل، وأتحمل مسؤولية فقده أو تلفه الناتج عن سوء الاستخدام.</p>${signatures(['المستلم', 'أمين العهد', 'المدير المعتمد'])}`);
}
function assetForm(a) {
  formSheet({
    title: a ? 'تعديل أصل' : 'إضافة عهدة عينية (أصل)', submit: 'حفظ',
    files: { photos: a?.photos || [] },
    fields: [
      { name: 'name', label: 'اسم الأصل', required: true, full: true, value: a?.name, placeholder: 'مثال: لابتوب HP / جهاز مساحة / شاحنة' },
      { type: 'select', name: 'category', label: 'الفئة', options: S.b.assetCategories.map(c => ({ value: c, label: c })), value: a?.category },
      { name: 'serial', label: 'الرقم التسلسلي / رقم اللوحة', value: a?.serial },
      { name: 'model', label: 'الماركة / الموديل', value: a?.model },
      { type: 'number', name: 'value', label: 'القيمة', value: a?.value, attrs: 'step="0.01" min="0"' },
      { type: 'date', name: 'purchaseDate', label: 'تاريخ الشراء', value: a?.purchaseDate || '' },
      { type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions(), value: a?.costCenterId, empty: '— بدون —' },
      { name: 'condition', label: 'الحالة الفنية', value: a?.condition || 'جديد' },
      ...(a ? [] : [{ type: 'select', name: 'assignTo', label: 'تسليمه مباشرة إلى', options: userOptions(), empty: '— يبقى بالمستودع —', full: true }]),
      { type: 'files', name: 'photos', label: 'صور الأصل', button: 'إضافة صورة' },
      { type: 'textarea', name: 'notes', label: 'ملاحظات', value: a?.notes },
    ],
    onSubmit: async (d, close) => { const r = await api(a ? 'PUT' : 'POST', '/api/assets' + (a ? '/' + a.id : ''), d); close(); toast('تم الحفظ'); a ? router() : go('#/asset/' + r.id); },
  });
}

// ----- الموظفون -----
async function userDetail(id) {
  await refreshBootstrap();
  const u = S.b.users.find(x => x.id === id);
  if (!u) return go('#/users');
  const [cs, assets, exps] = await Promise.all([api('GET', '/api/custodies?' + qsOf({ employeeId: id, status: 'open' })), api('GET', '/api/assets?holderId=' + id), api('GET', '/api/expenses?' + qsOf({ employeeId: id }))]);
  const bal = cs.reduce((s, c) => s + c.balance, 0);
  view(u.name, `
    <div class="hero-card"><div class="hero-top"><div><div class="hero-label">إجمالي الرصيد لدى ${esc(u.name)}</div><div class="hero-value">${money(bal)}</div><div class="hero-sub">${esc(u.roleName)}${u.jobTitle ? ' · ' + esc(u.jobTitle) : ''}${u.custodyLimit ? ' · الحد الأعلى ' + fmt(u.custodyLimit) : ''}</div></div></div></div>
    <div class="astrip mb">${btn('صرف عهدة', { act: 'u-give', icon: 'wallet', cls: 'primary' })}${btn('تسليم أصل', { act: 'u-asset', icon: 'box' })}${btn('كشف الحساب', { href: '#/report/statement?employeeId=' + id, icon: 'chart' })}${isAdmin() ? btn('تعديل الحساب', { act: 'u-edit', icon: 'edit', cls: 'ghost' }) : ''}${isAdmin() && u.id !== S.user.id ? btn('حذف المستخدم', { act: 'u-del', icon: 'trash', cls: 'danger-o' }) : ''}</div>
    ${card(`العهد النقدية المفتوحة (${cs.length})`, cs.length ? `<div class="list">${cs.map(custodyItem).join('')}</div>` : empty('لا توجد عهد مفتوحة'))}
    ${card(`العهد العينية (${assets.filter(a => a.status === 'assigned').length})`, assets.length ? `<div class="list">${assets.map(assetItem).join('')}</div>` : empty('لا توجد أصول بعهدته'))}
    ${card('آخر المصروفات', exps.length ? `<div class="list">${exps.slice(0, 10).map(e => expenseItem(e)).join('')}</div>` : empty('لا توجد مصروفات'), btn('الكل', { href: '#/expenses?status=&employeeId=' + id, cls: 'sm ghost' }))}
    ${card('بيانات الحساب', rows([['اسم المستخدم', `<span dir="ltr">${esc(u.username)}</span>`], ['الصلاحية', esc(u.roleName)], ['الجوال', `<span class="num">${esc(u.phone || '—')}</span>`], ['القسم', esc(u.department || '—')], ['الحالة', u.active ? 'نشط' : 'موقوف']]))}
  `, { back: '#/users' });
  ACT['u-give'] = () => custodyForm(id);
  ACT['u-asset'] = async () => {
    const avail = await api('GET', '/api/assets?status=available');
    if (!avail.length) return assetForm();
    formSheet({ title: 'تسليم أصل لـ ' + u.name, submit: 'تسليم', fields: [{ type: 'select', name: 'assetId', label: 'الأصل (من المستودع)', options: avail.map(a => ({ value: a.id, label: `${a.no} — ${a.name}` })), required: true, full: true }, { type: 'date', name: 'date', label: 'التاريخ', value: today() }, { name: 'condition', label: 'الحالة الفنية', value: 'جيد' }], onSubmit: async (b, close) => { await api('POST', `/api/assets/${b.assetId}/move`, { ...b, type: 'assign', toId: id }); close(); toast('تم التسليم'); router(); } });
  };
  ACT['u-edit'] = () => userForm(u);
  ACT['u-del'] = async () => {
    const all = await api('GET', '/api/custodies?' + qsOf({ employeeId: id }));
    if (!all.length) return adminDelete(`حذف المستخدم «${u.name}» نهائياً؟`, '/api/users/' + id, () => go('#/users'));
    // عليه عهد: يُطلب كتابة اسمه للتأكيد قبل حذفه مع كل حركاته
    formSheet({
      title: 'حذف المستخدم مع كل حركاته', submit: 'حذف نهائي',
      intro: `<div class="notice bad">${ic('alert', 18)} على «${esc(u.name)}» ${all.length} عهدة (مستلم ${fmt(all.reduce((s, c) => s + c.received, 0))}). سيُحذف الحساب مع كل عهده ومصروفاته وتسوياته وطلباته نهائياً، وتعود أصوله للمستودع. هذا مناسب لحسابات التجربة فقط — للموظف الحقيقي أوقف الحساب بدل حذفه.</div>`,
      fields: [{ name: 'confirm', label: `اكتب الاسم «${u.name}» للتأكيد`, required: true, full: true }],
      onSubmit: async (b, close) => {
        if (b.confirm.trim() !== u.name.trim()) return toast('الاسم غير مطابق', true);
        await api('DELETE', '/api/users/' + id + '?purge=1'); await refreshBootstrap(); close(); toast('تم حذف المستخدم'); go('#/users');
      },
    });
  };
}
function userForm(u) {
  if (!isAdmin()) return toast('لمدير النظام فقط', true);
  formSheet({
    title: u ? 'تعديل حساب' : 'إضافة موظف / مستخدم', submit: 'حفظ',
    fields: [
      { name: 'name', label: 'الاسم الكامل', required: true, value: u?.name },
      { name: 'jobTitle', label: 'المسمى الوظيفي', value: u?.jobTitle },
      { name: 'department', label: 'القسم / الإدارة', value: u?.department },
      { name: 'phone', label: 'الجوال', value: u?.phone, attrs: 'inputmode="tel" dir="ltr"' },
      { type: 'select', name: 'role', label: 'الصلاحية', value: u?.role || 'employee', options: [{ value: 'employee', label: 'موظف — يسجل مصروفاته فقط' }, { value: 'accountant', label: 'محاسب — يعتمد ويصرف ويسوي' }, { value: 'owner', label: 'المالك — واجهة مبسطة: يتابع ويعتمد ويصرف' }, { value: 'admin', label: 'مدير النظام — كل الصلاحيات' }] },
      { type: 'number', name: 'custodyLimit', label: 'الحد الأعلى للعهدة (اختياري)', value: u?.custodyLimit || '', attrs: 'min="0"' },
      { type: 'toggle', name: 'directCustody', label: 'تعميد مباشر: يستلم عهدته من المالك مباشرة ويسجلها بنفسه بدون طلب', value: u ? u.directCustody : true },
      { name: 'username', label: 'اسم المستخدم للدخول', required: !u, value: u?.username, attrs: `dir="ltr" autocapitalize="off" ${u ? 'disabled' : ''}` },
      { name: 'password', label: u ? 'كلمة مرور جديدة (اتركها فارغة)' : 'كلمة المرور', required: !u, attrs: 'dir="ltr" minlength="4"' },
      ...(u ? [{ type: 'toggle', name: 'active', label: 'الحساب نشط', value: u.active }] : []),
    ],
    onSubmit: async (d, close) => { const r = await api(u ? 'PUT' : 'POST', '/api/users' + (u ? '/' + u.id : ''), d); await refreshBootstrap(); close(); toast('تم الحفظ'); u ? router() : go('#/user/' + r.id); },
  });
}

// ----- مراكز التكلفة -----
async function ccDetail(id, q) {
  const d = await api('GET', `/api/cost-centers/${id}?` + qsOf({ from: q.from, to: q.to }));
  const c = d.costCenter;
  const maxCat = Math.max(1, ...d.byCategory.map(x => x[1]));
  view(c.name, `
    <div class="hero-card"><div class="hero-top"><div><div class="hero-label">${c.code ? esc(c.code) + ' · ' : ''}${esc(S.b.ccTypes[c.type] || '')}${c.parentName ? ' · تابع لـ ' + esc(c.parentName) : ''}</div><div class="hero-value">${money(d.spent)}</div><div class="hero-sub">إجمالي المصروف (يشمل الفروع)</div></div>${c.active === false ? tag('مغلق', 'light') : ''}</div>
      ${c.budget ? progress(d.spent, c.budget, 'light') + `<div class="hero-stats"><div><small>الميزانية</small>${money(c.budget)}</div><div><small>المتبقي</small>${money(c.budget - d.spent)}</div><div><small>نسبة الصرف</small><span class="num">${Math.round(d.spent / c.budget * 100)}%</span></div></div>` : ''}</div>
    <div class="astrip mb">${btn('تعديل', { act: 'cc-edit', icon: 'edit' })}${btn('مركز فرعي', { act: 'cc-child', icon: 'plus' })}${isAdmin() ? btn('حذف', { act: 'cc-del', icon: 'trash', cls: 'danger-o' }) : ''}${btn('كل المصروفات', { href: '#/expenses?status=&costCenterId=' + id, icon: 'receipt', cls: 'ghost' })}${btn('تقرير البنود', { href: '#/report/categories?costCenterId=' + id, icon: 'chart', cls: 'ghost' })}</div>
    <form class="period" id="per">${fieldHtml({ type: 'date', name: 'from', label: 'من', value: q.from })}${fieldHtml({ type: 'date', name: 'to', label: 'إلى', value: q.to })}<button class="btn sm">عرض</button></form>
    ${d.children.length ? card('المراكز الفرعية', `<div class="list">${d.children.map(x => `<a class="item" href="#/cost-center/${x.id}"><div class="item-ic">${ic('layers')}</div><div class="item-main"><div class="item-title">${esc(x.name)}</div><div class="item-sub">${x.budget ? 'الميزانية ' + fmt(x.budget) : ''}</div></div>${ic('chev', 16)}</a>`).join('')}</div>`) : ''}
    <div class="grid2">
      ${card('الصرف حسب البند', d.byCategory.length ? `<div class="bars">${d.byCategory.map(([n, v]) => `<div class="bar-row"><div class="bar-name">${esc(n)}</div>${progress(v, maxCat)}<div class="bar-val">${money(v)}</div></div>`).join('')}</div>` : empty('لا يوجد صرف'))}
      ${card('الصرف حسب الموظف', d.byEmployee.length ? `<div class="bars">${d.byEmployee.map(([n, v]) => `<div class="bar-row"><div class="bar-name">${esc(n)}</div>${progress(v, d.byEmployee[0][1])}<div class="bar-val">${money(v)}</div></div>`).join('')}</div>` : empty('لا يوجد صرف'))}
    </div>
    ${d.custodies.length ? card('عهد مفتوحة على هذا المركز', `<div class="list">${d.custodies.map(custodyItem).join('')}</div>`) : ''}
    ${card('آخر المصروفات', d.expenses.length ? `<div class="list">${d.expenses.slice(0, 15).map(e => expenseItem(e)).join('')}</div>` : empty('لا توجد مصروفات'))}
    ${d.assets.length ? card('الأصول المرتبطة', `<div class="list">${d.assets.map(assetItem).join('')}</div>`) : ''}
  `, { back: '#/cost-centers' });
  $('#per').onsubmit = e => { e.preventDefault(); go(`#/cost-center/${id}?` + qsOf(readForm(e.target))); };
  ACT['cc-edit'] = () => ccForm(c);
  ACT['cc-child'] = () => ccForm(null, c.id);
  ACT['cc-del'] = () => adminDelete(`حذف «${c.name}»؟ (يُرفض إن كانت عليه مصروفات أو عهد أو أصول أو مراكز فرعية — أغلقه بدل ذلك)`, '/api/cost-centers/' + c.id, () => go('#/cost-centers'));
}
function ccForm(c, parentId) {
  formSheet({
    title: c ? 'تعديل مشروع / مركز تكلفة' : 'مشروع / مركز تكلفة جديد', submit: 'حفظ',
    fields: [
      { name: 'name', label: 'الاسم', required: true, value: c?.name, full: true, placeholder: 'مثال: مشروع مجمع الورود / الإدارة العامة / شاحنة 4521' },
      { name: 'code', label: 'الرمز', value: c?.code, placeholder: '100' },
      { type: 'select', name: 'type', label: 'النوع', value: c?.type || 'project', options: Object.entries(S.b.ccTypes).map(([value, label]) => ({ value, label })) },
      { type: 'select', name: 'parentId', label: 'تابع لمركز رئيسي', options: ccOptions({ activeOnly: false }).filter(o => o.value !== c?.id), value: c ? c.parentId : parentId, empty: '— مركز رئيسي —', full: true },
      { type: 'number', name: 'budget', label: 'الميزانية (اختياري)', value: c?.budget || '', attrs: 'min="0" step="0.01"' },
      { type: 'select', name: 'managerId', label: 'المسؤول', options: userOptions(), value: c?.managerId, empty: '— بدون —' },
      ...(c ? [{ type: 'toggle', name: 'active', label: 'المركز نشط (يقبل مصروفات جديدة)', value: c.active !== false }] : []),
      { type: 'textarea', name: 'notes', label: 'ملاحظات', value: c?.notes },
    ],
    onSubmit: async (d, close) => { const r = await api(c ? 'PUT' : 'POST', '/api/cost-centers' + (c ? '/' + c.id : ''), d); await refreshBootstrap(); close(); toast('تم الحفظ'); c ? router() : go('#/cost-center/' + r.id); },
  });
}

// ----- التقارير -----
const REPORTS = [
  ['balances', 'wallet', 'أرصدة العهد حسب الموظف', 'كم استلم كل موظف وكم صرف وكم بقي معه', true],
  ['statement', 'list', 'كشف حساب موظف', 'كل الحركات بالرصيد الجاري لموظف أو عهدة', false],
  ['sources', 'bank', 'مصادر أموال العهد', 'من أين صُرفت العهد (بنك، صندوق، مالك…) وإلى أين رُدّت', true],
  ['source-ledger', 'list', 'حركة أموال العهد بالتفصيل', 'كل مبلغ: من أي مصدر، لأي موظف، بأي مرجع', true],
  ['cost-centers', 'layers', 'المصروفات حسب المشاريع ومراكز التكلفة', 'مقارنة بالميزانية مع تجميع المراحل الفرعية', true],
  ['categories', 'tag', 'المصروفات حسب البنود', 'لكل حساب: الصافي والضريبة والإجمالي', true],
  ['expenses', 'receipt', 'سجل المصروفات التفصيلي', 'كل مصروف ببياناته الكاملة مع التصفية', true],
  ['aging', 'clock', 'أعمار العهد المفتوحة', 'العهد المتأخرة عن التسوية', true],
  ['settlements', 'check', 'سجل التسويات', 'كل التسويات وما رُد أو عُوّض', true],
  ['vat', 'file', 'تقرير ضريبة المدخلات', 'فواتير المصروفات المعتمدة الخاضعة للضريبة', true],
  ['assets', 'box', 'سجل العهد العينية', 'الأصول وحالتها وبعهدة من', true],
  ['checkins', 'bell', 'تفاعل الموظفين مع التنبيهات', 'ردود الموظفين على تنبيه نصف الساعة', true],
  ['monthly', 'chart', 'المصروفات الشهرية حسب البنود', 'كل بند شهراً بشهر لاكتشاف الزيادة', true],
  ['employee-activity', 'users', 'نشاط الموظفين', 'عدد المصروفات والمعتمد والمرفوض ونسبة الفواتير المرفقة', true],
];
function reportsHub() {
  view('التقارير', `<a class="report-card feature" href="#/analytics"><div class="item-ic">${ic('chart')}</div><div><div class="item-title">التحليلات والرسوم البيانية</div><div class="item-sub">الصرف شهرياً، وحسب البنود والمشاريع والموظفين والمصادر</div></div></a><div class="report-grid">${REPORTS.map(([k, i, t, s]) => `<a class="report-card" href="#/report/${k}"><div class="item-ic">${ic(i)}</div><div><div class="item-title">${t}</div><div class="item-sub">${s}</div></div></a>`).join('')}</div>`);
}
async function reportView(name, q) {
  const needsEmp = name === 'statement' && isStaff() && !q.employeeId;
  const meta = REPORTS.find(r => r[0] === name) || [];
  const filterFields = [
    !['balances', 'aging', 'assets'].includes(name) && { type: 'date', name: 'from', label: 'من تاريخ', value: q.from },
    !['balances', 'aging', 'assets'].includes(name) && { type: 'date', name: 'to', label: 'إلى تاريخ', value: q.to },
    name === 'statement' && isStaff() && { type: 'select', name: 'employeeId', label: 'الموظف', options: userOptions(), value: q.employeeId, empty: '— اختر —' },
    (name === 'categories' || name === 'expenses') && { type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions({ activeOnly: false }), value: q.costCenterId, empty: 'الكل' },
    name === 'expenses' && { type: 'select', name: 'employeeId', label: 'الموظف', options: userOptions(), value: q.employeeId, empty: 'الكل' },
    name === 'expenses' && { type: 'select', name: 'status', label: 'الحالة', options: Object.entries(S.b.expenseStatus).map(([value, label]) => ({ value, label })), value: q.status, empty: 'الكل' },
    name === 'assets' && { type: 'select', name: 'holderId', label: 'بعهدة', options: userOptions(), value: q.holderId, empty: 'الكل' },
    name === 'source-ledger' && { type: 'select', name: 'sourceId', label: 'المصدر', options: S.b.fundSources.map(x => ({ value: x.id, label: x.name })), value: q.sourceId, empty: 'الكل' },
    name === 'source-ledger' && { type: 'select', name: 'employeeId', label: 'الموظف', options: userOptions(), value: q.employeeId, empty: 'الكل' },
  ].filter(Boolean);
  const r = needsEmp ? null : await api('GET', `/api/reports/${name}?` + qsOf(q));
  const cell = (c, v) => c.type === 'money' ? (v === '' ? '' : `<span class="num ${v < 0 ? 'neg' : ''}">${fmt(v)}</span>`) : c.type === 'num' ? `<span class="num">${v}</span>` : c.type === 'date' ? fmtDate(v) : esc(v);
  const table = r ? (r.rows.length ? `<div class="table-wrap"><table class="report"><thead><tr>${r.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row => `<tr class="${row._depth === 0 && name === 'cost-centers' ? 'strong' : ''}">${r.columns.map(c => `<td>${cell(c, row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>${r.totals ? `<tfoot><tr>${r.columns.map((c, i) => `<td>${i === 0 ? 'الإجمالي' : r.totals[c.key] !== undefined ? cell(c, r.totals[c.key]) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>` : empty('لا توجد بيانات في هذه الفترة')) : empty('اختر الموظف لعرض كشف الحساب');
  view(r ? r.title : meta[2] || 'تقرير', `
    ${filterFields.length ? `<form class="period" id="rf">${filterFields.map(fieldHtml).join('')}<button class="btn sm primary">عرض</button></form>` : ''}
    ${r ? `<div class="summary-line"><span>${esc(r.subtitle)}</span><span>${r.rows.length} سطر</span></div>` : ''}
    ${card('', table)}
  `, { back: isStaff() ? '#/reports' : '#/home', toolbar: r ? btn('تصدير Excel', { act: 'r-xls', icon: 'download', cls: 'primary' }) + btn('طباعة', { act: 'r-print', icon: 'print', cls: 'ghost' }) : '' });
  $('#rf') && ($('#rf').onsubmit = e => { e.preventDefault(); go(`#/report/${name}?` + qsOf(readForm(e.target))); });
  ACT['r-xls'] = () => exportCsv(r.title, r.columns, r.rows, r.totals);
  ACT['r-print'] = () => printDoc(`<h2 class="doc-title">${esc(r.title)}</h2><p class="center">${esc(r.subtitle)}</p>${table}`);
}

// ----- الإشعارات والإعدادات -----
async function notificationsView() {
  const list = await api('GET', '/api/notifications');
  view('الإشعارات', list.length ? `<div class="list cards">${list.map(n => `<a class="item ${n.read ? '' : 'unread'}" href="${esc(n.link || '#/')}"><div class="item-ic">${ic('bell')}</div><div class="item-main"><div class="item-title">${esc(n.text)}</div><div class="item-meta">${ago(n.at)}</div></div></a>`).join('')}</div>` : empty('لا توجد إشعارات'));
  if (list.some(n => !n.read)) { await api('POST', '/api/notifications/read'); S.unread = 0; updateBadges(); }
}
function settingsView() {
  const s = S.b.settings;
  const admin = isAdmin();
  view('الإعدادات', `
    ${card('حسابي', `<div class="me-row"><div class="avatar">${esc(S.user.name.trim()[0])}</div><div><b>${esc(S.user.name)}</b><div class="muted">${esc(S.user.roleName)} · <span dir="ltr">${esc(S.user.username)}</span></div></div></div>
      <div class="actions mt">${btn('تغيير كلمة المرور', { act: 's-pw', icon: 'lock' })}${btn('تسجيل الخروج', { act: 'logout', icon: 'logout', cls: 'danger-o' })}</div>`)}
    ${!isStaff() ? card('التنبيهات', `<p>يصلك تنبيه كل <b>${s.reminderMinutes}</b> دقيقة خلال الدوام (<span class="num">${s.workStart} – ${s.workEnd}</span>) يسألك: هل صرفت شيئاً؟</p>${notifStatus()}<div class="actions mt">${btn('تجربة التنبيه الآن', { act: 's-test', icon: 'bell' })}</div>`) : ''}
    ${admin ? card('بيانات الشركة', `<form class="form" id="s-co">
      ${fieldHtml({ name: 'companyName', label: 'اسم الشركة', value: s.companyName, full: true })}
      ${fieldHtml({ name: 'vatNumber', label: 'الرقم الضريبي', value: s.vatNumber, attrs: 'dir="ltr"' })}
      ${fieldHtml({ name: 'address', label: 'العنوان', value: s.address })}
      ${fieldHtml({ name: 'currency', label: 'العملة', value: s.currency })}
      ${fieldHtml({ type: 'number', name: 'vatRate', label: 'نسبة ضريبة القيمة المضافة %', value: s.vatRate })}
      <div class="full"><button class="btn primary">حفظ</button></div></form>`) : ''}
    ${admin ? card('الدوام وتنبيهات الموظفين', `<form class="form" id="s-work">
      ${fieldHtml({ type: 'toggle', name: 'remindersEnabled', label: 'تفعيل تنبيه «هل صرفت شيئاً؟» للموظفين', value: s.remindersEnabled })}
      ${fieldHtml({ type: 'time', name: 'workStart', label: 'بداية الدوام', value: s.workStart })}
      ${fieldHtml({ type: 'time', name: 'workEnd', label: 'نهاية الدوام', value: s.workEnd })}
      ${fieldHtml({ type: 'number', name: 'reminderMinutes', label: 'التنبيه كل (دقيقة)', value: s.reminderMinutes, attrs: 'min="5" max="240"' })}
      ${fieldHtml({ type: 'days', name: 'workDays', label: 'أيام العمل', value: s.workDays })}
      <div class="full"><button class="btn primary">حفظ</button></div></form>`) : ''}
    ${admin ? card('ضوابط العهد', `<form class="form" id="s-ctl">
      ${fieldHtml({ type: 'number', name: 'agingDays', label: 'العهدة المؤقتة تعتبر متأخرة بعد (يوم)', value: s.agingDays })}
      ${fieldHtml({ type: 'number', name: 'lowBalance', label: 'تنبيه انخفاض الرصيد عند أقل من', value: s.lowBalance })}
      ${fieldHtml({ type: 'number', name: 'receiptRequiredAbove', label: 'إلزام إرفاق الفاتورة للمصروف الأكبر من (0 = غير إلزامي)', value: s.receiptRequiredAbove, full: true })}
      <div class="full"><button class="btn primary">حفظ</button></div></form>`) : ''}
    ${admin ? card('البيانات والنسخ الاحتياطي', `<p class="muted">${MODE === 'server' ? 'البيانات محفوظة على خادم الشركة.' : MODE_NOTE[MODE] + '. احرص على أخذ نسخة احتياطية بانتظام.'}</p>
      <div class="actions wrap">${btn('تنزيل نسخة احتياطية', { act: 's-backup', icon: 'download', cls: 'primary' })}<label class="btn">${ic('upload', 18)}<span>استعادة نسخة</span><input type="file" accept="application/json,.json" id="s-restore" hidden></label>${MODE === 'demo' ? btn('مسح البيانات التجريبية', { act: 's-wipe', icon: 'trash', cls: 'danger-o' }) : ''}</div>`) : ''}
    ${NATIVE ? card('طريقة التشغيل', `<p class="muted">${MODE === 'server' ? 'مرتبط بخادم: ' + esc(NATIVE.getServer()) : MODE_NOTE[MODE]}</p>${btn('تغيير طريقة التشغيل', { act: 's-mode', icon: 'swap' })}`) : ''}
    <p class="muted center">نظام إدارة العهد — الإصدار 2.0</p>
  `);
  const save = form => form && (form.onsubmit = async e => { e.preventDefault(); try { S.b.settings = await api('PUT', '/api/settings', readForm(e.target)); toast('تم الحفظ'); if (form.id === 's-co') renderShell(), settingsView(); } catch (err) { toast(err.message, true); } });
  ['#s-co', '#s-work', '#s-ctl'].forEach(sel => save($(sel)));
  ACT['s-pw'] = () => formSheet({ title: 'تغيير كلمة المرور', fields: [{ type: 'password', name: 'oldPassword', label: 'كلمة المرور الحالية', required: true, full: true }, { type: 'password', name: 'newPassword', label: 'كلمة المرور الجديدة', required: true, full: true, attrs: 'minlength="4"' }], onSubmit: async (d, close) => { await api('POST', '/api/password', d); close(); toast('تم تغيير كلمة المرور'); } });
  ACT['s-test'] = () => NATIVE ? NATIVE.testReminder() : showReminder(true);
  ACT['s-backup'] = async () => { const data = await api('GET', '/api/backup'); downloadFile(`custody-backup-${today()}.json`, JSON.stringify(data), 'application/json'); toast('تم تنزيل النسخة الاحتياطية'); };
  ACT['s-wipe'] = async () => { if (await confirmBox('مسح كل البيانات التجريبية والبدء من جديد؟', { danger: true, ok: 'مسح' })) { await S.backend.wipe(); store.del(TOKEN_KEY); location.reload(); } };
  ACT['s-mode'] = () => NATIVE.changeServer();
  const rf = $('#s-restore');
  if (rf) rf.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmBox('ستُستبدل كل البيانات الحالية بالنسخة الاحتياطية. متابعة؟', { danger: true, ok: 'استعادة' }))) return;
    try { await api('POST', '/api/restore', JSON.parse(await f.text())); toast('تمت الاستعادة'); setTimeout(() => location.reload(), 600); } catch (err) { toast(err.message || 'ملف غير صالح', true); }
  };
}

// ================= واجهة الموظف =================
const EMP_VIEWS = {
  async home() {
    const d = await api('GET', '/api/home');
    const t = d.totals;
    const unack = d.assets.filter(a => !a.acknowledged);
    const rejected = d.recent.filter(e => e.status === 'rejected');
    const STATUS = { pending: ['بانتظار الاعتماد', 'warn-t'], approved: ['معتمد ✓', 'ok-t'], rejected: ['مرفوض ✗', 'neg'] };
    view('الرئيسية', `
      <div class="s-bal ${t.balance < 0 ? 'neg' : ''}">
        <div class="s-hi">أهلاً ${esc(S.user.name.split(' ')[0])} 👋</div>
        <div class="s-label">${t.balance < 0 ? 'دفعت من جيبك — لك عند الشركة' : 'المتبقي معك'}</div>
        <div class="s-value">${money(Math.abs(t.balance))}</div>
        ${t.balance < 0 ? '<div class="s-sub">يُعوَّض لك تلقائياً من العهدة القادمة</div>' : ''}
        ${t.pendingAmount ? `<div class="s-sub">بانتظار الاعتماد: <span class="num">${fmt(t.pendingAmount)}</span></div>` : ''}
      </div>
      ${notifNotice()}
      ${unack.map(a => `<a class="notice" href="#/asset/${a.id}">${ic('box', 18)} تم تسليمك «${esc(a.name)}» — اضغط للإقرار بالاستلام</a>`).join('')}
      ${rejected.map(e => `<a class="notice bad" href="#/expense/${e.id}">${ic('alert', 18)} رُفض مصروف «${esc(e.description)}»${e.reviewNote ? ' — ' + esc(e.reviewNote) : ''} — اضغط للتعديل</a>`).join('')}
      <form class="q-line" id="q-line" autocomplete="off">
        <input name="q" placeholder="اكتب مثل: اكل 300" aria-label="سجّل بسطر واحد" enterkeyhint="send">
        <button class="btn primary" aria-label="حفظ">${ic('ok', 22)}</button>
        <div class="q-hint" id="q-hint">${S.user.directCustody ? 'أو: استلمت 500' : 'اكتب النوع والمبلغ ثم اضغط ✓'}</div>
      </form>
      <div class="q-tiles">${quickCats().map(c => `<button class="q-tile" data-act="q-cat" data-id="${c.id}"><span class="q-emo">${catEmoji(c.name)}</span>${esc(c.name)}</button>`).join('')}</div>
      <button class="s-btn main" data-act="q-photo">${ic('camera', 30)}<span>صوّر الفاتورة<small>صورة + المبلغ فقط</small></span></button>
      ${S.user.directCustody
        ? `<button class="s-btn" data-act="q-receive">${ic('wallet', 26)}<span>استلمت عهدة<small>اكتب المبلغ فقط</small></span></button>`
        : `<button class="s-btn" data-act="q-requestForm">${ic('inbox', 26)}<span>اطلب عهدة<small>أرسل طلباً للإدارة</small></span></button>`}
      <div class="q-row"><button class="btn ghost" data-act="q-expenseForm">${ic('receipt', 18)} مصروف بالتفاصيل</button><button class="btn ghost" data-act="q-returnForm">${ic('undo', 18)} رجّعت مبلغاً</button>${S.user.directCustody ? `<button class="btn ghost" data-act="q-requestForm">${ic('inbox', 18)} اطلب عهدة</button>` : ''}</div>
      <h3 class="s-h">آخر مصروفاتي</h3>
      ${d.recent.length ? `<div class="s-list">${d.recent.slice(0, 6).map(e => `<a href="#/expense/${e.id}"><div><b>${esc(e.description)}</b><small class="${STATUS[e.status][1]}">${STATUS[e.status][0]} · ${fmtDate(e.date)}</small></div>${money(e.amount)}</a>`).join('')}</div>` : '<p class="muted center">لم تسجل مصروفات بعد</p>'}
      <div class="s-links"><a href="#/custodies">${ic('wallet', 18)}عهدي</a><a href="#/report/statement">${ic('chart', 18)}كشف حسابي</a>${d.assets.length ? `<a href="#/assets">${ic('box', 18)}أجهزتي</a>` : ''}<a href="#/settings">${ic('settings', 18)}الإعدادات</a></div>
      ${projectBar()}
    `);
    bindQuickLine();
  },
  async expenses(_, q) {
    const status = q.status ?? '';
    const list = await api('GET', '/api/expenses?' + qsOf({ status }));
    view('مصروفاتي', `${tabs([['status=', 'الكل'], ['status=pending', 'بانتظار الاعتماد'], ['status=approved', 'المعتمدة'], ['status=rejected', 'المرفوضة']], 'status=' + status, '#/expenses')}
      <div class="summary-line"><span>${list.length} مصروف</span><span>${money(list.filter(e => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0))}</span></div>
      ${list.length ? `<div class="list cards">${list.map(e => expenseItem(e)).join('')}</div>` : empty('لا توجد مصروفات', btn('تسجيل مصروف', { act: 'q-expenseForm', cls: 'primary' }))}`,
    { toolbar: btn('تسجيل مصروف', { act: 'q-expenseForm', icon: 'plus', cls: 'primary' }) });
  },
  expense: expenseDetail,
  async custodies(_, q) {
    const status = q.status ?? 'open';
    const list = await api('GET', '/api/custodies?' + qsOf({ status }));
    view('عهدي النقدية', `${tabs([['status=open', 'المفتوحة'], ['status=closed', 'المغلقة']], 'status=' + status, '#/custodies')}
      ${list.length ? `<div class="list cards">${list.map(custodyItem).join('')}</div>` : empty('لا توجد عهد', btn('طلب عهدة', { act: 'q-requestForm', cls: 'primary' }))}`);
  },
  custody: custodyDetail,
  settlement: settlementView,
  async assets() {
    const list = await api('GET', '/api/assets');
    view('عهدي العينية', list.length ? `<div class="list cards">${list.map(assetItem).join('')}</div>` : empty('لا توجد أصول بعهدتك'));
  },
  asset: assetDetail,
  async requests() {
    const list = await api('GET', '/api/requests');
    view('طلباتي', list.length ? `<div class="list cards">${list.map(r => `<div class="item"><div class="item-ic">${ic(r.type === 'cash' ? 'wallet' : 'box')}</div><div class="item-main"><div class="item-title">${esc(r.purpose)} ${r.direct ? tag('تعميد مباشر', 'info') : tag({ pending: 'قيد الدراسة', approved: 'تمت الموافقة', rejected: 'مرفوض' }[r.status], STATUS_TONE[r.status])}</div><div class="item-meta">${esc(r.no)} · ${ago(r.createdAt)}${r.decisionNote ? ' · ' + esc(r.decisionNote) : ''}</div>${r.custodyId ? `<a class="link-sm" href="#/custody/${r.custodyId}">عرض العهدة ←</a>` : ''}</div><div class="item-end">${r.type === 'cash' ? money(r.amount) : ''}</div></div>`).join('')}</div>` : empty('لم تقدم طلبات'),
    { toolbar: btn('طلب عهدة جديد', { act: 'q-requestForm', icon: 'plus', cls: 'primary' }) });
  },
  report: reportView,
  notifications: notificationsView,
  settings: settingsView,
  more: moreView,
};
// ================= التسجيل السريع للعامل =================
// تطبيع النص العربي لمطابقة الكلمات: أ إ آ ← ا، ة ← ه، ى ← ي، وأرقام هندية ← عربية
const normAr = t => String(t || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').toLowerCase();
// كلمات يكتبها العامل ← جزء من اسم البند
const CAT_WORDS = [
  ['اعاشه', 'اكل غدا غداء عشا عشاء فطور فطار مطعم وجبه وجبات شاي قهوه مويه ماء موية بوفيه ضيافه سندوتش عصير بقاله تموين'],
  ['نقل', 'نقل توصيل تاكسي اوبر كريم مواصلات اجره شحن ونيت دينا سطحه'],
  ['وقود', 'بنزين ديزل وقود سولار محروقات جاز'],
  ['مواد', 'مواد اسمنت حديد رمل بلك طوب خشب دهان دهانات بويه سلك مسامير مواسير بلاستيك سيراميك جبس كهربا افياش لمبات براغي'],
  ['عماله', 'عمال عماله يوميه يوميات اجره عامل'],
  ['ادوات', 'عده عدد ادوات معدات مفك شنيور منشار'],
  ['صيانه', 'صيانه تصليح اصلاح ورشه قطع غيار كفرات زيت'],
  ['رسوم', 'رسوم حكومي بلديه مخالفه تصريح'],
  ['قرطاسيه', 'ورق طباعه قرطاسيه تصوير احبار'],
  ['اتصالات', 'رصيد نت انترنت جوال باقه'],
  ['سكن', 'سكن فندق ايجار شقه'],
  ['سفر', 'سفر تذكره طيران'],
];
const CAT_EMOJI = [['اعاشه', '🍽️'], ['نقل', '🚚'], ['وقود', '⛽'], ['مواد', '🧱'], ['عماله', '👷'], ['ادوات', '🔧'], ['صيانه', '🛠️'], ['رسوم', '🏛️'], ['قرطاسيه', '📄'], ['اتصالات', '📱'], ['سكن', '🏠'], ['سفر', '✈️'], ['متنوع', '🧾']];
const catEmoji = name => (CAT_EMOJI.find(([k]) => normAr(name).includes(k)) || [, '🧾'])[1];
const activeCats = () => S.b.categories.filter(c => c.active !== false);
const otherCat = () => activeCats().find(c => normAr(c.name).includes('متنوع')) || activeCats()[activeCats().length - 1];
// أكثر البنود استخداماً عند هذا العامل (تُحفظ على الجهاز) ثم البنود الشائعة
function quickCats() {
  let used = {};
  try { used = JSON.parse(store.get('q_used') || '{}'); } catch { }
  const cats = activeCats();
  const pref = ['اعاشه', 'نقل', 'وقود', 'مواد', 'عماله', 'ادوات'];
  const rank = c => -(used[c.id] || 0) * 100 + (pref.findIndex(k => normAr(c.name).includes(k)) + 1 || 50);
  return cats.slice().sort((a, b) => rank(a) - rank(b)).slice(0, 6);
}
function markUsed(catId) {
  try { const u = JSON.parse(store.get('q_used') || '{}'); u[catId] = (u[catId] || 0) + 1; store.set('q_used', JSON.stringify(u)); } catch { }
}
function guessCat(text) {
  const t = ' ' + normAr(text) + ' ';
  const cats = activeCats();
  // 1) اسم البند نفسه أو كلمة منه
  for (const c of cats) { const words = normAr(c.name).split(/[\s/،,]+/).filter(w => w.length > 2); if (words.some(w => t.includes(w) || t.includes(w.replace(/^ال/, '')))) return c; }
  // 2) كلمات العامل المعتادة
  for (const [key, words] of CAT_WORDS) {
    if (words.split(' ').some(w => t.includes(' ' + w + ' ') || t.includes(' ال' + w + ' ') || t.includes(w))) { const c = cats.find(x => normAr(x.name).includes(key)); if (c) return c; }
  }
  return null;
}
// «اكل 300» ← { amount: 300, desc: 'اكل' } — يقبل الأرقام العربية والهندية
function parseLine(line) {
  const t = normAr(line).replace(/(\d),(\d)/g, '$1$2');
  const m = t.match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const amount = Number(m[0]);
  const desc = String(line).replace(/[0-9٠-٩۰-۹.,٫]+/, ' ').replace(/\s*(ريال|رس|ر\.س|sar)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  const receive = /^(استلمت|استلام|وصلني|عهده|عهدة)/.test(normAr(desc));
  return { amount, desc, receive };
}
const num2 = n => Math.round((Number(n) || 0) * 100) / 100;
// ----- المشروع الحالي للعامل: يُختار من الشريط أسفل الصفحة ويبقى محفوظاً -----
const projects = () => S.b.costCenters.filter(c => c.active !== false);
const curProject = () => { const id = store.get('q_cc'); return projects().find(c => c.id === id) || null; };
const setProject = id => { store.set('q_cc', id); $$('.p-chip').forEach(x => x.classList.toggle('on', x.dataset.id === id)); };
function projectBar() {
  const list = projects();
  if (!list.length) return '';
  const cur = curProject();
  return `<div class="p-bar" id="p-bar"><div class="p-title">${ic('layers', 16)} المشروع / مركز التكلفة ${cur ? '' : '<b class="warn-t">— اختر المشروع</b>'}</div>
    <div class="p-chips">${list.map(c => `<button type="button" class="p-chip ${cur && cur.id === c.id ? 'on' : ''}" data-act="p-set" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>`;
}
ACT['p-set'] = el => { setProject(el.dataset.id); toast('المشروع: ' + el.textContent); $('#q-line input')?.dispatchEvent(new Event('input')); const t = $('#p-bar .p-title b'); if (t) t.remove(); };
// النظام الذكي: إذا ذكر العامل اسم المشروع أو رمزه في السطر يُسجَّل عليه (مثل: اسمنت 400 العسيله)
const GENERIC = new Set(['مشروع', 'مشاريع', 'مركز', 'تكلفه', 'قسم', 'اداره', 'فرع', 'موقع', 'خاص']);
function guessProject(text) {
  const t = ' ' + normAr(text) + ' ';
  let best = null, score = 0;
  for (const c of projects()) {
    const words = normAr(c.name).split(/[\s/،,\-]+/).map(w => w.replace(/^ال/, '')).filter(w => w.length > 2 && !GENERIC.has(w));
    let sc = words.filter(w => t.includes(w)).length * 10;
    if (c.code && new RegExp('(^|\\s)' + normAr(c.code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(t)) sc += 5;
    if (sc > score) { score = sc; best = c; }
  }
  return best;
}
// يحذف اسم المشروع من البيان حتى لا يتكرر
function stripProject(desc, c) {
  if (!c) return desc;
  const key = w => normAr(w).replace(/^(وال|بال|لل|ال)/, '');
  const pw = new Set(String(c.name).split(/[\s/،,\-]+/).map(key).filter(w => w.length > 2 && !GENERIC.has(w)));
  const toks = String(desc).split(/\s+/).filter(Boolean).filter(w => !pw.has(key(w)) && !pw.has(normAr(w).replace(/^[بل]/, '')));
  while (toks.length && /^(مشروع|موقع|في|على|لل?)$/.test(normAr(toks[toks.length - 1]))) toks.pop();
  return toks.join(' ');
}
// العهدة التي يُسجَّل عليها: المفتوحة الوحيدة، وإلا الأحدث التي فيها رصيد
async function pickCustody() {
  const cs = await api('GET', '/api/custodies?status=open');
  if (!cs.length) return null;
  return cs.slice().sort((a, b) => (b.balance > 0) - (a.balance > 0) || String(b.createdAt).localeCompare(String(a.createdAt)))[0];
}
async function noCustody() {
  if (S.user.directCustody) { toast('سجّل العهدة التي استلمتها أولاً'); return quickReceive(); }
  return modal(`<h3>لا توجد عهدة معك</h3><p class="muted">اطلب عهدة من الإدارة أولاً.</p><div class="sheet-foot"><button class="btn ghost" data-close>إغلاق</button><button class="btn primary" id="nx">طلب عهدة</button></div>`, { onMount: (el, close) => { $('#nx', el).onclick = () => { close(); requestForm(); }; } });
}
// حفظ مصروف سريع؛ يطلب المشروع مرة واحدة فقط إذا لم يكن للعهدة مشروع
async function saveQuick({ amount, cat, desc, attachments = [], project }) {
  const c = await pickCustody();
  if (!c) return noCustody();
  const ccId = project?.id || curProject()?.id || c.costCenterId || null;
  const body = { custodyId: c.id, amount, categoryId: cat.id, description: desc || cat.name, attachments, date: today(), ...(ccId ? { costCenterId: ccId } : {}) };
  const over = num2(Number(amount) - Math.max(0, c.balance));
  const done = async b => {
    const e = await api('POST', '/api/expenses', b); markUsed(cat.id);
    toast(over > 0 ? `✓ تم: ${e.description} ${fmt(e.amount)} — دفعت ${fmt(over)} من جيبك، تُعوَّض من العهدة القادمة` : `✓ تم: ${e.description} ${fmt(e.amount)}`);
    router(); return e;
  };
  if (ccId) return done(body);
  formSheet({
    title: 'على أي مشروع؟', submit: 'حفظ',
    fields: [{ type: 'chips', name: 'costCenterId', label: 'المشروع', required: true, value: '', options: projects().map(p => ({ value: p.id, label: (p.code ? p.code + ' · ' : '') + p.name })) }],
    onSubmit: async (d, close) => { if (!d.costCenterId) throw new Error('اختر المشروع'); setProject(d.costCenterId); await done({ ...body, costCenterId: d.costCenterId }); close(); },
  });
}
function bindQuickLine() {
  const form = $('#q-line');
  if (!form) return;
  const input = form.q, hint = $('#q-hint');
  const base = hint.textContent;
  input.addEventListener('input', () => {
    const p = parseLine(input.value);
    if (!p) { hint.textContent = input.value.trim() ? 'اكتب المبلغ أيضاً' : base; return; }
    if (p.receive && S.user.directCustody) { hint.innerHTML = `استلام عهدة: <b class="num">${fmt(p.amount)}</b>`; return; }
    const c = guessCat(p.desc) || otherCat();
    const pr = guessProject(p.desc) || curProject();
    hint.innerHTML = `${catEmoji(c.name)} ${esc(c.name)} · <b class="num">${fmt(p.amount)}</b> · ${pr ? '🏗️ ' + esc(pr.name) : '<span class="warn-t">اختر المشروع من الأسفل</span>'}`;
  });
  form.onsubmit = async ev => {
    ev.preventDefault();
    const p = parseLine(input.value);
    if (!p || !(p.amount > 0)) { toast('اكتب النوع والمبلغ، مثل: اكل 300', true); return input.focus(); }
    const b = $('button', form); b.disabled = true;
    try {
      if (p.receive && S.user.directCustody) return await quickReceive(p.amount);
      const project = guessProject(p.desc);
      const desc = stripProject(p.desc, project);
      const cat = guessCat(desc) || otherCat();
      await saveQuick({ amount: p.amount, cat, desc: desc || cat.name, project });
    } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
  };
}
// بلاطة بند: المبلغ فقط (والصورة اختيارية)
function quickCatForm(cat) {
  formSheet({
    title: `${catEmoji(cat.name)} ${esc(cat.name)}`, submit: 'حفظ',
    intro: curProject() ? `<p class="muted">🏗️ على مشروع: <b>${esc(curProject().name)}</b></p>` : '',
    fields: [{ type: 'money', name: 'amount', label: 'المبلغ', required: true }, { name: 'description', label: 'ملاحظة (اختياري)', full: true, placeholder: cat.name }, { type: 'files', name: 'attachments', label: '', button: 'صورة الفاتورة (اختياري)' }],
    onMount: (_el, _c, form) => setTimeout(() => form.amount.focus(), 200),
    onSubmit: async (d, close) => { close(); await saveQuick({ amount: d.amount, cat, desc: d.description.trim() || cat.name, attachments: d.attachments }); },
  });
}
// صورة + مبلغ فقط؛ النوع «متنوعة» والمحاسب يصحّحه عند الاعتماد
function quickPhoto() {
  formSheet({
    title: '📷 صوّر الفاتورة', submit: 'حفظ',
    intro: curProject() ? `<p class="muted">🏗️ على مشروع: <b>${esc(curProject().name)}</b></p>` : '',
    fields: [{ type: 'files', name: 'attachments', label: '', button: 'افتح الكاميرا' }, { type: 'money', name: 'amount', label: 'المبلغ', required: true }],
    onMount: el => { const inp = $('[data-files] input[type=file]', el); inp.setAttribute('capture', 'environment'); inp.removeAttribute('multiple'); setTimeout(() => inp.click(), 150); },
    onSubmit: async (d, close) => {
      if (!d.attachments.length) throw new Error('صوّر الفاتورة أولاً');
      close(); await saveQuick({ amount: d.amount, cat: otherCat(), desc: 'فاتورة مصورة — يحددها المحاسب', attachments: d.attachments });
    },
  });
}
// استلمت عهدة: المبلغ فقط (والمشروع إن لزم) — المصدر «المالك» والتاريخ اليوم تلقائياً
function quickReceive(amount) {
  const ownerSrc = S.b.fundSources.find(x => x.active !== false && x.type === 'owner') || S.b.fundSources.find(x => x.active !== false);
  const last = store.get('q_cc');
  const ccs = ccOptions();
  formSheet({
    title: '💰 استلمت عهدة', submit: 'تسجيل',
    intro: `<p class="muted">من: <b>${esc(ownerSrc?.name || '—')}</b> · اليوم</p>`,
    fields: [{ type: 'money', name: 'amount', label: 'المبلغ المستلم', required: true, value: amount || '' },
      ...(ccs.length ? [{ type: 'chips', name: 'costCenterId', label: 'لأي مشروع؟', value: ccs.some(o => o.value === last) ? last : ccs.length === 1 ? ccs[0].value : '', options: projects().map(p => ({ value: p.id, label: (p.code ? p.code + ' · ' : '') + p.name })) }] : [])],
    onMount: (_el, _c, form) => setTimeout(() => form.amount.focus(), 200),
    onSubmit: async (d, close) => {
      if (ccs.length && !d.costCenterId) throw new Error('اختر المشروع');
      if (d.costCenterId) setProject(d.costCenterId);
      const proj = d.costCenterId ? ccName(d.costCenterId) : '';
      const r = await api('POST', '/api/requests', { type: 'cash', alreadyPaid: true, amount: d.amount, sourceId: ownerSrc?.id, costCenterId: d.costCenterId || null, purpose: 'عهدة مستلمة' + (proj && proj !== '—' ? ' — ' + proj : ''), issueDate: today(), method: 'نقداً' });
      const cov = r.custodyId ? (await api('GET', '/api/custodies/' + r.custodyId).catch(() => ({ custody: {} }))).custody.coveredDeficit : 0;
      close(); toast(cov ? `✓ تم تسجيل استلام ${fmt(d.amount)} — خُصم منها ${fmt(cov)} عوضاً عما دفعته من جيبك` : `✓ تم تسجيل استلام ${fmt(d.amount)}`); router();
    },
  });
}
ACT['q-cat'] = el => quickCatForm(S.b.categories.find(c => c.id === el.dataset.id));
ACT['q-photo'] = () => quickPhoto();
ACT['q-receive'] = () => quickReceive();

async function returnForm() {
  const cs = await api('GET', '/api/custodies?status=open');
  if (!cs.length) return toast('لا توجد عهدة مفتوحة', true);
  formSheet({
    title: 'رد مبلغ نقدي للإدارة', intro: '<p class="muted">يُسجل الرد بانتظار تأكيد الإدارة لاستلام المبلغ.</p>', submit: 'تسجيل الرد',
    fields: [{ type: 'select', name: 'custodyId', label: 'من عهدة', options: cs.map(c => ({ value: c.id, label: `${c.no} — ${c.purpose} (رصيد ${fmt(c.balance)})` })), full: true }, { type: 'money', name: 'amount', label: 'المبلغ المردود', required: true }, { type: 'select', name: 'method', label: 'الطريقة', options: PAY_METHODS }, { name: 'note', label: 'ملاحظة' }],
    onSubmit: async (d, close) => { await api('POST', `/api/custodies/${d.custodyId}/tx`, { ...d, type: 'return' }); close(); toast('تم التسجيل — بانتظار التأكيد'); router(); },
  });
}
function requestForm(direct = false) {
  const canDirect = !!S.user.directCustody;
  const ownerSrc = S.b.fundSources.find(x => x.active !== false && x.type === 'owner');
  formSheet({
    title: direct ? 'تسجيل عهدة مستلمة (تعميد مباشر)' : 'طلب عهدة', submit: direct ? 'تسجيل العهدة' : 'إرسال الطلب',
    fields: [
      ...(canDirect ? [{ type: 'toggle', name: 'alreadyPaid', label: 'تم صرف العهدة لي بالفعل (تعميد مباشر من المالك)', value: direct }] : []),
      { type: 'chips', name: 'type', label: 'نوع الطلب', value: 'cash', options: [{ value: 'cash', label: 'عهدة نقدية' }, { value: 'asset', label: 'عهدة عينية (جهاز / معدة)' }] },
      { type: 'money', name: 'amount', label: 'المبلغ المطلوب (للنقدية)' },
      ...(canDirect ? [srcField('استلمت المبلغ من', ownerSrc?.id), { type: 'date', name: 'issueDate', label: 'تاريخ الاستلام', value: today() }, { type: 'select', name: 'method', label: 'طريقة الاستلام', options: PAY_METHODS }] : []),
      { name: 'purpose', label: 'الغرض / الوصف', required: true, full: true },
      { type: 'select', name: 'costCenterId', label: 'مركز التكلفة', options: ccOptions(), empty: '— اختر —', full: true },
      { type: 'date', name: 'neededBy', label: 'مطلوب قبل تاريخ' },
    ],
    onMount: (el, _close, form) => {
      if (!canDirect) return;
      const box = name => form.querySelector(`[name="${name}"]`).closest('.field');
      const sync = () => {
        const on = form.alreadyPaid.checked;
        ['sourceId', 'issueDate', 'method'].forEach(n => { box(n).hidden = !on; });
        box('type').hidden = on; box('neededBy').hidden = on;
        $('[name=amount]', form).closest('.field').querySelector('label').firstChild.textContent = on ? 'المبلغ المستلم' : 'المبلغ المطلوب (للنقدية)';
        $('[type=submit]', form).textContent = on ? 'تسجيل العهدة' : 'إرسال الطلب';
      };
      form.alreadyPaid.addEventListener('change', sync); sync();
    },
    onSubmit: async (d, close) => {
      if (d.alreadyPaid) {
        const r = await api('POST', '/api/requests', { ...d, type: 'cash' });
        close(); toast('تم تسجيل العهدة وإبلاغ الإدارة'); go('#/custody/' + r.custodyId);
        return;
      }
      await api('POST', '/api/requests', d); close(); toast('تم إرسال الطلب للإدارة'); go('#/requests');
    },
  });
}

// اختصارات النماذج من الأزرار
ACT['q-custodyForm'] = () => custodyForm();
ACT['q-expenseForm'] = () => expenseForm();
ACT['q-assetForm'] = () => assetForm();
ACT['q-userForm'] = () => userForm();
ACT['q-ccForm'] = () => ccForm();
ACT['q-returnForm'] = () => returnForm();
ACT['q-requestForm'] = () => requestForm();
ACT['q-directForm'] = () => requestForm(true);

// ================= تنبيه «هل صرفت شيئاً؟» =================
let timers = [];
function stopTimers() { timers.forEach(clearInterval); timers = []; NATIVE?.stopReminders(); }
const remindersOn = () => S.user && S.user.role === 'employee' && S.b.settings.remindersEnabled !== false;
function startTimers() {
  stopTimers();
  if (remindersOn()) {
    const s = S.b.settings;
    if (NATIVE) NATIVE.startReminders(JSON.stringify({ token: S.token, workStart: s.workStart, workEnd: s.workEnd, workDays: s.workDays, minutes: s.reminderMinutes, local: MODE !== 'server' }));
    else {
      if (!store.get(remKey())) resetReminderClock();
      timers.push(setInterval(reminderTick, 20000));
      navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'reminder-action') handleReminderAction(e.data.answer); });
    }
  }
  // تحديث العدادات دورياً
  timers.push(setInterval(async () => {
    if (!S.user || $('.modal-back')) return;
    try {
      const b = await api('GET', '/api/bootstrap');
      S.unread = b.unread; updateBadges();
      if (isStaff() && ['dashboard', ''].includes(parseHash().page)) router();
    } catch { }
  }, 60000));
}
const remKey = () => 'last_reminder_' + S.user.id;
const resetReminderClock = () => { if (!S.user) return; store.set(remKey(), String(Date.now())); NATIVE?.snooze(); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function inWorkHours(d = new Date()) {
  const s = S.b.settings, m = d.getHours() * 60 + d.getMinutes();
  return s.workDays.includes(d.getDay()) && m >= toMin(s.workStart) && m <= toMin(s.workEnd);
}
function nextReminderText() {
  if (!remindersOn()) return '';
  if (!inWorkHours()) return 'خارج أوقات الدوام — لا توجد تنبيهات الآن';
  if (NATIVE) return `🔔 يصلك تنبيه كل ${S.b.settings.reminderMinutes} دقيقة خلال الدوام`;
  const last = Number(store.get(remKey())) || Date.now();
  const t = new Date(Math.max(Date.now(), last + S.b.settings.reminderMinutes * 6e4));
  return `🔔 التنبيه القادم: ${t.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`;
}
function reminderTick() {
  if (!S.user || !inWorkHours()) return;
  if (Date.now() - (Number(store.get(remKey())) || 0) >= S.b.settings.reminderMinutes * 6e4) showReminder();
}
async function showReminder(test = false) {
  resetReminderClock();
  if ($('#reminder')) return;
  beep();
  navigator.vibrate?.([300, 150, 300]);
  if (!NATIVE && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const o = { body: 'هل صرفت شيئاً من العهدة؟ ولأي مشروع؟', icon: '/logo.png', tag: 'custody-reminder', renotify: true, requireInteraction: true, dir: 'rtl', lang: 'ar', actions: [{ action: 'yes', title: 'نعم، سأسجل' }, { action: 'no', title: 'لا، لم أصرف' }] };
      if (reg) reg.showNotification('🔔 تذكير العهدة', o); else new Notification('🔔 تذكير العهدة', o);
    } catch { }
  }
  modal(`<div class="reminder-box" id="reminder"><div class="bell-big">🔔</div><div class="q-big">هل صرفت شيئاً من العهدة؟</div><div class="muted">خلال آخر ${S.b.settings.reminderMinutes} دقيقة${test ? ' (تنبيه تجريبي)' : ''}</div>
    <div class="yesno"><button class="btn primary lg" id="r-yes">نعم، صرفت</button><button class="btn ghost lg" id="r-no">لا، لم أصرف</button></div></div>`, {
    onMount: (el, close) => {
      $('#r-yes', el).onclick = () => { close(); expenseForm({ viaReminder: true }); };
      $('#r-no', el).onclick = async () => { close(); await api('POST', '/api/checkins', { answer: 'no' }).catch(() => { }); toast('شكراً، سنذكرك لاحقاً'); };
    },
  });
}
function handleReminderAction(answer) {
  $('#reminder')?.closest('.modal-back')?.remove();
  if (answer === 'no') { api('POST', '/api/checkins', { answer: 'no' }).catch(() => { }); toast('شكراً، سنذكرك لاحقاً'); } else if (answer === 'yes') expenseForm({ viaReminder: true }); else showReminder();
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { }
}
function notifStatus() {
  if (NATIVE) return NATIVE.notificationsEnabled() ? '<div class="notice ok">✓ الإشعارات مفعّلة وتصلك حتى والتطبيق مغلق</div>' : notifNotice();
  if (!('Notification' in window)) return '<div class="notice">التنبيهات تظهر داخل التطبيق فقط</div>';
  return Notification.permission === 'granted' ? '<div class="notice ok">✓ الإشعارات مفعّلة</div>' : notifNotice();
}
function notifNotice() {
  if (!remindersOn()) return '';
  const granted = NATIVE ? NATIVE.notificationsEnabled() : !('Notification' in window) || Notification.permission === 'granted';
  return granted ? '' : `<div class="notice">${ic('bell', 18)} اسمح بالإشعارات ليصلك تذكير كل نصف ساعة <button class="btn sm primary" data-act="enable-notif">السماح</button></div>`;
}
ACT['enable-notif'] = async () => {
  if (NATIVE) { NATIVE.requestNotifications(); setTimeout(router, 4000); return; }
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'تم تفعيل الإشعارات' : 'لم يتم السماح بالإشعارات', p !== 'granted');
  router();
};

// ================= الرسوم البيانية =================
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthName = ym => MONTHS_AR[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const pct = (v, t) => t ? Math.round(v / t * 100) : 0;
// أعمدة رأسية لسلسلة واحدة (الصرف الشهري): قيمة على أعلى عمود وآخر عمود فقط، والباقي في التلميح
function monthChart(monthly) {
  const max = Math.max(...monthly.map(m => m.spent), 0);
  if (!max) return empty('لا توجد مصروفات بعد');
  const top = monthly.findIndex(m => m.spent === max), last = monthly.length - 1;
  return `<div class="vchart" role="img" aria-label="الصرف الشهري">
    <div class="vc-plot">${monthly.map((m, i) => `<div class="vc-col" data-tip="${esc(monthName(m.month))}: ${fmt(m.spent)} ${cur()} — ${m.count} مصروف">
      <span class="vc-val">${i === top || i === last ? fmt(m.spent) : ''}</span><div class="vc-bar" style="height:${m.spent ? Math.max(2, m.spent / max * 100) : 0}%"></div></div>`).join('')}</div>
    <div class="vc-x">${monthly.map(m => `<span>${MONTHS_AR[+m.month.slice(5, 7) - 1]}</span>`).join('')}</div>
  </div>`;
}
// أشرطة أفقية مرتبة تنازلياً، اختيارياً مع الميزانية؛ ما زاد عن limit يُجمع في «أخرى»
function hbarChart(list, { limit, budget } = {}) {
  if (!list.length) return empty('لا توجد بيانات في هذه الفترة');
  let rows = list;
  if (limit && list.length > limit) rows = [...list.slice(0, limit - 1), { name: 'أخرى', total: list.slice(limit - 1).reduce((s, r) => s + r.total, 0), other: list.length - limit + 1 }];
  const max = Math.max(...rows.map(r => Math.max(r.total, budget ? r.budget || 0 : 0)), 1);
  const sum = list.reduce((s, r) => s + r.total, 0);
  return `<div class="hchart">${rows.map(r => {
    const over = budget && r.budget && r.total > r.budget;
    return `<div class="hc-row" data-tip="${esc(r.name)}: ${fmt(r.total)} ${cur()}${budget && r.budget ? ` من ميزانية ${fmt(r.budget)} (${pct(r.total, r.budget)}%)` : ` — ${pct(r.total, sum)}% من الإجمالي`}${r.other ? ` — ${r.other} بنود` : ''}">
      <div class="hc-name">${esc(r.name)}</div>
      <div class="hc-track">${budget && r.budget ? `<i class="hc-budget" style="inset-inline-start:${r.budget / max * 100}%"></i>` : ''}<div class="hc-bar ${over ? 'over' : ''}" style="width:${Math.max(1, r.total / max * 100)}%"></div></div>
      <div class="hc-val"><b class="num">${fmt(r.total)}</b><small>${budget && r.budget ? pct(r.total, r.budget) + '% من الميزانية' : pct(r.total, sum) + '%'}</small></div></div>`;
  }).join('')}</div>`;
}
// حالة المصروفات: شريط مكدس بألوان الحالة مع وسيلة إيضاح مكتوبة
function statusChart(st) {
  const parts = [['approved', 'معتمد', 'ok'], ['pending', 'بانتظار الاعتماد', 'warn'], ['rejected', 'مرفوض', 'bad']];
  const total = parts.reduce((s, [k]) => s + st[k], 0);
  if (!total) return empty('لا توجد مصروفات في هذه الفترة');
  return `<div class="stack">${parts.filter(([k]) => st[k]).map(([k, l, t]) => `<span class="st-${t}" style="flex:${st[k]}" data-tip="${l}: ${fmt(st[k])} ${cur()} (${pct(st[k], total)}%)"></span>`).join('')}</div>
    <div class="legend">${parts.map(([k, l, t]) => `<span><i class="st-${t}"></i>${l} <b class="num">${fmt(st[k])}</b> <small>${pct(st[k], total)}%</small></span>`).join('')}</div>`;
}
// تلميح الرسوم: يظهر عند المرور بالفأرة أو اللمس
(function () {
  const tip = document.createElement('div');
  tip.id = 'chart-tip';
  document.body.appendChild(tip);
  const show = (el, x, y) => {
    tip.textContent = el.dataset.tip; tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    tip.style.top = Math.max(8, y - r.height - 14) + 'px';
  };
  document.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else tip.style.display = 'none'; });
  document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else tip.style.display = 'none'; });
  addEventListener('scroll', () => { tip.style.display = 'none'; }, { passive: true });
})();

// ================= التحليلات =================
const PERIODS = [['month', 'هذا الشهر'], ['3m', 'آخر 3 أشهر'], ['year', 'هذه السنة'], ['all', 'كل الفترات']];
function periodRange(p) {
  const t = today(), [y, m] = t.split('-').map(Number);
  if (p === 'month') return { from: t.slice(0, 8) + '01' };
  if (p === '3m') { const d = new Date(Date.UTC(y, m - 3, 1)); return { from: d.toISOString().slice(0, 10) }; }
  if (p === 'year') return { from: y + '-01-01' };
  return {};
}
// المالك: خلاصة بجمل واضحة ورسوم قليلة؛ المدير: كل التفاصيل مع روابط التقارير العميقة
async function analyticsView(_, q) {
  const simple = isOwner();
  const p = q.p || (q.from || q.to ? '' : simple ? 'month' : 'all');
  const range = p ? periodRange(p) : { from: q.from, to: q.to };
  const a = await api('GET', '/api/analytics?' + qsOf(range));
  const t = a.totals;
  const chips = `<div class="tabs period-tabs">${PERIODS.map(([k, l]) => `<a href="#/${simple ? 'insights' : 'analytics'}?p=${k}" class="${p === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  const label = (PERIODS.find(x => x[0] === p) || [, `${range.from || 'البداية'} — ${range.to || 'اليوم'}`])[1];
  const cat1 = a.byCategory[0], cc1 = a.byCostCenter[0], emp1 = a.byEmployee[0];
  const facts = [
    [ic('receipt', 18), `صُرف <b>${money(t.spent)}</b> على <b class="num">${t.count}</b> مصروف${t.count ? ` — متوسط المصروف ${money(t.avg)}` : ''}`],
    cat1 && [ic('tag', 18), `أكثر نوع صرفاً: <b>${esc(cat1.name)}</b> بنسبة <b class="num">${pct(cat1.total, t.spent)}%</b>`],
    cc1 && [ic('layers', 18), `أكثر مشروع صرفاً: <b>${esc(cc1.name)}</b> ${money(cc1.total)}${cc1.budget ? ` (<span class="num">${pct(cc1.total, cc1.budget)}%</span> من ميزانيته)` : ''}`],
    emp1 && [ic('user', 18), `أكثر موظف صرفاً: <b>${esc(emp1.name)}</b> ${money(emp1.total)}`],
    [ic('wallet', 18), `المبالغ عند الموظفين الآن: <b>${money(t.outstanding)}</b>`],
    a.status.pending && [ic('clock', 18), `<a href="#/expenses?status=pending">بانتظار الاعتماد: <b>${money(a.status.pending)}</b> — اضغط للاعتماد</a>`],
  ].filter(Boolean);
  view(simple ? 'التقارير' : 'التحليلات', `
    ${chips}
    ${simple ? '' : `<form class="period" id="af">${fieldHtml({ type: 'date', name: 'from', label: 'من تاريخ', value: range.from })}${fieldHtml({ type: 'date', name: 'to', label: 'إلى تاريخ', value: range.to })}<button class="btn sm primary">عرض</button></form>`}
    ${card(`الخلاصة — ${esc(label)}`, `<div class="facts">${facts.map(([i, h]) => `<div>${i}<span>${h}</span></div>`).join('')}</div>`)}
    <div class="mini-kpis">
      ${kpi('المصروفات', money(t.spent), { sub: `<span class="num">${t.count}</span> مصروف` })}
      ${kpi('صُرف كعهد', money(t.issued), { sub: 'صرف وتعزيز وفروقات' })}
      ${kpi('عند الموظفين', money(t.outstanding), { sub: 'العهد المفتوحة الآن' })}
      ${simple ? '' : kpi('ضريبة المدخلات', money(t.vat), { sub: 'في المصروفات', go: '#/report/vat' })}
    </div>
    ${card('الصرف آخر 12 شهراً', monthChart(a.monthly))}
    ${card('حالة المصروفات', statusChart(a.status))}
    <div class="grid2">
      ${card('أين ذهبت الأموال (حسب النوع)', hbarChart(a.byCategory, { limit: simple ? 6 : 0 }), simple ? '' : btn('تقرير البنود', { href: '#/report/categories', cls: 'sm ghost' }))}
      ${card('المشاريع مقابل الميزانية', hbarChart(a.byCostCenter, { budget: true, limit: simple ? 6 : 0 }), simple ? '' : btn('تقرير المشاريع', { href: '#/report/cost-centers', cls: 'sm ghost' }))}
    </div>
    <div class="grid2">
      ${card('الصرف حسب الموظف', hbarChart(a.byEmployee, { limit: simple ? 6 : 0 }), simple ? '' : btn('نشاط الموظفين', { href: '#/report/employee-activity', cls: 'sm ghost' }))}
      ${card('مصادر الأموال', a.bySource.length ? `<div class="list">${a.bySource.map(r => `<div class="item"><div class="item-ic">${ic('bank', 18)}</div><div class="item-main"><div class="item-title">${esc(r.name)}</div><div class="item-sub">صُرف ${fmt(r.out)} · رُدّ ${fmt(r.back)}</div></div><div class="item-end">${money(r.net)}<div class="item-endsub">لدى الموظفين</div></div></div>`).join('')}</div>` : empty('لا توجد حركات'), simple ? '' : btn('حركة الأموال', { href: '#/report/source-ledger', cls: 'sm ghost' }))}
    </div>
    ${simple ? `<div class="s-links"><a href="#/reports">${ic('list', 18)}كل التقارير التفصيلية</a></div>` : card('تقارير عميقة', `<div class="report-grid">${['monthly', 'employee-activity', 'balances', 'aging', 'statement', 'settlements'].map(k => REPORTS.find(r => r[0] === k)).map(([k, i, tt, ss]) => `<a class="report-card" href="#/report/${k}"><div class="item-ic">${ic(i)}</div><div><div class="item-title">${tt}</div><div class="item-sub">${ss}</div></div></a>`).join('')}</div>`)}
  `);
  const f = $('#af');
  if (f) f.onsubmit = e => { e.preventDefault(); const d = readForm(f); go('#/analytics?' + qsOf({ from: d.from, to: d.to })); };
}
STAFF_VIEWS.analytics = analyticsView;

// ================= واجهة المالك =================
async function ownerHome() {
  const [d, a] = await Promise.all([api('GET', '/api/dashboard'), api('GET', '/api/analytics?' + qsOf(periodRange('month')))]);
  S.pendingCount = d.kpis.pendingCount; S.requestsCount = d.alerts.requests; updateBadges();
  const pend = d.kpis.pendingCount;
  view('الرئيسية', `
    <div class="s-bal">
      <div class="s-hi">مرحباً ${esc(S.user.name.split(' ')[0])} 👋</div>
      <div class="s-label">المبالغ عند الموظفين الآن</div>
      <div class="s-value">${money(d.kpis.outstanding)}</div>
      <div class="s-sub">صُرف هذا الشهر <span class="num">${fmt(a.totals.spent)}</span> على <span class="num">${a.totals.count}</span> مصروف</div>
    </div>
    ${pend ? `<a class="s-btn main" href="#/expenses?status=pending">${ic('check', 28)}<span>اعتمد المصروفات<small>${pend} مصروف بانتظارك بقيمة ${fmt(d.kpis.pendingAmount)}</small></span><b class="s-count num">${pend}</b></a>` : ''}
    <button class="s-btn ${pend ? '' : 'main'}" data-act="q-custodyForm">${ic('wallet', 26)}<span>اصرف عهدة لموظف<small>من حسابك أو من الصندوق</small></span></button>
    <a class="s-btn" href="#/insights">${ic('chart', 26)}<span>التقارير<small>أين ذهبت الأموال ومن صرف كم</small></span></a>
    ${d.alerts.requests ? `<a class="notice" href="#/requests">${ic('inbox', 18)} ${d.alerts.requests} طلب عهدة جديد من الموظفين</a>` : ''}
    ${d.alerts.overdue.length ? `<a class="notice bad" href="#/custodies?status=overdue">${ic('clock', 18)} ${d.alerts.overdue.length} عهدة متأخرة عن التسوية</a>` : ''}
    ${card('الصرف آخر 12 شهراً', monthChart(a.monthly))}
    ${card('الموظفون', d.employees.length ? `<div class="s-list">${d.employees.map(u => `<a href="#/user/${u.id}"><div><b>${esc(u.name)}</b><small class="${u.pendingCount ? 'warn-t' : 'muted'}">${u.pendingCount ? u.pendingCount + ' مصروف بانتظار الاعتماد' : u.openCount + ' عهدة مفتوحة'}</small></div>${signed(u.balance)}</a>`).join('')}</div>` : '<p class="muted center">لا يوجد موظفون بعد</p>')}
    ${card('أين ذهبت أموال هذا الشهر', hbarChart(a.byCategory, { limit: 5 }))}
    <div class="s-links"><a href="#/custodies">${ic('wallet', 18)}العهد</a><a href="#/expenses?status=">${ic('receipt', 18)}المصروفات</a><a href="#/users">${ic('users', 18)}الموظفون</a><a href="#/settings">${ic('settings', 18)}الإعدادات</a></div>
  `);
}
const OWNER_VIEWS = { ...STAFF_VIEWS, dashboard: ownerHome, insights: analyticsView };
