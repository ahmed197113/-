import '../../../shared/domain/entities/app_user.dart';
import 'sos_event.dart';

abstract interface class SosRepository {
  /// Raises an emergency. Works offline (queued), the server fans out pushes.
  Future<String> trigger(ElderRef elder, {GeoFix? location});

  /// Events from the last 48 hours (open ones included), newest first.
  Stream<List<SosEvent>> watchRecent(ElderRef elder);

  /// "أنا متابع" — tells the family someone is on it.
  Future<void> acknowledge(ElderRef elder, String eventId, {required String byName});

  /// "تم الاطمئنان" (caregiver) or "ألغِ التنبيه" (parent).
  Future<void> resolve(ElderRef elder, String eventId, {required String byName});
}
