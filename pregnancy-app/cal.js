/* نبضٌ صغير — التقويم الميلادي والهجري (أم القرى) وعجلة اختيار التاريخ
   التحويل من الهجري إلى الميلادي عبر جدول يُبنى من Intl للفترة 1440–1460 هـ (نفس تقويم أم القرى الرسمي). */
'use strict';

const Cal = (() => {
  const H_FROM = 1440, H_TO = 1460;
  const G_OPTS = { day: 'numeric', month: 'long', year: 'numeric' };
  let num = null, ok = false;
  try {
    num = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    ok = num.resolvedOptions().calendar === 'islamic-umalqura';
  } catch { ok = false; }

  const MONTHS_H = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const gName = new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long' });
  const MONTHS_G = Array.from({ length: 12 }, (_, i) => gName.format(new Date(2026, i, 1)));

  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // التاريخ الهجري لأي يوم ميلادي {y, m, d}
  function parts(date) {
    const o = {};
    num.formatToParts(date).forEach(p => { if (p.type === 'year' || p.type === 'month' || p.type === 'day') o[p.type[0]] = +p.value; });
    return { y: o.y, m: o.m, d: o.d };
  }

  // جدول بداية كل شهر هجري بالميلادي: starts[(y - H_FROM) * 12 + (m - 1)]
  let starts = null;
  function table() {
    if (starts) return starts;
    starts = [];
    let d = new Date(2018, 7, 20), p = parts(d);
    while (!(p.y === H_FROM && p.m === 1 && p.d === 1)) { d = plus(d, 1); p = parts(d); }
    starts.push(d);
    for (let i = 1; i <= (H_TO - H_FROM + 1) * 12; i++) {
      let g = plus(starts[i - 1], 29);
      for (let k = 0; k < 3 && parts(g).d !== 1; k++) g = plus(g, 1);
      starts.push(g);
    }
    return starts;
  }
  const idx = (y, m) => (y - H_FROM) * 12 + (m - 1);
  const inRange = y => y >= H_FROM && y <= H_TO;
  const monthLen = (y, m) => { const t = table(), i = idx(y, m); return Math.round((t[i + 1] - t[i]) / 864e5); };
  // هجري ← ميلادي (يرجع null خارج الفترة أو لتاريخ غير موجود)
  function toGreg(y, m, d) {
    if (!inRange(y) || m < 1 || m > 12 || d < 1 || d > monthLen(y, m)) return null;
    return plus(table()[idx(y, m)], d - 1);
  }

  const mode = () => ok && (typeof S !== 'undefined') && (S.calendar || (S.country === 'SA' ? 'hijri' : 'gregorian')) === 'hijri' ? 'hijri' : 'gregorian';
  const mk = (cal, opts) => { try { return new Intl.DateTimeFormat(cal === 'hijri' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'ar-u-nu-latn', opts); } catch { return new Intl.DateTimeFormat('ar', opts); } };
  // منسّق يتبع إعداد التقويم لحظة العرض
  function fmt(opts) {
    const g = mk('gregorian', opts), h = ok ? mk('hijri', opts) : g;
    return { format: d => (mode() === 'hijri' ? h : g).format(d) };
  }
  const gFull = mk('gregorian', G_OPTS), hFull = ok ? mk('hijri', G_OPTS) : null;
  const greg = d => `${gFull.format(d)} م`;
  const hijri = d => hFull ? hFull.format(d) : '';
  // التقويمان معاً، والمختار أولاً: «25 جمادى الآخرة 1448 هـ – 5 ديسمبر 2026 م»
  const both = d => !hFull ? greg(d) : mode() === 'hijri' ? `${hijri(d)} – ${greg(d)}` : `${greg(d)} – ${hijri(d)}`;

  return { ok, H_FROM, H_TO, MONTHS_H, MONTHS_G, parts: d => ok ? parts(d) : null, table, monthLen, toGreg, mode, fmt, greg, hijri, both, iso, day0 };
})();

