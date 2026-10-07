import '../../../shared/domain/entities/elder.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/family.dart';

abstract interface class FamilyRepository {
  /// Creates the family and makes the caller its admin. Returns the id.
  Future<String> createFamily(String name);

  Stream<Family?> watchFamily(String familyId);
  Stream<List<Member>> watchMembers(String familyId);
  Stream<List<Invite>> watchInvites(String familyId);
  Stream<List<Elder>> watchElders(String familyId);
  Stream<Elder?> watchElder(String familyId, String elderId);

  /// Throws [PlanLimitFailure] when the plan's elder limit is reached.
  Future<Elder> addElder(String familyId, ElderDraft draft);

  /// Throws [PlanLimitFailure] when the plan's member limit is reached.
  Future<void> invite(String familyId, {required String phone, required FamilyRole role});
}
