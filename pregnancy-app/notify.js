/* نبضٌ صغير — إشعار مع بداية كل أسبوع حمل (وكل شهر من عمر الطفل)
   في تطبيق الأندرويد: إشعارات محلية مجدولة على الجهاز نفسه (بدون إنترنت وبدون خادم).
   في المتصفح: رسالة ترحيب داخل التطبيق عند فتحه في أسبوع جديد. */
'use strict';

const Notify = (() => {
  const plugin = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.LocalNotifications;
  const HOUR = 10; // العاشرة صباحاً
  const short = (t, n = 110) => (t || '').length > n ? t.slice(0, n - 1).trim() + '…' : (t || '');
  const at = d => { const x = new Date(d); x.setHours(HOUR, 0, 0, 0); return x; };
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

  async function sync(ask = false) {
    const LN = plugin(); if (!LN) return false;
    try {
      const pending = (await LN.getPending()).notifications || [];
      if (pending.length) await LN.cancel({ notifications: pending.map(n => ({ id: n.id })) });
      if (S.notify === false) return false;
      let perm = (await LN.checkPermissions()).display;
      if (perm !== 'granted' && ask) perm = (await LN.requestPermissions()).display;
      if (perm !== 'granted') return false;
      const list = plan();
      if (list.length) await LN.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, extra: n.extra,
        schedule: { at: n.at, allowWhileIdle: true }, smallIcon: 'ic_stat_nabd', iconColor: '#FA1A7F' })) });
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

  return { native: () => !!plugin(), sync, listen, greet, start() { listen(); greet(); sync(false); } };
})();
