import 'package:flutter/painting.dart';

import '../../../core/theme/app_colors.dart';

enum TemplateCategory {
  eidFitr('eid_fitr', 'عيد الفطر', 'Eid al-Fitr'),
  eidAdha('eid_adha', 'عيد الأضحى', 'Eid al-Adha'),
  ramadan('ramadan', 'رمضان', 'Ramadan'),
  graduation('graduation', 'تخرّج', 'Graduation'),
  wedding('wedding', 'زفاف وخطوبة', 'Wedding'),
  newborn('newborn', 'مولود', 'Newborn'),
  nationalDay('national_day', 'أيام وطنية', 'National Days'),
  traditional('traditional', 'أزياء تراثية', 'Traditional'),
  hajjUmrah('hajj_umrah', 'حج وعمرة', 'Hajj & Umrah'),
  professional('professional', 'صور مهنية', 'Professional'),
  birthday('birthday', 'عيد ميلاد', 'Birthday');

  const TemplateCategory(this.id, this.titleAr, this.titleEn);
  final String id;
  final String titleAr;
  final String titleEn;

  static TemplateCategory fromId(String id) => TemplateCategory.values
      .firstWhere((c) => c.id == id, orElse: () => TemplateCategory.eidFitr);
}

enum GenderVariant {
  male,
  female,
  unisex;

  static GenderVariant fromId(String? id) => GenderVariant.values
      .firstWhere((g) => g.name == id, orElse: () => GenderVariant.unisex);
}

enum TextPosition {
  top,
  center,
  bottom;

  static TextPosition fromId(String? id) => TextPosition.values
      .firstWhere((p) => p.name == id, orElse: () => TextPosition.bottom);
}

/// Procedural cover used when a template has no sample images yet.
class CoverStyle {
  const CoverStyle({required this.motif, required this.colors});

  final String motif;
  final List<Color> colors;

  factory CoverStyle.fromJson(Map<String, dynamic>? json) {
    final colors = (json?['colors'] as List?)
            ?.map((c) => AppColors.parse(c as String))
            .toList() ??
        const [AppColors.night, AppColors.gold];
    return CoverStyle(
      motif: json?['motif'] as String? ?? 'stars',
      colors: colors.length < 2 ? [...colors, AppColors.gold] : colors,
    );
  }

  Map<String, dynamic> toJson() => {
        'motif': motif,
        'colors': colors
            .map((c) =>
                '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}')
            .toList(),
      };
}

class OccasionTemplate {
  const OccasionTemplate({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.category,
    required this.countryTags,
    required this.genderVariant,
    required this.coverImageUrl,
    required this.sampleImages,
    required this.coverStyle,
    required this.promptTemplate,
    required this.negativePrompt,
    required this.styleStrength,
    required this.modelId,
    required this.aspectRatios,
    required this.textPresets,
    required this.defaultFont,
    required this.defaultTextColor,
    required this.defaultTextPosition,
    required this.isPremium,
    required this.creditsCost,
    required this.activeFrom,
    required this.activeTo,
    required this.sortPriority,
    required this.isFeatured,
  });

  final String id;
  final String titleAr;
  final String titleEn;
  final TemplateCategory category;
  final List<String> countryTags;
  final GenderVariant genderVariant;
  final String coverImageUrl;
  final List<String> sampleImages;
  final CoverStyle coverStyle;
  final String promptTemplate;
  final String negativePrompt;
  final double styleStrength;
  final String modelId;
  final List<String> aspectRatios;
  final List<String> textPresets;
  final String defaultFont;
  final Color defaultTextColor;
  final TextPosition defaultTextPosition;
  final bool isPremium;
  final int creditsCost;
  final DateTime? activeFrom;
  final DateTime? activeTo;
  final int sortPriority;
  final bool isFeatured;

  String title(bool arabic) => arabic ? titleAr : titleEn;

  /// Seasonal scheduling: inactive templates are hidden from Home.
  bool isActiveAt(DateTime now) {
    if (activeFrom != null && now.isBefore(activeFrom!)) return false;
    if (activeTo != null && now.isAfter(activeTo!)) return false;
    return true;
  }

  /// Empty country tags means the template is shown everywhere.
  bool availableIn(String? country) =>
      countryTags.isEmpty || country == null || countryTags.contains(country);

  static DateTime? _date(Object? v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    if (v is String) return DateTime.tryParse(v);
    // Firestore Timestamp exposes toDate(); avoid importing it in the domain.
    try {
      return (v as dynamic).toDate() as DateTime;
    } catch (_) {
      return null;
    }
  }

  factory OccasionTemplate.fromJson(Map<String, dynamic> j) {
    List<String> strings(Object? v) =>
        (v as List?)?.map((e) => e.toString()).toList() ?? const [];
    return OccasionTemplate(
      id: j['id'] as String,
      titleAr: j['title_ar'] as String? ?? '',
      titleEn: j['title_en'] as String? ?? '',
      category: TemplateCategory.fromId(j['category'] as String? ?? ''),
      countryTags: strings(j['country_tags']),
      genderVariant: GenderVariant.fromId(j['gender_variant'] as String?),
      coverImageUrl: j['cover_image_url'] as String? ?? '',
      sampleImages: strings(j['sample_images']),
      coverStyle: CoverStyle.fromJson(j['cover_style'] as Map<String, dynamic>?),
      promptTemplate: j['prompt_template'] as String? ?? '',
      negativePrompt: j['negative_prompt'] as String? ?? '',
      styleStrength: (j['style_strength'] as num?)?.toDouble() ?? 0.8,
      modelId: j['model_id'] as String? ?? 'default',
      aspectRatios: strings(j['aspect_ratios']).isEmpty
          ? const ['9:16']
          : strings(j['aspect_ratios']),
      textPresets: strings(j['text_presets'])
          .where((s) => s.trim().isNotEmpty)
          .toList(),
      defaultFont: j['default_font'] as String? ?? 'ArefRuqaa',
      defaultTextColor:
          AppColors.parse(j['default_text_color'] as String? ?? '#E8C873'),
      defaultTextPosition:
          TextPosition.fromId(j['default_text_position'] as String?),
      isPremium: j['is_premium'] as bool? ?? false,
      creditsCost: (j['credits_cost'] as num?)?.toInt() ?? 1,
      activeFrom: _date(j['active_from']),
      activeTo: _date(j['active_to']),
      sortPriority: (j['sort_priority'] as num?)?.toInt() ?? 0,
      isFeatured: j['is_featured'] as bool? ?? false,
    );
  }
}
