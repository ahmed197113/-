import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:munasaba/core/utils/arabic_text.dart';
import 'package:munasaba/features/editor/domain/editor_layer.dart';
import 'package:munasaba/features/editor/domain/font_catalog.dart';
import 'package:munasaba/features/editor/presentation/editor_canvas.dart';
import 'package:munasaba/features/editor/presentation/layer_widgets.dart';

import 'arabic_strings.dart';

const _fontFiles = {
  'ArefRuqaa': ['ArefRuqaa-Regular.ttf', 'ArefRuqaa-Bold.ttf'],
  'Amiri': ['Amiri-Regular.ttf', 'Amiri-Bold.ttf'],
  'ReemKufi': ['ReemKufi-VF.ttf'],
  'ElMessiri': ['ElMessiri-VF.ttf'],
  'Lalezar': ['Lalezar-Regular.ttf'],
  'Marhey': ['Marhey-VF.ttf'],
  'NotoKufiArabic': ['NotoKufiArabic-VF.ttf'],
  'NotoNaskhArabic': ['NotoNaskhArabic-VF.ttf'],
  'Cairo': ['Cairo-VF.ttf'],
  'Tajawal': ['Tajawal-Regular.ttf', 'Tajawal-Bold.ttf'],
};

Future<void> _loadFonts() async {
  for (final e in _fontFiles.entries) {
    final loader = FontLoader(e.key);
    for (final f in e.value) {
      final bytes = File('assets/fonts/$f').readAsBytesSync();
      loader.addFont(Future.value(ByteData.view(bytes.buffer)));
    }
    await loader.load();
  }
}

void main() {
  setUpAll(_loadFonts);

  test('catalogue fonts are all bundled', () {
    for (final f in kArabicFonts) {
      expect(_fontFiles.containsKey(f.family), isTrue, reason: f.family);
    }
    expect(kTrickyArabicStrings.length, greaterThanOrEqualTo(50));
  });

  test('Arabic strings are laid out right-to-left as connected runs', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Strings that start with an Arabic letter (digits form their own LTR run).
    final arabicStart = RegExp('^[\u0621-\u064A\uFDF0-\uFDFF]');
    for (final s in kTrickyArabicStrings.where((s) => ArabicText.isRtl(s) && arabicStart.hasMatch(s))) {
      final tp = TextPainter(
        text: TextSpan(text: s, style: const TextStyle(fontFamily: 'Amiri', fontSize: 40)),
        textDirection: TextDirection.rtl,
      )..layout(maxWidth: 1000);
      // The first logical character must be drawn on the right-hand side.
      final cluster = s.characters.first.length;
      final first = tp.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: cluster));
      expect(first, isNotEmpty, reason: s);
      expect(first.first.direction, TextDirection.rtl, reason: s);
      expect(first.first.right, closeTo(tp.width, tp.width * .2 + 2), reason: s);
    }
  });

  // Ligature check: shaped "لا" is a single lam-alef glyph, narrower than the
  // isolated letters laid out side by side.
  test('lam-alef ligature is formed', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    double w(String s) => (TextPainter(
          text: TextSpan(text: s, style: const TextStyle(fontFamily: 'Amiri', fontSize: 80)),
          textDirection: TextDirection.rtl,
        )..layout())
            .width;
    expect(w('لا'), lessThan(w('ل') + w('ا')));
  });

  for (final font in kArabicFonts) {
    testWidgets('golden: ${font.family}', (tester) async {
      tester.view.physicalSize = const Size(1080, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Material(
          color: const Color(0xFF0F1A2E),
          child: Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            children: [
              for (final s in kTrickyArabicStrings)
                ArabicTextArt(
                  canvasWidth: 1080,
                  layer: TextLayer(
                    id: s,
                    text: s,
                    fontFamily: font.family,
                    fontSize: 40,
                    fill: TextFill.solid,
                    color: Colors.white,
                    shadow: false,
                    
                  ),
                ),
            ],
          ),
        ),
      ));
      await expectLater(find.byType(Wrap), matchesGoldenFile('goldens/font_${font.family}.png'));
    });
  }

  testWidgets('golden: editor composition with gold text, stroke and sticker', (tester) async {
    tester.view.physicalSize = const Size(540, 960);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Material(
        child: EditorCanvas(
          base: null,
          aspectRatio: 9 / 16,
          watermark: true,
          layers: [
            TextLayer(id: 'a', text: 'عيدكم مبارك', fontFamily: 'ArefRuqaa', fontSize: 110, position: const Offset(.5, .78)),
            TextLayer(
              id: 'b',
              text: 'أحمد Ahmed 2026',
              fontFamily: 'Cairo',
              fontSize: 54,
              fill: TextFill.solid,
              strokeWidth: 3,
              position: const Offset(.5, .9),
            ),
            StickerLayer(id: 'c', kind: StickerKind.crescent, position: const Offset(.5, .25)),
          ],
        ),
      ),
    ));
    await expectLater(find.byType(EditorCanvas), matchesGoldenFile('goldens/editor_composition.png'));
  });
}
