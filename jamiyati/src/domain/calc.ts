// كل الحسابات المالية للجمعية — دوال نقية بلا آثار جانبية، ومختبرة في calc.test.ts
import { addDays, addPeriods, diffDays, cyclesPerMonth } from './dates';
import type { Circle, Member, Payment, Payout, Share } from './types';

/** تقريب للهللات/القروش لتجنب أخطاء الفاصلة العائمة */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ───────────────────────── الجدول الزمني ─────────────────────────

export interface Cycle {
  index: number; // يبدأ من 0
  dueDate: string; // يوم الاستحقاق
  lateAfter: string; // آخر يوم في مهلة السماح؛ بعده يُعتبر متأخراً
  slot: number; // رقم الفترة الفعلي بعد احتساب التأجيلات
  postponedBy: number;
}

type ScheduleInput = Pick<Circle, 'startDate' | 'frequency' | 'sharesCount' | 'graceDays' | 'postponements'>;

/** عدد الدورات = عدد الأسهم (كل سهم يستلم مرة واحدة) */
export function cycleCount(c: Pick<Circle, 'sharesCount'>): number {
  return c.sharesCount;
}

/** مبلغ الاستلام في كل دورة = القسط × عدد الأسهم */
export function potAmount(c: Pick<Circle, 'installment' | 'sharesCount'>): number {
  return round2(c.installment * c.sharesCount);
}

/** مجموع ما يدفعه صاحب السهم الكامل طوال الجمعية (= مبلغ الاستلام، بلا فوائد) */
export function totalCommitmentPerShare(c: Pick<Circle, 'installment' | 'sharesCount'>): number {
  return potAmount(c);
}

export function buildSchedule(c: ScheduleInput): Cycle[] {
  const n = cycleCount(c);
  const out: Cycle[] = [];
  for (let i = 0; i < n; i++) {
    const postponedBy = c.postponements.filter((p) => p.beforeCycle <= i).length;
    const slot = i + postponedBy;
    const dueDate = addPeriods(c.startDate, c.frequency, slot);
    out.push({ index: i, dueDate, lateAfter: addDays(dueDate, c.graceDays), slot, postponedBy });
  }
  return out;
}

export function endDate(c: ScheduleInput): string {
  const s = buildSchedule(c);
  return s.length ? s[s.length - 1].dueDate : c.startDate;
}

/** مدة الجمعية بالأيام من أول استحقاق لآخره */
export function durationDays(c: ScheduleInput): number {
  return diffDays(c.startDate, endDate(c));
}

/**
 * الدورة الحالية = آخر دورة حلّ موعدها (dueDate <= اليوم).
 * قبل بداية الجمعية تُرجع -1، وبعد آخر دورة تبقى على الأخيرة.
 */
export function currentCycleIndex(schedule: Cycle[], today: string): number {
  let idx = -1;
  for (const cy of schedule) if (cy.dueDate <= today) idx = cy.index;
  return idx;
}

/** يتحقق من صلاحية التأجيل: لا يمكن تأجيل دورة حلّ موعدها */
export function canPostpone(schedule: Cycle[], beforeCycle: number, today: string): boolean {
  const cy = schedule[beforeCycle];
  return !!cy && cy.dueDate > today;
}

// ───────────────────────── الأسهم وأنصاف الأسهم ─────────────────────────

/** حصة العضو من الأسهم (2 = سهمان، 0.5 = نصف سهم) */
export function memberShareUnits(memberId: string, shares: Share[]): number {
  let units = 0;
  for (const s of shares) for (const h of s.holders) if (h.memberId === memberId) units += h.fraction;
  return units;
}

/** القسط المستحق على العضو في كل دورة */
export function memberDuePerCycle(memberId: string, shares: Share[], installment: number): number {
  return round2(memberShareUnits(memberId, shares) * installment);
}

export function shareForCycle(shares: Share[], cycleIndex: number): Share | undefined {
  return shares.find((s) => s.position === cycleIndex + 1);
}

