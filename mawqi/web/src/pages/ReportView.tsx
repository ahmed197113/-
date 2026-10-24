import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fmt, sar } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { addDays, download, Empty, ErrorBox, Loading, ProjectSelect, Search, today, useData } from '../ui'

export interface ReportDef {
  group: string; kind: string; title: string; text: string; filters: string[]; fin?: boolean
  options?: Record<string, { value: string; label: string }[]>
}
export interface Catalog { reports: ReportDef[]; professions: string[]; top: boolean }
interface Col { key: string; label: string; type: 't' | 'm' | 'n' | 'd' | 'p' | 'tag' | 'long'; sum?: boolean; strong?: boolean; tone?: boolean }
interface Result {
  title: string; from: string; to: string; period: boolean; columns: Col[]; rows: Record<string, string | number | null>[]
  totals: Record<string, number>; cards: { label: string; value: number; type: string; tone?: string }[]; note: string | null
}

const OPTION_LABEL: Record<string, string> = { status: 'الحالة', kind: 'النوع', severity: 'الخطورة' }

/** Quick periods: one tap instead of typing dates. */
function periods() {
  const t = today()
  const m = t.slice(0, 7)
  const prev = new Date(`${m}-01T12:00:00Z`); prev.setUTCMonth(prev.getUTCMonth() - 1)
  const pm = prev.toISOString().slice(0, 7)
  const pmEnd = addDays(`${m}-01`, -1)
  return [
    { key: 'today', label: 'اليوم', from: t, to: t },
    { key: 'week', label: 'آخر 7 أيام', from: addDays(t, -6), to: t },
    { key: 'month', label: 'هذا الشهر', from: `${m}-01`, to: t },
    { key: 'prev', label: 'الشهر الماضي', from: `${pm}-01`, to: pmEnd },
    { key: 'q', label: 'آخر 3 أشهر', from: addDays(t, -89), to: t },
    { key: 'year', label: 'هذه السنة', from: `${t.slice(0, 4)}-01-01`, to: t },
  ]
}

export const cell = (c: Col, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—'
  if (c.type === 'm') return sar(Number(v))
  if (c.type === 'n') return fmt(Number(v))
  if (c.type === 'p') return `${fmt(Number(v))}%`
  return String(v)
}
const toneOf = (c: Col, v: unknown) => (c.tone && typeof v === 'number' ? (v < 0 ? 'bad-t' : v > 0 ? 'good-t' : '') : '')

