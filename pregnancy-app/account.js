/* نبضٌ صغير — حساب اختياري (Google) للنسخ الاحتياطي التلقائي والاسترجاع على جهاز جديد
   لا يُطلب أبداً لاستخدام أي ميزة. التوكن يُحفظ منفصلاً عن S فلا يدخل في النسخ الاحتياطية.
   التحقق من توكن Google يتم على السيرفر فقط (auth.php). */
'use strict';

const Account = (() => {
  const LS = 'nabd_account', MAX = 512 * 1024, DEBOUNCE = 30000;
  const cfg = () => window.NABD_CONFIG || {};
  const base = () => (cfg().apiBase || '').replace(/\/$/, '');
  const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } };
  const write = a => { try { a ? localStorage.setItem(LS, JSON.stringify(a)) : localStorage.removeItem(LS); } catch {} };
  let acc = read(), timer = null, dirty = false, pushing = false, restoring = false;
  const user = () => acc && acc.exp > Date.now() ? acc : null;
  // في تطبيق أندرويد: Firebase Authentication (Google وFacebook)، وفي المتصفح: زر Google الرسمي
  const native = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.FirebaseAuthentication;
  const available = () => !!(base() && (native() || cfg().googleWebClientId));

  async function api(method, file, body, extra = {}) {
    const r = await fetch(`${base()}/${file}`, { method, ...extra,
      headers: { 'Content-Type': 'application/json', 'X-Device': Server.dev(), ...(acc ? { Authorization: `Bearer ${acc.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { acc = null; write(null); }
    if (!r.ok) throw Object.assign(new Error(j.error || r.status), { code: j.error, status: r.status });
    return j;
  }

  /* ---------- تسجيل الدخول ---------- */
  // في التطبيق: زرّا Google وFacebook، وفي المتصفح زر Google الرسمي
  function button(host, ctx = {}) {
    if (!available()) { host.innerHTML = '<p class="muted center">تسجيل الدخول غير متاح حالياً.</p>'; return; }
    if (native()) {
      host.innerHTML = `<div class="login-btns"><button class="btn g-btn block" type="button" data-prov="google">${G_LOGO}<span>المتابعة بحساب Google</span></button>
        ${cfg().facebook === false ? '' : `<button class="btn fb-btn block" type="button" data-prov="facebook">${FB_LOGO}<span>المتابعة بحساب Facebook</span></button>`}</div>`;
      host.querySelectorAll('[data-prov]').forEach(b => b.onclick = () => signIn({ ...ctx, provider: b.dataset.prov }));
      return;
    }
    host.innerHTML = '<p class="muted center">جاري تحميل زر Google…</p>';
    gis().then(g => {
      host.innerHTML = '';
      g.accounts.id.initialize({ client_id: cfg().googleWebClientId, callback: r => r.credential && finishLogin(r.credential, ctx), ux_mode: 'popup', use_fedcm_for_prompt: true });
      g.accounts.id.renderButton(host, { theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ar', width: Math.min(320, host.clientWidth || 300) });
    }).catch(() => { host.innerHTML = '<p class="muted center">تعذّر تحميل تسجيل الدخول — تأكدي من الاتصال.</p>'; });
  }
  let gisP = null;
  const gis = () => gisP || (gisP = new Promise((res, rej) => {
    if (window.google?.accounts?.id) return res(window.google);
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(window.google); s.onerror = () => { gisP = null; rej(new Error('gis')); };
    document.head.appendChild(s);
  }));

  // تسجيل الدخول من أي مكان (رابط «لديّ حساب» أو صفحة حسابي)
  // بدون مزوّد محدد (رابط «لديّ حساب»): نافذة فيها الأزرار
  async function signIn(ctx = {}) {
    if (!available()) return toast('تسجيل الدخول غير متاح حالياً');
    if (!native() || !ctx.provider) return sheet(ctx);
    try {
      // تسجيل دخول أصلي عبر Firebase، ثم توكن Firebase يتحقق منه السيرفر
      const FA = window.Capacitor.Plugins.FirebaseAuthentication;
      if (ctx.provider === 'facebook') await FA.signInWithFacebook({ scopes: ['email', 'public_profile'] });
      else await FA.signInWithGoogle({ scopes: ['email', 'profile'] });
      const r = await FA.getIdToken({ forceRefresh: false });
      if (!r || !r.token) throw new Error('no_token');
      await finishLogin(r.token, ctx, 'firebase');
    } catch (e) {
      const m = String(e && (e.code || e.message || e)).slice(0, 120);
      if (!/cancel|closed|abort/i.test(m)) toast('تعذّر تسجيل الدخول (' + m + ')');
    }
  }
  const nativeOut = async del => {
    if (!native()) return;
    const FA = window.Capacitor.Plugins.FirebaseAuthentication;
    try { if (del) await FA.deleteUser(); } catch {}
    try { await FA.signOut(); } catch {}
  };

  // نافذة صغيرة فيها زر Google (للمتصفح)
  function sheet(ctx) {
    closeSheet();
    const d = document.createElement('div'); d.className = 'sheet-bg'; d.id = 'accSheet';
    d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="تسجيل الدخول"><h3>تسجيل الدخول</h3>
      <p class="muted">لاسترجاع بياناتك المحفوظة على السحابة.</p><div class="g-slot" id="sheetG"></div>
      <button class="link" id="sheetX">إلغاء</button></div>`;
    document.body.appendChild(d);
    d.onclick = e => { if (e.target === d) closeSheet(); };
    d.querySelector('#sheetX').onclick = closeSheet;
    button(d.querySelector('#sheetG'), ctx);
  }
  const closeSheet = () => document.getElementById('accSheet')?.remove();

  async function finishLogin(idToken, ctx, kind = 'google') {
    closeSheet();
    toast('جاري تسجيل الدخول…');
    try {
      const r = await api('POST', 'auth.php', kind === 'firebase' ? { firebase_token: idToken } : { id_token: idToken });
      acc = { token: r.token, exp: r.exp, name: r.user.name, email: r.user.email, last: 0 }; write(acc);
      if (r.user.name && !S.nick) S.nick = r.user.name.split(' ')[0];
      await reconcile(ctx);
    } catch (e) { toast(e.code === 'rate_limited' ? 'محاولات كثيرة، جرّبي بعد قليل' : 'تعذّر تسجيل الدخول (server: ' + String(e.code || e.message || e).slice(0, 80) + ')'); }
  }

  /* ---------- المزامنة ---------- */
  const snapshot = () => { const c = { ...S }; delete c.onb; return c; };
  const payload = () => {
    let c = snapshot(), s = JSON.stringify(c);
    if (s.length > MAX) { c = { ...c, chat: [] }; s = JSON.stringify(c); }
    return s.length > MAX ? null : s;
  };

  // بعد تسجيل الدخول: لا نمسح شيئاً بصمت
  async function reconcile(ctx) {
    let cloud = null;
    try { const r = await api('GET', 'backup.php'); if (r.data) cloud = { data: JSON.parse(r.data), updated: r.updated }; } catch {}
    const hasLocal = !!S.profile;
    if (cloud && cloud.data && cloud.data.profile && hasLocal) return choose(cloud);
    if (cloud && cloud.data && cloud.data.profile) { restore(cloud.data); toast('تم استرجاع بياناتك ☁️'); return; }
    if (!S.profile) { toast('تم تسجيل الدخول ✅ — لا توجد نسخة محفوظة بعد، أكملي الإعداد'); if (S.onb && S.onb.step === 'welcome') Onb.go('cal'); return; }
    await push(); toast('تم تسجيل الدخول ✅ ونسخ بياناتك');
    if (S.onb && ctx.from === 'onboarding') Onb.finish(); else render(false);
  }

  function restore(data) {
    try { localStorage.setItem(KEY + '_before_restore', JSON.stringify(S)); } catch {}
    restoring = true;
    const keep = { theme: S.theme, devId: S.devId };
    S = Object.assign(defaults(), data, { theme: keep.theme || data.theme, news12: 1 });
    if (!S.devId) S.devId = keep.devId;
    delete S.onb;
    save(); restoring = false; dirty = false;
    route = { view: 'home' }; history.replaceState(route, ''); render();
    Notify.sync(false);
  }

  // اختيار النسخة: هذا الجهاز أم السحابة (الأحدث مختار افتراضياً)
  function choose(cloud) {
    const localT = S._mt || 0, cloudT = cloud.data._mt || cloud.updated || 0, newer = cloudT > localT ? 'cloud' : 'local';
    const when = t => t ? `${fmtDate.format(new Date(t))} · ${new Date(t).toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}` : 'غير معروف';
    const desc = d => d.baby ? `طفل وُلد ${fmtDate.format(parse(d.baby.date))}` : d.profile ? 'بيانات حمل' : '';
    closeSheet();
    const el = document.createElement('div'); el.className = 'sheet-bg'; el.id = 'accSheet';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><h3>أي نسخة تريدين الاحتفاظ بها؟</h3>
      <p class="muted">وجدنا بيانات على هذا الجهاز وعلى السحابة.</p>
      <label class="pick"><input type="radio" name="ver" value="local" ${newer === 'local' ? 'checked' : ''}><span><b>📱 هذا الجهاز</b><small>${desc(S)} · آخر تعديل ${when(localT)}${newer === 'local' ? ' · الأحدث' : ''}</small></span></label>
      <label class="pick"><input type="radio" name="ver" value="cloud" ${newer === 'cloud' ? 'checked' : ''}><span><b>☁️ السحابة</b><small>${desc(cloud.data)} · آخر تعديل ${when(cloudT)}${newer === 'cloud' ? ' · الأحدث' : ''}</small></span></label>
      <p class="muted" style="font-size:.85rem">النسخة الأخرى ستُستبدل.</p>
      <button class="btn block" id="verOk">متابعة</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#verOk').onclick = async () => {
      const v = el.querySelector('input[name=ver]:checked').value; closeSheet();
      if (v === 'cloud') { restore(cloud.data); toast('تم استرجاع نسخة السحابة ☁️'); }
      else { await push(); toast('تم حفظ نسخة هذا الجهاز على السحابة ☁️'); if (S.onb) Onb.finish(); else render(false); }
    };
  }

  async function push(opts = {}) {
    if (!user() || pushing) return false;
    const body = payload();
    if (!body) { toast('بياناتك أكبر من حد النسخ الاحتياطي'); return false; }
    pushing = true;
    try {
      // عند الخروج من التطبيق: keepalive حتى يكتمل الطلب (حدّه 64KB)
      const r = await api('PUT', 'backup.php', { data: body, mt: S._mt || Date.now() }, opts.exit && body.length < 60000 ? { keepalive: true } : {});
      dirty = false; acc.last = r.updated || Date.now(); write(acc); return true;
    } catch { return false; } finally { pushing = false; }
  }

  // بعد أي تعديل: نسخ تلقائي بعد 30 ثانية من آخر تعديل
  function markDirty() {
    if (restoring || !user()) return;
    dirty = true; clearTimeout(timer); timer = setTimeout(() => push(), DEBOUNCE);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) { clearTimeout(timer); push({ exit: true }); } });

  async function signOut() {
    try { await api('POST', 'account.php', { action: 'logout' }); } catch {}
    acc = null; write(null); clearTimeout(timer); dirty = false;
    await nativeOut(false);
  }
  async function remove() {
    await api('POST', 'account.php', { action: 'delete' });
    acc = null; write(null); clearTimeout(timer); dirty = false;
    await nativeOut(true);
  }

  const G_LOGO = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  const FB_LOGO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v8h4v-8h3l.5-4h-3.5V9c0-.6.4-1 1-1z"/></svg>';

  return { available, user, button, signIn, push, dirty: markDirty, signOut, remove, _finish: finishLogin };
})();
