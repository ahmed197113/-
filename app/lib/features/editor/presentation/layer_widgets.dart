import 'package:flutter/material.dart';

import '../../../core/art/occasion_art.dart';
import '../../../core/utils/arabic_text.dart';
import '../domain/editor_layer.dart';

const kGoldGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0xFFFFF0B8), Color(0xFFE8C873), Color(0xFFB8862B), Color(0xFFF3D98B), Color(0xFF9C6F1E)],
  stops: [0, .3, .55, .75, 1],
);

const kSilverGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0xFFFFFFFF), Color(0xFFD9DEE5), Color(0xFF8F98A3), Color(0xFFE6EAEE)],
  stops: [0, .35, .65, 1],
);

/// Renders one text layer with real Arabic shaping. All glyph shaping, joining
/// (e.g. لا, الله), and bidi reordering is done by the Flutter engine
/// (HarfBuzz + ICU); we never draw characters one by one.
class ArabicTextArt extends StatelessWidget {
  const ArabicTextArt({
    super.key,
    required this.layer,
    required this.canvasWidth,
  });

  final TextLayer layer;
  final double canvasWidth;

  @override
  Widget build(BuildContext context) {
    final text = layer.displayText;
    final direction = ArabicText.isRtl(text) ? TextDirection.rtl : TextDirection.ltr;
    final unit = canvasWidth / 1080;
    final size = layer.fontSize * unit;
    final base = TextStyle(
      fontFamily: layer.fontFamily,
      fontSize: size,
      height: 1.6,
      fontWeight: FontWeight.w700,
    );

    Widget textWith(TextStyle style) => Text(
          text,
          textAlign: TextAlign.center,
          textDirection: direction,
          softWrap: true,
          style: base.merge(style),
        );

    final children = <Widget>[];
    if (layer.shadow) {
      children.add(textWith(TextStyle(
        color: Colors.transparent,
        shadows: [
          Shadow(color: Colors.black.withValues(alpha: .55), blurRadius: size * .18, offset: Offset(0, size * .05)),
          Shadow(color: Colors.black.withValues(alpha: .35), blurRadius: size * .5),
        ],
      )));
    }
    if (layer.strokeWidth > 0) {
      children.add(textWith(TextStyle(
        foreground: Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = layer.strokeWidth * unit * 2
          ..strokeJoin = StrokeJoin.round
          ..color = layer.strokeColor,
      )));
    }
    final fillText = textWith(TextStyle(color: layer.fill == TextFill.solid ? layer.color : Colors.white));
    children.add(switch (layer.fill) {
      TextFill.solid => fillText,
      TextFill.gold => ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: kGoldGradient.createShader,
          child: fillText,
        ),
      TextFill.silver => ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: kSilverGradient.createShader,
          child: fillText,
        ),
    });

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: canvasWidth * .9),
      child: Stack(alignment: Alignment.center, children: children),
    );
  }
}

class StickerArt extends StatelessWidget {
  const StickerArt({super.key, required this.layer, required this.canvasWidth});

  final StickerLayer layer;
  final double canvasWidth;

  @override
  Widget build(BuildContext context) {
    final s = canvasWidth * .2;
    return SizedBox.square(
      dimension: s,
      child: CustomPaint(painter: _StickerPainter(layer.kind, layer.color)),
    );
  }
}

class StickerPreview extends StatelessWidget {
  const StickerPreview({super.key, required this.kind, this.color = const Color(0xFFC9A24A), this.size = 48});
  final StickerKind kind;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      SizedBox.square(dimension: size, child: CustomPaint(painter: _StickerPainter(kind, color)));
}

class _StickerPainter extends CustomPainter {
  const _StickerPainter(this.kind, this.color);
  final StickerKind kind;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final s = size.shortestSide;
    switch (kind) {
      case StickerKind.crescent:
        OccasionArt.crescent(canvas, c, s * .4, color);
      case StickerKind.lantern:
        OccasionArt.lantern(canvas, Offset(c.dx, s * .02), s * .96, color);
      case StickerKind.star:
        OccasionArt.star(canvas, c, s * .45, color);
      case StickerKind.balloon:
        OccasionArt.balloon(canvas, Offset(c.dx, s * .32), s * .26, color);
      case StickerKind.gradCap:
        OccasionArt.gradCap(canvas, Offset(c.dx, s * .4), s * .9, color);
      case StickerKind.rings:
        OccasionArt.rings(canvas, c, s * .55, color);
    }
  }

  @override
  bool shouldRepaint(_StickerPainter old) => old.kind != kind || old.color != color;
}

/// Small, tasteful brand mark for free-tier exports.
class Watermark extends StatelessWidget {
  const Watermark({super.key, required this.canvasWidth});
  final double canvasWidth;

  @override
  Widget build(BuildContext context) {
    final unit = canvasWidth / 1080;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 18 * unit, vertical: 4 * unit),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .28),
        borderRadius: BorderRadius.circular(30 * unit),
      ),
      child: Text(
        'مناسبة',
        textDirection: TextDirection.rtl,
        style: TextStyle(
          fontFamily: 'ArefRuqaa',
          fontSize: 34 * unit,
          color: Colors.white.withValues(alpha: .85),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
