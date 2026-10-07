import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/storage/prefs.dart';

Future<void> bootstrap(Flavor flavor) async {
  WidgetsFlutterBinding.ensureInitialized();

  var config = AppConfig.fromEnvironment(flavor);
  if (!config.isDemo) {
    try {
      await Firebase.initializeApp(options: config.firebaseOptions);
      FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true);
    } catch (e, st) {
      // Misconfigured Firebase must not brick the app: fall back to demo.
      debugPrint('Firebase init failed, using demo mode: $e\n$st');
      config = AppConfig(flavor: flavor);
    }
  }

  await initializeDateFormatting();
  final prefs = await SharedPreferences.getInstance();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // Phase 7: forward to Crashlytics.
  };

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const BarrApp(),
    ),
  );
}
