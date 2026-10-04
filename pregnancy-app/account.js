/* نبضٌ صغير — حسابي: الدخول برمز يصل على الإيميل، وحفظ البيانات والصور على السيرفر
   لاسترجاعها عند تغيير الجوال (server/api/account.php) */
'use strict';

const Account = (() => {
  const KEY = 'nabd_account', BASE = 'nabd_account_base', PHOTO = /^(bump-\d+|baby-photo)$/;
  let st = {}, base = null;
  try { st = JSON.parse(localStorage.getItem(KEY)) || {}; base = localStorage.getItem(BASE); } catch {}
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  // base: آخر نسخة اتفق عليها الجوال والسيرفر — بها نعرف ما الذي تغيّر على كل طرف
  const setBase = j => { base = j; try { j == null ? localStorage.removeItem(BASE) : localStorage.setItem(BASE, j); } catch {} };
  const norm = d => JSON.stringify(Object.assign(defaults(), d || {}));
  const call = (action, body = {}) => Server.call('account.php', { action, token: st.token, ...body });
  let timer = null, busy = false, again = false, pending = null, tries = 0;

  // بصمة سريعة للصورة لمعرفة هل تغيّرت
  const sig = s => { let h = 5381; for (let i = 0; i < s.length; i += 7) h = (h * 33 + s.charCodeAt(i)) | 0; return s.length.toString(36) + '.' + (h >>> 0).toString(36); };
  const out = () => { st = {}; keep(); setBase(null); };
  // انتهت الجلسة على السيرفر (حُذف الحساب أو سُجّل الخروج من مكان آخر)
  const lost = e => { if (e && e.code === 'signed_out') { out(); render(false); } };

  /* دمج ثلاثي: لكل قسم نأخذ الطرف الذي غيّره؛ وإن غيّره الطرفان نجمع القوائم والعناصر */
  function merge(b, server, local) {
    const r = { ...server }, J = JSON.stringify;
    for (const k of Object.keys(local)) {
      const lv = local[k], sv = server[k], bv = b[k];
      if (J(lv) === J(bv) || J(lv) === J(sv)) continue;   // لم يتغير على الجوال
      if (J(sv) === J(bv) || sv === undefined) { r[k] = lv; continue; } // تغيّر على الجوال فقط
      if (Array.isArray(lv) && Array.isArray(sv)) { const seen = new Set(sv.map(x => J(x))); r[k] = sv.concat(lv.filter(x => !seen.has(J(x)))); }
      else if (lv && sv && typeof lv === 'object' && typeof sv === 'object') r[k] = { ...sv, ...lv };
      else r[k] = lv;
    }
    return r;
  }
  function apply(data) { S = Object.assign(defaults(), data || {}); try { localStorage.setItem('rihlati_v1', JSON.stringify(S)); } catch {} }
  const dirty = () => base == null || JSON.stringify(S) !== base;

  async function push() {
    const snap = JSON.stringify(S);
    const r = await call('push', { data: S, base: st.updated || 0 });
    st.updated = r.updated; keep(); setBase(snap);
  }
  // يرفع صور الجوال الجديدة أو المعدّلة، وينزّل صور الحساب غير الموجودة على الجوال
  async function photos() {
    const remote = (await call('photos')).items || {};
    const keys = (await IDB.keys()).filter(k => PHOTO.test(k));
    let got = 0;
    for (const k of keys) {
      const v = await IDB.get(k);
      if (v && remote[k] !== sig(v)) await call('photo_put', { k, data: v, sig: sig(v) });
    }
    for (const k of Object.keys(remote)) {
      if (keys.includes(k)) continue;
      const r = await call('photo_get', { k });
      if (r.data) { await IDB.put(k, r.data); got++; }
    }
    return got;
  }

  // نسحب أولاً ثم نرفع: لا نكتب أبداً فوق نسخة أحدث على السيرفر دون دمجها
  async function sync() {
    clearTimeout(timer);
    if (!st.token || st.choose || !Server.on()) return;
    if (busy) { again = true; return; }
    busy = true; again = false;
    try {
      const r = await call('pull', { since: st.updated || 0 });
      if (r.data && r.updated > (st.updated || 0)) {
        const sb = norm(r.data);
        const next = dirty() && base ? merge(JSON.parse(base), JSON.parse(sb), JSON.parse(JSON.stringify(S))) : JSON.parse(sb);
        apply(next); st.updated = r.updated; keep(); setBase(sb);
        render(false);
      }
      if (dirty()) await push();
      if (await photos()) render(false);
      st.at = Date.now(); delete st.dirty; keep(); tries = 0;
    } catch (e) {
      st.dirty = dirty(); keep(); lost(e);
      // جوال آخر حفظ قبلنا بلحظة: نسحب نسخته وندمج ثم نعيد الحفظ
      if (e.code === 'conflict' && ++tries < 4) again = true; else if (!again) timer = setTimeout(sync, 20000);
    }
    busy = false;
    if (again) sync();
  }

  return {
    state: () => st,
    sig,
    // تُستدعى مع كل حفظ للبيانات على الجوال
    changed() {
      if (!st.token || st.choose || !dirty()) return;
      st.dirty = true; keep();
      clearTimeout(timer); timer = setTimeout(sync, 3000);
    },
    sync,
    sendCode: email => call('send_code', { email }),
    async verify(email, code) {
      const r = await call('verify', { email, code });
      st = { token: r.token, email: r.email, updated: 0 }; keep(); setBase(null);
      if (r.updated) {
        const p = await call('pull', { since: 0 });
        if (!S.profile) { apply(JSON.parse(norm(p.data))); st.updated = p.updated; keep(); setBase(norm(p.data)); await photos(); st.at = Date.now(); keep(); return 'restored'; }
        // على الجوال بيانات وفي الحساب بيانات: نسأل أيهما تبقى
        pending = p; st.choose = p.updated; keep(); return 'choose';
      }
      if (S.profile) { await push(); await photos(); st.at = Date.now(); keep(); }
      return S.profile ? 'uploaded' : 'empty';
    },
    // keepServer: true = استرجاع نسخة الحساب، false = رفع بيانات هذا الجوال مكانها
    async choose(keepServer) {
      const p = pending || await call('pull', { since: 0 });
      if (keepServer) { apply(JSON.parse(norm(p.data))); st.updated = p.updated; setBase(norm(p.data)); }
      else await push();
      delete st.choose; pending = null; keep();
      await photos(); st.at = Date.now(); keep();
    },
    async logout() {
      clearTimeout(timer);
      if (dirty()) await sync().catch(() => {});
      call('logout').catch(() => {});
      out();
    },
    async remove() { await call('delete_account'); out(); }
  };
})();

