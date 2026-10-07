import 'enums.dart';

/// Pointer from an elder's account to their record inside a family.
class ElderRef {
  const ElderRef({required this.familyId, required this.elderId});

  final String familyId;
  final String elderId;

  factory ElderRef.fromMap(Map<String, dynamic> m) =>
      ElderRef(familyId: m['familyId'] as String, elderId: m['elderId'] as String);

  Map<String, dynamic> toMap() => {'familyId': familyId, 'elderId': elderId};

  @override
  bool operator ==(Object other) =>
      other is ElderRef && other.familyId == familyId && other.elderId == elderId;

  @override
  int get hashCode => Object.hash(familyId, elderId);
}

/// `users/{uid}`
class AppUser {
  const AppUser({
    required this.uid,
    required this.displayName,
    required this.accountType,
    this.phone,
    this.familyIds = const [],
    this.elderRef,
  });

  final String uid;
  final String displayName;
  final AccountType accountType;
  final String? phone;
  final List<String> familyIds;
  final ElderRef? elderRef;

  String? get primaryFamilyId => familyIds.isEmpty ? null : familyIds.first;

  factory AppUser.fromMap(String uid, Map<String, dynamic> m) => AppUser(
        uid: uid,
        displayName: (m['displayName'] as String?) ?? '',
        accountType: AccountType.tryParse(m['accountType'] as String?) ?? AccountType.caregiver,
        phone: m['phone'] as String?,
        familyIds: List<String>.from((m['familyIds'] as List?) ?? const []),
        elderRef: m['elderRef'] is Map
            ? ElderRef.fromMap(Map<String, dynamic>.from(m['elderRef'] as Map))
            : null,
      );

  Map<String, dynamic> toMap() => {
        'displayName': displayName,
        'accountType': accountType.name,
        'phone': phone,
        'familyIds': familyIds,
        if (elderRef != null) 'elderRef': elderRef!.toMap(),
      };
}
