/// Domain-level failure. Repositories translate SDK exceptions into these,
/// and the UI maps them to localized Arabic/English messages.
sealed class Failure implements Exception {
  const Failure([this.debugMessage]);
  final String? debugMessage;

  @override
  String toString() => '$runtimeType(${debugMessage ?? ''})';
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.debugMessage]);
}

class InvalidOtpFailure extends Failure {
  const InvalidOtpFailure([super.debugMessage]);
}

class TooManyRequestsFailure extends Failure {
  const TooManyRequestsFailure([super.debugMessage]);
}

class InvalidLinkCodeFailure extends Failure {
  const InvalidLinkCodeFailure([super.debugMessage]);
}

class PermissionFailure extends Failure {
  const PermissionFailure([super.debugMessage]);
}

class PlanLimitFailure extends Failure {
  const PlanLimitFailure([super.debugMessage]);
}

class SessionExpiredFailure extends Failure {
  const SessionExpiredFailure([super.debugMessage]);
}

class UnknownFailure extends Failure {
  const UnknownFailure([super.debugMessage]);
}
