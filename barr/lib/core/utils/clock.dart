import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Current time, refreshed every 30 seconds so dose states update live.
final nowProvider = StreamProvider<DateTime>((ref) {
  final controller = StreamController<DateTime>();
  controller.add(DateTime.now());
  final timer = Timer.periodic(const Duration(seconds: 30), (_) => controller.add(DateTime.now()));
  ref.onDispose(() {
    timer.cancel();
    controller.close();
  });
  return controller.stream;
});

/// Midnight of today; only changes when the day changes.
final todayProvider = Provider<DateTime>((ref) {
  final now = ref.watch(nowProvider).value ?? DateTime.now();
  return DateTime(now.year, now.month, now.day);
});
