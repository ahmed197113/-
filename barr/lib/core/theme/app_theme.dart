import 'package:flutter/material.dart';

/// Brand palette: calm teal + warm terracotta.
abstract final class BarrColors {
  static const teal = Color(0xFF0F766E);
  static const tealDark = Color(0xFF0B4F4A);
  static const warm = Color(0xFFE07A5F);
  static const sand = Color(0xFFFAF6F0);

  static const ok = Color(0xFF2E7D32);
  static const warn = Color(0xFFF9A825);
  static const danger = Color(0xFFC62828);
}

abstract final class AppTheme {
  static const fontFamily = 'Tajawal';

  static ThemeData caregiver(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: BarrColors.teal,
      secondary: BarrColors.warm,
      brightness: brightness,
    );
    final isLight = brightness == Brightness.light;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: isLight ? BarrColors.sand : scheme.surface,
      appBarTheme: AppBarTheme(
        centerTitle: true,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isLight ? Colors.white : scheme.surfaceContainerHighest,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: isLight ? Colors.white : scheme.surfaceContainer,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        margin: EdgeInsets.zero,
      ),
    );
  }

  /// High-contrast, extra-large theme for parents (light only, ≥24sp).
  static ThemeData elder() {
    final scheme = ColorScheme.fromSeed(
      seedColor: BarrColors.teal,
      brightness: Brightness.light,
    ).copyWith(
      primary: BarrColors.tealDark,
      onPrimary: Colors.white,
      surface: Colors.white,
      onSurface: Colors.black,
    );
    const base = TextStyle(fontFamily: fontFamily, color: Colors.black);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: const Color(0xFFF4F1EA),
      textTheme: TextTheme(
        displaySmall: base.copyWith(fontSize: 40, fontWeight: FontWeight.w800),
        headlineMedium: base.copyWith(fontSize: 32, fontWeight: FontWeight.w800),
        titleLarge: base.copyWith(fontSize: 28, fontWeight: FontWeight.w700),
        bodyLarge: base.copyWith(fontSize: 26, fontWeight: FontWeight.w500),
        bodyMedium: base.copyWith(fontSize: 24),
        labelLarge: base.copyWith(fontSize: 28, fontWeight: FontWeight.w800),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(88),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 28, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}
