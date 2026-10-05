import { useMemo, useState } from 'react';
import { durationDays, endDate, finalSettlement, validateShares, type CellStatus } from '../../domain/calc';
import { diffDays, todayISO } from '../../domain/dates';
import type { Member, PaymentMethod } from '../../domain/types';
import { L } from '../../lib/i18n';
import { date, dateTime, freqLabel, methodLabel, money, monthShort, num, unitsLabel } from '../../lib/format';
import type { TemplateKind, TemplateVars } from '../../lib/whatsapp';
import * as A from '../../store/actions';
import { useDB, verifyLog } from '../../store/db';
import { canConfirm, circleView, cycleSummary, paymentsFor, roleIn, type CircleView } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { AddMemberSheet, InviteSheet, PaymentItem, PaySheet, WhatsAppSheet } from '../components/sheets';
import { attempt, Avatar, Empty, Field, Progress, ReasonSheet, Seg, Sheet, StatusChip, statusText, TopBar } from '../components/ui';
import { go, useRoute } from '../router';
import { roleLabel, statusLabel } from './Home';
import { NowTab } from './CircleNow';
import { PersonalScreen } from './Personal';

type Tab = 'now' | 'grid' | 'members' | 'more';
const TAB_ALIASES: Record<string, Tab> = { overview: 'now', order: 'members', log: 'more' };

export function CircleScreen({ circleId }: { circleId: string }) {
  const db = useDB();
  const { query } = useRoute();
  const today = todayISO();
  const v = circleView(db, circleId, today);
  const role = roleIn(db, circleId, db.currentUserId);
  const [tabState, setTab] = useState<Tab | null>(null);
  const q = query.get('tab') ?? 'now';
  const tab: Tab = tabState ?? TAB_ALIASES[q] ?? (q as Tab);
  const [invite, setInvite] = useState(query.get('invite') === '1');

  if (!v || !role) {
    return (
      <>
        <TopBar title={L('الجمعية', 'Circle')} backTo="/" />
        <main>
          <div className="card">
            <Empty icon="lock" title={L('لا يمكنك عرض هذه الجمعية', "You can't view this circle")} text={L('ترى فقط الجمعيات التي أنت عضو فيها.', 'You can only see circles you belong to.')} />
          </div>
        </main>
      </>
    );
  }

  if (v.circle.mode === 'personal') return <PersonalScreen v={v} />;
  const staff = canConfirm(role);
  const tabs: { k: Tab; t: string }[] = [
    { k: 'now', t: L('الآن', 'Now') },
    { k: 'grid', t: L('الجدول', 'Table') },
    { k: 'members', t: L('الأعضاء', 'Members') },
    { k: 'more', t: L('المزيد', 'More') },
  ];

  return (
    <>
      <TopBar
        title={v.circle.name}
        backTo="/"
        actions={
          role === 'organizer' && (
            <button className="icon-btn" onClick={() => setInvite(true)} aria-label={L('دعوة عبر واتساب', 'Invite via WhatsApp')}>
              <Icon name="whatsapp" />
            </button>
          )
        }
      />
      <main>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>
              {t.t}
            </button>
          ))}
        </div>
        {tab === 'now' &&
          (staff && v.circle.status !== 'draft' ? <NowTab v={v} role={role} /> : <Overview v={v} role={role} onInvite={() => setInvite(true)} goTab={setTab} />)}
        {tab === 'grid' && <Grid v={v} role={role} />}
        {tab === 'members' && <Order v={v} role={role} onInvite={() => setInvite(true)} />}
        {tab === 'more' && <More v={v} role={role} />}
      </main>
      <InviteSheet open={invite} onClose={() => setInvite(false)} circleId={circleId} />
    </>
  );
}

const nameOf = (v: CircleView, id: string) => v.members.find((m) => m.id === id)?.name ?? '؟';

// ───────────────────────── نظرة عامة ─────────────────────────