/** المستلمون في دورة معينة ومبلغ كل منهم (نصف السهم يقسم المبلغ) */
export function payoutSplit(share: Share | undefined, pot: number): { memberId: string; amount: number }[] {
  if (!share) return [];
  return share.holders.map((h) => ({ memberId: h.memberId, amount: round2(pot * h.fraction) }));
}

/** دورات استلام العضو مع المبلغ */
export function memberPayoutCycles(memberId: string, shares: Share[], pot: number): { cycleIndex: number; amount: number; shareId: string }[] {
  return shares
    .filter((s) => s.position > 0 && s.holders.some((h) => h.memberId === memberId))
    .map((s) => ({
      cycleIndex: s.position - 1,
      shareId: s.id,
      amount: round2(pot * s.holders.find((h) => h.memberId === memberId)!.fraction),
    }))
    .sort((a, b) => a.cycleIndex - b.cycleIndex);
}

/** التحقق من أن كل الأسهم مكتملة (مجموع الكسور = 1) وعددها يطابق الجمعية */
export function validateShares(shares: Share[], sharesCount: number): string[] {
  const errors: string[] = [];
  if (shares.length !== sharesCount) errors.push(`عدد الأسهم ${shares.length} لا يساوي ${sharesCount}`);
  for (const s of shares) {
    const sum = round2(s.holders.reduce((a, h) => a + h.fraction, 0));
    if (sum !== 1) errors.push(`السهم ${s.position || s.id} غير مكتمل (${sum})`);
  }
  const positions = shares.map((s) => s.position).filter((p) => p > 0);
  if (new Set(positions).size !== positions.length) errors.push('يوجد تكرار في ترتيب الاستلام');
  return errors;
}

// ───────────────────────── حالة الدفعات ─────────────────────────

export type CellStatus = 'paid' | 'pending' | 'partial' | 'late' | 'due' | 'upcoming' | 'none';

export interface CellInfo {
  status: CellStatus;
  due: number;
  confirmed: number;
  pending: number;
  remaining: number;
}

/**
 * حالة خانة (عضو × دورة) في شبكة الدفعات:
 * - paid: المؤكد يغطي المستحق (أخضر)
 * - pending: توجد دفعة بانتظار التأكيد (أصفر)
 * - late: انتهت مهلة السماح ولم يكتمل الدفع (أحمر)
 * - partial: دفع جزئي مؤكد والمهلة لم تنته
 * - due: حلّ الموعد وما زال ضمن المهلة
 * - upcoming: لم يحن موعده (رمادي)
 */
export function cellStatus(due: number, payments: Payment[], cycle: Cycle, today: string): CellInfo {
  const confirmed = round2(payments.filter((p) => p.status === 'confirmed').reduce((a, p) => a + p.amount, 0));
  const pending = round2(payments.filter((p) => p.status === 'pending').reduce((a, p) => a + p.amount, 0));
  const remaining = round2(Math.max(0, due - confirmed));
  let status: CellStatus;
  if (due <= 0) status = 'none';
  else if (confirmed >= due) status = 'paid';
  else if (pending > 0) status = 'pending';
  else if (today > cycle.lateAfter) status = 'late';
  else if (confirmed > 0) status = 'partial';
  else if (today >= cycle.dueDate) status = 'due';
  else status = 'upcoming';
  return { status, due, confirmed, pending, remaining };
}

/** نسبة التحصيل في دورة: المؤكد ÷ المستحق */
export function collectionRate(dues: number[], confirmed: number[]): number {
  const d = dues.reduce((a, b) => a + b, 0);
  if (d === 0) return 0;
  const c = confirmed.reduce((a, b, i) => a + Math.min(b, dues[i]), 0);
  return round2((c / d) * 100);
}

// ───────────────────────── دفتر العضو ─────────────────────────

export interface Ledger {
  units: number;
  duePerCycle: number;
  totalCommitment: number; // كل ما عليه طوال الجمعية
  paid: number; // المؤكد
  received: number; // ما استلمه
  dueToDate: number; // ما كان يجب دفعه حتى الآن
  arrears: number; // المتأخرات
  remainingToPay: number; // ما تبقى عليه حتى نهاية الجمعية
  expectedToReceive: number; // ما سيستلمه ولم يستلمه بعد
}

