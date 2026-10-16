import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/l10n.dart';
import 'package:mirra/core/personality.dart';

void main() {
  group('scoring', () {
    test('has 4 items per trait', () {
      for (final t in Personality.traits) {
        expect(Personality.items.where((i) => i.$1 == t).length, 4);
      }
    });

    test('agreeing with everything gives balanced scores', () {
      final all5 = {for (var i = 0; i < Personality.questionCount; i++) i: 5};
      final s = Personality.score(all5);
      for (final t in Personality.traits) {
        expect(s[t], 50);
      }
    });

    test('keyed answers reach 0 and 100', () {
      final high = {
        for (var i = 0; i < Personality.questionCount; i++)
          i: Personality.items[i].$2 > 0 ? 5 : 1,
      };
      final low = high.map((k, v) => MapEntry(k, 6 - v));
      for (final t in Personality.traits) {
        expect(Personality.score(high)[t], 100);
        expect(Personality.score(low)[t], 0);
      }
    });

    test('evidence picks the strongest non-neutral answers of a trait', () {
      // Items 0, 5, 10, 15 are Extraversion.
      final answers = {0: 5, 5: 3, 10: 4, 15: 1};
      final e = Personality.evidence(answers, 'E');
      expect(e.length, 2);
      expect(e.map((x) => x.$1).toSet(), {0, 15});
      expect(e.firstWhere((x) => x.$1 == 15).$2, isFalse);
      expect(Personality.evidence(answers, 'A'), isEmpty);
    });
  });

  group('translations', () {
    Map<String, dynamic> load(String code) =>
        jsonDecode(File('assets/i18n/$code.json').readAsStringSync())
            as Map<String, dynamic>;

    for (final code in L10n.languages.keys) {
      test('$code has every key the app uses', () {
        final j = load(code);
        expect((j['questions'] as List).length, Personality.questionCount);
        for (final q in j['questions'] as List) {
          expect((q as Map).keys, containsAll(['q', 'me', 'not']));
        }
        expect((j['likert'] as List).length, 5);
        for (final key in Personality.typeEmoji.keys) {
          expect((j['types'] as Map).containsKey(key), isTrue, reason: key);
        }
        for (final t in Personality.traits) {
          for (final level in ['low', 'mid', 'high']) {
            expect(j['traits'][t][level]['summary'], isA<String>());
          }
          expect((j['challenges'][t] as List).length, 10);
        }
      });
    }
  });
}
