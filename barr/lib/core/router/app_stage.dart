import '../../shared/domain/entities/app_user.dart';
import '../../shared/domain/entities/enums.dart';

/// Where the user is in the app lifecycle. Drives all top-level routing.
enum AppStage {
  loading,
  onboarding,
  signedOut,
  needsProfile,
  caregiverNoFamily,
  caregiverHome,
  elderNeedsLink,
  elderHome,
}

AppStage resolveStage({
  required bool loading,
  required bool onboardingSeen,
  required String? uid,
  required AppUser? profile,
}) {
  if (loading) return AppStage.loading;
  if (uid == null) return onboardingSeen ? AppStage.signedOut : AppStage.onboarding;
  if (profile == null) return AppStage.needsProfile;
  return switch (profile.accountType) {
    AccountType.caregiver =>
      profile.familyIds.isEmpty ? AppStage.caregiverNoFamily : AppStage.caregiverHome,
    AccountType.elder => profile.elderRef == null ? AppStage.elderNeedsLink : AppStage.elderHome,
  };
}

abstract final class Routes {
  static const splash = '/splash';
  static const onboarding = '/onboarding';
  static const welcome = '/welcome';
  static const phone = '/auth/phone';
  static const otp = '/auth/otp';
  static const accountType = '/auth/account-type';
  static const createFamily = '/family/create';
  static const home = '/home';
  static const addElder = '/home/add-elder';
  static const invite = '/home/invite';
  static const settings = '/home/settings';
  static String linkElder(String elderId) => '/home/elder/$elderId/link';
  static String elderSettings(String elderId) => '/home/elder/$elderId/settings';
  static String sosAlert(String elderId, String eventId) => '/home/elder/$elderId/sos/$eventId';
  static String medications(String elderId) => '/home/elder/$elderId/meds';
  static String newMedication(String elderId) => '/home/elder/$elderId/meds/new';
  static String editMedication(String elderId, String medId) => '/home/elder/$elderId/meds/$medId/edit';
  static const elderLink = '/elder/link';
  static const elderScan = '/elder/link/scan';
  static const elderHome = '/elder/home';
  static const elderKids = '/elder/home/kids';
  static const elderMeds = '/elder/home/meds';
  static const elderPermissions = '/elder/home/permissions';
  static const elderSos = '/elder/home/sos';
  static String elderDose(String doseId) => '/elder/home/dose/$doseId';
}

/// Pure redirect logic: keeps the user inside the routes their stage allows.
String? redirectFor(AppStage stage, String location) {
  final (String home, List<String> allowed) = switch (stage) {
    AppStage.loading => (Routes.splash, const [Routes.splash]),
    AppStage.onboarding => (Routes.onboarding, const [Routes.onboarding]),
    AppStage.signedOut => (
        Routes.welcome,
        const [Routes.welcome, Routes.phone, Routes.otp, Routes.elderLink],
      ),
    AppStage.needsProfile => (Routes.accountType, const [Routes.accountType]),
    AppStage.caregiverNoFamily => (Routes.createFamily, const [Routes.createFamily]),
    AppStage.caregiverHome => (Routes.home, const [Routes.home]),
    AppStage.elderNeedsLink => (Routes.elderLink, const [Routes.elderLink]),
    AppStage.elderHome => (Routes.elderHome, const [Routes.elderHome]),
  };
  final ok = allowed.any((p) => location == p || location.startsWith('$p/'));
  return ok ? null : home;
}
