import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, longDate, sar, shortDate, type Alert, type Dashboard, type ProjectRow } from '../api'
import { Icon } from '../icons'
import { useLive } from '../useLive'

const STATUS = { present: '#0ca30c', late: '#fab219', leave: '#a3a29b', absent: '#d03b3b' }
const ALERT_ICON: Record<Alert['type'], string> = { understaffed: 'workers', absence_streak: 'user', overdue_issue: 'issues', iqama_expiry: 'id' }
const ALERT_FILTERS: { key: Alert['type'] | 'all'; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'understaffed', label: 'نقص عمالة' },
  { key: 'absence_streak', label: 'غياب متكرر' },
  { key: 'overdue_issue', label: 'بلاغات متأخرة' },
  { key: 'iqama_expiry', label: 'إقامات' },
]

export default function DashboardPage() {
  const { data, error, connected, updatedAt } = useLive<Dashboard>('/api/dashboard')

  if (error && !data) return <div className="empty"><h2>تعذر تحميل البيانات</h2><p>{error}</p></div>
  if (!data) return <div className="empty"><p>جارٍ التحميل…</p></div>

  const c = data.cards
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>لوحة التحكم</h1>
          <p className="muted">{longDate(data.date)}</p>
        </div>
        <LiveBadge connected={connected} updatedAt={updatedAt} />
      </header>

      <section className="kpis">
        <Kpi icon="workers" label="إجمالي العمال" value={fmt(c.totalWorkers)} tone="navy" />
        <Kpi icon="attendance" label="الحاضرون اليوم" value={fmt(c.presentToday)} tone="good"
          sub={`${Math.round((c.presentToday / Math.max(c.totalWorkers, 1)) * 100)}% من العمال`} />
        <Kpi icon="user" label="الغائبون" value={fmt(c.absentToday)} tone="bad"
          sub={`${fmt(c.onLeaveToday)} إجازة · ${fmt(c.notRecorded)} لم يُحضَّر`} />
        <Kpi icon="issues" label="المشاكل المفتوحة" value={fmt(c.openIssues)} tone="warn" />
        <Kpi icon="money" label="تكلفة العمالة اليوم" value={sar(c.costToday)} tone="navy" sub={`الشهر: ${sar(c.costMonth)}`} />
      </section>

      <ProjectsTable rows={data.projects} />

      <div className="grid-2">
        <div className="stack">
          <AttendanceChart series={data.attendanceSeries} />
          <CostChart rows={data.projects} />
        </div>
        <AlertsPanel alerts={data.alerts} />
      </div>
    </div>
  )
}

function LiveBadge({ connected, updatedAt }: { connected: boolean; updatedAt: Date | null }) {
  return (
    <div className={`live ${connected ? 'on' : 'off'}`}>
      <span className="dot" />
      <span>{connected ? 'متصل مباشر' : 'غير متصل'}</span>
      {updatedAt && <small>آخر تحديث {updatedAt.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>}
    </div>
  )
}

function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-icon"><Icon name={icon} size={26} /></div>
      <div>
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  )
}

