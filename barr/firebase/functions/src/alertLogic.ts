/**
 * Pure alert rules (mirrors lib/features/dashboard/domain/alert_engine.dart
 * and lib/features/medications/domain/dose_schedule.dart). Times are the
 * parent's LOCAL wall-clock time, expressed as minutes since midnight.
 */

export const MISSED_AFTER_MIN = 30;
export const CHECKIN_ESCALATION_MIN = 120;
/** Scheduler period; each rule fires in exactly one run. */
export const RUN_EVERY_MIN = 5;

export interface LocalNow {
  /** yyyyMMdd */
  day: string;
  /** 1 = Monday … 7 = Sunday (Dart's DateTime.weekday). */
  weekday: number;
  minutes: number;
}

export interface MedicationDoc {
  id: string;
  name: string;
  times: string[]; // "HHmm"
  weekdays?: number[];
  startDate?: string; // yyyyMMdd
  endDate?: string | null;
  active?: boolean;
}

export interface DueDose {
  doseId: string;
  medId: string;
  medName: string;
  time: string;
}

export function localNow(date: Date, timeZone: string): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    day: `${parts.year}${parts.month}${parts.day}`,
    weekday: weekdays[parts.weekday as string] ?? 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function hmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function isDueOn(med: MedicationDoc, now: LocalNow): boolean {
  if (med.active === false) return false;
  if (med.startDate && now.day < med.startDate) return false;
  if (med.endDate && now.day > med.endDate) return false;
  const days = med.weekdays ?? [];
  return days.length === 0 || days.includes(now.weekday);
}

export const doseId = (day: string, medId: string, time: string) => `${day}_${medId}_${time}`;

/** True if [targetMin] falls in this run's window (now-period, now]. */
export function crossedNow(targetMin: number, nowMin: number, period = RUN_EVERY_MIN): boolean {
  return targetMin <= nowMin && targetMin > nowMin - period;
}

/** Doses whose 30-minute confirmation window ended during this run. */
export function newlyMissedDoses(
  meds: MedicationDoc[],
  takenOrSkipped: Set<string>,
  now: LocalNow,
): DueDose[] {
  const out: DueDose[] = [];
  for (const med of meds) {
    if (!isDueOn(med, now)) continue;
    for (const t of med.times ?? []) {
      const at = hmToMinutes(t);
      if (at === null) continue;
      const id = doseId(now.day, med.id, t);
      if (takenOrSkipped.has(id)) continue;
      if (crossedNow(at + MISSED_AFTER_MIN, now.minutes)) {
        out.push({ doseId: id, medId: med.id, medName: med.name, time: t });
      }
    }
  }
  return out;
}

export type CheckinAlert = "first" | "escalated" | null;

export function checkinAlert(deadlineHm: string, checkedInToday: boolean, now: LocalNow): CheckinAlert {
  if (checkedInToday) return null;
  const deadline = hmToMinutes(deadlineHm) ?? 600;
  if (crossedNow(deadline, now.minutes)) return "first";
  if (crossedNow(deadline + CHECKIN_ESCALATION_MIN, now.minutes)) return "escalated";
  return null;
}

/** Counts for the evening summary ("تناول بابا 4 من 4 أدوية اليوم"). */
export function dailyCounts(meds: MedicationDoc[], taken: Set<string>, now: LocalNow) {
  let total = 0;
  let done = 0;
  for (const med of meds) {
    if (!isDueOn(med, now)) continue;
    for (const t of med.times ?? []) {
      total++;
      if (taken.has(doseId(now.day, med.id, t))) done++;
    }
  }
  return { total, taken: done };
}
