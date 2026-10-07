import 'package:cloud_firestore/cloud_firestore.dart';

/// Converts Firestore [Timestamp]s to [DateTime] recursively so domain
/// entities never depend on the Firestore SDK.
Map<String, dynamic> normalizeFirestore(Map<String, dynamic> data) =>
    data.map((k, v) => MapEntry(k, _normalize(v)));

Object? _normalize(Object? v) => switch (v) {
      Timestamp t => t.toDate(),
      Map m => normalizeFirestore(Map<String, dynamic>.from(m)),
      List l => l.map(_normalize).toList(),
      _ => v,
    };

/// Central list of Firestore paths (see docs/ARCHITECTURE.md).
abstract final class FsPaths {
  static String user(String uid) => 'users/$uid';
  static String family(String fid) => 'families/$fid';
  static String members(String fid) => 'families/$fid/members';
  static String invites(String fid) => 'families/$fid/invites';
  static String elders(String fid) => 'families/$fid/elders';
  static String elder(String fid, String eid) => 'families/$fid/elders/$eid';
  static String checkins(String fid, String eid) => 'families/$fid/elders/$eid/checkins';
  static String medications(String fid, String eid) => 'families/$fid/elders/$eid/medications';
  static String doseLogs(String fid, String eid) => 'families/$fid/elders/$eid/doseLogs';
}