function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const [q, setQ] = useState('')
  const [onlyShort, setOnlyShort] = useState(false)
  const shown = useMemo(() => rows.filter((p) =>
    (!q || `${p.name} ${p.city} ${p.supervisor}`.includes(q.trim())) &&
    (!onlyShort || p.present < p.planned_workers * 0.8)), [rows, q, onlyShort])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>المشاريع</h2>
        <div className="filters">
          <label className="search"><Icon name="search" size={18} /><input placeholder="بحث بالاسم أو المدينة أو المشرف" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="toggle"><input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} /> نقص عمالة فقط</label>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>المشروع</th><th>الحضور / المخطط</th><th>نسبة الإنجاز</th><th>مشاكل مفتوحة</th><th>تكلفة اليوم</th><th>تكلفة الشهر</th></tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const ratio = p.present / p.planned_workers
              const short = ratio < 0.8
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><small>{p.city} · المشرف: {p.supervisor}</small></td>
                  <td>
                    <div className={`staff ${short ? 'short' : ''}`}>
                      <span><b>{p.present}</b> / {p.planned_workers}</span>
                      {short && <em><Icon name="warning" size={14} /> نقص {Math.round((1 - ratio) * 100)}%</em>}
                    </div>
                    <div className="meter"><i style={{ width: `${Math.min(ratio, 1) * 100}%` }} className={short ? 'bad' : 'good'} /></div>
                  </td>
                  <td>
                    <div className="progress"><div className="meter"><i style={{ width: `${p.progress}%` }} /></div><span>{fmt(p.progress)}%</span></div>
                  </td>
                  <td>{p.open_issues > 0 ? <span className="pill warn">{p.open_issues}</span> : <span className="pill ok">0</span>}</td>
                  <td className="num">{sar(p.cost_today)}</td>
                  <td className="num">{sar(p.cost_month)}</td>
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={6} className="muted center">لا توجد نتائج</td></tr>}
          </tbody>
        </table>
      </div>
      <ul className="pcards">
        {shown.map((p) => {
          const ratio = p.present / p.planned_workers
          const short = ratio < 0.8
          return (
            <li key={p.id} className={short ? 'short' : ''}>
              <div className="pc-top">
                <div><strong>{p.name}</strong><small>{p.city} · {p.supervisor}</small></div>
                <div className="pc-staff"><b>{p.present}</b> من {p.planned_workers}<small>حاضر / مخطط</small></div>
              </div>
              <div className="meter"><i style={{ width: `${Math.min(ratio, 1) * 100}%` }} className={short ? 'bad' : 'good'} /></div>
              <div className="pc-stats">
                <span>الإنجاز <b>{fmt(p.progress)}%</b></span>
                <span>مشاكل <b>{p.open_issues}</b></span>
                <span>اليوم <b>{sar(p.cost_today)}</b></span>
              </div>
            </li>
          )
        })}
        {!shown.length && <li className="muted center">لا توجد نتائج</li>}
      </ul>
    </section>
  )
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const [f, setF] = useState<Alert['type'] | 'all'>('all')
  const shown = f === 'all' ? alerts : alerts.filter((a) => a.type === f)
  return (
    <section className="panel alerts">
      <div className="panel-head">
        <h2><Icon name="bell" size={20} /> التنبيهات <span className="count">{alerts.length}</span></h2>
      </div>
      <div className="chips">
        {ALERT_FILTERS.map((x) => (
          <button key={x.key} className={`chip ${f === x.key ? 'active' : ''}`} onClick={() => setF(x.key)}>{x.label}</button>
        ))}
      </div>
      <ul>
        {shown.map((a, i) => (
          <li key={i} className={`alert lvl-${a.level}`}>
            <span className="alert-icon"><Icon name={ALERT_ICON[a.type]} size={20} /></span>
            <div><strong>{a.title}</strong><small>{a.detail}</small></div>
          </li>
        ))}
        {!shown.length && <li className="muted center">لا توجد تنبيهات</li>}
      </ul>
    </section>
  )
}

const tooltipStyle = { fontFamily: 'Cairo', borderRadius: 10, border: '1px solid #e3e6ea', direction: 'rtl' as const }

function AttendanceChart({ series }: { series: Dashboard['attendanceSeries'] }) {
  const data = series.map((d) => ({ ...d, label: shortDate(d.date) }))
  return (
    <section className="panel">
      <div className="panel-head"><h2>الحضور خلال آخر 30 يوماً</h2></div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="#eceef1" />
            <XAxis dataKey="label" reversed tick={{ fontSize: 12, fill: '#6b7380' }} tickLine={false} axisLine={{ stroke: '#d5d9df' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis orientation="right" tick={{ fontSize: 12, fill: '#6b7380' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,42,68,.06)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontFamily: 'Cairo', fontSize: 14 }} />
            <Bar dataKey="present" name="حاضر" stackId="a" fill={STATUS.present} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="late" name="متأخر" stackId="a" fill={STATUS.late} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="leave" name="إجازة" stackId="a" fill={STATUS.leave} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="absent" name="غائب" stackId="a" fill={STATUS.absent} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function CostChart({ rows }: { rows: ProjectRow[] }) {
  const data = [...rows].sort((a, b) => b.cost_month - a.cost_month)
  const max = Math.max(...data.map((p) => p.cost_month), 1)
  return (
    <section className="panel">
      <div className="panel-head"><h2>تكلفة العمالة لكل مشروع (الشهر الحالي)</h2></div>
      <ul className="hbars">
        {data.map((p) => (
          <li key={p.id} title={`${p.name}: ${sar(p.cost_month)}`}>
            <span className="hbar-label">{p.name}</span>
            <div className="hbar-track"><i style={{ width: `${(p.cost_month / max) * 100}%` }} /></div>
            <span className="hbar-value">{sar(p.cost_month)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
