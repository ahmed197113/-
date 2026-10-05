// معالج إنشاء جمعية في 4 خطوات قصيرة بقيم افتراضية ذكية — أقل من دقيقة
import { useMemo, useState } from 'react';
import { buildSchedule, durationDays, endDate, potAmount } from '../../domain/calc';
import { addDays, todayISO } from '../../domain/dates';
import type { Frequency } from '../../domain/types';
import { L } from '../../lib/i18n';
import { CURRENCIES, date, freqLabel, money, num } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { Icon } from '../components/Icon';
import { attempt, Field, Seg } from '../components/ui';
import { back, go, useRoute } from '../router';
import { PersonalForm } from './Personal';
import { QuickPeople } from '../components/QuickPeople';
import { countryOf, toIntl } from '../../lib/people';

const DEFAULT_RULES_AR = `١. يُدفع القسط في موعده، ومهلة السماح المحددة للظروف فقط.
٢. يُرفع إثبات التحويل في التطبيق لكل دفعة.
٣. من يستلم دوره يلتزم بالسداد حتى نهاية الجمعية.
٤. تبديل الأدوار بموافقة الطرفين والمنظِّم.
٥. لا فوائد ولا رسوم — الجمعية تعاون وأمانة.`;
const DEFAULT_RULES_EN = `1. Pay on time; the grace period is for emergencies only.
2. Upload a transfer proof for every payment.
3. Whoever receives their payout keeps paying until the end.
4. Turn swaps need both members and the organizer to agree.
5. No interest and no fees.`;

