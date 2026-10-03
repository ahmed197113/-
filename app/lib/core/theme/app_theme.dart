import 'package:flutter/material.dart';

import 'app_colors.dart';

class AppTheme {
  const AppTheme._();

  static const uiFont = 'Tajawal';

  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        background: AppColors.night,
        surface: AppColors.nightSurface,
        card: AppColors.nightCard,
        onSurface: AppColors.cream,
      );

  static ThemeData light() => _build(
        brightness: Brightness.light,
        background: AppColors.cream,
        surface: AppColors.creamCard,
        card: Colors.white,
        onSurface: AppColors.night,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color card,
    required Color onSurface,
  }) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.gold,
      onPrimary: AppColors.night,
      secondary: AppColors.goldLight,
      onSecondary: AppColors.night,
      error: AppColors.danger,
      onError: Colors.white,
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest: card,
    );
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      fontFamily: uiFont,
      scaffoldBackgroundColor: background,
    );
    return base.copyWith(
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: uiFont,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          color: onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.night,
          minimumSize: const Size.fromHeight(54),
          textStyle: const TextStyle(
              fontFamily: uiFont, fontSize: 17, fontWeight: FontWeight.w800),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: onSurface,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: AppColors.gold),
          textStyle: const TextStyle(
              fontFamily: uiFont, fontSize: 16, fontWeight: FontWeight.w700),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: card,
        selectedColor: AppColors.gold,
        labelStyle: TextStyle(fontFamily: uiFont, color: onSurface),
        secondaryLabelStyle:
            const TextStyle(fontFamily: uiFont, color: AppColors.night),
        side: BorderSide.none,
        shape: const StadiumBorder(),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        contentTextStyle: TextStyle(fontFamily: uiFont, fontSize: 15),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: AppColors.gold.withValues(alpha: 0.25),
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(fontFamily: uiFont, fontSize: 12, color: onSurface),
        ),
      ),
    );
  }
}
