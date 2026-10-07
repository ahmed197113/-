import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'failure.dart';

/// Converts Firebase SDK exceptions into domain [Failure]s.
Failure mapFirebaseError(Object error) {
  if (error is Failure) return error;
  if (error is FirebaseAuthException) {
    return switch (error.code) {
      'invalid-verification-code' || 'invalid-verification-id' => InvalidOtpFailure(error.code),
      'too-many-requests' || 'quota-exceeded' => TooManyRequestsFailure(error.code),
      'network-request-failed' => NetworkFailure(error.code),
      'session-expired' || 'user-token-expired' || 'requires-recent-login' => SessionExpiredFailure(error.code),
      _ => UnknownFailure(error.code),
    };
  }
  if (error is FirebaseFunctionsException) {
    return switch (error.code) {
      'not-found' || 'invalid-argument' when error.details == 'link-code' => InvalidLinkCodeFailure(error.message),
      'permission-denied' || 'unauthenticated' => PermissionFailure(error.message),
      'resource-exhausted' => PlanLimitFailure(error.message),
      'unavailable' || 'deadline-exceeded' => NetworkFailure(error.message),
      _ => UnknownFailure('${error.code}: ${error.message}'),
    };
  }
  if (error is FirebaseException) {
    return switch (error.code) {
      'permission-denied' => PermissionFailure(error.message),
      'unavailable' || 'deadline-exceeded' => NetworkFailure(error.message),
      _ => UnknownFailure('${error.code}: ${error.message}'),
    };
  }
  return UnknownFailure(error.toString());
}

/// Runs [body] and rethrows any error as a [Failure].
Future<T> guardFirebase<T>(Future<T> Function() body) async {
  try {
    return await body();
  } catch (e) {
    throw mapFirebaseError(e);
  }
}
