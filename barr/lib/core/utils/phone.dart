/// Phone number helpers. Saudi Arabia (+966) is the default country.
abstract final class PhoneUtils {
  static const defaultCountryCode = '966';

  static const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  static const _persianDigits = '۰۱۲۳۴۵۶۷۸۹';

  /// Converts Arabic-Indic / Persian digits to ASCII.
  static String toAsciiDigits(String input) {
    final b = StringBuffer();
    for (final ch in input.split('')) {
      final a = _arabicDigits.indexOf(ch);
      final p = _persianDigits.indexOf(ch);
      b.write(a >= 0 ? '$a' : (p >= 0 ? '$p' : ch));
    }
    return b.toString();
  }

  /// Normalizes user input to E.164 (`+9665XXXXXXXX`), or returns `null`
  /// when the number is not valid.
  ///
  /// Accepts `05XXXXXXXX`, `5XXXXXXXX`, `9665XXXXXXXX`, `009665XXXXXXXX`,
  /// `+9665XXXXXXXX` and other international numbers starting with `+`/`00`.
  static String? normalize(String input) {
    var s = toAsciiDigits(input).replaceAll(RegExp(r'[\s\-()]'), '');
    if (s.isEmpty) return null;

    if (s.startsWith('00')) s = '+${s.substring(2)}';
    if (!s.startsWith('+')) {
      if (s.startsWith('0')) s = s.substring(1);
      if (s.startsWith(defaultCountryCode)) {
        s = '+$s';
      } else {
        s = '+$defaultCountryCode$s';
      }
    }
    if (!RegExp(r'^\+\d{8,15}$').hasMatch(s)) return null;

    if (s.startsWith('+$defaultCountryCode')) {
      final local = s.substring(defaultCountryCode.length + 1);
      if (!RegExp(r'^5\d{8}$').hasMatch(local)) return null;
    }
    return s;
  }

  /// `+966512345678` → `0512345678` for Saudi numbers, unchanged otherwise.
  static String display(String e164) {
    if (e164.startsWith('+$defaultCountryCode')) {
      return '0${e164.substring(defaultCountryCode.length + 1)}';
    }
    return e164;
  }
}
