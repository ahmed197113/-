/* اللعب مع المدرب الذكي + المحلل */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  /* طابور تسلسلي لطلبات المحلل حتى لا تلغي بعضها */
  var q = Promise.resolve();
  function AQ(fn) {
    var p = q.then(fn, fn);
    q = p.catch(function () {});
    return p;
  }
  function analyseQ(fen, o) { return AQ(function () { return Engine.analyse(fen, o); }); }
  self.analyseQ = analyseQ;

  var BOOK = null;
  function isBook(ucis) {
    if (!BOOK) {
      BOOK = {};
      OPENINGS.forEach(function (o) {
        var c = new Chess(), seq = [];
        o.moves.forEach(function (m) { var r = c.move(m[0]); seq.push(r.from + r.to); BOOK[seq.join(' ')] = 1; });
      });
    }
    return !!BOOK[ucis.join(' ')];
  }

  function accuracy(drop) { return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669)); }

  function capturedHtml(ch, color) {
    // القطع التي أسرها اللاعب color
    var start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, have = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    var opp = color === 'w' ? 'b' : 'w';
    ch.board().forEach(function (row) { row.forEach(function (p) { if (p && p.color === opp && p.type !== 'k') have[p.type]++; }); });
    var h = '', mat = 0;
    ['q', 'r', 'b', 'n', 'p'].forEach(function (t) { var n = Math.max(0, start[t] - have[t]); for (var i = 0; i < n; i++) h += '<i class="pc ' + opp + t + '"></i>'; });
    return h;
  }
  function matDiff(ch) {
    var s = 0; ch.board().forEach(function (r) { r.forEach(function (p) { if (p && p.type !== 'k') s += (p.color === 'w' ? 1 : -1) * Coach.VAL[p.type]; }); }); return s;
  }

  /* ===== إعداد المباراة ===== */
  A.route('play', function (v) {
    v.innerHTML = '<button class="bigbtn main" id="on"><span class="ic">🌍</span><span><b>العب أونلاين</b><small>سجّل حسابك والعب ضد لاعبين حقيقيين</small></span></button>' +
      '<button class="bigbtn" id="ai"><span class="ic">🤖</span><span><b>العب ضد الكمبيوتر</b><small>9 مستويات · المدرب يشرح نقلاتك</small></span></button>' +
      '<button class="bigbtn" id="fr"><span class="ic">👥</span><span><b>صديق على نفس الهاتف</b><small>لاعبان على جهاز واحد</small></span></button>' +
      '<button class="bigbtn" id="an"><span class="ic">🔬</span><span><b>المحلل</b><small>حلّل أي موقف أو مباراة</small></span></button>';
    $('#on', v).onclick = function () { A.go('online'); };
    $('#ai', v).onclick = function () { A.go('vsai'); };
    $('#fr', v).onclick = function () { A.go('friend'); };
    $('#an', v).onclick = function () { A.go('analysis'); };
    return { title: 'العب' };
  });

  A.route('vsai', function (v) {
    var st = S.set;
    var html = '';
    if (S.saved && S.saved.moves && S.saved.moves.length) html += '<div class="card glow" id="resume"><div class="row nw"><div style="font-size:30px">⏯️</div><div class="sp"><h2>أكمل مباراتك</h2><p>ضد ' + Engine.LEVELS[S.saved.level].name + ' · ' + Math.ceil(S.saved.moves.length / 2) + ' نقلة</p></div><button class="btn pri sm">متابعة</button></div></div>';
    html += '<div class="card"><h2>🤖 العب ضد المدرب الذكي</h2><p>المدرب يلعب بمستواك ويشرح كل نقلة: هل هي ممتازة أم خطأ، ولماذا، وما الأفضل.</p></div>' +
      '<div class="sec-t">🎚️ المستوى</div><div class="lvgrid">' +
      Engine.LEVELS.map(function (L, i) { return '<button data-l="' + i + '" class="' + (st.level === i ? 'on' : '') + '">' + L.name + '<small>~' + L.elo + '</small></button>'; }).join('') + '</div>' +
      '<div class="sec-t">🎨 اللون</div><div class="seg" id="col"><button data-c="w">♔ أبيض</button><button data-c="r">🎲 عشوائي</button><button data-c="b">♚ أسود</button></div>' +
      '<div class="card" style="margin-top:12px">' +
      '<label class="switch"><span><b>🤖 تقييم كل نقلة</b><br><small class="mut">شرح فوري لنقلاتك</small></span><input type="checkbox" id="ce" ' + (st.coachEvery ? 'checked' : '') + '></label>' +
      '<label class="switch"><span><b>🛡️ تنبيه التهديدات</b><br><small class="mut">ينبهك عندما يهدد الخصم شيئًا</small></span><input type="checkbox" id="at" ' + (st.autoThreat ? 'checked' : '') + '></label>' +
      '<label class="switch" style="border:0"><span><b>📊 شريط التقييم</b></span><input type="checkbox" id="eb" ' + (st.evalbar ? 'checked' : '') + '></label></div>' +
      '<button class="btn pri block" id="start" style="padding:15px;font-size:16px">▶ ابدأ المباراة</button>';
    v.innerHTML = html;
    function seg() { $$('#col button', v).forEach(function (b) { b.classList.toggle('on', b.dataset.c === st.color); }); }
    seg();
    $$('#col button', v).forEach(function (b) { b.onclick = function () { st.color = b.dataset.c; A.save(); seg(); }; });
    $$('.lvgrid button', v).forEach(function (b) { b.onclick = function () { st.level = +b.dataset.l; A.save(); $$('.lvgrid button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); A.sfx('tap'); }; });
    $('#ce', v).onchange = function () { st.coachEvery = this.checked; A.save(); };
    $('#at', v).onchange = function () { st.autoThreat = this.checked; A.save(); };
    $('#eb', v).onchange = function () { st.evalbar = this.checked; A.save(); };
    $('#start', v).onclick = function () {
      var c = st.color === 'r' ? (Math.random() < .5 ? 'w' : 'b') : st.color;
      S.saved = null; A.save();
      A.go('game', { level: st.level, color: c });
    };
    if ($('#resume', v)) $('#resume', v).onclick = function () { A.go('game', { level: S.saved.level, color: S.saved.color, moves: S.saved.moves }); };
    return { title: 'ضد الكمبيوتر' };
  });

  /* ===== المباراة ===== */
  A.route('game', function (v, p) {
    var L = Engine.LEVELS[p.level], user = p.color, eng = user === 'w' ? 'b' : 'w';
    var ch = new Chess(p.fen || undefined), hist = [], gen = 0, over = false, thinking = false;
    var pre = null; // {fen, res}
    var evalW = { cp: 20 };

    v.innerHTML =
      '<div class="plr" id="pe"><div class="av">' + (p.bot ? '♟' : '🤖') + '</div><div><b>' + L.name + '</b> <small class="mut">~' + L.elo + '</small><div class="cap" id="ce"></div></div><span class="sp"></span><span id="st" class="think"></span></div>' +
      '<div class="bwrap" id="bd"></div>' +
      '<div class="plr" id="pu"><div class="av">🧑</div><div><b>أنت</b><div class="cap" id="cu"></div></div><span class="sp"></span><span class="tag v" id="md"></span></div>' +
      '<div class="evalbar" id="evb"><i style="width:50%"></i><span id="evt">0.0</span></div>' +
      '<div class="panel"><div class="coachbox" id="cb"></div><div class="moves" id="ml" style="margin-top:8px"></div></div>';
    var board = newBoard($('#bd', v), { orientation: user });
    var bar = A.actionbar([['hint', '💡', 'أفضل نقلة'], ['thr', '🛡️', 'التهديد'], ['und', '↩️', 'تراجع'], ['flp', '🔄', 'قلب'], ['res', '🏳️', 'استسلام']]);
    $('#evb', v).style.display = S.set.evalbar ? '' : 'none';
    function cb(html) { $('#cb', v).innerHTML = '<div class="who"><span class="bot">🤖</span> المدرب</div>' + html; }
    function status(t) { $('#st', v).innerHTML = t ? '<span class="spin"></span> ' + t : ''; }

    function refresh(last) {
      board.set(ch.fen(), last || null);
      var m = {}; if (ch.isCheck()) m.chk = [kingSq(ch, ch.turn())];
      board.setMarks(m); board.arrows([]);
      $('#ce', v).innerHTML = capturedHtml(ch, eng);
      $('#cu', v).innerHTML = capturedHtml(ch, user);
      var d = matDiff(ch) * (user === 'w' ? 1 : -1);
      $('#md', v).textContent = d > 0 ? '+' + d : d < 0 ? String(d) : '=';
      $('#pe', v).classList.toggle('turn', ch.turn() === eng);
      $('#pu', v).classList.toggle('turn', ch.turn() === user);
      drawList();
      S.saved = over ? null : { level: p.level, color: user, moves: hist.map(function (h) { return h.uci; }) };
      A.save();
    }
    function setEval(sw) {
      if (!sw) return; evalW = sw;
      var w = Coach.winPct(sw);
      var bar = $('#evb i', v); if (bar) bar.style.width = (user === 'w' ? w : w) + '%';
      $('#evt', v).textContent = Coach.scoreText(sw);
    }
    function drawList() {
      var h = '';
      hist.forEach(function (x, i) {
        if (i % 2 === 0 || i === 0) { if (x.color === 'w') h += '<span class="mn">' + x.num + '.</span>'; else if (i === 0) h += '<span class="mn">' + x.num + '...</span>'; }
        h += '<span class="mv' + (i === hist.length - 1 ? ' cur' : '') + '">' + Coach.sanHtml(x.san, x.color) + (x.cls ? '<span class="cl ' + x.cls.cls.cls + '">' + x.cls.cls.sym + '</span>' : '') + '</span>';
      });
      var ml = $('#ml', v); ml.innerHTML = h; ml.scrollTop = ml.scrollHeight;
    }

    function getPre(fen) {
      if (pre && pre.fen === fen) return pre.p;
      var pp = analyseQ(fen, { depth: 12, multipv: 2 });
      pre = { fen: fen, p: pp };
      pp.then(function (r) { if (ch.fen() === fen) setEval(Coach.toWhite(r.lines[0].score, fen.split(' ')[1])); }).catch(function () {});
      return pp;
    }

    board.o.movable = function () { return !over && !thinking && ch.turn() === user ? user : null; };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      if (over || thinking || ch.turn() !== user) return false;
      var before = ch.fen(), mv;
      try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || '');
      var rec = { san: mv.san, uci: u, color: mv.color, num: +before.split(' ')[5], fenBefore: before };
      hist.push(rec);
      A.soundFor(mv, ch);
      refresh({ from: from, to: to });
      var myGen = ++gen;
      var book = isBook(hist.map(function (h) { return h.uci.slice(0, 4); }));
      var after = ch.fen();
      // تقييم النقلة
      if (S.set.coachEvery) {
        cb('<span class="think"><span class="spin"></span> المدرب يقيّم نقلتك...</span>');
        var prP = getPre(before);
        prP.then(function (preRes) {
          if (ch.isGameOver() && !ch.isCheckmate()) return null;
          return analyseQ(after, { depth: 11 }).then(function (aft) {
            if (myGen !== gen && hist.indexOf(rec) < 0) return;
            var cls = Coach.classify(before, u, preRes, ch.isCheckmate() ? null : aft, book);
            rec.cls = cls;
            rec.drop = cls.drop;
            if (cls.key === 'brilliant') { S.brilliants++; A.save(); A.checkAch(); A.confetti(); }
            if (!ch.isCheckmate() && aft.lines[0]) setEval(Coach.toWhite(aft.lines[0].score, after.split(' ')[1]));
            drawList();
            if (hist.indexOf(rec) >= 0) {
              var bad = ['mistake', 'blunder', 'miss', 'inaccuracy'].indexOf(cls.key) >= 0;
              cb(cls.html + (bad && !over ? '<div class="chips"><button class="btn sm pri" id="retry">↩️ جرّب مجددًا</button><button class="btn sm" id="showb">👁️ أرني الأفضل</button></div>' : ''));
              if (bad && !over) {
                $('#retry', v).onclick = function () { takeBack(true); };
                $('#showb', v).onclick = function () { takeBack(false, preRes.lines[0].pv[0]); };
              }
              A.speak(cls.cls.label + '. ' + Coach.stripTags(cls.html).slice(0, 220));
            }
            if (cls.key === 'blunder' || cls.key === 'mistake') A.sfx('bad');
          });
        }).catch(function () {});
      } else {
        cb('');
        getPre(before).then(function (preRes) { rec.drop = Math.max(0, Coach.winPct(preRes.lines[0].score) - 50); }).catch(function () {});
      }
      if (checkEnd()) return true;
      engineTurn(myGen);
      return true;
    };

    function engineTurn(myGen) {
      thinking = true; status('يفكر...');
      var t0 = Date.now(), fen = ch.fen();
      Engine.play(fen, p.level).then(function (u) {
        if (myGen !== gen || ch.fen() !== fen) return;
        var wait = Math.max(0, 500 + Math.random() * 500 - (Date.now() - t0));
        setTimeout(function () {
          if (myGen !== gen || ch.fen() !== fen) return;
          var before = ch.fen();
          var mv = ch.move(Coach.parseUci(u));
          hist.push({ san: mv.san, uci: u, color: mv.color, num: +before.split(' ')[5], fenBefore: before, eng: true });
          A.soundFor(mv, ch);
          thinking = false; status('');
          refresh({ from: mv.from, to: mv.to });
          if (checkEnd()) return;
          var fenNow = ch.fen();
          getPre(fenNow);
          if (S.set.autoThreat) threat(true);
        }, wait);
      }).catch(function (e) { thinking = false; status(''); });
    }

    function threat(auto) {
      if (ch.isCheck()) { if (!auto) cb('أنت في كش! يجب أن تتعامل معه أولًا.'); return; }
      var fen = ch.fen();
      if (!auto) cb('<span class="think"><span class="spin"></span> أبحث عن نوايا الخصم...</span>');
      getPre(fen).catch(function () {}).then(function () {
        return analyseQ(Coach.nullMoveFen(fen), { depth: 10 });
      }).then(function (an) {
        if (ch.fen() !== fen) return;
        var t = Coach.threatText(fen, an);
        if (auto && !t.serious) return;
        if (t.uci) board.arrows([{ from: t.uci.slice(0, 2), to: t.uci.slice(2, 4), c: 'r' }]);
        var cur = $('#cb', v).innerHTML;
        cb((auto ? '⚠️ <b>انتبه!</b> ' : '') + t.html);
        if (auto) A.sfx('check');
        A.speak(Coach.stripTags(t.html));
      }).catch(function () {});
    }

    function checkEnd() {
      if (!ch.isGameOver()) return false;
      over = true; thinking = false; status('');
      var res, emoji;
      if (ch.isCheckmate()) { var winner = ch.turn() === 'w' ? 'b' : 'w'; res = winner === user ? 'win' : 'loss'; }
      else res = 'draw';
      var why = ch.isCheckmate() ? 'كش مات' : ch.isStalemate() ? 'إغلاق' : ch.isThreefoldRepetition() ? 'تكرار ثلاثي' : ch.isInsufficientMaterial() ? 'مادة غير كافية' : 'قاعدة الخمسين نقلة';
      setTimeout(function () { finish(res, why); }, 700);
      return true;
    }

    function finish(res, why) {
      over = true;
      S.saved = null;
      S.games.played++;
      if (res === 'win') { S.games.won++; if (p.level > S.games.bestLevel) S.games.bestLevel = p.level; }
      else if (res === 'loss') S.games.lost++; else S.games.drawn++;
      A.save();
      var mine = hist.filter(function (h) { return h.color === user && h.drop != null; });
      var acc = mine.length ? Math.round(mine.reduce(function (s, h) { return s + accuracy(h.drop); }, 0) / mine.length) : 0;
      var counts = {};
      hist.forEach(function (h) { if (h.color === user && h.cls) counts[h.cls.key] = (counts[h.cls.key] || 0) + 1; });
      var xp = res === 'win' ? 40 + p.level * 10 : res === 'draw' ? 20 : 10;
      A.addXp(xp, res === 'win' ? 'فوز!' : 'مباراة مكتملة');
      if (res === 'win') { A.sfx('win'); A.confetti(); } else A.sfx(res === 'loss' ? 'lose' : 'drawn');
      var t = res === 'win' ? ['🏆', 'فزت!'] : res === 'loss' ? ['💪', 'خسرت هذه المرة'] : ['🤝', 'تعادل'];
      var rows = ['brilliant', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'miss'].filter(function (k) { return counts[k]; }).map(function (k) {
        var C = Coach.CLASSES[k]; return '<div class="row nw"><span class="cls ' + C.cls + '"><span class="sym">' + C.sym + '</span> ' + C.label + '</span><span class="sp"></span><b>' + counts[k] + '</b></div>';
      }).join('');
      var tip = res === 'loss' ? 'حلّل المباراة لتعرف أين تغيّر التقييم — كل خسارة درس مجاني.' : 'حاول المستوى الأعلى لتتحدى نفسك!';
      var m = A.modal('<div class="big-emoji">' + t[0] + '</div><h2 class="center">' + t[1] + '</h2><p class="center mut">' + why + ' · +' + xp + ' XP</p>' +
        (mine.length ? '<div class="card center"><small class="mut">دقة لعبك</small><div class="timer">' + acc + '%</div></div>' : '') +
        (rows ? '<div class="card">' + rows + '</div>' : '') + '<p class="mut center">' + tip + '</p>' +
        '<button class="btn pri block" id="anl">🔬 حلّل المباراة</button><button class="btn block" style="margin-top:8px" id="again">🔁 مباراة جديدة</button>');
      $('#anl', m).onclick = function () { m.close(); A.go('analysis', { moves: hist.map(function (h) { return h.uci; }), orient: user }); };
      $('#again', m).onclick = function () { m.close(); A.go('game', { level: p.level, color: user }, true); };
      refresh();
      cb(t[1] + ' — ' + why);
    }

    function takeBack(retry, show) {
      if (!hist.length) return;
      gen++; Engine.stopPlayer(); thinking = false; status('');
      over = false;
      while (hist.length && hist[hist.length - 1].color !== user) { ch.undo(); hist.pop(); }
      if (hist.length) { ch.undo(); hist.pop(); }
      refresh(hist.length ? { from: hist[hist.length - 1].uci.slice(0, 2), to: hist[hist.length - 1].uci.slice(2, 4) } : null);
      if (show) {
        board.arrows([{ from: show.slice(0, 2), to: show.slice(2, 4), c: 'g' }]);
        var d = Coach.describeMove(ch.fen(), show);
        cb('👁️ الأفضل كان ' + Coach.sanHtml(d.san, d.move.color) + (d.lines[0] ? ' — ' + d.lines[0] : '') + '<br><small class="mut">العبها بنفسك لتثبت الفكرة.</small>');
      } else cb('↩️ حاول إيجاد نقلة أفضل. فكّر: كش؟ أسر؟ تهديد؟ وماذا يريد الخصم؟');
      getPre(ch.fen());
    }

    $('#hint', bar).onclick = function () {
      if (over || ch.turn() !== user || thinking) return;
      var fen = ch.fen();
      cb('<span class="think"><span class="spin"></span> المدرب يبحث عن أفضل نقلة...</span>');
      getPre(fen).then(function (r) {
        if (ch.fen() !== fen) return;
        var e = Coach.explainBest(fen, r);
        board.arrows(r.lines.map(function (l, i) { return { from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), c: i ? 'y' : 'g', o: i ? .5 : .9 }; }).reverse());
        cb(e.html);
        A.speak(e.speech);
      }).catch(function () { cb('تعذّر التحليل الآن.'); });
    };
    $('#thr', bar).onclick = function () { if (!over) threat(false); };
    $('#und', bar).onclick = function () { if (hist.some(function (h) { return h.color === user; })) takeBack(true); };
    $('#flp', bar).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#res', bar).onclick = function () {
      if (over) return;
      var m = A.modal('<h2>🏳️ الاستسلام؟</h2><p class="mut">لا تستسلم بسرعة! الأساتذة يقولون: "لم يفز أحد بالاستسلام".</p><div class="row"><button class="btn bad" id="y">استسلم</button><button class="btn pri" data-close>سأقاتل!</button></div>');
      $('#y', m).onclick = function () { m.close(); gen++; Engine.stopPlayer(); finish('loss', 'استسلام'); };
    };

    // استئناف
    if (p.moves) p.moves.forEach(function (u) { var b = ch.fen(); var mv = ch.move(Coach.parseUci(u)); hist.push({ san: mv.san, uci: u, color: mv.color, num: +b.split(' ')[5], fenBefore: b }); });
    var lm = hist.length ? { from: hist[hist.length - 1].uci.slice(0, 2), to: hist[hist.length - 1].uci.slice(2, 4) } : null;
    refresh(lm);
    cb(hist.length ? 'تابع المباراة. دورك!' : 'مرحبًا! أنا مدربك. العب نقلتك وسأخبرك برأيي فيها. استخدم 💡 إذا احتجت مساعدة. ' + (user === 'w' ? 'أنت الأبيض، ابدأ!' : 'أنت الأسود، سأبدأ أنا.'));
    if (!hist.length) A.sfx('start');
    if (ch.turn() === eng) engineTurn(gen); else getPre(ch.fen());

    return { title: p.bot ? 'مباراة' : 'ضد ' + L.name, cleanup: function () { gen++; Engine.stopPlayer(); Engine.stop(); } };
  });

  /* ===== المحلل الذكي ===== */
  A.route('analysis', function (v, p) {
    var root = p.fen || new Chess().fen();
    var line = []; // [{uci,san,color,fen}]
    var cur = 0;
    var auto = true;
    if (p.moves) { var c0 = new Chess(root); p.moves.forEach(function (u) { var r = c0.move(Coach.parseUci(u)); line.push({ uci: u, san: r.san, color: r.color, fen: c0.fen() }); }); cur = line.length; }
    var ch = new Chess(root), token = 0, lastRes = null, gameEvals = {};

    v.innerHTML = '<div class="bwrap" id="bd"></div><div class="evalbar" id="evb"><i style="width:50%"></i><span id="evt">0.0</span></div>' +
      '<div class="panel"><div class="row nw" style="gap:6px"><button class="btn sm" id="fst">⏮</button><button class="btn sm" id="prv">▶</button><button class="btn sm" id="nxt">◀</button><button class="btn sm" id="lst">⏭</button><span class="sp"></span><button class="btn sm" id="flp">🔄</button><button class="btn sm" id="io">📋</button><button class="btn sm" id="new">🆕</button></div>' +
      '<div class="tools" style="margin-top:6px"><button class="btn sm pri" id="exp">🧠 اشرح أفضل نقلة</button><button class="btn sm" id="thr">🛡️ التهديد</button><button class="btn sm" id="pfh">♟️ العب من هنا</button>' + (p.moves ? '<button class="btn sm" id="rev">📈 مراجعة المباراة</button><button class="btn sm" id="lfm" style="display:none">🎯 تعلّم من أخطائك</button>' : '') + '</div>' +
      '<div class="coachbox" id="cb" style="margin-top:8px"></div><div class="card" id="lines" style="margin-top:8px;padding:10px"></div><div class="moves" id="ml"></div></div>';
    var board = newBoard($('#bd', v), { orientation: p.orient || (root.split(' ')[1]) });
    function cb(h) { $('#cb', v).innerHTML = '<div class="who"><span class="bot">🔬</span> المحلل</div>' + h; }
    function fenAt(i) { return i === 0 ? root : line[i - 1].fen; }

    function draw() {
      var fen = fenAt(cur);
      ch.load(fen);
      board.set(fen, cur ? { from: line[cur - 1].uci.slice(0, 2), to: line[cur - 1].uci.slice(2, 4) } : null);
      var m = {}; if (ch.isCheck()) m.chk = [kingSq(ch, ch.turn())]; board.setMarks(m);
      var h = '', n = +root.split(' ')[5];
      line.forEach(function (x, i) {
        if (x.color === 'w') h += '<span class="mn">' + n + '.</span>'; else if (i === 0) h += '<span class="mn">' + n + '...</span>';
        var g = gameEvals[i + 1];
        h += '<span class="mv' + (i === cur - 1 ? ' cur' : '') + '" data-i="' + (i + 1) + '">' + Coach.sanHtml(x.san, x.color) + (g && g.cls ? '<span class="cl ' + g.cls.cls.cls + '">' + g.cls.cls.sym + '</span>' : '') + '</span>';
        if (x.color === 'b') n++;
      });
      $('#ml', v).innerHTML = h || '<span class="mut">حرّك القطع بحرية لتحليل أي موقف</span>';
      $$('#ml .mv', v).forEach(function (e) { e.onclick = function () { cur = +e.dataset.i; draw(); }; });
      if (gameEvals[cur] && gameEvals[cur].cls) cb(gameEvals[cur].cls.html);
      analyse();
    }

    function analyse() {
      var fen = fenAt(cur), my = ++token;
      board.arrows([]);
      if (lmode) { $('#lines', v).innerHTML = '<span class="mut">🎯 وضع التعلّم: التحليل مخفي حتى تجد النقلة.</span>'; return; }
      if (ch.isGameOver()) {
        $('#lines', v).innerHTML = '<b>' + (ch.isCheckmate() ? 'كش مات!' : 'تعادل') + '</b>';
        return;
      }
      $('#lines', v).innerHTML = '<span class="think"><span class="spin"></span> Stockfish يحلل...</span>';
      Engine.stop();
      analyseQ(fen, { depth: 15, multipv: 3 }).then(function (r) {
        if (my !== token) return;
        lastRes = r;
        var turn = fen.split(' ')[1];
        var sw = Coach.toWhite(r.lines[0].score, turn);
        var w = Coach.winPct(sw);
        $('#evb i', v).style.width = w + '%'; $('#evt', v).textContent = Coach.scoreText(sw);
        $('#lines', v).innerHTML = '<small class="mut">أفضل الخطوط (عمق ' + (r.lines[0].depth || '') + ')' + (r.fallback ? ' · محرك احتياطي' : '') + '</small>' + r.lines.map(function (l, i) {
          return '<div class="row nw" style="margin-top:6px;cursor:pointer" data-u="' + l.pv[0] + '"><bdi class="evalchip" style="min-width:52px;text-align:center">' + Coach.scoreText(Coach.toWhite(l.score, turn)) + '</bdi><div class="pv" style="flex:1">' + Coach.pvToHtml(fen, l.pv, 6) + '</div></div>';
        }).join('');
        $$('#lines [data-u]', v).forEach(function (e) { e.onclick = function () { play(e.dataset.u); }; });
        board.arrows(r.lines.map(function (l, i) { return { from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), c: i === 0 ? 'g' : 'b', o: i === 0 ? .85 : .35, w: i === 0 ? .17 : .12 }; }).reverse());
        if (auto && !gameEvals[cur]) cb(Coach.scoreSentence(sw) + ' اضغط "اشرح أفضل نقلة" لشرح مفصّل.');
      }).catch(function () {});
    }

    function play(u) {
      var c = new Chess(fenAt(cur)), r;
      try { r = c.move(Coach.parseUci(u)); } catch (e) { return false; }
      if (cur < line.length && line[cur].uci === u) { cur++; draw(); A.soundFor(r, c); return true; }
      line = line.slice(0, cur);
      Object.keys(gameEvals).forEach(function (k) { if (+k > cur) delete gameEvals[k]; });
      line.push({ uci: u, san: r.san, color: r.color, fen: c.fen() });
      cur++;
      A.soundFor(r, c);
      draw();
      return true;
    }

    board.o.movable = function () { return 'both'; };
    board.o.dests = function (s) { var pc = ch.get(s); if (!pc || pc.color !== ch.turn()) return []; return ch.moves({ square: s, verbose: true }).map(function (m) { return m.to; }); };
    var lmode = null;
    board.o.onMove = function (from, to, pr) {
      var c = new Chess(fenAt(cur)), r;
      try { r = c.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = r.from + r.to + (r.promotion || '');
      if (lmode) {
        var m = lmode.m, fen0 = fenAt(cur);
        var okm = u === m.best || m.good.indexOf(u) >= 0 || c.isCheckmate();
        if (okm) {
          A.sfx('ok'); A.soundFor(r, c);
          var d = Coach.describeMove(fen0, u);
          board.set(c.fen(), { from: r.from, to: r.to });
          cb('✅ ممتاز! ' + Coach.sanHtml(d.san, d.move.color) + (d.lines[0] ? ' — ' + d.lines[0] : '') + '<div class="chips"><button class="btn sm pri" id="lnx">التالي ◀</button></div>');
          var ii = lmode.i; lmode = null;
          $('#lnx', v).onclick = function () { learn(ii + 1); };
        } else {
          A.sfx('bad'); lmode.tries++;
          board.set(c.fen(), { from: r.from, to: r.to });
          board.snapBack(fen0, r.to, cur ? { from: line[cur - 1].uci.slice(0, 2), to: line[cur - 1].uci.slice(2, 4) } : null);
          A.toast('❌ ليست الأفضل، حاول مجددًا' + (lmode.tries >= 2 ? ' — أو اضغط "أرني"' : ''));
        }
        return true;
      }
      return play(u);
    };

    $('#fst', v).onclick = function () { cur = 0; draw(); };
    $('#prv', v).onclick = function () { if (cur > 0) { cur--; draw(); } };
    $('#nxt', v).onclick = function () { if (cur < line.length) { cur++; draw(); A.sfx('move'); } };
    $('#lst', v).onclick = function () { cur = line.length; draw(); };
    $('#flp', v).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#new', v).onclick = function () { root = new Chess().fen(); line = []; cur = 0; gameEvals = {}; draw(); cb('رقعة جديدة.'); };
    $('#exp', v).onclick = function () {
      var fen = fenAt(cur);
      if (!lastRes || lastRes.fen !== fen) { cb('<span class="think"><span class="spin"></span> انتظر انتهاء التحليل...</span>'); analyseQ(fen, { depth: 15, multipv: 3 }).then(function (r) { lastRes = r; show(r); }); return; }
      show(lastRes);
      function show(r) { var e = Coach.explainBest(fen, r); cb(e.html); A.speak(e.speech); }
    };
    $('#thr', v).onclick = function () {
      var fen = fenAt(cur);
      if (ch.isCheck()) { cb('الملك في كش الآن.'); return; }
      analyseQ(Coach.nullMoveFen(fen), { depth: 11 }).then(function (an) {
        var t = Coach.threatText(fen, an); cb(t.html);
        if (t.uci) board.arrows([{ from: t.uci.slice(0, 2), to: t.uci.slice(2, 4), c: 'r' }]);
      });
    };
    $('#io', v).onclick = function () {
      var c = new Chess(root); line.slice(0, line.length).forEach(function (x) { c.move(Coach.parseUci(x.uci)); });
      var m = A.modal('<h2>📋 استيراد / تصدير</h2><p class="mut">الموقف الحالي (FEN):</p><textarea rows="2" id="f">' + fenAt(cur) + '</textarea><p class="mut">المباراة (PGN):</p><textarea rows="4" id="g">' + A.esc(c.pgn()) + '</textarea><p class="mut">الصق FEN أو PGN ثم اضغط تحميل:</p><textarea rows="3" id="in" placeholder="FEN / PGN"></textarea><div class="row" style="margin-top:8px"><button class="btn pri" id="ld">تحميل</button><button class="btn" data-close>إغلاق</button></div>');
      $('#ld', m).onclick = function () {
        var t = $('#in', m).value.trim(); if (!t) return;
        try {
          var c2 = new Chess(t); root = c2.fen(); line = []; cur = 0;
        } catch (e) {
          try {
            var c3 = new Chess(); c3.loadPgn(t);
            var h = c3.history({ verbose: true }); root = new Chess().fen(); line = []; var c4 = new Chess();
            h.forEach(function (mv) { c4.move(mv.san); line.push({ uci: mv.from + mv.to + (mv.promotion || ''), san: mv.san, color: mv.color, fen: c4.fen() }); });
            cur = line.length;
          } catch (e2) { A.toast('صيغة غير صحيحة'); return; }
        }
        gameEvals = {}; m.close(); draw();
      };
    };
    if ($('#rev', v)) $('#rev', v).onclick = function () { review(); };
    $('#pfh', v).onclick = function () {
      var fen = fenAt(cur), c = new Chess(fen);
      if (c.isGameOver()) { A.toast('المباراة منتهية في هذا الموقف'); return; }
      A.go('game', { level: S.set.level, color: c.turn(), fen: fen });
    };
    var mistakes = [];
    if ($('#lfm', v)) $('#lfm', v).onclick = function () { learn(0); };
    /* تعلّم من أخطائك: أعد الموقف قبل الخطأ واطلب النقلة الأفضل */
    function learn(i) {
      if (i >= mistakes.length) { lmode = null; cb('🎉 انتهيت من مراجعة أخطائك! كل خطأ فهمته اليوم لن تكرره غدًا.'); A.addXp(10, 'تعلّم من أخطائك'); draw(); return; }
      var m = mistakes[i];
      cur = m.k - 1; lmode = { i: i, m: m, tries: 0 };
      draw();
      cb('🎯 <b>تعلّم من أخطائك (' + (i + 1) + '/' + mistakes.length + ')</b><br>هنا لعب ' + (m.x.color === 'w' ? 'الأبيض' : 'الأسود') + ' ' + Coach.sanHtml(m.x.san, m.x.color) + ' وكانت ' + m.cls.cls.label + '. ابحث عن نقلة أفضل!<div class="chips"><button class="btn sm" id="lsk">تخطَّ</button><button class="btn sm" id="lsh">👁️ أرني</button></div>');
      $('#lsk', v).onclick = function () { learn(i + 1); };
      $('#lsh', v).onclick = function () { board.arrows([{ from: m.best.slice(0, 2), to: m.best.slice(2, 4), c: 'g' }]); };
    }

    /* مراجعة المباراة: تقييم كل نقلة */
    function review() {
      var btn = $('#rev', v); btn.disabled = true;
      var evals = [], i = 0;
      cb('<span class="think"><span class="spin"></span> جاري مراجعة المباراة نقلة بنقلة...</span> <span id="rp">0/' + line.length + '</span>');
      function nextPos() {
        if (i > line.length) return done();
        var fen = fenAt(i), c = new Chess(fen);
        if (c.isGameOver()) { evals[i] = null; i++; return nextPos(); }
        analyseQ(fen, { depth: 11, multipv: 2 }).then(function (r) { evals[i] = r; i++; var rp = $('#rp', v); if (rp) rp.textContent = (i - 1) + '/' + line.length; nextPos(); }).catch(function () { btn.disabled = false; });
      }
      function done() {
        var sum = { w: [], b: [] }, bad = [];
        line.forEach(function (x, k) {
          var pre = evals[k]; if (!pre) return;
          var cls = Coach.classify(fenAt(k), x.uci, pre, evals[k + 1] || null, isBook(line.slice(0, k + 1).map(function (y) { return y.uci.slice(0, 4); })));
          gameEvals[k + 1] = { cls: cls };
          sum[x.color].push(accuracy(cls.drop));
          if (cls.key === 'blunder' || cls.key === 'mistake' || cls.key === 'miss') {
            var wb0 = Coach.winPct(pre.lines[0].score);
            bad.push({ k: k + 1, x: x, cls: cls, best: pre.lines[0].pv[0], good: pre.lines.filter(function (l) { return wb0 - Coach.winPct(l.score) < 4; }).map(function (l) { return l.pv[0]; }) });
          }
        });
        function avg(a) { return a.length ? Math.round(a.reduce(function (s, y) { return s + y; }, 0) / a.length) : 0; }
        var h = '<div class="exp-head">📈 تقرير المباراة</div><div class="stats"><div class="stat"><b>' + avg(sum.w) + '%</b><small>دقة الأبيض</small></div><div class="stat"><b>' + avg(sum.b) + '%</b><small>دقة الأسود</small></div></div>';
        if (bad.length) h += '<div class="exp-sec"><div class="exp-t">⚠️ اللحظات الحاسمة (اضغط للانتقال)</div>' + bad.map(function (b) { return '<div class="row nw" data-k="' + b.k + '" style="cursor:pointer;margin:4px 0"><span class="cls ' + b.cls.cls.cls + '"><span class="sym">' + b.cls.cls.sym + '</span></span>' + Coach.sanHtml(b.x.san, b.x.color) + ' <small class="mut">— ' + b.cls.cls.label + '</small></div>'; }).join('') + '</div>';
        else h += '<p>لا توجد أخطاء كبيرة. مباراة نظيفة! 👏</p>';
        cb(h);
        $$('#cb [data-k]', v).forEach(function (e) { e.onclick = function () { cur = +e.dataset.k; draw(); }; });
        btn.disabled = false;
        mistakes = bad;
        if (bad.length && $('#lfm', v)) $('#lfm', v).style.display = '';
        drawListOnly();
      }
      nextPos();
    }
    function drawListOnly() { var c = cur; draw(); }

    draw();
    cb(p.moves ? 'المباراة جاهزة للتحليل. اضغط "📈 مراجعة المباراة" لتقييم كل النقلات، أو تنقّل بالأسهم.' : 'حرّك القطع لأي موقف، وسيحلله Stockfish فورًا. اضغط على أي خط لتجربته.');
    return { title: 'المحلل الذكي', cleanup: function () { token++; Engine.stop(); } };
  });
})();
