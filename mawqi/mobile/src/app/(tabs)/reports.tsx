import { useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fileUrl, fmt, longDate, sar, today, type Meta, type Report } from '../../lib/api'
import { useData } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { useToast } from '../../components/Toast'
import { C, Card, Chip, Empty, ErrorBox, Header, Loading, Meter, Row, Sheet, T, type IconName } from '../../components/ui'

interface Summary {
  month: string
  projects: { id: number; name: string; kind?: string; contract_value: number; progress: number; labour: number; man_days: number; absences: number; billed: number; sub_cost: number; open_issues: number }[]
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}
const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)} مليون` : Math.abs(n) >= 1e4 ? `${fmt(n / 1e3)} ألف` : fmt(n))

const FILES: { kind: string; icon: IconName; title: string; sub: string; monthly: boolean }[] = [
  { kind: 'payroll', icon: 'cash', title: 'مسير الرواتب', sub: 'مستحق كل عامل حسب أيام العمل والإضافي', monthly: true },
  { kind: 'attendance', icon: 'calendar', title: 'كشف الحضور الشهري', sub: 'جدول يومي لكل عامل', monthly: true },
  { kind: 'costs', icon: 'stats-chart', title: 'تكاليف العمالة اليومية', sub: 'تكلفة كل مشروع يوماً بيوم', monthly: true },
  { kind: 'workers', icon: 'people', title: 'سجل العمال', sub: 'البيانات والإقامات والأجور', monthly: false },
  { kind: 'issues', icon: 'warning', title: 'سجل البلاغات', sub: 'كل المشاكل وحالتها وحلولها', monthly: false },
  { kind: 'invoices', icon: 'receipt', title: 'سجل المستخلصات', sub: 'المالك ومقاولو الباطن', monthly: false },
]

export default function Reports() {
  const thisMonth = today().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [project, setProject] = useState<number | null>(null)
  const [tab, setTab] = useState<'summary' | 'daily' | 'files'>('summary')
  const meta = useData<Meta>('/api/meta')
  const summary = useData<Summary>(`/api/reports/summary?month=${month}`)
  const daily = useData<Report[]>(`/api/daily-reports${project ? `?project=${project}` : ''}`)
  const [open, setOpen] = useState<Report | null>(null)
  const toast = useToast()

  const places = (meta.data?.projects ?? []).filter((p) => p.status === 'active')
  const rows = (summary.data?.projects ?? []).filter((p) => !project || p.id === project)
  const tot = rows.reduce((a, p) => ({ labour: a.labour + p.labour, days: a.days + p.man_days, abs: a.abs + p.absences, billed: a.billed + p.billed, issues: a.issues + p.open_issues }),
    { labour: 0, days: 0, abs: 0, billed: 0, issues: 0 })
  const absRate = tot.days + tot.abs ? (tot.abs / (tot.days + tot.abs)) * 100 : 0
  const reports = (daily.data ?? []).filter((r) => r.date.startsWith(month))

  const download = async (kind: string, monthly: boolean) => {
    const q = [monthly ? `month=${month}` : '', project ? `project=${project}` : ''].filter(Boolean).join('&')
    try { await Linking.openURL(fileUrl(`/api/export/${kind}${q ? `?${q}` : ''}`)) } catch { toast('تعذر فتح الملف', 'error') }
  }
  const refresh = () => { summary.refresh(); daily.refresh() }

  return (
    <AppScreen inTabs onRefresh={refresh} refreshing={summary.refreshing || daily.refreshing} header={<Header title="التقارير" sub="كل تقارير المشاريع في مكان واحد" />}>
      {/* month */}
      <Card style={s.monthBar}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10} accessibilityLabel="الشهر السابق" style={s.arrow}>
          <Ionicons name="chevron-forward" size={26} color={C.navy} />
        </Pressable>
        <T w="black" style={{ flex: 1, textAlign: 'center', fontSize: 19, color: C.navy }}>{monthLabel(month)}</T>
        <Pressable onPress={() => month < thisMonth && setMonth(shiftMonth(month, 1))} hitSlop={10} accessibilityLabel="الشهر التالي" style={[s.arrow, month >= thisMonth && { opacity: 0.3 }]}>
          <Ionicons name="chevron-back" size={26} color={C.navy} />
        </Pressable>
      </Card>

      {/* project filter */}
      {places.length > 1 && (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="الكل" active={project === null} onPress={() => setProject(null)} />
          {places.map((p) => <Chip key={p.id} label={`${p.kind === 'factory' ? '🏭 ' : ''}${p.name}`} active={project === p.id} onPress={() => setProject(p.id)} />)}
        </Row>
      )}

      <Row style={s.tabs}>
        {([['summary', 'ملخص الشهر'], ['daily', 'التقارير اليومية'], ['files', 'ملفات Excel']] as const).map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <T w="bold" style={{ color: tab === k ? C.navy : C.muted, fontSize: 15, textAlign: 'center' }}>{l}</T>
          </Pressable>
        ))}
      </Row>

      {tab === 'summary' && (!summary.data ? (summary.loading ? <Loading /> : <ErrorBox text={summary.error ?? ''} onRetry={summary.refresh} />) : (
        <>
          <Row style={{ gap: 10 }}>
            <Big label="تكلفة العمالة" value={sar(tot.labour)} color={C.navy} />
            <Big label="أيام العمل" value={fmt(tot.days)} color={C.good} />
          </Row>
          <Row style={{ gap: 10 }}>
            <Big label="نسبة الغياب" value={`${absRate.toFixed(1)}%`} color={absRate > 8 ? C.bad : C.good} />
            <Big label="بلاغات مفتوحة" value={fmt(tot.issues)} color={tot.issues ? C.amber : C.good} />
          </Row>
          {rows.length === 0 ? <Empty icon="document-text-outline" title="لا توجد بيانات لهذا الشهر" /> : rows.map((p) => (
            <Card key={p.id} style={{ gap: 8 }}>
              <Row>
                <T w="black" style={{ flex: 1, fontSize: 17, color: C.navy }}>{p.kind === 'factory' ? '🏭 ' : ''}{p.name}</T>
                {p.kind !== 'factory' && <T w="black" style={{ color: C.amber }}>{fmt(p.progress)}%</T>}
              </Row>
              {p.kind !== 'factory' && <Meter value={p.progress / 100} color={C.amber} />}
              <Line label="عمالة الشهر" value={sar(p.labour)} />
              <Line label="أيام عمل / غياب" value={`${fmt(p.man_days)} / ${fmt(p.absences)}`} />
              {p.billed > 0 && <Line label="المستخلصات المعتمدة" value={`${compact(p.billed)} ر.س`} />}
              {p.contract_value > 0 && <Line label="المتبقي من العقد" value={`${compact(p.contract_value - p.billed)} ر.س`} />}
            </Card>
          ))}
        </>
      ))}

      {tab === 'daily' && (!daily.data ? (daily.loading ? <Loading /> : <ErrorBox text={daily.error ?? ''} onRetry={daily.refresh} />)
        : reports.length === 0 ? <Empty icon="document-text-outline" title="لا توجد تقارير يومية في هذا الشهر" />
        : reports.map((r) => (
          <Pressable key={r.id} onPress={() => setOpen(r)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <Card style={{ gap: 6 }}>
              <Row>
                <T w="black" style={{ flex: 1, fontSize: 16, color: C.navy }}>{r.project}</T>
                <T style={{ color: C.muted, fontSize: 14 }}>{longDate(r.date)}</T>
              </Row>
              <T numberOfLines={2} style={{ color: C.ink2 }}>{r.work_done}</T>
              <Row>
                <T w="bold" style={{ color: C.good, fontSize: 14 }}>{r.present} حاضر</T>
                {r.absent > 0 && <T w="bold" style={{ color: C.bad, fontSize: 14 }}>{r.absent} غائب</T>}
                <View style={{ flex: 1 }} />
                <T style={{ color: C.muted, fontSize: 13 }}>{r.author ?? ''}</T>
              </Row>
            </Card>
          </Pressable>
        )))}

      {tab === 'files' && (
        <>
          <T style={{ color: C.muted }}>يفتح الملف في المتصفح ويُحمّل كملف Excel {project ? 'للمشروع المختار' : 'لكل المشاريع'}.</T>
          {FILES.map((f) => (
            <Pressable key={f.kind} onPress={() => download(f.kind, f.monthly)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <Card style={s.file}>
                <View style={s.fileIcon}><Ionicons name={f.icon} size={26} color={C.amber} /></View>
                <View style={{ flex: 1 }}>
                  <T w="bold" style={{ fontSize: 17 }}>{f.title}</T>
                  <T style={{ color: C.muted, fontSize: 14 }}>{f.sub}{f.monthly ? ` — ${monthLabel(month)}` : ''}</T>
                </View>
                <Ionicons name="download-outline" size={24} color={C.navy} />
              </Card>
            </Pressable>
          ))}
        </>
      )}

      <Sheet visible={!!open} title={open ? `${open.project} — ${longDate(open.date)}` : ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <Row style={{ flexWrap: 'wrap', gap: 14 }}>
              {!!open.weather && <T>☀️ {open.weather}</T>}
              <T w="bold" style={{ color: C.good }}>{open.present} حاضر</T>
              <T w="bold" style={{ color: C.bad }}>{open.absent} غائب</T>
              {open.progress !== null && <T w="bold" style={{ color: C.amber }}>الإنجاز {open.progress}%</T>}
            </Row>
            <Block title="الأعمال المنفذة" text={open.work_done} />
            <Block title="خطة الغد" text={open.next_plan} />
            <Block title="المعدات" text={open.equipment} />
            <Block title="المواد الواردة" text={open.materials} />
            <Block title="العوائق والملاحظات" text={open.obstacles} />
            {!!open.author && <T style={{ color: C.muted }}>بواسطة: {open.author}</T>}
          </>
        )}
      </Sheet>
    </AppScreen>
  )
}

function Big({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, gap: 2 }}>
      <T style={{ color: C.ink2, fontSize: 14 }}>{label}</T>
      <T w="black" style={{ color, fontSize: 22 }} adjustsFontSizeToFit numberOfLines={1}>{value}</T>
    </Card>
  )
}
const Line = ({ label, value }: { label: string; value: string }) => (
  <Row><T style={{ flex: 1, color: C.muted }}>{label}</T><T w="bold">{value}</T></Row>
)
const Block = ({ title, text }: { title: string; text: string | null }) => (text ? (
  <View style={{ gap: 4 }}><T w="black" style={{ color: C.navy }}>{title}</T><T style={{ color: C.ink2, lineHeight: 26 }}>{text}</T></View>
) : null)

const s = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 },
  arrow: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.navySoft, alignItems: 'center', justifyContent: 'center' },
  tabs: { backgroundColor: '#ebe7e2', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabOn: { backgroundColor: '#fff' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.amberSoft, alignItems: 'center', justifyContent: 'center' },
})
