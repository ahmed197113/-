import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/error/firebase_failure_mapper.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/elder.dart';
import '../domain/linking_repository.dart';

class FirebaseLinkingRepository implements LinkingRepository {
  FirebaseLinkingRepository(this._functions, this._auth);

  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;

  @override
  Future<LinkCode> createLinkCode(String familyId, String elderId) => guardFirebase(() async {
        final res = await _functions
            .httpsCallable('createLinkCode')
            .call<Map<String, dynamic>>({'familyId': familyId, 'elderId': elderId});
        return LinkCode(
          code: res.data['code'] as String,
          familyId: familyId,
          elderId: elderId,
          expiresAt: DateTime.fromMillisecondsSinceEpoch((res.data['expiresAt'] as num).toInt()),
        );
      });

  @override
  Future<ElderRef> redeem(String code) => guardFirebase(() async {
        final res = await _functions
            .httpsCallable('redeemLinkCode')
            .call<Map<String, dynamic>>({'code': code});
        final token = res.data['customToken'] as String?;
        if (token != null) await _auth.signInWithCustomToken(token);
        return ElderRef(
          familyId: res.data['familyId'] as String,
          elderId: res.data['elderId'] as String,
        );
      });
}
