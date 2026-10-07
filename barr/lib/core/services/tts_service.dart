import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Arabic text-to-speech for the parent interface.
abstract interface class TtsService {
  Future<void> speak(String text);
  Future<void> stop();
}

class FlutterTtsService implements TtsService {
  final _tts = FlutterTts();
  Future<void>? _setup;

  Future<void> _init() async {
    try {
      final hasSaudi = await _tts.isLanguageAvailable('ar-SA') == true;
      await _tts.setLanguage(hasSaudi ? 'ar-SA' : 'ar');
      await _tts.setSpeechRate(0.42);
      await _tts.setVolume(1);
      await _tts.awaitSpeakCompletion(false);
    } catch (e) {
      debugPrint('TTS init failed: $e');
    }
  }

  @override
  Future<void> speak(String text) async {
    try {
      await (_setup ??= _init());
      await _tts.stop();
      await _tts.speak(text);
    } catch (e) {
      debugPrint('TTS speak failed: $e');
    }
  }

  @override
  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}
