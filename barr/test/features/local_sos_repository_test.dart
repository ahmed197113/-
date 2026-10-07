import 'package:barr/features/sos/data/local_sos_repository.dart';
import 'package:barr/features/sos/domain/sos_event.dart';
import 'package:barr/shared/domain/entities/app_user.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/local_backend.dart';

void main() {
  test('trigger → acknowledge → resolve', () async {
    final (db, _) = await createLocalDb();
    var now = DateTime(2026, 3, 10, 9);
    final repo = LocalSosRepository(db, clock: () => now);
    const e = ElderRef(familyId: 'f', elderId: 'e');

    final id = await repo.trigger(e, location: const GeoFix(lat: 1, lng: 2));
    var events = await repo.watchRecent(e).first;
    expect(events.single.status, SosStatus.active);
    expect(events.single.location?.lat, 1);

    await repo.acknowledge(e, id, byName: 'Ahmed');
    await repo.acknowledge(e, id, byName: 'Ahmed');
    events = await repo.watchRecent(e).first;
    expect(events.single.status, SosStatus.acknowledged);
    expect(events.single.acknowledgedBy, ['Ahmed']);

    await repo.resolve(e, id, byName: 'Sara');
    events = await repo.watchRecent(e).first;
    expect(events.single.status, SosStatus.resolved);
    expect(events.single.resolvedBy, 'Sara');

    now = now.add(const Duration(hours: 49));
    expect(await repo.watchRecent(e).first, isEmpty);
  });
}
