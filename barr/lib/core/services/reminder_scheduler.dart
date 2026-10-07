/// A local notification to schedule (already localized).
class ReminderNotification {
  const ReminderNotification({
    required this.id,
    required this.at,
    required this.title,
    required this.body,
    required this.doseId,
  });

  final int id;
  final DateTime at;
  final String title;
  final String body;
  final String doseId;
}

class ReminderPermissions {
  const ReminderPermissions({
    required this.notifications,
    required this.exactAlarms,
    required this.batteryUnrestricted,
  });

  final bool notifications;
  final bool exactAlarms;
  final bool batteryUnrestricted;

  bool get allGranted => notifications && exactAlarms && batteryUnrestricted;
}

/// Labels for the notification action buttons.
class ReminderActionLabels {
  const ReminderActionLabels({required this.taken, required this.later});

  final String taken;
  final String later;
}

/// Schedules medication alarms on the parent's device. They are local, so
/// they fire without internet and survive reboots.
abstract interface class ReminderScheduler {
  Future<void> init();

  /// Makes the scheduled set equal to [reminders] (diffed, so cheap to call).
  Future<void> sync(List<ReminderNotification> reminders, ReminderActionLabels labels);

  /// Cancels every pending reminder of a dose (after it is confirmed).
  Future<void> cancelDose(String doseId);

  /// Dose ids from notifications the user tapped (or full-screen alarms).
  Stream<String> get doseOpened;

  /// Dose id if the app was launched from a reminder (consumed once).
  Future<String?> takeLaunchDoseId();

  Future<ReminderPermissions> permissions();

  Future<void> requestNotifications();
  Future<void> requestExactAlarms();
  Future<void> requestBatteryUnrestricted();

  /// Stops showing the app over the lock screen (after an alarm).
  Future<void> releaseLockScreen();
}
