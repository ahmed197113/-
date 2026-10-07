import 'dart:async';
import 'package:barr/features/sos/domain/location_service.dart';
import 'package:barr/features/sos/domain/sos_event.dart';

import 'package:barr/core/services/reminder_scheduler.dart';
import 'package:barr/core/services/tts_service.dart';

class FakeReminderScheduler implements ReminderScheduler {
  final synced = <List<ReminderNotification>>[];
  final cancelled = <String>[];
  final opened = StreamController<String>.broadcast();

  @override
  Future<void> init() async {}

  @override
  Future<void> sync(List<ReminderNotification> reminders, ReminderActionLabels labels) async =>
      synced.add(reminders);

  @override
  Future<void> cancelDose(String doseId) async => cancelled.add(doseId);

  @override
  Stream<String> get doseOpened => opened.stream;

  @override
  Future<String?> takeLaunchDoseId() async => null;

  @override
  Future<ReminderPermissions> permissions() async =>
      const ReminderPermissions(notifications: true, exactAlarms: true, batteryUnrestricted: true);

  @override
  Future<void> requestNotifications() async {}

  @override
  Future<void> requestExactAlarms() async {}

  @override
  Future<void> requestBatteryUnrestricted() async {}

  @override
  Future<void> releaseLockScreen() async {}
}

class FakeTts implements TtsService {
  final spoken = <String>[];

  @override
  Future<void> speak(String text) async => spoken.add(text);

  @override
  Future<void> stop() async {}
}

class FakeLocation implements LocationService {
  @override
  Future<GeoFix?> current({Duration timeout = const Duration(seconds: 8)}) async =>
      const GeoFix(lat: 24.7136, lng: 46.6753, accuracy: 12);

  @override
  Future<bool> hasPermission() async => true;

  @override
  Future<bool> requestPermission() async => true;
}
