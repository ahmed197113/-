import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../domain/selfie_check.dart';

/// On-device selfie validation with ML Kit, plus auto-crop around the face.
/// Nothing leaves the phone at this stage.
class FaceCheckService {
  FaceCheckService()
      : _detector = FaceDetector(
          options: FaceDetectorOptions(
            performanceMode: FaceDetectorMode.accurate,
            enableClassification: true,
            minFaceSize: 0.08,
          ),
        );

  final FaceDetector _detector;

  Future<SelfieCheckResult> check(String path) async {
    try {
      final faces = await _detector.processImage(InputImage.fromFilePath(path));
      final bytes = await File(path).readAsBytes();
      final dir = await getTemporaryDirectory();
      final out = '${dir.path}/selfie_${const Uuid().v4()}.jpg';
      final face = faces.length == 1 ? faces.first : null;
      final analysis = await compute(_analyseAndCrop, _CropRequest(
        bytes: bytes,
        outPath: out,
        face: face == null
            ? null
            : [face.boundingBox.left, face.boundingBox.top, face.boundingBox.width, face.boundingBox.height],
      ));
      if (analysis == null) {
        return SelfieCheckResult(sourcePath: path, issue: SelfieIssue.unreadable);
      }
      final issue = SelfieRules.evaluate(
        faceCount: faces.length,
        faceAreaRatio: analysis.faceAreaRatio,
        yaw: face?.headEulerAngleY ?? 0,
        sharpness: analysis.sharpness,
        brightness: analysis.brightness,
        leftEyeOpen: face?.leftEyeOpenProbability,
        rightEyeOpen: face?.rightEyeOpenProbability,
      );
      return SelfieCheckResult(
        sourcePath: path,
        croppedPath: issue == null ? out : null,
        issue: issue,
      );
    } catch (_) {
      return SelfieCheckResult(sourcePath: path, issue: SelfieIssue.unreadable);
    }
  }

  Future<void> dispose() => _detector.close();
}

class _CropRequest {
  const _CropRequest({required this.bytes, required this.outPath, this.face});
  final Uint8List bytes;
  final String outPath;
  final List<double>? face;
}

class _Analysis {
  const _Analysis(this.faceAreaRatio, this.sharpness, this.brightness);
  final double faceAreaRatio;
  final double sharpness;
  final double brightness;
}

_Analysis? _analyseAndCrop(_CropRequest r) {
  final decoded = img.decodeImage(r.bytes);
  if (decoded == null) return null;
  final image = img.bakeOrientation(decoded);
  final w = image.width.toDouble();
  final h = image.height.toDouble();

  // Face region (or centre) for metrics; ML Kit boxes are in oriented space.
  final f = r.face ?? [w * .25, h * .2, w * .5, h * .5];
  final faceArea = (f[2] * f[3]) / (w * h);

  // Crop 4:5 portrait around the face with generous margins.
  final cropH = math.min(h, f[3] * 3.2);
  final cropW = math.min(w, cropH * .8);
  final cx = f[0] + f[2] / 2;
  final cy = f[1] + f[3] / 2 + f[3] * .25;
  final x = (cx - cropW / 2).clamp(0, w - cropW).toInt();
  final y = (cy - cropH / 2).clamp(0, h - cropH).toInt();
  var crop = img.copyCrop(image, x: x, y: y, width: cropW.toInt(), height: cropH.toInt());
  if (crop.width > 1024) crop = img.copyResize(crop, width: 1024);

  // Metrics on a small grayscale copy of the face.
  final faceImg = img.copyCrop(image,
      x: f[0].clamp(0, w - 1).toInt(),
      y: f[1].clamp(0, h - 1).toInt(),
      width: f[2].clamp(1, w).toInt(),
      height: f[3].clamp(1, h).toInt());
  final small = img.grayscale(img.copyResize(faceImg, width: 160));
  var sum = 0.0;
  for (final p in small) {
    sum += p.r;
  }
  final brightness = sum / (small.width * small.height);

  // Variance of the Laplacian = sharpness.
  final values = <double>[];
  for (var yy = 1; yy < small.height - 1; yy++) {
    for (var xx = 1; xx < small.width - 1; xx++) {
      final c = small.getPixel(xx, yy).r * 4;
      final n = small.getPixel(xx - 1, yy).r +
          small.getPixel(xx + 1, yy).r +
          small.getPixel(xx, yy - 1).r +
          small.getPixel(xx, yy + 1).r;
      values.add((c - n).toDouble());
    }
  }
  final mean = values.fold(0.0, (a, b) => a + b) / values.length;
  final variance = values.fold(0.0, (a, b) => a + (b - mean) * (b - mean)) / values.length;

  File(r.outPath).writeAsBytesSync(img.encodeJpg(crop, quality: 92));
  return _Analysis(faceArea, variance, brightness);
}
