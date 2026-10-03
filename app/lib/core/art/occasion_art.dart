import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';

/// Procedural festive artwork drawn with plain vector paths. Used for
/// template covers, on-device previews and editor stickers, so the app ships
/// without heavy raster assets.
class OccasionArt {
  const OccasionArt._();

  static void paintBackground(
    Canvas canvas,
    Size size, {
    required String motif,
    required List<Color> colors,
    int seed = 0,
    double motifScale = 1,
    bool drawMotif = true,
  }) {
    final rect = Offset.zero & size;
    final c0 = colors[0];
    final c1 = colors[1];
    final c2 = colors.length > 2 ? colors[2] : Color.lerp(c0, c1, .35)!;
    final rnd = math.Random(seed * 7919 + motif.hashCode);

    // Base vertical gradient.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ui.Gradient.linear(
          rect.topCenter,
          rect.bottomCenter,
          [Color.lerp(c0, c2, .45)!, c0, Color.lerp(c0, const Color(0xFF000000), .35)!],
          [0, .55, 1],
        ),
    );
    // Soft glow.
    final glowCenter = Offset(
        size.width * (.3 + rnd.nextDouble() * .4), size.height * (.18 + rnd.nextDouble() * .15));
    canvas.drawCircle(
      glowCenter,
      size.longestSide * .55,
      Paint()
        ..shader = ui.Gradient.radial(glowCenter, size.longestSide * .55,
            [c1.withValues(alpha: .38), c1.withValues(alpha: 0)]),
    );

    if (motif == 'flag') {
      _flagRibbons(canvas, size, colors, rnd);
    } else if (motif == 'pattern') {
      _geometric(canvas, size, c1.withValues(alpha: .13), size.shortestSide / 5.5);
    }

    _sparkles(canvas, size, c1, rnd, count: motif == 'studio' ? 6 : 38);
    if (!drawMotif) return;

    final s = size.shortestSide * motifScale;
    switch (motif) {
      case 'lantern':
        lantern(canvas, Offset(size.width * .2, size.height * .12), s * .26, c1, swing: -.08);
        lantern(canvas, Offset(size.width * .8, size.height * .08), s * .2, c1, swing: .06);
        lantern(canvas, Offset(size.width * .55, size.height * .03), s * .14, c1);
      case 'crescent':
        crescent(canvas, Offset(size.width * .76, size.height * .16), s * .16, c1);
      case 'mosque':
        crescent(canvas, Offset(size.width * .8, size.height * .12), s * .1, c1);
        mosque(canvas, size, Color.lerp(c0, const Color(0xFF000000), .5)!, c1);
      case 'balloons':
        final palette = [c1, colors.length > 2 ? c2 : const Color(0xFFE57A9B), const Color(0xFF7FB7E8), const Color(0xFFF2C14E)];
        for (var i = 0; i < 6; i++) {
          balloon(canvas, Offset(size.width * (.08 + rnd.nextDouble() * .84), size.height * (.08 + rnd.nextDouble() * .25)),
              s * (.08 + rnd.nextDouble() * .05), palette[i % palette.length]);
        }
      case 'gradcap':
        gradCap(canvas, Offset(size.width * .78, size.height * .14), s * .22, c1);
        _confetti(canvas, size, [c1, c2, const Color(0xFFFFFFFF)], rnd);
      case 'rings':
        rings(canvas, Offset(size.width * .5, size.height * .13), s * .17, c1);
      case 'baby':
        crescent(canvas, Offset(size.width * .78, size.height * .14), s * .12, c1);
        _clouds(canvas, size, const Color(0xFFFFFFFF).withValues(alpha: .7));
      case 'cake':
        _confetti(canvas, size, [c1, c2, const Color(0xFF7FB7E8)], rnd);
        balloon(canvas, Offset(size.width * .15, size.height * .14), s * .1, c2);
        balloon(canvas, Offset(size.width * .85, size.height * .1), s * .09, c1);
      case 'stars':
        star(canvas, Offset(size.width * .8, size.height * .12), s * .07, c1);
        star(canvas, Offset(size.width * .2, size.height * .2), s * .045, c1);
      case 'studio':
        _studioVignette(canvas, size);
      default:
        break;
    }
  }

  static Paint _fill(Color c) => Paint()..color = c..isAntiAlias = true;

  static void _sparkles(Canvas canvas, Size size, Color color, math.Random rnd, {int count = 30}) {
    for (var i = 0; i < count; i++) {
      final p = Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height * .7);
      final r = (.6 + rnd.nextDouble() * 1.8) * size.shortestSide / 400;
      canvas.drawCircle(p, r, _fill(color.withValues(alpha: .25 + rnd.nextDouble() * .6)));
    }
  }

  static void _confetti(Canvas canvas, Size size, List<Color> colors, math.Random rnd) {
    for (var i = 0; i < 40; i++) {
      canvas.save();
      canvas.translate(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height * .6);
      canvas.rotate(rnd.nextDouble() * math.pi);
      final w = size.shortestSide / 70;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: w * 2.2), Radius.circular(w / 3)),
        _fill(colors[i % colors.length].withValues(alpha: .8)),
      );
      canvas.restore();
    }
  }

  static void _clouds(Canvas canvas, Size size, Color color) {
    final p = _fill(color);
    for (final c in [Offset(size.width * .18, size.height * .1), Offset(size.width * .5, size.height * .2)]) {
      final r = size.shortestSide * .06;
      canvas.drawCircle(c, r, p);
      canvas.drawCircle(c + Offset(r * 1.1, r * .2), r * .8, p);
      canvas.drawCircle(c - Offset(r * 1.1, -r * .25), r * .7, p);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(c.dx - r * 1.8, c.dy, r * 3.7, r * .9), Radius.circular(r)), p);
    }
  }

  static void _studioVignette(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ui.Gradient.radial(rect.center, size.longestSide * .7,
            [const Color(0x00000000), const Color(0x99000000)]),
    );
  }

  static void _geometric(Canvas canvas, Size size, Color color, double cell) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = cell / 40;
    for (var y = -cell; y < size.height + cell; y += cell) {
      for (var x = -cell; x < size.width + cell; x += cell) {
        final c = Offset(x + cell / 2, y + cell / 2);
        _eightPointStar(canvas, c, cell * .42, p);
      }
    }
  }

  static void _eightPointStar(Canvas canvas, Offset c, double r, Paint p) {
    for (final a in [0.0, math.pi / 4]) {
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.rotate(a);
      canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: r * 1.4, height: r * 1.4), p);
      canvas.restore();
    }
  }

  static void _flagRibbons(Canvas canvas, Size size, List<Color> colors, math.Random rnd) {
    final h = size.height * .06;
    for (var i = 0; i < colors.length; i++) {
      final y = size.height * .05 + i * h * .8;
      final path = Path()..moveTo(0, y);
      for (var x = 0.0; x <= size.width; x += size.width / 20) {
        path.lineTo(x, y + math.sin(x / size.width * math.pi * 2 + i) * h * .35);
      }
      path
        ..lineTo(size.width, y + h)
        ..lineTo(0, y + h)
        ..close();
      canvas.drawPath(path, _fill(colors[i].withValues(alpha: .55)));
    }
    // Fireworks.
    for (var f = 0; f < 3; f++) {
      final c = Offset(size.width * (.2 + f * .3), size.height * (.3 + rnd.nextDouble() * .1));
      final col = colors[f % colors.length];
      final paint = Paint()
        ..color = (col.computeLuminance() < .05 ? const Color(0xFFFFFFFF) : col).withValues(alpha: .7)
        ..strokeWidth = size.shortestSide / 250
        ..strokeCap = StrokeCap.round;
      for (var k = 0; k < 16; k++) {
        final a = k / 16 * math.pi * 2;
        final r = size.shortestSide * .08;
        canvas.drawLine(c + Offset(math.cos(a), math.sin(a)) * r * .35, c + Offset(math.cos(a), math.sin(a)) * r, paint);
      }
    }
  }

  static void crescent(Canvas canvas, Offset c, double r, Color color) {
    final outer = Path()..addOval(Rect.fromCircle(center: c, radius: r));
    final inner = Path()..addOval(Rect.fromCircle(center: c + Offset(r * .42, -r * .2), radius: r * .86));
    final shape = Path.combine(PathOperation.difference, outer, inner);
    canvas.drawPath(shape.shift(const Offset(0, 0)),
        Paint()..color = color.withValues(alpha: .35)..maskFilter = MaskFilter.blur(BlurStyle.normal, r * .25));
    canvas.drawPath(
      shape,
      Paint()..shader = ui.Gradient.linear(c - Offset(r, r), c + Offset(r, r), [_light(color), color, _dark(color)], [0, .5, 1]),
    );
    star(canvas, c + Offset(r * .55, r * .05), r * .22, color);
  }

  static void star(Canvas canvas, Offset c, double r, Color color, {int points = 5}) {
    final path = Path();
    for (var i = 0; i < points * 2; i++) {
      final rad = i.isEven ? r : r * .45;
      final a = -math.pi / 2 + i * math.pi / points;
      final p = c + Offset(math.cos(a), math.sin(a)) * rad;
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    path.close();
    canvas.drawPath(path, Paint()..shader = ui.Gradient.linear(c - Offset(r, r), c + Offset(r, r), [_light(color), color]));
  }

  static void lantern(Canvas canvas, Offset top, double h, Color color, {double swing = 0}) {
    canvas.save();
    canvas.translate(top.dx, 0);
    canvas.rotate(swing);
    final chain = Paint()
      ..color = color.withValues(alpha: .8)
      ..strokeWidth = h / 60;
    canvas.drawLine(Offset.zero, Offset(0, top.dy), chain);
    canvas.translate(0, top.dy);
    final w = h * .5;
    final gold = Paint()..shader = ui.Gradient.linear(Offset(-w / 2, 0), Offset(w / 2, 0), [_dark(color), _light(color), color, _dark(color)], [0, .35, .65, 1]);
    // Ring + cap.
    canvas.drawCircle(Offset(0, h * .03), h * .035, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = h / 70);
    final cap = Path()
      ..moveTo(-w * .18, h * .07)
      ..lineTo(w * .18, h * .07)
      ..lineTo(w * .42, h * .2)
      ..lineTo(-w * .42, h * .2)
      ..close();
    canvas.drawPath(cap, gold);
    // Glass body with glow.
    final body = Path()
      ..moveTo(-w * .42, h * .2)
      ..quadraticBezierTo(-w * .62, h * .5, -w * .32, h * .78)
      ..lineTo(w * .32, h * .78)
      ..quadraticBezierTo(w * .62, h * .5, w * .42, h * .2)
      ..close();
    canvas.drawCircle(Offset(0, h * .48), h * .55, Paint()..shader = ui.Gradient.radial(Offset(0, h * .48), h * .55, [const Color(0xFFFFD27A).withValues(alpha: .45), const Color(0x00FFD27A)]));
    canvas.drawPath(body, Paint()..shader = ui.Gradient.radial(Offset(0, h * .5), w * .6, [const Color(0xFFFFF1C4), const Color(0xFFFFB84D), const Color(0xFFB8641A)], [0, .55, 1]));
    final frame = Paint()
      ..shader = gold.shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = h / 45;
    canvas.drawPath(body, frame);
    for (final x in [-w * .16, w * .16]) {
      canvas.drawLine(Offset(x, h * .2), Offset(x * .8, h * .78), frame);
    }
    // Base + finial.
    final base = Path()
      ..moveTo(-w * .32, h * .78)
      ..lineTo(w * .32, h * .78)
      ..lineTo(w * .18, h * .88)
      ..lineTo(-w * .18, h * .88)
      ..close();
    canvas.drawPath(base, gold);
    canvas.drawCircle(Offset(0, h * .93), h * .04, gold);
    canvas.restore();
  }

  static void balloon(Canvas canvas, Offset c, double r, Color color) {
    final string = Paint()
      ..color = const Color(0xFFFFFFFF).withValues(alpha: .5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r / 25;
    final s = Path()
      ..moveTo(c.dx, c.dy + r * 1.25)
      ..quadraticBezierTo(c.dx - r * .3, c.dy + r * 2.2, c.dx + r * .1, c.dy + r * 3.2);
    canvas.drawPath(s, string);
    final body = Rect.fromCenter(center: c, width: r * 1.8, height: r * 2.3);
    canvas.drawOval(body, Paint()..shader = ui.Gradient.radial(c - Offset(r * .35, r * .45), r * 1.6, [_light(color), color, _dark(color)], [0, .45, 1]));
    final knot = Path()
      ..moveTo(c.dx - r * .12, c.dy + r * 1.28)
      ..lineTo(c.dx + r * .12, c.dy + r * 1.28)
      ..lineTo(c.dx, c.dy + r * 1.12)
      ..close();
    canvas.drawPath(knot, _fill(_dark(color)));
    canvas.drawOval(Rect.fromCenter(center: c - Offset(r * .4, r * .55), width: r * .35, height: r * .6), _fill(const Color(0xFFFFFFFF).withValues(alpha: .35)));
  }

  static void gradCap(Canvas canvas, Offset c, double w, Color color) {
    final dark = const Color(0xFF111827);
    final board = Path()
      ..moveTo(c.dx, c.dy - w * .25)
      ..lineTo(c.dx + w * .5, c.dy)
      ..lineTo(c.dx, c.dy + w * .25)
      ..lineTo(c.dx - w * .5, c.dy)
      ..close();
    final skull = Path()
      ..moveTo(c.dx - w * .28, c.dy + w * .08)
      ..lineTo(c.dx - w * .28, c.dy + w * .32)
      ..quadraticBezierTo(c.dx, c.dy + w * .45, c.dx + w * .28, c.dy + w * .32)
      ..lineTo(c.dx + w * .28, c.dy + w * .08)
      ..close();
    canvas.drawPath(skull, _fill(dark));
    canvas.drawPath(board, _fill(const Color(0xFF1F2937)));
    canvas.drawPath(board, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = w / 60);
    final tassel = Paint()
      ..color = color
      ..strokeWidth = w / 35
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(c, c + Offset(w * .38, w * .05), tassel);
    canvas.drawLine(c + Offset(w * .38, w * .05), c + Offset(w * .38, w * .32), tassel);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: c + Offset(w * .38, w * .36), width: w * .06, height: w * .12), Radius.circular(w * .02)), _fill(color));
    canvas.drawCircle(c, w * .03, _fill(color));
  }

  static void rings(Canvas canvas, Offset c, double r, Color color) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * .14
      ..shader = ui.Gradient.linear(c - Offset(r, r), c + Offset(r, r), [_light(color), color, _dark(color)]);
    canvas.drawCircle(c - Offset(r * .35, 0), r * .55, p);
    canvas.drawCircle(c + Offset(r * .35, 0), r * .55, p);
    final d = c + Offset(r * .35, -r * .62);
    final gem = Path()
      ..moveTo(d.dx, d.dy - r * .18)
      ..lineTo(d.dx + r * .14, d.dy)
      ..lineTo(d.dx, d.dy + r * .12)
      ..lineTo(d.dx - r * .14, d.dy)
      ..close();
    canvas.drawPath(gem, _fill(const Color(0xFFEAF6FF)));
  }

  static void mosque(Canvas canvas, Size size, Color color, Color accent) {
    final w = size.width;
    final base = size.height * .78;
    final p = _fill(color);
    final path = Path()..moveTo(0, size.height);
    path.lineTo(0, base);
    // Left minaret.
    void minaret(double x, double top, double mw) {
      path
        ..lineTo(x - mw / 2, base)
        ..lineTo(x - mw / 2, top)
        ..lineTo(x, top - mw * 1.6)
        ..lineTo(x + mw / 2, top)
        ..lineTo(x + mw / 2, base);
    }

    minaret(w * .14, size.height * .52, w * .045);
    path.lineTo(w * .3, base);
    path.lineTo(w * .3, base - size.height * .06);
    path.arcToPoint(Offset(w * .7, base - size.height * .06), radius: Radius.circular(w * .2), clockwise: true);
    path.lineTo(w * .7, base);
    minaret(w * .86, size.height * .52, w * .045);
    path
      ..lineTo(w, base)
      ..lineTo(w, size.height)
      ..close();
    canvas.drawPath(path, p);
    canvas.drawCircle(Offset(w * .5, base - size.height * .06 - w * .2 - 6), w * .012, _fill(accent));
    // Windows glow.
    for (var i = 0; i < 5; i++) {
      final x = w * (.36 + i * .07);
      canvas.drawRRect(
        RRect.fromRectAndCorners(Rect.fromLTWH(x - w * .012, base - size.height * .045, w * .024, size.height * .03),
            topLeft: Radius.circular(w * .012), topRight: Radius.circular(w * .012)),
        _fill(const Color(0xFFFFD27A).withValues(alpha: .7)),
      );
    }
  }

  static Color _light(Color c) => Color.lerp(c, const Color(0xFFFFFFFF), .45)!;
  static Color _dark(Color c) => Color.lerp(c, const Color(0xFF000000), .4)!;
}

/// Flutter wrapper so covers and stickers can be used as widgets.
class OccasionArtPainter extends CustomPainter {
  const OccasionArtPainter({
    required this.motif,
    required this.colors,
    this.seed = 0,
  });

  final String motif;
  final List<Color> colors;
  final int seed;

  @override
  void paint(Canvas canvas, Size size) => OccasionArt.paintBackground(
        canvas,
        size,
        motif: motif,
        colors: colors,
        seed: seed,
      );

  @override
  bool shouldRepaint(OccasionArtPainter old) =>
      old.motif != motif || old.seed != seed || old.colors != colors;
}
