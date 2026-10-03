import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/config/providers.dart';

/// How digits in editor text are displayed.
enum DigitStyle { asTyped, arabicIndic, western }

@immutable
class AppSettings {
  const AppSettings({
    required this.locale,
    required this.themeMode,
    required this.country,
    required this.onboardingDone,
    required this.consentAccepted,
    required this.signedIn,
  });

  final Locale locale;
  final ThemeMode themeMode;
  final String country;
  final bool onboardingDone;
  final bool consentAccepted;
  final bool signedIn;

  AppSettings copyWith({
    Locale? locale,
    ThemeMode? themeMode,
    String? country,
    bool? onboardingDone,
    bool? consentAccepted,
    bool? signedIn,
  }) =>
      AppSettings(
        locale: locale ?? this.locale,
        themeMode: themeMode ?? this.themeMode,
        country: country ?? this.country,
        onboardingDone: onboardingDone ?? this.onboardingDone,
        consentAccepted: consentAccepted ?? this.consentAccepted,
        signedIn: signedIn ?? this.signedIn,
      );
}

/// Supported countries with Arabic names and flag emoji.
const kCountries = <String, (String, String, String)>{
  'SA': ('السعودية', 'Saudi Arabia', '🇸🇦'),
  'EG': ('مصر', 'Egypt', '🇪🇬'),
  'AE': ('الإمارات', 'UAE', '🇦🇪'),
  'KW': ('الكويت', 'Kuwait', '🇰🇼'),
  'QA': ('قطر', 'Qatar', '🇶🇦'),
  'BH': ('البحرين', 'Bahrain', '🇧🇭'),
  'OM': ('عُمان', 'Oman', '🇴🇲'),
  'JO': ('الأردن', 'Jordan', '🇯🇴'),
  'IQ': ('العراق', 'Iraq', '🇮🇶'),
  'MA': ('المغرب', 'Morocco', '🇲🇦'),
  'DZ': ('الجزائر', 'Algeria', '🇩🇿'),
  'TN': ('تونس', 'Tunisia', '🇹🇳'),
  'LB': ('لبنان', 'Lebanon', '🇱🇧'),
  'PS': ('فلسطين', 'Palestine', '🇵🇸'),
  'SY': ('سوريا', 'Syria', '🇸🇾'),
  'LY': ('ليبيا', 'Libya', '🇱🇾'),
  'SD': ('السودان', 'Sudan', '🇸🇩'),
  'YE': ('اليمن', 'Yemen', '🇾🇪'),
};

class AppSettingsNotifier extends Notifier<AppSettings> {
  SharedPreferences get _prefs => ref.read(sharedPrefsProvider);

  @override
  AppSettings build() {
    final p = ref.watch(sharedPrefsProvider);
    final deviceCountry = ui.PlatformDispatcher.instance.locale.countryCode;
    return AppSettings(
      locale: Locale(p.getString('locale') ?? 'ar'),
      themeMode: ThemeMode.values[p.getInt('theme') ?? ThemeMode.dark.index],
      country: p.getString('country') ??
          (kCountries.containsKey(deviceCountry) ? deviceCountry! : 'SA'),
      onboardingDone: p.getBool('onboarding_done') ?? false,
      consentAccepted: p.getBool('consent_accepted') ?? false,
      signedIn: p.getBool('signed_in') ?? false,
    );
  }

  void setLocale(String code) {
    _prefs.setString('locale', code);
    state = state.copyWith(locale: Locale(code));
  }

  void setThemeMode(ThemeMode mode) {
    _prefs.setInt('theme', mode.index);
    state = state.copyWith(themeMode: mode);
  }

  void setCountry(String code) {
    _prefs.setString('country', code);
    state = state.copyWith(country: code);
  }

  void completeOnboarding() {
    _prefs.setBool('onboarding_done', true);
    state = state.copyWith(onboardingDone: true);
  }

  void acceptConsent() {
    _prefs.setBool('consent_accepted', true);
    state = state.copyWith(consentAccepted: true);
  }

  void setSignedIn(bool value) {
    _prefs.setBool('signed_in', value);
    state = state.copyWith(signedIn: value);
  }
}

final appSettingsProvider =
    NotifierProvider<AppSettingsNotifier, AppSettings>(AppSettingsNotifier.new);
