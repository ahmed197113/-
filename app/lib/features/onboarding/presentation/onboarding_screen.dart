import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/art/occasion_art.dart';
import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../../settings/application/app_settings.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  void _finish() {
    ref.read(appSettingsProvider.notifier).completeOnboarding();
    context.go('/auth');
  }

  @override
  Widget build(BuildContext context) {
    final slides = [
      (
        'lantern',
        [const Color(0xFF1B1035), AppColors.gold, const Color(0xFF6B3FA0)],
        context.tr('صورتك لكل مناسبة', 'Your photo for every occasion'),
        context.tr('ارفع سيلفي واختر المناسبة، واحصل على صور احترافية لك خلال ثوانٍ.',
            'Upload a selfie, pick an occasion, get pro portraits in seconds.'),
      ),
      (
        'crescent',
        [AppColors.night, AppColors.gold, const Color(0xFF2B3F66)],
        context.tr('خط عربي صحيح ١٠٠٪', '100% correct Arabic text'),
        context.tr('اكتب اسمك وتهنئتك بخطوط عربية فاخرة — حروف متصلة وسليمة دائماً.',
            'Add your name in beautiful Arabic calligraphy — always perfectly connected.'),
      ),
      (
        'stars',
        [const Color(0xFF0A0A0A), const Color(0xFFD4AF37), const Color(0xFF3A2E0B)],
        context.tr('خصوصيتك أولاً', 'Your privacy first'),
        context.tr('صورك تُحذف تلقائياً خلال ٢٤ ساعة، ولا تُستخدم أبداً للتدريب أو تُباع.',
            'Selfies auto-delete within 24h. Never used for training, never sold.'),
      ),
    ];
    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: slides.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final (motif, colors, title, body) = slides[i];
              return Stack(fit: StackFit.expand, children: [
                CustomPaint(painter: OccasionArtPainter(motif: motif, colors: colors, seed: i)),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(28, 0, 28, 140),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (i == 1)
                          const GoldText('عيدكم مبارك',
                              style: TextStyle(fontFamily: 'ArefRuqaa', fontSize: 56, height: 1.6)),
                        if (i == 0) const Icon(Icons.auto_awesome, color: AppColors.gold, size: 56),
                        if (i == 2) const Icon(Icons.verified_user, color: AppColors.gold, size: 56),
                        const SizedBox(height: 24),
                        Text(title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        Text(body,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white.withValues(alpha: .85), fontSize: 16, height: 1.6)),
                      ],
                    ),
                  ),
                ),
              ]);
            },
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 32,
            child: SafeArea(
              child: Column(children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    slides.length,
                    (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: i == _page ? 22 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: i == _page ? AppColors.gold : Colors.white38,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _page == slides.length - 1
                      ? _finish
                      : () => _controller.nextPage(duration: const Duration(milliseconds: 350), curve: Curves.easeOut),
                  child: Text(_page == slides.length - 1 ? context.tr('ابدأ الآن', 'Get started') : context.tr('التالي', 'Next')),
                ),
              ]),
            ),
          ),
          PositionedDirectional(
            top: 8,
            end: 8,
            child: SafeArea(
              child: TextButton(
                onPressed: _finish,
                child: Text(context.tr('تخطٍّ', 'Skip'), style: const TextStyle(color: Colors.white70)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
