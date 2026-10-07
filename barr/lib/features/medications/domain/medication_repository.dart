import 'dart:typed_data';

import 'medication.dart';

abstract interface class MedicationRepository {
  Stream<List<Medication>> watchMedications(String familyId, String elderId);

  /// Creates (empty id) or updates. Throws [PlanLimitFailure] when the
  /// family's medication limit is reached.
  Future<Medication> save(String familyId, String elderId, Medication medication);

  Future<void> delete(String familyId, String elderId, String medicationId);

  /// Logs keyed by dose id, for doses scheduled in [from, to).
  Stream<Map<String, DoseLog>> watchDoseLogs(
    String familyId,
    String elderId, {
    required DateTime from,
    required DateTime to,
  });

  /// Records the parent's (or a caregiver's) action on a dose. Taking a dose
  /// decrements the tracked stock.
  Future<void> logDose(
    String familyId,
    String elderId, {
    required String doseId,
    required Medication medication,
    required DateTime scheduledAt,
    required DoseStatus status,
    String source = 'elder',
  });

  /// "سأشتريه أنا" — or clears the claim when [buyer] is null.
  Future<void> setBuyer(String familyId, String elderId, String medicationId, StockBuyer? buyer);

  /// Stores the box photo and returns a URL (or local path in demo mode).
  Future<String> uploadPhoto(String familyId, String elderId, Uint8List bytes);
}
