/* غلاف محرك Stockfish — تحليل متعدد الخطوط + لاعب بمستويات */
(function () {
  'use strict';

  function UciEngine(name) {
    this.name = name;
    this.ready = false;
    this.failed = false;
    this.queue = [];
    this.current = null;
    this.readyWaiters = [];
    try {
      this.w = new Worker('vendor/stockfish-18-lite-single.js');
    } catch (e) {
      this.failed = true;
      return;
    }
    var self = this;
    this.w.onmessage = function (e) { self._line(String(e.data || '')); };
    this.w.onerror = function () { self.failed = true; self._flushFail(); };
    this.send('uci');
    this.send('setoption name Hash value 16');
    this.send('isready');
    this.timeout = setTimeout(function () { if (!self.ready) { self.failed = true; self._flushFail(); } }, 20000);
  }

  UciEngine.prototype.send = function (c) { if (this.w) this.w.postMessage(c); };

  UciEngine.prototype._flushFail = function () {
    this.readyWaiters.forEach(function (f) { f(false); });
    this.readyWaiters = [];
    if (this.current) { this.current.reject(new Error('engine-failed')); this.current = null; }
    this.queue.forEach(function (j) { j.reject(new Error('engine-failed')); });
    this.queue = [];
  };

  UciEngine.prototype.whenReady = function () {
    var self = this;
    if (this.ready) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    return new Promise(function (r) { self.readyWaiters.push(r); });
  };

  UciEngine.prototype._line = function (l) {
    if (l === 'readyok') {
      if (!this.ready) {
        this.ready = true;
        clearTimeout(this.timeout);
        this.readyWaiters.forEach(function (f) { f(true); });
        this.readyWaiters = [];
        this._next();
      }
      return;
    }
    var job = this.current;
    if (!job) return;
    if (l.indexOf('info') === 0 && l.indexOf(' pv ') > 0) {
      var info = parseInfo(l);
      if (info) {
        job.lines[info.multipv - 1] = info;
        if (job.onInfo && info.multipv === 1) job.onInfo(info);
      }
    } else if (l.indexOf('bestmove') === 0) {
      var best = l.split(' ')[1];
      this.current = null;
      var lines = job.lines.filter(Boolean);
      if (job.cancelled) job.reject(new Error('cancelled'));
      else job.resolve({ best: best && best !== '(none)' ? best : null, lines: lines, fen: job.fen });
      this._next();
    }
  };

  function parseInfo(l) {
    var t = l.split(' ');
    var o = { multipv: 1, depth: 0, score: null, pv: [] };
    for (var i = 1; i < t.length; i++) {
      var k = t[i];
      if (k === 'multipv') o.multipv = +t[++i];
      else if (k === 'depth') o.depth = +t[++i];
      else if (k === 'score') {
        var kind = t[++i], v = +t[++i];
        o.score = kind === 'mate' ? { mate: v } : { cp: v };
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') { o.bound = true; i++; }
      } else if (k === 'pv') { o.pv = t.slice(i + 1); break; }
    }
    if (!o.score || !o.pv.length) return null;
    return o;
  }

  UciEngine.prototype._next = function () {
    if (!this.ready || this.current || !this.queue.length) return;
    var job = this.queue.shift();
    this.current = job;
    job.lines = [];
    job.setup.forEach(this.send, this);
    this.send('position fen ' + job.fen);
    this.send(job.go);
  };

  /* يلغي كل الطلبات السابقة وينفّذ الجديد */
  UciEngine.prototype.run = function (fen, go, setup, onInfo) {
    var self = this;
    if (this.failed) return Promise.reject(new Error('engine-failed'));
    this.queue.forEach(function (j) { j.reject(new Error('cancelled')); });
    this.queue = [];
    if (this.current && !this.current.cancelled) { this.current.cancelled = true; this.send('stop'); }
    return new Promise(function (resolve, reject) {
      self.queue.push({ fen: fen, go: go, setup: setup || [], onInfo: onInfo, resolve: resolve, reject: reject });
      self._next();
    });
  };

  UciEngine.prototype.stop = function () {
    this.queue.forEach(function (j) { j.reject(new Error('cancelled')); });
    this.queue = [];
    if (this.current) { this.current.cancelled = true; this.send('stop'); }
  };

  var analyst = null, player = null;

  function getAnalyst() { if (!analyst) analyst = new UciEngine('analyst'); return analyst; }
  function getPlayer() { if (!player) player = new UciEngine('player'); return player; }

  /* مستويات اللعب: من المبتدئ إلى الأسطورة */
  var LEVELS = [
    { name: 'برعم', elo: 400, skill: 0, depth: 1, random: 0.45 },
    { name: 'مبتدئ', elo: 700, skill: 1, depth: 2, random: 0.25 },
    { name: 'هاوٍ', elo: 1000, skill: 3, depth: 4, random: 0.1 },
    { name: 'لاعب نادي', elo: 1300, skill: 6, depth: 6, random: 0 },
    { name: 'متقدّم', elo: 1600, skill: 9, depth: 8, random: 0 },
    { name: 'خبير', elo: 1900, skill: 12, depth: 10, random: 0 },
    { name: 'أستاذ', elo: 2200, skill: 15, depth: 12, random: 0 },
    { name: 'أستاذ دولي', elo: 2500, skill: 18, depth: 14, random: 0 },
    { name: 'الأسطورة', elo: 3000, skill: 20, depth: 18, random: 0 }
  ];

  var Engine = {
    LEVELS: LEVELS,
    available: function () { return getAnalyst().whenReady(); },
    /* تحليل: يعيد أفضل الخطوط */
    analyse: function (fen, opts) {
      opts = opts || {};
      var go = opts.movetime ? 'go movetime ' + opts.movetime : 'go depth ' + (opts.depth || 14);
      var setup = ['setoption name MultiPV value ' + (opts.multipv || 1)];
      if (opts.searchmoves) go += ' searchmoves ' + opts.searchmoves.join(' ');
      var e = getAnalyst();
      return e.whenReady().then(function (ok) {
        if (!ok) return Fallback.analyse(fen, opts);
        return e.run(fen, go, setup, opts.onInfo);
      });
    },
    /* نقلة الخصم حسب المستوى */
    play: function (fen, level) {
      var L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
      var e = getPlayer();
      return e.whenReady().then(function (ok) {
        if (!ok) return Fallback.analyse(fen, { depth: Math.min(3, L.depth) }).then(function (r) { return r.best; });
        var setup = ['setoption name MultiPV value 1', 'setoption name Skill Level value ' + L.skill];
        return e.run(fen, 'go depth ' + L.depth + ' movetime 1500', setup).then(function (r) {
          if (L.random && Math.random() < L.random) {
            var c = new ChessJS.Chess(fen);
            var ms = c.moves({ verbose: true });
            // عشوائية "بشرية": تفضيل الأسر والنقلات غير الخاسرة بوضوح
            var caps = ms.filter(function (m) { return m.captured; });
            var pool = caps.length && Math.random() < 0.6 ? caps : ms;
            var m = pool[Math.floor(Math.random() * pool.length)];
            return m.from + m.to + (m.promotion || '');
          }
          return r.best;
        });
      });
    },
    /* اللعب بأسلوب: هجومي، موضعي، دفاعي، أو متوازن */
    playStyle: function (fen, level, style) {
      if (!style || style === 'balanced' || level < 3) return Engine.play(fen, level);
      var L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
      var e = getPlayer();
      return e.whenReady().then(function (ok) {
        if (!ok) return Engine.play(fen, level);
        var setup = ['setoption name MultiPV value 4', 'setoption name Skill Level value 20'];
        return e.run(fen, 'go depth ' + L.depth + ' movetime 1800', setup).then(function (r) {
          if (!r.lines.length) return r.best;
          var c = new ChessJS.Chess(fen), me = c.turn();
          var opK = c.findPiece({ type: 'k', color: me === 'w' ? 'b' : 'w' })[0], myK = c.findPiece({ type: 'k', color: me })[0];
          function sc(l) { return l.score.mate != null ? (l.score.mate > 0 ? 100000 - l.score.mate : -100000 - l.score.mate) : l.score.cp; }
          var best = sc(r.lines[0]), margin = Math.max(18, 140 - level * 14);
          function dist(a, b) { return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(+a[1] - +b[1])); }
          var cands = r.lines.filter(function (l) { return best - sc(l) <= margin; });
          var pick = cands[0], top = -1e9;
          cands.forEach(function (l) {
            var u = l.pv[0], cc = new ChessJS.Chess(fen), mv;
            try { mv = cc.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (x) { return; }
            var v = 0;
            if (style === 'attack') { if (mv.captured) v += 3; if (cc.isCheck()) v += 4; v += (dist(mv.from, opK) - dist(mv.to, opK)) * 2; if (mv.piece === 'p' && Math.abs(mv.to.charCodeAt(0) - opK.charCodeAt(0)) <= 1) v += 1.5; }
            else if (style === 'positional') { if (!mv.captured && !cc.isCheck()) v += 2; var f = mv.to.charCodeAt(0) - 97, rk = +mv.to[1] - 1; v += 3 - (Math.abs(3.5 - f) + Math.abs(3.5 - rk)) / 2; if ((mv.piece === 'n' || mv.piece === 'b') && (mv.from[1] === '1' || mv.from[1] === '8')) v += 2; }
            else if (style === 'defense') { v += (dist(mv.from, myK) - dist(mv.to, myK)) * 1.5; if (mv.captured) v += 1; if (mv.flags.indexOf('k') >= 0 || mv.flags.indexOf('q') >= 0) v += 3; }
            v += (sc(l) - best) / 60;
            if (v > top) { top = v; pick = l; }
          });
          return pick.pv[0];
        });
      });
    },
    stop: function () { if (analyst) analyst.stop(); },
    stopPlayer: function () { if (player) player.stop(); }
  };

  /* محرك احتياطي بسيط (إذا تعذّر تشغيل WASM) */
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var Fallback = {
    evalBoard: function (c) {
      var s = 0, b = c.board();
      for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
        var p = b[r][f];
        if (!p) continue;
        var v = VAL[p.type];
        var center = (3.5 - Math.abs(3.5 - f)) + (3.5 - Math.abs(3.5 - r));
        if (p.type === 'n' || p.type === 'b') v += center * 4;
        if (p.type === 'p') v += (p.color === 'w' ? (6 - r) : (r - 1)) * 6 + (f > 1 && f < 6 ? 6 : 0);
        s += p.color === 'w' ? v : -v;
      }
      return c.turn() === 'w' ? s : -s;
    },
    search: function (c, d, a, b) {
      if (c.isCheckmate()) return -100000 - d;
      if (c.isDraw()) return 0;
      if (d === 0) return this.evalBoard(c);
      var ms = c.moves({ verbose: true });
      ms.sort(function (x, y) { return (y.captured ? VAL[y.captured] : 0) - (x.captured ? VAL[x.captured] : 0); });
      for (var i = 0; i < ms.length; i++) {
        c.move(ms[i]);
        var v = -this.search(c, d - 1, -b, -a);
        c.undo();
        if (v >= b) return b;
        if (v > a) a = v;
      }
      return a;
    },
    analyse: function (fen, opts) {
      var c = new ChessJS.Chess(fen);
      var ms = c.moves({ verbose: true });
      var d = Math.min(3, opts.depth || 3) - 1;
      var res = ms.map(function (m) {
        c.move(m);
        var v = -Fallback.search(c, Math.max(0, d), -1e9, 1e9);
        c.undo();
        return { move: m.from + m.to + (m.promotion || ''), v: v };
      });
      res.sort(function (x, y) { return y.v - x.v; });
      var lines = res.slice(0, opts.multipv || 1).map(function (x, i) {
        var sc = Math.abs(x.v) > 50000 ? { mate: x.v > 0 ? 1 : -1 } : { cp: x.v };
        return { multipv: i + 1, depth: d + 1, score: sc, pv: [x.move] };
      });
      return Promise.resolve({ best: res.length ? res[0].move : null, lines: lines, fen: fen, fallback: true });
    }
  };

  self.Engine = Engine;
})();
