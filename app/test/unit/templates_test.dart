import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:munasaba/features/templates/application/template_filter.dart';
import 'package:munasaba/features/templates/data/template_repository.dart';
import 'package:munasaba/features/templates/domain/occasion_template.dart';

void main() {
  final all = AssetTemplateRepository.parse(File('assets/templates/templates.json').readAsStringSync());

  test('seed has at least 40 templates with unique ids', () {
    expect(all.length, greaterThanOrEqualTo(40));
    expect(all.map((t) => t.id).toSet().length, all.length);
  });

  test('every template is fully specified and safe', () {
    for (final t in all) {
      expect(t.titleAr, isNotEmpty, reason: t.id);
      expect(t.titleEn, isNotEmpty, reason: t.id);
      expect(t.promptTemplate, contains('{gender}'), reason: t.id);
      // The model must never draw text: enforced via the negative prompt.
      expect(t.negativePrompt, contains('text'), reason: t.id);
      expect(t.negativePrompt, contains('revealing'), reason: t.id);
      expect(t.creditsCost, greaterThan(0), reason: t.id);
      expect(t.textPresets, isNotEmpty, reason: t.id);
    }
  });

  test('covers every category', () {
    expect(all.map((t) => t.category).toSet(), containsAll(TemplateCategory.values));
  });

  test('seasonal scheduling', () {
    final sa = all.firstWhere((t) => t.id == 'sa_national');
    expect(sa.isActiveAt(DateTime(2026, 9, 23)), isTrue);
    expect(sa.isActiveAt(DateTime(2026, 12, 1)), isFalse);
  });

  test('country filter keeps global templates', () {
    final egOnly = TemplateFilter(country: 'EG').apply(all, DateTime(2026, 10, 3));
    expect(egOnly.any((t) => t.id == 'eg_october'), isTrue);
    expect(egOnly.any((t) => t.id == 'sa_national'), isFalse);
    expect(egOnly.any((t) => t.id == 'eid_elegant'), isTrue);
  });

  test('arabic search is tolerant to hamza/taa marbuta', () {
    final r = const TemplateFilter(query: 'تخرج').apply(all, DateTime(2026, 10, 3));
    expect(r, isNotEmpty);
    expect(r.every((t) => t.category == TemplateCategory.graduation), isTrue);
  });

  test('parses firestore-like dates and missing fields', () {
    final t = OccasionTemplate.fromJson({'id': 'x', 'category': 'unknown', 'active_from': '2026-01-01'});
    expect(t.category, TemplateCategory.eidFitr);
    expect(t.activeFrom, DateTime(2026));
    expect(t.aspectRatios, ['9:16']);
  });
}
