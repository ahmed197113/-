import 'package:barr/core/router/app_stage.dart';
import 'package:barr/shared/domain/entities/app_user.dart';
import 'package:barr/shared/domain/entities/enums.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  AppStage stage({bool loading = false, bool seen = true, String? uid, AppUser? profile}) =>
      resolveStage(loading: loading, onboardingSeen: seen, uid: uid, profile: profile);

  const caregiver = AppUser(uid: 'u', displayName: 'A', accountType: AccountType.caregiver);
  const elder = AppUser(uid: 'e', displayName: 'B', accountType: AccountType.elder);

  test('resolves every stage', () {
    expect(stage(loading: true), AppStage.loading);
    expect(stage(seen: false), AppStage.onboarding);
    expect(stage(), AppStage.signedOut);
    expect(stage(uid: 'u'), AppStage.needsProfile);
    expect(stage(uid: 'u', profile: caregiver), AppStage.caregiverNoFamily);
    expect(
      stage(uid: 'u', profile: AppUser(
        uid: 'u', displayName: 'A', accountType: AccountType.caregiver, familyIds: const ['f'])),
      AppStage.caregiverHome,
    );
    expect(stage(uid: 'e', profile: elder), AppStage.elderNeedsLink);
    expect(
      stage(uid: 'e', profile: const AppUser(
        uid: 'e',
        displayName: 'B',
        accountType: AccountType.elder,
        elderRef: ElderRef(familyId: 'f', elderId: 'x'),
      )),
      AppStage.elderHome,
    );
  });

  group('redirectFor', () {
    test('keeps signed-out users in auth routes', () {
      expect(redirectFor(AppStage.signedOut, Routes.phone), isNull);
      expect(redirectFor(AppStage.signedOut, Routes.elderScan), isNull);
      expect(redirectFor(AppStage.signedOut, Routes.home), Routes.welcome);
    });

    test('elders can never reach caregiver screens', () {
      expect(redirectFor(AppStage.elderHome, Routes.home), Routes.elderHome);
      expect(redirectFor(AppStage.elderHome, Routes.settings), Routes.elderHome);
      expect(redirectFor(AppStage.elderHome, Routes.elderKids), isNull);
    });

    test('caregivers can open nested home routes', () {
      expect(redirectFor(AppStage.caregiverHome, Routes.linkElder('x')), isNull);
      expect(redirectFor(AppStage.caregiverHome, Routes.elderHome), Routes.home);
    });
  });
}
