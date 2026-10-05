// سجل الجمعيات: كل جمعيات المستخدم في مكان واحد — النشطة، وما ينظّمه، وما هو عضو فيه، وأرشيف المنتهية.
import { useState } from 'react';
import { round2 } from '../../domain/calc';
import { diffDays, todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, freqLabel, money, num, relDays } from '../../lib/format';
import { useDB } from '../../store/db';
import { cycleSummary, myCircles, type MyCircleCard } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { Empty, Progress, StatusChip, TopBar } from '../components/ui';
import { go } from '../router';
import { focusCycle } from './CircleNow';
import { roleLabel, statusLabel } from './Home';

type Filter = 'active' | 'organizer' | 'member' | 'archive' | 'all';

const isLive = (c: MyCircleCard) => c.view.circle.status === 'active' || c.view.circle.status === 'draft';
const isOrganizer = (c: MyCircleCard) => c.view.circle.mode !== 'personal' && c.role !== 'member';

export function CirclesScreen() {
  const db = useDB();
  const today = todayISO();
  const all = myCircles(db, db.currentUserId!, today);
  const [filter, setFilter] = useState<Filter>(() => {
    try {
      return (sessionStorage.getItem('jamiyati:circlesFilter') as Filter) || 'active';
    } catch {
      return 'active';
    }
  });
  const [q, setQ] = useState('');
  const choose = (f: Filter) => {
    setFilter(f);
    try {
      sessionStorage.setItem('jamiyati:circlesFilter', f);
    } catch {
      /* تجاهل */
    }
  };

  const counts: Record<Filter, number> = {
    active: all.filter(isLive).length,
    organizer: all.filter((c) => isLive(c) && isOrganizer(c)).length,
    member: all.filter((c) => isLive(c) && !isOrganizer(c)).length,
    archive: all.filter((c) => !isLive(c)).length,
    all: all.length,
  };
  const shown = all
    .filter((c) =>
      filter === 'active' ? isLive(c) : filter === 'organizer' ? isLive(c) && isOrganizer(c) : filter === 'member' ? isLive(c) && !isOrganizer(c) : filter === 'archive' ? !isLive(c) : true,
    )
    .filter((c) => !q.trim() || c.view.circle.name.includes(q.trim()));

  // ملخص الجمعيات النشطة حسب العملة
  const totals = new Map<string, { monthly: number; toReceive: number; remaining: number }>();
  for (const c of all.filter(isLive)) {
    const t = totals.get(c.view.circle.currency) ?? { monthly: 0, toReceive: 0, remaining: 0 };
    t.monthly += c.monthly;
    t.toReceive += c.ledger.expectedToReceive;
    t.remaining += c.view.circle.status === 'active' ? c.ledger.remainingToPay : 0;
    totals.set(c.view.circle.currency, t);
  }

  const chips: { k: Filter; t: string }[] = [
    { k: 'active', t: L('النشطة', 'Active') },
    { k: 'organizer', t: L('أنظّمها', 'I organize') },
    { k: 'member', t: L('أنا عضو', "I'm a member") },
    { k: 'archive', t: L('المنتهية', 'Finished') },
    { k: 'all', t: L('الكل', 'All') },
  ];

  return (
    <>
      <TopBar
        title={L('جمعياتي', 'My circles')}
        actions={
          <button className="btn sm" onClick={() => go('/new')}>
            <Icon name="plus" size={18} /> {L('جمعية', 'Circle')}
          </button>
        }
      />
      <main>
        {all.length === 0 ? (
          <div className="card">
            <Empty
              icon="users"
              title={L('لا توجد جمعيات بعد', 'No circles yet')}
              text={L('أضف كل جمعية تشارك فيها — كمنظِّم أو كعضو — لتتابعها كلها هنا.', 'Add every circle you are in — as organizer or member — to track them all here.')}
              action={
                <button className="btn block" onClick={() => go('/new')}>
                  <Icon name="plus" /> {L('إضافة جمعية', 'Add a circle')}
                </button>
              }
            />
          </div>
        ) : (
          <>
            {counts.active > 0 && (
              <section className="card hero stack" style={{ gap: 8 }}>
                <div className="row between">
                  <b style={{ fontSize: '1.1rem' }}>
                    {num(counts.active)} {counts.active === 1 ? L('جمعية نشطة', 'active circle') : counts.active === 2 ? L('جمعيتان نشطتان', 'active circles') : L('جمعيات نشطة', 'active circles')}
                  </b>
                  <span className="small muted">
                    {L(`أنظّم ${num(counts.organizer)} · عضو في ${num(counts.member)}`, `Organizing ${counts.organizer} · member of ${counts.member}`)}
                  </span>
                </div>
                {[...totals.entries()].map(([cur, t]) => (
                  <div className="grid2" key={cur} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    <HeroStat label={L('التزامي الشهري', 'Monthly')} value={money(round2(t.monthly), cur)} />
                    <HeroStat label={L('باقي عليّ', 'Left to pay')} value={money(round2(t.remaining), cur)} />
                    <HeroStat label={L('سأستلم', 'To receive')} value={money(round2(t.toReceive), cur)} />
                  </div>
                ))}
              </section>
            )}

            <div className="tabs" role="tablist" aria-label={L('تصفية الجمعيات', 'Filter circles')}>
              {chips.map((c) => (
                <button key={c.k} role="tab" aria-selected={filter === c.k} className={filter === c.k ? 'on' : ''} onClick={() => choose(c.k)}>
                  {c.t} <span className="num muted">({num(counts[c.k])})</span>
                </button>
              ))}
            </div>

            {all.length > 4 && <input className="input" type="search" placeholder={L('ابحث باسم الجمعية…', 'Search by name…')} value={q} onChange={(e) => setQ(e.target.value)} />}

            {shown.length === 0 ? (
              <div className="card">
                <Empty
                  icon={filter === 'archive' ? 'log' : 'users'}
                  title={filter === 'archive' ? L('لا توجد جمعيات منتهية بعد', 'No finished circles yet') : L('لا توجد جمعيات هنا', 'Nothing here')}
                  text={filter === 'archive' ? L('عند اكتمال جمعية أو إنهائها تنتقل إلى هنا مع كامل سجلها.', 'Completed or ended circles move here with their full record.') : undefined}
                />
              </div>
            ) : (
              shown.map((c) => <RegistryCard key={c.view.circle.id} c={c} />)
            )}
          </>
        )}
      </main>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgb(255 255 255 / 14%)', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
      <div className="tiny" style={{ opacity: 0.85 }}>
        {label}
      </div>
      <b className="num small" style={{ display: 'block', overflowWrap: 'anywhere' }}>
        {value}
      </b>
    </div>
  );
}