function OrganizerWizard() {
  const db = useDB();
  const me = db.users.find((u) => u.id === db.currentUserId)!;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [installment, setInstallment] = useState('1000');
  const [currency, setCurrency] = useState(() => sessionStorage.getItem('jamiyati:currency') || (me.phone.startsWith('20') ? 'EGP' : 'SAR'));
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [shares, setShares] = useState(10);
  const [orgUnits, setOrgUnits] = useState(1);
  const [startDate, setStartDate] = useState(addDays(todayISO(), 7));
  const [grace, setGrace] = useState(3);
  const [rules, setRules] = useState(L(DEFAULT_RULES_AR, DEFAULT_RULES_EN));
  const [members, setMembers] = useState<{ name: string; phone: string; units: number }[]>([]);
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');

  const inst = Number(installment) || 0;
  const preview = useMemo(() => {
    const c = { startDate, frequency, sharesCount: shares, graceDays: grace, postponements: [], installment: inst };
    return { pot: potAmount(c), end: endDate(c), days: durationDays(c), schedule: buildSchedule(c) };
  }, [startDate, frequency, shares, grace, inst]);
  const usedUnits = orgUnits + members.reduce((a, m) => a + m.units, 0);

  const steps = [L('الأساسيات', 'Basics'), L('الأسهم والمواعيد', 'Shares & dates'), L('الأعضاء', 'Members'), L('القواعد والتأكيد', 'Rules & confirm')];
  const canNext = step === 0 ? name.trim() && inst > 0 : step === 1 ? shares >= 2 && startDate : true;

  const create = () =>
    attempt(() => {
      const id = A.createCircle({ name, installment: inst, currency, frequency, startDate, graceDays: grace, sharesCount: shares, rules, organizerUnits: orgUnits, members });
      go(`/c/${id}?tab=members&invite=1`, true);
    }, L('أُنشئت الجمعية 🎉 ادعُ الأعضاء الآن', 'Circle created 🎉 Invite members now'));

  return (
    <>
      <header className="top">
        <button className="icon-btn" onClick={() => (step ? setStep(step - 1) : back())} aria-label={L('رجوع', 'Back')}>
          <Icon name="back" className="flip" />
        </button>
        <h1>{L('جمعية جديدة', 'New circle')}</h1>
        <span className="small muted">
          {num(step + 1)}/{num(4)}
        </span>
      </header>
      <main>
        <div className="steps" aria-hidden="true">
          {steps.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <h2 style={{ margin: 0 }}>{steps[step]}</h2>

        {step === 0 && (
          <div className="card stack">
            <Field label={L('اسم الجمعية', 'Circle name')}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('مثال: جمعية الأصدقاء', 'e.g. Friends circle')} autoFocus />
            </Field>
            <div className="grid2">
              <Field label={L('قيمة القسط للسهم', 'Installment per share')}>
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
            <Field label={L('دورية الدفع', 'Frequency')}>
              <Seg value={frequency} onChange={setFrequency} options={(['weekly', 'biweekly', 'monthly'] as Frequency[]).map((f) => ({ v: f, t: freqLabel(f) }))} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="card stack">
            <Field label={L('عدد الأسهم (= عدد الدورات)', 'Number of shares (= cycles)')}>
              <div className="row">
                <button className="btn ghost" onClick={() => setShares(Math.max(2, shares - 1))} aria-label={L('إنقاص', 'Decrease')}>
                  −
                </button>
                <input className="input num grow" style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 800 }} inputMode="numeric" value={shares} onChange={(e) => setShares(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} />
                <button className="btn ghost" onClick={() => setShares(shares + 1)} aria-label={L('زيادة', 'Increase')}>
                  +
                </button>
              </div>
            </Field>
            <Field label={L('أسهمك أنت كمنظِّم', 'Your own shares')} hint={L('نصف السهم: تتشارك مع شخص آخر القسط والاستلام', 'Half share: split the installment and payout with someone')}>
              <Seg value={orgUnits} onChange={setOrgUnits} options={[{ v: 0, t: L('لا أشارك', 'None') }, { v: 0.5, t: L('نصف', 'Half') }, { v: 1, t: '1' }, { v: 2, t: '2' }]} />
            </Field>
            <div className="grid2">
              <Field label={L('أول موعد دفع', 'First due date')}>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label={L('مهلة السماح (أيام)', 'Grace (days)')}>
                <input className="input num" inputMode="numeric" value={grace} onChange={(e) => setGrace(Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 0))} />
              </Field>
            </div>
            <div className="note stack" style={{ gap: 4 }}>
              <b>{L('حسبناها لك:', 'Calculated for you:')}</b>
              <span>
                💰 {L('مبلغ الاستلام لكل دور', 'Payout per turn')}: <b className="num">{money(preview.pot, currency)}</b>
              </span>
              <span>
                📅 {L('المدة', 'Duration')}: <b className="num">{num(shares)}</b> {L('دورات', 'cycles')} ({L('حوالي', '~')} <b className="num">{num(Math.round(preview.days / 30.4))}</b> {L('شهر', 'months')})
              </span>
              <span>
                🏁 {L('آخر دورة', 'Last cycle')}: <b>{date(preview.end)}</b>
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card stack">
            <div className="small muted">{L('أضف الأعضاء الآن أو لاحقاً. الأسرع: من جهات الاتصال أو لصق قائمة الأسماء من مجموعة واتساب.', 'Add members now or later — fastest: from contacts or paste names from your WhatsApp group.')}</div>
            <QuickPeople country={countryOf(me.phone)} onAdd={(people) => setMembers((prev) => [...prev, ...people])} />
            <div className="row between small">
              <span>
                {L('الأسهم المحجوزة', 'Shares taken')}: <b className="num">{num(usedUnits)}</b> / {num(shares)}
              </span>
              {usedUnits > shares && <span className="chip s-late">{L('أكثر من العدد — سيُزاد تلقائياً', 'Over — will increase')}</span>}
            </div>
            <div className="list">
              {members.map((m, i) => (
                <div className="item" key={i}>
                  <span className="avatar sm">{m.name[0]}</span>
                  <span className="grow">
                    <b>{m.name}</b>
                    <div className="tiny muted num" dir="ltr" style={{ textAlign: 'start' }}>
                      {m.phone ? '+' + m.phone : '—'}
                    </div>
                  </span>
                  <select className="input" style={{ width: 96, minHeight: 42, padding: 6 }} value={m.units} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, units: Number(e.target.value) } : x)))} aria-label={L('الأسهم', 'Shares')}>
                    <option value={0.5}>{L('نصف', '½')}</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                  <button className="icon-btn" onClick={() => setMembers(members.filter((_, j) => j !== i))} aria-label={L('حذف', 'Remove')}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid2">
              <input className="input" placeholder={L('الاسم', 'Name')} value={mName} onChange={(e) => setMName(e.target.value)} />
              <input className="input ltr num" inputMode="tel" placeholder="05xxxxxxxx" value={mPhone} onChange={(e) => setMPhone(e.target.value)} />
            </div>
            <button
              className="btn soft block"
              disabled={!mName.trim()}
              onClick={() => {
                setMembers([...members, { name: mName.trim(), phone: toIntl(mPhone, countryOf(me.phone)), units: 1 }]);
                setMName('');
                setMPhone('');
              }}
            >
              <Icon name="plus" /> {L('إضافة عضو', 'Add member')}
            </button>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="card stack">
              <Field label={L('قواعد الجمعية', 'Circle rules')} hint={L('يوافق عليها كل عضو عند الانضمام', 'Every member accepts these when joining')}>
                <textarea className="input" style={{ minHeight: 170 }} value={rules} onChange={(e) => setRules(e.target.value)} />
              </Field>
            </div>
            <div className="card stack" style={{ gap: 6 }}>
              <h3>{L('المراجعة', 'Review')}</h3>
              <Line k={L('الاسم', 'Name')} v={name} />
              <Line k={L('القسط', 'Installment')} v={`${money(inst, currency)} · ${freqLabel(frequency)}`} />
              <Line k={L('الأسهم', 'Shares')} v={num(shares)} />
              <Line k={L('مبلغ الاستلام', 'Payout')} v={money(preview.pot, currency)} />
              <Line k={L('من — إلى', 'From — to')} v={`${date(startDate)} — ${date(preview.end)}`} />
              <Line k={L('مهلة السماح', 'Grace')} v={`${num(grace)} ${L('أيام', 'days')}`} />
              <Line k={L('الأعضاء المضافون', 'Members added')} v={num(members.length + 1)} />
            </div>
          </>
        )}

        <div className="btns" style={{ marginTop: 4 }}>
          {step < 3 ? (
            <button className="btn block" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 2 && members.length === 0 ? L('تخطٍّ — سأدعوهم لاحقاً', 'Skip — invite later') : L('التالي', 'Next')}
            </button>
          ) : (
            <button className="btn block" onClick={create}>
              <Icon name="check" /> {L('إنشاء الجمعية', 'Create circle')}
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="row between">
      <span className="muted">{k}</span>
      <b className="num" style={{ textAlign: 'end' }}>
        {v}
      </b>
    </div>
  );
}

