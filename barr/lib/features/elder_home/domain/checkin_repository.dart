import '../../../shared/domain/entities/app_user.dart';

abstract interface class CheckinRepository {
  /// Records today's "I'm fine". Idempotent per day.
  Future<void> checkIn(ElderRef elder, {String source = 'button'});

  /// Heartbeat from the parent's phone (inactivity alerts) + its timezone
  /// (server-side reminders and alerts use the parent's local time).
  Future<void> touch(ElderRef elder, {required String timezone});
}
