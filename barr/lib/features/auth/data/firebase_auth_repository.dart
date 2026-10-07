import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/firebase_failure_mapper.dart';
import '../domain/auth_repository.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository(this._auth, this._functions);

  final FirebaseAuth _auth;
  final FirebaseFunctions _functions;

  @override
  Stream<String?> uidChanges() => _auth.authStateChanges().map((u) => u?.uid);

  @override
  String? get currentUid => _auth.currentUser?.uid;

  @override
  String? get currentPhone => _auth.currentUser?.phoneNumber;

  @override
  Future<PhoneVerification> sendOtp(String phoneE164, {int? resendToken}) {
    final completer = Completer<PhoneVerification>();
    _auth
        .verifyPhoneNumber(
          phoneNumber: phoneE164,
          forceResendingToken: resendToken,
          timeout: const Duration(seconds: 60),
          verificationCompleted: (credential) async {
            // Android instant verification / SMS auto-retrieval.
            try {
              await _auth.signInWithCredential(credential);
              if (!completer.isCompleted) {
                completer.complete(PhoneVerification(
                  phone: phoneE164,
                  verificationId: credential.verificationId ?? '',
                  autoVerified: true,
                ));
              }
            } catch (e) {
              if (!completer.isCompleted) completer.completeError(mapFirebaseError(e));
            }
          },
          verificationFailed: (e) {
            if (!completer.isCompleted) completer.completeError(mapFirebaseError(e));
          },
          codeSent: (verificationId, token) {
            if (!completer.isCompleted) {
              completer.complete(PhoneVerification(
                phone: phoneE164,
                verificationId: verificationId,
                resendToken: token,
              ));
            }
          },
          codeAutoRetrievalTimeout: (_) {},
        )
        .catchError((Object e) {
      if (!completer.isCompleted) completer.completeError(mapFirebaseError(e));
    });
    return completer.future;
  }

  @override
  Future<void> confirmOtp(PhoneVerification verification, String code) => guardFirebase(() async {
        if (verification.autoVerified) return;
        final credential = PhoneAuthProvider.credential(
          verificationId: verification.verificationId,
          smsCode: code,
        );
        await _auth.signInWithCredential(credential);
      });

  @override
  Future<void> signOut() => _auth.signOut();

  @override
  Future<void> deleteAccount() => guardFirebase(() async {
        if (_auth.currentUser == null) throw const SessionExpiredFailure();
        await _functions.httpsCallable('deleteAccount').call<void>();
        await _auth.signOut();
      });
}
