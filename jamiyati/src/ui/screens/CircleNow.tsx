// شاشة "الآن" للمنظِّم: قائمة الدورة كشيك-ليست — ضغطة واحدة لتسجيل الدفع، والتأكيد، والتذكير، والإيصال.
import { useState } from 'react';
import { type CellInfo } from '../../domain/calc';
import { diffDays, todayISO } from '../../domain/dates';
import type { Member } from '../../domain/types';
import { L } from '../../lib/i18n';
import { date, money, num, relDays } from '../../lib/format';
import { openLink } from '../../lib/native';
import { template, waLink, type TemplateKind, type TemplateVars } from '../../lib/whatsapp';
import * as A from '../../store/actions';
import { getDB, useDB } from '../../store/db';
import { cycleSummary, paymentsFor, type CircleView } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { PaymentItem, PaySheet, WhatsAppSheet } from '../components/sheets';
import { attempt, Avatar, Progress, Sheet, StatusChip, toast, toastError } from '../components/ui';
import { go } from '../router';
import { DeliverSheet } from './Circle';

/** الدورة التي يهتم بها المنظم الآن: الحالية، أو القادمة إن سُلّم مبلغ الحالية أو اقترب موعد القادمة */
export function focusCycle(v: CircleView, today: string): number {
  if (v.current < 0) return 0;
  const cur = v.current;
  const next = v.schedule[cur + 1];
  if (!next) return cur;
  const delivered = getDB().payouts.some((p) => p.circleId === v.circle.id && p.cycleIndex === cur);
  return delivered || diffDays(today, next.dueDate) <= 5 ? cur + 1 : cur;
}

