import { useState } from 'react';
import { round2 } from '../../domain/calc';
import { diffDays, todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, money, relDays, num, freqLabel } from '../../lib/format';
import { useDB } from '../../store/db';
import { myCircles, type MyCircleCard } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { PaySheet } from '../components/sheets';
import { Empty, Progress, StatusChip } from '../components/ui';
import { go } from '../router';
import { Logo } from './Auth';

const roleLabel = (r: string) => ({ organizer: L('منظِّم', 'Organizer'), assistant: L('مساعد', 'Assistant'), member: L('عضو', 'Member') })[r] ?? r;
const statusLabel = (s: string) => ({ draft: L('قيد التجهيز', 'Draft'), active: L('نشطة', 'Active'), completed: L('مكتملة', 'Completed'), terminated: L('منتهية مبكراً', 'Ended early') })[s] ?? s;

export function Home() {
  const db = useDB();
  const today = todayISO();
  const me = db.users.find((u) => u.id === db.currentUserId)!;
  const cards = myCircles(db, me.id, today);
  const active = cards.filter((c) => c.view.circle.status === 'active' || c.view.circle.status === 'draft');
  const [pay, setPay] = useState<{ circleId: string; memberId: string; cycle: number } | null>(null);

  // القسط القادم الأقرب عبر كل الجمعيات
  const nexts = active.filter((c) => c.next).sort((a, b) => a.next!.cycle.dueDate.localeCompare(b.next!.cycle.dueDate));
  const next = nexts[0];
  const turns = active.flatMap((c) => c.myTurns.filter((t) => !t.received).map((t) => ({ ...t, card: c }))).sort((a, b) => a.date.localeCompare(b.date));
  const nextTurn = turns[0];
  const arrears = active.filter((c) => c.arrears > 0);

  // مهام المنظم
  const staffCircles = new Set(cards.filter((c) => c.role !== 'member').map((c) => c.view.circle.id));
  const pendingProofs = db.payments.filter((p) => staffCircles.has(p.circleId) && p.status === 'pending');
  const swapsForMe = db.swaps.filter((s) => {
    if (s.status !== 'open') return false;
    const isOrg = cards.find((c) => c.view.circle.id === s.circleId)?.role === 'organizer';
    const to = db.shares.find((x) => x.id === s.toShareId);
    const isTo = to?.holders.some((h) => db.members.find((m) => m.id === h.memberId)?.userId === me.id);
    return (isOrg && !s.approvals.organizer) || (isTo && !s.approvals.to);
  });
  const unconfirmedPayouts = db.payouts.filter((p) => !p.recipientConfirmedAt && db.members.find((m) => m.id === p.memberId)?.userId === me.id);

  // الملخص المالي (يُجمع حسب العملة)
  const byCur = new Map<string, { paid: number; toReceive: number; monthly: number; remaining: number }>();
  for (const c of cards) {
    const cur = c.view.circle.currency;
    const t = byCur.get(cur) ?? { paid: 0, toReceive: 0, monthly: 0, remaining: 0 };
    t.paid += c.ledger.paid;
    t.toReceive += c.ledger.expectedToReceive;
    t.monthly += c.monthly;
    t.remaining += c.view.circle.status === 'active' ? c.ledger.remainingToPay : 0;
    byCur.set(cur, t);
  }

  return (
    <>
      <header className="top">
        <Logo size={34} />
        <h1>
          {L('أهلاً', 'Hi')} {me.name} 👋
        </h1>
        <button className="icon-btn" onClick={() => go('/tools')} aria-label={L('أدوات', 'Tools')}>
          <Icon name="calc" />
        </button>
      </header>
      <main>
        {cards.length === 0 ? (
          <div className="card">
            <Empty
              icon="users"
              title={L('لا توجد جمعيات بعد', 'No circles yet')}
              text={L('أنشئ جمعيتك الأولى في أقل من دقيقة، أو انضم بكود دعوة من المنظِّم.', 'Create your first circle in under a minute, or join with an invite code.')}
              action={
                <div className="stack" style={{ width: '100%' }}>
                  <button className="btn block" onClick={() => go('/new')}>
                    <Icon name="plus" /> {L('إنشاء جمعية', 'Create a circle')}
                  </button>
                  <button className="btn soft block" onClick={() => go('/join')}>
                    <Icon name="qr" /> {L('الانضمام بكود', 'Join with a code')}
                  </button>
                  <button className="btn ghost block" onClick={() => go('/tools')}>
                    <Icon name="book" /> {L('تعرّف على الجمعية وآدابها', 'Learn about circles')}
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            {/* البطاقة الرئيسية: كم عليّ ومتى، ومتى دوري */}
            <section className="card hero stack" aria-label={L('القسط القادم', 'Next installment')}>
              {next ? (
                <>
                  <div className="row between">
                    <span className="muted">{L('قسطك القادم', 'Your next installment')}</span>
                    <span className="chip" style={{ background: 'rgb(255 255 255 / 22%)', color: 'inherit' }}>
                      {next.next!.status === 'late' ? L('متأخر', 'Late') : relDays(next.next!.days)}
                    </span>
                  </div>
                  <div className="big num">{money(next.next!.remaining, next.view.circle.currency)}</div>
                  <div>
                    {next.view.circle.name} · {date(next.next!.cycle.dueDate, 'long')}
                  </div>
                  {next.next!.status === 'pending' ? (
                    <div className="small">⏳ {L('أرسلت الإثبات — بانتظار تأكيد المنظِّم', 'Proof sent — awaiting confirmation')}</div>
                  ) : (
                    <button
                      className="btn block"
                      style={{ background: '#fff', color: 'var(--brand-strong)' }}
                      onClick={() => setPay({ circleId: next.view.circle.id, memberId: next.member.id, cycle: next.next!.cycle.index })}
                    >
                      <Icon name="check" /> {L('دفعت — ارفع الإثبات', 'I paid — upload proof')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="muted">{L('قسطك القادم', 'Your next installment')}</span>
                  <div className="big">{L('لا أقساط مستحقة 🎉', 'Nothing due 🎉')}</div>
                </>
              )}
              {nextTurn && (
                <>
                  <hr style={{ borderColor: 'rgb(255 255 255 / 25%)' }} />
                  <div className="row between">
                    <div>
                      <div className="muted small">{L('دورك في الاستلام', 'Your payout')}</div>
                      <b className="num" style={{ fontSize: '1.2rem' }}>
                        {money(nextTurn.amount, nextTurn.card.view.circle.currency)}
                      </b>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <div className="small">{nextTurn.card.view.circle.name}</div>
                      <div className="small">
                        {date(nextTurn.date)} · {relDays(diffDays(today, nextTurn.date))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {arrears.map((c) => (
              <button key={c.view.circle.id} className="card row" style={{ textAlign: 'start', borderColor: 'var(--late)', cursor: 'pointer' }} onClick={() => go(`/c/${c.view.circle.id}`)}>
                <span className="avatar" style={{ background: 'var(--late-bg)', color: 'var(--late)' }}>
                  <Icon name="alert" />
                </span>
                <span className="grow">
                  <b>{L('عليك متأخرات', 'You have arrears')}</b>
                  <div className="small muted">
                    {c.view.circle.name}: {money(c.arrears, c.view.circle.currency)}
                  </div>
                </span>
              </button>
            ))}

            {(pendingProofs.length > 0 || swapsForMe.length > 0 || unconfirmedPayouts.length > 0) && (
              <section className="card stack" style={{ gap: 4 }}>
                <h2>{L('بانتظارك', 'Waiting for you')}</h2>
                {pendingProofs.length > 0 && (
                  <button className="item" onClick={() => go(`/c/${pendingProofs[0].circleId}?tab=overview`)}>
                    <span className="avatar sm s-pending">
                      <Icon name="receipt" size={18} />
                    </span>
                    <span className="grow">{L(`${num(pendingProofs.length)} إثباتات دفع تنتظر تأكيدك`, `${pendingProofs.length} payment proofs to review`)}</span>
                    <Icon name="next" className="flip" size={18} />
                  </button>
                )}
                {swapsForMe.map((s) => (
                  <button key={s.id} className="item" onClick={() => go(`/c/${s.circleId}?tab=order`)}>
                    <span className="avatar sm s-due">
                      <Icon name="swap" size={18} />
                    </span>
                    <span className="grow">{L('طلب تبديل أدوار ينتظر موافقتك', 'A turn swap needs your approval')}</span>
                    <Icon name="next" className="flip" size={18} />
                  </button>
                ))}
                {unconfirmedPayouts.map((p) => (
                  <button key={p.id} className="item" onClick={() => go(`/c/${p.circleId}?tab=order`)}>
                    <span className="avatar sm s-paid">
                      <Icon name="wallet" size={18} />
                    </span>
                    <span className="grow">{L('أكّد استلامك لمبلغ الجمعية', 'Confirm you received your payout')}</span>
                    <Icon name="next" className="flip" size={18} />
                  </button>
                ))}
              </section>
            )}

            <div className="section-title">
              <h2>{L('جمعياتي', 'My circles')}</h2>
              <button className="btn sm ghost" onClick={() => go('/join')}>
                <Icon name="qr" size={18} /> {L('انضمام بكود', 'Join')}
              </button>
            </div>
            {cards.map((c) => (
              <CircleCard key={c.view.circle.id} c={c} />
            ))}

            <div className="section-title">
              <h2>{L('ملخصي المالي', 'My finances')}</h2>
              <button className="btn sm ghost" onClick={() => go('/settings#export')}>
                <Icon name="download" size={18} /> CSV
              </button>
            </div>
            {[...byCur.entries()].map(([cur, t]) => (
              <section key={cur} className="stack" style={{ gap: 10 }}>
                <div className="grid2">
                  <div className="stat">
                    <div className="label">{L('إجمالي ما دفعت', 'Total paid')}</div>
                    <div className="value num">{money(round2(t.paid), cur)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">{L('سأستلم', 'To receive')}</div>
                    <div className="value num" style={{ color: 'var(--paid)' }}>
                      {money(round2(t.toReceive), cur)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="label">{L('التزامي الشهري', 'Monthly commitment')}</div>
                    <div className="value num">{money(round2(t.monthly), cur)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">{L('باقي عليّ', 'Left to pay')}</div>
                    <div className="value num">{money(round2(t.remaining), cur)}</div>
                  </div>
                </div>
              </section>
            ))}
            <div className="small muted" style={{ textAlign: 'center' }}>
              {L('بلا فوائد: مجموع ما تدفعه = ما تستلمه.', 'No interest: what you pay in equals what you receive.')}
            </div>
          </>
        )}
      </main>
      {pay && <PaySheet open onClose={() => setPay(null)} circleId={pay.circleId} memberId={pay.memberId} cycleIndex={pay.cycle} />}
    </>
  );
}

function CircleCard({ c }: { c: MyCircleCard }) {
  const { circle, schedule, current, pot } = c.view;
  const done = c.view.circle.status === 'completed' ? schedule.length : Math.max(0, current + 1);
  return (
    <a href={`#/c/${circle.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 8 }}>
      <div className="row between">
        <b style={{ fontSize: '1.08rem' }} className="ellipsis">
          {circle.name}
        </b>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip s-brand">{roleLabel(c.role)}</span>
          {circle.status !== 'active' && <span className="chip">{statusLabel(circle.status)}</span>}
        </div>
      </div>
      <div className="small muted">
        {money(c.duePerCycle || circle.installment, circle.currency)} · {freqLabel(circle.frequency)} · {L('الاستلام', 'Pot')} {money(pot, circle.currency)}
      </div>
      {circle.status !== 'draft' && (
        <>
          <Progress value={(done / schedule.length) * 100} />
          <div className="row between small">
            <span className="muted">{L(`الدورة ${num(Math.min(done, schedule.length))} من ${num(schedule.length)}`, `Cycle ${done} of ${schedule.length}`)}</span>
            {c.next ? <StatusChip s={c.next.status} /> : circle.status === 'active' && <span className="chip s-paid">{L('مسدد ✓', 'Up to date ✓')}</span>}
          </div>
        </>
      )}
      {c.myTurns.length > 0 && (
        <div className="small">
          🎯 {L('دوري', 'My turn')}: {c.myTurns.map((t) => `${num(t.cycleIndex + 1)}${t.received ? ' ✓' : ''}`).join('، ')}
          {c.myTurns.find((t) => !t.received)?.date && <> · {date(c.myTurns.find((t) => !t.received)!.date)}</>}
        </div>
      )}
      {circle.status === 'draft' && <div className="warn small">{L('قيد التجهيز: أكمل الأعضاء ثم أجرِ القرعة لتبدأ', 'Draft: add members, then run the lottery to start')}</div>}
    </a>
  );
}

export { roleLabel, statusLabel };
