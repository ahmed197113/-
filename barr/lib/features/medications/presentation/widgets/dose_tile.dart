import 'package:flutter/material.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../domain/dose_schedule.dart';
import '../labels.dart';
import 'med_photo.dart';

/// A row in the caregiver's "today" timeline.
class DoseTile extends StatelessWidget {
  const DoseTile({super.key, required this.dose, required this.now, this.onMarkTaken});

  final ScheduledDose dose;
  final DateTime now;
  final VoidCallback? onMarkTaken;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final state = dose.stateAt(now);
    final canMark = onMarkTaken != null && state != DoseState.taken && state != DoseState.upcoming;
    return ListTile(
      leading: MedPhoto(url: dose.medication.photoUrl, size: 44, radius: 10),
      title: Text(dose.medication.name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${formatTime(context, dose.at)} · ${dose.medication.dose}'),
      trailing: canMark
          ? TextButton(onPressed: onMarkTaken, child: Text(l.markTaken))
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(state.icon, color: state.color(scheme), size: 20),
                const SizedBox(width: 4),
                Text(state.label(l), style: TextStyle(color: state.color(scheme))),
              ],
            ),
    );
  }
}
