/* اللعب أونلاين عبر lichess.org (مجاني، لاعبون حقيقيون) + اللعب مع صديق على نفس الهاتف */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;
  var HOST = 'https://lichess.org';
  var CLIENT = 'shatranj-academy';

  /* ===== الحساب ===== */
  function token() { return S.lichess && S.lichess.token; }
  function redirectUri() { return location.origin + location.pathname; }
  function b64url(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function randStr(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }

  function login() {
    var verifier = randStr(64), state = randStr(16);
    try { localStorage.setItem('li.pkce', JSON.stringify({ v: verifier, s: state })); } catch (e) {}
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
      location.href = HOST + '/oauth?response_type=code&client_id=' + CLIENT +
        '&redirect_uri=' + encodeURIComponent(redirectUri()) + '&code_challenge_method=S256&code_challenge=' + b64url(h) +
        '&scope=' + encodeURIComponent('board:play challenge:write') + '&state=' + state;
    });
  }

  /* يُستدعى عند فتح التطبيق: إكمال تسجيل الدخول بعد العودة من lichess */
  function handleRedirect() {
    var q = new URLSearchParams(location.search);
    var code = q.get('code'), st = q.get('state');
    if (!code && !q.get('error')) return false;
    history.replaceState(null, '', location.pathname);
    var saved = null; try { saved = JSON.parse(localStorage.getItem('li.pkce')); } catch (e) {}
    if (!code || !saved || saved.s !== st) { A.toast('تم إلغاء تسجيل الدخول'); return false; }
    var body = new URLSearchParams({ grant_type: 'authorization_code', code: code, code_verifier: saved.v, redirect_uri: redirectUri(), client_id: CLIENT });
    fetch(HOST + '/api/token', { method: 'POST', body: body }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.access_token) throw new Error('no token');
      S.lichess = { token: j.access_token };
      return api('/api/account');
    }).then(function (acc) {
      S.lichess.user = acc.username; S.lichess.id = acc.id; A.save();
      A.toast('مرحبًا ' + acc.username + '! جاهز للعب أونلاين');
      A.go('online');
    }).catch(function () { A.toast('تعذّر تسجيل الدخول، حاول مرة أخرى'); });
    return true;
  }

  function api(path, opts) {
    opts = opts || {};
    var h = { Authorization: 'Bearer ' + token() };
    if (opts.form) { opts.body = new URLSearchParams(opts.form); delete opts.form; }
    opts.headers = h;
    return fetch(HOST + path, opts).then(function (r) {
      if (r.status === 401) { S.lichess = null; A.save(); throw new Error('auth'); }
      if (!r.ok) return r.text().then(function (t) { var e = new Error(t); e.status = r.status; throw e; });
      var ct = r.headers.get('content-type') || '';
      return ct.indexOf('json') >= 0 ? r.json() : r.text();
    });
  }

  /* تدفق ndjson: كل سطر حدث */
  function stream(path, onEvent, ctrl, opts) {
    opts = opts || {};
    return fetch(HOST + path, { method: opts.method || 'GET', body: opts.form ? new URLSearchParams(opts.form) : undefined, headers: { Authorization: 'Bearer ' + token() }, signal: ctrl.signal }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { var e = new Error(t); e.status = r.status; throw e; });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) return;
          buf += dec.decode(x.value, { stream: true });
          var parts = buf.split('\n'); buf = parts.pop();
          parts.forEach(function (l) { if (l.trim()) { try { onEvent(JSON.parse(l)); } catch (e) {} } });
          return pump();
        });
      }
      return pump();
    });
  }

  function errText(e) {
    var m = String(e && e.message || '');
    try { var j = JSON.parse(m); m = j.error || m; } catch (x) {}
    if (e && e.name === 'AbortError') return '';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'لا يوجد اتصال بالإنترنت.';
    return m.slice(0, 120);
  }

  /* ===== شاشة اللعب أونلاين ===== */
  var TCS = [[10, 0, '10 دقائق'], [10, 5, '10+5'], [15, 10, '15+10'], [30, 0, '30 دقيقة']];

  A.route('online', function (v) {
    var ctrl = null;
    if (!token()) {
      v.innerHTML = '<div class="card"><h2>🌍 العب ضد لاعبين حقيقيين</h2><p>اللعب أونلاين يتم عبر موقع <b>lichess.org</b> المجاني (بدون إعلانات، ملايين اللاعبين). تحتاج حسابًا مجانيًا هناك — يمكنك إنشاؤه من صفحة الدخول.</p></div>' +
        '<button class="bigbtn main" id="li"><span class="ic">🔑</span><span><b>تسجيل الدخول بحساب lichess</b><small>أو أنشئ حسابًا جديدًا مجانًا</small></span></button>' +
        '<p class="mut center" style="font-size:12.5px">يحتاج اتصالًا بالإنترنت. باقي التطبيق يعمل دون إنترنت.</p>';
      $('#li', v).onclick = login;
      return { title: 'العب أونلاين' };
    }
    var tc = S.liTc || 0, rated = !!S.liRated;
    v.innerHTML = '<div class="card"><div class="row nw"><div class="sp"><small class="mut">متصل باسم</small><h2 style="margin:0">' + A.esc(S.lichess.user || '') + '</h2></div><button class="btn sm" id="out">خروج</button></div></div>' +
      '<div id="ongoing"></div>' +
      '<div class="sec-t">⏱️ مدة المباراة</div><div class="diff" id="tcs">' + TCS.map(function (t, i) { return '<button data-i="' + i + '" class="' + (i === tc ? 'on' : '') + '">' + t[2] + '</button>'; }).join('') + '</div>' +
      '<label class="switch"><span><b>مباراة مصنّفة</b><br><small class="mut">تؤثر على تصنيفك في lichess</small></span><input type="checkbox" id="rt" ' + (rated ? 'checked' : '') + '></label>' +
      '<button class="bigbtn main" id="seek" style="margin-top:12px"><span class="ic">⚔️</span><span><b>ابحث عن خصم</b><small>لاعب حقيقي بمستوى قريب منك</small></span></button>' +
      '<div class="card" style="margin-top:6px"><h2>👥 تحدَّ صديقًا</h2><p>اكتب اسم صديقك في lichess:</p><div class="row nw"><input type="text" id="fr" placeholder="username"><button class="btn pri" id="ch">تحدَّ</button></div></div>' +
      '<div id="incoming"></div>' +
      '<p class="mut center" style="font-size:12px">⚖️ أثناء اللعب أونلاين تُعطَّل مساعدة المدرب احترامًا لقواعد اللعب النظيف. بعد المباراة يمكنك تحليلها بالكامل.</p>';
    $$('#tcs button', v).forEach(function (b) { b.onclick = function () { tc = +b.dataset.i; S.liTc = tc; A.save(); $$('#tcs button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#rt', v).onchange = function () { rated = this.checked; S.liRated = rated; A.save(); };
    $('#out', v).onclick = function () { S.lichess = null; A.save(); A.go('online', {}, true); };

    // تدفق الأحداث: بدء المباريات والتحديات الواردة
    var evCtrl = new AbortController();
    stream('/api/stream/event', function (ev) {
      if (ev.type === 'gameStart') {
        var g = ev.game || {};
        if (ctrl) { stopSearch(); A.go('ogame', { id: g.gameId || g.id }); return; }
        var o = $('#ongoing', v);
        if (o) {
          o.innerHTML = '<button class="bigbtn" id="resume"><span class="ic">⏯️</span><span><b>لديك مباراة جارية</b><small>ضد ' + A.esc((g.opponent && g.opponent.username) || '') + ' — اضغط للمتابعة</small></span></button>';
          $('#resume', v).onclick = function () { A.go('ogame', { id: g.gameId || g.id }); };
        }
      } else if (ev.type === 'challenge' && ev.challenge && ev.challenge.challenger && ev.challenge.challenger.id !== S.lichess.id) {
        var c = ev.challenge, inc = $('#incoming', v);
        if (!inc) return;
        inc.innerHTML = '<div class="card glow"><h2>📩 تحدٍّ من ' + A.esc(c.challenger.name) + '</h2><p>' + A.esc((c.timeControl && c.timeControl.show) || '') + (c.rated ? ' · مصنّفة' : ' · ودّية') + '</p><div class="row"><button class="btn pri" id="acc">قبول</button><button class="btn" id="dec">رفض</button></div></div>';
        $('#acc', v).onclick = function () { api('/api/challenge/' + c.id + '/accept', { method: 'POST' }).catch(function (e) { A.toast(errText(e)); }); inc.innerHTML = '<p class="center mut">جارٍ بدء المباراة...</p>'; ctrl = ctrl || { abort: function () {} }; };
        $('#dec', v).onclick = function () { api('/api/challenge/' + c.id + '/decline', { method: 'POST' }).catch(function () {}); inc.innerHTML = ''; };
      }
    }, evCtrl).catch(function (e) { var m = errText(e); if (m) A.toast(m); });

    var challengeId = null;
    function searching(text) {
      var m = A.modal('<div class="center"><div class="spin" style="width:42px;height:42px;border-width:4px"></div><h2 style="margin-top:14px">' + text + '</h2><p class="mut">' + TCS[tc][2] + (rated ? ' · مصنّفة' : ' · ودّية') + '</p><button class="btn block" data-close>إلغاء</button></div>', function () { stopSearch(); });
      return m;
    }
    var modalRef = null;
    function stopSearch() {
      if (ctrl) { try { ctrl.abort(); } catch (e) {} ctrl = null; }
      if (challengeId) { api('/api/challenge/' + challengeId + '/cancel', { method: 'POST' }).catch(function () {}); challengeId = null; }
      if (modalRef && modalRef.parentNode) modalRef.remove();
    }
    $('#seek', v).onclick = function () {
      ctrl = new AbortController();
      modalRef = searching('نبحث عن خصم...');
      stream('/api/board/seek', function () {}, ctrl, { method: 'POST', form: { rated: rated, time: TCS[tc][0], increment: TCS[tc][1], variant: 'standard', color: 'random' } })
        .catch(function (e) { var m = errText(e); if (m) { A.toast(m); stopSearch(); } });
    };
    $('#ch', v).onclick = function () {
      var u = $('#fr', v).value.trim();
      if (!u) { A.toast('اكتب اسم المستخدم'); return; }
      ctrl = new AbortController();
      modalRef = searching('بانتظار قبول ' + A.esc(u) + '...');
      api('/api/challenge/' + encodeURIComponent(u), { method: 'POST', form: { rated: rated, 'clock.limit': TCS[tc][0] * 60, 'clock.increment': TCS[tc][1], color: 'random', variant: 'standard' } })
        .then(function (j) { challengeId = (j.challenge || j).id; A.toast('أُرسل التحدي! أرسل لصديقك الرابط: lichess.org/' + challengeId, 5000); })
        .catch(function (e) { A.toast(errText(e) || 'تعذّر إرسال التحدي'); stopSearch(); });
    };
    return { title: 'العب أونلاين', cleanup: function () { stopSearch(); evCtrl.abort(); } };
  });

  /* ===== المباراة أونلاين ===== */
  A.route('ogame', function (v, p) {
    var id = p.id, ctrl = new AbortController();
    var me = null, initFen = new Chess().fen(), ch = new Chess(), moves = [], st = {}, over = false, clockT = null, lastTick = Date.now();
    var names = { w: '', b: '' };
    v.innerHTML = '<div class="plr" id="pt"></div><div class="bwrap" id="bd"></div><div class="plr" id="pb"></div><div class="panel"><div class="coachbox" id="cb"><span class="think"><span class="spin"></span> جارٍ الاتصال بالمباراة...</span></div><div class="moves" id="ml" style="margin-top:8px"></div></div>';
    var board = newBoard($('#bd', v), {});
    var bar = A.actionbar([['drw', '🤝', 'تعادل'], ['res', '🏳️', 'استسلام'], ['flp', '🔄', 'قلب']]);
    function msg(h) { $('#cb', v).innerHTML = h; }

    function fmt(ms) { ms = Math.max(0, ms); var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); s %= 60; return m + ':' + (s < 10 ? '0' : '') + s; }
    function bars() {
      if (!me) return;
      var opp = me === 'w' ? 'b' : 'w', turn = ch.turn();
      var el = Date.now() - lastTick;
      function t(c) { var x = c === 'w' ? st.wtime : st.btime; if (!over && turn === c && moves.length >= 2) x -= el; return x; }
      function bar(c) { var tm = t(c); return '<div class="av">' + (c === 'w' ? '♔' : '♚') + '</div><b>' + A.esc(names[c]) + '</b><span class="sp"></span><span class="clock' + (turn === c && !over ? ' on' : '') + (tm < 20000 ? ' low' : '') + '">' + fmt(tm) + '</span>'; }
      $('#pt', v).innerHTML = bar(opp); $('#pb', v).innerHTML = bar(me);
    }
    function applyMoves(list, animate) {
      var prev = moves.length;
      ch = new Chess(initFen); var last = null, mv = null;
      list.forEach(function (u) { mv = ch.move(Coach.parseUci(u)); last = { from: mv.from, to: mv.to }; });
      moves = list.slice();
      board.set(ch.fen(), last);
      var mk = {}; if (ch.isCheck()) mk.chk = [kingSq(ch, ch.turn())]; board.setMarks(mk);
      if (animate && list.length > prev && mv) A.soundFor(mv, ch);
      var h = '', c2 = new Chess(initFen);
      list.forEach(function (u, i) { var r = c2.move(Coach.parseUci(u)); if (r.color === 'w') h += '<span class="mn">' + Math.ceil((i + 1) / 2) + '.</span>'; h += '<span class="mv' + (i === list.length - 1 ? ' cur' : '') + '">' + Coach.sanHtml(r.san, r.color) + '</span>'; });
      var ml = $('#ml', v); ml.innerHTML = h; ml.scrollTop = ml.scrollHeight;
      lastTick = Date.now();
    }
    function onState(s) {
      st = s;
      var list = s.moves ? s.moves.split(' ') : [];
      if (list.length !== moves.length || list.join() !== moves.join()) applyMoves(list, true);
      else lastTick = Date.now();
      if (s.status && s.status !== 'started' && s.status !== 'created') return finish(s);
      var oppDraw = me === 'w' ? s.bdraw : s.wdraw;
      if (oppDraw) {
        msg('🤝 خصمك يعرض التعادل.<div class="chips"><button class="btn sm pri" id="dy">قبول</button><button class="btn sm" id="dn">رفض</button></div>');
        $('#dy', v).onclick = function () { api('/api/board/game/' + id + '/draw/yes', { method: 'POST' }).catch(function () {}); };
        $('#dn', v).onclick = function () { api('/api/board/game/' + id + '/draw/no', { method: 'POST' }).catch(function () {}); msg('رفضت التعادل.'); };
      } else msg(ch.turn() === me ? '<b>دورك</b>' : '<span class="mut">ينتظر نقلة الخصم...</span>');
      bars();
    }
    var STATUS = { mate: 'كش مات', resign: 'استسلام', stalemate: 'إغلاق (تعادل)', timeout: 'انتهاء الوقت', draw: 'تعادل', outoftime: 'انتهاء الوقت', aborted: 'أُلغيت المباراة', noStart: 'لم تبدأ المباراة', cheat: 'غش' };
    function finish(s) {
      if (over) return; over = true; bars();
      var res = s.winner ? (s.winner === (me === 'w' ? 'white' : 'black') ? 'win' : 'loss') : 'draw';
      if (s.status === 'aborted') res = 'aborted';
      A.sfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'drawn');
      if (res === 'win') A.confetti();
      if (res !== 'aborted') { S.games.played++; if (res === 'win') S.games.won++; else if (res === 'loss') S.games.lost++; else S.games.drawn++; A.save(); A.addXp(res === 'win' ? 30 : 15, 'مباراة أونلاين'); }
      var t = { win: ['🏆', 'فزت!'], loss: ['💪', 'خسرت هذه المرة'], draw: ['🤝', 'تعادل'], aborted: ['⏹️', 'أُلغيت المباراة'] }[res];
      var m = A.modal('<div class="big-emoji">' + t[0] + '</div><h2 class="center">' + t[1] + '</h2><p class="center mut">' + (STATUS[s.status] || s.status) + '</p>' +
        (moves.length > 1 ? '<button class="btn pri block" id="anl">🔬 حلّل المباراة مع المدرب</button>' : '') + '<button class="btn block" style="margin-top:8px" id="nw">مباراة جديدة</button>');
      if ($('#anl', m)) $('#anl', m).onclick = function () { m.close(); A.go('analysis', { moves: moves.slice(), orient: me }); };
      $('#nw', m).onclick = function () { m.close(); A.go('online', {}, true); };
      msg(t[1] + ' — ' + (STATUS[s.status] || ''));
    }

    board.o.movable = function () { return !over && me && ch.turn() === me ? me : null; };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      var mv; try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || '');
      var before = moves.slice();
      moves.push(u); applyMoves(moves, false); A.soundFor(mv, ch); bars();
      api('/api/board/game/' + id + '/move/' + u, { method: 'POST' }).catch(function (e) {
        A.toast('لم تُرسل النقلة: ' + errText(e)); applyMoves(before, false);
      });
      return true;
    };
    $('#flp', bar).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#drw', bar).onclick = function () { if (over) return; api('/api/board/game/' + id + '/draw/yes', { method: 'POST' }).then(function () { A.toast('أرسلت عرض التعادل'); }).catch(function (e) { A.toast(errText(e)); }); };
    $('#res', bar).onclick = function () {
      if (over) return;
      var abort = moves.length < 2;
      var m = A.modal('<h2>' + (abort ? 'إلغاء المباراة؟' : 'الاستسلام؟') + '</h2><div class="row"><button class="btn bad" id="y">' + (abort ? 'إلغاء' : 'استسلم') + '</button><button class="btn" data-close>رجوع</button></div>');
      $('#y', m).onclick = function () { m.close(); api('/api/board/game/' + id + (abort ? '/abort' : '/resign'), { method: 'POST' }).catch(function (e) { A.toast(errText(e)); }); };
    };

    stream('/api/board/game/stream/' + id, function (ev) {
      if (ev.type === 'gameFull') {
        var myId = S.lichess.id || (S.lichess.user || '').toLowerCase();
        me = ev.white && ev.white.id === myId ? 'w' : 'b';
        names.w = (ev.white.name || ev.white.id || 'الأبيض') + (ev.white.rating ? ' (' + ev.white.rating + ')' : '');
        names.b = (ev.black.name || ev.black.id || 'الأسود') + (ev.black.rating ? ' (' + ev.black.rating + ')' : '');
        if (ev.initialFen && ev.initialFen !== 'startpos') initFen = ev.initialFen;
        board.setOrientation(me);
        A.sfx('start');
        onState(ev.state);
      } else if (ev.type === 'gameState') onState(ev);
      else if (ev.type === 'opponentGone' && ev.gone) msg('⚠️ خصمك غادر المباراة. ' + (ev.claimWinInSeconds ? 'يمكنك المطالبة بالفوز خلال ' + ev.claimWinInSeconds + ' ثانية.' : ''));
    }, ctrl).catch(function (e) { var m = errText(e); if (m) msg('⚠️ ' + m); });

    clockT = setInterval(bars, 250);
    return { title: 'مباراة أونلاين', cleanup: function () { ctrl.abort(); clearInterval(clockT); } };
  });

  /* ===== صديق على نفس الهاتف ===== */
  A.route('friend', function (v) {
    var ch = new Chess(), hist = [], autoFlip = true;
    v.innerHTML = '<div class="plr" id="pt"></div><div class="bwrap" id="bd"></div><div class="plr" id="pb"></div><div class="panel"><label class="switch"><span><b>اقلب الرقعة تلقائيًا بعد كل نقلة</b></span><input type="checkbox" id="af" checked></label><div class="moves" id="ml" style="margin-top:8px"></div></div>';
    var board = newBoard($('#bd', v), {});
    var bar = A.actionbar([['und', '↩️', 'تراجع'], ['flp', '🔄', 'قلب'], ['new', '🆕', 'جديدة'], ['anl', '🔬', 'تحليل']]);
    function draw(last) {
      board.set(ch.fen(), last || null);
      var mk = {}; if (ch.isCheck()) mk.chk = [kingSq(ch, ch.turn())]; board.setMarks(mk);
      var t = ch.turn();
      $('#pt', v).innerHTML = '<div class="av">♚</div><b>الأسود</b>' + (t === 'b' ? ' <span class="tag g">دوره</span>' : '');
      $('#pb', v).innerHTML = '<div class="av">♔</div><b>الأبيض</b>' + (t === 'w' ? ' <span class="tag g">دوره</span>' : '');
      var h = '', c2 = new Chess();
      hist.forEach(function (u, i) { var r = c2.move(Coach.parseUci(u)); if (r.color === 'w') h += '<span class="mn">' + Math.ceil((i + 1) / 2) + '.</span>'; h += '<span class="mv">' + Coach.sanHtml(r.san, r.color) + '</span>'; });
      $('#ml', v).innerHTML = h;
      if (ch.isGameOver()) {
        var r = ch.isCheckmate() ? (ch.turn() === 'w' ? 'فاز الأسود' : 'فاز الأبيض') + ' بكش مات!' : 'تعادل';
        A.sfx(ch.isCheckmate() ? 'win' : 'drawn');
        setTimeout(function () { A.modal('<div class="big-emoji">🏁</div><h2 class="center">' + r + '</h2><button class="btn pri block" data-close>حسنًا</button>'); }, 500);
      }
    }
    board.o.movable = function () { return ch.isGameOver() ? null : ch.turn(); };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      var mv; try { mv = ch.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      hist.push(mv.from + mv.to + (mv.promotion || ''));
      draw({ from: from, to: to }); A.soundFor(mv, ch);
      if (autoFlip && !ch.isGameOver()) setTimeout(function () { board.setOrientation(ch.turn()); }, 450);
      return true;
    };
    $('#af', v).onchange = function () { autoFlip = this.checked; };
    $('#und', bar).onclick = function () { if (hist.length) { ch.undo(); hist.pop(); draw(); if (autoFlip) board.setOrientation(ch.turn()); } };
    $('#flp', bar).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#new', bar).onclick = function () { ch = new Chess(); hist = []; board.setOrientation('w'); draw(); };
    $('#anl', bar).onclick = function () { A.go('analysis', { moves: hist.slice() }); };
    draw();
    return { title: 'صديق على نفس الهاتف' };
  });

  self.Lichess = { handleRedirect: handleRedirect, login: login };
})();
