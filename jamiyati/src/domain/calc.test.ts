import { describe, expect, it } from 'vitest';
import { addMonths, addPeriods, diffDays } from './dates';
import {
  assignByRequests,
  buildSchedule,
  canPostpone,
  cellStatus,
  collectionRate,
  completionDate,
  currentCycleIndex,
  durationDays,
  endDate,
  finalSettlement,
  memberDuePerCycle,
  memberLedger,
  memberPayoutCycles,
  monthlyEquivalent,
  payoutSplit,
  potAmount,
  reliability,
  badges,
  reminderFor,
  seededShuffle,
  suitability,
  validateShares,
  withdrawalSettlement,
} from './calc';
import type { Payment, Payout, Share } from './types';

const base = { startDate: '2026-01-31', frequency: 'monthly' as const, sharesCount: 10, graceDays: 3, postponements: [] };

const pay = (memberId: string, cycleIndex: number, amount: number, paidAt: string, status: Payment['status'] = 'confirmed'): Payment => ({
  id: `${memberId}-${cycleIndex}-${amount}-${paidAt}`,
  circleId: 'c',
  cycleIndex,
  memberId,
  amount,
  method: 'bank',
  status,
  paidAt,
  submittedBy: memberId,
  submittedAt: paidAt,
});

describe('التواريخ', () => {
  it('الشهري يثبت اليوم الأصلي ويقص لنهاية الشهر', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // سنة كبيسة
    expect(addPeriods('2026-01-31', 'monthly', 2)).toBe('2026-03-31'); // لا يتراكم القص
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15'); // عبور السنة
  });

  it('الأسبوعي كل 7 أيام', () => {
    expect(addPeriods('2026-12-28', 'weekly', 1)).toBe('2027-01-04');
    expect(addPeriods('2026-01-01', 'weekly', 52)).toBe('2026-12-31');
  });

  it('النصف شهري: يوم البداية ثم +15', () => {
    expect([0, 1, 2, 3].map((n) => addPeriods('2026-01-01', 'biweekly', n))).toEqual([
      '2026-01-01',
      '2026-01-16',
      '2026-02-01',
      '2026-02-16',
    ]);
    expect(addPeriods('2026-01-20', 'biweekly', 1)).toBe('2026-02-04');
  });

  it('يبني الجدول ويحسب المدة ونهاية الجمعية', () => {
    const s = buildSchedule(base);
    expect(s).toHaveLength(10);
    expect(s[1].dueDate).toBe('2026-02-28');
    expect(s[1].lateAfter).toBe('2026-03-03');
    expect(endDate(base)).toBe('2026-10-31');
    expect(durationDays(base)).toBe(diffDays('2026-01-31', '2026-10-31'));
  });

  it('الدورة الحالية', () => {
    const s = buildSchedule({ ...base, startDate: '2026-01-01' });
    expect(currentCycleIndex(s, '2025-12-31')).toBe(-1);
    expect(currentCycleIndex(s, '2026-01-01')).toBe(0);
    expect(currentCycleIndex(s, '2026-03-15')).toBe(2);
    expect(currentCycleIndex(s, '2030-01-01')).toBe(9);
  });
});

describe('التأجيل', () => {
  it('تأجيل دورة يزيح الدورة وما بعدها فترة واحدة فقط', () => {
    const c = { ...base, startDate: '2026-01-01', postponements: [{ beforeCycle: 2, reason: 'رمضان', at: '' }] };
    const s = buildSchedule(c);
    expect(s[0].dueDate).toBe('2026-01-01');
    expect(s[1].dueDate).toBe('2026-02-01');
    expect(s[2].dueDate).toBe('2026-04-01'); // قفز مارس
    expect(s[9].dueDate).toBe('2026-11-01');
    expect(s[2].postponedBy).toBe(1);
  });

  it('تأجيلان يتراكمان', () => {
    const c = {
      ...base,
      startDate: '2026-01-01',
      postponements: [
        { beforeCycle: 2, reason: '', at: '' },
        { beforeCycle: 5, reason: '', at: '' },
      ],
    };
    const s = buildSchedule(c);
    expect(s[4].dueDate).toBe('2026-06-01');
    expect(s[5].dueDate).toBe('2026-08-01');
    expect(endDate(c)).toBe('2026-12-01');
  });

  it('لا يمكن تأجيل دورة حل موعدها', () => {
    const s = buildSchedule({ ...base, startDate: '2026-01-01' });
    expect(canPostpone(s, 1, '2026-02-01')).toBe(false);
    expect(canPostpone(s, 2, '2026-02-10')).toBe(true);
    expect(canPostpone(s, 99, '2026-02-10')).toBe(false);
  });
});

