/* وضع المدرب: مباراة عادية ضد كمبيوتر قوي، وتقييم كل نقلة بعد لعبها فقط، وتلميح عند الطلب */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  var STYLES = [['balanced', '⚖️', 'متوازن', 'يلعب أفضل النقلات بشكل عام'], ['attack', '⚔️', 'هجومي', 'يحب الكش والأسر والهجوم على الملك'], ['positional', '🧭', 'موضعي', 'نقلات هادئة وتحسين القطع والمركز'], ['defense', '🛡️', 'دفاعي', 'يحمي ملكه ويبادل القطع']];
  var STARTS = [['normal', '♟️', 'من البداية'], ['opening', '📖', 'افتتاحية أختارها'], ['random', '🎲', 'افتتاحية عشوائية']];

  function accuracy(drop) { return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669)); }
  function openingOf(ucis) {
    var best = null, n = 0;
    OPENINGS.forEach(function (o) {
      var c = new Chess(), k = 0;
      for (var i = 0; i < o.moves.length && i < ucis.length; i++) { var r = c.move(o.moves[i][0]); if (r.from + r.to !== ucis[i].slice(0, 4)) break; k++; }
      if (k >= 2 && k > n) { n = k; best = o; }
    });
    return best ? { o: best, n: n } : null;
  }

  /* أنواع الأخطاء ← ماذا تتدرّب عليه */
  var WEAK = {
    hang: ['ترك القطع بلا حماية', 'hanging', 't5'],
    fork: ['الوقوع في الشوكة', 'fork', 't1'],
    pin: ['التثبيت والسيخ', 'pin', 't2'],
    mate: ['حماية الملك من المات', 'mate1', 'm1'],
    king: ['أمان الملك في الافتتاح', 'mate2', 'o1'],
    miss: ['تفويت الفرص التكتيكية', null, 't0'],
    calc: ['الدقة والحساب', null, 's4']
  };

  /* ===== الإعداد ===== */
  A.route('coachsetup', function (v) {
    var st = S.set;
    if (st.cLevel == null) st.cLevel = 'auto';
    if (!st.cStyle) st.cStyle = 'balanced';
    if (!st.cStart) st.cStart = 'normal';
    if (S.coachLv == null) S.coachLv = 2;
    var opId = st.cOpening || OPENINGS[0].id;
    function draw() {
      v.innerHTML = '<div class="card"><h2>🎓 وضع المدرب</h2><p>العب مباراة عادية. بعد كل نقلة يخبرك المدرب: هل هي صحيحة أم خطأ، وما الأفضل ولماذا. لا يساعدك قبل النقلة إلا إذا طلبت.</p></div>' +
        '<div class="sec-t">🎚️ قوة الكمبيوتر</div><div class="lvgrid"><button data-l="auto" class="' + (st.cLevel === 'auto' ? 'on' : '') + '">🧠 يتكيّف معك<small>' + Engine.LEVELS[S.coachLv].name + '</small></button>' +
        Engine.LEVELS.map(function (L, i) { return '<button data-l="' + i + '" class="' + (st.cLevel === i ? 'on' : '') + '">' + L.name + '<small>~' + L.elo + '</small></button>'; }).join('') + '</div>' +
        '<div class="sec-t">🎭 أسلوب الكمبيوتر</div><div class="psets" id="sty">' + STYLES.map(function (x) { return '<button data-s="' + x[0] + '" class="' + (st.cStyle === x[0] ? 'on' : '') + '" style="padding:10px 4px"><span style="font-size:22px;width:100%">' + x[1] + '</span><small style="color:var(--txt);font-weight:700">' + x[2] + '</small><small>' + x[3] + '</small></button>'; }).join('') + '</div>' +
        '<div class="sec-t">🚀 البداية</div><div class="diff" id="stt">' + STARTS.map(function (x) { return '<button data-t="' + x[0] + '" class="' + (st.cStart === x[0] ? 'on' : '') + '">' + x[1] + ' ' + x[2] + '</button>'; }).join('') + '</div>' +
        (st.cStart === 'opening' ? '<div class="list">' + OPENINGS.map(function (o) { return '<div class="it" data-o="' + o.id + '" style="' + (o.id === opId ? 'border-color:var(--neon)' : '') + '"><div class="ic">' + (o.id === opId ? '✅' : '📖') + '</div><div class="tx"><b>' + o.name + '</b><small>' + o.idea + '</small></div></div>'; }).join('') + '</div>' : '') +
        '<div class="sec-t">🎨 لونك</div><div class="seg" id="col"><button data-c="w">♔ أبيض</button><button data-c="r">🎲 عشوائي</button><button data-c="b">♚ أسود</button></div>' +
        '<button class="bigbtn main" id="go" style="margin-top:14px"><span class="ic">▶</span><span><b>ابدأ المباراة</b><small>المدرب سيقيّم كل نقلة بعد أن تلعبها</small></span></button>';
      $$('.lvgrid button', v).forEach(function (b) { b.onclick = function () { st.cLevel = b.dataset.l === 'auto' ? 'auto' : +b.dataset.l; A.save(); draw(); }; });
      $$('#sty button', v).forEach(function (b) { b.onclick = function () { st.cStyle = b.dataset.s; A.save(); draw(); }; });
      $$('#stt button', v).forEach(function (b) { b.onclick = function () { st.cStart = b.dataset.t; A.save(); draw(); }; });
      $$('[data-o]', v).forEach(function (b) { b.onclick = function () { opId = st.cOpening = b.dataset.o; A.save(); draw(); }; });
      $$('#col button', v).forEach(function (b) { b.classList.toggle('on', b.dataset.c === st.color); b.onclick = function () { st.color = b.dataset.c; A.save(); draw(); }; });
      $('#go', v).onclick = function () {
        var color = st.color === 'r' ? (Math.random() < .5 ? 'w' : 'b') : st.color;
        var start = [];
        if (st.cStart === 'opening') { var o = OPENINGS.filter(function (x) { return x.id === opId; })[0]; start = o.moves.map(function (m) { return m[0]; }); }
        else if (st.cStart === 'random') { var r = OPENINGS[Math.floor(Math.random() * OPENINGS.length)]; start = r.moves.slice(0, 4 + Math.floor(Math.random() * 5)).map(function (m) { return m[0]; }); }
        A.go('coachgame', { level: st.cLevel === 'auto' ? S.coachLv : st.cLevel, auto: st.cLevel === 'auto', style: st.cStyle, color: color, start: start });
      };
    }
    draw();
    return { title: 'وضع المدرب' };
  });

  /* ===== المباراة ===== */
  A.route('coachgame', function (v, p) {
    var L = Engine.LEVELS[p.level], user = p.color, eng = user === 'w' ? 'b' : 'w';
    var ch = new Chess(), hist = [], gen = 0, over = false, thinking = false, pre = null, hintLv = 0;
    var styleName = STYLES.filter(function (x) { return x[0] === p.style; })[0] || STYLES[0];
    (p.start || []).forEach(function (m) { var b = ch.fen(), r = ch.move(m); hist.push({ san: r.san, uci: r.from + r.to + (r.promotion || ''), color: r.color, num: +b.split(' ')[5], start: true }); });

    v.innerHTML = '<div class="plr" id="pe"><div class="av">' + styleName[1] + '</div><div><b>' + L.name + '</b> <small class="mut">~' + L.elo + ' · ' + styleName[2] + '</small></div><span class="sp"></span><span id="st" class="think"></span></div>' +
      '<div class="bwrap" id="bd"></div>' +
      '<div class="plr" id="pu"><div class="av">🧑</div><b>أنت</b><span class="sp"></span><span class="tag g" id="acc">الدقة —</span></div>' +
      '<div class="panel"><div class="coachbox" id="cb"></div><div class="moves" id="ml" style="margin-top:8px"></div></div>';
    var board = newBoard($('#bd', v), { orientation: user });
    var bar = A.actionbar([['hint', '💡', 'تلميح'], ['thr', '🛡️', 'التهديد'], ['und', '↩️', 'تراجع'], ['flp', '🔄', 'قلب'], ['res', '🏳️', 'إنهاء']]);
    function cb(h) { $('#cb', v).innerHTML = '<div class="who"><span class="bot">🎓</span> المدرب</div>' + h; }
    function status(t) { $('#st', v).innerHTML = t ? '<span class="spin"></span> ' + t : ''; }
    function last() { var h = hist[hist.length - 1]; return h ? { from: h.uci.slice(0, 2), to: h.uci.slice(2, 4) } : null; }

    function refresh() {
      board.set(ch.fen(), last());
      var m = {}; if (ch.isCheck()) m.chk = [kingSq(ch, ch.turn())]; board.setMarks(m); board.arrows([]);
      $('#pe', v).classList.toggle('turn', ch.turn() === eng);
      $('#pu', v).classList.toggle('turn', ch.turn() === user);
      var h = '';
      hist.forEach(function (x, i) {
        if (x.color === 'w') h += '<span class="mn">' + x.num + '.</span>'; else if (i === 0) h += '<span class="mn">' + x.num + '...</span>';
        h += '<span class="mv' + (i === hist.length - 1 ? ' cur' : '') + '">' + Coach.sanHtml(x.san, x.color) + (x.cls ? '<span class="cl ' + x.cls.cls.cls + '">' + x.cls.cls.sym + '</span>' : '') + '</span>';
      });
      var ml = $('#ml', v); ml.innerHTML = h; ml.scrollTop = ml.scrollHeight;
      var mine = hist.filter(function (x) { return x.color === user && x.drop != null; });
      $('#acc', v).textContent = mine.length ? 'الدقة ' + Math.round(mine.reduce(function (s, x) { return s + accuracy(x.drop); }, 0) / mine.length) + '%' : 'الدقة —';
    }
    function getPre(fen) {
      if (pre && pre.fen === fen) return pre.p;
      var pp = analyseQ(fen, { depth: 14, multipv: 3 });
      pre = { fen: fen, p: pp };
      return pp;
    }
    function opName() {
      var o = openingOf(hist.map(function (h) { return h.uci; }));
      return o ? '📖 ' + o.o.name : '';
    }

    /* تصنيف سبب الخطأ */
    function weakness(rec, before, after, aft) {
      if (rec.cls.key === 'miss') return 'miss';
      var d = Coach.describeMove(before, rec.uci);
      if (d && d.tags.indexOf('kingweak') >= 0) return 'king';
      if (d && d.tags.indexOf('hang') >= 0) return 'hang';
      if (aft && aft.lines[0]) {
        var l = aft.lines[0];
        if (l.score.mate != null && l.score.mate > 0) return 'mate';
        var r = Coach.describeMove(after, l.pv[0]);
        if (r) {
          if (r.tags.indexOf('fork') >= 0) return 'fork';
          if (r.tags.indexOf('pin') >= 0 || r.tags.indexOf('skewer') >= 0) return 'pin';
          if (r.tags.indexOf('win') >= 0) return 'hang';
        }
      }
      return 'calc';
    }

    board.o.movable = function () { return !over && !thinking && ch.turn() === user ? user : null; };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      if (over || thinking || ch.turn() !== user) return false;
      var before = ch.fen(), mv;
      try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || ''), after = ch.fen();
      var rec = { san: mv.san, uci: u, color: mv.color, num: +before.split(' ')[5], fenBefore: before };
      hist.push(rec); hintLv = 0;
      A.soundFor(mv, ch); refresh();
      var myGen = ++gen;
      var book = !!openingOf(hist.map(function (h) { return h.uci; })) && openingOf(hist.map(function (h) { return h.uci; })).n === hist.length;
      cb('<span class="think"><span class="spin"></span> المدرب يقيّم نقلتك...</span>');
      getPre(before).then(function (preRes) {
        return (ch.isCheckmate() ? Promise.resolve(null) : analyseQ(after, { depth: 12 })).then(function (aft) {
          if (hist.indexOf(rec) < 0) return;
          var cls = Coach.classify(before, u, preRes, aft, book);
          rec.cls = cls; rec.drop = cls.drop;
          var bad = ['mistake', 'blunder', 'miss', 'inaccuracy'].indexOf(cls.key) >= 0;
          if (bad) rec.weak = weakness(rec, before, after, aft);
          refresh();
          var on = opName();
          cb(cls.html + (on ? '<div class="mut" style="font-size:12.5px;margin-top:4px">' + on + '</div>' : '') +
            (bad && !over ? '<div class="chips"><button class="btn sm pri" id="retry">↩️ جرّب مجددًا</button><button class="btn sm" id="showb">👁️ أرني الأفضل</button></div>' : ''));
          if (bad && !over) {
            $('#retry', v).onclick = function () { takeBack(); };
            $('#showb', v).onclick = function () { takeBack(preRes.lines[0].pv[0]); };
          }
          if (cls.key === 'brilliant') { S.brilliants++; A.save(); A.confetti(); }
          if (cls.key === 'blunder' || cls.key === 'mistake') A.sfx('bad');
          A.speak(cls.cls.label);
        });
      }).catch(function () {});
      if (checkEnd()) return true;
      engineTurn(myGen);
      return true;
    };

    function engineTurn(myGen) {
      thinking = true; status('يفكر...');
      var t0 = Date.now(), fen = ch.fen();
      Engine.playStyle(fen, p.level, p.style).then(function (u) {
        if (myGen !== gen || ch.fen() !== fen) return;
        setTimeout(function () {
          if (myGen !== gen || ch.fen() !== fen) return;
          var mv = ch.move(Coach.parseUci(u));
          hist.push({ san: mv.san, uci: u, color: mv.color, num: +fen.split(' ')[5], fenBefore: fen, eng: true });
          A.soundFor(mv, ch); thinking = false; status(''); refresh();
          if (checkEnd()) return;
          // زر "لماذا لعب هذه؟" يُضاف لرسالة المدرب الحالية
          var box = $('#cb', v);
          if (box && !box.querySelector('#why')) {
            var c = document.createElement('div'); c.className = 'chips';
            c.innerHTML = '<button class="btn sm" id="why">🤔 لماذا لعب الكمبيوتر ' + Coach.sanHtml(mv.san, mv.color) + '؟</button>';
            box.appendChild(c);
            $('#why', v).onclick = function () { explainEngine(fen, u); };
          }
          getPre(ch.fen());
        }, Math.max(0, 450 + Math.random() * 450 - (Date.now() - t0)));
      }).catch(function () { thinking = false; status(''); });
    }

    function explainEngine(fen, u) {
      var d = Coach.describeMove(fen, u);
      var reasons = d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
      var h = '<b>🤔 لماذا ' + Coach.sanHtml(d.san, d.move.color) + '؟</b><ul>' + (reasons.length ? reasons.slice(0, 2).map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li>نقلة تحسّن موقع القطعة وتحضّر لخطة قادمة.</li>') + '</ul><span class="think" id="wt"><span class="spin"></span> أبحث عن خطته...</span>';
      cb(h);
      var now = ch.fen();
      if (ch.isCheck()) { var w = $('#wt', v); if (w) w.innerHTML = '<b>انتبه: أنت في كش!</b>'; return; }
      analyseQ(Coach.nullMoveFen(now), { depth: 10 }).then(function (an) {
        if (ch.fen() !== now) return;
        var t = Coach.threatText(now, an), w = $('#wt', v);
        if (!w) return;
        w.outerHTML = t.serious ? '<div>' + t.html + '</div>' : '<div class="mut">لا يوجد تهديد مباشر الآن، الكمبيوتر يحسّن موقفه.</div>';
        if (t.serious && t.uci) board.arrows([{ from: t.uci.slice(0, 2), to: t.uci.slice(2, 4), c: 'r' }]);
      }).catch(function () {});
    }

    function takeBack(show) {
      gen++; Engine.stopPlayer(); thinking = false; status(''); over = false;
      while (hist.length && !hist[hist.length - 1].start && hist[hist.length - 1].color !== user) { ch.undo(); hist.pop(); }
      if (hist.length && !hist[hist.length - 1].start) { ch.undo(); hist.pop(); }
      refresh();
      if (show) {
        board.arrows([{ from: show.slice(0, 2), to: show.slice(2, 4), c: 'g' }]);
        var d = Coach.describeMove(ch.fen(), show);
        cb('👁️ الأفضل كان ' + Coach.sanHtml(d.san, d.move.color) + (d.lines[0] ? ' — ' + d.lines[0] : '') + '<br><small class="mut">العبها بنفسك لتثبت الفكرة.</small>');
      } else cb('↩️ حاول إيجاد نقلة أفضل. فكّر: كش؟ أسر؟ تهديد؟ وماذا يريد الخصم؟');
      getPre(ch.fen());
    }

    function checkEnd() {
      if (!ch.isGameOver()) return false;
      over = true; thinking = false; status('');
      var res = ch.isCheckmate() ? ((ch.turn() === 'w' ? 'b' : 'w') === user ? 'win' : 'loss') : 'draw';
      var why = ch.isCheckmate() ? 'كش مات' : ch.isStalemate() ? 'إغلاق' : ch.isThreefoldRepetition() ? 'تكرار ثلاثي' : ch.isInsufficientMaterial() ? 'مادة غير كافية' : 'قاعدة الخمسين نقلة';
      setTimeout(function () { finish(res, why); }, 900);
      return true;
    }

    function finish(res, why) {
      over = true;
      S.games.played++; if (res === 'win') S.games.won++; else if (res === 'loss') S.games.lost++; else S.games.drawn++;
      var lvMsg = '';
      if (p.auto) {
        var old = S.coachLv;
        if (res === 'win') S.coachLv = Math.min(Engine.LEVELS.length - 1, S.coachLv + 1);
        else if (res === 'loss') S.coachLv = Math.max(0, S.coachLv - 1);
        if (S.coachLv !== old) lvMsg = (S.coachLv > old ? '⬆️ المستوى القادم أقوى: ' : '⬇️ المستوى القادم أسهل: ') + Engine.LEVELS[S.coachLv].name;
      }
      A.save();
      A.addXp(res === 'win' ? 40 + p.level * 8 : res === 'draw' ? 20 : 12, 'مباراة مع المدرب');
      A.sfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'drawn'); if (res === 'win') A.confetti();
      var mine = hist.filter(function (h) { return h.color === user && h.drop != null; });
      var acc = mine.length ? Math.round(mine.reduce(function (s, h) { return s + accuracy(h.drop); }, 0) / mine.length) : 0;
      var counts = {}, weak = {};
      mine.forEach(function (h) { if (h.cls) counts[h.cls.key] = (counts[h.cls.key] || 0) + 1; if (h.weak) weak[h.weak] = (weak[h.weak] || 0) + 1; });
      var rows = ['brilliant', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'miss'].filter(function (k) { return counts[k]; }).map(function (k) {
        var C = Coach.CLASSES[k]; return '<div class="row nw"><span class="cls ' + C.cls + '"><span class="sym">' + C.sym + '</span> ' + C.label + '</span><span class="sp"></span><b>' + counts[k] + '</b></div>';
      }).join('');
      var wk = Object.keys(weak).sort(function (a, b) { return weak[b] - weak[a]; });
      var wh = wk.length ? '<div class="card"><h2>🎯 ما تحتاج أن تتدرّب عليه</h2>' + wk.slice(0, 3).map(function (k) {
        var W = WEAK[k];
        return '<div class="row nw" style="margin:8px 0"><span class="sp"><b>' + W[0] + '</b> <small class="mut">(' + weak[k] + ' ' + (weak[k] === 1 ? 'مرة' : 'مرات') + ')</small></span>' +
          (W[1] ? '<button class="btn sm" data-pz="' + W[1] + '">🧩 ألغاز</button>' : '') + '<button class="btn sm" data-ls="' + W[2] + '">📘 درس</button></div>';
      }).join('') + '</div>' : '<div class="card center"><b>👏 لا توجد أخطاء كبيرة في هذه المباراة!</b></div>';
      var t = res === 'win' ? ['🏆', 'فزت!'] : res === 'loss' ? ['💪', 'خسرت هذه المرة'] : ['🤝', 'تعادل'];
      var m = A.modal('<div class="big-emoji">' + t[0] + '</div><h2 class="center">' + t[1] + '</h2><p class="center mut">' + why + '</p>' +
        (lvMsg ? '<p class="center"><b>' + lvMsg + '</b></p>' : '') +
        (mine.length ? '<div class="card center"><small class="mut">دقة لعبك</small><div class="timer">' + acc + '%</div></div>' : '') +
        (rows ? '<div class="card">' + rows + '</div>' : '') + wh +
        '<button class="btn pri block" id="anl">🔬 راجع المباراة وتعلّم من أخطائك</button><button class="btn block" style="margin-top:8px" id="again">🔁 مباراة جديدة</button>');
      $$('[data-pz]', m).forEach(function (b) { b.onclick = function () { m.close(); A.go('puzzle', { mode: 'theme', theme: b.dataset.pz }); }; });
      $$('[data-ls]', m).forEach(function (b) {
        b.onclick = function () {
          var cid = null; COURSES.forEach(function (c) { c.lessons.forEach(function (l) { if (l.id === b.dataset.ls) cid = c.id; }); });
          m.close(); A.go('lesson', { c: cid, l: b.dataset.ls });
        };
      });
      $('#anl', m).onclick = function () { m.close(); A.go('analysis', { moves: hist.map(function (h) { return h.uci; }), orient: user }); };
      $('#again', m).onclick = function () { m.close(); A.go('coachsetup', {}, true); };
      refresh();
      cb(t[1] + ' — ' + why);
    }

    $('#hint', bar).onclick = function () {
      if (over || thinking || ch.turn() !== user) return;
      var fen = ch.fen(); hintLv++; board.arrows([]);
      cb('<span class="think"><span class="spin"></span> ...</span>');
      getPre(fen).then(function (r) {
        if (ch.fen() !== fen) return;
        var u = r.lines[0].pv[0], d = Coach.describeMove(fen, u);
        var IDEA = { mate: 'كش مات!', win: 'كسب مادة', fork: 'شوكة', pin: 'تثبيت', skewer: 'سيخ', discovered: 'هجوم مكشوف', dcheck: 'كش مزدوج', discheck: 'كش مكشوف', check: 'كش', threat: 'تهديد قطعة', promo: 'ترقية', sac: 'تضحية', escape: 'إنقاذ قطعة مهددة', defend: 'حماية قطعة', castle: 'تبييت الملك', develop: 'تطوير قطعة', center: 'السيطرة على المركز', openfile: 'عمود مفتوح', seventh: 'الصف السابع', passer: 'دفع البيدق الحر', capture: 'أسر', trade: 'تبادل' };
        var idea = d.items.filter(function (x) { return x.w > 0 && IDEA[x.tag]; })[0];
        if (hintLv === 1) { board.mark('hint', [u.slice(0, 2)]); cb('💡 <b>تلميح:</b> فكّر في تحريك ' + Coach.NAME[d.move.piece] + ' المضيء.' + (idea ? ' الفكرة: <b>' + IDEA[idea.tag] + '</b>.' : '')); }
        else { board.arrows([{ from: u.slice(0, 2), to: u.slice(2, 4), c: 'g' }]); var e = Coach.explainBest(fen, r); cb(e.html); }
      }).catch(function () {});
    };
    $('#thr', bar).onclick = function () {
      if (over || ch.isCheck()) return;
      var fen = ch.fen();
      analyseQ(Coach.nullMoveFen(fen), { depth: 10 }).then(function (an) {
        if (ch.fen() !== fen) return;
        var t = Coach.threatText(fen, an); cb(t.html);
        if (t.uci) board.arrows([{ from: t.uci.slice(0, 2), to: t.uci.slice(2, 4), c: 'r' }]);
      }).catch(function () {});
    };
    $('#und', bar).onclick = function () { if (hist.some(function (h) { return h.color === user && !h.start; })) takeBack(); };
    $('#flp', bar).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#res', bar).onclick = function () {
      if (over) return;
      var mm = A.modal('<h2>إنهاء المباراة؟</h2><p class="mut">ستُحسب خسارة، وستحصل على تقرير بأخطائك.</p><div class="row"><button class="btn bad" id="y">إنهاء</button><button class="btn pri" data-close>سأكمل</button></div>');
      $('#y', mm).onclick = function () { mm.close(); gen++; Engine.stopPlayer(); finish('loss', 'استسلام'); };
    };

    refresh();
    var on = opName();
    cb('مرحبًا! العب كما تلعب عادة، وسأقيّم كل نقلة <b>بعد</b> أن تلعبها. إذا احتجت مساعدة قبل النقلة اضغط 💡.' + (on ? '<br>' + on : '') + (ch.turn() === user ? '<br><b>دورك.</b>' : ''));
    A.sfx('start');
    if (ch.turn() === eng) engineTurn(gen); else getPre(ch.fen());
    return { title: 'وضع المدرب', cleanup: function () { gen++; Engine.stopPlayer(); Engine.stop(); } };
  });
})();
