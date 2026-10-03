import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/providers.dart';
import '../../settings/application/app_settings.dart';

abstract interface class AuthRepository {
  bool get isSignedIn;
  String? get uid;
  bool get isAnonymous;

  /// "Try first": anonymous account, linked to a real one on purchase.
  Future<String?> continueAsGuest();
  Future<String?> signInWithGoogle();
  Future<String?> signInWithApple();
  Future<String?> sendPhoneCode(String phone, void Function(String verificationId) onCodeSent);
  Future<String?> verifyPhoneCode(String verificationId, String code);
  Future<void> signOut();
}

class LocalAuthRepository implements AuthRepository {
  LocalAuthRepository(this._ref);
  final Ref _ref;

  @override
  bool get isSignedIn => _ref.read(appSettingsProvider).signedIn;
  @override
  String? get uid => isSignedIn ? 'local' : null;
  @override
  bool get isAnonymous => true;

  Future<String?> _ok() async {
    _ref.read(appSettingsProvider.notifier).setSignedIn(true);
    return null;
  }

  static const _needsServer = 'تسجيل الدخول بالحساب يتطلب ربط الخادم. يمكنك المتابعة كضيف الآن.';

  @override
  Future<String?> continueAsGuest() => _ok();
  @override
  Future<String?> signInWithGoogle() async => _needsServer;
  @override
  Future<String?> signInWithApple() async => _needsServer;
  @override
  Future<String?> sendPhoneCode(String phone, void Function(String) onCodeSent) async => _needsServer;
  @override
  Future<String?> verifyPhoneCode(String verificationId, String code) async => _needsServer;
  @override
  Future<void> signOut() async => _ref.read(appSettingsProvider.notifier).setSignedIn(false);
}

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository(this._ref);
  final Ref _ref;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  @override
  bool get isSignedIn => _auth.currentUser != null;
  @override
  String? get uid => _auth.currentUser?.uid;
  @override
  bool get isAnonymous => _auth.currentUser?.isAnonymous ?? true;

  Future<String?> _run(Future<void> Function() action) async {
    try {
      await action();
      _ref.read(appSettingsProvider.notifier).setSignedIn(true);
      return null;
    } on FirebaseAuthException catch (e) {
      return switch (e.code) {
        'network-request-failed' => 'تحقق من اتصالك بالإنترنت.',
        'invalid-verification-code' => 'رمز التحقق غير صحيح.',
        'invalid-phone-number' => 'رقم الهاتف غير صحيح. اكتبه مع رمز الدولة.',
        'too-many-requests' => 'محاولات كثيرة، حاول بعد قليل.',
        'web-context-canceled' || 'canceled' => 'تم الإلغاء.',
        _ => 'تعذّر تسجيل الدخول، حاول مجدداً.',
      };
    }
  }

  /// Links to the current anonymous user so credits are kept.
  Future<void> _signInOrLink(AuthProvider provider) async {
    final current = _auth.currentUser;
    if (current != null && current.isAnonymous) {
      try {
        await current.linkWithProvider(provider);
        return;
      } on FirebaseAuthException catch (e) {
        if (e.code != 'credential-already-in-use') rethrow;
      }
    }
    await _auth.signInWithProvider(provider);
  }

  @override
  Future<String?> continueAsGuest() => _run(() => _auth.signInAnonymously());
  @override
  Future<String?> signInWithGoogle() => _run(() => _signInOrLink(GoogleAuthProvider()));
  @override
  Future<String?> signInWithApple() => _run(() => _signInOrLink(AppleAuthProvider()));

  @override
  Future<String?> sendPhoneCode(String phone, void Function(String) onCodeSent) async {
    String? error;
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      verificationCompleted: (cred) => _run(() => _auth.signInWithCredential(cred)),
      verificationFailed: (e) => error = e.code == 'invalid-phone-number'
          ? 'رقم الهاتف غير صحيح. اكتبه مع رمز الدولة.'
          : 'تعذّر إرسال الرمز.',
      codeSent: (id, _) => onCodeSent(id),
      codeAutoRetrievalTimeout: (_) {},
    );
    return error;
  }

  @override
  Future<String?> verifyPhoneCode(String verificationId, String code) => _run(() async {
        final cred = PhoneAuthProvider.credential(verificationId: verificationId, smsCode: code);
        final current = _auth.currentUser;
        if (current != null && current.isAnonymous) {
          await current.linkWithCredential(cred);
        } else {
          await _auth.signInWithCredential(cred);
        }
      });

  @override
  Future<void> signOut() async {
    await _auth.signOut();
    _ref.read(appSettingsProvider.notifier).setSignedIn(false);
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (ref.watch(firebaseEnabledProvider)) return FirebaseAuthRepository(ref);
  return LocalAuthRepository(ref);
});
