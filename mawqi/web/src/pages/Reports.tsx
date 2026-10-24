import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Catalog } from './ReportView'
import { compact, fmt, sar } from '../api'
import { Icon } from '../icons'
import { download, ErrorBox, Loading, Meter, PageHead, ProjectSelect, Stat, thisMonth, useData } from '../ui'

interface Summary {
  month: string
  projects: { id: number; name: string; kind: string; contract_value: number; progress: number; labour: number; man_days: number; absences: number; billed: number; sub_cost: number; open_issues: number; iqama?: number; overhead?: number; total_cost?: number }[]
  overhead?: { salaries: number; iqama: number; total: number; share: number; projects: { id: number; name: string }[] }
}

const EXPORTS = [
  { kind: 'payroll', icon: 'money', title: 'مسير الرواتب', text: 'مستحق كل عامل حسب أيام العمل والإضافي', monthly: true },
  { kind: 'attendance', icon: 'attendance', title: 'كشف الحضور الشهري', text: 'جدول يومي لكل عامل (ح/غ/م/ج)', monthly: true },
  { kind: 'costs', icon: 'exports', title: 'تكاليف العمالة اليومية', text: 'تكلفة كل مشروع يوماً بيوم', monthly: true },
  { kind: 'workers', icon: 'workers', title: 'سجل العمال', text: 'البيانات والإقامات والأجور', monthly: false },
  { kind: 'issues', icon: 'issues', title: 'سجل البلاغات', text: 'كل المشاكل وحالتها وحلولها', monthly: false },
  { kind: 'invoices', icon: 'contracts', title: 'سجل المستخلصات', text: 'المالك ومقاولي الباطن', monthly: false },
]

export default function ReportsPage() {
  const [month, setMonth] = useState(thisMonth())
  const [project, setProject] = useState('')
  const { data, error } = useData<Summary>(`/api/reports/summary?month=${month}`)
  const cat = useData<Catalog>('/api/r')
  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />

  const rows = data.projects.filter((p) => !project || String(p.id) === project)
  const tot = rows.reduce((a, p) => ({ labour: a.labour + p.labour, days: a.days + p.man_days, abs: a.abs + p.absences, billed: a.billed + p.billed, sub: a.sub + p.sub_cost, real: a.real + (p.total_cost ?? p.labour) }), { labour: 0, days: 0, abs: 0, billed: 0, sub: 0, real: 0 })
  const groups = [...new Set((cat.data?.reports ?? []).map((r) => r.group))]
  const absRate = tot.days + tot.abs ? (tot.abs / (tot.days + tot.abs)) * 100 : 0
  const q = `month=${month}${project ? `&project=${project}` : ''}`

  return (
    <div className="page">
      <PageHead title="التقارير" sub="كل تقارير الشركة بفلاتر للفترة والمشروع والمهنة والحالة — للعرض والطباعة وExcel">
        <button className="btn" onClick={() => window.print()}><Icon name="print" size={18} /> طباعة / PDF</button>
      </PageHead>
      {groups.map((g) => (
        <section key={g} className="no-print">
          <h2 className="section-title">{g}</h2>
          <div className="exports">
            {cat.data!.reports.filter((r) => r.group === g).map((r) => (
              <Link key={r.kind} className="export" to={`/reports/${r.kind}`}>
                <span className="export-icon"><Icon name="report" size={24} /></span>
                <span><strong>{r.title}</strong><small>{r.text}</small></span>
                <Icon name="back" size={18} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <h2 className="section-title">ملخص الشهر</h2>
      <div className="toolbar">
        <input type="month" className="select" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <ProjectSelect value={project} onChange={setProject} />
      </div>

      <div className="stats printable">
        <Stat icon="money" label="التكلفة الفعلية للشهر" value={sar(tot.real)} sub={`منها عمالة ${compact(tot.labour)}`} />
        {data.overhead && data.overhead.total > 0 && <Stat icon="user" label="مصاريف الإدارة" value={sar(data.overhead.total)} sub={`÷ ${data.overhead.projects.length} مشروع = ${compact(data.overhead.share)} لكل مشروع`} />}
        <Stat icon="workers" label="أيام العمل (عامل × يوم)" value={fmt(tot.days)} />
        <Stat icon="user" label="نسبة الغياب" value={`${absRate.toFixed(1)}%`} tone={absRate > 8 ? 'bad' : 'good'} />
        <Stat icon="contracts" label="المستخلصات المعتمدة (تراكمي)" value={compact(tot.billed)} sub={`مقاولو الباطن ${compact(tot.sub)}`} tone="good" />
      </div>

      <section className="panel flush printable">
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>المشروع</th><th>الإنجاز</th><th>عمالة الشهر</th><th>تجديد إقامات</th><th>حصة الإدارة</th><th>التكلفة الفعلية</th><th>أيام عمل</th><th>غياب</th><th>المستخلص المعتمد</th><th>مقاولو الباطن</th><th>المتبقي من العقد</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong>{p.open_issues > 0 && <small className="warn-t">{p.open_issues} بلاغ مفتوح</small>}</td>
                  <td><div className="progress"><Meter value={p.progress} /><span>{fmt(p.progress)}%</span></div></td>
                  <td className="num">{sar(p.labour)}</td>
                  <td className="num">{p.iqama ? sar(p.iqama) : '—'}</td>
                  <td className="num">{p.overhead ? sar(p.overhead) : '—'}</td>
                  <td className="num strong">{sar(p.total_cost ?? p.labour)}</td>
                  <td className="num">{fmt(p.man_days)}</td>
                  <td className="num bad-t">{fmt(p.absences)}</td>
                  <td className="num">{compact(p.billed)}</td>
                  <td className="num">{compact(p.sub_cost)}</td>
                  <td className="num">{p.contract_value ? compact(p.contract_value - p.billed) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="section-title">ملفات Excel</h2>
      <div className="exports">
        {EXPORTS.map((e) => (
          <button key={e.kind} className="export" onClick={() => download(`/api/export/${e.kind}?${e.monthly ? q : project ? `project=${project}` : ''}`)}>
            <span className="export-icon"><Icon name={e.icon} size={26} /></span>
            <span><strong>{e.title}</strong><small>{e.text}{e.monthly ? ` — ${month}` : ''}</small></span>
            <Icon name="download" size={20} />
          </button>
        ))}
      </div>
    </div>
  )
}
