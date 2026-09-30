/* مكوّن الرقعة التفاعلية: نقر، سحب، أسهم، تحريك سلس */
(function () {
  'use strict';
  var FILES = 'abcdefgh';

  function fenToMap(fen) {
    var map = {}, rows = fen.split(' ')[0].split('/');
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (/\d/.test(ch)) { f += +ch; continue; }
        var color = ch === ch.toUpperCase() ? 'w' : 'b';
        map[FILES[f] + (8 - r)] = color + ch.toLowerCase();
        f++;
      }
    }
    return map;
  }

  function Board(el, opts) {
    this.el = el;
    this.o = opts || {};
    this.orient = this.o.orientation || 'w';
    this.map = {};
    this.pieces = {}; // sq -> element
    this.sel = null;
    this.marks = {};
    this.arrowsList = [];
    this.build();
  }

  Board.fenToMap = fenToMap;

  Board.prototype.build = function () {
    var self = this;
    this.el.innerHTML = '<div class="board"><div class="sqs"></div><div class="pcs"></div><svg class="arr" viewBox="0 0 8 8"></svg><div class="fx"></div></div>';
    this.root = this.el.firstChild;
    this.sqEl = {};
    this.drawSquares();
    this.root.addEventListener('pointerdown', function (e) { self.down(e); });
    this.root.addEventListener('pointermove', function (e) { self.movePtr(e); });
    this.root.addEventListener('pointerup', function (e) { self.up(e); });
    this.root.addEventListener('pointercancel', function () { self.cancelDrag(); });
    this.root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  Board.prototype.drawSquares = function () {
    var sqs = this.root.querySelector('.sqs');
    sqs.innerHTML = '';
    this.sqEl = {};
    var coords = this.o.coords !== false;
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var f = this.orient === 'w' ? col : 7 - col;
        var r = this.orient === 'w' ? 7 - row : row;
        var s = FILES[f] + (r + 1);
        var d = document.createElement('div');
        d.className = 's ' + ((f + r) % 2 ? 'l' : 'd');
        if (coords) {
          if (row === 7) d.innerHTML += '<span class="co f">' + FILES[f] + '</span>';
          if (col === 0) d.innerHTML += '<span class="co r">' + (r + 1) + '</span>';
        }
        sqs.appendChild(d);
        this.sqEl[s] = d;
      }
    }
  };

  Board.prototype.xy = function (s) {
    var f = s.charCodeAt(0) - 97, r = +s[1] - 1;
    return this.orient === 'w' ? [f, 7 - r] : [7 - f, r];
  };

  Board.prototype.place = function (el, s) {
    var p = this.xy(s);
    el.style.transform = 'translate(' + (p[0] * 100) + '%,' + (p[1] * 100) + '%)';
  };

  Board.prototype.setOrientation = function (o) {
    if (o === this.orient) return;
    this.orient = o;
    this.drawSquares();
    for (var s in this.pieces) this.place(this.pieces[s], s);
    this.applyMarks();
    this.drawArrows();
  };

  /* position: FEN أو خريطة */
  Board.prototype.set = function (position, lastMove) {
    var map = typeof position === 'string' ? fenToMap(position) : position;
    var layer = this.root.querySelector('.pcs');
    var old = this.pieces, next = {};
    var free = [];
    for (var s in old) {
      if (map[s] === old[s].dataset.p) { next[s] = old[s]; }
      else free.push(s);
    }
    for (var t in map) {
      if (next[t]) continue;
      var idx = -1, best = 99;
      for (var i = 0; i < free.length; i++) {
        if (old[free[i]] && old[free[i]].dataset.p === map[t]) {
          var a = this.xy(free[i]), b = this.xy(t), dd = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
          if (dd < best) { best = dd; idx = i; }
        }
      }
      var el;
      if (idx >= 0) {
        el = old[free[idx]];
        free.splice(idx, 1);
      } else {
        el = document.createElement('i');
        el.className = 'pc fade ' + map[t];
        el.dataset.p = map[t];
        layer.appendChild(el);
      }
      this.place(el, t);
      next[t] = el;
    }
    free.forEach(function (s) { if (old[s] && next[s] !== old[s]) old[s].remove(); });
    this.pieces = next;
    this.map = map;
    this.last = lastMove || null;
    this.sel = null;
    this.applyMarks();
  };

  Board.prototype.setMarks = function (m) { this.marks = m || {}; this.applyMarks(); };
  Board.prototype.mark = function (cls, squares) { this.marks[cls] = squares; this.applyMarks(); };

  Board.prototype.applyMarks = function () {
    var self = this;
    for (var s in this.sqEl) {
      var d = this.sqEl[s];
      d.classList.remove('last', 'sel', 'hl', 'hint', 'chk', 'bad', 'good');
      var dots = d.querySelectorAll('.dot,.cap,.star');
      for (var i = 0; i < dots.length; i++) dots[i].remove();
    }
    if (this.last) [this.last.from, this.last.to].forEach(function (s) { if (self.sqEl[s]) self.sqEl[s].classList.add('last'); });
    for (var cls in this.marks) {
      (this.marks[cls] || []).forEach(function (s) {
        var d = self.sqEl[s]; if (!d) return;
        if (cls === 'star') { var st = document.createElement('i'); st.className = 'star'; d.appendChild(st); }
        else d.classList.add(cls);
      });
    }
    if (this.sel) {
      this.sqEl[this.sel] && this.sqEl[this.sel].classList.add('sel');
      (this.dests || []).forEach(function (t) {
        var d = self.sqEl[t]; if (!d) return;
        var x = document.createElement('i');
        x.className = self.map[t] ? 'cap' : 'dot';
        d.appendChild(x);
      });
    }
  };

  Board.prototype.arrows = function (list) { this.arrowsList = list || []; this.drawArrows(); };

  Board.prototype.drawArrows = function () {
    var svg = this.root.querySelector('svg.arr'), self = this;
    var html = '<defs>';
    var colors = { g: '#3dffa8', b: '#38f5ff', r: '#ff5470', y: '#ffc14d', v: '#b98bff' };
    Object.keys(colors).forEach(function (k) {
      html += '<marker id="ah' + k + '" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="' + colors[k] + '"/></marker>';
    });
    html += '</defs>';
    this.arrowsList.forEach(function (a) {
      var c = a.c || 'g';
      var p1 = self.xy(a.from), p2 = self.xy(a.to);
      var x1 = p1[0] + .5, y1 = p1[1] + .5, x2 = p2[0] + .5, y2 = p2[1] + .5;
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
      var ex = x2 - dx / len * .35, ey = y2 - dy / len * .35;
      var sx = x1 + dx / len * .2, sy = y1 + dy / len * .2;
      html += '<line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey + '" stroke="' + colors[c] + '" stroke-width="' + (a.w || .17) + '" stroke-linecap="round" opacity="' + (a.o || .85) + '" marker-end="url(#ah' + c + ')" style="filter:drop-shadow(0 0 .08px ' + colors[c] + ')"/>';
    });
    svg.innerHTML = html;
  };

  Board.prototype.burst = function (s, color) {
    var fx = this.root.querySelector('.fx');
    var d = document.createElement('i');
    d.className = 'burst';
    var p = this.xy(s);
    d.style.left = (p[0] * 12.5) + '%';
    d.style.top = (p[1] * 12.5) + '%';
    if (color) d.style.boxShadow = '0 0 0 3px ' + color + ',0 0 20px ' + color;
    fx.appendChild(d);
    setTimeout(function () { d.remove(); }, 700);
  };

  Board.prototype.sqAt = function (e) {
    var r = this.root.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    var f = this.orient === 'w' ? x : 7 - x, rk = this.orient === 'w' ? 7 - y : y;
    return FILES[f] + (rk + 1);
  };

  Board.prototype.canMove = function (s) {
    var p = this.map[s];
    if (!p || !this.o.movable) return false;
    var m = this.o.movable();
    return m === 'both' || m === p[0];
  };

  Board.prototype.select = function (s) {
    this.sel = s;
    this.dests = s && this.o.dests ? this.o.dests(s) : [];
    this.applyMarks();
  };

  Board.prototype.down = function (e) {
    if (this.lock) return;
    var s = this.sqAt(e);
    if (!s) return;
    if (this.o.onSquare) this.o.onSquare(s);
    if (this.sel && this.sel !== s && (this.dests || []).indexOf(s) >= 0) {
      this.tryMove(this.sel, s);
      return;
    }
    if (this.canMove(s)) {
      if (this.sel === s) { this.pendingDeselect = true; }
      else { this.pendingDeselect = false; this.select(s); }
      var el = this.pieces[s];
      if (el) {
        this.drag = { s: s, el: el, x0: e.clientX, y0: e.clientY, moved: false, rect: this.root.getBoundingClientRect() };
        try { this.root.setPointerCapture(e.pointerId); } catch (err) {}
      }
    } else {
      if (this.sel) this.select(null);
    }
  };

  Board.prototype.movePtr = function (e) {
    var d = this.drag; if (!d) return;
    var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    d.moved = true;
    d.el.classList.add('drag');
    var r = d.rect, sz = r.width / 8;
    var px = e.clientX - r.left - sz / 2, py = e.clientY - r.top - sz / 2 - (e.pointerType === 'touch' ? sz * .35 : 0);
    d.el.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) scale(1.15)';
  };

  Board.prototype.up = function (e) {
    var d = this.drag; this.drag = null;
    if (!d) return;
    d.el.classList.remove('drag');
    if (d.moved) {
      var t = this.sqAt(e);
      if (t && t !== d.s && (this.dests || []).indexOf(t) >= 0) {
        this.place(d.el, d.s);
        d.el.style.transition = 'none';
        var p = this.xy(t);
        d.el.style.transform = 'translate(' + (p[0] * 100) + '%,' + (p[1] * 100) + '%)';
        var el = d.el;
        requestAnimationFrame(function () { el.style.transition = ''; });
        this.tryMove(d.s, t, true);
      } else {
        this.place(d.el, d.s);
      }
    } else if (this.pendingDeselect) {
      this.select(null);
    }
  };

  Board.prototype.cancelDrag = function () {
    if (this.drag) { this.drag.el.classList.remove('drag'); this.place(this.drag.el, this.drag.s); this.drag = null; }
  };

  Board.prototype.tryMove = function (from, to) {
    var self = this;
    var p = this.map[from];
    this.select(null);
    var promoRank = p && p[1] === 'p' && ((p[0] === 'w' && to[1] === '8') || (p[0] === 'b' && to[1] === '1'));
    if (promoRank && this.o.promotion !== false) {
      this.askPromotion(p[0], function (pr) {
        if (!pr) { self.set(self.map, self.last); return; }
        self.o.onMove && self.o.onMove(from, to, pr);
      });
      return;
    }
    if (this.o.onMove) {
      var ok = this.o.onMove(from, to);
      if (ok === false) this.set(this.map, this.last);
    }
  };

  Board.prototype.askPromotion = function (color, cb) {
    var ov = document.createElement('div');
    ov.className = 'promo';
    ['q', 'r', 'b', 'n'].forEach(function (t) {
      var b = document.createElement('i');
      b.className = 'pc ' + color + t;
      b.onclick = function (e) { e.stopPropagation(); ov.remove(); cb(t); };
      ov.appendChild(b);
    });
    ov.addEventListener('pointerdown', function (e) { e.stopPropagation(); if (e.target === ov) { ov.remove(); cb(null); } });
    this.root.appendChild(ov);
  };

  /* نقلة خاطئة: تظهر القطعة على المربع بعلامة ✕ ثم تعود لمكانها */
  Board.prototype.snapBack = function (position, badSq, prevLast, cb) {
    var self = this;
    this.lock = true;
    this.mark('bad', [badSq]);
    setTimeout(function () {
      self.marks = {};
      self.set(position, prevLast || null);
      self.lock = false;
      if (cb) cb();
    }, 420);
  };

  self.Board = Board;
})();
