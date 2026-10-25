import { useEffect, useMemo, useState } from 'react'
import { fmt, longDate, sar } from '../api'
import { Icon } from '../icons'
import { src } from '../media'
import { addDays, ATT, download, Empty, ErrorBox, Loading, Modal, PageHead, ProjectSelect, Search, send, Tabs, thisMonth, today, toast, useCan, useData, useMeta } from '../ui'

interface Row {
  worker_id: number; name: string; profession: string; project_id: number; project: string; project_kind?: string; photo?: string | null
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
  const [draft, setDraft] = useState<Record<number, { status: string | null; overtime_hours?: number; project_id?: number }>>({})
  const [saving, setSaving] = useState(false)
  const [pulled, setPulled] = useState<Row[]>([])
  const [pulling, setPulling] = useState(false)
  const meta = useMeta()
  const canMove = can('moveWorkers')
  const places = meta?.places ?? []
  const placeName = (id: number) => places.find((p) => p.id === id)?.name ?? ''

  useEffect(() => { setDraft({}); setPulled([]) }, [date, project])

  const rows = useMemo(() => [...pulled.filter((p) => !(data?.rows ?? []).some((r) => r.worker_id === p.worker_id)), ...(data?.rows ?? [])]
    .filter((r) => !q || `${r.name} ${r.profession}`.includes(q.trim())), [data, q, pulled])
  const statusOf = (r: Row) => (r.worker_id in draft ? draft[r.worker_id].status : r.status)
  const dirty = Object.keys(draft).length

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />

