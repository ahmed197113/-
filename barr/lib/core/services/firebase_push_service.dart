import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../firebase/firestore_utils.dart';
import 'push_service.dart';

/// FCM for caregivers. The server sends notification + data messages with
/// an Android channel id; the system shows them in background, and this
/// class shows them while the app is in foreground.
///
/// Channels:
/// - `barr_sos_v1`: emergency — alarm sound, max importance, may bypass DND.
/// - `barr_alerts_v1`: missed doses, check-ins, inactivity, daily summary.
class FirebasePushService implements PushService {
  FirebasePushService(this._db);

  static const sosChannel = 'barr_sos_v1';
  static const alertsChannel = 'barr_alerts_v1';

  final FirebaseFirestore _db;
  final _messaging = FirebaseMessaging.instance;
  final _local = FlutterLocalNotificationsPlugin();
  final _opened = StreamController<PushOpen>.broadcast();
  final _subs = <StreamSubscription<dynamic>>[];
  String? _uid;

  @override
  Stream<PushOpen> get opened => _opened.stream;

  @override
  Future<void> start(String uid) async {
    if (_uid == uid) return;
    _uid = uid;
    for (final s in _subs) {
      await s.cancel();
    }
    _subs.clear();
    try {
      await _setupLocal();
      await _messaging.requestPermission(alert: true, sound: true, badge: true);
      final token = await _messaging.getToken();
      if (token != null) await _saveToken(uid, token);
      _subs
        ..add(_messaging.onTokenRefresh.listen((t) => _saveToken(uid, t)))
        ..add(FirebaseMessaging.onMessage.listen(_showForeground))
        ..add(FirebaseMessaging.onMessageOpenedApp.listen((m) => _opened.add(PushOpen.fromData(m.data))));
      final initial = await _messaging.getInitialMessage();
      if (initial != null) _opened.add(PushOpen.fromData(initial.data));
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }

  Future<void> _setupLocal() async {
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (r) {
        try {
          _opened.add(PushOpen.fromData(Map<String, dynamic>.from(jsonDecode(r.payload ?? '{}') as Map)));
        } catch (_) {}
      },
    );
    final android =
        _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(AndroidNotificationChannel(
      sosChannel,
      'طوارئ',
      description: 'تنبيه عند ضغط الوالد زر الطوارئ',
      importance: Importance.max,
      bypassDnd: true,
      sound: const UriAndroidNotificationSound('content://settings/system/alarm_alert'),
      audioAttributesUsage: AudioAttributesUsage.alarm,
      vibrationPattern: Int64List.fromList([0, 1000, 500, 1000, 500, 1000]),
    ));
    await android?.createNotificationChannel(const AndroidNotificationChannel(
      alertsChannel,
      'تنبيهات الرعاية',
      description: 'دواء فائت، الاطمئنان اليومي، الملخص المسائي',
      importance: Importance.high,
    ));
  }

  Future<void> _saveToken(String uid, String token) => _db
      .doc('${FsPaths.user(uid)}/devices/${token.hashCode.toUnsigned(32)}')
      .set({
        'token': token,
        'platform': Platform.operatingSystem,
        'updatedAt': FieldValue.serverTimestamp(),
      }).catchError((Object e) => debugPrint('Token save failed: $e'));

  Future<void> _showForeground(RemoteMessage m) async {
    final n = m.notification;
    if (n == null) return;
    final isSos = m.data['type'] == 'sos';
    await _local.show(
      id: m.messageId.hashCode,
      title: n.title,
      body: n.body,
      payload: jsonEncode(m.data),
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          isSos ? sosChannel : alertsChannel,
          isSos ? 'طوارئ' : 'تنبيهات الرعاية',
          importance: isSos ? Importance.max : Importance.high,
          priority: isSos ? Priority.max : Priority.high,
          category: isSos ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.reminder,
          fullScreenIntent: isSos,
          audioAttributesUsage: isSos ? AudioAttributesUsage.alarm : AudioAttributesUsage.notification,
        ),
        iOS: DarwinNotificationDetails(
          interruptionLevel: isSos ? InterruptionLevel.critical : InterruptionLevel.timeSensitive,
        ),
      ),
    );
  }
}
