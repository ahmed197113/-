enum AccountType {
  caregiver,
  elder;

  static AccountType? tryParse(String? v) =>
      AccountType.values.where((e) => e.name == v).firstOrNull;
}

enum FamilyRole {
  admin,
  caregiver,
  viewer,
  elder;

  static FamilyRole parse(String? v) =>
      FamilyRole.values.where((e) => e.name == v).firstOrNull ?? FamilyRole.viewer;

  bool get canEdit => this == admin || this == caregiver;
  bool get canManageMembers => this == admin;
}

enum ElderRelation {
  father,
  mother,
  grandfather,
  grandmother;

  static ElderRelation parse(String? v) =>
      ElderRelation.values.where((e) => e.name == v).firstOrNull ?? ElderRelation.father;
}

enum FamilyPlan {
  free,
  trial,
  premium;

  static FamilyPlan parse(String? v) =>
      FamilyPlan.values.where((e) => e.name == v).firstOrNull ?? FamilyPlan.free;

  bool get isPaid => this != free;
}
