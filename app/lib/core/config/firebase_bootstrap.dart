import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'env.dart';

/// Initialises Firebase when build-time options are supplied. Returns false
/// (demo mode) otherwise or on failure, so the app always starts.
Future<bool> bootstrapFirebase() async {
  if (!Env.hasFirebase) return false;
  try {
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: Env.firebaseApiKey,
        appId: Env.firebaseAppId,
        messagingSenderId: Env.firebaseSenderId,
        projectId: Env.firebaseProjectId,
        storageBucket: Env.firebaseStorageBucket,
      ),
    );
    // Push when a generation finishes (sent by processJob).
    await FirebaseMessaging.instance.requestPermission();
    return true;
  } catch (e) {
    debugPrint('Firebase init failed, running in demo mode: $e');
    return false;
  }
}
