// بيانات مشتقة للواجهة — تعتمد على دوال domain/calc النقية
import {
  buildSchedule,
  cellStatus,
  collectionRate,
  currentCycleIndex,
  memberDuePerCycle,
  memberLedger,
  memberPayoutCycles,
  monthlyEquivalent,
  potAmount,
  reliability,
  shareForCycle,
  type CellInfo,
  type Cycle,
  type ReliabilityInput,
} from '../domain/calc';
import { diffDays } from '../domain/dates';
import type { Circle, DB, Member, Payment, Role, Share } from '../domain/types';

export function roleIn(db: DB, circleId: string, userId?: string): Role | null {
  if (!userId) return null;
  const c = db.circles.find((x) => x.id === circleId);
  if (c?.organizerId === userId) return 'organizer';
  const m = db.members.find((x) => x.circleId === circleId && x.userId === userId && x.status === 'active');
  return m?.role ?? null;
}

export const canManage = (r: Role | null) => r === 'organizer';
export const canConfirm = (r: Role | null) => r === 'organizer' || r === 'assistant';

export function myMember(db: DB, circleId: string, userId?: string): Member | undefined {
  return db.members.find((m) => m.circleId === circleId && m.userId === userId && m.status === 'active')
    ?? db.members.find((m) => m.circleId === circleId && m.userId === userId);
}

/** العضو وكل من حلّ محلهم (لوراثة الدفعات عند الاستبدال) */
export function lineage(db: DB, memberId: string): string[] {
  const out = [memberId];
  let cur = db.members.find((m) => m.id === memberId);
  while (cur?.replacesMemberId) {
    out.push(cur.replacesMemberId);
    cur = db.members.find((m) => m.id === cur!.replacesMemberId);
  }
  return out;
}

export function paymentsFor(db: DB, circleId: string, memberId: string, cycleIndex?: number): Payment[] {
  const ids = new Set(lineage(db, memberId));
  return db.payments.filter(
    (p) => p.circleId === circleId && ids.has(p.memberId) && (cycleIndex === undefined || p.cycleIndex === cycleIndex),
  );
}

export interface GridRow {
  member: Member;
  units: number;
  due: number;
  positions: number[];
  cells: CellInfo[];
}

export interface CircleView {
  circle: Circle;
  members: Member[]; // كل الأعضاء بما فيهم المنسحبون
  holders: Member[]; // الأعضاء أصحاب الأسهم حالياً (صفوف الشبكة)
  shares: Share[];
  schedule: Cycle[];
  pot: number;
  current: number;
  rows: GridRow[];
  filledUnits: number;
}

export function circleView(db: DB, circleId: string, today: string): CircleView | null {
  const circle = db.circles.find((c) => c.id === circleId);
  if (!circle) return null;
  const members = db.members.filter((m) => m.circleId === circleId);
  const shares = db.shares.filter((s) => s.circleId === circleId).sort((a, b) => (a.position || 999) - (b.position || 999));
  const schedule = buildSchedule(circle);
  const pot = potAmount(circle);
  const holderIds = new Set(shares.flatMap((s) => s.holders.map((h) => h.memberId)));
  const holders = members
    .filter((m) => holderIds.has(m.id))
    .sort((a, b) => firstPos(a.id, shares) - firstPos(b.id, shares));
  const rows: GridRow[] = holders.map((member) => {
    const due = memberDuePerCycle(member.id, shares, circle.installment);
    const positions = shares.filter((s) => s.holders.some((h) => h.memberId === member.id)).map((s) => s.position);
    const pays = paymentsFor(db, circleId, member.id);
    const cells = schedule.map((cy) => cellStatus(due, pays.filter((p) => p.cycleIndex === cy.index), cy, today));
    return { member, units: due / circle.installment, due, positions, cells };
  });
  const filledUnits = shares.reduce((a, s) => a + s.holders.reduce((b, h) => b + h.fraction, 0), 0);
  return { circle, members, holders, shares, schedule, pot, current: currentCycleIndex(schedule, today), rows, filledUnits };
}

function firstPos(memberId: string, shares: Share[]) {
  const ps = shares.filter((s) => s.holders.some((h) => h.memberId === memberId)).map((s) => s.position || 999);
  return ps.length ? Math.min(...ps) : 999;
}

/** ملخص دورة للمنظم */
export function cycleSummary(v: CircleView, cycleIndex: number) {
  const cells = v.rows.map((r) => ({ member: r.member, cell: r.cells[cycleIndex] })).filter((x) => x.cell);
  const share = shareForCycle(v.shares, cycleIndex);
  const recipients = share ? share.holders.map((h) => v.members.find((m) => m.id === h.memberId)!).filter(Boolean) : [];
  return {
    paid: cells.filter((c) => c.cell.status === 'paid'),
    pending: cells.filter((c) => c.cell.status === 'pending'),
    late: cells.filter((c) => c.cell.status === 'late'),
    open: cells.filter((c) => ['due', 'partial', 'upcoming'].includes(c.cell.status)),
    rate: collectionRate(cells.map((c) => c.cell.due), cells.map((c) => c.cell.confirmed)),
    collected: cells.reduce((a, c) => a + c.cell.confirmed, 0),
    expected: cells.reduce((a, c) => a + c.cell.due, 0),
    recipients,
    share,
  };
}

export function ledgerFor(db: DB, v: CircleView, memberId: string, today: string) {
  const ids = new Set(lineage(db, memberId));
  return memberLedger({
    memberId,
    circle: v.circle,
    shares: v.shares,
    schedule: v.schedule,
    payments: db.payments.filter((p) => p.circleId === v.circle.id && ids.has(p.memberId)).map((p) => ({ ...p, memberId })),
    payouts: db.payouts.filter((p) => p.circleId === v.circle.id && ids.has(p.memberId)).map((p) => ({ ...p, memberId })),
    today,
  });
}

