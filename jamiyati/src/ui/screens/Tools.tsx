// أدوات ما قبل الانضمام: حاسبة "هل الجمعية مناسبة لي؟" وتعريف مبسط بالجمعية وآدابها
import { useState } from 'react';
import { monthlyEquivalent, suitability } from '../../domain/calc';
import type { Frequency } from '../../domain/types';
import { L } from '../../lib/i18n';
import { freqLabel, num } from '../../lib/format';
import { useDB } from '../../store/db';
import { Field, Progress, Seg, TopBar } from '../components/ui';

export function Tools() {
  const db = useDB();
  const [tab, setTab] = useState<'calc' | 'guide'>('calc');
  return (
    <>
      <TopBar title={L('أدوات ومعرفة', 'Tools & guide')} backTo={db.currentUserId ? '/' : '/'} />
      <main>
        <Seg value={tab} onChange={setTab} options={[{ v: 'calc', t: L('هل تناسبني؟', 'Is it right for me?') }, { v: 'guide', t: L('ما هي الجمعية؟', 'What is a circle?') }]} />
        {tab === 'calc' ? <Calculator /> : <Guide />}
      </main>
    </>
  );
}

function Calculator() {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [commit, setCommit] = useState('');
  const [inst, setInst] = useState('1000');
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [shares, setShares] = useState('10');
  const n = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;
  const monthly = monthlyEquivalent(n(inst), freq);
  const r = suitability(n(income), n(expenses), n(commit), monthly);
  const ready = n(income) > 0;
  const pot = n(inst) * n(shares);
  const color = r.verdict === 'good' ? 'var(--paid)' : r.verdict === 'tight' ? 'var(--pending)' : 'var(--late)';

  return (
    <>
      <section className="card stack">
        <h2>{L('دخلك ومصاريفك الشهرية', 'Your monthly budget')}</h2>
        <Field label={L('صافي الدخل الشهري', 'Net monthly income')}>
          <input className="input num" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="0" />
        </Field>
        <Field label={L('المصاريف الأساسية (سكن، أكل، مواصلات، فواتير)', 'Essential expenses')}>
          <input className="input num" inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0" />
        </Field>
        <Field label={L('التزامات أخرى (أقساط، جمعيات حالية)', 'Other commitments')}>
          <input className="input num" inputMode="decimal" value={commit} onChange={(e) => setCommit(e.target.value)} placeholder="0" />
        </Field>
      </section>
      <section className="card stack">
        <h2>{L('الجمعية المقترحة', 'The circle')}</h2>
        <div className="grid2">
          <Field label={L('القسط', 'Installment')}>
            <input className="input num" inputMode="decimal" value={inst} onChange={(e) => setInst(e.target.value)} />
          </Field>
          <Field label={L('عدد الأسهم', 'Shares')}>
            <input className="input num" inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} />
          </Field>
        </div>
        <Seg value={freq} onChange={setFreq} options={(['weekly', 'biweekly', 'monthly'] as Frequency[]).map((f) => ({ v: f, t: freqLabel(f) }))} />
        <div className="small muted">
          {L('تستلم', 'You would receive')} <b className="num">{num(pot)}</b> · {L('التزام شهري ≈', 'Monthly ≈')} <b className="num">{num(monthly)}</b>
        </div>
      </section>
      {ready && (
        <section className="card stack" style={{ borderColor: color }}>
          <h2 style={{ color }}>
            {r.verdict === 'good' ? L('✅ مناسبة لك', '✅ A good fit') : r.verdict === 'tight' ? L('⚠️ ممكنة لكنها مُرهقة', '⚠️ Possible but tight') : L('❌ غير مناسبة الآن', '❌ Not right now')}
          </h2>
          <div className="row between small">
            <span>{L('الفائض الشهري بعد المصاريف', 'Monthly surplus')}</span>
            <b className="num">{num(r.surplus)}</b>
          </div>
          <div className="row between small">
            <span>{L('القسط الآمن المقترح (حتى)', 'Suggested safe installment (max)')}</span>
            <b className="num" style={{ color: 'var(--paid)' }}>
              {num(r.recommendedMax)}
            </b>
          </div>
          {Number.isFinite(r.ratio) && (
            <>
              <div className="row between small">
                <span>{L('القسط من فائضك', 'Installment vs surplus')}</span>
                <b className="num">{num(r.ratio)}%</b>
              </div>
              <Progress value={r.ratio} />
            </>
          )}
          <div className="small">
            {r.verdict === 'good'
              ? L('يبقى لك هامش للطوارئ. الجمعية فرصة ممتازة للادخار المنضبط.', 'You keep a buffer for emergencies.')
              : r.verdict === 'tight'
                ? L('القسط يأخذ أكثر من نصف فائضك. فكّر في نصف سهم أو جمعية أقل قسطاً.', 'Consider a half share or a smaller installment.')
                : L('القسط أكبر من فائضك الشهري. التأخر سيحرجك ويضر بقية الأعضاء — اختر نصف سهم أو قسطاً أقل.', 'The installment exceeds your surplus. Choose a half share or smaller installment.')}
          </div>
        </section>
      )}
    </>
  );
}

