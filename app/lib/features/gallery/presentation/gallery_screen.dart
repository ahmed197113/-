import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/arabic_text.dart';
import '../../../core/utils/files.dart';
import '../../editor/presentation/editor_screen.dart';
import '../data/gallery_repository.dart';
import '../domain/gallery_item.dart';

class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key});

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen> {
  bool _favoritesOnly = false;

  @override
  Widget build(BuildContext context) {
    final all = ref.watch(galleryProvider);
    final items = _favoritesOnly ? all.where((i) => i.favorite).toList() : all;
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('معرضي', 'My gallery')),
        actions: [
          IconButton(
            tooltip: context.tr('المفضلة', 'Favorites'),
            onPressed: () => setState(() => _favoritesOnly = !_favoritesOnly),
            icon: Icon(_favoritesOnly ? Icons.favorite : Icons.favorite_border, color: _favoritesOnly ? AppColors.danger : null),
          ),
        ],
      ),
      body: Column(children: [
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(children: [
            const Icon(Icons.timer_outlined, color: AppColors.gold),
            const SizedBox(width: 8),
            Expanded(
              child: Text(context.tr(
                'نحتفظ بصورك ٣٠ يوماً فقط ثم تُحذف تلقائياً. احفظ ما تحب في معرض هاتفك.',
                'Results are kept for 30 days only. Save your favourites to your phone.',
              )),
            ),
          ]),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.photo_library_outlined, size: 64, color: AppColors.gold),
                    const SizedBox(height: 12),
                    Text(context.tr('لا توجد صور بعد', 'No photos yet')),
                    const SizedBox(height: 12),
                    FilledButton(
                      style: FilledButton.styleFrom(minimumSize: const Size(180, 48)),
                      onPressed: () => context.go('/home'),
                      child: Text(context.tr('صمّم أول صورة', 'Create your first')),
                    ),
                  ]),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 9 / 14,
                  ),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _Tile(item: items[i], now: now),
                ),
        ),
      ]),
    );
  }
}

class _Tile extends ConsumerWidget {
  const _Tile({required this.item, required this.now});
  final GalleryItem item;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = item.daysLeft(now);
    final label = context.isArabic ? '${ArabicText.toArabicIndicDigits('$days')} يوم' : '${days}d';
    return GestureDetector(
      onTap: () => _open(context, ref),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(fit: StackFit.expand, children: [
          Image(image: imageFor(item.uri), fit: BoxFit.cover, errorBuilder: (_, _, _) => const ColoredBox(color: Colors.black26)),
          PositionedDirectional(
            bottom: 4,
            start: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
              child: Text(label, style: TextStyle(fontSize: 11, color: days <= 3 ? AppColors.danger : Colors.white)),
            ),
          ),
          if (item.favorite)
            const PositionedDirectional(top: 4, end: 4, child: Icon(Icons.favorite, color: AppColors.danger, size: 18)),
          if (item.edited)
            const PositionedDirectional(top: 4, start: 4, child: Icon(Icons.text_fields, color: AppColors.gold, size: 18)),
        ]),
      ),
    );
  }

  void _open(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.share),
            title: Text(ctx.tr('مشاركة / حفظ', 'Share / save')),
            onTap: () async {
              Navigator.pop(ctx);
              final path = await ensureLocalFile(item.uri);
              if (context.mounted) context.push('/export', extra: path);
            },
          ),
          ListTile(
            leading: const Icon(Icons.text_fields),
            title: Text(ctx.tr('إضافة نص', 'Add text')),
            onTap: () {
              Navigator.pop(ctx);
              context.push('/editor', extra: EditorArgs(imageUri: item.uri, templateId: item.templateId, jobId: item.jobId));
            },
          ),
          ListTile(
            leading: Icon(item.favorite ? Icons.favorite : Icons.favorite_border),
            title: Text(ctx.tr('المفضلة', 'Favorite')),
            onTap: () {
              ref.read(galleryProvider.notifier).toggleFavorite(item.id);
              Navigator.pop(ctx);
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline, color: AppColors.danger),
            title: Text(ctx.tr('حذف', 'Delete'), style: const TextStyle(color: AppColors.danger)),
            onTap: () {
              ref.read(galleryProvider.notifier).remove(item.id);
              Navigator.pop(ctx);
            },
          ),
        ]),
      ),
    );
  }
}
