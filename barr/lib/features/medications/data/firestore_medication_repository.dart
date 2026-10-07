import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/firebase_failure_mapper.dart';
import '../../../core/firebase/firestore_utils.dart';
import '../domain/medication.dart';
import '../domain/medication_repository.dart';

class FirestoreMedicationRepository implements MedicationRepository {
  FirestoreMedicationRepository(this._db, this._storage, this._auth);

  final FirebaseFirestore _db;
  final FirebaseStorage _storage;
  final FirebaseAuth _auth;

  @override
  Stream<List<Medication>> watchMedications(String familyId, String elderId) => _db
      .collection(FsPaths.medications(familyId, elderId))
      .where('active', isEqualTo: true)
      .snapshots()
      .map((q) => q.docs.map((d) => Medication.fromMap(d.id, normalizeFirestore(d.data()))).toList()
        ..sort((a, b) => a.name.compareTo(b.name)));

  @override
  Future<Medication> save(String familyId, String elderId, Medication medication) =>
      guardFirebase(() async {
        final col = _db.collection(FsPaths.medications(familyId, elderId));
        if (medication.id.isEmpty) {
          // Free-plan limit (also enforced by security rules).
          final family = (await _db.doc(FsPaths.family(familyId)).get()).data() ?? const {};
          final count = ((family['counts'] as Map?)?['medications'] as num?)?.toInt() ?? 0;
          final limit = ((family['limits'] as Map?)?['maxMedications'] as num?)?.toInt() ?? 3;
          if (count >= limit) throw const PlanLimitFailure();
          final ref = col.doc();
          await ref.set({
            ...medication.toMap(),
            'createdBy': _auth.currentUser?.uid,
            'createdAt': FieldValue.serverTimestamp(),
          });
          return medication.copyWith(id: ref.id);
        }
        await col.doc(medication.id).set({
          ...medication.toMap(),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
        return medication;
      });

  @override
  Future<void> delete(String familyId, String elderId, String medicationId) => guardFirebase(
        () => _db.doc('${FsPaths.medications(familyId, elderId)}/$medicationId').delete(),
      );

  @override
  Stream<Map<String, DoseLog>> watchDoseLogs(
    String familyId,
    String elderId, {
    required DateTime from,
    required DateTime to,
  }) =>
      _db
          .collection(FsPaths.doseLogs(familyId, elderId))
          .where('scheduledAt', isGreaterThanOrEqualTo: Timestamp.fromDate(from))
          .where('scheduledAt', isLessThan: Timestamp.fromDate(to))
          .snapshots()
          .map((q) => {
                for (final d in q.docs) d.id: DoseLog.fromMap(d.id, normalizeFirestore(d.data())),
              });

  @override
  Future<void> logDose(
    String familyId,
    String elderId, {
    required String doseId,
    required Medication medication,
    required DateTime scheduledAt,
    required DoseStatus status,
    String source = 'elder',
  }) =>
      guardFirebase(() async {
        // Not awaited: lands in the offline cache immediately and syncs later.
        // Stock is decremented server-side by `onDoseLogWritten`.
        _db.doc('${FsPaths.doseLogs(familyId, elderId)}/$doseId').set({
          'medId': medication.id,
          'scheduledAt': Timestamp.fromDate(scheduledAt),
          'status': status.name,
          'actedAt': FieldValue.serverTimestamp(),
          'source': source,
          'by': _auth.currentUser?.uid,
          if (status == DoseStatus.snoozed) 'snoozeCount': FieldValue.increment(1),
        }, SetOptions(merge: true)).ignore();
      });

  @override
  Future<void> setBuyer(String familyId, String elderId, String medicationId, StockBuyer? buyer) =>
      guardFirebase(() => _db.doc('${FsPaths.medications(familyId, elderId)}/$medicationId').update({
            'stock.buyer': buyer == null ? FieldValue.delete() : {'uid': buyer.uid, 'name': buyer.name},
          }));

  @override
  Future<String> uploadPhoto(String familyId, String elderId, Uint8List bytes) =>
      guardFirebase(() async {
        final ref = _storage.ref(
            'families/$familyId/elders/$elderId/medications/${DateTime.now().millisecondsSinceEpoch}.jpg');
        await ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
        return ref.getDownloadURL();
      });
}
