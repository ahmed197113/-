/* النواة: التخزين، الواجهة، التنقل، الأصوات، التقدم */
(function () {
  'use strict';
  var Chess = ChessJS.Chess;

  /* ===== التخزين ===== */
  var KEY = 'shatranj.v1';
  var DEF = {
    xp: 0, streak: 0, lastDay: '', days: 0,
    lessons: {}, puzzles: {}, pRating: 800, pSolved: 0, pFailed: 0, rushBest: 0, coordBest: 0, quizBest: 0,
    games: { played: 0, won: 0, lost: 0, drawn: 0, bestLevel: -1 }, openings: {}, brilliants: 0, ach: {},
    set: { sound: true, vib: true, voice: false, coords: true, theme: 'classic', lowfx: false, evalbar: true, coachEvery: true, autoThreat: false, level: 2, color: 'w' },
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
  function sfx(k) {
    if (!S.set.sound) return;
    try {
      if (k === 'move') knock(.9, 1500);
      else if (k === 'capture') { knock(1.2, 900); knock(.6, 2200); }
      else if (k === 'check') { tone(880, .12, 'square', .08); tone(660, .18, 'square', .07, .1); }
      else if (k === 'ok') { tone(660, .12, 'sine', .18); tone(990, .2, 'sine', .16, .1); }
      else if (k === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .25, 'triangle', .15, i * .09); }); }
      else if (k === 'level') { [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, .3, 'triangle', .13, i * .07); }); }
      else if (k === 'bad') { tone(330, .18, 'sawtooth', .07); tone(220, .3, 'sawtooth', .07, .12); }
      else if (k === 'tap') tone(1200, .04, 'sine', .05);
    } catch (e) {}
    if (S.set.vib && (k === 'bad' || k === 'check')) vibrate(k === 'bad' ? 60 : 25);
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
    else if (mv && mv.captured) sfx('capture');
    else sfx('move');
  }

  /* ===== التنقل ===== */
  var routes = {}, stack = [], cleanup = null;
  var NAV = [['home', '🏠', 'الرئيسية'], ['academy', '🎓', 'الأكاديمية'], ['puzzles', '🧩', 'الألغاز'], ['play', '♟️', 'العب'], ['more', '✨', 'المزيد']];
  function route(name, fn) { routes[name] = fn; }
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
    var root = stack[0].name;
    $$('nav.bottom button').forEach(function (b) { b.classList.toggle('on', b.dataset.r === root); });
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
    if (c) c.innerHTML = '⚡ ' + S.xp + ' <span class="mut">· مستوى ' + li.lv + '</span>';
  }

  /* ===== الرئيسية ===== */
  function greet() { var h = new Date().getHours(); return h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'مساء النور 🌤️' : 'مساء الخير 🌙'; }
  function dailyIndex(n) { var d = new Date(); var s = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); return (s * 2654435761 >>> 0) % n; }

  route('home', function (v) {
    var li = levelInfo(S.xp);
    var next = nextLesson();
    var tip = TIPS[dailyIndex(TIPS.length)];
    v.innerHTML =
      '<div class="hero">' +
        '<div class="hi">' + greet() + '</div>' +
        '<div class="lvl"><div class="ring" style="--p:' + li.pct + '"><span>' + li.lv + '</span></div>' +
          '<div style="flex:1"><div class="name">' + li.title + '</div><div class="progress"><i style="width:' + li.pct + '%"></i></div><small class="mut">' + li.cur + ' / ' + li.need + ' XP للمستوى التالي</small></div></div>' +
        '<div class="stats"><div class="stat"><b>🔥 ' + S.streak + '</b><small>أيام متتالية</small></div><div class="stat"><b>🧩 ' + S.pSolved + '</b><small>لغز محلول</small></div><div class="stat"><b>📈 ' + Math.round(S.pRating) + '</b><small>تصنيفك</small></div></div>' +
      '</div>' +
      (next ? '<div class="card glow" id="cont"><div class="row nw"><div style="font-size:34px">' + next.l.icon + '</div><div class="sp"><small class="mut">تابع التعلم · ' + next.c.title + '</small><h2>' + next.l.title + '</h2></div><button class="btn pri sm">ابدأ ◀</button></div></div>' : '') +
      '<div class="card" id="daily"><div class="row nw"><div style="font-size:34px">🌅</div><div class="sp"><h2>لغز اليوم</h2><p>' + (S.puzzles['daily-' + today()] ? '✅ حللته اليوم! عد غدًا' : 'لغز جديد كل يوم — حافظ على سلسلتك!') + '</p></div><button class="btn sm">حل ◀</button></div></div>' +
      '<div class="sec-t">🚀 ابدأ الآن</div>' +
      '<div class="grid2">' +
        tile('academy', '🎓', 'الأكاديمية', cnt(S.lessons) + ' / ' + totalLessons() + ' درس', '#38f5ff', Math.round(cnt(S.lessons) / totalLessons() * 100)) +
        tile('puzzles', '🧩', 'الألغاز', PUZZLES.length + ' لغز مع الشرح', '#ff4fd8') +
        tile('play', '🤖', 'العب مع المدرب', 'مدرب يشرح كل نقلة', '#a66bff') +
        tile('analysis', '🔬', 'المحلل الذكي', 'Stockfish بالعربية', '#3dffa8') +
        tile('openings', '📖', 'الافتتاحات', OPENINGS.length + ' افتتاحية مشروحة', '#ffc14d') +
        tile('trainers', '🎯', 'التدريبات', 'إحداثيات وعاصفة ألغاز', '#ff9f43') +
      '</div>' +
      '<div class="sec-t">💡 نصيحة اليوم</div><div class="card"><p style="color:var(--txt);font-size:15px">' + tip + '</p></div>';
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
    var themes = [['classic', '#c9d3f2', '#5a6aa8', 'مستقبلي'], ['wood', '#f0d9b5', '#b58863', 'خشبي'], ['emerald', '#e6f2e2', '#4f8a6d', 'زمردي'], ['neon', '#1c2350', '#0e1333', 'نيون'], ['marble', '#eceff4', '#8c96ad', 'رخامي']];
    v.innerHTML = '<div class="card">' +
      sw('sound', '🔊 المؤثرات الصوتية') + sw('vib', '📳 الاهتزاز') + sw('voice', '🗣️ القراءة الصوتية بالعربية', 'يقرأ المدرب الشرح بصوت عالٍ (يتطلب محرك نطق عربي في الهاتف)') +
      sw('coords', '🔤 إظهار الإحداثيات') + sw('evalbar', '📊 شريط التقييم أثناء اللعب') + sw('coachEvery', '🤖 تقييم كل نقلة', 'المدرب يعلّق على كل نقلة تلعبها') + sw('autoThreat', '🛡️ تنبيه التهديدات تلقائيًا', 'ينبهك المدرب عندما يهدد الخصم شيئًا مهمًا') + sw('lowfx', '🔋 وضع توفير الطاقة', 'إيقاف المؤثرات المتحركة') +
      '</div><div class="card"><h2>🎨 شكل الرقعة</h2><div class="themes">' + themes.map(function (t) {
        return '<button data-t="' + t[0] + '" class="' + (st.theme === t[0] ? 'on' : '') + '" title="' + t[3] + '"><i style="background:' + t[1] + '"></i><i style="background:' + t[2] + '"></i><i style="background:' + t[2] + '"></i><i style="background:' + t[1] + '"></i></button>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2>🗑️ البيانات</h2><p>يتم حفظ تقدمك على هذا الهاتف فقط.</p><button class="btn bad" id="reset">إعادة ضبط كل التقدم</button></div>';
    $$('input[data-k]', v).forEach(function (i) { i.onchange = function () { st[i.dataset.k] = i.checked; save(); applySettings(); if (i.dataset.k === 'voice' && i.checked) speak('مرحبًا! سأشرح لك النقلات بصوتي.'); }; });
    $$('.themes button', v).forEach(function (b) { b.onclick = function () { st.theme = b.dataset.t; save(); applySettings(); $$('.themes button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#reset', v).onclick = function () {
      var m = modal('<h2>هل أنت متأكد؟</h2><p class="mut">سيتم حذف كل النقاط والدروس والألغاز المحلولة.</p><div class="row"><button class="btn bad" id="yes">نعم، احذف</button><button class="btn" data-close>إلغاء</button></div>');
      $('#yes', m).onclick = function () { localStorage.removeItem(KEY); location.reload(); };
    };
    return { title: 'الإعدادات' };
  });

  route('about', function (v) {
    v.innerHTML = '<div class="card center"><div class="splash-in" style="font-size:60px">♞</div><h2>أكاديمية الشطرنج الذكية</h2><p>الإصدار 1.0 · تطبيق تعليمي عربي بالكامل يعمل دون إنترنت</p></div>' +
      '<div class="card"><h2>🧠 التقنيات</h2><p>• محرك <b>Stockfish 18</b> (أقوى محرك شطرنج في العالم) يعمل داخل الهاتف — رخصة GPLv3.<br>• مكتبة <b>chess.js</b> لقواعد اللعبة — رخصة BSD.<br>• قطع <b>cburnett</b> — رخصة GPLv2+/CC BY-SA.<br>• خط <b>Cairo</b> — رخصة SIL OFL.<br>• نظام المدرب العربي والشروحات والألغاز: مطوّر خصيصًا لهذا التطبيق.</p></div>' +
      '<div class="card"><h2>📜 الشطرنج والعرب</h2><p>انتقل الشطرنج من الهند إلى فارس، ثم طوّره العرب في العصر العباسي وألّفوا فيه الكتب، وكان <b>الصولي</b> و<b>العدلي</b> من أعظم لاعبيه. ومن الأندلس انتقل إلى أوروبا. كلمة "شاه مات" و"رخ" من أصول فارسية-عربية.</p></div>';
    return { title: 'عن التطبيق' };
  });

  function applySettings() {
    document.body.className = 't-' + S.set.theme + (S.set.lowfx ? ' lowfx' : '');
  }

  /* ===== التشغيل ===== */
  function boot() {
    applySettings();
    touchStreak();
    $$('nav.bottom button').forEach(function (b) { b.onclick = function () { sfx('tap'); go(b.dataset.r); }; });
    $('header.top .back').onclick = function () { back(); };
    updateChip();
    go('home');
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
    addXp: addXp, levelInfo: levelInfo, checkAch: checkAch, today: today, dailyIndex: dailyIndex, tile: tile, bindTiles: bindTiles, cnt: cnt,
    boot: boot, Chess: Chess
  };
})();
