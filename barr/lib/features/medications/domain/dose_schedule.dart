import '../../../core/utils/dates.dart';
import 'medication.dart';

/// How long after the scheduled time an unconfirmed dose counts as missed.
const missedAfter = Duration(minutes: 30);

enum DoseState { upcoming, due, snoozed, taken, missed, skipped }

/// One occurrence of a medication on a given day.
class ScheduledDose {
  const ScheduledDose({required this.medication, required this.at, this.log});

  final Medication medication;
  final DateTime at;
  final DoseLog? log;

  String get id => doseId(medication.id, at);

  DoseState stateAt(DateTime now) {
    switch (log?.status) {
      case DoseStatus.taken:
        return DoseState.taken;
      case DoseStatus.skipped:
        return DoseState.skipped;
      case DoseStatus.snoozed:
      case null:
        if (now.isBefore(at)) return DoseState.upcoming;
        if (!now.isBefore(at.add(missedAfter))) return DoseState.missed;
        return log?.status == DoseStatus.snoozed ? DoseState.snoozed : DoseState.due;
    }
  }
}

/// Deterministic id: offline retries and multiple devices never duplicate.
String doseId(String medId, DateTime at) =>
    '${dayKey(at)}_${medId}_${at.hour.toString().padLeft(2, '0')}${at.minute.toString().padLeft(2, '0')}';

/// All doses of [meds] on [day], sorted by time.
List<ScheduledDose> dosesForDay(
  List<Medication> meds,
  DateTime day,
  Map<String, DoseLog> logs,
) {
  final result = <ScheduledDose>[];
  for (final m in meds) {
    if (!m.isDueOn(day)) continue;
    for (final t in m.times) {
      final at = t.on(day);
      result.add(ScheduledDose(medication: m, at: at, log: logs[doseId(m.id, at)]));
    }
  }
  result.sort((a, b) {
    final c = a.at.compareTo(b.at);
    return c != 0 ? c : a.medication.name.compareTo(b.medication.name);
  });
  return result;
}

/// The dose the parent should act on now: the earliest unconfirmed dose
/// that is due/snoozed/missed, otherwise the next upcoming one.
ScheduledDose? currentDose(List<ScheduledDose> today, DateTime now) {
  for (final d in today) {
    final s = d.stateAt(now);
    if (s == DoseState.due || s == DoseState.snoozed || s == DoseState.missed) return d;
  }
  for (final d in today) {
    if (d.stateAt(now) == DoseState.upcoming) return d;
  }
  return null;
}

/// Adherence summary for the doses whose time has come.
class Adherence {
  const Adherence({required this.taken, required this.due, required this.total});

  final int taken;

  /// Doses whose time has passed (taken or not).
  final int due;

  /// All doses scheduled today.
  final int total;

  double? get ratio => due == 0 ? null : taken / due;
  int get missed => due - taken;
}

Adherence adherenceOf(List<ScheduledDose> doses, DateTime now) {
  var taken = 0;
  var due = 0;
  for (final d in doses) {
    final s = d.stateAt(now);
    if (s == DoseState.taken) taken++;
    if (s != DoseState.upcoming) due++;
  }
  return Adherence(taken: taken, due: due, total: doses.length);
}
