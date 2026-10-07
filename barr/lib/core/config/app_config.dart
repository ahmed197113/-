import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum Flavor { dev, prod }

/// Runtime configuration resolved at startup.
///
/// Firebase options come from `--dart-define-from-file=env/<flavor>.json`.
/// When they are missing the app runs in **demo mode**: every repository
/// uses a local implementation backed by SharedPreferences, so the APK is
/// installable and usable before a Firebase project is wired up.
class AppConfig {
  const AppConfig({required this.flavor, this.firebaseOptions});

  final Flavor flavor;
  final FirebaseOptions? firebaseOptions;

  bool get isDemo => firebaseOptions == null;

  static AppConfig fromEnvironment(Flavor flavor) {
    const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
    const senderId = String.fromEnvironment('FIREBASE_SENDER_ID');
    const bucket = String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
    const androidApiKey = String.fromEnvironment('FIREBASE_ANDROID_API_KEY');
    const androidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');
    const iosApiKey = String.fromEnvironment('FIREBASE_IOS_API_KEY');
    const iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
    const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

    final isIos = defaultTargetPlatform == TargetPlatform.iOS;
    final apiKey = isIos ? iosApiKey : androidApiKey;
    final appId = isIos ? iosAppId : androidAppId;
    if (projectId.isEmpty || apiKey.isEmpty || appId.isEmpty) {
      return AppConfig(flavor: flavor);
    }
    return AppConfig(
      flavor: flavor,
      firebaseOptions: FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: senderId,
        projectId: projectId,
        storageBucket: bucket.isEmpty ? null : bucket,
        iosBundleId: isIos && iosBundleId.isNotEmpty ? iosBundleId : null,
      ),
    );
  }
}

/// Overridden in `bootstrap.dart`.
final appConfigProvider = Provider<AppConfig>(
  (ref) => throw UnimplementedError('appConfigProvider must be overridden'),
);
