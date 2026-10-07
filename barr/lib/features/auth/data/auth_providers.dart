import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/auth_repository.dart';
import '../domain/profile_repository.dart';
import 'firebase_auth_repository.dart';
import 'firestore_profile_repository.dart';
import 'local_auth_repository.dart';
import 'local_profile_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalAuthRepository(ref.watch(localDbProvider));
  return FirebaseAuthRepository(FirebaseAuth.instance, FirebaseFunctions.instance);
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalProfileRepository(ref.watch(localDbProvider));
  return FirestoreProfileRepository(FirebaseFirestore.instance, FirebaseFunctions.instance);
});

final authUidProvider = StreamProvider<String?>(
  (ref) => ref.watch(authRepositoryProvider).uidChanges(),
);

final currentProfileProvider = StreamProvider<AppUser?>((ref) {
  final uid = ref.watch(authUidProvider).value;
  if (uid == null) return Stream.value(null);
  return ref.watch(profileRepositoryProvider).watch(uid);
});
