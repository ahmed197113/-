import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { L } from '../../lib/i18n';
import type { CellStatus } from '../../domain/calc';
import { back } from '../router';

// ───── Toast ─────
export interface ToastAction {
  label: string;
  run: () => void;
}
let pushToast: (t: { text: string; err?: boolean; actions?: ToastAction[] }) => void = () => {};
export function toast(text: string, actions?: ToastAction[]) {
  pushToast({ text, actions });
}
export function toastError(e: unknown) {
  pushToast({ text: e instanceof Error ? e.message : String(e), err: true });
}
export function Toaster() {
  const [t, setT] = useState<{ text: string; err?: boolean; actions?: ToastAction[]; k: number } | null>(null);
  useEffect(() => {
    pushToast = (x) => setT({ ...x, k: Date.now() });
    // أزرار التراجع تخص الشاشة التي ظهرت فيها
    const clear = () => setT((cur) => (cur?.actions?.length ? null : cur));
    window.addEventListener('hashchange', clear);
    return () => window.removeEventListener('hashchange', clear);
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), t.actions?.length ? 7000 : t.err ? 4500 : 2600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <div className={`${t.err ? 'err' : ''} ${t.actions?.length ? 'has-actions' : ''}`} key={t.k}>
        <span>{t.text}</span>
        {t.actions?.map((a) => (
          <button
            key={a.label}
            className="toast-act"
            onClick={() => {
              setT(null);
              a.run();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** يشغّل عملية ويعرض الخطأ برسالة مفهومة بدلاً من الانهيار */
export function attempt(fn: () => void, ok?: string): boolean {
  try {
    fn();
    if (ok) toast(ok);
    return true;
  } catch (e) {
    toastError(e);
    return false;
  }
}

// ───── Top bar ─────
export function TopBar({ title, backTo, actions }: { title: string; backTo?: string | true; actions?: ReactNode }) {
  return (
    <header className="top">
      {backTo && (
        <button className="icon-btn" onClick={() => back(typeof backTo === 'string' ? backTo : '/')} aria-label={L('رجوع', 'Back')}>
          <Icon name="back" className="flip" />
        </button>
      )}
      <h1>{title}</h1>
      {actions}
    </header>
  );
}

// ───── Sheet ─────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={L('إغلاق', 'Close')}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** حقل بعنوان: يربط العنوان بالعنصر عبر aria-labelledby (بدلاً من <label> كي لا تتأثر الأزرار المضمّنة) */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': id }) : children;
  return (
    <div className="field">
      <span id={id}>{label}</span>
      {child}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, label, ...rest }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; label?: string; 'aria-labelledby'?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} aria-labelledby={label ? undefined : rest['aria-labelledby']}>
      {options.map((o) => (
        <button type="button" key={String(o.v)} role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">
        <Icon name={icon} size={34} />
      </div>
      <strong style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>{title}</strong>
      {text && <div className="small">{text}</div>}
      {action}
    </div>
  );
}

export const statusText = (s: CellStatus) =>
  ({
    paid: L('مدفوع', 'Paid'),
    pending: L('بانتظار التأكيد', 'Pending'),
    late: L('متأخر', 'Late'),
    upcoming: L('لم يحن', 'Upcoming'),
    due: L('مستحق الآن', 'Due now'),
    partial: L('جزئي', 'Partial'),
    none: '—',
  })[s];

export function StatusChip({ s }: { s: CellStatus }) {
  return <span className={`chip s-${s}`}>{statusText(s)}</span>;
}

export function Avatar({ name, sm }: { name: string; sm?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return <span className={`avatar ${sm ? 'sm' : ''}`}>{initials}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** نافذة تطلب سبباً (رفض/إلغاء/إنهاء) */
export function ReasonSheet({ open, title, placeholder, confirmText, danger, onClose, onSubmit }: { open: boolean; title: string; placeholder: string; confirmText: string; danger?: boolean; onClose: () => void; onSubmit: (r: string) => void }) {
  const [r, setR] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <textarea className="input" value={r} onChange={(e) => setR(e.target.value)} placeholder={placeholder} autoFocus />
        <button className={`btn block ${danger ? 'danger' : ''}`} disabled={!r.trim()} onClick={() => { onSubmit(r.trim()); setR(''); }}>
          {confirmText}
        </button>
      </div>
    </Sheet>
  );
}
