import 'package:flutter/widgets.dart';

/// Arabic-first inline translations: `context.tr('عربي', 'English')`.
extension Tr on BuildContext {
  bool get isArabic => Localizations.localeOf(this).languageCode == 'ar';
  String tr(String ar, String en) => isArabic ? ar : en;
}
