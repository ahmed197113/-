import 'dart:convert';

import 'package:flutter/services.dart';

/// Lightweight JSON-based localization. Every language lives in
/// `assets/i18n/<code>.json`; adding a language = adding one file and one
/// entry in [L10n.languages].
class L10n {
  L10n._(this.code, this._data, this._fallback);

  final String code;
  final Map<String, dynamic> _data;
  final Map<String, dynamic> _fallback;

  /// Native display names, shown in the language picker.
  static const languages = <String, String>{
    'ar': 'العربية',
    'en': 'English',
    'fr': 'Français',
    'es': 'Español',
    'de': 'Deutsch',
    'tr': 'Türkçe',
  };

  static const rtlLanguages = {'ar'};

  bool get isRtl => rtlLanguages.contains(code);

  static Future<Map<String, dynamic>> _read(String code) async {
    final raw = await rootBundle.loadString('assets/i18n/$code.json');
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  static Future<L10n> load(String code) async {
    final fallback = await _read('en');
    final data = code == 'en' ? fallback : await _read(code);
    return L10n._(code, data, fallback);
  }

  dynamic _lookup(Map<String, dynamic> source, String path) {
    dynamic node = source;
    for (final part in path.split('.')) {
      if (node is Map<String, dynamic> && node.containsKey(part)) {
        node = node[part];
      } else if (node is List && int.tryParse(part) != null) {
        final i = int.parse(part);
        if (i < 0 || i >= node.length) return null;
        node = node[i];
      } else {
        return null;
      }
    }
    return node;
  }

  /// Raw node (string, list or map) with English fallback.
  dynamic raw(String path) => _lookup(_data, path) ?? _lookup(_fallback, path);

  /// Translated string; `{placeholders}` are replaced from [args].
  String t(String path, [Map<String, Object?> args = const {}]) {
    final value = raw(path);
    var text = value is String ? value : path;
    args.forEach((k, v) => text = text.replaceAll('{$k}', '${v ?? ''}'));
    return text;
  }

  List<String> list(String path) {
    final value = raw(path);
    if (value is List) return value.map((e) => '$e').toList();
    return const [];
  }
}
