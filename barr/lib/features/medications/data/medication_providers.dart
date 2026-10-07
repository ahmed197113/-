import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_db.dart';
import '../../../core/utils/clock.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../domain/dose_schedule.dart';
import '../domain/medication.dart';
import '../domain/medication_repository.dart';
import 'firestore_medication_repository.dart';
import 'local_medication_repository.dart';

final medicationRepositoryProvider = Provider<MedicationRepository>((ref) {
  if (ref.watch(appConfigProvider).isDemo) {
    return LocalMedicationRepository(ref.watch(localDbProvider));
  }
  return FirestoreMedicationRepository(
    FirebaseFirestore.instance,
    FirebaseStorage.instance,
    FirebaseAuth.instance,
  );
});

final medicationsProvider = StreamProvider.family<List<Medication>, ElderRef>(
  (ref, e) => ref.watch(medicationRepositoryProvider).watchMedications(e.familyId, e.elderId),
);

/// Dose logs from today through the next 7 days (the reminder window).
final doseLogsProvider = StreamProvider.family<Map<String, DoseLog>, ElderRef>((ref, e) {
  final today = ref.watch(todayProvider);
  return ref.watch(medicationRepositoryProvider).watchDoseLogs(
        e.familyId,
        e.elderId,
        from: today,
        to: today.add(const Duration(days: 8)),
      );
});

/// Today's doses for one parent, or `null` while loading.
final todayDosesProvider = Provider.family<List<ScheduledDose>?, ElderRef>((ref, e) {
  final meds = ref.watch(medicationsProvider(e)).value;
  final logs = ref.watch(doseLogsProvider(e)).value;
  if (meds == null || logs == null) return null;
  return dosesForDay(meds, ref.watch(todayProvider), logs);
});
