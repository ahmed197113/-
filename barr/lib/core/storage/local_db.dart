import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'prefs.dart';

/// A tiny JSON document store persisted in SharedPreferences.
///
/// Backs every repository in demo mode (no Firebase project configured).
/// It mirrors the Firestore layout closely so that the local and remote
/// implementations stay behaviourally equivalent.
class LocalDb {
  LocalDb(this._prefs) : _data = _load(_prefs);

  static const _key = 'barr.local_db.v1';

  final SharedPreferences _prefs;
  final Map<String, dynamic> _data;
  final _changes = StreamController<void>.broadcast();
  final _random = Random.secure();

  static Map<String, dynamic> _load(SharedPreferences prefs) {
    final raw = prefs.getString(_key);
    if (raw == null) return {};
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return {};
    }
  }

  /// Read-only view of the whole database.
  Map<String, dynamic> get data => _data;

  /// Emits the selected value now and after every mutation.
  Stream<T> watch<T>(T Function(Map<String, dynamic> db) select) async* {
    yield select(_data);
    await for (final _ in _changes.stream) {
      yield select(_data);
    }
  }

  /// Applies [change] and persists the result.
  Future<T> mutate<T>(T Function(Map<String, dynamic> db) change) async {
    final result = change(_data);
    await _prefs.setString(_key, jsonEncode(_data));
    _changes.add(null);
    return result;
  }

  /// Returns (creating if needed) the nested map at [path].
  static Map<String, dynamic> node(Map<String, dynamic> db, List<String> path) {
    var current = db;
    for (final key in path) {
      final next = current[key];
      if (next is Map<String, dynamic>) {
        current = next;
      } else {
        final created = next is Map ? Map<String, dynamic>.from(next) : <String, dynamic>{};
        current[key] = created;
        current = created;
      }
    }
    return current;
  }

  /// Read-only lookup that never creates intermediate nodes.
  static Map<String, dynamic>? read(Map<String, dynamic> db, List<String> path) {
    Object? current = db;
    for (final key in path) {
      if (current is! Map) return null;
      current = current[key];
    }
    return current is Map ? Map<String, dynamic>.from(current) : null;
  }

  String newId([int length = 20]) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return List.generate(length, (_) => chars[_random.nextInt(chars.length)]).join();
  }

  String newNumericCode(int length) =>
      List.generate(length, (_) => _random.nextInt(10)).join();

  Future<void> clear() async {
    _data.clear();
    await _prefs.remove(_key);
    _changes.add(null);
  }
}

final localDbProvider = Provider<LocalDb>((ref) => LocalDb(ref.watch(sharedPreferencesProvider)));