export function memberLedger(args: {
  memberId: string;
  circle: Pick<Circle, 'installment' | 'sharesCount'>;
  shares: Share[];
  schedule: Cycle[];
  payments: Payment[];
  payouts: Payout[];
  today: string;
  /** الدورات التي يُحتسب فيها العضو (للبديل: من دورة انضمامه فقط لا تهم لأنه يدفع ما فات) */
}): Ledger {
  const { memberId, circle, shares, schedule, payments, payouts, today } = args;
  const units = memberShareUnits(memberId, shares);
  const duePerCycle = round2(units * circle.installment);
  const totalCommitment = round2(duePerCycle * schedule.length);
  const paid = round2(
    payments.filter((p) => p.memberId === memberId && p.status === 'confirmed').reduce((a, p) => a + p.amount, 0),
  );
  const received = round2(payouts.filter((p) => p.memberId === memberId).reduce((a, p) => a + p.amount, 0));
  const lateCycles = schedule.filter((c) => c.lateAfter < today).length;
  const dueToDate = round2(duePerCycle * schedule.filter((c) => c.dueDate <= today).length);
  const mustHavePaid = round2(duePerCycle * lateCycles);
  const arrears = round2(Math.max(0, mustHavePaid - paid));
  const pot = potAmount(circle);
  const entitled = memberPayoutCycles(memberId, shares, pot).reduce((a, p) => a + p.amount, 0);
  return {
    units,
    duePerCycle,
    totalCommitment,
    paid,
    received,
    dueToDate,
    arrears,
    remainingToPay: round2(Math.max(0, totalCommitment - paid)),
    expectedToReceive: round2(Math.max(0, entitled - received)),
  };
}

// ───────────────────────── الانسحاب والاستبدال ─────────────────────────

export interface WithdrawalResult {
  phase: 'before_payout' | 'after_payout';
  /** يُرد للمنسحب (قبل الاستلام) */
  refundToMember: number;
  /** يبقى على المنسحب سداده (بعد الاستلام) */
  owedByMember: number;
  /** ما يدفعه البديل فوراً ليعادل ما دفعه المنسحب (ويذهب للمنسحب) */
  replacementCatchUp: number;
  canBeReplaced: boolean;
  explanation: string;
}

/**
 * قبل الاستلام: يُرد للعضو كل ما دفعه، إما من البديل (يدفع ما فات ويرث الدور) أو بالتسوية.
 * بعد الاستلام: يبقى العضو ملتزماً بسداد الفرق بين ما استلمه وما دفعه.
 */
export function withdrawalSettlement(paid: number, received: number, entitled: number): WithdrawalResult {
  paid = round2(paid);
  received = round2(received);
  if (received <= 0) {
    return {
      phase: 'before_payout',
      refundToMember: paid,
      owedByMember: 0,
      replacementCatchUp: paid,
      canBeReplaced: true,
      explanation: 'لم يستلم بعد: تُرد له دفعاته كاملة، ويدفع البديل نفس المبلغ ويرث دوره.',
    };
  }
  const owed = round2(Math.max(0, entitled - paid));
  const extra = round2(Math.max(0, paid - entitled));
  return {
    phase: 'after_payout',
    refundToMember: extra,
    owedByMember: owed,
    replacementCatchUp: 0,
    canBeReplaced: false,
    explanation: 'استلم دوره: يبقى ملتزماً بسداد باقي الأقساط حتى يتساوى ما دفعه مع ما استلمه.',
  };
}

// ───────────────────────── الإنهاء المبكر ─────────────────────────

export interface SettlementLine {
  memberId: string;
  paid: number;
  received: number;
  /** موجب = له مبلغ يُرد إليه، سالب = عليه مبلغ يدفعه */
  net: number;
}

