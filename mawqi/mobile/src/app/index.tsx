import { useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fmt, longDate, sar, shortDate, type Alert, type Dashboard } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLive } from '../lib/useLive'
import { C, Card, Meter, T } from '../components/ui'

const LEVEL = { high: C.bad, medium: C.late, low: C.blue }
const ALERT_TAG: Record<Alert['type'], string> = { understaffed: 'نقص عمالة', absence_streak: 'غياب متكرر', overdue_issue: 'بلاغ متأخر', iqama_expiry: 'إقامة' }

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const { data, error, connected, refreshing, refresh } = useLive<Dashboard>('/api/dashboard')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLogo}><Image source={require('../../assets/logo.png')} style={{ width: 30, height: 38 }} resizeMode="contain" /></View>
        <View style={{ flex: 1 }}>
          <T w="black" style={{ color: '#fff', fontSize: 22 }}>لوحة التحكم</T>
          <T style={{ color: '#b9b3dc', fontSize: 13 }}>{user?.name} · {user?.roleLabel}</T>
        </View>
        <View style={[s.live, { backgroundColor: connected ? 'rgba(12,163,12,.18)' : 'rgba(208,59,59,.2)' }]}>
          <View style={[s.dot, { backgroundColor: connected ? '#3ddc3d' : C.bad }]} />
          <T w="semibold" style={{ color: '#fff', fontSize: 13 }}>{connected ? 'متصل' : 'غير متصل'}</T>
        </View>
        <Pressable onPress={logout} style={s.logout}><T w="semibold" style={{ color: '#b9b3dc', fontSize: 13 }}>خروج</T></Pressable>
      </View>

      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {!data ? (
          <T style={{ textAlign: 'center', color: error ? C.bad : C.muted, marginTop: 40 }}>{error ?? 'جارٍ التحميل…'}</T>
        ) : (
          <Content d={data} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Content({ d }: { d: Dashboard }) {
  const c = d.cards
  return (
    <>
      <T style={{ color: C.muted }}>{longDate(d.date)}</T>
      <View style={s.kpis}>
        <Kpi label="إجمالي العمال" value={fmt(c.totalWorkers)} color={C.navy} />
        <Kpi label="الحاضرون اليوم" value={fmt(c.presentToday)} color={C.good} sub={`${Math.round((c.presentToday / Math.max(1, c.totalWorkers)) * 100)}%`} />
        <Kpi label="الغائبون" value={fmt(c.absentToday)} color={C.bad} sub={`${c.onLeaveToday} إجازة · ${c.notRecorded} لم يُحضَّر`} />
        <Kpi label="مشاكل مفتوحة" value={fmt(c.openIssues)} color={C.warn} />
      </View>
      <Card style={s.costCard}>
        <View>
          <T w="semibold" style={{ color: '#b9b3dc' }}>تكلفة العمالة اليوم</T>
          <T w="black" style={{ color: '#fff', fontSize: 28 }}>{sar(c.costToday)}</T>
        </View>
        <View>
          <T style={{ color: '#b9b3dc', fontSize: 13 }}>الشهر الحالي</T>
          <T w="bold" style={{ color: C.amber, fontSize: 18 }}>{sar(c.costMonth)}</T>
        </View>
      </Card>

      <Alerts alerts={d.alerts} />
      <Projects d={d} />
      <AttendanceBars series={d.attendanceSeries.slice(-14)} />
      <CostBars d={d} />
    </>
  )
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <Card style={s.kpi}>
      <View style={[s.kpiBar, { backgroundColor: color }]} />
      <T w="semibold" style={{ color: C.ink2, fontSize: 15 }}>{label}</T>
      <T w="black" style={{ fontSize: 32, color, lineHeight: 42 }}>{value}</T>
      {!!sub && <T style={{ color: C.muted, fontSize: 12 }}>{sub}</T>}
    </Card>
  )
}

function Section({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.row}>
        <T w="bold" style={{ fontSize: 19, color: C.navy, flex: 1 }}>{title}</T>
        {extra}
      </View>
      {children}
    </Card>
  )
}

