import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/l10n/generated/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/dose_schedule.dart';
import '../domain/medication.dart';

extension MealLabel on MealInstruction {
  String label(AppLocalizations l) => switch (this) {
        MealInstruction.none => l.mealNone,
        MealInstruction.beforeMeal => l.mealBefore,
        MealInstruction.afterMeal => l.mealAfter,
        MealInstruction.withMeal => l.mealWith,
        MealInstruction.beforeSleep => l.mealBeforeSleep,
      };
}

extension DoseStateUi on DoseState {
  String label(AppLocalizations l) => switch (this) {
        DoseState.taken => l.doseTaken,
        DoseState.missed => l.doseMissed,
        DoseState.snoozed => l.doseSnoozed,
        DoseState.upcoming => l.doseUpcoming,
        DoseState.due => l.doseDue,
        DoseState.skipped => l.doseSkipped,
      };

  Color color(ColorScheme scheme) => switch (this) {
        DoseState.taken => BarrColors.ok,
        DoseState.missed => BarrColors.danger,
        DoseState.snoozed || DoseState.due => BarrColors.warn,
        DoseState.upcoming || DoseState.skipped => scheme.outline,
      };

  IconData get icon => switch (this) {
        DoseState.taken => Icons.check_circle_rounded,
        DoseState.missed => Icons.cancel_rounded,
        DoseState.snoozed => Icons.snooze_rounded,
        DoseState.due => Icons.notifications_active_rounded,
        DoseState.upcoming => Icons.schedule_rounded,
        DoseState.skipped => Icons.remove_circle_outline_rounded,
      };
}

String weekdayShort(AppLocalizations l, int weekday) => switch (weekday) {
      DateTime.monday => l.weekdayShort1,
      DateTime.tuesday => l.weekdayShort2,
      DateTime.wednesday => l.weekdayShort3,
      DateTime.thursday => l.weekdayShort4,
      DateTime.friday => l.weekdayShort5,
      DateTime.saturday => l.weekdayShort6,
      _ => l.weekdayShort7,
    };

String formatTime(BuildContext context, DateTime t) =>
    DateFormat.jm(Localizations.localeOf(context).toLanguageTag()).format(t);

String formatDoseTime(BuildContext context, DoseTime t) => formatTime(context, t.on(DateTime(2000)));
