/* الألغاز: لغز اليوم، حسب الموضوع، التدريب المتدرج، العاصفة */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  var THEMES = {
    mate1: ['كش مات في نقلة', '👑', 'ابحث عن الكش الذي لا مهرب منه'],
    mate2: ['كش مات في نقلتين', '♛', 'نقلة تحضيرية ثم المات'],
    mate3: ['كش مات في 3 نقلات', '☠️', 'سلسلة إجبارية من الكشوش'],
    fork: ['الشوكة', '🍴', 'هجوم مزدوج على قطعتين'],
    pin: ['التثبيت', '📌', 'قطعة لا تستطيع الحركة'],
    skewer: ['السيخ', '🍢', 'هجوم يخترق القطعة الأغلى'],
    discovered: ['الهجوم المكشوف', '💥', 'حرّك قطعة لتكشف أخرى'],
    dcheck: ['الكش المزدوج', '⚡', 'كش من قطعتين'],
    sac: ['التضحية', '🔥', 'اعطِ مادة لتكسب أكثر'],
    promo: ['الترقية', '⬆️', 'البيدق يصبح وزيرًا'],
    hanging: ['القطعة المعلّقة', '🎯', 'اصطد القطع غير المحمية'],
    advantage: ['كسب الأفضلية', '📈', 'أفضل نقلة تحسم الموقف'],
    quiet: ['النقلة الهادئة', '🤫', 'أقوى نقلة ليست أسرًا ولا كشًا'],
    endgame: ['النهايات', '🏁', 'تقنيات قليلة القطع']
  };
  self.PTHEMES = THEMES;

  function byId(id) { for (var i = 0; i < PUZZLES.length; i++) if (PUZZLES[i].id === id) return PUZZLES[i]; }

  function pickRated(theme) {
    var pool = PUZZLES.filter(function (p) { return (!theme || p.th.indexOf(theme) >= 0); });
    var uns = pool.filter(function (p) { return !S.puzzles[p.id]; });
    if (!uns.length) uns = pool;
    uns.sort(function (a, b) { return Math.abs(a.r - S.pRating) - Math.abs(b.r - S.pRating); });
    var top = uns.slice(0, Math.min(6, uns.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  A.route('puzzles', function (v) {
    var html = '<div class="hero"><div class="row nw"><div class="sp"><div class="hi">تصنيفك في الألغاز</div><div class="name" style="font-size:34px">' + Math.round(S.pRating) + '</div><small class="mut">✅ ' + S.pSolved + ' محلول · ❌ ' + S.pFailed + ' خطأ</small></div><div style="font-size:58px">🧩</div></div></div>' +
      '<div class="grid2">' +
      '<div class="tile" id="rated" style="--c:#38f5ff"><div class="ic">🎯</div><div class="tt">تدريب متدرّج</div><div class="st">ألغاز تناسب مستواك</div></div>' +
      '<div class="tile" id="daily" style="--c:#ffc14d"><div class="ic">🌅</div><div class="tt">لغز اليوم</div><div class="st">' + (S.puzzles['daily-' + A.today()] ? '✅ تم الحل' : 'جديد!') + '</div></div>' +
      '<div class="tile" id="rush" style="--c:#ff4fd8"><div class="ic">⚡</div><div class="tt">عاصفة الألغاز</div><div class="st">3 دقائق · أفضل: ' + S.rushBest + '</div></div>' +
      '<div class="tile" id="classic" style="--c:#3dffa8"><div class="ic">🏛️</div><div class="tt">الكلاسيكيات</div><div class="st">أشهر الأنماط مع شرح مفصل</div></div>' +
      '</div><div class="sec-t">📚 حسب الموضوع</div><div class="list">';
    Object.keys(THEMES).forEach(function (k) {
      var n = PUZZLES.filter(function (p) { return p.th.indexOf(k) >= 0; }).length;
      if (!n) return;
      var d = PUZZLES.filter(function (p) { return p.th.indexOf(k) >= 0 && S.puzzles[p.id]; }).length;
      html += '<div class="it" data-t="' + k + '"><div class="ic">' + THEMES[k][1] + '</div><div class="tx"><b>' + THEMES[k][0] + '</b><small>' + THEMES[k][2] + ' · ' + d + '/' + n + '</small></div><span class="mut">◀</span></div>';
    });
    html += '</div>';
    v.innerHTML = html;
    $('#rated', v).onclick = function () { A.go('puzzle', { mode: 'rated' }); };
    $('#daily', v).onclick = function () { A.go('puzzle', { mode: 'daily' }); };
    $('#rush', v).onclick = function () { A.go('puzzle', { mode: 'rush' }); };
    $('#classic', v).onclick = function () { A.go('puzzle', { mode: 'classic' }); };
    $$('[data-t]', v).forEach(function (e) { e.onclick = function () { A.go('puzzle', { mode: 'theme', theme: e.dataset.t }); }; });
    return { title: 'الألغاز' };
  });

  /* ===== مشغّل اللغز ===== */
  A.route('puzzle', function (v, p) {
    var mode = p.mode, classicIdx = 0;
    var rush = mode === 'rush' ? { score: 0, strikes: 0, left: 180, timer: null, level: 600 } : null;
    var pz, ch, step, hints, failed, done, board, startFen, userSide;

    v.innerHTML = (rush ? '<div class="row" style="justify-content:space-around;margin-bottom:8px"><div class="timer" id="rt">3:00</div><div class="timer" id="rs" style="color:var(--ok)">0</div><div class="timer" id="rx" style="color:var(--bad)"></div></div>' : '') +
      '<div class="plr" id="who"></div><div class="bwrap" id="bd"></div>' +
      '<div class="panel"><div class="coachbox" id="cb"></div><div class="tools" style="margin-top:8px" id="tl">' +
      '<button class="btn sm" id="h1">💡 تلميح</button><button class="btn sm" id="sol">👁️ الحل</button><button class="btn sm" id="ana">🔬 حلّل</button><button class="btn sm pri" id="nx">اللغز التالي ◀</button></div></div>';
    board = newBoard($('#bd', v), {});
    var cbEl = $('#cb', v);
    function cb(html) { cbEl.innerHTML = '<div class="who"><span class="bot">🤖</span> المدرب</div>' + html; }

    function choose() {
      if (mode === 'daily') { var list = PUZZLES.filter(function (x) { return x.r >= 900 && x.r <= 1600; }); return list[A.dailyIndex(list.length)]; }
      if (mode === 'classic') { var cl = PUZZLES.filter(function (x) { return x.x; }); var q = cl[classicIdx % cl.length]; classicIdx++; return q; }
      if (mode === 'theme') return pickRated(p.theme);
      if (mode === 'rush') {
        var pool = PUZZLES.filter(function (x) { return x.r >= rush.level - 150 && x.r <= rush.level + 150; });
        if (!pool.length) pool = PUZZLES;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      return pickRated();
    }

    function load(pzz) {
      pz = pzz || choose();
      ch = new Chess(pz.fen); startFen = pz.fen;
      step = 0; hints = 0; failed = false; done = false;
      userSide = ch.turn();
      board.setOrientation(userSide);
      board.set(pz.fen);
      board.arrows([]);
      marks();
      $('#who', v).innerHTML = '<div class="av">' + (userSide === 'w' ? '♔' : '♚') + '</div><b>دورك: ' + (userSide === 'w' ? 'الأبيض' : 'الأسود') + '</b><span class="sp"></span>' + (rush ? '' : '<span class="tag v">تصنيف ' + pz.r + '</span>');
      var goal = pz.mate ? 'ابحث عن <b>كش مات في ' + pz.mate + '</b> ' + (pz.mate === 1 ? 'نقلة' : 'نقلات') + '.' : 'ابحث عن <b>أفضل نقلة</b> تكسب الأفضلية.';
      cb((pz.t ? '<b>' + pz.t + '</b><br>' : '') + goal + (pz.sol.length > 1 && !pz.mate ? ' <small class="mut">(الحل من ' + Math.ceil(pz.sol.length / 2) + ' نقلات)</small>' : ''));
      $('#nx', v).style.display = rush ? 'none' : '';
      $('#nx', v).classList.remove('pri');
      $('#sol', v).style.display = rush ? 'none' : '';
      $('#ana', v).style.display = 'none';
      $('#h1', v).style.display = rush ? 'none' : '';
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
      var before = ch.fen();
      var mv;
      try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || '');
      var exp = pz.sol[step];
      var ok = u === exp || ch.isCheckmate() || (step === 0 && pz.acc && pz.acc.indexOf(u) >= 0);
      board.set(ch.fen(), { from: from, to: to });
      A.soundFor(mv, ch);
      marks();
      if (ok) {
        if (u !== exp || step + 1 >= pz.sol.length || ch.isCheckmate()) { solved(u !== exp && !ch.isCheckmate()); return true; }
        step++;
        cb('✅ ' + Coach.sanHtml(mv.san, mv.color) + ' صحيحة! استمر...');
        A.sfx('ok');
        setTimeout(function () {
          var r = ch.move(Coach.parseUci(pz.sol[step]));
          board.set(ch.fen(), { from: r.from, to: r.to }); A.soundFor(r, ch); marks();
          step++;
        }, 550);
      } else {
        wrong(before, u, mv);
      }
      return true;
    };

    function wrong(before, u, mv) {
      A.sfx('bad');
      if (!failed) { failed = true; if (!rush) rate(false); }
      if (rush) {
        rush.strikes++; $('#rx', v).textContent = '❌'.repeat(rush.strikes);
        board.mark('bad', [mv.to]);
        if (rush.strikes >= 3) { setTimeout(endRush, 600); return; }
        setTimeout(function () { load(); }, 700);
        return;
      }
      cb('❌ ' + Coach.sanHtml(mv.san, mv.color) + ' ليست أفضل نقلة. <span class="think"><span class="spin"></span> المدرب يحلل لماذا...</span>');
      board.mark('bad', [mv.to]);
      // شرح لماذا النقلة خاطئة
      Engine.analyse(ch.fen(), { depth: 12 }).then(function (after) {
        var r = after.lines[0];
        var html = '❌ <b>' + Coach.sanHtml(mv.san, mv.color) + '</b> ليست الحل.';
        if (r) {
          var d = Coach.describeMove(ch.fen(), r.pv[0]);
          var reason = d && d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; })[0];
          html += '<br>بعدها يرد الخصم بـ ' + Coach.sanHtml(d.san, d.move.color) + (reason ? ' — ' + reason : '');
          html += '<br><small class="mut">' + Coach.scoreSentence(Coach.toWhite(r.score, ch.turn())) + '</small>';
          board.arrows([{ from: r.pv[0].slice(0, 2), to: r.pv[0].slice(2, 4), c: 'r' }]);
        }
        html += '<div class="row" style="margin-top:8px"><button class="btn sm" id="retry">↩️ حاول مجددًا</button><button class="btn sm" id="show">👁️ أرني الحل</button></div>';
        cb(html);
        $('#retry', v).onclick = retry;
        $('#show', v).onclick = showSol;
      }).catch(function () {
        cb('❌ ليست الحل. <div class="row" style="margin-top:8px"><button class="btn sm" id="retry">↩️ حاول مجددًا</button></div>');
        $('#retry', v).onclick = retry;
      });
    }

    function retry() { ch.undo(); board.set(ch.fen()); board.arrows([]); marks(); cb('حاول مرة أخرى 💪 فكر: كش؟ أسر؟ تهديد؟'); }

    function rate(win) {
      var k = 28, exp = 1 / (1 + Math.pow(10, (pz.r - S.pRating) / 400));
      var delta = Math.round(k * ((win ? 1 : 0) - exp));
      if (win && hints) delta = Math.round(delta / (1 + hints));
      S.pRating = Math.max(400, S.pRating + delta);
      if (!win) S.pFailed++;
      A.save();
      return delta;
    }

    function solved(alt) {
      done = true;
      A.sfx('ok');
      if (rush) {
        rush.score++; $('#rs', v).textContent = rush.score; rush.level += 60;
        board.burst(board.last ? board.last.to : 'e4');
        setTimeout(function () { load(); }, 500);
        return;
      }
      var first = !S.puzzles[pz.id];
      var delta = 0;
      if (!failed) delta = rate(true);
      if (first && !failed) { S.pSolved++; }
      S.puzzles[pz.id] = failed ? -1 : 1;
      if (mode === 'daily' && !failed) S.puzzles['daily-' + A.today()] = 1;
      A.save();
      A.confetti();
      var xp = failed ? 2 : Math.max(3, 10 - hints * 3) + (mode === 'daily' ? 10 : 0);
      if (first || !failed) A.addXp(xp, failed ? 'أكملت اللغز' : 'لغز محلول');
      $('#nx', v).classList.add('pri');
      $('#ana', v).style.display = '';
      explain(alt, delta);
    }

    function explain(alt, delta) {
      var html = '<div class="exp-head">🎉 ' + (failed ? 'أكملت الحل' : 'أحسنت! حللت اللغز') + (delta ? ' <span class="tag g">' + (delta > 0 ? '+' : '') + delta + '</span>' : '') + '</div>';
      if (alt) html += '<div class="exp-note">وجدت حلًا بديلًا قويًا بنفس القيمة تقريبًا!</div>';
      if (pz.x) html += '<div class="exp-sec"><div class="exp-t">📖 الفكرة</div>' + pz.x + '</div>';
      html += '<div class="exp-sec"><div class="exp-t">🧠 شرح الحل خطوة بخطوة</div><ul>';
      var c = new Chess(startFen);
      pz.sol.forEach(function (u, i) {
        var d = Coach.describeMove(c.fen(), u);
        var mine = c.turn() === userSide;
        var reasons = d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
        html += '<li>' + (mine ? '' : '<span class="mut">رد الخصم: </span>') + Coach.sanHtml(d.san, d.move.color) + (reasons.length ? ' — ' + reasons.slice(0, mine ? 2 : 1).join(' ') : (mine ? '' : ' (أفضل دفاع متاح)')) + '</li>';
        c.move(Coach.parseUci(u));
      });
      html += '</ul></div>';
      var th = pz.th.filter(function (t) { return THEMES[t]; }).map(function (t) { return '<span class="tag">' + THEMES[t][1] + ' ' + THEMES[t][0] + '</span>'; }).join('');
      html += '<div class="exp-sec"><div class="exp-t">🏷️ المواضيع</div>' + th + '</div>';
      html += '<div class="exp-sec" id="whybest"><span class="think"><span class="spin"></span> يقارن المدرب الحل بالبدائل...</span></div>';
      cb(html);
      A.speak(pz.x || ('أحسنت. ' + Coach.moveToArabic(startFen, pz.sol[0])));
      // لماذا هي الأفضل؟ مقارنة حية بالمحرك
      Engine.analyse(startFen, { depth: 13, multipv: 3 }).then(function (an) {
        var el = $('#whybest', v); if (!el) return;
        var turn = startFen.split(' ')[1], best = an.lines[0];
        var h = '<div class="exp-t">⚖️ لماذا هي الأفضل؟</div><ul>';
        var wb = Coach.winPct(best.score);
        an.lines.forEach(function (l, i) {
          if (l.pv[0] === pz.sol[0]) { h += '<li>' + Coach.sanHtml(Coach.uciToSan(startFen, l.pv[0]), turn) + ' <b>(الحل)</b> — ' + Coach.scoreSentence(Coach.toWhite(l.score, turn)) + '</li>'; return; }
          var g = wb - Coach.winPct(l.score);
          h += '<li>' + Coach.sanHtml(Coach.uciToSan(startFen, l.pv[0]), turn) + ' — ' + (g < 5 ? 'بديل قريب في القوة' : g < 20 ? 'أضعف بوضوح' : 'تضيّع الفرصة تمامًا') + ' <bdi class="evalchip">' + Coach.scoreText(Coach.toWhite(l.score, turn)) + '</bdi></li>';
        });
        h += '</ul>';
        el.innerHTML = h;
      }).catch(function () { var el = $('#whybest', v); if (el) el.remove(); });
    }

    function showSol() {
      failed = true;
      ch.load(startFen); board.set(startFen); marks();
      var i = 0;
      cb('👁️ مشاهدة الحل...');
      (function stepSol() {
        if (i >= pz.sol.length) { S.puzzles[pz.id] = S.puzzles[pz.id] || -1; A.save(); done = true; $('#nx', v).classList.add('pri'); $('#ana', v).style.display = ''; explain(false, 0); return; }
        var r = ch.move(Coach.parseUci(pz.sol[i]));
        board.set(ch.fen(), { from: r.from, to: r.to }); A.soundFor(r, ch); marks();
        board.arrows([]);
        i++; setTimeout(stepSol, 900);
      })();
    }

    $('#h1', v).onclick = function () {
      if (done) return;
      hints++;
      var u = pz.sol[step];
      if (hints === 1) {
        var th = pz.th.filter(function (t) { return THEMES[t] && t !== 'endgame' && t !== 'quiet'; })[0];
        cb('💡 <b>تلميح:</b> ' + (th ? 'الفكرة: ' + THEMES[th][0] + ' — ' + THEMES[th][2] + '.' : 'ابحث عن نقلة تجبر الخصم.') + ' ' + (new Chess(ch.fen()).move(Coach.parseUci(u)).captured ? 'الحل يتضمن أسرًا.' : ''));
      } else if (hints === 2) {
        board.mark('hint', [u.slice(0, 2)]);
        cb('💡 <b>تلميح 2:</b> حرّك ' + Coach.NAME[ch.get(u.slice(0, 2)).type] + ' المضيء.');
      } else {
        board.arrows([{ from: u.slice(0, 2), to: u.slice(2, 4), c: 'b' }]);
        cb('💡 <b>السهم يشير إلى النقلة.</b> حاول أن تفهم لماذا قبل أن تلعبها!');
      }
    };
    $('#sol', v).onclick = function () { if (!done) { if (!failed) rate(false); showSol(); } };
    $('#nx', v).onclick = function () { load(); };
    $('#ana', v).onclick = function () { A.go('analysis', { fen: startFen }); };

    function endRush() {
      clearInterval(rush.timer); done = true;
      var best = rush.score > S.rushBest; if (best) { S.rushBest = rush.score; A.save(); }
      A.addXp(rush.score * 3, 'عاصفة الألغاز');
      A.sfx('win');
      var m = A.modal('<div class="big-emoji">⚡</div><h2 class="center">النتيجة: ' + rush.score + '</h2><p class="center mut">' + (best ? '🏆 رقم قياسي جديد!' : 'أفضل نتيجة: ' + S.rushBest) + '</p><button class="btn pri block" id="again">مرة أخرى</button><button class="btn block" style="margin-top:8px" data-close>إغلاق</button>');
      $('#again', m).onclick = function () { m.close(); A.go('puzzle', { mode: 'rush' }, true); };
    }

    if (rush) {
      rush.timer = setInterval(function () {
        rush.left--;
        var mm = Math.floor(rush.left / 60), ss = rush.left % 60;
        var el = $('#rt', v); if (el) el.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
        if (rush.left <= 0) endRush();
      }, 1000);
    }

    load(p.id ? byId(p.id) : null);
    var titles = { daily: 'لغز اليوم', rush: 'عاصفة الألغاز', classic: 'الكلاسيكيات', rated: 'تدريب متدرّج', theme: p.theme && THEMES[p.theme] ? THEMES[p.theme][0] : 'الألغاز' };
    return { title: titles[mode] || 'لغز', cleanup: function () { if (rush) clearInterval(rush.timer); Engine.stop(); } };
  });
})();
