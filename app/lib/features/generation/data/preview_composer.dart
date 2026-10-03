import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import '../../../core/art/occasion_art.dart';
import '../../templates/domain/occasion_template.dart';

/// Builds festive on-device preview cards from the user's selfie when no AI
/// backend is configured. The AI pipeline (Cloud Functions) replaces this in
/// production; text is never drawn here — that is the editor's job.
class PreviewComposer {
  const PreviewComposer();

  static Size sizeFor(String aspect) => switch (aspect) {
        '9:16' => const Size(1080, 1920),
        '1:1' => const Size(1080, 1080),
        _ => const Size(1080, 1350),
      };

  Future<void> compose({
    required String selfiePath,
    required OccasionTemplate template,
    required int variation,
    required String aspect,
    required String outPath,
  }) async {
    final size = sizeFor(aspect);
    final bytes = await File(selfiePath).readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final photo = (await codec.getNextFrame()).image;

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Offset.zero & size);
    final colors = template.coverStyle.colors;
    final accent = colors[1];

    OccasionArt.paintBackground(canvas, size,
        motif: template.coverStyle.motif, colors: colors, seed: variation, motifScale: 1.1);

    final layout = variation % 4;
    final w = size.width;
    final h = size.height;
    switch (layout) {
      case 0: // Arch frame (Islamic window).
        final frame = Rect.fromCenter(center: Offset(w / 2, h * .52), width: w * .66, height: h * .58);
        final arch = _archPath(frame);
        _glow(canvas, arch, accent);
        canvas.save();
        canvas.clipPath(arch);
        _drawCover(canvas, photo, frame);
        _innerShade(canvas, frame);
        canvas.restore();
        _goldStroke(canvas, arch, accent, w / 90);
        _goldStroke(canvas, _archPath(frame.inflate(w * .025)), accent, w / 300);
      case 1: // Medallion circle.
        final c = Offset(w / 2, h * .5);
        final r = math.min(w, h) * .34;
        final circle = Path()..addOval(Rect.fromCircle(center: c, radius: r));
        _glow(canvas, circle, accent);
        canvas.save();
        canvas.clipPath(circle);
        _drawCover(canvas, photo, Rect.fromCircle(center: c, radius: r));
        canvas.restore();
        _goldStroke(canvas, circle, accent, w / 70);
        for (var i = 0; i < 24; i++) {
          final a = i / 24 * math.pi * 2;
          OccasionArt.star(canvas, c + Offset(math.cos(a), math.sin(a)) * (r * 1.12), w / 110, accent);
        }
      case 2: // Full-bleed portrait with festive frame.
        final rect = Offset.zero & size;
        _drawCover(canvas, photo, Rect.fromLTWH(0, h * .12, w, h * .88));
        canvas.drawRect(
          rect,
          Paint()
            ..shader = ui.Gradient.linear(Offset(0, h * .1), Offset(0, h * .32), [colors[0], colors[0].withValues(alpha: 0)]),
        );
        canvas.drawRect(
          rect,
          Paint()
            ..shader = ui.Gradient.linear(Offset(0, h * .62), Offset(0, h), [colors[0].withValues(alpha: 0), colors[0].withValues(alpha: .92)]),
        );
        canvas.save();
        canvas.clipRect(Rect.fromLTWH(0, 0, w, h * .26));
        OccasionArt.paintBackground(canvas, size, motif: template.coverStyle.motif, colors: colors, seed: variation + 11);
        canvas.restore();
        final border = Path()..addRRect(RRect.fromRectAndRadius(rect.deflate(w * .035), Radius.circular(w * .04)));
        _goldStroke(canvas, border, accent, w / 160);
      default: // Polaroid card, tilted.
        canvas.save();
        canvas.translate(w / 2, h * .5);
        canvas.rotate(-.05);
        final card = Rect.fromCenter(center: Offset.zero, width: w * .7, height: h * .6);
        canvas.drawRRect(RRect.fromRectAndRadius(card.shift(Offset(w * .012, w * .02)), Radius.circular(w * .02)),
            Paint()..color = const Color(0x66000000)..maskFilter = MaskFilter.blur(BlurStyle.normal, w * .02));
        canvas.drawRRect(RRect.fromRectAndRadius(card, Radius.circular(w * .02)), Paint()..color = const Color(0xFFF8F3E8));
        final photoRect = Rect.fromLTRB(card.left + w * .03, card.top + w * .03, card.right - w * .03, card.bottom - h * .1);
        canvas.save();
        canvas.clipRRect(RRect.fromRectAndRadius(photoRect, Radius.circular(w * .01)));
        _drawCover(canvas, photo, photoRect);
        canvas.restore();
        canvas.restore();
    }

    // Warm colour grade to tie the photo into the scene.
    canvas.drawRect(Offset.zero & size, Paint()..color = accent.withValues(alpha: .06)..blendMode = BlendMode.softLight);

    final picture = recorder.endRecording();
    final out = await picture.toImage(size.width.toInt(), size.height.toInt());
    final png = await out.toByteData(format: ui.ImageByteFormat.png);
    await File(outPath).writeAsBytes(png!.buffer.asUint8List());
    photo.dispose();
    out.dispose();
  }

  static Path _archPath(Rect r) {
    final rad = r.width / 2;
    return Path()
      ..moveTo(r.left, r.bottom)
      ..lineTo(r.left, r.top + rad)
      ..arcToPoint(Offset(r.right, r.top + rad), radius: Radius.circular(rad))
      ..lineTo(r.right, r.bottom)
      ..close();
  }

  static void _drawCover(Canvas canvas, ui.Image image, Rect dst) {
    final src = Offset.zero & Size(image.width.toDouble(), image.height.toDouble());
    final fitted = applyBoxFit(BoxFit.cover, src.size, dst.size);
    final s = Alignment.topCenter.inscribe(fitted.source, src);
    canvas.drawImageRect(image, s, dst, Paint()..filterQuality = FilterQuality.high);
  }

  static void _innerShade(Canvas canvas, Rect r) {
    canvas.drawRect(
      r,
      Paint()
        ..shader = ui.Gradient.linear(r.bottomCenter, r.center, [const Color(0x88000000), const Color(0x00000000)]),
    );
  }

  static void _glow(Canvas canvas, Path p, Color c) {
    canvas.drawPath(p, Paint()..color = c.withValues(alpha: .45)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40));
  }

  static void _goldStroke(Canvas canvas, Path p, Color c, double width) {
    final b = p.getBounds();
    canvas.drawPath(
      p,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..shader = ui.Gradient.linear(b.topLeft, b.bottomRight, [
          Color.lerp(c, const Color(0xFFFFFFFF), .5)!,
          c,
          Color.lerp(c, const Color(0xFF000000), .35)!,
          Color.lerp(c, const Color(0xFFFFFFFF), .3)!,
        ], [0, .4, .7, 1]),
    );
  }
}
