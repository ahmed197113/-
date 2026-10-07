import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/firebase_failure_mapper.dart';
import '../../../core/firebase/firestore_utils.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/family.dart';
import '../domain/family_repository.dart';

class FirestoreFamilyRepository implements FamilyRepository {
  FirestoreFamilyRepository(this._db, this._functions, this._auth);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;

  @override
  Future<String> createFamily(String name) => guardFirebase(() async {
        final result = await _functions
            .httpsCallable('createFamily')
            .call<Map<String, dynamic>>({'name': name});
        return result.data['familyId'] as String;
      });

  @override
  Stream<Family?> watchFamily(String familyId) => _db.doc(FsPaths.family(familyId)).snapshots().map(
        (s) => s.exists ? Family.fromMap(s.id, normalizeFirestore(s.data()!)) : null,
      );

  @override
  Stream<List<Member>> watchMembers(String familyId) =>
      _db.collection(FsPaths.members(familyId)).snapshots().map((q) => q.docs
          .map((d) => Member.fromMap(d.id, normalizeFirestore(d.data())))
          .toList());

  @override
  Stream<List<Invite>> watchInvites(String familyId) => _db
      .collection(FsPaths.invites(familyId))
      .where('status', isEqualTo: 'pending')
      .snapshots()
      .map((q) => q.docs.map((d) => Invite.fromMap(d.id, d.data())).toList());

  @override
  Stream<List<Elder>> watchElders(String familyId) =>
      _db.collection(FsPaths.elders(familyId)).orderBy('createdAt').snapshots().map((q) => q.docs
          .map((d) => Elder.fromMap(d.id, familyId, normalizeFirestore(d.data())))
          .toList());

  @override
  Stream<Elder?> watchElder(String familyId, String elderId) =>
      _db.doc(FsPaths.elder(familyId, elderId)).snapshots().map((s) =>
          s.exists ? Elder.fromMap(s.id, familyId, normalizeFirestore(s.data()!)) : null);

  @override
  Future<Elder> addElder(String familyId, ElderDraft draft) => guardFirebase(() async {
        // The free-plan limit is enforced by security rules (families.counts);
        // a rejected write surfaces as permission-denied, so pre-check here to
        // give a precise message.
        await _ensureCapacity(familyId, const ['elders'], 'maxElders');
        final ref = _db.collection(FsPaths.elders(familyId)).doc();
        await ref.set({
          ...draft.toMap(),
          'linkedUid': null,
          'checkinDeadline': '10:00',
          'createdBy': _auth.currentUser?.uid,
          'createdAt': FieldValue.serverTimestamp(),
        });
        return Elder(
          id: ref.id,
          familyId: familyId,
          name: draft.name,
          nickname: draft.nickname,
          relation: draft.relation,
          phone: draft.phone,
        );
      });

  @override
  Future<void> updateElderSettings(String familyId, String elderId, ElderSettings settings) =>
      guardFirebase(() => _db.doc(FsPaths.elder(familyId, elderId)).update(settings.toMap()));

  @override
  Future<void> invite(String familyId, {required String phone, required FamilyRole role}) =>
      guardFirebase(() async {
        await _ensureCapacity(familyId, const ['members', 'invites'], 'maxMembers');
        await _db.collection(FsPaths.invites(familyId)).add({
          'phone': phone,
          'role': role.name,
          'status': 'pending',
          'createdBy': _auth.currentUser?.uid,
          'createdAt': FieldValue.serverTimestamp(),
          'expiresAt': Timestamp.fromDate(DateTime.now().add(const Duration(days: 30))),
        });
      });

  Future<void> _ensureCapacity(String familyId, List<String> countKeys, String limitKey) async {
    final snap = await _db.doc(FsPaths.family(familyId)).get();
    final data = snap.data() ?? const {};
    final counts = (data['counts'] as Map?) ?? const {};
    final count = countKeys.fold<int>(0, (total, k) => total + ((counts[k] as num?)?.toInt() ?? 0));
    final limit = ((data['limits'] as Map?)?[limitKey] as num?)?.toInt() ?? 1;
    if (count >= limit) throw const PlanLimitFailure();
  }
}
