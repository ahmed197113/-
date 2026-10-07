import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/l10n/generated/app_localizations.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class BarrApp extends ConsumerWidget {
  const BarrApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final flavor = ref.watch(appConfigProvider).flavor;
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: flavor == Flavor.dev,
      routerConfig: router,
      theme: AppTheme.caregiver(Brightness.light),
      darkTheme: AppTheme.caregiver(Brightness.dark),
      themeMode: ThemeMode.system,
      // Arabic (RTL) first; English follows the device language.
      locale: null,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (device, supported) =>
          supported.firstWhere((l) => l.languageCode == device?.languageCode,
              orElse: () => const Locale('ar')),
    );
  }
}
