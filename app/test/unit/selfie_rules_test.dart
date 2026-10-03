import 'package:flutter_test/flutter_test.dart';
import 'package:munasaba/features/upload/domain/selfie_check.dart';

void main() {
  test('good selfie passes', () {
    expect(SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .2), isNull);
  });
  test('rejects with friendly reasons', () {
    expect(SelfieRules.evaluate(faceCount: 0), SelfieIssue.noFace);
    expect(SelfieRules.evaluate(faceCount: 2), SelfieIssue.multipleFaces);
    expect(SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .01), SelfieIssue.faceTooSmall);
    expect(SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .2, yaw: 40), SelfieIssue.notFrontal);
    expect(SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .2, brightness: 20), SelfieIssue.tooDark);
    expect(SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .2, sharpness: 5), SelfieIssue.blurry);
    expect(
      SelfieRules.evaluate(faceCount: 1, faceAreaRatio: .2, leftEyeOpen: .05, rightEyeOpen: .05),
      SelfieIssue.eyesClosed,
    );
  });
  test('every issue has an arabic tip', () {
    for (final i in SelfieIssue.values) {
      expect(i.messageAr, isNotEmpty);
      expect(i.tipAr, isNotEmpty);
    }
  });
}
