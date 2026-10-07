import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/enums.dart';

abstract interface class ProfileRepository {
  /// `null` until the user has chosen an account type.
  Stream<AppUser?> watch(String uid);

  /// Creates `users/{uid}` and, for caregivers, claims pending family invites.
  Future<void> create({
    required String uid,
    required String displayName,
    required AccountType accountType,
    String? phone,
  });
}
