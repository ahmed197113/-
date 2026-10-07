/// Result of requesting an SMS code.
class PhoneVerification {
  const PhoneVerification({
    required this.phone,
    required this.verificationId,
    this.resendToken,
    this.autoVerified = false,
  });

  /// E.164 phone number.
  final String phone;
  final String verificationId;
  final int? resendToken;

  /// Android may verify the SMS automatically; the user is then already
  /// signed in and the OTP screen can be skipped.
  final bool autoVerified;
}

abstract interface class AuthRepository {
  /// Emits the signed-in uid, or `null` when signed out.
  Stream<String?> uidChanges();

  String? get currentUid;

  /// Phone number of the signed-in user (E.164), if any.
  String? get currentPhone;

  Future<PhoneVerification> sendOtp(String phoneE164, {int? resendToken});

  Future<void> confirmOtp(PhoneVerification verification, String code);

  Future<void> signOut();

  /// Deletes the account and all data the user owns (server-side).
  Future<void> deleteAccount();
}