// ───────── لوحة المستخدم ─────────

export interface MyCircleCard {
  view: CircleView;
  member: Member;
  role: Role;
  duePerCycle: number;
  next?: { cycle: Cycle; remaining: number; status: CellInfo['status']; days: number };
  arrears: number;
  myTurns: { cycleIndex: number; amount: number; date: string; received: boolean }[];
  ledger: ReturnType<typeof ledgerFor>;
  monthly: number;
}

export function myCircles(db: DB, userId: string, today: string): MyCircleCard[] {
  const out: MyCircleCard[] = [];
  const circleIds = new Set([
    ...db.members.filter((m) => m.userId === userId).map((m) => m.circleId),
    ...db.circles.filter((c) => c.organizerId === userId).map((c) => c.id),
  ]);
  for (const id of circleIds) {
    const v = circleView(db, id, today);
    if (!v) continue;
    const member = myMember(db, id, userId);
    // في المتابعة الشخصية المستخدم عضو فعلياً (وإن كان يملك صلاحية التسجيل على جهازه)
    const role = v.circle.mode === 'personal' ? 'member' : (roleIn(db, id, userId) ?? 'member');
    if (!member) continue;
    const row = v.rows.find((r) => r.member.id === member.id);
    const duePerCycle = row?.due ?? 0;
    let next: MyCircleCard['next'];
    if (row && v.circle.status === 'active') {
      const idx = row.cells.findIndex((c) => c.status !== 'paid' && c.status !== 'none');
      if (idx >= 0) {
        const cycle = v.schedule[idx];
        next = { cycle, remaining: row.cells[idx].remaining, status: row.cells[idx].status, days: diffDays(today, cycle.dueDate) };
      }
    }
    const received = new Set(db.payouts.filter((p) => p.circleId === id && lineage(db, member.id).includes(p.memberId)).map((p) => p.cycleIndex));
    const myTurns = memberPayoutCycles(member.id, v.shares, v.pot).map((t) => ({
      cycleIndex: t.cycleIndex,
      amount: t.amount,
      date: v.schedule[t.cycleIndex]?.dueDate,
      received: received.has(t.cycleIndex),
    }));
    const ledger = ledgerFor(db, v, member.id, today);
    out.push({
      view: v,
      member,
      role,
      duePerCycle,
      next,
      arrears: ledger.arrears,
      myTurns,
      ledger,
      monthly: v.circle.status === 'active' || v.circle.status === 'draft' ? monthlyEquivalent(duePerCycle, v.circle.frequency) : 0,
    });
  }
  const rank = (c: MyCircleCard) => (c.view.circle.status === 'active' ? 0 : c.view.circle.status === 'draft' ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || (a.next?.cycle.dueDate ?? '9').localeCompare(b.next?.cycle.dueDate ?? '9'));
}

// ───────── سجل الالتزام عبر كل الجمعيات ─────────

export function userReliability(db: DB, userId: string, today: string) {
  const items: ReliabilityInput[] = [];
  let completed = 0;
  for (const m of db.members.filter((x) => x.userId === userId)) {
    const v = circleView(db, m.circleId, today);
    if (!v) continue;
    if (v.circle.status === 'completed' && m.status === 'active') completed++;
    const due = memberDuePerCycle(m.id, v.shares, v.circle.installment);
    if (!due) continue;
    const pays = db.payments.filter((p) => p.memberId === m.id && p.status === 'confirmed');
    for (const cy of v.schedule) {
      items.push({ dueDate: cy.dueDate, lateAfter: cy.lateAfter, due, payments: pays.filter((p) => p.cycleIndex === cy.index) });
    }
  }
  return reliability(items, today, completed);
}

/** هل يُسمح للمشاهد برؤية جوال العضو؟ */
export function phoneVisible(db: DB, viewerId: string | undefined, member: Member): boolean {
  if (!viewerId) return false;
  if (member.userId === viewerId) return true;
  const role = roleIn(db, member.circleId, viewerId);
  if (role === 'organizer' || role === 'assistant') return true;
  if (!member.userId) return false;
  return db.users.find((u) => u.id === member.userId)?.showPhone ?? false;
}

// ───────── التقويم ─────────

export interface CalEvent {
  date: string;
  kind: 'pay' | 'payout';
  circleId: string;
  circleName: string;
  amount: number;
  currency: string;
  status?: CellInfo['status'];
  cycleIndex: number;
}

export function calendarEvents(db: DB, userId: string, today: string): CalEvent[] {
  const ev: CalEvent[] = [];
  for (const c of myCircles(db, userId, today)) {
    if (c.view.circle.status !== 'active' && c.view.circle.status !== 'draft') continue;
    const row = c.view.rows.find((r) => r.member.id === c.member.id);
    if (row) {
      c.view.schedule.forEach((cy, i) =>
        ev.push({
          date: cy.dueDate,
          kind: 'pay',
          circleId: c.view.circle.id,
          circleName: c.view.circle.name,
          amount: row.due,
          currency: c.view.circle.currency,
          status: row.cells[i].status,
          cycleIndex: i,
        }),
      );
    }
    for (const t of c.myTurns)
      if (t.date)
        ev.push({
          date: t.date,
          kind: 'payout',
          circleId: c.view.circle.id,
          circleName: c.view.circle.name,
          amount: t.amount,
          currency: c.view.circle.currency,
          cycleIndex: t.cycleIndex,
        });
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}

export function organizedActiveCount(db: DB, userId: string) {
  return db.circles.filter((c) => c.organizerId === userId && (c.status === 'active' || c.status === 'draft')).length;
}

export const FREE_LIMITS = { circles: 2, members: 10 };
