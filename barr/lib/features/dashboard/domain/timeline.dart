import '../../../core/utils/dates.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../medications/domain/dose_schedule.dart';
import '../../medications/domain/medication.dart';
import '../../sos/domain/sos_event.dart';

enum TimelineType { checkin, doseTaken, doseSnoozed, doseMissed, sos, sosResolved }

class TimelineEvent {
  const TimelineEvent({required this.type, required this.at, required this.elder, this.medication});

  final TimelineType type;
  final DateTime at;
  final Elder elder;
  final Medication? medication;
}

/// Today's events for one parent, newest first.
List<TimelineEvent> timelineFor({
  required Elder elder,
  required DateTime now,
  List<ScheduledDose> doses = const [],
  List<SosEvent> sosEvents = const [],
}) {
  final events = <TimelineEvent>[];
  final checkin = elder.lastCheckinAt;
  if (checkin != null && isSameDay(checkin, now)) {
    events.add(TimelineEvent(type: TimelineType.checkin, at: checkin, elder: elder));
  }
  for (final d in doses) {
    final state = d.stateAt(now);
    final log = d.log;
    switch (state) {
      case DoseState.taken:
        events.add(TimelineEvent(
            type: TimelineType.doseTaken, at: log?.actedAt ?? d.at, elder: elder, medication: d.medication));
      case DoseState.snoozed:
        events.add(TimelineEvent(
            type: TimelineType.doseSnoozed, at: log?.actedAt ?? d.at, elder: elder, medication: d.medication));
      case DoseState.missed:
        events.add(TimelineEvent(
            type: TimelineType.doseMissed, at: d.at.add(missedAfter), elder: elder, medication: d.medication));
      case DoseState.upcoming || DoseState.due || DoseState.skipped:
        break;
    }
  }
  for (final s in sosEvents) {
    if (!isSameDay(s.at, now)) continue;
    events.add(TimelineEvent(type: TimelineType.sos, at: s.at, elder: elder));
    if (s.status == SosStatus.resolved) {
      events.add(TimelineEvent(type: TimelineType.sosResolved, at: s.at, elder: elder));
    }
  }
  events.sort((a, b) => b.at.compareTo(a.at));
  return events;
}