describe('الأسهم ونصف السهم', () => {
  const shares: Share[] = [
    { id: 's1', circleId: 'c', position: 1, holders: [{ memberId: 'a', fraction: 1 }] },
    { id: 's2', circleId: 'c', position: 2, holders: [{ memberId: 'b', fraction: 0.5 }, { memberId: 'c', fraction: 0.5 }] },
    { id: 's3', circleId: 'c', position: 3, holders: [{ memberId: 'a', fraction: 1 }] },
  ];

  it('مبلغ الاستلام = القسط × عدد الأسهم', () => {
    expect(potAmount({ installment: 1000, sharesCount: 10 })).toBe(10000);
  });

  it('قسط العضو حسب عدد أسهمه', () => {
    expect(memberDuePerCycle('a', shares, 1000)).toBe(2000);
    expect(memberDuePerCycle('b', shares, 1000)).toBe(500);
    expect(memberDuePerCycle('z', shares, 1000)).toBe(0);
  });

  it('نصف السهم يقتسم الاستلام', () => {
    expect(payoutSplit(shares[1], 3000)).toEqual([
      { memberId: 'b', amount: 1500 },
      { memberId: 'c', amount: 1500 },
    ]);
  });

  it('أدوار صاحب السهمين', () => {
    expect(memberPayoutCycles('a', shares, 3000).map((x) => x.cycleIndex)).toEqual([0, 2]);
  });

  it('مجموع ما يدفعه نصف السهم = ما يستلمه (بلا فوائد)', () => {
    const c = { installment: 1000, sharesCount: 3 };
    const sched = buildSchedule({ ...base, sharesCount: 3 });
    const l = memberLedger({ memberId: 'b', circle: c, shares, schedule: sched, payments: [], payouts: [], today: '2020-01-01' });
    expect(l.totalCommitment).toBe(1500);
    expect(l.expectedToReceive).toBe(1500);
  });

  it('التحقق من اكتمال الأسهم', () => {
    expect(validateShares(shares, 3)).toEqual([]);
    const bad: Share[] = [{ id: 'x', circleId: 'c', position: 1, holders: [{ memberId: 'a', fraction: 0.5 }] }];
    expect(validateShares(bad, 1)).toHaveLength(1);
    expect(validateShares([...shares, { ...shares[0], id: 'dup' }], 4).some((e) => e.includes('تكرار'))).toBe(true);
  });
});

describe('حالة الدفعات', () => {
  const cycle = buildSchedule({ ...base, startDate: '2026-03-01' })[0]; // due 03-01, lateAfter 03-04

  it('الألوان حسب الحالة', () => {
    expect(cellStatus(1000, [], cycle, '2026-02-20').status).toBe('upcoming');
    expect(cellStatus(1000, [], cycle, '2026-03-02').status).toBe('due');
    expect(cellStatus(1000, [], cycle, '2026-03-04').status).toBe('due'); // آخر يوم سماح
    expect(cellStatus(1000, [], cycle, '2026-03-05').status).toBe('late');
    expect(cellStatus(1000, [pay('a', 0, 1000, '2026-03-01', 'pending')], cycle, '2026-03-10').status).toBe('pending');
    expect(cellStatus(1000, [pay('a', 0, 1000, '2026-03-01')], cycle, '2026-03-10').status).toBe('paid');
  });

  it('الدفع الجزئي', () => {
    const info = cellStatus(1000, [pay('a', 0, 400, '2026-03-01')], cycle, '2026-03-02');
    expect(info.status).toBe('partial');
    expect(info.remaining).toBe(600);
    expect(cellStatus(1000, [pay('a', 0, 400, '2026-03-01')], cycle, '2026-03-06').status).toBe('late');
    expect(cellStatus(1000, [pay('a', 0, 400, '2026-03-01'), pay('a', 0, 600, '2026-03-02')], cycle, '2026-03-06').status).toBe('paid');
  });

  it('الدفعات المرفوضة والملغاة لا تُحتسب', () => {
    const info = cellStatus(1000, [pay('a', 0, 1000, '2026-03-01', 'rejected'), pay('a', 0, 1000, '2026-03-01', 'voided')], cycle, '2026-03-02');
    expect(info.confirmed).toBe(0);
    expect(info.status).toBe('due');
  });

  it('نسبة التحصيل لا تحتسب الزيادة', () => {
    expect(collectionRate([1000, 1000], [1500, 0])).toBe(50);
    expect(collectionRate([], [])).toBe(0);
  });
});

describe('الانسحاب', () => {
  it('قبل الاستلام: يُرد له ما دفعه ويحل البديل محله', () => {
    const r = withdrawalSettlement(3000, 0, 10000);
    expect(r.phase).toBe('before_payout');
    expect(r.refundToMember).toBe(3000);
    expect(r.replacementCatchUp).toBe(3000);
    expect(r.canBeReplaced).toBe(true);
    expect(r.owedByMember).toBe(0);
  });

  it('بعد الاستلام: يبقى ملتزماً بالفرق', () => {
    const r = withdrawalSettlement(3000, 10000, 10000);
    expect(r.phase).toBe('after_payout');
    expect(r.owedByMember).toBe(7000);
    expect(r.refundToMember).toBe(0);
    expect(r.canBeReplaced).toBe(false);
  });

  it('نصف سهم استلم وانسحب', () => {
    expect(withdrawalSettlement(1500, 5000, 5000).owedByMember).toBe(3500);
  });
});

