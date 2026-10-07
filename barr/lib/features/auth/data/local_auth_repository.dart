import '../../../core/error/failure.dart';
import '../../../core/storage/local_db.dart';
import '../domain/auth_repository.dart';

/// Demo-mode auth: any valid phone number, OTP is always [demoOtp].
class LocalAuthRepository implements AuthRepository {
  LocalAuthRepository(this._db);

  static const demoOtp = '123456';

  final LocalDb _db;

  @override
  Stream<String?> uidChanges() => _db.watch((db) => db['currentUid'] as String?);

  @override
  String? get currentUid => _db.data['currentUid'] as String?;

  @override
  String? get currentPhone {
    final uid = currentUid;
    if (uid == null) return null;
    return LocalDb.read(_db.data, ['auth', uid])?['phone'] as String?;
  }

  @override
  Future<PhoneVerification> sendOtp(String phoneE164, {int? resendToken}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return PhoneVerification(phone: phoneE164, verificationId: 'local:$phoneE164');
  }

  @override
  Future<void> confirmOtp(PhoneVerification verification, String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (code != demoOtp) throw const InvalidOtpFailure();
    final uid = 'u${verification.phone.replaceAll('+', '')}';
    await _db.mutate((db) {
      LocalDb.node(db, ['auth', uid])['phone'] = verification.phone;
      db['currentUid'] = uid;
    });
  }

  @override
  Future<void> signOut() => _db.mutate((db) => db['currentUid'] = null);

  @override
  Future<void> deleteAccount() async {
    final uid = currentUid;
    if (uid == null) throw const SessionExpiredFailure();
    await _db.mutate((db) {
      final user = LocalDb.read(db, ['users', uid]);
      final familyIds = List<String>.from((user?['familyIds'] as List?) ?? const []);
      for (final fid in familyIds) {
        final family = LocalDb.read(db, ['families', fid]);
        if (family?['ownerUid'] == uid) {
          // Owner deletes the whole family space.
          for (final col in ['families', 'members', 'invites', 'elders', 'checkins', 'medications', 'doseLogs', 'sosEvents']) {
            LocalDb.node(db, [col]).remove(fid);
          }
          for (final other in LocalDb.node(db, ['users']).values.whereType<Map>()) {
            (other['familyIds'] as List?)?.remove(fid);
            if ((other['elderRef'] as Map?)?['familyId'] == fid) other.remove('elderRef');
          }
        } else {
          LocalDb.node(db, ['members', fid]).remove(uid);
        }
      }
      LocalDb.node(db, ['users']).remove(uid);
      LocalDb.node(db, ['auth']).remove(uid);
      db['currentUid'] = null;
    });
  }
}