/* ---------- الشاشة ---------- */
const fmtSync = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

function viewAccount() {
  if (!Server.on()) return `<div class="card"><p style="margin:0">الحساب يتفعّل بعد ربط سيرفر التطبيق.</p></div>`;
  const a = Account.state();
  if (a.token && a.choose) return `<div class="card"><h3 style="margin-top:0">☁️ عندك نسخة محفوظة في حسابك</h3>
    <p>آخر حفظ لها: <b>${fmtSync.format(new Date(a.choose))}</b>. وعلى هذا الجوال بيانات أيضاً. أيهما تريدين؟</p>
    <button class="btn block" id="accKeepServer">استرجاع النسخة المحفوظة في حسابي</button>
    <button class="btn ghost block" id="accKeepLocal" style="margin-top:8px">الاحتفاظ ببيانات هذا الجوال وحفظها في حسابي</button>
    <p class="muted" style="margin-bottom:0">الصور تُجمع من الاثنين ولا يُحذف منها شيء.</p></div>`;
  if (a.token) return `<div class="card"><h3 style="margin-top:0">☁️ حسابي</h3>
    <p style="margin:0">مسجّلة بـ <b dir="ltr">${esc(a.email)}</b></p>
    <p class="muted">${a.dirty ? 'يوجد تعديلات لم تُحفظ بعد — تُحفظ تلقائياً عند الاتصال.' : a.at ? `آخر حفظ: ${fmtSync.format(new Date(a.at))}` : ''}</p>
    <p class="muted">بياناتك وتحاليلك وصورك تُحفظ تلقائياً في حسابك. لو غيّرتِ جوالك ثبّتي التطبيق وسجّلي الدخول بنفس الإيميل لتعود كما هي.</p>
    <button class="btn block" id="accSync">🔄 احفظي الآن</button>
    <button class="btn ghost block" id="accOut" style="margin-top:8px">تسجيل الخروج</button>
    <button class="btn danger block" id="accDel" style="margin-top:8px">حذف حسابي وبياناتي من السيرفر</button></div>`;
  if (route.mail) return `<div class="card"><h3 style="margin-top:0">📩 أدخلي الرمز</h3>
    <p>أرسلنا رمزاً من 6 أرقام إلى <b dir="ltr">${esc(route.mail)}</b>. إن لم يصل خلال دقيقة افحصي مجلد الرسائل غير المرغوب فيها (Spam).</p>
    <input class="input" id="accCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" dir="ltr" style="text-align:center;font-size:1.4rem;letter-spacing:.4em">
    <button class="btn block" id="accVerify" style="margin-top:10px">تأكيد</button>
    <div class="row" style="justify-content:space-between"><button class="link" id="accResend">إعادة إرسال الرمز</button><button class="link" id="accChange">تغيير الإيميل</button></div></div>`;
  return `<div class="card"><h3 style="margin-top:0">☁️ احفظي بياناتك في حساب</h3>
    <p>سجّلي الدخول بإيميلك (Gmail أو أي إيميل) لتُحفظ بياناتك وتحاليلك وصورك، وتسترجعيها كما هي لو غيّرتِ جوالك. لا تحتاجين كلمة سر: نرسل لكِ رمزاً على الإيميل.</p>
    <input class="input" id="accMail" type="email" inputmode="email" autocomplete="email" placeholder="example@gmail.com" dir="ltr">
    <button class="btn block" id="accSend" style="margin-top:10px">أرسلي الرمز</button></div>`;
}

