/* نبضٌ صغير — إشعار مع بداية كل أسبوع حمل (وكل شهر من عمر الطفل)، ومعلومة يومية، وتذكير بالماء والفيتامين/الدواء
   في تطبيق الأندرويد: إشعارات محلية مجدولة على الجهاز نفسه (بدون إنترنت وبدون خادم).
   في المتصفح: رسالة ترحيب داخل التطبيق عند فتحه في أسبوع جديد. */
'use strict';

const Notify = (() => {
  const plugin = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.LocalNotifications;
  const HOUR = 10; // العاشرة صباحاً
  const short = (t, n = 110) => (t || '').length > n ? t.slice(0, n - 1).trim() + '…' : (t || '');
  const at = d => { const x = new Date(d); x.setHours(HOUR, 0, 0, 0); return x; };
  // ساعات تذكير الماء حسب اختيار المستخدمة (الافتراضي: من 10 صباحاً حتى 6 مساءً كل ساعتين)
  const waterHours = r => { const out = [], to = +r.waterTo, ev = Math.max(1, +r.waterEvery || 2); for (let h = +r.waterFrom; h <= to; h += ev) out.push(h); return out; };
  const TIP_DAYS = 14; // تُجدول معلومات الأيام القادمة وتتجدد عند كل فتح للتطبيق
  const rem = () => ({ tip: true, water: true, vit: true, vitTime: '10:00', waterFrom: 10, waterTo: 18, waterEvery: 2, ...(S.reminders || {}) });
  const months = m => m === 1 ? 'شهراً واحداً' : m === 2 ? 'شهرين' : m <= 10 ? `${m} أشهر` : `${m} شهراً`;

  function plan() {
    const list = [], now = Date.now() + 60e3;
    if (S.baby && S.baby.date) {
      const b = new Date(S.baby.date), name = S.baby.name || 'طفلك';
      for (let m = 1; m <= 24; m++) {
        const d = at(new Date(b.getFullYear(), b.getMonth() + m, b.getDate()));
        if (d.getTime() <= now) continue;
        const g = BABY_GUIDE.find(x => x.m === m) || BABY_GUIDE[BABY_GUIDE.length - 1];
        list.push({ id: 2000 + m, at: d, title: m % 12 === 0 ? `🎂 كل سنة و${name} بخير!` : `🌙 ${name} أتمّ اليوم ${months(m)}`,
          body: short(`${g.t.split('—').pop().trim()}: ${g.dev}`), extra: { view: 'weeks', bm: Math.min(m, BABY_GUIDE.length - 1) } });
      }
    } else if (S.profile) {
      const st = status(), name = S.profile.babyName || 'طفلك';
      for (let w = st.week + 1; w <= 40; w++) {
        const d = at(weekDate(st, w));
        if (d.getTime() <= now) continue;
        const x = WEEKS[w - 1], hasSize = x.size && !/لم|—/.test(x.size);
        list.push({ id: 1000 + w, at: d,
          title: w === 40 ? '💗 الأسبوع 40 — موعد اللقاء اقترب!' : `${x.emoji} أهلاً بالأسبوع ${w}`,
          body: short((hasSize ? `${name} الآن بحجم ${x.size}. ` : '') + (x.baby.find(t => !/طوله|وزنه/.test(t)) || x.baby[0]), 150), extra: { view: 'weeks', week: w } });
      }
    }
    return list;
  }

  // معلومة اليوم: من نصائح ومعلومات أسبوع الحمل في ذلك اليوم، أو من نصائح الطفل بعد الولادة
  function tipFor(day) {
    if (S.baby) return DAILY_TIPS[((diffDays(day, new Date(2024, 0, 1)) % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length];
    const st = status(), w = Math.min(40, Math.max(1, Math.floor(diffDays(day, st.start) / 7) + 1)), x = WEEKS[w - 1];
    const pool = [...x.tips, ...x.baby.filter(t => !/طوله|وزنه/.test(t))];
    return pool.length ? pool[diffDays(day, st.start) % pool.length] : '';
  }

  function daily() {
    const r = rem(), list = [], now = Date.now() + 60e3;
    if (r.tip && (S.profile || S.baby)) {
      for (let i = 0; i < TIP_DAYS; i++) {
        const d = new Date(); d.setDate(d.getDate() + i); d.setHours(9, 0, 0, 0);
        if (d.getTime() <= now) continue;
        const t = tipFor(d); if (!t) continue;
        list.push({ id: 3000 + i, schedule: { at: d, allowWhileIdle: true }, title: '💡 معلومة اليوم', body: short(t, 160), extra: { view: S.baby ? 'home' : 'weeks' } });
      }
    }
    if (r.water) waterHours(r).forEach(h => list.push({ id: 4000 + h, schedule: { on: { hour: h, minute: 0 }, allowWhileIdle: true },
      title: '💧 وقت كوب ماء', body: 'كوب ماء الآن يساعدك على النشاط ويقلل الإمساك والتورم.', extra: { view: 'track' } }));
    if (r.vit) {
      const [hh, mm] = (r.vitTime || '10:00').split(':').map(Number);
      list.push({ id: 4100, schedule: { on: { hour: hh || 0, minute: mm || 0 }, allowWhileIdle: true }, title: '💊 موعد الفيتامين أو الدواء',
        body: 'لا تنسي الفيتامين أو الدواء حسب وصف طبيبك، ثم سجّليه في «صحتي» ✅', extra: { view: 'track' } });
    }
    return list;
  }

  async function sync(ask = false) {
    const LN = plugin(); if (!LN) return false;
    try {
      const pending = (await LN.getPending()).notifications || [];
      if (pending.length) await LN.cancel({ notifications: pending.map(n => ({ id: n.id })) });
      if (S.notify === false) return false;
      let perm = (await LN.checkPermissions()).display;
      if (perm !== 'granted' && ask) perm = (await LN.requestPermissions()).display;
      if (perm !== 'granted') return false;
      const list = [...plan().map(n => ({ ...n, schedule: { at: n.at, allowWhileIdle: true } })), ...daily()];
      if (list.length) await LN.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, extra: n.extra,
        schedule: n.schedule, isExactNotification: false, smallIcon: 'ic_stat_nabd', iconColor: '#FA1A7F' })) });
      return true;
    } catch (e) { console.warn('notify', e); return false; }
  }

  function listen() {
    const LN = plugin(); if (!LN) return;
    LN.addListener('localNotificationActionPerformed', a => {
      const x = (a.notification && a.notification.extra) || {};
      route = { view: x.view || 'home' }; if (x.week) route.week = x.week; if (x.bm != null) { route.sub = 'bguide'; route.bm = x.bm; }
      history.replaceState(route, ''); render();
    });
  }

  // في المتصفح: ترحيب بالأسبوع الجديد عند أول فتح فيه
  function greet() {
    if (!S.profile || S.baby) return;
    const w = status().week;
    if (S.seenWeek && w > S.seenWeek) setTimeout(() => toast(`${WEEKS[w - 1].emoji} أهلاً بالأسبوع ${w}! شوفي الجديد عن طفلك`), 900);
    if (S.seenWeek !== w) { S.seenWeek = w; save(); }
  }

  // إشعار تجريبي بعد ثوانٍ للتأكد أن الإشعارات تصل على هذا الجهاز
  async function test() {
    const LN = plugin(); if (!LN) return 'web';
    let perm = (await LN.checkPermissions()).display;
    if (perm !== 'granted') perm = (await LN.requestPermissions()).display;
    if (perm !== 'granted') return 'denied';
    await LN.schedule({ notifications: [{ id: 9999, title: '🔔 الإشعارات تعمل', body: 'هكذا ستصلك تذكيرات نبض الصغير 💗', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      isExactNotification: false, smallIcon: 'ic_stat_nabd', iconColor: '#FA1A7F' }] });
    return 'ok';
  }

  return { waterHours, native: () => !!plugin(), sync, listen, greet, test, rem, start() { listen(); greet(); sync(false); } };
})();
