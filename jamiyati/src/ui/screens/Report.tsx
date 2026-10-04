// التقرير النهائي للجمعية — يُطبع أو يُحفظ PDF عبر نافذة الطباعة (يدعم العربية بالكامل)
import { useState } from 'react';
import { finalSettlement } from '../../domain/calc';
import { todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, dateTime, freqLabel, money, num } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB, verifyLog } from '../../store/db';
import { circleView, cycleSummary, ledgerFor, lineage, roleIn } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { Sheet, TopBar } from '../components/ui';
import { printPage } from '../../lib/native';

const MARK: Record<string, string> = { paid: '✓', pending: '…', late: '✗', partial: '½', due: '•', upcoming: '', none: '' };

export function Report({ circleId }: { circleId: string }) {
  const db = useDB();
  const today = todayISO();
  const v = circleView(db, circleId, today);
  const role = roleIn(db, circleId, db.currentUserId);
  const [upsell, setUpsell] = useState(false);
  if (!v || !role) return null;
  const { circle } = v;
  const log = db.log.filter((e) => e.circleId === circleId);
  const intact = verifyLog(log) === -1;
  const payouts = db.payouts.filter((p) => p.circleId === circleId).sort((a, b) => a.cycleIndex - b.cycleIndex);
  const ids = v.rows.map((r) => r.member.id);
  const toCurrent = (id: string) => v.rows.find((r) => lineage(db, r.member.id).includes(id))?.member.id ?? id;
  const settle = finalSettlement(
    ids,
    db.payments.filter((p) => p.circleId === circleId).map((p) => ({ ...p, memberId: toCurrent(p.memberId) })),
    payouts.map((p) => ({ ...p, memberId: toCurrent(p.memberId) })),
  );
  const totalConfirmed = settle.totalPaid;
  const print = () => (db.settings.premium ? printPage(circle.name) : setUpsell(true));

  return (
    <>
      <TopBar
        title={L('تقرير الجمعية', 'Circle report')}
        backTo={`/c/${circleId}?tab=more`}
        actions={
          <button className="icon-btn" onClick={print} aria-label="PDF">
            <Icon name="download" />
          </button>
        }
      />
      <main>
        <article className="report stack">
          <div className="row between">
            <div>
              <h2 style={{ margin: 0 }}>{circle.name}</h2>
              <div className="small" style={{ color: '#5b7470' }}>
                {L('تقرير صادر في', 'Issued')} {dateTime(new Date().toISOString())}
              </div>
            </div>
            <b style={{ color: '#0f766e' }}>{L('جمعيتي', 'Jamiyati')}</b>
          </div>
          <table>
            <tbody>
              <tr>
                <th>{L('القسط', 'Installment')}</th>
                <td>
                  {money(circle.installment, circle.currency)} · {freqLabel(circle.frequency)}
                </td>
                <th>{L('مبلغ الاستلام', 'Payout')}</th>
                <td>{money(v.pot, circle.currency)}</td>
              </tr>
              <tr>
                <th>{L('الأسهم', 'Shares')}</th>
                <td>{num(circle.sharesCount)}</td>
                <th>{L('الحالة', 'Status')}</th>
                <td>{circle.status}</td>
              </tr>
              <tr>
                <th>{L('البداية', 'Start')}</th>
                <td>{date(v.schedule[0].dueDate)}</td>
                <th>{L('النهاية', 'End')}</th>
                <td>{date(v.schedule.at(-1)!.dueDate)}</td>
              </tr>
              <tr>
                <th>{L('إجمالي المحصّل المؤكد', 'Total confirmed')}</th>
                <td>{money(totalConfirmed, circle.currency)}</td>
                <th>{L('إجمالي المسلّم', 'Total paid out')}</th>
                <td>{money(settle.totalReceived, circle.currency)}</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginBottom: 0 }}>{L('الأعضاء', 'Members')}</h3>
          <table>
            <thead>
              <tr>
                <th>{L('العضو', 'Member')}</th>
                <th>{L('الأسهم', 'Shares')}</th>
                <th>{L('الدور', 'Turn')}</th>
                <th>{L('دفع', 'Paid')}</th>
                <th>{L('استلم', 'Received')}</th>
                <th>{L('متأخرات', 'Arrears')}</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => {
                const l = ledgerFor(db, v, r.member.id, today);
                return (
                  <tr key={r.member.id}>
                    <td style={{ textAlign: 'start' }}>{r.member.name}</td>
                    <td>{num(r.units)}</td>
                    <td>{r.positions.map((p) => num(p)).join('، ')}</td>
                    <td>{num(l.paid)}</td>
                    <td>{num(l.received)}</td>
                    <td style={{ color: l.arrears ? '#b91c1c' : undefined }}>{num(l.arrears)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ marginBottom: 0 }}>{L('شبكة الدفعات', 'Payment grid')}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{L('العضو', 'Member')}</th>
                  {v.schedule.map((c) => (
                    <th key={c.index}>{num(c.index + 1)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.rows.map((r) => (
                  <tr key={r.member.id}>
                    <td style={{ textAlign: 'start', whiteSpace: 'nowrap' }}>{r.member.name}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} style={{ color: c.status === 'late' ? '#b91c1c' : c.status === 'paid' ? '#15803d' : undefined }}>
                        {MARK[c.status]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tiny" style={{ color: '#5b7470' }}>
            ✓ {L('مدفوع', 'paid')} · … {L('بانتظار التأكيد', 'pending')} · ✗ {L('متأخر', 'late')} · ½ {L('جزئي', 'partial')} · • {L('مستحق', 'due')}
          </div>

          <h3 style={{ marginBottom: 0 }}>{L('التسليمات', 'Payouts')}</h3>
          <table>
            <thead>
              <tr>
                <th>{L('الدورة', 'Cycle')}</th>
                <th>{L('المستلم', 'Recipient')}</th>
                <th>{L('المبلغ', 'Amount')}</th>
                <th>{L('التسليم', 'Delivered')}</th>
                <th>{L('تأكيد المستلم', 'Confirmed')}</th>
              </tr>
            </thead>
            <tbody>
              {v.schedule.map((c) => {
                const s = cycleSummary(v, c.index);
                const ps = payouts.filter((p) => p.cycleIndex === c.index);
                return (
                  <tr key={c.index}>
                    <td>{num(c.index + 1)}</td>
                    <td style={{ textAlign: 'start' }}>{s.recipients.map((r) => r.name).join(' و')}</td>
                    <td>{num(ps.reduce((a, p) => a + p.amount, 0))}</td>
                    <td>{ps[0] ? date(ps[0].deliveredAt.slice(0, 10)) : '—'}</td>
                    <td>{ps.length && ps.every((p) => p.recipientConfirmedAt) ? '✓' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {circle.status === 'terminated' && (
            <>
              <h3 style={{ marginBottom: 0 }}>{L('التسوية النهائية', 'Final settlement')}</h3>
              <table>
                <tbody>
                  {settle.lines.map((l) => (
                    <tr key={l.memberId}>
                      <td style={{ textAlign: 'start' }}>{v.members.find((m) => m.id === l.memberId)?.name}</td>
                      <td>{l.net >= 0 ? L('له', 'gets') : L('عليه', 'owes')}</td>
                      <td>{money(Math.abs(l.net), circle.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="small" style={{ color: '#5b7470' }}>
            {L('سجل النشاط', 'Activity log')}: {num(log.length)} {L('قيداً', 'entries')} · {intact ? L('السلسلة سليمة ✓', 'chain intact ✓') : L('تحذير: عبث بالسجل', 'tampered!')} · {L('آخر تجزئة', 'last hash')} <span dir="ltr">{log.at(-1)?.hash}</span>
          </div>
          <div className="tiny" style={{ color: '#5b7470' }}>
            {L('جمعيتي أداة تنظيم وتوثيق؛ لا تحتفظ بأموال ولا فوائد.', 'Jamiyati organizes and documents; no money held, no interest.')}
          </div>
        </article>
        <button className="btn block no-print" onClick={print}>
          <Icon name="download" /> {L('حفظ PDF / طباعة', 'Save PDF / print')}
        </button>
      </main>
      <Sheet open={upsell} onClose={() => setUpsell(false)} title={L('تقارير PDF — الخطة المميزة', 'PDF reports — Premium')}>
        <div className="stack">
          <div>{L('تصدير التقارير PDF متاح في الخطة المميزة للمنظِّمين، مع جمعيات وأعضاء بلا حد، وإيصالات بلا علامة مائية.', 'PDF export is part of Premium, with unlimited circles and members and unbranded receipts.')}</div>
          <button
            className="btn block"
            onClick={() => {
              A.updateSettings({ premium: true });
              setUpsell(false);
              setTimeout(() => printPage(circle.name), 300);
            }}
          >
            {L('تفعيل المميز (تجريبي) والطباعة', 'Enable Premium (demo) & print')}
          </button>
        </div>
      </Sheet>
    </>
  );
}
