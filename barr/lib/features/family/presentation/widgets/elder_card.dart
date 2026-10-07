import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/dates.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../l10n_labels.dart';

/// Parent status card on the caregiver dashboard.
class ElderCard extends StatelessWidget {
  const ElderCard({super.key, required this.elder, required this.onLink, this.now});

  final Elder elder;
  final VoidCallback onLink;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final today = now ?? DateTime.now();
    final checkin = elder.lastCheckinAt;
    final checkedIn = checkin != null && isSameDay(checkin, today);

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

    return Card(
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
                          color: status,
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
              ],
            ),
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: Row(
                children: [
                  Icon(
                    checkedIn ? Icons.check_circle_rounded : Icons.info_rounded,
                    color: status,
                    size: 20,
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Text(statusText)),
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
    );
  }
}
