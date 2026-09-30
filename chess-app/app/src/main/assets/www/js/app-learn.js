/* التعلم: الأكاديمية، الدروس التفاعلية، الافتتاحات، التدريبات، الاختبار */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  function newBoard(el, o) { o = o || {}; if (o.coords === undefined) o.coords = S.set.coords; return new Board(el, o); }
  self.newBoard = newBoard;

  function parseMove(ch, from, to, pr) {
    try { return ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return null; }
  }
  function dests(ch) { return function (s) { return ch.moves({ square: s, verbose: true }).map(function (m) { return m.to; }); }; }
  self.chessDests = dests;

  /* ===== الأكاديمية ===== */
  A.route('academy', function (v) {
    var html = '<div class="card glow"><h2>🎓 أكاديمية الشطرنج</h2><p>مسار تعليمي متكامل من الصفر إلى الاحتراف، بدروس تفاعلية تتدرب فيها بيدك على الرقعة.</p></div>';
    COURSES.forEach(function (c) {
      var done = c.lessons.filter(function (l) { return S.lessons[l.id]; }).length;
      var pct = Math.round(done / c.lessons.length * 100);
      html += '<div class="list"><div class="it" data-c="' + c.id + '"><div class="ic" style="background:' + c.color + '22">' + c.icon + '</div><div class="tx"><b>' + c.title + '</b><small>' + c.desc + '</small><div class="progress" style="margin-top:6px"><i style="width:' + pct + '%"></i></div></div><div class="mut" style="font-size:12px">' + done + '/' + c.lessons.length + '</div></div></div>';
    });
    v.innerHTML = html;
    $$('[data-c]', v).forEach(function (e) { e.onclick = function () { A.sfx('tap'); A.go('course', { c: e.dataset.c }); }; });
    return { title: 'الأكاديمية' };
  });

  function course(id) { return COURSES.filter(function (c) { return c.id === id; })[0]; }

  A.route('course', function (v, p) {
    var c = course(p.c);
    v.innerHTML = '<div class="hero"><div style="font-size:40px">' + c.icon + '</div><div class="name">' + c.title + '</div><p class="mut" style="margin:0">' + c.desc + '</p></div><div class="list">' +
      c.lessons.map(function (l, i) {
        return '<div class="it" data-l="' + l.id + '"><div class="ic">' + l.icon + '</div><div class="tx"><b>' + (i + 1) + '. ' + l.title + '</b><small>' + l.steps.length + ' خطوات · +30 XP</small></div>' + (S.lessons[l.id] ? '<span class="done">✔</span>' : '<span class="mut">◀</span>') + '</div>';
      }).join('') + '</div>';
    $$('[data-l]', v).forEach(function (e) { e.onclick = function () { A.sfx('tap'); A.go('lesson', { c: c.id, l: e.dataset.l }); }; });
    return { title: c.title };
  });

  /* ===== مشغّل الدرس ===== */
  var PIECE_MOVES = {
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]], b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  };
  function starDests(type, s, startRank) {
    var f = s.charCodeAt(0) - 97, r = +s[1] - 1, out = [];
    function add(ff, rr) { if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) out.push(String.fromCharCode(97 + ff) + (rr + 1)); }
    if (type === 'n') [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(function (d) { add(f + d[0], r + d[1]); });
    else if (type === 'k') { for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (a || b) add(f + a, r + b); }
    else if (type === 'p') { add(f, r + 1); if (r === startRank) add(f, r + 2); }
    else PIECE_MOVES[type].forEach(function (d) { for (var k = 1; k < 8; k++) add(f + d[0] * k, r + d[1] * k); });
    return out;
  }

  A.route('lesson', function (v, p) {
    var c = course(p.c), les = c.lessons.filter(function (l) { return l.id === p.l; })[0];
    var idx = 0, doneSteps = {};
    v.innerHTML = '<div class="stepdots" id="dots"></div><div class="card" style="padding:12px 14px"><div class="lesson-text" id="lt"></div></div><div class="bwrap" id="bd"></div><div class="panel"><div class="feedback" id="fb"></div></div>';
    var board = newBoard($('#bd', v), {});
    var bar = A.actionbar([['prev', '▶', 'السابق'], ['hint', '💡', 'تلميح'], ['next', '◀', 'التالي', true]]);
    var ch = null, task = null, stars = null, starPiece = null, moves = 0, solved = false;

    function fb(cls, msg) { var f = $('#fb', v); f.className = 'feedback ' + (cls || ''); f.innerHTML = msg || ''; }
    function dots() { $('#dots', v).innerHTML = les.steps.map(function (s, i) { return '<i class="' + (i === idx ? 'on' : doneSteps[i] ? 'ok' : '') + '"></i>'; }).join(''); }

    function show() {
      var st = les.steps[idx];
      task = st.task || null; solved = !task; stars = null; moves = 0;
      $('#lt', v).innerHTML = st.t;
      fb();
      dots();
      board.arrows([]); board.setMarks({});
      board.setOrientation(st.orient || 'w');
      ch = null;
      if (task && task.type === 'stars') {
        starPiece = { sq: task.from, p: task.piece };
        stars = task.stars.slice();
        drawStars();
        fb('info', 'النجوم: ' + stars.length + ' · الحد الأمثل: ' + task.max + ' نقلات');
        board.o.movable = function () { return solved ? null : 'w'; };
        board.o.dests = function (s) {
          if (s !== starPiece.sq) return [];
          return starDests(starPiece.p[1], s, 1);
        };
        board.o.onMove = function (from, to) {
          moves++;
          starPiece.sq = to;
          A.sfx('move');
          var i = stars.indexOf(to);
          if (i >= 0) { stars.splice(i, 1); A.sfx('ok'); board.burst(to, '#ffd700'); }
          drawStars();
          if (!stars.length) {
            if (moves <= task.max) success(task.ok || 'أحسنت!', '⭐⭐⭐ ' + moves + ' نقلات');
            else success((task.ok || 'أحسنت!'), '⭐ أكملت في ' + moves + ' نقلات (الأفضل ' + task.max + ') — أعد المحاولة للعلامة الكاملة');
          } else fb('info', 'بقي ' + stars.length + ' · النقلات: ' + moves);
          return true;
        };
        board.o.promotion = false;
        board.o.onSquare = null;
      } else {
        var fen = st.fen;
        if (st.moves) { var tmp = new Chess(); st.moves.split(' ').forEach(function (m) { tmp.move(m); }); fen = tmp.fen(); }
        ch = null;
        if (fen && task && task.type === 'move') ch = new Chess(fen);
        board.set(fen || '8/8/8/8/8/8/8/8 w - - 0 1');
        board.o.promotion = true;
        var marks = {};
        if (st.hl) marks.hl = st.hl;
        if (ch && ch.isCheck()) marks.chk = [kingSq(ch, ch.turn())];
        board.setMarks(marks);
        if (st.arrows) board.arrows(st.arrows.map(function (a) { return { from: a[0], to: a[1], c: a[2] || 'g' }; }));
        board.o.onSquare = null;
        if (task && task.type === 'click') {
          board.o.movable = function () { return null; };
          board.o.onSquare = function (s) {
            if (solved) return;
            if (task.ans.indexOf(s) >= 0) { board.mark('good', [s]); success(task.ok); }
            else { board.mark('bad', [s]); A.sfx('bad'); fb('bad', task.no + ' (ضغطت ' + '<b class="sq">' + s + '</b>)'); }
          };
        } else if (task && task.type === 'move') {
          board.o.movable = function () { return solved ? null : ch.turn(); };
          board.o.dests = dests(ch);
          board.o.onMove = function (from, to, pr) {
            var prevFen = ch.fen(), prevLast = board.last;
            var mv = parseMove(ch, from, to, pr);
            if (!mv) return false;
            var u = from + to + (mv.promotion || '');
            var okMove = task.ans.some(function (a) { return a === u || (a.length === 4 && a === from + to); });
            if (task.mate && !ch.isCheckmate()) okMove = false;
            board.set(ch.fen(), { from: from, to: to });
            if (okMove) {
              A.soundFor(mv, ch);
              var marks2 = {}; if (ch.isCheck()) marks2.chk = [kingSq(ch, ch.turn())];
              board.setMarks(marks2);
              success(task.ok || 'أحسنت!');
              if (st.next) {
                setTimeout(function () {
                  var r = ch.move({ from: st.next.slice(0, 2), to: st.next.slice(2, 4), promotion: st.next[4] });
                  board.set(ch.fen(), { from: r.from, to: r.to }); A.soundFor(r, ch);
                }, 700);
              }
            } else {
              A.sfx('bad');
              var msg = task.no || 'ليست النقلة المطلوبة، حاول مرة أخرى.';
              if (ch.isStalemate()) msg = '😱 إغلاق! الخصم لا يملك نقلات وليس في كش = تعادل. حاول مجددًا.';
              else if (task.mate && ch.isCheck()) msg = 'كش، لكن الملك يستطيع الهرب. ابحث عن كش مات.';
              fb('bad', '❌ ' + msg);
              ch.undo();
              board.snapBack(prevFen, to, prevLast);
            }
            return true;
          };
        } else {
          board.o.movable = function () { return null; };
        }
      }
      $('#prev', bar).disabled = idx === 0;
      $('#hint', bar).disabled = !task;
      $('#next', bar).innerHTML = idx === les.steps.length - 1 ? '<span class="i">✔</span>إنهاء' : '<span class="i">◀</span>التالي';
      $('#next', bar).classList.toggle('pri', solved);
      A.speak(st.t);
    }

    function drawStars() {
      var m = {}; m[starPiece.sq] = starPiece.p;
      board.set(m);
      board.setMarks({ star: stars });
    }

    function success(msg, sub) {
      solved = true; doneSteps[idx] = true;
      A.sfx('ok');
      fb('ok', '✅ ' + msg + (sub ? '<br><small>' + sub + '</small>' : ''));
      $('#next', bar).classList.add('pri');
      dots();
      A.speak(msg);
    }

    $('#prev', bar).onclick = function () { if (idx > 0) { idx--; show(); } };
    $('#next', bar).onclick = function () {
      if (!solved) { fb('bad', 'أكمل المهمة أولًا، أو استخدم التلميح 💡'); A.sfx('bad'); return; }
      if (idx < les.steps.length - 1) { idx++; show(); return; }
      finish();
    };
    $('#hint', bar).onclick = function () {
      if (!task) return;
      if (task.type === 'click') board.mark('hint', [task.ans[0]]);
      else if (task.type === 'move') board.arrows([{ from: task.ans[0].slice(0, 2), to: task.ans[0].slice(2, 4), c: 'b' }]);
      else if (task.type === 'stars') {
        var ds = starDests(starPiece.p[1], starPiece.sq, 1).filter(function (d) { return stars.indexOf(d) >= 0; });
        board.mark('hint', ds.length ? ds : [starPiece.sq]);
        fb('info', ds.length ? 'يمكنك الوصول لنجمة مباشرة!' : 'لا توجد نجمة قريبة مباشرة، اقترب منها أولًا.');
      }
    };

    function finish() {
      var first = !S.lessons[les.id];
      S.lessons[les.id] = Date.now(); A.save();
      if (first) A.addXp(30, 'درس مكتمل');
      A.sfx('win'); A.confetti();
      var nx = null;
      COURSES.some(function (cc) { return cc.lessons.some(function (l) { if (!S.lessons[l.id]) { nx = { c: cc.id, l: l.id, t: l.title }; return true; } }); });
      var m = A.modal('<div class="big-emoji">🎉</div><h2 class="center">أكملت: ' + les.title + '</h2><p class="center mut">' + (first ? '+30 XP' : 'مراجعة ممتازة!') + '</p>' +
        (nx ? '<button class="btn pri block" id="nx">الدرس التالي: ' + nx.t + ' ◀</button>' : '') + '<button class="btn block" style="margin-top:8px" id="bk">العودة للدورة</button>');
      if (nx) $('#nx', m).onclick = function () { m.close(); A.go('lesson', { c: nx.c, l: nx.l }, true); };
      $('#bk', m).onclick = function () { m.close(); A.back(); };
    }

    show();
    return { title: les.title };
  });

  function kingSq(ch, color) { var k = ch.findPiece({ type: 'k', color: color }); return k && k[0]; }
  self.kingSq = kingSq;

  /* ===== الافتتاحات ===== */
  A.route('openings', function (v) {
    var lv = ['', 'سهل', 'متوسط', 'متقدم'];
    v.innerHTML = '<div class="card glow"><h2>📖 موسوعة الافتتاحات</h2><p>لا تحفظ النقلات فقط — افهم الفكرة وراء كل نقلة. اختر افتتاحية لتشاهدها أو تتدرب عليها.</p></div><div class="list">' +
      OPENINGS.map(function (o) {
        return '<div class="it" data-o="' + o.id + '"><div class="ic">' + (o.side === 'w' ? '♔' : '♚') + '</div><div class="tx"><b>' + o.name + '</b><small><bdi>' + o.en + ' · ' + o.eco + '</bdi> · ' + lv[o.level] + ' · للـ' + (o.side === 'w' ? 'أبيض' : 'أسود') + '</small></div>' + (S.openings[o.id] ? '<span class="done">✔</span>' : '') + '</div>';
      }).join('') + '</div>';
    $$('[data-o]', v).forEach(function (e) { e.onclick = function () { A.go('opening', { id: e.dataset.o }); }; });
    return { title: 'الافتتاحات' };
  });

  A.route('opening', function (v, p) {
    var o = OPENINGS.filter(function (x) { return x.id === p.id; })[0];
    var mode = p.train ? 'train' : 'view';
    var ch = new Chess(), ply = 0, fens = [ch.fen()], mvs = [];
    o.moves.forEach(function (m) { var r = ch.move(m[0]); mvs.push(r); fens.push(ch.fen()); });
    ch = new Chess();
    v.innerHTML = '<div class="card"><h2>' + o.name + '</h2><p>' + o.idea + '</p></div>' +
      '<div class="seg" style="margin-bottom:10px"><button data-m="view">👁️ مشاهدة وشرح</button><button data-m="train">🏋️ تدرّب عليها</button></div>' +
      '<div class="bwrap" id="bd"></div><div class="panel"><div class="coachbox" id="cb"></div><div class="row" style="margin-top:8px"><button class="btn" id="pv">▶</button><button class="btn" id="nx">◀</button><button class="btn" id="rs">⟲ من البداية</button></div>' +
      '<div class="moves" id="ml" style="margin-top:8px"></div><div class="card" style="margin-top:10px"><h2>🎯 الخطط الرئيسية</h2><ul>' + o.plans.map(function (x) { return '<li class="mut" style="line-height:1.9">' + x + '</li>'; }).join('') + '</ul></div></div>';
    var board = newBoard($('#bd', v), { orientation: o.side });
    function seg() { $$('.seg button', v).forEach(function (b) { b.classList.toggle('on', b.dataset.m === mode); }); }
    $$('.seg button', v).forEach(function (b) { b.onclick = function () { mode = b.dataset.m; seg(); reset(); }; });
    function cb(html) { $('#cb', v).innerHTML = '<div class="who"><span class="bot">🤖</span> المدرب</div>' + html; }
    function list() {
      var h = '';
      mvs.forEach(function (m, i) {
        if (i % 2 === 0) h += '<span class="mn">' + (i / 2 + 1) + '.</span>';
        h += '<span class="mv ' + (i === ply - 1 ? 'cur' : '') + '" data-i="' + (i + 1) + '">' + (mode === 'train' && i >= ply ? '…' : Coach.sanHtml(m.san, m.color)) + '</span>';
      });
      $('#ml', v).innerHTML = h;
      $$('#ml .mv', v).forEach(function (e) { e.onclick = function () { if (mode === 'view') { ply = +e.dataset.i; draw(); } }; });
    }
    function draw(anim) {
      board.set(fens[ply], ply ? { from: mvs[ply - 1].from, to: mvs[ply - 1].to } : null);
      board.arrows([]);
      ch.load(fens[ply]);
      if (mode === 'view') {
        if (ply === 0) cb('اضغط ◀ لمشاهدة النقلات خطوة بخطوة مع شرح كل نقلة.');
        else { var m = mvs[ply - 1]; cb('<b>' + Math.ceil(ply / 2) + (m.color === 'w' ? '. ' : '... ') + '</b>' + Coach.sanHtml(m.san, m.color) + ' — ' + o.moves[ply - 1][1]); A.speak(o.moves[ply - 1][1]); }
        if (ply < mvs.length) board.arrows([{ from: mvs[ply].from, to: mvs[ply].to, c: 'b', o: .45 }]);
      }
      list();
    }
    function reset() {
      ply = 0; draw();
      if (mode === 'train') {
        board.setOrientation(o.side);
        cb('العب نقلات <b>' + (o.side === 'w' ? 'الأبيض' : 'الأسود') + '</b> في ' + o.name + '. سأرد بنقلات الخصم.');
        if (o.side === 'b') setTimeout(autoReply, 500);
      }
    }
    function autoReply() {
      if (ply >= mvs.length) return;
      ply++; draw(); A.soundFor(mvs[ply - 1]);
      if (ply >= mvs.length) done();
    }
    function done() {
      var first = !S.openings[o.id];
      S.openings[o.id] = Date.now(); A.save();
      cb('🎉 أتقنت ' + o.name + '! ' + (first ? '+20 XP' : ''));
      A.sfx('win'); if (first) A.addXp(20, 'افتتاحية جديدة');
      A.checkAch();
    }
    board.o.movable = function () { return mode === 'train' && ply < mvs.length && mvs[ply].color === o.side ? o.side : null; };
    board.o.dests = function (s) { return ch.moves({ square: s, verbose: true }).map(function (m) { return m.to; }); };
    board.o.onMove = function (from, to, pr) {
      var exp = mvs[ply];
      if (exp.from === from && exp.to === to) {
        ply++; draw(); A.soundFor(exp);
        cb('✅ صحيح! ' + o.moves[ply - 1][1]);
        if (ply >= mvs.length) done(); else setTimeout(autoReply, 600);
      } else {
        A.sfx('bad');
        var tmp = new Chess(fens[ply]), r = null;
        try { r = tmp.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) {}
        cb('❌ ' + (r ? Coach.sanHtml(r.san, r.color) + ' ليست نقلة هذه الافتتاحية.' : '') + ' النقلة النظرية: ' + Coach.sanHtml(exp.san, exp.color) + ' — ' + o.moves[ply][1]);
        var mm = {}; mm[to] = board.map[from]; var tmpMap = Object.assign({}, board.map); delete tmpMap[from]; tmpMap[to] = mm[to];
        board.set(tmpMap);
        board.snapBack(fens[ply], to, ply ? { from: mvs[ply - 1].from, to: mvs[ply - 1].to } : null, function () { board.arrows([{ from: exp.from, to: exp.to, c: 'g' }]); });
      }
      return true;
    };
    $('#nx', v).onclick = function () { if (mode === 'view' && ply < mvs.length) { ply++; draw(); A.soundFor(mvs[ply - 1]); } };
    $('#pv', v).onclick = function () { if (mode === 'view' && ply > 0) { ply--; draw(); } };
    $('#rs', v).onclick = reset;
    seg(); reset();
    return { title: o.name };
  });

  /* ===== التدريبات ===== */
  A.route('trainers', function (v) {
    v.innerHTML = '<div class="list">' +
      '<div class="it" data-g="rush"><div class="ic">⚡</div><div class="tx"><b>عاصفة الألغاز</b><small>حل أكبر عدد في 3 دقائق · أفضل نتيجة: ' + S.rushBest + '</small></div></div>' +
      '<div class="it" data-g="coords"><div class="ic">🎯</div><div class="tx"><b>تدريب الإحداثيات</b><small>اضغط المربع المطلوب بسرعة · أفضل: ' + S.coordBest + '</small></div></div>' +
      '<div class="it" data-g="quiz"><div class="ic">🧠</div><div class="tx"><b>اختبر معلوماتك</b><small>10 أسئلة عن القواعد والتاريخ · أفضل: ' + S.quizBest + '/10</small></div></div>' +
      '<div class="it" data-g="vision"><div class="ic">👁️</div><div class="tx"><b>رؤية الحصان</b><small>كم نقلة يحتاج الحصان للوصول؟ يقوّي التخيّل</small></div></div>' +
      '</div>';
    $$('[data-g]', v).forEach(function (e) { e.onclick = function () { A.go(e.dataset.g === 'rush' ? 'puzzle' : e.dataset.g, e.dataset.g === 'rush' ? { mode: 'rush' } : {}); }; });
    return { title: 'التدريبات' };
  });

  A.route('coords', function (v) {
    var orient = 'w', running = false, score = 0, target = null, left = 30, timer = null;
    v.innerHTML = '<div class="seg" style="margin-bottom:10px"><button data-o="w" class="on">من جهة الأبيض</button><button data-o="b">من جهة الأسود</button></div><div class="bigsq" id="tg">?</div><div class="row" style="justify-content:center;gap:20px;margin-bottom:8px"><div class="timer" id="tm">30</div><div class="timer" id="sc" style="color:var(--ok)">0</div></div><div class="bwrap" id="bd"></div><div class="panel"><button class="btn pri block" id="st">ابدأ ▶</button></div>';
    var board = newBoard($('#bd', v), { coords: false });
    board.set('8/8/8/8/8/8/8/8 w - - 0 1');
    function pick() { target = String.fromCharCode(97 + Math.floor(Math.random() * 8)) + (1 + Math.floor(Math.random() * 8)); $('#tg', v).textContent = target; }
    board.o.onSquare = function (s) {
      if (!running) return;
      if (s === target) { score++; A.sfx('tap'); board.mark('good', [s]); $('#sc', v).textContent = score; pick(); }
      else { A.sfx('bad'); board.mark('bad', [s]); }
      setTimeout(function () { board.setMarks({}); }, 250);
    };
    $$('.seg button', v).forEach(function (b) { b.onclick = function () { if (running) return; orient = b.dataset.o; board.setOrientation(orient); $$('.seg button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#st', v).onclick = function () {
      if (running) return;
      running = true; score = 0; left = 30; $('#sc', v).textContent = 0; pick();
      this.disabled = true;
      timer = setInterval(function () {
        left--; $('#tm', v).textContent = left;
        if (left <= 0) {
          clearInterval(timer); running = false; $('#st', v).disabled = false; $('#tg', v).textContent = '⏱️';
          var best = score > S.coordBest; if (best) { S.coordBest = score; A.save(); }
          A.addXp(Math.min(20, score), 'تدريب الإحداثيات');
          A.modal('<div class="big-emoji">🎯</div><h2 class="center">النتيجة: ' + score + '</h2><p class="center mut">' + (best ? '🏆 رقم قياسي جديد!' : 'أفضل نتيجة: ' + S.coordBest) + '</p><p class="center mut">الأساتذة يصلون إلى 35+ في 30 ثانية</p><button class="btn pri block" data-close>حسنًا</button>');
        }
      }, 1000);
    };
    return { title: 'تدريب الإحداثيات', cleanup: function () { clearInterval(timer); } };
  });

  A.route('vision', function (v) {
    var from, to, ans, score = 0, n = 0;
    v.innerHTML = '<div class="card"><p>كم نقلة يحتاج الحصان للوصول من المربع الأخضر إلى النجمة؟ (تخيّل دون تحريك!)</p></div><div class="bwrap" id="bd"></div><div class="panel"><div class="row" id="ops" style="justify-content:center"></div><div class="feedback" id="fb"></div><p class="center mut" id="sc"></p></div>';
    var board = newBoard($('#bd', v), {});
    function dist(a, b) {
      var q = [[a, 0]], seen = {}; seen[a] = 1;
      while (q.length) { var x = q.shift(); if (x[0] === b) return x[1]; starDests('n', x[0]).forEach(function (d) { if (!seen[d]) { seen[d] = 1; q.push([d, x[1] + 1]); } }); }
      return -1;
    }
    function rnd() { return String.fromCharCode(97 + Math.floor(Math.random() * 8)) + (1 + Math.floor(Math.random() * 8)); }
    function round() {
      from = rnd(); do { to = rnd(); } while (to === from);
      ans = dist(from, to);
      var m = {}; m[from] = 'wn'; board.set(m); board.setMarks({ star: [to], good: [from] });
      $('#fb', v).className = 'feedback';
      $('#ops', v).innerHTML = [1, 2, 3, 4, 5, 6].map(function (k) { return '<button class="btn" data-k="' + k + '">' + k + '</button>'; }).join('');
      $$('#ops button', v).forEach(function (b) {
        b.onclick = function () {
          n++;
          if (+b.dataset.k === ans) { score++; A.sfx('ok'); $('#fb', v).className = 'feedback ok'; $('#fb', v).textContent = '✅ صحيح! ' + ans + ' نقلات.'; }
          else { A.sfx('bad'); $('#fb', v).className = 'feedback bad'; $('#fb', v).textContent = '❌ الجواب: ' + ans + ' نقلات.'; }
          $('#sc', v).textContent = 'النتيجة: ' + score + ' / ' + n;
          if (n % 10 === 0) A.addXp(score >= 8 ? 15 : 5, 'رؤية الحصان');
          setTimeout(round, 1100);
        };
      });
    }
    round();
    return { title: 'رؤية الحصان' };
  });

  A.route('quiz', function (v) {
    var qs = QUIZ.slice().sort(function () { return Math.random() - .5; }).slice(0, 10), i = 0, score = 0;
    function show() {
      if (i >= qs.length) {
        var best = score > S.quizBest; if (best) { S.quizBest = score; A.save(); }
        A.addXp(score * 2, 'الاختبار');
        v.innerHTML = '<div class="card center"><div class="big-emoji">' + (score >= 8 ? '🏆' : score >= 5 ? '👏' : '📚') + '</div><h2>نتيجتك: ' + score + ' / 10</h2><p>' + (best ? 'رقم قياسي جديد!' : '') + '</p><button class="btn pri" id="again">اختبار جديد</button></div>';
        $('#again', v).onclick = function () { A.go('quiz', {}, true); };
        A.checkAch();
        return;
      }
      var q = qs[i];
      var order = q.a.map(function (_, k) { return k; }).sort(function () { return Math.random() - .5; });
      v.innerHTML = '<div class="progress" style="margin-bottom:12px"><i style="width:' + (i * 10) + '%"></i></div><div class="card"><small class="mut">سؤال ' + (i + 1) + ' من 10</small><h2 style="line-height:1.7">' + q.q + '</h2></div>' +
        order.map(function (k) { return '<button class="opt" data-k="' + k + '">' + q.a[k] + '</button>'; }).join('') + '<div class="feedback" id="fb"></div>';
      $$('.opt', v).forEach(function (b) {
        b.onclick = function () {
          if (v.dataset.lock) return; v.dataset.lock = 1;
          var ok = +b.dataset.k === q.c;
          b.classList.add(ok ? 'ok' : 'bad');
          if (!ok) $$('.opt', v).forEach(function (x) { if (+x.dataset.k === q.c) x.classList.add('ok'); });
          if (ok) { score++; A.sfx('ok'); } else A.sfx('bad');
          var f = $('#fb', v); f.className = 'feedback ' + (ok ? 'ok' : 'bad'); f.innerHTML = (ok ? '✅ صحيح!' : '❌ خطأ') + (q.e ? '<br><small>' + q.e + '</small>' : '');
          setTimeout(function () { delete v.dataset.lock; i++; show(); }, q.e ? 2200 : 1100);
        };
      });
    }
    show();
    return { title: 'اختبر معلوماتك' };
  });
})();
