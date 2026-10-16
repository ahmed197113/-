import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/personality.dart';

/// Five-axis personality radar. An optional [compare] profile is drawn
/// as a dashed outline behind the main one.
class RadarChart extends StatelessWidget {
  const RadarChart({
    super.key,
    required this.scores,
    required this.labels,
    this.compare,
    this.size = 260,
  });

  final Map<String, double> scores;
  final Map<String, double>? compare;
  final Map<String, String> labels;
  final double size;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, t, _) => CustomPaint(
        size: Size.square(size),
        painter: _RadarPainter(
          scores: scores,
          compare: compare,
          labels: labels,
          progress: t,
          textColor: Theme.of(context).colorScheme.onSurface,
          gridColor: Theme.of(context).colorScheme.outlineVariant,
          direction: Directionality.of(context),
          fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
        ),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({
    required this.scores,
    required this.compare,
    required this.labels,
    required this.progress,
    required this.textColor,
    required this.gridColor,
    required this.direction,
    required this.fontFamily,
  });

  final Map<String, double> scores;
  final Map<String, double>? compare;
  final Map<String, String> labels;
  final double progress;
  final Color textColor;
  final Color gridColor;
  final TextDirection direction;
  final String? fontFamily;

  static const traits = Personality.traits;

  Offset _point(Offset c, double r, int i, double value) {
    final angle = -math.pi / 2 + 2 * math.pi * i / traits.length;
    return c + Offset(math.cos(angle), math.sin(angle)) * r * value / 100;
  }

  Path _shape(Offset c, double r, Map<String, double> s, double t) {
    final path = Path();
    for (var i = 0; i < traits.length; i++) {
      final p = _point(c, r, i, s[traits[i]]! * t);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    return path..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 44;

    final grid = Paint()
      ..color = gridColor.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final level in [25.0, 50.0, 75.0, 100.0]) {
      canvas.drawPath(
          _shape(c, r, {for (final t in traits) t: level}, 1), grid);
    }
    for (var i = 0; i < traits.length; i++) {
      canvas.drawLine(c, _point(c, r, i, 100), grid);
    }

    if (compare != null) {
      canvas.drawPath(
        _shape(c, r, compare!, progress),
        Paint()
          ..color = textColor.withValues(alpha: 0.35)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    final shape = _shape(c, r, scores, progress);
    canvas.drawPath(
      shape,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xAA6C4BFF), Color(0xAAFF6B9A)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    canvas.drawPath(
      shape,
      Paint()
        ..color = const Color(0xFF6C4BFF)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round,
    );

    for (var i = 0; i < traits.length; i++) {
      final t = traits[i];
      final p = _point(c, r, i, scores[t]! * progress);
      canvas.drawCircle(p, 5, Paint()..color = Personality.colors[t]!);
      canvas.drawCircle(
          p,
          5,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2);

      final label = TextPainter(
        text: TextSpan(children: [
          TextSpan(
            text: '${labels[t]}\n',
            style: TextStyle(
                color: textColor,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                fontFamily: fontFamily),
          ),
          TextSpan(
            text: '${scores[t]!.round()}%',
            style: TextStyle(
                color: Personality.colors[t],
                fontSize: 13,
                fontWeight: FontWeight.w800,
                fontFamily: fontFamily),
          ),
        ]),
        textAlign: TextAlign.center,
        textDirection: direction,
        maxLines: 3,
      )..layout(maxWidth: 96);
      final lp = _point(c, r + 30, i, 100);
      label.paint(canvas, lp - Offset(label.width / 2, label.height / 2));
    }
  }

  @override
  bool shouldRepaint(_RadarPainter old) =>
      old.progress != progress ||
      old.scores != scores ||
      old.compare != compare ||
      old.textColor != textColor;
}
