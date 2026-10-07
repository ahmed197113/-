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
    this.lastSeenAt,
    this.checkinDeadline = const (hour: 10, minute: 0),
    this.inactivityHours,
    this.emergencyContacts = const [],
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

  /// Last time the parent's app was opened (heartbeat).
  final DateTime? lastSeenAt;

  /// Local time by which "أنا بخير" is expected each day.
  final ({int hour, int minute}) checkinDeadline;

  /// Alert when the parent's app is idle this long (null = off).
  final int? inactivityHours;

  /// Called first on SOS, in order.
  final List<EmergencyContact> emergencyContacts;

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
        lastSeenAt: _toDate(m['lastSeenAt']),
        checkinDeadline: _parseHm(m['checkinDeadline']) ?? (hour: 10, minute: 0),
        inactivityHours: (m['inactivityHours'] as num?)?.toInt(),
        emergencyContacts: ((m['emergencyContacts'] as List?) ?? const [])
            .whereType<Map>()
            .map((c) => EmergencyContact(name: '${c['name'] ?? ''}', phone: '${c['phone'] ?? ''}'))
            .where((c) => c.phone.isNotEmpty)
            .toList(),
      );

  static ({int hour, int minute})? _parseHm(Object? v) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch('${v ?? ''}');
    if (match == null) return null;
    final h = int.parse(match.group(1)!);
    final m = int.parse(match.group(2)!);
    return h < 24 && m < 60 ? (hour: h, minute: m) : null;
  }

  static String formatHm(({int hour, int minute}) t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  static DateTime? _toDate(Object? v) => switch (v) {
        DateTime d => d,
        int ms => DateTime.fromMillisecondsSinceEpoch(ms),
        String s => DateTime.tryParse(s),
        _ => null,
      };
}

class EmergencyContact {
  const EmergencyContact({required this.name, required this.phone});

  final String name;

  /// E.164.
  final String phone;

  Map<String, dynamic> toMap() => {'name': name, 'phone': phone};
}

/// Caregiver-controlled settings of a parent (locked on the parent's phone).
class ElderSettings {
  const ElderSettings({
    required this.checkinDeadline,
    required this.inactivityHours,
    required this.emergencyContacts,
  });

  final ({int hour, int minute}) checkinDeadline;
  final int? inactivityHours;
  final List<EmergencyContact> emergencyContacts;

  Map<String, dynamic> toMap() => {
        'checkinDeadline': Elder.formatHm(checkinDeadline),
        'inactivityHours': inactivityHours,
        'emergencyContacts': emergencyContacts.map((c) => c.toMap()).toList(),
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
