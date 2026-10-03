/**
 * Pure credit rules (mirrors app/lib/features/credits/application/credit_ledger.dart).
 * Firestore transactions in jobs.ts apply these atomically.
 */
export const PRO_WEEKLY_FAIR_USE = 60;
export const FREE_TRIAL_CREDITS = 2;
export const REFERRAL_REWARD = 5;

export const PRODUCT_CREDITS: Record<string, number> = {
  credits_10: 10,
  credits_30: 30,
  credits_80: 80,
};

export interface UserCredits {
  credits: number;
  proUntil: number | null; // epoch ms
  proUsedWeek: number;
  proWeekStart: number | null;
}

export type ChargeDecision =
  | { ok: true; mode: 'pro' | 'credits'; next: UserCredits; watermarked: boolean }
  | { ok: false; reason: 'insufficient_credits' | 'fair_use_exceeded' };

const WEEK = 7 * 24 * 3600 * 1000;

export function decideCharge(u: UserCredits, cost: number, now: number): ChargeDecision {
  if (!Number.isInteger(cost) || cost <= 0) throw new Error('cost must be a positive integer');
  const isPro = u.proUntil !== null && u.proUntil > now;
  if (isPro) {
    const weekFresh = u.proWeekStart === null || now - u.proWeekStart >= WEEK;
    const used = weekFresh ? 0 : u.proUsedWeek;
    if (used + cost > PRO_WEEKLY_FAIR_USE) return { ok: false, reason: 'fair_use_exceeded' };
    return {
      ok: true,
      mode: 'pro',
      watermarked: false,
      next: { ...u, proUsedWeek: used + cost, proWeekStart: weekFresh ? now : u.proWeekStart },
    };
  }
  if (u.credits < cost) return { ok: false, reason: 'insufficient_credits' };
  return { ok: true, mode: 'credits', watermarked: true, next: { ...u, credits: u.credits - cost } };
}

export function refundOf(u: UserCredits, mode: 'pro' | 'credits', cost: number): UserCredits {
  return mode === 'pro'
    ? { ...u, proUsedWeek: Math.max(0, u.proUsedWeek - cost) }
    : { ...u, credits: u.credits + cost };
}
