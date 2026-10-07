import 'dose_schedule.dart';
import 'medication.dart';

/// One local notification to schedule on the parent's device.
class PlannedReminder {
  const PlannedReminder({
    required this.notificationId,
    required this.at,
    required this.doseId,
    required this.medication,
    required this.doseAt,
    required this.attempt,
  });

  final int notificationId;
  final DateTime at;
  final String doseId;
  final Medication medication;
  final DateTime doseAt;

  /// 0 = on time, 1..n = repeats.
  final int attempt;
}

/// Each dose rings at its time, then repeats every [interval]
/// [repeats] more times until confirmed (spec: every 10 min, 3 times).
List<PlannedReminder> planReminders({
  required List<Medication> medications,
  required Map<String, DoseLog> logs,
  required DateTime now,
  int days = 7,
  int repeats = 3,
  Duration interval = const Duration(minutes: 10),
  int maxReminders = 400,
}) {
  final plan = <PlannedReminder>[];
  final today = DateTime(now.year, now.month, now.day);
  for (var i = 0; i < days; i++) {
    final day = DateTime(today.year, today.month, today.day + i);
    for (final dose in dosesForDay(medications, day, logs)) {
      final status = dose.log?.status;
      if (status == DoseStatus.taken || status == DoseStatus.skipped) continue;
      for (var attempt = 0; attempt <= repeats; attempt++) {
        final at = dose.at.add(interval * attempt);
        if (!at.isAfter(now)) continue;
        plan.add(PlannedReminder(
          notificationId: notificationIdFor(dose.id, attempt),
          at: at,
          doseId: dose.id,
          medication: dose.medication,
          doseAt: dose.at,
          attempt: attempt,
        ));
      }
    }
  }
  plan.sort((a, b) => a.at.compareTo(b.at));
  // Android caps pending alarms (~500 per app); keep the soonest.
  return plan.length > maxReminders ? plan.sublist(0, maxReminders) : plan;
}

/// Stable 31-bit id (FNV-1a) so the same reminder keeps the same id.
int notificationIdFor(String doseId, int attempt) {
  var hash = 0x811c9dc5;
  for (final c in '$doseId#$attempt'.codeUnits) {
    hash ^= c;
    hash = (hash * 0x01000193) & 0xFFFFFFFF;
  }
  return hash & 0x7FFFFFFF;
}
