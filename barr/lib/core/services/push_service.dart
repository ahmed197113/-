/// A notification the caregiver opened.
class PushOpen {
  const PushOpen({required this.type, this.familyId, this.elderId, this.eventId});

  /// `sos` | `missedDose` | `noCheckin` | `inactivity` | `summary`.
  final String type;
  final String? familyId;
  final String? elderId;
  final String? eventId;

  factory PushOpen.fromData(Map<String, dynamic> d) => PushOpen(
        type: '${d['type'] ?? ''}',
        familyId: d['familyId'] as String?,
        elderId: d['elderId'] as String?,
        eventId: d['eventId'] as String?,
      );
}

/// Remote push for caregivers (SOS, missed doses, check-ins, daily summary).
abstract interface class PushService {
  /// Requests permission, registers this device's token for [uid].
  Future<void> start(String uid);

  Stream<PushOpen> get opened;
}

/// Demo mode: alerts are only shown in-app.
class NoopPushService implements PushService {
  @override
  Future<void> start(String uid) async {}

  @override
  Stream<PushOpen> get opened => const Stream.empty();
}
