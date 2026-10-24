import { useEffect, useMemo, useState } from 'react'
import { fmt, longDate, sar } from '../api'
import { Icon } from '../icons'
import { addDays, ATT, download, Empty, ErrorBox, Loading, PageHead, ProjectSelect, Search, send, Tabs, thisMonth, today, toast, useCan, useData } from '../ui'

interface Row {
  worker_id: number; name: string; profession: string; project_id: number; project: string
  status: string | null; check_in: string | null; check_out: string | null; overtime_hours: number; method: string | null
}
interface MonthSheet {
  month: string; days: number; from: string
  rows: { id: number; name: string; profession: string; project: string; cells: (string | null)[]; worked: number; absent: number; leave: number; late: number; overtime: number; pay: number }[]
}

export default function AttendancePage() {
  const [tab, setTab] = useState<'day' | 'month'>('day')
  return (
    <div className="page">
      <PageHead title="الحضور والغياب" sub="سجّل الحضور بلمسة واحدة لكل عامل، أو راجع الكشف الشهري">
        <Tabs value={tab} onChange={setTab} items={[{ key: 'day', label: 'تسجيل يومي' }, { key: 'month', label: 'الكشف الشهري' }]} />
      </PageHead>
      {tab === 'day' ? <DaySheet /> : <MonthView />}
    </div>
  )
}

const ORDER = ['present', 'late', 'overtime', 'absent', 'leave']

