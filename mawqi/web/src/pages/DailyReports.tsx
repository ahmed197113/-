import { useState } from 'react'
import { longDate, shortDate } from '../api'
import { Icon } from '../icons'
import { addDays, DeleteButton, Empty, ErrorBox, Field, FormModal, inp, Loading, Modal, PageHead, ProjectSelect, send, today, useCan, useData, useMeta } from '../ui'

interface Report {
  id: number; project_id: number; project: string; date: string; weather: string | null; work_done: string; next_plan: string | null
  equipment: string | null; materials: string | null; obstacles: string | null; progress: number | null; author: string | null
  present: number; absent: number; new_issues: number
}

const WEATHER = ['مشمس', 'حار', 'معتدل', 'غائم جزئياً', 'رياح وأتربة', 'ممطر']

export default function DailyReportsPage() {
  const [project, setProject] = useState('')
  const [from, setFrom] = useState(addDays(today(), -30))
  const [editing, setEditing] = useState<Partial<Report> | null>(null)
  const [viewing, setViewing] = useState<Report | null>(null)
  const can = useCan()
  const meta = useMeta()
  const { data, error } = useData<Report[]>(`/api/daily-reports?from=${from}${project ? `&project=${project}` : ''}`)

  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />

  // Which of my active projects still have no report today?
  const reportedToday = new Set(data.filter((r) => r.date === today()).map((r) => r.project_id))
  const missing = (meta?.projects ?? []).filter((p) => p.status === 'active' && !reportedToday.has(p.id) && (!project || String(p.id) === project))
  const byDate = data.reduce<Record<string, Report[]>>((g, r) => ((g[r.date] ||= []).push(r), g), {})

  return (
    <div className="page">
      <PageHead title="التقرير اليومي" sub="ما تم إنجازه في كل موقع، يوماً بيوم">
        {can('dailyReports') && <button className="btn primary" onClick={() => setEditing({ project_id: project ? Number(project) : undefined, date: today() })}><Icon name="plus" size={18} /> تقرير اليوم</button>}
      </PageHead>

      {can('dailyReports') && missing.length > 0 && (
        <div className="notice">
          <Icon name="clock" size={20} />
          <span>لم يُرفع تقرير اليوم بعد لـ: {missing.map((p, i) => (
            <button key={p.id} className="link" onClick={() => setEditing({ project_id: p.id, date: today() })}>{p.name}{i < missing.length - 1 ? '،' : ''}</button>
          ))}</span>
        </div>
      )}

      <div className="toolbar">
        <ProjectSelect value={project} onChange={setProject} />
        <label className="inline">من <input type="date" className="select" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
      </div>

      {data.length === 0 ? <Empty icon="report" title="لا توجد تقارير في هذه الفترة" /> : (
        <div className="timeline">
          {Object.entries(byDate).map(([date, list]) => (
            <section key={date} className="tl-day">
              <h3 className="tl-date">{longDate(date)}</h3>
              <div className="cards-grid">
                {list.map((r) => (
                  <article key={r.id} className="rcard" onClick={() => setViewing(r)}>
                    <div className="rcard-top"><strong>{r.project}</strong>{r.weather && <small><Icon name="sun" size={14} /> {r.weather}</small>}</div>
                    <p className="clip-3">{r.work_done}</p>
                    <div className="rcard-foot">
                      <span className="good-t">{r.present} حاضر</span>
                      {r.absent > 0 && <span className="bad-t">{r.absent} غائب</span>}
                      {r.obstacles && <span className="warn-t">عوائق</span>}
                      <span className="grow" /><small>{r.author}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && <ReportForm report={editing} onClose={() => setEditing(null)} />}
      {viewing && <ReportView r={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} />}
    </div>
  )
}

function ReportForm({ report, onClose }: { report: Partial<Report>; onClose: () => void }) {
  const isNew = !report.id
  const initial = {
    project_id: report.project_id ?? '', date: report.date ?? today(), weather: report.weather ?? 'مشمس', work_done: report.work_done ?? '',
    next_plan: report.next_plan ?? '', equipment: report.equipment ?? '', materials: report.materials ?? '', obstacles: report.obstacles ?? '',
    progress: report.progress ?? '',
  }
  const meta = useMeta()
  return (
    <FormModal title={isNew ? 'تقرير يومي جديد' : `تقرير ${report.project} — ${shortDate(report.date!)}`} initial={initial} onClose={onClose} wide
      extra={!isNew ? <DeleteButton path={`/api/daily-reports/${report.id}`} what="هذا التقرير" onDone={onClose} /> : undefined}
      onSubmit={(v) => (isNew ? send('/api/daily-reports', 'POST', v, 'تم رفع التقرير') : send(`/api/daily-reports/${report.id}`, 'PUT', v, 'تم حفظ التقرير'))}>
      {(v, set) => (
        <>
          <Field label="المشروع">
            <select value={v.project_id} onChange={(e) => set({ project_id: e.target.value })}>
              <option value="">اختر…</option>{meta?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="التاريخ">{inp(v, set, 'date', 'date', { max: today() })}</Field>
          <Field label="الطقس">
            <select value={v.weather} onChange={(e) => set({ weather: e.target.value })}>{WEATHER.map((w) => <option key={w}>{w}</option>)}</select>
          </Field>
          <Field label="الأعمال المنفذة اليوم" span={3}><textarea rows={4} value={v.work_done} onChange={(e) => set({ work_done: e.target.value })} placeholder="مثال: صب سقف الدور الثالث — 85 م³" /></Field>
          <Field label="خطة الغد" span={3}><textarea rows={2} value={v.next_plan} onChange={(e) => set({ next_plan: e.target.value })} /></Field>
          <Field label="المعدات العاملة">{inp(v, set, 'equipment')}</Field>
          <Field label="المواد الواردة">{inp(v, set, 'materials')}</Field>
          <Field label="نسبة الإنجاز الكلية %" hint="تحدّث نسبة المشروع">{inp(v, set, 'progress', 'number', { min: 0, max: 100 })}</Field>
          <Field label="العوائق والملاحظات" span={3}><textarea rows={2} value={v.obstacles} onChange={(e) => set({ obstacles: e.target.value })} /></Field>
        </>
      )}
    </FormModal>
  )
}

function ReportView({ r, onClose, onEdit }: { r: Report; onClose: () => void; onEdit: () => void }) {
  const can = useCan()
  const rows: [string, string | null][] = [['الأعمال المنفذة', r.work_done], ['خطة الغد', r.next_plan], ['المعدات', r.equipment], ['المواد الواردة', r.materials], ['العوائق والملاحظات', r.obstacles]]
  return (
    <Modal title={`${r.project} — ${longDate(r.date)}`} onClose={onClose} wide footer={
      <>
        <button className="btn ghost" onClick={() => window.print()}><Icon name="print" size={18} /> طباعة</button>
        {can('dailyReports') && <button className="btn primary" onClick={onEdit}><Icon name="edit" size={18} /> تعديل</button>}
      </>
    }>
      <div className="printable">
        <div className="facts">
          <div><span>الطقس</span><b>{r.weather ?? '—'}</b></div>
          <div><span>الحضور</span><b className="good-t">{r.present}</b></div>
          <div><span>الغياب</span><b className="bad-t">{r.absent}</b></div>
          <div><span>بلاغات جديدة</span><b>{r.new_issues}</b></div>
          {r.progress !== null && <div><span>الإنجاز</span><b>{r.progress}%</b></div>}
          <div><span>بواسطة</span><b>{r.author ?? '—'}</b></div>
        </div>
        {rows.filter(([, t]) => t).map(([label, text]) => (
          <div key={label} className="block"><h3>{label}</h3><p className="pre">{text}</p></div>
        ))}
      </div>
    </Modal>
  )
}
