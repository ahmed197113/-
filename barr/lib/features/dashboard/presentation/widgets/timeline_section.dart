import 'package:flutter/material.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../medications/presentation/labels.dart';
import '../../domain/timeline.dart';
import '../labels.dart';

class TimelineSection extends StatelessWidget {
  const TimelineSection({super.key, required this.events, this.max = 8});

  final List<TimelineEvent> events;
  final int max;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final shown = events.take(max).toList();
    return Card(
      child: shown.isEmpty
          ? ListTile(
              leading: const Icon(Icons.wb_sunny_outlined),
              title: Text(l.noEventsToday),
            )
          : Column(
              children: [
                for (var i = 0; i < shown.length; i++)
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(width: 16),
                        SizedBox(
                          width: 28,
                          child: Column(
                            children: [
                              Expanded(
                                child: Container(
                                  width: 2,
                                  color: i == 0 ? Colors.transparent : theme.colorScheme.outlineVariant,
                                ),
                              ),
                              Icon(timelineIcon(shown[i].type).$1, color: timelineIcon(shown[i].type).$2, size: 22),
                              Expanded(
                                child: Container(
                                  width: 2,
                                  color: i == shown.length - 1
                                      ? Colors.transparent
                                      : theme.colorScheme.outlineVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(timelineText(l, shown[i])),
                                Text(formatTime(context, shown[i].at),
                                    style: theme.textTheme.bodySmall
                                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
