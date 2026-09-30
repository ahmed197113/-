/* المدرّب الذكي: يشرح النقلات بالعربية ويكتشف الأفكار التكتيكية */
(function () {
  'use strict';
  var Chess = ChessJS.Chess;
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  var NAME = { p: 'البيدق', n: 'الحصان', b: 'الفيل', r: 'الرخ', q: 'الوزير', k: 'الملك' };
  var NAME_INDEF = { p: 'بيدق', n: 'حصان', b: 'فيل', r: 'رخ', q: 'وزير', k: 'ملك' };
  var SIDE = { w: 'الأبيض', b: 'الأسود' };
  var FILES = 'abcdefgh';

  function sq(f, r) { return FILES[f] + (r + 1); }
  function fr(s) { return [s.charCodeAt(0) - 97, +s[1] - 1]; }
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function S(s) { return '<b class="sq">' + s + '</b>'; }

  /* المربعات التي تهاجمها قطعة موجودة على مربع (بحسب الرقعة) */
  function attacksFrom(c, s) {
    var p = c.get(s); if (!p) return [];
    var xy = fr(s), f = xy[0], r = xy[1], out = [];
    function add(ff, rr) { if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) out.push(sq(ff, rr)); }
    function ray(df, dr) {
      var ff = f + df, rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        var t = sq(ff, rr); out.push(t);
        if (c.get(t)) break;
        ff += df; rr += dr;
      }
    }
    switch (p.type) {
      case 'p': var d = p.color === 'w' ? 1 : -1; add(f - 1, r + d); add(f + 1, r + d); break;
      case 'n': [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(function (v) { add(f + v[0], r + v[1]); }); break;
      case 'k': for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (a || b) add(f + a, r + b); break;
      default:
        if (p.type !== 'r') [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (v) { ray(v[0], v[1]); });
        if (p.type !== 'b') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) { ray(v[0], v[1]); });
    }
    return out;
  }

  function minAttackerValue(c, s, color) {
    var a = c.attackers(s, color), m = 1000;
    a.forEach(function (x) { var p = c.get(x); if (p && VAL[p.type] < m) m = VAL[p.type]; });
    return a.length ? m : 0;
  }

  /* هل القطعة معلّقة (يمكن أسرها بربح)؟ */
  function isHanging(c, s) {
    var p = c.get(s); if (!p || p.type === 'k') return false;
    var enemy = other(p.color);
    var att = c.attackers(s, enemy);
    if (!att.length) return false;
    var def = c.attackers(s, p.color);
    if (!def.length) return true;
    return minAttackerValue(c, s, enemy) < VAL[p.type];
  }

  function kingSq(c, color) {
    var k = c.findPiece({ type: 'k', color: color });
    return k && k[0];
  }

  /* خطوط التثبيت والسيخ من قطعة منزلقة */
  function lineTactics(c, s) {
    var p = c.get(s); if (!p || 'brq'.indexOf(p.type) < 0) return [];
    var xy = fr(s), res = [];
    var dirs = [];
    if (p.type !== 'r') dirs = dirs.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    if (p.type !== 'b') dirs = dirs.concat([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    dirs.forEach(function (d) {
      var ff = xy[0] + d[0], rr = xy[1] + d[1], hits = [];
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && hits.length < 2) {
        var t = sq(ff, rr), q = c.get(t);
        if (q) { hits.push({ s: t, p: q }); }
        ff += d[0]; rr += d[1];
      }
      if (hits.length === 2 && hits[0].p.color !== p.color && hits[1].p.color !== p.color) {
        var A = hits[0], B = hits[1];
        if (A.p.type === 'p' && B.p.type !== 'k') return;
        if (B.p.type === 'k') res.push({ kind: 'pin-abs', front: A, back: B });
        else if (VAL[B.p.type] > VAL[A.p.type] && VAL[B.p.type] > VAL[p.type]) res.push({ kind: 'pin', front: A, back: B });
        else if (VAL[A.p.type] > VAL[B.p.type] && (A.p.type === 'k' || VAL[A.p.type] > VAL[p.type]) && (B.p.type !== 'p')) res.push({ kind: 'skewer', front: A, back: B });
      }
    });
    return res;
  }

  function isPassed(c, s, color) {
    var xy = fr(s), dir = color === 'w' ? 1 : -1;
    for (var df = -1; df <= 1; df++) {
      var f = xy[0] + df; if (f < 0 || f > 7) continue;
      for (var r = xy[1] + dir; r >= 0 && r < 8; r += dir) {
        var q = c.get(sq(f, r));
        if (q && q.type === 'p' && q.color !== color) return false;
      }
    }
    return true;
  }

  function fileState(c, f, color) {
    var own = false, opp = false;
    for (var r = 0; r < 8; r++) {
      var q = c.get(sq(f, r));
      if (q && q.type === 'p') { if (q.color === color) own = true; else opp = true; }
    }
    return own ? 'closed' : (opp ? 'semi' : 'open');
  }

  function parseUci(u) { return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }; }

  function material(c) {
    var s = { w: 0, b: 0 };
    c.board().forEach(function (row) { row.forEach(function (p) { if (p && p.type !== 'k') s[p.color] += VAL[p.type]; }); });
    return s;
  }

  /* ===== وصف نقلة واحدة بالعربية ===== */
  function describeMove(fen, uci) {
    var c = new Chess(fen);
    var mv;
    try { mv = c.move(parseUci(uci)); } catch (e) { return null; }
    var before = new Chess(fen);
    var me = mv.color, op = other(me);
    var tags = [], txt = [];
    var pn = NAME[mv.piece];
    var moveNo = +fen.split(' ')[5] || 1;

    function T(tag, text, weight) { tags.push(tag); txt.push({ tag: tag, t: text, w: weight || 1 }); }

    if (c.isCheckmate()) {
      T('mate', 'كش مات! ' + pn + ' ينهي المباراة، ولا يملك ملك ' + SIDE[op] + ' أي مربع هروب ولا يمكن صد الهجوم أو أسر القطعة المهاجِمة.', 10);
      return finish();
    }
    if (mv.flags.indexOf('k') >= 0 || mv.flags.indexOf('q') >= 0) {
      T('castle', 'تبييت الملك: ينقل الملك إلى مكان آمن خلف البيادق ويُدخل الرخ إلى اللعب في خطوة واحدة.', 4);
    }
    if (mv.promotion) {
      T('promo', 'ترقية! يصل البيدق إلى الصف الأخير ويتحوّل إلى ' + NAME[mv.promotion] + '.', 8);
    }

    // الأسر وتقييمه
    if (mv.captured) {
      var capV = VAL[mv.captured], myV = VAL[mv.piece];
      var recapt = c.attackers(mv.to, op).length > 0;
      if (!recapt) T('win', 'يأسر ' + NAME[mv.captured] + ' مجانًا، فلا يمكن للخصم استعادة المادة.', 6 + capV);
      else if (capV > myV) T('win', 'يأسر ' + NAME[mv.captured] + ' (قيمته ' + capV + ') بقطعة أقل قيمة (' + myV + ')، فحتى لو استرد الخصم يبقى الربح المادي.', 5 + capV - myV);
      else if (capV === myV) T('trade', 'تبادل متكافئ للقطع (' + NAME[mv.captured] + ' مقابل ' + pn + ').', 2);
      else T('capture', 'يأسر ' + NAME[mv.captured] + '.', 2);
    }

    // الكش أنواعه
    if (c.isCheck()) {
      var ks = kingSq(c, op);
      var checkers = c.attackers(ks, me);
      if (checkers.length > 1) T('dcheck', 'كش مزدوج! قطعتان تهاجمان الملك معًا، والطريقة الوحيدة للنجاة هي تحريك الملك.', 7);
      else if (checkers[0] !== mv.to) T('discheck', 'كش مكشوف: تتحرك القطعة فتفتح الطريق لـ' + NAME[c.get(checkers[0]).type] + ' ليعطي كش.', 6);
      else T('check', 'كش للملك يجبر الخصم على الرد فورًا.', 3);
    }

    // الشوكة
    var targets = attacksFrom(c, mv.to).filter(function (t) {
      var q = c.get(t); if (!q || q.color !== op) return false;
      if (q.type === 'k') return true;
      if (q.type === 'p') return false;
      return VAL[q.type] > VAL[mv.piece] || c.attackers(t, op).length === 0;
    });
    var moverSafe = !isHanging(c, mv.to);
    if (targets.length >= 2 && moverSafe) {
      var names = targets.map(function (t) { return NAME[c.get(t).type] + ' على ' + S(t); });
      T('fork', 'شوكة! ' + pn + ' يهاجم ' + names.join(' و') + ' في وقت واحد، ولن يستطيع الخصم إنقاذ الجميع.', 7);
    } else if (targets.length === 1 && !c.isCheck() && moverSafe && !mv.captured) {
      var tq = c.get(targets[0]);
      T('threat', 'يهاجم ' + NAME[tq.type] + ' على ' + S(targets[0]) + (c.attackers(targets[0], op).length ? ' وهو أغلى من القطعة المهاجِمة.' : ' غير المحمي.'), 3);
    }

    // تثبيت وسيخ من القطعة المتحركة
    lineTactics(c, mv.to).forEach(function (lt) {
      if (lt.kind === 'pin-abs') T('pin', 'تثبيت مطلق (مسمار): ' + NAME[lt.front.p.type] + ' على ' + S(lt.front.s) + ' لا يستطيع الحركة لأن الملك خلفه مباشرة.', 5);
      else if (lt.kind === 'pin') T('pin', 'تثبيت: ' + NAME[lt.front.p.type] + ' على ' + S(lt.front.s) + ' إذا تحرك سيُكشف ' + NAME[lt.back.p.type] + ' الأغلى خلفه.', 4);
      else T('skewer', 'سيخ: يهاجم ' + NAME[lt.front.p.type] + ' على ' + S(lt.front.s) + '، وعندما يبتعد ستُؤسر القطعة التي خلفه (' + NAME[lt.back.p.type] + ').', 6);
    });

    // الهجوم المكشوف (غير الكش)
    if (!c.isCheck()) {
      var disc = [];
      c.board().forEach(function (row) {
        row.forEach(function (q) {
          if (!q || q.color !== me || 'brq'.indexOf(q.type) < 0 || q.square === mv.to) return;
          var after = attacksFrom(c, q.square), bef = attacksFrom(before, q.square);
          after.forEach(function (t) {
            if (bef.indexOf(t) >= 0) return;
            var x = c.get(t);
            if (x && x.color === op && x.type !== 'p' && (VAL[x.type] > VAL[q.type] || !c.attackers(t, op).length)) disc.push({ by: q, t: t, x: x });
          });
        });
      });
      if (disc.length) T('discovered', 'هجوم مكشوف: بتحريك ' + pn + ' ينفتح خط ' + NAME[disc[0].by.type] + ' ليهاجم ' + NAME[disc[0].x.type] + ' على ' + S(disc[0].t) + '.', 5);
    }

    // إنقاذ قطعة مهددة
    if (before.get(mv.from) && isHanging(before, mv.from) && !isHanging(c, mv.to) && !mv.captured) {
      T('escape', 'ينقذ ' + pn + ' الذي كان مهددًا بالأسر وينقله إلى مربع آمن.', 3);
    }

    // حماية قطعة معلّقة
    var protectedOne = null;
    attacksFrom(c, mv.to).forEach(function (t) {
      var q = c.get(t);
      if (q && q.color === me && q.type !== 'k' && isHanging(before, t) && !isHanging(c, t)) protectedOne = { t: t, q: q };
    });
    if (protectedOne) T('defend', 'يحمي ' + NAME[protectedOne.q.type] + ' على ' + S(protectedOne.t) + ' الذي كان مهددًا.', 3);

    // التضحية
    if (!mv.captured || VAL[mv.captured] < VAL[mv.piece]) {
      if (mv.piece !== 'p' && mv.piece !== 'k' && isHanging(c, mv.to) && !c.isCheckmate()) T('sac', 'تضحية: يضع ' + pn + ' في مربع يمكن أسره فيه، مقابل فكرة أكبر (هجوم أو مكسب لاحق).', 4);
    }

    // مبادئ استراتيجية
    var center = ['d4', 'e4', 'd5', 'e5'];
    if (mv.piece === 'p' && center.indexOf(mv.to) >= 0) T('center', 'يحتل مركز الرقعة: البيادق في المركز تمنح مساحة وتتحكم بمربعات مهمة.', 2);
    else if (mv.piece === 'n' || mv.piece === 'b') {
      var ctrl = attacksFrom(c, mv.to).filter(function (t) { return center.indexOf(t) >= 0; }).length;
      if (ctrl >= 2 && moveNo <= 15) T('center', 'يضغط على مربعات المركز (' + ctrl + ' مربعات مركزية).', 1.5);
    }
    var backRank = me === 'w' ? '1' : '8';
    if ((mv.piece === 'n' || mv.piece === 'b') && mv.from[1] === backRank && moveNo <= 14) T('develop', 'تطوير: يُخرج ' + pn + ' من الصف الأول ليشارك في اللعب — مبدأ ذهبي في الافتتاح.', 2);
    if (mv.piece === 'q' && moveNo <= 6 && !mv.captured && !c.isCheck()) T('earlyqueen', 'تنبيه: إخراج الوزير مبكرًا قد يعرّضه لهجمات تكسب للخصم الوقت.', -1);
    if (mv.piece === 'r') {
      var st = fileState(c, fr(mv.to)[0], me);
      if (st === 'open') T('openfile', 'يضع الرخ على عمود مفتوح (بلا بيادق) ليتحكم به ويخترق صفوف الخصم.', 2);
      else if (st === 'semi') T('openfile', 'يضع الرخ على عمود شبه مفتوح للضغط على بيدق الخصم.', 1.5);
      if ((me === 'w' && mv.to[1] === '7') || (me === 'b' && mv.to[1] === '2')) T('seventh', 'الرخ على الصف السابع — موقع قوي جدًا يهاجم البيادق ويحاصر الملك.', 3);
    }
    if (mv.piece === 'p' && !mv.promotion && isPassed(c, mv.to, me)) {
      var rk = +mv.to[1];
      if ((me === 'w' && rk >= 5) || (me === 'b' && rk <= 4)) T('passer', 'يدفع البيدق الحر نحو الترقية — البيدق الحر المتقدم خطر كبير على الخصم.', 3);
    }
    if (mv.piece === 'n' && ('ah'.indexOf(mv.to[0]) >= 0) && !mv.captured && !c.isCheck() && tags.indexOf('fork') < 0) T('rim', 'ملاحظة: "الحصان على الحافة ضعيف" — يتحكم بمربعات أقل.', -0.5);

    // تحذير: ترك القطعة معلّقة
    if (isHanging(c, mv.to) && tags.indexOf('sac') < 0 && !c.isCheck()) T('hang', 'تحذير: ' + pn + ' يصبح عرضة للأسر في ' + S(mv.to) + '.', -2);

    function finish() {
      var sorted = txt.slice().sort(function (a, b) { return b.w - a.w; });
      return { san: mv.san, move: mv, tags: tags, items: sorted, lines: sorted.map(function (x) { return x.t; }), fenAfter: c.fen() };
    }
    return finish();
  }

  /* ===== أدوات النص ===== */
  function moveToArabic(fen, uci) {
    var c = new Chess(fen), mv;
    try { mv = c.move(parseUci(uci)); } catch (e) { return uci; }
    if (mv.flags.indexOf('k') >= 0) return 'تبييت قصير';
    if (mv.flags.indexOf('q') >= 0) return 'تبييت طويل';
    var s = NAME[mv.piece] + (mv.captured ? ' يأسر في ' : ' إلى ') + mv.to;
    if (mv.promotion) s += ' ويترقى إلى ' + NAME[mv.promotion];
    if (c.isCheckmate()) s += ' كش مات';
    else if (c.isCheck()) s += ' كش';
    return s;
  }

  var FIG = { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' };
  function sanHtml(san, color) {
    var m = san.match(/^([KQRBN])(.*)$/);
    if (m) return '<bdi class="san"><i class="pc fig ' + color + FIG[m[1]] + '"></i>' + m[2] + '</bdi>';
    if (san === 'O-O' || san === 'O-O-O' || /^O-O/.test(san)) return '<bdi class="san">' + san + '</bdi>';
    return '<bdi class="san">' + san + '</bdi>';
  }

  function pvToHtml(fen, pv, max) {
    var c = new Chess(fen), out = [];
    var n = +fen.split(' ')[5] || 1;
    for (var i = 0; i < Math.min(pv.length, max || 8); i++) {
      var col = c.turn(), mv;
      try { mv = c.move(parseUci(pv[i])); } catch (e) { break; }
      var num = '';
      if (col === 'w') num = n + '. ';
      else if (i === 0) num = n + '... ';
      out.push('<span class="pvm">' + num + sanHtml(mv.san, col) + '</span>');
      if (col === 'b') n++;
    }
    return out.join(' ');
  }

  function uciToSan(fen, uci) {
    var c = new Chess(fen);
    try { return c.move(parseUci(uci)).san; } catch (e) { return uci; }
  }

  /* نسبة الفوز من تقييم (منظور صاحب النقلة) */
  function winPct(score) {
    if (!score) return 50;
    if (score.mate != null) return score.mate > 0 ? 100 : 0;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * score.cp)) - 1);
  }
  function negate(s) { return s.mate != null ? { mate: -s.mate } : { cp: -s.cp }; }
  function toWhite(score, turn) { return turn === 'w' ? score : negate(score); }

  function scoreText(scoreW) {
    if (!scoreW) return '—';
    if (scoreW.mate != null) {
      if (scoreW.mate === 0) return 'مات';
      return (scoreW.mate > 0 ? '+' : '-') + 'M' + Math.abs(scoreW.mate);
    }
    var v = scoreW.cp / 100;
    return (v > 0 ? '+' : '') + v.toFixed(1);
  }

  function scoreSentence(scoreW) {
    if (!scoreW) return '';
    if (scoreW.mate != null) {
      var side = scoreW.mate > 0 ? 'الأبيض' : 'الأسود';
      return side + ' يفرض كش مات خلال ' + Math.abs(scoreW.mate) + ' ' + (Math.abs(scoreW.mate) === 1 ? 'نقلة' : 'نقلات') + ' مهما دافع الخصم.';
    }
    var cp = scoreW.cp, a = Math.abs(cp) / 100, side2 = cp > 0 ? 'الأبيض' : 'الأسود';
    if (a < 0.3) return 'الموقف متعادل تقريبًا.';
    if (a < 0.9) return 'أفضلية بسيطة لـ' + side2 + ' (حوالي ' + a.toFixed(1) + ' بيدق).';
    if (a < 2) return 'أفضلية واضحة لـ' + side2 + ' (ما يعادل ' + a.toFixed(1) + ' بيدق).';
    if (a < 5) return side2 + ' متفوق بشكل كبير، والموقف يقترب من الفوز.';
    return side2 + ' في طريقه إلى الفوز بتفوق ساحق.';
  }

  /* ===== شرح أفضل نقلة بالتفصيل ===== */
  function explainBest(fen, analysis) {
    var lines = analysis.lines || [];
    if (!lines.length) return { html: 'لا توجد نقلات قانونية.' };
    var turn = fen.split(' ')[1];
    var best = lines[0];
    var d = describeMove(fen, best.pv[0]);
    var html = '';
    var bestSan = sanHtml(d.san, turn);
    html += '<div class="exp-head">أفضل نقلة: ' + bestSan + '</div>';
    var reasons = d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
    var sw = toWhite(best.score, turn);

    // أسباب من الاستمرار (ماذا يحدث بعدها)
    var pvFacts = pvInsights(fen, best.pv);
    html += '<div class="exp-sec"><div class="exp-t">💡 لماذا هي الأفضل؟</div><ul>';
    if (!reasons.length && !pvFacts.length) reasons.push('نقلة تحسّن موقع القطع وتحافظ على التوازن؛ المحرك يرى أنها الأدق استراتيجيًا بعد حساب آلاف الاحتمالات.');
    reasons.forEach(function (r) { html += '<li>' + r + '</li>'; });
    pvFacts.forEach(function (r) { html += '<li>' + r + '</li>'; });
    html += '</ul></div>';

    if (lines.length > 1) {
      var alt = lines[1];
      var wb = winPct(best.score), wa = winPct(alt.score);
      var gap = wb - wa;
      html += '<div class="exp-sec"><div class="exp-t">⚖️ مقارنة بالبدائل</div><ul>';
      lines.slice(1).forEach(function (l, i) {
        var g = wb - winPct(l.score);
        var q = g < 3 ? 'بديل جيد تقريبًا بنفس القوة' : g < 10 ? 'أضعف قليلًا' : g < 25 ? 'أضعف بوضوح' : 'أضعف بكثير وقد تضيّع الأفضلية';
        html += '<li>' + sanHtml(uciToSan(fen, l.pv[0]), turn) + ' — ' + q + ' (' + scoreText(toWhite(l.score, turn)) + ')</li>';
      });
      html += '</ul>';
      if (gap >= 15) html += '<div class="exp-note">⭐ هذه النقلة "فريدة": البدائل تخسر الكثير، لذلك يجب إيجادها بالضبط.</div>';
      html += '</div>';
    }

    html += '<div class="exp-sec"><div class="exp-t">🔮 الاستمرار المتوقع</div><div class="pv">' + pvToHtml(fen, best.pv, 8) + '</div></div>';
    html += '<div class="exp-sec"><div class="exp-t">📊 التقييم</div>' + scoreSentence(sw) + ' <bdi class="evalchip">' + scoreText(sw) + '</bdi></div>';
    return { html: html, san: d.san, uci: best.pv[0], describe: d, speech: 'أفضل نقلة: ' + moveToArabic(fen, best.pv[0]) + '. ' + stripTags(reasons.concat(pvFacts).slice(0, 3).join(' ')) };
  }

  /* استنتاجات من خط الاستمرار: مكسب مادي، كش مات، ترقية */
  function pvInsights(fen, pv) {
    var c = new Chess(fen), me = c.turn(), out = [];
    var m0 = material(c);
    var n = Math.min(pv.length, 8), mateAt = -1, promoAt = -1;
    for (var i = 0; i < n; i++) {
      var mv; try { mv = c.move(parseUci(pv[i])); } catch (e) { break; }
      if (mv.promotion && mv.color === me && promoAt < 0) promoAt = i;
      if (c.isCheckmate()) { mateAt = i; break; }
    }
    if (mateAt > 0) out.push('تؤدي إلى كش مات إجباري خلال ' + Math.ceil((mateAt + 1) / 2) + ' نقلات إذا لعب الخصم أفضل دفاع.');
    var m1 = material(c);
    var gain = (m1[me] - m0[me]) - (m1[other(me)] - m0[other(me)]);
    if (mateAt < 0) {
      if (gain >= 2) out.push('بعد التبادلات المتوقعة تربح مادة تعادل حوالي ' + gain + ' ' + (gain >= 3 ? 'نقاط (قطعة أو أكثر)' : 'بيدق') + '.');
      else if (gain <= -2) out.push('تتضمن تضحية مادية (' + (-gain) + ' نقاط) لكن التعويض في النشاط والهجوم أكبر.');
    }
    if (promoAt > 0) out.push('خطة الاستمرار تنتهي بترقية بيدق.');
    return out;
  }

  function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

  /* ===== تصنيف نقلة اللاعب ===== */
  var CLASSES = {
    brilliant: { label: 'نقلة رائعة', sym: '!!', cls: 'c-brill', xp: 12 },
    best: { label: 'أفضل نقلة', sym: '★', cls: 'c-best', xp: 8 },
    excellent: { label: 'ممتازة', sym: '!', cls: 'c-exc', xp: 6 },
    good: { label: 'جيدة', sym: '✓', cls: 'c-good', xp: 4 },
    book: { label: 'نقلة نظرية', sym: '📖', cls: 'c-book', xp: 4 },
    inaccuracy: { label: 'غير دقيقة', sym: '?!', cls: 'c-inacc', xp: 1 },
    mistake: { label: 'خطأ', sym: '?', cls: 'c-mist', xp: 0 },
    blunder: { label: 'خطأ فادح', sym: '??', cls: 'c-blund', xp: 0 },
    miss: { label: 'فرصة ضائعة', sym: '✗', cls: 'c-mist', xp: 0 }
  };

  /* before: تحليل الموقف قبل النقلة (multipv>=1) ، afterScore: تقييم بعد النقلة من منظور الخصم */
  function classify(fen, played, before, afterAnalysis, isBook) {
    var best = before.lines[0];
    var bestScore = best.score;
    var afterBest = afterAnalysis && afterAnalysis.lines[0];
    var playedScore = afterBest ? negate(afterBest.score) : bestScore;
    var c0 = new Chess(fen), c1 = new Chess(fen);
    var mv = c1.move(parseUci(played));
    if (c1.isCheckmate()) playedScore = { mate: 1 };
    else if (c1.isDraw()) playedScore = { cp: 0 };
    var wb = winPct(bestScore), wp = winPct(playedScore);
    var drop = Math.max(0, wb - wp);
    var isBest = played === best.pv[0] || drop < 0.5;
    var d = describeMove(fen, played);
    var key;
    if (isBook) key = 'book';
    else if (isBest) key = (d && d.tags.indexOf('sac') >= 0 && wb < 92 && wp > 45) ? 'brilliant' : 'best';
    else if (bestScore.mate != null && bestScore.mate > 0 && !(playedScore.mate > 0) && drop >= 10) key = 'miss';
    else if (drop < 2) key = 'excellent';
    else if (drop < 5) key = 'good';
    else if (drop < 10) key = 'inaccuracy';
    else if (drop < 20) key = 'mistake';
    else key = 'blunder';
    var C = CLASSES[key];
    var turn = mv.color;
    var html = '<div class="cls ' + C.cls + '"><span class="sym">' + C.sym + '</span> ' + sanHtml(mv.san, turn) + ' — ' + C.label + '</div>';
    var body = [];
    if (key === 'book') body.push('نقلة معروفة في نظرية الافتتاحات، يلعبها الأساتذة كثيرًا.');
    if (d) {
      var good = isBest || drop < 5;
      d.items.filter(function (x) { return good || (x.tag !== 'sac' && x.w > 1.5) || x.w < 0; }).slice(0, 2).forEach(function (x) { body.push(x.t); });
      if (!good && d.tags.indexOf('sac') >= 0) body.push('تحذير: ' + NAME[mv.piece] + ' أصبح عرضة للأسر دون تعويض كافٍ.');
    }
    if (key !== 'best' && key !== 'brilliant' && key !== 'book' && !isBest) {
      var bd = describeMove(fen, best.pv[0]);
      var why = bd && bd.lines.filter(function (x) { return x.indexOf('تحذير') !== 0; })[0];
      body.push('<b>الأفضل كان</b> ' + sanHtml(bd.san, turn) + (why ? ': ' + why : '.'));
      if (afterBest && drop >= 5) {
        var refut = describeMove(c1.fen(), afterBest.pv[0]);
        if (refut) {
          var rr = refut.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; })[0];
          body.push('<b>المشكلة:</b> نقلتك تسمح للخصم بـ ' + sanHtml(refut.san, other(turn)) + (rr ? ' — ' + rr : '') + '.');
        }
        var ins = pvInsights(c1.fen(), afterBest.pv);
        if (ins.length) body.push('بالنسبة للخصم: ' + ins[0]);
      }
      if (drop >= 5) body.push('خسرت تقريبًا ' + Math.round(drop) + '% من فرص الفوز بهذه النقلة.');
    }
    return { key: key, cls: C, drop: drop, html: html + '<ul>' + body.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>', playedScore: playedScore, turn: turn };
  }

  /* ===== ما هو تهديد الخصم؟ (نقلة فارغة) ===== */
  function nullMoveFen(fen) {
    var p = fen.split(' ');
    p[1] = p[1] === 'w' ? 'b' : 'w';
    p[3] = '-';
    return p.join(' ');
  }

  function threatText(fen, analysis) {
    var l = analysis.lines[0];
    if (!l) return 'لا يوجد تهديد واضح.';
    var nf = nullMoveFen(fen), t = nf.split(' ')[1];
    var d = describeMove(nf, l.pv[0]);
    var sc = winPct(l.score);
    var html = '<div class="exp-head">🛡️ تهديد الخصم: ' + sanHtml(d.san, t) + '</div><ul>';
    var r = d.lines.filter(function (x) { return x.indexOf('تحذير') !== 0 && x.indexOf('ملاحظة') !== 0; });
    if (sc < 60 || !r.length) html += '<li>لا يوجد تهديد خطير حاليًا، يمكنك التركيز على تحسين قطعك وخطتك.</li>';
    else r.slice(0, 2).forEach(function (x) { html += '<li>لو تركت له الدور: ' + x + '</li>'; });
    html += '</ul>';
    return { html: html, uci: l.pv[0], serious: sc >= 60 };
  }

  self.Coach = {
    NAME: NAME, NAME_INDEF: NAME_INDEF, VAL: VAL, SIDE: SIDE,
    describeMove: describeMove,
    explainBest: explainBest,
    classify: classify,
    CLASSES: CLASSES,
    moveToArabic: moveToArabic,
    sanHtml: sanHtml,
    pvToHtml: pvToHtml,
    uciToSan: uciToSan,
    winPct: winPct,
    negate: negate,
    toWhite: toWhite,
    scoreText: scoreText,
    scoreSentence: scoreSentence,
    nullMoveFen: nullMoveFen,
    threatText: threatText,
    isHanging: isHanging,
    attacksFrom: attacksFrom,
    stripTags: stripTags,
    parseUci: parseUci
  };
})();
