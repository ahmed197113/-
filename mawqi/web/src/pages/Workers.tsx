import { useMemo, useState } from 'react'
import { fmt, sar, shortDate } from '../api'
import { Icon } from '../icons'
import { ACCEPT_ALL, Attachments, PickFiles, src, uploadAll, useCanDeleteFile, type MediaFile } from '../media'
import {
  ATT, Badge, DeleteButton, download, Empty, ErrorBox, Field, FormModal, inp, Loading, Modal, PageHead, ProjectSelect, Search, send, Stat, Tabs, today, addDays, toast,
  useCan, useData, useMeta,
} from '../ui'

interface Worker {
  id: number; name: string; iqama_no: string; iqama_expiry: string; nationality: string; profession: string; phone: string | null
  wage_type: 'daily' | 'monthly'; wage: number; subcontractor_id: number | null; project_id: number | null; active: number
  project: string | null; location_kind?: string | null; subcontractor: string | null; days_present: number; days_absent: number; iqama_soon: number
  photo?: string | null; today?: string | null
}
interface WorkerDetail extends Worker {
  history: { from_date: string; to_date: string | null; project: string }[]
  attendance: { date: string; status: string; check_in: string | null; check_out: string | null; overtime_hours: number }[]
  media: MediaFile[]
}

const NATIONALITIES = ['مصري', 'هندي', 'باكستاني', 'بنجلاديشي', 'نيبالي', 'يمني', 'سوداني', 'فلبيني', 'سعودي', 'أخرى']
const PROFESSIONS = ['نجار مسلح', 'حداد مسلح', 'بنّاء', 'كهربائي', 'سباك', 'دهان', 'مبلط', 'لحام', 'مشغل معدات', 'عامل عادي', 'فني تكييف', 'سائق']

