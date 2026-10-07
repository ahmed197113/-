import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../domain/linking_repository.dart';
import 'firebase_linking_repository.dart';
import 'local_linking_repository.dart';

final linkingRepositoryProvider = Provider<LinkingRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalLinkingRepository(ref.watch(localDbProvider));
  return FirebaseLinkingRepository(FirebaseFunctions.instance, FirebaseAuth.instance);
});
