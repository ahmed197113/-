import { useState } from 'react';
import { round2 } from '../../domain/calc';
import { diffDays, todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, money, relDays, num } from '../../lib/format';
import { useDB } from '../../store/db';
import { canConfirm, cycleSummary, myCircles, roleIn, type MyCircleCard } from '../../store/selectors';
import * as A from '../../store/actions';
import { focusCycle } from './CircleNow';
import { RegistryCard } from './Circles';
import { Icon } from '../components/Icon';
import { PaySheet } from '../components/sheets';
import { attempt, Empty, toast, toastError } from '../components/ui';
import { go } from '../router';
import { Logo } from './Auth';

const roleLabel = (r: string) => ({ organizer: L('منظِّم', 'Organizer'), assistant: L('مساعد', 'Assistant'), member: L('عضو', 'Member') })[r] ?? r;
const statusLabel = (s: string) => ({ draft: L('قيد التجهيز', 'Draft'), active: L('نشطة', 'Active'), completed: L('مكتملة', 'Completed'), terminated: L('منتهية مبكراً', 'Ended early') })[s] ?? s;

export function Home() {
  const db = useDB();
  const today = todayISO();
  const me = db.users.find((u) => u.id === db.currentUserId)!;
  const cards = myCircles(db, me.id, today);
  const unread = db.notifications.filter((n) => n.userId === me.id && !n.read).length;
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
  const tasks = cards
    .filter((c) => staffCircles.has(c.view.circle.id) && c.view.circle.status === 'active')
    .map((c) => {
      const f = focusCycle(c.view, today);
      const s = cycleSummary(c.view, f);
      const late = c.view.rows.filter((r) => r.cells.some((x, i) => i < f && x.status === 'late')).length;
      const payoutDue = s.share && today >= c.view.schedule[f].dueDate && !db.payouts.some((p) => p.circleId === c.view.circle.id && p.cycleIndex === f);
      return { c, f, unpaid: c.view.rows.length - s.paid.length - s.pending.length, pending: s.pending.length, late, payoutDue };
    })
    .filter((t) => t.unpaid || t.pending || t.late || t.payoutDue);
  const swapsForMe = db.swaps.filter((s) => {
    if (s.status !== 'open') return false;
    const isOrg = cards.find((c) => c.view.circle.id === s.circleId)?.role === 'organizer';
    const to = db.shares.find((x) => x.id === s.toShareId);
    const isTo = to?.holders.some((h) => db.members.find((m) => m.id === h.memberId)?.userId === me.id);
    return (isOrg && !s.approvals.organizer) || (isTo && !s.approvals.to);
  });
  const unconfirmedPayouts = db.payouts.filter((p) => !p.recipientConfirmedAt && db.members.find((m) => m.id === p.memberId)?.userId === me.id);

  // "دفعت": ضغطة واحدة حين أملك صلاحية التسجيل (منظِّم أو متابعة شخصية)، وإلا نموذج رفع الإثبات
  const payNext = (c: MyCircleCard) => {
    const n = c.next!;
    if (canConfirm(roleIn(db, c.view.circle.id, me.id))) {
      try {
        const id = A.quickPay(c.view.circle.id, c.member.id, n.cycle.index, n.remaining);
        toast(L('✓ سُجّل قسطك', '✓ Recorded'), [{ label: L('تراجع', 'Undo'), run: () => attempt(() => A.undoPayment(id), L('تم التراجع', 'Undone')) }]);
      } catch (e) {
        toastError(e);
      }
    } else setPay({ circleId: c.view.circle.id, memberId: c.member.id, cycle: n.cycle.index });
  };

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
        <button className="icon-btn" onClick={() => go('/notifications')} aria-label={L('الإشعارات', 'Notifications')}>
          <Icon name="bell" />
          {unread > 0 && <span className="dot">{unread > 9 ? '9+' : num(unread)}</span>}
        </button>
      </header>
      <main>
        {cards.length === 0 ? (
          <div className="card">
            <Empty
              icon="users"
              title={L('لا توجد جمعيات بعد', 'No circles yet')}
              text={L('اختر دورك لنبدأ — أقل من دقيقة.', 'Pick your role to start — under a minute.')}
              action={
                <div className="stack" style={{ width: '100%' }}>
                  <button className="btn block" onClick={() => go('/new?type=organized')}>
                    👑 {L('أنا المنظِّم — إنشاء جمعية', "I'm the organizer — create")}
                  </button>
                  <button className="btn soft block" onClick={() => go('/new?type=personal')}>
                    🙋 {L('أنا عضو — أتابع أقساطي ودوري', "I'm a member — track my turn")}
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
                      onClick={() => payNext(next)}
                    >
                      <Icon name="check" /> {L('دفعت', 'I paid')}
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

            {(tasks.length > 0 || swapsForMe.length > 0 || unconfirmedPayouts.length > 0) && (
              <section className="card stack" style={{ gap: 4 }}>
                <h2>{L('مهامك الآن', 'To do now')}</h2>
                {tasks.map((t) => (
                  <button key={t.c.view.circle.id} className="item" onClick={() => go(`/c/${t.c.view.circle.id}`)}>
                    <span className={`avatar sm ${t.late ? 's-late' : t.pending ? 's-pending' : 's-due'}`}>
                      <Icon name="check" size={18} />
                    </span>
                    <span className="grow">
                      <b className="small">
                        {t.c.view.circle.name} — {L('الدورة', 'cycle')} {num(t.f + 1)}
                      </b>
                      <div className="tiny muted">
                        {[
                          t.unpaid && L(`${num(t.unpaid)} لم يدفعوا`, `${t.unpaid} unpaid`),
                          t.pending && L(`${num(t.pending)} إثبات للتأكيد`, `${t.pending} to confirm`),
                          t.late && L(`${num(t.late)} متأخر من قبل`, `${t.late} overdue`),
                          t.payoutDue && L('سلّم المبلغ لصاحب الدور', 'deliver the payout'),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </span>
                    <span className="chip s-brand">{L('افتح', 'Open')}</span>
                  </button>
                ))}
                {swapsForMe.map((s) => (
                  <button key={s.id} className="item" onClick={() => go(`/c/${s.circleId}?tab=members`)}>
                    <span className="avatar sm s-due">
                      <Icon name="swap" size={18} />
                    </span>
                    <span className="grow">{L('طلب تبديل أدوار ينتظر موافقتك', 'A turn swap needs your approval')}</span>
                    <Icon name="next" className="flip" size={18} />
                  </button>
                ))}
                {unconfirmedPayouts.map((p) => (
                  <button key={p.id} className="item" onClick={() => go(`/c/${p.circleId}`)}>
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
              <h2>{L('جمعياتي النشطة', 'Active circles')}</h2>
              <button className="btn sm ghost" onClick={() => go('/new')}>
                <Icon name="plus" size={18} /> {L('جمعية', 'Circle')}
              </button>
            </div>
            {active.length === 0 && <div className="card small muted">{L('لا توجد جمعيات نشطة. الجمعيات المنتهية في سجل جمعياتي.', 'No active circles. Finished ones are in My circles.')}</div>}
            {active.slice(0, 3).map((c) => (
              <RegistryCard key={c.view.circle.id} c={c} />
            ))}
            <button className="btn soft block" onClick={() => go('/circles')}>
              <Icon name="users" /> {L(`كل جمعياتي (${num(cards.length)})`, `All my circles (${cards.length})`)}
            </button>

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

export { roleLabel, statusLabel };
