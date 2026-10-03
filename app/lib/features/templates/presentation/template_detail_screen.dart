import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../../settings/application/app_settings.dart';
import '../data/template_repository.dart';
import '../domain/occasion_template.dart';

class TemplateDetailScreen extends ConsumerStatefulWidget {
  const TemplateDetailScreen({super.key, required this.templateId});
  final String templateId;

  @override
  ConsumerState<TemplateDetailScreen> createState() => _TemplateDetailScreenState();
}

class _TemplateDetailScreenState extends ConsumerState<TemplateDetailScreen> {
  GenderVariant? _gender;
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(templateByIdProvider(widget.templateId));
    return Scaffold(
      appBar: AppBar(actions: const [Padding(padding: EdgeInsetsDirectional.only(end: 12), child: CreditsBadge())]),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorView(message: context.tr('تعذّر تحميل القالب', 'Could not load template')),
        data: (t) {
          if (t == null) return ErrorView(message: context.tr('هذا القالب لم يعد متاحاً', 'Template unavailable'));
          final gender = _gender ?? (t.genderVariant == GenderVariant.unisex ? GenderVariant.male : t.genderVariant);
          final samples = t.sampleImages.isNotEmpty ? t.sampleImages.length : 4;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              AspectRatio(
                aspectRatio: 4 / 5,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: PageView.builder(
                    itemCount: samples,
                    onPageChanged: (i) => setState(() => _page = i),
                    itemBuilder: (_, i) => t.sampleImages.isNotEmpty
                        ? Image.network(t.sampleImages[i], fit: BoxFit.cover)
                        : TemplateCover(template: t, seed: i, showTitle: false),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  samples,
                  (i) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: i == _page ? AppColors.gold : Colors.white24),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: Text(t.title(context.isArabic), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                ),
                if (t.isPremium) const ProBadge(),
              ]),
              const SizedBox(height: 6),
              Text(context.tr(t.category.titleAr, t.category.titleEn), style: const TextStyle(color: AppColors.gold)),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    const Icon(Icons.toll, color: AppColors.gold),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(context.tr(
                        '${t.creditsCost} رصيد = ٤ صور مختلفة لك',
                        '${t.creditsCost} credit = 4 variations',
                      )),
                    ),
                  ]),
                ),
              ),
              if (t.genderVariant == GenderVariant.unisex) ...[
                const SizedBox(height: 16),
                SegmentedButton<GenderVariant>(
                  segments: [
                    ButtonSegment(value: GenderVariant.male, label: Text(context.tr('رجل', 'Man')), icon: const Icon(Icons.man)),
                    ButtonSegment(value: GenderVariant.female, label: Text(context.tr('امرأة', 'Woman')), icon: const Icon(Icons.woman)),
                  ],
                  selected: {gender},
                  onSelectionChanged: (s) => setState(() => _gender = s.first),
                ),
              ],
              if (t.textPresets.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(context.tr('عبارات مقترحة', 'Suggested greetings'), style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final p in t.textPresets)
                    Chip(label: Text(p, style: const TextStyle(fontFamily: 'Amiri', fontSize: 16))),
                ]),
              ],
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () {
                  final consent = ref.read(appSettingsProvider).consentAccepted;
                  final target = '/upload/${t.id}?gender=${gender.name}';
                  consent ? context.push(target) : context.push('/consent', extra: target);
                },
                icon: const Icon(Icons.auto_awesome),
                label: Text(context.tr('استخدم هذا القالب', 'Use this template')),
              ),
            ],
          );
        },
      ),
    );
  }
}
