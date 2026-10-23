export const TZ = process.env.MAWQI_TZ || 'Asia/Riyadh';

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** YYYY-MM-DD in the company time zone. */
export const todayStr = (d = new Date()) => dateFmt.format(d);
/** HH:MM in the company time zone. */
export const nowTime = (d = new Date()) => timeFmt.format(d);

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const isFriday = (dateStr) => new Date(dateStr + 'T12:00:00Z').getUTCDay() === 5;

/** Daily cost of a worker; monthly wages are spread over 30 days. */
export const dailyRate = (w) => (w.wage_type === 'daily' ? w.wage : w.wage / 30);
/** Overtime is paid at 1.5x the hourly rate of an 8-hour day. */
export const overtimeRate = (w) => (dailyRate(w) / 8) * 1.5;

export const WORKING_STATUSES = ['present', 'late', 'overtime'];

export const round = (n) => Math.round(n * 100) / 100;
