/* النواة: التخزين، الواجهة، التنقل، الأصوات، التقدم */
(function () {
  'use strict';
  var Chess = ChessJS.Chess;

  /* ===== التخزين ===== */
  var KEY = 'shatranj.v1';
  var DEF = {
    xp: 0, streak: 0, lastDay: '', days: 0,
    lessons: {}, puzzles: {}, pRating: 600, streakBest: 0, pSolved: 0, pFailed: 0, rushBest: 0, coordBest: 0, quizBest: 0,
    games: { played: 0, won: 0, lost: 0, drawn: 0, bestLevel: -1 }, openings: {}, brilliants: 0, ach: {},
    set: { sound: true, pack: 'wood', pieces: 'cburnett', pdiff: 1, vib: true, voice: false, coords: true, theme: 'green', lowfx: false, evalbar: false, coachEvery: true, autoThreat: false, level: 2, color: 'w' },
    saved: null
  };
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  function merge(d, s) { for (var k in d) { if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(d[k])); else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && s[k] && typeof s[k] === 'object') merge(d[k], s[k]); } return s; }
  S = merge(DEF, S);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function touchStreak() {
    var t = today();
    if (S.lastDay === t) return;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    S.streak = S.lastDay === ys ? S.streak + 1 : 1;
    S.lastDay = t; S.days++;
    save();
  }

  /* ===== المستويات ===== */
  var TITLES = ['مبتدئ', 'متعلّم', 'هاوٍ', 'لاعب واعد', 'لاعب نادي', 'متمرّس', 'خبير', 'مرشح أستاذ', 'أستاذ', 'أستاذ دولي', 'أستاذ كبير', 'أسطورة'];
  function levelInfo(xp) {
    var lv = 1, need = 100, acc = 0;
    while (xp >= acc + need) { acc += need; lv++; need = Math.round(need * 1.25); }
    return { lv: lv, cur: xp - acc, need: need, pct: Math.round((xp - acc) / need * 100), title: TITLES[Math.min(TITLES.length - 1, Math.floor((lv - 1) / 2))] };
  }
  function addXp(n, why) {
    if (!n) return;
    var before = levelInfo(S.xp).lv;
    S.xp += n; save();
    var after = levelInfo(S.xp);
    updateChip();
    if (after.lv > before) {
      setTimeout(function () {
        sfx('level'); confetti();
        modal('<div class="big-emoji">🚀</div><h2 class="center">مستوى جديد: ' + after.lv + '</h2><p class="center mut">لقبك الآن: <b>' + after.title + '</b></p><button class="btn pri block" data-close>رائع!</button>');
      }, 700);
    } else if (why) toast('+' + n + ' XP · ' + why);
    checkAch();
  }

  /* ===== الإنجازات ===== */
  var ACH = [
    ['first', '🌱', 'البداية', 'أكمل أول درس', function () { return cnt(S.lessons) >= 1; }],
    ['l10', '📚', 'طالب مجتهد', 'أكمل 10 دروس', function () { return cnt(S.lessons) >= 10; }],
    ['lall', '🎓', 'خريج الأكاديمية', 'أكمل كل الدروس', function () { return cnt(S.lessons) >= totalLessons(); }],
    ['p1', '🧩', 'أول لغز', 'حل لغزًا', function () { return S.pSolved >= 1; }],
    ['p50', '🔥', 'صياد الألغاز', 'حل 50 لغزًا', function () { return S.pSolved >= 50; }],
    ['p200', '💎', 'عقل تكتيكي', 'حل 200 لغز', function () { return S.pSolved >= 200; }],
    ['r1200', '📈', 'تصنيف 1200', 'تصنيف ألغاز 1200', function () { return S.pRating >= 1200; }],
    ['r1600', '🏅', 'تصنيف 1600', 'تصنيف ألغاز 1600', function () { return S.pRating >= 1600; }],
    ['rush10', '⚡', 'البرق', '10 نقاط في العاصفة', function () { return S.rushBest >= 10; }],
    ['win1', '🏆', 'أول انتصار', 'اهزم المدرب', function () { return S.games.won >= 1; }],
    ['win5', '⚔️', 'المحارب', 'اهزم المستوى 5 أو أعلى', function () { return S.games.bestLevel >= 4; }],
    ['brill', '✨', 'عبقري', 'العب نقلة رائعة !!', function () { return S.brilliants >= 1; }],
    ['st3', '📅', 'الالتزام', 'سلسلة 3 أيام', function () { return S.streak >= 3; }],
    ['st7', '🌟', 'أسبوع ذهبي', 'سلسلة 7 أيام', function () { return S.streak >= 7; }],
    ['coord', '🎯', 'عين الصقر', '20 في تدريب الإحداثيات', function () { return S.coordBest >= 20; }],
    ['open5', '📖', 'موسوعي', 'تدرّب على 5 افتتاحات', function () { return cnt(S.openings) >= 5; }],
    ['quiz', '🧠', 'المثقف', '9/10 في الاختبار', function () { return S.quizBest >= 9; }]
  ];
  function cnt(o) { return Object.keys(o || {}).length; }
  function totalLessons() { var n = 0; COURSES.forEach(function (c) { n += c.lessons.length; }); return n; }
  function checkAch() {
    ACH.forEach(function (a) {
      if (!S.ach[a[0]] && a[4]()) {
        S.ach[a[0]] = Date.now(); save();
        setTimeout(function () { sfx('level'); toast(a[1] + ' إنجاز جديد: ' + a[2]); }, 1200);
      }
    });
  }

  /* ===== الواجهة ===== */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var toastT;
  function toast(msg, ms) {
    var t = $('#toast'); t.innerHTML = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2200);
  }
  function modal(html, onClose) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="sheet">' + html + '</div>';
    function close() { if (!m.parentNode) return; m.remove(); if (onClose) onClose(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-close')) close(); });
    document.body.appendChild(m);
    m.close = close;
    return m;
  }
  function confetti() {
    if (S.set.lowfx) return;
    var c = document.createElement('div'); c.className = 'confetti';
    var cols = ['#38f5ff', '#a66bff', '#ff4fd8', '#3dffa8', '#ffc14d'];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * .6 + 's';
      p.style.animationDuration = 1.2 + Math.random() * 1.2 + 's';
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 3200);
  }

  /* ===== الأصوات (مُركّبة، بلا ملفات) ===== */
  var AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function tone(f, d, type, vol, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .2, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  function knock(vol, f) {
    var a = ac(); if (!a) return;
    var len = a.sampleRate * .06, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    var s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    fl.type = 'bandpass'; fl.frequency.value = f || 1800; g.gain.value = vol || .8;
    s.buffer = b; s.connect(fl); fl.connect(g); g.connect(a.destination); s.start();
  }
  /* عينات صوتية حقيقية تُحمَّل مسبقًا لتشغيل فوري بلا تأخير */
  var SAMPLES = { move: 'Move', capture: 'Capture', check: 'Check', win: 'Victory', loss: 'Defeat', draw: 'Draw', notify: 'GenericNotify', low: 'LowTime' };
  var buf = {}, bufPack = null;
  var PACKS = ['wood', 'real', 'future', 'piano', 'nes'];
  function loadPack() {
    var pack = PACKS.indexOf(S.set.pack) >= 0 ? S.set.pack : 'wood';
    if (bufPack === pack) return;
    bufPack = pack; buf = {};
    var a = ac(); if (!a) return;
    Object.keys(SAMPLES).forEach(function (k) {
      var dir = pack === 'wood' && ['move', 'capture', 'check'].indexOf(k) < 0 ? 'real' : pack;
      fetch('sounds/' + dir + '/' + SAMPLES[k] + '.mp3').then(function (r) { return r.arrayBuffer(); })
        .then(function (d) { return new Promise(function (res, rej) { a.decodeAudioData(d, res, rej); }); })
        .then(function (b) { if (bufPack === pack) buf[k] = b; }).catch(function () {});
    });
  }
  function play(k, vol, rate) {
    var a = ac(); if (!a || !buf[k]) return false;
    if (a.state === 'suspended') a.resume();
    var s = a.createBufferSource(), g = a.createGain();
    s.buffer = buf[k]; s.playbackRate.value = rate || 1; g.gain.value = vol == null ? 1 : vol;
    s.connect(g); g.connect(a.destination); s.start();
    return true;
  }
  function sfx(k) {
    if (!S.set.sound) return;
    try {
      loadPack();
      if (k === 'move') { if (!play('move')) knock(.9, 1500); }
      else if (k === 'capture') { if (!play('capture')) { knock(1.2, 900); knock(.6, 2200); } }
      else if (k === 'check') { if (!play('check')) { tone(880, .12, 'square', .08); tone(660, .18, 'square', .07, .1); } }
      else if (k === 'castle') { if (play('move')) setTimeout(function () { play('move', .8, 1.05); }, 90); else knock(.9, 1500); }
      else if (k === 'promote') { play('move'); tone(784, .15, 'triangle', .12, .05); tone(1175, .25, 'triangle', .12, .15); }
      else if (k === 'ok') { tone(784, .14, 'sine', .16); tone(1175, .22, 'sine', .14, .09); }
      else if (k === 'win') { if (!play('win')) [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .25, 'triangle', .15, i * .09); }); }
      else if (k === 'lose') { if (!play('loss')) tone(220, .4, 'triangle', .12); }
      else if (k === 'drawn') { if (!play('draw')) tone(440, .3, 'triangle', .1); }
      else if (k === 'start') { if (!play('notify', .7)) tone(660, .1, 'sine', .1); }
      else if (k === 'level') { [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, .3, 'triangle', .13, i * .07); }); }
      else if (k === 'bad') { tone(196, .16, 'triangle', .14); tone(147, .22, 'triangle', .12, .08); }
      else if (k === 'tap') tone(1400, .03, 'sine', .035);
    } catch (e) {}
    if (S.set.vib && (k === 'bad' || k === 'check')) vibrate(k === 'bad' ? 70 : 25);
    else if (S.set.vib && (k === 'move' || k === 'capture' || k === 'castle')) vibrate(k === 'capture' ? 14 : 8);
  }
  function vibrate(ms) {
    try { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }
  function speak(text) {
    if (!S.set.voice || !text) return;
    text = Coach.stripTags(text).replace(/[★✓!?#+]/g, ' ');
    try {
      if (window.Android && Android.speak) { Android.speak(text); return; }
      if (window.speechSynthesis) {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = 1;
        speechSynthesis.speak(u);
      }
    } catch (e) {}
  }
  function soundFor(mv, c) {
    if (c && c.isCheck()) sfx('check');
    else if (mv && mv.promotion) sfx('promote');
    else if (mv && mv.captured) sfx('capture');
    else if (mv && mv.flags && (mv.flags.indexOf('k') >= 0 || mv.flags.indexOf('q') >= 0)) sfx('castle');
    else sfx('move');
  }

  /* ===== التنقل ===== */
  var routes = {}, stack = [], cleanup = null;
  var NAV = [['home'], ['academy'], ['puzzles'], ['play']];
  var TAB = { home: 'home', academy: 'academy', course: 'academy', lesson: 'academy', openings: 'academy', opening: 'academy', puzzles: 'puzzles', puzzle: 'puzzles', play: 'play', game: 'play', coachsetup: 'play', coachgame: 'play', vsai: 'play', online: 'play', ogame: 'play', friend: 'play', analysis: 'play' };
  var FOCUS = { lesson: 1, puzzle: 1, game: 1, coachgame: 1, ogame: 1, friend: 1, analysis: 1, opening: 1, coords: 1, vision: 1 };
  function route(name, fn) { routes[name] = fn; }
  /* شريط أزرار سفلي ثابت: [[id, icon, label, pri]] */
  function actionbar(items) {
    var old = $('.actionbar'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'actionbar';
    d.innerHTML = items.map(function (x) { return '<button id="' + x[0] + '"' + (x[3] ? ' class="pri"' : '') + '><span class="i">' + x[1] + '</span>' + x[2] + '</button>'; }).join('');
    document.body.appendChild(d);
    return d;
  }
  function go(name, params, replace) {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    if (!replace && stack.length) stack[stack.length - 1].scroll = $('#view').scrollTop;
    var entry = { name: name, params: params || {} };
    if (NAV.some(function (n) { return n[0] === name; })) stack = [entry];
    else if (replace) stack[stack.length - 1] = entry; else stack.push(entry);
    render();
  }
  function back() {
    if ($('.modal')) { $('.modal').close(); return true; }
    if (stack.length <= 1) {
      if (stack[0] && stack[0].name !== 'home') { go('home'); return true; }
      return false;
    }
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    stack.pop();
    render(true);
    return true;
  }
  function render(restore) {
    var e = stack[stack.length - 1];
    var v = $('#view');
    v.className = '';
    v.innerHTML = '';
    var top = e.name;
    var root = TAB[top] || stack[0].name;
    $$('nav.bottom button').forEach(function (b) { b.classList.toggle('on', b.dataset.r === root); });
    document.body.classList.toggle('focus', !!FOCUS[top]);
    var ab = $('.actionbar'); if (ab) ab.remove();
    $('header.top .back').style.visibility = stack.length > 1 ? 'visible' : 'hidden';
    var r = routes[top](v, e.params) || {};
    $('header.top h1').textContent = r.title || 'أكاديمية الشطرنج';
    cleanup = r.cleanup || null;
    v.scrollTop = restore && e.scroll ? e.scroll : 0;
  }
  function onCleanup(fn) { cleanup = fn; }

  function updateChip() {
    var li = levelInfo(S.xp);
    var c = $('header.top .xpchip');
    if (c) c.innerHTML = '<button class="back" id="gear" aria-label="الإعدادات">⚙️</button>';
    var g = $('#gear'); if (g) g.onclick = function () { go('settings'); };
  }

  /* ===== الرئيسية ===== */
  function greet() { var h = new Date().getHours(); return h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'مساء النور 🌤️' : 'مساء الخير 🌙'; }
  function dailyIndex(n) { var d = new Date(); var s = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); return (s * 2654435761 >>> 0) % n; }

  route('home', function (v) {
    var next = nextLesson();
    var daily = S.puzzles['daily-' + today()];
    v.innerHTML =
      '<div class="mini"><div><b>🔥 ' + S.streak + '</b><small>أيام متتالية</small></div><div><b>' + Math.round(S.pRating) + '</b><small>تصنيف الألغاز</small></div><div><b>' + cnt(S.lessons) + '/' + totalLessons() + '</b><small>دروس</small></div></div>' +
      '<button class="bigbtn main" data-go="play"><span class="ic">♟️</span><span><b>العب الآن</b><small>أونلاين، ضد الكمبيوتر، أو مع صديق</small></span></button>' +
      (next ? '<button class="bigbtn" id="cont"><span class="ic">' + next.l.icon + '</span><span><b>تابع التعلم</b><small>' + next.c.title + ' · ' + next.l.title + '</small></span></button>' : '') +
      '<button class="bigbtn" id="daily"><span class="ic">🧩</span><span><b>لغز اليوم</b><small>' + (daily ? '✅ حللته اليوم' : 'لغز جديد كل يوم') + '</small></span></button>' +
      '<div class="links">' +
        '<button data-go="openings">📖 الافتتاحات</button><button data-go="trainers">🎯 تدريبات</button><button data-go="glossary">📘 القاموس</button>' +
        '<button data-go="achievements">🏆 إنجازاتي</button><button data-go="quiz">🧠 اختبار</button><button data-go="about">ℹ️ عن التطبيق</button>' +
      '</div>';
    if (next) $('#cont', v).onclick = function () { go('lesson', { c: next.c.id, l: next.l.id }); };
    $('#daily', v).onclick = function () { go('puzzle', { mode: 'daily' }); };
    bindTiles(v);
    return { title: 'أكاديمية الشطرنج' };
  });

  function tile(r, ic, tt, st, c, pct) {
    return '<div class="tile" data-go="' + r + '" style="--c:' + c + '"><div class="ic">' + ic + '</div><div class="tt">' + tt + '</div><div class="st">' + st + '</div>' + (pct != null ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
  }
  function bindTiles(v) { $$('[data-go]', v).forEach(function (t) { t.onclick = function () { sfx('tap'); go(t.dataset.go); }; }); }
  function nextLesson() {
    for (var i = 0; i < COURSES.length; i++) for (var j = 0; j < COURSES[i].lessons.length; j++) if (!S.lessons[COURSES[i].lessons[j].id]) return { c: COURSES[i], l: COURSES[i].lessons[j] };
    return null;
  }

  /* ===== المزيد ===== */
  route('more', function (v) {
    v.innerHTML = '<div class="grid2">' +
      tile('analysis', '🔬', 'المحلل الذكي', 'حلل أي موقف', '#3dffa8') +
      tile('openings', '📖', 'الافتتاحات', 'موسوعة مشروحة', '#ffc14d') +
      tile('trainers', '🎯', 'التدريبات', 'مهارات سريعة', '#ff9f43') +
      tile('quiz', '🧠', 'اختبر معلوماتك', 'أسئلة وأجوبة', '#38f5ff') +
      tile('glossary', '📘', 'قاموس الشطرنج', GLOSSARY.length + ' مصطلحًا', '#a66bff') +
      tile('achievements', '🏆', 'الإنجازات', cnt(S.ach) + ' / ' + ACH.length, '#ff4fd8') +
      tile('settings', '⚙️', 'الإعدادات', 'الصوت، الرقعة، الصوت العربي', '#9aa3c7') +
      tile('about', 'ℹ️', 'عن التطبيق', 'الإصدار والتراخيص', '#9aa3c7') +
      '</div>';
    bindTiles(v);
    return { title: 'المزيد' };
  });

  route('glossary', function (v) {
    v.innerHTML = '<input type="text" id="gq" placeholder="ابحث عن مصطلح..." style="direction:rtl;margin-bottom:8px"><dl class="gloss card" id="gl"></dl>';
    function draw(q) {
      $('#gl', v).innerHTML = GLOSSARY.filter(function (g) { return !q || (g[0] + g[1]).indexOf(q) >= 0; }).map(function (g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') || '<p class="mut">لا توجد نتائج</p>';
    }
    draw('');
    $('#gq', v).oninput = function () { draw(this.value.trim()); };
    return { title: 'قاموس الشطرنج' };
  });

  route('achievements', function (v) {
    var gs = S.games;
    v.innerHTML = '<div class="card"><h2>📊 إحصائياتك</h2><div class="stats">' +
      '<div class="stat"><b>' + S.xp + '</b><small>نقاط XP</small></div><div class="stat"><b>' + Math.round(S.pRating) + '</b><small>تصنيف الألغاز</small></div><div class="stat"><b>' + S.pSolved + '</b><small>ألغاز محلولة</small></div>' +
      '<div class="stat"><b>' + gs.played + '</b><small>مباريات</small></div><div class="stat"><b>' + gs.won + '</b><small>انتصارات</small></div><div class="stat"><b>' + S.rushBest + '</b><small>أفضل عاصفة</small></div>' +
      '</div></div><div class="ach">' + ACH.map(function (a) {
        return '<div class="a ' + (S.ach[a[0]] ? '' : 'no') + '"><span class="e">' + a[1] + '</span><b>' + a[2] + '</b><br><span class="mut">' + a[3] + '</span></div>';
      }).join('') + '</div>';
    return { title: 'الإنجازات' };
  });

  route('settings', function (v) {
    var st = S.set;
    function sw(k, label, sub) { return '<label class="switch"><span><b>' + label + '</b>' + (sub ? '<br><small class="mut">' + sub + '</small>' : '') + '</span><input type="checkbox" data-k="' + k + '" ' + (st[k] ? 'checked' : '') + '></label>'; }
    var themes = [['green', '#ebecd0', '#739552', 'أخضر'], ['brown', '#f0d9b5', '#b58863', 'بني'], ['blue', '#dee3e6', '#8ca2ad', 'أزرق'], ['walnut', '#e8c99b', '#8a5a36', 'جوزي'], ['purple', '#e9e2f3', '#8877b7', 'بنفسجي'], ['ice', '#e4f0f5', '#6d9eb3', 'جليدي'], ['coral', '#f2e4d6', '#d08a6a', 'مرجاني'], ['marble', '#eceff4', '#8c96ad', 'رخامي'], ['future', '#c9d3f2', '#5a6aa8', 'مستقبلي'], ['neon', '#1c2350', '#0e1333', 'نيون']];
    var sets = [['cburnett', 'كلاسيكي'], ['merida', 'ميريدا'], ['chessnut', 'شيستنات'], ['mpchess', 'أنيق'], ['fantasy', 'خيالي'], ['celtic', 'سلتي'], ['spatial', 'فضائي'], ['pirouetti', 'دائري'], ['rhosgfx', 'رسومي'], ['pixel', 'بكسل'], ['kiwen-suwi', 'مبسّط']];
    var packs = [['wood', 'خشبي كلاسيكي'], ['real', 'واقعي'], ['piano', 'بيانو'], ['future', 'مستقبلي'], ['nes', 'ألعاب قديمة']];
    v.innerHTML = '<div class="card"><h2>🎨 المظهر</h2><div id="pvb" style="max-width:220px;margin:6px auto 12px"></div>' +
      '<b>لون الرقعة</b><div class="themes" style="margin:8px 0 14px">' + themes.map(function (t) {
        return '<button data-t="' + t[0] + '" class="' + (st.theme === t[0] ? 'on' : '') + '" title="' + t[3] + '"><i style="background:' + t[1] + '"></i><i style="background:' + t[2] + '"></i><i style="background:' + t[2] + '"></i><i style="background:' + t[1] + '"></i></button>';
      }).join('') + '</div><b>شكل القطع</b><div class="psets">' + sets.map(function (x) {
        return '<button data-s="' + x[0] + '" class="' + ((st.pieces || 'cburnett') === x[0] ? 'on' : '') + '"><i class="pc wn pv pv-' + x[0] + '"></i><i class="pc bq pv pv-' + x[0] + '"></i><small>' + x[1] + '</small></button>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2>🔊 الأصوات</h2>' + sw('sound', 'أصوات تحريك القطع') + '<div class="psets" id="pk" style="margin-top:10px">' + packs.map(function (x) { return '<button data-p="' + x[0] + '" style="padding:12px 6px">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="card">' + sw('vib', '📳 الاهتزاز') + sw('voice', '🗣️ القراءة الصوتية بالعربية', 'يقرأ المدرب الشرح بصوت عالٍ (يتطلب محرك نطق عربي في الهاتف)') +
      sw('coords', '🔤 إظهار الإحداثيات') + sw('evalbar', '📊 شريط التقييم أثناء اللعب') + sw('coachEvery', '🤖 تقييم كل نقلة', 'المدرب يعلّق على كل نقلة تلعبها') + sw('autoThreat', '🛡️ تنبيه التهديدات تلقائيًا', 'ينبهك المدرب عندما يهدد الخصم شيئًا مهمًا') + sw('lowfx', '🔋 وضع توفير الطاقة', 'إيقاف المؤثرات المتحركة') +
      '</div>' +
      '<div class="card"><h2>🗑️ البيانات</h2><p>يتم حفظ تقدمك على هذا الهاتف فقط.</p><button class="btn bad" id="reset">إعادة ضبط كل التقدم</button></div>';
    $$('input[data-k]', v).forEach(function (i) { i.onchange = function () { st[i.dataset.k] = i.checked; save(); applySettings(); if (i.dataset.k === 'voice' && i.checked) speak('مرحبًا! سأشرح لك النقلات بصوتي.'); }; });
    var pvb = new Board($('#pvb', v), { coords: false });
    pvb.set('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1', { from: 'e1', to: 'g1' });
    $$('.psets button[data-s]', v).forEach(function (b) { b.onclick = function () { st.pieces = b.dataset.s; save(); applySettings(); sfx('move'); $$('.psets button[data-s]', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    function pk() { $$('#pk button', v).forEach(function (b) { b.classList.toggle('on', b.dataset.p === (PACKS.indexOf(st.pack) >= 0 ? st.pack : 'wood')); }); }
    pk(); $$('#pk button', v).forEach(function (b) { b.onclick = function () { st.pack = b.dataset.p; save(); pk(); setTimeout(function () { sfx('move'); }, 250); setTimeout(function () { sfx('capture'); }, 750); setTimeout(function () { sfx('check'); }, 1250); }; });
    $$('.themes button', v).forEach(function (b) { b.onclick = function () { st.theme = b.dataset.t; save(); applySettings(); $$('.themes button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#reset', v).onclick = function () {
      var m = modal('<h2>هل أنت متأكد؟</h2><p class="mut">سيتم حذف كل النقاط والدروس والألغاز المحلولة.</p><div class="row"><button class="btn bad" id="yes">نعم، احذف</button><button class="btn" data-close>إلغاء</button></div>');
      $('#yes', m).onclick = function () { localStorage.removeItem(KEY); location.reload(); };
    };
    return { title: 'الإعدادات' };
  });

  route('about', function (v) {
    v.innerHTML = '<div class="card center"><div class="splash-in" style="font-size:60px">♞</div><h2>أكاديمية الشطرنج الذكية</h2><p>الإصدار 1.6 · تطبيق تعليمي عربي بالكامل يعمل دون إنترنت</p></div>' +
      '<div class="card"><h2>🧠 التقنيات</h2><p>• محرك <b>Stockfish 18</b> (أقوى محرك شطرنج في العالم) يعمل داخل الهاتف — رخصة GPLv3.<br>• مكتبة <b>chess.js</b> لقواعد اللعبة — رخصة BSD.<br>• قطع <b>cburnett</b> — رخصة GPLv2+/CC BY-SA.<br>• خط <b>Cairo</b> — رخصة SIL OFL.<br>• أصوات: الخشبي من تصميم التطبيق، والباقي من lichess.org (Enigmahack) — AGPLv3+.<br>• أطقم القطع الإضافية من lichess.org (merida وchessnut وfantasy وغيرها) برخص حرة.<br>• نظام المدرب العربي والشروحات والألغاز: مطوّر خصيصًا لهذا التطبيق.</p></div>' +
      '<div class="card"><h2>📜 الشطرنج والعرب</h2><p>انتقل الشطرنج من الهند إلى فارس، ثم طوّره العرب في العصر العباسي وألّفوا فيه الكتب، وكان <b>الصولي</b> و<b>العدلي</b> من أعظم لاعبيه. ومن الأندلس انتقل إلى أوروبا. كلمة "شاه مات" و"رخ" من أصول فارسية-عربية.</p></div>';
    return { title: 'عن التطبيق' };
  });

  function applySettings() {
    var keep = document.body.classList.contains('focus');
    document.body.className = 't-' + S.set.theme + ' ps-' + (S.set.pieces || 'cburnett') + (S.set.lowfx ? ' lowfx' : '') + (keep ? ' focus' : '');
  }

  /* ===== التشغيل ===== */
  function boot() {
    document.addEventListener('pointerdown', function unlock() { var a = ac(); if (a && a.state === 'suspended') a.resume(); loadPack(); }, { once: true, capture: true });
    applySettings();
    touchStreak();
    $$('nav.bottom button').forEach(function (b) { b.onclick = function () { sfx('tap'); go(b.dataset.r); }; });
    $('header.top .back').onclick = function () { back(); };
    updateChip();
    go('home');
    if (self.Lichess) Lichess.handleRedirect();
    setTimeout(function () { var s = $('.splash'); if (s) { s.style.opacity = 0; setTimeout(function () { s.remove(); }, 500); } }, 900);
    // تسخين المحرك
    setTimeout(function () { Engine.available(); }, 1200);
    checkAch();
  }

  // زر الرجوع في أندرويد
  self.appBack = function () { return back(); };

  self.App = {
    S: S, save: save, go: go, back: back, route: route, render: render, onCleanup: onCleanup,
    $: $, $$: $$, esc: esc, toast: toast, modal: modal, confetti: confetti, sfx: sfx, soundFor: soundFor, speak: speak, vibrate: vibrate,
    addXp: addXp, actionbar: actionbar, levelInfo: levelInfo, checkAch: checkAch, today: today, dailyIndex: dailyIndex, tile: tile, bindTiles: bindTiles, cnt: cnt,
    boot: boot, Chess: Chess
  };
})();
