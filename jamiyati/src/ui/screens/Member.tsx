import { useState } from 'react';
import { withdrawalSettlement } from '../../domain/calc';
import { todayISO } from '../../domain/dates';
import type { PaymentMethod } from '../../domain/types';
import { L } from '../../lib/i18n';
import { date, displayPhone, maskPhone, methodLabel, money, num, unitsLabel } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { canConfirm, circleView, ledgerFor, phoneVisible, roleIn, userReliability } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { PaySheet, ReputationLine, WhatsAppSheet } from '../components/sheets';
import { attempt, Avatar, Empty, Field, Seg, Sheet, StatusChip, TopBar } from '../components/ui';
import { roleLabel } from './Home';

/** كشف حساب نصي للعضو يُرسل عبر واتساب (لمن لا يملك التطبيق) */
function statementText(v: NonNullable<ReturnType<typeof circleView>>, row: NonNullable<ReturnType<typeof circleView>>['rows'][number], led: ReturnType<typeof ledgerFor>) {
  const cur = v.circle.currency;
  const mark: Record<string, string> = { paid: '✅', pending: '⏳', late: '❌', partial: '🟠', due: '🔵', upcoming: '⚪', none: '' };
  const lines = v.schedule
    .filter((cy) => cy.dueDate <= todayISO() || row.cells[cy.index].confirmed > 0)
    .map((cy) => `${mark[row.cells[cy.index].status]} ${L('الدورة', 'Cycle')} ${cy.index + 1} (${date(cy.dueDate)}): ${money(row.cells[cy.index].confirmed, cur)} / ${money(row.cells[cy.index].due, cur)}`);
  const turns = row.positions.map((p) => `${p} — ${date(v.schedule[p - 1]?.dueDate)}`).join('، ');
  return [
    ...lines,
    '',
    `${L('المدفوع', 'Paid')}: ${money(led.paid, cur)}`,
    led.arrears > 0 ? `${L('المتأخرات', 'Arrears')}: ${money(led.arrears, cur)}` : `${L('لا متأخرات', 'No arrears')} 👍`,
    `${L('الباقي حتى نهاية الجمعية', 'Left to pay')}: ${money(led.remainingToPay, cur)}`,
    `🎯 ${L('دورك في الاستلام', 'Your turn')}: ${turns} · ${money(led.units * v.pot, cur)}${led.received ? ` (${L('استلمت', 'received')} ✓)` : ''}`,
  ].join('\n');
}

