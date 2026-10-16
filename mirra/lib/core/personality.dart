import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Big Five model, measured with a short 20-item scale adapted from the
/// public-domain Mini-IPIP (Donnellan et al., 2006; ipip.ori.org):
/// four simple statements per trait, answered on a 5-point scale.
///
/// Trait codes: O = Openness, C = Conscientiousness, E = Extraversion,
/// A = Agreeableness, S = Emotional Stability (inverse of Neuroticism).
class Personality {
  static const traits = ['O', 'C', 'E', 'A', 'S'];

  /// (trait, keying) for each item, in presentation order.
  /// Keying +1 = agreeing raises the trait, -1 = reverse-keyed.
  static const items = <(String, int)>[
    ('E', 1), ('A', 1), ('C', 1), ('S', -1), ('O', 1),
    ('E', -1), ('A', -1), ('C', -1), ('S', 1), ('O', -1),
    ('E', 1), ('A', 1), ('C', 1), ('S', -1), ('O', 1),
    ('E', -1), ('A', -1), ('C', -1), ('S', 1), ('O', -1),
  ];

  static int get questionCount => items.length;

  static const colors = <String, Color>{
    'O': Color(0xFF8B5CF6),
    'C': Color(0xFF0EA5E9),
    'E': Color(0xFFF59E0B),
    'A': Color(0xFF10B981),
    'S': Color(0xFFEC4899),
  };

  static const icons = <String, IconData>{
    'O': Icons.lightbulb_rounded,
    'C': Icons.task_alt_rounded,
    'E': Icons.groups_rounded,
    'A': Icons.favorite_rounded,
    'S': Icons.spa_rounded,
  };

  /// Emoji per archetype key (E, O, C, A high=1 / low=0).
  static const typeEmoji = <String, String>{
    '1111': '🌟', '1110': '🚀', '1101': '✨', '1100': '⚡',
    '1011': '🤝', '1010': '🦁', '1001': '🎉', '1000': '🧭',
    '0111': '🦉', '0110': '♟️', '0101': '🌙', '0100': '🔭',
    '0011': '🛡️', '0010': '🔍', '0001': '🕊️', '0000': '🗻',
  };

  /// Percent scores 0–100 per trait from answers (item index → 1..5).
  static Map<String, double> score(Map<int, int> answers) {
    final sums = {for (final t in traits) t: 0};
    final counts = {for (final t in traits) t: 0};
    for (var i = 0; i < items.length; i++) {
      final a = answers[i];
      if (a == null) continue;
      final (trait, key) = items[i];
      sums[trait] = sums[trait]! + (key > 0 ? a : 6 - a);
      counts[trait] = counts[trait]! + 1;
    }
    return {
      for (final t in traits)
        t: counts[t]! == 0
            ? 50
            : ((sums[t]! - counts[t]!) / (counts[t]! * 4) * 100)
                .clamp(0, 100)
                .toDouble(),
    };
  }

  static String level(double v) => v >= 60 ? 'high' : (v <= 40 ? 'low' : 'mid');

  static String typeKey(Map<String, double> s) =>
      ['E', 'O', 'C', 'A'].map((t) => s[t]! >= 50 ? '1' : '0').join();

  static String variant(Map<String, double> s) =>
      s['S']! >= 50 ? 'steady' : 'sensitive';

  /// Traits sorted from strongest to weakest.
  static List<String> ranked(Map<String, double> s) =>
      [...traits]..sort((a, b) => s[b]!.compareTo(s[a]!));

  /// The two lowest traits become the growth focus.
  static List<String> focusTraits(Map<String, double> s) =>
      ranked(s).reversed.take(2).toList();

  /// Ids of combination insights that apply (keys under `insights.`).
  static List<String> insights(Map<String, double> s) {
    bool hi(String t) => s[t]! >= 60;
    bool lo(String t) => s[t]! <= 40;
    final rules = <String, bool>{
      'perfectionist': hi('C') && lo('S'),
      'connector': hi('E') && hi('A'),
      'ideas': hi('O') && lo('C'),
      'creator': hi('O') && hi('C'),
      'innerWorld': lo('E') && hi('O'),
      'empath': hi('A') && lo('S'),
      'driven': lo('A') && hi('C'),
      'spontaneous': hi('E') && lo('C'),
      'rock': hi('S') && hi('C'),
      'withdraw': lo('E') && lo('S'),
      'visionary': hi('E') && hi('O'),
      'competitor': lo('A') && hi('E'),
      'calmKind': hi('S') && hi('A'),
      'traditional': lo('O') && hi('C'),
    };
    return [for (final e in rules.entries) if (e.value) e.key];
  }

  /// The answers that most strongly shaped [trait], strongest first.
  /// Each entry is (item index, agreed). Neutral answers are skipped.
  static List<(int, bool)> evidence(Map<int, int> answers, String trait,
      {int max = 2}) {
    final picks = <(int, bool, int)>[];
    for (var i = 0; i < items.length; i++) {
      final a = answers[i];
      if (a == null || a == 3 || items[i].$1 != trait) continue;
      picks.add((i, a > 3, (a - 3).abs()));
    }
    picks.sort((x, y) => y.$3.compareTo(x.$3));
    return [for (final p in picks.take(max)) (p.$1, p.$2)];
  }

  /// Distance between two profiles, 0 = identical, 100 = opposite.
  static double distance(Map<String, double> a, Map<String, double> b) {
    var sum = 0.0;
    for (final t in traits) {
      sum += math.pow(a[t]! - b[t]!, 2);
    }
    return math.sqrt(sum / traits.length);
  }
}
