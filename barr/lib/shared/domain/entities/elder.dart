import 'enums.dart';

/// `families/{fid}/elders/{eid}`
class Elder {
  const Elder({
    required this.id,
    required this.familyId,
    required this.name,
    required this.nickname,
    required this.relation,
    this.phone,
    this.linkedUid,
    this.lastCheckinAt,
  });

  final String id;
  final String familyId;
  final String name;

  /// What the children call them ("بابا"); shown in the elder's greeting.
  final String nickname;
  final ElderRelation relation;
  final String? phone;
  final String? linkedUid;
  final DateTime? lastCheckinAt;

  bool get isLinked => linkedUid != null;
  String get displayName => nickname.isNotEmpty ? nickname : name;

  factory Elder.fromMap(String id, String familyId, Map<String, dynamic> m) => Elder(
        id: id,
        familyId: familyId,
        name: (m['name'] as String?) ?? '',
        nickname: (m['nickname'] as String?) ?? '',
        relation: ElderRelation.parse(m['relation'] as String?),
        phone: m['phone'] as String?,
        linkedUid: m['linkedUid'] as String?,
        lastCheckinAt: _toDate(m['lastCheckinAt']),
      );

  static DateTime? _toDate(Object? v) => switch (v) {
        DateTime d => d,
        int ms => DateTime.fromMillisecondsSinceEpoch(ms),
        String s => DateTime.tryParse(s),
        _ => null,
      };
}

/// Input for creating an elder.
class ElderDraft {
  const ElderDraft({
    required this.name,
    required this.nickname,
    required this.relation,
    this.phone,
  });

  final String name;
  final String nickname;
  final ElderRelation relation;
  final String? phone;

  Map<String, dynamic> toMap() => {
        'name': name,
        'nickname': nickname,
        'relation': relation.name,
        'phone': phone,
      };
}

/// One-time 6-digit code that links a parent's device to an elder record.
class LinkCode {
  const LinkCode({
    required this.code,
    required this.familyId,
    required this.elderId,
    required this.expiresAt,
  });

  final String code;
  final String familyId;
  final String elderId;
  final DateTime expiresAt;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);
}
