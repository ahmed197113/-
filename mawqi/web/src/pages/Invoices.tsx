import { useMemo, useState } from 'react'
import { sar, sar2, shortDate } from '../api'
import { Icon } from '../icons'
import { Badge, download, Empty, ErrorBox, Field, FormModal, inp, INVOICE_STATUS, Loading, PageHead, ProjectSelect, send, Stat, Tabs, toast, useCan, useData, useMeta } from '../ui'

interface Invoice {
  id: number; project_id: number; project: string; client: string | null; kind: 'client' | 'subcontractor'; subcontractor_id: number | null; subcontractor: string | null
  number: string; period_from: string | null; period_to: string | null; gross: number; retention_pct: number; deductions: number; vat_pct: number
  status: string; notes: string | null; retention: number; net: number; vat: number; total: number; created_at: string
}

export default function InvoicesPage() {
  const [kind, setKind] = useState<'client' | 'subcontractor'>('client')
  const [project, setProject] = useState('')
  const [editing, setEditing] = useState<Partial<Invoice> | null>(null)
  const can = useCan()
  const { data, error } = useData<Invoice[]>(`/api/invoices${project ? `?project=${project}` : ''}`)
  const rows = useMemo(() => (data ?? []).filter((v) => v.kind === kind), [data, kind])

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const sum = (st: string[]) => rows.filter((v) => st.includes(v.status)).reduce((a, v) => a + v.total, 0)
  const retention = rows.filter((v) => ['approved', 'paid'].includes(v.status)).reduce((a, v) => a + v.retention, 0)

  const del = async (v: Invoice) => {
    if (!window.confirm(`حذف المستخلص ${v.number} نهائياً؟`)) return
    try { await send(`/api/invoices/${v.id}`, 'DELETE', undefined, 'تم الحذف') } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <div className="page">
      <PageHead title="المستخلصات" sub="مستخلصات المالك ومقاولي الباطن مع المحتجزات والضريبة">
        <button className="btn" onClick={() => download(`/api/export/invoices${project ? `?project=${project}` : ''}`)}><Icon name="download" size={18} /> Excel</button>
        {can('invoices') && <button className="btn primary" onClick={() => setEditing({ kind, project_id: project ? Number(project) : undefined })}><Icon name="plus" size={18} /> مستخلص جديد</button>}
      </PageHead>

      <div className="toolbar">
        <Tabs value={kind} onChange={setKind} items={[
          { key: 'client', label: 'مستخلصات المالك', count: data.filter((v) => v.kind === 'client').length },
          { key: 'subcontractor', label: 'مقاولو الباطن', count: data.filter((v) => v.kind === 'subcontractor').length },
        ]} />
        <ProjectSelect value={project} onChange={setProject} />
      </div>

      <div className="stats">
        <Stat icon="clock" label="بانتظار الاعتماد" value={sar(sum(['submitted']))} tone="warn" />
        <Stat icon="check" label={kind === 'client' ? 'معتمد ولم يُحصّل' : 'معتمد ولم يُصرف'} value={sar(sum(['approved']))} />
        <Stat icon="money" label={kind === 'client' ? 'المحصّل' : 'المصروف'} value={sar(sum(['paid']))} tone="good" />
        <Stat icon="key" label="المحتجزات (ضمان)" value={sar(retention)} tone="navy" />
      </div>

      <section className="panel flush">
        {rows.length === 0 ? <Empty icon="contracts" title="لا توجد مستخلصات" /> : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>الرقم</th><th>{kind === 'client' ? 'المشروع / المالك' : 'المشروع / المقاول'}</th><th>الفترة</th><th>قيمة الأعمال</th><th>المحتجز + الخصم</th><th>الضريبة</th><th>الصافي المستحق</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.number}</strong></td>
                    <td><strong>{v.project}</strong><small>{kind === 'client' ? v.client ?? '—' : v.subcontractor}</small></td>
                    <td><small>{v.period_from ? `${shortDate(v.period_from)} ← ${v.period_to ? shortDate(v.period_to) : ''}` : '—'}</small></td>
                    <td className="num">{sar(v.gross)}</td>
                    <td className="num bad-t">−{sar(v.retention + v.deductions)}</td>
                    <td className="num">{sar(v.vat)}</td>
                    <td className="num"><b>{sar(v.total)}</b></td>
                    <td><Badge tone={INVOICE_STATUS[v.status].tone}>{INVOICE_STATUS[v.status].label}</Badge></td>
                    <td className="row-actions">
                      {can('invoices') && <button className="icon-btn dark" onClick={() => setEditing(v)} title="تعديل"><Icon name="edit" size={18} /></button>}
                      {can('delete') && <button className="icon-btn dark" onClick={() => del(v)} title="حذف"><Icon name="trash" size={18} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <InvoiceForm inv={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function InvoiceForm({ inv, onClose }: { inv: Partial<Invoice>; onClose: () => void }) {
  const meta = useMeta()
  const isNew = !inv.id
  const initial = {
    kind: inv.kind ?? 'client', project_id: inv.project_id ?? '', subcontractor_id: inv.subcontractor_id ?? '', number: inv.number ?? '',
    period_from: inv.period_from ?? '', period_to: inv.period_to ?? '', gross: inv.gross ?? '', retention_pct: inv.retention_pct ?? 10,
    deductions: inv.deductions ?? 0, vat_pct: inv.vat_pct ?? 15, status: inv.status ?? 'draft', notes: inv.notes ?? '',
  }
  return (
    <FormModal title={isNew ? 'مستخلص جديد' : `مستخلص ${inv.number}`} initial={initial} onClose={onClose} wide
      onSubmit={(v) => (isNew ? send('/api/invoices', 'POST', v, 'تم حفظ المستخلص') : send(`/api/invoices/${inv.id}`, 'PUT', v, 'تم حفظ المستخلص'))}>
      {(v, set) => {
        const gross = Number(v.gross) || 0
        const ret = (gross * (Number(v.retention_pct) || 0)) / 100
        const net = gross - ret - (Number(v.deductions) || 0)
        const vat = (net * (Number(v.vat_pct) || 0)) / 100
        return (
          <>
            <Field label="النوع">
              <select value={v.kind} onChange={(e) => set({ kind: e.target.value as 'client' | 'subcontractor' })}><option value="client">مستخلص مالك</option><option value="subcontractor">مستخلص مقاول باطن</option></select>
            </Field>
            <Field label="المشروع">
              <select value={v.project_id} onChange={(e) => set({ project_id: e.target.value })}>
                <option value="">اختر…</option>{meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {v.kind === 'subcontractor' ? (
              <Field label="مقاول الباطن">
                <select value={v.subcontractor_id} onChange={(e) => set({ subcontractor_id: e.target.value })}>
                  <option value="">اختر…</option>{meta?.subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            ) : <Field label="رقم المستخلص">{inp(v, set, 'number', 'text', { placeholder: 'م-1' })}</Field>}
            {v.kind === 'subcontractor' && <Field label="رقم المستخلص">{inp(v, set, 'number', 'text', { placeholder: 'ب-1' })}</Field>}
            <Field label="الفترة من">{inp(v, set, 'period_from', 'date')}</Field>
            <Field label="إلى">{inp(v, set, 'period_to', 'date')}</Field>
            <Field label="قيمة الأعمال المنفذة (ر.س)">{inp(v, set, 'gross', 'number', { min: 0, step: 'any' })}</Field>
            <Field label="نسبة المحتجز (ضمان) %">{inp(v, set, 'retention_pct', 'number', { min: 0, max: 100 })}</Field>
            <Field label="خصومات أخرى (ر.س)">{inp(v, set, 'deductions', 'number', { min: 0, step: 'any' })}</Field>
            <Field label="ضريبة القيمة المضافة %">{inp(v, set, 'vat_pct', 'number', { min: 0 })}</Field>
            <Field label="الحالة">
              <select value={v.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(INVOICE_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
            </Field>
            <div className="calc span-3">
              <div><span>قيمة الأعمال</span><b>{sar2(gross)}</b></div>
              <div><span>المحتجز</span><b className="bad-t">−{sar2(ret)}</b></div>
              <div><span>الصافي قبل الضريبة</span><b>{sar2(net)}</b></div>
              <div><span>الضريبة</span><b>+{sar2(vat)}</b></div>
              <div className="total"><span>المستحق</span><b>{sar2(net + vat)}</b></div>
            </div>
            <Field label="ملاحظات" span={3}><textarea rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </>
        )
      }}
    </FormModal>
  )
}
