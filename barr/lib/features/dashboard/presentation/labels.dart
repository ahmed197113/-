import 'package:flutter/material.dart';

import '../../../core/l10n/generated/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/alert_engine.dart';
import '../domain/timeline.dart';

String alertText(AppLocalizations l, FamilyAlert a) {
  final name = a.elder.displayName;
  final med = a.medication?.name ?? '';
  return switch (a.type) {
    AlertType.sos => l.alertSos(name),
    AlertType.missedDose => l.alertMissedDose(name, med),
    AlertType.noCheckin => a.escalated ? l.alertNoCheckinEscalated(name) : l.alertNoCheckin(name),
    AlertType.inactivity => l.alertInactivity(name),
    AlertType.lowStock => l.alertLowStock(name, med),
  };
}

IconData alertIcon(AlertType t) => switch (t) {
      AlertType.sos => Icons.sos_rounded,
      AlertType.missedDose => Icons.medication_rounded,
      AlertType.noCheckin => Icons.favorite_border_rounded,
      AlertType.inactivity => Icons.phonelink_erase_rounded,
      AlertType.lowStock => Icons.inventory_2_outlined,
    };

Color severityColor(AlertSeverity s) => switch (s) {
      AlertSeverity.critical => BarrColors.danger,
      AlertSeverity.warning => BarrColors.attention,
      AlertSeverity.info => BarrColors.teal,
    };

Color statusColor(ElderStatus s, ColorScheme scheme) => switch (s) {
      ElderStatus.green => BarrColors.ok,
      ElderStatus.yellow => BarrColors.warn,
      ElderStatus.red => BarrColors.danger,
      ElderStatus.unknown => scheme.outline,
    };

String statusLabel(AppLocalizations l, ElderStatus s) => switch (s) {
      ElderStatus.green => l.statusGreen,
      ElderStatus.yellow => l.statusYellow,
      ElderStatus.red => l.statusRed,
      ElderStatus.unknown => l.notLinked,
    };

String timelineText(AppLocalizations l, TimelineEvent e) {
  final name = e.elder.displayName;
  final med = e.medication?.name ?? '';
  return switch (e.type) {
    TimelineType.checkin => l.tlCheckin(name),
    TimelineType.doseTaken => l.tlDoseTaken(name, med),
    TimelineType.doseSnoozed => l.tlDoseSnoozed(name, med),
    TimelineType.doseMissed => l.tlDoseMissed(name, med),
    TimelineType.sos => l.tlSos(name),
    TimelineType.sosResolved => l.tlSosResolved(name),
  };
}

(IconData, Color) timelineIcon(TimelineType t) => switch (t) {
      TimelineType.checkin => (Icons.favorite_rounded, BarrColors.ok),
      TimelineType.doseTaken => (Icons.check_circle_rounded, BarrColors.ok),
      TimelineType.doseSnoozed => (Icons.snooze_rounded, BarrColors.warn),
      TimelineType.doseMissed => (Icons.cancel_rounded, BarrColors.danger),
      TimelineType.sos => (Icons.sos_rounded, BarrColors.danger),
      TimelineType.sosResolved => (Icons.verified_user_rounded, BarrColors.ok),
    };
