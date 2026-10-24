import { useMemo, useState } from 'react'
import { shortDate } from '../api'
import { Icon } from '../icons'
import { Attachments, MediaGrid, PickFiles, uploadAll, useCanDeleteFile, type MediaFile } from '../media'
import {
  addDays, Badge, CATEGORY, DeleteButton, download, Empty, ErrorBox, Field, FormModal, inp, ISSUE_STATUS, Loading, PageHead, ProjectSelect, Search, send,
  SEVERITY, Tabs, today, toast, useCan, useData, useMeta,
} from '../ui'

interface Issue {
  id: number; project_id: number; project: string; title: string; description: string | null; category: string; severity: string
  status: 'open' | 'in_progress' | 'closed'; assignee_id: number | null; assignee: string | null; reporter: string | null
  due_at: string | null; created_at: string; closed_at: string | null; resolution: string | null; overdue: number; escalated: number; media: MediaFile[]
}

const COLS: Issue['status'][] = ['open', 'in_progress', 'closed']

export default function IssuesPage() {
  const [project, setProject] = useState('')
  const [q, setQ] = useState('')
  const [sev, setSev] = useState<string>('all')
  const [editing, setEditing] = useState<Partial<Issue> | null>(null)
  const can = useCan()
  const { data, error } = useData<Issue[]>(`/api/issues${project ? `?project=${project}` : ''}`)

  const shown = useMemo(() => (data ?? []).filter((i) =>
    (sev === 'all' || (sev === 'overdue' ? i.overdue : i.severity === sev)) && (!q || `${i.title} ${i.project} ${i.assignee ?? ''}`.includes(q.trim()))), [data, q, sev])

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />

  const move = async (i: Issue, status: Issue['status']) => {
    try { await send(`/api/issues/${i.id}`, 'PUT', { status }, status === 'closed' ? 'تم إغلاق البلاغ' : 'تم تحديث الحالة') } catch (e) { toast((e as Error).message, 'err') }
  }
  const overdue = data.filter((i) => i.overdue).length

  return (
    <div className="page">
      <PageHead title="المشاكل والبلاغات" sub={`${data.filter((i) => i.status !== 'closed').length} مفتوح${overdue ? ` · ${overdue} متأخر` : ''}`}>
        <button className="btn" onClick={() => download(`/api/export/issues${project ? `?project=${project}` : ''}`)}><Icon name="download" size={18} /> Excel</button>
        {can('issues') && <button className="btn primary" onClick={() => setEditing({ project_id: project ? Number(project) : undefined })}><Icon name="plus" size={18} /> بلاغ جديد</button>}
      </PageHead>

      <div className="toolbar">
        <ProjectSelect value={project} onChange={setProject} />
        <Tabs value={sev} onChange={setSev} items={[
          { key: 'all', label: 'الكل' }, { key: 'overdue', label: 'متأخرة', count: overdue },
          { key: 'critical', label: 'حرجة' }, { key: 'high', label: 'عالية' },
        ]} />
        <Search value={q} onChange={setQ} placeholder="بحث في البلاغات" />
      </div>

      <div className="board">
        {COLS.map((col) => {
          const list = shown.filter((i) => i.status === col)
          return (
            <section key={col} className={`col col-${col}`}>
              <h3>{ISSUE_STATUS[col]} <em>{list.length}</em></h3>
              {list.length === 0 && <p className="muted center">لا يوجد</p>}
              {list.slice(0, col === 'closed' ? 30 : 200).map((i) => (
                <article key={i.id} className={`icard sev-${i.severity} ${i.overdue ? 'late' : ''}`}>
                  <div className="icard-top">
                    <Badge tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Badge>
                    <small>{CATEGORY[i.category]}</small>
                    {i.overdue ? <Badge tone="bad">متأخر</Badge> : null}
                    <span className="grow" />
                    {can('issues') && <button className="icon-btn dark" onClick={() => setEditing(i)} title="تعديل"><Icon name="edit" size={16} /></button>}
                    <DeleteButton icon path={`/api/issues/${i.id}`} what={`البلاغ «${i.title}»`} />
                  </div>
                  <strong>{i.title}</strong>
                  {i.description && <p className="clip-2">{i.description}</p>}
                  {i.resolution && col === 'closed' && <p className="good-t clip-2">الحل: {i.resolution}</p>}
                  {i.media?.length > 0 && <MediaGrid files={i.media} small max={4} />}
                  <div className="icard-meta">
                    <span><Icon name="projects" size={14} /> {i.project}</span>
                    <span><Icon name="user" size={14} /> {i.assignee ?? 'غير محدد'}</span>
                    {i.due_at && <span><Icon name="clock" size={14} /> {shortDate(i.due_at.slice(0, 10))}</span>}
                  </div>
                  {can('issues') && col !== 'closed' && (
                    <div className="icard-actions">
                      {col === 'open' && <button className="btn sm" onClick={() => move(i, 'in_progress')}>بدء المعالجة</button>}
                      <button className="btn sm good" onClick={() => setEditing({ ...i, status: 'closed' })}><Icon name="check" size={14} /> إغلاق</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )
        })}
      </div>
      {data.length === 0 && <Empty icon="check" title="لا توجد بلاغات" text="كل شيء على ما يرام." />}
      {editing && <IssueForm issue={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function IssueForm({ issue, onClose }: { issue: Partial<Issue>; onClose: () => void }) {
  const meta = useMeta()
  const isNew = !issue.id
  const initial = {
    project_id: issue.project_id ?? '', title: issue.title ?? '', description: issue.description ?? '', category: issue.category ?? 'safety',
    severity: issue.severity ?? 'medium', assignee_id: issue.assignee_id ?? '', due_at: (issue.due_at ?? `${addDays(today(), 2)}T17:00`).slice(0, 16),
    status: issue.status ?? 'open', resolution: issue.resolution ?? '',
  }
  const canDel = useCanDeleteFile()
  const [before, setBefore] = useState<File[]>([])
  const [after, setAfter] = useState<File[]>([])
  const [up, setUp] = useState('')
  return (
    <FormModal title={isNew ? 'بلاغ جديد' : issue.status === 'closed' && issue.closed_at === null ? 'إغلاق البلاغ' : 'تعديل البلاغ'} initial={initial} onClose={onClose} wide
      extra={!isNew ? <DeleteButton path={`/api/issues/${issue.id}`} what={`البلاغ «${issue.title}»`} onDone={onClose} /> : undefined}
      onSubmit={async (v) => {
        const out = (isNew ? await send('/api/issues', 'POST', v) : await send(`/api/issues/${issue.id}`, 'PUT', v)) as { id?: number }
        const id = isNew ? out.id! : issue.id!
        const prog = (d: number, t: number, p: number) => setUp(`جارٍ رفع الصور ${d + 1} من ${t} — ${Math.round(p * 100)}%`)
        if (before.length) await uploadAll('issue', id, before, 'before', prog)
        if (after.length) await uploadAll('issue', id, after, 'after', prog)
        toast(isNew ? 'تم تسجيل البلاغ' : 'تم حفظ البلاغ')
      }}>
      {(v, set) => (
        <>
          <Field label="عنوان المشكلة" span={2}>{inp(v, set, 'title', 'text', { autoFocus: isNew })}</Field>
          <Field label="المشروع">
            <select value={v.project_id} onChange={(e) => set({ project_id: e.target.value })}>
              <option value="">اختر…</option>{meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="التصنيف">
            <select value={v.category} onChange={(e) => set({ category: e.target.value })}>{Object.entries(CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label="الخطورة">
            <div className="seg full">
              {Object.entries(SEVERITY).reverse().map(([k, s]) => (
                <button key={k} type="button" className={`seg-btn ${v.severity === k ? `on c-${s.tone}` : ''}`} onClick={() => set({ severity: k })}>{s.label}</button>
              ))}
            </div>
          </Field>
          <Field label="المسؤول عن الحل">
            <select value={v.assignee_id} onChange={(e) => set({ assignee_id: e.target.value })}>
              <option value="">—</option>{meta?.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} ({meta.roles[u.role]})</option>)}
            </select>
          </Field>
          <Field label="المهلة">{inp(v, set, 'due_at', 'datetime-local')}</Field>
          {!isNew && (
            <Field label="الحالة">
              <select value={v.status} onChange={(e) => set({ status: e.target.value as Issue['status'] })}>{Object.entries(ISSUE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
          )}
          <Field label="التفاصيل" span={3}><textarea rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          {v.status === 'closed' && <Field label="ما الذي تم لحل المشكلة؟" span={3}><textarea rows={2} value={v.resolution} onChange={(e) => set({ resolution: e.target.value })} autoFocus /></Field>}
          <div className="span-3">
            <span className="field-label">صور أو فيديو للمشكلة</span>
            {!isNew && <Attachments entity="issue" id={issue.id!} files={issue.media ?? []} tag="before" canAdd={false} canDelete={canDel} compact />}
            <PickFiles files={before} onChange={setBefore} label="صورة المشكلة" />
          </div>
          {(v.status === 'closed' || (issue.media ?? []).some((m) => m.tag === 'after')) && (
            <div className="span-3">
              <span className="field-label">صور بعد الحل</span>
              {!isNew && <Attachments entity="issue" id={issue.id!} files={issue.media ?? []} tag="after" canAdd={false} canDelete={canDel} compact />}
              <PickFiles files={after} onChange={setAfter} label="صورة بعد الحل" />
            </div>
          )}
          {up && <p className="muted span-3">{up}</p>}
        </>
      )}
    </FormModal>
  )
}
