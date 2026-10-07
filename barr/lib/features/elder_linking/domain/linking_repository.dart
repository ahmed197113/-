import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/elder.dart';

abstract interface class LinkingRepository {
  /// Issues a fresh one-time code for [elderId] (caregivers only).
  Future<LinkCode> createLinkCode(String familyId, String elderId);

  /// Redeems [code] on the parent's device.
  ///
  /// If nobody is signed in, a dedicated elder account is created and the
  /// device is signed into it (no OTP needed). If an elder account is
  /// already signed in (registered by phone), that account is linked.
  /// Throws [InvalidLinkCodeFailure] for unknown, used or expired codes.
  Future<ElderRef> redeem(String code);
}
