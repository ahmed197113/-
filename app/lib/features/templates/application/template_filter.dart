import '../../../core/utils/arabic_text.dart';
import '../domain/occasion_template.dart';

/// Pure filtering used by Home; kept separate for unit testing.
class TemplateFilter {
  const TemplateFilter({
    this.category,
    this.country,
    this.query = '',
  });

  final TemplateCategory? category;
  final String? country;
  final String query;

  List<OccasionTemplate> apply(List<OccasionTemplate> all, DateTime now) {
    final q = ArabicText.normalizeForSearch(query);
    return all.where((t) {
      if (!t.isActiveAt(now)) return false;
      if (!t.availableIn(country)) return false;
      if (category != null && t.category != category) return false;
      if (q.isEmpty) return true;
      final hay = ArabicText.normalizeForSearch(
          '${t.titleAr} ${t.titleEn} ${t.category.titleAr} ${t.category.titleEn}');
      return hay.contains(q);
    }).toList();
  }

  /// Featured, in-season templates for the hero/trending rails.
  static List<OccasionTemplate> trending(
          List<OccasionTemplate> all, String? country, DateTime now) =>
      all
          .where((t) =>
              t.isFeatured && t.isActiveAt(now) && t.availableIn(country))
          .toList();

  /// Seasonal (date-bounded) templates that are live now, newest season first.
  static List<OccasionTemplate> seasonal(
          List<OccasionTemplate> all, String? country, DateTime now) =>
      all
          .where((t) =>
              t.activeFrom != null &&
              t.isActiveAt(now) &&
              t.availableIn(country))
          .toList();
}
