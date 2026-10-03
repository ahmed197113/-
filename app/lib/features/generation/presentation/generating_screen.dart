import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/art/occasion_art.dart';
import '../../../core/l10n/tr.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/common.dart';
import '../data/generation_repository.dart';
import '../domain/generation_job.dart';

class GeneratingScreen extends ConsumerStatefulWidget {
  const GeneratingScreen({super.key, required this.jobId});
  final String jobId;

  @override
  ConsumerState<GeneratingScreen> createState() => _GeneratingScreenState();
}

class _GeneratingScreenState extends ConsumerState<GeneratingScreen> with SingleTickerProviderStateMixin {
  late final _anim = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
  bool _navigated = false;

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(jobProvider(widget.jobId), (_, next) {
      final job = next.value;
      if (job?.status == JobStatus.done && !_navigated) {
        _navigated = true;
        HapticFeedback.heavyImpact();
        context.pushReplacement('/results/${widget.jobId}');
      }
    });
    final job = ref.watch(jobProvider(widget.jobId)).value;
    final failed = job?.status == JobStatus.failed;
    final progress = job?.progress ?? 0;
    final messages = [
      context.tr('نجهّز الإضاءة…', 'Setting up the lights…'),
      context.tr('نختار أجمل زيّ للمناسبة…', 'Picking the perfect outfit…'),
      context.tr('نحافظ على ملامحك الحقيقية…', 'Preserving your real features…'),
      context.tr('اللمسات الأخيرة ✨', 'Final touches ✨'),
    ];
    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false, actions: [
        IconButton(onPressed: () => context.go('/home'), icon: const Icon(Icons.close)),
      ]),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: failed
            ? ErrorView(
                message: job?.errorAr ?? context.tr('حدث خطأ، أُعيد رصيدك.', 'Something went wrong; credits refunded.'),
                onRetry: () => context.pop(),
              )
            : Column(
                children: [
                  Expanded(
                    child: AnimatedBuilder(
                      animation: _anim,
                      builder: (_, _) => CustomPaint(
                        size: Size.infinite,
                        painter: _LanternLoader(_anim.value),
                      ),
                    ),
                  ),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 400),
                    child: Text(
                      messages[(progress * (messages.length - 1)).floor().clamp(0, messages.length - 1)],
                      key: ValueKey((progress * 3).floor()),
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: progress == 0 ? null : progress,
                      minHeight: 10,
                      color: AppColors.gold,
                      backgroundColor: AppColors.gold.withValues(alpha: .15),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    context.tr('يمكنك مغادرة الشاشة، سنرسل لك إشعاراً عندما تجهز صورك.',
                        "You can leave — we'll notify you when your photos are ready."),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white60),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
      ),
    );
  }
}

class _LanternLoader extends CustomPainter {
  const _LanternLoader(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final swing = math.sin(t * math.pi * 2) * .12;
    final h = math.min(size.height * .7, size.width * .8);
    canvas.save();
    canvas.translate(size.width / 2, 0);
    OccasionArt.lantern(canvas, Offset(0, size.height * .12), h, AppColors.gold, swing: swing);
    canvas.restore();
    for (var i = 0; i < 12; i++) {
      final a = i / 12 * math.pi * 2 + t * math.pi * 2;
      final p = Offset(size.width / 2, size.height * .55) + Offset(math.cos(a), math.sin(a)) * (h * .6);
      final o = (math.sin(t * math.pi * 2 + i) + 1) / 2;
      OccasionArt.star(canvas, p, 4 + o * 4, AppColors.goldLight.withValues(alpha: .4 + o * .6));
    }
  }

  @override
  bool shouldRepaint(_LanternLoader old) => old.t != t;
}
