import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/credits/data/credits_repository.dart';
import '../../features/templates/domain/occasion_template.dart';
import '../art/occasion_art.dart';
import '../l10n/tr.dart';
import '../theme/app_colors.dart';

/// Template cover: sample image when available, procedural art otherwise.
class TemplateCover extends StatelessWidget {
  const TemplateCover({super.key, required this.template, this.seed = 0, this.showTitle = true});
  final OccasionTemplate template;
  final int seed;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final url = template.coverImageUrl;
    return Stack(
      fit: StackFit.expand,
      children: [
        CustomPaint(
          painter: OccasionArtPainter(
              motif: template.coverStyle.motif, colors: template.coverStyle.colors, seed: seed),
        ),
        if (url.isNotEmpty)
          Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
        if (url.isEmpty)
          Align(
            alignment: const Alignment(0, .15),
            child: Icon(Icons.person, size: 64, color: Colors.white.withValues(alpha: .18)),
          ),
        if (showTitle)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 24, 10, 10),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xCC000000)],
                ),
              ),
              child: Text(
                template.title(context.isArabic),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
              ),
            ),
          ),
        if (template.isPremium)
          const PositionedDirectional(top: 8, start: 8, child: ProBadge()),
      ],
    );
  }
}

class ProBadge extends StatelessWidget {
  const ProBadge({super.key});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(gradient: AppColors.goldGradient, borderRadius: BorderRadius.circular(10)),
        child: const Text('PRO', style: TextStyle(color: AppColors.night, fontWeight: FontWeight.w900, fontSize: 11)),
      );
}

class CreditsBadge extends ConsumerWidget {
  const CreditsBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(creditStateProvider).value;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => context.push('/store'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.gold.withValues(alpha: .6)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(s?.isPro == true ? Icons.workspace_premium : Icons.toll, color: AppColors.gold, size: 18),
          const SizedBox(width: 6),
          Text(
            s == null ? '…' : (s.isPro ? 'PRO' : '${s.balance}'),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ]),
      ),
    );
  }
}

class GoldText extends StatelessWidget {
  const GoldText(this.text, {super.key, this.style});
  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: AppColors.goldGradient.createShader,
        child: Text(text, style: (style ?? const TextStyle()).copyWith(color: Colors.white), textAlign: TextAlign.center),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, size: 48, color: AppColors.gold),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: Text(context.tr('إعادة المحاولة', 'Retry'))),
            ],
          ]),
        ),
      );
}
