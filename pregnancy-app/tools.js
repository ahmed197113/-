/* نبضٌ صغير — أدوات الثلث الأخير: عدّاد الركلات، مؤقّت الطلق (5-1-1)، المزاج السريع، وتصدير سجل الأعراض PDF للطبيب */
'use strict';

const KICK_GOAL = 10, KICK_WINDOW = 2 * 3600 * 1000;
const arKicks = n => arCount(n, 'ركلة واحدة', 'ركلتان', 'ركلات', 'ركلة') || '0 ركلات';
const arMins = n => arCount(n, 'دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة') || 'أقل من دقيقة';
const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const clock = t => new Date(t).toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

/* ---------- عدّاد الركلات: جلسة ساعتين وهدف 10 ركلات ---------- */
function kickSave(reason) {
  const k = S._kick; if (!k) return;
  const end = Math.min(Date.now(), k.start + KICK_WINDOW);
  S.kicks.push({ at: k.start, count: k.count, sec: (end - k.start) / 1000, goal: k.count >= KICK_GOAL });
  route.kickDone = { count: k.count, min: Math.round((end - k.start) / 60000), reason };
  delete S._kick; save();
}
// جلسة انتهت ساعتاها والتطبيق مغلق: تُحفظ عند الفتح
function kickExpire() { if (S._kick && Date.now() - S._kick.start >= KICK_WINDOW) kickSave('time'); }

function kickRing(n) {
  const r = 70, C = 2 * Math.PI * r, f = Math.min(1, n / KICK_GOAL);
  return `<svg class="kick-ring" viewBox="0 0 160 160" role="img" aria-label="${arKicks(n)} من ${KICK_GOAL}">
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--track)" stroke-width="12"/>
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--primary)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - f)).toFixed(1)}" transform="rotate(-90 80 80)"/>
    <text x="80" y="82" text-anchor="middle" class="kick-n">${n}</text><text x="80" y="108" text-anchor="middle" class="kick-of">من ${KICK_GOAL}</text></svg>`;
}

