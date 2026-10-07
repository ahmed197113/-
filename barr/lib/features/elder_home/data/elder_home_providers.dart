import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/family.dart';
import '../../auth/data/auth_providers.dart';
import '../../family/data/family_providers.dart';
import '../domain/checkin_repository.dart';
import 'firestore_checkin_repository.dart';
import 'local_checkin_repository.dart';

final checkinRepositoryProvider = Provider<CheckinRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalCheckinRepository(ref.watch(localDbProvider));
  return FirestoreCheckinRepository(FirebaseFirestore.instance, FirebaseAuth.instance);
});

/// The elder record of the signed-in parent.
final myElderProvider = StreamProvider<Elder?>((ref) {
  final elderRef = ref.watch(currentProfileProvider).value?.elderRef;
  if (elderRef == null) return Stream.value(null);
  return ref.watch(familyRepositoryProvider).watchElder(elderRef.familyId, elderRef.elderId);
});

/// Children (caregivers/admins) the parent can call, in join order.
final myChildrenProvider = Provider<List<Member>>((ref) {
  final fid = ref.watch(currentProfileProvider).value?.elderRef?.familyId;
  if (fid == null) return const [];
  final members = ref.watch(membersProvider(fid)).value ?? const [];
  return members
      .where((m) => m.role == FamilyRole.admin || m.role == FamilyRole.caregiver)
      .toList();
});
