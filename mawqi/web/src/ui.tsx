// Shared building blocks for every section: data loading, forms, dialogs, toasts and labels.
import { useEffect, useState, type ReactNode } from 'react'
import { api, getToken } from './api'
import { useAuth } from './auth'
import { Icon } from './icons'
import { useLive } from './useLive'

// ---------- labels ----------
export const ATT: Record<string, { label: string; short: string; tone: string }> = {
  present: { label: 'حاضر', short: 'ح', tone: 'good' },
  late: { label: 'متأخر', short: 'م', tone: 'warn' },
  overtime: { label: 'إضافي', short: 'إ', tone: 'navy' },
  absent: { label: 'غائب', short: 'غ', tone: 'bad' },
  leave: { label: 'إجازة', short: 'ج', tone: 'grey' },
}
export const SEVERITY: Record<string, { label: string; tone: string }> = {
  critical: { label: 'حرجة', tone: 'bad' }, high: { label: 'عالية', tone: 'amber' }, medium: { label: 'متوسطة', tone: 'warn' }, low: { label: 'منخفضة', tone: 'grey' },
}
export const CATEGORY: Record<string, string> = { safety: 'سلامة', materials: 'مواد', equipment: 'معدات', subcontractor: 'مقاول باطن', other: 'أخرى' }
export const ISSUE_STATUS: Record<string, string> = { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' }
export const PROJECT_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'جارٍ', tone: 'good' }, paused: { label: 'متوقف', tone: 'warn' }, done: { label: 'منتهٍ', tone: 'grey' },
}
export const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'مسودة', tone: 'grey' }, submitted: { label: 'مقدم', tone: 'warn' }, approved: { label: 'معتمد', tone: 'navy' },
  paid: { label: 'مدفوع', tone: 'good' }, rejected: { label: 'مرفوض', tone: 'bad' },
}
export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: 'جديد', tone: 'warn' }, in_progress: { label: 'قيد التنفيذ', tone: 'navy' }, done: { label: 'منجز', tone: 'good' }, cancelled: { label: 'ملغى', tone: 'grey' },
}

// ---------- data ----------
export interface Meta {
  roles: Record<string, string>
  users: { id: number; name: string; role: string; active: number }[]
  projects: { id: number; name: string; status: string; kind?: string }[]
  subcontractors: { id: number; name: string }[]
  settings: { companyName: string; absenceCutoff: string }
  places?: { id: number; name: string; kind: string }[]
}
export const useMeta = () => useLive<Meta>('/api/meta').data

/** Live data for a page; reloads whenever anyone changes anything. */
export const useData = <T,>(path: string) => useLive<T>(path)

export const useCan = () => {
  const { user } = useAuth()
  return (perm: string) => Boolean(user?.permissions?.[perm])
}

export async function send(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, okMsg?: string) {
  const out = await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  if (okMsg) toast(okMsg)
  return out
}

export const download = (path: string) => {
  const sep = path.includes('?') ? '&' : '?'
  window.open(`${path}${sep}token=${encodeURIComponent(getToken() ?? '')}`, '_blank')
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date())
export const thisMonth = () => today().slice(0, 7)
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10)
}

// ---------- toast ----------
type ToastItem = { id: number; text: string; kind: 'ok' | 'err' }
let pushToast: (t: ToastItem) => void = () => undefined
let seq = 0
export const toast = (text: string, kind: 'ok' | 'err' = 'ok') => pushToast({ id: ++seq, text, kind })
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    pushToast = (t) => {
      setItems((l) => [...l, t])
      window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 3200)
    }
  }, [])
  return <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
}

// ---------- layout pieces ----------
export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  )
}

export function Empty({ icon = 'dashboard', title, text, children }: { icon?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty small">
      <Icon name={icon} size={44} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export const Loading = () => <div className="empty"><div className="spinner" /></div>
export const ErrorBox = ({ error }: { error: string }) => <div className="empty"><h2>تعذر تحميل البيانات</h2><p>{error}</p></div>

export const Badge = ({ tone = 'grey', children }: { tone?: string; children: ReactNode }) => <span className={`badge b-${tone}`}>{children}</span>

export function Stat({ label, value, sub, tone = 'navy', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; icon?: string }) {
  return (
    <div className={`stat s-${tone}`}>
      {icon && <span className="stat-icon"><Icon name={icon} size={22} /></span>}
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

export function Meter({ value, tone }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, value || 0))
  return <div className="meter"><i className={tone} style={{ width: `${v}%` }} /></div>
}

export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r={r} className="ring-bg" />
        <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span>{Math.round(v)}%{label && <small>{label}</small>}</span>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs">
      {items.map((it) => (
        <button key={it.key} type="button" className={`tab ${value === it.key ? 'active' : ''}`} onClick={() => onChange(it.key)}>
          {it.label}{it.count !== undefined && <em>{it.count}</em>}
        </button>
      ))}
    </div>
  )
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="search"><Icon name="search" size={18} /><input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}

