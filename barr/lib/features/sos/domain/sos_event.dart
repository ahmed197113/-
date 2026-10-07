enum SosStatus {
  active,
  acknowledged,
  resolved;

  static SosStatus parse(String? v) =>
      SosStatus.values.where((e) => e.name == v).firstOrNull ?? SosStatus.active;

  bool get isOpen => this != resolved;
}

class GeoFix {
  const GeoFix({required this.lat, required this.lng, this.accuracy});

  final double lat;
  final double lng;
  final double? accuracy;

  Uri get mapsUri => Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');

  Map<String, dynamic> toMap() => {'lat': lat, 'lng': lng, 'accuracy': accuracy};
}

/// `families/{fid}/elders/{eid}/sosEvents/{id}`
class SosEvent {
  const SosEvent({
    required this.id,
    required this.familyId,
    required this.elderId,
    required this.at,
    required this.status,
    this.location,
    this.acknowledgedBy = const [],
    this.resolvedBy,
  });

  final String id;
  final String familyId;
  final String elderId;
  final DateTime at;
  final SosStatus status;
  final GeoFix? location;

  /// Display names of family members who said "أنا متابع".
  final List<String> acknowledgedBy;
  final String? resolvedBy;

  factory SosEvent.fromMap(String id, String familyId, String elderId, Map<String, dynamic> m) {
    final loc = m['location'] is Map ? Map<String, dynamic>.from(m['location'] as Map) : null;
    return SosEvent(
      id: id,
      familyId: familyId,
      elderId: elderId,
      at: switch (m['at']) {
            DateTime d => d,
            int ms => DateTime.fromMillisecondsSinceEpoch(ms),
            _ => null,
          } ??
          DateTime.now(),
      status: SosStatus.parse(m['status'] as String?),
      location: loc == null || loc['lat'] == null
          ? null
          : GeoFix(
              lat: (loc['lat'] as num).toDouble(),
              lng: (loc['lng'] as num).toDouble(),
              accuracy: (loc['accuracy'] as num?)?.toDouble(),
            ),
      acknowledgedBy: List<String>.from((m['acknowledgedBy'] as List?) ?? const []),
      resolvedBy: m['resolvedBy'] as String?,
    );
  }
}
