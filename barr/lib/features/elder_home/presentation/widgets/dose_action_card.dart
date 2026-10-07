import 'package:flutter/material.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../medications/domain/dose_schedule.dart';
import '../../../medications/domain/medication.dart';
import '../../../medications/presentation/labels.dart';
import '../../../medications/presentation/widgets/med_photo.dart';

/// Big card for one dose with "أخذته" / "لاحقًا" (parent UI).
class DoseActionCard extends StatelessWidget {
  const DoseActionCard({
    super.key,
    required this.dose,
    required this.now,
    required this.onTaken,
    required this.onLater,
    this.photoSize = 140,
  });

  final ScheduledDose dose;
  final DateTime now;
  final VoidCallback onTaken;
  final VoidCallback onLater;
  final double photoSize;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final m = dose.medication;
    final state = dose.stateAt(now);
    final actionable = state != DoseState.taken;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: state.color(theme.colorScheme), width: 4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MedPhoto(url: m.photoUrl, size: photoSize, radius: 24),
          const SizedBox(height: 12),
          Text(m.name, textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(m.dose, textAlign: TextAlign.center, style: theme.textTheme.titleLarge),
          if (m.meal != MealInstruction.none)
            Text(m.meal.label(l), textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(state.icon, size: 32, color: state.color(theme.colorScheme)),
              const SizedBox(width: 8),
              Flexible(
                child: Text('${formatTime(context, dose.at)} · ${state.label(l)}',
                    style: theme.textTheme.bodyLarge),
              ),
            ],
          ),
          if (actionable) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: BarrColors.ok),
              onPressed: onTaken,
              icon: const Icon(Icons.check_rounded, size: 40),
              label: Text(l.takenIt),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(80),
                side: const BorderSide(width: 2),
                textStyle: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
              onPressed: onLater,
              icon: const Icon(Icons.snooze_rounded, size: 34),
              label: Text(l.later),
            ),
          ],
        ],
      ),
    );
  }
}

/// Spoken description of a dose for TTS.
String doseSpeech(AppLocalizations l, ScheduledDose dose) {
  final m = dose.medication;
  final instruction = m.meal == MealInstruction.none ? '' : m.meal.label(l);
  return '${l.doseSpeechIntro}. ${l.doseSpeech(m.name, m.dose, instruction)}';
}
