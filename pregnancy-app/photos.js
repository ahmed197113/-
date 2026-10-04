/* صور الأسابيع مع أسماء الأجزاء فوقها (الإحداثيات من 0 إلى 10 على عرض/ارتفاع الصورة) */
'use strict';

const Photos = (() => {
  const LAST = 39; // آخر صورة متوفرة
  const src = w => `images/week-${String(Math.min(LAST, Math.max(1, w))).padStart(2, '0')}.webp`;

  const P = {};
  P[1] = { ovary: [2.4, 5.2], follicle: [6.4, 4.6], small: [2.0, 3.4] };
  P[2] = { egg: [5.0, 5.0], corona: [6.6, 5.2], sperm: [2.2, 1.6] };
  P[3] = { blast: [7.8, 3.8], lining: [3.0, 7.0] };
  P[4] = { embryo: [3.7, 3.6], yolk: [5.8, 4.2], cord: [6.6, 5.2], placenta: [7.6, 4.8], sac: [3.2, 7.8] };
  P[5] = { head: [5.6, 3.0], eye: [4.9, 4.0], heart: [5.6, 4.9], yolk: [3.0, 5.2], placenta: [2.0, 4.6], tail: [4.6, 7.2], sac: [7.8, 7.4] };
  P[6] = { head: [4.8, 2.4], eye: [4.6, 3.9], hand: [4.0, 5.2], foot: [4.0, 7.0], yolk: [8.0, 5.8], placenta: [1.8, 6.2], cord: [6.0, 6.1], sac: [3.2, 8.4] };
  P[7] = { head: [5.0, 2.4], eye: [4.6, 4.0], hand: [4.0, 5.2], foot: [4.2, 7.2], placenta: [1.5, 6.0], cord: [2.8, 6.2], sac: [7.6, 7.8] };
  const early = { head: [5.0, 2.2], eye: [4.4, 3.9], ear: [6.0, 3.5], hand: [4.0, 5.0], foot: [3.6, 7.3], placenta: [1.6, 6.0], cord: [2.6, 6.2], sac: [7.6, 7.8], spine: [6.4, 5.0] };
  for (let w = 8; w <= 13; w++) P[w] = early;
  P[14] = { ...early, hand: [3.4, 4.6] };
  P[15] = { head: [5.0, 1.8], eye: [4.2, 3.5], ear: [5.6, 3.2], hand: [4.2, 4.4], foot: [3.4, 7.2], placenta: [1.6, 5.4], cord: [3.2, 5.6], sac: [8.6, 4.0], spine: [6.4, 5.2] };
  for (let w = 16; w <= 27; w++) P[w] = { head: [5.2, 1.8], eye: [4.4, 3.2], ear: [5.9, 3.0], hand: [4.3, 4.4], foot: [2.9, 7.6], placenta: [1.7, 5.2], cord: [3.2, 5.8], sac: [8.5, 4.0], back: [6.6, 5.5] };
  P[28] = { head: [3.0, 3.0], eye: [4.3, 3.6], ear: [2.6, 4.0], hand: [4.6, 4.6], foot: [7.4, 5.4], placenta: [6.5, 2.3], cord: [6.2, 4.2], sac: [2.4, 7.8] };
  P[29] = { head: [3.0, 3.0], eye: [4.4, 3.5], ear: [2.6, 4.0], hand: [4.4, 4.6], foot: [7.5, 5.6], placenta: [6.8, 2.3], cord: [6.0, 4.4], sac: [2.4, 7.8] };
  P[30] = { head: [3.4, 2.6], eye: [4.4, 3.7], ear: [2.8, 3.8], hand: [4.0, 4.4], foot: [7.0, 6.5], placenta: [7.4, 2.9], cord: [6.8, 4.3], sac: [2.4, 7.8] };
  P[31] = { head: [3.4, 2.6], eye: [4.5, 3.6], ear: [2.9, 3.7], hand: [4.0, 4.3], foot: [7.0, 6.3], placenta: [7.3, 2.8], cord: [7.0, 4.2], sac: [2.4, 7.8] };
  P[32] = { head: [3.4, 2.6], eye: [4.4, 3.5], ear: [2.0, 3.8], hand: [4.0, 4.4], foot: [7.0, 6.0], placenta: [7.0, 3.0], cord: [6.3, 4.2], sac: [2.4, 7.8] };
  P[33] = { head: [5.4, 7.0], eye: [5.8, 6.0], ear: [4.6, 7.2], hand: [4.9, 5.2], foot: [6.1, 2.9], placenta: [7.5, 3.0], cord: [7.1, 4.6], back: [2.8, 4.5], sac: [8.6, 6.4] };
  P[34] = { head: [5.4, 7.2], eye: [5.7, 6.1], ear: [4.7, 6.8], hand: [4.0, 5.2], foot: [5.5, 2.8], placenta: [7.2, 3.6], cord: [6.5, 4.8], back: [2.5, 4.5], sac: [8.6, 6.4] };
  P[35] = { head: [3.0, 2.8], eye: [4.0, 3.6], ear: [2.6, 3.8], hand: [3.6, 4.8], foot: [7.2, 5.6], placenta: [6.8, 2.4], cord: [6.4, 4.4], sac: [2.6, 7.8] };
  P[36] = { head: [5.8, 6.6], eye: [5.6, 5.4], ear: [4.4, 6.6], hand: [4.6, 4.5], foot: [5.0, 2.6], placenta: [6.6, 2.6], cord: [5.8, 3.8], back: [2.2, 4.5], sac: [8.2, 6.4] };
  for (let w = 37; w <= 39; w++) P[w] = { head: [6.0, 7.0], eye: [5.6, 5.6], hand: [5.6, 4.6], foot: [4.6, 2.4], placenta: [6.6, 2.4], cord: [6.0, 3.4], back: [2.3, 4.6], sac: [8.4, 6.2] };

  const NAME = {
    ovary: 'المبيض', follicle: 'جريب ناضج', small: 'جريبات صغيرة', egg: 'البويضة', corona: 'خلايا الإكليل', sperm: 'حيوان منوي',
    blast: 'البويضة المخصبة', lining: 'بطانة الرحم', embryo: 'الجنين', yolk: 'كيس المُح', head: 'الرأس', eye: 'العين', ear: 'الأذن',
    hand: 'اليد', foot: 'القدم', heart: 'القلب', tail: 'الذيل الجنيني', placenta: 'المشيمة', cord: 'الحبل السري', sac: 'كيس السائل',
    spine: 'العمود الفقري', back: 'الظهر'
  };
  const desc = (k, w) => ({
    ovary: 'يحتوي على آلاف البويضات غير الناضجة.',
    follicle: 'كيس صغير تنضج بداخله بويضة واحدة كل شهر.',
    small: 'بويضات تنتظر دورها في الأشهر القادمة.',
    egg: 'أكبر خلية في جسم المرأة، تعيش 12–24 ساعة بعد الإباضة.',
    corona: 'خلايا تحيط بالبويضة وتحميها وتغذيها.',
    sperm: 'يحمل نصف الصفات الوراثية من الأب ويحدد جنس الجنين.',
    blast: 'البويضة المخصبة بعد انقسامها إلى عشرات الخلايا، وتنغرس الآن في الرحم.',
    lining: 'طبقة غنية بالدم تحتضن البويضة المخصبة وتغذيها.',
    embryo: 'مجموعة صغيرة من الخلايا ستصبح طفلك.',
    yolk: 'يغذي الجنين في الأسابيع الأولى حتى تتكوّن المشيمة.',
    head: w < 14 ? 'كبير مقارنة بالجسم لأن الدماغ ينمو بسرعة كبيرة.' : w >= 33 ? 'متجه للأسفل استعداداً للولادة.' : 'يحتوي الدماغ الذي ينمو ويتطور كل يوم.',
    eye: w < 26 ? 'الجفون مغلقة حتى الأسبوع 26 تقريباً.' : 'تنفتح وتستجيب للضوء.',
    ear: w >= 18 ? 'يسمع صوتك ونبض قلبك.' : 'تتكوّن وتنتقل تدريجياً إلى مكانها.',
    hand: w < 9 ? 'تبدأ كبرعم صغير ثم تظهر الأصابع.' : w >= 16 ? 'يحرك يديه ويقربهما من فمه، وقد يمص إصبعه.' : 'الأصابع منفصلة ويستطيع فتح يده وغلقها.',
    foot: w < 9 ? 'براعم الرجلين تنمو بعد اليدين بأيام.' : 'الساقان مثنيتان في وضعية الجنين، ويركل بهما.',
    heart: 'بدأ ينبض! 100–160 نبضة في الدقيقة.',
    tail: 'ذيل مؤقت يختفي بنهاية الأسبوع 8.',
    placenta: w < 10 ? 'تتكوّن الآن وستتولى تغذية الجنين قريباً.' : 'تلتصق بجدار الرحم، وتنقل الغذاء والأكسجين للجنين وتخلّصه من الفضلات.',
    cord: 'يصل الجنين بالمشيمة، ويحمل له الغذاء والأكسجين.',
    sac: 'كيس مملوء بالسائل الأمنيوسي يحمي الجنين من الصدمات ويحافظ على حرارته.',
    spine: 'يظهر من خلال الجلد الرقيق الشفاف.',
    back: 'العضلات والعظام تقوى يوماً بعد يوم.'
  }[k]);

  const parts = w => { const p = P[Math.min(LAST, Math.max(1, w))]; return Object.keys(p).map(k => ({ k, n: NAME[k], d: desc(k, w), p: p[k] })); };

  // طبقة الأسماء: نقطة على الجزء وخط إلى اسمه على أحد الجانبين
  function overlay(w) {
    const L = parts(w).map(x => ({ ...x, x: x.p[0] * 40, y: x.p[1] * 40 }));
    const place = (arr, left) => {
      arr.sort((a, b) => a.y - b.y);
      const ys = []; arr.forEach((l, i) => ys.push(Math.max(l.y, i ? ys[i - 1] + 30 : 20)));
      const over = ys.length ? ys[ys.length - 1] - 382 : 0;
      if (over > 0) for (let i = ys.length - 1; i >= 0; i--) { ys[i] -= over; if (i && ys[i - 1] > ys[i] - 30) ys[i - 1] = ys[i] - 30; }
      return arr.map((l, i) => {
        const y = ys[i], wpx = l.n.length * 8.2 + 18, cx = left ? 6 + wpx / 2 : 394 - wpx / 2, ex = left ? 6 + wpx : 394 - wpx;
        return `<path d="M${l.x} ${l.y}L${ex} ${y}" stroke="#fff" stroke-width="1.2" opacity=".85"/>
          <circle cx="${l.x}" cy="${l.y}" r="4.5" fill="#ef4f6c" stroke="#fff" stroke-width="2"/>
          <rect x="${cx - wpx / 2}" y="${y - 12}" width="${wpx}" height="24" rx="12" fill="#fff" fill-opacity=".94"/>
          <text x="${cx}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#2b1d33">${l.n}</text>`;
      }).join('');
    };
    return `<svg class="photo-labels" viewBox="0 0 400 400" aria-hidden="true">${place(L.filter(l => l.x < 200), true)}${place(L.filter(l => l.x >= 200), false)}</svg>`;
  }

  function figure(w, { labels = false, cls = '' } = {}) {
    return `<div class="photo ${cls}"><img src="${src(w)}" alt="شكل الجنين في الأسبوع ${w}" loading="lazy" decoding="async">${labels ? overlay(w) : ''}</div>`;
  }

  return { src, parts, figure };
})();
