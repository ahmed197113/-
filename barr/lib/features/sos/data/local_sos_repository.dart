import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/sos_event.dart';
import '../domain/sos_repository.dart';

class LocalSosRepository implements SosRepository {
  LocalSosRepository(this._db, {DateTime Function()? clock}) : _now = clock ?? DateTime.now;

  final LocalDb _db;
  final DateTime Function() _now;

  List<String> _path(ElderRef e) => ['sosEvents', e.familyId, e.elderId];

  @override
  Future<String> trigger(ElderRef elder, {GeoFix? location}) {
    final id = _db.newId();
    return _db.mutate((db) {
      LocalDb.node(db, _path(elder))[id] = {
        'at': _now().millisecondsSinceEpoch,
        'status': SosStatus.active.name,
        'location': location?.toMap(),
        'acknowledgedBy': <String>[],
      };
      return id;
    });
  }

  @override
  Stream<List<SosEvent>> watchRecent(ElderRef elder) => _db.watch((db) {
        final since = _now().subtract(const Duration(hours: 48));
        return (LocalDb.read(db, _path(elder)) ?? const {})
            .entries
            .map((e) => SosEvent.fromMap(
                e.key, elder.familyId, elder.elderId, Map<String, dynamic>.from(e.value as Map)))
            .where((e) => e.at.isAfter(since))
            .toList()
          ..sort((a, b) => b.at.compareTo(a.at));
      });

  @override
  Future<void> acknowledge(ElderRef elder, String eventId, {required String byName}) =>
      _db.mutate((db) {
        final e = LocalDb.node(db, [..._path(elder), eventId]);
        e['status'] = SosStatus.acknowledged.name;
        final by = List<String>.from((e['acknowledgedBy'] as List?) ?? const []);
        if (!by.contains(byName)) by.add(byName);
        e['acknowledgedBy'] = by;
      });

  @override
  Future<void> resolve(ElderRef elder, String eventId, {required String byName}) =>
      _db.mutate((db) {
        final e = LocalDb.node(db, [..._path(elder), eventId]);
        e['status'] = SosStatus.resolved.name;
        e['resolvedBy'] = byName;
      });
}
