import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/clock.dart';
import '../../../../core/utils/dates.dart';
import '../../../../shared/domain/entities/app_user.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../../../medications/data/medication_providers.dart';
import '../../../medications/domain/dose_schedule.dart';
import '../l10n_labels.dart';

/// Parent status card on the caregiver dashboard: check-in, today's
/// medicine adherence and low-stock warnings.
class ElderCard extends ConsumerWidget {
  const ElderCard({super.key, required this.elder, required this.onLink, required this.onOpen});

  final Elder elder;
  final VoidCallback onLink;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final now = ref.watch(nowProvider).value ?? DateTime.now();
    final elderRef = ElderRef(familyId: elder.familyId, elderId: elder.id);
    final doses = ref.watch(todayDosesProvider(elderRef));
    final meds = ref.watch(medicationsProvider(elderRef)).value ?? const [];
    final adherence = doses == null ? null : adherenceOf(doses, now);
    final lowStock = meds.where((m) => m.isLowStock).toList();

    final checkin = elder.lastCheckinAt;
    final checkedIn = checkin != null && isSameDay(checkin, now);

    // Green: fine / Yellow: needs a look / Red: missed doses.
    final Color status;
    final String statusText;
    if (!elder.isLinked) {
      status = theme.colorScheme.outline;
      statusText = l.notLinked;
    } else if (checkedIn) {
      status = BarrColors.ok;
      statusText = l.checkedInToday(
        DateFormat.jm(Localizations.localeOf(context).toLanguageTag()).format(checkin),
      );
    } else {
      status = BarrColors.warn;
      statusText = l.noCheckinToday;
    }
    final overall = (adherence?.missed ?? 0) > 0
        ? BarrColors.danger
        : (lowStock.isNotEmpty && status == BarrColors.ok ? BarrColors.warn : status);

    Widget infoRow(IconData icon, Color color, String text) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 6),
              Expanded(child: Text(text)),
            ],
          ),
        );

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: theme.colorScheme.primaryContainer,
                        child: Text(
                          elder.displayName.characters.firstOrNull ?? '؟',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: theme.colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                      PositionedDirectional(
                        end: 0,
                        bottom: 0,
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: overall,
                            shape: BoxShape.circle,
                            border: Border.all(color: theme.cardTheme.color ?? Colors.white, width: 2),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(elder.displayName,
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        Text(
                          '${elder.relation.label(l)} · ${elder.name}',
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_left_rounded),
                ],
              ),
              Semantics(
                liveRegion: true,
                child: Column(
                  children: [
                    infoRow(checkedIn ? Icons.check_circle_rounded : Icons.info_rounded, status,
                        statusText),
                    if (adherence != null && adherence.total > 0)
                      infoRow(
                        Icons.medication_rounded,
                        adherence.missed > 0 ? BarrColors.danger : BarrColors.ok,
                        adherence.due == 0
                            ? l.nextDose
                            : l.medsToday(adherence.taken, adherence.due),
                      ),
                    for (final m in lowStock)
                      infoRow(Icons.warning_amber_rounded, BarrColors.danger, '${m.name}: ${l.stockLow}'),
                  ],
                ),
              ),
              if (!elder.isLinked) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onLink,
                  icon: const Icon(Icons.qr_code_rounded),
                  label: Text(l.linkDevice),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