export interface FinalSettlement {
  lines: SettlementLine[];
  totalPaid: number;
  totalReceived: number;
  /** المبالغ المحصّلة ولم تُسلّم (في عهدة المنظم) */
  heldByOrganizer: number;
  totalOwedToMembers: number;
  totalOwedByMembers: number;
  balanced: boolean;
}

/** التسوية النهائية عند إنهاء الجمعية مبكراً: كل عضو يسترد ما دفعه ناقص ما استلمه */
export function finalSettlement(memberIds: string[], payments: Payment[], payouts: Payout[]): FinalSettlement {
  const lines = memberIds.map((memberId) => {
    const paid = round2(payments.filter((p) => p.memberId === memberId && p.status === 'confirmed').reduce((a, p) => a + p.amount, 0));
    const received = round2(payouts.filter((p) => p.memberId === memberId).reduce((a, p) => a + p.amount, 0));
    return { memberId, paid, received, net: round2(paid - received) };
  });
  const totalPaid = round2(lines.reduce((a, l) => a + l.paid, 0));
  const totalReceived = round2(lines.reduce((a, l) => a + l.received, 0));
  const totalOwedToMembers = round2(lines.filter((l) => l.net > 0).reduce((a, l) => a + l.net, 0));
  const totalOwedByMembers = round2(-lines.filter((l) => l.net < 0).reduce((a, l) => a + l.net, 0));
  const heldByOrganizer = round2(totalPaid - totalReceived);
  return {
    lines,
    totalPaid,
    totalReceived,
    heldByOrganizer,
    totalOwedToMembers,
    totalOwedByMembers,
    // المحتجز + ما على الأعضاء = ما للأعضاء
    balanced: round2(heldByOrganizer + totalOwedByMembers) === totalOwedToMembers,
  };
}

// ───────────────────────── سجل الالتزام ─────────────────────────

export interface ReliabilityInput {
  dueDate: string;
  lateAfter: string;
  due: number;
  /** الدفعات المؤكدة لهذه الدورة */
  payments: { amount: number; paidAt: string }[];
}

export interface ReliabilityStats {
  cyclesDue: number;
  onTime: number;
  onTimeRate: number; // %
  avgDelayDays: number;
  unpaid: number;
  completedCircles: number;
}