function accBind() {
  const on = (id, fn, ev = 'onclick') => { const el = $(id); if (el) el[ev] = fn; };
  const busy = (id, text) => { const b = $(id); if (b) { b.disabled = true; b.textContent = text; } };
  const fail = e => { toast((e && e.text) || 'تعذّر الاتصال — تأكدي من الإنترنت'); render(false); };
  const done = msg => { toast(msg); route = { view: 'home' }; history.replaceState(route, ''); render(); };
  on('#toAccount', () => { route = { view: 'home', sub: 'account' }; history.pushState(route, ''); render(); });

  const send = async () => {
    const mail = ($('#accMail') ? $('#accMail').value : route.mail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return toast('اكتبي إيميلاً صحيحاً');
    busy('#accSend', 'جاري الإرسال…');
    try { await Account.sendCode(mail); route.mail = mail; history.replaceState(route, ''); toast('تم إرسال الرمز 📩'); render(false); $('#accCode')?.focus(); }
    catch (e) { fail(e); }
  };
  on('#accSend', send);
  on('#accMail', e => { if (e.key === 'Enter') send(); }, 'onkeydown');
  on('#accResend', send);
  on('#accChange', () => { delete route.mail; history.replaceState(route, ''); render(false); });

  const verify = async () => {
    const code = ($('#accCode').value || '').replace(/\D/g, '');
    if (code.length !== 6) return toast('الرمز 6 أرقام');
    busy('#accVerify', 'جاري التحقق…');
    try {
      const r = await Account.verify(route.mail, code);
      delete route.mail;
      if (r === 'restored') return done('تم استرجاع بياناتك ✅');
      if (r === 'empty') return done('تم تسجيل الدخول ✅ — أدخلي بياناتك وستُحفظ تلقائياً');
      if (r === 'uploaded') toast('تم تسجيل الدخول وحفظ بياناتك ✅');
      history.replaceState(route, ''); render(false);
    } catch (e) { fail(e); }
  };
  on('#accVerify', verify);
  on('#accCode', e => { if (e.target.value.replace(/\D/g, '').length === 6) verify(); }, 'oninput');

  on('#accKeepServer', async () => { busy('#accKeepServer', 'جاري الاسترجاع…'); try { await Account.choose(true); done('تم استرجاع بياناتك ✅'); } catch (e) { fail(e); } });
  on('#accKeepLocal', async () => { busy('#accKeepLocal', 'جاري الحفظ…'); try { await Account.choose(false); toast('تم حفظ بيانات هذا الجوال في حسابك ✅'); render(false); } catch (e) { fail(e); } });
  on('#accSync', async () => { busy('#accSync', 'جاري الحفظ…'); await Account.sync(); toast(Account.state().dirty ? 'تعذّر الحفظ — تأكدي من الإنترنت' : 'تم الحفظ ✅'); render(false); });
  on('#accOut', confirmTap('#accOut', async () => { await Account.logout(); toast('تم تسجيل الخروج — بياناتك باقية على هذا الجوال'); render(false); }));
  on('#accDel', confirmTap('#accDel', async () => { try { await Account.remove(); toast('تم حذف حسابك من السيرفر'); render(false); } catch (e) { fail(e); } }));
}

// مزامنة عند فتح التطبيق، وعند رجوع الإنترنت، وعند الرجوع للتطبيق
window.addEventListener('DOMContentLoaded', () => setTimeout(Account.sync, 1500));
window.addEventListener('online', () => Account.sync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Account.state().dirty) Account.sync(); });

Object.assign(SUBVIEWS, { account: viewAccount });
