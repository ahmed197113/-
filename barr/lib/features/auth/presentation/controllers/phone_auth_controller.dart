import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/auth_providers.dart';
import '../../domain/auth_repository.dart';

/// Holds the pending SMS verification between the phone and OTP screens.
class PhoneAuthController extends Notifier<PhoneVerification?> {
  @override
  PhoneVerification? build() => null;

  Future<PhoneVerification> sendOtp(String phoneE164, {bool resend = false}) async {
    final v = await ref.read(authRepositoryProvider).sendOtp(
          phoneE164,
          resendToken: resend ? state?.resendToken : null,
        );
    state = v;
    return v;
  }

  Future<void> confirm(String code) async {
    final v = state;
    if (v == null) throw StateError('No pending verification');
    await ref.read(authRepositoryProvider).confirmOtp(v, code);
  }
}

final phoneAuthControllerProvider =
    NotifierProvider<PhoneAuthController, PhoneVerification?>(PhoneAuthController.new);
