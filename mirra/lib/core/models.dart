import 'personality.dart';

class TestResult {
  TestResult({required this.date, required this.scores});

  final DateTime date;
  final Map<String, double> scores;

  String get typeKey => Personality.typeKey(scores);
  String get variant => Personality.variant(scores);
  String get emoji => Personality.typeEmoji[typeKey]!;

  Map<String, dynamic> toJson() => {
        'date': date.toIso8601String(),
        'scores': scores,
      };

  factory TestResult.fromJson(Map<String, dynamic> j) => TestResult(
        date: DateTime.parse(j['date'] as String),
        scores: (j['scores'] as Map<String, dynamic>)
            .map((k, v) => MapEntry(k, (v as num).toDouble())),
      );
}

/// A 21-day growth plan built around the user's two focus traits.
class GrowthPlan {
  GrowthPlan({
    required this.start,
    required this.focus,
    Set<int>? done,
    Map<int, String>? notes,
  })  : done = done ?? {},
        notes = notes ?? {};

  static const length = 21;
  static const challengesPerTrait = 10;

  final DateTime start;
  final List<String> focus;
  final Set<int> done;
  final Map<int, String> notes;

  static DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

  int get today =>
      _day(DateTime.now()).difference(_day(start)).inDays.clamp(0, length - 1);

  bool get finished => done.length >= length;

  String traitFor(int day) => focus[day % focus.length];

  int challengeFor(int day) => (day ~/ focus.length) % challengesPerTrait;

  /// Consecutive completed days ending today (or yesterday if today is open).
  int get streak {
    var d = done.contains(today) ? today : today - 1;
    var s = 0;
    while (d >= 0 && done.contains(d)) {
      s++;
      d--;
    }
    return s;
  }

  Map<String, dynamic> toJson() => {
        'start': start.toIso8601String(),
        'focus': focus,
        'done': done.toList(),
        'notes': notes.map((k, v) => MapEntry('$k', v)),
      };

  factory GrowthPlan.fromJson(Map<String, dynamic> j) => GrowthPlan(
        start: DateTime.parse(j['start'] as String),
        focus: (j['focus'] as List).cast<String>(),
        done: (j['done'] as List).map((e) => e as int).toSet(),
        notes: (j['notes'] as Map<String, dynamic>)
            .map((k, v) => MapEntry(int.parse(k), v as String)),
      );
}
