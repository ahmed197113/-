import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/arabic_text.dart';
import '../../../core/widgets/common.dart';
import '../data/credits_repository.dart';
import '../domain/credits.dart';

class StoreScreen extends ConsumerStatefulWidget {
  const StoreScreen({super.key});

  @override
  ConsumerState<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends ConsumerState<StoreScreen> {
  String? _busy;

  Future<void> _buy(String id, Future<String?> Function(CreditsRepository) action) async {
    setState(() => _busy = id);
    final err = await action(ref.read(creditsRepositoryProvider));
    if (!mounted) return;
    setState(() => _busy = null);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(err ?? context.tr('تمت العملية بنجاح 🎉', 'Done 🎉')),
    ));
  }

  String _n(BuildContext c, int v) => c.isArabic ? ArabicText.toArabicIndicDigits('$v') : '$v';

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(creditStateProvider).value ?? CreditState.empty;
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('المتجر', 'Store'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                Text(context.tr('رصيدك الحالي', 'Your balance')),
                const SizedBox(height: 4),
                GoldText(s.isPro ? 'PRO' : _n(context, s.balance),
                    style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900)),
                if (s.isPro)
                  Text(context.tr(
                    'استخدمت ${_n(context, s.proUsedThisWeek)} من ${_n(context, kProWeeklyFairUse)} هذا الأسبوع',
                    'Used ${s.proUsedThisWeek}/$kProWeeklyFairUse this week',
                  )),
              ]),
            ),
          ),
          if (s.isDemo)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                context.tr('نسخة تجريبية: الشراء هنا محاكاة ولا يتم خصم أي مبلغ.', 'Demo build: purchases are simulated, no charge.'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.goldLight),
              ),
            ),
          const SizedBox(height: 12),
          // Weekly Pro.
          Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF2A1F05), Color(0xFF0F1A2E)]),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.gold, width: 1.5),
            ),
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const ProBadge(),
                const SizedBox(width: 8),
                Text(context.tr('اشتراك أسبوعي', 'Weekly Pro'),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
              ]),
              const SizedBox(height: 12),
              for (final f in [
                context.tr('حتى ٦٠ صورة أسبوعياً', 'Up to 60 images / week'),
                context.tr('بدون علامة مائية', 'No watermark'),
                context.tr('تصدير بدقة 4K', '4K export'),
                context.tr('أولوية في الإنشاء', 'Priority queue'),
                context.tr('كل القوالب المميزة', 'All premium templates'),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    const Icon(Icons.check_circle, color: AppColors.gold, size: 18),
                    const SizedBox(width: 8),
                    Text(f, style: const TextStyle(color: Colors.white)),
                  ]),
                ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy != null || s.isPro ? null : () => _buy('pro', (r) => r.buyPro()),
                child: _busy == 'pro'
                    ? const CircularProgressIndicator()
                    : Text(s.isPro
                        ? context.tr('أنت مشترك ✓', 'Subscribed ✓')
                        : context.tr('اشترك بـ $kProWeeklyFallbackPrice / أسبوع', 'Subscribe $kProWeeklyFallbackPrice / week')),
              ),
              const SizedBox(height: 6),
              Text(
                context.tr('يتجدد أسبوعياً، ويمكنك الإلغاء في أي وقت من Google Play.', 'Renews weekly. Cancel anytime in Google Play.'),
                style: const TextStyle(color: Colors.white60, fontSize: 12),
              ),
            ]),
          ),
          const SizedBox(height: 20),
          Text(context.tr('باقات الرصيد', 'Credit packs'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          for (final p in kCreditPacks)
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
                side: p.highlight ? const BorderSide(color: AppColors.gold, width: 1.5) : BorderSide.none,
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                leading: CircleAvatar(
                  backgroundColor: AppColors.gold.withValues(alpha: .15),
                  child: Text(_n(context, p.credits), style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w900)),
                ),
                title: Row(children: [
                  Text(context.tr(p.titleAr, p.titleEn), style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (p.highlight) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.gold, borderRadius: BorderRadius.circular(8)),
                      child: Text(context.tr('الأكثر طلباً', 'Most popular'),
                          style: const TextStyle(color: AppColors.night, fontSize: 11, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ]),
                subtitle: Text(context.tr('${_n(context, p.credits)} صورة', '${p.credits} images')),
                trailing: _busy == p.productId
                    ? const SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(p.fallbackPrice, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                onTap: _busy != null ? null : () => _buy(p.productId, (r) => r.buyPack(p)),
              ),
            ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => _buy('restore', (r) => r.restore()),
            child: Text(context.tr('استعادة المشتريات', 'Restore purchases')),
          ),
          Text(
            context.tr('الأسعار تختلف حسب بلدك وتظهر بعملتك المحلية عند الدفع.', 'Prices vary by country and show in your local currency.'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Colors.white54),
          ),
        ],
      ),
    );
  }
}
