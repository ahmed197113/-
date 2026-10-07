import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/error/firebase_failure_mapper.dart';
import '../../../core/firebase/firestore_utils.dart';
import '../../../core/utils/dates.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/checkin_repository.dart';

class FirestoreCheckinRepository implements CheckinRepository {
  FirestoreCheckinRepository(this._db, this._auth);

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  @override
  Future<void> checkIn(ElderRef elder, {String source = 'button'}) => guardFirebase(() async {
        // Deterministic per-day id: offline retries never duplicate.
        // Not awaited: the write lands in the local cache immediately and
        // syncs when online. `onCheckinCreated` updates lastCheckinAt.
        final doc = _db
            .collection(FsPaths.checkins(elder.familyId, elder.elderId))
            .doc(dayKey(DateTime.now()));
        doc.set({
          'at': FieldValue.serverTimestamp(),
          'clientAt': Timestamp.now(),
          'source': source,
          'by': _auth.currentUser?.uid,
        }).ignore();
      });

  @override
  Future<void> touch(ElderRef elder, {required String timezone}) => guardFirebase(() async {
        _db.doc(FsPaths.elder(elder.familyId, elder.elderId)).update({
          'lastSeenAt': FieldValue.serverTimestamp(),
          'timezone': timezone,
        }).ignore();
      });
}
