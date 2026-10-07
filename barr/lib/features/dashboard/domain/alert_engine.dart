import '../../../core/utils/dates.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../medications/domain/dose_schedule.dart';
import '../../medications/domain/medication.dart';
import '../../sos/domain/sos_event.dart';

enum AlertSeverity { info, warning, critical }

enum AlertType { sos, missedDose, noCheckin, inactivity, lowStock }

/// Status light on the parent's card.
enum ElderStatus { green, yellow, red, unknown }

/// Something the family should look at. Computed client-side from live
/// data so the dashboard works the same in demo mode and with Firebase;
/// Cloud Functions apply the same rules to send push notifications.
class FamilyAlert {
  const FamilyAlert({
    required this.type,
    required this.severity,
    required this.elder,
    required this.at,
    this.medication,
    this.sos,
    this.escalated = false,
  });

  final AlertType type;
  final AlertSeverity severity;
  final Elder elder;
  final DateTime at;
  final Medication? medication;
  final SosEvent? sos;

  /// No check-in long after the deadline.
  final bool escalated;

  String get id => '${type.name}_${elder.id}_${sos?.id ?? medication?.id ?? ''}_${at.millisecondsSinceEpoch}';
}

/// Escalate a missing check-in to red this long after the deadline.
const checkinEscalation = Duration(hours: 2);

List<FamilyAlert> alertsForElder({
  required Elder elder,
  required DateTime now,
  List<ScheduledDose> doses = const [],
  List<Medication> medications = const [],
  List<SosEvent> sosEvents = const [],
}) {
  final alerts = <FamilyAlert>[];

  for (final e in sosEvents) {
    if (e.status.isOpen) {
      alerts.add(FamilyAlert(
        type: AlertType.sos,
        severity: AlertSeverity.critical,
        elder: elder,
        at: e.at,
        sos: e,
      ));
    }
  }

  for (final d in doses) {
    if (d.stateAt(now) == DoseState.missed) {
      alerts.add(FamilyAlert(
        type: AlertType.missedDose,
        severity: AlertSeverity.warning,
        elder: elder,
        at: d.at.add(missedAfter),
        medication: d.medication,
      ));
    }
  }

  if (elder.isLinked) {
    final deadline = DateTime(now.year, now.month, now.day, elder.checkinDeadline.hour,
        elder.checkinDeadline.minute);
    final checkedIn = elder.lastCheckinAt != null && isSameDay(elder.lastCheckinAt!, now);
    if (!checkedIn && !now.isBefore(deadline)) {
      final escalated = !now.isBefore(deadline.add(checkinEscalation));
      alerts.add(FamilyAlert(
        type: AlertType.noCheckin,
        severity: escalated ? AlertSeverity.critical : AlertSeverity.warning,
        elder: elder,
        at: escalated ? deadline.add(checkinEscalation) : deadline,
        escalated: escalated,
      ));
    }

    final hours = elder.inactivityHours;
    final lastSeen = _latest(elder.lastSeenAt, elder.lastCheckinAt);
    if (hours != null && hours > 0 && lastSeen != null &&
        now.difference(lastSeen) >= Duration(hours: hours)) {
      alerts.add(FamilyAlert(
        type: AlertType.inactivity,
        severity: AlertSeverity.critical,
        elder: elder,
        at: lastSeen.add(Duration(hours: hours)),
      ));
    }
  }

  for (final m in medications) {
    if (m.isLowStock && m.buyer == null) {
      alerts.add(FamilyAlert(
        type: AlertType.lowStock,
        severity: AlertSeverity.info,
        elder: elder,
        at: now,
        medication: m,
      ));
    }
  }
  return sortAlerts(alerts);
}

/// Most severe first, then newest first.
List<FamilyAlert> sortAlerts(List<FamilyAlert> alerts) => alerts
  ..sort((a, b) {
    final s = b.severity.index - a.severity.index;
    return s != 0 ? s : b.at.compareTo(a.at);
  });

ElderStatus statusOf(Elder elder, List<FamilyAlert> alerts) {
  if (!elder.isLinked) return ElderStatus.unknown;
  if (alerts.any((a) => a.severity == AlertSeverity.critical)) return ElderStatus.red;
  if (alerts.any((a) => a.severity == AlertSeverity.warning)) return ElderStatus.yellow;
  return ElderStatus.green;
}

DateTime? _latest(DateTime? a, DateTime? b) {
  if (a == null) return b;
  if (b == null) return a;
  return a.isAfter(b) ? a : b;
}
