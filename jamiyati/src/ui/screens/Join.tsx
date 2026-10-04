import { useState } from 'react';
import { buildSchedule, potAmount } from '../../domain/calc';
import { L } from '../../lib/i18n';
import { date, freqLabel, money, num } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { Icon } from '../components/Icon';
import { attempt, Empty, Field, Seg, TopBar } from '../components/ui';
import { go } from '../router';

export function Join({ code: initial }: { code?: string }) {
  const db = useDB();
  const [code, setCode] = useState(initial ?? '');
  const [units, setUnits] = useState(1);
  const [agree, setAgree] = useState(false);
  const c = code.length >= 4 ? db.circles.find((x) => x.inviteCode === code.trim().toUpperCase()) : undefined;
  const organizer = c && db.users.find((u) => u.id === c.organizerId);
  const already = c && db.members.some((m) => m.circleId === c.id && m.userId === db.currentUserId && m.status === 'active');
  const taken = c ? db.shares.filter((s) => s.circleId === c.id).reduce((a, s) => a + s.holders.reduce((b, h) => b + h.fraction, 0), 0) : 0;

  return (
    <>
      <TopBar title={L('الانضمام إلى جمعية', 'Join a circle')} backTo="/" />
      <main>
        <div className="card stack">
          <Field label={L('كود الدعوة', 'Invite code')} hint={L('اطلبه من المنظِّم، أو امسح رمز QR بكاميرا جوالك', 'Ask the organizer, or scan the QR with your camera')}>
            <input className="input ltr code" style={{ textAlign: 'center' }} maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoFocus={!initial} />
          </Field>
        </div>
        {code.length >= 4 && !c && (
          <div className="card">
            <Empty icon="alert" title={L('لم نجد جمعية بهذا الكود', 'No circle with this code')} text={L('تأكد من الحروف والأرقام، أو اطلب رابطاً جديداً من المنظِّم.', 'Check the code or ask the organizer for a new link.')} />
          </div>
        )}
        {c && (
          <>
            <div className="card stack" style={{ gap: 6 }}>
              <h2>{c.name}</h2>
              <div className="muted small">
                {L('المنظِّم', 'Organizer')}: {organizer?.name}
              </div>
              <div className="grid2">
                <div className="stat">
                  <div className="label">{L('القسط', 'Installment')}</div>
                  <div className="value num">{money(c.installment, c.currency)}</div>
                  <div className="tiny muted">{freqLabel(c.frequency)}</div>
                </div>
                <div className="stat">
                  <div className="label">{L('مبلغ الاستلام', 'Payout')}</div>
                  <div className="value num">{money(potAmount(c), c.currency)}</div>
                </div>
                <div className="stat">
                  <div className="label">{L('البداية', 'Starts')}</div>
                  <div className="value" style={{ fontSize: '1rem' }}>
                    {date(c.startDate)}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{L('الأسهم المتاحة', 'Shares left')}</div>
                  <div className="value num">
                    {num(Math.max(0, c.sharesCount - taken))} / {num(c.sharesCount)}
                  </div>
                </div>
              </div>
              <div className="small muted">
                {L('آخر دورة', 'Last cycle')}: {date(buildSchedule(c).at(-1)!.dueDate)}
              </div>
            </div>
            {c.status !== 'draft' ? (
              <div className="warn">{L('هذه الجمعية بدأت ولا تقبل أعضاء جدداً. يمكن للمنظِّم إضافتك كبديل لعضو منسحب.', 'This circle has started. The organizer can add you as a replacement.')}</div>
            ) : already ? (
              <button className="btn block" onClick={() => go(`/c/${c.id}`)}>
                {L('أنت عضو بالفعل — افتح الجمعية', 'Already a member — open')}
              </button>
            ) : (
              <div className="card stack">
                <Field label={L('كم سهماً تريد؟', 'How many shares?')}>
                  <Seg value={units} onChange={setUnits} options={[{ v: 0.5, t: L('نصف سهم', 'Half') }, { v: 1, t: L('سهم', '1') }, { v: 2, t: L('سهمان', '2') }]} />
                </Field>
                <div className="small">
                  {L('قسطك في كل دورة', 'Your installment per cycle')}: <b className="num">{money(c.installment * units, c.currency)}</b> · {L('تستلم', 'You receive')}{' '}
                  <b className="num">{money(potAmount(c) * units, c.currency)}</b>
                </div>
                <h3 style={{ marginBottom: 0 }}>{L('قواعد الجمعية', 'Circle rules')}</h3>
                <div className="note" style={{ whiteSpace: 'pre-wrap' }}>
                  {c.rules || L('لا توجد قواعد مكتوبة.', 'No written rules.')}
                </div>
                <label className="check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>{L('قرأت القواعد وأوافق عليها، وأفهم أن التطبيق لا يحتفظ بالأموال وأن الدفع بين الأعضاء مباشرة.', 'I accept the rules and understand the app never holds money.')}</span>
                </label>
                <button
                  className="btn block"
                  disabled={!agree}
                  onClick={() =>
                    attempt(() => {
                      const id = A.joinByCode(c.inviteCode, units);
                      go(`/c/${id}`, true);
                    }, L('انضممت إلى الجمعية 🎉', 'Joined 🎉'))
                  }
                >
                  <Icon name="check" /> {L('انضمام', 'Join')}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
