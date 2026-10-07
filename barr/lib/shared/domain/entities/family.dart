import '../../../core/config/plan_limits.dart';
import 'enums.dart';

/// `families/{fid}`
class Family {
  const Family({
    required this.id,
    required this.name,
    required this.ownerUid,
    this.plan = FamilyPlan.free,
    this.maxElders = PlanLimits.freeMaxElders,
    this.maxMembers = PlanLimits.freeMaxMembers,
    this.maxMedications = PlanLimits.freeMaxMedications,
  });

  final String id;
  final String name;
  final String ownerUid;
  final FamilyPlan plan;
  final int maxElders;

  /// Non-elder members (caregivers + viewers), invites included.
  final int maxMembers;

  /// Across all parents in the family.
  final int maxMedications;

  factory Family.fromMap(String id, Map<String, dynamic> m) {
    final limits = Map<String, dynamic>.from((m['limits'] as Map?) ?? const {});
    return Family(
      id: id,
      name: (m['name'] as String?) ?? '',
      ownerUid: (m['ownerUid'] as String?) ?? '',
      plan: FamilyPlan.parse(m['plan'] as String?),
      maxElders: (limits['maxElders'] as num?)?.toInt() ?? PlanLimits.freeMaxElders,
      maxMembers: (limits['maxMembers'] as num?)?.toInt() ?? PlanLimits.freeMaxMembers,
      maxMedications:
          (limits['maxMedications'] as num?)?.toInt() ?? PlanLimits.freeMaxMedications,
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'ownerUid': ownerUid,
        'plan': plan.name,
        'limits': {
          'maxElders': maxElders,
          'maxMembers': maxMembers,
          'maxMedications': maxMedications,
        },
      };
}

/// `families/{fid}/members/{uid}`
class Member {
  const Member({
    required this.uid,
    required this.role,
    required this.displayName,
    this.phone,
  });

  final String uid;
  final FamilyRole role;
  final String displayName;
  final String? phone;

  factory Member.fromMap(String uid, Map<String, dynamic> m) => Member(
        uid: uid,
        role: FamilyRole.parse(m['role'] as String?),
        displayName: (m['displayName'] as String?) ?? '',
        phone: m['phone'] as String?,
      );

  Map<String, dynamic> toMap() => {
        'role': role.name,
        'displayName': displayName,
        'phone': phone,
      };
}

/// `families/{fid}/invites/{id}`
class Invite {
  const Invite({required this.id, required this.phone, required this.role});

  final String id;
  final String phone;
  final FamilyRole role;

  factory Invite.fromMap(String id, Map<String, dynamic> m) => Invite(
        id: id,
        phone: (m['phone'] as String?) ?? '',
        role: FamilyRole.parse(m['role'] as String?),
      );
}
