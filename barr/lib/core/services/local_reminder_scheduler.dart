import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../features/medications/domain/reminder_plan.dart';
import 'reminder_scheduler.dart';

/// [ReminderScheduler] backed by flutter_local_notifications.
///
/// Android: max-importance "alarm" channel using the alarm audio stream and
/// the system alarm sound, insistent (loops until acted on), full-screen
/// intent so it shows on the lock screen, exact alarms when permitted.
class LocalReminderScheduler implements ReminderScheduler {
  LocalReminderScheduler(this._prefs);

  static const channelId = 'barr_med_alarm_v1';
  static const actionTaken = 'taken';
  static const actionLater = 'later';
  static const _storeKey = 'barr.scheduled_reminders.v1';
  static const _lockChannel = MethodChannel('barr/lockscreen');

  final SharedPreferences _prefs;
  final _plugin = FlutterLocalNotificationsPlugin();
  final _opened = StreamController<String>.broadcast();
  bool _ready = false;
  Future<void>? _initializing;

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  @override
  Stream<String> get doseOpened => _opened.stream;

  @override
  Future<void> init() => _initializing ??= _init();

  Future<void> _init() async {
    tzdata.initializeTimeZones();
    try {
      final info = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(info.identifier));
    } catch (e) {
      debugPrint('Timezone lookup failed, defaulting to Asia/Riyadh: $e');
      tz.setLocalLocation(tz.getLocation('Asia/Riyadh'));
    }

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (r) {
        final doseId = r.payload;
        if (doseId != null && doseId.isNotEmpty) _opened.add(doseId);
      },
    );

    await _android?.createNotificationChannel(AndroidNotificationChannel(
      channelId,
      'تذكير الأدوية',
      description: 'منبّه مواعيد الدواء',
      importance: Importance.max,
      playSound: true,
      sound: const UriAndroidNotificationSound('content://settings/system/alarm_alert'),
      audioAttributesUsage: AudioAttributesUsage.alarm,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 800, 400, 800, 400, 800]),
    ));
    _ready = true;
  }

  NotificationDetails _details(ReminderActionLabels labels) => NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          'تذكير الأدوية',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: true,
          visibility: NotificationVisibility.public,
          audioAttributesUsage: AudioAttributesUsage.alarm,
          // FLAG_INSISTENT: repeat sound until the user responds.
          additionalFlags: Int32List.fromList([4]),
          // Stop ringing before the next repeat (every 10 minutes).
          timeoutAfter: const Duration(minutes: 9).inMilliseconds,
          actions: [
            AndroidNotificationAction(actionTaken, labels.taken, showsUserInterface: true),
            AndroidNotificationAction(actionLater, labels.later, showsUserInterface: true),
          ],
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          interruptionLevel: InterruptionLevel.timeSensitive,
        ),
      );

  Map<String, String> _stored() {
    try {
      return Map<String, String>.from(jsonDecode(_prefs.getString(_storeKey) ?? '{}') as Map);
    } catch (_) {
      return {};
    }
  }

  @override
  Future<void> sync(List<ReminderNotification> reminders, ReminderActionLabels labels) async {
    await init();
    if (!_ready) return;
    final previous = _stored();
    final next = {
      for (final r in reminders)
        '${r.id}': '${r.at.millisecondsSinceEpoch}|${Object.hash(r.title, r.body, labels.taken)}',
    };

    for (final id in previous.keys) {
      if (next[id] != previous[id]) await _plugin.cancel(id: int.parse(id));
    }

    final exact = await _android?.canScheduleExactNotifications() ?? true;
    final details = _details(labels);
    for (final r in reminders) {
      final key = '${r.id}';
      if (previous[key] == next[key]) continue;
      try {
        await _plugin.zonedSchedule(
          id: r.id,
          scheduledDate: tz.TZDateTime.from(r.at, tz.local),
          notificationDetails: details,
          androidScheduleMode: exact
              ? AndroidScheduleMode.exactAllowWhileIdle
              : AndroidScheduleMode.inexactAllowWhileIdle,
          title: r.title,
          body: r.body,
          payload: r.doseId,
        );
      } catch (e) {
        debugPrint('Failed to schedule reminder ${r.id}: $e');
        next.remove(key);
      }
    }
    await _prefs.setString(_storeKey, jsonEncode(next));
  }

  @override
  Future<void> cancelDose(String doseId) async {
    await init();
    final stored = _stored();
    for (var attempt = 0; attempt <= 3; attempt++) {
      final id = notificationIdFor(doseId, attempt);
      await _plugin.cancel(id: id);
      stored.remove('$id');
    }
    await _prefs.setString(_storeKey, jsonEncode(stored));
  }

  @override
  Future<String?> takeLaunchDoseId() async {
    await init();
    final details = await _plugin.getNotificationAppLaunchDetails();
    if (details?.didNotificationLaunchApp != true) return null;
    final payload = details!.notificationResponse?.payload;
    const key = 'barr.last_launch_payload';
    // The launch details persist for the process; only handle them once.
    final marker = '$payload@${details.notificationResponse?.id}';
    if (_prefs.getString(key) == marker) return null;
    await _prefs.setString(key, marker);
    return payload;
  }

  @override
  Future<ReminderPermissions> permissions() async {
    await init();
    final android = _android;
    if (android == null) {
      return const ReminderPermissions(notifications: true, exactAlarms: true, batteryUnrestricted: true);
    }
    return ReminderPermissions(
      notifications: await android.areNotificationsEnabled() ?? false,
      exactAlarms: await android.canScheduleExactNotifications() ?? true,
      batteryUnrestricted: await Permission.ignoreBatteryOptimizations.isGranted,
    );
  }

  @override
  Future<void> requestNotifications() async {
    await init();
    await _android?.requestNotificationsPermission();
    await _android?.requestFullScreenIntentPermission();
    await _plugin
        .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, sound: true, badge: true);
  }

  @override
  Future<void> requestExactAlarms() async {
    await init();
    await _android?.requestExactAlarmsPermission();
  }

  @override
  Future<void> requestBatteryUnrestricted() async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    await Permission.ignoreBatteryOptimizations.request();
  }

  @override
  Future<void> releaseLockScreen() async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _lockChannel.invokeMethod<void>('release');
    } catch (_) {}
  }
}
