// المتابعة الشخصية: أنا عضو في جمعية يديرها غيري — قسطي، ودوري، وزر "دفعت" بضغطة.
import { useState } from 'react';
import { diffDays, todayISO } from '../../domain/dates';
import type { Frequency } from '../../domain/types';
import { L } from '../../lib/i18n';
import { CURRENCIES, date, freqLabel, money, num, relDays } from '../../lib/format';
import { openLink } from '../../lib/native';
import { waLink } from '../../lib/whatsapp';
import * as A from '../../store/actions';
import { getDB, useDB } from '../../store/db';
import { ledgerFor, type CircleView } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { PaySheet } from '../components/sheets';
import { attempt, Field, Progress, ReasonSheet, Seg, StatusChip, toast, toastError, TopBar } from '../components/ui';
import { go } from '../router';
import { addDays } from '../../domain/dates';

export function PersonalScreen({ v }: { v: CircleView }) {
  const db = useDB();
  const today = todayISO();
  const { circle } = v;
  const me = v.members.find((m) => m.userId === db.currentUserId)!;
  const row = v.rows.find((r) => r.member.id === me.id)!;
  const led = ledgerFor(db, v, me.id, today);
  const [proofFor, setProofFor] = useState<number | null>(null);
  const [end, setEnd] = useState(false);
  const nextIdx = row.cells.findIndex((c) => c.status !== 'paid');
  const next = nextIdx >= 0 ? row.cells[nextIdx] : undefined;
  const paidCount = row.cells.filter((c) => c.status === 'paid').length;
  const turnIdx = row.positions[0] - 1;
  const turnDate = v.schedule[turnIdx]?.dueDate;
  const received = db.payouts.some((p) => p.circleId === circle.id && p.cycleIndex === turnIdx && p.memberId === me.id);
  const active = circle.status === 'active';

  const tellOrganizer = (i: number, amount: number) => {
    if (!circle.organizerPhone) return;
    const text = L(
      `السلام عليكم ${circle.organizerName ?? ''} 🌿\nحوّلت قسط "${circle.name}" للدورة ${i + 1}: ${money(amount, circle.currency)}.\nجزاك الله خيراً 🤍`,
      `Hi ${circle.organizerName ?? ''} 🌿\nI've paid "${circle.name}" cycle ${i + 1}: ${money(amount, circle.currency)}.`,
    );
    openLink(waLink(circle.organizerPhone, text));
  };

  const paid = (i: number) => {
    try {
      const id = A.quickPay(circle.id, me.id, i, row.cells[i].remaining);
      const amount = getDB().payments.find((p) => p.id === id)?.amount ?? row.cells[i].remaining;
      toast(L(`✓ سُجّل قسط الدورة ${num(i + 1)}`, `✓ Cycle ${i + 1} recorded`), [
        { label: L('تراجع', 'Undo'), run: () => attempt(() => A.undoPayment(id), L('تم التراجع', 'Undone')) },
        ...(circle.organizerPhone ? [{ label: L('أخبر المنظِّم', 'Tell organizer'), run: () => tellOrganizer(i, amount) }] : []),
      ]);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <>
      <TopBar title={circle.name} backTo="/" />
      <main>
        <section className="card hero stack">
          {next && active ? (
            <>
              <div className="row between">
                <span className="muted">{L('قسطك القادم', 'Your next installment')}</span>
                <span className="chip" style={{ background: 'rgb(255 255 255 / 22%)', color: 'inherit' }}>
                  {next.status === 'late' ? L('متأخر', 'Late') : relDays(diffDays(today, v.schedule[nextIdx].dueDate))}
                </span>
              </div>
              <div className="big num">{money(next.remaining, circle.currency)}</div>
              <div>
                {L('الدورة', 'Cycle')} {num(nextIdx + 1)} · {date(v.schedule[nextIdx].dueDate, 'long')}
              </div>
              <button className="btn block" style={{ background: '#fff', color: 'var(--brand-strong)' }} onClick={() => paid(nextIdx)}>
                <Icon name="check" /> {L('دفعت', 'I paid')}
              </button>
              <button className="btn block" style={{ background: 'rgb(255 255 255 / 16%)', color: 'inherit' }} onClick={() => setProofFor(nextIdx)}>
                <Icon name="upload" /> {L('دفعت مع صورة الإثبات', 'Paid — attach proof')}
              </button>
            </>
          ) : (
            <>
              <span className="muted">{L('أقساطك', 'Your installments')}</span>
              <div className="big">{active ? L('كلها مدفوعة 🎉', 'All paid 🎉') : L('انتهت المتابعة', 'Tracking ended')}</div>
            </>
          )}
        </section>

        <section className="card stack" style={{ gap: 8 }}>
          <div className="row">
            <span className={`pos ${received ? 'done' : 'now'}`}>{num(turnIdx + 1)}</span>
            <div className="grow">
              <div className="small muted">{L('دورك في الاستلام', 'Your payout turn')}</div>
              <b>
                {date(turnDate)} · {relDays(diffDays(today, turnDate))}
              </b>
            </div>
            <b className="num" style={{ color: 'var(--paid)' }}>
              {money(led.units * v.pot, circle.currency)}
            </b>
          </div>
          {received ? (
            <span className="chip s-paid">✓ {L('استلمت دورك', 'Received')}</span>
          ) : (
            active &&
            diffDays(today, turnDate) <= 7 && (
              <button className="btn block soft" onClick={() => attempt(() => A.markReceivedPersonal(circle.id, turnIdx), L('مبروك! سُجّل الاستلام 🎉', 'Congrats! Recorded 🎉'))}>
                <Icon name="wallet" /> {L('استلمت المبلغ ✓', 'I received it ✓')}
              </button>
            )
          )}
        </section>

        <section className="card stack" style={{ gap: 6 }}>
          <div className="row between">
            <b>
              {L('دفعت', 'Paid')} {num(paidCount)} {L('من', 'of')} {num(v.schedule.length)} {L('أقساط', 'installments')}
            </b>
            <span className="small num muted">
              {money(led.paid, circle.currency)} / {money(led.totalCommitment, circle.currency)}
            </span>
          </div>
          <Progress value={(paidCount / v.schedule.length) * 100} />
          {led.arrears > 0 && (
            <div className="error small">
              {L('عليك متأخرات', 'Arrears')}: {money(led.arrears, circle.currency)}
            </div>
          )}
        </section>

        <section className="card list">
          {v.schedule.map((cy, i) => {
            const cell = row.cells[i];
            return (
              <div className="item" key={i}>
                <span className={`pos ${i === turnIdx ? 'now' : cell.status === 'paid' ? 'done' : ''}`}>{num(i + 1)}</span>
                <div className="grow">
                  <div className="small">{date(cy.dueDate)}</div>
                  {i === turnIdx && <div className="tiny" style={{ color: 'var(--gold)' }}>🎯 {L('دورك', 'Your turn')}</div>}
                </div>
                {cell.status !== 'paid' && active && (cy.dueDate <= addDays(today, 31) || cell.status === 'late') ? (
                  <button className={`btn sm ${cell.status === 'late' ? 'danger' : 'soft'}`} onClick={() => paid(i)}>
                    {L('✓ دفعت', '✓ Paid')}
                  </button>
                ) : (
                  <StatusChip s={cell.status} />
                )}
              </div>
            );
          })}
        </section>

        <section className="card stack" style={{ gap: 6 }}>
          <div className="small muted">
            {money(circle.installment * led.units, circle.currency)} · {freqLabel(circle.frequency)} · {num(circle.sharesCount)} {L('أسهم', 'shares')}
            {led.units === 0.5 && ` · ${L('نصف سهم', 'half share')}`}
          </div>
          {circle.organizerName && (
            <div className="small">
              {L('المنظِّم', 'Organizer')}: <b>{circle.organizerName}</b>
            </div>
          )}
          {circle.organizerPhone && (
            <button className="btn whatsapp block" onClick={() => openLink(waLink(circle.organizerPhone, L('السلام عليكم 🌿', 'Hi 🌿')))}>
              <Icon name="whatsapp" /> {L('مراسلة المنظِّم', 'Message organizer')}
            </button>
          )}
          {active && (
            <button className="btn ghost block" onClick={() => setEnd(true)}>
              {L('إنهاء المتابعة', 'Stop tracking')}
            </button>
          )}
        </section>
      </main>
      {proofFor !== null && <PaySheet open onClose={() => setProofFor(null)} circleId={circle.id} memberId={me.id} cycleIndex={proofFor} />}
      <ReasonSheet
        open={end}
        onClose={() => setEnd(false)}
        title={L('إنهاء متابعة الجمعية', 'Stop tracking')}
        placeholder={L('السبب، مثلاً: انتهت الجمعية أو انسحبت', 'Reason')}
        confirmText={L('إنهاء', 'End')}
        danger
        onSubmit={(r) => attempt(() => A.terminateCircle(circle.id, r), L('أُنهيت المتابعة', 'Ended')) && (setEnd(false), go('/'))}
      />
    </>
  );
}

/** نموذج من شاشة واحدة لبدء متابعة جمعية أنا عضو فيها */
export function PersonalForm() {
  const db = useDB();
  const me = db.users.find((u) => u.id === db.currentUserId)!;
  const [name, setName] = useState('');
  const [installment, setInstallment] = useState('1000');
  const [currency, setCurrency] = useState(() => sessionStorage.getItem('jamiyati:currency') || (me.phone.startsWith('20') ? 'EGP' : 'SAR'));
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [shares, setShares] = useState('10');
  const [turn, setTurn] = useState('1');
  const [units, setUnits] = useState<1 | 0.5>(1);
  const [orgName, setOrgName] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const n = Number(shares) || 0;
  const inst = Number(installment) || 0;

  return (
    <div className="stack">
      <div className="card stack">
        <Field label={L('اسم الجمعية', 'Circle name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('مثال: جمعية العمل', 'e.g. Work circle')} autoFocus />
        </Field>
        <div className="grid2">
          <Field label={L('قسط السهم', 'Installment')}>
            <input className="input num" inputMode="decimal" value={installment} onChange={(e) => setInstallment(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
          <Field label={L('العملة', 'Currency')}>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {L(c.ar, c.en)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={L('الدورية', 'Frequency')}>
          <Seg value={frequency} onChange={setFrequency} options={(['weekly', 'biweekly', 'monthly'] as Frequency[]).map((f) => ({ v: f, t: freqLabel(f) }))} />
        </Field>
        <Field label={L('تاريخ أول قسط', 'First due date')} hint={L('حتى لو كان في الماضي — سنحسب ما فات', 'Can be in the past')}>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label={L('عدد الأسهم', 'Number of shares')}>
            <input className="input num" inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label={L('رقم دوري', 'My turn #')}>
            <input className="input num" inputMode="numeric" value={turn} onChange={(e) => setTurn(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <Field label={L('سهمي', 'My share')}>
          <Seg value={units} onChange={setUnits} options={[{ v: 1, t: L('سهم كامل', 'Full') }, { v: 0.5, t: L('نصف سهم', 'Half') }]} />
        </Field>
      </div>
      <div className="card stack">
        <div className="small muted">{L('اختياري — لإرسال "حوّلت" للمنظِّم بضغطة', 'Optional — to message the organizer in one tap')}</div>
        <div className="grid2">
          <input className="input" placeholder={L('اسم المنظِّم', 'Organizer name')} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <input className="input ltr num" inputMode="tel" placeholder="9665xxxxxxxx" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
        </div>
      </div>
      {inst > 0 && n >= 2 && (
        <div className="note small">
          {L('قسطك', 'You pay')} <b className="num">{money(inst * units, currency)}</b> · {L('تستلم', 'you receive')} <b className="num">{money(inst * n * units, currency)}</b> {L('في الدور', 'on turn')} {num(Number(turn) || 1)}
        </div>
      )}
      <button
        className="btn block"
        disabled={!name.trim() || !(inst > 0) || n < 2}
        onClick={() =>
          attempt(() => {
            const id = A.createPersonalCircle({ name, installment: inst, currency, frequency, startDate, sharesCount: n, myTurn: Number(turn) || 1, units, organizerName: orgName, organizerPhone: orgPhone });
            go(`/c/${id}`, true);
          }, L('بدأت المتابعة — سنذكّرك قبل كل قسط 🔔', 'Tracking started — we will remind you 🔔'))
        }
      >
        <Icon name="check" /> {L('ابدأ المتابعة', 'Start tracking')}
      </button>
    </div>
  );
}
