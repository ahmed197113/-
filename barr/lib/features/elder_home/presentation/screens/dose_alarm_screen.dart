import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/services/reminder_scheduler.dart';
import '../../../../core/services/service_providers.dart';
import '../../../../core/services/tts_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/clock.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../medications/domain/medication.dart';
import '../../data/elder_home_providers.dart';
import '../elder_dose_controller.dart';
import '../widgets/dose_action_card.dart';

/// Full-screen alarm opened from a reminder (also over the lock screen).
/// Reads the medicine aloud every 20 seconds until the parent responds.
class DoseAlarmScreen extends ConsumerStatefulWidget {
  const DoseAlarmScreen({super.key, required this.doseId});

  final String doseId;

  @override
  ConsumerState<DoseAlarmScreen> createState() => _DoseAlarmScreenState();
}

class _DoseAlarmScreenState extends ConsumerState<DoseAlarmScreen> {
  Timer? _repeat;
  late final TtsService _tts;
  late final ReminderScheduler _scheduler;

  @override
  void initState() {
    super.initState();
    _tts = ref.read(ttsServiceProvider);
    _scheduler = ref.read(reminderSchedulerProvider);
  }

  @override
  void dispose() {
    _repeat?.cancel();
    _tts.stop();
    _scheduler.releaseLockScreen();
    super.dispose();
  }

  void _startSpeaking(String text) {
    if (_repeat != null) return;
    _tts.speak(text);
    _repeat = Timer.periodic(const Duration(seconds: 20), (_) => _tts.speak(text));
  }

  void _close() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.elderHome);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final doses = ref.watch(myTodayDosesProvider);
    final now = ref.watch(nowProvider).value ?? DateTime.now();
    final dose = doses?.where((d) => d.id == widget.doseId).firstOrNull;

    if (dose != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _startSpeaking(doseSpeech(l, dose));
      });
    }

    Future<void> act(DoseStatus status) async {
      _repeat?.cancel();
      final ok = await runWithFeedback(context, () => ref.read(elderDoseControllerProvider).act(dose!, status));
      if (!ok || !mounted) return;
      _tts.speak(status == DoseStatus.taken ? l.takenThanks : l.laterOk);
      _close();
    }

    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        final theme = Theme.of(context);
        return Scaffold(
          backgroundColor: const Color(0xFFFFF4E5),
          body: SafeArea(
            child: doses == null
                ? const Center(child: CircularProgressIndicator())
                : dose == null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: FilledButton(onPressed: _close, child: Text(l.close)),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          const Icon(Icons.alarm_rounded, size: 72, color: BarrColors.warm),
                          Text(l.doseTimeNow, textAlign: TextAlign.center, style: theme.textTheme.displaySmall),
                          const SizedBox(height: 16),
                          DoseActionCard(
                            dose: dose,
                            now: now,
                            photoSize: 180,
                            onTaken: () => act(DoseStatus.taken),
                            onLater: () => act(DoseStatus.snoozed),
                          ),
                          if (dose.log?.status == DoseStatus.taken) ...[
                            const SizedBox(height: 16),
                            FilledButton(onPressed: _close, child: Text(l.close)),
                          ],
                        ],
                      ),
          ),
        );
      }),
    );
  }
}
