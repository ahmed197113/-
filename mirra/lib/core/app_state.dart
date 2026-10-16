import 'dart:convert';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n.dart';
import 'models.dart';
import 'personality.dart';

/// Single source of truth. Everything is stored on-device only.
class AppState extends ChangeNotifier {
  late SharedPreferences _prefs;
  late L10n l10n;

  ThemeMode themeMode = ThemeMode.system;
  String name = '';
  bool onboarded = false;
  List<TestResult> results = [];
  Map<int, int> progress = {};
  GrowthPlan? plan;

  String get locale => l10n.code;
  TestResult? get latest => results.isEmpty ? null : results.last;
  String t(String key, [Map<String, Object?> args = const {}]) =>
      l10n.t(key, args);

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final device = PlatformDispatcher.instance.locale.languageCode;
    final code = _prefs.getString('locale') ??
        (L10n.languages.containsKey(device) ? device : 'en');
    l10n = await L10n.load(code);
    themeMode = ThemeMode.values[_prefs.getInt('theme') ?? 0];
    name = _prefs.getString('name') ?? '';
    onboarded = _prefs.getBool('onboarded') ?? false;
    results = (jsonDecode(_prefs.getString('results') ?? '[]') as List)
        .map((e) => TestResult.fromJson(e as Map<String, dynamic>))
        .toList();
    progress = (jsonDecode(_prefs.getString('progress') ?? '{}')
            as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), v as int))
      // Drop answers saved by an older, longer version of the test.
      ..removeWhere((k, _) => k >= Personality.questionCount);
    final p = _prefs.getString('plan');
    plan = p == null
        ? null
        : GrowthPlan.fromJson(jsonDecode(p) as Map<String, dynamic>);
  }

  Future<void> setLocale(String code) async {
    l10n = await L10n.load(code);
    await _prefs.setString('locale', code);
    notifyListeners();
  }

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    _prefs.setInt('theme', mode.index);
    notifyListeners();
  }

  void setName(String value) {
    name = value.trim();
    _prefs.setString('name', name);
    notifyListeners();
  }

  void finishOnboarding() {
    onboarded = true;
    _prefs.setBool('onboarded', true);
    notifyListeners();
  }

  void answer(int index, int value) {
    progress[index] = value;
    _saveProgress();
  }

  void clearProgress() {
    progress = {};
    _saveProgress();
  }

  void _saveProgress() => _prefs.setString(
      'progress', jsonEncode(progress.map((k, v) => MapEntry('$k', v))));

  TestResult completeTest() {
    final result = TestResult(
      date: DateTime.now(),
      scores: Personality.score(progress),
      answers: Map.of(progress),
    );
    results.add(result);
    _saveResults();
    clearProgress();
    notifyListeners();
    return result;
  }

  void deleteResult(TestResult r) {
    results.remove(r);
    _saveResults();
    notifyListeners();
  }

  void _saveResults() => _prefs.setString(
      'results', jsonEncode(results.map((r) => r.toJson()).toList()));

  void startPlan(List<String> focus) {
    plan = GrowthPlan(start: DateTime.now(), focus: focus);
    _savePlan();
  }

  void toggleDay(int day) {
    final p = plan!;
    p.done.contains(day) ? p.done.remove(day) : p.done.add(day);
    _savePlan();
  }

  void setNote(int day, String text) {
    plan!.notes[day] = text;
    _prefs.setString('plan', jsonEncode(plan!.toJson()));
  }

  void endPlan() {
    plan = null;
    _prefs.remove('plan');
    notifyListeners();
  }

  void _savePlan() {
    _prefs.setString('plan', jsonEncode(plan!.toJson()));
    notifyListeners();
  }

  Future<void> resetAll() async {
    final code = locale;
    await _prefs.clear();
    await _prefs.setString('locale', code);
    name = '';
    onboarded = false;
    results = [];
    progress = {};
    plan = null;
    themeMode = ThemeMode.system;
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  static AppState read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
