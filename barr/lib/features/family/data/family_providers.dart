import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/family.dart';
import '../../auth/data/auth_providers.dart';
import '../domain/family_repository.dart';
import 'firestore_family_repository.dart';
import 'local_family_repository.dart';

final familyRepositoryProvider = Provider<FamilyRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalFamilyRepository(ref.watch(localDbProvider));
  return FirestoreFamilyRepository(
    FirebaseFirestore.instance,
    FirebaseFunctions.instance,
    FirebaseAuth.instance,
  );
});

/// The family currently shown in the caregiver UI.
final currentFamilyIdProvider = Provider<String?>(
  (ref) => ref.watch(currentProfileProvider).value?.primaryFamilyId,
);

final familyProvider = StreamProvider.family<Family?, String>(
  (ref, fid) => ref.watch(familyRepositoryProvider).watchFamily(fid),
);

final membersProvider = StreamProvider.family<List<Member>, String>(
  (ref, fid) => ref.watch(familyRepositoryProvider).watchMembers(fid),
);

final invitesProvider = StreamProvider.family<List<Invite>, String>(
  (ref, fid) => ref.watch(familyRepositoryProvider).watchInvites(fid),
);

final eldersProvider = StreamProvider.family<List<Elder>, String>(
  (ref, fid) => ref.watch(familyRepositoryProvider).watchElders(fid),
);

/// Role of the signed-in user in [fid] (viewer until loaded).
final myRoleProvider = Provider.family<FamilyRole, String>((ref, fid) {
  final uid = ref.watch(authUidProvider).value;
  final members = ref.watch(membersProvider(fid)).value ?? const [];
  return members.where((m) => m.uid == uid).firstOrNull?.role ?? FamilyRole.viewer;
});
