import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/app_state.dart';
import 'core/l10n.dart';
import 'core/theme.dart';
import 'screens/home_shell.dart';
import 'screens/onboarding.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState();
  await state.init();
  runApp(AppScope(state: state, child: const MirraApp()));
}

class MirraApp extends StatelessWidget {
  const MirraApp({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return MaterialApp(
      title: 'Mirra',
      debugShowCheckedModeBanner: false,
      locale: Locale(app.locale),
      supportedLocales: [for (final c in L10n.languages.keys) Locale(c)],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      themeMode: app.themeMode,
      theme: buildTheme(Brightness.light, app.locale),
      darkTheme: buildTheme(Brightness.dark, app.locale),
      home: app.onboarded ? const HomeShell() : const OnboardingScreen(),
    );
  }
}
