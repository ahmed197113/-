import 'package:flutter/foundation.dart';

@immutable
class GalleryItem {
  const GalleryItem({
    required this.id,
    required this.jobId,
    required this.templateId,
    required this.uri,
    required this.createdAt,
    this.favorite = false,
    this.edited = false,
  });

  static const retention = Duration(days: 30);

  final String id;
  final String jobId;
  final String templateId;

  /// Local file path or HTTPS URL.
  final String uri;
  final DateTime createdAt;
  final bool favorite;
  final bool edited;

  DateTime get expiresAt => createdAt.add(retention);

  int daysLeft(DateTime now) =>
      expiresAt.difference(now).inHours <= 0 ? 0 : (expiresAt.difference(now).inHours / 24).ceil();

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);

  GalleryItem copyWith({bool? favorite}) => GalleryItem(
        id: id,
        jobId: jobId,
        templateId: templateId,
        uri: uri,
        createdAt: createdAt,
        favorite: favorite ?? this.favorite,
        edited: edited,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'job_id': jobId,
        'template_id': templateId,
        'uri': uri,
        'created_at': createdAt.toIso8601String(),
        'favorite': favorite,
        'edited': edited,
      };

  factory GalleryItem.fromJson(Map<String, dynamic> j) => GalleryItem(
        id: j['id'] as String,
        jobId: j['job_id'] as String? ?? '',
        templateId: j['template_id'] as String? ?? '',
        uri: j['uri'] as String,
        createdAt: DateTime.parse(j['created_at'] as String),
        favorite: j['favorite'] as bool? ?? false,
        edited: j['edited'] as bool? ?? false,
      );
}