export function ProjectSelect({ value, onChange, all = true, label, unassigned }: { value: string; onChange: (v: string) => void; all?: boolean; label?: string; unassigned?: boolean }) {
  const meta = useMeta()
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label ?? 'المشروع'}>
      {all && <option value="">{unassigned ? 'كل المواقع' : 'كل المشاريع'}</option>}
      {unassigned && <option value="none">غير موزّع</option>}
      {!all && <option value="">اختر المشروع…</option>}
      {meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.kind === 'factory' ? '🏭 ' : ''}{p.name}</option>)}
    </select>
  )
}

// ---------- dialogs & forms ----------
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll') }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, span, hint }: { label: string; children: ReactNode; span?: 2 | 3; hint?: string }) {
  return (
    <label className={`field ${span ? `span-${span}` : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

/** A form dialog: holds its values, submits, shows server errors in place. */
export function FormModal<T extends Record<string, unknown>>({ title, initial, onClose, onSubmit, children, wide, submitLabel = 'حفظ', extra }: {
  title: string; initial: T; onClose: () => void; onSubmit: (v: T) => Promise<unknown>
  children: (v: T, set: (patch: Partial<T>) => void) => ReactNode; wide?: boolean; submitLabel?: string; extra?: ReactNode
}) {
  const [v, setV] = useState<T>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<T>) => setV((cur) => ({ ...cur, ...patch }))
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError('')
    try { await onSubmit(v); onClose() } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title={title} onClose={onClose} wide={wide} footer={
      <>
        {extra}
        <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        <button type="button" className="btn primary" onClick={() => submit()} disabled={busy}>{busy ? 'جارٍ الحفظ…' : submitLabel}</button>
      </>
    }>
      <form className="form-grid" onSubmit={submit}>
        {children(v, set)}
        {error && <div className="form-error span-3">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/** Shorthand for text/number/date inputs bound to a form value. */
export function inp<T extends Record<string, unknown>>(v: T, set: (p: Partial<T>) => void, key: keyof T, type = 'text', extra: Record<string, unknown> = {}) {
  return <input type={type} value={(v[key] as string | number | undefined) ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<T>)} {...extra} />
}

/** Red "delete" button for edit dialogs — shown only to the general manager and the system manager. */
export function DeleteButton({ path, what, onDone = () => undefined, icon }: { path: string; what: string; onDone?: () => void; icon?: boolean }) {
  const can = useCan()
  if (!can('delete')) return null
  const go = async () => {
    if (!window.confirm(`حذف ${what} نهائياً؟ لا يمكن التراجع.`)) return
    try { await send(path, 'DELETE', undefined, 'تم الحذف'); onDone() } catch (e) { toast((e as Error).message, 'err') }
  }
  if (icon) return <button type="button" className="icon-btn dark del" title="حذف" aria-label="حذف" onClick={(e) => { e.stopPropagation(); go() }}><Icon name="trash" size={17} /></button>
  return <button type="button" className="btn ghost danger" onClick={go}><Icon name="trash" size={16} /> حذف</button>
}

/** Tap-to-toggle chips for choosing several people. */
export function PickMany({ options, value, onChange, disabled, empty }: { options: { id: number; name: string }[]; value: number[]; onChange: (ids: number[]) => void; disabled?: boolean; empty?: string }) {
  if (!options.length) return <small className="muted">{empty}</small>
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="pick">
      {options.map((o) => (
        <button key={o.id} type="button" disabled={disabled} className={`pick-chip ${value.includes(o.id) ? 'on' : ''}`} onClick={() => toggle(o.id)} aria-pressed={value.includes(o.id)}>
          {value.includes(o.id) && <Icon name="check" size={15} />} {o.name}
        </button>
      ))}
    </div>
  )
}
