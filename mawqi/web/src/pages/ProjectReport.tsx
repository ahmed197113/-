import { useParams, useNavigate } from 'react-router-dom'
import { compact, fmt, longDate, sar, shortDate } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { src, type MediaFile } from '../media'
import { ErrorBox, INVOICE_STATUS, ISSUE_STATUS, Loading, SEVERITY, today, useData } from '../ui'
import type { Cost, Project } from './Projects'

interface Detail extends Project {
  workers: { id: number; name: string; profession: string; today: string | null }[]
  series: { date: string; present: number; absent: number }[]
  invoiced: number; subcontracted: number; gallery: MediaFile[]
  costs?: { month: Cost; total: Cost }
}
interface Report { id: number; date: string; weather: string | null; work_done: string; obstacles: string | null; author: string | null; present: number; absent: number; media: MediaFile[] }
interface Issue { id: number; title: string; severity: string; status: string; due_at: string | null; assignee: string | null; resolution: string | null; overdue: number; created_at: string }
interface Invoice { id: number; number: string; kind: string; subcontractor: string | null; gross: number; total: number; status: string; period_to: string | null }

const days = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5)

/** A complete, printable report of one project — for the owner, management or the archive. */
export default function ProjectReportPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { status } = useAuth()
  const p = useData<Detail>(`/api/projects/${id}`)
  const reports = useData<Report[]>(`/api/daily-reports?project=${id}`)
  const issues = useData<Issue[]>(`/api/issues?project=${id}`)
  const invoices = useData<Invoice[]>(`/api/invoices?project=${id}`)

  if (p.error && !p.data) return <ErrorBox error={p.error} />
  if (!p.data || !reports.data || !issues.data || !invoices.data) return <Loading />
  const d = p.data
  const total = Math.max(1, days(d.start_date, d.end_date))
  const used = Math.max(0, Math.min(100, (days(d.start_date, today()) / total) * 100))
  const gap = Math.round(used - d.progress)
  const att = d.series.reduce((a, s) => ({ present: a.present + s.present, absent: a.absent + s.absent }), { present: 0, absent: 0 })
  const absRate = att.present + att.absent ? (att.absent / (att.present + att.absent)) * 100 : 0
  const open = issues.data.filter((i) => i.status !== 'closed')
  const closed = issues.data.filter((i) => i.status === 'closed')
  const client = invoices.data.filter((v) => v.kind === 'client')
  const subs = invoices.data.filter((v) => v.kind === 'subcontractor')
  const photos = d.gallery.filter((m) => m.kind === 'image').slice(0, 12)
  const lastReports = reports.data.slice(0, 7)

  // The headline in plain words: where the project stands today.
  const verdict = d.status === 'done' ? 'المشروع منتهٍ.'
    : gap > 15 ? `المشروع متأخر عن الجدول: انقضى ${Math.round(used)}% من المدة وأُنجز ${fmt(d.progress)}% فقط.`
    : gap < -5 ? `المشروع متقدم على الجدول: أُنجز ${fmt(d.progress)}% مقابل ${Math.round(used)}% من المدة.`
    : `المشروع يسير حسب الجدول: أُنجز ${fmt(d.progress)}% وانقضى ${Math.round(used)}% من المدة.`

  return (
    <div className="page report-page">
      <div className="no-print report-actions">
        <button className="back" onClick={() => nav(`/projects/${d.id}`)}><Icon name="back" size={18} /> رجوع للمشروع</button>
        <span className="grow" />
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" size={18} /> طباعة / حفظ PDF</button>
      </div>

      <article className="sheet-a4">
        <header className="rp-head">
          <img src="/logo.png" alt="" />
          <div>
            <small>{status?.companyName ?? 'شركة الخطوط المعدنية للمقاولات العامة'}</small>
            <h1>تقرير مشروع: {d.name}</h1>
            <p>{d.city ?? ''}{d.client ? ` · المالك: ${d.client}` : ''} · صدر في {longDate(today())}</p>
          </div>
        </header>

        <p className={`verdict ${gap > 15 ? 'bad' : 'good'}`}>{verdict}</p>

        <section className="rp-grid">
          <div><span>نسبة الإنجاز</span><b>{fmt(d.progress)}%</b></div>
          <div><span>المدة المنقضية</span><b>{Math.round(used)}%</b></div>
          <div><span>المتبقي على التسليم</span><b>{fmt(Math.max(0, days(today(), d.end_date)))} يوم</b></div>
          <div><span>العمال على المشروع</span><b>{fmt(d.assigned)}</b><small>المخطط {fmt(d.planned_workers)}</small></div>
          <div><span>الحضور اليوم</span><b>{fmt(d.present)}</b></div>
          <div><span>نسبة الغياب (14 يوماً)</span><b>{absRate.toFixed(1)}%</b></div>
          <div><span>التكلفة الفعلية هذا الشهر</span><b>{sar(d.costs?.month.total ?? d.cost_month)}</b></div>
          <div><span>التكلفة الفعلية منذ البداية</span><b>{compact(d.costs?.total.total ?? d.cost_total)} ر.س</b></div>
          <div><span>المستخلصات المعتمدة</span><b>{compact(d.invoiced)} ر.س</b>{d.contract_value > 0 && <small>من عقد {compact(d.contract_value)}</small>}</div>
        </section>

        {d.costs && (
          <section>
            <h2>التكلفة الفعلية</h2>
            <table className="rp-table">
              <thead><tr><th>البند</th><th>هذا الشهر</th><th>منذ بداية المشروع</th></tr></thead>
              <tbody>
                <tr><th>العمالة (حسب الحضور)</th><td>{sar(d.costs.month.labour)}</td><td>{sar(d.costs.total.labour)}</td></tr>
                <tr><th>تجديد إقامات عمال المشروع</th><td>{sar(d.costs.month.iqama)}</td><td>{sar(d.costs.total.iqama)}</td></tr>
                <tr><th>حصة المشروع من مصاريف الإدارة</th><td>{sar(d.costs.month.overhead)}</td><td>{sar(d.costs.total.overhead)}</td></tr>
                {(d.costs.total.custody ?? 0) > 0 && <tr><th>مصروفات العهد (من تطبيق العهدة)</th><td>{sar(d.costs.month.custody ?? 0)}</td><td>{sar(d.costs.total.custody ?? 0)}</td></tr>}
                {d.subcontracted > 0 && <tr><th>مستخلصات مقاولي الباطن المعتمدة</th><td>—</td><td>{sar(d.subcontracted)}</td></tr>}
                <tr className="total"><th>الإجمالي</th><td><b>{sar(d.costs.month.total)}</b></td><td><b>{sar(d.costs.total.total + d.subcontracted)}</b></td></tr>
              </tbody>
            </table>
            <p className="muted">حصة الإدارة = رواتب وإقامات موظفي الإدارة ÷ عدد المشاريع الجارية في كل شهر.</p>
          </section>
        )}

        <section>
          <h2>بيانات المشروع</h2>
          <table className="rp-table">
            <tbody>
              <tr><th>مدة التنفيذ</th><td>{shortDate(d.start_date)} ← {shortDate(d.end_date)} ({fmt(total)} يوم)</td></tr>
              <tr><th>مديرو المشروع</th><td>{d.manager ?? '—'}</td></tr>
              <tr><th>مشرفو الموقع</th><td>{d.supervisor ?? '—'}</td></tr>
              {d.contract_value > 0 && <tr><th>قيمة العقد</th><td>{sar(d.contract_value)} — المتبقي {sar(d.contract_value - d.invoiced)}</td></tr>}
              {d.subcontracted > 0 && <tr><th>مستخلصات مقاولي الباطن المعتمدة</th><td>{sar(d.subcontracted)}</td></tr>}
            </tbody>
          </table>
        </section>

        <section>
          <h2>الحضور آخر 14 يوماً</h2>
          <table className="rp-table center">
            <thead><tr><th>اليوم</th>{d.series.map((s) => <th key={s.date}>{Number(s.date.slice(8))}</th>)}</tr></thead>
            <tbody>
              <tr><th>حاضر</th>{d.series.map((s) => <td key={s.date} className="good-t">{s.present}</td>)}</tr>
              <tr><th>غائب</th>{d.series.map((s) => <td key={s.date} className="bad-t">{s.absent || ''}</td>)}</tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>البلاغات — {open.length} مفتوح، {closed.length} مغلق</h2>
          {open.length === 0 ? <p className="muted">لا توجد بلاغات مفتوحة.</p> : (
            <table className="rp-table">
              <thead><tr><th>البلاغ</th><th>الخطورة</th><th>الحالة</th><th>المسؤول</th><th>المهلة</th></tr></thead>
              <tbody>
                {open.map((i) => (
                  <tr key={i.id} className={i.overdue ? 'late' : ''}>
                    <td>{i.title}</td><td>{SEVERITY[i.severity]?.label}</td><td>{ISSUE_STATUS[i.status]}{i.overdue ? ' (متأخر)' : ''}</td>
                    <td>{i.assignee ?? '—'}</td><td>{i.due_at ? shortDate(i.due_at.slice(0, 10)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {invoices.data.length > 0 && (
          <section>
            <h2>المستخلصات</h2>
            <table className="rp-table">
              <thead><tr><th>الرقم</th><th>الجهة</th><th>قيمة الأعمال</th><th>المستحق شامل الضريبة</th><th>الحالة</th></tr></thead>
              <tbody>
                {[...client, ...subs].map((v) => (
                  <tr key={v.id}><td>{v.number}</td><td>{v.kind === 'client' ? 'المالك' : v.subcontractor}</td><td>{sar(v.gross)}</td><td>{sar(v.total)}</td><td>{INVOICE_STATUS[v.status]?.label}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>آخر التقارير اليومية</h2>
          {lastReports.length === 0 ? <p className="muted">لا توجد تقارير يومية بعد.</p> : lastReports.map((r) => (
            <div key={r.id} className="rp-day">
              <div className="rp-day-head"><b>{longDate(r.date)}</b><span>{r.weather ?? ''}</span><span className="good-t">{r.present} حاضر</span>{r.absent > 0 && <span className="bad-t">{r.absent} غائب</span>}<span className="grow" /><small>{r.author}</small></div>
              <p className="pre">{r.work_done}</p>
              {r.obstacles && <p className="warn-t pre">العوائق: {r.obstacles}</p>}
              {r.media.some((m) => m.kind === 'image') && (
                <div className="rp-photos">{r.media.filter((m) => m.kind === 'image').slice(0, 4).map((m) => <img key={m.id} src={src(m.url)} alt="" />)}</div>
              )}
            </div>
          ))}
        </section>

        {photos.length > 0 && (
          <section>
            <h2>صور من الموقع</h2>
            <div className="rp-gallery">
              {photos.map((m) => <figure key={m.id}><img src={src(m.url)} alt="" /><figcaption>{m.caption ?? ''} {m.created_at.slice(0, 10)}</figcaption></figure>)}
            </div>
          </section>
        )}

        <footer className="rp-foot">تم إنشاء هذا التقرير من نظام «المشاريع» — {status?.companyName ?? ''}</footer>
      </article>
    </div>
  )
}
