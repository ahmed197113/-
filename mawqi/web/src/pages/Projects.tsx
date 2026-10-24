import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { compact, fmt, sar, shortDate } from '../api'
import { Icon } from '../icons'
import {
  ATT, Badge, DeleteButton, Empty, ErrorBox, Field, FormModal, inp, ISSUE_STATUS, Loading, Meter, PageHead, PROJECT_STATUS, Ring, Search, send, SEVERITY,
  Stat, Tabs, today, useCan, useData, useMeta,
} from '../ui'

export interface Project {
  id: number; name: string; city: string | null; client: string | null; contract_value: number
  lat: number; lng: number; radius_m: number; start_date: string; end_date: string; planned_workers: number; progress: number
  manager_id: number | null; supervisor_id: number | null; status: string; supervisor: string | null; manager: string | null
  assigned: number; present: number; open_issues: number; cost_month: number; cost_total: number; last_report: string | null
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5)
const timeUsed = (p: Project) => {
  const total = Math.max(1, daysBetween(p.start_date, p.end_date))
  return Math.max(0, Math.min(100, (daysBetween(p.start_date, today()) / total) * 100))
}

export default function ProjectsPage() {
  const { data, error } = useData<Project[]>('/api/projects')
  const can = useCan()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'active' | 'paused' | 'done' | 'all'>('active')
  const [editing, setEditing] = useState<Partial<Project> | null>(null)

  const shown = useMemo(() => (data ?? []).filter((p) =>
    (tab === 'all' || p.status === tab) && (!q || `${p.name} ${p.city ?? ''} ${p.client ?? ''}`.includes(q.trim()))), [data, q, tab])

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const count = (s: string) => data.filter((p) => p.status === s).length

  return (
    <div className="page">
      <PageHead title="المشاريع" sub={`${fmt(data.length)} مشروع · ${fmt(data.reduce((a, p) => a + p.assigned, 0))} عامل`}>
        {can('projectsCreate') && <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> مشروع جديد</button>}
      </PageHead>

      <div className="toolbar">
        <Tabs value={tab} onChange={setTab} items={[
          { key: 'active', label: 'جارية', count: count('active') }, { key: 'paused', label: 'متوقفة', count: count('paused') },
          { key: 'done', label: 'منتهية', count: count('done') }, { key: 'all', label: 'الكل', count: data.length },
        ]} />
        <Search value={q} onChange={setQ} placeholder="بحث باسم المشروع أو المدينة أو المالك" />
      </div>

      {shown.length === 0 ? <Empty icon="projects" title="لا توجد مشاريع هنا" text={can('projectsCreate') ? 'أضف أول مشروع لتبدأ.' : undefined} /> : (
        <div className="cards-grid">
          {shown.map((p) => {
            const ratio = p.present / Math.max(1, p.planned_workers)
            const used = timeUsed(p)
            const behind = p.status === 'active' && used - p.progress > 15
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className={`pcard ${behind ? 'behind' : ''}`}>
                <div className="pcard-top">
                  <div>
                    <strong>{p.name}</strong>
                    <small><Icon name="pin" size={14} /> {p.city ?? '—'}{p.client ? ` · ${p.client}` : ''}</small>
                  </div>
                  <Ring value={p.progress} size={62} />
                </div>
                <div className="pcard-row">
                  <span>الحضور اليوم</span>
                  <b className={ratio < 0.8 ? 'bad-t' : ''}>{p.present} / {p.planned_workers}</b>
                </div>
                <Meter value={ratio * 100} tone={ratio < 0.8 ? 'bad' : 'good'} />
                <div className="pcard-row"><span>المدة المنقضية</span><b>{Math.round(used)}%</b></div>
                <Meter value={used} tone={behind ? 'warn' : undefined} />
                <div className="pcard-foot">
                  <Badge tone={PROJECT_STATUS[p.status]?.tone}>{PROJECT_STATUS[p.status]?.label}</Badge>
                  {behind && <Badge tone="warn">متأخر عن الجدول</Badge>}
                  {p.open_issues > 0 && <Badge tone="bad">{p.open_issues} بلاغ مفتوح</Badge>}
                  <span className="grow" />
                  <small>العمالة هذا الشهر <b>{compact(p.cost_month)}</b></small>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {editing && <ProjectForm project={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function ProjectForm({ project, onClose, onDeleted }: { project: Partial<Project>; onClose: () => void; onDeleted?: () => void }) {
  const meta = useMeta()
  const can = useCan()
  const isNew = !project.id
  const initial = {
    name: project.name ?? '', city: project.city ?? '', client: project.client ?? '', contract_value: project.contract_value ?? '',
    start_date: project.start_date ?? today(), end_date: project.end_date ?? '', planned_workers: project.planned_workers ?? '',
    progress: project.progress ?? 0, manager_id: project.manager_id ?? '', supervisor_id: project.supervisor_id ?? '', status: project.status ?? 'active',
    lat: project.lat ?? '', lng: project.lng ?? '', radius_m: project.radius_m ?? 300,
  }
  const users = (role: string) => meta?.users.filter((u) => u.role === role && u.active) ?? []
  return (
    <FormModal title={isNew ? 'مشروع جديد' : `تعديل: ${project.name}`} initial={initial} onClose={onClose} wide
      extra={!isNew ? <DeleteButton path={`/api/projects/${project.id}`} what={`المشروع «${project.name}» وكل حضوره وبلاغاته وتقاريره ومستخلصاته`} onDone={() => { onClose(); onDeleted?.() }} /> : undefined}
      onSubmit={(v) => (isNew ? send('/api/projects', 'POST', v, 'تمت إضافة المشروع') : send(`/api/projects/${project.id}`, 'PUT', v, 'تم حفظ التعديلات'))}>
      {(v, set) => (
        <>
          <Field label="اسم المشروع" span={2}>{inp(v, set, 'name', 'text', { required: true, autoFocus: true })}</Field>
          <Field label="المدينة">{inp(v, set, 'city')}</Field>
          <Field label="المالك (العميل)" span={2}>{inp(v, set, 'client')}</Field>
          <Field label="قيمة العقد (ر.س)">{inp(v, set, 'contract_value', 'number', { min: 0 })}</Field>
          <Field label="تاريخ البداية">{inp(v, set, 'start_date', 'date')}</Field>
          <Field label="تاريخ النهاية">{inp(v, set, 'end_date', 'date')}</Field>
          <Field label="العمالة المخططة">{inp(v, set, 'planned_workers', 'number', { min: 1 })}</Field>
          <Field label="مدير المشروع">
            <select value={v.manager_id} disabled={!can('users')} onChange={(e) => set({ manager_id: e.target.value })}>
              <option value="">—</option>{users('project_manager').concat(users('admin')).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="مشرف الموقع">
            <select value={v.supervisor_id} onChange={(e) => set({ supervisor_id: e.target.value })}>
              <option value="">—</option>{users('supervisor').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="الحالة">
            <select value={v.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(PROJECT_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="نسبة الإنجاز %">{inp(v, set, 'progress', 'number', { min: 0, max: 100 })}</Field>
          <Field label="خط العرض (للحضور بالموقع)" hint="اختياري">{inp(v, set, 'lat', 'number', { step: 'any' })}</Field>
          <Field label="خط الطول" hint="اختياري">{inp(v, set, 'lng', 'number', { step: 'any' })}</Field>
        </>
      )}
    </FormModal>
  )
}

interface ProjectDetail extends Project {
  workers: { id: number; name: string; profession: string; nationality: string; today: string | null }[]
  issues: { id: number; title: string; severity: string; status: string; due_at: string | null }[]
  series: { date: string; present: number; absent: number }[]
  reports: { id: number; date: string; work_done: string; author: string }[]
  invoiced: number; subcontracted: number
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const can = useCan()
  const { data: p, error } = useData<ProjectDetail>(`/api/projects/${id}`)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'workers' | 'issues' | 'reports'>('workers')

  if (error && !p) return <ErrorBox error={error} />
  if (!p) return <Loading />
  const used = timeUsed(p)
  const remaining = daysBetween(today(), p.end_date)
  const maxBar = Math.max(1, ...p.series.map((s) => s.present + s.absent))

  return (
    <div className="page">
      <button className="back" onClick={() => nav('/projects')}><Icon name="back" size={18} /> كل المشاريع</button>
      <PageHead title={p.name} sub={<>{p.city ?? ''}{p.client ? ` · المالك: ${p.client}` : ''} · {shortDate(p.start_date)} ← {shortDate(p.end_date)}</>}>
        <Badge tone={PROJECT_STATUS[p.status]?.tone}>{PROJECT_STATUS[p.status]?.label}</Badge>
        {can('projects') && <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={18} /> تعديل</button>}
      </PageHead>

      <div className="hero">
        <Ring value={p.progress} size={120} label="إنجاز" />
        <div className="hero-bars">
          <div><span>الإنجاز الفعلي</span><b>{fmt(p.progress)}%</b></div><Meter value={p.progress} tone="good" />
          <div><span>المدة المنقضية</span><b>{Math.round(used)}%</b></div><Meter value={used} tone={used - p.progress > 15 ? 'warn' : undefined} />
          <p className="muted">{remaining >= 0 ? `متبقٍ ${fmt(remaining)} يوماً على التسليم` : `تجاوز موعد التسليم بـ ${fmt(-remaining)} يوماً`}
            {p.last_report && ` · آخر تقرير يومي ${shortDate(p.last_report)}`}</p>
        </div>
        <div className="mini-chart" aria-label="الحضور آخر 14 يوماً">
          {p.series.map((s) => (
            <div key={s.date} title={`${shortDate(s.date)}: ${s.present} حاضر، ${s.absent} غائب`}>
              <i className="bar-bad" style={{ height: `${(s.absent / maxBar) * 100}%` }} />
              <i className="bar-good" style={{ height: `${(s.present / maxBar) * 100}%` }} />
            </div>
          ))}
          <small>الحضور آخر 14 يوماً</small>
        </div>
      </div>

      <div className="stats">
        <Stat icon="workers" label="الحضور اليوم" value={`${p.present} / ${p.planned_workers}`} sub={`${p.assigned} عامل على المشروع`} tone={p.present < p.planned_workers * 0.8 ? 'bad' : 'good'} />
        <Stat icon="money" label="تكلفة العمالة (الشهر)" value={sar(p.cost_month)} sub={`الإجمالي ${compact(p.cost_total)} ر.س`} />
        <Stat icon="contracts" label="المستخلصات المعتمدة" value={compact(p.invoiced)} sub={p.contract_value ? `من عقد ${compact(p.contract_value)}` : 'ر.س'} tone="good" />
        <Stat icon="issues" label="بلاغات مفتوحة" value={fmt(p.open_issues)} tone={p.open_issues ? 'warn' : 'good'} />
      </div>

      <section className="panel">
        <Tabs value={tab} onChange={setTab} items={[
          { key: 'workers', label: 'العمال اليوم', count: p.workers.length }, { key: 'issues', label: 'البلاغات المفتوحة', count: p.issues.length },
          { key: 'reports', label: 'آخر التقارير', count: p.reports.length },
        ]} />
        {tab === 'workers' && (p.workers.length ? (
          <ul className="people">
            {p.workers.map((w) => (
              <li key={w.id}>
                <span className="avatar-s">{w.name.slice(0, 1)}</span>
                <div><strong>{w.name}</strong><small>{w.profession} · {w.nationality}</small></div>
                {w.today ? <Badge tone={ATT[w.today].tone}>{ATT[w.today].label}</Badge> : <Badge>لم يُسجل</Badge>}
              </li>
            ))}
          </ul>
        ) : <Empty icon="workers" title="لا يوجد عمال على هذا المشروع" />)}
        {tab === 'issues' && (p.issues.length ? (
          <ul className="list">
            {p.issues.map((i) => (
              <li key={i.id}><Badge tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Badge><strong>{i.title}</strong><span className="grow" />
                <small>{ISSUE_STATUS[i.status]}{i.due_at ? ` · المهلة ${shortDate(i.due_at.slice(0, 10))}` : ''}</small></li>
            ))}
          </ul>
        ) : <Empty icon="check" title="لا توجد بلاغات مفتوحة" />)}
        {tab === 'reports' && (p.reports.length ? (
          <ul className="list">
            {p.reports.map((r) => <li key={r.id}><b>{shortDate(r.date)}</b><span className="clip">{r.work_done}</span><span className="grow" /><small>{r.author}</small></li>)}
          </ul>
        ) : <Empty icon="report" title="لا توجد تقارير يومية بعد" />)}
      </section>

      {editing && <ProjectForm project={p} onClose={() => setEditing(false)} onDeleted={() => nav('/projects')} />}
    </div>
  )
}
