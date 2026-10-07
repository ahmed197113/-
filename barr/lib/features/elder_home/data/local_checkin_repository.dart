import '../../../core/storage/local_db.dart';
import '../../../core/utils/dates.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/checkin_repository.dart';

class LocalCheckinRepository implements CheckinRepository {
  LocalCheckinRepository(this._db);

  final LocalDb _db;

  @override
  Future<void> checkIn(ElderRef elder, {String source = 'button'}) => _db.mutate((db) {
        final now = DateTime.now();
        LocalDb.node(db, ['checkins', elder.familyId, elder.elderId])[dayKey(now)] = {
          'at': now.millisecondsSinceEpoch,
          'source': source,
        };
        final e = LocalDb.node(db, ['elders', elder.familyId, elder.elderId]);
        e['lastCheckinAt'] = now.millisecondsSinceEpoch;
      });
}
