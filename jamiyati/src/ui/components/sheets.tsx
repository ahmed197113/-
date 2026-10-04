import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { todayISO } from '../../domain/dates';
import type { Payment, PaymentMethod } from '../../domain/types';
import { L } from '../../lib/i18n';
import { date, dateTime, methodLabel, money, num } from '../../lib/format';
import { compressImage } from '../../lib/image';
import { template, waLink, type TemplateKind, type TemplateVars } from '../../lib/whatsapp';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { circleView, canConfirm, roleIn, userReliability } from '../../store/selectors';
import { badges, reliabilityScore } from '../../domain/calc';
import { Icon } from './Icon';
import { attempt, Field, ReasonSheet, Seg, Sheet, StatusChip, toast } from './ui';
import { go } from '../router';

// ───────── دفعت / تسجيل دفعة ─────────

export function PaySheet({ open, onClose, circleId, memberId, cycleIndex }: { open: boolean; onClose: () => void; circleId: string; memberId: string; cycleIndex: number }) {
  const db = useDB();
  const today = todayISO();
  const v = circleView(db, circleId, today);
  const role = roleIn(db, circleId, db.currentUserId);
  const staff = canConfirm(role);
  const [mid, setMid] = useState(memberId);
  const [cy, setCy] = useState(cycleIndex);
  const row = v?.rows.find((r) => r.member.id === mid);
  const remaining = row?.cells[cy]?.remaining ?? 0;
  const pendingAmt = row?.cells[cy]?.pending ?? 0;
  const [amount, setAmount] = useState(String(Math.max(0, remaining - pendingAmt) || ''));
  const [method, setMethod] = useState<PaymentMethod>(row?.member.preferredPayment ?? 'bank');
  const [paidAt, setPaidAt] = useState(today);
  const [proof, setProof] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMid(memberId);
    setCy(cycleIndex);
    setProof(undefined);
    setNote('');
    setPaidAt(today);
  }, [open, memberId, cycleIndex, today]);
  useEffect(() => {
    const r = v?.rows.find((x) => x.member.id === mid);
    const c = r?.cells[cy];
    if (c) setAmount(String(Math.max(0, c.remaining - c.pending) || c.due));
    if (r?.member.preferredPayment) setMethod(r.member.preferredPayment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, cy, open]);

  if (!v || !row) return null;
  const isSelf = row.member.userId === db.currentUserId;
  const direct = staff;
  const amt = Number(amount);

  const submit = () =>
    attempt(() => {
      A.submitPayment({ circleId, memberId: mid, cycleIndex: cy, amount: amt, method, paidAt, proofImage: proof, note: note.trim() || undefined });
      onClose();
    }, direct ? L('تم تسجيل الدفعة وتأكيدها ✓', 'Payment recorded ✓') : L('أُرسل الإثبات للمنظم للتأكيد ✓', 'Proof sent for confirmation ✓'));

  return (
    <Sheet open={open} onClose={onClose} title={direct && !isSelf ? L('تسجيل دفعة', 'Record payment') : L('دفعت القسط', 'I paid')}>
      <div className="stack">
        {staff && (
          <Field label={L('العضو', 'Member')}>
            <select className="input" value={mid} onChange={(e) => setMid(e.target.value)}>
              {v.rows.map((r) => (
                <option key={r.member.id} value={r.member.id}>
                  {r.member.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={L('الدورة', 'Cycle')}>
          <select className="input" value={cy} onChange={(e) => setCy(Number(e.target.value))}>
            {v.schedule.map((s, i) => (
              <option key={i} value={i}>
                {L(`الدورة ${i + 1}`, `Cycle ${i + 1}`)} — {date(s.dueDate)} — {row.cells[i].status === 'paid' ? '✓' : money(row.cells[i].remaining, v.circle.currency)}
              </option>
            ))}
          </select>
        </Field>
        <div className="row between small">
          <span className="muted">
            {L('المستحق', 'Due')}: <b className="num">{money(row.cells[cy].due, v.circle.currency)}</b> · {L('المتبقي', 'Left')}: <b className="num">{money(remaining, v.circle.currency)}</b>
          </span>
          <StatusChip s={row.cells[cy].status} />
        </div>
        {pendingAmt > 0 && <div className="warn">{L(`توجد دفعة بـ ${num(pendingAmt)} بانتظار التأكيد لهذه الدورة`, `${pendingAmt} pending confirmation for this cycle`)}</div>}
        <Field label={L('المبلغ', 'Amount')} hint={amt > 0 && amt < remaining ? L('دفع جزئي — سيبقى الباقي مستحقاً', 'Partial payment') : undefined}>
          <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label={L('طريقة الدفع', 'Method')}>
          <Seg value={method} onChange={setMethod} options={(['bank', 'wallet', 'cash'] as PaymentMethod[]).map((m) => ({ v: m, t: methodLabel(m) }))} />
        </Field>
        <Field label={L('تاريخ الدفع', 'Paid on')}>
          <input className="input" type="date" value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label={L('صورة إثبات التحويل', 'Transfer proof')} hint={!direct && method !== 'cash' ? L('مطلوبة للتحويل البنكي والمحفظة', 'Required for transfers') : L('اختيارية', 'Optional')}>
          <label className="btn ghost block" style={{ cursor: 'pointer' }}>
            <Icon name="upload" /> {proof ? L('تغيير الصورة', 'Change image') : L('اختر صورة أو التقط', 'Choose or take a photo')}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                try {
                  setProof(await compressImage(f));
                } catch (er) {
                  toast(String((er as Error).message));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </Field>
        {proof && <img src={proof} alt={L('معاينة الإثبات', 'Proof preview')} className="proof" />}
        <Field label={L('ملاحظة (اختياري)', 'Note (optional)')}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="btn block" disabled={busy || !(amt > 0)} onClick={submit}>
          <Icon name="check" /> {direct ? L('تسجيل وتأكيد', 'Record & confirm') : L('إرسال للتأكيد', 'Send for confirmation')}
        </button>
        {!direct && <div className="note small">{L('التطبيق لا يحوّل الأموال. ادفع للمنظم مباشرة ثم ارفع الإثبات هنا.', 'The app never moves money. Pay the organizer directly, then upload proof here.')}</div>}
      </div>
    </Sheet>
  );
}

// ───────── تفاصيل الدفعة ومراجعتها ─────────

export function PaymentItem({ p, currency, staff, organizer }: { p: Payment; currency: string; staff: boolean; organizer: boolean }) {
  const db = useDB();
  const [reject, setReject] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const reviewer = db.users.find((u) => u.id === p.reviewedBy)?.name;
  const st = p.status === 'confirmed' ? 'paid' : p.status === 'pending' ? 'pending' : 'late';
  return (
    <div className="card tight stack" style={{ gap: 8 }}>
      <div className="row between">
        <b className="num">{money(p.amount, currency)}</b>
        <span className={`chip s-${st}`}>
          {{ confirmed: L('مؤكدة', 'Confirmed'), pending: L('بانتظار التأكيد', 'Pending'), rejected: L('مرفوضة', 'Rejected'), voided: L('ملغاة', 'Voided') }[p.status]}
        </span>
      </div>
      <div className="small muted">
        {methodLabel(p.method)} · {L('دُفعت', 'Paid')} {date(p.paidAt)} · {L('أُرسلت', 'Sent')} {dateTime(p.submittedAt)}
        {reviewer && p.reviewedAt && <> · {L('راجعها', 'Reviewed by')} {reviewer}</>}
      </div>
      {p.note && <div className="small">📝 {p.note}</div>}
      {p.rejectReason && <div className="error small">{L('سبب الرفض', 'Reason')}: {p.rejectReason}</div>}
      {p.voidReason && <div className="warn small">{L('سبب الإلغاء', 'Void reason')}: {p.voidReason}</div>}
      {p.proofImage && (
        <>
          <button className="btn sm ghost" onClick={() => setShowProof((s) => !s)}>
            <Icon name="receipt" size={18} /> {showProof ? L('إخفاء الإثبات', 'Hide proof') : L('عرض الإثبات', 'View proof')}
          </button>
          {showProof && <img src={p.proofImage} className="proof" alt={L('إثبات التحويل', 'Transfer proof')} />}
        </>
      )}
      <div className="btns">
        {staff && p.status === 'pending' && (
          <>
            <button className="btn sm" onClick={() => attempt(() => A.reviewPayment(p.id, true), L('تم التأكيد ✓', 'Confirmed ✓'))}>
              <Icon name="check" size={18} /> {L('تأكيد', 'Confirm')}
            </button>
            <button className="btn sm danger" onClick={() => setReject(true)}>
              <Icon name="x" size={18} /> {L('رفض', 'Reject')}
            </button>
          </>
        )}
        {p.status === 'confirmed' && (
          <button className="btn sm soft" onClick={() => go(`/r/${p.id}`)}>
            <Icon name="receipt" size={18} /> {L('الإيصال', 'Receipt')}
          </button>
        )}
        {organizer && p.status === 'confirmed' && (
          <button className="btn sm ghost" onClick={() => setVoiding(true)}>
            {L('إلغاء الدفعة', 'Void')}
          </button>
        )}
      </div>
      <ReasonSheet
        open={reject}
        onClose={() => setReject(false)}
        title={L('سبب رفض الدفعة', 'Rejection reason')}
        placeholder={L('مثال: المبلغ في الإثبات لا يطابق، أو الصورة غير واضحة', 'e.g. amount mismatch')}
        confirmText={L('رفض الدفعة', 'Reject')}
        danger
        onSubmit={(r) => attempt(() => A.reviewPayment(p.id, false, r), L('تم الرفض وإبلاغ العضو', 'Rejected')) && setReject(false)}
      />
      <ReasonSheet
        open={voiding}
        onClose={() => setVoiding(false)}
        title={L('إلغاء دفعة مؤكدة', 'Void confirmed payment')}
        placeholder={L('السبب (سيبقى في السجل ولا يُحذف)', 'Reason (kept in the log)')}
        confirmText={L('إلغاء الدفعة', 'Void payment')}
        danger
        onSubmit={(r) => attempt(() => A.voidPayment(p.id, r), L('أُلغيت الدفعة وبقيت في السجل', 'Voided')) && setVoiding(false)}
      />
    </div>
  );
}

// ───────── رسالة واتساب قابلة للتعديل ─────────

export function WhatsAppSheet({ open, onClose, phone, kinds, vars }: { open: boolean; onClose: () => void; phone?: string; kinds: TemplateKind[]; vars: TemplateVars }) {
  const [kind, setKind] = useState<TemplateKind>(kinds[0]);
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setKind(kinds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const varsKey = JSON.stringify(vars);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setText(template(kind, vars)), [kind, varsKey, open]);
  const names: Record<TemplateKind, string> = {
    before3: L('قبل الموعد', 'Before due'),
    dueDay: L('يوم الاستحقاق', 'Due day'),
    late: L('تأخير (بلطف)', 'Late (gentle)'),
    turn: L('إعلان الدور', 'Turn announcement'),
    invite: L('دعوة', 'Invite'),
    thanks: L('شكر', 'Thanks'),
    lottery: L('نتيجة القرعة', 'Lottery result'),
  };
  return (
    <Sheet open={open} onClose={onClose} title={L('رسالة واتساب', 'WhatsApp message')}>
      <div className="stack">
        {kinds.length > 1 && <Seg value={kind} onChange={setKind} options={kinds.map((k) => ({ v: k, t: names[k] }))} />}
        <textarea className="input" style={{ minHeight: 170 }} value={text} onChange={(e) => setText(e.target.value)} aria-label={L('نص الرسالة', 'Message text')} />
        <div className="small muted">{L('النص قابل للتعديل قبل الإرسال.', 'You can edit the text before sending.')}</div>
        <a className="btn whatsapp block" href={waLink(phone, text)} target="_blank" rel="noreferrer" onClick={onClose}>
          <Icon name="whatsapp" /> {phone ? L('إرسال عبر واتساب', 'Send on WhatsApp') : L('اختيار جهة في واتساب', 'Pick a WhatsApp chat')}
        </a>
        <button className="btn ghost block" onClick={() => navigator.clipboard?.writeText(text).then(() => toast(L('نُسخ النص', 'Copied')))}>
          <Icon name="copy" /> {L('نسخ النص', 'Copy text')}
        </button>
      </div>
    </Sheet>
  );
}

// ───────── الدعوة: كود + رابط + QR + إضافة يدوية ─────────

export function InviteSheet({ open, onClose, circleId }: { open: boolean; onClose: () => void; circleId: string }) {
  const db = useDB();
  const c = db.circles.find((x) => x.id === circleId)!;
  const link = `${location.origin}${location.pathname}#/join/${c.inviteCode}`;
  const [qr, setQr] = useState('');
  const [wa, setWa] = useState(false);
  useEffect(() => {
    if (open) QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#0b3b36', light: '#ffffff' } }).then(setQr);
  }, [open, link]);
  const vars = useMemo(() => ({ name: '', circle: c.name, amount: c.installment, currency: c.currency, code: c.inviteCode, link }), [c, link]);
  return (
    <Sheet open={open} onClose={onClose} title={L('دعوة أعضاء', 'Invite members')}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="muted small">{L('كود الدعوة', 'Invite code')}</div>
        <div className="code">{c.inviteCode}</div>
        {qr && (
          <div className="qr">
            <img src={qr} width={200} height={200} alt={L('رمز QR للانضمام', 'Join QR code')} />
          </div>
        )}
        <div className="btns" style={{ width: '100%' }}>
          <button className="btn soft" onClick={() => navigator.clipboard?.writeText(link).then(() => toast(L('نُسخ الرابط', 'Link copied')))}>
            <Icon name="copy" /> {L('نسخ الرابط', 'Copy link')}
          </button>
          <button className="btn whatsapp" onClick={() => setWa(true)}>
            <Icon name="whatsapp" /> {L('واتساب', 'WhatsApp')}
          </button>
        </div>
        {c.status !== 'draft' && <div className="warn small">{L('الجمعية بدأت؛ الانضمام بالكود متوقف. للاستبدال استخدم "انسحاب عضو".', 'Circle started; joining is closed.')}</div>}
      </div>
      <WhatsAppSheet open={wa} onClose={() => setWa(false)} kinds={['invite']} vars={vars} />
    </Sheet>
  );
}

export function AddMemberSheet({ open, onClose, circleId }: { open: boolean; onClose: () => void; circleId: string }) {
  const db = useDB();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [units, setUnits] = useState(1);
  const p = phone.replace(/\D/g, '');
  const existing = p.length >= 8 ? db.users.find((u) => u.phone === p || u.phone.endsWith(p.replace(/^0+/, ''))) : undefined;
  const rel = existing?.shareReputation ? userReliability(db, existing.id, todayISO()) : undefined;
  return (
    <Sheet open={open} onClose={onClose} title={L('إضافة عضو يدوياً', 'Add member manually')}>
      <div className="stack">
        <div className="note small">{L('لمن لا يملك التطبيق: يُضاف برقم جواله ويصله التذكير عبر واتساب. إن ثبّت التطبيق لاحقاً بنفس الرقم يرتبط تلقائياً.', 'For people without the app: reminders go via WhatsApp. If they sign up later with the same number, it links automatically.')}</div>
        <Field label={L('الاسم', 'Name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label={L('رقم الجوال (دولي)', 'Phone (international)')} hint={L('مثال: 9665xxxxxxxx أو 201xxxxxxxxx', 'e.g. 9665xxxxxxxx')}>
          <input className="input ltr num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
        {existing && (
          <div className="card tight">
            <div className="row between">
              <b>{existing.name}</b>
              <span className="chip s-brand">{L('مستخدم للتطبيق', 'App user')}</span>
            </div>
            {rel ? <ReputationLine stats={rel} /> : <div className="small muted">{L('لم يوافق على مشاركة سجل التزامه', 'Has not shared their record')}</div>}
          </div>
        )}
        <Field label={L('عدد الأسهم', 'Shares')}>
          <Seg value={units} onChange={setUnits} options={[{ v: 0.5, t: L('نصف', 'Half') }, { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }]} />
        </Field>
        <button
          className="btn block"
          disabled={!name.trim()}
          onClick={() =>
            attempt(() => {
              A.addMember(circleId, name, p, units);
              setName('');
              setPhone('');
              setUnits(1);
              onClose();
            }, L('أُضيف العضو ✓', 'Member added ✓'))
          }
        >
          <Icon name="plus" /> {L('إضافة', 'Add')}
        </button>
      </div>
    </Sheet>
  );
}

export function ReputationLine({ stats }: { stats: ReturnType<typeof userReliability> }) {
  const bs = badges(stats);
  const score = reliabilityScore(stats);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row wrap small">
        <span>
          {L('الالتزام', 'On time')}: <b className="num">{num(stats.onTimeRate)}%</b>
        </span>
        <span>
          · {L('متوسط التأخير', 'Avg delay')}: <b className="num">{num(stats.avgDelayDays, 1)}</b> {L('يوم', 'd')}
        </span>
        <span>
          · {L('جمعيات مكتملة', 'Completed')}: <b className="num">{num(stats.completedCircles)}</b>
        </span>
        {stats.cyclesDue > 0 && (
          <span>
            · {L('الدرجة', 'Score')}: <b className="num">{num(score)}</b>/100
          </span>
        )}
      </div>
      {bs.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {bs.map((b) => (
            <BadgeChip key={b} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BadgeChip({ b }: { b: ReturnType<typeof badges>[number] }) {
  const t = {
    committed100: ['⭐', L('ملتزم 100%', '100% on time')],
    completed5: ['🏆', L('أكمل 5 جمعيات', '5 circles completed')],
    completed1: ['✅', L('أكمل جمعية', 'Completed a circle')],
    veteran: ['🎖️', L('خبير جمعيات', 'Veteran')],
    newcomer: ['🌱', L('جديد', 'Newcomer')],
  }[b];
  return (
    <span className={`chip ${b === 'newcomer' ? 's-brand' : 's-gold'}`}>
      {t[0]} {t[1]}
    </span>
  );
}
