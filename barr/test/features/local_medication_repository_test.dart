import 'package:barr/core/error/failure.dart';
import 'package:barr/core/storage/local_db.dart';
import 'package:barr/features/medications/data/local_medication_repository.dart';
import 'package:barr/features/medications/domain/medication.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/local_backend.dart';

void main() {
  late LocalDb db;
  late LocalMedicationRepository repo;

  Medication draft(String name, {int? stock}) => Medication(
        id: '',
        name: name,
        dose: '1',
        times: const [DoseTime(8, 0)],
        startDate: DateTime(2026),
        stockQty: stock,
      );

  setUp(() async {
    (db, _) = await createLocalDb();
    await db.mutate((d) {
      LocalDb.node(d, ['families'])['f'] = {'name': 'F', 'ownerUid': 'u', 'limits': {'maxMedications': 3}};
    });
    repo = LocalMedicationRepository(db, clock: () => DateTime(2026, 3, 10, 8, 5));
  });

  test('free plan allows 3 medicines across the family', () async {
    await repo.save('f', 'e1', draft('a'));
    await repo.save('f', 'e1', draft('b'));
    await repo.save('f', 'e2', draft('c'));
    expect(() => repo.save('f', 'e2', draft('d')), throwsA(isA<PlanLimitFailure>()));
  });

  test('taking a dose decrements stock once', () async {
    final m = await repo.save('f', 'e', draft('a', stock: 10));
    final at = DateTime(2026, 3, 10, 8);
    for (var i = 0; i < 2; i++) {
      await repo.logDose('f', 'e', doseId: 'd1', medication: m, scheduledAt: at, status: DoseStatus.taken);
    }
    final meds = await repo.watchMedications('f', 'e').first;
    expect(meds.single.stockQty, 9);

    final logs = await repo
        .watchDoseLogs('f', 'e', from: DateTime(2026, 3, 10), to: DateTime(2026, 3, 11))
        .first;
    expect(logs['d1']!.status, DoseStatus.taken);
  });

  test('snoozes are counted and buyer can be claimed', () async {
    final m = await repo.save('f', 'e', draft('a', stock: 2));
    final at = DateTime(2026, 3, 10, 8);
    await repo.logDose('f', 'e', doseId: 'd1', medication: m, scheduledAt: at, status: DoseStatus.snoozed);
    await repo.logDose('f', 'e', doseId: 'd1', medication: m, scheduledAt: at, status: DoseStatus.snoozed);
    final logs = await repo.watchDoseLogs('f', 'e', from: DateTime(2026), to: DateTime(2027)).first;
    expect(logs['d1']!.snoozeCount, 2);

    await repo.setBuyer('f', 'e', m.id, const StockBuyer(uid: 'u', name: 'Ahmed'));
    expect((await repo.watchMedications('f', 'e').first).single.buyer?.name, 'Ahmed');
    await repo.setBuyer('f', 'e', m.id, null);
    expect((await repo.watchMedications('f', 'e').first).single.buyer, isNull);
  });
}
