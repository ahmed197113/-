import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../../../core/error/firebase_failure_mapper.dart';
import '../../../core/firebase/firestore_utils.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/enums.dart';
import '../domain/profile_repository.dart';

class FirestoreProfileRepository implements ProfileRepository {
  FirestoreProfileRepository(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  @override
  Stream<AppUser?> watch(String uid) => _db.doc(FsPaths.user(uid)).snapshots().map(
        (s) => s.exists ? AppUser.fromMap(uid, normalizeFirestore(s.data()!)) : null,
      );

  @override
  Future<void> create({
    required String uid,
    required String displayName,
    required AccountType accountType,
    String? phone,
  }) =>
      guardFirebase(() async {
        // Security rules only allow the owner to create their doc with an
        // empty familyIds list; memberships are granted server-side.
        await _db.doc(FsPaths.user(uid)).set({
          'displayName': displayName,
          'accountType': accountType.name,
          'phone': phone,
          'familyIds': <String>[],
          'locale': 'ar',
          'createdAt': FieldValue.serverTimestamp(),
        });
        if (accountType == AccountType.caregiver) {
          await _functions.httpsCallable('claimInvites').call<void>();
        }
      });
}