function Alerts({ alerts }: { alerts: Alert[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? alerts : alerts.slice(0, 4)
  return (
    <Section title="التنبيهات" extra={<View style={s.count}><T w="bold" style={{ color: '#fff', fontSize: 13 }}>{alerts.length}</T></View>}>
      {shown.map((a, i) => (
        <View key={i} style={[s.alert, { borderStartColor: LEVEL[a.level] }]}>
          <T w="semibold" style={{ fontSize: 12, color: LEVEL[a.level] }}>{ALERT_TAG[a.type]}</T>
          <T w="bold" style={{ fontSize: 15 }}>{a.title}</T>
          <T style={{ fontSize: 13, color: C.ink2 }}>{a.detail}</T>
        </View>
      ))}
      {alerts.length > 4 && (
        <Pressable onPress={() => setAll(!all)} style={s.more}>
          <T w="semibold" style={{ color: C.navy }}>{all ? 'عرض أقل' : `عرض الكل (${alerts.length})`}</T>
        </Pressable>
      )}
    </Section>
  )
}

function Projects({ d }: { d: Dashboard }) {
  const [q, setQ] = useState('')
  const shown = d.projects.filter((p) => !q || `${p.name} ${p.city} ${p.supervisor}`.includes(q.trim()))
  return (
    <Section title="المشاريع">
      <TextInput value={q} onChangeText={setQ} placeholder="بحث بالاسم أو المدينة أو المشرف" placeholderTextColor={C.muted} style={s.search} />
      {shown.map((p) => {
        const ratio = p.present / p.planned_workers
        const short = ratio < 0.8
        return (
          <View key={p.id} style={[s.project, { borderStartColor: short ? C.bad : C.good }]}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <T w="bold" style={{ fontSize: 17 }}>{p.name}</T>
                <T style={{ fontSize: 13, color: C.muted }}>{p.city} · {p.supervisor}</T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T w="black" style={{ fontSize: 24, color: short ? C.bad : C.ink, lineHeight: 30 }}>{p.present} <T style={{ fontSize: 15, color: C.ink2 }}>من {p.planned_workers}</T></T>
                <T style={{ fontSize: 11, color: C.muted }}>حاضر / مخطط</T>
              </View>
            </View>
            <Meter value={ratio} color={short ? C.bad : C.good} />
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 6 }]}>
              <T style={s.stat}>الإنجاز <T w="bold" style={s.stat}>{p.progress}%</T></T>
              <T style={s.stat}>مشاكل <T w="bold" style={s.stat}>{p.open_issues}</T></T>
              <T style={s.stat}>اليوم <T w="bold" style={s.stat}>{sar(p.cost_today)}</T></T>
            </View>
          </View>
        )
      })}
      {!shown.length && <T style={{ color: C.muted, textAlign: 'center' }}>لا توجد نتائج</T>}
    </Section>
  )
}

const SERIES = [
  { key: 'present', label: 'حاضر', color: C.good },
  { key: 'late', label: 'متأخر', color: C.late },
  { key: 'leave', label: 'إجازة', color: C.leave },
  { key: 'absent', label: 'غائب', color: C.bad },
] as const

function AttendanceBars({ series }: { series: Dashboard['attendanceSeries'] }) {
  const max = Math.max(...series.map((d) => d.present + d.late + d.leave + d.absent), 1)
  const [sel, setSel] = useState<number | null>(null)
  const picked = sel !== null ? series[sel] : series[series.length - 1]
  return (
    <Section title="الحضور — آخر 14 يوم عمل">
      <View style={s.legend}>
        {SERIES.map((x) => (
          <View key={x.key} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: x.color }]} />
            <T style={{ fontSize: 13 }}>{x.label} <T w="bold" style={{ fontSize: 13 }}>{picked?.[x.key]}</T></T>
          </View>
        ))}
      </View>
      <T style={{ fontSize: 12, color: C.muted }}>{picked ? shortDate(picked.date) : ''} — اضغط على أي عمود لعرض تفاصيله</T>
      <View style={s.bars}>
        {series.map((d, i) => (
          <Pressable key={d.date} style={[s.barCol, sel === i && { backgroundColor: '#ebe9f6' }]} onPress={() => setSel(i)}>
            <View style={{ height: 150, justifyContent: 'flex-end' }}>
              {[...SERIES].reverse().map((x) => (
                <View key={x.key} style={{ height: (d[x.key] / max) * 150, backgroundColor: x.color, borderBottomWidth: d[x.key] ? 1 : 0, borderColor: '#fff' }} />
              ))}
            </View>
            <T style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>{Number(d.date.slice(8))}</T>
          </Pressable>
        ))}
      </View>
    </Section>
  )
}

function CostBars({ d }: { d: Dashboard }) {
  const rows = [...d.projects].sort((a, b) => b.cost_month - a.cost_month)
  const max = Math.max(...rows.map((p) => p.cost_month), 1)
  return (
    <Section title="تكلفة العمالة لكل مشروع (الشهر)">
      {rows.map((p) => (
        <View key={p.id} style={{ gap: 4 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T w="semibold" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{p.name}</T>
            <T w="bold" style={{ fontSize: 14 }}>{sar(p.cost_month)}</T>
          </View>
          <View style={{ height: 14, backgroundColor: '#f1f3f5', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: `${(p.cost_month / max) * 100}%`, height: '100%', backgroundColor: C.blue, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </Section>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  headerLogo: { width: 42, height: 48, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  logout: { paddingHorizontal: 8, paddingVertical: 4 },
  body: { padding: 14, gap: 14, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '47%', flexGrow: 1, paddingTop: 18, overflow: 'hidden' },
  kpiBar: { position: 'absolute', top: 0, start: 0, end: 0, height: 4 },
  costCard: { backgroundColor: C.navy, borderColor: C.navy, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  count: { backgroundColor: C.bad, borderRadius: 99, paddingHorizontal: 9 },
  alert: { borderWidth: 1, borderColor: C.line, borderStartWidth: 4, borderRadius: 12, padding: 10 },
  more: { alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#ebe9f6' },
  search: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: 'Tajawal_400Regular', backgroundColor: '#fafbfc', textAlign: 'right' },
  project: { borderWidth: 1, borderColor: C.line, borderStartWidth: 4, borderRadius: 12, padding: 12, gap: 6 },
  stat: { fontSize: 13, color: C.ink2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  barCol: { flex: 1, borderRadius: 4, paddingTop: 4, overflow: 'hidden' },
})