function Overview({ v, role, onInvite, goTab }: { v: CircleView; role: string; onInvite: () => void; goTab: (t: Tab) => void }) {
  const db = useDB();
  const { circle } = v;
  const staff = canConfirm(role as never);
  const me = v.members.find((m) => m.userId === db.currentUserId && m.status === 'active');
  const myRow = v.rows.find((r) => r.member.id === me?.id);
  const cur = Math.max(0, v.current);
  // دورة التركيز: الحالية، أو القادمة إن كانت خلال أيام قليلة وكانت الحالية مكتملة التحصيل
  const focus = circle.status === 'draft' ? -1 : cur;
  const sum = focus >= 0 ? cycleSummary(v, focus) : null;
  const [pay, setPay] = useState<{ memberId: string; cycle: number } | null>(null);
  const [wa, setWa] = useState<{ phone?: string; kinds: TemplateKind[]; vars: TemplateVars } | null>(null);
  const [deliver, setDeliver] = useState<{ memberId: string; amount: number; cycle: number } | null>(null);
  const pending = db.payments.filter((p) => p.circleId === circle.id && p.status === 'pending');
  const payoutsThis = focus >= 0 ? db.payouts.filter((p) => p.circleId === circle.id && p.cycleIndex === focus) : [];

  if (circle.status === 'draft') return <DraftSetup v={v} role={role} onInvite={onInvite} goTab={goTab} />;

  const myNext = myRow ? myRow.cells.findIndex((c) => c.status !== 'paid') : -1;

  return (
    <>
      {circle.status !== 'active' && (
        <div className={circle.status === 'completed' ? 'note' : 'warn'}>
          {statusLabel(circle.status)} {circle.terminatedAt && `· ${dateTime(circle.terminatedAt)}`}
        </div>
      )}
      {/* بطاقتي في هذه الجمعية */}
      {myRow && (
        <section className="card stack" style={{ gap: 8 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{L('وضعي', 'My status')}</h3>
            <span className="chip s-brand">{roleLabel(role)}</span>
          </div>
          {myNext >= 0 && circle.status === 'active' ? (
            <>
              <div className="row between">
                <span>
                  {L('عليّ', 'I owe')} <b className="num">{money(myRow.cells[myNext].remaining, circle.currency)}</b> · {date(v.schedule[myNext].dueDate)}
                </span>
                <StatusChip s={myRow.cells[myNext].status} />
              </div>
              {myRow.cells[myNext].status !== 'pending' && (
                <button className="btn block" onClick={() => setPay({ memberId: myRow.member.id, cycle: myNext })}>
                  <Icon name="check" /> {L('دفعت — ارفع الإثبات', 'I paid — upload proof')}
                </button>
              )}
            </>
          ) : (
            <div className="row">
              <span className="chip s-paid">✓ {L('لا شيء مستحق عليك', 'Nothing due')}</span>
            </div>
          )}
          <div className="small">
            🎯 {L('دوري', 'My turn')}: {myRow.positions.map((p) => `${num(p)} (${date(v.schedule[p - 1]?.dueDate)})`).join('، ')} · {money(myRow.units * v.pot, circle.currency)}
          </div>
        </section>
      )}

      {/* الدورة الحالية */}
      {sum && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>
              {L('الدورة', 'Cycle')} {num(focus + 1)} / {num(v.schedule.length)}
            </h3>
            <span className="small muted">{date(v.schedule[focus].dueDate)}</span>
          </div>
          <div className="row">
            <span className="pos now">{num(focus + 1)}</span>
            <div className="grow">
              <div className="small muted">{L('الدور على', 'Turn of')}</div>
              <b>{sum.recipients.map((r) => r.name).join(' و') || '—'}</b>
            </div>
            <b className="num">{money(v.pot, circle.currency)}</b>
          </div>
          <div>
            <div className="row between small">
              <span>{L('نسبة التحصيل', 'Collected')}</span>
              <b className="num">
                {num(sum.rate)}% · {money(sum.collected, circle.currency)} / {money(sum.expected, circle.currency)}
              </b>
            </div>
            <Progress value={sum.rate} />
          </div>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <MiniStat n={sum.paid.length} label={L('دفع', 'Paid')} cls="s-paid" />
            <MiniStat n={sum.pending.length} label={L('بانتظار', 'Pending')} cls="s-pending" />
            <MiniStat n={sum.late.length + sum.open.length} label={L('لم يدفع', 'Unpaid')} cls={sum.late.length ? 's-late' : 's-upcoming'} />
          </div>
          {staff && (
            <div className="btns">
              <button
                className="btn sm whatsapp"
                onClick={() =>
                  setWa({
                    kinds: ['turn'],
                    vars: { name: '', circle: circle.name, amount: circle.installment, currency: circle.currency, cycle: focus + 1, recipient: sum.recipients.map((r) => r.name).join(' و'), pot: v.pot, dueDate: v.schedule[focus].dueDate },
                  })
                }
              >
                <Icon name="whatsapp" size={18} /> {L('إعلان الدور للمجموعة', 'Announce turn')}
              </button>
              <button className="btn sm soft" onClick={() => setPay({ memberId: v.rows[0].member.id, cycle: focus })}>
                <Icon name="plus" size={18} /> {L('تسجيل دفعة', 'Record payment')}
              </button>
            </div>
          )}
          {/* تسليم المبلغ للمستلم */}
          {sum.share &&
            sum.share.holders.map((h) => {
              const po = payoutsThis.find((p) => p.memberId === h.memberId);
              const amount = v.pot * h.fraction;
              return (
                <div key={h.memberId} className="row between card tight">
                  <span className="small">
                    {L('تسليم', 'Payout to')} {nameOf(v, h.memberId)}: <b className="num">{money(amount, circle.currency)}</b>
                  </span>
                  {po ? (
                    po.recipientConfirmedAt ? (
                      <span className="chip s-paid">✓ {L('استلم وأكّد', 'Received')}</span>
                    ) : v.members.find((m) => m.id === h.memberId)?.userId === db.currentUserId ? (
                      <button className="btn sm" onClick={() => attempt(() => A.confirmPayoutReceived(po.id), L('شكراً، تم تأكيد الاستلام', 'Receipt confirmed'))}>
                        {L('أكّد الاستلام', 'Confirm receipt')}
                      </button>
                    ) : (
                      <span className="chip s-pending">{L('سُلّم — بانتظار تأكيد المستلم', 'Delivered — awaiting confirmation')}</span>
                    )
                  ) : role === 'organizer' ? (
                    <button className="btn sm soft" onClick={() => setDeliver({ memberId: h.memberId, amount, cycle: focus })}>
                      {L('سجّل التسليم', 'Record payout')}
                    </button>
                  ) : (
                    <span className="chip">{L('لم يُسلّم بعد', 'Not yet')}</span>
                  )}
                </div>
              );
            })}
        </section>
      )}

      {/* إثباتات بانتظار التأكيد */}
      {staff && pending.length > 0 && (
        <section className="stack">
          <div className="section-title">
            <h2>
              {L('بانتظار تأكيدك', 'Awaiting your review')} ({num(pending.length)})
            </h2>
          </div>
          {pending.map((p) => (
            <div key={p.id} className="stack" style={{ gap: 4 }}>
              <div className="small">
                <b>{nameOf(v, p.memberId)}</b> · {L('الدورة', 'Cycle')} {num(p.cycleIndex + 1)}
              </div>
              <PaymentItem p={p} currency={circle.currency} staff organizer={role === 'organizer'} />
            </div>
          ))}
        </section>
      )}

      {/* المتأخرون */}
      {staff && (
        <LateList
          v={v}
          onRemind={(m, cycle) =>
            setWa({
              phone: m.phone,
              kinds: ['late', 'dueDay', 'before3'],
              vars: { name: m.name.split(' ')[0], circle: circle.name, amount: v.rows.find((r) => r.member.id === m.id)!.cells[cycle].remaining, currency: circle.currency, dueDate: v.schedule[cycle].dueDate },
            })
          }
        />
      )}

      <CircleDetails v={v} />

      {pay && <PaySheet open onClose={() => setPay(null)} circleId={circle.id} memberId={pay.memberId} cycleIndex={pay.cycle} />}
      {wa && <WhatsAppSheet open onClose={() => setWa(null)} phone={wa.phone} kinds={wa.kinds} vars={wa.vars} />}
      {deliver && <DeliverSheet v={v} {...deliver} onClose={() => setDeliver(null)} />}
    </>
  );
}

export function DeliverSheet({ v, memberId, amount, cycle, onClose }: { v: CircleView; memberId: string; amount: number; cycle: number; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const sum = cycleSummary(v, cycle);
  return (
    <Sheet open onClose={onClose} title={L('تسجيل تسليم المبلغ', 'Record payout')}>
      <div className="stack">
        <div className="note">
          {L('تسليم', 'Paying')} <b className="num">{money(amount, v.circle.currency)}</b> {L('إلى', 'to')} <b>{nameOf(v, memberId)}</b> — {L('الدورة', 'cycle')} {num(cycle + 1)}
        </div>
        {sum.rate < 100 && <div className="warn small">{L(`نسبة التحصيل ${num(sum.rate)}% فقط. تأكد أنك جمعت المبلغ كاملاً قبل التسليم.`, `Only ${sum.rate}% collected.`)}</div>}
        <Field label={L('طريقة التسليم', 'Method')}>
          <Seg value={method} onChange={setMethod} options={(['bank', 'wallet', 'cash'] as PaymentMethod[]).map((m) => ({ v: m, t: methodLabel(m) }))} />
        </Field>
        <button className="btn block" onClick={() => attempt(() => A.recordPayout(v.circle.id, cycle, memberId, amount, method), L('سُجّل التسليم وأُشعر المستلم للتأكيد', 'Payout recorded')) && onClose()}>
          <Icon name="check" /> {L('تأكيد التسليم', 'Confirm payout')}
        </button>
      </div>
    </Sheet>
  );
}

function LateList({ v, onRemind }: { v: CircleView; onRemind: (m: Member, cycle: number) => void }) {
  const late = v.rows.flatMap((r) => r.cells.map((c, i) => ({ r, c, i })).filter((x) => x.c.status === 'late'));
  const dueNow = v.rows.flatMap((r) => r.cells.map((c, i) => ({ r, c, i })).filter((x) => x.c.status === 'due' || x.c.status === 'partial'));
  if (!late.length && !dueNow.length) return null;
  return (
    <section className="card stack" style={{ gap: 2 }}>
      <h3>{L('المتأخرون ومن لم يدفع', 'Late & unpaid')}</h3>
      {[...late, ...dueNow].map(({ r, c, i }) => (
        <div className="item" key={r.member.id + i}>
          <Avatar name={r.member.name} sm />
          <div className="grow">
            <b className="ellipsis" style={{ display: 'block' }}>
              {r.member.name}
            </b>
            <div className="tiny muted">
              {L('الدورة', 'Cycle')} {num(i + 1)} · {money(c.remaining, v.circle.currency)} · {c.status === 'late' ? L(`متأخر ${num(diffDays(v.schedule[i].dueDate, todayISO()))} يوم`, `${diffDays(v.schedule[i].dueDate, todayISO())}d late`) : statusText(c.status)}
            </div>
          </div>
          <button className="btn sm whatsapp" onClick={() => onRemind(r.member, i)} aria-label={L('تذكير واتساب', 'WhatsApp reminder')}>
            <Icon name="whatsapp" size={18} />
          </button>
        </div>
      ))}
    </section>
  );
}

function CircleDetails({ v }: { v: CircleView }) {
  const today = todayISO();
  const { circle } = v;
  const nextCycle = v.schedule.find((c) => c.dueDate > today);
  return (
      <section className="card stack" style={{ gap: 6 }}>
      <h3>{L('تفاصيل الجمعية', 'Details')}</h3>
      <KV k={L('القسط للسهم', 'Per share')} v={`${money(circle.installment, circle.currency)} · ${freqLabel(circle.frequency)}`} />
      <KV k={L('مبلغ الاستلام', 'Payout')} v={money(v.pot, circle.currency)} />
      <KV k={L('الأسهم / الأعضاء', 'Shares / members')} v={`${num(circle.sharesCount)} / ${num(v.holders.length)}`} />
      <KV k={L('البداية — النهاية', 'Start — end')} v={`${date(v.schedule[0].dueDate)} — ${date(endDate(circle))}`} />
      <KV k={L('المدة', 'Duration')} v={`${num(Math.round(durationDays(circle) / 30.4))} ${L('شهر تقريباً', 'months approx.')}`} />
      <KV k={L('مهلة السماح', 'Grace')} v={`${num(circle.graceDays)} ${L('أيام', 'days')}`} />
      {nextCycle && <KV k={L('الموعد القادم', 'Next due')} v={`${date(nextCycle.dueDate)} (${num(diffDays(today, nextCycle.dueDate))} ${L('يوم', 'd')})`} />}
      {circle.postponements.length > 0 && <KV k={L('تأجيلات', 'Postponements')} v={circle.postponements.map((p) => `${L('قبل الدورة', 'before')} ${num(p.beforeCycle + 1)} (${p.reason})`).join('، ')} />}
    </section>
  );
}

function MiniStat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`stat ${cls}`} style={{ textAlign: 'center', border: 0 }}>
      <div className="value num">{num(n)}</div>
      <div className="tiny">{label}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <span className="muted small" style={{ flex: 'none' }}>
        {k}
      </span>
      <b className="small num" style={{ textAlign: 'end' }}>
        {v}
      </b>
    </div>
  );
}

