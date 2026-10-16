import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/personality.dart';
import '../widgets/common.dart';
import '../widgets/radar_chart.dart';
import 'home_tab.dart';
import 'result_screen.dart';

class HistoryTab extends StatelessWidget {
  const HistoryTab({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    final results = app.results.reversed.toList();
    final labels = {
      for (final t in Personality.traits) t: app.t('traits.$t.name')
    };

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Text(app.t('journey.title'),
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(app.t('journey.subtitle'),
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          if (results.isEmpty) ...[
            const SizedBox(height: 60),
            Icon(Icons.timeline_rounded,
                size: 80, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(app.t('journey.empty'), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => HomeTab.startTest(context),
              child: Text(app.t('home.startTest')),
            ),
          ],
          if (results.length >= 2) ...[
            SectionTitle(app.t('journey.compareTitle'),
                icon: Icons.compare_arrows_rounded),
            Panel(
              child: Column(children: [
                Center(
                  child: RadarChart(
                    scores: results[0].scores,
                    compare: results[1].scores,
                    labels: labels,
                    size: 280,
                  ),
                ),
                const SizedBox(height: 8),
                Text(app.t('journey.compareLegend'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 12.5,
                        color: theme.colorScheme.onSurfaceVariant)),
                const Divider(height: 28),
                for (final t in Personality.traits)
                  _DeltaRow(
                    label: labels[t]!,
                    trait: t,
                    delta: results[0].scores[t]! - results[1].scores[t]!,
                  ),
              ]),
            ),
          ],
          if (results.isNotEmpty)
            SectionTitle(app.t('journey.allTests'),
                icon: Icons.history_rounded),
          for (final r in results)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Dismissible(
                key: ValueKey(r.date),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: AlignmentDirectional.centerEnd,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.error,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: const Icon(Icons.delete_rounded, color: Colors.white),
                ),
                onDismissed: (_) => app.deleteResult(r),
                child: Panel(
                  padding: 16,
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ResultScreen(result: r))),
                  child: Row(children: [
                    Text(r.emoji, style: const TextStyle(fontSize: 34)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(app.t('types.${r.typeKey}.name'),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 16)),
                          Text(
                              MaterialLocalizations.of(context)
                                  .formatMediumDate(r.date),
                              style: TextStyle(
                                  color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DeltaRow extends StatelessWidget {
  const _DeltaRow(
      {required this.label, required this.trait, required this.delta});

  final String label;
  final String trait;
  final double delta;

  @override
  Widget build(BuildContext context) {
    final d = delta.round();
    final color = d > 0
        ? const Color(0xFF10B981)
        : (d < 0 ? const Color(0xFFEF4444) : Colors.grey);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Icon(Personality.icons[trait],
            size: 20, color: Personality.colors[trait]),
        const SizedBox(width: 10),
        Expanded(child: Text(label)),
        Icon(
            d > 0
                ? Icons.arrow_upward_rounded
                : (d < 0 ? Icons.arrow_downward_rounded : Icons.remove_rounded),
            size: 18,
            color: color),
        const SizedBox(width: 4),
        Text('${d > 0 ? '+' : ''}$d%',
            style: TextStyle(color: color, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}