export function NowTab({ v, role }: { v: CircleView; role: string }) {
  const db = useDB();
  const today = todayISO();
  const { circle } = v;
  const [cycle, setCycle] = useState(() => focusCycle(v, today));
  const [rowSheet, setRowSheet] = useState<{ memberId: string; cycle: number } | null>(null);
  const [pay, setPay] = useState<{ memberId: string; cycle: number } | null>(null);
  const [wa, setWa] = useState<{ phone?: string; kinds: TemplateKind[]; vars: TemplateVars } | null>(null);
  const [deliver, setDeliver] = useState<{ memberId: string; amount: number } | null>(null);
  const cy = v.schedule[cycle];
  const sum = cycleSummary(v, cycle);
  const recipientNames = sum.recipients.map((r) => r.name).join(' و') || '—';
  const payouts = db.payouts.filter((p) => p.circleId === circle.id && p.cycleIndex === cycle);
  const paidCount = sum.paid.length;
  const total = v.rows.length;
  const days = diffDays(today, cy.dueDate);
  const active = circle.status === 'active';

  // متأخرات من دورات سابقة
  const arrears = v.rows.flatMap((r) => r.cells.map((c, i) => ({ r, c, i })).filter((x) => x.i < cycle && x.c.status === 'late'));

  const oneTap = (m: Member, i: number, cell: CellInfo) => {
    try {
      const id = A.quickPay(circle.id, m.id, i, cell.remaining);
      const p = getDB().payments.find((x) => x.id === id);
      toast(L(`✓ ${m.name.split(' ')[0]} — ${money(p?.amount ?? cell.remaining, circle.currency)}`, `✓ ${m.name} paid`), [
        { label: L('تراجع', 'Undo'), run: () => attempt(() => A.undoPayment(id), L('تم التراجع', 'Undone')) },
        ...(m.phone ? [{ label: L('إرسال إيصال', 'Send receipt'), run: () => sendReceipt(m, id) }] : []),
      ]);
    } catch (e) {
      toastError(e);
    }
  };

  const sendReceipt = (m: Member, paymentId: string) => {
    const p = getDB().payments.find((x) => x.id === paymentId);
    if (!p) return;
    const text =
      template('thanks', { name: m.name.split(' ')[0], circle: circle.name, amount: p.amount, currency: circle.currency }) +
      L(`\n🧾 رقم الإيصال: ${p.receiptNo ?? ''} — الدورة ${p.cycleIndex + 1}`, `\n🧾 Receipt: ${p.receiptNo ?? ''} — cycle ${p.cycleIndex + 1}`);
    openLink(waLink(m.phone, text));
  };

  const remind = (m: Member, i: number, cell: CellInfo) =>
    setWa({
      phone: m.phone,
      kinds: cell.status === 'late' ? ['late', 'dueDay', 'statement'] : diffDays(today, v.schedule[i].dueDate) > 0 ? ['before3', 'dueDay', 'late'] : ['dueDay', 'late', 'before3'],
      vars: { name: m.name.split(' ')[0], circle: circle.name, amount: cell.remaining, currency: circle.currency, dueDate: v.schedule[i].dueDate },
    });

  const groupVars: TemplateVars = {
    name: '',
    circle: circle.name,
    amount: circle.installment,
    currency: circle.currency,
    cycle: cycle + 1,
    dueDate: cy.dueDate,
    recipient: recipientNames,
    pot: v.pot,
    paidNames: sum.paid.map((x) => x.member.name),
    remainingCount: total - paidCount,
  };

  return (
    <>
      {/* رأس الدورة */}
      <section className="card stack" style={{ gap: 10 }}>
        <div className="row between">
          <button className="icon-btn" disabled={cycle === 0} onClick={() => setCycle(cycle - 1)} aria-label={L('الدورة السابقة', 'Previous cycle')}>
            <Icon name="back" className="flip" />
          </button>
          <div style={{ textAlign: 'center' }}>
            <b style={{ fontSize: '1.1rem' }}>
              {L('الدورة', 'Cycle')} {num(cycle + 1)} {L('من', 'of')} {num(v.schedule.length)}
            </b>
            <div className="small muted">
              {date(cy.dueDate)} · {relDays(days)}
            </div>
          </div>
          <button className="icon-btn" disabled={cycle === v.schedule.length - 1} onClick={() => setCycle(cycle + 1)} aria-label={L('الدورة التالية', 'Next cycle')}>
            <Icon name="next" className="flip" />
          </button>
        </div>
        <div className="row">
          <span className="pos now">{num(cycle + 1)}</span>
          <div className="grow">
            <div className="small muted">{L('الدور على', 'Turn of')}</div>
            <b>{recipientNames}</b>
          </div>
          <b className="num">{money(v.pot, circle.currency)}</b>
        </div>
        <div>
          <div className="row between">
            <b>
              {L('دفع', 'Paid')} {num(paidCount)} {L('من', 'of')} {num(total)}
            </b>
            <span className="small num muted">
              {money(sum.collected, circle.currency)} / {money(sum.expected, circle.currency)}
            </span>
          </div>
          <Progress value={sum.rate} />
        </div>
      </section>

      {/* قائمة الأعضاء */}
      <section className="card list" aria-label={L('دفعات الدورة', 'Cycle payments')}>
        {v.rows.map((r) => {
          const cell = r.cells[cycle];
          const isRecipient = r.positions.includes(cycle + 1);
          const lastPaid = paymentsFor(db, circle.id, r.member.id, cycle).filter((p) => p.status === 'confirmed').at(-1);
          return (
            <div className="item" key={r.member.id} style={{ gap: 8 }}>
              <button className="row grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer', minWidth: 0 }} onClick={() => setRowSheet({ memberId: r.member.id, cycle })}>
                <Avatar name={r.member.name} sm />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>
                    {r.member.name} {isRecipient && <span title={L('صاحب الدور', 'Recipient')}>🎯</span>}
                  </b>
                  <span className="tiny muted">
                    {cell.status === 'paid'
                      ? L('مدفوع ✓', 'Paid ✓')
                      : cell.status === 'pending'
                        ? L(`أرسل إثباتاً بـ ${num(cell.pending)}`, `Sent proof of ${cell.pending}`)
                        : `${money(cell.remaining, circle.currency)}${cell.confirmed > 0 ? L(' (باقي)', ' left') : ''}`}
                  </span>
                </span>
              </button>
              {cell.status === 'paid' ? (
                <>
                  {lastPaid && r.member.phone && (
                    <button className="icon-btn" onClick={() => sendReceipt(r.member, lastPaid.id)} aria-label={L('إرسال الإيصال عبر واتساب', 'Send receipt on WhatsApp')}>
                      <Icon name="receipt" size={20} />
                    </button>
                  )}
                  <span className="cell s-paid" aria-hidden="true">
                    ✓
                  </span>
                </>
              ) : active ? (
                <>
                  {r.member.phone && cell.status !== 'pending' && r.member.userId !== db.currentUserId && (
                    <button className="icon-btn" style={{ color: '#1faa55' }} onClick={() => remind(r.member, cycle, cell)} aria-label={L('تذكير عبر واتساب', 'Remind on WhatsApp')}>
                      <Icon name="whatsapp" size={22} />
                    </button>
                  )}
                  <button className={`btn sm ${cell.status === 'pending' ? '' : cell.status === 'late' ? 'danger' : 'soft'}`} style={{ minWidth: 84 }} onClick={() => oneTap(r.member, cycle, cell)}>
                    {cell.status === 'pending' ? L('تأكيد', 'Confirm') : L('✓ دفع', '✓ Paid')}
                  </button>
                </>
              ) : (
                <StatusChip s={cell.status} />
              )}
            </div>
          );
        })}
      </section>
      {active && <div className="tiny muted" style={{ textAlign: 'center' }}>{L('"✓ دفع" يسجّل المبلغ كاملاً بضغطة. للدفع الجزئي أو رفض إثبات اضغط اسم العضو.', '"✓ Paid" records the full amount. Tap a name for partial payments or to reject a proof.')}</div>}

      {/* المتأخرات السابقة */}
      {active && arrears.length > 0 && (
        <section className="card stack" style={{ gap: 2, borderColor: 'var(--late)' }}>
          <h3 style={{ color: 'var(--late)' }}>{L('متأخرات من دورات سابقة', 'Earlier arrears')}</h3>
          {arrears.map(({ r, c, i }) => (
            <div className="item" key={r.member.id + i} style={{ gap: 8 }}>
              <Avatar name={r.member.name} sm />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: 'block' }}>
                  {r.member.name}
                </b>
                <span className="tiny muted">
                  {L('الدورة', 'Cycle')} {num(i + 1)} · {money(c.remaining, circle.currency)} · {L(`متأخر ${num(diffDays(v.schedule[i].dueDate, today))} يوم`, `${diffDays(v.schedule[i].dueDate, today)}d late`)}
                </span>
              </span>
              {r.member.phone && (
                <button className="icon-btn" style={{ color: '#1faa55' }} onClick={() => remind(r.member, i, c)} aria-label={L('تذكير', 'Remind')}>
                  <Icon name="whatsapp" size={22} />
                </button>
              )}
              <button className="btn sm danger" onClick={() => oneTap(r.member, i, c)}>
                {L('✓ دفع', '✓ Paid')}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* تسليم المبلغ */}
      {active && sum.share && (
        <section className="card stack" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>{L('تسليم المبلغ لصاحب الدور', 'Payout')}</h3>
          {sum.share.holders.map((h) => {
            const po = payouts.find((p) => p.memberId === h.memberId);
            const amount = v.pot * h.fraction;
            const name = v.members.find((m) => m.id === h.memberId)?.name;
            return (
              <div key={h.memberId} className="row between">
                <span className="small">
                  {name}: <b className="num">{money(amount, circle.currency)}</b>
                </span>
                {po ? (
                  <span className="chip s-paid">✓ {L('سُلّم', 'Delivered')}</span>
                ) : role === 'organizer' && (days <= 0 || sum.rate >= 100) ? (
                  <button className="btn sm" onClick={() => setDeliver({ memberId: h.memberId, amount })}>
                    {L('سلّمت المبلغ', 'Mark delivered')}
                  </button>
                ) : (
                  <span className="chip">{days > 0 ? L(`يوم ${date(cy.dueDate)}`, `on ${date(cy.dueDate)}`) : L('لم يُسلّم', 'Not yet')}</span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* رسائل المجموعة */}
      {active && (
        <section className="card stack" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>{L('رسالة لمجموعة واتساب', 'Message the WhatsApp group')}</h3>
          <div className="small muted">{L('بلا ذكر أسماء المتأخرين — تذكير لطيف لا يحرج أحداً.', "No names of who hasn't paid — nobody gets embarrassed.")}</div>
          <div className="btns">
            <button className="btn sm whatsapp" onClick={() => setWa({ kinds: ['groupReminder', 'groupBoard', 'turn'], vars: groupVars })}>
              <Icon name="whatsapp" size={18} /> {L('تذكير عام', 'Reminder')}
            </button>
            <button className="btn sm whatsapp" onClick={() => setWa({ kinds: ['groupBoard', 'groupReminder', 'turn'], vars: groupVars })}>
              <Icon name="whatsapp" size={18} /> {L('من وصلت دفعته', 'Who paid')}
            </button>
          </div>
        </section>
      )}

      {rowSheet && <RowSheet v={v} role={role} memberId={rowSheet.memberId} cycle={rowSheet.cycle} onClose={() => setRowSheet(null)} onPay={() => { setPay(rowSheet); setRowSheet(null); }} onRemind={(m, c) => { setRowSheet(null); remind(m, rowSheet.cycle, c); }} />}
      {pay && <PaySheet open onClose={() => setPay(null)} circleId={circle.id} memberId={pay.memberId} cycleIndex={pay.cycle} />}
      {wa && <WhatsAppSheet open onClose={() => setWa(null)} phone={wa.phone} kinds={wa.kinds} vars={wa.vars} />}
      {deliver && <DeliverSheet v={v} memberId={deliver.memberId} amount={deliver.amount} cycle={cycle} onClose={() => setDeliver(null)} />}
    </>
  );
}

function RowSheet({ v, role, memberId, cycle, onClose, onPay, onRemind }: { v: CircleView; role: string; memberId: string; cycle: number; onClose: () => void; onPay: () => void; onRemind: (m: Member, c: CellInfo) => void }) {
  const db = useDB();
  const row = v.rows.find((r) => r.member.id === memberId)!;
  const cell = row.cells[cycle];
  const pays = paymentsFor(db, v.circle.id, memberId, cycle).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return (
    <Sheet open onClose={onClose} title={`${row.member.name} — ${L('الدورة', 'Cycle')} ${num(cycle + 1)}`}>
      <div className="stack">
        <div className="row between">
          <span className="small muted">
            {L('المستحق', 'Due')} <b className="num">{money(cell.due, v.circle.currency)}</b> · {L('المتبقي', 'Left')} <b className="num">{money(cell.remaining, v.circle.currency)}</b>
          </span>
          <StatusChip s={cell.status} />
        </div>
        {pays.map((p) => (
          <PaymentItem key={p.id} p={p} currency={v.circle.currency} staff organizer={role === 'organizer'} />
        ))}
        {v.circle.status === 'active' && cell.status !== 'paid' && (
          <button className="btn block soft" onClick={onPay}>
            <Icon name="edit" /> {L('دفع جزئي أو بطريقة أخرى', 'Partial / other method')}
          </button>
        )}
        {row.member.phone && cell.status !== 'paid' && (
          <button className="btn whatsapp block" onClick={() => onRemind(row.member, cell)}>
            <Icon name="whatsapp" /> {L('تذكير لطيف', 'Gentle reminder')}
          </button>
        )}
        <button className="btn ghost block" onClick={() => go(`/c/${v.circle.id}/m/${memberId}`)}>
          <Icon name="user" /> {L('ملف العضو وكشف حسابه', 'Member profile & statement')}
        </button>
      </div>
    </Sheet>
  );
}
