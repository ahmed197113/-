import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/config/firebase_bootstrap.dart';
import 'core/config/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final results = await Future.wait([SharedPreferences.getInstance(), bootstrapFirebase()]);
  runApp(
    ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(results[0] as SharedPreferences),
        firebaseEnabledProvider.overrideWithValue(results[1] as bool),
      ],
      child: const MunasabaApp(),
    ),
  );
}