Object.assign(SUBVIEWS, {
  kicks() {
    kickExpire();
    const s = S._kick, done = route.kickDone;
    // السجل اليومي: آخر 14 يوماً
    const days = {};
    S.kicks.forEach(k => { const d = iso(new Date(k.at)); (days[d] = days[d] || []).push(k); });
    const rows = Object.keys(days).sort().reverse().slice(0, 14).map(d => {
      const l = days[d], best = l.filter(k => k.goal || k.count >= KICK_GOAL).map(k => k.sec / 60).sort((a, b) => a - b)[0];
      return `<tr><td>${fmtShort.format(parse(d))}</td><td>${l.length}</td><td>${l.reduce((n, k) => n + k.count, 0)}</td><td>${best != null ? arMins(Math.max(1, Math.round(best))) : '<span style="color:var(--warn)">لم يكتمل</span>'}</td></tr>`;
    }).join('');
    return `${done ? `<div class="card result lv-${done.count >= KICK_GOAL ? 'ok' : 'high'}">
        ${done.count >= KICK_GOAL ? `<b>🎉 ${arKicks(done.count)} خلال ${arMins(done.min)}</b><p style="margin:6px 0 0">طفلك نشيط. سُجّلت الجلسة في السجل.</p>`
          : `<b>⚠️ ${arKicks(done.count)} فقط خلال ساعتين</b><p style="margin:6px 0 0">اشربي ماء أو كلي شيئاً واستلقي على جانبك الأيسر وأعيدي العدّ. وإذا بقيت الحركة قليلة، كلّمي طبيبك أو اذهبي للطوارئ اليوم.</p>`}</div>` : ''}
      <div class="card center kick-card">
        ${s ? `${kickRing(s.count)}
          <div class="kick-left">متبقٍ <b id="kickLeft">${hms(s.start + KICK_WINDOW - Date.now())}</b> من الساعتين</div>
          <button class="counter-big" id="kickBtn" aria-label="سجّلي ركلة">👣<small>اضغطي عند كل حركة</small></button>
          <div class="row" style="justify-content:center"><button class="btn ghost" id="kickUndo" ${s.count ? '' : 'disabled'}>تراجع</button><button class="btn" id="kickStop">إنهاء وحفظ</button></div>`
        : `<p class="muted" style="margin-top:0">اختاري وقتاً يكون فيه الجنين نشطاً (بعد الأكل غالباً)، واستلقي على جانبك الأيسر. الهدف: ${KICK_GOAL} حركات خلال ساعتين، وتنتهي الجلسة تلقائياً عند الوصول للهدف.</p>
          <button class="counter-big" id="kickStart" aria-label="ابدئي جلسة عدّ الركلات">▶<small>ابدئي جلسة جديدة</small></button>`}
      </div>
      <div class="card"><h3>السجل اليومي</h3>${rows ? `<table class="t"><tr><th>اليوم</th><th>جلسات</th><th>ركلات</th><th>أسرع ${KICK_GOAL}</th></tr>${rows}</table>` : '<p class="muted">لا توجد جلسات بعد.</p>'}</div>
      <div class="card warn-card"><b>⚠️ راجعي الطبيب</b> إذا لم تشعري بـ${KICK_GOAL} حركات خلال ساعتين، أو لاحظتِ انخفاضاً واضحاً في نشاط الجنين المعتاد. لا تنتظري لليوم التالي.</div>`;
  },

  contractions() {
    const list = S.contractions.slice(-60), now = Date.now();
    const active = list.length && !list[list.length - 1].end;
    const rows = list.map((c, i) => ({ c, dur: c.end ? Math.round((c.end - c.start) / 1000) : null, gap: i ? (c.start - list[i - 1].start) / 60000 : null }));
    const hour = rows.filter(r => r.dur != null && r.gap != null && r.c.start >= now - 3600e3);
    const avg = (a, k) => a.length ? a.reduce((n, r) => n + r[k], 0) / a.length : 0;
    const avgGap = avg(hour, 'gap'), avgDur = avg(hour, 'dur');
    const span = hour.length ? (now - hour[0].c.start) / 60000 : 0;
    const regular = hour.length >= 4 && avgGap <= 5.5 && avgDur >= 50;
    // قاعدة 5-1-1: كل 5 دقائق أو أقل، تستمر دقيقة تقريباً، لمدة ساعة
    const go511 = regular && span >= 55, soon = regular && !go511;
    const last = rows.filter(r => r.dur != null).slice(-1)[0];
    return `${go511 ? `<div class="card lv-danger go-hospital" role="alert"><h2>🏥 توجّهي للمستشفى الآن</h2>
        <p>الانقباضات منتظمة: كل ${avgGap.toFixed(1)} دقيقة تقريباً، ومدة كل واحدة ${Math.round(avgDur)} ثانية، منذ ساعة (قاعدة 5-1-1).</p>
        <a class="btn block" href="tel:${emergencyNo()}">📞 اتصلي بالطوارئ ${emergencyNo()}</a></div>`
      : soon ? `<div class="card warn-card"><b>⏳ الانقباضات بدأت تنتظم</b><p style="margin:6px 0 0">جهّزي حقيبتك وأبلغي من سيرافقك. إذا استمرت هكذا ساعة كاملة توجّهي للمستشفى.</p></div>` : ''}
      <div class="card center">
        <p class="muted" style="margin-top:0">اضغطي عند بداية الانقباض، واضغطي مرة أخرى عند انتهائه.</p>
        <button class="counter-big ${active ? 'live' : ''}" id="ctrBtn">${active ? '<span id="ctrTime">0</span>' : '▶'}<small>${active ? 'انتهى الانقباض' : 'بدأ الانقباض'}</small></button>
        <div class="grid3" style="margin-top:12px"><div class="stat"><b>${last ? last.dur + ' ث' : '—'}</b><small>آخر مدة</small></div>
          <div class="stat"><b>${last && last.gap != null ? last.gap.toFixed(1) + ' د' : '—'}</b><small>آخر فاصل</small></div>
          <div class="stat"><b>${hour.length}</b><small>في آخر ساعة</small></div></div>
        ${hour.length ? `<p class="muted" style="margin:10px 0 0">متوسط آخر ساعة: فاصل ${avgGap.toFixed(1)} د · مدة ${Math.round(avgDur)} ث</p>` : ''}
      </div>
      <div class="card"><h3>السجل</h3>${rows.length ? `<table class="t"><tr><th>الوقت</th><th>المدة</th><th>الفاصل</th></tr>
        ${rows.slice().reverse().slice(0, 20).map(r => `<tr><td>${clock(r.c.start)}</td><td>${r.dur != null ? r.dur + ' ث' : '…'}</td><td>${r.gap != null ? r.gap.toFixed(1) + ' د' : '—'}</td></tr>`).join('')}</table>
        <button class="btn ghost sm" id="ctrClear" style="margin-top:10px">مسح السجل</button>` : '<p class="muted">لا يوجد سجل.</p>'}</div>
      <div class="card"><b>قاعدة 5-1-1:</b> انقباض كل 5 دقائق أو أقل، يستمر دقيقة، لمدة ساعة ← توجّهي للمستشفى. في الحمل الثاني فأكثر قد تحتاجين التوجّه أبكر.</div>
      <div class="card warn-card"><b>⚕️ تنبيه طبي:</b> المؤقّت مؤشر عام وليس تشخيصاً. توجّهي للطوارئ فوراً دون انتظار إذا نزل ماء أو دم، أو قلّت حركة الجنين، أو كان الألم شديداً ومستمراً، أو بدأت الانقباضات قبل الأسبوع 37.</div>`;
  }
});

