import { L } from '../../lib/i18n';
import { date, dateTime, methodLabel, money, num } from '../../lib/format';
import { renderReceiptPNG } from '../../lib/receipt';
import { shareOrDownload } from '../../lib/image';
import { waLink } from '../../lib/whatsapp';
import { useDB } from '../../store/db';
import { roleIn } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { Empty, TopBar, toastError } from '../components/ui';

export function Receipt({ paymentId }: { paymentId: string }) {
  const db = useDB();
  const p = db.payments.find((x) => x.id === paymentId);
  const c = p && db.circles.find((x) => x.id === p.circleId);
  const allowed = c && roleIn(db, c.id, db.currentUserId);
  if (!p || !c || !allowed || p.status !== 'confirmed') {
    return (
      <>
        <TopBar title={L('الإيصال', 'Receipt')} backTo="/" />
        <main>
          <Empty icon="receipt" title={L('الإيصال غير متاح', 'Receipt unavailable')} text={L('الإيصالات تصدر للدفعات المؤكدة فقط.', 'Receipts are issued for confirmed payments only.')} />
        </main>
      </>
    );
  }
  const member = db.members.find((m) => m.id === p.memberId)!;
  const reviewer = db.users.find((u) => u.id === p.reviewedBy)?.name ?? '—';
  const watermark = !db.settings.premium;
  const data = {
    receiptNo: p.receiptNo ?? p.id,
    circle: c.name,
    member: member.name,
    amount: money(p.amount, c.currency),
    cycle: `${num(p.cycleIndex + 1)}`,
    paidAt: date(p.paidAt),
    confirmedAt: p.reviewedAt ? dateTime(p.reviewedAt) : '—',
    confirmedBy: reviewer,
    method: methodLabel(p.method),
    watermark,
  };
  const text = L(
    `🧾 إيصال دفعة — ${c.name}\nرقم: ${data.receiptNo}\nالعضو: ${member.name}\nالمبلغ: ${data.amount}\nالدورة: ${data.cycle}\nتاريخ الدفع: ${data.paidAt}\nأكّدها: ${reviewer}`,
    `🧾 Receipt — ${c.name}\nNo: ${data.receiptNo}\nMember: ${member.name}\nAmount: ${data.amount}\nCycle: ${data.cycle}\nPaid: ${data.paidAt}\nConfirmed by: ${reviewer}`,
  );

  return (
    <>
      <TopBar title={L('إيصال دفعة', 'Payment receipt')} backTo={`/c/${c.id}?tab=grid`} />
      <main>
        <article className="receipt">
          {watermark && <div className="wm">{L('جمعيتي', 'Jamiyati')}</div>}
          <div className="row between">
            <b style={{ fontSize: '1.15rem' }}>{L('إيصال دفعة', 'Payment receipt')}</b>
            <span className="num tiny" dir="ltr">
              #{data.receiptNo}
            </span>
          </div>
          <div style={{ textAlign: 'center', margin: '18px 0 6px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900 }} className="num">
              {data.amount}
            </div>
            <span className="chip s-paid">✓ {L('دفعة مؤكدة', 'Confirmed')}</span>
          </div>
          <dl>
            <dt>{L('الجمعية', 'Circle')}</dt>
            <dd>{c.name}</dd>
            <dt>{L('العضو', 'Member')}</dt>
            <dd>{member.name}</dd>
            <dt>{L('الدورة', 'Cycle')}</dt>
            <dd className="num">{data.cycle}</dd>
            <dt>{L('تاريخ الدفع', 'Paid on')}</dt>
            <dd>{data.paidAt}</dd>
            <dt>{L('طريقة الدفع', 'Method')}</dt>
            <dd>{data.method}</dd>
            <dt>{L('أكّدها', 'Confirmed by')}</dt>
            <dd>{reviewer}</dd>
            <dt>{L('وقت التأكيد', 'Confirmed at')}</dt>
            <dd>{data.confirmedAt}</dd>
          </dl>
          <p className="tiny" style={{ color: '#6b827e', marginBottom: 0 }}>
            {L('التطبيق أداة توثيق فقط ولا يحتفظ بالأموال. هذا الإيصال مرتبط بسجل نشاط غير قابل للحذف.', 'Jamiyati documents payments only and never holds money. Linked to a tamper-evident activity log.')}
          </p>
        </article>
        <div className="btns no-print">
          <button
            className="btn"
            onClick={async () => {
              try {
                await shareOrDownload(await renderReceiptPNG(data), `receipt-${data.receiptNo}.png`, L('إيصال دفعة', 'Receipt'));
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <Icon name="share" /> {L('مشاركة كصورة', 'Share image')}
          </button>
          <button className="btn soft" onClick={() => window.print()}>
            <Icon name="download" /> PDF
          </button>
          <a className="btn whatsapp" href={waLink(member.phone, text)} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" /> {L('واتساب', 'WhatsApp')}
          </a>
        </div>
        {watermark && <div className="tiny muted no-print">{L('تُزال العلامة المائية في الخطة المميزة.', 'Watermark is removed on Premium.')}</div>}
      </main>
    </>
  );
}