describe('الإنهاء المبكر والتسوية', () => {
  it('التسوية متوازنة: المحتجز + ما على الأعضاء = ما للأعضاء', () => {
    // 3 أعضاء، قسط 1000، دفعوا دورتين، استلم a في الدورة 1 فقط (3000)
    const payments = ['a', 'b', 'c'].flatMap((m) => [pay(m, 0, 1000, '2026-01-01'), pay(m, 1, 1000, '2026-02-01')]);
    const payouts: Payout[] = [
      { id: 'p', circleId: 'c', cycleIndex: 0, shareId: 's1', memberId: 'a', amount: 3000, deliveredAt: '2026-01-02', deliveredBy: 'o', method: 'cash' },
    ];
    const s = finalSettlement(['a', 'b', 'c'], payments, payouts);
    expect(s.lines.find((l) => l.memberId === 'a')!.net).toBe(-1000);
    expect(s.lines.find((l) => l.memberId === 'b')!.net).toBe(2000);
    expect(s.heldByOrganizer).toBe(3000); // دورة 2 لم تُسلّم
    expect(s.totalOwedToMembers).toBe(4000);
    expect(s.totalOwedByMembers).toBe(1000);
    expect(s.balanced).toBe(true);
  });
});

describe('سجل الالتزام', () => {
  const items = [
    { dueDate: '2026-01-01', lateAfter: '2026-01-04', due: 1000, payments: [{ amount: 1000, paidAt: '2026-01-01' }] },
    { dueDate: '2026-02-01', lateAfter: '2026-02-04', due: 1000, payments: [{ amount: 500, paidAt: '2026-02-01' }, { amount: 500, paidAt: '2026-02-11' }] },
    { dueDate: '2026-03-01', lateAfter: '2026-03-04', due: 1000, payments: [] },
    { dueDate: '2026-04-01', lateAfter: '2026-04-04', due: 1000, payments: [] }, // لم ينته سماحها بعد
  ];

  it('يحسب نسبة الالتزام ومتوسط التأخير', () => {
    const s = reliability(items, '2026-03-11', 1);
    expect(s.cyclesDue).toBe(3);
    expect(s.onTime).toBe(1);
    expect(s.unpaid).toBe(1);
    expect(s.onTimeRate).toBe(33.33);
    expect(s.avgDelayDays).toBe(round((10 + 10) / 3));
  });

  it('يوم اكتمال الدفع الجزئي', () => {
    expect(completionDate(1000, items[1].payments)).toBe('2026-02-11');
    expect(completionDate(1000, [])).toBeUndefined();
  });

  it('الشارات', () => {
    const perfect = reliability(items.slice(0, 1).concat(items.slice(0, 1), items.slice(0, 1)), '2026-03-11', 5);
    expect(badges(perfect)).toContain('committed100');
    expect(badges(perfect)).toContain('completed5');
    expect(badges(reliability([], '2026-01-01', 0))).toEqual(['newcomer']);
  });
});

describe('القرعة والترتيب', () => {
  it('القرعة قابلة للتحقق: نفس البذرة = نفس النتيجة', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `s${i}`);
    const a = seededShuffle(ids, 12345);
    expect(seededShuffle(ids, 12345)).toEqual(a);
    expect([...a].sort()).toEqual([...ids].sort());
    expect(seededShuffle(ids, 54321)).not.toEqual(a);
  });

  it('أولوية الطلب: الأسبق يأخذ الدور المطلوب والباقي الأقرب', () => {
    const r = assignByRequests(
      [
        { shareId: 'x', requestedAt: '2026-01-02', requestedPosition: 1 },
        { shareId: 'y', requestedAt: '2026-01-01', requestedPosition: 1 },
        { shareId: 'z' },
      ],
      3,
    );
    expect(r).toEqual({ y: 1, x: 2, z: 3 });
  });
});

describe('الميزانية', () => {
  it('الالتزام الشهري المكافئ', () => {
    expect(monthlyEquivalent(1000, 'monthly')).toBe(1000);
    expect(monthlyEquivalent(500, 'biweekly')).toBe(1000);
    expect(monthlyEquivalent(100, 'weekly')).toBe(433.33);
  });

  it('حاسبة الملاءمة', () => {
    expect(suitability(10000, 6000, 1000, 1000)).toMatchObject({ surplus: 3000, recommendedMax: 1500, verdict: 'good' });
    expect(suitability(10000, 6000, 1000, 2000).verdict).toBe('tight');
    expect(suitability(10000, 9000, 1000, 500).verdict).toBe('no');
  });
});

describe('التذكيرات', () => {
  const cy = buildSchedule({ ...base, startDate: '2026-03-10' })[0];
  it('قبل 3 أيام، ويوم الاستحقاق، وبعد التأخير', () => {
    expect(reminderFor(cy, '2026-03-07', false)).toBe('before3');
    expect(reminderFor(cy, '2026-03-10', false)).toBe('dueDay');
    expect(reminderFor(cy, '2026-03-12', false)).toBeNull(); // ضمن السماح
    expect(reminderFor(cy, '2026-03-14', false)).toBe('late');
    expect(reminderFor(cy, '2026-03-14', true)).toBeNull();
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