export function RegistryCard({ c }: { c: MyCircleCard }) {
  const today = todayISO();
  const { circle, schedule, current, pot } = c.view;
  const live = isLive(c);
  const organizer = isOrganizer(c);
  const done = circle.status === 'completed' ? schedule.length : Math.max(0, current + 1);
  const turn = c.myTurns.find((t) => !t.received) ?? c.myTurns.at(-1);
  const focus = organizer && circle.status === 'active' ? focusCycle(c.view, today) : -1;
  const sum = focus >= 0 ? cycleSummary(c.view, focus) : null;
  const endedOn = circle.terminatedAt?.slice(0, 10) ?? schedule.at(-1)?.dueDate;

  return (
    <a href={`#/c/${circle.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 8, opacity: live ? 1 : 0.92 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <b style={{ fontSize: '1.08rem', minWidth: 0 }} className="ellipsis">
          {circle.name}
        </b>
        <div className="row" style={{ gap: 6, flex: 'none' }}>
          <span className="chip s-brand">{circle.mode === 'personal' ? L('عضو', 'Member') : roleLabel(c.role)}</span>
          {circle.status !== 'active' && <span className={`chip ${circle.status === 'completed' ? 's-paid' : ''}`}>{statusLabel(circle.status)}</span>}
        </div>
      </div>
      <div className="small muted">
        {money(c.duePerCycle || circle.installment, circle.currency)} · {freqLabel(circle.frequency)} · {L('الاستلام', 'Pot')} {money(c.ledger.units ? c.ledger.units * pot : pot, circle.currency)}
      </div>

      {circle.status !== 'draft' && (
        <>
          <Progress value={(Math.min(done, schedule.length) / schedule.length) * 100} />
          <div className="small muted">
            {L(`الدورة ${num(Math.min(done, schedule.length))} من ${num(schedule.length)}`, `Cycle ${done} of ${schedule.length}`)}
          </div>
        </>
      )}

      {live ? (
        <div className="stack" style={{ gap: 4 }}>
          {c.next ? (
            <div className="row between small">
              <span>
                💳 {L('قسطي', 'My installment')}: <b className="num">{money(c.next.remaining, circle.currency)}</b> · {date(c.next.cycle.dueDate)}
              </span>
              <StatusChip s={c.next.status} />
            </div>
          ) : (
            circle.status === 'active' && c.duePerCycle > 0 && <div className="small">✅ {L('كل أقساطي مسددة', 'All my installments paid')}</div>
          )}
          {turn && (
            <div className="small">
              🎯 {L('دوري', 'My turn')} {num(turn.cycleIndex + 1)} · {date(turn.date)}
              {turn.received ? ` · ✓ ${L('استلمت', 'received')}` : ` · ${relDays(diffDays(today, turn.date))}`}
            </div>
          )}
          {sum && (
            <div className="small">
              👥 {L('الدورة', 'Cycle')} {num(focus + 1)}: {L('دفع', 'paid')} <b className="num">{num(sum.paid.length)}</b> {L('من', 'of')} {num(c.view.rows.length)}
              {sum.pending.length > 0 && ` · ${num(sum.pending.length)} ${L('إثبات للتأكيد', 'to confirm')}`}
            </div>
          )}
          {c.arrears > 0 && (
            <div className="small" style={{ color: 'var(--late)' }}>
              ⚠️ {L('متأخرات عليّ', 'My arrears')}: {money(c.arrears, circle.currency)}
            </div>
          )}
          {circle.status === 'draft' && <div className="warn small">{L('قيد التجهيز: أكمل الأعضاء ثم أجرِ القرعة', 'Draft: add members, then run the lottery')}</div>}
        </div>
      ) : (
        <div className="small">
          🏁 {L('انتهت', 'Ended')} {date(endedOn ?? '')} · {L('دفعت', 'paid')} <b className="num">{money(c.ledger.paid, circle.currency)}</b> · {L('استلمت', 'received')}{' '}
          <b className="num">{money(c.ledger.received, circle.currency)}</b>
        </div>
      )}
    </a>
  );
}
