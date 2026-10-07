import 'package:barr/core/utils/link_code.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses typed and scanned codes', () {
    expect(LinkCodeUtils.parse('123456'), '123456');
    expect(LinkCodeUtils.parse(' 123 456 '), '123456');
    expect(LinkCodeUtils.parse('١٢٣٤٥٦'), '123456');
    expect(LinkCodeUtils.parse(LinkCodeUtils.qrPayload('654321')), '654321');
  });

  test('rejects anything else', () {
    expect(LinkCodeUtils.parse(null), isNull);
    expect(LinkCodeUtils.parse('12345'), isNull);
    expect(LinkCodeUtils.parse('1234567'), isNull);
    expect(LinkCodeUtils.parse('https://evil.example/?code=123456'), isNull);
    expect(LinkCodeUtils.parse('barr://link?code=12ab56'), isNull);
  });
}
