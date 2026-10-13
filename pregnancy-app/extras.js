/* نبضٌ صغير — المفضلة 💗، ومشاركة الأسبوع كصورة، وشاشة «حسابي» */
'use strict';

/* ---------- المفضلة ---------- */
const FAVREG = {};
const favHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const isFav = id => (S.favorites || []).some(f => f.id === id);
// زر قلب لأي عنصر: {id, type: week|tip|ai|cq, text, ...}
function favBtn(item, label = '') {
  FAVREG[item.id] = item;
  const on = isFav(item.id);
  return `<button class="fav-btn ${on ? 'on' : ''}" data-fav="${esc(item.id)}" aria-pressed="${on}" aria-label="${on ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}">${ICON.heart}${label ? `<span>${label}</span>` : ''}</button>`;
}
function toggleFav(id) {
  S.favorites = S.favorites || [];
  if (isFav(id)) { S.favorites = S.favorites.filter(f => f.id !== id); save(); toast('أُزيلت من المفضلة'); return false; }
  const it = FAVREG[id]; if (!it) return false;
  S.favorites.unshift({ ...it, t: Date.now() }); save(); toast('حُفظت في المفضلة 💗'); return true;
}

const FAV_TYPES = [['week', '👶', 'معلومات الأسبوع'], ['tip', '💡', 'نصائح'], ['ai', '✨', 'ردود نبض'], ['cq', '👩‍👩‍👧', 'أسئلة المجتمع']];

