/* نبضٌ صغير — إشعار مع بداية كل أسبوع حمل (وكل شهر من عمر الطفل)، وتذكيرات يومية (الدواء، الماء)
   في تطبيق الأندرويد: إشعارات محلية مجدولة على الجهاز نفسه (بدون إنترنت وبدون خادم).
   في المتصفح: رسالة ترحيب داخل التطبيق عند فتحه في أسبوع جديد. */
'use strict';

const Notify = (() => {
  const plugin = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.LocalNotifications;
  const HOUR = 10; // العاشرة صباحاً
  const short = (t, n = 110) => (t || '').length > n ? t.slice(0, n - 1).trim() + '…' : (t || '');
  const at = d => { const x = new Date(d); x.setHours(HOUR, 0, 0, 0); return x; };
  const months = m => m === 1 ? 'شهراً واحداً' : m === 2 ? 'شهرين' : m <= 10 ? `${m} أشهر` : `${m} شهراً`;

  // التذكيرات اليومية: الإعدادات الافتراضية
  const REM = () => ({ med: { on: true, times: [], name: '' }, water: { on: false, from: '09:00', to: '21:00', every: 2 } });
  const rem = () => {
    const d = REM(), r = S.reminders || {};
    return { med: { ...d.med, ...r.med }, water: { ...d.water, ...r.water } };
  };
  const hm = t => { const [h, m] = String(t || '').split(':').map(Number); return isFinite(h) && isFinite(m) ? h * 60 + m : null; };
  const atMin = (day, min) => { const x = new Date(day); x.setHours(Math.floor(min / 60), min % 60, 0, 0); return x; };
  const DAYS = 14, BASE = 4000, PER_DAY = 20; // 4000+: التذكيرات اليومية (1000+ أسبوعية، 2000+ شهرية، 3000+ نصيحة كل يوم)
  const WATER_TXT = ['الماء يقلل التورم والإمساك والتهاب المسالك.', 'رشفات صغيرة طوال اليوم أسهل من كوب كبير مرة واحدة.', 'لون البول الفاتح علامة على أنكِ تشربين كفاية.'];

  function reminders(now) {
    const list = [], r = rem(), t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    if (!S.profile && !S.baby) return list;
    const todayKey = iso(new Date()), cups = S.water && S.water[todayKey];
    for (let d = 0; d < DAYS; d++) {
      const day = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d), base = BASE + d * PER_DAY;
      if (r.med.on) r.med.times.slice(0, 3).forEach((t, i) => {
        const m = hm(t); if (m == null) return;
        list.push({ id: base + i, at: atMin(day, m), title: `💊 وقت ${r.med.name || 'الفيتامين'}`,
          body: 'اضغطي «الفيتامين» في الرئيسية لتسجيله اليوم.', extra: { view: 'home' } });
      });
      if (r.water.on) {
        const from = hm(r.water.from), to = hm(r.water.to), step = (+r.water.every === 3 ? 3 : 2) * 60;
        if (from != null && to != null) for (let m = from, k = 0; m <= to && k < 16; m += step, k++) {
          const at = atMin(day, m), same = iso(day) === todayKey;
          list.push({ id: base + 3 + k, at,
            title: S.baby ? '💧 الرضاعة تحتاج سوائل — كوب ماء؟' : '💧 كوب ماء الآن؟',
            body: same && cups != null ? `شربتِ ${cups} من 10 اليوم` : WATER_TXT[(d + k) % WATER_TXT.length],
            extra: { view: 'home', sub: 'water' } });
        }
      }
    }
    return list.filter(n => n.at.getTime() > now + 60e3);
  }

  function plan(nowMs = Date.now()) {
    const list = [], now = nowMs + 60e3;
    if (S.notify === false) return reminders(nowMs);
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
        const x = WEEKS[w - 1], hasSize = w >= 3 && x.size && !/لم|—/.test(x.size);
        list.push({ id: 1000 + w, at: d,
          title: w === 40 ? '💗 الأسبوع 40 — موعد اللقاء اقترب!' : `${x.emoji} أهلاً بالأسبوع ${w}`,
          body: short((hasSize ? `${name} الآن بحجم ${x.size}. ` : '') + (x.baby.find(t => !/طوله|وزنه/.test(t)) || x.baby[0]), 150), extra: { view: 'weeks', week: w } });
      }
    }
    return list.concat(reminders(nowMs));
  }

  async function sync(ask = false) {
    const LN = plugin(); if (!LN) return false;
    try {
      const pending = (await LN.getPending()).notifications || [];
      if (pending.length) await LN.cancel({ notifications: pending.map(n => ({ id: n.id })) });
      const list = plan();
      if (!list.length) return S.notify !== false;
      let perm = (await LN.checkPermissions()).display;
      if (perm !== 'granted' && ask) perm = (await LN.requestPermissions()).display;
      if (perm !== 'granted') return false;
      await LN.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, extra: n.extra,
        schedule: { at: n.at, allowWhileIdle: true }, smallIcon: 'ic_stat_nabd', iconColor: '#FA1A7F' })) });
      return true;
    } catch (e) { console.warn('notify', e); return false; }
  }

  function listen() {
    const LN = plugin(); if (!LN) return;
    LN.addListener('localNotificationActionPerformed', a => {
      const x = (a.notification && a.notification.extra) || {};
      route = { view: x.view || 'home' }; if (x.sub) route.sub = x.sub; if (x.week) route.week = x.week; if (x.bm != null) { route.sub = 'bguide'; route.bm = x.bm; }
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

  return { native: () => !!plugin(), plan, rem, sync, listen, greet, start() { listen(); greet(); sync(false); } };
})();
