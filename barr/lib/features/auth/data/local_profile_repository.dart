import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/enums.dart';
import '../domain/profile_repository.dart';

class LocalProfileRepository implements ProfileRepository {
  LocalProfileRepository(this._db);

  final LocalDb _db;

  @override
  Stream<AppUser?> watch(String uid) => _db.watch((db) {
        final m = LocalDb.read(db, ['users', uid]);
        return m == null ? null : AppUser.fromMap(uid, m);
      });

  @override
  Future<void> create({
    required String uid,
    required String displayName,
    required AccountType accountType,
    String? phone,
  }) =>
      _db.mutate((db) {
        final familyIds = <String>[];
        if (accountType == AccountType.caregiver && phone != null) {
          // Equivalent of the `claimInvites` Cloud Function.
          final invites = LocalDb.node(db, ['invites']);
          for (final entry in invites.entries) {
            final fid = entry.key;
            final byId = Map<String, dynamic>.from(entry.value as Map);
            for (final invite in byId.entries.toList()) {
              final m = Map<String, dynamic>.from(invite.value as Map);
              if (m['phone'] != phone) continue;
              LocalDb.node(db, ['members', fid])[uid] = {
                'role': m['role'],
                'displayName': displayName,
                'phone': phone,
              };
              LocalDb.node(db, ['invites', fid]).remove(invite.key);
              familyIds.add(fid);
            }
          }
        }
        LocalDb.node(db, ['users'])[uid] = {
          'displayName': displayName,
          'accountType': accountType.name,
          'phone': phone,
          'familyIds': familyIds,
        };
      });
}
