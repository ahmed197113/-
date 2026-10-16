import 'package:flutter/material.dart';

class Brand {
  static const primary = Color(0xFF6C4BFF);
  static const violet = Color(0xFF8B3DFF);
  static const pink = Color(0xFFFF6B9A);
  static const gold = Color(0xFFFFD45C);

  static const gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5B4BFF), violet, pink],
    stops: [0, 0.6, 1],
  );
}

ThemeData buildTheme(Brightness brightness, String locale) {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.primary,
    brightness: brightness,
  );
  final dark = brightness == Brightness.dark;
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: locale == 'ar' ? 'Tajawal' : 'Poppins',
    scaffoldBackgroundColor:
        dark ? const Color(0xFF0F0B1E) : const Color(0xFFF7F5FF),
  );
  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: base.textTheme.titleLarge
          ?.copyWith(fontWeight: FontWeight.w700, color: scheme.onSurface),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: dark ? const Color(0xFF1B1530) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      margin: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF1B1530) : Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF15102A) : Colors.white,
      indicatorColor: scheme.primaryContainer,
      labelTextStyle: WidgetStatePropertyAll(
        base.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
  );
}
