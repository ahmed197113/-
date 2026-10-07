import 'package:barr/core/error/failure.dart';
import 'package:barr/core/storage/local_db.dart';
import 'package:barr/features/auth/data/local_auth_repository.dart';
import 'package:barr/features/auth/data/local_profile_repository.dart';
import 'package:barr/features/auth/domain/auth_repository.dart';
import 'package:barr/features/elder_linking/data/local_linking_repository.dart';
import 'package:barr/features/family/data/local_family_repository.dart';
import 'package:barr/shared/domain/entities/elder.dart';
import 'package:barr/shared/domain/entities/enums.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/local_backend.dart';

void main() {
  late LocalDb db;
  late LocalAuthRepository auth;
  late LocalProfileRepository profiles;
  late LocalFamilyRepository families;

  Future<String> signUpCaregiver(String phone, String name) async {
    await auth.confirmOtp(PhoneVerification(phone: phone, verificationId: 'x'), '123456');
    final uid = auth.currentUid!;
    await profiles.create(
        uid: uid, displayName: name, accountType: AccountType.caregiver, phone: phone);
    return uid;
  }

  setUp(() async {
    (db, _) = await createLocalDb();
    auth = LocalAuthRepository(db);
    profiles = LocalProfileRepository(db);
    families = LocalFamilyRepository(db);
  });

  test('wrong OTP is rejected', () async {
    expect(
      () => auth.confirmOtp(const PhoneVerification(phone: '+966500000000', verificationId: 'x'), '000000'),
      throwsA(isA<InvalidOtpFailure>()),
    );
  });

  test('creating a family makes the caller admin', () async {
    final uid = await signUpCaregiver('+966500000001', 'Ahmed');
    final fid = await families.createFamily('Family');

    final profile = await profiles.watch(uid).first;
    expect(profile!.familyIds, [fid]);
    final members = await families.watchMembers(fid).first;
    expect(members.single.role, FamilyRole.admin);
  });

  test('free plan allows one elder only', () async {
    await signUpCaregiver('+966500000001', 'Ahmed');
    final fid = await families.createFamily('Family');
    const draft = ElderDraft(name: 'Saleh', nickname: 'بابا', relation: ElderRelation.father);
    await families.addElder(fid, draft);
    expect(() => families.addElder(fid, draft), throwsA(isA<PlanLimitFailure>()));
  });

  test('invited sibling joins on sign-up; member limit enforced', () async {
    await signUpCaregiver('+966500000001', 'Ahmed');
    final fid = await families.createFamily('Family');
    await families.invite(fid, phone: '+966500000002', role: FamilyRole.caregiver);
    expect(
      () => families.invite(fid, phone: '+966500000003', role: FamilyRole.viewer),
      throwsA(isA<PlanLimitFailure>()),
    );

    await auth.signOut();
    final sibling = await signUpCaregiver('+966500000002', 'Sara');
    final profile = await profiles.watch(sibling).first;
    expect(profile!.familyIds, [fid]);
    expect(await families.watchInvites(fid).first, isEmpty);
  });

  group('link codes', () {
    late String fid;
    late Elder elder;
    var now = DateTime(2026, 1, 1, 9);
    late LocalLinkingRepository linking;

    setUp(() async {
      now = DateTime(2026, 1, 1, 9);
      linking = LocalLinkingRepository(db, clock: () => now);
      await signUpCaregiver('+966500000001', 'Ahmed');
      fid = await families.createFamily('Family');
      elder = await families.addElder(
        fid,
        const ElderDraft(name: 'Saleh', nickname: 'بابا', relation: ElderRelation.father),
      );
    });

    test('redeem signs the device into a new elder account', () async {
      final code = await linking.createLinkCode(fid, elder.id);
      expect(code.code, matches(RegExp(r'^\d{6}$')));
      await auth.signOut();

      final ref = await linking.redeem(code.code);
      expect(ref.elderId, elder.id);
      final uid = auth.currentUid!;
      final profile = await profiles.watch(uid).first;
      expect(profile!.accountType, AccountType.elder);
      expect(profile.elderRef, ref);
      final linked = await families.watchElder(fid, elder.id).first;
      expect(linked!.linkedUid, uid);
    });

    test('codes are single-use', () async {
      final code = await linking.createLinkCode(fid, elder.id);
      await linking.redeem(code.code);
      expect(() => linking.redeem(code.code), throwsA(isA<InvalidLinkCodeFailure>()));
    });

    test('codes expire after 15 minutes', () async {
      final code = await linking.createLinkCode(fid, elder.id);
      now = now.add(const Duration(minutes: 15));
      expect(() => linking.redeem(code.code), throwsA(isA<InvalidLinkCodeFailure>()));
    });

    test('unknown codes fail', () async {
      expect(() => linking.redeem('000000'), throwsA(isA<InvalidLinkCodeFailure>()));
    });
  });

  test('owner deleting account removes the family', () async {
    await signUpCaregiver('+966500000001', 'Ahmed');
    final fid = await families.createFamily('Family');
    await auth.deleteAccount();
    expect(auth.currentUid, isNull);
    expect(await families.watchFamily(fid).first, isNull);
  });
}