function Guide() {
  const items: [string, string, string][] = [
    ['🤝', L('ما هي الجمعية؟', 'What is it?'), L('مجموعة أشخاص يدفع كل منهم قسطاً ثابتاً كل دورة (شهر مثلاً)، ويستلم أحدهم المجموع كاملاً حسب ترتيب متفق عليه، حتى يستلم الجميع. هي ادخار وتعاون بلا فوائد.', 'A group where everyone pays a fixed amount each cycle and one member receives the whole pot in turn until everyone has received it. Interest-free saving and mutual help.')],
    ['🧮', L('مثال', 'Example'), L('10 أشخاص × 1000 شهرياً = 10,000 يستلمها شخص واحد كل شهر لمدة 10 أشهر. كل عضو يدفع 10,000 ويستلم 10,000.', '10 people × 1,000 monthly = 10,000 to one person each month for 10 months.')],
    ['🌓', L('نصف السهم', 'Half share'), L('شخصان يتشاركان سهماً: كل منهما يدفع نصف القسط ويستلم نصف المبلغ في الدور نفسه.', 'Two people share one turn: each pays half and receives half.')],
    ['🎯', L('المستلم مبكراً', 'Early recipients'), L('من يستلم أولاً كأنه أخذ قرضاً حسناً من البقية، ومن يستلم آخراً كأنه ادّخر. لذلك الالتزام بعد الاستلام أمانة، ويُستحسن وجود كفيل.', 'Early recipients effectively borrow interest-free from the group; staying committed afterwards is a trust.')],
    ['⏰', L('آداب الدفع', 'Payment etiquette'), L('ادفع في الموعد دون انتظار التذكير، وارفع الإثبات فوراً، وأخبر المنظِّم مبكراً إن طرأ ظرف.', 'Pay on time, upload proof right away, and tell the organizer early if something comes up.')],
    ['🔁', L('التبديل والانسحاب', 'Swaps & leaving'), L('تبديل الأدوار بموافقة الطرفين والمنظِّم. من ينسحب قبل استلامه تُرد له دفعاته أو يحل محله بديل، ومن ينسحب بعد استلامه يبقى ملتزماً بالسداد.', 'Swaps need both parties and the organizer. Leaving before your turn: refund or replacement. After your turn: keep paying.')],
    ['🛡️', L('الأمانة والشفافية', 'Trust'), L('جمعيتي لا تحتفظ بأي أموال؛ الدفع بينكم مباشرة. التطبيق يوثّق كل دفعة بإيصال وسجل لا يُمحى، لتبقى الجمعية ودّية وخالية من الخلاف.', 'Jamiyati never holds money. It documents every payment with receipts and a tamper-evident log.')],
  ];
  return (
    <>
      {items.map(([ic, t, d]) => (
        <section className="card" key={t}>
          <h3>
            {ic} {t}
          </h3>
          <div>{d}</div>
        </section>
      ))}
    </>
  );
}
