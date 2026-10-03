import 'package:flutter/material.dart';

import '../domain/editor_layer.dart';
import 'layer_widgets.dart';

/// The composited picture: base image + layers (+ watermark). Pure layout so
/// the same widget is used on screen, for export, and in golden tests.
class EditorCanvas extends StatelessWidget {
  const EditorCanvas({
    super.key,
    required this.base,
    required this.aspectRatio,
    required this.layers,
    this.selectedId,
    this.watermark = false,
    this.onTapLayer,
    this.onDoubleTapLayer,
  });

  final ImageProvider? base;
  final double aspectRatio;
  final List<EditorLayer> layers;
  final String? selectedId;
  final bool watermark;
  final ValueChanged<String>? onTapLayer;
  final ValueChanged<String>? onDoubleTapLayer;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth;
        final h = c.maxHeight;
        return ClipRect(
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: base == null
                    ? const ColoredBox(color: Color(0xFF0F1A2E))
                    : Image(image: base!, fit: BoxFit.cover, filterQuality: FilterQuality.high, gaplessPlayback: true),
              ),
              for (final l in layers)
                _Positioned(
                  layer: l,
                  canvas: Size(w, h),
                  selected: l.id == selectedId,
                  onTap: onTapLayer == null ? null : () => onTapLayer!(l.id),
                  onDoubleTap: onDoubleTapLayer == null ? null : () => onDoubleTapLayer!(l.id),
                  child: switch (l) {
                    TextLayer t => ArabicTextArt(layer: t, canvasWidth: w),
                    StickerLayer s => StickerArt(layer: s, canvasWidth: w),
                  },
                ),
              if (watermark)
                Positioned(
                  left: w * .03,
                  bottom: w * .03,
                  child: Watermark(canvasWidth: w),
                ),
            ],
          ),
        );
      }),
    );
  }
}

class _Positioned extends StatelessWidget {
  const _Positioned({
    required this.layer,
    required this.canvas,
    required this.selected,
    required this.child,
    this.onTap,
    this.onDoubleTap,
  });

  final EditorLayer layer;
  final Size canvas;
  final bool selected;
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onDoubleTap;

  @override
  Widget build(BuildContext context) {
    final center = Offset(layer.position.dx * canvas.width, layer.position.dy * canvas.height);
    return Positioned(
      left: center.dx - canvas.width,
      top: center.dy - canvas.height,
      width: canvas.width * 2,
      height: canvas.height * 2,
      child: Center(
        child: Transform.rotate(
          angle: layer.rotation,
          child: Transform.scale(
            scale: layer.scale,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTap,
              onDoubleTap: onDoubleTap,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: selected
                      ? Border.all(color: const Color(0xFFE8C873).withValues(alpha: .9), width: 1.5 / layer.scale)
                      : null,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Padding(padding: const EdgeInsets.all(6), child: child),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
