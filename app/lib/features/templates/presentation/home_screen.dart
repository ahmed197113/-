import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../../settings/application/app_settings.dart';
import '../application/template_filter.dart';
import '../data/template_repository.dart';
import '../domain/occasion_template.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  TemplateCategory? _category;
  String _query = '';
  bool _searching = false;

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(appSettingsProvider);
    final async = ref.watch(allTemplatesProvider);
    final country = kCountries[settings.country];
    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: _searching
            ? TextField(
                autofocus: true,
                decoration: InputDecoration(
                  hintText: context.tr('ابحث عن مناسبة…', 'Search occasions…'),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _query = v),
              )
            : const GoldText('مناسبة', style: TextStyle(fontFamily: 'ArefRuqaa', fontSize: 32, height: 1.3)),
        actions: [
          IconButton(
            tooltip: context.tr('بحث', 'Search'),
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              _query = '';
            }),
          ),
          TextButton(
            onPressed: () => _pickCountry(context),
            child: Text(country?.$3 ?? '🌍', style: const TextStyle(fontSize: 22)),
          ),
          const Padding(padding: EdgeInsetsDirectional.only(end: 12), child: CreditsBadge()),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: context.tr('تعذّر تحميل القوالب', 'Could not load templates'),
          onRetry: () => ref.invalidate(allTemplatesProvider),
        ),
        data: (all) {
          final now = DateTime.now();
          final filter = TemplateFilter(category: _category, country: settings.country, query: _query);
          final items = filter.apply(all, now);
          final seasonal = TemplateFilter.seasonal(all, settings.country, now);
          final trending = TemplateFilter.trending(all, settings.country, now);
          final hero = seasonal.isNotEmpty ? seasonal.first : (trending.isNotEmpty ? trending.first : null);
          final browsing = _category != null || _query.isNotEmpty;
          return RefreshIndicator(
            onRefresh: () => ref.refresh(allTemplatesProvider.future),
            child: CustomScrollView(
              slivers: [
                if (!browsing && hero != null)
                  SliverToBoxAdapter(child: _Hero(template: hero)),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 52,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      children: [
                        _chip(context.tr('الكل', 'All'), _category == null, () => setState(() => _category = null)),
                        for (final c in TemplateCategory.values)
                          _chip(context.tr(c.titleAr, c.titleEn), _category == c, () => setState(() => _category = c)),
                      ],
                    ),
                  ),
                ),
                if (!browsing && trending.isNotEmpty) ...[
                  _sectionTitle(context.tr('🔥 الأكثر رواجاً', '🔥 Trending')),
                  SliverToBoxAdapter(child: _Rail(items: trending)),
                ],
                if (!browsing && seasonal.length > 1) ...[
                  _sectionTitle(context.tr('✨ جديد هذا الموسم', '✨ New this season')),
                  SliverToBoxAdapter(child: _Rail(items: seasonal)),
                ],
                _sectionTitle(browsing ? context.tr('النتائج', 'Results') : context.tr('كل القوالب', 'All templates')),
                if (items.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(context.tr('لا توجد قوالب مطابقة', 'No matching templates'), textAlign: TextAlign.center),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 4 / 5,
                    ),
                    itemCount: items.length,
                    itemBuilder: (context, i) => _Tile(template: items[i]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap(), showCheckmark: false),
      );

  Widget _sectionTitle(String text) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Text(text, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        ),
      );

  void _pickCountry(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => ListView(
        children: [
          for (final e in kCountries.entries)
            ListTile(
              leading: Text(e.value.$3, style: const TextStyle(fontSize: 24)),
              title: Text(ctx.tr(e.value.$1, e.value.$2)),
              trailing: ref.read(appSettingsProvider).country == e.key ? const Icon(Icons.check, color: AppColors.gold) : null,
              onTap: () {
                ref.read(appSettingsProvider.notifier).setCountry(e.key);
                Navigator.pop(ctx);
              },
            ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.template});
  final OccasionTemplate template;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
      child: GestureDetector(
        onTap: () => context.push('/template/${template.id}'),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(fit: StackFit.expand, children: [
              TemplateCover(template: template, seed: 5, showTitle: false),
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.centerEnd,
                    end: AlignmentDirectional.centerStart,
                    colors: [Colors.transparent, Color(0xBB000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(context.tr('موسم الآن', 'In season'), style: const TextStyle(color: AppColors.goldLight, fontWeight: FontWeight.w700)),
                    Text(template.title(context.isArabic),
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 10),
                    FilledButton(
                      style: FilledButton.styleFrom(minimumSize: const Size(140, 42)),
                      onPressed: () => context.push('/template/${template.id}'),
                      child: Text(context.tr('صمّم صورتك', 'Create yours')),
                    ),
                  ],
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({required this.items});
  final List<OccasionTemplate> items;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 190,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (context, i) => SizedBox(width: 150, child: _Tile(template: items[i])),
        ),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.template});
  final OccasionTemplate template;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => context.push('/template/${template.id}'),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: TemplateCover(template: template),
        ),
      );
}
