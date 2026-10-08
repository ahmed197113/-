/* نبضٌ صغير — مجتمع الأمهات: أسئلة وأجوبة بين مستخدمات التطبيق
   التخزين: قاعدة بيانات Claude المشتركة داخل نسخة Claude، أو Supabase في النسخة المستقلة (config.js) */
'use strict';

const CATS = [['all', 'الكل'], ['t1', 'الثلث الأول'], ['t2', 'الثلث الثاني'], ['t3', 'الثلث الثالث'], ['birth', 'الولادة'],
  ['bf', 'الرضاعة'], ['baby', 'الطفل'], ['sleep', 'النوم'], ['food', 'الأكل'], ['mental', 'نفسية'], ['other', 'عام']];
const catName = k => (CATS.find(c => c[0] === k) || CATS[CATS.length - 1])[1];
const URGENT_RE = /نزيف|ينزف|سائل ينزل|لا يتحرك|ما يتحرك|ما عم يتحرك|دم |دم$|نزل (مني )?ماء|نزلت مية|مش بيتحرك|مبيتحركش|حركته قلت|تشنج|ازرق|إغماء|اغماء|حرارة 3[89]|حرارته|مش بيتنفس|صعوبة (في )?التنفس|انتحار|أذي نفسي|اذي نفسي/;
const BLOCK_RE = /(https?:\/\/|www\.)|(\d[\s-]?){8,}/;

const CM = { mode: null, uid: null, canWrite: null, qs: [], loaded: false, loading: false, err: '', ans: {} };

