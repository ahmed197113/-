/* اللعب أونلاين بحسابات التطبيق نفسه (Firebase) + اللعب مع صديق على نفس الهاتف */
(function () {
  'use strict';
  var A = App, S = App.S, $ = A.$, $$ = A.$$, Chess = ChessJS.Chess;

  /* ===== الاتصال بالسيرفر ===== */
  var Net = { ok: false, auth: null, db: null, offset: 0, user: null, profile: null };
  function initNet() {
    var cfg = self.FIREBASE_CONFIG;
    var emu = /[?&]emu=1/.test(location.search);
    if (emu) cfg = { apiKey: 'demo-key', authDomain: 'demo-chess.firebaseapp.com', projectId: 'demo-chess', databaseURL: 'http://127.0.0.1:9000/?ns=demo-chess' };
    if (!cfg || !self.firebase) return;
    try {
      firebase.initializeApp(cfg);
      Net.auth = firebase.auth(); Net.db = firebase.database();
      if (emu) { Net.auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true }); Net.db.useEmulator('127.0.0.1', 9000); }
      Net.ok = true;
      Net.db.ref('.info/serverTimeOffset').on('value', function (s) { Net.offset = s.val() || 0; });
      Net.auth.onAuthStateChanged(function (u) {
        Net.user = u; Net.profile = null;
        if (u) Net.db.ref('users/' + u.uid).on('value', function (s) { Net.profile = s.val(); });
      });
    } catch (e) { Net.ok = false; }
  }
  function now() { return Date.now() + Net.offset; }
  function ref(p) { return Net.db.ref(p); }
  function uid() { return Net.user && Net.user.uid; }

  var ERR = {
    'auth/email-already-in-use': 'هذا البريد مسجّل مسبقًا، جرّب تسجيل الدخول.',
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
    'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل).',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/invalid-login-credentials': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلًا ثم حاول.',
    'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت.'
  };
  function errMsg(e) {
    if (e && /permission_denied|PERMISSION_DENIED/i.test(String(e.code || e.message))) return 'السيرفر رفض العملية (قواعد قاعدة البيانات غير مضبوطة).';
    return ERR[e && e.code] || (e && e.message) || 'حدث خطأ، حاول مرة أخرى.';
  }

  var TCS = [[5, 0, '5 دقائق'], [10, 0, '10 دقائق'], [10, 5, '10+5'], [15, 10, '15+10']];
  function tcKey(i) { return TCS[i][0] + '_' + TCS[i][1]; }

  /* ===== إنشاء مباراة بين لاعبين ===== */
  function createGame(a, b, tcI) {
    var white = Math.random() < .5 ? a : b, black = white === a ? b : a;
    var t = TCS[tcI], gid = ref('games').push().key;
    var g = { w: white.uid, b: black.uid, wn: white.name, bn: black.name, wr: white.rating || 1200, br: black.rating || 1200,
      tc: { m: t[0], i: t[1] }, moves: '', wtime: t[0] * 60000, btime: t[0] * 60000, lastTs: now(), created: now(), status: 'started' };
    return ref('games/' + gid).set(g).then(function () {
      return Promise.all([ref('userGames/' + a.uid).set(gid), ref('userGames/' + b.uid).set(gid)]);
    }).then(function () { return gid; });
  }

  /* ===== الحساب: تسجيل ودخول ===== */
  function authView(v) {
    var mode = 'reg';
    function draw() {
      v.innerHTML = '<div class="card"><h2>🌍 العب أونلاين</h2><p>أنشئ حسابك في <b>أكاديمية الشطرنج</b> والعب ضد لاعبين حقيقيين وتحدَّ أصدقاءك.</p></div>' +
        '<div class="seg" style="margin-bottom:12px"><button data-m="reg" class="' + (mode === 'reg' ? 'on' : '') + '">حساب جديد</button><button data-m="in" class="' + (mode === 'in' ? 'on' : '') + '">تسجيل الدخول</button></div>' +
        '<div class="card">' +
        (mode === 'reg' ? '<label class="mut">اسم اللاعب (يظهر لخصومك)</label><input type="text" id="un" maxlength="16" style="direction:rtl;margin:6px 0 12px" placeholder="مثال: أحمد_2026">' : '') +
        '<label class="mut">البريد الإلكتروني</label><input type="text" id="em" inputmode="email" autocomplete="email" style="margin:6px 0 12px" placeholder="name@gmail.com">' +
        '<label class="mut">كلمة المرور</label><input type="password" id="pw" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--txt);margin:6px 0 14px;direction:ltr" placeholder="6 أحرف على الأقل">' +
        '<button class="btn pri block" id="go">' + (mode === 'reg' ? 'إنشاء الحساب' : 'دخول') + '</button>' +
        (mode === 'in' ? '<button class="btn block" style="margin-top:8px" id="fg">نسيت كلمة المرور؟</button>' : '') +
        '<p class="feedback" id="fb"></p></div>';
      $$('.seg button', v).forEach(function (b) { b.onclick = function () { mode = b.dataset.m; draw(); }; });
      $('#go', v).onclick = submit;
      if ($('#fg', v)) $('#fg', v).onclick = function () {
        var em = $('#em', v).value.trim(); if (!em) return fb('bad', 'اكتب بريدك أولًا');
        Net.auth.sendPasswordResetEmail(em).then(function () { fb('ok', 'أرسلنا رابط تغيير كلمة المرور إلى بريدك.'); }).catch(function (e) { fb('bad', errMsg(e)); });
      };
    }
    function fb(c, m) { var f = $('#fb', v); f.className = 'feedback ' + c; f.textContent = m; }
    function submit() {
      var em = $('#em', v).value.trim(), pw = $('#pw', v).value;
      var btn = $('#go', v); btn.disabled = true;
      var done = function () { btn.disabled = false; };
      if (mode === 'in') {
        Net.auth.signInWithEmailAndPassword(em, pw).then(function () { A.toast('أهلًا بعودتك!'); A.go('online', {}, true); }).catch(function (e) { fb('bad', errMsg(e)); done(); });
        return;
      }
      var name = $('#un', v).value.trim();
      if (!/^[A-Za-z0-9_؀-ۿ]{3,16}$/.test(name)) { fb('bad', 'الاسم من 3 إلى 16 حرفًا (حروف وأرقام و _ فقط).'); done(); return; }
      var key = name.toLowerCase();
      Net.auth.createUserWithEmailAndPassword(em, pw).then(function (cr) {
        var u = cr.user;
        return ref('usernames/' + key).transaction(function (cur) { return cur ? undefined : u.uid; }).then(function (r) {
          if (!r.committed) { return u.delete().then(function () { throw { message: 'هذا الاسم مستخدم، اختر اسمًا آخر.' }; }); }
          return u.updateProfile({ displayName: name }).then(function () {
            return ref('users/' + u.uid).set({ name: name, rating: 1200, played: 0, wins: 0, losses: 0, draws: 0, created: now() });
          });
        });
      }).then(function () { A.toast('🎉 تم إنشاء حسابك!'); A.go('online', {}, true); }).catch(function (e) { fb('bad', errMsg(e)); done(); });
    }
    draw();
  }

  /* ===== شاشة اللعب أونلاين ===== */
  A.route('online', function (v) {
    if (!Net.ok) {
      v.innerHTML = '<div class="card"><h2>🌍 اللعب أونلاين</h2><p>اللعب أونلاين قيد التفعيل وسيكون متاحًا قريبًا. يمكنك الآن اللعب ضد الكمبيوتر أو مع صديق على نفس الهاتف.</p></div>';
      return { title: 'العب أونلاين' };
    }
    if (!Net.user) {
      v.innerHTML = '<p class="center"><span class="spin"></span></p>';
      var t = setTimeout(function () { if (!Net.user) authView(v); else A.go('online', {}, true); }, Net.auth.currentUser === null ? 600 : 0);
      return { title: 'العب أونلاين', cleanup: function () { clearTimeout(t); } };
    }
    var me = uid(), offs = [], seeking = null, beat = null;
    function on(r, ev, fn) { r.on(ev, fn); offs.push(function () { r.off(ev, fn); }); }
    var tc = S.onTc == null ? 1 : S.onTc;
    v.innerHTML = '<div class="card" id="prof"></div><div id="cur"></div>' +
      '<div class="sec-t">⏱️ مدة المباراة</div><div class="diff" id="tcs">' + TCS.map(function (x, i) { return '<button data-i="' + i + '" class="' + (i === tc ? 'on' : '') + '">' + x[2] + '</button>'; }).join('') + '</div>' +
      '<button class="bigbtn main" id="seek"><span class="ic">⚔️</span><span><b>ابحث عن خصم</b><small>لاعب حقيقي من مستخدمي التطبيق</small></span></button>' +
      '<div id="inc"></div>' +
      '<div class="card"><h2>👥 تحدَّ صديقًا</h2><p>اكتب اسم صديقك في التطبيق:</p><div class="row nw"><input type="text" id="fr" style="direction:rtl" placeholder="اسم اللاعب"><button class="btn pri" id="ch">تحدَّ</button></div></div>' +
      '<div class="card"><h2>🏆 أفضل اللاعبين</h2><div id="lb"><span class="spin"></span></div></div>' +
      '<button class="btn block" id="out" style="margin-bottom:10px">تسجيل الخروج</button>';
    $$('#tcs button', v).forEach(function (b) { b.onclick = function () { tc = +b.dataset.i; S.onTc = tc; A.save(); $$('#tcs button', v).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#out', v).onclick = function () { Net.auth.signOut().then(function () { A.go('online', {}, true); }); };

    on(ref('users/' + me), 'value', function (s) {
      var p = s.val() || {}; Net.profile = p;
      $('#prof', v).innerHTML = '<div class="row nw"><div class="av" style="width:44px;height:44px;border-radius:14px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:22px">♞</div><div class="sp"><b style="font-size:17px">' + A.esc(p.name || '') + '</b><br><small class="mut">التصنيف ' + (p.rating || 1200) + ' · ' + (p.wins || 0) + ' فوز · ' + (p.losses || 0) + ' خسارة · ' + (p.draws || 0) + ' تعادل</small></div></div>';
    });
    // مباراة جارية أو مباراة بدأت للتو
    var startGid = null, firstSnap = true;
    on(ref('userGames/' + me), 'value', function (s) {
      var gid = s.val();
      if (firstSnap) { firstSnap = false; startGid = gid; if (gid) ref('games/' + gid + '/status').once('value').then(function (st) { if (st.val() === 'started' && $('#cur', v)) { $('#cur', v).innerHTML = '<button class="bigbtn" id="rs"><span class="ic">⏯️</span><span><b>لديك مباراة جارية</b><small>اضغط للمتابعة</small></span></button>'; $('#rs', v).onclick = function () { A.go('ngame', { id: gid }); }; } }); return; }
      if (gid && gid !== startGid) { stopSeek(true); A.go('ngame', { id: gid }); }
    });
    // التحديات الواردة
    on(ref('challenges/' + me), 'value', function (s) {
      var list = s.val() || {}, h = '';
      Object.keys(list).forEach(function (from) {
        var c = list[from]; if (now() - c.ts > 120000) return;
        h += '<div class="card glow"><b>📩 ' + A.esc(c.name) + ' (' + c.rating + ') يتحداك</b><p>' + TCS[c.tc][2] + '</p><div class="row"><button class="btn pri" data-a="' + from + '">قبول</button><button class="btn" data-d="' + from + '">رفض</button></div></div>';
      });
      $('#inc', v).innerHTML = h;
      $$('#inc [data-a]', v).forEach(function (b) { b.onclick = function () { var from = b.dataset.a, c = list[from]; ref('challenges/' + me + '/' + from).remove(); createGame({ uid: from, name: c.name, rating: c.rating }, { uid: me, name: Net.profile.name, rating: Net.profile.rating }, c.tc).catch(function (e) { A.toast(errMsg(e)); }); }; });
      $$('#inc [data-d]', v).forEach(function (b) { b.onclick = function () { ref('challenges/' + me + '/' + b.dataset.d).remove(); }; });
    });
    // لوحة الصدارة
    ref('users').orderByChild('rating').limitToLast(20).once('value').then(function (s) {
      var arr = []; s.forEach(function (c) { arr.push(c.val()); });
      arr.reverse();
      var el = $('#lb', v); if (!el) return;
      el.innerHTML = arr.map(function (u, i) { return '<div class="row nw" style="padding:6px 0;border-bottom:1px solid var(--line)"><b style="width:26px">' + (i + 1) + '</b><span class="sp">' + A.esc(u.name || '') + '</span><b>' + (u.rating || 1200) + '</b></div>'; }).join('') || '<p class="mut">لا يوجد لاعبون بعد</p>';
    }).catch(function () { var el = $('#lb', v); if (el) el.innerHTML = ''; });

    var waitModal = null, challengeTo = null, botT = null;
    var BOT_WAIT = 25;
    function stopSeek(silent) {
      if (seeking) { ref('queue/' + seeking + '/' + me).remove(); seeking = null; }
      if (challengeTo) { ref('challenges/' + challengeTo + '/' + me).remove(); challengeTo = null; }
      clearInterval(beat); beat = null; clearInterval(botT); botT = null;
      if (waitModal && waitModal.parentNode) waitModal.remove();
      waitModal = null;
    }
    function wait(text, bot) {
      waitModal = A.modal('<div class="center"><div class="spin" style="width:42px;height:42px;border-width:4px"></div><h2 style="margin-top:14px">' + text + '</h2><p class="mut">' + TCS[tc][2] + '</p>' + (bot ? '<p class="mut" style="font-size:12.5px">إذا لم يتوفر لاعب خلال <b id="bc">' + BOT_WAIT + '</b> ثانية ستبدأ مباراة ضد الكمبيوتر بمستواك.</p>' : '') + '<button class="btn block" data-close>إلغاء</button></div>', function () { stopSeek(); });
    }
    /* لا يوجد لاعب متاح: مباراة مباشرة ضد الكمبيوتر بمستوى قريب من تصنيف اللاعب */
    function startBot() {
      var r = (Net.profile && Net.profile.rating) || 1200;
      var lv = r < 700 ? 1 : r < 1000 ? 2 : r < 1300 ? 3 : r < 1600 ? 4 : r < 1900 ? 5 : 6;
      stopSeek(true);
      A.toast('🤖 لا يوجد لاعب متاح الآن — بدأت مباراة ضد الكمبيوتر');
      A.go('game', { level: lv, color: Math.random() < .5 ? 'w' : 'b', bot: true });
    }
    $('#seek', v).onclick = function () {
      var p = Net.profile || {}, key = tcKey(tc), opp = null, mine = { name: p.name || Net.user.displayName || 'لاعب', rating: p.rating || 1200, ts: now() };
      wait('نبحث عن خصم...', true);
      var left = BOT_WAIT;
      botT = setInterval(function () { left--; var el = document.getElementById('bc'); if (el) el.textContent = left; if (left <= 0) startBot(); }, 1000);
      ref('queue/' + key).transaction(function (q) {
        q = q || {}; opp = null;
        var t = now();
        Object.keys(q).forEach(function (k) {
          if (k === me) { delete q[k]; return; }
          if (t - (q[k].ts || 0) > 45000) { delete q[k]; return; }
          if (!opp) opp = k;
        });
        if (opp) { opp = { uid: opp, name: q[opp].name, rating: q[opp].rating }; delete q[opp]; }
        else q[me] = mine;
        return q;
      }).then(function (r) {
        if (!r.committed) throw new Error('retry');
        if (opp) return createGame(opp, { uid: me, name: mine.name, rating: mine.rating }, tc);
        seeking = key;
        beat = setInterval(function () { ref('queue/' + key + '/' + me + '/ts').set(now()); }, 15000);
      }).catch(function (e) { stopSeek(); A.toast(errMsg(e)); });
    };
    $('#ch', v).onclick = function () {
      var name = $('#fr', v).value.trim().toLowerCase();
      if (!name) return A.toast('اكتب اسم صديقك');
      ref('usernames/' + name).once('value').then(function (s) {
        var to = s.val();
        if (!to) { A.toast('لا يوجد لاعب بهذا الاسم'); return; }
        if (to === me) { A.toast('لا يمكنك تحدي نفسك 😄'); return; }
        var p = Net.profile || {};
        challengeTo = to;
        wait('بانتظار قبول صديقك...');
        return ref('challenges/' + to + '/' + me).set({ name: p.name, rating: p.rating || 1200, tc: tc, ts: now() });
      }).catch(function (e) { stopSeek(); A.toast(errMsg(e)); });
    };
    return { title: 'العب أونلاين', cleanup: function () { stopSeek(); offs.forEach(function (f) { f(); }); } };
  });

  /* ===== المباراة أونلاين ===== */
  A.route('ngame', function (v, p) {
    var gid = p.id, me = uid(), g = null, my = null, ch = new Chess(), over = false, tick = null, gref = ref('games/' + gid);
    v.innerHTML = '<div class="plr" id="pt"></div><div class="bwrap" id="bd"></div><div class="plr" id="pb"></div><div class="panel"><div class="coachbox" id="cb"><span class="think"><span class="spin"></span> جارٍ تحميل المباراة...</span></div><div class="moves" id="ml" style="margin-top:8px"></div></div>';
    var board = newBoard($('#bd', v), {});
    var bar = A.actionbar([['drw', '🤝', 'تعادل'], ['res', '🏳️', 'استسلام'], ['flp', '🔄', 'قلب']]);
    function msg(h) { $('#cb', v).innerHTML = h; }
    function fmt(ms) { ms = Math.max(0, ms); var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); s %= 60; return m + ':' + (s < 10 ? '0' : '') + s; }
    function list() { return g && g.moves ? g.moves.split(' ') : []; }
    function remaining(c) {
      if (!g) return 0;
      var t = c === 'w' ? g.wtime : g.btime;
      if (g.status === 'started' && ch.turn() === c && list().length >= 2) t -= now() - g.lastTs;
      return t;
    }
    function bars() {
      if (!g) return;
      var opp = my === 'w' ? 'b' : 'w';
      function row(c) { var t = remaining(c), nm = c === 'w' ? g.wn + ' (' + g.wr + ')' : g.bn + ' (' + g.br + ')'; return '<div class="av">' + (c === 'w' ? '♔' : '♚') + '</div><b>' + A.esc(nm) + '</b><span class="sp"></span><span class="clock' + (ch.turn() === c && !over ? ' on' : '') + (t < 20000 ? ' low' : '') + '">' + fmt(t) + '</span>'; }
      $('#pt', v).innerHTML = row(opp); $('#pb', v).innerHTML = row(my);
      // المطالبة بالفوز عند انتهاء وقت الخصم
      if (!over && ch.turn() === opp && list().length >= 2 && remaining(opp) <= 0) claim('timeout', my);
    }
    var lastLen = -1;
    function render() {
      var mv = null, last = null;
      ch = new Chess();
      list().forEach(function (u) { mv = ch.move(Coach.parseUci(u)); last = { from: mv.from, to: mv.to }; });
      board.set(ch.fen(), last);
      var mk = {}; if (ch.isCheck()) mk.chk = [kingSq(ch, ch.turn())]; board.setMarks(mk);
      if (list().length !== lastLen && lastLen >= 0 && mv) A.soundFor(mv, ch);
      lastLen = list().length;
      var h = '', c2 = new Chess();
      list().forEach(function (u, i) { var r = c2.move(Coach.parseUci(u)); if (r.color === 'w') h += '<span class="mn">' + Math.ceil((i + 1) / 2) + '.</span>'; h += '<span class="mv' + (i === list().length - 1 ? ' cur' : '') + '">' + Coach.sanHtml(r.san, r.color) + '</span>'; });
      var ml = $('#ml', v); ml.innerHTML = h; ml.scrollTop = ml.scrollHeight;
    }
    function claim(status, winner) {
      gref.transaction(function (x) { if (!x || x.status !== 'started') return; x.status = status; x.winner = winner || null; return x; });
    }
    var STATUS = { mate: 'كش مات', resign: 'استسلام', stalemate: 'إغلاق', timeout: 'انتهاء الوقت', draw: 'تعادل بالاتفاق', drawn: 'تعادل', aborted: 'أُلغيت المباراة' };

    function finish() {
      if (over) return; over = true; bars();
      var res = g.status === 'aborted' ? 'aborted' : !g.winner ? 'draw' : g.winner === my ? 'win' : 'loss';
      A.sfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'drawn');
      if (res === 'win') A.confetti();
      if (res !== 'aborted') {
        // تحديث تصنيفي مرة واحدة فقط لكل مباراة
        var oppR = my === 'w' ? g.br : g.wr, myR = my === 'w' ? g.wr : g.br;
        var score = res === 'win' ? 1 : res === 'draw' ? .5 : 0;
        var exp = 1 / (1 + Math.pow(10, (oppR - myR) / 400));
        var delta = Math.round(32 * (score - exp));
        ref('users/' + me).transaction(function (u) {
          if (!u) return u;
          u.done = u.done || {};
          if (u.done[gid]) return;
          u.done[gid] = true;
          u.rating = (u.rating || 1200) + delta; u.played = (u.played || 0) + 1;
          if (res === 'win') u.wins = (u.wins || 0) + 1; else if (res === 'loss') u.losses = (u.losses || 0) + 1; else u.draws = (u.draws || 0) + 1;
          return u;
        });
        S.games.played++; if (res === 'win') S.games.won++; else if (res === 'loss') S.games.lost++; else S.games.drawn++; A.save();
        A.addXp(res === 'win' ? 30 : 15, 'مباراة أونلاين');
        var t0 = { win: ['🏆', 'فزت!'], loss: ['💪', 'خسرت هذه المرة'], draw: ['🤝', 'تعادل'] }[res];
        showEnd(t0, (STATUS[g.status] || '') + ' · التصنيف ' + (delta >= 0 ? '+' : '') + delta);
      } else showEnd(['⏹️', 'أُلغيت المباراة'], '');
    }
    function showEnd(t, sub) {
      msg(t[1] + ' — ' + sub);
      var m = A.modal('<div class="big-emoji">' + t[0] + '</div><h2 class="center">' + t[1] + '</h2><p class="center mut">' + sub + '</p>' +
        (list().length > 1 ? '<button class="btn pri block" id="anl">🔬 حلّل المباراة مع المدرب</button>' : '') + '<button class="btn block" style="margin-top:8px" id="nw">مباراة جديدة</button>');
      if ($('#anl', m)) $('#anl', m).onclick = function () { m.close(); A.go('analysis', { moves: list(), orient: my }); };
      $('#nw', m).onclick = function () { m.close(); A.go('online', {}, true); };
    }

    var listener = function (s) {
      g = s.val();
      if (!g) { msg('المباراة غير موجودة.'); return; }
      if (!my) { my = g.w === me ? 'w' : 'b'; board.setOrientation(my); A.sfx('start'); }
      render(); bars();
      if (g.status !== 'started') { finish(); return; }
      var opp = my === 'w' ? 'b' : 'w';
      if (g.drawOffer === opp) {
        msg('🤝 خصمك يعرض التعادل.<div class="chips"><button class="btn sm pri" id="dy">قبول</button><button class="btn sm" id="dn">رفض</button></div>');
        $('#dy', v).onclick = function () { claim('draw', null); };
        $('#dn', v).onclick = function () { gref.child('drawOffer').remove(); };
      } else msg(ch.turn() === my ? '<b>دورك</b>' + (list().length < 2 ? ' <small class="mut">(الوقت يبدأ بعد أول نقلتين)</small>' : '') : '<span class="mut">ينتظر نقلة الخصم...</span>');
    };
    gref.on('value', listener);

    board.o.movable = function () { return !over && g && ch.turn() === my ? my : null; };
    board.o.dests = chessDests({ moves: function (o) { return ch.moves(o); } });
    board.o.onMove = function (from, to, pr) {
      var c = new Chess(ch.fen()), mv;
      try { mv = c.move({ from: from, to: to, promotion: pr || 'q' }); } catch (e) { return false; }
      var u = mv.from + mv.to + (mv.promotion || '');
      board.set(c.fen(), { from: from, to: to }); A.soundFor(mv, c); lastLen = list().length + 1;
      gref.transaction(function (x) {
        if (!x || x.status !== 'started') return;
        var cc = new Chess(), ms = x.moves ? x.moves.split(' ') : [];
        ms.forEach(function (m) { cc.move(Coach.parseUci(m)); });
        if (cc.turn() !== my) return;
        try { cc.move(Coach.parseUci(u)); } catch (e) { return; }
        var t = now(), key = my === 'w' ? 'wtime' : 'btime';
        if (ms.length >= 2) {
          x[key] -= t - x.lastTs;
          if (x[key] <= 0) { x[key] = 0; x.status = 'timeout'; x.winner = my === 'w' ? 'b' : 'w'; return x; }
          x[key] += (x.tc.i || 0) * 1000;
        }
        ms.push(u); x.moves = ms.join(' '); x.lastTs = t; x.drawOffer = null;
        if (cc.isCheckmate()) { x.status = 'mate'; x.winner = my; }
        else if (cc.isStalemate()) x.status = 'stalemate';
        else if (cc.isDraw()) x.status = 'drawn';
        return x;
      }).then(function (r) { if (!r.committed) { A.toast('لم تُقبل النقلة'); render(); } }).catch(function () { A.toast('لا يوجد اتصال'); render(); });
      return true;
    };
    $('#flp', bar).onclick = function () { board.setOrientation(board.orient === 'w' ? 'b' : 'w'); };
    $('#drw', bar).onclick = function () { if (over || !g) return; gref.child('drawOffer').set(my); A.toast('أرسلت عرض التعادل'); };
    $('#res', bar).onclick = function () {
      if (over || !g) return;
      var abort = list().length < 2;
      var m = A.modal('<h2>' + (abort ? 'إلغاء المباراة؟' : 'الاستسلام؟') + '</h2><div class="row"><button class="btn bad" id="y">' + (abort ? 'إلغاء' : 'استسلم') + '</button><button class="btn" data-close>رجوع</button></div>');
      $('#y', m).onclick = function () { m.close(); if (abort) claim('aborted', null); else claim('resign', my === 'w' ? 'b' : 'w'); };
    };
    tick = setInterval(bars, 250);
    return { title: 'مباراة أونلاين', cleanup: function () { gref.off('value', listener); clearInterval(tick); } };
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

  initNet();
  self.Net = Net;
})();
