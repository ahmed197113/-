import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/services/service_providers.dart';
import '../../medications/data/medication_providers.dart';
import '../../medications/domain/dose_schedule.dart';
import '../../medications/domain/medication.dart';
import '../data/elder_home_providers.dart';

/// Parent's actions on a dose: "أخذته" / "لاحقًا".
class ElderDoseController {
  ElderDoseController(this._ref);

  final Ref _ref;

  Future<void> act(ScheduledDose dose, DoseStatus status) async {
    final elder = _ref.read(myElderRefProvider);
    if (elder == null) return;
    await _ref.read(medicationRepositoryProvider).logDose(
          elder.familyId,
          elder.elderId,
          doseId: dose.id,
          medication: dose.medication,
          scheduledAt: dose.at,
          status: status,
        );
    // Taken: stop the remaining repeats now (the plan resync also drops
    // them). Later: the next repeat (10 min) stays scheduled.
    if (status == DoseStatus.taken) {
      await _ref.read(reminderSchedulerProvider).cancelDose(dose.id);
    }
  }
}

final elderDoseControllerProvider = Provider<ElderDoseController>(ElderDoseController.new);
