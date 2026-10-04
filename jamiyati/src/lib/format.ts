import { getLang } from './i18n';
import { getDB } from '../store/db';
import { parseISODate } from '../domain/dates';
import type { Frequency, PaymentMethod } from '../domain/types';
import { L } from './i18n';

function locale(): string {
  const { digits } = getDB().settings;
  const base = getLang() === 'ar' ? 'ar' : 'en';
  return `${base}-u-nu-${digits}`;
}

export const CURRENCIES: { code: string; ar: string; en: string }[] = [
  { code: 'SAR', ar: 'ريال سعودي', en: 'Saudi Riyal' },
  { code: 'EGP', ar: 'جنيه مصري', en: 'Egyptian Pound' },
  { code: 'AED', ar: 'درهم إماراتي', en: 'UAE Dirham' },
  { code: 'KWD', ar: 'دينار كويتي', en: 'Kuwaiti Dinar' },
  { code: 'QAR', ar: 'ريال قطري', en: 'Qatari Riyal' },
  { code: 'BHD', ar: 'دينار بحريني', en: 'Bahraini Dinar' },
  { code: 'OMR', ar: 'ريال عماني', en: 'Omani Rial' },
  { code: 'JOD', ar: 'دينار أردني', en: 'Jordanian Dinar' },
  { code: 'SYP', ar: 'ليرة سورية', en: 'Syrian Pound' },
  { code: 'LBP', ar: 'ليرة لبنانية', en: 'Lebanese Pound' },
  { code: 'USD', ar: 'دولار أمريكي', en: 'US Dollar' },
];

const SYMBOL_AR: Record<string, string> = {
  SAR: 'ر.س', EGP: 'ج.م', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', SYP: 'ل.س', LBP: 'ل.ل', USD: '$',
};

export function num(n: number, maxFrac = 2): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: maxFrac }).format(n);
}

export function money(n: number, currency: string): string {
  const v = num(n);
  if (getLang() === 'ar') return `${v} ${SYMBOL_AR[currency] ?? currency}`;
  return `${currency} ${v}`;
}

function fmt(iso: string, calendar: 'gregory' | 'islamic-umalqura', opts: Intl.DateTimeFormatOptions) {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat(`${locale()}-ca-${calendar}`, { timeZone: 'UTC', ...opts }).format(d);
}

/** تاريخ حسب اختيار المستخدم: ميلادي، هجري، أو كلاهما */
export function date(iso: string, style: 'short' | 'long' = 'short'): string {
  if (!iso) return '';
  const { calendar } = getDB().settings;
  const opts: Intl.DateTimeFormatOptions =
    style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' } : { day: 'numeric', month: 'short', year: 'numeric' };
  const g = fmt(iso, 'gregory', opts);
  if (calendar === 'gregory') return g;
  const h = fmt(iso, 'islamic-umalqura', opts);
  return calendar === 'islamic' ? h : `${g} (${h})`;
}

export function monthTitle(iso: string, calendar: 'gregory' | 'islamic-umalqura' = 'gregory') {
  return fmt(iso, calendar, { month: 'long', year: 'numeric' });
}

export function dayNum(iso: string, calendar: 'gregory' | 'islamic-umalqura' = 'gregory') {
  return fmt(iso, calendar, { day: 'numeric' });
}

export function dateTime(isoFull: string): string {
  const d = new Date(isoFull);
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function relDays(n: number): string {
  if (n === 0) return L('اليوم', 'today');
  if (n === 1) return L('غداً', 'tomorrow');
  if (n === -1) return L('أمس', 'yesterday');
  if (n > 0) return L(`بعد ${num(n)} ${n <= 10 ? 'أيام' : 'يوماً'}`, `in ${n} days`);
  return L(`منذ ${num(-n)} ${-n <= 10 ? 'أيام' : 'يوماً'}`, `${-n} days ago`);
}

export const freqLabel = (f: Frequency) =>
  ({ weekly: L('أسبوعي', 'Weekly'), biweekly: L('نصف شهري', 'Semi-monthly'), monthly: L('شهري', 'Monthly') })[f];

export const methodLabel = (m?: PaymentMethod) =>
  m ? ({ bank: L('تحويل بنكي', 'Bank transfer'), wallet: L('محفظة إلكترونية', 'E-wallet'), cash: L('نقداً', 'Cash'), other: L('أخرى', 'Other') })[m] : '—';

export const unitsLabel = (u: number) => {
  if (u === 0.5) return L('نصف سهم', 'Half share');
  if (u === 1) return L('سهم', '1 share');
  if (u === 2) return L('سهمان', '2 shares');
  return L(`${num(u)} أسهم`, `${u} shares`);
};

/** يخفي الجوال جزئياً: 9665****1234 */
export const maskPhone = (p: string) => (p.length > 6 ? p.slice(0, 4) + '•••' + p.slice(-3) : '•••');

export const displayPhone = (p: string) => '+' + p;
