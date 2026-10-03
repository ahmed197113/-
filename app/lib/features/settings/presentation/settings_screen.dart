import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/env.dart';
import '../../../core/config/providers.dart';
import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/arabic_text.dart';
import '../../auth/data/auth_repository.dart';
import '../../credits/data/credits_repository.dart';
import '../../gallery/data/gallery_repository.dart';
import '../application/app_settings.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  String _referralCode(String? uid) {
    final base = (uid ?? 'guest').replaceAll(RegExp('[^A-Za-z0-9]'), '').toUpperCase();
    return base.length >= 6 ? base.substring(0, 6) : base.padRight(6, 'X');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(appSettingsProvider);
    final auth = ref.watch(authRepositoryProvider);
    final credits = ref.watch(creditStateProvider).value;
    final code = _referralCode(auth.uid);
    final firebase = ref.watch(firebaseEnabledProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.tr('حسابي', 'Profile'))),
      body: ListView(
        children: [
          _header(context, context.tr('الحساب', 'Account')),
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: Text(auth.isAnonymous ? context.tr('ضيف', 'Guest') : context.tr('حساب مسجّل', 'Signed in')),
            subtitle: auth.isAnonymous
                ? Text(context.tr('سجّل لحفظ رصيدك على أكثر من جهاز', 'Sign in to keep credits across devices'))
                : null,
            trailing: auth.isAnonymous && firebase ? const Icon(Icons.chevron_left) : null,
            onTap: auth.isAnonymous && firebase ? () => context.push('/auth') : null,
          ),
          ListTile(
            leading: const Icon(Icons.history),
            title: Text(context.tr('سجل الرصيد', 'Credit history')),
            onTap: () => _history(context, ref),
          ),
          _header(context, context.tr('ادعُ صديقاً', 'Invite friends')),
          ListTile(
            leading: const Icon(Icons.card_giftcard, color: AppColors.gold),
            title: Text(context.tr('٥ صور مجانية لك ولصديقك', '5 free credits for you and your friend')),
            subtitle: Text(context.tr('رمزك: $code', 'Your code: $code')),
            trailing: const Icon(Icons.share),
            onTap: () => SharePlus.instance.share(ShareParams(
              text: 'صمّم صورتك للعيد مع اسمك بخط عربي جميل 🌙 حمّل تطبيق مناسبة واستخدم رمزي $code لتحصل على ٥ صور مجاناً\nhttps://munasaba.app/r/$code',
            )),
          ),
          _header(context, context.tr('التفضيلات', 'Preferences')),
          ListTile(
            leading: const Icon(Icons.language),
            title: Text(context.tr('اللغة', 'Language')),
            trailing: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'ar', label: Text('عربي')),
                ButtonSegment(value: 'en', label: Text('EN')),
              ],
              selected: {s.locale.languageCode},
              onSelectionChanged: (v) => ref.read(appSettingsProvider.notifier).setLocale(v.first),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.flag_outlined),
            title: Text(context.tr('الدولة', 'Country')),
            trailing: Text('${kCountries[s.country]?.$3 ?? ''} ${context.tr(kCountries[s.country]?.$1 ?? s.country, kCountries[s.country]?.$2 ?? s.country)}'),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              builder: (ctx) => ListView(children: [
                for (final e in kCountries.entries)
                  ListTile(
                    leading: Text(e.value.$3, style: const TextStyle(fontSize: 22)),
                    title: Text(ctx.tr(e.value.$1, e.value.$2)),
                    onTap: () {
                      ref.read(appSettingsProvider.notifier).setCountry(e.key);
                      Navigator.pop(ctx);
                    },
                  ),
              ]),
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode_outlined),
            title: Text(context.tr('الوضع الليلي', 'Dark mode')),
            value: s.themeMode != ThemeMode.light,
            onChanged: (v) => ref.read(appSettingsProvider.notifier).setThemeMode(v ? ThemeMode.dark : ThemeMode.light),
          ),
          _header(context, context.tr('الخصوصية', 'Privacy')),
          ListTile(
            leading: const Icon(Icons.policy_outlined),
            title: Text(context.tr('سياسة الخصوصية والشروط', 'Privacy policy & terms')),
            onTap: () => context.push('/privacy'),
          ),
          ListTile(
            leading: const Icon(Icons.delete_sweep_outlined),
            title: Text(context.tr('احذف كل صوري الآن', 'Delete all my photos now')),
            onTap: () => _confirm(
              context,
              context.tr('سيتم حذف كل صورك نهائياً من الجهاز والخادم.', 'All your photos will be permanently deleted.'),
              () async {
                ref.read(galleryProvider.notifier).clear();
                if (firebase) {
                  await FirebaseFunctions.instanceFor(region: Env.functionsRegion).httpsCallable('deleteMyPhotos').call<void>();
                }
              },
            ),
          ),
          ListTile(
            leading: const Icon(Icons.person_remove_outlined, color: AppColors.danger),
            title: Text(context.tr('حذف الحساب', 'Delete account'), style: const TextStyle(color: AppColors.danger)),
            onTap: () => _confirm(
              context,
              context.tr('سيُحذف حسابك وكل بياناتك وصورك ورصيدك نهائياً ولا يمكن التراجع.',
                  'Your account, photos and credits will be permanently deleted.'),
              () async {
                if (firebase) {
                  await FirebaseFunctions.instanceFor(region: Env.functionsRegion).httpsCallable('deleteAccount').call<void>();
                }
                ref.read(galleryProvider.notifier).clear();
                final prefs = ref.read(sharedPrefsProvider);
                await prefs.clear();
                await auth.signOut();
                ref.invalidate(appSettingsProvider);
                ref.invalidate(creditsRepositoryProvider);
                if (context.mounted) context.go('/onboarding');
              },
            ),
          ),
          _header(context, context.tr('الدعم', 'Support')),
          if (Env.supportWhatsApp.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.chat_outlined),
              title: Text(context.tr('تواصل عبر واتساب', 'WhatsApp support')),
              onTap: () => launchUrl(Uri.parse('https://wa.me/${Env.supportWhatsApp}'), mode: LaunchMode.externalApplication),
            ),
          ListTile(
            leading: const Icon(Icons.email_outlined),
            title: Text(context.tr('راسلنا', 'Email us')),
            subtitle: Text(Env.supportEmail),
            onTap: () => launchUrl(Uri(scheme: 'mailto', path: Env.supportEmail)),
          ),
          ListTile(
            leading: const Icon(Icons.star_outline),
            title: Text(context.tr('قيّم التطبيق', 'Rate the app')),
            onTap: () => launchUrl(Uri.parse('https://play.google.com/store/apps/details?id=com.munasaba.munasaba'),
                mode: LaunchMode.externalApplication),
          ),
          if (credits?.isDemo ?? false)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                context.tr('وضع تجريبي — غير متصل بالخادم', 'Demo mode — no backend connected'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _header(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
        child: Text(text, style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800)),
      );

  Future<void> _confirm(BuildContext context, String message, Future<void> Function() action) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ctx.tr('هل أنت متأكد؟', 'Are you sure?')),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.tr('إلغاء', 'Cancel'))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.tr('حذف', 'Delete'), style: const TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await action();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.tr('تم الحذف', 'Deleted'))));
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.tr('تعذّر الحذف، تحقق من الإنترنت', 'Could not delete, check connection'))));
      }
    }
  }

  void _history(BuildContext context, WidgetRef ref) {
    final h = ref.read(creditStateProvider).value?.history ?? const [];
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => h.isEmpty
          ? Center(child: Text(ctx.tr('لا توجد عمليات بعد', 'No transactions yet')))
          : ListView(children: [
              for (final t in h)
                ListTile(
                  leading: Icon(t.amount >= 0 ? Icons.add_circle_outline : Icons.remove_circle_outline,
                      color: t.amount >= 0 ? AppColors.success : AppColors.gold),
                  title: Text(_txLabel(ctx, t.type.name, t.note)),
                  subtitle: Text('${t.createdAt.year}/${t.createdAt.month}/${t.createdAt.day}'),
                  trailing: Text(
                    ctx.isArabic ? ArabicText.toArabicIndicDigits('${t.amount > 0 ? '+' : ''}${t.amount}') : '${t.amount}',
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
            ]),
    );
  }

  String _txLabel(BuildContext c, String type, String note) {
    if (note.isNotEmpty && note != 'pro') return note;
    return switch (type) {
      'signupBonus' => c.tr('هدية التسجيل', 'Signup bonus'),
      'purchase' => c.tr('شراء رصيد', 'Purchase'),
      'subscription' => c.tr('اشتراك Pro', 'Pro subscription'),
      'generation' => c.tr('إنشاء صور', 'Generation'),
      'refund' => c.tr('استرداد تلقائي', 'Auto refund'),
      'referral' => c.tr('مكافأة دعوة', 'Referral reward'),
      'rewardedAd' => c.tr('إعلان بمكافأة', 'Rewarded ad'),
      _ => c.tr('رصيد', 'Credit'),
    };
  }
}
