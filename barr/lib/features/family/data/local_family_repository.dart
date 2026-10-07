import '../../../core/error/failure.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/family.dart';
import '../domain/family_repository.dart';

class LocalFamilyRepository implements FamilyRepository {
  LocalFamilyRepository(this._db);

  final LocalDb _db;

  String get _uid {
    final uid = _db.data['currentUid'] as String?;
    if (uid == null) throw const SessionExpiredFailure();
    return uid;
  }

  @override
  Future<String> createFamily(String name) {
    final uid = _uid;
    final fid = _db.newId();
    return _db.mutate((db) {
      final user = LocalDb.node(db, ['users', uid]);
      LocalDb.node(db, ['families'])[fid] = Family(id: fid, name: name, ownerUid: uid).toMap();
      LocalDb.node(db, ['members', fid])[uid] = {
        'role': FamilyRole.admin.name,
        'displayName': user['displayName'],
        'phone': user['phone'],
      };
      user['familyIds'] = [...((user['familyIds'] as List?) ?? const []), fid];
      return fid;
    });
  }

  @override
  Stream<Family?> watchFamily(String familyId) => _db.watch((db) {
        final m = LocalDb.read(db, ['families', familyId]);
        return m == null ? null : Family.fromMap(familyId, m);
      });

  @override
  Stream<List<Member>> watchMembers(String familyId) => _db.watch((db) =>
      (LocalDb.read(db, ['members', familyId]) ?? const {})
          .entries
          .map((e) => Member.fromMap(e.key, Map<String, dynamic>.from(e.value as Map)))
          .toList());

  @override
  Stream<List<Invite>> watchInvites(String familyId) => _db.watch((db) =>
      (LocalDb.read(db, ['invites', familyId]) ?? const {})
          .entries
          .map((e) => Invite.fromMap(e.key, Map<String, dynamic>.from(e.value as Map)))
          .toList());

  @override
  Stream<List<Elder>> watchElders(String familyId) => _db.watch((db) =>
      (LocalDb.read(db, ['elders', familyId]) ?? const {})
          .entries
          .map((e) => Elder.fromMap(e.key, familyId, Map<String, dynamic>.from(e.value as Map)))
          .toList());

  @override
  Stream<Elder?> watchElder(String familyId, String elderId) => _db.watch((db) {
        final m = LocalDb.read(db, ['elders', familyId, elderId]);
        return m == null ? null : Elder.fromMap(elderId, familyId, m);
      });

  Family _family(Map<String, dynamic> db, String familyId) {
    final m = LocalDb.read(db, ['families', familyId]);
    if (m == null) throw const PermissionFailure();
    return Family.fromMap(familyId, m);
  }

  @override
  Future<Elder> addElder(String familyId, ElderDraft draft) {
    final uid = _uid;
    final eid = _db.newId();
    return _db.mutate((db) {
      final family = _family(db, familyId);
      final elders = LocalDb.node(db, ['elders', familyId]);
      if (elders.length >= family.maxElders) throw const PlanLimitFailure();
      elders[eid] = {...draft.toMap(), 'linkedUid': null, 'createdBy': uid};
      return Elder(
        id: eid,
        familyId: familyId,
        name: draft.name,
        nickname: draft.nickname,
        relation: draft.relation,
        phone: draft.phone,
      );
    });
  }

  @override
  Future<void> invite(String familyId, {required String phone, required FamilyRole role}) {
    _uid;
    final id = _db.newId();
    return _db.mutate((db) {
      final family = _family(db, familyId);
      final members = LocalDb.node(db, ['members', familyId]).values
          .where((m) => (m as Map)['role'] != FamilyRole.elder.name)
          .length;
      final invites = LocalDb.node(db, ['invites', familyId]);
      if (members + invites.length >= family.maxMembers) throw const PlanLimitFailure();
      invites[id] = {'phone': phone, 'role': role.name, 'status': 'pending'};
    });
  }
}
