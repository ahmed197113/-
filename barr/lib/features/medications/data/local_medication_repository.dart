import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

import '../../../core/error/failure.dart';
import '../../../core/storage/local_db.dart';
import '../domain/medication.dart';
import '../domain/medication_repository.dart';

class LocalMedicationRepository implements MedicationRepository {
  LocalMedicationRepository(this._db, {DateTime Function()? clock}) : _now = clock ?? DateTime.now;

  final LocalDb _db;
  final DateTime Function() _now;

  @override
  Stream<List<Medication>> watchMedications(String familyId, String elderId) => _db.watch((db) =>
      (LocalDb.read(db, ['medications', familyId, elderId]) ?? const {})
          .entries
          .map((e) => Medication.fromMap(e.key, Map<String, dynamic>.from(e.value as Map)))
          .where((m) => m.active)
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name)));

  @override
  Future<Medication> save(String familyId, String elderId, Medication medication) {
    final id = medication.id.isEmpty ? _db.newId() : medication.id;
    return _db.mutate((db) {
      if (medication.id.isEmpty) {
        final family = LocalDb.read(db, ['families', familyId]);
        final limit = ((family?['limits'] as Map?)?['maxMedications'] as num?)?.toInt() ?? 3;
        final count = (LocalDb.read(db, ['medications', familyId]) ?? const {})
            .values
            .whereType<Map>()
            .fold<int>(0, (total, perElder) => total + perElder.length);
        if (count >= limit) throw const PlanLimitFailure();
      }
      LocalDb.node(db, ['medications', familyId, elderId])[id] = medication.toMap();
      return medication.copyWith(id: id);
    });
  }

  @override
  Future<void> delete(String familyId, String elderId, String medicationId) =>
      _db.mutate((db) => LocalDb.node(db, ['medications', familyId, elderId]).remove(medicationId));

  @override
  Stream<Map<String, DoseLog>> watchDoseLogs(
    String familyId,
    String elderId, {
    required DateTime from,
    required DateTime to,
  }) =>
      _db.watch((db) => {
            for (final e in (LocalDb.read(db, ['doseLogs', familyId, elderId]) ?? const {}).entries)
              e.key: DoseLog.fromMap(e.key, Map<String, dynamic>.from(e.value as Map)),
          }..removeWhere((_, l) => l.scheduledAt.isBefore(from) || !l.scheduledAt.isBefore(to)));

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
      _db.mutate((db) {
        final logs = LocalDb.node(db, ['doseLogs', familyId, elderId]);
        final previous = logs[doseId] as Map?;
        logs[doseId] = {
          'medId': medication.id,
          'scheduledAt': scheduledAt.millisecondsSinceEpoch,
          'status': status.name,
          'actedAt': _now().millisecondsSinceEpoch,
          'source': source,
          'snoozeCount': ((previous?['snoozeCount'] as num?)?.toInt() ?? 0) +
              (status == DoseStatus.snoozed ? 1 : 0),
        };
        final wasTaken = previous?['status'] == DoseStatus.taken.name;
        if (status == DoseStatus.taken && !wasTaken) {
          // Equivalent of the `onDoseLogWritten` Cloud Function.
          final med = LocalDb.read(db, ['medications', familyId, elderId, medication.id]);
          final qty = ((med?['stock'] as Map?)?['qty'] as num?)?.toInt();
          if (qty != null) {
            LocalDb.node(db, ['medications', familyId, elderId, medication.id, 'stock'])['qty'] =
                (qty - medication.perDose).clamp(0, 1 << 30);
          }
        }
      });

  @override
  Future<void> setBuyer(String familyId, String elderId, String medicationId, StockBuyer? buyer) =>
      _db.mutate((db) {
        final stock = LocalDb.node(db, ['medications', familyId, elderId, medicationId, 'stock']);
        if (buyer == null) {
          stock.remove('buyer');
        } else {
          stock['buyer'] = {'uid': buyer.uid, 'name': buyer.name};
        }
      });

  @override
  Future<String> uploadPhoto(String familyId, String elderId, Uint8List bytes) async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/med_${_now().millisecondsSinceEpoch}.jpg');
    await file.writeAsBytes(bytes);
    return file.path;
  }
}
