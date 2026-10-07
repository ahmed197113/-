import 'package:barr/features/dashboard/domain/alert_engine.dart';
import 'package:barr/features/dashboard/domain/timeline.dart';
import 'package:barr/features/medications/domain/dose_schedule.dart';
import 'package:barr/features/medications/domain/medication.dart';
import 'package:barr/features/sos/domain/sos_event.dart';
import 'package:barr/shared/domain/entities/elder.dart';
import 'package:barr/shared/domain/entities/enums.dart';
import 'package:flutter_test/flutter_test.dart';

Elder elder({DateTime? checkin, DateTime? seen, int? inactivity, bool linked = true}) => Elder(
      id: 'e',
      familyId: 'f',
      name: 'Saleh',
      nickname: 'بابا',
      relation: ElderRelation.father,
      linkedUid: linked ? 'u' : null,
      lastCheckinAt: checkin,
      lastSeenAt: seen,
      inactivityHours: inactivity,
    );

final med = Medication(
  id: 'm',
  name: 'Med',
  dose: '1',
  times: const [DoseTime(8, 0)],
  startDate: DateTime(2026),
);

void main() {
  final morning = DateTime(2026, 3, 10, 9, 0);

  test('all good → green', () {
    final e = elder(checkin: DateTime(2026, 3, 10, 7));
    final alerts = alertsForElder(elder: e, now: morning);
    expect(alerts, isEmpty);
    expect(statusOf(e, alerts), ElderStatus.green);
  });

  test('missed dose → yellow', () {
    final e = elder(checkin: DateTime(2026, 3, 10, 7));
    final doses = dosesForDay([med], morning, {});
    final alerts = alertsForElder(elder: e, now: morning, doses: doses);
    expect(alerts.single.type, AlertType.missedDose);
    expect(statusOf(e, alerts), ElderStatus.yellow);
  });

  test('no check-in: warning at deadline, critical 2h later', () {
    final e = elder();
    expect(alertsForElder(elder: e, now: DateTime(2026, 3, 10, 9, 59)), isEmpty);
    final first = alertsForElder(elder: e, now: DateTime(2026, 3, 10, 10, 0)).single;
    expect((first.severity, first.escalated), (AlertSeverity.warning, false));
    final second = alertsForElder(elder: e, now: DateTime(2026, 3, 10, 12, 0)).single;
    expect((second.severity, second.escalated), (AlertSeverity.critical, true));
  });

  test('yesterday\'s check-in does not count', () {
    final e = elder(checkin: DateTime(2026, 3, 9, 20));
    expect(alertsForElder(elder: e, now: DateTime(2026, 3, 10, 11)).single.type, AlertType.noCheckin);
  });

  test('inactivity only when enabled', () {
    final seen = DateTime(2026, 3, 9, 20);
    final now = DateTime(2026, 3, 10, 9);
    expect(alertsForElder(elder: elder(checkin: now, seen: seen), now: now), isEmpty);
    final a = alertsForElder(elder: elder(checkin: seen, seen: seen, inactivity: 12), now: now);
    expect(a.single.type, AlertType.inactivity);
    expect(statusOf(elder(), a), ElderStatus.red);
  });

  test('open SOS is critical and sorted first; resolved SOS is ignored', () {
    final e = elder();
    final open = SosEvent(id: 's', familyId: 'f', elderId: 'e', at: morning, status: SosStatus.active);
    final done = SosEvent(id: 't', familyId: 'f', elderId: 'e', at: morning, status: SosStatus.resolved);
    final alerts = alertsForElder(
      elder: e,
      now: DateTime(2026, 3, 10, 10, 30),
      doses: dosesForDay([med], morning, {}),
      sosEvents: [open, done],
    );
    expect(alerts.first.type, AlertType.sos);
    expect(alerts.where((a) => a.type == AlertType.sos), hasLength(1));
  });

  test('unlinked parents get no check-in alerts and unknown status', () {
    final e = elder(linked: false);
    final alerts = alertsForElder(elder: e, now: DateTime(2026, 3, 10, 15));
    expect(alerts, isEmpty);
    expect(statusOf(e, alerts), ElderStatus.unknown);
  });

  test('timeline lists today\'s events newest first', () {
    final e = elder(checkin: DateTime(2026, 3, 10, 7));
    final taken = DoseLog(
      doseId: doseId('m', DateTime(2026, 3, 10, 8)),
      medId: 'm',
      scheduledAt: DateTime(2026, 3, 10, 8),
      status: DoseStatus.taken,
      actedAt: DateTime(2026, 3, 10, 8, 5),
    );
    final events = timelineFor(
      elder: e,
      now: DateTime(2026, 3, 10, 12),
      doses: dosesForDay([med], morning, {taken.doseId: taken}),
      sosEvents: [SosEvent(id: 's', familyId: 'f', elderId: 'e', at: DateTime(2026, 3, 10, 11), status: SosStatus.resolved)],
    );
    expect(events.map((e) => e.type), [
      TimelineType.sos,
      TimelineType.sosResolved,
      TimelineType.doseTaken,
      TimelineType.checkin,
    ]);
  });
}