export default function WorkersPage() {
  const [project, setProject] = useState('')
  const [active, setActive] = useState('1')
  const [q, setQ] = useState('')
  const [onlyIqama, setOnlyIqama] = useState(false)
  const [editing, setEditing] = useState<Partial<Worker> | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [moving, setMoving] = useState<Worker | null>(null)
  const [view, setView] = useState<'board' | 'list'>(() => { try { return (localStorage.getItem('mawqi.workersView') as 'board' | 'list') || 'board' } catch { return 'board' } })
  const pickView = (v: 'board' | 'list') => { setView(v); try { localStorage.setItem('mawqi.workersView', v) } catch { /* ignore */ } }
  const can = useCan()
  const { data, error } = useData<Worker[]>(`/api/workers?active=${active}${project ? `&project=${project}` : ''}`)

  const shown = useMemo(() => (data ?? []).filter((w) =>
    (!onlyIqama || w.iqama_soon) && (!q || `${w.name} ${w.iqama_no} ${w.profession} ${w.nationality} ${w.project ?? ''}`.includes(q.trim()))), [data, q, onlyIqama])

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const iqamaSoon = data.filter((w) => w.iqama_soon).length
  const monthlyCost = data.reduce((a, w) => a + (w.wage_type === 'daily' ? w.wage * 26 : w.wage), 0)

  return (
    <div className="page">
      <PageHead title="العمال" sub={`${fmt(data.length)} عامل`}>
        <button className="btn" onClick={() => download(`/api/export/workers${project ? `?project=${project}` : ''}`)}><Icon name="download" size={18} /> Excel</button>
        {can('workers') && <button className="btn primary" onClick={() => setEditing({ project_id: project ? Number(project) : null })}><Icon name="plus" size={18} /> عامل جديد</button>}
      </PageHead>

      <div className="stats">
        <Stat icon="workers" label="عدد العمال" value={fmt(data.length)} />
        <Stat icon="id" label="إقامات تنتهي خلال 30 يوماً" value={fmt(iqamaSoon)} tone={iqamaSoon ? 'bad' : 'good'} />
        <Stat icon="money" label="تقدير الرواتب الشهرية" value={sar(monthlyCost)} sub="اليومي × 26 يوم عمل" />
      </div>

      <div className="toolbar">
        <Tabs value={view} onChange={pickView} items={[{ key: 'board', label: 'توزيع العمال على المواقع' }, { key: 'list', label: 'قائمة العمال' }]} />
        <Search value={q} onChange={setQ} placeholder="بحث بالاسم أو الإقامة أو المهنة" />
        {view === 'list' && <ProjectSelect value={project} onChange={setProject} unassigned />}
        <select className="select" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="1">النشطون</option><option value="0">الموقوفون</option><option value="all">الكل</option>
        </select>
        <label className="toggle"><input type="checkbox" checked={onlyIqama} onChange={(e) => setOnlyIqama(e.target.checked)} /> إقامات قاربت على الانتهاء</label>
      </div>

      {view === 'board' && <Board workers={shown} onOpen={setViewing} onMove={can('moveWorkers') ? setMoving : undefined} />}
      {view === 'list' && <section className="panel flush">
        {shown.length === 0 ? <Empty icon="workers" title="لا يوجد عمال مطابقون" /> : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>العامل</th><th>الموقع الحالي</th><th>الإقامة</th><th>الأجر</th><th>حضور الشهر</th><th /></tr></thead>
              <tbody>
                {shown.map((w) => (
                  <tr key={w.id} onClick={() => setViewing(w.id)} className="clickable">
                    <td><div className="who"><Avatar w={w} /><div><strong>{w.name}</strong><small>{w.profession} · {w.nationality}{w.subcontractor ? ` · ${w.subcontractor}` : ''}</small></div></div></td>
                    <td>
                      <div className="loc">
                        {w.project ? <Badge tone={w.location_kind === 'factory' ? 'amber' : 'navy'}>{w.location_kind === 'factory' ? '🏭 ' : ''}{w.project}</Badge> : <Badge>غير موزّع</Badge>}
                        {can('moveWorkers') && <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMoving(w) }}>نقل</button>}
                      </div>
                    </td>
                    <td><span className="mono">{w.iqama_no}</span><small className={w.iqama_soon ? 'bad-t' : 'muted'}>تنتهي {w.iqama_expiry}</small></td>
                    <td className="num">{fmt(w.wage)} <small className="muted">{w.wage_type === 'daily' ? 'يومي' : 'شهري'}</small></td>
                    <td><span className="good-t">{w.days_present} يوم</span>{w.days_absent > 0 && <small className="bad-t"> · غياب {w.days_absent}</small>}</td>
                    <td>{can('workers') && <button className="icon-btn dark" onClick={(e) => { e.stopPropagation(); setEditing(w) }} title="تعديل"><Icon name="edit" size={18} /></button>}<DeleteButton icon path={`/api/workers/${w.id}`} what={`العامل «${w.name}» وسجل حضوره`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>}

      {editing && <WorkerForm worker={editing} onClose={() => setEditing(null)} />}
      {moving && <MoveWorker worker={moving} onClose={() => setMoving(null)} />}
      {viewing && <WorkerView id={viewing} onClose={() => setViewing(null)} onEdit={(w) => { setViewing(null); setEditing(w) }} />}
    </div>
  )
}

function WorkerForm({ worker, onClose }: { worker: Partial<Worker>; onClose: () => void }) {
  const meta = useMeta()
  const isNew = !worker.id
  const [newSub, setNewSub] = useState('')
  const [photo, setPhoto] = useState<File[]>([])
  const [iqama, setIqama] = useState<File[]>([])
  const initial = {
    name: worker.name ?? '', iqama_no: worker.iqama_no ?? '', iqama_expiry: worker.iqama_expiry ?? addDays(today(), 365),
    nationality: worker.nationality ?? '', profession: worker.profession ?? '', phone: worker.phone ?? '',
    wage_type: worker.wage_type ?? 'daily', wage: worker.wage ?? '', project_id: worker.project_id ?? '',
    subcontractor_id: worker.subcontractor_id ?? '', active: worker.active ?? 1,
  }
  return (
    <FormModal title={isNew ? 'عامل جديد' : `تعديل: ${worker.name}`} initial={initial} onClose={onClose} wide
      extra={!isNew ? <DeleteButton path={`/api/workers/${worker.id}`} what={`العامل «${worker.name}» وسجل حضوره`} onDone={onClose} /> : undefined}
      onSubmit={async (v) => {
        let sub = v.subcontractor_id
        if (sub === 'new') {
          if (!newSub.trim()) throw new Error('اكتب اسم مقاول الباطن الجديد')
          sub = String(((await send('/api/subcontractors', 'POST', { name: newSub })) as { id: number }).id)
        }
        const body = { ...v, subcontractor_id: sub }
        const out = (isNew ? await send('/api/workers', 'POST', body) : await send(`/api/workers/${worker.id}`, 'PUT', body)) as { id?: number }
        const id = isNew ? out.id! : worker.id!
        if (photo.length) await uploadAll('worker', id, photo.slice(-1), 'photo')
        if (iqama.length) await uploadAll('worker', id, iqama, 'iqama')
        toast(isNew ? 'تمت إضافة العامل' : 'تم حفظ بيانات العامل')
      }}>
      {(v, set) => (
        <>
          <Field label="اسم العامل" span={2}>{inp(v, set, 'name', 'text', { autoFocus: true })}</Field>
          <Field label="الجوال">{inp(v, set, 'phone', 'tel')}</Field>
          <Field label="رقم الإقامة">{inp(v, set, 'iqama_no', 'text', { inputMode: 'numeric' })}</Field>
          <Field label="انتهاء الإقامة">{inp(v, set, 'iqama_expiry', 'date')}</Field>
          <Field label="الجنسية">
            <input list="nat-list" value={v.nationality} onChange={(e) => set({ nationality: e.target.value })} />
            <datalist id="nat-list">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="المهنة">
            <input list="prof-list" value={v.profession} onChange={(e) => set({ profession: e.target.value })} />
            <datalist id="prof-list">{PROFESSIONS.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="نوع الأجر">
            <select value={v.wage_type} onChange={(e) => set({ wage_type: e.target.value as 'daily' | 'monthly' })}><option value="daily">يومي</option><option value="monthly">شهري</option></select>
          </Field>
          <Field label={v.wage_type === 'daily' ? 'الأجر اليومي (ر.س)' : 'الراتب الشهري (ر.س)'}>{inp(v, set, 'wage', 'number', { min: 0 })}</Field>
          <Field label="المشروع" hint={!isNew && String(v.project_id) !== String(worker.project_id ?? '') ? 'سيُسجل نقل العامل من اليوم' : undefined}>
            <select value={v.project_id} onChange={(e) => set({ project_id: e.target.value })}>
              <option value="">غير موزّع</option>{meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="مقاول الباطن">
            <select value={v.subcontractor_id} onChange={(e) => set({ subcontractor_id: e.target.value })}>
              <option value="">عمالة الشركة</option>{meta?.subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="new">+ مقاول جديد…</option>
            </select>
          </Field>
          {v.subcontractor_id === 'new' && <Field label="اسم المقاول الجديد"><input value={newSub} onChange={(e) => setNewSub(e.target.value)} /></Field>}
          {!isNew && (
            <Field label="الحالة">
              <select value={v.active} onChange={(e) => set({ active: Number(e.target.value) })}><option value={1}>نشط</option><option value={0}>موقوف / غادر</option></select>
            </Field>
          )}
          <div>
            <span className="field-label">الصورة الشخصية</span>
            <PickFiles files={photo} onChange={(f) => setPhoto(f.slice(-1))} accept="image/*" label={worker.photo ? 'تغيير الصورة' : 'إضافة صورة'} />
          </div>
          <div className="span-2">
            <span className="field-label">صورة الإقامة / المستندات</span>
            <PickFiles files={iqama} onChange={setIqama} accept={ACCEPT_ALL} label="صورة الإقامة" />
          </div>
        </>
      )}
    </FormModal>
  )
}

function WorkerView({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (w: Worker) => void }) {
  const { data: w } = useData<WorkerDetail>(`/api/workers/${id}`)
  const can = useCan()
  const canDel = useCanDeleteFile()
  const canAdd = can('workers') || can('moveWorkers')
  return (
    <Modal title={w?.name ?? '…'} onClose={onClose} wide footer={w && can('workers') ? <button className="btn primary" onClick={() => onEdit(w)}><Icon name="edit" size={18} /> تعديل</button> : undefined}>
      {!w ? <Loading /> : (
        <div className="detail">
          <div className="wk-head">
            {w.photo ? <img className="wk-photo" src={src(w.photo)} alt={w.name} /> : <span className="wk-photo none">{w.name.slice(0, 1)}</span>}
            <div><h2>{w.name}</h2><p className="muted">{w.profession} · {w.nationality}</p>
              <p>{w.project ? `${w.location_kind === 'factory' ? '🏭 ' : '🏗️ '}${w.project}` : 'غير موزّع'}</p></div>
          </div>
          <div className="facts">
            <div><span>المهنة</span><b>{w.profession}</b></div>
            <div><span>الجنسية</span><b>{w.nationality}</b></div>
            <div><span>الإقامة</span><b className="mono">{w.iqama_no}</b><small>تنتهي {w.iqama_expiry}</small></div>
            <div><span>الأجر</span><b>{fmt(w.wage)} ر.س</b><small>{w.wage_type === 'daily' ? 'يومي' : 'شهري'}</small></div>
            <div><span>المشروع</span><b>{w.project ?? '—'}</b></div>
            <div><span>الجهة</span><b>{w.subcontractor ?? 'عمالة الشركة'}</b></div>
            {w.phone && <div><span>الجوال</span><b><a href={`tel:${w.phone}`}>{w.phone}</a></b></div>}
          </div>
          <div className="grid-2 even">
            <Attachments entity="worker" id={w.id} files={w.media ?? []} tag="photo" canAdd={canAdd} canDelete={canDel} accept="image/*" title="الصورة الشخصية" empty="لا توجد صورة" compact />
            <Attachments entity="worker" id={w.id} files={w.media ?? []} tag="iqama" canAdd={canAdd} canDelete={canDel} accept={ACCEPT_ALL} title="الإقامة والمستندات" empty="لا توجد صورة للإقامة" compact />
          </div>
          <h3>آخر 31 يوماً</h3>
          <div className="days">
            {w.attendance.length === 0 && <p className="muted">لا يوجد حضور مسجل.</p>}
            {[...w.attendance].reverse().map((a) => (
              <span key={a.date} className={`day d-${ATT[a.status].tone}`} title={`${a.date} — ${ATT[a.status].label}${a.check_in ? ` ${a.check_in}` : ''}`}>
                {ATT[a.status].short}<small>{Number(a.date.slice(8))}</small>
              </span>
            ))}
          </div>
          <h3>سجل التنقل بين المشاريع</h3>
          <ul className="list">
            {w.history.map((h, i) => <li key={i}><strong>{h.project}</strong><span className="grow" /><small>{shortDate(h.from_date)} ← {h.to_date ? shortDate(h.to_date) : 'حتى الآن'}</small></li>)}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function MoveWorker({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const meta = useMeta()
  const [target, setTarget] = useState<string>(String(worker.project_id ?? ''))
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await send(`/api/workers/${worker.id}/move`, 'POST', { project_id: target ? Number(target) : null }, `تم نقل ${worker.name}`); onClose() }
    catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const places = meta?.projects.filter((p) => p.status === 'active') ?? []
  return (
    <Modal title={`أين يعمل ${worker.name}؟`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
        <button className="btn primary" onClick={go} disabled={busy}>{busy ? 'جارٍ النقل…' : 'تأكيد'}</button>
      </>
    }>
      <p className="muted">الموقع الحالي: <b>{worker.project ?? 'غير موزّع'}</b></p>
      <div className="places">
        {places.map((p) => (
          <button key={p.id} type="button" className={`place ${target === String(p.id) ? 'on' : ''}`} onClick={() => setTarget(String(p.id))}>
            <span>{p.kind === 'factory' ? '🏭' : '🏗️'}</span>{p.name}
          </button>
        ))}
        <button type="button" className={`place ${target === '' ? 'on' : ''}`} onClick={() => setTarget('')}><span>⏸️</span>غير موزّع</button>
      </div>
    </Modal>
  )
}

function Avatar({ w }: { w: Pick<Worker, 'name' | 'photo' | 'today'> }) {
  const tone = w.today ? ATT[w.today]?.tone : ''
  return w.photo
    ? <img className={`avatar-s img ${tone ? `ring-${tone}` : ''}`} src={src(w.photo)} alt="" loading="lazy" />
    : <span className={`avatar-s ${tone ? `a-${tone}` : ''}`}>{w.name.slice(0, 1)}</span>
}

/** Every location as a column: the factory, each project, and the unassigned — with today's attendance at a glance. */
function Board({ workers, onOpen, onMove }: { workers: Worker[]; onOpen: (id: number) => void; onMove?: (w: Worker) => void }) {
  const meta = useMeta()
  const places = [...(meta?.projects ?? []).filter((p) => p.status === 'active')]
  const groups = [
    ...places.map((p) => ({ key: String(p.id), name: p.name, icon: p.kind === 'factory' ? '🏭' : '🏗️', list: workers.filter((w) => w.project_id === p.id) })),
    // Workers in projects outside my list still show, grouped by their project name.
    ...[...new Set(workers.filter((w) => w.project_id && !places.some((p) => p.id === w.project_id)).map((w) => w.project_id))].map((pid) => {
      const list = workers.filter((w) => w.project_id === pid)
      return { key: String(pid), name: list[0]?.project ?? '—', icon: list[0]?.location_kind === 'factory' ? '🏭' : '🏗️', list }
    }),
    { key: 'none', name: 'غير موزّع', icon: '⏸️', list: workers.filter((w) => !w.project_id) },
  ]
  return (
    <div className="board-wf">
      {groups.map((g) => {
        const present = g.list.filter((w) => w.today && ['present', 'late', 'overtime'].includes(w.today)).length
        const absent = g.list.filter((w) => w.today === 'absent').length
        return (
          <section key={g.key} className="wf-col">
            <header>
              <span className="wf-icon">{g.icon}</span>
              <div><strong>{g.name}</strong><small>{g.list.length} عامل{g.key !== 'none' ? ` · حاضر ${present}${absent ? ` · غائب ${absent}` : ''}` : ''}</small></div>
            </header>
            {g.list.length === 0 && <p className="muted center">لا يوجد</p>}
            <ul>
              {g.list.map((w) => (
                <li key={w.id} onClick={() => onOpen(w.id)}>
                  <Avatar w={w} />
                  <div className="grow"><strong>{w.name}</strong><small>{w.profession}{w.today ? ` · ${ATT[w.today]?.label}` : ''}</small></div>
                  {onMove && <button className="icon-btn dark" title="نقل" onClick={(e) => { e.stopPropagation(); onMove(w) }}>⇄</button>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
