/* رسومات SVG مولّدة لكل أسبوع: الجنين داخل الرحم + شكل الأم */
'use strict';

const Art = (() => {
  let uid = 0;

  function womb(content, id, week) {
    const placenta = week >= 10
      ? `<path d="M128 22 Q170 30 182 72 Q160 66 146 50 Q134 38 128 22Z" fill="url(#pl${id})" opacity=".95"/>`
      : '';
    return `
      <defs>
        <radialGradient id="wb${id}" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#ffe9ef"/>
          <stop offset="70%" stop-color="#ffc7d6"/>
          <stop offset="100%" stop-color="#f48fb1"/>
        </radialGradient>
        <radialGradient id="am${id}" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#fffaf3"/>
          <stop offset="100%" stop-color="#ffe0e8"/>
        </radialGradient>
        <radialGradient id="sk${id}" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#ffe1d3"/>
          <stop offset="100%" stop-color="#f2a98f"/>
        </radialGradient>
        <linearGradient id="pl${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d9536f"/><stop offset="100%" stop-color="#a8324e"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#wb${id})"/>
      <circle cx="100" cy="100" r="86" fill="url(#am${id})"/>
      <g opacity=".35" fill="#fff">
        <circle cx="40" cy="60" r="3"/><circle cx="160" cy="140" r="2.5"/><circle cx="55" cy="150" r="2"/><circle cx="150" cy="95" r="2"/>
      </g>
      ${placenta}
      ${content}`;
  }

  function cells(week) {
    const n = week === 1 ? 1 : week === 2 ? 1 : 8;
    if (week <= 2) {
      return `<circle cx="100" cy="100" r="22" fill="#fff3d6" stroke="#f0c36b" stroke-width="3"/>
              <circle cx="100" cy="100" r="8" fill="#f5b041" opacity=".7"/>
              <g stroke="#f0c36b" stroke-width="1.5" opacity=".6">${Array.from({ length: 16 }, (_, i) => {
                const a = i / 16 * Math.PI * 2;
                return `<line x1="${100 + Math.cos(a) * 24}" y1="${100 + Math.sin(a) * 24}" x2="${100 + Math.cos(a) * 30}" y2="${100 + Math.sin(a) * 30}"/>`;
              }).join('')}</g>`;
    }
    const pts = [[0, 0], [-9, -7], [9, -7], [-9, 7], [9, 7], [0, -12], [0, 12], [-13, 0]].slice(0, n);
    return `<g transform="translate(100 100)">
      <circle r="26" fill="#fff3d6" stroke="#f0c36b" stroke-width="2"/>
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#ffd8a8" stroke="#e8a05c" stroke-width="1.2"/>`).join('')}
    </g>`;
  }

  function embryo(week, id) {
    const s = 0.45 + (week - 4) * 0.13;
    const buds = week >= 6
      ? `<ellipse cx="6" cy="2" rx="7" ry="4" transform="rotate(30 6 2)" fill="url(#sk${id})"/>
         <ellipse cx="2" cy="22" rx="7" ry="4" transform="rotate(-20 2 22)" fill="url(#sk${id})"/>` : '';
    return `<g transform="translate(100 100) scale(${s})">
      <circle cx="-48" cy="30" r="12" fill="#ffe6a8" stroke="#e8b85c" stroke-width="2"/>
      <path d="M-30 30 Q-40 28 -38 20" stroke="#e8a090" stroke-width="3" fill="none"/>
      <path d="M-10 -40 C 30 -50 40 0 25 25 C 15 42 -5 45 -12 32 C -16 24 -6 20 -4 26 C 0 30 8 22 8 10 C 8 -8 -10 -12 -22 -10 C -40 -8 -34 -38 -10 -40Z"
        fill="url(#sk${id})" stroke="#e0907a" stroke-width="1.5"/>
      <circle cx="-8" cy="-24" r="3.2" fill="#6b3a3a" opacity=".8"/>
      ${buds}
      <path d="M8 -36 Q14 -30 10 -24" stroke="#c0505a" stroke-width="1.6" fill="none" opacity=".5"/>
    </g>`;
  }

  function fetus(week, id) {
    const t = Math.min(1, Math.max(0, (week - 8) / 32));
    const s = 0.38 + t * 0.66;
    const headR = 36 - t * 6;
    const hair = week >= 25 ? `<path d="M-50 -58 Q-30 -88 0 -72 Q-20 -84 -40 -76" stroke="#7a4b3a" stroke-width="3" fill="none" opacity=".55"/>` : '';
    const fat = 1 + t * 0.25;
    return `<g transform="translate(96 104) scale(${s})">
      <path d="M8 22 C 40 10 60 -40 92 -66" stroke="#e57b95" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M8 22 C 40 10 60 -40 92 -66" stroke="#ffb3c4" stroke-width="2.5" fill="none" stroke-dasharray="4 6" stroke-linecap="round"/>
      <!-- body -->
      <ellipse cx="14" cy="18" rx="${36 * fat}" ry="${48 * fat}" transform="rotate(-28 14 18)" fill="url(#sk${id})" stroke="#de8f78" stroke-width="1.6"/>
      <!-- leg -->
      <path d="M38 40 C 62 30 66 66 40 76 C 22 82 -2 74 -6 58" fill="url(#sk${id})" stroke="#de8f78" stroke-width="1.6"/>
      <ellipse cx="-10" cy="62" rx="12" ry="7" transform="rotate(-20 -10 62)" fill="url(#sk${id})" stroke="#de8f78" stroke-width="1.4"/>
      <!-- head -->
      <circle cx="-24" cy="-40" r="${headR}" fill="url(#sk${id})" stroke="#de8f78" stroke-width="1.6"/>
      ${hair}
      <!-- ear -->
      <path d="M-14 -44 q8 -2 8 8 q0 8 -8 6" fill="none" stroke="#d48268" stroke-width="2"/>
      <!-- eye closed -->
      <path d="M-46 -42 q6 5 12 0" fill="none" stroke="#7a4b3a" stroke-width="2.4" stroke-linecap="round"/>
      ${week >= 26 ? '<path d="M-46 -42 l-2 3 M-42 -39 l-1 3.5 M-37 -39 l0 3.5" stroke="#7a4b3a" stroke-width="1.2"/>' : ''}
      <!-- nose & mouth -->
      <path d="M-56 -32 q-4 4 0 7" fill="none" stroke="#d48268" stroke-width="2"/>
      <path d="M-50 -18 q4 3 8 0" fill="none" stroke="#c0606a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="-38" cy="-26" r="5" fill="#ff9aa8" opacity=".35"/>
      <!-- arm -->
      <path d="M0 -8 C -14 2 -30 4 -40 -4" fill="none" stroke="#de8f78" stroke-width="${11 * fat}" stroke-linecap="round"/>
      <path d="M0 -8 C -14 2 -30 4 -40 -4" fill="none" stroke="#f7bba6" stroke-width="${8.6 * fat}" stroke-linecap="round"/>
      <circle cx="-44" cy="-6" r="${6.5 * fat}" fill="#f7bba6" stroke="#de8f78" stroke-width="1.4"/>
    </g>`;
  }

  function baby(week, size = 200) {
    const id = ++uid;
    let inner;
    if (week <= 3) inner = cells(week);
    else if (week <= 7) inner = embryo(week, id);
    else inner = fetus(week, id);
    return `<svg class="art-baby" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="رسم الجنين في الأسبوع ${week}">${womb(inner, id, week)}</svg>`;
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

  return { baby, mom, ring };
})();
