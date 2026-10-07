import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/location_service.dart';
import '../domain/sos_event.dart';
import '../domain/sos_repository.dart';
import 'firestore_sos_repository.dart';
import 'geolocator_location_service.dart';
import 'local_sos_repository.dart';

final sosRepositoryProvider = Provider<SosRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return LocalSosRepository(ref.watch(localDbProvider));
  return FirestoreSosRepository(FirebaseFirestore.instance, FirebaseAuth.instance);
});

final locationServiceProvider = Provider<LocationService>((ref) => GeolocatorLocationService());

final recentSosProvider = StreamProvider.family<List<SosEvent>, ElderRef>(
  (ref, e) => ref.watch(sosRepositoryProvider).watchRecent(e),
);
