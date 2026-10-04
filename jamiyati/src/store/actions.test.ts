// اختبارات تكامل لعمليات الأعمال على البيانات التجريبية
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../domain/dates';
import { getDB, setDB, verifyLog } from './db';
import { buildDemoDB } from './seed';
import * as A from './actions';
import { circleView, ledgerFor, myCircles, userReliability, cycleSummary } from './selectors';
import { finalSettlement, seededShuffle } from '../domain/calc';

const today = todayISO();
const friends = () => getDB().circles.find((c) => c.name === 'جمعية الأصدقاء')!;
const member = (name: string) => getDB().members.find((m) => m.circleId === friends().id && m.name === name)!;

beforeEach(() => setDB(buildDemoDB(today)));

describe('البيانات التجريبية', () => {
  it('جمعية 10 أعضاء، 1000 شهرياً، بدأت قبل 3 أشهر، فيها متأخر وطلب تبديل', () => {
    const v = circleView(getDB(), friends().id, today)!;
    expect(v.rows).toHaveLength(10);
    expect(v.pot).toBe(10000);
    expect(v.current).toBe(2);
    const late = v.rows.filter((r) => r.cells.some((c) => c.status === 'late')).map((r) => r.member.name);
    expect(late).toEqual(['خالد المطيري']);
    expect(getDB().swaps.filter((s) => s.status === 'open')).toHaveLength(1);
    expect(cycleSummary(v, 2).rate).toBeLessThan(100);
  });

  it('قرعة البيانات التجريبية قابلة للتحقق بالبذرة', () => {
    const c = friends();
    const ids = getDB().shares.filter((s) => s.circleId === c.id).map((s) => s.id).sort();
    expect(seededShuffle(ids, c.lottery!.seed)).toEqual(c.lottery!.result);
  });

  it('سلسلة سجل النشاط سليمة لكل جمعية', () => {
    for (const c of getDB().circles) expect(verifyLog(getDB().log.filter((e) => e.circleId === c.id))).toBe(-1);
  });

  it('أي تلاعب في السجل يُكتشف', () => {
    const entries = getDB().log.filter((e) => e.circleId === friends().id).map((e) => ({ ...e }));
    entries[2].message = 'تعديل مزور';
    expect(verifyLog(entries)).toBe(2);
  });

  it('لوحة المستخدم تجمع الجمعيات بأدوار مختلفة ونصف سهم', () => {
    const cards = myCircles(getDB(), getDB().currentUserId!, today);
    expect(cards.map((c) => c.role).sort()).toEqual(['member', 'member', 'organizer']);
    const fam = cards.find((c) => c.view.circle.name === 'جمعية العائلة')!;
    expect(fam.duePerCycle).toBe(125);
    expect(fam.myTurns[0].amount).toBe(1000);
    const fr = cards.find((c) => c.view.circle.name === 'جمعية الأصدقاء')!;
    expect(fr.next?.days).toBe(3);
  });

  it('سجل الالتزام للمستخدم', () => {
    const s = userReliability(getDB(), getDB().currentUserId!, today);
    expect(s.completedCircles).toBe(1);
    expect(s.onTimeRate).toBe(100);
  });
});

describe('الدفعات', () => {
  it('المنظم يؤكد أو يرفض مع السبب، ولا يُحذف بعد التأكيد', () => {
    const pending = getDB().payments.filter((p) => p.circleId === friends().id && p.status === 'pending');
    A.reviewPayment(pending[0].id, true);
    expect(() => A.reviewPayment(pending[1].id, false, '')).toThrow();
    A.reviewPayment(pending[1].id, false, 'المبلغ ناقص');
    const db = getDB();
    expect(db.payments.find((p) => p.id === pending[0].id)!.status).toBe('confirmed');
    expect(db.payments.find((p) => p.id === pending[0].id)!.receiptNo).toBeTruthy();
    A.voidPayment(pending[0].id, 'أُدخلت بالخطأ');
    expect(getDB().payments.find((p) => p.id === pending[0].id)!.status).toBe('voided');
    expect(getDB().log.some((e) => e.type === 'payment.void')).toBe(true);
  });

  it('المنظم يسجل دفعة نقدية جزئية فتُكمل المتأخر', () => {
    const k = member('خالد المطيري');
    A.submitPayment({ circleId: friends().id, memberId: k.id, cycleIndex: 2, amount: 700, method: 'cash', paidAt: today });
    const v = circleView(getDB(), friends().id, today)!;
    expect(v.rows.find((r) => r.member.id === k.id)!.cells[2].status).toBe('paid');
  });

  it('العضو لا يستطيع تسجيل دفعة غيره', () => {
    const omar = getDB().users.find((u) => u.name === 'عمر الدوسري')!;
    setDB({ ...getDB(), currentUserId: omar.id });
    expect(() => A.submitPayment({ circleId: friends().id, memberId: member('مريم العتيبي').id, cycleIndex: 3, amount: 1000, method: 'bank', paidAt: today, proofImage: 'x' })).toThrow();
  });
});

