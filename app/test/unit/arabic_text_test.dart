import 'package:flutter_test/flutter_test.dart';
import 'package:munasaba/core/utils/arabic_text.dart';
import 'package:munasaba/features/editor/domain/editor_layer.dart';
import 'package:munasaba/features/settings/application/app_settings.dart';

void main() {
  group('digits', () {
    test('western → arabic-indic', () {
      expect(ArabicText.toArabicIndicDigits('Ahmed أحمد 2026'), 'Ahmed أحمد ٢٠٢٦');
    });
    test('arabic-indic and persian → western', () {
      expect(ArabicText.toWesternDigits('٢٠٢٦ و ۱۴'), '2026 و 14');
    });
    test('round trip', () {
      const s = 'العيد ١٤٤٧ هـ';
      expect(ArabicText.toArabicIndicDigits(ArabicText.toWesternDigits(s)), s);
    });
  });

  group('tashkeel', () {
    test('strips harakat but keeps letters', () {
      expect(ArabicText.stripTashkeel('عِيدٌ مُبَارَكٌ'), 'عيد مبارك');
      expect(ArabicText.hasTashkeel('عِيدٌ'), isTrue);
      expect(ArabicText.hasTashkeel('عيد'), isFalse);
    });
    test('keeps hamza forms, taa marbuta and alef maqsura', () {
      expect(ArabicText.stripTashkeel('مُصْطَفَى فَاطِمَةُ سَمَاءٌ'), 'مصطفى فاطمة سماء');
    });
  });

  test('direction detection', () {
    expect(ArabicText.isRtl('أحمد Ahmed'), isTrue);
    expect(ArabicText.isRtl('Ahmed أحمد'), isFalse);
    expect(ArabicText.isRtl('2026 أحمد'), isTrue);
  });

  test('search normalisation', () {
    expect(ArabicText.normalizeForSearch('إحتفال'), ArabicText.normalizeForSearch('احتفال'));
    expect(ArabicText.normalizeForSearch('مبروكــة'), 'مبروكه');
  });

  test('text layer display applies options', () {
    final l = TextLayer(id: '1', text: 'عِيدٌ 2026', showTashkeel: false, digits: DigitStyle.arabicIndic);
    expect(l.displayText, 'عيد ٢٠٢٦');
    l
      ..showTashkeel = true
      ..digits = DigitStyle.western;
    expect(l.displayText, 'عِيدٌ 2026');
  });
}
