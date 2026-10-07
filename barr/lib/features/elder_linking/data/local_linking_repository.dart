import '../../../core/config/plan_limits.dart';
import '../../../core/error/failure.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../domain/linking_repository.dart';

class LocalLinkingRepository implements LinkingRepository {
  LocalLinkingRepository(this._db, {DateTime Function()? clock}) : _now = clock ?? DateTime.now;

  final LocalDb _db;
  final DateTime Function() _now;

  @override
  Future<LinkCode> createLinkCode(String familyId, String elderId) async {
    if (LocalDb.read(_db.data, ['elders', familyId, elderId]) == null) {
      throw const PermissionFailure();
    }
    final expiresAt = _now().add(PlanLimits.linkCodeValidity);
    var code = _db.newNumericCode(6);
    while (LocalDb.read(_db.data, ['linkCodes', code]) != null) {
      code = _db.newNumericCode(6);
    }
    await _db.mutate((db) {
      LocalDb.node(db, ['linkCodes'])[code] = {
        'familyId': familyId,
        'elderId': elderId,
        'expiresAt': expiresAt.millisecondsSinceEpoch,
      };
    });
    return LinkCode(code: code, familyId: familyId, elderId: elderId, expiresAt: expiresAt);
  }

  @override
  Future<ElderRef> redeem(String code) => _db.mutate((db) {
        final entry = LocalDb.read(db, ['linkCodes', code]);
        final expiresAt = (entry?['expiresAt'] as num?)?.toInt() ?? 0;
        if (entry == null ||
            entry['usedAt'] != null ||
            _now().millisecondsSinceEpoch >= expiresAt) {
          throw const InvalidLinkCodeFailure();
        }
        final fid = entry['familyId'] as String;
        final eid = entry['elderId'] as String;
        final elder = LocalDb.read(db, ['elders', fid, eid]);
        if (elder == null) throw const InvalidLinkCodeFailure();

        final current = db['currentUid'] as String?;
        final currentUser = current == null ? null : LocalDb.read(db, ['users', current]);
        final uid = currentUser?['accountType'] == AccountType.elder.name ? current! : 'elder_$eid';

        final ref = ElderRef(familyId: fid, elderId: eid);
        final displayName = (elder['nickname'] as String?)?.isNotEmpty == true
            ? elder['nickname']
            : elder['name'];
        LocalDb.node(db, ['users'])[uid] = {
          ...?currentUser,
          'displayName': currentUser?['displayName'] ?? displayName,
          'accountType': AccountType.elder.name,
          'phone': currentUser?['phone'] ?? elder['phone'],
          'familyIds': [fid],
          'elderRef': ref.toMap(),
        };
        LocalDb.node(db, ['members', fid])[uid] = {
          'role': FamilyRole.elder.name,
          'displayName': displayName,
          'phone': elder['phone'],
          'elderId': eid,
        };
        LocalDb.node(db, ['elders', fid, eid])['linkedUid'] = uid;
        LocalDb.node(db, ['linkCodes', code])['usedAt'] = _now().millisecondsSinceEpoch;
        db['currentUid'] = uid;
        return ref;
      });
}