/** يوم اكتمال سداد المستحق (أو undefined إن لم يكتمل) */
export function completionDate(due: number, payments: { amount: number; paidAt: string }[]): string | undefined {
  let sum = 0;
  for (const p of [...payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    sum = round2(sum + p.amount);
    if (sum >= due) return p.paidAt.slice(0, 10);
  }
  return undefined;
}

export function reliability(items: ReliabilityInput[], today: string, completedCircles: number): ReliabilityStats {
  const relevant = items.filter((i) => i.due > 0 && i.lateAfter < today);
  let onTime = 0;
  let delaySum = 0;
  let unpaid = 0;
  for (const i of relevant) {
    const done = completionDate(i.due, i.payments);
    if (!done) {
      unpaid++;
      delaySum += Math.max(0, diffDays(i.dueDate, today));
    } else if (done <= i.lateAfter) {
      onTime++;
    } else {
      delaySum += diffDays(i.dueDate, done);
    }
  }
  const n = relevant.length;
  return {
    cyclesDue: n,
    onTime,
    onTimeRate: n ? round2((onTime / n) * 100) : 100,
    avgDelayDays: n ? round2(delaySum / n) : 0,
    unpaid,
    completedCircles,
  };
}

export type Badge = 'committed100' | 'completed5' | 'completed1' | 'veteran' | 'newcomer';

export function badges(s: ReliabilityStats): Badge[] {
  const out: Badge[] = [];
  if (s.cyclesDue >= 3 && s.onTime === s.cyclesDue) out.push('committed100');
  if (s.completedCircles >= 5) out.push('completed5');
  else if (s.completedCircles >= 1) out.push('completed1');
  if (s.cyclesDue >= 24) out.push('veteran');
  if (s.cyclesDue === 0) out.push('newcomer');
  return out;
}

/** درجة من 100 للعرض السريع */
export function reliabilityScore(s: ReliabilityStats): number {
  if (s.cyclesDue === 0) return 0;
  const penalty = Math.min(30, s.avgDelayDays * 3) + s.unpaid * 10;
  return Math.max(0, Math.min(100, Math.round(s.onTimeRate - penalty + Math.min(10, s.completedCircles * 2))));
}

// ───────────────────────── الترتيب والقرعة ─────────────────────────

/** مولد أرقام عشوائية بذرة ثابتة — أي شخص يعيد القرعة بنفس البذرة يحصل على النتيجة نفسها */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** خلط فيشر-ييتس بذرة ثابتة. المدخلات تُرتب أولاً لضمان نتيجة قابلة للتحقق */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ترتيب حسب أولوية الطلب: الأسبق طلباً يحصل على الدور الذي طلبه إن كان متاحاً، وإلا أقرب دور متاح */
export function assignByRequests(
  requests: { shareId: string; requestedAt?: string; requestedPosition?: number }[],
  n: number,
): Record<string, number> {
  const sorted = [...requests].sort((a, b) => (a.requestedAt ?? '￿').localeCompare(b.requestedAt ?? '￿'));
  const taken = new Set<number>();
  const result: Record<string, number> = {};
  for (const r of sorted) {
    if (!r.requestedPosition) continue;
    let pos = r.requestedPosition;
    if (taken.has(pos)) {
      // أقرب دور متاح (يفضل الأقرب ثم الأبكر)
      let best = 0;
      for (let d = 1; d < n && !best; d++) {
        if (pos - d >= 1 && !taken.has(pos - d)) best = pos - d;
        else if (pos + d <= n && !taken.has(pos + d)) best = pos + d;
      }
      pos = best;
    }
    if (pos) {
      taken.add(pos);
      result[r.shareId] = pos;
    }
  }
  let next = 1;
  for (const r of sorted) {
    if (result[r.shareId]) continue;
    while (taken.has(next)) next++;
    result[r.shareId] = next;
    taken.add(next);
  }
  return result;
}

// ───────────────────────── الميزانية الشخصية ─────────────────────────

/** الالتزام الشهري التقريبي لقسط بدورية معينة */
export function monthlyEquivalent(amountPerCycle: number, f: Circle['frequency']): number {
  return round2(amountPerCycle * cyclesPerMonth(f));
}

export interface Suitability {
  surplus: number;
  recommendedMax: number;
  verdict: 'good' | 'tight' | 'no';
  ratio: number; // نسبة القسط من الفائض
}

/**
 * حاسبة "هل الجمعية مناسبة لي؟": الفائض = الدخل − المصاريف − الالتزامات.
 * القسط الآمن لا يتجاوز نصف الفائض الشهري (لترك هامش للطوارئ).
 */
export function suitability(income: number, expenses: number, commitments: number, monthlyInstallment: number): Suitability {
  const surplus = round2(income - expenses - commitments);
  const recommendedMax = round2(Math.max(0, surplus * 0.5));
  const ratio = surplus > 0 ? round2((monthlyInstallment / surplus) * 100) : Infinity;
  const verdict = surplus <= 0 || monthlyInstallment > surplus ? 'no' : monthlyInstallment <= recommendedMax ? 'good' : 'tight';
  return { surplus, recommendedMax, verdict, ratio };
}

// ───────────────────────── التذكيرات ─────────────────────────

export type ReminderKind = 'before3' | 'dueDay' | 'late';

/** نوع التذكير المناسب اليوم لدورة لم تُدفع (أو null) */
export function reminderFor(cycle: Cycle, today: string, paid: boolean): ReminderKind | null {
  if (paid) return null;
  const d = diffDays(today, cycle.dueDate);
  if (d === 3) return 'before3';
  if (d === 0) return 'dueDay';
  if (today > cycle.lateAfter) return 'late';
  return null;
}

/** ملخص الأعضاء النشطين فقط */
export function activeMembers(members: Member[]): Member[] {
  return members.filter((m) => m.status === 'active');
}
