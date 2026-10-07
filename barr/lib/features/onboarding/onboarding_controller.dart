import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/prefs.dart';

class OnboardingSeenNotifier extends Notifier<bool> {
  static const _key = 'barr.onboarding_seen';

  @override
  bool build() => ref.watch(sharedPreferencesProvider).getBool(_key) ?? false;

  Future<void> markSeen() async {
    await ref.read(sharedPreferencesProvider).setBool(_key, true);
    state = true;
  }
}

final onboardingSeenProvider =
    NotifierProvider<OnboardingSeenNotifier, bool>(OnboardingSeenNotifier.new);