export function MemberScreen({ circleId, memberId }: { circleId: string; memberId: string }) {
  const db = useDB();
  const today = todayISO();
  const v = circleView(db, circleId, today);
  const role = roleIn(db, circleId, db.currentUserId);
  const m = v?.members.find((x) => x.id === memberId);
  const [pay, setPay] = useState<number | null>(null);
  const [wa, setWa] = useState(false);
  const [edit, setEdit] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  if (!v || !m || !role) {
    return (
      <>
        <TopBar title={L('العضو', 'Member')} backTo={`/c/${circleId}`} />
        <main>
          <Empty icon="user" title={L('العضو غير موجود', 'Member not found')} />
        </main>
      </>
    );
  }
  const organizer = role === 'organizer';
  const staff = canConfirm(role);
  const isSelf = m.userId === db.currentUserId;
  const row = v.rows.find((r) => r.member.id === m.id);
  const led = row ? ledgerFor(db, v, m.id, today) : undefined;
  const u = m.userId ? db.users.find((x) => x.id === m.userId) : undefined;
  const rel = u && u.shareReputation && (organizer || isSelf) ? userReliability(db, u.id, today) : undefined;
  const nextUnpaid = row ? row.cells.findIndex((c) => c.status !== 'paid') : -1;
  const predecessor = m.replacesMemberId ? v.members.find((x) => x.id === m.replacesMemberId) : undefined;
  const successor = v.members.find((x) => x.replacesMemberId === m.id);

  return (
    <>
      <TopBar title={m.name} backTo={`/c/${circleId}?tab=members`} />
      <main>
        <section className="card stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <Avatar name={m.name} />
          <h2 style={{ margin: 0 }}>{m.name}</h2>
          <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
            <span className="chip s-brand">{roleLabel(m.role)}</span>
            {row && <span className="chip">{unitsLabel(row.units)}</span>}
            {m.status === 'withdrawn' && <span className="chip s-late">{L('منسحب', 'Withdrawn')}</span>}
            {!m.userId && <span className="chip">{L('بلا تطبيق — تذكير عبر واتساب', 'No app — WhatsApp reminders')}</span>}
          </div>
          <bdi dir="ltr" className="small muted">
            {phoneVisible(db, db.currentUserId, m) ? displayPhone(m.phone) : maskPhone(m.phone)}
          </bdi>
          {predecessor && <div className="small">{L(`بديل عن ${predecessor.name} ويرث دوره والتزاماته`, `Replaces ${predecessor.name}`)}</div>}
          {successor && <div className="small">{L(`حلّ محله ${successor.name}`, `Replaced by ${successor.name}`)}</div>}
        </section>

        {led && (
          <section className="grid2">
            <div className="stat">
              <div className="label">{L('القسط لكل دورة', 'Per cycle')}</div>
              <div className="value num">{money(led.duePerCycle, v.circle.currency)}</div>
            </div>
            <div className="stat">
              <div className="label">{L('دفع (مؤكد)', 'Paid (confirmed)')}</div>
              <div className="value num">{money(led.paid, v.circle.currency)}</div>
            </div>
            <div className="stat">
              <div className="label">{L('متأخرات', 'Arrears')}</div>
              <div className="value num" style={{ color: led.arrears ? 'var(--late)' : undefined }}>
                {money(led.arrears, v.circle.currency)}
              </div>
            </div>
            <div className="stat">
              <div className="label">{L('باقي حتى النهاية', 'Left to pay')}</div>
              <div className="value num">{money(led.remainingToPay, v.circle.currency)}</div>
            </div>
            <div className="stat">
              <div className="label">{L('استلم', 'Received')}</div>
              <div className="value num">{money(led.received, v.circle.currency)}</div>
            </div>
            <div className="stat">
              <div className="label">{L('سيستلم', 'Will receive')}</div>
              <div className="value num" style={{ color: 'var(--paid)' }}>
                {money(led.expectedToReceive, v.circle.currency)}
              </div>
            </div>
          </section>
        )}

        {row && (
          <section className="card stack" style={{ gap: 4 }}>
            <h3>{L('الجدول', 'Schedule')}</h3>
            {v.schedule.map((cy, i) => (
              <div className="item" key={i} style={{ padding: '8px 0' }}>
                <span className={`pos ${row.positions.includes(i + 1) ? 'now' : ''}`}>{num(i + 1)}</span>
                <div className="grow">
                  <div className="small">{date(cy.dueDate)}</div>
                  {row.positions.includes(i + 1) && <div className="tiny" style={{ color: 'var(--gold)' }}>★ {L('دور الاستلام', 'Payout turn')}</div>}
                </div>
                <span className="small num muted">{row.cells[i].confirmed > 0 && row.cells[i].status !== 'paid' ? money(row.cells[i].confirmed, v.circle.currency) : ''}</span>
                <StatusChip s={row.cells[i].status} />
              </div>
            ))}
          </section>
        )}

        <section className="card stack" style={{ gap: 6 }}>
          <h3>{L('الملف', 'Profile')}</h3>
          <div className="row between small">
            <span className="muted">{L('وسيلة الدفع المفضلة', 'Preferred payment')}</span>
            <b>{methodLabel(m.preferredPayment)}</b>
          </div>
          <div className="row between small">
            <span className="muted">{L('الكفيل / الضامن', 'Guarantor')}</span>
            <b>{m.guarantor ? `${m.guarantor.name}` : '—'}</b>
          </div>
          <div className="row between small">
            <span className="muted">{L('وافق على القواعد', 'Accepted rules')}</span>
            <b>{m.acceptedRulesAt ? date(m.acceptedRulesAt.slice(0, 10)) : L('لم يوافق بعد (بلا تطبيق)', 'Not yet')}</b>
          </div>
          {m.notes && <div className="small">📝 {m.notes}</div>}
          {rel && (
            <>
              <hr />
              <b className="small">{L('سجل الالتزام (عبر كل جمعياته)', 'Reliability (all circles)')}</b>
              <ReputationLine stats={rel} />
            </>
          )}
        </section>

        <div className="stack">
          {v.circle.status === 'active' && row && nextUnpaid >= 0 && (staff || isSelf) && (
            <button className="btn block" onClick={() => setPay(nextUnpaid)}>
              <Icon name="plus" /> {isSelf ? L('دفعت — ارفع الإثبات', 'I paid') : L('تسجيل دفعة', 'Record payment')}
            </button>
          )}
          {staff && !isSelf && (
            <button className="btn whatsapp block" onClick={() => setWa(true)}>
              <Icon name="whatsapp" /> {L('رسالة واتساب', 'WhatsApp message')}
            </button>
          )}
          {(organizer || isSelf) && m.status === 'active' && (
            <button className="btn soft block" onClick={() => setEdit(true)}>
              <Icon name="edit" /> {L('تعديل الملف', 'Edit profile')}
            </button>
          )}
          {organizer && m.role !== 'organizer' && m.status === 'active' && v.circle.status === 'active' && (
            <button className="btn danger block" onClick={() => setWithdraw(true)}>
              {L('انسحاب العضو / استبداله', 'Withdraw / replace')}
            </button>
          )}
          {organizer && m.role !== 'organizer' && v.circle.status === 'draft' && (
            <button className="btn danger block" onClick={() => attempt(() => A.removeMemberBeforeStart(m.id), L('أُزيل العضو', 'Removed')) && history.back()}>
              <Icon name="trash" /> {L('إزالة من الجمعية', 'Remove')}
            </button>
          )}
        </div>
      </main>
      {pay !== null && row && <PaySheet open onClose={() => setPay(null)} circleId={circleId} memberId={m.id} cycleIndex={pay} />}
      {row && (
        <WhatsAppSheet
          open={wa}
          onClose={() => setWa(false)}
          phone={m.phone}
          kinds={nextUnpaid >= 0 ? (row.cells[nextUnpaid].status === 'late' ? ['late', 'statement', 'dueDay', 'before3'] : ['before3', 'dueDay', 'statement', 'late']) : ['statement', 'thanks']}
          vars={{
            name: m.name.split(' ')[0],
            circle: v.circle.name,
            amount: nextUnpaid >= 0 ? row.cells[nextUnpaid].remaining : row.due,
            currency: v.circle.currency,
            dueDate: v.schedule[Math.max(0, nextUnpaid)].dueDate,
            statement: led ? statementText(v, row, led) : '',
          }}
        />
      )}
      {edit && <EditMember memberId={m.id} organizer={organizer} onClose={() => setEdit(false)} />}
      {withdraw && led && (
        <WithdrawSheet
          circleId={circleId}
          memberId={m.id}
          name={m.name}
          currency={v.circle.currency}
          settlement={withdrawalSettlement(led.paid, led.received, led.units * v.pot)}
          onClose={() => setWithdraw(false)}
        />
      )}
    </>
  );
}

