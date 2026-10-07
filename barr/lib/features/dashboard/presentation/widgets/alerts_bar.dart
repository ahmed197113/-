import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../domain/alert_engine.dart';
import '../labels.dart';

/// Urgent alerts at the top of the dashboard (warning + critical only).
class AlertsBar extends StatelessWidget {
  const AlertsBar({super.key, required this.alerts});

  final List<FamilyAlert> alerts;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final urgent = alerts.where((a) => a.severity != AlertSeverity.info).toList();
    if (urgent.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(l.urgentAlerts,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            ),
          ),
          for (final a in urgent) ...[
            _AlertTile(alert: a),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert});

  final FamilyAlert alert;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final color = severityColor(alert.severity);
    final phone = alert.elder.phone;
    final isSos = alert.type == AlertType.sos;

    void open() {
      if (isSos) {
        context.push(Routes.sosAlert(alert.elder.id, alert.sos!.id));
      } else {
        context.push(Routes.medications(alert.elder.id));
      }
    }

    return Material(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: open,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: BorderDirectional(start: BorderSide(color: color, width: 5)),
          ),
          padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
          child: Row(
            children: [
              Icon(alertIcon(alert.type), color: color, size: isSos ? 32 : 26),
              const SizedBox(width: 10),
              Expanded(
                child: Text(alertText(l, alert),
                    style: TextStyle(fontWeight: isSos ? FontWeight.w800 : FontWeight.w600)),
              ),
              if (phone != null)
                IconButton(
                  tooltip: l.call,
                  icon: Icon(Icons.call_rounded, color: color),
                  onPressed: () => launchUrl(Uri(scheme: 'tel', path: phone)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
