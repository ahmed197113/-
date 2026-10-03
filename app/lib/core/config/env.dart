/// Build-time configuration passed with `--dart-define`.
///
/// When Firebase options are absent the app runs in **demo mode**: everything
/// works on-device (templates from the bundled seed, local credit ledger,
/// on-device preview generation) so the APK can be installed and tried
/// without any backend. Supplying the Firebase defines switches every
/// repository to its Firebase implementation.
class Env {
  const Env._();

  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const firebaseStorageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
  static const functionsRegion =
      String.fromEnvironment('FUNCTIONS_REGION', defaultValue: 'europe-west1');
  static const revenueCatAndroidKey =
      String.fromEnvironment('REVENUECAT_ANDROID_KEY');
  static const revenueCatIosKey = String.fromEnvironment('REVENUECAT_IOS_KEY');
  static const supportWhatsApp =
      String.fromEnvironment('SUPPORT_WHATSAPP', defaultValue: '');
  static const supportEmail =
      String.fromEnvironment('SUPPORT_EMAIL', defaultValue: 'support@munasaba.app');
  static const privacyUrl = String.fromEnvironment('PRIVACY_URL',
      defaultValue: 'https://munasaba.app/privacy');

  static bool get hasFirebase =>
      firebaseApiKey.isNotEmpty &&
      firebaseAppId.isNotEmpty &&
      firebaseProjectId.isNotEmpty;

  static bool get hasRevenueCat =>
      revenueCatAndroidKey.isNotEmpty || revenueCatIosKey.isNotEmpty;
}