function EditMember({ memberId, organizer, onClose }: { memberId: string; organizer: boolean; onClose: () => void }) {
  const db = useDB();
  const m = db.members.find((x) => x.id === memberId)!;
  const [name, setName] = useState(m.name);
  const [phone, setPhone] = useState(m.phone);
  const [method, setMethod] = useState<PaymentMethod>(m.preferredPayment ?? 'bank');
  const [notes, setNotes] = useState(m.notes ?? '');
  const [gName, setGName] = useState(m.guarantor?.name ?? '');
  const [gPhone, setGPhone] = useState(m.guarantor?.phone ?? '');
  const [assistant, setAssistant] = useState(m.role === 'assistant');
  return (
    <Sheet open onClose={onClose} title={L('تعديل الملف', 'Edit profile')}>
      <div className="stack">
        <Field label={L('الاسم', 'Name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {organizer && !m.userId && (
          <Field label={L('الجوال', 'Phone')}>
            <input className="input ltr num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <Field label={L('وسيلة الدفع المفضلة', 'Preferred payment')}>
          <Seg value={method} onChange={setMethod} options={(['bank', 'wallet', 'cash'] as PaymentMethod[]).map((x) => ({ v: x, t: methodLabel(x) }))} />
        </Field>
        <Field label={L('الكفيل / الضامن (اختياري)', 'Guarantor (optional)')} hint={L('مستحسن لمن يستلم مبكراً', 'Recommended for early recipients')}>
          <div className="grid2">
            <input className="input" placeholder={L('الاسم', 'Name')} value={gName} onChange={(e) => setGName(e.target.value)} />
            <input className="input ltr num" placeholder={L('الجوال', 'Phone')} inputMode="tel" value={gPhone} onChange={(e) => setGPhone(e.target.value.replace(/\D/g, ''))} />
          </div>
        </Field>
        <Field label={L('ملاحظات', 'Notes')}>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {organizer && m.role !== 'organizer' && m.userId && (
          <label className="check">
            <input type="checkbox" checked={assistant} onChange={(e) => setAssistant(e.target.checked)} />
            <span>
              {L('مساعد المنظِّم', 'Organizer assistant')}
              <div className="tiny muted">{L('صلاحية تأكيد الدفعات فقط', 'Can confirm payments only')}</div>
            </span>
          </label>
        )}
        <button
          className="btn block"
          onClick={() =>
            attempt(() => {
              A.updateMember(memberId, {
                name,
                phone,
                preferredPayment: method,
                notes: notes || undefined,
                guarantor: gName.trim() ? { name: gName.trim(), phone: gPhone } : undefined,
                ...(organizer && m.role !== 'organizer' ? { role: assistant ? 'assistant' : 'member' } : {}),
              });
              onClose();
            }, L('حُفظ ✓', 'Saved ✓'))
          }
        >
          {L('حفظ', 'Save')}
        </button>
      </div>
    </Sheet>
  );
}

function WithdrawSheet({ circleId, memberId, name, currency, settlement: s, onClose }: { circleId: string; memberId: string; name: string; currency: string; settlement: ReturnType<typeof withdrawalSettlement>; onClose: () => void }) {
  const [mode, setMode] = useState<'replace' | 'keep'>(s.canBeReplaced ? 'replace' : 'keep');
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  void circleId;
  return (
    <Sheet open onClose={onClose} title={L(`انسحاب ${name}`, `${name} withdraws`)}>
      <div className="stack">
        <div className={s.phase === 'before_payout' ? 'note' : 'warn'}>
          <b>{s.phase === 'before_payout' ? L('لم يستلم دوره بعد', 'Has not received the payout') : L('استلم دوره', 'Already received the payout')}</b>
          <div className="small">{s.explanation}</div>
        </div>
        <div className="card tight stack" style={{ gap: 4 }}>
          {s.refundToMember > 0 && (
            <div className="row between small">
              <span>{L('يُرد له', 'Refund to member')}</span>
              <b className="num" style={{ color: 'var(--paid)' }}>{money(s.refundToMember, currency)}</b>
            </div>
          )}
          {s.owedByMember > 0 && (
            <div className="row between small">
              <span>{L('يبقى عليه سداده', 'Still owes')}</span>
              <b className="num" style={{ color: 'var(--late)' }}>{money(s.owedByMember, currency)}</b>
            </div>
          )}
          {s.canBeReplaced && (
            <div className="row between small">
              <span>{L('يدفعه البديل للمنسحب فوراً', 'Replacement pays the leaver')}</span>
              <b className="num">{money(s.replacementCatchUp, currency)}</b>
            </div>
          )}
        </div>
        {s.canBeReplaced && (
          <Seg value={mode} onChange={setMode} options={[{ v: 'replace', t: L('عضو بديل', 'Replacement') }, { v: 'keep', t: L('انسحاب بلا بديل', 'No replacement') }]} />
        )}
        {mode === 'replace' ? (
          <>
            <Field label={L('اسم البديل', 'Replacement name')}>
              <input className="input" value={rName} onChange={(e) => setRName(e.target.value)} />
            </Field>
            <Field label={L('جوال البديل', 'Replacement phone')}>
              <input className="input ltr num" inputMode="tel" value={rPhone} onChange={(e) => setRPhone(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <div className="small muted">{L('يرث البديل الدور نفسه والتزاماته، وتُحتسب له دفعات المنسحب السابقة.', 'The replacement inherits the turn, obligations and past payments.')}</div>
            <button className="btn block" disabled={!rName.trim()} onClick={() => attempt(() => A.withdrawMember(memberId, { name: rName.trim(), phone: rPhone }), L('تم الاستبدال وسُجل في السجل', 'Replaced')) && onClose()}>
              {L('تأكيد الاستبدال', 'Confirm replacement')}
            </button>
          </>
        ) : (
          <>
            {s.phase === 'before_payout' && <div className="warn small">{L('بلا بديل سيبقى سهمه شاغراً. يُنصح بإيجاد بديل أو أن يتحمله المنظِّم.', 'Without a replacement the share stays vacant.')}</div>}
            <button className="btn danger block" onClick={() => attempt(() => A.withdrawMember(memberId), L('سُجل الانسحاب', 'Withdrawal recorded')) && onClose()}>
              {L('تأكيد الانسحاب', 'Confirm withdrawal')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
