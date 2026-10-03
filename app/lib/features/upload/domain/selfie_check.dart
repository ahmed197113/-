import 'package:flutter/foundation.dart';

enum SelfieIssue {
  noFace('لم نتمكن من رؤية وجه في الصورة', 'التقط صورة أمامية واضحة لوجهك'),
  multipleFaces('الصورة فيها أكثر من وجه', 'استخدم صورة لك وحدك فقط'),
  faceTooSmall('الوجه بعيد وصغير جداً', 'اقترب من الكاميرا ليملأ وجهك ثلث الصورة'),
  notFrontal('الوجه مائل كثيراً', 'انظر مباشرة إلى الكاميرا'),
  blurry('الصورة غير واضحة', 'ثبّت الهاتف وامسح العدسة ثم أعد التصوير'),
  tooDark('الإضاءة ضعيفة', 'صورة أوضح بإضاءة أمامية — قف مقابل نافذة'),
  tooBright('الإضاءة قوية جداً', 'ابتعد عن ضوء الشمس المباشر'),
  eyesClosed('العينان مغلقتان', 'افتح عينيك وانظر إلى الكاميرا'),
  unreadable('تعذّرت قراءة الصورة', 'جرّب صورة أخرى بصيغة JPG أو PNG');

  const SelfieIssue(this.messageAr, this.tipAr);
  final String messageAr;
  final String tipAr;
}

@immutable
class SelfieCheckResult {
  const SelfieCheckResult({
    required this.sourcePath,
    this.croppedPath,
    this.issue,
  });

  final String sourcePath;
  final String? croppedPath;
  final SelfieIssue? issue;

  bool get ok => issue == null && croppedPath != null;
}

/// Thresholds are pure so they can be unit tested and tuned from one place.
class SelfieRules {
  const SelfieRules._();

  static const minFaceAreaRatio = 0.04;
  static const maxYawDegrees = 28.0;
  static const minSharpness = 60.0;
  static const minBrightness = 55.0;
  static const maxBrightness = 215.0;
  static const minEyeOpenProbability = 0.2;

  static SelfieIssue? evaluate({
    required int faceCount,
    double faceAreaRatio = 1,
    double yaw = 0,
    double sharpness = 1000,
    double brightness = 128,
    double? leftEyeOpen,
    double? rightEyeOpen,
  }) {
    if (faceCount == 0) return SelfieIssue.noFace;
    if (faceCount > 1) return SelfieIssue.multipleFaces;
    if (faceAreaRatio < minFaceAreaRatio) return SelfieIssue.faceTooSmall;
    if (yaw.abs() > maxYawDegrees) return SelfieIssue.notFrontal;
    if (brightness < minBrightness) return SelfieIssue.tooDark;
    if (brightness > maxBrightness) return SelfieIssue.tooBright;
    if (sharpness < minSharpness) return SelfieIssue.blurry;
    if (leftEyeOpen != null &&
        rightEyeOpen != null &&
        leftEyeOpen < minEyeOpenProbability &&
        rightEyeOpen < minEyeOpenProbability) {
      return SelfieIssue.eyesClosed;
    }
    return null;
  }
}