/** نقطة البداية: هل أنت المنظِّم أم عضو تتابع أقساطك؟ */
export function Wizard() {
  const { query } = useRoute();
  const type = query.get('type');
  if (type === 'organized') return <OrganizerWizard />;
  if (type === 'personal')
    return (
      <>
        <header className="top">
          <button className="icon-btn" onClick={() => back()} aria-label={L('رجوع', 'Back')}>
            <Icon name="back" className="flip" />
          </button>
          <h1>{L('متابعة جمعية أنا عضو فيها', 'Track a circle I belong to')}</h1>
        </header>
        <main>
          <PersonalForm />
        </main>
      </>
    );
  return (
    <>
      <header className="top">
        <button className="icon-btn" onClick={() => back()} aria-label={L('رجوع', 'Back')}>
          <Icon name="back" className="flip" />
        </button>
        <h1>{L('جمعية جديدة', 'New circle')}</h1>
      </header>
      <main>
        <h2 style={{ margin: '4px 0' }}>{L('ما دورك في الجمعية؟', 'What is your role?')}</h2>
        <button className="card choice" onClick={() => go('/new?type=organized', true)}>
          <span className="choice-ic">👑</span>
          <span className="grow">
            <b>{L('أنا المنظِّم', "I'm the organizer")}</b>
            <span className="small muted">{L('أُنشئ الجمعية وأضيف الأعضاء وأُجري القرعة وأسجّل من دفع.', 'Create the circle, add members, run the lottery, track who paid.')}</span>
          </span>
          <Icon name="next" className="flip" />
        </button>
        <button className="card choice" onClick={() => go('/new?type=personal', true)}>
          <span className="choice-ic">🙋</span>
          <span className="grow">
            <b>{L('أنا عضو في جمعية', "I'm a member")}</b>
            <span className="small muted">{L('أتابع أقساطي ومتى دوري، وأحصل على تذكير قبل كل قسط.', 'Track my installments and turn, with reminders.')}</span>
          </span>
          <Icon name="next" className="flip" />
        </button>
      </main>
    </>
  );
}
