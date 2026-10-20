/* نبضٌ صغير — الإعداد أول مرة على خطوات: ترحيب ← التقويم ← طريقة الحساب ← التاريخ ← بياناتك ← النتيجة ← الإشعارات ← الحساب (اختياري)
   التقدّم محفوظ في S.onb، فلو أُغلق التطبيق في المنتصف تعود لنفس الخطوة. */
'use strict';

const Onb = (() => {
  let dir = 'fwd';
  const st0 = () => S.onb || (S.onb = { step: 'welcome', hist: [] });
  const steps = () => ['cal', 'method', 'date', 'info', 'result', 'notify', ...(Account.available() ? ['login'] : [])];
  const born = o => o.method === 'born';
  const defDate = m => iso(addDays(today(), { lmp: -70, conception: -56, ivf: -50, due: 180, born: -14 }[m] || -70));
  const bounds = m => m === 'born' ? [iso(addDays(today(), -730)), iso(today())] : dateBounds(m === 'due' ? 'due' : 'lmp');

  function go(step) { const o = st0(); o.hist.push(o.step); o.step = step; dir = 'fwd'; save(); render(); }
  function back() { const o = st0(); if (!o.hist.length) return; o.step = o.hist.pop(); dir = 'back'; save(); render(); }

  // الملف الشخصي الناتج من اختيارات الإعداد
  function profileOf(o) {
    const p = { method: o.method, name: o.name || '', babyName: o.babyName || '', cycle: o.cycle || 28, ivfDay: o.ivfDay || 5 };
    if (o.method === 'born') return { ...p, method: 'due', due: o.date, babyName: (o.baby && o.baby.name) || p.babyName };
    p[o.method] = o.date;
    return p;
  }
  function calc(o) {
    const old = S.profile; S.profile = profileOf(o);
    try { const st = status(); return { st, bad: st.left < -21 || st.left > 300 }; } finally { S.profile = old; }
  }

  /* ---------- الشاشات ---------- */
  const card = (attr, on, ic, title, sub) => `<button class="onb-card ${on ? 'on' : ''}" ${attr}><span class="onb-ic">${ic}</span><span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="onb-tick">✓</span></button>`;
  const V = {
    welcome: () => `<div class="onb-hero">
        <div class="onb-lang chips" role="group" aria-label="Language">${I18N.LANGS.map(l => `<button class="chip ${l.c === I18N.lang ? 'on' : ''}" data-lang="${l.c}" lang="${l.c}">${l.n}</button>`).join('')}</div>
        <img class="onb-hero-img" src="${Photos.src(24)}" alt="">
        <div class="onb-hero-body">
          <img class="onb-logo" src="icons/icon.svg" alt="${APP_NAME}">
          <h1>${APP_NAME}</h1>
          <p>${L`نرافقكِ في رحلة الـ 9 أشهر… وما بعدها 💗`}</p>
          <button class="btn block big" id="onbStart">${L`لنبدأ الرحلة`}</button>
          ${Account.available() ? `<button class="link onb-login" id="onbLogin">${L`لديّ حساب – تسجيل الدخول`}</button>` : ''}
        </div></div>`,

    cal: o => `<h2>${L`بأي تقويم تفضّلين التواريخ؟`}</h2><p class="muted">${L`يمكنك تغييره لاحقاً من الإعدادات.`}</p>
      ${card('data-ocal="gregorian"', o.cal === 'gregorian', '📅', L('ميلادي'), Cal.greg(today()))}
      ${Cal.ok ? card('data-ocal="hijri"', o.cal === 'hijri', '🌙', L('هجري'), L`${Cal.hijri(today())} · تقويم أم القرى`) : ''}`,

    method: o => `<h2>${L`كيف نحسب موعد الولادة؟`}</h2><p class="muted">${L`اختاري ما تعرفينه، وسنحسب الباقي.`}</p>
      ${card('data-om="lmp"', o.method === 'lmp', '🩸', L('أول يوم في آخر دورة'), L('الطريقة الأشهر عند الأطباء'))}
      ${card('data-om="conception"', o.method === 'conception' || o.method === 'ivf', '🧬', L('تاريخ الإخصاب أو أطفال الأنابيب'), L('الإباضة أو إرجاع الأجنة'))}
      ${card('data-om="due"', o.method === 'due', '🗓️', L('أعرف موعد الولادة'), L('من الطبيب أو السونار'))}
      ${card('data-om="born"', born(o), '👶', L('وُلد طفلي'), L('ابدئي متابعة الطفل حتى عمر سنتين'))}`,

    date: o => {
      const t = { lmp: L('متى بدأت آخر دورة شهرية؟'), conception: L('متى كان الإخصاب؟'), ivf: L('متى كان إرجاع الأجنة؟'), due: L('متى موعد الولادة؟'), born: L('متى وُلد طفلك؟') }[o.method];
      const extra = o.method === 'lmp' ? `<div class="onb-stepper"><span>${L`طول الدورة`}</span><button class="icon-btn sm" data-cyc="-1" aria-label="${L`أقل`}">−</button><b>${L`${o.cycle || 28} يوماً`}</b><button class="icon-btn sm" data-cyc="1" aria-label="${L`أكثر`}">+</button></div>`
        : o.method === 'conception' || o.method === 'ivf' ? `<div class="seg" id="onbConc"><button data-oc="conception" class="${o.method === 'conception' ? 'on' : ''}">${L`إخصاب طبيعي`}</button><button data-oc="ivf" class="${o.method === 'ivf' ? 'on' : ''}">${L`أطفال الأنابيب`}</button></div>
          ${o.method === 'ivf' ? `<div class="seg">${[3, 5, 6].map(d => `<button data-ivd="${d}" class="${(o.ivfDay || 5) === d ? 'on' : ''}">${L`جنين اليوم ${d}`}</button>`).join('')}</div>` : ''}`
        : born(o) ? `<label class="f">${L`اسم طفلك (اختياري)`}<input id="onbBabyName" value="${esc((o.baby && o.baby.name) || '')}" placeholder="${L`مثال: يوسف`}"></label>
          <div class="seg" id="onbSex"><button data-osex="girl" class="${(o.baby && o.baby.sex) === 'girl' ? 'on' : ''}">${L`👧 بنت`}</button><button data-osex="boy" class="${(o.baby && o.baby.sex) !== 'girl' ? 'on' : ''}">${L`👦 ولد`}</button></div>` : '';
      return `<h2>${t}</h2>${o.method === 'conception' || o.method === 'ivf' ? extra : ''}
        <div class="wheel big" id="onbWheel"></div>
        ${o.method === 'lmp' || born(o) ? extra : ''}
        <div class="card onb-live" id="onbLive">${live(o)}</div>`;
    },

    info: o => `<h2>${L`عرّفينا بكِ`} <small class="muted">${L`(اختياري)`}</small></h2>
      <label class="f">${L`اسمك`}<input id="onbName" value="${esc(o.name || '')}" placeholder="${L`مثال: سارة`}" maxlength="30"></label>
      ${born(o) ? '' : `<label class="f">${L`اسم الجنين أو لقبه`}<input id="onbBaby" value="${esc(o.babyName || '')}" placeholder="${L`مثال: نونو`}" maxlength="30"></label>`}
      <label class="f">${L`بلدك`}<select id="onbCountry">${COUNTRIES.map(c => `<option value="${c.c}" ${(o.country || S.country || guessCountry()) === c.c ? 'selected' : ''}>${c.f} ${c.n}</option>`).join('')}</select></label>
      <p class="muted">${L`البلد يضبط رقم الإسعاف ووحدات التحاليل.`}</p>`,

    result: o => {
      if (born(o)) {
        const d = diffDays(today(), parse(o.date)), b = o.baby || {};
        return `<div class="onb-result"><div class="onb-big">🎉</div><h2>${L`مبروك! ${esc(b.name || (b.sex === 'girl' ? L('بنتك') : L('طفلك')))}`}</h2>
          <p>${L`عمره اليوم`} <b>${d < 60 ? arWeeks(Math.floor(d / 7)) || arDays(d) : L`${Math.floor(d / 30.44)} شهراً`}</b>${L`، وسنرافقك شهراً بشهر حتى عمر سنتين.`}</p>
          <p class="muted">${L`وُلد في ${Cal.both(parse(o.date))}`}</p><button class="link" id="onbEdit">${L`تعديل`}</button></div>`;
      }
      const { st } = calc(o);
      return `<div class="onb-result">
        <div class="onb-ring"><b>${st.week}</b><small>${L`الأسبوع`}</small></div>
        <h2>${L`وفقاً لحساباتنا أنتِ حامل في الأسبوع ${st.week}`} <span class="muted">${L`(الشهر ${MONTHS_ORD[st.month - 1]})`}</span></h2>
        <div class="card"><small class="muted">${L`موعد الولادة المتوقع`}</small><div class="onb-due">${Cal.both(st.due)}</div></div>
        <button class="link" id="onbEdit">${L`تعديل`}</button></div>`;
    },

    notify: () => `<div class="onb-center">
        <svg class="onb-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="var(--soft)"/><path d="M60 26c-13 0-22 10-22 23v15l-7 10h58l-7-10V49c0-13-9-23-22-23z" fill="var(--primary)"/><circle cx="60" cy="86" r="7" fill="var(--primary)"/><circle cx="84" cy="34" r="9" fill="var(--gold)"/></svg>
        <h2>${L`ابقي على اطلاع بكل ما يهمك`}</h2>
        <ul class="onb-list"><li>${L`📅 إشعار مع بداية كل أسبوع جديد`}</li><li>${L`💡 معلومة يومية الساعة 9 صباحاً`}</li><li>${L`💧 تذكير بشرب الماء`}</li><li>${L`💊 تذكير الفيتامين أو الدواء`}</li></ul>
        <p class="muted">${L`يمكنك ضبطها أو إيقافها في أي وقت من الإعدادات.`}</p></div>`,

    login: () => `<div class="onb-center">
        <svg class="onb-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="var(--soft)"/><path d="M38 80h46a16 16 0 0 0 0-32 22 22 0 0 0-42-5 14 14 0 0 0-4 37z" fill="var(--primary)"/><path d="m50 62 7 7 14-14" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h2>${L`احفظي بياناتك على السحابة`}</h2>
        <ul class="onb-list"><li>${L`☁️ نسخة احتياطية تلقائية`}</li><li>${L`📱 استرجاع كل شيء على جهاز جديد`}</li><li>${L`👩 نفس اسمك في مجتمع الأمهات`}</li></ul>
        <p class="muted">${L`اختياري تماماً — كل الميزات تعمل بدون حساب.`}</p>
        <div id="onbGoogle" class="g-slot"></div></div>`
  };

  function live(o) {
    if (born(o)) return `<small class="muted">${L`تاريخ الميلاد`}</small><b>${Cal.both(parse(o.date))}</b>`;
    const { st, bad } = calc(o);
    if (bad) return `<b style="color:var(--warn)">${L`⚠️ التاريخ غير منطقي، تأكدي منه.`}</b>`;
    return `<small class="muted">${L`موعد الولادة المتوقع`}</small><b>${Cal.both(st.due)}</b>
      <span class="muted">${st.left >= 0 ? L`باقٍ لكِ ${arWeeks(Math.max(0, 40 - st.week)) || L('أقل من أسبوع')} للأسبوع 40` : L('تجاوزتِ موعد الولادة')}</span>`;
  }

  const FOOT = {
    welcome: '', cal: '', method: '',
    date: o => `<button class="btn block big" id="onbNext" ${!born(o) && calc(o).bad ? 'disabled' : ''}>${L`التالي`}</button>`,
    info: () => `<button class="btn block big" id="onbNext">${L`التالي`}</button><button class="link onb-skip" id="onbSkip">${L`تخطّي`}</button>`,
    result: () => `<button class="btn block big" id="onbNext">${L`التالي`}</button>`,
    notify: () => `<button class="btn block big" id="onbNotify">${L`ابدئي بتفعيل الإشعارات`}</button><button class="link onb-skip" id="onbLater">${L`لاحقاً`}</button>`,
    login: () => `<button class="link onb-skip" id="onbGuest">${L`المتابعة كضيفة`}</button>`
  };

  function render() {
    const o = st0();
    document.body.classList.add('onb-mode');
    $('#backBtn').hidden = true;
    const list = steps(), i = list.indexOf(o.step);
    if (o.step !== 'welcome' && i < 0) { o.step = 'welcome'; o.hist = []; }
    const head = o.step === 'welcome' ? '' : `<div class="onb-head">
      <button class="icon-btn" id="onbBack" aria-label="${L`رجوع`}" ${o.hist.length ? '' : 'disabled'}>→</button>
      <div class="onb-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${list.length}" aria-valuenow="${i + 1}">${list.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>
      <span class="icon-btn ghost-slot"></span></div>`;
    const foot = typeof FOOT[o.step] === 'function' ? FOOT[o.step](o) : '';
    app.innerHTML = `<div class="onb onb-${o.step}">${head}<div class="onb-body ${REDUCED ? '' : 'in-' + dir}">${V[o.step](o)}</div>${foot ? `<div class="onb-foot">${foot}</div>` : ''}</div>`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    bindStep(o);
  }

  function finish() {
    delete S.onb; S.news12 = 1; save();
    route = { view: 'home' }; history.replaceState(route, ''); render0();
  }
  const render0 = () => window.render();

  // نثبّت البيانات قبل خطوة الإشعارات حتى تُجدول على الموعد الصحيح
  function commit(o) {
    S.profile = profileOf(o);
    S.country = o.country || S.country || guessCountry();
    if (o.cal) S.calendar = o.cal;
    if (born(o)) S.baby = { name: (o.baby && o.baby.name) || '', sex: (o.baby && o.baby.sex) || 'boy', date: o.date, type: '', weight: '', length: '' };
    save();
  }

  function bindStep(o) {
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#onbBack', back);
    on('#onbStart', () => { o.cal = o.cal || (Cal.ok && I18N.lang === 'ar' && guessCountry() === 'SA' ? 'hijri' : 'gregorian'); go('cal'); });
    app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang !== I18N.lang) I18N.set(b.dataset.lang); });
    on('#onbLogin', () => Account.signIn({ from: 'welcome' }));
    app.querySelectorAll('[data-ocal]').forEach(b => b.onclick = () => { o.cal = b.dataset.ocal; S.calendar = o.cal; b.classList.add('on'); setTimeout(() => go('method'), 160); });
    app.querySelectorAll('[data-om]').forEach(b => b.onclick = () => {
      const m = b.dataset.om;
      if (m !== o.method && !(m === 'conception' && o.method === 'ivf')) { o.method = m; o.date = defDate(m); }
      b.classList.add('on'); setTimeout(() => go('date'), 160);
    });
    const w = $('#onbWheel');
    if (w) {
      const [min, max] = bounds(o.method);
      datePicker(w, { cal: Cal.mode(), value: o.date || defDate(o.method), min, max, onChange: v => {
        o.date = v; save(); $('#onbLive').innerHTML = live(o);
        const n = $('#onbNext'); if (n) n.disabled = !born(o) && calc(o).bad;
      } });
      if (!o.date) { o.date = w._picker.value(); save(); }
    }
    app.querySelectorAll('[data-cyc]').forEach(b => b.onclick = () => { o.cycle = Math.max(20, Math.min(45, (o.cycle || 28) + +b.dataset.cyc)); save(); render(); });
    app.querySelectorAll('[data-oc]').forEach(b => b.onclick = () => { o.method = b.dataset.oc; save(); render(); });
    app.querySelectorAll('[data-ivd]').forEach(b => b.onclick = () => { o.ivfDay = +b.dataset.ivd; save(); render(); });
    app.querySelectorAll('[data-osex]').forEach(b => b.onclick = () => { o.baby = { ...(o.baby || {}), sex: b.dataset.osex }; save(); app.querySelectorAll('[data-osex]').forEach(x => x.classList.toggle('on', x === b)); });
    const bn = $('#onbBabyName'); if (bn) bn.oninput = () => { o.baby = { ...(o.baby || {}), name: bn.value.trim() }; save(); };
    const readInfo = () => { if ($('#onbName')) { o.name = $('#onbName').value.trim(); o.babyName = $('#onbBaby') ? $('#onbBaby').value.trim() : o.babyName; o.country = $('#onbCountry').value; } };
    on('#onbNext', () => {
      if (o.step === 'date') return go('info');
      if (o.step === 'info') { readInfo(); save(); return go('result'); }
      if (o.step === 'result') { commit(o); return go('notify'); }
    });
    on('#onbSkip', () => { o.country = o.country || $('#onbCountry').value; save(); go('result'); });
    on('#onbEdit', back);
    const after = () => steps().includes('login') ? go('login') : finish();
    on('#onbNotify', async () => {
      S.notify = true; save();
      const ok = await Notify.sync(true);
      toast(ok ? L('تم تفعيل الإشعارات 🔔') : Notify.native() ? L('يمكنك السماح بالإشعارات لاحقاً من الإعدادات') : L('تعمل الإشعارات في تطبيق الموبايل'));
      after();
    });
    on('#onbLater', after);
    on('#onbGuest', finish);
    if ($('#onbGoogle')) Account.button($('#onbGoogle'), { from: 'onboarding' });
  }

  return { render, finish, go, state: st0 };
})();
