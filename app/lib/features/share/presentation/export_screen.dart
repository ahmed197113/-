import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/rating_prompt.dart';
import '../../credits/data/credits_repository.dart';
import '../data/share_service.dart';

class ExportScreen extends ConsumerStatefulWidget {
  const ExportScreen({super.key, required this.path});
  final String path;

  @override
  ConsumerState<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends ConsumerState<ExportScreen> {
  final _share = ShareService();
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _save(silent: true));
  }

  Future<void> _save({bool silent = false}) async {
    final ok = await _share.saveToGallery(widget.path);
    if (!mounted) return;
    setState(() => _saved = ok);
    if (ok) {
      HapticFeedback.mediumImpact();
      maybeAskForRating(ref);
    }
    if (!silent || !ok) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok
            ? context.tr('حُفظت في معرض الصور ✨', 'Saved to your gallery ✨')
            : context.tr('اسمح بالوصول للصور لحفظها في المعرض', 'Allow photo access to save')),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final credits = ref.watch(creditStateProvider).value;
    final caption = (credits?.isPro ?? false) ? '' : 'صُنعت بتطبيق مناسبة ✨';
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('شارك فرحتك', 'Share your moment')),
        actions: [
          IconButton(
            tooltip: context.tr('الرئيسية', 'Home'),
            onPressed: () => context.go('/home'),
            icon: const Icon(Icons.home_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Image.file(File(widget.path), fit: BoxFit.contain),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(_saved ? Icons.check_circle : Icons.info_outline, color: _saved ? AppColors.success : AppColors.gold, size: 18),
              const SizedBox(width: 6),
              Text(_saved
                  ? context.tr('محفوظة في معرض الصور', 'Saved to gallery')
                  : context.tr('لم تُحفظ بعد في المعرض', 'Not saved to gallery yet')),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            children: [
              for (final t in ShareTarget.values.where((t) => t != ShareTarget.other))
                _ShareButton(
                  target: t,
                  onTap: () => _share.share(widget.path, t, caption: caption),
                ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => _share.share(widget.path, ShareTarget.other, caption: caption),
            icon: const Icon(Icons.share),
            label: Text(context.tr('مشاركة', 'Share')),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _saved ? null : () => _save(),
            icon: const Icon(Icons.download),
            label: Text(context.tr('حفظ في المعرض', 'Save to gallery')),
          ),
          if (credits != null && !credits.isPro) ...[
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.workspace_premium, color: AppColors.gold),
                title: Text(context.tr('صور بدقة 4K وبدون علامة مائية', '4K exports, no watermark')),
                subtitle: Text(context.tr('اشترك في Pro الأسبوعي', 'Go Pro weekly')),
                onTap: () => context.push('/store'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ShareButton extends StatelessWidget {
  const _ShareButton({required this.target, required this.onTap});
  final ShareTarget target;
  final VoidCallback onTap;

  static const _colors = {
    ShareTarget.whatsapp: Color(0xFF25D366),
    ShareTarget.snapchat: Color(0xFFFFFC00),
    ShareTarget.instagramStory: Color(0xFFE1306C),
    ShareTarget.tiktok: Color(0xFF111111),
  };
  static const _icons = {
    ShareTarget.whatsapp: Icons.chat,
    ShareTarget.snapchat: Icons.camera_alt,
    ShareTarget.instagramStory: Icons.camera,
    ShareTarget.tiktok: Icons.music_note,
  };

  @override
  Widget build(BuildContext context) {
    final c = _colors[target]!;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: c,
            child: Icon(_icons[target], color: c.computeLuminance() > .5 ? Colors.black : Colors.white),
          ),
          const SizedBox(height: 6),
          Text(context.tr(target.labelAr, target.labelEn),
              textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
        ],
      ),
    );
  }
}
