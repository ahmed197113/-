import 'package:flutter/widgets.dart';

import '../l10n/generated/app_localizations.dart';
import 'failure.dart';

/// Localized, user-facing message for any error thrown by a repository.
String failureMessage(BuildContext context, Object? error) {
  final l = AppLocalizations.of(context);
  return switch (error) {
    NetworkFailure() => l.errorNetwork,
    InvalidOtpFailure() => l.errorInvalidOtp,
    TooManyRequestsFailure() => l.errorTooManyRequests,
    InvalidLinkCodeFailure() => l.errorInvalidLinkCode,
    PermissionFailure() => l.errorPermissionDenied,
    PlanLimitFailure() => l.errorPlanLimit,
    SessionExpiredFailure() => l.errorSessionExpired,
    _ => l.errorUnknown,
  };
}