// ───────────────────────── التجهيز قبل البدء ─────────────────────────

function DraftSetup({ v, role, onInvite, goTab }: { v: CircleView; role: string; onInvite: () => void; goTab: (t: Tab) => void }) {
  const errs = validateShares(v.shares, v.circle.sharesCount);
  const filled = v.filledUnits;
  const ordered = v.shares.length > 0 && v.shares.every((s) => s.position > 0);
  const steps = [
    { done: true, t: L('إنشاء الجمعية', 'Create circle') },
    { done: filled >= v.circle.sharesCount && !errs.length, t: L(`اكتمال الأسهم (${num(filled)} من ${num(v.circle.sharesCount)})`, `Shares filled (${filled}/${v.circle.sharesCount})`) },
    { done: ordered, t: L('ترتيب الاستلام (قرعة أو يدوي)', 'Payout order (lottery or manual)') },
    { done: false, t: L('بدء الجمعية وقفل الترتيب', 'Start & lock the order') },
  ];
  return (
    <>
      <section className="card stack">
        <h3>{L('خطوات البدء', 'Getting started')}</h3>
        {steps.map((s, i) => (
          <div className="row" key={i}>
            <span className={`pos ${s.done ? 'done' : ''}`}>{s.done ? '✓' : num(i + 1)}</span>
            <span className={s.done ? 'muted' : ''}>{s.t}</span>
          </div>
        ))}
        <Progress value={(filled / v.circle.sharesCount) * 100} />
      </section>
      {role === 'organizer' ? (
        <div className="stack">
          <button className="btn block" onClick={onInvite}>
            <Icon name="qr" /> {L('دعوة الأعضاء (رابط، كود، QR)', 'Invite (link, code, QR)')}
          </button>
          <button className="btn soft block" onClick={() => goTab('members')}>
            <Icon name="users" /> {L('إضافة عضو يدوياً', 'Add manually')}
          </button>
          <button className="btn soft block" disabled={errs.length > 0} onClick={() => go(`/c/${v.circle.id}/lottery`)}>
            <Icon name="dice" /> {L('إجراء القرعة', 'Run the lottery')}
          </button>
          {errs.length > 0 && <div className="small muted">{errs[0]}</div>}
          <button className="btn block" disabled={!ordered || errs.length > 0} onClick={() => attempt(() => A.startCircle(v.circle.id), L('بدأت الجمعية 🎉 بالتوفيق للجميع', 'Circle started 🎉'))}>
            <Icon name="lock" /> {L('ابدأ الجمعية', 'Start circle')}
          </button>
        </div>
      ) : (
        <div className="note">{L('بانتظار المنظِّم لإكمال الأعضاء وإجراء القرعة.', 'Waiting for the organizer to complete members and run the lottery.')}</div>
      )}
    </>
  );
}

