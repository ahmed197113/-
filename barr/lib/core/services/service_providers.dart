import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/prefs.dart';
import 'firebase_push_service.dart';
import 'local_reminder_scheduler.dart';
import 'push_service.dart';
import 'reminder_scheduler.dart';
import 'tts_service.dart';

final reminderSchedulerProvider = Provider<ReminderScheduler>(
  (ref) => LocalReminderScheduler(ref.watch(sharedPreferencesProvider)),
);

final ttsServiceProvider = Provider<TtsService>((ref) => FlutterTtsService());

final pushServiceProvider = Provider<PushService>((ref) {
  if (ref.watch(appConfigProvider).isDemo) return NoopPushService();
  return FirebasePushService(FirebaseFirestore.instance);
});
