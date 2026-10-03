import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../../core/config/providers.dart';
import '../domain/gallery_item.dart';

/// Index of the user's results. Items expire after 30 days (matching the
/// server-side `scheduledCleanup`), and local files are deleted with them.
class GalleryNotifier extends Notifier<List<GalleryItem>> {
  static const _key = 'gallery_v1';
  SharedPreferences get _prefs => ref.read(sharedPrefsProvider);

  @override
  List<GalleryItem> build() {
    final raw = ref.watch(sharedPrefsProvider).getString(_key);
    final all = raw == null
        ? <GalleryItem>[]
        : (jsonDecode(raw) as List).cast<Map<String, dynamic>>().map(GalleryItem.fromJson).toList();
    final now = DateTime.now();
    final expired = all.where((i) => i.isExpired(now)).toList();
    for (final e in expired) {
      _deleteFile(e.uri);
    }
    final live = all.where((i) => !i.isExpired(now)).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    if (expired.isNotEmpty) _save(live);
    return live;
  }

  void _save(List<GalleryItem> items) =>
      _prefs.setString(_key, jsonEncode(items.map((i) => i.toJson()).toList()));

  void _set(List<GalleryItem> items) {
    _save(items);
    state = items;
  }

  void addAll({required String jobId, required String templateId, required List<String> uris, bool edited = false}) {
    final now = DateTime.now();
    final added = [
      for (final u in uris)
        GalleryItem(id: const Uuid().v4(), jobId: jobId, templateId: templateId, uri: u, createdAt: now, edited: edited),
    ];
    _set([...added, ...state]);
  }

  void toggleFavorite(String id) =>
      _set([for (final i in state) i.id == id ? i.copyWith(favorite: !i.favorite) : i]);

  void remove(String id) {
    final item = state.where((i) => i.id == id).firstOrNull;
    if (item != null) _deleteFile(item.uri);
    _set(state.where((i) => i.id != id).toList());
  }

  /// "Delete all my photos now" from privacy settings.
  void clear() {
    for (final i in state) {
      _deleteFile(i.uri);
    }
    _set(const []);
  }

  static void _deleteFile(String uri) {
    if (uri.startsWith('http')) return;
    try {
      final f = File(uri);
      if (f.existsSync()) f.deleteSync();
    } catch (_) {}
  }
}

final galleryProvider = NotifierProvider<GalleryNotifier, List<GalleryItem>>(GalleryNotifier.new);
