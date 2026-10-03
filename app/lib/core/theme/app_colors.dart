import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const gold = Color(0xFFC9A24A);
  static const goldLight = Color(0xFFE8C873);
  static const goldDeep = Color(0xFF8A6A22);
  static const night = Color(0xFF0F1A2E);
  static const nightSurface = Color(0xFF17243D);
  static const nightCard = Color(0xFF1E2D4A);
  static const cream = Color(0xFFF8F3E8);
  static const creamCard = Color(0xFFFFFCF5);
  static const danger = Color(0xFFE5484D);
  static const success = Color(0xFF30A46C);

  static const goldGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFFF3DC93), gold, goldDeep, Color(0xFFE8C873)],
    stops: [0, 0.4, 0.75, 1],
  );

  static Color parse(String hex, {Color fallback = gold}) {
    var h = hex.replaceAll('#', '').trim();
    if (h.length == 6) h = 'FF$h';
    final v = int.tryParse(h, radix: 16);
    return v == null ? fallback : Color(v);
  }
}