/* ---------- مشاركة الأسبوع كصورة ---------- */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function weekCard(w) {
  const x = WEEKS[w - 1], W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  try { await Promise.all([document.fonts.load('700 80px Rubik'), document.fonts.load('400 40px Rubik')]); } catch {}
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1640'); bg.addColorStop(1, '#0f1428');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 600, 80, W / 2, 600, 560); glow.addColorStop(0, 'rgba(250,26,127,.45)'); glow.addColorStop(1, 'rgba(250,26,127,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // صورة الجنين في دائرة
  try {
    const img = await loadImg(Photos.src(w)), r = 300, cx = W / 2, cy = 600;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip(); g.drawImage(img, cx - r, cy - r, r * 2, r * 2); g.restore();
    g.lineWidth = 10; g.strokeStyle = '#ff4d9a'; g.beginPath(); g.arc(cx, cy, r + 14, 0, Math.PI * 2); g.stroke();
  } catch {}
  // الشعار والاسم
  try { const logo = await loadImg('icons/icon.svg'); g.drawImage(logo, W / 2 - 50, 70, 100, 100); } catch {}
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#fff';
  g.font = '700 48px Rubik, sans-serif'; g.fillText(APP_NAME, W / 2, 230);
  const name = S.profile && S.profile.babyName;
  g.font = '700 96px Rubik, sans-serif'; g.fillText(`الأسبوع ${w}`, W / 2, 1035);
  g.fillStyle = '#ffb3cf'; g.font = '400 52px Rubik, sans-serif';
  g.fillText(x.wt === '—' ? x.size : `${name ? name + ' ' : ''}بحجم ${x.size} ${x.emoji}`, W / 2, 1115);
  if (x.wt !== '—') { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '400 40px Rubik, sans-serif'; g.fillText(`الطول ${x.len} · الوزن ${wtLabel(x.wt)}`, W / 2, 1185); }
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '400 34px Rubik, sans-serif'; g.fillText('تابعي حملك أسبوعاً بأسبوع مع نبضٌ صغير 💗', W / 2, 1290);
  return c;
}
async function shareWeek(w) {
  toast('جاري تجهيز الصورة…');
  const c = await weekCard(w), name = `nabd-week-${w}.png`, text = `الأسبوع ${w} من رحلتي مع ${APP_NAME} 💗`;
  const P = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins;
  try {
    if (P && P.Share && P.Filesystem) {
      const data = c.toDataURL('image/png').split(',')[1];
      const f = await P.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
      await P.Share.share({ title: text, text, files: [f.uri], dialogTitle: 'شاركي الأسبوع' });
      return;
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('تم حفظ الصورة 📸');
  } catch (e) { if (!/abort|cancel/i.test(String(e && (e.name || e.message)))) toast('تعذّرت المشاركة'); }
}

/* ---------- الشاشات ---------- */
Object.assign(SUBVIEWS, {
  favs() {
    const list = S.favorites || [], f = route.tab && FAV_TYPES.some(t => t[0] === route.tab) ? route.tab : 'all';
    if (!list.length) return `<div class="card center"><div style="font-size:2.6rem">💗</div><h3>لا توجد عناصر محفوظة بعد</h3>
      <p class="muted">اضغطي القلب بجانب أي معلومة أو نصيحة في «رحلتي»، أو على رد من نبض، أو على سؤال في المجتمع.</p></div>`;
    const shown = list.filter(x => f === 'all' || x.type === f);
    return `<div class="seg" id="favSeg"><button data-ff="all" class="${f === 'all' ? 'on' : ''}">الكل ${list.length}</button>
      ${FAV_TYPES.filter(([k]) => list.some(x => x.type === k)).map(([k, ic, n]) => `<button data-ff="${k}" class="${f === k ? 'on' : ''}">${ic} ${n}</button>`).join('')}</div>
      ${shown.map(x => { FAVREG[x.id] = x; const t = FAV_TYPES.find(y => y[0] === x.type) || FAV_TYPES[0];
        const body = x.type === 'cq' ? `<b>${esc(x.title)}</b><div class="muted clamp">${esc(x.text)}</div>` : x.type === 'ai' ? `<div class="clamp">${esc(x.text)}</div>` : `<div>${x.text}</div>`;
        return `<div class="card fav-card"><div class="row"><span class="badge soft">${t[1]} ${x.week ? `الأسبوع ${x.week}` : t[2]}</span><span class="grow"></span>${favBtn(x)}</div>
          <div class="fav-open" data-fopen="${esc(x.id)}">${body}</div></div>`; }).join('')}`;
  },

  account() {
    const u = Account.user();
    if (!u) return `<div class="card center">
        <svg class="onb-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="var(--soft)"/><path d="M38 80h46a16 16 0 0 0 0-32 22 22 0 0 0-42-5 14 14 0 0 0-4 37z" fill="var(--primary)"/></svg>
        <h2>احفظي بياناتك على السحابة</h2>
        <ul class="onb-list"><li>☁️ نسخة احتياطية تلقائية</li><li>📱 استرجاع كل شيء على جهاز جديد</li><li>👩 نفس اسمك في مجتمع الأمهات</li></ul>
        <p class="muted">اختياري تماماً — كل الميزات تعمل بدون حساب. لا نحفظ الصور على السحابة.</p>
        <div class="g-slot" id="accGoogle"></div></div>`;
    const last = u.last ? `${fmtDate.format(new Date(u.last))} · ${new Date(u.last).toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}` : 'لم يتم النسخ بعد';
    return `<div class="card"><div class="row"><span class="av big">${esc((u.name || u.email || '؟').trim()[0])}</span><div class="grow"><b>${esc(u.name || '')}</b><div class="muted" dir="ltr" style="text-align:right">${esc(u.email || '')}</div></div></div></div>
      <div class="card"><h3>☁️ النسخ الاحتياطي</h3><p class="muted" style="margin:0 0 10px">يتم تلقائياً بعد أي تعديل وعند الخروج من التطبيق.<br>آخر نسخ: <b>${last}</b></p>
        <button class="btn block" id="accPush">نسخ الآن</button></div>
      <div class="card"><button class="btn ghost block" id="accOut">تسجيل الخروج</button>
        <p class="muted" style="margin:8px 0 0">بياناتك تبقى على هذا الجهاز بعد الخروج.</p></div>
      <details class="card group more-tools" id="accAdv" ${route.delStep ? 'open' : ''}><summary><b>إعدادات متقدمة</b></summary>
        <p class="muted" style="margin:10px 0">إزالة الحساب تمسح نسختك على السحابة وتخفي منشوراتك في المجتمع. بيانات هذا الجهاز تبقى كما هي.</p>
        ${route.delStep ? `<p><b>هل أنتِ متأكدة؟ لا يمكن التراجع عن هذا.</b></p><button class="btn danger block" id="accDelFinal">نعم، أزيلي حسابي</button><button class="link" id="accDelCancel">إلغاء</button>`
          : '<button class="btn ghost block" id="accDel">إزالة الحساب</button>'}</details>`;
  }
});

function extrasBind() {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  app.querySelectorAll('[data-fav]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const now = toggleFav(b.dataset.fav);
    if (route.sub === 'favs') return render(false);
    b.classList.toggle('on', now); b.setAttribute('aria-pressed', now);
    if (now && !REDUCED) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  });
  app.querySelectorAll('[data-ff]').forEach(b => b.onclick = () => { route.tab = b.dataset.ff; history.replaceState(route, ''); render(false); });
  app.querySelectorAll('[data-fopen]').forEach(el => el.onclick = () => {
    const x = (S.favorites || []).find(f => f.id === el.dataset.fopen); if (!x) return;
    if (x.type === 'week' || x.type === 'tip') { route = { view: 'weeks', week: x.week, sec: x.sec, mode: 'week' }; history.pushState(route, ''); render(); }
    else if (x.type === 'cq') { route = { view: 'assist', as: 'cm', sub: 'cq', qid: x.qid }; history.pushState(route, ''); render(); }
    else el.querySelector('.clamp')?.classList.toggle('clamp');
  });
  app.querySelectorAll('[data-share]').forEach(b => b.onclick = e => { e.stopPropagation(); shareWeek(+b.dataset.share); });
  // حسابي
  if ($('#accGoogle')) Account.button($('#accGoogle'), { from: 'account' });
  on('#accPush', async () => { const b = $('#accPush'); b.disabled = true; const ok = await Account.push(); toast(ok ? 'تم النسخ ☁️' : 'تعذّر النسخ — تأكدي من الاتصال'); render(false); });
  on('#accOut', confirmTap('#accOut', async () => { await Account.signOut(); toast('تم تسجيل الخروج'); render(false); }));
  on('#accDel', () => { route.delStep = 1; history.replaceState(route, ''); render(false); });
  on('#accDelCancel', () => { route.delStep = 0; history.replaceState(route, ''); render(false); });
  on('#accDelFinal', confirmTap('#accDelFinal', async () => {
    try { await Account.remove(); route.delStep = 0; toast('تمت إزالة حسابك'); render(false); }
    catch { toast('تعذّر الحذف — تأكدي من الاتصال'); }
  }));
}

/* ---------- ويدجت الشاشة الرئيسية (أندرويد): نكتب موعد الولادة وأحجام الجنين، والويدجت يحسب الأسبوع يومياً ---------- */
const Widget = (() => {
  let t = null, last = '';
  function sync() {
    const P = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Preferences;
    if (!P) return;
    clearTimeout(t);
    t = setTimeout(() => {
      let data = {};
      if (S.baby && S.baby.date) data = { baby: S.baby.date, name: S.baby.name || '' };
      else if (S.profile && !S.onb) data = { due: iso(calcDue(S.profile)), name: S.profile.babyName || '', sizes: WEEKS.map(w => w.wt === '—' ? '' : `بحجم ${w.size} ${w.emoji}`) };
      const v = JSON.stringify(data);
      if (v !== last) { last = v; P.set({ key: 'nabd_widget', value: v }).catch(() => {}); }
    }, 800);
  }
  return { sync };
})();