/* ---------- عجلة تمرير (بدون مكتبات): أعمدة تثبت على العنصر الأوسط ---------- */
const Wheel = (() => {
  const H = 40; // ارتفاع العنصر
  function column(onPick) {
    const el = document.createElement('div');
    el.className = 'wheel-col'; el.tabIndex = 0; el.setAttribute('role', 'listbox');
    let items = [], cur = 0, t = null, silent = false;
    const mark = () => [...el.children].forEach((c, i) => { c.classList.toggle('on', i === cur); c.setAttribute('aria-selected', i === cur); });
    const settle = () => {
      if (silent) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / H)));
      if (i !== cur) { cur = i; mark(); onPick(items[i][0]); }
    };
    el.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(settle, 110); }, { passive: true });
    el.addEventListener('keydown', e => {
      const k = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (k) { e.preventDefault(); api.scrollTo(cur + k, true); }
    });
    el.addEventListener('click', e => { const it = e.target.closest('.wheel-item'); if (it) api.scrollTo(+it.dataset.i, true); });
    const api = {
      el,
      fill(list, value) {
        items = list;
        el.innerHTML = list.map(([, label], i) => `<div class="wheel-item" role="option" data-i="${i}">${label}</div>`).join('');
        api.select(value);
      },
      select(value) {
        const i = Math.max(0, items.findIndex(x => x[0] === value));
        cur = i; mark(); silent = true; el.scrollTop = i * H;
        requestAnimationFrame(() => { el.scrollTop = i * H; setTimeout(() => { silent = false; }, 60); });
      },
      scrollTo(i, smooth) { i = Math.max(0, Math.min(items.length - 1, i)); el.scrollTo({ top: i * H, behavior: smooth ? 'smooth' : 'instant' }); },
      value: () => items[cur] && items[cur][0]
    };
    return api;
  }
  return { column, H };
})();

/* عجلة تاريخ (يوم / شهر / سنة) بالتقويم المختار؛ القيمة الداخلية دائماً تاريخ ميلادي ISO
   opts: { cal: 'hijri'|'gregorian', value, min, max (ISO), onChange(iso) } */
function datePicker(host, opts) {
  const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const H = opts.cal === 'hijri' && Cal.ok;
  const min = parseIso(opts.min), max = parseIso(opts.max);
  let date = parseIso(opts.value);
  if (date < min) date = min; if (date > max) date = max;
  const toP = d => H ? Cal.parts(d) : { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  const fromP = p => H ? Cal.toGreg(p.y, p.m, p.d) : new Date(p.y, p.m - 1, p.d);
  const len = (y, m) => H ? Cal.monthLen(y, m) : new Date(y, m, 0).getDate();
  const pMin = toP(min), pMax = toP(max);
  host.innerHTML = '';
  host.classList.add('wheel');
  const p = toP(date);
  const pick = () => {
    const y = cy.value(), m = cm.value(), n = len(y, m);
    let d = Math.min(cd.value(), n);
    let g = fromP({ y, m, d });
    const clamped = g < min ? min : g > max ? max : g;
    const q = toP(clamped);
    if (cd.el.children.length !== len(q.y, q.m)) cd.fill(days(q.y, q.m), q.d);
    if (+clamped !== +g) { cy.select(q.y); cm.select(q.m); cd.select(q.d); }
    date = clamped; opts.onChange && opts.onChange(Cal.iso(date));
  };
  const days = (y, m) => Array.from({ length: len(y, m) }, (_, i) => [i + 1, String(i + 1)]);
  const cd = Wheel.column(pick), cm = Wheel.column(pick), cy = Wheel.column(pick);
  cd.el.setAttribute('aria-label', 'اليوم'); cm.el.setAttribute('aria-label', 'الشهر'); cy.el.setAttribute('aria-label', 'السنة');
  host.append(cd.el, cm.el, cy.el);
  cd.fill(days(p.y, p.m), p.d);
  cm.fill((H ? Cal.MONTHS_H : Cal.MONTHS_G).map((n, i) => [i + 1, n]), p.m);
  const ys = []; for (let y = pMin.y; y <= pMax.y; y++) ys.push([y, H ? `${y} هـ` : `${y}`]);
  cy.fill(ys, p.y);
  const api = {
    value: () => Cal.iso(date),
    // للاختبارات وللتحكم من الكود
    set(isoStr) { date = parseIso(isoStr); const q = toP(date); cy.select(q.y); cm.select(q.m); cd.fill(days(q.y, q.m), q.d); opts.onChange && opts.onChange(Cal.iso(date)); }
  };
  host._picker = api;
  return api;
}