/* ---------- مفكرة الأعراض والمزاج: إدخال سريع + تصدير PDF ---------- */
const journalBase = SUBVIEWS.journal;
SUBVIEWS.journal = () => `<div class="card row" style="justify-content:space-between"><div><b>📄 تقرير للطبيب</b><div class="muted">سجل المزاج والأعراض والضغط بصيغة PDF</div></div><button class="btn sm" id="jPdf">تصدير PDF</button></div>${journalBase()}`;

// بطاقة «كيف حالك اليوم؟» بلمسة واحدة
function quickMood() {
  const e = S.journal.find(j => j.date === iso(today()));
  return `<div class="card quick-mood"><div class="row" style="justify-content:space-between"><b>كيف حالك اليوم؟</b><button class="link" data-sub="journal">الأعراض والملاحظات ‹</button></div>
    <div class="mood-row" role="group" aria-label="اختاري مزاجك">${MOODS.map(m => `<button class="${e && e.mood === m ? 'on' : ''}" data-qmood="${m}" aria-pressed="${!!(e && e.mood === m)}">${m}</button>`).join('')}</div></div>`;
}

// PDF صغير بدون مكتبات: كل صفحة تُرسم على canvas (العربية تُشكَّل صحيحاً) ثم تُضمَّن كصورة JPEG
function pdfFromJpegs(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body, stream) => { offs[n] = len; push(`${n} 0 obj\n${body}\n`); if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); } push('endobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, ct = pg + 1, im = pg + 2, draw = enc.encode(`q 595 0 0 842 0 0 cm /Im0 Do Q`);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(ct, `<< /Length ${draw.length} >>`, draw);
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>`, p.data);
  });
  const total = 3 + n * 3, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n${Array.from({ length: total - 1 }, (_, i) => `${String(offs[i + 1]).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

async function journalPdf() {
  const W = 1240, H = 1754, M = 80, LH = 44;
  try { await document.fonts.load('400 30px Rubik'); await document.fonts.load('700 30px Rubik'); } catch {}
  const p = S.profile || {}, st = S.baby ? null : status();
  const entries = [...S.journal].sort((a, b) => b.date.localeCompare(a.date));
  const checks = Object.fromEntries((S.checks || []).map(c => [c.date, c]));
  const pages = [];
  let c, g, y;
  const newPage = () => {
    c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = '#2c3048';
    y = M; pages.push(c);
  };
  const text = (t, size = 28, bold = false, color = '#2c3048') => { g.font = `${bold ? 700 : 400} ${size}px Rubik, sans-serif`; g.fillStyle = color; g.fillText(t, W - M, y); };
  const wrap = (t, size, maxW) => { g.font = `400 ${size}px Rubik, sans-serif`; const out = []; let line = ''; for (const w of t.split(/\s+/)) { const tr = line ? line + ' ' + w : w; if (g.measureText(tr).width > maxW && line) { out.push(line); line = w; } else line = tr; } if (line) out.push(line); return out; };
  newPage();
  text('سجل المزاج والأعراض', 44, true, '#c40f63'); y += 56;
  text(`${p.name ? p.name + ' · ' : ''}${st ? `الأسبوع ${st.week} · موعد الولادة: ${Cal.both(st.due)}` : ''}`, 26, false, '#5c6080'); y += 40;
  text(`تاريخ التقرير: ${fmtDate.format(today())} · من تطبيق ${APP_NAME}`, 24, false, '#7c8098'); y += 30;
  g.fillStyle = '#efe3ea'; g.fillRect(M, y, W - 2 * M, 3); y += 50;
  if (!entries.length) text('لا توجد يوميات مسجّلة بعد.', 28);
  for (const e of entries) {
    const wk = st ? Math.floor(diffDays(parse(e.date), st.start) / 7) + 1 : null, ck = checks[e.date];
    const lines = [`${e.mood || '📝'}  ${fmtDate.format(parse(e.date))}${wk > 0 ? ` · الأسبوع ${wk}` : ''}${ck && ck.sys ? ` · الضغط ${ck.sys}/${ck.dia}` : ''}`];
    const body = [...(e.symptoms.length ? wrap('الأعراض: ' + e.symptoms.join('، '), 26, W - 2 * M) : []), ...(e.note ? wrap('ملاحظات: ' + e.note, 26, W - 2 * M) : [])];
    if (y + LH * (1 + body.length) > H - M) newPage();
    text(lines[0], 28, true); y += LH;
    body.forEach(l => { text(l, 26, false, '#3c4060'); y += LH - 6; });
    y += 18; g.fillStyle = '#f3e6ee'; g.fillRect(M, y - 22, W - 2 * M, 2);
  }
  pages.forEach((pc, i) => { const x = pc.getContext('2d'); x.direction = 'rtl'; x.textAlign = 'center'; x.font = '400 22px Rubik, sans-serif'; x.fillStyle = '#9a9cb0';
    x.fillText(`صفحة ${i + 1} من ${pages.length} · للتثقيف ولا يغني عن رأي الطبيب`, W / 2, H - 40); });
  const jpgs = await Promise.all(pages.map(pc => new Promise(r => pc.toBlob(b => b.arrayBuffer().then(a => r({ data: new Uint8Array(a), w: W, h: H })), 'image/jpeg', 0.88))));
  return pdfFromJpegs(jpgs);
}
async function shareFile(blob, name, title) {
  const P = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins;
  if (P && P.Share && P.Filesystem) {
    const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    const f = await P.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
    return P.Share.share({ title, files: [f.uri], dialogTitle: title });
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('تم حفظ الملف 📄');
}

function toolsBind() {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  // الركلات
  on('#kickStart', () => { S._kick = { start: Date.now(), count: 0 }; route.kickDone = null; save(); render(false); });
  on('#kickBtn', () => {
    const k = S._kick; if (!k) return;
    k.count++; k.last = Date.now();
    if (navigator.vibrate) navigator.vibrate(30);
    if (k.count >= KICK_GOAL) { kickSave('goal'); if (navigator.vibrate) navigator.vibrate([60, 60, 120]); }
    else save();
    render(false);
  });
  on('#kickUndo', () => { if (S._kick) { S._kick.count = Math.max(0, S._kick.count - 1); save(); render(false); } });
  on('#kickStop', () => { kickSave('stop'); toast('تم الحفظ'); render(false); });
  if ($('#kickLeft')) timers.push(setInterval(() => {
    if (!S._kick) return;
    const left = S._kick.start + KICK_WINDOW - Date.now();
    if (left <= 0) { kickSave('time'); render(false); return; }
    const el = $('#kickLeft'); if (el) el.textContent = hms(left);
  }, 1000));
  // الطلق
  on('#ctrBtn', () => {
    const l = S.contractions, last = l[l.length - 1];
    if (last && !last.end) last.end = Date.now(); else l.push({ start: Date.now() });
    if (l.length > 200) l.splice(0, l.length - 200);
    save(); render(false);
    if ($('.go-hospital') && navigator.vibrate) navigator.vibrate([300, 150, 300]);
  });
  const ctrClear = $('#ctrClear'); if (ctrClear) ctrClear.onclick = confirmTap(ctrClear, () => { S.contractions = []; save(); render(false); });
  if ($('#ctrTime')) {
    const last = S.contractions[S.contractions.length - 1];
    const tick = () => { const el = $('#ctrTime'); if (el) el.textContent = Math.floor((Date.now() - last.start) / 1000); };
    tick(); timers.push(setInterval(tick, 500));
  }
  // المزاج السريع
  app.querySelectorAll('[data-qmood]').forEach(b => b.onclick = () => {
    const t = iso(today()), e = S.journal.find(j => j.date === t);
    if (e) e.mood = e.mood === b.dataset.qmood ? '' : b.dataset.qmood; else S.journal.push({ date: t, mood: b.dataset.qmood, symptoms: [], note: '' });
    save(); render(false); toast('سُجّل مزاجك اليوم 💗');
  });
  on('#jPdf', async () => {
    const b = $('#jPdf'); b.disabled = true; b.textContent = 'جاري التجهيز…';
    try { await shareFile(await journalPdf(), `nabd-report-${iso(today())}.pdf`, 'تقرير المزاج والأعراض'); }
    catch (e) { if (!/abort|cancel/i.test(String(e && (e.name || e.message)))) toast('تعذّر إنشاء الملف'); }
    b.disabled = false; b.textContent = 'تصدير PDF';
  });
}
