import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/services/service_providers.dart';
import '../../../../core/services/tts_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/clock.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../medications/domain/dose_schedule.dart';
import '../../../medications/domain/medication.dart';
import '../../../medications/presentation/labels.dart';
import '../../../medications/presentation/widgets/med_photo.dart';
import '../../data/elder_home_providers.dart';
import '../elder_dose_controller.dart';
import '../widgets/dose_action_card.dart';

/// "أدويتي اليوم": the dose to act on now, then the rest of today.
class ElderMedsScreen extends ConsumerStatefulWidget {
  const ElderMedsScreen({super.key});

  @override
  ConsumerState<ElderMedsScreen> createState() => _ElderMedsScreenState();
}

class _ElderMedsScreenState extends ConsumerState<ElderMedsScreen> {
  bool _spoken = false;
  late final TtsService _tts;

  void _speak(String text) => _tts.speak(text);

  @override
  void initState() {
    super.initState();
    _tts = ref.read(ttsServiceProvider);
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  Future<void> _act(ScheduledDose dose, DoseStatus status) async {
    final l = AppLocalizations.of(context);
    final ok = await runWithFeedback(context, () => ref.read(elderDoseControllerProvider).act(dose, status));
    if (!ok || !mounted) return;
    final msg = status == DoseStatus.taken ? l.takenThanks : l.laterOk;
    showSnack(context, msg);
    _speak(msg);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final doses = ref.watch(myTodayDosesProvider);
    final now = ref.watch(nowProvider).value ?? DateTime.now();
    final current = doses == null ? null : currentDose(doses, now);

    if (!_spoken && doses != null) {
      _spoken = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _speak(current == null ? l.allDosesDone : doseSpeech(l, current));
      });
    }

    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        final theme = Theme.of(context);
        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 80,
            title: Text(l.myMedsToday, style: theme.textTheme.titleLarge),
            leading: IconButton(
              iconSize: 40,
              icon: const BackButtonIcon(),
              onPressed: () => Navigator.pop(context),
            ),
            actions: [
              IconButton(
                iconSize: 44,
                tooltip: l.listen,
                icon: const Icon(Icons.volume_up_rounded),
                onPressed: () => _speak(current == null ? l.allDosesDone : doseSpeech(l, current)),
              ),
            ],
          ),
          body: SafeArea(
            child: doses == null
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (current == null)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 48),
                          child: Column(
                            children: [
                              const Icon(Icons.verified_rounded, size: 120, color: BarrColors.ok),
                              const SizedBox(height: 16),
                              Text(
                                doses.isEmpty ? l.medsComingSoon : l.allDosesDone,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.headlineMedium,
                              ),
                            ],
                          ),
                        )
                      else
                        DoseActionCard(
                          dose: current,
                          now: now,
                          onTaken: () => _act(current, DoseStatus.taken),
                          onLater: () => _act(current, DoseStatus.snoozed),
                        ),
                      const SizedBox(height: 24),
                      for (final d in doses)
                        if (d.id != current?.id) _DoseRow(dose: d, now: now, onTaken: () => _act(d, DoseStatus.taken)),
                    ],
                  ),
          ),
        );
      }),
    );
  }
}

class _DoseRow extends StatelessWidget {
  const _DoseRow({required this.dose, required this.now, required this.onTaken});

  final ScheduledDose dose;
  final DateTime now;
  final VoidCallback onTaken;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final state = dose.stateAt(now);
    final canTake = state == DoseState.missed || state == DoseState.due || state == DoseState.snoozed;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              MedPhoto(url: dose.medication.photoUrl, size: 72, radius: 16),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(dose.medication.name, style: theme.textTheme.titleLarge),
                    Text(formatTime(context, dose.at), style: theme.textTheme.bodyLarge),
                  ],
                ),
              ),
              if (canTake)
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: BarrColors.ok,
                    minimumSize: const Size(110, 72),
                    textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  onPressed: onTaken,
                  child: Text(l.takenIt),
                )
              else
                Semantics(
                  label: state.label(l),
                  child: Icon(state.icon, size: 48, color: state.color(theme.colorScheme)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
