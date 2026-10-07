import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/prefs.dart';
import 'local_reminder_scheduler.dart';
import 'reminder_scheduler.dart';
import 'tts_service.dart';

final reminderSchedulerProvider = Provider<ReminderScheduler>(
  (ref) => LocalReminderScheduler(ref.watch(sharedPreferencesProvider)),
);

final ttsServiceProvider = Provider<TtsService>((ref) => FlutterTtsService());
