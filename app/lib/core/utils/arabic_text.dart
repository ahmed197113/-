/// Pure text helpers for the Arabic editor. Shaping itself is done by the
/// Flutter engine (HarfBuzz + ICU bidi); these only transform code points.
class ArabicText {
  const ArabicText._();

  static const _western = '0123456789';
  static const _arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  static const _easternPersian = '۰۱۲۳۴۵۶۷۸۹';

  /// Converts every digit (Western, Arabic-Indic or Persian) to Arabic-Indic.
  static String toArabicIndicDigits(String input) {
    final b = StringBuffer();
    for (final r in input.runes) {
      final c = String.fromCharCode(r);
      final w = _western.indexOf(c);
      final p = _easternPersian.indexOf(c);
      if (w >= 0) {
        b.write(_arabicIndic[w]);
      } else if (p >= 0) {
        b.write(_arabicIndic[p]);
      } else {
        b.write(c);
      }
    }
    return b.toString();
  }

  /// Converts Arabic-Indic / Persian digits to Western digits.
  static String toWesternDigits(String input) {
    final b = StringBuffer();
    for (final r in input.runes) {
      final c = String.fromCharCode(r);
      final a = _arabicIndic.indexOf(c);
      final p = _easternPersian.indexOf(c);
      if (a >= 0) {
        b.write(_western[a]);
      } else if (p >= 0) {
        b.write(_western[p]);
      } else {
        b.write(c);
      }
    }
    return b.toString();
  }

  /// Harakat (U+064B–U+065F), superscript alef (U+0670) and Quranic marks.
  static final _tashkeel = RegExp('[ً-ٰٟۖ-ۭ]');

  static String stripTashkeel(String input) => input.replaceAll(_tashkeel, '');

  static bool hasTashkeel(String input) => _tashkeel.hasMatch(input);

  /// Tatweel (kashida) is a stylistic elongation; strip it for search.
  static String normalizeForSearch(String input) => stripTashkeel(input)
      .replaceAll('ـ', '')
      .replaceAll(RegExp('[أإآ]'), 'ا')
      .replaceAll('ى', 'ي')
      .replaceAll('ة', 'ه')
      .toLowerCase()
      .trim();

  static final _rtlChar = RegExp('[֐-ࣿיִ-﷿ﹰ-﻿]');

  /// True when the first strong directional character is RTL.
  static bool isRtl(String input) {
    for (final r in input.runes) {
      final c = String.fromCharCode(r);
      if (_rtlChar.hasMatch(c)) return true;
      if (RegExp('[A-Za-z]').hasMatch(c)) return false;
    }
    return true;
  }
}
