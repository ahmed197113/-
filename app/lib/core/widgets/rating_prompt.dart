import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';

import '../config/providers.dart';

/// Asks for a store review only after a successful export (the happiest
/// moment), once on the 2nd export and never again.
Future<void> maybeAskForRating(WidgetRef ref) async {
  final prefs = ref.read(sharedPrefsProvider);
  final count = (prefs.getInt('export_count') ?? 0) + 1;
  await prefs.setInt('export_count', count);
  if (count != 2 || (prefs.getBool('review_asked') ?? false)) return;
  final review = InAppReview.instance;
  if (await review.isAvailable()) {
    await prefs.setBool('review_asked', true);
    await review.requestReview();
  }
}