function DaySheet() {
  const [date, setDate] = useState(today())
  const [project, setProject] = useState('')
  const [q, setQ] = useState('')
  const can = useCan()
  const editable = can('attendance')
  const { data, error } = useData<{ date: string; rows: Row[] }>(`/api/attendance?date=${date}${project ? `&project=${project}` : ''}`)
  const [draft, setDraft] = useState<Record<number, { status: string | null; overtime_hours?: number }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft({}), [date, project])

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !q || `${r.name} ${r.profession}`.includes(q.trim())), [data, q])
  const statusOf = (r: Row) => (r.worker_id in draft ? draft[r.worker_id].status : r.status)
  const dirty = Object.keys(draft).length

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />

  const counts = ORDER.map((s) => ({ s, n: data.rows.filter((r) => statusOf(r) === s).length }))
  const unrecorded = data.rows.filter((r) => !statusOf(r)).length
  const set = (id: number, status: string | null) => setDraft((d) => ({ ...d, [id]: { status, overtime_hours: status === 'overtime' ? (d[id]?.overtime_hours ?? 2) : 0 } }))
  const markRest = (status: string) => {
    const next = { ...draft }
    for (const r of rows) if (!statusOf(r)) next[r.worker_id] = { status }
    setDraft(next)
  }
  const save = async () => {
    setSaving(true)
    try {
      const entries = Object.entries(draft).map(([worker_id, v]) => ({ worker_id: Number(worker_id), status: v.status, overtime_hours: v.overtime_hours }))
      await send('/api/attendance', 'POST', { date, entries }, `تم حفظ حضور ${fmt(entries.length)} عامل`)
      setDraft({})
    } catch (e) { toast((e as Error).message, 'err') } finally { setSaving(false) }
  }

  // Group by project for a clean list when "all projects" is shown.
  const groups = rows.reduce<Record<string, Row[]>>((g, r) => ((g[r.project] ||= []).push(r), g), {})

  return (
    <>
      <div className="toolbar">
        <div className="date-nav">
          <button className="icon-btn dark" onClick={() => setDate(addDays(date, -1))} aria-label="اليوم السابق">›</button>
          <input type="date" className="select" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="icon-btn dark" onClick={() => date < today() && setDate(addDays(date, 1))} disabled={date >= today()} aria-label="اليوم التالي">‹</button>
          {date !== today() && <button className="btn ghost sm" onClick={() => setDate(today())}>اليوم</button>}
        </div>
        <ProjectSelect value={project} onChange={setProject} />
        <Search value={q} onChange={setQ} placeholder="بحث عن عامل" />
      </div>

      {editable && <p className="muted tip">أخطأت في تسجيل عامل؟ اضغط على نفس الحالة مرة ثانية لإلغائها، أو اختر الحالة الصحيحة، ثم «حفظ الحضور».</p>}
      <div className="att-summary">
        <strong>{longDate(date)}</strong>
        {counts.map(({ s, n }) => <span key={s} className={`chip-s c-${ATT[s].tone}`}>{ATT[s].label} <b>{n}</b></span>)}
        <span className="chip-s">لم يُسجل <b>{unrecorded}</b></span>
        {editable && unrecorded > 0 && (
          <span className="quick">
            <button className="btn sm good" onClick={() => markRest('present')}><Icon name="check" size={16} /> الباقي حاضر</button>
            <button className="btn sm bad" onClick={() => markRest('absent')}>الباقي غائب</button>
          </span>
        )}
      </div>

      {rows.length === 0 ? <Empty icon="workers" title="لا يوجد عمال" text="وزّع العمال على المشاريع من قسم العمال أولاً." /> : (
        <section className="panel flush">
          {Object.entries(groups).map(([proj, list]) => (
            <div key={proj} className="att-group">
              {!project && <h3 className="group-title">{proj} <small>{list.length} عامل</small></h3>}
              <ul className="att-list">
                {list.map((r) => {
                  const st = statusOf(r)
                  return (
                    <li key={r.worker_id} className={r.worker_id in draft ? 'changed' : ''}>
                      <div className="who"><span className={`avatar-s ${st ? `a-${ATT[st].tone}` : ''}`}>{r.name.slice(0, 1)}</span>
                        <div><strong>{r.name}</strong><small>{r.profession}{r.check_in && !(r.worker_id in draft) ? ` · دخول ${r.check_in}` : ''}{r.method === 'qr' ? ' · QR' : ''}</small></div>
                      </div>
                      <div className="seg" role="radiogroup" aria-label={`حالة ${r.name}`}>
                        {ORDER.map((s) => (
                          <button key={s} type="button" disabled={!editable} role="radio" aria-checked={st === s}
                            className={`seg-btn ${st === s ? `on c-${ATT[s].tone}` : ''}`} onClick={() => set(r.worker_id, st === s ? null : s)}>
                            {ATT[s].label}
                          </button>
                        ))}
                      </div>
                      {st === 'overtime' && editable && (
                        <label className="ot">ساعات
                          <input type="number" min={1} max={12} value={draft[r.worker_id]?.overtime_hours ?? r.overtime_hours ?? 2}
                            onChange={(e) => setDraft((d) => ({ ...d, [r.worker_id]: { status: 'overtime', overtime_hours: Number(e.target.value) } }))} />
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {dirty > 0 && (
        <div className="savebar">
          <span>تعديلات على <b>{dirty}</b> عامل لم تُحفظ</span>
          <button className="btn ghost" onClick={() => setDraft({})}>تراجع</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الحضور'}</button>
        </div>
      )}
    </>
  )
}

function MonthView() {
  const [month, setMonth] = useState(thisMonth())
  const [project, setProject] = useState('')
  const qs = `month=${month}${project ? `&project=${project}` : ''}`
  const { data, error } = useData<MonthSheet>(`/api/attendance/month?${qs}`)
  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const total = data.rows.reduce((a, r) => a + r.pay, 0)
  return (
    <>
      <div className="toolbar">
        <input type="month" className="select" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <ProjectSelect value={project} onChange={setProject} />
        <span className="grow" />
        <button className="btn" onClick={() => download(`/api/export/attendance?${qs}`)}><Icon name="download" size={18} /> كشف الحضور Excel</button>
        <button className="btn primary" onClick={() => download(`/api/export/payroll?${qs}`)}><Icon name="money" size={18} /> مسير الرواتب Excel</button>
      </div>
      <div className="legend">
        {ORDER.map((s) => <span key={s}><i className={`day d-${ATT[s].tone}`}>{ATT[s].short}</i>{ATT[s].label}</span>)}
        <span className="grow" /><span>إجمالي المستحق: <b>{sar(total)}</b></span>
      </div>
      {data.rows.length === 0 ? <Empty icon="attendance" title="لا يوجد حضور في هذا الشهر" /> : (
        <section className="panel flush">
          <div className="table-scroll">
            <table className="sheet">
              <thead>
                <tr><th className="sticky">العامل</th>{Array.from({ length: data.days }, (_, i) => <th key={i}>{i + 1}</th>)}<th>عمل</th><th>غياب</th><th>إضافي</th><th>المستحق</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sticky"><strong>{r.name}</strong><small>{r.project}</small></td>
                    {r.cells.map((c, i) => <td key={i} className={c ? `cell d-${ATT[c].tone}` : 'cell'}>{c ? ATT[c].short : ''}</td>)}
                    <td className="num">{r.worked}</td><td className="num bad-t">{r.absent || ''}</td><td className="num">{r.overtime || ''}</td><td className="num">{fmt(r.pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
