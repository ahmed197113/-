import 'phone.dart';

/// 6-digit family link codes, optionally wrapped in a QR deep link
/// (`barr://link?code=123456`).
abstract final class LinkCodeUtils {
  static const length = 6;
  static const qrScheme = 'barr';

  static String qrPayload(String code) => '$qrScheme://link?code=$code';

  /// Extracts a valid code from typed text or a scanned QR payload.
  static String? parse(String? raw) {
    if (raw == null) return null;
    final text = PhoneUtils.toAsciiDigits(raw.trim());
    final uri = Uri.tryParse(text);
    if (uri != null && uri.scheme == qrScheme) {
      return parse(uri.queryParameters['code']);
    }
    final digits = text.replaceAll(RegExp(r'\s'), '');
    return RegExp(r'^\d{6}$').hasMatch(digits) ? digits : null;
  }
}
