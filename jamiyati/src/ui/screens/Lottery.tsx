// القرعة الشفافة: البذرة تُعلن قبل السحب، والنتيجة تُحفظ مع التاريخ والوقت، ويمكن لأي عضو إعادة العرض والتحقق.
import { useEffect, useRef, useState } from 'react';
import { seededShuffle, validateShares } from '../../domain/calc';
import { todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, dateTime, num } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { circleView, roleIn } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { WhatsAppSheet } from '../components/sheets';
import { attempt, TopBar } from '../components/ui';
import { go } from '../router';

const randomSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000;

export function Lottery({ circleId }: { circleId: string }) {
  const db = useDB();
  const v = circleView(db, circleId, todayISO());
  const role = roleIn(db, circleId, db.currentUserId);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [revealed, setRevealed] = useState(0);
  const [drum, setDrum] = useState('؟');
  const [order, setOrder] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [wa, setWa] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!v || !role) return null;
  const label = (id: string) => v.shares.find((s) => s.id === id)?.holders.map((h) => v.members.find((m) => m.id === h.memberId)?.name).join(' و') ?? '؟';
  const ids = v.shares.map((s) => s.id).sort();
  const errs = validateShares(v.shares, v.circle.sharesCount);
  const rec = v.circle.lottery;
  const verified = rec ? JSON.stringify(seededShuffle(ids, rec.seed)) === JSON.stringify(rec.result) : false;
  const canRun = role === 'organizer' && !v.circle.orderLocked && !errs.length;

  const animate = (result: string[], s: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSeed(s);
    setOrder(result);
    setRevealed(0);
    setPhase('running');
    const names = result.map(label);
    const step = Math.max(650, Math.min(1100, 9000 / result.length));
    result.forEach((_, i) => {
      for (let k = 0; k < 8; k++) timers.current.push(window.setTimeout(() => setDrum(names[Math.floor(Math.random() * names.length)]), i * step + k * (step / 10)));
      timers.current.push(
        window.setTimeout(() => {
          setDrum(names[i]);
          setRevealed(i + 1);
          if (navigator.vibrate) navigator.vibrate(30);
          if (i === result.length - 1) setPhase('done');
        }, i * step + step * 0.85),
      );
    });
  };

  const run = () => {
    const s = randomSeed();
    let result: string[] = [];
    // الحفظ أولاً ثم العرض — النتيجة محسومة ومسجلة حتى لو أُغلقت الشاشة
    if (attempt(() => (result = A.runLottery(circleId, s)))) animate(result, s);
  };

  const shownOrder = phase === 'idle' && rec ? rec.result : order;

  return (
    <>
      <TopBar title={L('القرعة الإلكترونية', 'Lottery')} backTo={`/c/${circleId}?tab=order`} />
      <main>
        <div className="card stack" style={{ textAlign: 'center' }}>
          <div className="drum" aria-live="polite">
            {phase === 'idle' ? (rec ? '🎲' : '؟') : drum}
          </div>
          {phase !== 'idle' && (
            <div className="small">
              {L('البذرة المعلنة', 'Announced seed')}: <b className="num">{seed}</b> · {L('الدور', 'Turn')} {num(Math.min(revealed + (phase === 'running' ? 1 : 0), order.length))} / {num(order.length)}
            </div>
          )}
          {phase === 'idle' && !rec && (
            <div className="small muted">
              {L('اجمع الأعضاء (أو شارك الشاشة في مكالمة) ثم اضغط "ابدأ القرعة". تُولَّد بذرة عشوائية وتُعلن، وأي شخص يستطيع إعادة الحساب بها والحصول على النتيجة نفسها.', 'Gather members (or share your screen), then start. A random seed is announced; anyone can recompute the same result from it.')}
            </div>
          )}
          {canRun && phase !== 'running' && (
            <button className="btn block" onClick={run}>
              <Icon name="dice" /> {rec ? L('إعادة القرعة', 'Redo lottery') : L('ابدأ القرعة', 'Start the lottery')}
            </button>
          )}
          {!canRun && errs.length > 0 && role === 'organizer' && <div className="warn small">{L('أكمل الأسهم قبل القرعة', 'Complete all shares first')}: {errs[0]}</div>}
          {rec && phase === 'idle' && (
            <button className="btn soft block" onClick={() => animate(rec.result, rec.seed)}>
              {L('إعادة عرض القرعة', 'Replay')}
            </button>
          )}
        </div>

        {rec && phase !== 'running' && (
          <div className={verified ? 'note' : 'error'}>
            <div className="row">
              <Icon name="shield" />
              <b>{verified ? L('النتيجة موثّقة ✓', 'Verified ✓') : L('النتيجة لا تطابق البذرة!', 'Result does not match the seed!')}</b>
            </div>
            <div className="small">
              {L('أُجريت', 'Drawn')} {dateTime(rec.at)} {L('بواسطة', 'by')} {db.users.find((u) => u.id === rec.byUserId)?.name} · {L('البذرة', 'seed')} <b className="num">{rec.seed}</b>
            </div>
            <div className="tiny">{L('أعدنا حساب الخلط بالبذرة نفسها على أسهم الجمعية وطابق الترتيب المحفوظ.', 'We re-shuffled the shares with the same seed and it matches the saved order.')}</div>
          </div>
        )}

        <section className="lottery-stage">
          {shownOrder.map((id, i) => {
            const show = phase === 'idle' || i < revealed;
            return (
              <div key={id} className={`lot-card ${show ? 'revealed' : phase === 'running' && i === revealed ? 'spin' : ''}`}>
                <span className={`pos ${show ? 'now' : ''}`}>{num(i + 1)}</span>
                <b className="grow">{show ? label(id) : '• • •'}</b>
                {show && <span className="small muted">{date(v.schedule[i]?.dueDate)}</span>}
              </div>
            );
          })}
        </section>

        {(phase === 'done' || (phase === 'idle' && rec)) && (
          <div className="btns">
            <button className="btn whatsapp" onClick={() => setWa(true)}>
              <Icon name="whatsapp" /> {L('مشاركة النتيجة', 'Share result')}
            </button>
            <button className="btn soft" onClick={() => go(`/c/${circleId}`)}>
              {L('العودة للجمعية', 'Back to circle')}
            </button>
          </div>
        )}
        {phase === 'done' && !v.circle.orderLocked && role === 'organizer' && (
          <button className="btn block" onClick={() => attempt(() => A.startCircle(circleId), L('بدأت الجمعية 🎉', 'Started 🎉')) && go(`/c/${circleId}`)}>
            <Icon name="lock" /> {L('اعتماد الترتيب وبدء الجمعية', 'Lock order & start')}
          </button>
        )}
      </main>
      <WhatsAppSheet
        open={wa}
        onClose={() => setWa(false)}
        kinds={['lottery']}
        vars={{
          name: '',
          circle: v.circle.name,
          amount: v.circle.installment,
          currency: v.circle.currency,
          code: String(rec?.seed ?? seed),
          order: (phase === 'idle' && rec ? rec.result : order).map((id, i) => `${i + 1}. ${label(id)} — ${date(v.schedule[i]?.dueDate)}`).join('\n'),
        }}
      />
    </>
  );
}