// ───────────────────────── شبكة الدفعات ─────────────────────────

const LEGEND: CellStatus[] = ['paid', 'pending', 'late', 'upcoming', 'due', 'partial'];
const CELL_MARK: Record<CellStatus, string> = { paid: '✓', pending: '…', late: '!', upcoming: '', due: '•', partial: '½', none: '' };

function Grid({ v, role }: { v: CircleView; role: string }) {
  const db = useDB();
  const [sel, setSel] = useState<{ memberId: string; cycle: number } | null>(null);
  const [pay, setPay] = useState<{ memberId: string; cycle: number } | null>(null);
  const [wa, setWa] = useState<{ phone?: string; vars: TemplateVars } | null>(null);
  const staff = canConfirm(role as never);
  if (!v.rows.length) return <div className="card"><Empty icon="users" title={L('لا يوجد أعضاء بعد', 'No members yet')} /></div>;
  const selRow = sel && v.rows.find((r) => r.member.id === sel.memberId);
  const selPays = sel ? paymentsFor(db, v.circle.id, sel.memberId, sel.cycle).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) : [];
  const isMine = selRow?.member.userId === db.currentUserId;

  return (
    <>
      <div className="legend" aria-label={L('دليل الألوان', 'Legend')}>
        {LEGEND.map((s) => (
          <span key={s} className={`chip s-${s}`}>
            {CELL_MARK[s] || '○'} {statusText(s)}
          </span>
        ))}
        <span className="chip" style={{ outline: '2px solid var(--gold)' }}>
          ★ {L('دور الاستلام', 'Payout turn')}
        </span>
      </div>
      <div className="grid-wrap">
        <table className="pgrid">
          <thead>
            <tr>
              <th className="namecol">{L('العضو', 'Member')}</th>
              {v.schedule.map((c) => (
                <th key={c.index} className={c.index === v.current ? 'cur' : ''} scope="col">
                  {num(c.index + 1)}
                  <div className="tiny" style={{ fontWeight: 500 }}>
                    {monthShort(c.dueDate)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r) => (
              <tr key={r.member.id}>
                <th className="namecol" scope="row">
                  <span className="ellipsis">{r.member.name}</span>
                  <span className="tiny muted">
                    {unitsLabel(r.units)}
                    {r.member.status === 'withdrawn' && ` · ${L('منسحب', 'withdrawn')}`}
                  </span>
                </th>
                {r.cells.map((c, i) => (
                  <td key={i}>
                    <button
                      className={`cell s-${c.status} ${r.positions.includes(i + 1) ? 'recipient' : ''}`}
                      onClick={() => setSel({ memberId: r.member.id, cycle: i })}
                      aria-label={`${r.member.name} — ${L('الدورة', 'cycle')} ${i + 1}: ${statusText(c.status)}`}
                    >
                      {CELL_MARK[c.status]}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small muted">{L('اسحب الجدول أفقياً لرؤية كل الدورات، واضغط أي خانة للتفاصيل.', 'Scroll sideways for all cycles; tap a cell for details.')}</div>

      {sel && selRow && (
        <Sheet open onClose={() => setSel(null)} title={`${selRow.member.name} — ${L('الدورة', 'Cycle')} ${num(sel.cycle + 1)}`}>
          <div className="stack">
            <div className="row between">
              <span className="muted small">
                {date(v.schedule[sel.cycle].dueDate)} · {L('المستحق', 'Due')} <b className="num">{money(selRow.cells[sel.cycle].due, v.circle.currency)}</b>
              </span>
              <StatusChip s={selRow.cells[sel.cycle].status} />
            </div>
            {selRow.cells[sel.cycle].remaining > 0 && selRow.cells[sel.cycle].confirmed > 0 && (
              <div className="warn small">
                {L('دفع جزئي — المتبقي', 'Partial — remaining')}: <b className="num">{money(selRow.cells[sel.cycle].remaining, v.circle.currency)}</b>
              </div>
            )}
            {selPays.length === 0 && <div className="muted small">{L('لا توجد دفعات مسجلة لهذه الدورة.', 'No payments for this cycle.')}</div>}
            {selPays.map((p) => (
              <PaymentItem key={p.id} p={p} currency={v.circle.currency} staff={staff} organizer={role === 'organizer'} />
            ))}
            {v.circle.status === 'active' && selRow.cells[sel.cycle].status !== 'paid' && (staff || isMine) && (
              <button className="btn block" onClick={() => { setPay(sel); setSel(null); }}>
                <Icon name="plus" /> {staff && !isMine ? L('تسجيل دفعة (كاش/تحويل)', 'Record payment') : L('دفعت — ارفع الإثبات', 'I paid — upload proof')}
              </button>
            )}
            {staff && !isMine && selRow.cells[sel.cycle].status !== 'paid' && (
              <button
                className="btn whatsapp block"
                onClick={() => {
                  setWa({ phone: selRow.member.phone, vars: { name: selRow.member.name.split(' ')[0], circle: v.circle.name, amount: selRow.cells[sel.cycle].remaining, currency: v.circle.currency, dueDate: v.schedule[sel.cycle].dueDate } });
                  setSel(null);
                }}
              >
                <Icon name="whatsapp" /> {L('تذكير لطيف عبر واتساب', 'Gentle WhatsApp reminder')}
              </button>
            )}
          </div>
        </Sheet>
      )}
      {pay && <PaySheet open onClose={() => setPay(null)} circleId={v.circle.id} memberId={pay.memberId} cycleIndex={pay.cycle} />}
      {wa && <WhatsAppSheet open onClose={() => setWa(null)} phone={wa.phone} kinds={['late', 'dueDay', 'before3']} vars={wa.vars} />}
    </>
  );
}

// ───────────────────────── الترتيب والتبديل ─────────────────────────

function Order({ v, role, onInvite }: { v: CircleView; role: string; onInvite: () => void }) {
  const [add, setAdd] = useState(false);
  const db = useDB();
  const organizer = role === 'organizer';
  const ordered = [...v.shares].sort((a, b) => (a.position || 999) - (b.position || 999));
  const [manual, setManual] = useState<string[] | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapNote, setSwapNote] = useState('');
  const [swapTo, setSwapTo] = useState('');
  const [reqPos, setReqPos] = useState<string | null>(null);
  const payouts = db.payouts.filter((p) => p.circleId === v.circle.id);
  const swaps = db.swaps.filter((s) => s.circleId === v.circle.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const myMemberIds = v.members.filter((m) => m.userId === db.currentUserId).map((m) => m.id);
  const label = (shareId: string) => v.shares.find((s) => s.id === shareId)?.holders.map((h) => nameOf(v, h.memberId)).join(' و') ?? '؟';
  const sharePos = (shareId: string) => v.shares.find((s) => s.id === shareId)?.position ?? 0;
  const rowArrears = new Map(v.rows.map((r) => [r.member.id, r.cells.filter((c) => c.status === 'late').length]));

  const list = manual ?? ordered.map((s) => s.id);
  const move = (i: number, d: number) => {
    const a = [...list];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setManual(a);
  };

  return (
    <>
      {organizer && (v.circle.status === 'draft' || v.circle.status === 'active') && (
        <div className="btns">
          {v.circle.status === 'draft' && (
            <button className="btn" onClick={() => setAdd(true)}>
              <Icon name="plus" /> {L('إضافة أعضاء', 'Add members')}
            </button>
          )}
          <button className="btn soft" onClick={onInvite}>
            <Icon name="whatsapp" /> {L('دعوة عبر واتساب', 'Invite via WhatsApp')}
          </button>
        </div>
      )}
      <AddMemberSheet open={add} onClose={() => setAdd(false)} circleId={v.circle.id} />
      {v.circle.lottery && (
        <div className="note small row between wrap">
          <span>
            🎲 {L('قرعة إلكترونية', 'Lottery')} · {dateTime(v.circle.lottery.at)} · {L('البذرة', 'Seed')} <b className="num">{v.circle.lottery.seed}</b>
          </span>
          <button className="btn sm soft" onClick={() => go(`/c/${v.circle.id}/lottery`)}>
            {L('إعادة العرض والتحقق', 'Replay & verify')}
          </button>
        </div>
      )}
      {v.circle.orderLocked ? (
        <div className="small muted row">
          <Icon name="lock" size={16} /> {L('الترتيب مقفل منذ البدء. أي تعديل يتم بطلب تبديل يوافق عليه الطرفان والمنظِّم، ويُسجل في السجل.', 'Order is locked. Changes need a swap approved by both members and the organizer.')}
        </div>
      ) : (
        organizer && (
          <div className="card stack">
            <h3>{L('طريقة الترتيب', 'Ordering method')}</h3>
            <div className="btns">
              <button className="btn" onClick={() => go(`/c/${v.circle.id}/lottery`)}>
                <Icon name="dice" /> {L('قرعة', 'Lottery')}
              </button>
              <button className="btn soft" onClick={() => setManual(list)}>
                <Icon name="edit" /> {L('يدوي', 'Manual')}
              </button>
              <button className="btn soft" onClick={() => attempt(() => A.applyRequestOrder(v.circle.id), L('رُتّبت الأدوار حسب أولوية الطلب', 'Ordered by requests'))}>
                <Icon name="hand" /> {L('حسب الطلب', 'By request')}
              </button>
            </div>
            <div className="tiny muted">{L('"حسب الطلب": كل عضو يطلب دوراً، والأسبق طلباً يأخذه.', '"By request": first to ask gets the turn.')}</div>
          </div>
        )
      )}

      <section className="card list">
        {list.map((id, i) => {
          const s = v.shares.find((x) => x.id === id)!;
          const pos = manual ? i + 1 : s.position;
          const cy = pos ? v.schedule[pos - 1] : undefined;
          const delivered = payouts.filter((p) => p.cycleIndex === pos - 1);
          const mine = s.holders.some((h) => myMemberIds.includes(h.memberId));
          const isNow = pos - 1 === v.current && v.circle.status === 'active';
          return (
            <div className="item" key={id} style={mine ? { background: 'var(--brand-soft)', borderRadius: 12, paddingInline: 8 } : undefined}>
              <span className={`pos ${delivered.length ? 'done' : isNow ? 'now' : ''}`}>{pos ? num(pos) : '؟'}</span>
              <a className="grow" style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }} href={manual ? undefined : `#/c/${v.circle.id}/m/${s.holders[0]?.memberId}`}>
                <b className="ellipsis" style={{ display: 'block' }}>
                  {label(id)} {mine && <span className="chip s-brand">{L('أنت', 'You')}</span>}
                  {s.holders.some((h) => (rowArrears.get(h.memberId) ?? 0) > 0) && <span className="chip s-late">{L('متأخر', 'Late')}</span>}
                </b>
                <div className="tiny muted">
                  {cy ? date(cy.dueDate) : L('لم يُحدد', 'Not set')} · {money(v.pot, v.circle.currency)}
                  {s.holders.length > 1 && ` · ${L('نصف سهم لكل منهما', 'half share each')}`}
                  {delivered.length > 0 && ` · ✓ ${L('سُلّم', 'paid out')}`}
                  {!v.circle.orderLocked && s.requestedPosition && ` · ${L('طلب الدور', 'requested')} ${num(s.requestedPosition)}`}
                </div>
              </a>
              {manual ? (
                <div className="row" style={{ gap: 2 }}>
                  <button className="icon-btn" onClick={() => move(i, -1)} aria-label={L('أعلى', 'Up')}>
                    ▲
                  </button>
                  <button className="icon-btn" onClick={() => move(i, 1)} aria-label={L('أسفل', 'Down')}>
                    ▼
                  </button>
                </div>
              ) : !v.circle.orderLocked && mine ? (
                <button className="btn sm ghost" onClick={() => setReqPos(id)}>
                  {L('اطلب دوراً', 'Request')}
                </button>
              ) : (
                v.circle.status === 'active' &&
                (mine || organizer) &&
                !delivered.length && (
                  <button className="btn sm ghost" onClick={() => setSwapFrom(id)} aria-label={L('طلب تبديل', 'Request swap')}>
                    <Icon name="swap" size={18} />
                  </button>
                )
              )}
            </div>
          );
        })}
      </section>
      {manual && (
        <div className="btns">
          <button className="btn" onClick={() => attempt(() => A.setManualOrder(v.circle.id, manual), L('حُفظ الترتيب', 'Order saved')) && setManual(null)}>
            {L('حفظ الترتيب', 'Save order')}
          </button>
          <button className="btn ghost" onClick={() => setManual(null)}>
            {L('إلغاء', 'Cancel')}
          </button>
        </div>
      )}

      {swaps.length > 0 && (
        <>
          <div className="section-title">
            <h2>{L('طلبات التبديل', 'Swap requests')}</h2>
          </div>
          {swaps.map((s) => {
            const to = v.shares.find((x) => x.id === s.toShareId);
            const amTo = to?.holders.some((h) => myMemberIds.includes(h.memberId));
            const canAnswer = s.status === 'open' && ((amTo && !s.approvals.to) || (organizer && !s.approvals.organizer));
            return (
              <div className="card stack" key={s.id} style={{ gap: 8 }}>
                <div className="row between">
                  <b>
                    {label(s.fromShareId)} ({num(sharePos(s.fromShareId))}) ⇄ {label(s.toShareId)} ({num(sharePos(s.toShareId))})
                  </b>
                  <span className={`chip ${s.status === 'done' ? 's-paid' : s.status === 'rejected' ? 's-late' : 's-pending'}`}>
                    {{ open: L('مفتوح', 'Open'), done: L('نُفذ', 'Done'), rejected: L('مرفوض', 'Rejected') }[s.status]}
                  </span>
                </div>
                {s.note && <div className="small">💬 {s.note}</div>}
                <div className="row wrap small" style={{ gap: 6 }}>
                  <Approval ok={!!s.approvals.from} t={L('الطالب', 'Requester')} />
                  <Approval ok={!!s.approvals.to} t={L('الطرف الآخر', 'Other member')} />
                  <Approval ok={!!s.approvals.organizer} t={L('المنظِّم', 'Organizer')} />
                </div>
                {canAnswer && (
                  <div className="btns">
                    <button className="btn sm" onClick={() => attempt(() => A.answerSwap(s.id, true), L('تمت الموافقة', 'Approved'))}>
                      <Icon name="check" size={18} /> {L('موافقة', 'Approve')}
                    </button>
                    <button className="btn sm danger" onClick={() => attempt(() => A.answerSwap(s.id, false), L('رُفض الطلب', 'Rejected'))}>
                      {L('رفض', 'Reject')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <Sheet open={!!swapFrom} onClose={() => setSwapFrom(null)} title={L('طلب تبديل دور', 'Request a turn swap')}>
        {swapFrom && (
          <div className="stack">
            <div className="note small">
              {L('دورك الحالي', 'Current turn')}: {num(sharePos(swapFrom))} — {label(swapFrom)}
            </div>
            <Field label={L('التبديل مع', 'Swap with')}>
              <select className="input" value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>
                <option value="">{L('اختر دوراً', 'Choose a turn')}</option>
                {ordered
                  .filter((s) => s.id !== swapFrom && !payouts.some((p) => p.cycleIndex === s.position - 1))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {num(s.position)} — {label(s.id)} ({date(v.schedule[s.position - 1]?.dueDate)})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={L('السبب (يظهر للطرف الآخر)', 'Reason (visible to the other member)')}>
              <input className="input" value={swapNote} onChange={(e) => setSwapNote(e.target.value)} />
            </Field>
            <button
              className="btn block"
              disabled={!swapTo}
              onClick={() =>
                attempt(() => {
                  A.requestSwap(swapFrom, swapTo, swapNote);
                  setSwapFrom(null);
                  setSwapTo('');
                  setSwapNote('');
                }, L('أُرسل الطلب للطرف الآخر والمنظِّم', 'Request sent'))
              }
            >
              {L('إرسال الطلب', 'Send request')}
            </button>
          </div>
        )}
      </Sheet>
      <Sheet open={!!reqPos} onClose={() => setReqPos(null)} title={L('اطلب دوراً معيناً', 'Request a turn')}>
        <div className="stack">
          <div className="small muted">{L('يُرتّب المنظِّم حسب أسبقية الطلب إن اختار هذه الطريقة.', 'The organizer may order by who asked first.')}</div>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {v.schedule.map((c) => (
              <button key={c.index} className="btn sm soft" onClick={() => attempt(() => A.requestPosition(reqPos!, c.index + 1), L('سُجّل طلبك', 'Requested')) && setReqPos(null)}>
                {num(c.index + 1)}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

function Approval({ ok, t }: { ok: boolean; t: string }) {
  return <span className={`chip ${ok ? 's-paid' : ''}`}>{ok ? '✓' : '○'} {t}</span>;
}

// ───────────────────────── السجل ─────────────────────────

function Log({ circleId }: { circleId: string }) {
  const db = useDB();
  const entries = db.log.filter((e) => e.circleId === circleId);
  const broken = useMemo(() => verifyLog(entries), [entries]);
  const [q, setQ] = useState('');
  const shown = [...entries].reverse().filter((e) => !q || e.message.includes(q) || e.actorName.includes(q));
  return (
    <>
      <div className={broken === -1 ? 'note row' : 'error row'}>
        <Icon name="shield" />
        <span className="small">
          {broken === -1
            ? L(`السجل سليم — ${num(entries.length)} قيداً مترابطة بسلسلة تجزئة ولا يمكن حذفها أو تعديلها دون اكتشاف ذلك.`, `Log intact — ${entries.length} hash-chained entries.`)
            : L(`تحذير: تم العبث بالسجل عند القيد رقم ${num(broken + 1)}`, `Warning: log tampered at entry ${broken + 1}`)}
        </span>
      </div>
      <input className="input" placeholder={L('بحث في السجل…', 'Search the log…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <section className="card list">
        {shown.map((e) => (
          <div className="item" key={e.id} style={{ alignItems: 'flex-start' }}>
            <span className="avatar sm">
              <Icon name={logIcon(e.type)} size={16} />
            </span>
            <div className="grow">
              <div className="small">{e.message}</div>
              <div className="tiny muted">
                {e.actorName} · {dateTime(e.at)} · <span className="num" dir="ltr">#{e.hash.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        ))}
        {!shown.length && <Empty icon="log" title={L('لا نتائج', 'No results')} />}
      </section>
    </>
  );
}

const logIcon = (t: string) =>
  t.startsWith('payment') ? 'receipt' : t.startsWith('payout') ? 'wallet' : t.startsWith('swap') ? 'swap' : t.startsWith('order') ? 'dice' : t.startsWith('member') ? 'user' : t.startsWith('cycle') ? 'pause' : 'log';

// ───────────────────────── المزيد: القواعد والحالات الخاصة والتقارير ─────────────────────────

function More({ v, role }: { v: CircleView; role: string }) {
  const db = useDB();
  const organizer = role === 'organizer';
  const today = todayISO();
  const [postpone, setPostpone] = useState(false);
  const [pCycle, setPCycle] = useState(() => v.schedule.find((c) => c.dueDate > today)?.index ?? 0);
  const [pReason, setPReason] = useState(L('رمضان', 'Ramadan'));
  const [terminate, setTerminate] = useState(false);
  const [editRules, setEditRules] = useState(false);
  const [rules, setRules] = useState(v.circle.rules);
  const [grace, setGrace] = useState(v.circle.graceDays);
  const settlement = useMemo(
    () => finalSettlement(v.members.filter((m) => !(m.status === 'withdrawn' && v.members.some((x) => x.replacesMemberId === m.id))).map((m) => m.id), lineagePayments(db, v), lineagePayouts(db, v)),
    [db, v],
  );
  const future = v.schedule.filter((c) => c.dueDate > today);
  const allDelivered = new Set(db.payouts.filter((p) => p.circleId === v.circle.id).map((p) => p.cycleIndex)).size >= v.circle.sharesCount;

  return (
    <>
      <CircleDetails v={v} />
      <section className="card stack">
        <div className="row between">
          <h3 style={{ margin: 0 }}>{L('قواعد الجمعية', 'Rules')}</h3>
          {organizer && !editRules && (
            <button className="btn sm ghost" onClick={() => setEditRules(true)}>
              <Icon name="edit" size={16} /> {L('تعديل', 'Edit')}
            </button>
          )}
        </div>
        {editRules ? (
          <>
            <textarea className="input" value={rules} onChange={(e) => setRules(e.target.value)} style={{ minHeight: 160 }} />
            <Field label={L('مهلة السماح (أيام)', 'Grace (days)')}>
              <input className="input num" inputMode="numeric" value={grace} onChange={(e) => setGrace(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </Field>
            <button className="btn" onClick={() => attempt(() => A.updateCircle(v.circle.id, { rules, graceDays: grace }), L('حُفظت القواعد وسُجل التعديل', 'Saved')) && setEditRules(false)}>
              {L('حفظ', 'Save')}
            </button>
          </>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }} className="small">
            {v.circle.rules || L('لا توجد قواعد مكتوبة.', 'No written rules.')}
          </div>
        )}
      </section>

      <section className="card stack">
        <h3>{L('التقارير والتصدير', 'Reports')}</h3>
        <button className="btn soft block" onClick={() => go(`/c/${v.circle.id}/report`)}>
          <Icon name="chart" /> {L('التقرير الكامل (PDF)', 'Full report (PDF)')}
        </button>
      </section>

      {organizer && (v.circle.status === 'active' || v.circle.status === 'draft') && (
        <section className="card stack">
          <h3>{L('الحالات الخاصة', 'Special cases')}</h3>
          <button className="btn ghost block" disabled={!future.length || v.circle.status !== 'active'} onClick={() => setPostpone(true)}>
            <Icon name="pause" /> {L('تأجيل دورة (رمضان، عيد…)', 'Postpone a cycle')}
          </button>
          <div className="tiny muted">{L('لانسحاب عضو أو استبداله: افتح ملف العضو من تبويب "الأعضاء".', 'To withdraw or replace a member, open their profile in Members.')}</div>
          {v.circle.status === 'active' && allDelivered && (
            <button className="btn block" onClick={() => attempt(() => A.completeCircle(v.circle.id), L('مبروك! اكتملت الجمعية 🎉', 'Completed 🎉'))}>
              <Icon name="check" /> {L('إغلاق الجمعية كمكتملة', 'Mark as completed')}
            </button>
          )}
          <button className="btn danger block" onClick={() => setTerminate(true)}>
            <Icon name="stop" /> {L('إنهاء الجمعية مبكراً', 'End circle early')}
          </button>
        </section>
      )}

      {(v.circle.status === 'terminated' || (organizer && v.circle.status === 'active')) && (
        <section className="card stack" style={{ gap: 6 }}>
          <h3>{v.circle.status === 'terminated' ? L('التسوية النهائية', 'Final settlement') : L('معاينة التسوية لو أُنهيت اليوم', 'Settlement preview if ended today')}</h3>
          <div className="small muted">{L('كل عضو يسترد ما دفعه ناقص ما استلمه. السالب = عليه دفعه.', 'Each member gets back what they paid minus what they received. Negative = owes.')}</div>
          {settlement.lines.map((l) => (
            <div className="row between small" key={l.memberId}>
              <span>{nameOf(v, l.memberId)}</span>
              <b className="num" style={{ color: l.net > 0 ? 'var(--paid)' : l.net < 0 ? 'var(--late)' : undefined }}>
                {l.net > 0 ? L('له ', 'gets ') : l.net < 0 ? L('عليه ', 'owes ') : ''}
                {money(Math.abs(l.net), v.circle.currency)}
              </b>
            </div>
          ))}
          <hr />
          <div className="row between small">
            <span>{L('محصّل لم يُسلّم (لدى المنظِّم)', 'Collected, not paid out (held)')}</span>
            <b className="num">{money(settlement.heldByOrganizer, v.circle.currency)}</b>
          </div>
          <div className="row between small">
            <span>{L('التوازن', 'Balanced')}</span>
            <b>{settlement.balanced ? '✓' : '✗'}</b>
          </div>
        </section>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{L('سجل النشاط (لا يُحذف — مرجع عند أي خلاف)', 'Activity log (tamper-evident)')}</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <Log circleId={v.circle.id} />
        </div>
      </details>

      <div className="note small">{L('مبدأ جمعيتي: التطبيق أداة تنظيم وتوثيق فقط، لا يحتفظ بأموال ولا يحوّلها، وبلا فوائد أو رسوم.', 'Jamiyati organizes and documents only. It never holds or moves money. No interest or fees.')}</div>

      <Sheet open={postpone} onClose={() => setPostpone(false)} title={L('تأجيل دورة', 'Postpone a cycle')}>
        <div className="stack">
          <Field label={L('الدورة', 'Cycle')} hint={L('تُزاح هذه الدورة وكل ما بعدها فترة واحدة', 'This and all later cycles shift by one period')}>
            <select className="input" value={pCycle} onChange={(e) => setPCycle(Number(e.target.value))}>
              {future.map((c) => (
                <option key={c.index} value={c.index}>
                  {L('الدورة', 'Cycle')} {num(c.index + 1)} — {date(c.dueDate)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={L('السبب', 'Reason')}>
            <input className="input" value={pReason} onChange={(e) => setPReason(e.target.value)} />
          </Field>
          <button className="btn block" disabled={!pReason.trim()} onClick={() => attempt(() => A.postponeCycle(v.circle.id, pCycle, pReason), L('أُجّلت الدورة وأُعيد حساب المواعيد وأُبلغ الأعضاء', 'Postponed')) && setPostpone(false)}>
            {L('تأجيل وإعادة حساب التواريخ', 'Postpone & recalculate')}
          </button>
        </div>
      </Sheet>
      <ReasonSheet
        open={terminate}
        onClose={() => setTerminate(false)}
        title={L('إنهاء الجمعية مبكراً', 'End circle early')}
        placeholder={L('سبب الإنهاء (يُحفظ في السجل)', 'Reason (saved in the log)')}
        confirmText={L('إنهاء وإصدار التسوية', 'End & settle')}
        danger
        onSubmit={(r) => attempt(() => A.terminateCircle(v.circle.id, r), L('أُنهيت الجمعية. راجع التسوية النهائية.', 'Circle ended')) && setTerminate(false)}
      />
    </>
  );
}

// دفعات/استلامات منسوبة للعضو الحالي في خط الوراثة (البديل يرث ما دفعه المنسحب)
function lineagePayments(db: ReturnType<typeof useDB>, v: CircleView) {
  const map = replacementMap(v);
  return db.payments.filter((p) => p.circleId === v.circle.id).map((p) => ({ ...p, memberId: map(p.memberId) }));
}
function lineagePayouts(db: ReturnType<typeof useDB>, v: CircleView) {
  const map = replacementMap(v);
  return db.payouts.filter((p) => p.circleId === v.circle.id).map((p) => ({ ...p, memberId: map(p.memberId) }));
}
function replacementMap(v: CircleView) {
  return (id: string) => {
    let cur = id;
    for (let i = 0; i < 20; i++) {
      const next = v.members.find((m) => m.replacesMemberId === cur);
      if (!next) break;
      cur = next.id;
    }
    return cur;
  };
}

