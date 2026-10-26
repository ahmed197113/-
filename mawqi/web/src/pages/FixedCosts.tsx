import { useState } from 'react'
import { fmt, sar } from '../api'
import { Icon } from '../icons'
import { Badge, DeleteButton, Empty, ErrorBox, Field, FormModal, inp, Loading, PageHead, send, today, useData, useMeta } from '../ui'

interface Fixed {
  id: number; name: string; kind: string; amount: number; months: number; monthly: number; project_id: number; project: string; project_kind: string
  start_date: string; end_date: string | null; note: string | null
}
const PERIODS = [1, 3, 6, 12]
const placeLabel = (name: string, kind: string) => (kind === 'office' ? `🏢 ${name} (تُوزَّع على المشاريع)` : kind === 'factory' ? `🏭 ${name}` : `🏗️ ${name}`)

/** Rent of the office, the factory, cars… entered once and counted in the cost every month until stopped. */
export default function FixedCostsPage() {
  const { data, error } = useData<{ kinds: Record<string, string>; list: Fixed[] }>('/api/fixed-costs')
  const [editing, setEditing] = useState<Partial<Fixed> | null>(null)
  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const now = today()
  const active = data.list.filter((f) => !f.end_date || f.end_date >= now)
  const monthly = active.reduce((t, f) => t + f.monthly, 0)
  return (
    <div className="page">
      <PageHead title="الإيجارات والمصروفات الثابتة" sub={`${fmt(active.length)} مصروف قائم · ${sar(monthly)} شهرياً`}>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> مصروف جديد</button>
      </PageHead>
      <p className="muted tip">سجّل كل مصروف متكرر مرة واحدة (إيجار المبنى الإداري، إيجار المصنع، إيجار كل سيارة…) بالمبلغ والمدة التي يغطيها.
        يدخل في التكلفة كل شهر تلقائياً حتى توقفه. ما يُحمَّل على «الإدارة» يُوزَّع على المشاريع بنسبة عدد عمالها.</p>
      {!data.list.length ? (
        <Empty icon="money" title="لا توجد مصروفات ثابتة بعد" text="مثال: إيجار المبنى الإداري 60,000 كل 12 شهراً، أو إيجار سيارة 2,500 شهرياً.">
          <button className="btn primary" onClick={() => setEditing({ kind: 'rent_office' })}><Icon name="plus" size={18} /> أضف أول مصروف</button>
        </Empty>
      ) : (
        <section className="panel flush">
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>المصروف</th><th>يُحمَّل على</th><th>المبلغ</th><th>شهرياً</th><th>من</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {data.list.map((f) => {
                  const stopped = !!f.end_date && f.end_date < now
                  return (
                    <tr key={f.id} className="clickable" onClick={() => setEditing(f)}>
                      <td><strong>{f.name}</strong><small className="muted">{data.kinds[f.kind] ?? f.kind}{f.note ? ` · ${f.note}` : ''}</small></td>
                      <td>{placeLabel(f.project, f.project_kind)}</td>
                      <td className="num">{sar(f.amount)} <small className="muted">كل {f.months === 1 ? 'شهر' : `${f.months} أشهر`}</small></td>
                      <td className="num"><b>{sar(f.monthly)}</b></td>
                      <td>{f.start_date}</td>
                      <td>{stopped ? <Badge>متوقف منذ {f.end_date}</Badge> : f.end_date ? <Badge tone="warn">حتى {f.end_date}</Badge> : <Badge tone="good">قائم</Badge>}</td>
                      <td onClick={(e) => e.stopPropagation()}><DeleteButton icon path={`/api/fixed-costs/${f.id}`} what={`المصروف «${f.name}»`} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {editing && <FixedForm f={editing} kinds={data.kinds} onClose={() => setEditing(null)} />}
    </div>
  )
}

function FixedForm({ f, kinds, onClose }: { f: Partial<Fixed>; kinds: Record<string, string>; onClose: () => void }) {
  const meta = useMeta()
  const places = (meta?.projects ?? []).filter((p) => p.status !== 'done' || p.id === f.project_id)
  const office = places.find((p) => p.kind === 'office')
  const factory = places.find((p) => p.kind === 'factory')
  const isNew = !f.id
  // Until chosen: office rent and cars on «الإدارة», factory rent on the factory.
  const defaultFor = (kind: string) => String((kind === 'rent_factory' ? factory?.id : office?.id) ?? '')
  const initial = {
    name: f.name ?? '', kind: f.kind ?? 'rent_office', amount: f.amount ? String(f.amount) : '', months: String(f.months ?? 1),
    project_id: f.project_id ? String(f.project_id) : '',
    start_date: f.start_date ?? `${today().slice(0, 7)}-01`, end_date: f.end_date ?? '', note: f.note ?? '',
  }
  return (
    <FormModal title={isNew ? 'مصروف ثابت جديد' : `تعديل «${f.name}»`} initial={initial} onClose={onClose}
      onSubmit={(v) => send(isNew ? '/api/fixed-costs' : `/api/fixed-costs/${f.id}`, isNew ? 'POST' : 'PUT', { ...v, project_id: v.project_id || defaultFor(v.kind), end_date: v.end_date || null }, 'تم الحفظ')}>
      {(v, set) => (
        <>
          <Field label="النوع">
            <select value={v.kind} onChange={(e) => {
              const kind = e.target.value
              set({ kind, project_id: kind === 'rent_factory' || kind === 'rent_office' ? defaultFor(kind) : v.project_id })
            }}>
              {Object.entries(kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="الاسم" span={2}>{inp(v, set, 'name', 'text', { placeholder: v.kind === 'car' ? 'مثال: سيارة هايلكس 1234' : v.kind === 'rent_factory' ? 'إيجار المصنع' : 'إيجار المبنى الإداري', autoFocus: true })}</Field>
          <Field label="المبلغ المدفوع (ر.س)">{inp(v, set, 'amount', 'number', { min: 0, inputMode: 'decimal' })}</Field>
          <Field label="يغطي مدة">
            <div className="seg full">
              {PERIODS.map((m) => <button type="button" key={m} className={`seg-btn ${v.months === String(m) ? 'on c-good' : ''}`} onClick={() => set({ months: String(m) })}>{m === 1 ? 'شهر' : `${m} أشهر`}</button>)}
            </div>
          </Field>
          <Field label="يُحمَّل على">
            <select value={v.project_id || defaultFor(v.kind)} onChange={(e) => set({ project_id: e.target.value })}>
              {places.map((p) => <option key={p.id} value={p.id}>{placeLabel(p.name, p.kind ?? 'project')}</option>)}
            </select>
          </Field>
          <Field label="يبدأ من">{inp(v, set, 'start_date', 'date')}</Field>
          <Field label="يتوقف في (اتركه فارغاً إن كان مستمراً)">{inp(v, set, 'end_date', 'date')}</Field>
          <Field label="ملاحظة">{inp(v, set, 'note')}</Field>
          <p className="muted span-3">
            {Number(v.amount) > 0 ? `= ${sar(Number(v.amount) / Number(v.months))} شهرياً، ` : ''}
            {places.find((p) => String(p.id) === (v.project_id || defaultFor(v.kind)))?.kind === 'office'
              ? 'يدخل في مصاريف الإدارة ويُوزَّع كل شهر على المشاريع الجارية بنسبة عدد عمالها.'
              : 'يُحمَّل كل شهر على الموقع المختار.'}
          </p>
        </>
      )}
    </FormModal>
  )
}
