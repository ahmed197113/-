import '../../../core/utils/dates.dart';

/// Time of day for a dose (local time of the parent's device).
class DoseTime implements Comparable<DoseTime> {
  const DoseTime(this.hour, this.minute);

  final int hour;
  final int minute;

  /// `HHmm`, used in ids and storage.
  String get key => '${hour.toString().padLeft(2, '0')}${minute.toString().padLeft(2, '0')}';

  static DoseTime? tryParse(String? v) {
    if (v == null || !RegExp(r'^\d{4}$').hasMatch(v)) return null;
    final h = int.parse(v.substring(0, 2));
    final m = int.parse(v.substring(2));
    if (h > 23 || m > 59) return null;
    return DoseTime(h, m);
  }

  DateTime on(DateTime day) => DateTime(day.year, day.month, day.day, hour, minute);

  @override
  int compareTo(DoseTime other) => (hour * 60 + minute) - (other.hour * 60 + other.minute);

  @override
  bool operator ==(Object other) => other is DoseTime && other.key == key;

  @override
  int get hashCode => key.hashCode;
}

enum MealInstruction {
  none,
  beforeMeal,
  afterMeal,
  withMeal,
  beforeSleep;

  static MealInstruction parse(String? v) =>
      MealInstruction.values.where((e) => e.name == v).firstOrNull ?? MealInstruction.none;
}

/// Who promised to buy the refill ("سأشتريه أنا").
class StockBuyer {
  const StockBuyer({required this.uid, required this.name});

  final String uid;
  final String name;
}

/// `families/{fid}/elders/{eid}/medications/{mid}`
class Medication {
  const Medication({
    required this.id,
    required this.name,
    required this.dose,
    required this.times,
    required this.startDate,
    this.weekdays = const {},
    this.endDate,
    this.meal = MealInstruction.none,
    this.notes = '',
    this.photoUrl,
    this.stockQty,
    this.perDose = 1,
    this.buyer,
    this.active = true,
  });

  final String id;
  final String name;

  /// Free text, e.g. "حبة واحدة", "5 مل".
  final String dose;
  final List<DoseTime> times;

  /// `DateTime.monday..DateTime.sunday`; empty means every day.
  final Set<int> weekdays;
  final DateTime startDate;
  final DateTime? endDate;
  final MealInstruction meal;
  final String notes;
  final String? photoUrl;

  /// Units left (null = not tracked).
  final int? stockQty;
  final int perDose;
  final StockBuyer? buyer;
  final bool active;

  bool isDueOn(DateTime day) {
    if (!active) return false;
    final d = DateTime(day.year, day.month, day.day);
    final start = DateTime(startDate.year, startDate.month, startDate.day);
    if (d.isBefore(start)) return false;
    if (endDate != null) {
      final end = DateTime(endDate!.year, endDate!.month, endDate!.day);
      if (d.isAfter(end)) return false;
    }
    return weekdays.isEmpty || weekdays.contains(d.weekday);
  }

  /// Units used per day on days the medication is due.
  int get dailyUse => perDose * times.length;

  /// Low when fewer than 3 days remain.
  bool get isLowStock => stockQty != null && stockQty! <= dailyUse * 3;

  int? get daysLeft => stockQty == null || dailyUse == 0 ? null : stockQty! ~/ dailyUse;

  factory Medication.fromMap(String id, Map<String, dynamic> m) {
    final stock = Map<String, dynamic>.from((m['stock'] as Map?) ?? const {});
    final buyer = stock['buyer'] is Map ? Map<String, dynamic>.from(stock['buyer'] as Map) : null;
    return Medication(
      id: id,
      name: (m['name'] as String?) ?? '',
      dose: (m['dose'] as String?) ?? '',
      times: ((m['times'] as List?) ?? const [])
          .map((t) => DoseTime.tryParse(t as String?))
          .whereType<DoseTime>()
          .toList()
        ..sort(),
      weekdays: Set<int>.from(((m['weekdays'] as List?) ?? const []).map((e) => (e as num).toInt())),
      startDate: _date(m['startDate']) ?? DateTime(2000),
      endDate: _date(m['endDate']),
      meal: MealInstruction.parse(m['meal'] as String?),
      notes: (m['notes'] as String?) ?? '',
      photoUrl: m['photoUrl'] as String?,
      stockQty: (stock['qty'] as num?)?.toInt(),
      perDose: (stock['perDose'] as num?)?.toInt() ?? 1,
      buyer: buyer == null
          ? null
          : StockBuyer(uid: buyer['uid'] as String? ?? '', name: buyer['name'] as String? ?? ''),
      active: (m['active'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'dose': dose,
        'times': times.map((t) => t.key).toList(),
        'weekdays': weekdays.toList()..sort(),
        'startDate': dayKey(startDate),
        'endDate': endDate == null ? null : dayKey(endDate!),
        'meal': meal.name,
        'notes': notes,
        'photoUrl': photoUrl,
        'stock': {
          'qty': stockQty,
          'perDose': perDose,
          if (buyer != null) 'buyer': {'uid': buyer!.uid, 'name': buyer!.name},
        },
        'active': active,
      };

  Medication copyWith({String? id, String? photoUrl}) => Medication(
        id: id ?? this.id,
        name: name,
        dose: dose,
        times: times,
        weekdays: weekdays,
        startDate: startDate,
        endDate: endDate,
        meal: meal,
        notes: notes,
        photoUrl: photoUrl ?? this.photoUrl,
        stockQty: stockQty,
        perDose: perDose,
        buyer: buyer,
        active: active,
      );

  static DateTime? _date(Object? v) => switch (v) {
        DateTime d => d,
        String s when RegExp(r'^\d{8}$').hasMatch(s) =>
          DateTime(int.parse(s.substring(0, 4)), int.parse(s.substring(4, 6)), int.parse(s.substring(6))),
        String s => DateTime.tryParse(s),
        _ => null,
      };
}

enum DoseStatus {
  taken,
  snoozed,
  skipped;

  static DoseStatus? tryParse(String? v) => DoseStatus.values.where((e) => e.name == v).firstOrNull;
}

/// `families/{fid}/elders/{eid}/doseLogs/{doseId}`
class DoseLog {
  const DoseLog({
    required this.doseId,
    required this.medId,
    required this.scheduledAt,
    required this.status,
    required this.actedAt,
    this.snoozeCount = 0,
    this.source = 'elder',
  });

  final String doseId;
  final String medId;
  final DateTime scheduledAt;
  final DoseStatus status;
  final DateTime actedAt;
  final int snoozeCount;
  final String source;

  factory DoseLog.fromMap(String id, Map<String, dynamic> m) => DoseLog(
        doseId: id,
        medId: m['medId'] as String? ?? '',
        scheduledAt: _toDate(m['scheduledAt']) ?? DateTime(2000),
        status: DoseStatus.tryParse(m['status'] as String?) ?? DoseStatus.snoozed,
        actedAt: _toDate(m['actedAt']) ?? DateTime(2000),
        snoozeCount: (m['snoozeCount'] as num?)?.toInt() ?? 0,
        source: m['source'] as String? ?? 'elder',
      );

  static DateTime? _toDate(Object? v) => switch (v) {
        DateTime d => d,
        int ms => DateTime.fromMillisecondsSinceEpoch(ms),
        String s => DateTime.tryParse(s),
        _ => null,
      };
}
