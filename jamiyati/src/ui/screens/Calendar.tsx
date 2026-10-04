import { useState } from 'react';
import { addDays, addMonths, diffDays, parseISODate, todayISO } from '../../domain/dates';
import { L } from '../../lib/i18n';
import { date, dayNum, money, monthTitle, num, relDays } from '../../lib/format';
import { useDB } from '../../store/db';
import { calendarEvents } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { Empty, StatusChip, TopBar } from '../components/ui';
import { go } from '../router';

export function CalendarScreen() {
  const db = useDB();
  const today = todayISO();
  const events = calendarEvents(db, db.currentUserId!, today);
  const [month, setMonth] = useState(today.slice(0, 8) + '01');
  const [sel, setSel] = useState(today);
  const showHijri = db.settings.calendar !== 'gregory';

  const first = parseISODate(month);
  const startOffset = (first.getUTCDay() + 1) % 7; // الأسبوع يبدأ السبت
  const gridStart = addDays(month, -startOffset);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const dows = [L('سبت', 'Sat'), L('أحد', 'Sun'), L('إثنين', 'Mon'), L('ثلاثاء', 'Tue'), L('أربعاء', 'Wed'), L('خميس', 'Thu'), L('جمعة', 'Fri')];
  const selEvents = byDay.get(sel) ?? [];
  const upcoming = events.filter((e) => e.date >= today && !(e.kind === 'pay' && e.status === 'paid')).slice(0, 8);
  const overdue = events.filter((e) => e.kind === 'pay' && e.status === 'late');

  return (
    <>
      <TopBar title={L('التقويم', 'Calendar')} />
      <main>
        <section className="card stack">
          <div className="row between">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label={L('الشهر السابق', 'Previous month')}>
              <Icon name="back" className="flip" />
            </button>
            <div style={{ textAlign: 'center' }}>
              <b>{monthTitle(month)}</b>
              {showHijri && <div className="tiny muted">{monthTitle(addDays(month, 14), 'islamic-umalqura')}</div>}
            </div>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label={L('الشهر التالي', 'Next month')}>
              <Icon name="next" className="flip" />
            </button>
          </div>
          <div className="cal" role="grid">
            {dows.map((d) => (
              <div className="dow" key={d}>
                {d}
              </div>
            ))}
            {days.map((d) => {
              const ev = byDay.get(d) ?? [];
              return (
                <button key={d} className={`${d.slice(0, 7) !== month.slice(0, 7) ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(d)} aria-label={date(d)}>
                  <span className="num">{dayNum(d)}</span>
                  {showHijri && <span className="hd num">{dayNum(d, 'islamic-umalqura')}</span>}
                  <span className="dots">
                    {ev.slice(0, 3).map((e, i) => (
                      <i key={i} style={{ background: e.kind === 'payout' ? 'var(--gold)' : e.status === 'paid' ? 'var(--paid)' : e.status === 'late' ? 'var(--late)' : 'var(--due)' }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="row wrap tiny muted" style={{ gap: 10 }}>
            <span>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--due)' }} /> {L('قسط', 'Installment')}
            </span>
            <span>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--paid)' }} /> {L('مدفوع', 'Paid')}
            </span>
            <span>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--late)' }} /> {L('متأخر', 'Late')}
            </span>
            <span>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--gold)' }} /> {L('استلام', 'Payout')}
            </span>
          </div>
        </section>

        <section className="card stack" style={{ gap: 4 }}>
          <h3>{date(sel, 'long')}</h3>
          {selEvents.length === 0 ? <div className="muted small">{L('لا مواعيد في هذا اليوم', 'Nothing on this day')}</div> : selEvents.map((e, i) => <EventRow key={i} e={e} />)}
        </section>

        {overdue.length > 0 && (
          <section className="card stack" style={{ gap: 4, borderColor: 'var(--late)' }}>
            <h3 style={{ color: 'var(--late)' }}>{L('متأخر', 'Overdue')}</h3>
            {overdue.map((e, i) => (
              <EventRow key={i} e={e} />
            ))}
          </section>
        )}

        <section className="card stack" style={{ gap: 4 }}>
          <h3>{L('القادم', 'Upcoming')}</h3>
          {upcoming.length === 0 ? <Empty icon="cal" title={L('لا مواعيد قادمة', 'No upcoming dates')} /> : upcoming.map((e, i) => <EventRow key={i} e={e} withDate />)}
        </section>
      </main>
    </>
  );
}

function EventRow({ e, withDate }: { e: ReturnType<typeof calendarEvents>[number]; withDate?: boolean }) {
  const today = todayISO();
  return (
    <button className="item" onClick={() => go(`/c/${e.circleId}`)}>
      <span className="avatar sm" style={e.kind === 'payout' ? { background: 'color-mix(in srgb, var(--gold) 20%, transparent)', color: 'var(--gold)' } : undefined}>
        <Icon name={e.kind === 'payout' ? 'wallet' : 'receipt'} size={16} />
      </span>
      <span className="grow">
        <b className="small">{e.kind === 'payout' ? L('استلام', 'Payout') : L('قسط', 'Installment')} — {e.circleName}</b>
        <div className="tiny muted">
          {L('الدورة', 'Cycle')} {num(e.cycleIndex + 1)}
          {withDate && ` · ${date(e.date)} · ${relDays(diffDays(today, e.date))}`}
        </div>
      </span>
      <span style={{ textAlign: 'end' }}>
        <b className="small num" style={{ color: e.kind === 'payout' ? 'var(--paid)' : undefined }}>
          {e.kind === 'payout' ? '+' : '−'}
          {money(e.amount, e.currency)}
        </b>
        {e.status && (
          <div>
            <StatusChip s={e.status} />
          </div>
        )}
      </span>
    </button>
  );
}
