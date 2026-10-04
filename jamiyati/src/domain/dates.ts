// حساب التواريخ التقويمية بصيغة "YYYY-MM-DD" بتوقيت UTC لتجنب مشاكل التوقيت الصيفي والمناطق الزمنية.
import type { Frequency } from './types';

export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  // التاريخ المحلي للمستخدم
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** يضيف أشهراً مع تثبيت اليوم الأصلي وقصّه لنهاية الشهر عند الحاجة (31 يناير ← 28/29 فبراير ← 31 مارس). */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const clamped = Math.min(day, daysInMonth(year, month0));
  return toISODate(new Date(Date.UTC(year, month0, clamped)));
}

/**
 * تاريخ الفترة رقم n (تبدأ من 0) بعد تاريخ البداية.
 * - أسبوعي: كل 7 أيام.
 * - نصف شهري: يوم البداية من كل شهر، ثم بعده بـ 15 يوماً (مثل 1 و16).
 * - شهري: نفس اليوم من كل شهر (مع القص لنهاية الشهر).
 * يُحسب دائماً من تاريخ البداية وليس بالتسلسل حتى لا يتراكم خطأ القص.
 */
export function addPeriods(start: string, frequency: Frequency, n: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(start, 7 * n);
    case 'biweekly': {
      const base = addMonths(start, Math.floor(n / 2));
      return n % 2 === 0 ? base : addDays(base, 15);
    }
    case 'monthly':
      return addMonths(start, n);
  }
}

/** الفرق بالأيام (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function periodsPerYear(f: Frequency): number {
  return f === 'weekly' ? 52 : f === 'biweekly' ? 24 : 12;
}

/** عدد الدورات التقريبي في الشهر لحساب الالتزام الشهري */
export function cyclesPerMonth(f: Frequency): number {
  return periodsPerYear(f) / 12;
}
