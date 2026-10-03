import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/providers.dart';
import '../domain/occasion_template.dart';

abstract interface class TemplateRepository {
  Future<List<OccasionTemplate>> fetchAll();
}

/// Bundled seed catalogue. Also the offline fallback in Firebase mode.
class AssetTemplateRepository implements TemplateRepository {
  const AssetTemplateRepository({this.bundle});
  final AssetBundle? bundle;

  static const path = 'assets/templates/templates.json';

  @override
  Future<List<OccasionTemplate>> fetchAll() async {
    final raw = await (bundle ?? rootBundle).loadString(path);
    return parse(raw);
  }

  static List<OccasionTemplate> parse(String raw) => (jsonDecode(raw) as List)
      .cast<Map<String, dynamic>>()
      .map(OccasionTemplate.fromJson)
      .toList();
}

/// Live catalogue from Firestore `templates/*`, editable from the admin panel
/// so seasonal packs ship without an app update.
class FirestoreTemplateRepository implements TemplateRepository {
  FirestoreTemplateRepository(this._db, this._fallback);
  final FirebaseFirestore _db;
  final TemplateRepository _fallback;

  @override
  Future<List<OccasionTemplate>> fetchAll() async {
    try {
      final snap = await _db
          .collection('templates')
          .where('is_published', isEqualTo: true)
          .get();
      if (snap.docs.isEmpty) return await _fallback.fetchAll();
      return snap.docs
          .map((d) => OccasionTemplate.fromJson({...d.data(), 'id': d.id}))
          .toList();
    } on FirebaseException {
      return await _fallback.fetchAll();
    }
  }
}

final templateRepositoryProvider = Provider<TemplateRepository>((ref) {
  const asset = AssetTemplateRepository();
  if (!ref.watch(firebaseEnabledProvider)) return asset;
  return FirestoreTemplateRepository(FirebaseFirestore.instance, asset);
});

/// All templates sorted by priority (highest first).
final allTemplatesProvider = FutureProvider<List<OccasionTemplate>>((ref) async {
  final list = await ref.watch(templateRepositoryProvider).fetchAll();
  return [...list]..sort((a, b) => b.sortPriority.compareTo(a.sortPriority));
});

final templateByIdProvider =
    FutureProvider.family<OccasionTemplate?, String>((ref, id) async {
  final all = await ref.watch(allTemplatesProvider.future);
  for (final t in all) {
    if (t.id == id) return t;
  }
  return null;
});
