import 'package:barr/core/utils/phone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PhoneUtils.normalize', () {
    test('accepts common Saudi formats', () {
      for (final input in [
        '0512345678',
        '512345678',
        '966512345678',
        '00966512345678',
        '+966512345678',
        '+966 51 234 5678',
        '٠٥١٢٣٤٥٦٧٨',
      ]) {
        expect(PhoneUtils.normalize(input), '+966512345678', reason: input);
      }
    });

    test('rejects invalid Saudi numbers', () {
      for (final input in ['', '0412345678', '05123', '+96651234567899', 'abc']) {
        expect(PhoneUtils.normalize(input), isNull, reason: input);
      }
    });

    test('accepts international numbers', () {
      expect(PhoneUtils.normalize('+201001234567'), '+201001234567');
      expect(PhoneUtils.normalize('00971501234567'), '+971501234567');
    });

    test('display converts back to local format', () {
      expect(PhoneUtils.display('+966512345678'), '0512345678');
      expect(PhoneUtils.display('+201001234567'), '+201001234567');
    });
  });
}
