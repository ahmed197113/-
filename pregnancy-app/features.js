/* نبضٌ صغير — الميزات المتقدمة: المساعد الذكي، التحاليل، فحص الخطر، الملف الطبي، الزوج، رمضان،
   الأكل المحلي، ألبوم البطن، ورحلة ما بعد الولادة */
'use strict';

/* ---------- تخزين الصور (IndexedDB) ---------- */
const IDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('nabd', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('img', mode), st = t.objectStore('img'), q = fn(st);
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  return {
    get: k => tx('readonly', s => s.get(k)).catch(() => null),
    put: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => null),
    del: k => tx('readwrite', s => s.delete(k)).catch(() => null),
    keys: () => tx('readonly', s => s.getAllKeys()).catch(() => [])
  };
})();
// تصغير الصورة قبل حفظها
function shrink(file, max = 900) {
  return new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
async function fillIdbImages() {
  for (const el of app.querySelectorAll('[data-idb]')) {
    const v = await IDB.get(el.dataset.idb);
    if (v && el.isConnected) { el.style.backgroundImage = `url("${v}")`; el.classList.add('has'); }
  }
}

/* ---------- المساعد الذكي ---------- */
const AI = { sample: null, images: false };
AI.ready = (async () => {
  try {
    if (window.claude && window.claude.use) {
      AI.sample = await window.claude.use('sample');
      if (AI.sample) { const l = await AI.sample.limits().catch(() => null); AI.images = !!(l && l.images); }
    }
  } catch { AI.sample = null; }
  if (route.view === 'assist' || route.sub === 'labs') render(false);
})();

const trimesterOf = w => w <= 13 ? 1 : w <= 27 ? 2 : 3;
const latestLabs = () => {
  const m = {};
  [...S.labs].sort((a, b) => a.date.localeCompare(b.date)).forEach(l => { m[l.k] = l; });
  return m;
};
const labEval = (l, tri) => { const t = LAB_TESTS.find(x => x.k === l.k); return t ? t.check(+l.v, tri) : { s: 'ok', t: '' }; };

function contextText() {
  const lines = [];
  if (S.baby) {
    const d = diffDays(today(), parse(S.baby.date));
    lines.push(`المستخدمة أم لطفل ${S.baby.sex === 'girl' ? 'بنت' : 'ولد'} اسمه ${S.baby.name || 'غير محدد'} عمره ${d} يوماً.`);
  } else if (S.profile) {
    const st = status();
    lines.push(`المستخدمة حامل في الأسبوع ${st.week} (${st.weeksDone} أسبوع و${st.extra} يوم)، الثلث ${st.tri}، موعد الولادة ${iso(st.due)}.`);
  }
  const m = S.med || {};
  if (m.conditions) lines.push(`أمراض أو حالات: ${m.conditions}`);
  if (m.meds) lines.push(`أدوية حالية: ${m.meds}`);
  if (m.allergies) lines.push(`حساسية: ${m.allergies}`);
  if (m.blood) lines.push(`فصيلة الدم: ${m.blood}${m.rh || ''}`);
  const tri = S.profile ? status().tri : 3;
  const labs = Object.values(latestLabs());
  if (labs.length) lines.push('آخر التحاليل: ' + labs.map(l => { const t = LAB_TESTS.find(x => x.k === l.k); return `${t.n} = ${l.v} ${t.u} (${LAB_STATUS[labEval(l, tri).s][0]}، ${l.date})`; }).join('؛ '));
  const c = S.checks[S.checks.length - 1];
  if (c) lines.push(`آخر فحص يومي (${c.date}): ضغط ${c.sys || '؟'}/${c.dia || '؟'}، أعراض: ${c.syms.map(k => CHECK_SYMPTOMS.find(s => s.k === k)?.n).filter(Boolean).join('، ') || 'لا شيء'}.`);
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (ws.length) lines.push(`آخر وزن: ${ws[ws.length - 1].kg} كغ، الوزن قبل الحمل: ${S.profile?.preWeight || 'غير معروف'}.`);
  return lines.join('\n');
}
const AI_RULES = `أنتِ "نبض"، رفيقة ذكية داخل تطبيق متابعة حمل عربي، تتكلمين بلهجة مصرية بسيطة ودافئة ومحترمة.
قواعدك:
- أجيبي باختصار ووضوح في نقاط قصيرة، وبلغة يفهمها أي شخص غير متخصص.
- استخدمي بيانات المستخدمة أدناه لتكون الإجابة شخصية لها هي.
- إذا ظهرت أي علامة خطر (نزيف، نزول ماء، قلة حركة الجنين، صداع شديد مع زغللة، ضغط مرتفع، حرارة عالية للرضيع تحت 3 أشهر، صعوبة تنفس، أفكار لإيذاء النفس) ابدئي الإجابة بسطر واضح: "🚨 توجهي للطوارئ الآن" أو "📞 كلمي طبيبك اليوم".
- لا تشخّصي بشكل قاطع، ولا تصفي أدوية بجرعات؛ وجّهي للطبيب عند الحاجة.
- اختمي عند الحاجة بجملة قصيرة تذكّر بأن المعلومات للتثقيف ولا تغني عن الطبيب.`;

function offlineAnswer(q) {
  const STOP = ['هل', 'آمن', 'آمنة', 'امن', 'امنة', 'ممكن', 'ايه', 'إيه', 'اللي', 'أقدر', 'اقدر', 'عندي', 'كده', 'ينفع', 'مسموح', 'الحمل', 'حامل', 'وانا', 'وأنا', 'انا', 'أنا', 'ليه', 'إزاي', 'ازاي', 'امتى', 'إمتى'];
  const norm = w => w.replace(/^(و|ف|ب)?ال/, '').replace(/[ةه]$/, 'ه').replace(/[أإآ]/g, 'ا');
  const words = q.replace(/[؟?.,،!]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.includes(w)).map(norm).filter(w => w.length > 2);
  const score = text => { const t = text.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه'); return words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0); };
  const urgent = CHECK_SYMPTOMS.filter(s => s.lvl === 3 && score(s.n) >= 1);
  const pool = [
    ...FAQ.map(([qq, a]) => ({ t: qq, a })),
    ...WARNING_SIGNS.map(([, t, d]) => ({ t, a: d + ' — اتصلي بطبيبك.' })),
    ...LOCAL_FOODS.map(([n, s, d]) => ({ t: n, a: `${s === 'ok' ? '✅ آمن' : s === 'care' ? '⚠️ باعتدال' : '⛔ تجنبيه'}: ${d}` })),
    ...LAB_TESTS.map(t => ({ t: t.n, a: t.about }))
  ].map(x => ({ ...x, sc: score(x.t) * 2 + score(x.a) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3);
  let out = urgent.length ? '🚨 ما ذكرتِه قد يكون علامة خطر — توجهي للطوارئ أو كلمي طبيبك الآن.\n\n' : '';
  out += pool.length ? pool.map(x => `• ${x.t}\n${x.a}`).join('\n\n') : 'لم أجد إجابة جاهزة لسؤالك. جرّبي كلمات أبسط، أو تصفحي «دليلي»، أو اسألي طبيبك.';
  return out + '\n\n(وضع بدون اتصال: إجابات من دليل التطبيق)';
}

/* ---------- فحص الخطر ---------- */
function triage(c, week) {
  const reasons = []; let lvl = 0;
  const sys = +c.sys || 0, dia = +c.dia || 0;
  const pre = c.syms.some(k => ['headache', 'vision', 'rua', 'swell'].includes(k));
  if (sys >= 160 || dia >= 110) { lvl = 3; reasons.push(`الضغط ${sys}/${dia} مرتفع جداً.`); }
  else if (sys >= 140 || dia >= 90) { lvl = Math.max(lvl, pre ? 3 : 2); reasons.push(`الضغط ${sys}/${dia} مرتفع${pre ? ' مع أعراض تسمم حمل' : ''}.`); }
  c.syms.forEach(k => {
    const s = CHECK_SYMPTOMS.find(x => x.k === k); if (!s) return;
    let l = s.lvl;
    if (k === 'contr' && week >= 37) l = 1;
    lvl = Math.max(lvl, l); reasons.push(s.why);
  });
  const lv = [
    ['💚', 'كل شيء يبدو مطمئناً', 'استمري في روتينك وراقبي نفسك.', 'ok'],
    ['👀', 'راقبي وأخبري طبيبك في الزيارة', 'ليست حالة طارئة، لكن سجّليها واذكريها لطبيبك.', 'low'],
    ['📞', 'كلمي طبيبك اليوم', 'هذه الأعراض تحتاج رأي طبيبك خلال اليوم.', 'high'],
    ['🚨', 'توجهي للطوارئ الآن', 'لا تنتظري — اذهبي لأقرب طوارئ نساء وولادة أو اتصلي بالإسعاف (123 في مصر).', 'danger']
  ][lvl];
  return { lvl, ic: lv[0], title: lv[1], act: lv[2], cls: lv[3], reasons };
}
const waLink = (text, phone) => `https://wa.me/${(phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;

/* ---------- عناصر مساعدة للعرض ---------- */
const chipS = s => `<span class="st-chip" style="--c:${LAB_STATUS[s][1]}">${LAB_STATUS[s][0]}</span>`;
function spark(vals, w = 120, h = 34) {
  if (vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 6) + 3).toFixed(1)},${(h - 4 - (v - mn) / r * (h - 8)).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2"/><circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="3" fill="var(--primary)"/></svg>`;
}
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? `منذ ${m} دقيقة` : m < 1440 ? `منذ ${Math.floor(m / 60)} ساعة و${m % 60} د` : `منذ ${Math.floor(m / 1440)} يوم`; };
const babyAge = () => {
  const d = diffDays(today(), parse(S.baby.date));
  if (d < 14) return `${d} ${d === 1 ? 'يوم' : 'أيام'}`;
  if (d < 61) return `${Math.floor(d / 7)} أسابيع و${d % 7} أيام`;
  const m = Math.floor(d / 30.44); return m < 24 ? `${m} شهراً و${Math.floor(d - m * 30.44)} يوماً` : `${Math.floor(m / 12)} سنة و${m % 12} شهراً`;
};
const todayLog = arr => arr.filter(x => iso(new Date(x.t)) === iso(today()));

/* ---------- إضافات الصفحة الرئيسية (الحمل) ---------- */
function homeExtras(st) {
  const t = iso(today());
  const c = S.checks.find(x => x.date === t);
  const tr = c && triage(c, st.week);
  const tri = st.tri, alerts = Object.values(latestLabs()).map(l => ({ l, e: labEval(l, tri) })).filter(x => x.e.s !== 'ok');
  const pt = PARTNER.find(p => st.week <= p.to) || PARTNER[PARTNER.length - 1];
  return `
  <div class="card check-card ${tr ? 'lv-' + tr.cls : ''}">
    <div class="row"><span class="big-ic">${tr ? tr.ic : '🩺'}</span><div class="grow">
      <b>${tr ? 'فحص اليوم: ' + tr.title : 'فحص اليوم — دقيقة واحدة'}</b>
      <div class="muted">${tr ? tr.act : 'ضغطك وأعراضك اليوم، ونقول لك فوراً هل تحتاجين الطبيب.'}</div></div></div>
    <button class="btn block" data-sub="checkin" style="margin-top:12px">${tr ? 'تحديث فحص اليوم' : 'ابدئي الفحص'}</button>
  </div>
  ${alerts.length ? `<div class="card warn-card nav-row" data-sub="labs"><span class="ic">🧪</span><div class="grow"><b>${alerts.length} تحليل يحتاج انتباهك</b>
    <div class="muted">${alerts.slice(0, 2).map(x => LAB_TESTS.find(t => t.k === x.l.k).n).join('، ')}</div></div><span class="chev">‹</span></div>` : ''}
  <div class="card ask-card">
    <div class="row"><span class="big-ic">✨</span><div class="grow"><b>اسألي نبض</b><div class="muted">رفيقتك الذكية تعرف أسبوعك وتحاليلك وتجاوبك عليكِ أنتِ.</div></div></div>
    <form class="ask-row" id="homeAsk"><input class="input" id="homeAskQ" placeholder="مثال: هل الحلبة آمنة في الشهر الثامن؟" autocomplete="off"><button class="btn" aria-label="اسألي">↖</button></form>
  </div>
  <div class="grid2" style="margin-bottom:14px">
    <div class="card mini tap" data-sub="partner"><span class="big-ic">💑</span><b style="font-size:1rem">شاركي زوجك</b><small>${pt.help[0]}</small></div>
    <div class="card mini tap" data-sub="album"><span class="big-ic">📸</span><b style="font-size:1rem">صورة بطنك</b><small>سجّلي الأسبوع ${st.week} في ألبوم رحلتك</small></div>
  </div>
  ${st.week >= 36 ? `<button class="btn ghost block" data-sub="born" style="margin-bottom:14px">🎉 وُلد طفلي — ابدئي رحلة ما بعد الولادة</button>` : ''}`;
}

/* ---------- الصفحة الرئيسية بعد الولادة ---------- */
function viewBabyHome() {
  const b = S.baby, d = diffDays(today(), parse(b.date));
  const nextV = VACCINES.find(v => !S.vax[v.d] && v.d >= d - 30) || VACCINES.find(v => !S.vax[v.d]);
  const feeds = todayLog(S.feeds), lastFeed = S.feeds[S.feeds.length - 1];
  const dWet = todayLog(S.diapers).filter(x => x.k === 'wet').length, dDirty = todayLog(S.diapers).filter(x => x.k === 'dirty').length;
  const sleeping = S.sleeps.length && !S.sleeps[S.sleeps.length - 1].end;
  const sleepMin = todayLog(S.sleeps).reduce((n, s) => n + ((s.end || Date.now()) - s.t) / 60000, 0);
  const month = [...BABY_MONTHS].reverse().find(m => d / 30.44 >= m[0]) || BABY_MONTHS[0];
  const nextM = MILESTONES.find(m => !S.miles[m[0]]);
  return `
  <div class="card baby-hero">
    <div class="baby-photo" data-idb="baby-photo"><label class="cam">📷<input type="file" accept="image/*" id="babyPhoto" hidden></label></div>
    <h2 style="margin:8px 0 0">${esc(b.name || 'طفلي')} ${b.sex === 'girl' ? '👧' : '👦'}</h2>
    <div class="muted">عمره ${babyAge()} · وُلد ${fmtDate.format(parse(b.date))}</div>
  </div>
  <div class="quick4">
    <button data-quick="feed"><span>🍼</span>رضعة<small>${lastFeed ? ago(lastFeed.t) : '—'}</small></button>
    <button data-quick="wet"><span>💧</span>مبلل<small>اليوم ${dWet}</small></button>
    <button data-quick="dirty"><span>💩</span>براز<small>اليوم ${dDirty}</small></button>
    <button data-quick="sleep" class="${sleeping ? 'on' : ''}"><span>${sleeping ? '⏰' : '😴'}</span>${sleeping ? 'صحي' : 'نام'}<small>${Math.round(sleepMin / 60 * 10) / 10} س اليوم</small></button>
  </div>
  <div class="grid2" style="margin-bottom:14px">
    <div class="card mini pattern"><small>رضعات اليوم</small><b>${feeds.length}</b></div>
    <div class="card mini pattern"><small>حفاضات اليوم</small><b>${dWet + dDirty}</b></div>
  </div>
  ${nextV ? `<div class="card nav-row" data-sub="vaccines"><span class="ic">💉</span><div class="grow"><b>التطعيم القادم: ${nextV.at}</b><div class="muted">${nextV.n} · ${fmtShort.format(addDays(parse(b.date), nextV.d))}</div></div><span class="chev">‹</span></div>` : ''}
  <div class="card"><h3>${month[1]}</h3><p style="margin:0 0 6px">${month[2]}</p><p class="muted" style="margin:0">💡 ${month[3]}</p></div>
  ${nextM ? `<div class="card nav-row" data-sub="miles"><span class="ic">⭐</span><div class="grow"><b>المرحلة القادمة (شهر ${nextM[0]})</b><div class="muted">${nextM[1]}</div></div><span class="chev">‹</span></div>` : ''}
  <div class="card ask-card"><div class="row"><span class="big-ic">✨</span><div class="grow"><b>اسألي نبض عن طفلك</b><div class="muted">رضاعة، نوم، مغص، حرارة، تطعيمات…</div></div></div>
    <form class="ask-row" id="homeAsk"><input class="input" id="homeAskQ" placeholder="مثال: ابني عنده مغص بالليل أعمل إيه؟" autocomplete="off"><button class="btn" aria-label="اسألي">↖</button></form></div>
  <div class="card nav-row" data-sub="momcare"><span class="ic">🤱</span><div class="grow"><b>صحتك أنتِ بعد الولادة</b><div class="muted">التعافي، والمزاج، والرضاعة</div></div><span class="chev">‹</span></div>
  <div class="card warn-card nav-row" data-sub="babywarn"><span class="ic">🚨</span><div class="grow"><b>متى أذهب بطفلي للطوارئ؟</b><div class="muted">علامات لا تنتظر</div></div><span class="chev">‹</span></div>`;
}

function viewBabyHub() {
  const b = S.baby, d = diffDays(today(), parse(b.date));
  return `<div class="card baby-hero"><div class="baby-photo sm" data-idb="baby-photo"></div><h2 style="margin:6px 0 0">${esc(b.name || 'طفلي')}</h2><div class="muted">عمره ${babyAge()}</div></div>
    ${group('📊 متابعة يومية', [navRow('feeds', `${todayLog(S.feeds).length} رضعات اليوم`), navRow('diapers', `${todayLog(S.diapers).length} حفاضات اليوم`), navRow('sleep', 'مواعيد النوم والاستيقاظ')])}
    ${group('📈 النمو والصحة', [navRow('growth', S.growth.length ? `آخر وزن: ${S.growth[S.growth.length - 1].kg} كغ` : 'سجّلي الوزن والطول'), navRow('vaccines', `${Object.values(S.vax).filter(Boolean).length} من ${VACCINES.length} تطعيمات`), navRow('miles', `${Object.values(S.miles).filter(Boolean).length} من ${MILESTONES.length} مرحلة`)])}
    ${group('💗 أنا وطفلي', [navRow('momcare', 'التعافي والمزاج'), navRow('album', 'ألبوم الحمل ورسائلك لطفلك'), navRow('babywarn', 'علامات الطوارئ')])}
    <p class="muted center">عمر ${d} يوماً — كل يوم معه ذكرى 💗</p>`;
}

/* ---------- الشاشات الفرعية الجديدة ---------- */
Object.assign(SUBVIEWS, {
  assist() { return viewAssist(); },

  checkin() {
    const st = status(), t = iso(today());
    const c = S.checks.find(x => x.date === t) || { sys: '', dia: '', syms: [], mood: '' };
    const syms = CHECK_SYMPTOMS.filter(s => !s.minW || st.week >= s.minW);
    const res = route.res && S.checks.find(x => x.date === t) ? triage(c, st.week) : null;
    const hist = S.checks.slice(-10).reverse();
    return `${res ? `<div class="card result lv-${res.cls}"><div class="row"><span class="big-ic">${res.ic}</span><div class="grow"><h2 style="margin:0">${res.title}</h2><div>${res.act}</div></div></div>
        ${res.reasons.length ? `<ul class="list" style="margin-top:10px">${res.reasons.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
        ${res.lvl >= 2 ? `<div class="row" style="margin-top:12px">
          <a class="btn grow center" href="tel:123">📞 الإسعاف 123</a>
          ${S.med.docPhone ? `<a class="btn ghost grow center" href="tel:${esc(S.med.docPhone)}">👩‍⚕️ اتصلي بطبيبك</a>` : ''}
          <a class="btn ghost grow center" target="_blank" rel="noopener" href="${waLink(`🚨 محتاجاكي/محتاجاك دلوقتي. فحص نبض بيقول: ${res.title}. ${res.reasons.join(' ')}`, S.med.partnerPhone)}">💬 أبلغي زوجك</a></div>
          <p class="muted" style="margin:8px 0 0">رقم الإسعاف في مصر 123 — اكتبيه يدوياً لو لم يعمل الزر.</p>` : ''}
      </div>` : ''}
    <div class="card"><h3>1) الضغط (اختياري)</h3>
      <div class="row"><input class="input grow" id="cSys" type="number" inputmode="numeric" placeholder="الانقباضي (الكبير) مثل 120" value="${esc(c.sys)}" style="margin:0">
      <span>/</span><input class="input grow" id="cDia" type="number" inputmode="numeric" placeholder="الانبساطي (الصغير) مثل 80" value="${esc(c.dia)}" style="margin:0"></div></div>
    <div class="card"><h3>2) هل تشعرين بأي من هذه اليوم؟</h3>
      <div class="chips" id="cSyms">${syms.map(s => `<button class="chip ${c.syms.includes(s.k) ? 'on' : ''}" data-csym="${s.k}">${s.n}</button>`).join('')}</div>
      <p class="muted" style="margin:10px 0 0">لا تشعرين بشيء؟ اتركيها فارغة.</p></div>
    <div class="card"><h3>3) مزاجك</h3><div class="chips" id="cMood">${MOODS.map(m => `<button class="chip ${c.mood === m ? 'on' : ''}" data-cmood="${m}" style="font-size:1.4rem">${m}</button>`).join('')}</div></div>
    <button class="btn block" id="cSave">احسبي النتيجة</button>
    ${hist.length ? `<div class="card" style="margin-top:14px"><h3>السجل</h3><table class="t"><tr><th>اليوم</th><th>الضغط</th><th>النتيجة</th></tr>
      ${hist.map(h => { const r = triage(h, st.week); return `<tr><td>${fmtShort.format(parse(h.date))}</td><td>${h.sys ? h.sys + '/' + h.dia : '—'}</td><td>${r.ic} ${r.title}</td></tr>`; }).join('')}</table>
      ${spark(S.checks.filter(x => x.sys).slice(-14).map(x => +x.sys)) ? `<div class="muted" style="margin-top:8px">الضغط الانقباضي آخر أسبوعين</div>${spark(S.checks.filter(x => x.sys).slice(-14).map(x => +x.sys), 300, 60)}` : ''}</div>` : ''}`;
  },

  labs() {
    const tri = S.profile ? status().tri : 3;
    const lat = latestLabs();
    const pending = route.pending || null;
    return `
    <div class="card"><h3>➕ أضيفي نتيجة</h3>
      ${AI.sample && AI.images ? `<label class="btn block center" style="cursor:pointer;margin-bottom:12px">📷 صوّري ورقة التحليل ونقرأها لكِ<input type="file" id="labPhoto" accept="image/*" hidden></label><div id="labAiOut"></div>` : ''}
      ${pending ? `<div class="card soft-card"><b>وجدنا هذه النتائج في الصورة — راجعيها:</b>
        ${pending.map((p, i) => { const t = LAB_TESTS.find(x => x.k === p.k); return `<label class="check"><input type="checkbox" data-pend="${i}" checked><span>${t.n}: <b>${p.v}</b> ${t.u}</span></label>`; }).join('')}
        <div class="row" style="margin-top:8px"><button class="btn grow" id="pendSave">حفظ المحدد</button><button class="btn ghost grow" id="pendCancel">إلغاء</button></div></div>` : ''}
      <label class="f">التحليل<select id="lK">${LAB_TESTS.map(t => `<option value="${t.k}">${t.ic} ${t.n} (${t.u})</option>`).join('')}</select></label>
      <div class="grid2"><label class="f">النتيجة<input id="lV" type="number" step="0.01" inputmode="decimal"></label><label class="f">التاريخ<input id="lD" type="date" value="${iso(today())}"></label></div>
      <button class="btn block" id="lAdd">حفظ وشرح النتيجة</button>
    </div>
    ${LAB_TESTS.filter(t => lat[t.k]).map(t => {
      const l = lat[t.k], e = t.check(+l.v, tri), hist = S.labs.filter(x => x.k === t.k).sort((a, b) => a.date.localeCompare(b.date));
      return `<div class="card lab-card"><div class="row"><span class="big-ic">${t.ic}</span><div class="grow"><b>${t.n}</b><div class="muted">${fmtShort.format(parse(l.date))}</div></div>
        <div class="center"><b style="font-size:1.3rem">${l.v}</b> <small class="muted">${t.u}</small><br>${chipS(e.s)}</div></div>
        <p style="margin:10px 0 0">${e.t}</p>${spark(hist.map(h => +h.v), 300, 50)}
        <details><summary class="muted">ما هذا التحليل؟ · السجل (${hist.length})</summary><p class="muted">${t.about}</p>
        ${hist.slice().reverse().map(h => `<div class="row" style="justify-content:space-between"><span>${fmtShort.format(parse(h.date))}</span><b>${h.v}</b><button class="btn sm ghost" data-labdel="${h.id}">✕</button></div>`).join('')}</details></div>`;
    }).join('') || '<p class="muted center">لم تضيفي تحاليل بعد. أضيفي أول نتيجة وسنشرحها لكِ فوراً.</p>'}
    <p class="disclaimer">النطاقات المرجعية تقريبية وتختلف بين المعامل — طبيبك هو المرجع.</p>`;
  },

  medinfo() {
    const m = S.med;
    const f = (id, label, ph = '', type = 'text') => `<label class="f">${label}<input id="m_${id}" type="${type}" value="${esc(m[id] || '')}" placeholder="${ph}"></label>`;
    return `<div class="card">
      <div class="grid2"><label class="f">فصيلة الدم<select id="m_blood">${['', 'A', 'B', 'AB', 'O'].map(x => `<option ${m.blood === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f">العامل الريسيسي<select id="m_rh">${['', '+', '-'].map(x => `<option value="${x}" ${m.rh === x ? 'selected' : ''}>${x === '+' ? 'موجب +' : x === '-' ? 'سالب −' : ''}</option>`).join('')}</select></label></div>
      ${f('conditions', 'أمراض أو حالات (سكر، ضغط، غدة…)', 'لا يوجد')}
      ${f('meds', 'أدوية ومكملات حالية', 'حمض الفوليك، حديد…')}
      ${f('allergies', 'حساسية من أدوية أو أطعمة', 'لا يوجد')}
      ${f('prev', 'حمل وولادات سابقة', 'مثال: ولادة طبيعية 2022')}
      ${f('doctor', 'اسم الطبيب')}${f('docPhone', 'رقم الطبيب', '', 'tel')}
      ${f('hospital', 'المستشفى المختار')}${f('partnerPhone', 'رقم واتساب الزوج (بمفتاح الدولة مثل 2010…)', '201xxxxxxxxx', 'tel')}
      <button class="btn block" id="medSave">حفظ</button></div>`;
  },

  file() {
    const st = status(), p = S.profile, m = S.med, tri = st.tri;
    const lat = Object.values(latestLabs());
    const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
    const checks = S.checks.slice(-14).filter(c => c.sys || c.syms.length);
    const inPage = !!window.claude;
    return `<div class="card report" id="report">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">ملف الحمل الطبي</h2><span class="muted">${fmtDate.format(today())}</span></div>
      <table class="t"><tr><td>الاسم</td><td>${esc(p.name || '—')}</td></tr><tr><td>عمر الحمل</td><td>${st.weeksDone} أسبوع و${st.extra} يوم (الأسبوع ${st.week})</td></tr>
        <tr><td>موعد الولادة المتوقع</td><td>${fmtDate.format(st.due)}</td></tr><tr><td>فصيلة الدم</td><td>${esc((m.blood || '—') + (m.rh || ''))}</td></tr>
        <tr><td>حالات مرضية</td><td>${esc(m.conditions || '—')}</td></tr><tr><td>أدوية</td><td>${esc(m.meds || '—')}</td></tr><tr><td>حساسية</td><td>${esc(m.allergies || '—')}</td></tr>
        <tr><td>حمل سابق</td><td>${esc(m.prev || '—')}</td></tr><tr><td>الطبيب / المستشفى</td><td>${esc([m.doctor, m.hospital].filter(Boolean).join(' — ') || '—')}</td></tr></table>
      <h3 style="margin-top:14px">آخر التحاليل</h3>
      ${lat.length ? `<table class="t"><tr><th>التحليل</th><th>النتيجة</th><th>التاريخ</th><th>الحالة</th></tr>${lat.map(l => { const t = LAB_TESTS.find(x => x.k === l.k), e = t.check(+l.v, tri); return `<tr><td>${t.n}</td><td>${l.v} ${t.u}</td><td>${l.date}</td><td>${LAB_STATUS[e.s][0]}</td></tr>`; }).join('')}</table>` : '<p class="muted">لا توجد.</p>'}
      <h3 style="margin-top:14px">الضغط والأعراض (آخر أسبوعين)</h3>
      ${checks.length ? `<table class="t"><tr><th>اليوم</th><th>الضغط</th><th>أعراض</th></tr>${checks.map(c => `<tr><td>${c.date}</td><td>${c.sys ? c.sys + '/' + c.dia : '—'}</td><td>${c.syms.map(k => CHECK_SYMPTOMS.find(s => s.k === k)?.n).join('، ') || '—'}</td></tr>`).join('')}</table>` : '<p class="muted">لا توجد.</p>'}
      <h3 style="margin-top:14px">الوزن</h3>
      <p>${p.preWeight ? `قبل الحمل: ${p.preWeight} كغ · ` : ''}${ws.length ? `آخر قياس: ${ws[ws.length - 1].kg} كغ (${ws[ws.length - 1].date})` : 'لا توجد قياسات'}</p>
      <p class="muted" style="font-size:.78rem">أُعد بواسطة تطبيق ${APP_NAME} — للمساعدة في المتابعة ولا يغني عن التقييم الطبي.</p>
    </div>
    <div class="row">
      ${inPage ? '<button class="btn grow" id="fileDl">⬇️ تنزيل الملف</button>' : '<button class="btn grow" id="filePrint">🖨️ طباعة / PDF</button>'}
      <a class="btn ghost grow center" target="_blank" rel="noopener" href="${waLink(fileText())}">💬 مشاركة واتساب</a>
    </div>
    <button class="btn ghost block" data-sub="medinfo" style="margin-top:10px">✏️ تعديل البيانات الطبية</button>`;
  },

  partner() {
    const st = status(), pt = PARTNER.find(p => st.week <= p.to) || PARTNER[PARTNER.length - 1], w = WEEKS[st.week - 1];
    const msg = partnerMsg(st, pt, w);
    return `<div class="card hero-soft"><div class="row"><span class="big-ic">💑</span><div class="grow"><h2 style="margin:0">زوجك شريك الرحلة</h2><div class="muted">أرسلي له كل أسبوع تحديثاً بسيطاً: ماذا يحدث، وكيف يساعدك.</div></div></div></div>
      <div class="card"><h3>بماذا تشعرين الآن؟</h3><p style="margin:0">${pt.feel}</p></div>
      <div class="card"><h3>كيف يساعدك هذا الأسبوع</h3><ul class="list">${pt.help.map(h => `<li>${h}</li>`).join('')}</ul></div>
      <div class="card"><h3>رسالة الأسبوع ${st.week}</h3><textarea class="input" id="pMsg" rows="8">${esc(msg)}</textarea>
        <a class="btn block center" id="pSend" target="_blank" rel="noopener" href="${waLink(msg, S.med.partnerPhone)}" style="margin-top:10px">💬 أرسليها على واتساب</a>
        ${!S.med.partnerPhone ? `<button class="link" data-sub="medinfo">أضيفي رقم زوجك لإرسال مباشر ‹</button>` : ''}</div>`;
  },

  ramadan() {
    const st = status(), tri = st.tri;
    return `<div class="card hero-soft"><h2 style="margin:0">🌙 الصيام في الحمل</h2><p style="margin:6px 0 0">${RAMADAN.intro}</p></div>
      <div class="card"><h3>حسب مرحلتك</h3>${RAMADAN.byTri.map(([n, d], i) => `<div class="item-row ${i + 1 === tri ? 'now-row' : ''}"><div class="em">${i + 1 === tri ? '📍' : '•'}</div><div><b>${n}</b>${i + 1 === tri ? ' <span class="badge soft">أنتِ هنا</span>' : ''}<div class="muted">${d}</div></div></div>`).join('')}</div>
      <div class="card warn-card"><h3>لا تصومي إذا كان عندك</h3><div class="chips">${RAMADAN.noFast.map(x => `<span class="chip">${x}</span>`).join('')}</div></div>
      <div class="card"><h3>خطة يوم الصيام</h3>${RAMADAN.plan.map(([t, d]) => `<div class="item-row"><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</div>
      <div class="card warn-card"><h3>🚫 أفطري فوراً عند</h3><ul class="list">${RAMADAN.breakNow.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
  },

  localfood() {
    const q = (route.q || '').trim(), f = route.ff || 'all';
    const list = LOCAL_FOODS.filter(([n, s]) => (f === 'all' || s === f) && (!q || n.includes(q)));
    const lab = { ok: ['✅', 'آمن'], care: ['⚠️', 'باعتدال'], no: ['⛔', 'تجنبيه'] };
    return `<input class="input" id="lfQ" placeholder="ابحثي: فول، فسيخ، حلبة…" value="${esc(q)}" style="margin:0 0 10px">
      <div class="seg">${[['all', 'الكل'], ['ok', '✅ آمن'], ['care', '⚠️ باعتدال'], ['no', '⛔ تجنبيه']].map(([k, v]) => `<button data-lf="${k}" class="${f === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="card">${list.map(([n, s, d]) => `<div class="item-row"><div class="em">${lab[s][0]}</div><div class="grow"><b>${n}</b> <span class="st-chip" style="--c:${s === 'ok' ? '#4caf7d' : s === 'care' ? '#f2a03d' : '#ef5350'}">${lab[s][1]}</span><div class="muted">${d}</div></div></div>`).join('') || '<p class="muted">لا نتائج — اسألي نبض عنه ✨</p>'}</div>`;
  },

  album() {
    const st = S.profile ? status() : null;
    const max = S.baby ? 40 : Math.min(40, st.week);
    const letters = [...S.letters].reverse();
    return `<div class="card hero-soft"><h2 style="margin:0">📸 ألبوم رحلتك</h2><p class="muted" style="margin:4px 0 0">صورة لبطنك كل أسبوع — وفي النهاية تشاهدين رحلتك كاملة كفيلم.</p>
      <button class="btn block" id="playAlbum" style="margin-top:10px">▶️ شاهدي رحلتك</button></div>
      <div class="album-grid">${Array.from({ length: max - 3 }, (_, i) => i + 4).reverse().map(w => `<label class="album-cell" data-idb="bump-${w}"><span>الأسبوع ${w}</span><input type="file" accept="image/*" data-bump="${w}" hidden></label>`).join('')}</div>
      <div class="card" style="margin-top:14px"><h3>💌 رسائل لطفلك</h3><p class="muted" style="margin:0 0 8px">اكتبي له ما تشعرين به الآن — سيقرؤها يوماً ما.</p>
        <textarea class="input" id="letterT" rows="3" placeholder="حبيبي الصغير…"></textarea><button class="btn block" id="letterAdd" style="margin-top:8px">حفظ الرسالة</button>
        ${letters.map(l => `<div class="letter"><div class="muted">${fmtDate.format(parse(l.date))}${l.week ? ` · الأسبوع ${l.week}` : ''}</div><p>${esc(l.text)}</p><button class="btn sm ghost" data-letdel="${l.id}">حذف</button></div>`).join('')}</div>
      <div class="player" id="player" hidden><img id="playImg" alt=""><div id="playCap"></div><button class="btn ghost" id="playClose">إغلاق</button></div>`;
  },

  born() {
    const b = S.baby || {};
    return `<div class="card hero-soft center"><div style="font-size:3rem">🎉</div><h2 style="margin:0">مبروك! حمداً لله على سلامتك</h2><p class="muted">سجّلي بيانات طفلك لتبدأ رحلة جديدة معاً.</p></div>
      <div class="card"><label class="f">اسم الطفل<input id="bName" value="${esc(b.name || S.profile.babyName || '')}"></label>
        <div class="seg" id="bSex"><button data-sex="boy" class="${b.sex !== 'girl' ? 'on' : ''}">👦 ولد</button><button data-sex="girl" class="${b.sex === 'girl' ? 'on' : ''}">👧 بنت</button></div>
        <div class="grid2"><label class="f">تاريخ الولادة<input id="bDate" type="date" max="${iso(today())}" value="${esc(b.date || iso(today()))}"></label>
        <label class="f">نوع الولادة<select id="bType"><option value="normal" ${b.type !== 'cs' ? 'selected' : ''}>طبيعية</option><option value="cs" ${b.type === 'cs' ? 'selected' : ''}>قيصرية</option></select></label></div>
        <div class="grid2"><label class="f">الوزن (كغ)<input id="bW" type="number" step="0.01" value="${esc(b.weight || '')}"></label><label class="f">الطول (سم)<input id="bL" type="number" step="0.1" value="${esc(b.length || '')}"></label></div>
        <button class="btn block" id="bSave">ابدئي رحلة طفلي 💗</button>
        ${S.baby ? '<button class="btn ghost block" id="bUndo" style="margin-top:8px">رجوع لوضع الحمل</button>' : ''}</div>`;
  },

  feeds() {
    const list = S.feeds.slice(-30).reverse(), act = route.feedTimer;
    return `<div class="card center"><h3>رضعة جديدة</h3>
      <div class="seg" style="justify-content:center">${[['L', '🤱 يسار'], ['R', '🤱 يمين'], ['B', '🍼 زجاجة']].map(([k, v]) => `<button data-feed="${k}" class="${act && act.side === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      ${act ? `<div class="big-num" id="feedTime">00:00</div><button class="btn" id="feedStop">إنهاء الرضعة</button>` : '<p class="muted">اختاري الجهة لبدء المؤقت، أو الزجاجة لتسجيل الكمية.</p>'}
      ${route.bottle ? `<div class="row" style="justify-content:center"><input class="input" id="mlIn" type="number" placeholder="ml" style="width:110px;margin:0"><button class="btn" id="mlSave">حفظ</button></div>` : ''}</div>
      <div class="card"><h3>السجل</h3>${list.length ? `<table class="t"><tr><th>الوقت</th><th>النوع</th><th>المدة/الكمية</th></tr>${list.map(f => `<tr><td>${new Date(f.t).toLocaleString('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>${f.side === 'B' ? '🍼 زجاجة' : f.side === 'L' ? 'يسار' : 'يمين'}</td><td>${f.ml ? f.ml + ' ml' : Math.round((f.min || 0)) + ' د'}</td></tr>`).join('')}</table>` : '<p class="muted">لا توجد رضعات بعد.</p>'}</div>
      <div class="card"><p class="muted" style="margin:0">💡 حديث الولادة يرضع 8–12 مرة يومياً. علامة كفاية الرضاعة: 6 حفاضات مبللة أو أكثر يومياً بعد اليوم الخامس، وزيادة الوزن.</p></div>`;
  },

  diapers() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    return `<div class="quick4" style="grid-template-columns:1fr 1fr"><button data-quick="wet"><span>💧</span>مبلل</button><button data-quick="dirty"><span>💩</span>براز</button></div>
      <div class="card"><h3>آخر 7 أيام</h3><table class="t"><tr><th>اليوم</th><th>💧</th><th>💩</th></tr>${days.reverse().map(d => { const l = S.diapers.filter(x => iso(new Date(x.t)) === iso(d)); return `<tr><td>${fmtShort.format(d)}</td><td>${l.filter(x => x.k === 'wet').length}</td><td>${l.filter(x => x.k === 'dirty').length}</td></tr>`; }).join('')}</table></div>`;
  },

  sleep() {
    const on = S.sleeps.length && !S.sleeps[S.sleeps.length - 1].end;
    const list = S.sleeps.slice(-20).reverse();
    return `<div class="card center"><button class="counter-big" data-quick="sleep">${on ? '⏰' : '😴'}<small>${on ? 'صحي الآن' : 'نام الآن'}</small></button>${on ? `<div class="muted">نائم ${ago(S.sleeps[S.sleeps.length - 1].t).replace('منذ ', '')}</div>` : ''}</div>
      <div class="card"><h3>السجل</h3>${list.length ? `<table class="t"><tr><th>نام</th><th>المدة</th></tr>${list.map(s => `<tr><td>${new Date(s.t).toLocaleString('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>${s.end ? Math.round((s.end - s.t) / 60000) + ' دقيقة' : 'نائم الآن'}</td></tr>`).join('')}</table>` : '<p class="muted">لا يوجد.</p>'}</div>
      <div class="card"><p class="muted" style="margin:0">💡 نوم آمن: على الظهر دائماً، على سطح ثابت، بدون مخدات أو ألعاب في السرير.</p></div>`;
  },

  growth() {
    const g = GROWTH[S.baby.sex === 'girl' ? 'girl' : 'boy'], birth = parse(S.baby.date);
    const pts = S.growth.map(x => ({ ...x, m: diffDays(parse(x.date), birth) / 30.44 })).sort((a, b) => a.m - b.m);
    const W = 320, H = 190, X = m => 30 + m / 24 * (W - 50), Y = kg => 10 + (1 - (kg - 2) / 14) * (H - 30);
    const line = arr => arr.map((v, m) => `${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    let verdict = '';
    if (last) { const i = Math.min(24, Math.round(last.m)); verdict = last.kg < g.lo[i] ? '⚠️ الوزن أقل من المعدل الطبيعي — راجعي طبيب الأطفال.' : last.kg > g.hi[i] ? '⚠️ الوزن أعلى من المعدل الطبيعي — ناقشي الأمر مع الطبيب.' : '💚 الوزن في النطاق الطبيعي لعمره.'; }
    return `<div class="card"><h3>إضافة قياس</h3><div class="grid3"><label class="f">التاريخ<input id="gD" type="date" value="${iso(today())}"></label><label class="f">الوزن كغ<input id="gW" type="number" step="0.01"></label><label class="f">الطول سم<input id="gL" type="number" step="0.1"></label></div><button class="btn block" id="gAdd">حفظ</button></div>
      <div class="card"><h3>منحنى الوزن</h3>${verdict ? `<p style="margin:0 0 8px">${verdict}</p>` : ''}
        <svg class="svg-chart" viewBox="0 0 ${W} ${H}"><polygon points="${line(g.hi)} ${g.lo.map((v, m) => `${X(m).toFixed(1)},${Y(v).toFixed(1)}`).reverse().join(' ')}" fill="var(--primary-2)" opacity=".18"/>
        <polyline points="${line(g.med)}" fill="none" stroke="var(--primary-2)" stroke-dasharray="4 3" stroke-width="1.5"/>
        ${[0, 6, 12, 18, 24].map(m => `<text x="${X(m)}" y="${H - 4}" text-anchor="middle">${m}ش</text>`).join('')}${[4, 8, 12, 16].map(k => `<text x="22" y="${Y(k) + 3}" text-anchor="end">${k}</text>`).join('')}
        ${pts.length ? `<polyline points="${pts.map(p => `${X(p.m).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>${pts.map(p => `<circle cx="${X(p.m).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="3.5" fill="var(--primary)"/>`).join('')}` : ''}</svg>
        <p class="muted center" style="margin:0">المنطقة البنفسجية: النطاق الطبيعي تقريباً حسب منظمة الصحة العالمية</p></div>
      ${pts.length ? `<div class="card"><table class="t"><tr><th>التاريخ</th><th>الوزن</th><th>الطول</th><th></th></tr>${pts.slice().reverse().map(p => `<tr><td>${fmtShort.format(parse(p.date))}</td><td>${p.kg || '—'}</td><td>${p.cm || '—'}</td><td><button class="btn sm ghost" data-gdel="${p.date}">✕</button></td></tr>`).join('')}</table></div>` : ''}`;
  },

  vaccines() {
    const birth = parse(S.baby.date), d = diffDays(today(), birth);
    return `<div class="card">${VACCINES.map(v => { const due = addDays(birth, v.d), done = !!S.vax[v.d], late = !done && d > v.d + 14;
      return `<label class="check ${done ? 'done' : ''}"><input type="checkbox" data-vax="${v.d}" ${done ? 'checked' : ''}><span class="grow"><b>${v.at}</b> · ${fmtShort.format(due)} ${late ? '<span class="st-chip" style="--c:#ef5350">متأخر</span>' : ''}<br><small class="muted">${v.n}</small></span></label>`; }).join('')}</div>
      <div class="card"><p class="muted" style="margin:0">${OPTIONAL_VACCINES}<br>الجدول تقريبي حسب برنامج التطعيمات الإجبارية في مصر — راجعي مكتب الصحة أو طبيب الأطفال.</p></div>`;
  },

  miles() {
    const m = diffDays(today(), parse(S.baby.date)) / 30.44;
    return `<div class="card">${MILESTONES.map(([mo, t]) => `<label class="check ${S.miles[mo] ? 'done' : ''}"><input type="checkbox" data-mile="${mo}" ${S.miles[mo] ? 'checked' : ''}><span class="grow"><b>شهر ${mo}</b> ${!S.miles[mo] && m > mo + 3 ? '<span class="st-chip" style="--c:#f2a03d">اسألي الطبيب</span>' : ''}<br><small class="muted">${t}</small>${S.miles[mo] ? `<br><small>✔️ ${S.miles[mo]}</small>` : ''}</span></label>`).join('')}</div>
      <p class="disclaimer">كل طفل له سرعته؛ التأخر البسيط طبيعي غالباً، لكن ناقشي أي قلق مع الطبيب.</p>`;
  },

  momcare() {
    const last = S.moodChecks[S.moodChecks.length - 1];
    const sc = route.moodRes;
    return `<div class="card"><h3>✅ قائمة التعافي</h3>${MOM_RECOVERY.map((r, i) => `<label class="check ${S.recovery[i] ? 'done' : ''}"><input type="checkbox" data-rec="${i}" ${S.recovery[i] ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>
      <div class="card"><h3>💗 كيف حالك النفسية؟ (آخر أسبوعين)</h3>${MOOD_Q.map((q, i) => `<div class="mood-q"><div>${q}</div><div class="seg">${['أبداً', 'أحياناً', 'كثيراً'].map((a, v) => `<button data-mq="${i}" data-mv="${v}" class="${(route.mq || {})[i] === v ? 'on' : ''}">${a}</button>`).join('')}</div></div>`).join('')}
        <button class="btn block" id="mqSave">النتيجة</button>
        ${sc != null ? `<div class="card result lv-${sc >= 5 ? 'high' : 'ok'}" style="margin:12px 0 0">${sc >= 5 ? '<b>📞 ما تمرين به يستحق الدعم.</b><p style="margin:6px 0 0">اكتئاب ما بعد الولادة شائع وقابل للعلاج. تحدثي مع طبيبك هذا الأسبوع، وأخبري زوجك أو شخصاً قريباً. لو جاءتك أفكار لإيذاء نفسك أو طفلك اطلبي المساعدة فوراً.</p>' : '<b>💚 تبدين بخير.</b><p style="margin:6px 0 0">كآبة بسيطة في أول أسبوعين طبيعية. ارتاحي واقبلي المساعدة.</p>'}</div>` : last ? `<p class="muted">آخر تقييم: ${fmtShort.format(parse(last.date))}</p>` : ''}</div>
      <div class="card"><h3>🤱 الرضاعة الطبيعية</h3><ul class="list"><li>رضّعي عند الطلب 8–12 مرة يومياً.</li><li>الوضع الصحيح: فم الطفل يغطي الهالة، وليس الحلمة فقط.</li><li>اشربي ماءً كثيراً، وكُلي 500 سعرة إضافية.</li><li>ألم شديد أو احمرار وحرارة في الثدي = راجعي الطبيب (التهاب).</li></ul></div>`;
  },

  babywarn() {
    return `<div class="card warn-card"><h2>🚨 اذهبي للطوارئ أو اتصلي بالطبيب فوراً عند:</h2>${BABY_WARNINGS.map(([e, t, d]) => `<div class="item-row"><div class="em">${e}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</div>`;
  }
});

function partnerMsg(st, pt, w) {
  return `💗 تحديث الأسبوع ${st.week} من رحلتنا
👶 بيبي دلوقتي بحجم ${w.size} (${w.len}، ${w.wt})
✨ ${w.baby[0]}
🤰 أنا حاسة بـ: ${pt.feel}
🙏 ممكن تساعدني في:
${pt.help.map(h => '• ' + h).join('\n')}
⏳ فاضل ${Math.max(0, st.left)} يوم على ميعاد الولادة (${fmtDate.format(st.due)})`;
}
function fileText() {
  const st = status(), m = S.med, tri = st.tri;
  const lat = Object.values(latestLabs()).map(l => { const t = LAB_TESTS.find(x => x.k === l.k); return `- ${t.n}: ${l.v} ${t.u} (${LAB_STATUS[t.check(+l.v, tri).s][0]})`; }).join('\n');
  return `ملف الحمل — ${S.profile.name || ''}
عمر الحمل: الأسبوع ${st.week} — الولادة المتوقعة ${iso(st.due)}
فصيلة الدم: ${(m.blood || '—') + (m.rh || '')}
حالات: ${m.conditions || '—'} | أدوية: ${m.meds || '—'} | حساسية: ${m.allergies || '—'}
آخر التحاليل:
${lat || '—'}`;
}

/* ---------- المساعد ---------- */
function viewAssist() {
  const chat = S.chat;
  const sug = S.baby ? ['ابني بيعيط كتير بالليل', 'إمتى أبدأ الأكل الصلب؟', 'حرارة 38 لطفل عمره شهرين', 'إزاي أعرف إن الرضاعة كفاية؟']
    : ['إيه معنى نتيجة تحاليلي؟', 'أقدر أصوم رمضان؟', 'هل الحلبة آمنة؟', 'إيه اللي يحصل لبيبي الأسبوع ده؟', 'عندي صداع وتورم في رجلي'];
  return `<div class="assist">
    <div class="card hero-soft"><div class="row"><span class="big-ic">✨</span><div class="grow"><b>نبض — رفيقتك الذكية</b><div class="muted">${AI.sample ? 'تعرف أسبوعك وتحاليلك وأعراضك، وتجاوبك عليكِ أنتِ.' : 'وضع بدون اتصال: إجابات من دليل التطبيق. المساعد الذكي الكامل متاح داخل نسخة Claude.'}</div></div></div></div>
    <div id="chat">${chat.length ? chat.map(m => `<div class="bubble ${m.role}">${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('') : `<div class="chips">${sug.map(s => `<button class="chip" data-sug="${esc(s)}">${s}</button>`).join('')}</div>`}</div>
    <form class="ask-row sticky-ask" id="askForm"><input class="input" id="askQ" placeholder="اكتبي سؤالك…" autocomplete="off" value="${esc(route.q || '')}"><button class="btn" id="askSend" aria-label="إرسال">↖</button></form>
    ${chat.length ? '<button class="link" id="chatClear">مسح المحادثة</button>' : ''}
    <p class="disclaimer">نبض للتثقيف ولا تغني عن الطبيب. في الطوارئ اتصلي بالإسعاف 123.</p></div>`;
}
let askBusy = false;
async function ask(q) {
  if (!q || askBusy) return;
  askBusy = true;
  S.chat.push({ role: 'user', content: q }); save();
  route.q = ''; render(false);
  const box = $('#chat'), b = document.createElement('div');
  b.className = 'bubble assistant'; b.textContent = 'نبض تفكر…'; box.appendChild(b); b.scrollIntoView({ block: 'end' });
  let text = '';
  if (AI.sample) {
    const turns = [{ role: 'user', content: `${AI_RULES}\n\nبيانات المستخدمة:\n${contextText()}\n\n(ابدئي المحادثة)` }, { role: 'assistant', content: 'تمام، أنا جاهزة.' }, ...S.chat.slice(-10)];
    try {
      const r = await AI.sample(turns, { cache: false, onText: ({ text: t }) => { b.textContent = t; } });
      text = r.text;
    } catch (e) {
      text = e.code === 'not_granted' ? offlineAnswer(q) : (e.text || 'تعذّر الوصول للمساعد الآن. ') + (e.code === 'rate_limited' ? 'جرّبي بعد قليل.' : '');
      if (e.code === 'not_granted') AI.sample = null;
    }
  } else text = offlineAnswer(q);
  S.chat.push({ role: 'assistant', content: text }); save();
  askBusy = false; render(false);
  const c = $('#chat'); if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'end' });
}

async function readLabPhoto(file) {
  const out = $('#labAiOut'); out.innerHTML = '<p class="muted">جاري قراءة التحليل… قد يستغرق دقيقة.</p>';
  try {
    const keys = LAB_TESTS.map(t => `${t.k}: ${t.n} (${t.u})`).join('\n');
    const r = await AI.sample.json(`هذه صورة ورقة تحاليل طبية لامرأة حامل. استخرجي القيم الموجودة فقط من هذه القائمة:\n${keys}\nللزلال في البول: 0 سلبي، 1 آثار، 2 ++، 3 +++. حوّلي الوحدات إلى المذكورة (مثلاً الصفائح إلى آلاف).\nأعيدي فقط مصفوفة JSON مثل: [{"k":"hb","v":10.8,"date":"2026-05-01"}] — date إن وُجد في الورقة، وإلا اتركيه فارغاً. إن لم تجدي شيئاً أعيدي [].`, { images: file, modelTier: 'default' });
    const found = (Array.isArray(r) ? r : []).filter(x => LAB_TESTS.some(t => t.k === x.k) && isFinite(+x.v));
    if (!found.length) { out.innerHTML = '<p class="muted">لم نجد قيماً واضحة — أدخليها يدوياً.</p>'; return; }
    route.pending = found.map(x => ({ k: x.k, v: +x.v, date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : iso(today()) }));
    render(false);
  } catch (e) {
    out.innerHTML = `<p class="muted">${e.code === 'not_granted' ? 'لم يتم السماح للمساعد.' : 'تعذّرت قراءة الصورة — أدخلي القيم يدوياً.'}</p>`;
  }
}

/* ---------- ربط الأحداث ---------- */
function featBind() {
  const on = (id, fn, ev = 'onclick') => { const el = $(id); if (el) el[ev] = fn; };
  const t = iso(today());
  fillIdbImages();

  // سؤال سريع من الرئيسية
  on('#homeAsk', e => { e.preventDefault(); const q = $('#homeAskQ').value.trim(); if (!q) return; go('assist'); ask(q); }, 'onsubmit');
  on('#askForm', e => { e.preventDefault(); ask($('#askQ').value.trim()); }, 'onsubmit');
  app.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => ask(b.dataset.sug));
  on('#chatClear', confirmTap('#chatClear', () => { S.chat = []; save(); render(false); }));

  // الفحص اليومي
  app.querySelectorAll('[data-csym]').forEach(b => b.onclick = () => b.classList.toggle('on'));
  app.querySelectorAll('[data-cmood]').forEach(b => b.onclick = () => { app.querySelectorAll('[data-cmood]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  on('#cSave', () => {
    const c = { date: t, sys: $('#cSys').value, dia: $('#cDia').value, syms: [...app.querySelectorAll('[data-csym].on')].map(b => b.dataset.csym), mood: app.querySelector('[data-cmood].on')?.dataset.cmood || '' };
    if ((c.sys && !(+c.sys > 60 && +c.sys < 250)) || (c.dia && !(+c.dia > 30 && +c.dia < 160))) return toast('تأكدي من أرقام الضغط');
    S.checks = S.checks.filter(x => x.date !== t).concat(c); save(); route.res = true; history.replaceState(route, ''); render();
  });

  // التحاليل
  on('#lAdd', () => {
    const k = $('#lK').value, v = parseFloat($('#lV').value), d = $('#lD').value;
    if (!isFinite(v) || !d) return toast('أدخلي النتيجة والتاريخ');
    S.labs.push({ id: Date.now().toString(36), k, v, date: d }); save(); toast('تم الحفظ'); render(false);
  });
  app.querySelectorAll('[data-labdel]').forEach(b => b.onclick = () => { S.labs = S.labs.filter(x => x.id !== b.dataset.labdel); save(); render(false); });
  on('#labPhoto', e => { const f = e.target.files[0]; if (f) readLabPhoto(f); }, 'onchange');
  on('#pendSave', () => {
    const keep = [...app.querySelectorAll('[data-pend]')].filter(c => c.checked).map(c => route.pending[+c.dataset.pend]);
    keep.forEach((p, i) => S.labs.push({ id: Date.now().toString(36) + i, k: p.k, v: p.v, date: p.date }));
    route.pending = null; save(); toast(`تم حفظ ${keep.length} نتائج`); render(false);
  });
  on('#pendCancel', () => { route.pending = null; render(false); });

  // البيانات الطبية والملف
  on('#medSave', () => {
    ['blood', 'rh', 'conditions', 'meds', 'allergies', 'prev', 'doctor', 'docPhone', 'hospital', 'partnerPhone'].forEach(k => { const el = $('#m_' + k); if (el) S.med[k] = el.value.trim(); });
    save(); toast('تم الحفظ'); history.back();
  });
  on('#filePrint', () => window.print());
  on('#fileDl', async () => {
    const dl = await window.claude?.use?.('downloads').catch(() => null);
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>ملف الحمل</title><style>body{font-family:system-ui;padding:24px;max-width:760px;margin:auto}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:right}</style>${$('#report').innerHTML}</html>`;
    if (!dl) return toast('التنزيل غير متاح هنا — استخدمي مشاركة واتساب');
    dl.save({ filename: 'ملف-الحمل.html', data: new Blob([html], { type: 'text/html' }) }).catch(() => {});
  });

  // الزوج
  on('#pMsg', e => { $('#pSend').href = waLink(e.target.value, S.med.partnerPhone); }, 'oninput');

  // الأكل المحلي
  on('#lfQ', e => { route.q = e.target.value; const pos = e.target.selectionStart; render(false); const i = $('#lfQ'); i.focus(); i.setSelectionRange(pos, pos); }, 'oninput');
  app.querySelectorAll('[data-lf]').forEach(b => b.onclick = () => { route.ff = b.dataset.lf; render(false); });

  // الألبوم والرسائل
  app.querySelectorAll('[data-bump]').forEach(inp => inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; const d = await shrink(f); if (!d) return toast('تعذّر قراءة الصورة');
    await IDB.put('bump-' + inp.dataset.bump, d); toast('تم حفظ صورة الأسبوع ' + inp.dataset.bump); render(false);
  });
  on('#babyPhoto', async e => { const f = e.target.files[0]; if (!f) return; const d = await shrink(f); if (d) { await IDB.put('baby-photo', d); render(false); } }, 'onchange');
  on('#letterAdd', () => {
    const tx = $('#letterT').value.trim(); if (!tx) return;
    S.letters.push({ id: Date.now().toString(36), date: t, week: S.baby ? null : status().week, text: tx }); save(); toast('حُفظت رسالتك 💌'); render(false);
  });
  app.querySelectorAll('[data-letdel]').forEach(b => b.onclick = () => { S.letters = S.letters.filter(l => l.id !== b.dataset.letdel); save(); render(false); });
  on('#playAlbum', async () => {
    const keys = (await IDB.keys()).filter(k => String(k).startsWith('bump-')).sort((a, b) => +a.slice(5) - +b.slice(5));
    if (!keys.length) return toast('أضيفي صوراً أولاً');
    const pl = $('#player'), img = $('#playImg'), cap = $('#playCap'); pl.hidden = false; let i = 0;
    const step = async () => { const v = await IDB.get(keys[i]); img.src = v; cap.textContent = 'الأسبوع ' + keys[i].slice(5); i = (i + 1) % keys.length; };
    step(); const iv = setInterval(step, 1200); timers.push(iv);
    $('#playClose').onclick = () => { clearInterval(iv); pl.hidden = true; };
  });

  // الولادة
  app.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { app.querySelectorAll('[data-sex]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  on('#bSave', () => {
    const d = $('#bDate').value; if (!d) return toast('أدخلي تاريخ الولادة');
    S.baby = { name: $('#bName').value.trim(), sex: app.querySelector('[data-sex].on').dataset.sex, date: d, type: $('#bType').value, weight: $('#bW').value, length: $('#bL').value };
    if (S.baby.weight) S.growth = S.growth.filter(g => g.date !== d).concat({ date: d, kg: +S.baby.weight, cm: +S.baby.length || null });
    save(); route = { view: 'home' }; history.replaceState(route, ''); toast('مبروك 🎉'); render();
  });
  on('#bUndo', confirmTap('#bUndo', () => { S.baby = null; save(); route = { view: 'home' }; render(); }));

  // اختصارات الطفل
  app.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => {
    const k = b.dataset.quick, now = Date.now();
    if (k === 'feed') { go(route.view, 'feeds'); return; }
    if (k === 'wet' || k === 'dirty') { S.diapers.push({ t: now, k }); toast(k === 'wet' ? '💧 سُجّل' : '💩 سُجّل'); }
    if (k === 'sleep') { const l = S.sleeps[S.sleeps.length - 1]; if (l && !l.end) { l.end = now; toast('صباح الخير ☀️'); } else { S.sleeps.push({ t: now }); toast('نوماً هادئاً 😴'); } }
    save(); render(false);
  });
  app.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => {
    if (b.dataset.feed === 'B') { route.bottle = true; route.feedTimer = null; render(false); return; }
    route.bottle = false; route.feedTimer = { side: b.dataset.feed, t: Date.now() }; history.replaceState(route, ''); render(false);
  });
  if ($('#feedTime') && route.feedTimer) {
    const tick = () => { const s = Math.floor((Date.now() - route.feedTimer.t) / 1000); const el = $('#feedTime'); if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    tick(); timers.push(setInterval(tick, 1000));
  }
  on('#feedStop', () => { const f = route.feedTimer; S.feeds.push({ t: f.t, side: f.side, min: (Date.now() - f.t) / 60000 }); route.feedTimer = null; save(); toast('تم تسجيل الرضعة'); render(false); });
  on('#mlSave', () => { const ml = +$('#mlIn').value; if (!(ml > 0)) return; S.feeds.push({ t: Date.now(), side: 'B', ml }); route.bottle = false; save(); render(false); });

  // النمو والتطعيمات والمراحل
  on('#gAdd', () => {
    const d = $('#gD').value, kg = +$('#gW').value, cm = +$('#gL').value;
    if (!d || !(kg > 1 && kg < 30)) return toast('أدخلي وزناً صحيحاً');
    S.growth = S.growth.filter(g => g.date !== d).concat({ date: d, kg, cm: cm || null }); save(); render(false);
  });
  app.querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => { S.growth = S.growth.filter(g => g.date !== b.dataset.gdel); save(); render(false); });
  app.querySelectorAll('[data-vax]').forEach(b => b.onchange = () => { S.vax[b.dataset.vax] = b.checked; save(); render(false); });
  app.querySelectorAll('[data-mile]').forEach(b => b.onchange = () => { S.miles[b.dataset.mile] = b.checked ? t : false; save(); render(false); });
  app.querySelectorAll('[data-rec]').forEach(b => b.onchange = () => { S.recovery[b.dataset.rec] = b.checked; save(); render(false); });
  app.querySelectorAll('[data-mq]').forEach(b => b.onclick = () => { route.mq = { ...(route.mq || {}), [b.dataset.mq]: +b.dataset.mv }; render(false); });
  on('#mqSave', () => {
    const a = route.mq || {}; if (Object.keys(a).length < MOOD_Q.length) return toast('أجيبي على كل الأسئلة');
    const sc = Object.values(a).reduce((x, y) => x + y, 0); S.moodChecks.push({ date: t, score: sc }); route.moodRes = sc; save(); render(false);
  });
}
