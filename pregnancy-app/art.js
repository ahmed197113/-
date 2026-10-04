/* رسومات SVG تشريحية مولّدة لكل أسبوع: الجنين داخل الرحم، عرض السونار، وشكل الأم */
'use strict';

const Art = (() => {
  let uid = 0;

  /* ---------- أدوات هندسية ---------- */
  const V = (x, y) => ({ x, y });
  const add = (a, b) => V(a.x + b.x, a.y + b.y);
  const sub = (a, b) => V(a.x - b.x, a.y - b.y);
  const mul = (a, k) => V(a.x * k, a.y * k);
  const len = a => Math.hypot(a.x, a.y);
  const norm = a => { const l = len(a) || 1; return V(a.x / l, a.y / l); };
  const perp = a => V(-a.y, a.x);
  const f2 = n => Math.round(n * 100) / 100;
  const pt = p => `${f2(p.x)} ${f2(p.y)}`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // منحنى Catmull-Rom ناعم يمر بالنقاط
  function smooth(pts, closed = true, k = 1 / 6) {
    const n = pts.length;
    const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    let d = `M${pt(pts[0])}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = add(p1, mul(sub(p2, p0), k)), c2 = sub(p2, mul(sub(p3, p1), k));
      d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
    }
    return d + (closed ? 'Z' : '');
  }
  // عيّنات على منحنى يمر بالنقاط
  function sample(pts, per = 8) {
    const out = [], n = pts.length;
    const P = i => pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let s = 0; s < per; s++) {
        const t = s / per, t2 = t * t, t3 = t2 * t;
        out.push(V(
          0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)));
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  // طرف (ذراع/ساق) متدرج السماكة على طول خط مركزي
  function limb(center, w0, w1) {
    const s = sample(center, 6), L = [], R = [];
    s.forEach((p, i) => {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
      const nn = perp(norm(sub(b, a))), w = lerp(w0, w1, i / (s.length - 1)) / 2;
      L.push(add(p, mul(nn, w))); R.push(sub(p, mul(nn, w)));
    });
    const e0 = s[0], e1 = s[s.length - 1];
    const d0 = norm(sub(s[0], s[1])), d1 = norm(sub(e1, s[s.length - 2]));
    return smooth([...L, add(e1, mul(d1, w1 * 0.45)), ...R.reverse(), add(e0, mul(d0, w0 * 0.45))]);
  }
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
  // مولد عشوائي ثابت لكل أسبوع
  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------- الألوان ---------- */
  function skinPalette(t, sono) {
    if (sono) return { hi: '#ffffff', base: '#d6d6d6', sh: '#6d6d6d', line: '#9a9a9a', op: 1 };
    // من جلد رقيق شفاف وردي محمر إلى جلد ممتلئ بلون الخوخ
    return {
      hi: mix('#ffd6cf', '#ffe9dc', t),
      base: mix('#ee9f96', '#f3bf9f', clamp(t * 1.4)),
      sh: mix('#c4655f', '#cf8e6f', t),
      line: mix('#b85a57', '#bf7a5e', t),
      op: lerp(0.9, 1, clamp(t * 2))
    };
  }

  function defs(id, pal, sono) {
    return `<defs>
      <radialGradient id="sk${id}" cx=".36" cy=".3" r=".8">
        <stop offset="0" stop-color="${pal.hi}"/><stop offset=".5" stop-color="${pal.base}"/><stop offset="1" stop-color="${pal.sh}"/>
      </radialGradient>
      <radialGradient id="skd${id}" cx=".4" cy=".35" r=".8">
        <stop offset="0" stop-color="${mix(pal.base, pal.sh, .3)}"/><stop offset="1" stop-color="${mix(pal.sh, '#000000', sono ? .3 : .15)}"/>
      </radialGradient>
      <radialGradient id="fl${id}" cx=".38" cy=".3" r=".85">
        <stop offset="0" stop-color="${sono ? '#0a0a0a' : '#fff8f3'}"/><stop offset=".65" stop-color="${sono ? '#050505' : '#fde3df'}"/><stop offset="1" stop-color="${sono ? '#1a1a1a' : '#f5bfc4'}"/>
      </radialGradient>
      <radialGradient id="wl${id}" cx=".45" cy=".4" r=".7">
        <stop offset=".7" stop-color="${sono ? '#8a8a8a' : '#e46f8a'}"/><stop offset="1" stop-color="${sono ? '#3a3a3a' : '#9e2546'}"/>
      </radialGradient>
      <radialGradient id="pl${id}" cx=".5" cy=".4" r=".7">
        <stop offset="0" stop-color="${sono ? '#e0e0e0' : '#c2405e'}"/><stop offset="1" stop-color="${sono ? '#8c8c8c' : '#7d1a35'}"/>
      </radialGradient>
      <filter id="tx${id}" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="${sono ? 0.55 : 1.1}" numOctaves="2" seed="${id}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${sono ? 0.9 : 0.22} 0" result="a"/>
        <feComposite in="a" in2="SourceAlpha" operator="in" result="m"/>
        <feBlend in="SourceGraphic" in2="m" mode="multiply"/>
      </filter>
      <filter id="ds${id}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="${sono ? '#000' : '#9b2c4b'}" flood-opacity="${sono ? 0 : .28}"/>
      </filter>
      <filter id="bl${id}"><feGaussianBlur stdDeviation="${sono ? 1.1 : 2.5}"/></filter>
    </defs>`;
  }

  /* ---------- الرحم ---------- */
  const UC = V(120, 128);
  const UTERUS = [V(120, 10), V(176, 16), V(216, 52), V(228, 112), V(214, 172), V(178, 216), V(146, 240), V(134, 254), V(106, 254), V(94, 240), V(62, 216), V(26, 172), V(12, 112), V(24, 52), V(64, 16)];
  const inner = k => UTERUS.map(p => add(UC, mul(sub(p, UC), k)));

  function uterus(id, sono, r) {
    const cav = inner(0.87);
    const stri = sono ? '' : Array.from({ length: 9 }, (_, i) => {
      const k = 0.89 + i * 0.012;
      return `<path d="${smooth(inner(k))}" fill="none" stroke="#fff" stroke-opacity="${0.05 + (i % 3) * 0.03}" stroke-width=".7"/>`;
    }).join('');
    const parts = Array.from({ length: 26 }, () => {
      const a = r() * Math.PI * 2, d = r() * 80;
      return `<circle cx="${f2(UC.x + Math.cos(a) * d)}" cy="${f2(UC.y + Math.sin(a) * d * 1.05)}" r="${f2(0.6 + r() * 1.6)}" fill="${sono ? '#444' : '#fff'}" opacity="${f2(0.2 + r() * 0.4)}"/>`;
    }).join('');
    return `<path d="${smooth(UTERUS)}" fill="url(#wl${id})" ${sono ? `filter="url(#tx${id})"` : ''}/>
      ${stri}
      <path d="${smooth(cav)}" fill="url(#fl${id})"/>
      <path d="${smooth(inner(0.85))}" fill="none" stroke="${sono ? '#666' : '#fff'}" stroke-opacity=".5" stroke-width="1"/>
      ${sono ? '' : `<ellipse cx="88" cy="70" rx="46" ry="26" fill="#fff" opacity=".35" filter="url(#bl${id})"/>`}
      ${parts}`;
  }

  // المشيمة على الجدار العلوي الأيمن
  function placenta(id, t, sono, r) {
    const th = 9 + t * 13;
    const arc = [], inn = [];
    for (let i = 0; i <= 8; i++) {
      const a = lerp(-1.95, -0.55, i / 8);
      const pOut = V(UC.x + Math.cos(a) * 97, UC.y + Math.sin(a) * 108);
      arc.push(pOut);
      const bulge = Math.sin(i / 8 * Math.PI);
      inn.unshift(add(UC, mul(sub(pOut, UC), 1 - (th * (0.5 + bulge * 0.7)) / 100)));
    }
    const shape = smooth([...arc, ...inn]);
    const lob = Array.from({ length: 7 }, (_, i) => {
      const p = inn[1 + i] || inn[inn.length - 2];
      const q = add(p, mul(sub(UC, p), -0.06));
      return `<circle cx="${f2(q.x)}" cy="${f2(q.y)}" r="${f2(th * 0.55)}" fill="none" stroke="${sono ? '#fff' : '#5b0f24'}" stroke-opacity=".35" stroke-width=".8"/>`;
    }).join('');
    const ins = inn[4];
    const vessels = sono ? '' : Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI + i * 0.55 + r() * 0.3, l = 10 + r() * 14;
      const e = add(ins, V(Math.cos(a) * l, Math.sin(a) * l * 0.5));
      return `<path d="M${pt(ins)}Q${pt(add(ins, V(Math.cos(a + .4) * l * .5, Math.sin(a + .4) * l * .3)))} ${pt(e)}" stroke="#4a1530" stroke-width="1.1" fill="none" opacity=".55"/>`;
    }).join('');
    return {
      svg: `<path d="${shape}" fill="url(#pl${id})" filter="url(#tx${id})"/>${lob}${vessels}`,
      insertion: ins
    };
  }

  // الحبل السري الملتف
  function cord(a, b, ctrl1, ctrl2, w, sono) {
    const N = 70, P = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      P.push(V(u * u * u * a.x + 3 * u * u * t * ctrl1.x + 3 * u * t * t * ctrl2.x + t * t * t * b.x,
               u * u * u * a.y + 3 * u * u * t * ctrl1.y + 3 * u * t * t * ctrl2.y + t * t * t * b.y));
    }
    const base = 'M' + P.map(pt).join('L');
    const spiral = ph => 'M' + P.map((p, i) => {
      const d = norm(sub(P[Math.min(N, i + 1)], P[Math.max(0, i - 1)]));
      return pt(add(p, mul(perp(d), Math.sin(i * 0.9 + ph) * w * 0.32)));
    }).join('L');
    return `<path d="${base}" stroke="${sono ? '#9a9a9a' : '#e7a7b6'}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
      <path d="${spiral(0)}" stroke="${sono ? '#cfcfcf' : '#b23a5a'}" stroke-width="${f2(w * .26)}" fill="none" opacity=".85"/>
      <path d="${spiral(Math.PI)}" stroke="${sono ? '#bbb' : '#6a5aa8'}" stroke-width="${f2(w * .3)}" fill="none" opacity=".55"/>
      <path d="${base}" stroke="#fff" stroke-width="${f2(w * .22)}" fill="none" opacity="${sono ? .1 : .35}" transform="translate(${f2(-w * .2)} ${f2(-w * .2)})" stroke-linecap="round"/>`;
  }

  /* ---------- الجنين (من الأسبوع 9) ---------- */
  function fetusFigure(week, id, sono) {
    const t = clamp((week - 9) / 31);
    const pal = skinPalette(t, sono);
    const r = 40;
    const L = 62 + 78 * Math.pow(t, 0.8);
    const W = r * (1.05 + 1.05 * t);
    const fat = 0.75 + 0.45 * t;
    const N = V(0.25 * r, 0.8 * r);
    const ang = 28 * Math.PI / 180, d = V(Math.sin(ang), Math.cos(ang)), n = V(Math.cos(ang), -Math.sin(ang));
    const P = (u, v) => add(add(N, mul(d, u * L)), mul(n, v * W));
    const belly = 0.55 + 0.1 * t;

    const torso = [P(-0.02, 0.3), P(0.25, 0.52), P(0.55, 0.58), P(0.85, 0.46), P(1.02, 0.14), P(1.0, -0.25), P(0.8, -belly + 0.04), P(0.5, -belly), P(0.22, -0.46), P(0.02, -0.25)];

    const nz = 0.03 + 0.11 * t, ck = 0.06 * t, fh = 0.08 * (1 - t);
    const H = [[0.95, -0.1], [0.78, -0.68], [0.25, -1.0], [-0.38, -0.97], [-0.86 - fh, -0.6], [-1.03 - fh, -0.18], [-1.0, 0.04], [-1.01 - nz, 0.2], [-0.97, 0.3], [-1.03 - nz * 0.3, 0.38], [-0.97, 0.43], [-1.02 - nz * 0.25, 0.48], [-0.93 - ck, 0.6], [-0.72 - ck, 0.72], [-0.35, 0.8], [0.1, 0.86], [0.6, 0.66], [0.9, 0.3]]
      .map(([x, y]) => V(x * r, y * r));

    const armW = (7 + 0.075 * L) * fat, legW = (9 + 0.1 * L) * fat;
    const fill = `fill="url(#sk${id})" fill-opacity="${pal.op}" stroke="${pal.line}" stroke-width=".8" vector-effect="non-scaling-stroke"`;
    const dark = `fill="url(#skd${id})" fill-opacity="${pal.op}" stroke="${pal.line}" stroke-width=".7" vector-effect="non-scaling-stroke"`;

    // الأطراف البعيدة (خلف الجسم)
    const farArm = limb([P(0.12, 0.08), P(0.46, -0.38), P(0.66, -0.66)], armW * 1.05, armW * 0.7);
    const farHand = P(0.7, -0.72);
    const farLeg = limb([P(0.78, 0.15), P(0.36, -0.82), P(0.74, -0.66)], legW * 1.2, legW * 0.6);

    // الأطراف القريبة
    const sh = P(0.16, -0.02), el = P(0.44, -0.66), wr = V(-0.72 * r, 0.8 * r);
    const nearArm = limb([sh, el, wr], armW * 1.15, armW * 0.72);
    const hip = P(0.82, 0.02), knee = P(0.4, -0.98), ank = P(0.98, -0.55);
    const thigh = limb([hip, P(0.62, -0.62), knee], legW * 1.35, legW * 0.95);
    const shin = limb([knee, P(0.66, -0.98), ank], legW * 0.95, legW * 0.62);

    // القدم وأصابعها
    const fd = norm(add(mul(n, -0.9), mul(d, 0.25))), fu = perp(fd);
    const footLen = legW * (1.1 + 0.2 * t);
    const heel = add(ank, mul(d, legW * 0.25));
    const toe = add(heel, mul(fd, footLen));
    const foot = smooth([add(heel, mul(fu, legW * 0.32)), add(add(heel, mul(fd, footLen * .55)), mul(fu, legW * 0.36)), add(toe, mul(fu, legW * 0.2)), add(toe, mul(fu, -legW * 0.22)), add(add(heel, mul(fd, footLen * .5)), mul(fu, -legW * 0.3)), add(heel, mul(fu, -legW * 0.3))]);
    const toes = week >= 10 ? [0, 1, 2, 3, 4].map(i => {
      const p = add(add(toe, mul(fd, -legW * (0.05 + i * 0.03))), mul(fu, lerp(0.2, -0.22, i / 4) * legW));
      return `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(legW * (0.13 - i * 0.012))}" ${fill}/>`;
    }).join('') : '';

    // اليد قرب الفم والأصابع
    const hc = V(-0.86 * r, 0.62 * r);
    const fingers = [0, 1, 2, 3].map(i => {
      const a = (-115 - i * 16) * Math.PI / 180, l = armW * (0.9 + (i === 1 ? 0.12 : 0) - (i === 3 ? 0.2 : 0)) * (week < 11 ? 0.6 : 1);
      const s = add(hc, V(Math.cos(a) * armW * 0.45, Math.sin(a) * armW * 0.45));
      const m = add(s, V(Math.cos(a - 0.2) * l * 0.55, Math.sin(a - 0.2) * l * 0.55));
      const e = add(m, V(Math.cos(a - 0.7) * l * 0.45, Math.sin(a - 0.7) * l * 0.45));
      return `<path d="${limb([s, m, e], armW * 0.3, armW * 0.24)}" ${fill}/>`;
    }).join('');
    const thumb = `<path d="${limb([add(hc, V(-armW * .3, armW * .2)), add(hc, V(-armW * .75, -armW * .05)), add(hc, V(-armW * 1.0, -armW * .3))], armW * .36, armW * .28)}" ${fill}/>`;
    const palm = `<ellipse cx="${f2(hc.x)}" cy="${f2(hc.y)}" rx="${f2(armW * .62)}" ry="${f2(armW * .5)}" transform="rotate(-50 ${f2(hc.x)} ${f2(hc.y)})" ${fill}/>`;

    // ملامح الوجه
    const eye = V(-0.6 * r, -0.02 * r);
    const open = week >= 28 && !sono;
    const eyeSvg = sono ? `<ellipse cx="${f2(eye.x)}" cy="${f2(eye.y)}" rx="${f2(r * .13)}" ry="${f2(r * .09)}" fill="#202020" opacity=".7"/>` :
      week < 12 ? `<ellipse cx="${f2(eye.x)}" cy="${f2(eye.y)}" rx="${f2(r * .13)}" ry="${f2(r * .11)}" fill="#3b1f24" opacity=".75"/>
                   <path d="M${f2(eye.x - r * .17)} ${f2(eye.y - r * .02)}q${f2(r * .17)} ${f2(-r * .1)} ${f2(r * .34)} 0" stroke="${pal.line}" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>` :
      open ? `<path d="M${f2(eye.x - r * .17)} ${f2(eye.y)}q${f2(r * .17)} ${f2(-r * .14)} ${f2(r * .32)} ${f2(r * .01)}q${f2(-r * .15)} ${f2(r * .12)} ${f2(-r * .32)} ${f2(-r * .01)}z" fill="#fbf4f0"/>
             <circle cx="${f2(eye.x - r * .02)}" cy="${f2(eye.y)}" r="${f2(r * .075)}" fill="#3a3030"/><circle cx="${f2(eye.x - r * .05)}" cy="${f2(eye.y - r * .03)}" r="${f2(r * .025)}" fill="#fff"/>
             <path d="M${f2(eye.x - r * .18)} ${f2(eye.y - r * .01)}q${f2(r * .17)} ${f2(-r * .16)} ${f2(r * .34)} 0" stroke="#5a3a33" stroke-width="1.3" fill="none" vector-effect="non-scaling-stroke"/>` :
      `<path d="M${f2(eye.x - r * .19)} ${f2(eye.y - r * .07)}q${f2(r * .19)} ${f2(-r * .16)} ${f2(r * .36)} ${f2(r * .02)}" fill="${pal.sh}" opacity=".18"/>
       <path d="M${f2(eye.x - r * .17)} ${f2(eye.y)}q${f2(r * .17)} ${f2(r * .09)} ${f2(r * .32)} ${f2(-r * .02)}" stroke="#6a3c36" stroke-width="1.3" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    const lashes = week >= 26 && !sono ? [0, 1, 2, 3].map(i => {
      const x = eye.x - r * .13 + i * r * .085, y = eye.y + r * (0.035 - Math.abs(i - 1.5) * .012);
      return `<path d="M${f2(x)} ${f2(y)}l${f2(-r * .025)} ${f2(r * .07)}" stroke="#5a3a33" stroke-width=".7" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const brow = week >= 22 && !sono ? `<path d="M${f2(eye.x - r * .2)} ${f2(eye.y - r * .2)}q${f2(r * .18)} ${f2(-r * .1)} ${f2(r * .36)} ${f2(-r * .02)}" stroke="#8a5a48" stroke-width="1.2" opacity="${f2(0.2 + 0.3 * t)}" fill="none" vector-effect="non-scaling-stroke"/>` : '';
    const er = V(0.12 * r, (0.34 - 0.28 * t) * r), es = r * (0.19 + 0.04 * t);
    const ear = `<path d="M${f2(er.x - es * .3)} ${f2(er.y - es)}C${f2(er.x + es * .9)} ${f2(er.y - es * 1.2)} ${f2(er.x + es)} ${f2(er.y + es * .3)} ${f2(er.x + es * .3)} ${f2(er.y + es * .7)}C${f2(er.x)} ${f2(er.y + es * 1.05)} ${f2(er.x - es * .45)} ${f2(er.y + es * .9)} ${f2(er.x - es * .35)} ${f2(er.y + es * .5)}"
      fill="${pal.base}" stroke="${pal.line}" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <path d="M${f2(er.x - es * .05)} ${f2(er.y - es * .55)}C${f2(er.x + es * .55)} ${f2(er.y - es * .5)} ${f2(er.x + es * .55)} ${f2(er.y + es * .2)} ${f2(er.x + es * .1)} ${f2(er.y + es * .35)}" fill="none" stroke="${pal.line}" stroke-width=".8" opacity=".7" vector-effect="non-scaling-stroke"/>`;
    const nose = H[7];
    const face = `<circle cx="${f2(nose.x + r * .1)}" cy="${f2(nose.y + r * .07)}" r="${f2(r * .028)}" fill="${pal.line}" opacity=".7"/>
      <path d="M${f2(-0.98 * r)} ${f2(0.43 * r)}q${f2(r * .09)} ${f2(r * .03)} ${f2(r * .16)} ${f2(r * .01)}" stroke="${pal.line}" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>
      ${sono ? '' : `<ellipse cx="${f2(-0.66 * r)}" cy="${f2(0.36 * r)}" rx="${f2(r * .22)}" ry="${f2(r * .16)}" fill="#ff7f8f" opacity="${f2(0.08 + 0.14 * t)}"/>`}`;

    // تفاصيل الجلد حسب العمر
    const rnd = rng(week * 97 + 13);
    const brain = !sono && t < 0.35 ? `<path d="${smooth([V(-0.75 * r, -0.2 * r), V(-0.55 * r, -0.72 * r), V(0, -0.88 * r), V(0.6 * r, -0.6 * r), V(0.7 * r, -0.05 * r), V(0.3 * r, 0.12 * r), V(-0.3 * r, 0.05 * r)])}"
        fill="#e8888a" opacity="${f2(0.22 * (1 - t / 0.35))}"/>
        <path d="M${f2(-0.1 * r)} ${f2(-0.86 * r)}Q${f2(0.05 * r)} ${f2(-0.3 * r)} ${f2(0.5 * r)} ${f2(-0.1 * r)}" stroke="${pal.line}" stroke-width="1" fill="none" opacity="${f2(0.4 * (1 - t / 0.35))}" vector-effect="non-scaling-stroke"/>` : '';
    const vessels = !sono && t < 0.4 ? Array.from({ length: 7 }, (_, i) => {
      const o = i < 4 ? V(-0.2 * r + rnd() * 0.6 * r, -0.7 * r + rnd() * 0.6 * r) : P(0.2 + rnd() * 0.6, -0.2 + rnd() * 0.5);
      const a = rnd() * 6.28, l = 6 + rnd() * 10;
      const m = add(o, V(Math.cos(a) * l, Math.sin(a) * l)), e = add(m, V(Math.cos(a + .6) * l * .7, Math.sin(a + .6) * l * .7));
      return `<path d="M${pt(o)}Q${pt(m)} ${pt(e)}" stroke="#c2384f" stroke-width=".7" fill="none" opacity="${f2(0.45 * (1 - t / 0.4))}" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const spine = t < 0.45 ? Array.from({ length: 13 }, (_, i) => {
      const p = P(0.03 + i * 0.07, 0.4 - Math.sin(i / 12 * Math.PI) * 0.06);
      return `<ellipse cx="${f2(p.x)}" cy="${f2(p.y)}" rx="${f2(2 + L * .012)}" ry="${f2(1.4 + L * .008)}" transform="rotate(${-28 + i * 4} ${f2(p.x)} ${f2(p.y)})" fill="${sono ? '#fff' : pal.sh}" opacity="${f2((sono ? .8 : .45) * (1 - t / 0.45))}"/>`;
    }).join('') : '';
    const ribs = !sono && t > 0.05 && t < 0.4 ? [0, 1, 2, 3, 4].map(i => {
      const a = P(0.2 + i * 0.075, 0.35), b = P(0.24 + i * 0.075, -0.25);
      return `<path d="M${pt(a)}Q${pt(P(0.3 + i * .075, 0.05))} ${pt(b)}" stroke="${pal.sh}" stroke-width=".8" fill="none" opacity="${f2(0.2 * (1 - t / 0.4))}" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const hair = week >= 25 && !sono ? Array.from({ length: 38 }, (_, i) => {
      const a = lerp(-2.6, -0.35, i / 37) + (rnd() - .5) * .05, rr = r * (0.94 + rnd() * .05);
      const p = V(Math.cos(a) * rr, Math.sin(a) * rr - 0.04 * r), q = add(p, V(Math.cos(a + 1.5) * r * (.14 + rnd() * .08), Math.sin(a + 1.5) * r * (.14 + rnd() * .08)));
      return `<path d="M${pt(p)}Q${pt(add(mul(add(p, q), .5), V(0, -2)))} ${pt(q)}" stroke="#6b4434" stroke-width="1" fill="none" opacity="${f2(0.25 + 0.45 * (week - 25) / 15)}" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const lanugo = week >= 20 && week <= 34 && !sono ? Array.from({ length: 30 }, (_, i) => {
      const u = i / 29, p = P(lerp(0.02, 0.95, u), lerp(0.3, 0.12, Math.abs(u - .5) * 2) + 0.28);
      const q = add(p, mul(n, 3 + rnd() * 2));
      return `<path d="M${pt(p)}L${pt(add(q, mul(d, 1.5)))}" stroke="#fff" stroke-width=".6" opacity=".55" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const vernix = week >= 21 && week <= 39 && !sono ? [[0.08, 0.32, 6], [0.4, 0.5, 8], [0.7, 0.44, 7], [0.95, 0.1, 5]].map(([u, v, s]) =>
      `<ellipse cx="${f2(P(u, v).x)}" cy="${f2(P(u, v).y)}" rx="${s * (0.6 + t * .6)}" ry="${s * 0.45}" fill="#fffaf0" opacity="${f2(0.5 * Math.sin((week - 20) / 20 * Math.PI))}" transform="rotate(-30 ${f2(P(u, v).x)} ${f2(P(u, v).y)})"/>`).join('') +
      `<ellipse cx="${f2(er.x + r * .1)}" cy="${f2(er.y + r * .4)}" rx="5" ry="3" fill="#fffaf0" opacity=".45"/>` : '';
    const navel = P(0.62, -belly + 0.02);
    const kneeCrease = !sono && t > 0.5 ? `<path d="M${pt(add(knee, mul(n, legW * .2)))}q3 -1 6 1" stroke="${pal.line}" stroke-width=".8" fill="none" opacity=".5" vector-effect="non-scaling-stroke"/>` : '';
    const fatRolls = !sono && t > 0.6 ? `<path d="M${pt(P(0.62, -0.62 - 0.02))}q4 3 9 2" stroke="${pal.line}" stroke-width=".8" fill="none" opacity=".4" vector-effect="non-scaling-stroke"/>` : '';

    const svg = `
      <path d="${farArm}" ${dark}/><circle cx="${f2(farHand.x)}" cy="${f2(farHand.y)}" r="${f2(armW * .5)}" ${dark}/>
      <path d="${farLeg}" ${dark}/>
      <path d="${smooth(torso)}" ${fill}/>
      ${ribs}${spine}${vessels}${lanugo}${fatRolls}
      <path d="${thigh}" ${fill}/><path d="${shin}" ${fill}/><path d="${foot}" ${fill}/>${toes}${kneeCrease}
      <path d="${smooth(H)}" ${fill}/>
      ${brain}${hair}${ear}${brow}${eyeSvg}${lashes}${face}
      <path d="${nearArm}" ${fill}/>${palm}${fingers}${thumb}
      ${vernix}`;

    const box = [...torso, ...H, knee, toe, hc, farHand];
    return { svg, box, navel };
  }

  /* ---------- الجنين المبكر (الأسابيع 4–8) ---------- */
  function embryoFigure(week, id, sono) {
    const pal = skinPalette(0, sono);
    const fill = `fill="url(#sk${id})" fill-opacity="${sono ? 1 : .88}" stroke="${pal.line}" stroke-width=".8" vector-effect="non-scaling-stroke"`;
    const body = [[-30, -18], [-29, -36], [-13, -49], [6, -49], [22, -39], [32, -18], [36, 6], [30, 27], [17, 40], [4, 42], [-5, 36], [-6, 26], [-15, 18], [-24, 8], [-29, -4]].map(([x, y]) => V(x, y));
    const tailK = clamp((8.5 - week) / 4);
    const tail = tailK > 0 ? `<path d="${limb([V(14, 38), V(6, 50 * (0.85 + tailK * .15)), V(-6, 52 * (0.8 + tailK * .2)), V(-12, 44)].map((p, i) => i ? add(V(14, 38), mul(sub(p, V(14, 38)), 0.3 + tailK * 0.7)) : p), 8, 2)}" ${fill}/>` : '';
    const somites = !sono && week <= 7 ? Array.from({ length: 12 }, (_, i) => {
      const a = lerp(-1.25, 1.15, i / 11), p = V(Math.sin(a) * 31 + 3, -Math.cos(a) * 40 + 2), q = V(Math.sin(a) * 25 + 3, -Math.cos(a) * 34 + 2);
      return `<path d="M${pt(p)}L${pt(q)}" stroke="${pal.line}" stroke-width="1" opacity=".45" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';
    const arches = week >= 5 && week <= 6 ? [0, 1, 2].map(i =>
      `<path d="M${-26 + i * 3} ${-10 + i * 6}q5 -2 9 2" stroke="${pal.line}" stroke-width="1.1" fill="none" vector-effect="non-scaling-stroke"/>`).join('') : '';
    const heart = week >= 5 ? `<ellipse cx="-16" cy="8" rx="8" ry="7" fill="${sono ? '#fff' : '#d42e4a'}" opacity="${sono ? .6 : .55}"/>` : '';
    const liver = week >= 6 && !sono ? `<ellipse cx="-9" cy="20" rx="7" ry="6" fill="#9c3d3a" opacity=".3"/>` : '';
    const eye = week >= 6 ? `<circle cx="-17" cy="-26" r="4.2" fill="${sono ? '#111' : '#2b1a1e'}" opacity=".85"/><circle cx="-17" cy="-26" r="6" fill="none" stroke="${pal.line}" stroke-width=".8" opacity=".6"/>`
      : week === 5 ? `<circle cx="-17" cy="-26" r="4" fill="none" stroke="${pal.line}" stroke-width="1.2" opacity=".7"/>` : '';
    const brainLines = !sono ? `<path d="M-14 -48Q-6 -36 -2 -48M8 -48Q14 -36 22 -38" stroke="${pal.line}" stroke-width=".9" fill="none" opacity=".5" vector-effect="non-scaling-stroke"/>` : '';
    let arm = '', leg = '';
    if (week === 5) { arm = `<ellipse cx="6" cy="4" rx="5" ry="3.5" ${fill}/>`; leg = `<ellipse cx="19" cy="30" rx="4" ry="3" ${fill}/>`; }
    if (week === 6) { arm = `<ellipse cx="2" cy="6" rx="9" ry="5" transform="rotate(35 2 6)" ${fill}/>`; leg = `<ellipse cx="16" cy="32" rx="7" ry="4.5" transform="rotate(-20 16 32)" ${fill}/>`; }
    if (week === 7) {
      arm = `<path d="${limb([V(8, 0), V(-2, 10), V(-8, 14)], 8, 6)}" ${fill}/><circle cx="-10" cy="15" r="5.5" ${fill}/>
             <path d="M-14 12l-2 -1M-15 16l-2 0M-13 19l-2 1" stroke="${pal.line}" stroke-width=".8" vector-effect="non-scaling-stroke"/>`;
      leg = `<path d="${limb([V(20, 26), V(10, 34), V(4, 36)], 8, 6)}" ${fill}/><circle cx="2" cy="37" r="4.6" ${fill}/>`;
    }
    if (week >= 8) {
      arm = `<path d="${limb([V(8, -2), V(4, 14), V(-12, 12)], 8, 5.5)}" ${fill}/><circle cx="-14" cy="11" r="4.6" ${fill}/>` +
        [0, 1, 2, 3, 4].map(i => `<path d="${limb([V(-16, 9 + i * 1.2), V(-21 - (i === 2 ? 1 : 0), 6 + i * 2.2)], 2, 1.4)}" ${fill}/>`).join('');
      leg = `<path d="${limb([V(22, 26), V(6, 30), V(10, 40)], 9, 6)}" ${fill}/><ellipse cx="6" cy="42" rx="6" ry="4" ${fill}/>`;
    }
    const svg = `${tail}<path d="${smooth(body)}" ${fill}/>${somites}${brainLines}${arches}${heart}${liver}${eye}${leg}${arm}`;
    return { svg, box: [...body, V(-12, 52)] };
  }

  /* ---------- الأسابيع 1–3 (منظر مجهري) ---------- */
  function micro(week, id) {
    const r = rng(week * 31 + 7);
    const c = V(120, 130);
    let inner = '';
    if (week === 1) {
      // نسيج المبيض وجريبات بمختلف الأحجام (صبغة H&E)
      const fol = [[85, 95, 12], [150, 80, 9], [70, 170, 8], [165, 175, 11], [125, 210, 7], [60, 125, 6], [185, 125, 7]].map(([x, y, s]) =>
        `<circle cx="${x}" cy="${y}" r="${s}" fill="#f7d6e4" stroke="#8e4a8c" stroke-width="2.4" stroke-dasharray="1.6 1.4"/><circle cx="${x}" cy="${y}" r="${s * .38}" fill="#e7b3cf" stroke="#6a2d6d" stroke-width=".8"/>`).join('');
      inner = `<rect x="0" y="0" width="240" height="260" fill="#eab6c9" filter="url(#tx${id})"/>
        ${Array.from({ length: 160 }, () => `<ellipse cx="${f2(r() * 240)}" cy="${f2(r() * 260)}" rx="${f2(1 + r() * 1.4)}" ry=".9" fill="#7b3f8a" opacity=".5" transform="rotate(${f2(r() * 180)})"/>`).join('')}
        ${fol}
        <circle cx="122" cy="132" r="38" fill="#fbe9f1" stroke="#8e4a8c" stroke-width="5" stroke-dasharray="2 1.6"/>
        <circle cx="122" cy="132" r="31" fill="#fdf3f8"/>
        <circle cx="108" cy="150" r="13" fill="#f2c8de" stroke="#8e4a8c" stroke-width="3" stroke-dasharray="1.5 1.2"/>
        <circle cx="108" cy="150" r="7" fill="#d79bc0" stroke="#5c2a5e" stroke-width="1"/><circle cx="108" cy="150" r="2.4" fill="#4a1d4e"/>`;
    } else if (week === 2) {
      // البويضة مع المنطقة الشفافة والإكليل المشع والحيوانات المنوية
      const corona = Array.from({ length: 70 }, (_, i) => {
        const a = i / 70 * 6.283 + r() * .05, d = 66 + (i % 2) * 9 + r() * 4;
        return `<ellipse cx="${f2(c.x + Math.cos(a) * d)}" cy="${f2(c.y + Math.sin(a) * d)}" rx="5.5" ry="4" transform="rotate(${f2(a * 57.3)} ${f2(c.x + Math.cos(a) * d)} ${f2(c.y + Math.sin(a) * d)})" fill="#e9dcc8" stroke="#a89277" stroke-width=".6"/>
                <circle cx="${f2(c.x + Math.cos(a) * d)}" cy="${f2(c.y + Math.sin(a) * d)}" r="1.5" fill="#7a6a58"/>`;
      }).join('');
      const sperm = Array.from({ length: 9 }, (_, i) => {
        const a = i / 9 * 6.283 + .3, d0 = 88 + r() * 6;
        const h = V(c.x + Math.cos(a) * d0, c.y + Math.sin(a) * d0), dir = V(Math.cos(a), Math.sin(a)), pp = perp(dir);
        const tail = Array.from({ length: 14 }, (_, k) => pt(add(add(h, mul(dir, 5 + k * 3.2)), mul(pp, Math.sin(k * .9 + i) * 2.5)))).join('L');
        return `<path d="M${tail}" stroke="#d9e4ef" stroke-width="1" fill="none" opacity=".85"/>
          <ellipse cx="${f2(h.x)}" cy="${f2(h.y)}" rx="4.2" ry="2.6" transform="rotate(${f2(a * 57.3)} ${f2(h.x)} ${f2(h.y)})" fill="#eef4fa"/>`;
      }).join('');
      inner = `<rect width="240" height="260" fill="#1c2b3a"/>
        <circle cx="${c.x}" cy="${c.y}" r="95" fill="#2b4256" opacity=".6" filter="url(#bl${id})"/>
        ${corona}
        <circle cx="${c.x}" cy="${c.y}" r="60" fill="#d6e6ee" opacity=".55"/>
        <circle cx="${c.x}" cy="${c.y}" r="52" fill="#f1e2c9" filter="url(#tx${id})"/>
        <circle cx="${c.x - 14}" cy="${c.y - 10}" r="13" fill="#e2c9a6" stroke="#b39270" stroke-width="1"/>
        <circle cx="${c.x - 14}" cy="${c.y - 10}" r="4" fill="#9a7552"/>
        <circle cx="${c.x + 30}" cy="${c.y - 38}" r="6" fill="#efe1cc" stroke="#b39270" stroke-width=".8"/>
        ${sperm}`;
    } else {
      // الكيسة الأريمية تنغرس في بطانة الرحم
      const glands = Array.from({ length: 9 }, (_, i) => `<ellipse cx="${18 + i * 26}" cy="${222 + (i % 2) * 10}" rx="7" ry="14" fill="#fbe3ea" stroke="#8a3d78" stroke-width="2" stroke-dasharray="1.5 1.2"/>`).join('');
      const tropho = Array.from({ length: 30 }, (_, i) => {
        const a = i / 30 * 6.283, p = V(120 + Math.cos(a) * 52, 128 + Math.sin(a) * 52);
        return `<ellipse cx="${f2(p.x)}" cy="${f2(p.y)}" rx="8" ry="3.4" transform="rotate(${f2(a * 57.3 + 90)} ${f2(p.x)} ${f2(p.y)})" fill="#f4d2c4" stroke="#9c5470" stroke-width=".8"/><circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="1.4" fill="#6b2e5c"/>`;
      }).join('');
      const icm = Array.from({ length: 14 }, (_, i) => {
        const a = 0.35 + r() * 2.4, d = 30 + r() * 14;
        return `<circle cx="${f2(120 + Math.cos(a) * d)}" cy="${f2(128 + Math.sin(a) * d)}" r="${f2(6 + r() * 2)}" fill="#f0c3c9" stroke="#9c5470" stroke-width=".8"/><circle cx="${f2(120 + Math.cos(a) * d)}" cy="${f2(128 + Math.sin(a) * d)}" r="2" fill="#6b2e5c"/>`;
      }).join('');
      inner = `<rect width="240" height="260" fill="#f6dbe3"/>
        <path d="M0 170 Q60 150 120 172 T240 165 V260 H0Z" fill="#e9a9bf" filter="url(#tx${id})"/>
        ${Array.from({ length: 120 }, () => `<circle cx="${f2(r() * 240)}" cy="${f2(180 + r() * 80)}" r="1.2" fill="#6b2a6e" opacity=".5"/>`).join('')}
        ${glands}
        <circle cx="120" cy="128" r="56" fill="#fdf1ee" opacity=".7"/>
        ${tropho}${icm}
        <path d="M78 168 q20 18 42 10 q22 8 42 -10" stroke="#b5426b" stroke-width="3" fill="none" opacity=".6"/>`;
    }
    return inner;
  }

  /* ---------- التجميع ---------- */
  function scene(week, sono) {
    const id = ++uid;
    const r = rng(week * 53 + (sono ? 5 : 0));
    const pal = skinPalette(clamp((week - 9) / 31), sono);
    if (week <= 3 && sono) {
      return defs(id, pal, sono) + uterus(id, sono, r) + `<path d="${smooth(inner(0.55).map(p => V(UC.x + (p.x - UC.x) * 0.35, p.y)))}" fill="#bdbdbd" opacity=".75"/>`;
    }
    if (week <= 3) {
      return `${defs(id, pal, sono)}<clipPath id="mc${id}"><circle cx="120" cy="130" r="116"/></clipPath>
        <g clip-path="url(#mc${id})" ${sono ? `filter="url(#tx${id})"` : ''}>${micro(week, id)}
          <circle cx="120" cy="130" r="116" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="18" filter="url(#bl${id})"/></g>
        <circle cx="120" cy="130" r="116" fill="none" stroke="${sono ? '#555' : '#b4889f'}" stroke-width="3"/>`;
    }
    const t = clamp((week - 9) / 31);
    let out = defs(id, pal, sono) + uterus(id, sono, r);
    const pl = week >= 7 ? placenta(id, t, sono, r) : null;

    if (week <= 8) {
      const sacR = [0, 0, 0, 0, 22, 32, 44, 56, 66][week];
      const sc = V(116, 132);
      const villi = Array.from({ length: 90 }, (_, i) => {
        const a = i / 90 * 6.283, p = V(sc.x + Math.cos(a) * sacR, sc.y + Math.sin(a) * sacR), q = V(sc.x + Math.cos(a + (r() - .5) * .08) * (sacR + 3 + r() * 5), sc.y + Math.sin(a) * (sacR + 3 + r() * 5));
        return `<path d="M${pt(p)}L${pt(q)}" stroke="${sono ? '#bbb' : '#e39aa6'}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`;
      }).join('');
      const fig = embryoFigure(week, id, sono);
      const es = [0, 0, 0, 0, 0.16, 0.28, 0.42, 0.56, 0.72][week];
      const ys = V(sc.x + sacR * 0.55, sc.y + sacR * 0.45);
      out += `${pl ? pl.svg : ''}
        <circle cx="${sc.x}" cy="${sc.y}" r="${sacR}" fill="${sono ? '#050505' : '#fff6ef'}" stroke="${sono ? '#ddd' : '#eab0a6'}" stroke-width="2"/>
        ${villi}
        <circle cx="${sc.x - sacR * .1}" cy="${sc.y - sacR * .08}" r="${sacR * .72}" fill="none" stroke="${sono ? '#666' : '#f3c9c0'}" stroke-width="1" stroke-dasharray="3 2"/>
        <circle cx="${f2(ys.x)}" cy="${f2(ys.y)}" r="${f2(4 + week)}" fill="${sono ? '#111' : '#fde7b0'}" stroke="${sono ? '#eee' : '#e2b45a'}" stroke-width="1.6"/>
        ${week >= 5 ? `<path d="M${pt(ys)}Q${f2(sc.x + 6)} ${f2(sc.y + sacR * .3)} ${f2(sc.x)} ${f2(sc.y + 4)}" stroke="${sono ? '#888' : '#e9a8a0'}" stroke-width="2" fill="none"/>` : ''}
        <g transform="translate(${sc.x - sacR * .1} ${sc.y - sacR * .1}) scale(${es}) rotate(-10)" filter="url(#ds${id})">${fig.svg}</g>`;
      return out;
    }

    // الأسبوع 9 فما فوق
    const fig = fetusFigure(week, id, sono);
    const xs = fig.box.map(p => p.x), ys = fig.box.map(p => p.y);
    const bx = (Math.min(...xs) + Math.max(...xs)) / 2, by = (Math.min(...ys) + Math.max(...ys)) / 2;
    const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const table = [[9, 50], [12, 78], [16, 110], [20, 135], [24, 152], [28, 166], [32, 180], [36, 190], [42, 198]];
    let E = 50;
    for (let i = 0; i < table.length - 1; i++) if (week >= table[i][0] && week <= table[i + 1][0]) E = lerp(table[i][1], table[i + 1][1], (week - table[i][0]) / (table[i + 1][0] - table[i][0]));
    const s = E / ext;
    const rot = week >= 32 ? 150 : week >= 28 ? 40 : -12;
    const C = V(118, week >= 32 ? 136 : 132);
    const tf = p => { const q = mul(sub(p, V(bx, by)), s), a = rot * Math.PI / 180; return add(C, V(q.x * Math.cos(a) - q.y * Math.sin(a), q.x * Math.sin(a) + q.y * Math.cos(a))); };
    const nav = tf(fig.navel), ins = pl.insertion;
    const cw = 3.2 + 4.5 * t;
    const mid = mul(add(nav, ins), .5);
    out += pl.svg +
      cord(nav, ins, add(mid, V(-40 + 20 * t, 30)), add(mid, V(30, -30 + 10 * t)), cw, sono) +
      `<g transform="translate(${f2(C.x)} ${f2(C.y)}) rotate(${rot}) scale(${f2(s)}) translate(${f2(-bx)} ${f2(-by)})" filter="url(#ds${id})">
        <g filter="url(#tx${id})">${fig.svg}</g></g>`;
    return out;
  }

  function baby(week, size = 200) {
    return `<svg class="art-baby" viewBox="0 0 240 260" width="${size}" height="${Math.round(size * 260 / 240)}" role="img" aria-label="رسم توضيحي للجنين في الأسبوع ${week}">${scene(week, false)}</svg>`;
  }

  // عرض بأسلوب السونار
  function sono(week, size = 240) {
    const id = ++uid;
    const fan = `M120 -6 L${f2(120 + Math.sin(0.72) * 290)} ${f2(-6 + Math.cos(0.72) * 290)} A290 290 0 0 1 ${f2(120 - Math.sin(0.72) * 290)} ${f2(-6 + Math.cos(0.72) * 290)} Z`;
    const ga = `${week}w`;
    const ticks = Array.from({ length: 10 }, (_, i) => `<line x1="232" x2="${i % 5 ? 236 : 240}" y1="${20 + i * 24}" y2="${20 + i * 24}" stroke="#8fd" stroke-width="1"/>`).join('');
    return `<svg class="art-sono" viewBox="0 0 240 260" width="${size}" height="${Math.round(size * 260 / 240)}" role="img" aria-label="محاكاة سونار للأسبوع ${week}">
      <defs><clipPath id="fan${id}"><path d="${fan}"/></clipPath>
        <filter id="sn${id}"><feGaussianBlur stdDeviation=".9"/></filter>
        <filter id="sp${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="${week}"/>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 -.12"/></filter></defs>
      <rect width="240" height="260" fill="#000"/>
      <g clip-path="url(#fan${id})">
        <g filter="url(#sn${id})" transform="translate(120 140) scale(1.12) translate(-120 -130)">${scene(week, true)}</g>
        <rect width="240" height="260" filter="url(#sp${id})" opacity=".55"/>
      </g>
      ${ticks}
      <text direction="ltr" x="8" y="16" fill="#cfe" font-size="9" font-family="monospace">GA ${ga}</text>
      <text direction="ltr" x="8" y="28" fill="#8a9" font-size="7" font-family="monospace">OB · 3.5MHz</text>
      <text direction="ltr" x="200" y="252" fill="#8a9" font-size="7" font-family="monospace">محاكاة</text>
    </svg>`;
  }

  function mom(week, size = 120) {
    const id = ++uid;
    const b = Math.max(0, Math.min(1, (week - 10) / 30));
    const bump = 4 + b * 34;
    const chest = 6 + b * 4;
    return `<svg class="art-mom" viewBox="0 0 120 220" width="${size * 0.55}" height="${size}" role="img" aria-label="شكل البطن في الأسبوع ${week}">
      <defs><linearGradient id="mg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ce93d8"/><stop offset="100%" stop-color="#9575cd"/></linearGradient></defs>
      <circle cx="54" cy="24" r="15" fill="#f3c6b3"/>
      <path d="M40 18 Q52 0 68 14 Q60 10 50 14 Q44 22 44 34 Q36 28 40 18Z" fill="#5d4037"/>
      <path d="M48 38 L58 38 L58 46
               C ${62 + chest} 52 ${64 + chest} 66 ${60 + chest * .4} 76
               C ${60 + bump * .6} 82 ${60 + bump} 104 ${58 + bump * .8} 122
               C ${56 + bump * .45} 138 64 144 62 150
               L 64 214 L 54 214 L 52 160 L 48 214 L 38 214 L 38 150
               C 34 130 40 100 42 76 C 42 60 44 48 48 38Z" fill="url(#mg${id})"/>
      <path d="M58 70 C 50 84 46 96 48 108" stroke="#f3c6b3" stroke-width="6" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  function ring(pct, size = 170, label = '', sub = '') {
    const r = 70, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(1, Math.max(0, pct)));
    return `<svg class="ring" viewBox="0 0 170 170" width="${size}" height="${size}">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f06292"/><stop offset="100%" stop-color="#9575cd"/></linearGradient></defs>
      <circle cx="85" cy="85" r="${r}" fill="none" stroke="var(--track)" stroke-width="12"/>
      <circle cx="85" cy="85" r="${r}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 85 85)"/>
      <text x="85" y="80" text-anchor="middle" class="ring-big">${label}</text>
      <text x="85" y="106" text-anchor="middle" class="ring-sub">${sub}</text>
    </svg>`;
  }

  return { baby, sono, mom, ring };
})();
