import { useState } from 'react'
import { api, fmt, sar, sar2, shortDate } from '../api'
import { Icon } from '../icons'
import { ACCEPT_ALL, Attachments, PickFiles, uploadAll, useCanDeleteFile, type MediaFile } from '../media'
import { Badge, DeleteButton, Empty, ErrorBox, Field, FormModal, inp, Loading, Meter, ORDER_STATUS, PageHead, ProjectSelect, send, Stat, today, toast, useCan, useData, useMeta } from '../ui'

interface Order {
  id: number; project_id: number; project: string; subcontractor_id: number | null; subcontractor: string | null; number: string; title: string
  date: string; due_date: string | null; status: string; notes: string | null; value: number; done_value: number; items_count: number
}
interface Item { description: string; unit: string; qty: number | string; unit_price: number | string; done_qty: number | string }
interface OrderDetail extends Order { items: Item[]; media?: MediaFile[] }

export default function DirectOrdersPage() {
  const [project, setProject] = useState('')
  const [editing, setEditing] = useState<Partial<OrderDetail> | null>(null)
  const can = useCan()
  const { data, error } = useData<Order[]>(`/api/direct-orders${project ? `?project=${project}` : ''}`)

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const live = data.filter((o) => !['done', 'cancelled'].includes(o.status))
  const value = live.reduce((a, o) => a + o.value, 0)
  const done = live.reduce((a, o) => a + o.done_value, 0)

  const open = async (o: Order) => {
    try { setEditing(await api<OrderDetail>(`/api/direct-orders/${o.id}`)) }
    catch { toast('تعذر فتح الأمر', 'err') }
  }

  return (
    <div className="page">
      <PageHead title="الإسناد المباشر" sub="أوامر إسناد الأعمال لمقاولي الباطن وبنودها ونسبة تنفيذها">
        {can('directOrders') && <button className="btn primary" onClick={() => setEditing({ project_id: project ? Number(project) : undefined, items: [] })}><Icon name="plus" size={18} /> أمر إسناد جديد</button>}
      </PageHead>
      <div className="stats">
        <Stat icon="assign" label="أوامر قائمة" value={fmt(live.length)} />
        <Stat icon="money" label="قيمة الأوامر القائمة" value={sar(value)} />
        <Stat icon="check" label="قيمة المنفذ منها" value={sar(done)} sub={value ? `${Math.round((done / value) * 100)}% منفذ` : undefined} tone="good" />
      </div>
      <div className="toolbar"><ProjectSelect value={project} onChange={setProject} /></div>

      {data.length === 0 ? <Empty icon="assign" title="لا توجد أوامر إسناد" /> : (
        <div className="cards-grid">
          {data.map((o) => {
            const pct = o.value ? (o.done_value / o.value) * 100 : 0
            const late = o.due_date && o.due_date < today() && !['done', 'cancelled'].includes(o.status)
            return (
              <article key={o.id} className="rcard" onClick={() => open(o)}>
                <div className="rcard-top"><strong>{o.title}</strong><span className="row-actions"><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge><DeleteButton icon path={`/api/direct-orders/${o.id}`} what={`أمر الإسناد «${o.title}»`} /></span></div>
                <small className="muted">{o.number} · {o.project} · {o.subcontractor ?? 'بدون مقاول'}</small>
                <div className="pcard-row"><span>{o.items_count} بند · {sar(o.value)}</span><b>{Math.round(pct)}%</b></div>
                <Meter value={pct} tone="good" />
                <div className="rcard-foot">
                  <small>من {shortDate(o.date)}</small>
                  {o.due_date && <small className={late ? 'bad-t' : ''}>التسليم {shortDate(o.due_date)}{late ? ' (متأخر)' : ''}</small>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {editing && <OrderForm order={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const blankItem = (): Item => ({ description: '', unit: 'م²', qty: '', unit_price: '', done_qty: 0 })

function OrderForm({ order, onClose }: { order: Partial<OrderDetail>; onClose: () => void }) {
  const meta = useMeta()
  const can = useCan()
  const isNew = !order.id
  const initial = {
    project_id: order.project_id ?? '', subcontractor_id: order.subcontractor_id ?? '', number: order.number ?? '', title: order.title ?? '',
    date: order.date ?? today(), due_date: order.due_date ?? '', status: order.status ?? 'open', notes: order.notes ?? '',
    items: order.items?.length ? order.items : [blankItem()],
  }
  const canDel = useCanDeleteFile()
  const [files, setFiles] = useState<File[]>([])
  const remove = async () => {
    if (!window.confirm('حذف أمر الإسناد نهائياً؟')) return
    try { await send(`/api/direct-orders/${order.id}`, 'DELETE', undefined, 'تم حذف الأمر'); onClose() } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <FormModal title={isNew ? 'أمر إسناد جديد' : `أمر ${order.number}`} initial={initial} onClose={onClose} wide
      extra={!isNew && can('delete') ? <button type="button" className="btn ghost danger" onClick={remove}><Icon name="trash" size={16} /> حذف</button> : undefined}
      onSubmit={async (v) => {
        const out = (isNew ? await send('/api/direct-orders', 'POST', v) : await send(`/api/direct-orders/${order.id}`, 'PUT', v)) as { id?: number }
        if (files.length) await uploadAll('direct_order', isNew ? out.id! : order.id!, files)
        toast(isNew ? 'تم إنشاء أمر الإسناد' : 'تم حفظ الأمر')
      }}>
      {(v, set) => {
        const setItem = (i: number, patch: Partial<Item>) => set({ items: v.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) })
        const total = v.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
        const done = v.items.reduce((a, it) => a + Math.min(Number(it.done_qty) || 0, Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
        return (
          <>
            <Field label="وصف الأعمال" span={2}>{inp(v, set, 'title', 'text', { autoFocus: isNew })}</Field>
            <Field label="رقم الأمر">{inp(v, set, 'number', 'text', { placeholder: 'إس-001' })}</Field>
            <Field label="المشروع">
              <select value={v.project_id} onChange={(e) => set({ project_id: e.target.value })}>
                <option value="">اختر…</option>{meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="مقاول الباطن">
              <select value={v.subcontractor_id} onChange={(e) => set({ subcontractor_id: e.target.value })}>
                <option value="">—</option>{meta?.subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="الحالة">
              <select value={v.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(ORDER_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
            </Field>
            <Field label="تاريخ الأمر">{inp(v, set, 'date', 'date')}</Field>
            <Field label="موعد التسليم">{inp(v, set, 'due_date', 'date')}</Field>
            <div className="span-3 items">
              <table>
                <thead><tr><th>البند</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>المنفذ</th><th>القيمة</th><th /></tr></thead>
                <tbody>
                  {v.items.map((it, i) => (
                    <tr key={i}>
                      <td><input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="مثال: لياسة داخلية" /></td>
                      <td><input className="w-s" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                      <td><input className="w-s" type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
                      <td><input className="w-s" type="number" min={0} step="any" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: e.target.value })} /></td>
                      <td><input className="w-s" type="number" min={0} value={it.done_qty} onChange={(e) => setItem(i, { done_qty: e.target.value })} /></td>
                      <td className="num">{fmt((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</td>
                      <td><button type="button" className="icon-btn dark" onClick={() => set({ items: v.items.filter((_, k) => k !== i) })} aria-label="حذف البند"><Icon name="trash" size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="items-foot">
                <button type="button" className="btn sm" onClick={() => set({ items: [...v.items, blankItem()] })}><Icon name="plus" size={16} /> بند</button>
                <span className="grow" />
                <span>الإجمالي <b>{sar2(total)}</b></span>
                <span>المنفذ <b className="good-t">{sar2(done)}</b> ({total ? Math.round((done / total) * 100) : 0}%)</span>
              </div>
            </div>
            <Field label="ملاحظات" span={3}><textarea rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
            <div className="span-3">
              <span className="field-label">المرفقات (العرض، العقد، صور الأعمال)</span>
              {!isNew && <Attachments entity="direct_order" id={order.id!} files={order.media ?? []} canAdd={false} canDelete={canDel} compact />}
              <PickFiles files={files} onChange={setFiles} accept={ACCEPT_ALL} label="إرفاق ملف" />
            </div>
          </>
        )
      }}
    </FormModal>
  )
}
