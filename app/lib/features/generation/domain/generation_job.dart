import 'package:flutter/foundation.dart';

enum JobStatus { queued, processing, done, failed }

@immutable
class GenerationJob {
  const GenerationJob({
    required this.id,
    required this.templateId,
    required this.status,
    required this.createdAt,
    this.progress = 0,
    this.results = const [],
    this.errorAr,
    this.watermarked = true,
    this.isPreview = false,
  });

  final String id;
  final String templateId;
  final JobStatus status;
  final DateTime createdAt;

  /// 0..1 progress for the animated loader.
  final double progress;

  /// Local file paths (demo) or HTTPS URLs (Firebase).
  final List<String> results;
  final String? errorAr;
  final bool watermarked;

  /// True for on-device previews generated without the AI backend.
  final bool isPreview;

  bool get isFinished => status == JobStatus.done || status == JobStatus.failed;

  GenerationJob copyWith({
    JobStatus? status,
    double? progress,
    List<String>? results,
    String? errorAr,
  }) =>
      GenerationJob(
        id: id,
        templateId: templateId,
        status: status ?? this.status,
        createdAt: createdAt,
        progress: progress ?? this.progress,
        results: results ?? this.results,
        errorAr: errorAr ?? this.errorAr,
        watermarked: watermarked,
        isPreview: isPreview,
      );
}

@immutable
class GenerationRequest {
  const GenerationRequest({
    required this.templateId,
    required this.selfiePaths,
    required this.gender,
    this.aspectRatio = '4:5',
    this.variations = 4,
  });

  final String templateId;
  final List<String> selfiePaths;
  final String gender;
  final String aspectRatio;
  final int variations;
}