describe('التبديل', () => {
  it('موافقة المنظم تكمل التبديل وتعدل الترتيب', () => {
    const sw = getDB().swaps[0];
    A.answerSwap(sw.id, true);
    const db = getDB();
    expect(db.swaps[0].status).toBe('done');
    expect(db.shares.find((s) => s.id === sw.fromShareId)!.position).toBe(6);
    expect(db.shares.find((s) => s.id === sw.toShareId)!.position).toBe(9);
  });
  it('لا يمكن تبديل دور تم استلامه', () => {
    const shares = getDB().shares.filter((s) => s.circleId === friends().id);
    expect(() => A.requestSwap(shares.find((s) => s.position === 4)!.id, shares.find((s) => s.position === 1)!.id, '')).toThrow();
  });
});

describe('الانسحاب والبديل', () => {
  it('قبل الاستلام: البديل يرث الدور والدفعات السابقة', () => {
    const y = member('يوسف الحربي');
    const vBefore = circleView(getDB(), friends().id, today)!;
    const paidBefore = ledgerFor(getDB(), vBefore, y.id, today).paid;
    A.withdrawMember(y.id, { name: 'سلمان', phone: '966500000099' });
    const db = getDB();
    const r = db.members.find((m) => m.name === 'سلمان')!;
    const v = circleView(db, friends().id, today)!;
    expect(v.rows.some((row) => row.member.id === y.id)).toBe(false);
    expect(v.rows.find((row) => row.member.id === r.id)!.positions).toEqual([7]);
    expect(ledgerFor(db, v, r.id, today).paid).toBe(paidBefore);
    expect(db.log.some((e) => e.type === 'member.replace')).toBe(true);
  });

  it('بعد الاستلام: لا يُستبدل ويبقى ملتزماً', () => {
    const f = member('فاطمة الزهراني');
    expect(() => A.withdrawMember(f.id, { name: 'س', phone: '1' })).toThrow();
    A.withdrawMember(f.id);
    expect(getDB().log.at(-1)!.message).toContain('يبقى ملتزماً');
  });
});

describe('التأجيل والإنهاء', () => {
  it('تأجيل الدورة القادمة يزيح المواعيد شهراً', () => {
    const v0 = circleView(getDB(), friends().id, today)!;
    const before = v0.schedule[3].dueDate;
    A.postponeCycle(friends().id, 3, 'رمضان');
    const v = circleView(getDB(), friends().id, today)!;
    expect(v.schedule[3].dueDate > before).toBe(true);
    expect(v.schedule[2].dueDate).toBe(v0.schedule[2].dueDate);
    expect(() => A.postponeCycle(friends().id, 1, 'x')).toThrow();
  });

  it('الإنهاء المبكر بتسوية متوازنة', () => {
    A.terminateCircle(friends().id, 'اتفاق الأعضاء');
    const db = getDB();
    const ids = db.members.filter((m) => m.circleId === friends().id).map((m) => m.id);
    const s = finalSettlement(ids, db.payments.filter((p) => p.circleId === friends().id), db.payouts.filter((p) => p.circleId === friends().id));
    expect(s.balanced).toBe(true);
    expect(friends().status).toBe('terminated');
  });
});

describe('الإنشاء والقرعة', () => {
  it('ينشئ جمعية بنصف سهم ويجري القرعة ويبدأ', () => {
    A.updateSettings({ premium: true });
    const id = A.createCircle({
      name: 'تجربة', installment: 500, currency: 'EGP', frequency: 'biweekly', startDate: addDays(today, 10), graceDays: 2, sharesCount: 3, rules: '',
      organizerUnits: 1, members: [{ name: 'أ', phone: '201000000001', units: 1 }, { name: 'ب', phone: '201000000002', units: 0.5 }, { name: 'ج', phone: '201000000003', units: 0.5 }],
    });
    expect(() => A.startCircle(id)).toThrow(); // لا ترتيب بعد
    const r1 = A.runLottery(id, 777);
    const s = getDB().shares.filter((x) => x.circleId === id);
    expect(s).toHaveLength(3);
    expect(s.some((x) => x.holders.length === 2)).toBe(true);
    A.startCircle(id);
    expect(getDB().circles.find((c) => c.id === id)!.orderLocked).toBe(true);
    expect(() => A.runLottery(id, 1)).toThrow();
    expect(r1).toHaveLength(3);
  });

  it('حد الخطة المجانية', () => {
    A.updateSettings({ premium: false });
    A.createCircle({ name: 'ثانية', installment: 100, currency: 'SAR', frequency: 'monthly', startDate: today, graceDays: 0, sharesCount: 2, rules: '', organizerUnits: 1, members: [] });
    expect(() => A.createCircle({ name: 'ثالثة', installment: 100, currency: 'SAR', frequency: 'monthly', startDate: today, graceDays: 0, sharesCount: 2, rules: '', organizerUnits: 1, members: [] })).toThrow(/الخطة المجانية/);
  });
});
