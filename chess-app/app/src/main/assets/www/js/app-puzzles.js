/* الألغاز: لغز اليوم، حسب الموضوع، التدريب المتدرج، السلسلة، العاصفة */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  var THEMES = {
    mate1: ['كش مات في نقلة', '👑', 'ابحث عن الكش الذي لا مهرب منه'],
    mate2: ['كش مات في نقلتين', '♛', 'نقلة تحضيرية ثم المات'],
    mate3: ['كش مات في 3 نقلات', '☠️', 'سلسلة إجبارية من الكشوش'],
    hanging: ['القطعة المعلّقة', '🎯', 'اصطد القطع غير المحمية'],
    fork: ['الشوكة', '🍴', 'هجوم مزدوج على قطعتين'],
    pin: ['التثبيت', '📌', 'قطعة لا تستطيع الحركة'],
    skewer: ['السيخ', '🍢', 'هجوم يخترق القطعة الأغلى'],
    discovered: ['الهجوم المكشوف', '💥', 'حرّك قطعة لتكشف أخرى'],
    dcheck: ['الكش المزدوج', '⚡', 'كش من قطعتين'],
    sac: ['التضحية', '🔥', 'اعطِ مادة لتكسب أكثر'],
    promo: ['الترقية', '⬆️', 'البيدق يصبح وزيرًا'],
    advantage: ['كسب الأفضلية', '📈', 'أفضل نقلة تحسم الموقف'],
    quiet: ['النقلة الهادئة', '🤫', 'أقوى نقلة ليست أسرًا ولا كشًا'],
    endgame: ['النهايات', '🏁', 'تقنيات قليلة القطع']
  };
  self.PTHEMES = THEMES;
  var DIFF = [['سهل جدًا', -350], ['سهل', -150], ['متوسط', 0], ['صعب', 250]];

  function byId(id) { for (var i = 0; i < PUZZLES.length; i++) if (PUZZLES[i].id === id) return PUZZLES[i]; }
  function target() { var d = DIFF[S.set.pdiff == null ? 1 : S.set.pdiff]; return S.pRating + d[1]; }

  function pickRated(theme, tgt) {
    var t = tgt == null ? target() : tgt;
    var pool = PUZZLES.filter(function (p) { return (!theme || p.th.indexOf(theme) >= 0); });
    var uns = pool.filter(function (p) { return !S.puzzles[p.id]; });
    if (!uns.length) uns = pool;
    uns.sort(function (a, b) { return Math.abs(a.r - t) - Math.abs(b.r - t); });
    var top = uns.slice(0, Math.min(8, uns.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  A.route('puzzles', function (v) {
    var html = '<div class="hero"><div class="row nw"><div class="sp"><div class="hi">تصنيفك في الألغاز</div><div class="name" style="font-size:34px">' + Math.round(S.pRating) + '</div><small class="mut">✅ ' + S.pSolved + ' محلول · 🔥 أفضل سلسلة ' + (S.streakBest || 0) + '</small></div><div style="font-size:58px">🧩</div></div></div>' +
      '<div class="sec-t">🎚️ مستوى الصعوبة</div><div class="diff">' + DIFF.map(function (d, i) { return '<button data-d="' + i + '" class="' + (S.set.pdiff === i ? 'on' : '') + '">' + d[0] + '</button>'; }).join('') + '</div>' +
      '<div class="grid2">' +
      '<div class="tile" id="rated" style="--c:#38f5ff"><div class="ic">🎯</div><div class="tt">تدريب متدرّج</div><div class="st">ألغاز تناسب مستواك</div></div>' +
      '<div class="tile" id="daily" style="--c:#ffc14d"><div class="ic">🌅</div><div class="tt">لغز اليوم</div><div class="st">' + (S.puzzles['daily-' + A.today()] ? '✅ تم الحل' : 'جديد!') + '</div></div>' +
      '<div class="tile" id="streak" style="--c:#3dffa8"><div class="ic">🔥</div><div class="tt">سلسلة الألغاز</div><div class="st">بلا وقت، تصعب تدريجيًا · خطأ واحد ينهيها</div></div>' +
      '<div class="tile" id="rush" style="--c:#ff4fd8"><div class="ic">⚡</div><div class="tt">عاصفة الألغاز</div><div class="st">3 دقائق · أفضل: ' + S.rushBest + '</div></div>' +
      '<div class="tile" id="classic" style="--c:#a66bff"><div class="ic">🏛️</div><div class="tt">الكلاسيكيات</div><div class="st">أشهر الأنماط مع شرح مفصل</div></div>' +
      '<div class="tile" id="mates" style="--c:#ff9f43"><div class="ic">👑</div><div class="tt">مات في نقلة</div><div class="st">أسهل بداية للمبتدئين</div></div>' +
      '</div><div class="sec-t">📚 حسب الموضوع</div><div class="list">';
    Object.keys(THEMES).forEach(function (k) {
      var n = PUZZLES.filter(function (p) { return p.th.indexOf(k) >= 0; }).length;
      if (!n) return;
      var d = PUZZLES.filter(function (p) { return p.th.indexOf(k) >= 0 && S.puzzles[p.id]; }).length;
      html += '<div class="it" data-t="' + k + '"><div class="ic">' + THEMES[k][1] + '</div><div class="tx"><b>' + THEMES[k][0] + '</b><small>' + THEMES[k][2] + ' · ' + d + '/' + n + '</small></div><span class="mut">◀</span></div>';
    });
    html += '</div>';
    v.innerHTML = html;
    $$('.diff button', v).forEach(function (b) { b.onclick = function () { S.set.pdiff = +b.dataset.d; A.save(); A.sfx('tap'); $$('.diff button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#rated', v).onclick = function () { A.go('puzzle', { mode: 'rated' }); };
    $('#daily', v).onclick = function () { A.go('puzzle', { mode: 'daily' }); };
    $('#rush', v).onclick = function () { A.go('puzzle', { mode: 'rush' }); };
    $('#streak', v).onclick = function () { A.go('puzzle', { mode: 'streak' }); };
    $('#classic', v).onclick = function () { A.go('puzzle', { mode: 'classic' }); };
    $('#mates', v).onclick = function () { A.go('puzzle', { mode: 'theme', theme: 'mate1' }); };
    $$('[data-t]', v).forEach(function (e) { e.onclick = function () { A.go('puzzle', { mode: 'theme', theme: e.dataset.t }); }; });
    return { title: 'الألغاز' };
  });

  /* ===== مشغّل اللغز ===== */
  A.route('puzzle', function (v, p) {
    var mode = p.mode, classicIdx = 0;
    var rush = mode === 'rush' ? { score: 0, strikes: 0, left: 180, timer: null, level: 500 } : null;
    var streak = mode === 'streak' ? { n: 0, level: 450, used: {} } : null;
    var pz, ch, step, hints, failed, done, board, startFen, userSide, lastWrong = null;

    v.innerHTML = (rush ? '<div class="row" style="justify-content:space-around;margin-bottom:6px"><div class="timer" id="rt">3:00</div><div class="timer" id="rs" style="color:var(--ok)">0</div><div class="timer" id="rx" style="color:var(--bad);min-width:60px"></div></div>' : '') +
      (streak ? '<div class="row" style="justify-content:center;margin-bottom:6px"><div class="timer" id="sk" style="color:var(--ok)">🔥 0</div></div>' : '') +
      '<div class="plr" id="who"></div><div class="bwrap" id="bd"></div>' +
      '<div class="panel"><div class="coachbox" id="cb"></div></div>';
    board = newBoard($('#bd', v), {});
    var bar = A.actionbar([['h1', '💡', 'تلميح'], ['sol', '👁️', 'الحل'], ['ana', '🔬', 'تحليل'], ['nx', '⏭️', 'التالي', true]]);
    var cbEl = $('#cb', v);
    function cb(html) { cbEl.innerHTML = '<div class="who"><span class="bot">🤖</span> المدرب</div>' + html; }
    function btn(id, on) { var b = $('#' + id, bar); if (b) b.disabled = !on; }

    function choose() {
      if (mode === 'daily') { var list = PUZZLES.filter(function (x) { return x.r >= 700 && x.r <= 1300; }); return list[A.dailyIndex(list.length)]; }
      if (mode === 'classic') { var cl = PUZZLES.filter(function (x) { return x.x; }); var q = cl[classicIdx % cl.length]; classicIdx++; return q; }
      if (mode === 'theme') return pickRated(p.theme);
      if (mode === 'rush' || mode === 'streak') {
        var st = rush || streak, lv = st.level;
        var pool = PUZZLES.filter(function (x) { return x.r >= lv - 120 && x.r <= lv + 120 && !(streak && streak.used[x.id]); });
        if (!pool.length) pool = PUZZLES.filter(function (x) { return !(streak && streak.used[x.id]); });
        var pk = pool[Math.floor(Math.random() * pool.length)];
        if (streak) streak.used[pk.id] = 1;
        return pk;
      }
      return pickRated();
    }

    function load(pzz) {
      pz = pzz || choose();
      ch = new Chess(pz.fen); startFen = pz.fen;
      step = 0; hints = 0; failed = false; done = false; lastWrong = null;
      userSide = ch.turn();
      board.setOrientation(userSide);
      board.set(pz.fen);
      board.arrows([]);
      marks();
      $('#who', v).innerHTML = '<div class="av">' + (userSide === 'w' ? '♔' : '♚') + '</div><b>دورك: ' + (userSide === 'w' ? 'الأبيض' : 'الأسود') + '</b><span class="sp"></span>' + (rush || streak ? '' : '<span class="tag v">تصنيف ' + pz.r + '</span>');
      var goal = pz.mate ? 'ابحث عن <b>كش مات في ' + (pz.mate === 1 ? 'نقلة واحدة' : pz.mate + ' نقلات') + '</b>.' : 'ابحث عن <b>أفضل نقلة</b>.' + (pz.th.indexOf('hanging') >= 0 && S.set.pdiff === 0 ? ' 💡 انظر: هل توجد قطعة غير محمية؟' : '');
      cb((pz.t ? '<b>' + pz.t + '</b><br>' : '') + goal);
      btn('h1', !rush); btn('sol', !rush && !streak); btn('ana', false); btn('nx', !rush && !streak);
    }

    function marks(extra) {
      var m = extra || {};
      if (ch.isCheck()) m.chk = [kingSq(ch, ch.turn())];
      board.setMarks(m);
    }

    board.o.movable = function () { return done ? null : userSide; };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      if (done || ch.turn() !== userSide) return false;
      var before = ch.fen(), prevLast = board.last;
      var mv;
      try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || '');
      var exp = pz.sol[step];
      var ok = u === exp || ch.isCheckmate() || (step === 0 && pz.acc && pz.acc.indexOf(u) >= 0);
      board.set(ch.fen(), { from: from, to: to });
      board.arrows([]);
      if (ok) {
        A.soundFor(mv, ch);
        marks({ good: [to] });
        if (u !== exp || step + 1 >= pz.sol.length || ch.isCheckmate()) { solved(u !== exp && !ch.isCheckmate()); return true; }
        step++;
        cb('✅ ' + Coach.sanHtml(mv.san, mv.color) + ' صحيحة! استمر...');
        A.sfx('ok');
        setTimeout(function () {
          var r = ch.move(Coach.parseUci(pz.sol[step]));
          board.set(ch.fen(), { from: r.from, to: r.to }); A.soundFor(r, ch); marks();
          step++;
          cb('الخصم ردّ بـ ' + Coach.sanHtml(r.san, r.color) + '. ما هي النقلة التالية؟');
        }, 500);
      } else {
        wrong(before, u, mv, prevLast);
      }
      return true;
    };

    /* النقلة الخاطئة: القطعة تعود لمكانها + رسالة قصيرة */
    function wrong(before, u, mv, prevLast) {
      A.sfx('bad');
      ch.undo();
      lastWrong = { fen: before, u: u, san: mv.san, color: mv.color };
      board.snapBack(before, mv.to, prevLast, function () { marks(); });
      if (rush) {
        rush.strikes++; $('#rx', v).textContent = '❌'.repeat(rush.strikes);
        if (rush.strikes >= 3) { setTimeout(endRush, 500); return; }
        setTimeout(function () { load(); }, 650);
        return;
      }
      if (streak) { setTimeout(endStreak, 600); return; }
      if (!failed) { failed = true; rate(false); }
      cb('❌ <b>' + Coach.sanHtml(mv.san, mv.color) + '</b> ليست الحل. حاول مرة أخرى!<div class="chips"><button class="btn sm" id="why">🤔 لماذا خطأ؟</button><button class="btn sm" id="hint2">💡 تلميح</button></div>');
      $('#why', v).onclick = explainWrong;
      $('#hint2', v).onclick = hint;
    }

    function explainWrong() {
      if (!lastWrong) return;
      var w = lastWrong, c = new Chess(w.fen); c.move(Coach.parseUci(w.u));
      cb('<span class="think"><span class="spin"></span> المدرب يحلل...</span>');
      analyseQ(c.fen(), { depth: 12 }).then(function (after) {
        var r = after.lines[0];
        var html = '❌ <b>' + Coach.sanHtml(w.san, w.color) + '</b> ليست الحل.';
        if (c.isStalemate()) html += '<br>هذه النقلة تعطي <b>إغلاقًا</b> (تعادل)!';
        else if (r) {
          var d = Coach.describeMove(c.fen(), r.pv[0]);
          var reason = d && d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; })[0];
          html += '<br>لأن الخصم يرد بـ ' + Coach.sanHtml(d.san, d.move.color) + (reason ? ' — ' + reason : '.');
          board.arrows([{ from: r.pv[0].slice(0, 2), to: r.pv[0].slice(2, 4), c: 'r' }]);
        }
        html += '<div class="chips"><button class="btn sm" id="hint2">💡 تلميح</button></div>';
        cb(html);
        $('#hint2', v).onclick = hint;
      }).catch(function () {});
    }

    function rate(win) {
      var n = S.pSolved + S.pFailed;
      var k = n < 20 ? 40 : 24, exp = 1 / (1 + Math.pow(10, (pz.r - S.pRating) / 400));
      var delta = Math.round(k * ((win ? 1 : 0) - exp));
      if (win && hints) delta = Math.round(delta / (1 + hints));
      S.pRating = Math.max(300, S.pRating + delta);
      if (!win) S.pFailed++;
      A.save();
      return delta;
    }

    function solved(alt) {
      done = true;
      A.sfx('ok');
      board.burst(board.last ? board.last.to : 'e4', '#3dffa8');
      if (rush) {
        rush.score++; $('#rs', v).textContent = rush.score; rush.level += 50;
        setTimeout(function () { load(); }, 450);
        return;
      }
      if (streak) {
        streak.n++; streak.level += 45; $('#sk', v).textContent = '🔥 ' + streak.n;
        if (!S.puzzles[pz.id]) S.pSolved++;
        S.puzzles[pz.id] = 1; A.save();
        cb('✅ أحسنت! السلسلة: <b>' + streak.n + '</b>');
        setTimeout(function () { load(); }, 900);
        return;
      }
      var first = !S.puzzles[pz.id];
      var delta = 0;
      if (!failed) delta = rate(true);
      if (first && !failed) S.pSolved++;
      S.puzzles[pz.id] = failed ? -1 : 1;
      if (mode === 'daily' && !failed) S.puzzles['daily-' + A.today()] = 1;
      A.save();
      if (!failed) A.confetti();
      var xp = failed ? 2 : Math.max(3, 10 - hints * 3) + (mode === 'daily' ? 10 : 0);
      if (first || !failed) A.addXp(xp, failed ? 'أكملت اللغز' : 'لغز محلول');
      btn('ana', true); btn('nx', true);
      explain(alt, delta);
    }

    function explain(alt, delta) {
      var c = new Chess(startFen);
      var d0 = Coach.describeMove(c.fen(), pz.sol[0]);
      var r0 = d0.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
      var summary = pz.x || r0[0] || 'هذه النقلة تحسم الموقف لصالحك.';
      var html = '<div class="exp-head">🎉 ' + (failed ? 'أكملت الحل' : 'أحسنت!') + (delta ? ' <span class="tag g">' + (delta > 0 ? '+' : '') + delta + '</span>' : '') + '</div>';
      if (alt) html += '<div class="exp-note">وجدت حلًا بديلًا قويًا!</div>';
      html += '<p style="margin:4px 0">' + Coach.sanHtml(d0.san, d0.move.color) + ' — ' + summary + '</p>';
      html += '<div id="full" style="display:none"><div class="exp-sec"><div class="exp-t">🧠 الحل خطوة بخطوة</div><ul>';
      pz.sol.forEach(function (u) {
        var d = Coach.describeMove(c.fen(), u);
        var mine = c.turn() === userSide;
        var reasons = d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
        html += '<li>' + (mine ? '' : '<span class="mut">رد الخصم: </span>') + Coach.sanHtml(d.san, d.move.color) + (reasons.length ? ' — ' + reasons[0] : (mine ? '' : ' (أفضل دفاع)')) + '</li>';
        c.move(Coach.parseUci(u));
      });
      html += '</ul></div>';
      var th = pz.th.filter(function (t) { return THEMES[t]; }).map(function (t) { return '<span class="tag">' + THEMES[t][1] + ' ' + THEMES[t][0] + '</span>'; }).join('');
      html += '<div class="exp-sec"><div class="exp-t">🏷️ المواضيع</div>' + th + '</div><div class="exp-sec" id="whybest"></div></div>';
      html += '<div class="chips"><button class="btn sm" id="more">📖 الشرح الكامل</button><button class="btn sm pri" id="nx2">اللغز التالي ◀</button></div>';
      cb(html);
      $('#nx2', v).onclick = function () { load(); };
      $('#more', v).onclick = function () {
        $('#full', v).style.display = ''; this.remove();
        var el = $('#whybest', v);
        el.innerHTML = '<span class="think"><span class="spin"></span> يقارن المدرب الحل بالبدائل...</span>';
        analyseQ(startFen, { depth: 13, multipv: 3 }).then(function (an) {
          var turn = startFen.split(' ')[1], wb = Coach.winPct(an.lines[0].score);
          var h = '<div class="exp-t">⚖️ لماذا هي الأفضل؟</div><ul>';
          an.lines.forEach(function (l) {
            var san = Coach.sanHtml(Coach.uciToSan(startFen, l.pv[0]), turn);
            if (l.pv[0] === pz.sol[0]) { h += '<li>' + san + ' <b>(الحل)</b> — ' + Coach.scoreSentence(Coach.toWhite(l.score, turn)) + '</li>'; return; }
            var g = wb - Coach.winPct(l.score);
            h += '<li>' + san + ' — ' + (g < 5 ? 'بديل قريب في القوة' : g < 20 ? 'أضعف بوضوح' : 'تضيّع الفرصة') + ' <bdi class="evalchip">' + Coach.scoreText(Coach.toWhite(l.score, turn)) + '</bdi></li>';
          });
          el.innerHTML = h + '</ul>';
        }).catch(function () { el.innerHTML = ''; });
      };
      A.speak(summary);
    }

    function showSol() {
      if (done) return;
      if (!failed) { failed = true; rate(false); }
      done = true;
      ch.load(startFen); board.set(startFen); marks();
      var i = 0;
      cb('👁️ مشاهدة الحل...');
      (function stepSol() {
        if (i >= pz.sol.length) { S.puzzles[pz.id] = S.puzzles[pz.id] || -1; A.save(); btn('ana', true); btn('nx', true); explain(false, 0); return; }
        var r = ch.move(Coach.parseUci(pz.sol[i]));
        board.set(ch.fen(), { from: r.from, to: r.to }); A.soundFor(r, ch); marks();
        i++; setTimeout(stepSol, 850);
      })();
    }

    function hint() {
      if (done) return;
      hints++;
      var u = pz.sol[step];
      if (hints === 1) {
        var th = pz.th.filter(function (t) { return THEMES[t] && t !== 'endgame' && t !== 'quiet' && t !== 'advantage'; })[0];
        board.mark('hint', [u.slice(0, 2)]);
        cb('💡 حرّك ' + Coach.NAME[ch.get(u.slice(0, 2)).type] + ' المضيء.' + (th ? ' الفكرة: <b>' + THEMES[th][0] + '</b>.' : ''));
      } else {
        board.arrows([{ from: u.slice(0, 2), to: u.slice(2, 4), c: 'b' }]);
        cb('💡 السهم يشير إلى النقلة. حاول أن تفهم لماذا قبل أن تلعبها!');
      }
    }

    $('#h1', bar).onclick = hint;
    $('#sol', bar).onclick = showSol;
    $('#nx', bar).onclick = function () { load(); };
    $('#ana', bar).onclick = function () { A.go('analysis', { fen: startFen }); };

    function endRush() {
      clearInterval(rush.timer); done = true;
      var best = rush.score > S.rushBest; if (best) { S.rushBest = rush.score; A.save(); }
      A.addXp(rush.score * 3, 'عاصفة الألغاز');
      A.sfx('win');
      var m = A.modal('<div class="big-emoji">⚡</div><h2 class="center">النتيجة: ' + rush.score + '</h2><p class="center mut">' + (best ? '🏆 رقم قياسي جديد!' : 'أفضل نتيجة: ' + S.rushBest) + '</p><button class="btn pri block" id="again">مرة أخرى</button><button class="btn block" style="margin-top:8px" data-close>إغلاق</button>');
      $('#again', m).onclick = function () { m.close(); A.go('puzzle', { mode: 'rush' }, true); };
    }
    function endStreak() {
      done = true;
      var best = streak.n > (S.streakBest || 0); if (best) { S.streakBest = streak.n; A.save(); }
      A.addXp(streak.n * 3, 'سلسلة الألغاز');
      var sol = pz.sol[0];
      board.arrows([{ from: sol.slice(0, 2), to: sol.slice(2, 4), c: 'g' }]);
      var m = A.modal('<div class="big-emoji">🔥</div><h2 class="center">السلسلة: ' + streak.n + '</h2><p class="center mut">' + (best ? '🏆 رقم قياسي جديد!' : 'أفضل سلسلة: ' + S.streakBest) + '</p><p class="center">الحل كان: ' + Coach.sanHtml(Coach.uciToSan(startFen, sol), userSide) + '</p><button class="btn pri block" id="again">سلسلة جديدة</button><button class="btn block" style="margin-top:8px" data-close>إغلاق</button>');
      $('#again', m).onclick = function () { m.close(); A.go('puzzle', { mode: 'streak' }, true); };
    }

    if (rush) {
      rush.timer = setInterval(function () {
        rush.left--;
        var mm = Math.floor(rush.left / 60), ss = rush.left % 60;
        var el = $('#rt', v); if (el) el.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
        if (rush.left === 10) A.sfx('start');
        if (rush.left <= 0) endRush();
      }, 1000);
    }

    load(p.id ? byId(p.id) : null);
    var titles = { daily: 'لغز اليوم', rush: 'عاصفة الألغاز', streak: 'سلسلة الألغاز', classic: 'الكلاسيكيات', rated: 'تدريب متدرّج', theme: p.theme && THEMES[p.theme] ? THEMES[p.theme][0] : 'الألغاز' };
    return { title: titles[mode] || 'لغز', cleanup: function () { if (rush) clearInterval(rush.timer); Engine.stop(); } };
  });
})();
