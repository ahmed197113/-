import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/error/firebase_failure_mapper.dart';
import '../../../core/firebase/firestore_utils.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/sos_event.dart';
import '../domain/sos_repository.dart';

class FirestoreSosRepository implements SosRepository {
  FirestoreSosRepository(this._db, this._auth);

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> _col(ElderRef e) =>
      _db.collection('${FsPaths.elder(e.familyId, e.elderId)}/sosEvents');

  @override
  Future<String> trigger(ElderRef elder, {GeoFix? location}) => guardFirebase(() async {
        final ref = _col(elder).doc();
        // Not awaited: queued offline; `onSosCreated` pushes to the family.
        ref.set({
          'at': FieldValue.serverTimestamp(),
          'clientAt': Timestamp.now(),
          'status': SosStatus.active.name,
          'location': location?.toMap(),
          'by': _auth.currentUser?.uid,
          'acknowledgedBy': <String>[],
        }).ignore();
        return ref.id;
      });

  @override
  Stream<List<SosEvent>> watchRecent(ElderRef elder) => _col(elder)
      .where('clientAt',
          isGreaterThan: Timestamp.fromDate(DateTime.now().subtract(const Duration(hours: 48))))
      .orderBy('clientAt', descending: true)
      .snapshots()
      .map((q) => q.docs.map((d) {
            final data = normalizeFirestore(d.data());
            data['at'] ??= data['clientAt'];
            return SosEvent.fromMap(d.id, elder.familyId, elder.elderId, data);
          }).toList());

  @override
  Future<void> acknowledge(ElderRef elder, String eventId, {required String byName}) =>
      guardFirebase(() => _col(elder).doc(eventId).update({
            'status': SosStatus.acknowledged.name,
            'acknowledgedBy': FieldValue.arrayUnion([byName]),
          }));

  @override
  Future<void> resolve(ElderRef elder, String eventId, {required String byName}) =>
      guardFirebase(() => _col(elder).doc(eventId).update({
            'status': SosStatus.resolved.name,
            'resolvedBy': byName,
            'resolvedAt': FieldValue.serverTimestamp(),
          }));
}
