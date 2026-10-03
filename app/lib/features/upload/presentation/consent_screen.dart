import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../settings/application/app_settings.dart';

/// Explicit consent before the first upload (Play policy, PDPL, GDPR).
class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key, required this.next});
  final String next;

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _own = false;
  bool _adult = false;

  @override
  Widget build(BuildContext context) {
    final points = [
      (Icons.photo_camera_front, context.tr('نستخدم صورك فقط لإنشاء صورك أنت.', 'Your photos are used only to create your images.')),
      (Icons.timer_outlined, context.tr('صور السيلفي تُحذف تلقائياً خلال ٢٤ ساعة.', 'Selfies are auto-deleted within 24 hours.')),
      (Icons.block, context.tr('لا تُستخدم صورك أبداً لتدريب أي نموذج.', 'Never used to train any model.')),
      (Icons.money_off, context.tr('لا نبيع صورك أو بياناتك لأي جهة.', 'Never sold to anyone.')),
      (Icons.delete_forever_outlined, context.tr('يمكنك حذف كل صورك وحسابك في أي وقت.', 'Delete all your photos or account anytime.')),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('خصوصيتك تهمنا', 'Your privacy matters'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(Icons.verified_user, size: 64, color: AppColors.gold),
          const SizedBox(height: 16),
          for (final (icon, text) in points)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Icon(icon, color: AppColors.gold),
                const SizedBox(width: 12),
                Expanded(child: Text(text, style: const TextStyle(fontSize: 16, height: 1.5))),
              ]),
            ),
          const Divider(height: 32),
          CheckboxListTile(
            value: _own,
            onChanged: (v) => setState(() => _own = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(context.tr('أؤكد أن الصور التي سأرفعها هي صوري الشخصية فقط.', 'I confirm I will upload only photos of myself.')),
          ),
          CheckboxListTile(
            value: _adult,
            onChanged: (v) => setState(() => _adult = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(context.tr('عمري ١٨ عاماً أو أكثر، ولن أرفع صور أطفال.', 'I am 18+ and will not upload photos of children.')),
          ),
          TextButton(
            onPressed: () => context.push('/privacy'),
            child: Text(context.tr('اقرأ سياسة الخصوصية كاملة', 'Read the full privacy policy')),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _own && _adult
                ? () {
                    ref.read(appSettingsProvider.notifier).acceptConsent();
                    context.pushReplacement(widget.next);
                  }
                : null,
            child: Text(context.tr('موافق، لنبدأ', 'Agree & continue')),
          ),
        ],
      ),
    );
  }
}