  const counts = ORDER.map((s) => ({ s, n: data.rows.filter((r) => statusOf(r) === s).length }))
  const unrecorded = data.rows.filter((r) => !statusOf(r)).length
  const set = (id: number, status: string | null) => setDraft((d) => ({ ...d, [id]: { ...d[id], status, overtime_hours: status === 'overtime' ? (d[id]?.overtime_hours ?? 2) : 0 } }))
  // Where the worker worked that day; changing it moves him (from today) and records the day on the new site.
  const setSite = (r: Row, project_id: number) => setDraft((d) => ({ ...d, [r.worker_id]: { ...d[r.worker_id], status: d[r.worker_id]?.status ?? statusOf(r) ?? 'present', project_id } }))
  const siteOf = (r: Row) => draft[r.worker_id]?.project_id ?? r.project_id
  const markRest = (status: string) => {
    const next = { ...draft }
    for (const r of rows) if (!statusOf(r)) next[r.worker_id] = { status }
    setDraft(next)
  }
  const save = async () => {
    setSaving(true)
    try {
      const entries = Object.entries(draft).map(([worker_id, v]) => ({ worker_id: Number(worker_id), status: v.status, overtime_hours: v.overtime_hours, project_id: v.project_id }))
      const moved = entries.filter((e) => e.project_id).length
      await send('/api/attendance', 'POST', { date, entries }, `تم حفظ حضور ${fmt(entries.length)} عامل${moved ? ` ونقل ${fmt(moved)}` : ''}`)
      setDraft({})
      setPulled([])
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
        {editable && canMove && <button className="btn primary" onClick={() => setPulling(true)}><Icon name="plus" size={18} /> إضافة عمال</button>}
      </div>

      {editable && <p className="muted tip">اختر حالة كل عامل{canMove ? '، وغيّر «الموقع» إن عمل اليوم في مشروع آخر أو المصنع' : ''}، ثم «حفظ الحضور». للإلغاء اضغط على نفس الحالة مرة ثانية.</p>}
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
                      <div className="who">{r.photo ? <img className={`avatar-s img ${st ? `ring-${ATT[st].tone}` : ''}`} src={src(r.photo)} alt="" /> : <span className={`avatar-s ${st ? `a-${ATT[st].tone}` : ''}`}>{r.name.slice(0, 1)}</span>}
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
                      {canMove && editable && (
                        <label className={`site ${siteOf(r) !== r.project_id ? 'moved' : ''}`} title="أين عمل هذا اليوم">
                          <span>الموقع</span>
                          <select value={siteOf(r)} onChange={(e) => setSite(r, Number(e.target.value))}>
                            {!places.some((p) => p.id === r.project_id) && <option value={r.project_id}>{r.project}</option>}
                            {places.map((p) => <option key={p.id} value={p.id}>{p.kind === 'factory' ? '🏭 ' : p.kind === 'office' ? '🏢 ' : ''}{p.name}</option>)}
                          </select>
                          {siteOf(r) !== r.project_id && <em>سيُنقل إلى {placeName(siteOf(r))}</em>}
                        </label>
                      )}
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

      {pulling && <PullWorker date={date} project={project} exclude={rows.map((r) => r.worker_id)} onClose={() => setPulling(false)}
        onPick={(list, site) => {
          setPulled((l) => [...list, ...l])
          setDraft((d) => { const n = { ...d }; for (const r of list) n[r.worker_id] = { status: 'present', project_id: site }; return n })
          setPulling(false)
          toast(`أُضيف ${list.length} عامل حاضر — راجع ثم اضغط «حفظ الحضور»`)
        }} />}

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

interface AnyWorker { id: number; name: string; profession: string; project_id: number | null; project: string | null; location_kind?: string | null; photo?: string | null }

/** Bring workers from other sites (or not yet placed) into today's sheet — tick several and add them at once. */
function PullWorker({ project, exclude, onClose, onPick }: { date: string; project: string; exclude: number[]; onClose: () => void; onPick: (r: Row[], site: number) => void }) {
  const { data } = useData<AnyWorker[]>('/api/workers?active=1')
  const meta = useMeta()
  const [q, setQ] = useState('')
  const [site, setSite] = useState<string>(project)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const list = (data ?? []).filter((w) => !exclude.includes(w.id) && (!q || `${w.name} ${w.profession} ${w.project ?? ''}`.includes(q.trim())))
  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOn = list.length > 0 && list.every((w) => picked.has(w.id))
  const add = () => {
    if (!site) { toast('اختر أولاً الموقع الذي يعملون فيه اليوم', 'err'); return }
    const p = meta?.places?.find((x) => x.id === Number(site))
    onPick((data ?? []).filter((w) => picked.has(w.id)).map((w) => ({ worker_id: w.id, name: w.name, profession: w.profession, project_id: w.project_id ?? Number(site), project: w.project ?? p?.name ?? '', photo: w.photo,
      status: null, check_in: null, check_out: null, overtime_hours: 0, method: null })), Number(site))
  }
  return (
    <Modal title="إضافة عمال" onClose={onClose} wide>
      <div className="pull">
        <div className="toolbar">
          <label className="inline">يعملون اليوم في
            <select className="select" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">اختر الموقع…</option>
              {(meta?.places ?? []).map((p) => <option key={p.id} value={p.id}>{p.kind === 'factory' ? '🏭 ' : p.kind === 'office' ? '🏢 ' : ''}{p.name}</option>)}
            </select>
          </label>
          <Search value={q} onChange={setQ} placeholder="ابحث بالاسم أو المهنة أو الموقع" />
          {list.length > 0 && <button type="button" className="btn ghost sm" onClick={() => setPicked((p) => { const n = new Set(p); for (const w of list) allOn ? n.delete(w.id) : n.add(w.id); return n })}>{allOn ? 'إلغاء التحديد' : `تحديد الكل (${list.length})`}</button>}
        </div>
        {!data ? <Loading /> : !list.length ? <Empty icon="workers" title="لا يوجد عمال آخرون" /> : (
          <ul className="people">
            {list.map((w) => (
              <li key={w.id} className={`pickable ${picked.has(w.id) ? 'picked' : ''}`} onClick={() => toggle(w.id)}>
                <input type="checkbox" checked={picked.has(w.id)} readOnly />
                {w.photo ? <img className="avatar-s img" src={src(w.photo)} alt="" /> : <span className="avatar-s">{w.name.slice(0, 1)}</span>}
                <div><strong>{w.name}</strong><small>{w.profession} · الآن في: {w.project ? `${w.location_kind === 'factory' ? '🏭 ' : w.location_kind === 'office' ? '🏢 ' : ''}${w.project}` : 'غير موزّع'}</small></div>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={!picked.size} onClick={add}><Icon name="plus" size={18} /> {picked.size ? `إضافة ${picked.size} عامل` : 'علّم العمال أولاً'}</button>
        </div>
      </div>
    </Modal>
  )
}