/* ---------- المحوّل: Claude db ---------- */
const ClaudeStore = {
  async list() {
    const s = await CM.db.collection('community').orderBy('t', 'desc').limit(300).get();
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(q) { const r = await CM.db.collection('community').add(q); return r.id; },
  async answers(qid) {
    const s = await CM.db.collection(`community/${qid}/answers`).orderBy('t', 'asc').limit(300).get();
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async answer(qid, a) {
    await CM.db.collection(`community/${qid}/answers`).add(a);
    const q = await CM.db.doc(`community/${qid}`).get();
    if (q.exists) await CM.db.doc(`community/${qid}`).update({ ac: ((q.data().ac) || 0) + 1, lt: Date.now() });
  },
  async helpful(qid, aid) {
    const ref = CM.db.doc(`community/${qid}/answers/${aid}`), d = await ref.get();
    if (d.exists) await ref.update({ hp: (d.data().hp || 0) + 1 });
  },
  async report(r) { await CM.db.collection('reports').add(r); },
  async remove(qid) { await CM.db.doc(`community/${qid}`).delete(); }
};

/* ---------- المحوّل: Supabase (النسخة المستقلة) ---------- */
const SupaStore = {
  req(path, opt = {}) {
    const c = window.NABD_CONFIG;
    return fetch(`${c.supabaseUrl}/rest/v1/${path}`, {
      ...opt, headers: { apikey: c.supabaseKey, Authorization: `Bearer ${c.supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opt.headers || {}) }
    }).then(r => { if (!r.ok) throw new Error(r.status); return r.status === 204 ? null : r.json(); });
  },
  list() { return this.req('questions?select=*&order=t.desc&limit=300'); },
  async add(q) { const r = await this.req('questions', { method: 'POST', body: JSON.stringify(q) }); return r[0].id; },
  answers(qid) { return this.req(`answers?select=*&qid=eq.${encodeURIComponent(qid)}&order=t.asc&limit=300`); },
  async answer(qid, a) { await this.req('answers', { method: 'POST', body: JSON.stringify({ ...a, qid }) }); await this.req('rpc/inc_answers', { method: 'POST', body: JSON.stringify({ q: qid }) }); },
  helpful(qid, aid) { return this.req('rpc/inc_helpful', { method: 'POST', body: JSON.stringify({ a: aid }) }); },
  report(r) { return this.req('reports', { method: 'POST', body: JSON.stringify(r) }); },
  remove(qid) { return this.req(`questions?id=eq.${encodeURIComponent(qid)}&uid=eq.${encodeURIComponent(CM.uid)}`, { method: 'DELETE' }); }
};

/* ---------- المحوّل: سيرفرك الخاص (server/api/community.php) ---------- */
const ServerStore = {
  c: (action, body = {}) => Server.call('community.php', { action, ...body }),
  async list() { return (await this.c('list')).items; },
  async add(q) { return (await this.c('add', q)).id; },
  async answers(qid) { return (await this.c('answers', { qid })).items; },
  answer(qid, a) { return this.c('answer', { qid, ...a }); },
  helpful(qid, aid) { return this.c('helpful', { aid }); },
  report(r) { return this.c('report', { ref: r.ref }); },
  remove(qid) { return this.c('remove', { qid }); },
  aiAnswer(qid) { return this.c('ai_answer', { qid }); }
};

CM.ready = (async () => {
  try {
    if (window.claude && window.claude.use) {
      const db = await window.claude.use('db');
      if (db) {
        CM.db = db; CM.store = ClaudeStore; CM.mode = 'claude';
        const u = await window.claude.use('user');
        CM.uid = u ? await u.id() : null;
        CM.canWrite = u ? await u.can('data.write') : null;
      }
    }
  } catch { CM.mode = null; }
  if (!CM.mode && Server.on()) { CM.store = ServerStore; CM.mode = 'server'; CM.uid = 'me'; CM.canWrite = true; }
  if (!CM.mode && window.NABD_CONFIG && window.NABD_CONFIG.supabaseUrl) {
    if (!S.devId) { S.devId = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); save(); }
    CM.store = SupaStore; CM.mode = 'supabase'; CM.uid = S.devId; CM.canWrite = true;
  }
  if (route.view === 'assist' || route.sub === 'cq' || route.view === 'home') render(false);
})();

CM.load = async (force) => {
  // بعد فشل التحميل لا نعيد المحاولة تلقائياً مع كل رسم للشاشة (كان يسبب حلقة طلبات لا تنتهي) — زر 🔄 يعيدها
  if (!CM.mode || CM.loading || ((CM.loaded || CM.err) && !force)) return;
  CM.loading = true; CM.err = '';
  try { CM.qs = await CM.store.list(); CM.loaded = true; }
  catch (e) { CM.err = 'تعذّر تحميل المجتمع الآن. حاولي مرة أخرى.'; }
  CM.loading = false;
  if (route.view === 'assist' || route.sub === 'cq' || route.view === 'home') render(false);
};
CM.loadAnswers = async (qid, force) => {
  if (!force && CM.ans[qid]) return;
  CM.ans[qid] = CM.ans[qid] || null;
  try { CM.ans[qid] = await CM.store.answers(qid); } catch { CM.ans[qid] = []; toast('تعذّر تحميل الردود'); }
  if (route.sub === 'cq' && route.qid === qid) render(false);
};

const myStage = () => {
  const fl = S.country && S.country !== 'XX' ? countryOf(S.country).f + ' ' : '';
  return fl + myStage0();
};
const myStage0 = () => {
  if (S.baby) { const d = diffDays(today(), parse(S.baby.date)); return d < 60 ? `أم لطفل عمره ${Math.floor(d / 7)} أسابيع` : `أم لطفل عمره ${Math.floor(d / 30.44)} شهراً`; }
  return `حامل · الأسبوع ${status().week}`;
};
const myCat = () => S.baby ? 'baby' : ['t1', 't2', 't3'][status().tri - 1];
const timeAgo = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `منذ ${Math.floor(m / 60)} س` : `منذ ${Math.floor(m / 1440)} يوم`; };
const author = x => x.team ? 'فريق نبض 💗' : x.ai ? 'نبض ✨' : x.anon ? 'أم مجهولة' : (x.nick || 'أم');
const avatar = x => `<span class="av ${x.ai || x.team ? 'ai' : ''}">${x.team ? '💗' : x.ai ? '✨' : x.anon ? '🤍' : esc((x.nick || 'أ').trim()[0])}</span>`;
const subline = x => x.team ? (x.title ? 'سؤال شائع يصلنا كثيراً' : 'رد فريق نبض') : x.ai ? 'إجابة ذكية للتثقيف' : (x.stage || '');
function checkText(t, min, max) {
  if (t.length < min) return `اكتبي ${min} حروف على الأقل`;
  if (t.length > max) return `النص طويل (الحد ${max} حرف)`;
  if (BLOCK_RE.test(t)) return 'لحمايتك: ممنوع نشر أرقام هواتف أو روابط';
  return '';
}

/* ---------- الشاشات ---------- */
function viewCommunity() {
  if (!CM.mode) return `<div class="card hero-soft"><h2 style="margin:0">👩‍👩‍👧 مجتمع الأمهات</h2>
    <p style="margin:6px 0 0">${window.claude ? 'المجتمع يحتاج تسجيل الدخول وصلاحية المشاركة في هذه الصفحة.' : 'المجتمع يتفعّل بعد ربط سيرفر التطبيق (راجعي ملف COMMUNITY.md).'}</p></div>`;
  CM.load();
  const f = route.cf || 'all', q = (route.cq || '').trim(), tab = route.ct || 'all';
  let list = CM.qs.filter(x => (f === 'all' || x.cat === f) && (!q || (x.title + ' ' + x.body).includes(q)));
  if (tab === 'mine') list = list.filter(x => x.uid === CM.uid);
  if (tab === 'open') list = list.filter(x => !x.ac);
  return `
    <div class="row" style="margin-bottom:10px"><button class="btn grow" data-sub="cnew" ${CM.canWrite === false ? 'disabled' : ''}>✍️ اطرحي سؤالاً</button><button class="btn ghost" id="cmRefresh" aria-label="تحديث">🔄</button></div>
    ${CM.canWrite === false ? '<p class="muted">يمكنك القراءة فقط في هذه الصفحة.</p>' : ''}
    <input class="input" id="cmQ" placeholder="ابحثي في أسئلة الأمهات…" value="${esc(q)}" style="margin:0 0 10px">
    <div class="seg">${[['all', 'الكل'], ['open', 'بدون رد'], ['mine', 'أسئلتي']].map(([k, v]) => `<button data-ct="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div class="cat-strip">${CATS.map(([k, v]) => `<button class="chip ${f === k ? 'on' : ''}" data-cf="${k}">${v}</button>`).join('')}</div>
    ${CM.err ? `<div class="card warn-card">${CM.err}</div>` : ''}
    ${!CM.loaded && !CM.err ? '<p class="muted center">جاري التحميل…</p>' : list.length ? list.map(x => `
      <div class="card q-card" data-qid="${esc(x.id)}">
        <div class="q-head">${avatar(x)}<div class="grow"><b>${esc(author(x))}</b><div class="muted">${esc(subline(x))} · ${timeAgo(x.t)}</div></div><span class="st-chip" style="--c:var(--primary-2)">${catName(x.cat)}</span></div>
        <h3 style="margin:10px 0 4px">${esc(x.title)}</h3><p class="muted clamp">${esc(x.body)}</p>
        <div class="q-foot"><span>💬 ${x.ac || 0} ${x.ac === 1 ? 'رد' : 'ردود'}</span>${URGENT_RE.test(x.title + x.body) ? '<span class="st-chip" style="--c:#ef5350">قد تكون حالة طارئة</span>' : ''}</div>
      </div>`).join('') : `<div class="card center"><div style="font-size:2.4rem">🌸</div><p>${q || f !== 'all' || tab !== 'all' ? 'لا توجد أسئلة مطابقة.' : 'كوني أول من يسأل في المجتمع!'}</p></div>`}
    <p class="disclaimer">ردود الأمهات تجارب شخصية وليست نصيحة طبية. احترمي الجميع، ولا تنشري بيانات شخصية.</p>`;
}

Object.assign(SUBVIEWS, {
  cnew() {
    const d = route.draft || {};
    return `<div class="card"><label class="f">اسمك في المجتمع<input id="nNick" value="${esc(S.nick || '')}" placeholder="مثال: أم يوسف" maxlength="30"></label>
      <label class="check"><input type="checkbox" id="nAnon" ${d.anon ? 'checked' : ''}><span>انشري بدون اسم 🤍</span></label>
      <label class="f" style="margin-top:10px">التصنيف<select id="nCat">${CATS.slice(1).map(([k, v]) => `<option value="${k}" ${(d.cat || myCat()) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">سؤالك باختصار<input id="nTitle" maxlength="120" value="${esc(d.title || '')}" placeholder="مثال: متى شعرتنّ بأول حركة للجنين؟"></label>
      <label class="f">التفاصيل<textarea id="nBody" rows="5" maxlength="1500" placeholder="اكتبي التفاصيل حتى تستطيع الأمهات مساعدتك">${esc(d.body || '')}</textarea></label>
      <div id="nWarn"></div>
      <p class="muted" style="margin:0 0 10px">سيظهر مع سؤالك: «${esc(myStage())}»</p>
      <button class="btn block" id="nPost">نشر السؤال</button></div>
      <div class="card"><b>قواعد المجتمع</b><ul class="list"><li>الاحترام أولاً — لا تنمّر ولا أحكام.</li><li>لا أرقام هواتف ولا روابط ولا إعلانات.</li><li>التجارب الشخصية لا تغني عن الطبيب.</li><li>في الطوارئ لا تنتظري الردود — اذهبي للمستشفى.</li></ul></div>`;
  },

  cq() {
    const x = CM.qs.find(q => q.id === route.qid);
    if (!x) { CM.load(); return '<p class="muted center">جاري التحميل…</p>'; }
    if (CM.ans[x.id] === undefined) CM.loadAnswers(x.id);
    const ans = CM.ans[x.id], hasAi = (ans || []).some(a => a.ai);
    const sorted = (ans || []).slice().sort((a, b) => ((b.team || 0) - (a.team || 0)) || (b.ai - a.ai) || ((b.hp || 0) - (a.hp || 0)) || (a.t - b.t));
    return `${URGENT_RE.test(x.title + x.body) ? `<div class="card lv-danger"><b>🚨 لو الحالة طارئة لا تنتظري الردود</b><div>اذهبي لأقرب طوارئ أو اتصلي بالإسعاف (${emergencyNo()}).</div></div>` : ''}
      <div class="card"><div class="q-head">${avatar(x)}<div class="grow"><b>${esc(author(x))}</b><div class="muted">${esc(subline(x))} · ${timeAgo(x.t)}</div></div><span class="st-chip" style="--c:var(--primary-2)">${catName(x.cat)}</span></div>
        <h2 style="margin:12px 0 6px">${esc(x.title)}</h2><p style="white-space:pre-wrap;margin:0">${esc(x.body)}</p>
        <div class="row" style="margin-top:10px">${x.uid && x.uid === CM.uid ? '<button class="btn sm ghost" id="qDel">حذف سؤالي</button>' : `<button class="link" data-report="q:${esc(x.id)}">🚩 إبلاغ</button>`}</div></div>
      ${!hasAi && AI.chat && ans ? '<button class="btn ghost block" id="aiAns" style="margin-bottom:14px">✨ اطلبي رأي نبض في هذا السؤال</button>' : ''}
      <h3>${ans ? `${ans.length} ${ans.length === 1 ? 'رد' : 'ردود'}` : 'جاري تحميل الردود…'}</h3>
      ${sorted.map(a => `<div class="card a-card ${a.ai ? 'ai' : ''}"><div class="q-head">${avatar(a)}<div class="grow"><b>${esc(author(a))}</b><div class="muted">${esc(subline(a))} · ${timeAgo(a.t)}</div></div></div>
        <p style="white-space:pre-wrap;margin:10px 0 6px">${esc(a.body)}</p>
        <div class="row"><button class="chip ${S.voted[a.id] ? 'on' : ''}" data-help="${esc(a.id)}" ${S.voted[a.id] ? 'disabled' : ''}>👍 مفيد ${a.hp || 0}</button>${a.ai ? '' : `<button class="link" data-report="a:${esc(x.id)}/${esc(a.id)}">🚩 إبلاغ</button>`}</div></div>`).join('')}
      ${CM.canWrite === false ? '' : `<div class="card"><b>اكتبي ردك</b>
        <textarea class="input" id="aBody" rows="3" maxlength="1000" placeholder="شاركي تجربتك بلطف…"></textarea>
        <label class="check"><input type="checkbox" id="aAnon"><span>رد بدون اسم 🤍</span></label>
        <button class="btn block" id="aPost">إرسال الرد</button></div>`}`;
  }
});

async function aiAnswer(x) {
  const b = $('#aiAns'); if (b) { b.disabled = true; b.textContent = 'نبض تكتب ردها…'; }
  try {
    if (CM.mode === 'server') { await CM.store.aiAnswer(x.id); x.ac = (x.ac || 0) + 1; await CM.loadAnswers(x.id, true); return; }
    const r = await AI.sample(`${AI_RULES}\n\nهذا سؤال نشرته أم في مجتمع التطبيق (${x.stage}):\nالعنوان: ${x.title}\nالتفاصيل: ${x.body}\n\nاكتبي رداً مختصراً ومفيداً لها ولكل من يقرأ، في 4–7 نقاط.`, { modelTier: 'default' });
    await CM.store.answer(x.id, { uid: 'ai', ai: true, nick: 'نبض', body: r.text.trim(), t: Date.now(), hp: 0 });
    x.ac = (x.ac || 0) + 1; await CM.loadAnswers(x.id, true);
  } catch (e) { toast(e.code === 'not_granted' ? 'لم يتم السماح للمساعد' : 'تعذّر الحصول على رد نبض'); if (b) { b.disabled = false; b.textContent = '✨ اطلبي رأي نبض في هذا السؤال'; } }
}

function cmBind() {
  const on = (id, fn, ev = 'onclick') => { const el = $(id); if (el) el[ev] = fn; };
  app.querySelectorAll('[data-qid]').forEach(el => el.onclick = () => { route = { view: route.view, sub: 'cq', qid: el.dataset.qid, as: route.as }; history.pushState(route, ''); render(); });
  app.querySelectorAll('[data-cf]').forEach(b => b.onclick = () => { route.cf = b.dataset.cf; render(false); });
  app.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { route.ct = b.dataset.ct; render(false); });
  // لا نعيد رسم الشاشة أثناء تركيب الكلمة في كيبورد الجوال، وإلا تنقطع الكتابة
  const cmSearch = e => { if (e.isComposing) return; route.cq = e.target.value; const p = e.target.selectionStart; render(false); const i = $('#cmQ'); i.focus(); i.setSelectionRange(p, p); };
  on('#cmQ', cmSearch, 'oninput'); on('#cmQ', cmSearch, 'oncompositionend');
  on('#cmRefresh', () => { CM.load(true); toast('جاري التحديث…'); });
  on('#nBody', e => { const w = $('#nWarn'); if (w) w.innerHTML = URGENT_RE.test(e.target.value) ? '<div class="card lv-danger" style="margin-bottom:10px">🚨 يبدو أنها قد تكون حالة طارئة — لا تنتظري الردود، اذهبي للطوارئ أو كلمي طبيبك الآن.</div>' : ''; }, 'oninput');
  on('#nPost', async () => {
    const nick = $('#nNick').value.trim(), anon = $('#nAnon').checked, title = $('#nTitle').value.trim(), body = $('#nBody').value.trim();
    route.draft = { title, body, anon, cat: $('#nCat').value };
    if (!anon && nick.length < 2) return toast('اكتبي اسماً للمجتمع أو اختاري بدون اسم');
    const err = checkText(title, 8, 120) || checkText(body, 10, 1500) || (BLOCK_RE.test(nick) || /نبض/.test(nick) ? 'الاسم غير مسموح' : '');
    if (err) return toast(err);
    if (nick) { S.nick = nick; save(); }
    const btn = $('#nPost'); btn.disabled = true; btn.textContent = 'جاري النشر…';
    try {
      const q = { uid: CM.uid || S.devId || 'anon', nick: anon ? '' : nick, anon, cat: route.draft.cat, title, body, stage: myStage(), t: Date.now(), ac: 0 };
      const id = await CM.store.add(q);
      CM.qs.unshift({ id, ...q }); route.draft = null; toast('نُشر سؤالك 💗');
      route = { view: route.view, sub: 'cq', qid: id }; history.replaceState(route, ''); render();
    } catch (e) { btn.disabled = false; btn.textContent = 'نشر السؤال'; toast(e && e.code === 'quota_exceeded' ? 'المجتمع ممتلئ حالياً' : (e && e.text) || 'تعذّر النشر — تأكدي من الاتصال'); }
  });
  on('#aPost', async () => {
    const body = $('#aBody').value.trim(), anon = $('#aAnon').checked, err = checkText(body, 3, 1000);
    if (err) return toast(err);
    if (!anon && !S.nick) { route.draftA = body; return toast('اختاري اسماً من «اطرحي سؤالاً» أو رد بدون اسم'); }
    const x = CM.qs.find(q => q.id === route.qid), btn = $('#aPost'); btn.disabled = true;
    try {
      await CM.store.answer(x.id, { uid: CM.uid || S.devId || 'anon', nick: anon ? '' : S.nick, anon, body, stage: myStage(), t: Date.now(), hp: 0 });
      x.ac = (x.ac || 0) + 1; toast('تم إرسال ردك 💗'); await CM.loadAnswers(x.id, true);
    } catch (e) { btn.disabled = false; toast(e.text || 'تعذّر الإرسال'); }
  });
  app.querySelectorAll('[data-help]').forEach(b => b.onclick = async () => {
    const aid = b.dataset.help; if (S.voted[aid]) return;
    S.voted[aid] = 1; save(); b.disabled = true;
    try { await CM.store.helpful(route.qid, aid); await CM.loadAnswers(route.qid, true); } catch { toast('تعذّر التسجيل'); }
  });
  app.querySelectorAll('[data-report^="q:"], [data-report^="a:"]').forEach(b => b.onclick = async () => {
    try { await CM.store.report({ ref: b.dataset.report, by: CM.uid || S.devId || 'anon', t: Date.now() }); toast('شكراً، سنراجع البلاغ'); b.disabled = true; } catch { toast('تعذّر الإبلاغ'); }
  });
  on('#qDel', confirmTap('#qDel', async () => {
    try { await CM.store.remove(route.qid); CM.qs = CM.qs.filter(q => q.id !== route.qid); toast('تم الحذف'); history.back(); } catch { toast('تعذّر الحذف'); }
  }));
  on('#aiAns', () => { const x = CM.qs.find(q => q.id === route.qid); if (x) aiAnswer(x); });
}
