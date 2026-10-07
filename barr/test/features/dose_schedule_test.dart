import 'package:barr/features/medications/domain/dose_schedule.dart';
import 'package:barr/features/medications/domain/medication.dart';
import 'package:barr/features/medications/domain/reminder_plan.dart';
import 'package:flutter_test/flutter_test.dart';

Medication med({
  String id = 'm1',
  List<DoseTime> times = const [DoseTime(8, 0), DoseTime(20, 0)],
  Set<int> weekdays = const {},
  DateTime? start,
  DateTime? end,
  int? stock,
}) =>
    Medication(
      id: id,
      name: 'Med $id',
      dose: '1',
      times: times,
      weekdays: weekdays,
      startDate: start ?? DateTime(2026, 1, 1),
      endDate: end,
      stockQty: stock,
    );

DoseLog log(String doseId, DoseStatus status) => DoseLog(
      doseId: doseId,
      medId: 'm1',
      scheduledAt: DateTime(2026),
      status: status,
      actedAt: DateTime(2026),
    );

void main() {
  final day = DateTime(2026, 3, 10); // Tuesday

  group('Medication.isDueOn', () {
    test('respects start/end dates and weekdays', () {
      expect(med().isDueOn(day), isTrue);
      expect(med(start: DateTime(2026, 3, 11)).isDueOn(day), isFalse);
      expect(med(end: DateTime(2026, 3, 9)).isDueOn(day), isFalse);
      expect(med(end: DateTime(2026, 3, 10)).isDueOn(day), isTrue);
      expect(med(weekdays: {DateTime.tuesday}).isDueOn(day), isTrue);
      expect(med(weekdays: {DateTime.friday}).isDueOn(day), isFalse);
    });

    test('low stock means fewer than 3 days left', () {
      expect(med(stock: 6).isLowStock, isTrue);
      expect(med(stock: 7).isLowStock, isFalse);
      expect(med(stock: 7).daysLeft, 3);
      expect(med().isLowStock, isFalse);
    });

    test('round-trips through a map', () {
      final m = med(weekdays: {1, 3}, end: DateTime(2026, 4, 1), stock: 20);
      final back = Medication.fromMap('m1', m.toMap());
      expect(back.times, m.times);
      expect(back.weekdays, m.weekdays);
      expect(back.endDate, DateTime(2026, 4, 1));
      expect(back.stockQty, 20);
    });
  });

  group('dose states', () {
    final doses = dosesForDay([med()], day, {});
    final morning = doses.first;

    test('ids are deterministic', () {
      expect(morning.id, '20260310_m1_0800');
      expect(doses.map((d) => d.at.hour), [8, 20]);
    });

    test('upcoming → due → missed after 30 minutes', () {
      expect(morning.stateAt(DateTime(2026, 3, 10, 7, 59)), DoseState.upcoming);
      expect(morning.stateAt(DateTime(2026, 3, 10, 8, 10)), DoseState.due);
      expect(morning.stateAt(DateTime(2026, 3, 10, 8, 30)), DoseState.missed);
    });

    test('logs override the clock', () {
      final taken = dosesForDay([med()], day, {morning.id: log(morning.id, DoseStatus.taken)}).first;
      expect(taken.stateAt(DateTime(2026, 3, 10, 12)), DoseState.taken);
      final snoozed = dosesForDay([med()], day, {morning.id: log(morning.id, DoseStatus.snoozed)}).first;
      expect(snoozed.stateAt(DateTime(2026, 3, 10, 8, 5)), DoseState.snoozed);
    });

    test('currentDose prefers overdue doses, then upcoming', () {
      expect(currentDose(doses, DateTime(2026, 3, 10, 9))!.at.hour, 8); // missed morning
      final afterMorning = dosesForDay([med()], day, {morning.id: log(morning.id, DoseStatus.taken)});
      expect(currentDose(afterMorning, DateTime(2026, 3, 10, 9))!.at.hour, 20);
      expect(currentDose(afterMorning, DateTime(2026, 3, 10, 21)), isNotNull); // evening missed
    });

    test('adherence counts only doses whose time has come', () {
      final a = adherenceOf(
          dosesForDay([med()], day, {morning.id: log(morning.id, DoseStatus.taken)}), DateTime(2026, 3, 10, 12));
      expect((a.taken, a.due, a.total, a.missed), (1, 1, 2, 0));
      final b = adherenceOf(doses, DateTime(2026, 3, 10, 21));
      expect((b.taken, b.due, b.missed), (0, 2, 2));
    });
  });

  group('planReminders', () {
    test('each dose rings on time then 3 repeats every 10 minutes', () {
      final plan = planReminders(
        medications: [med(times: const [DoseTime(8, 0)])],
        logs: {},
        now: DateTime(2026, 3, 10, 7),
        days: 1,
      );
      expect(plan.map((p) => '${p.at.hour}:${p.at.minute}'), ['8:0', '8:10', '8:20', '8:30']);
      expect(plan.map((p) => p.notificationId).toSet().length, 4);
    });

    test('skips past reminders and taken doses', () {
      final first = dosesForDay([med()], day, {}).first;
      final plan = planReminders(
        medications: [med()],
        logs: {first.id: log(first.id, DoseStatus.taken)},
        now: DateTime(2026, 3, 10, 7),
        days: 1,
      );
      expect(plan.every((p) => p.doseAt.hour == 20), isTrue);

      final late = planReminders(medications: [med()], logs: {}, now: DateTime(2026, 3, 10, 8, 15), days: 1);
      expect(late.where((p) => p.doseAt.hour == 8).map((p) => p.attempt), [2, 3]);
    });

    test('covers 7 days and respects the cap', () {
      final plan = planReminders(medications: [med()], logs: {}, now: DateTime(2026, 3, 10, 0, 1));
      expect(plan.length, 7 * 2 * 4);
      final capped = planReminders(medications: [med()], logs: {}, now: DateTime(2026, 3, 10), maxReminders: 10);
      expect(capped.length, 10);
      expect(capped.first.at, DateTime(2026, 3, 10, 8));
    });

    test('notification ids are stable', () {
      expect(notificationIdFor('20260310_m1_0800', 0), notificationIdFor('20260310_m1_0800', 0));
      expect(notificationIdFor('20260310_m1_0800', 0), isNot(notificationIdFor('20260310_m1_0800', 1)));
      expect(notificationIdFor('x', 0), greaterThanOrEqualTo(0));
    });
  });
}
