import 'package:flutter/painting.dart';

import '../../../core/utils/arabic_text.dart';
import '../../settings/application/app_settings.dart';

enum TextFill { solid, gold, silver }

enum StickerKind { crescent, lantern, star, balloon, gradCap, rings }

sealed class EditorLayer {
  EditorLayer({
    required this.id,
    this.position = const Offset(.5, .8),
    this.scale = 1,
    this.rotation = 0,
  });

  final String id;

  /// Centre in normalised (0..1) canvas coordinates.
  Offset position;
  double scale;
  double rotation;
}

class TextLayer extends EditorLayer {
  TextLayer({
    required super.id,
    required this.text,
    this.fontFamily = 'ArefRuqaa',
    this.fontSize = 64,
    this.color = const Color(0xFFE8C873),
    this.fill = TextFill.gold,
    this.strokeWidth = 0,
    this.strokeColor = const Color(0xFF0F1A2E),
    this.shadow = true,
    this.showTashkeel = true,
    this.digits = DigitStyle.asTyped,
    super.position,
    super.scale,
    super.rotation,
  });

  String text;
  String fontFamily;

  /// Logical size relative to a 1080px-wide canvas.
  double fontSize;
  Color color;
  TextFill fill;
  double strokeWidth;
  Color strokeColor;
  bool shadow;
  bool showTashkeel;
  DigitStyle digits;

  /// Text as it should be rendered after the user's display options.
  String get displayText {
    var t = showTashkeel ? text : ArabicText.stripTashkeel(text);
    return switch (digits) {
      DigitStyle.asTyped => t,
      DigitStyle.arabicIndic => ArabicText.toArabicIndicDigits(t),
      DigitStyle.western => ArabicText.toWesternDigits(t),
    };
  }
}

class StickerLayer extends EditorLayer {
  StickerLayer({
    required super.id,
    required this.kind,
    this.color = const Color(0xFFC9A24A),
    super.position = const Offset(.5, .3),
    super.scale,
    super.rotation,
  });

  final StickerKind kind;
  Color color;
}