export default function ReportViewPage() {
  const { kind = '' } = useParams()
  const nav = useNavigate()
  const { status } = useAuth()
  const cat = useData<Catalog>('/api/r')
  const def = cat.data?.reports.find((r) => r.kind === kind)
  const P = useMemo(periods, [])
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState(P[2].from)
  const [to, setTo] = useState(P[2].to)
  const [project, setProject] = useState('')
  const [profession, setProfession] = useState('')
  const [opt, setOpt] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)

  const has = (f: string) => def?.filters.includes(f)
  const params = new URLSearchParams()
  if (has('range')) { params.set('from', from); params.set('to', to) }
  if (project) params.set('project', project)
  if (profession) params.set('profession', profession)
  for (const [k, v] of Object.entries(opt)) if (v) params.set(k, v)
  const qs = params.toString()
  const r = useData<Result>(`/api/r/${kind}?${qs}`)

  const rows = useMemo(() => {
    let list = r.data?.rows ?? []
    const t = q.trim()
    if (t) list = list.filter((row) => Object.values(row).some((v) => String(v ?? '').includes(t)))
    if (sort) list = [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key]
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'ar')) * sort.dir
    })
    return list
  }, [r.data, q, sort])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of r.data?.columns ?? []) if (c.sum) t[c.key] = rows.reduce((s, row) => s + (Number(row[c.key]) || 0), 0)
    return t
  }, [rows, r.data])

  if (cat.error && !cat.data) return <ErrorBox error={cat.error} />
  if (!cat.data) return <Loading />
  if (!def) return <Empty icon="report" title="التقرير غير متاح" text="قد لا تكون لديك صلاحية لهذا التقرير."><Link className="btn" to="/reports">كل التقارير</Link></Empty>

  const pick = (k: string) => { const p = P.find((x) => x.key === k)!; setPeriod(k); setFrom(p.from); setTo(p.to) }
  const filtersText = [
    has('range') && `الفترة: ${from} ← ${to}`,
    project && 'مشروع محدد',
    profession && `المهنة: ${profession}`,
    ...Object.entries(opt).filter(([, v]) => v).map(([k, v]) => `${OPTION_LABEL[k] ?? k}: ${def.options?.[k]?.find((o) => o.value === v)?.label ?? v}`),
    q && `بحث: ${q}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="page report-view">
      <div className="no-print report-actions">
        <button className="back" onClick={() => nav('/reports')}><Icon name="back" size={18} /> كل التقارير</button>
        <span className="grow" />
        <button className="btn" onClick={() => download(`/api/r/${kind}?${qs}${q ? `&q=${encodeURIComponent(q)}` : ''}&format=csv`)}><Icon name="download" size={18} /> Excel</button>
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" size={18} /> طباعة / PDF</button>
      </div>

      <header className="rv-head">
        <small>{status?.companyName ?? 'شركة الخطوط المعدنية للمقاولات العامة'}</small>
        <h1>{def.title}</h1>
        <p className="muted">{def.text}</p>
        {filtersText && <p className="rv-filters">{filtersText}</p>}
      </header>

      <section className="panel rv-filterbar no-print">
        {has('range') && (
          <div className="rv-periods">
            {P.map((p) => <button key={p.key} className={`chip ${period === p.key ? 'on' : ''}`} onClick={() => pick(p.key)}>{p.label}</button>)}
            <label className={`chip custom ${period === 'custom' ? 'on' : ''}`}>من <input type="date" value={from} max={to} onChange={(e) => { setPeriod('custom'); setFrom(e.target.value) }} /></label>
            <label className={`chip custom ${period === 'custom' ? 'on' : ''}`}>إلى <input type="date" value={to} min={from} max={today()} onChange={(e) => { setPeriod('custom'); setTo(e.target.value) }} /></label>
          </div>
        )}
        <div className="toolbar">
          {has('project') && <ProjectSelect value={project} onChange={setProject} />}
          {has('profession') && (
            <select className="select" value={profession} onChange={(e) => setProfession(e.target.value)} aria-label="المهنة">
              <option value="">كل المهن</option>
              {cat.data.professions.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          {Object.entries(def.options ?? {}).map(([k, list]) => (
            <select key={k} className="select" value={opt[k] ?? ''} onChange={(e) => setOpt((o) => ({ ...o, [k]: e.target.value }))} aria-label={OPTION_LABEL[k]}>
              <option value="">{OPTION_LABEL[k] ?? k}: الكل</option>
              {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          <Search value={q} onChange={setQ} placeholder="بحث داخل التقرير" />
          {(project || profession || q || Object.values(opt).some(Boolean)) && (
            <button className="btn ghost" onClick={() => { setProject(''); setProfession(''); setOpt({}); setQ('') }}>مسح الفلاتر</button>
          )}
        </div>
      </section>

      {r.error && !r.data ? <ErrorBox error={r.error} /> : !r.data ? <Loading /> : (
        <>
          {r.data.cards.length > 0 && (
            <div className="rv-cards">
              {r.data.cards.map((c) => (
                <div key={c.label} className={`rv-card ${c.tone ?? ''}`}><span>{c.label}</span><b>{c.type === 'm' ? sar(c.value) : c.type === 'p' ? `${fmt(c.value)}%` : fmt(c.value)}</b></div>
              ))}
            </div>
          )}
          {r.data.note && <p className="muted tip">{r.data.note}</p>}
          {!rows.length ? <Empty icon="report" title="لا توجد بيانات" text="جرّب فترة أخرى أو امسح الفلاتر." /> : (
            <section className="panel flush">
              <div className="table-scroll">
                <table className="data rv-table">
                  <thead>
                    <tr>{r.data.columns.map((c) => (
                      <th key={c.key} className={['m', 'n', 'p'].includes(c.type) ? 'num' : ''} onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                        {c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>{r.data!.columns.map((c) => (
                        <td key={c.key} className={`${['m', 'n', 'p'].includes(c.type) ? 'num' : ''} ${c.strong ? 'strong' : ''} ${c.type === 'long' ? 'long' : ''} ${toneOf(c, row[c.key])}`}>
                          {c.type === 'tag' && row[c.key] ? <span className="badge">{String(row[c.key])}</span> : cell(c, row[c.key])}
                        </td>
                      ))}</tr>
                    ))}
                  </tbody>
                  {Object.keys(totals).length > 0 && (
                    <tfoot>
                      <tr>{r.data.columns.map((c, i) => <td key={c.key} className={c.sum ? `num ${toneOf(c, totals[c.key])}` : ''}>{i === 0 ? `الإجمالي (${fmt(rows.length)})` : c.sum ? cell(c, Math.round(totals[c.key] * 100) / 100) : ''}</td>)}</tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
