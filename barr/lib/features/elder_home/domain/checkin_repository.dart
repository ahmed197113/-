import '../../../shared/domain/entities/app_user.dart';

abstract interface class CheckinRepository {
  /// Records today's "I'm fine". Idempotent per day.
  Future<void> checkIn(ElderRef elder, {String source = 'button'});
}
